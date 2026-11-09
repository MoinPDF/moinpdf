import JSZip from 'jszip';
import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFName,
  PDFString,
  PDFHexString,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import { renderPage, sourcePages, pdfBlob, filenameStem, type Source } from './pdf-engine';
import { readPdfText } from './pdf-text';
import { rasterBlob } from './image-codecs';
import { pdfJson, pdfFromJson } from './pdf-security';
import type { ExportFile, RunContext } from './advanced-types';

export async function exportPdfJson(source: Source, ctx: RunContext): Promise<ExportFile> {
  ctx.report({ percent: 10, label: 'PDF-Struktur exportieren' });
  const bytes = await pdfJson(source.bytes, ctx.signal);
  if (bytes.length > 80 * 1024 * 1024) throw new Error('Die JSON-Ausgabe überschreitet 80 MB.');
  ctx.report({ percent: 100, label: 'Ausgabe erstellt' });
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'application/json' }),
    filename: filenameStem(source.name) + '.pdf.json',
    kind: 'data',
    pages: source.pdf.numPages,
  };
}
export function validatePdfJson(value: unknown) {
  if (!value || typeof value !== 'object' || !('qpdf' in value))
    throw new Error('Bitte einen vollständigen QPDF-JSON-Export auswählen.');
  const q = value.qpdf;
  if (
    !Array.isArray(q) ||
    q.length !== 2 ||
    q[0]?.jsonversion !== 2 ||
    typeof q[0]?.pdfversion !== 'string' ||
    !q[1]?.trailer?.value?.['/Root']
  )
    throw new Error('Ungültiger QPDF-JSON-Export (Version 2 erforderlich).');
  let nodes = 0;
  function walk(v: unknown, depth: number) {
    if (++nodes > 1000000 || depth > 80)
      throw new Error('Die PDF-JSON-Struktur ist zu groß oder zu tief verschachtelt.');
    if (!v || typeof v !== 'object') return;
    for (const [k, child] of Object.entries(v)) {
      if (k === 'datafile')
        throw new Error(
          'Externe Stream-Dateien sind nicht erlaubt. Bitte einen JSON-Export mit eingebetteten Daten verwenden.',
        );
      walk(child, depth + 1);
    }
  }
  walk(value, 0);
  for (const entry of Object.values(q[1]) as { stream?: { data?: unknown } }[]) {
    if (
      entry?.stream &&
      (typeof entry.stream.data !== 'string' ||
        entry.stream.data.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.stream.data))
    )
      throw new Error('Der JSON-Export enthält keine vollständigen eingebetteten Stream-Daten.');
  }
}
export async function importPdfJson(file: File, ctx: RunContext): Promise<ExportFile> {
  if (!file.size || file.size > 80 * 1024 * 1024)
    throw new Error('Bitte eine JSON-Datei mit höchstens 80 MB verwenden.');
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error('Die JSON-Datei ist nicht gültig.');
  }
  validatePdfJson(value);
  ctx.signal.throwIfAborted();
  const bytes = await pdfFromJson(new TextEncoder().encode(JSON.stringify(value)), ctx.signal);
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  if (!doc.getPageCount() || doc.getPageCount() > 200 || bytes.length > 80 * 1024 * 1024)
    throw new Error('Die wiederhergestellte PDF überschreitet 80 MB oder 200 Seiten.');
  return {
    blob: pdfBlob(bytes),
    filename: file.name.replace(/(?:\.pdf)?\.json$/i, '') + '.pdf',
    kind: 'pdf',
    pages: doc.getPageCount(),
    note: 'PDF aus vollständiger Objektstruktur wiederhergestellt. Aktive Inhalte können enthalten sein; bestehende digitale Signaturen werden nicht wiederhergestellt.',
  };
}

