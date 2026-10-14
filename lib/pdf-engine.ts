import { PDFDocument, PDFDict, PDFName, StandardFonts, degrees, rgb, type PDFPage } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Worker } from 'tesseract.js';
import type { PdfReport } from './pdf-report';
import { parseOcrLanguages } from './ocr-languages';

export type Source = {
  id: string;
  name: string;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
  size: number;
  kind: 'pdf' | 'image' | 'invoice';
  wasEncrypted?: boolean;
  invoiceOriginal?: { bytes: Uint8Array; name: string };
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
};
export type ProgressUpdate = { percent: number; label: string };
type Report = (progress: ProgressUpdate) => void;

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | undefined;
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
export function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
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
    const abort = () => reject(new DOMException('Abgebrochen', 'AbortError'));
    if (signal.aborted) {
      promise.catch(() => {});
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
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
      data: bytes.slice(),
      cMapUrl: '/vendor/pdf/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/vendor/pdf/standard_fonts/',
      wasmUrl: '/vendor/pdf/wasm/',
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
  const page = await source.pdf.getPage(item.index + 1);
  const rotation = (page.rotate + item.rotation) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  const scale = Math.min(maxSide / Math.max(base.width, base.height), 4.2);
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const task = page.render({ canvas, viewport, background: 'rgb(255,255,255)' });
  const cancel = () => task.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await task.promise;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
  return { canvas, width: base.width, height: base.height, scale };
}
export async function extractPageText(source: Source, item: PageItem) {
  const page = await source.pdf.getPage(item.index + 1);
  const content = await page.getTextContent();
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
  let worker: Worker | undefined;
  const stop = () => {
    void worker?.terminate();
  };
  signal.addEventListener('abort', stop, { once: true });
  const texts: string[] = [];
  const languageNotes: string[] = [];
  const zip =
    tool === 'split' || tool === 'to-images' ? new (await import('jszip')).default() : null;
  let currentIndex = 0;
  try {
    for (let i = 0; i < pages.length; i++) {
      aborted(signal);
      currentIndex = i;
      const item = pages[i],
        source = sources.find((s) => s.id === item.sourceId)!;
      report({
        percent: (i / pages.length) * 100,
        label: `Seite ${i + 1} von ${pages.length} wird verarbeitet …`,
      });
      if (tool === 'ocr') {
        const nativeText = options.forceOcr ? '' : await extractPageText(source, item);
        if (nativeText.replace(/\s/g, '').length >= 20) {
          texts.push(nativeText);
          await appendPage(doc, loaded, item);
        } else {
          let selectedLanguage = options.language;
          if (options.autoLanguage) {
            await worker?.terminate();
            worker = undefined;
            report({
              percent: (i / pages.length) * 100,
              label: `Sprachprobe mit 21 Modellen · Seite ${i + 1}`,
            });
            const preview = await renderPage(source, item, 1800, signal);
            try {
              const { probeOcrLanguages } = await import('./ocr-language-probe');
              const languages = await probeOcrLanguages(preview.canvas, signal);
              selectedLanguage = languages.join('+');
              languageNotes.push(`Seite ${i + 1}: ${selectedLanguage}`);
              report({
                percent: (i / pages.length) * 100,
                label: `Erkannte Sprachmodelle: ${selectedLanguage}`,
              });
            } finally {
              preview.canvas.width = preview.canvas.height = 0;
            }
          }
          if (!worker) {
            report({ percent: (i / pages.length) * 100, label: 'Texterkennung wird geladen …' });
            const { createWorker, PSM } = await import('tesseract.js');
            const creating = createWorker(parseOcrLanguages(selectedLanguage), 1, {
              workerPath: '/vendor/ocr/worker.min.js',
              corePath: '/vendor/ocr',
              langPath: '/vendor/languages',
              workerBlobURL: false,
              logger: (m) => {
                if (signal.aborted) return;
                if (m.status === 'recognizing text')
                  report({
                    percent: ((currentIndex + m.progress * 0.95) / pages.length) * 100,
                    label: `Text erkennen · Seite ${currentIndex + 1} von ${pages.length}`,
                  });
                else if (m.status === 'loading language traineddata')
                  report({
                    percent: (currentIndex / pages.length) * 100,
                    label: 'Sprachpaket wird geladen …',
                  });
              },
            });
            creating
              .then((w) => {
                if (signal.aborted) void w.terminate();
              })
              .catch(() => {});
            worker = await abortable(creating, signal);
            await worker.setParameters({
              tessedit_pageseg_mode: (['3', '4', '6', '7', '11'].includes(options.ocrLayout || '')
                ? options.ocrLayout
                : PSM.AUTO) as typeof PSM.AUTO,
              preserve_interword_spaces: '1',
            });
          }
          const { canvas, width, height, scale } = await renderPage(source, item, 2800, signal);
          try {
            await worker.setParameters({ user_defined_dpi: String(Math.round(scale * 72)) });
            const { data } = await abortable(
              worker.recognize(
                canvas,
                { pdfTitle: filenameStem(source.name), pdfTextOnly: false },
                { text: true, pdf: true },
              ),
              signal,
            );
            texts.push(data.text.trim());
            if (!data.pdf) throw new Error('Die durchsuchbare PDF konnte nicht erstellt werden.');
            const scanPdf = await PDFDocument.load(new Uint8Array(data.pdf));
            const [scanPage] = await doc.embedPages(scanPdf.getPages());
            const page = doc.addPage([width, height]);
            page.drawPage(scanPage, { x: 0, y: 0, width, height });
          } finally {
            canvas.width = canvas.height = 0;
          }
        }
      } else if (tool === 'to-images' || tool === 'compress') {
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
      ...(languageNotes.length
        ? {
            note:
              'Automatische Sprachwahl: ' +
              languageNotes.join('; ') +
              '. Statistische Vorschläge und OCR-Ergebnis bitte prüfen; kurze oder uneindeutige Texte benötigen eine manuelle Auswahl.',
          }
        : {}),
      ...(tool === 'ocr'
        ? {
            text: texts
              .map((text, i) => `— Seite ${i + 1} —\n\n${text || '[Kein Text erkannt]'}`)
              .join('\n\n'),
          }
        : {}),
    };
  } finally {
    signal.removeEventListener('abort', stop);
    await worker?.terminate();
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
export async function makeDemoFile() {
  const doc = await PDFDocument.create();
  for (const [title, subtitle, lines] of [
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
  ] as [string, string, string[]][]) {
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
  return new File([new Uint8Array(await doc.save())], 'Beispiel-Scan.pdf', {
    type: 'application/pdf',
  });
}
