import {
  PDFDocument,
  PDFName,
  StandardFonts,
  degrees,
  rgb,
  type PDFPage,
  type PDFEmbeddedPage,
} from 'pdf-lib';
import type { Source } from './pdf-engine';
import { checkAbort, uniqueNames, type ExportFile, type RunContext } from './advanced-types';
import { linearizePdf } from './pdf-security';

export const proToolIds = [
  'bates',
  'page-labels',
  'rotate-free',
  'continuous-page',
  'poster-print',
  'linearize',
  'structured-export',
] as const;
export type ProTool = (typeof proToolIds)[number];
export const isProTool = (id: string): id is ProTool =>
  (proToolIds as readonly string[]).includes(id);
const pdfBlob = (bytes: Uint8Array) =>
  new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
const stem = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .slice(0, 100) || 'Dokument';
function bounded(value: number, min: number, max: number, label: string, integer = false) {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(`${label}: Bitte einen Wert zwischen ${min} und ${max} verwenden.`);
  return value;
}
export async function packagePdfs(
  outputs: { name: string; bytes: Uint8Array; pages: number }[],
  note?: string,
): Promise<ExportFile> {
  if (!outputs.length) throw new Error('Keine Dokumente vorhanden.');
  if (outputs.length === 1)
    return {
      blob: pdfBlob(outputs[0].bytes),
      filename: outputs[0].name,
      pages: outputs[0].pages,
      kind: 'pdf',
      note,
    };
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip(),
    names = uniqueNames(outputs.map((o) => o.name));
  outputs.forEach((o, i) => zip.file(names[i], o.bytes));
  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    filename: 'MoinPDF-Dokumente.zip',
    pages: outputs.reduce((n, o) => n + o.pages, 0),
    kind: 'zip',
    note,
  };
}
export type BatesOptions = {
  template: string;
  start: number;
  padding: number;
  size: number;
  position:
    'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
};
export function batesText(
  template: string,
  number: number,
  padding: number,
  page: number,
  pages: number,
  file: string,
) {
  return template.replace(
    /\{(nummer|seite|seiten|datei)\}/g,
    (_, key: string) =>
      ({
        nummer: String(number).padStart(padding, '0'),
        seite: String(page),
        seiten: String(pages),
        datei: stem(file),
      })[key]!,
  );
}
export async function batesPdfs(sources: Source[], options: BatesOptions, ctx: RunContext) {
  bounded(options.start, 0, 999999999, 'Startnummer', true);
  bounded(options.padding, 1, 12, 'Stellen', true);
  bounded(options.size, 6, 40, 'Schriftgröße');
  if (!options.template.trim() || options.template.length > 250)
    throw new Error('Bitte eine Vorlage mit 1 bis 250 Zeichen eingeben.');
  if (!/^(top|bottom)-(left|center|right)$/.test(options.position))
    throw new Error('Ungültige Position.');
  let counter = options.start,
    done = 0;
  const total = sources.reduce((n, s) => n + s.pdf.numPages, 0),
    outputs = [];
  for (const source of sources) {
    checkAbort(ctx.signal);
    const pdf = await PDFDocument.load(source.bytes),
      font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const [i, page] of pdf.getPages().entries()) {
      checkAbort(ctx.signal);
      const text = batesText(
        options.template,
        counter++,
        options.padding,
        i + 1,
        pdf.getPageCount(),
        source.name,
      );
      try {
        font.encodeText(text);
      } catch {
        throw new Error(
          'Die Beschriftung enthält Zeichen, die Helvetica nicht unterstützt. Bitte lateinische Zeichen verwenden.',
        );
      }
      // Work in the displayed coordinate system, including pages with /Rotate.
      const angle = ((page.getRotation().angle % 360) + 360) % 360,
        box = page.getCropBox();
      const width = angle % 180 ? box.height : box.width,
        height = angle % 180 ? box.width : box.height;
      const measured = font.widthOfTextAtSize(text, options.size);
      if (measured > width - 32)
        throw new Error(
          `Die Beschriftung passt auf Seite ${i + 1} nicht. Schrift verkleinern oder Vorlage kürzen.`,
        );
      const x = options.position.endsWith('left')
        ? 16
        : options.position.endsWith('right')
          ? width - 16 - measured
          : (width - measured) / 2;
      const y = options.position.startsWith('top') ? height - 16 - options.size : 16;
      const point =
        angle === 90
          ? [box.width - y, x]
          : angle === 180
            ? [box.width - x, box.height - y]
            : angle === 270
              ? [y, box.height - x]
              : [x, y];
      page.drawText(text, {
        x: box.x + point[0],
        y: box.y + point[1],
        font,
        size: options.size,
        color: rgb(0.12, 0.12, 0.12),
        rotate: degrees(angle),
      });
      ctx.report({
        percent: (++done / Math.max(1, total)) * 100,
        label: `Kennzeichnung ${done} von ${total}`,
      });
    }
    outputs.push({
      name: stem(source.name) + '-nummeriert.pdf',
      bytes: await pdf.save(),
      pages: pdf.getPageCount(),
    });
  }
  return packagePdfs(
    outputs,
    'Die Nummerierung läuft in der angezeigten Dateireihenfolge weiter. Änderungen machen bestehende Signaturen ungültig.',
  );
}
export type LabelRule = {
  page: number;
  style: 'D' | 'r' | 'R' | 'a' | 'A' | '';
  prefix: string;
  start: number;
};
export async function pageLabels(bytes: Uint8Array, rules: LabelRule[]) {
  const pdf = await PDFDocument.load(bytes),
    count = pdf.getPageCount();
  if (!rules.length || rules.length > count)
    throw new Error('Bitte mindestens einen gültigen Abschnitt angeben.');
  const sorted = [...rules].sort((a, b) => a.page - b.page),
    used = new Set<number>(),
    nums = [];
  if (sorted[0].page !== 1) throw new Error('Der erste Abschnitt muss auf Seite 1 beginnen.');
  for (const rule of sorted) {
    bounded(rule.page, 1, count, 'Abschnittsseite', true);
    bounded(rule.start, 1, 999999, 'Startwert', true);
    if (
      used.has(rule.page) ||
      !['D', 'r', 'R', 'a', 'A', ''].includes(rule.style) ||
      rule.prefix.length > 100
    )
      throw new Error('Doppelter oder ungültiger Seitenabschnitt.');
    used.add(rule.page);
    const dict = pdf.context.obj({ P: rule.prefix, St: rule.start });
    if (rule.style) dict.set(PDFName.of('S'), PDFName.of(rule.style));
    // Prefix is a PDF text string, not a name.
    const { PDFHexString } = await import('pdf-lib');
    dict.set(PDFName.of('P'), PDFHexString.fromText(rule.prefix));
    nums.push(rule.page - 1, dict);
  }
  pdf.catalog.set(PDFName.of('PageLabels'), pdf.context.obj({ Nums: nums }));
  return pdf.save();
}
type Placement = {
  embedded: PDFEmbeddedPage;
  width: number;
  height: number;
  x: number;
  y: number;
  angle: number;
};
async function placement(out: PDFDocument, page: PDFPage, extra = 0): Promise<Placement> {
  const box = page.getCropBox(),
    embedded = await out.embedPage(page, {
      left: box.x,
      bottom: box.y,
      right: box.x + box.width,
      top: box.y + box.height,
    });
  const angle = -((page.getRotation().angle + extra) % 360),
    rad = (angle * Math.PI) / 180,
    c = Math.cos(rad),
    s = Math.sin(rad);
  const corners = [
    [0, 0],
    [embedded.width, 0],
    [0, embedded.height],
    [embedded.width, embedded.height],
  ].map(([x, y]) => [c * x - s * y, s * x + c * y]);
  const xs = corners.map((p) => p[0]),
    ys = corners.map((p) => p[1]),
    minX = Math.min(...xs),
    minY = Math.min(...ys);
  return {
    embedded,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    x: -minX,
    y: -minY,
    angle,
  };
}
function paint(page: PDFPage, p: Placement, x = 0, y = 0, scale = 1) {
  page.drawPage(p.embedded, {
    x: x + p.x * scale,
    y: y + p.y * scale,
    width: p.embedded.width * scale,
    height: p.embedded.height * scale,
    rotate: degrees(p.angle),
  });
}
export async function rotateFreely(bytes: Uint8Array, angle: number, ctx: RunContext) {
  bounded(angle, -360, 360, 'Drehwinkel');
  const input = await PDFDocument.load(bytes),
    out = await PDFDocument.create();
  if (input.getForm().getFields().length) input.getForm().flatten();
  for (const [i, p] of input.getPages().entries()) {
    checkAbort(ctx.signal);
    const item = await placement(out, p, angle);
    paint(out.addPage([item.width, item.height]), item);
    ctx.report({ percent: ((i + 1) / input.getPageCount()) * 100, label: `Seite ${i + 1} drehen` });
  }
  return out.save();
}
export async function continuousPage(
  sources: Source[],
  width: number,
  gap: number,
  ctx: RunContext,
) {
  bounded(width, 100, 2000, 'Breite');
  bounded(gap, 0, 100, 'Abstand');
  const out = await PDFDocument.create(),
    items: Placement[] = [];
  for (const s of sources) {
    const pdf = await PDFDocument.load(s.bytes);
    if (pdf.getForm().getFields().length) pdf.getForm().flatten();
    for (const p of pdf.getPages()) {
      checkAbort(ctx.signal);
      items.push(await placement(out, p));
    }
  }
  if (!items.length) throw new Error('Keine Seiten vorhanden.');
  const height =
    items.reduce((n, p) => n + (p.height * width) / p.width, 0) + gap * (items.length - 1);
  if (height > 14400)
    throw new Error(
      'Die lange Seite würde größer als 5,08 Meter. Weniger Seiten oder eine kleinere Breite wählen.',
    );
  const page = out.addPage([width, height]);
  let y = height;
  for (const [i, item] of items.entries()) {
    checkAbort(ctx.signal);
    const scale = width / item.width;
    y -= item.height * scale;
    paint(page, item, 0, y, scale);
    y -= gap;
    ctx.report({ percent: ((i + 1) / items.length) * 100, label: `Seite ${i + 1} anfügen` });
  }
  return out.save();
}
export async function posterPages(
  bytes: Uint8Array,
  columns: number,
  rows: number,
  overlap: number,
  ctx: RunContext,
) {
  bounded(columns, 1, 8, 'Spalten', true);
  bounded(rows, 1, 8, 'Zeilen', true);
  bounded(overlap, 0, 72, 'Überlappung');
  const input = await PDFDocument.load(bytes),
    out = await PDFDocument.create();
  if (input.getPageCount() * columns * rows > 1000)
    throw new Error(
      'Das Poster würde mehr als 1.000 Seiten erzeugen. Bitte weniger Kacheln wählen.',
    );
  if (input.getForm().getFields().length) input.getForm().flatten();
  for (const [i, p] of input.getPages().entries()) {
    checkAbort(ctx.signal);
    const item = await placement(out, p),
      w = (item.width + overlap * (columns - 1)) / columns,
      h = (item.height + overlap * (rows - 1)) / rows;
    if (overlap >= Math.min(w, h) / 2)
      throw new Error('Die Überlappung ist für diese Kachelgröße zu groß.');
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        checkAbort(ctx.signal);
        const page = out.addPage([w, h]);
        paint(page, item, -c * (w - overlap), -(item.height - h - r * (h - overlap)));
      }
    ctx.report({
      percent: ((i + 1) / input.getPageCount()) * 100,
      label: `Poster ${i + 1} aufteilen`,
    });
  }
  return out.save();
}
export async function linearizeSources(sources: Source[], ctx: RunContext) {
  const outputs = [];
  for (const [i, s] of sources.entries()) {
    checkAbort(ctx.signal);
    ctx.report({ percent: (i / sources.length) * 100, label: `${s.name}: Webansicht vorbereiten` });
    outputs.push({
      name: stem(s.name) + '-web.pdf',
      bytes: await linearizePdf(s.bytes, ctx.signal),
      pages: s.pdf.numPages,
    });
  }
  return packagePdfs(
    outputs,
    'Die Dateistruktur ist für die schnelle Webansicht vorbereitet. Spätere Bearbeitungen können diese Optimierung aufheben.',
  );
}
export async function structuredExport(sources: Source[], ctx: RunContext) {
  const documents = [];
  let done = 0;
  const total = sources.reduce((n, s) => n + s.pdf.numPages, 0);
  for (const source of sources) {
    const pages = [];
    for (let i = 1; i <= source.pdf.numPages; i++) {
      checkAbort(ctx.signal);
      const page = await source.pdf.getPage(i),
        content = await page.getTextContent(),
        view = page.getViewport({ scale: 1 });
      pages.push({
        page: i,
        width: view.width,
        height: view.height,
        rotation: view.rotation,
        items: content.items
          .filter((v): v is Extract<typeof v, { str: string }> => 'str' in v)
          .map((v) => ({
            text: v.str,
            transform: v.transform,
            width: v.width,
            height: v.height,
            font: v.fontName,
            endOfLine: v.hasEOL,
          })),
      });
      ctx.report({
        percent: (++done / Math.max(1, total)) * 100,
        label: `Textstruktur Seite ${done}`,
      });
    }
    documents.push({ name: source.name, pages });
  }
  return {
    blob: new Blob(
      [
        JSON.stringify(
          {
            schema: 'moinpdf-document/1',
            coordinates: 'PDF text matrices in points; page viewport dimensions include rotation',
            documents,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    ),
    filename: 'MoinPDF-Dokumentstruktur.json',
    pages: total,
    kind: 'data' as const,
    note: 'Auslesbarer PDF-Text mit Fundstellen. Reine Scans zuerst mit OCR durchsuchbar machen.',
  };
}