export type ScriptEntry = { location: string; code: string; readable: boolean };
export async function inspectPdfJavaScript(
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<ScriptEntry[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false }),
    result: ScriptEntry[] = [];
  const seen = new Set<object>();
  let count = 0,
    total = 0;
  function visit(obj: unknown, path: string, depth: number) {
    signal.throwIfAborted();
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
    seen.add(obj);
    if (++count > 150000 || depth > 60)
      throw new Error('Die PDF-Struktur ist zu umfangreich für die Skriptprüfung.');
    const dictionary = obj instanceof PDFRawStream ? obj.dict : obj;
    if (dictionary instanceof PDFDict) {
      const script = dictionary.get(PDFName.of('JS'));
      if (script !== undefined) {
        const value = doc.context.lookup(script);
        let code = '',
          readable = true;
        try {
          if (value instanceof PDFString || value instanceof PDFHexString)
            code = value.decodeText();
          else if (value instanceof PDFRawStream) {
            const raw = decodePDFRawStream(value).getBytes(1000001);
            if (raw.length > 1000000) throw new Error('limit');
            code =
              raw[0] === 0xfe && raw[1] === 0xff
                ? new TextDecoder('utf-16be').decode(raw.subarray(2))
                : raw[0] === 0xff && raw[1] === 0xfe
                  ? new TextDecoder('utf-16le').decode(raw.subarray(2))
                  : new TextDecoder().decode(raw);
          } else readable = false;
        } catch {
          readable = false;
        }
        total += code.length;
        if (code.length > 1000000 || total > 8000000 || result.length >= 500)
          throw new Error('Die eingebetteten Skripte überschreiten die Anzeigegrenze.');
        result.push({ location: path + '/JS', code, readable });
      }
      for (const [key, value] of dictionary.entries())
        visit(value, path + '/' + key.decodeText(), depth + 1);
    } else if (obj instanceof PDFArray)
      obj.asArray().forEach((v, i) => visit(v, `${path}[${i}]`, depth + 1));
  }
  // Enumerate indirect objects too: actions may be referenced or unreferenced.
  for (const [ref, value] of doc.context.enumerateIndirectObjects())
    visit(value, ref.toString(), 0);
  return result;
}

export async function exportAiDocuments(source: Source, ctx: RunContext): Promise<ExportFile> {
  const documents: {
    id_: string;
    text: string;
    metadata: Record<string, string | number>;
    class_name: string;
    excluded_embed_metadata_keys: string[];
    excluded_llm_metadata_keys: string[];
  }[] = [];
  const labels = await source.pdf.getPageLabels();
  let characters = 0,
    missing = 0;
  for (let page = 1; page <= source.pdf.numPages; page++) {
    ctx.signal.throwIfAborted();
    const items = (await readPdfText(await source.pdf.getPage(page))).items;
    const text = items
      .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
      .join('')
      .trim();
    if (!text) missing++;
    characters += text.length;
    if (characters > 2000000)
      throw new Error('Bitte für den Textexport höchstens zwei Millionen Zeichen verwenden.');
    documents.push({
      id_: `${source.id}-page-${page}`,
      text,
      metadata: {
        file_name: source.name,
        page_number: page,
        page_label: labels?.[page - 1] || String(page),
        total_pages: source.pdf.numPages,
      },
      class_name: 'Document',
      excluded_embed_metadata_keys: [],
      excluded_llm_metadata_keys: [],
    });
    ctx.report({
      percent: (page / source.pdf.numPages) * 100,
      label: `Text auslesen · Seite ${page}`,
    });
  }
  if (missing === documents.length)
    throw new Error(
      'Kein auslesbarer Text gefunden. Bitte zuerst „OCR & Text“ ausführen und das Ergebnis übernehmen.',
    );
  return {
    blob: new Blob([JSON.stringify(documents, null, 2)], { type: 'application/json' }),
    filename: filenameStem(source.name) + '.llamaindex.json',
    kind: 'data',
    pages: documents.length,
    note: missing
      ? `${missing} · ${(ctx.translate || ((text: string) => text))('Seiten ohne auslesbaren Text sind mit leerem Text enthalten. Bei Bedarf zuerst OCR ausführen.')}`
      : 'LlamaIndex-Dokumente mit einem Texteintrag pro PDF-Seite. Bilder, Tabellenlayout und eingebettete Dateien sind nicht enthalten.',
  };
}

