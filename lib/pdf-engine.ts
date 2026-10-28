import { readPdfText } from './pdf-text';
import { PDFDocument, PDFDict, PDFName, StandardFonts, degrees, rgb, type PDFPage } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfReport } from './pdf-report';
import type { Language } from './ui-language';

export type Source = {
  id: string;
  name: string;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
  size: number;
  kind: 'pdf' | 'image' | 'invoice';
  wasEncrypted?: boolean;
  invoiceOriginal?: { bytes: Uint8Array; name: string };
  /** Digest of the uploaded bytes, before image conversion or PDF decryption. */
  originalDigest?: string;
};
export type PageItem = {
  id: string;
  sourceId: string;
  index: number;
  rotation: number;
  selected: boolean;
};
export type ToolId =
  | 'ocr'
  | 'merge'
  | 'split'
  | 'organize'
  | 'images'
  | 'to-images'
  | 'compress'
  | 'watermark'
  | 'numbers';
export type JobOptions = {
  language: string;
  ocrLayout?: string;
  forceOcr: boolean;
  autoLanguage?: boolean;
  imageFormat: string;
  quality: string;
  compressionMode?: 'preserve' | 'lossless' | 'raster';
  watermark: string;
  numberStart: number;
};
export type JobResult = {
  blob: Blob;
  filename: string;
  kind: 'pdf' | 'zip' | 'report';
  text?: string;
  pages: number;
  inputSize: number;
  report?: PdfReport;
  note?: string;
  ocrData?: import('./ocr-document').OcrResultPage[];
  ocrBase?: Blob;
  editorVerification?: import('./editor-verification').EditorVerification;
};
export type ProgressUpdate = { percent: number; label: string };
type Report = (progress: ProgressUpdate) => void;

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | undefined;
/** WebKit can complete a large worker ImageBitmap transfer with missing pixels.
 * Use PDF.js's typed pixel-data path there for previews, OCR and verification.
 * This changes decoding, never the source image dimensions or PDF contents. */