export type ScanEffectOptions = {
  dpi: number;
  noise: number;
  angle: number;
  gray: boolean;
  blur: number;
};
export const scanEffectDefaults: ScanEffectOptions = {
  dpi: 150,
  noise: 6,
  angle: 0.4,
  gray: true,
  blur: 0.3,
};
export function applyScanPixels(
  data: Uint8ClampedArray,
  noise: number,
  gray: boolean,
  seed = 1234567,
) {
  // A deterministic sequence keeps the preview consistent with the exported page.
  for (let i = 0; i < data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const offset = (seed / 4294967296 - 0.5) * noise;
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    for (let channel = 0; channel < 3; channel++)
      data[i + channel] = Math.max(
        0,
        Math.min(255, (gray ? luminance : data[i + channel]) + offset),
      );
  }
}
export async function pageRaster(source: Source, index: number, dpi: number, signal: AbortSignal) {
  if (![72, 100, 150, 200, 300].includes(dpi)) throw new Error('Ungültige Bildauflösung.');
  const page = await source.pdf.getPage(index + 1),
    viewport = page.getViewport({ scale: dpi / 72 });
  if (viewport.width * viewport.height > 16000000)
    throw new Error(
      'Eine Seite überschreitet 16 Megapixel. Bitte eine niedrigere Auflösung wählen.',
    );
  return renderPage(
    source,
    sourcePages(source)[index],
    Math.max(viewport.width, viewport.height),
    signal,
  );
}
export async function scanEffect(
  source: Source,
  options: ScanEffectOptions,
  ctx: RunContext,
): Promise<ExportFile> {
  if (
    !Number.isFinite(options.noise) ||
    options.noise < 0 ||
    options.noise > 30 ||
    !Number.isFinite(options.angle) ||
    Math.abs(options.angle) > 3 ||
    !Number.isFinite(options.blur) ||
    options.blur < 0 ||
    options.blur > 2
  )
    throw new Error('Ungültige Einstellungen für den Scannereffekt.');
  const pdf = await PDFDocument.create();
  let size = 0;
  for (let i = 0; i < source.pdf.numPages; i++) {
    ctx.signal.throwIfAborted();
    const { canvas, width, height } = await pageRaster(source, i, options.dpi, ctx.signal);
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    try {
      const c = output.getContext('2d')!;
      c.fillStyle = '#fff';
      c.fillRect(0, 0, output.width, output.height);
      const angle = (options.angle * Math.PI) / 180;
      // Fit the rotated sheet inside the original bounds instead of cutting corners.
      const fit = Math.min(
        output.width /
          (output.width * Math.abs(Math.cos(angle)) + output.height * Math.abs(Math.sin(angle))),
        output.height /
          (output.height * Math.abs(Math.cos(angle)) + output.width * Math.abs(Math.sin(angle))),
      );
      c.translate(output.width / 2, output.height / 2);
      c.rotate(angle);
      c.scale(fit, fit);
      c.filter = `blur(${options.blur}px)`;
      c.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.filter = 'none';
      const pixels = c.getImageData(0, 0, output.width, output.height);
      applyScanPixels(pixels.data, options.noise, options.gray, 1234567 + i);
      c.putImageData(pixels, 0, 0);
      const blob = await rasterBlob(output, 'jpg');
      size += blob.size;
      if (size > 80 * 1024 * 1024)
        throw new Error('Die Ausgabe überschreitet 80 MB. Bitte die Auflösung verringern.');
      const image = await pdf.embedJpg(await blob.arrayBuffer());
      pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    } finally {
      canvas.width = canvas.height = output.width = output.height = 0;
    }
    ctx.report({ percent: ((i + 1) / source.pdf.numPages) * 95, label: `Seite ${i + 1}` });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  ctx.signal.throwIfAborted();
  return {
    blob: pdfBlob(await pdf.save()),
    filename: filenameStem(source.name) + '-Scan.pdf',
    kind: 'pdf',
    pages: source.pdf.numPages,
    note: 'Neue Bild-PDF: Textsuche, Links, Formulare, Anhänge und digitale Signaturen werden nicht übernommen.',
  };
}
export async function exportCbz(
  source: Source,
  dpi: number,
  format: 'png' | 'jpg',
  ctx: RunContext,
): Promise<ExportFile> {
  if (!['png', 'jpg'].includes(format)) throw new Error('Ungültiges Bildformat.');
  const zip = new JSZip();
  let size = 0;
  for (let i = 0; i < source.pdf.numPages; i++) {
    ctx.signal.throwIfAborted();
    const { canvas } = await pageRaster(source, i, dpi, ctx.signal);
    try {
      const blob = await rasterBlob(canvas, format);
      size += blob.size;
      if (size > 80 * 1024 * 1024)
        throw new Error('Das Comicarchiv überschreitet 80 MB. Bitte die Auflösung verringern.');
      zip.file(`${String(i + 1).padStart(4, '0')}.${format}`, await blob.arrayBuffer());
    } finally {
      canvas.width = canvas.height = 0;
    }
    ctx.report({ percent: ((i + 1) / source.pdf.numPages) * 90, label: `Seite ${i + 1}` });
  }
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }, () =>
    ctx.signal.throwIfAborted(),
  );
  ctx.signal.throwIfAborted();
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'application/vnd.comicbook+zip' }),
    filename: filenameStem(source.name) + '.cbz',
    kind: 'data',
    pages: source.pdf.numPages,
  };
}