export function pdfImageOptions(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
) {
  const webkit =
    /AppleWebKit\//.test(userAgent) &&
    (!/(?:Chrome|Chromium|Edg|OPR|SamsungBrowser)\//.test(userAgent) ||
      /iP(?:ad|hone|od)/.test(userAgent));
  return webkit ? { isOffscreenCanvasSupported: false } : {};
}
// Keep the renderer and local worker on PDF.js's polyfilled build. The modern
// build needs APIs such as Map.getOrInsertComputed that older browsers lack.
async function getPdfJs() {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf/pdf.worker.min.mjs';
    return pdfjs;
  });
  return pdfjsPromise;
}
export const uid = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
// Unlike crypto.randomUUID, getRandomValues also works on local HTTP origins.
export function uuid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const MAX_BYTES = 80 * 1024 * 1024;
export const MAX_PAGES = 200;
export function formatSize(bytes: number, locale = 'de-DE') {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}
export function pdfBlob(bytes: Uint8Array) {
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
// PDFDocument.getForm() deletes XFA as a side effect. Inspect the catalog first,
// including indirect AcroForm dictionaries, before ever calling that API.
export function hasXfaForm(doc: PDFDocument): boolean {
  return doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)?.has(PDFName.of('XFA')) ?? false;
}
export function requireAcroForm(doc: PDFDocument) {
  if (hasXfaForm(doc))
    throw new Error(
      'Dieses PDF verwendet XFA. Dieses Werkzeug kann die dynamischen Formularinhalte nicht zuverlässig übernehmen. Bitte eine gewöhnliche PDF-Version aus der ursprünglichen Formularanwendung verwenden.',
    );
  return doc.getForm();
}
export function filenameStem(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .slice(0, 100) || 'Dokument'
  );
}
function aborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
}
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(
        signal.reason instanceof Error && signal.reason.name !== 'AbortError'
          ? signal.reason
          : new DOMException('Abgebrochen', 'AbortError'),
      );
    if (signal.aborted) {
      promise.catch(() => {});
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export class PdfTimeoutError extends Error {
  constructor(readonly stage: string) {
    super(
      'Die PDF-Prüfung hat zu lange gedauert. Bitte erneut versuchen. Deine Bearbeitung bleibt geöffnet.',
    );
    this.name = 'PdfTimeoutError';
  }
}

/** Own the renderer used by temporary checks, including its actual worker.
 * PDF.js may leave reads or Terminate acknowledgements pending after a worker
 * stops replying. Cancellation must not depend on that same worker replying.
 * Original workspace documents never belong to this temporary session. */
export async function withPdfDocument<T>(
  bytes: Uint8Array | Blob,
  parent: AbortSignal,
  inspect: (
    pdf: PDFDocumentProxy,
    signal: AbortSignal,
    step: <V>(stage: string, operation: Promise<V>) => Promise<V>,
  ) => Promise<T>,
  options: { disableFontFace?: boolean; discard?: (value: T) => void } = {},
): Promise<T> {
  parent.throwIfAborted();
  const controller = new AbortController(),
    signal = controller.signal;
  const abort = () => controller.abort(parent.reason);
  parent.addEventListener('abort', abort, { once: true });
  const step = async <V>(stage: string, operation: Promise<V>): Promise<V> => {
    const timer = setTimeout(() => controller.abort(new PdfTimeoutError(stage)), 60000);
    try {
      const value = await abortable(operation, signal);
      signal.throwIfAborted();
      return value;
    } finally {
      clearTimeout(timer);
    }
  };
  let worker: InstanceType<typeof import('pdfjs-dist/legacy/build/pdf.mjs').PDFWorker> | undefined,
    task: ReturnType<typeof import('pdfjs-dist/legacy/build/pdf.mjs').getDocument> | undefined,
    closing: Promise<void> | undefined,
    finished = false,
    delivered = false,
    discarded = false,
    hasResult = false,
    result: T;
  const discard = () => {
    if (!hasResult || discarded || delivered) return;
    discarded = true;
    options.discard?.(result);
  };
  const close = () => {
    closing ??= (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Explicitly supplied PDFWorker instances are not owned by PDF.js's
        // loading task. Give graceful shutdown a bounded chance, then always
        // terminate the owned worker even if its acknowledgement never arrives.
        await Promise.race([
          Promise.resolve()
            .then(() => task?.destroy())
            .catch(() => {}),
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 1500);
          }),
        ]);
      } finally {
        clearTimeout(timer);
        worker?.destroy();
      }
    })();
    return closing;
  };
  const stop = () => {
    void close();
  };
  try {
    const pdfjs = await step('renderer-load', getPdfJs());
    signal.throwIfAborted();
    worker = new pdfjs.PDFWorker();
    let range: InstanceType<typeof pdfjs.PDFDataRangeTransport> | undefined;
    if (bytes instanceof Blob) {
      const file = bytes;
      const initial = new Uint8Array(await step('file-header', file.slice(0, 65536).arrayBuffer()));
      class LocalFileRange extends pdfjs.PDFDataRangeTransport {
        requestDataRange(begin: number, end: number) {
          void file
            .slice(begin, end)
            .arrayBuffer()
            .then((buffer) => {
              if (!signal.aborted) this.onDataRange(begin, new Uint8Array(buffer));
            })
            .catch((error) => controller.abort(error));
        }
      }
      range = new LocalFileRange(file.size, initial);
    }
    task = pdfjs.getDocument({
      ...pdfImageOptions(),
      ...(range
        ? {
            range,
            length: (bytes as Blob).size,
            rangeChunkSize: 262144,
            disableAutoFetch: true,
            disableStream: true,
          }
        : { data: (bytes as Uint8Array).slice() }),
      worker,
      cMapUrl: '/vendor/pdf/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/vendor/pdf/standard_fonts/',
      wasmUrl: '/vendor/pdf/wasm/',
      fontExtraProperties: true,
      ...(options.disableFontFace ? { disableFontFace: true } : {}),
    });
    signal.addEventListener('abort', stop, { once: true });
    const pdf = await step('document-open', task.promise);
    const operation = inspect(pdf, signal, step).then((value) => {
      result = value;
      hasResult = true;
      if (finished) discard();
      return value;
    });
    const value = await abortable(operation, signal);
    await close();
    signal.throwIfAborted();
    delivered = true;
    return value;
  } finally {
    finished = true;
    parent.removeEventListener('abort', abort);
    signal.removeEventListener('abort', stop);
    await close();
    discard();
  }
}
export async function openSource(
  file: File,
  options: { requestPassword?: (name: string, failed: boolean) => Promise<string | null> } = {},
): Promise<Source> {
  if (file.size > MAX_BYTES)
    throw new Error('Diese Datei ist größer als 80 MB. Bitte verwende eine kleinere Datei.');
  if (!file.size) throw new Error('Die Datei ist leer.');
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  let kind: Source['kind'] = 'pdf';
  let invoiceOriginal: Source['invoiceOriginal'];
  if (/\.xml$/i.test(file.name) || /^(application|text)\/xml$/.test(file.type)) {
    const { invoiceFromBytes, invoicePdf } = await import('./invoice-engine');
    invoiceOriginal = { bytes: bytes.slice(), name: file.name };
    bytes = await invoicePdf(invoiceFromBytes(bytes, file.name));
    kind = 'invoice';
  } else if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) {
    kind = 'image';
    const { imageFilePdf } = await import('./image-codecs');
    bytes = await imageFilePdf(file, bytes);
  }
  const pdfjs = await getPdfJs();
  let wasEncrypted = false;
  for (;;) {
    const task = pdfjs.getDocument({
      ...pdfImageOptions(),
      data: bytes.slice(),
      cMapUrl: '/vendor/pdf/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/vendor/pdf/standard_fonts/',
      wasmUrl: '/vendor/pdf/wasm/',
      fontExtraProperties: true,
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > MAX_PAGES) {
        await pdf.loadingTask.destroy();
        throw new Error('Bitte öffne höchstens 200 Seiten auf einmal.');
      }
      if (!wasEncrypted && (await pdf.getPermissions()) !== null) {
        await task.destroy();
        const { unlockPdf } = await import('./pdf-security');
        bytes = await unlockPdf(bytes, '');
        wasEncrypted = true;
        continue;
      }
      return {
        id: uid(),
        name: file.name,
        bytes,
        pdf,
        size: file.size,
        kind,
        wasEncrypted,
        invoiceOriginal,
      };
    } catch (error) {
      await task.destroy();
      if (error instanceof Error && error.name === 'PasswordException') {
        if (!options.requestPassword)
          throw new Error(
            'Diese PDF ist passwortgeschützt. Bitte über das Upload-Feld mit Passwort öffnen.',
          );
        const { unlockPdf, PdfPasswordError } = await import('./pdf-security');
        let failed = false;
        for (;;) {
          const password = await options.requestPassword(file.name, failed);
          if (password === null) throw new DOMException('Öffnen abgebrochen', 'AbortError');
          try {
            bytes = await unlockPdf(bytes, password);
            wasEncrypted = true;
            break;
          } catch (e) {
            if (e instanceof PdfPasswordError) {
              failed = true;
              continue;
            }
            throw e;
          }
        }
        continue;
      }
      throw error instanceof Error && error.message.includes('200 Seiten')
        ? error
        : new Error(
            'Die Datei konnte nicht gelesen werden. Bitte prüfe, ob sie eine gültige und unbeschädigte PDF ist.',
          );
    }
  }
}
export function sourcePages(source: Source): PageItem[] {
  return Array.from({ length: source.pdf.numPages }, (_, index) => ({
    id: uid(),
    sourceId: source.id,
    index,
    rotation: 0,
    selected: true,
  }));
}
export async function renderPage(
  source: Source,
  item: PageItem | Pick<PageItem, 'index' | 'rotation'>,
  maxSide = 360,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const page = await source.pdf.getPage(item.index + 1);
  signal?.throwIfAborted();
  if (page.isPureXfa)
    throw new Error(
      'Dieses dynamische XFA-Formular kann nicht als Seitenbild bearbeitet werden. Bitte zuerst in der ursprünglichen Anwendung als normale PDF speichern.',
    );
  const rotation = (page.rotate + item.rotation) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  if (![base.width, base.height].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('Die Seite hat ungültige Abmessungen.');
  const scale = Math.min(
    maxSide / Math.max(base.width, base.height),
    4.2,
    Math.sqrt(16000000 / (base.width * base.height)),
  );
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const task = page.render({ canvas, viewport, background: 'rgb(255,255,255)' });
  const cancel = () => task.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await task.promise;
    signal?.throwIfAborted();
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
  return { canvas, width: base.width, height: base.height, scale };
}
/** Render a selected region directly; a small correction must not first downsample
 * a large scan. The working bitmap is capped independently of the page size. */
export async function renderPageRegion(
  source: Source,
  item: Pick<PageItem, 'index' | 'rotation'>,
  rect: { x: number; y: number; w: number; h: number },
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (
    ![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.w <= 0 ||
    rect.h <= 0 ||
    rect.x + rect.w > 1.000001 ||
    rect.y + rect.h > 1.000001
  )
    throw new Error('Der ausgewählte Bereich liegt außerhalb der Seite.');
  const page = await source.pdf.getPage(item.index + 1);
  signal?.throwIfAborted();
  if (page.isPureXfa)
    throw new Error('Dynamische XFA-Seiten unterstützen keine Bereichserkennung.');
  const rotation = (page.rotate + item.rotation) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  const width = rect.w * base.width,
    height = rect.h * base.height;
  if (![width, height].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('Die Seite hat ungültige Abmessungen.');
  const scale = Math.min(
    600 / 72,
    4095 / Math.max(width, height),
    Math.sqrt(3990000 / (width * height)),
  );
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const task = page.render({
    canvas,
    viewport,
    background: 'rgb(255,255,255)',
    transform: [1, 0, 0, 1, -rect.x * viewport.width, -rect.y * viewport.height],
  });
  const cancel = () => task.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await task.promise;
    signal?.throwIfAborted();
    return { canvas, width, height, scale };
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}
export async function extractPageText(source: Source, item: PageItem) {
  const page = await source.pdf.getPage(item.index + 1);
  const content = await readPdfText(page);
  let lastY: number | undefined;
  let text = '';
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const y = item.transform[5];
    if (lastY !== undefined && Math.abs(y - lastY) > 3 && !text.endsWith('\n')) text += '\n';
    text += item.str + (item.hasEOL ? '\n' : ' ');
    lastY = y;
  }
  return text
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
export function selectRange(value: string, count: number) {
  if (!value.trim()) return new Set(Array.from({ length: count }, (_, i) => i));
  const selected = new Set<number>();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Bitte Seiten als 1, 3-5 eingeben.');
    const a = Number(match[1]),
      b = Number(match[2] || match[1]);
    if (a < 1 || b < a || b > count)
      throw new Error(`Bitte Seiten zwischen 1 und ${count} wählen.`);
    for (let i = a; i <= b; i++) selected.add(i - 1);
  }
  return selected;
}
export async function prepareSources(sources: Source[], pages: PageItem[]) {
  const loaded = new Map<string, PDFDocument>();
  for (const id of new Set(pages.map((p) => p.sourceId))) {
    const source = sources.find((s) => s.id === id)!;
    const pdf = await PDFDocument.load(source.bytes.slice(), { updateMetadata: false });
    // Freeze filled form values before copying pages; form objects are document-level.
    const form = requireAcroForm(pdf);
    if (form.getFields().length) form.flatten();
    loaded.set(id, pdf);
  }
  return loaded;
}
export async function appendPage(
  dest: PDFDocument,
  loaded: Map<string, PDFDocument>,
  item: PageItem,
) {
  const [page] = await dest.copyPages(loaded.get(item.sourceId)!, [item.index]);
  page.setRotation(degrees((page.getRotation().angle + item.rotation) % 360));
  dest.addPage(page);
  return page;
}
export function pointOnRotatedPage(page: PDFPage, x: number, y: number) {
  const { width: w, height: h } = page.getSize();
  const angle = (page.getRotation().angle + 360) % 360;
  if (angle === 90) return { x: w - y, y: x, rotate: degrees(90) };
  if (angle === 180) return { x: w - x, y: h - y, rotate: degrees(180) };
  if (angle === 270) return { x: y, y: h - x, rotate: degrees(270) };
  return { x, y, rotate: degrees(0) };
}
export async function runJob(
  tool: ToolId,
  sources: Source[],
  pages: PageItem[],
  options: JobOptions,
  report: Report,
  signal: AbortSignal,
): Promise<JobResult> {
  if (!pages.length) throw new Error('Bitte wähle mindestens eine Seite aus.');
  aborted(signal);
  if (tool === 'compress' && options.compressionMode !== 'raster') {
    const { compressPreservingPdf } = await import('./pdf-compression');
    return compressPreservingPdf(sources, pages, options, report, signal);
  }
  if (tool === 'ocr') {
    const { runDocumentOcr } = await import('./ocr-document');
    return runDocumentOcr(sources, pages, options, report, signal);
  }
  const loaded = await prepareSources(sources, pages);
  const doc = await PDFDocument.create();
  doc.setProducer('PDF-Werkzeuge');
  doc.setCreator('PDF-Werkzeuge');
  doc.setTitle('Bearbeitetes Dokument');
  const stem = sources.length === 1 ? filenameStem(sources[0].name) : 'Dokumente';
  const inputSize = [...new Set(pages.map((p) => p.sourceId))].reduce(
    (sum, id) => sum + sources.find((s) => s.id === id)!.size,
    0,
  );
  const base = { pages: pages.length, inputSize };
  const zip =
    tool === 'split' || tool === 'to-images' ? new (await import('jszip')).default() : null;
  {
    for (let i = 0; i < pages.length; i++) {
      aborted(signal);
      const item = pages[i],
        source = sources.find((s) => s.id === item.sourceId)!;
      report({
        percent: (i / pages.length) * 100,
        label: `Seite ${i + 1} von ${pages.length} wird verarbeitet …`,
      });
      if (tool === 'to-images' || tool === 'compress') {
        const side =
          tool === 'compress'
            ? options.quality === 'small'
              ? 1400
              : options.quality === 'gentle'
                ? 2400
                : 2000
            : 2400;
        const { canvas, width, height } = await renderPage(source, item, side, signal);
        try {
          const { rasterBlob } = await import('./image-codecs');
          const format = tool === 'compress' ? 'jpg' : options.imageFormat;
          if (!['png', 'jpg', 'webp', 'tiff', 'bmp'].includes(format))
            throw new Error('Unbekanntes Bildformat.');
          const blob = await rasterBlob(
            canvas,
            format as import('./image-codecs').RasterFormat,
            tool === 'compress'
              ? options.quality === 'small'
                ? 0.5
                : options.quality === 'gentle'
                  ? 0.9
                  : 0.76
              : 0.92,
          );
          const data = new Uint8Array(await blob.arrayBuffer());
          if (zip)
            zip.file(
              `${String(i + 1).padStart(3, '0')}-${filenameStem(source.name)}.${format}`,
              data,
            );
          else {
            const image = await doc.embedJpg(data),
              page = doc.addPage([width, height]);
            page.drawImage(image, { x: 0, y: 0, width, height });
          }
        } finally {
          canvas.width = canvas.height = 0;
        }
      } else if (tool === 'split') {
        const part = await PDFDocument.create();
        await appendPage(part, loaded, item);
        zip!.file(
          `${String(i + 1).padStart(3, '0')}-${filenameStem(source.name)}.pdf`,
          await part.save(),
        );
      } else {
        const page = await appendPage(doc, loaded, item);
        if (tool === 'numbers' || tool === 'watermark') {
          const font = await doc.embedFont(StandardFonts.Helvetica);
          const isSideways = page.getRotation().angle % 180 !== 0;
          const w = isSideways ? page.getHeight() : page.getWidth(),
            h = isSideways ? page.getWidth() : page.getHeight();
          const text = tool === 'numbers' ? `${options.numberStart + i}` : options.watermark.trim();
          if (!text) throw new Error('Bitte gib einen Text für das Wasserzeichen ein.');
          let size = tool === 'numbers' ? 11 : Math.min(52, w / 10);
          try {
            size = Math.min(size, (w - 44) / font.widthOfTextAtSize(text, 1));
          } catch {
            throw new Error(
              'Das Wasserzeichen unterstützt lateinische Buchstaben, Umlaute, Zahlen und übliche Satzzeichen. Bitte entferne Sonderzeichen oder Emojis.',
            );
          }
          const x = (w - font.widthOfTextAtSize(text, size)) / 2;
          const y = tool === 'numbers' ? 20 : h / 2;
          page.drawText(text, {
            ...pointOnRotatedPage(page, x, y),
            size,
            font,
            color: tool === 'numbers' ? rgb(0.3, 0.3, 0.3) : rgb(5 / 255, 154 / 255, 152 / 255),
            opacity: tool === 'numbers' ? 1 : 0.25,
          });
        }
      }
      report({
        percent: ((i + 1) / pages.length) * 100,
        label: `Seite ${i + 1} von ${pages.length} fertig`,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    aborted(signal);
    if (zip) {
      report({ percent: 99, label: 'ZIP-Datei wird erstellt …' });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      aborted(signal);
      return {
        ...base,
        blob,
        filename: `${stem}-${tool === 'split' ? 'Einzelseiten' : 'Bilder'}.zip`,
        kind: 'zip',
      };
    }
    const blob = pdfBlob(await doc.save());
    aborted(signal);
    const suffix: Record<string, string> = {
      ocr: 'durchsuchbar',
      merge: 'zusammengefuegt',
      organize: 'bearbeitet',
      images: 'Bilder',
      compress: 'komprimiert',
      watermark: 'Wasserzeichen',
      numbers: 'nummeriert',
    };
    return {
      ...base,
      blob,
      filename: `${stem}-${suffix[tool]}.pdf`,
      kind: 'pdf',
    };
  }
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function downloadWord(text: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const doc = new Document({
    sections: [
      {
        children: text.split('\n').map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line, font: 'Calibri', size: 22 })],
              spacing: { after: 100 },
            }),
        ),
      },
    ],
  });
  downloadBlob(await Packer.toBlob(doc), filename);
}
export async function makeDemoFile(language: Language = 'de') {
  const doc = await PDFDocument.create();
  const demoPages: [string, string, string[]][] =
    language === 'en'
      ? [
          [
            'Sample invoice',
            'Nordlicht Studio · Sample document',
            [
              'Invoice No. 2026-014',
              'Date: 4 October 2026',
              '',
              'Service                           Amount',
              'Brochure design                   250.00 EUR',
              'Print file revisions               85.00 EUR',
              '',
              'Total                             335.00 EUR',
              '',
              'Thank you for working with us.',
              'This document contains sample data only.',
            ],
          ],
          [
            'Project overview',
            'Nordlicht Studio · Sample document',
            [
              'Project: New brochure',
              '',
              '1. Review the content and revise the text',
              '2. Select images and agree on the layout',
              '3. Prepare the print files',
              '',
              'Notes',
              'Final approval follows a joint review.',
              'Changes can be added until the project is complete.',
              '',
              'This PDF consists of scanned images.',
              'Try text recognition or the page tools.',
            ],
          ],
        ]
      : [
          [
            'Musterrechnung',
            'Nordlicht Studio · Beispieldokument',
            [
              'Rechnung Nr. 2026-014',
              'Datum: 04.10.2026',
              '',
              'Leistung                          Betrag',
              'Gestaltung einer Broschüre         250,00 EUR',
              'Überarbeitung der Druckdaten        85,00 EUR',
              '',
              'Gesamtbetrag                      335,00 EUR',
              '',
              'Vielen Dank für die gute Zusammenarbeit.',
              'Dieses Dokument enthält ausschließlich Beispieldaten.',
            ],
          ],
          [
            'Projektübersicht',
            'Nordlicht Studio · Beispieldokument',
            [
              'Projekt: Neue Broschüre',
              '',
              '1. Inhalte prüfen und Texte überarbeiten',
              '2. Bilder auswählen und Layout abstimmen',
              '3. Druckdaten vorbereiten',
              '',
              'Notizen',
              'Die Freigabe erfolgt nach der gemeinsamen Prüfung.',
              'Änderungen können bis zum Abschluss ergänzt werden.',
              '',
              'Dieses PDF besteht aus gescannten Bildern.',
              'Probiere die Texterkennung oder die Seitenwerkzeuge aus.',
            ],
          ],
        ];
  for (const [title, subtitle, lines] of demoPages) {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1240, 1754);
    ctx.fillStyle = '#9bd447';
    ctx.fillRect(90, 110, 70, 8);
    ctx.fillStyle = '#18181b';
    ctx.font = 'bold 55px Arial';
    ctx.fillText(title, 90, 235);
    ctx.font = '26px Arial';
    ctx.fillStyle = '#555';
    ctx.fillText(subtitle, 90, 295);
    ctx.fillStyle = '#242424';
    ctx.font = '27px Arial';
    lines.forEach((line, i) => ctx.fillText(line, 90, 410 + i * 67));
    const image = await doc.embedPng(canvas.toDataURL('image/png'));
    doc.addPage([595.28, 841.89]).drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
    canvas.width = canvas.height = 0;
  }
  return new File(
    [new Uint8Array(await doc.save())],
    language === 'en' ? 'Sample-Scan.pdf' : 'Beispiel-Scan.pdf',
    {
      type: 'application/pdf',
    },
  );
}
