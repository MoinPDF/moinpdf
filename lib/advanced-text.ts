import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import {
  extractPageText,
  renderPage,
  sourcePages,
  abortable,
  pdfBlob,
  type Source,
} from './pdf-engine';
import { readTextTargets, type TextTarget } from './editor-model';
import { readDocumentDraft } from './document-tools';
import { inspectPage } from './document-check';
import { emptyEdits, type StudioOptions } from './studio-engine';
import { extraDefaults } from './extra-options';
import {
  checkAbort,
  safeName,
  uniqueNames,
  type ExportFile,
  type RunContext,
} from './advanced-types';
import type { Worker } from 'tesseract.js';
import { decodePageCodes } from './advanced-media';

export const workflowOptions: StudioOptions = {
  ...extraDefaults,
  language: 'deu',
  forceOcr: false,
  imageFormat: 'png',
  quality: 'balanced',
  watermark: 'ENTWURF',
  numberStart: 1,
  pageSize: 'a4',
  orientation: 'portrait',
  perSheet: '2',
};
export async function textTargets(
  source: Source,
  index: number,
  ocr: boolean,
  ctx: RunContext,
): Promise<TextTarget[]> {
  checkAbort(ctx.signal);
  const item = sourcePages(source)[index];
  if (!ocr) return (await readTextTargets(source, item)).targets;
  let worker: Worker | undefined;
  const stop = () => void worker?.terminate();
  ctx.signal.addEventListener('abort', stop, { once: true });
  const { canvas } = await renderPage(source, item, 2400, ctx.signal);
  try {
    const { createWorker, PSM } = await import('tesseract.js');
    const creating = createWorker('deu+eng', 1, {
      workerPath: '/vendor/ocr/worker.min.js',
      corePath: '/vendor/ocr',
      langPath: '/vendor/languages',
      workerBlobURL: false,
      logger: (m) => {
        if (m.status === 'recognizing text')
          ctx.report({ percent: m.progress * 100, label: `OCR · Seite ${index + 1}` });
      },
    });
    creating
      .then((w) => {
        if (ctx.signal.aborted) void w.terminate();
      })
      .catch(() => {});
    worker = await abortable(creating, ctx.signal);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await abortable(
      worker.recognize(canvas, {}, { text: true, blocks: true }),
      ctx.signal,
    );
    return (data.blocks || [])
      .flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
      .filter((w) => w.text.trim())
      .map((w, i) => ({
        id: `ocr-${i}`,
        text: w.text,
        x: w.bbox.x0 / canvas.width,
        y: w.bbox.y0 / canvas.height,
        w: (w.bbox.x1 - w.bbox.x0) / canvas.width,
        h: (w.bbox.y1 - w.bbox.y0) / canvas.height,
        fontSize: 12,
        family: 'sans' as const,
      }));
  } finally {
    canvas.width = canvas.height = 0;
    ctx.signal.removeEventListener('abort', stop);
    await worker?.terminate();
  }
}
export function renameSuggestion(
  text: string,
  fallback: string,
  template = '{datum}_{nummer}_{titel}',
) {
  const iso = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[012])[-/.]([012]?\d|3[01])\b/),
    de = text.match(/\b([012]?\d|3[01])[./](0?[1-9]|1[012])[./](20\d{2})\b/);
  const date = iso
    ? `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
    : de
      ? `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`
      : '';
  const number =
    text.match(
      /(?:Rechnung(?:snummer|s?[ -]?(?:nr\.?|no\.?))|Invoice\s*(?:no\.?|number)|Beleg(?:nummer|[ -]?nr\.?))\s*[:#]?\s*([A-Z0-9][A-Z0-9/_.-]{1,45})/i,
    )?.[1] || '';
  const title = (
    text
      .split(/\n/)
      .map((s) => s.trim())
      .find((s) => s.length >= 5 && /[a-zäöü]/i.test(s)) || fallback.replace(/\.pdf$/i, '')
  ).slice(0, 60);
  return {
    date,
    number,
    title,
    name:
      safeName(
        template
          .replace(/\{datum\}/g, date)
          .replace(/\{nummer\}/g, number)
          .replace(/\{titel\}/g, title)
          .replace(/[_ ]{2,}/g, '_')
          .replace(/^[_ ]+|[_ ]+$/g, ''),
      ) + '.pdf',
  };
}
export async function suggestNames(sources: Source[], template: string, ctx: RunContext) {
  const rows = [];
  for (const [i, source] of sources.entries()) {
    checkAbort(ctx.signal);
    let text = '';
    for (const page of sourcePages(source).slice(0, 3))
      text += '\n' + (await extractPageText(source, page));
    rows.push({
      id: source.id,
      ...renameSuggestion(text, source.name, template),
      hasText: !!text.trim(),
    });
    ctx.report({ percent: ((i + 1) / sources.length) * 100, label: source.name });
  }
  return rows;
}
export async function renamedZip(sources: Source[], names: string[]): Promise<ExportFile> {
  const zip = new JSZip();
  uniqueNames(names.map((n) => n.replace(/\.pdf$/i, '') + '.pdf')).forEach((name, i) =>
    zip.file(name, sources[i].bytes),
  );
  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    filename: 'Umbenannte-PDFs.zip',
    kind: 'zip',
    pages: sources.reduce((n, s) => n + s.pdf.numPages, 0),
  };
}
export type SplitPart = { name: string; pages: number[] };
export function partsFromStarts(
  count: number,
  starts: number[],
  excluded: number[] = [],
): SplitPart[] {
  const boundaries = [...new Set([0, ...starts.filter((n) => n >= 0 && n < count), count])].sort(
    (a, b) => a - b,
  );
  return boundaries
    .slice(0, -1)
    .map((start, i) => ({
      name: `Abschnitt-${i + 1}.pdf`,
      pages: Array.from({ length: boundaries[i + 1] - start }, (_, j) => start + j).filter(
        (p) => !excluded.includes(p),
      ),
    }))
    .filter((p) => p.pages.length);
}
export async function planSplit(
  source: Source,
  mode: 'text' | 'bookmarks' | 'blank' | 'qr',
  query: string,
  exclude: boolean,
  ctx: RunContext,
): Promise<SplitPart[]> {
  const starts: number[] = [],
    excluded: number[] = [];
  if (mode === 'bookmarks') {
    const draft = await readDocumentDraft(source, ctx.signal);
    const bookmarks = draft.bookmarks.filter((b) => b.depth === 0 && b.page !== null);
    if (!bookmarks.length) throw new Error('Keine Lesezeichen mit einer Zielseite gefunden.');
    const parts = partsFromStarts(
      source.pdf.numPages,
      bookmarks.map((b) => b.page!),
    );
    return parts.map((p) => ({
      ...p,
      name:
        safeName(
          bookmarks.find((b) => b.page === p.pages[0])?.title || p.name.replace(/\.pdf$/, ''),
        ) + '.pdf',
    }));
  }
  if (mode === 'text' && !query.trim()) throw new Error('Bitte einen Trenntext eingeben.');
  for (const [i, page] of sourcePages(source).entries()) {
    checkAbort(ctx.signal);
    let match = false;
    if (mode === 'text')
      match = (await extractPageText(source, page))
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase());
    if (mode === 'blank') match = (await inspectPage(source, page, i, ctx.signal)).blank;
    if (mode === 'qr') {
      match = (await decodePageCodes(source, i, ctx)).some(
        (c) => !query.trim() || c.text.includes(query.trim()),
      );
    }
    if (match) {
      starts.push(i);
      if (exclude && (mode === 'blank' || mode === 'qr')) excluded.push(i);
    }
    ctx.report({
      percent: ((i + 1) / source.pdf.numPages) * 100,
      label: `Trennstellen · Seite ${i + 1}`,
    });
  }
  return partsFromStarts(source.pdf.numPages, starts, excluded);
}
export async function saveSplit(
  source: Source,
  parts: SplitPart[],
  ctx: RunContext,
): Promise<ExportFile> {
  if (!parts.length) throw new Error('Keine Seiten für den Export.');
  const original = await PDFDocument.load(source.bytes),
    zip = new JSZip(),
    names = uniqueNames(parts.map((p) => p.name.replace(/\.pdf$/i, '') + '.pdf'));
  for (const [i, part] of parts.entries()) {
    checkAbort(ctx.signal);
    const doc = await PDFDocument.create();
    for (const page of await doc.copyPages(original, part.pages)) doc.addPage(page);
    zip.file(names[i], await doc.save());
    ctx.report({ percent: ((i + 1) / parts.length) * 100, label: names[i] });
  }
  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    filename: 'Geteilte-PDFs.zip',
    kind: 'zip',
    pages: parts.reduce((n, p) => n + p.pages.length, 0),
  };
}
export type RedactionHit = {
  id: string;
  page: number;
  text: string;
  rects: TextTarget[];
  selected: boolean;
};
export function findTextHits(
  targets: TextTarget[],
  terms: string[],
  emails: boolean,
  ibans: boolean,
) {
  // Match across adjacent OCR words/PDF text runs, then redact complete intersecting runs.
  const ordered = [...targets].sort((a, b) =>
      Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.5 ? a.x - b.x : a.y - b.y,
    ),
    starts: number[] = [],
    text = ordered.map((t) => t.text).join(' ');
  let at = 0;
  for (const t of ordered) {
    starts.push(at);
    at += t.text.length + 1;
  }
  const ranges: { start: number; end: number; text: string }[] = [];
  for (const term of terms.map((t) => t.trim()).filter(Boolean)) {
    const folded = text.toLocaleLowerCase(),
      needle = term.toLocaleLowerCase();
    let start = 0;
    while ((start = folded.indexOf(needle, start)) >= 0) {
      ranges.push({
        start,
        end: start + needle.length,
        text: text.slice(start, start + needle.length),
      });
      start += needle.length;
    }
  }
  for (const pattern of [
    emails ? /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi : null,
    ibans ? /\b[A-Z]{2}\s?\d{2}(?:\s?[A-Z0-9]){11,30}\b/g : null,
  ])
    if (pattern)
      for (const match of text.matchAll(pattern))
        ranges.push({ start: match.index!, end: match.index! + match[0].length, text: match[0] });
  const seen = new Set<string>();
  return ranges
    .map((r) => ({
      text: r.text,
      rects: ordered.filter((t, i) => starts[i] < r.end && starts[i] + t.text.length > r.start),
    }))
    .filter((hit) => {
      const key = hit.rects.map((r) => r.id).join('|');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export async function findRedactions(
  source: Source,
  terms: string,
  emails: boolean,
  ibans: boolean,
  ocr: boolean,
  ctx: RunContext,
) {
  const hits: RedactionHit[] = [];
  for (let i = 0; i < source.pdf.numPages; i++) {
    const targets = await textTargets(source, i, ocr, ctx);
    for (const hit of findTextHits(targets, terms.split(/[\n,]/), emails, ibans))
      hits.push({ ...hit, id: `hit-${hits.length}`, page: i, selected: true });
    ctx.report({
      percent: ((i + 1) / source.pdf.numPages) * 100,
      label: `Fundstellen · Seite ${i + 1}`,
    });
  }
  return hits;
}
export async function redactHits(
  source: Source,
  hits: RedactionHit[],
  ctx: RunContext,
): Promise<ExportFile> {
  if (!hits.some((h) => h.selected)) throw new Error('Bitte mindestens eine Fundstelle auswählen.');
  const pages = sourcePages(source),
    edits = emptyEdits();
  for (const hit of hits.filter((h) => h.selected))
    for (const [i, r] of hit.rects.entries()) {
      const pad = 0.002,
        x = Math.max(0, r.x - pad),
        y = Math.max(0, r.y - pad);
      (edits.marks[pages[hit.page].id] ??= []).push({
        ...r,
        x,
        y,
        w: Math.min(1 - x, r.w + 2 * pad),
        h: Math.min(1 - y, r.h + 2 * pad),
        id: `${hit.id}-${i}`,
        kind: 'redact',
      });
    }
  // Rebuild every page from the visible pixels: no hidden text, old objects, forms or attachments remain.
  const doc = await PDFDocument.create();
  for (const [i, item] of pages.entries()) {
    checkAbort(ctx.signal);
    const { canvas, width, height } = await renderPage(source, item, 2600, ctx.signal);
    try {
      const c = canvas.getContext('2d')!;
      c.fillStyle = '#000';
      for (const r of edits.marks[item.id] || [])
        c.fillRect(
          Math.floor(r.x * canvas.width),
          Math.floor(r.y * canvas.height),
          Math.ceil(r.w * canvas.width) + 2,
          Math.ceil(r.h * canvas.height) + 2,
        );
      const img = await doc.embedPng(canvas.toDataURL('image/png'));
      doc.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
    } finally {
      canvas.width = canvas.height = 0;
    }
    ctx.report({ percent: ((i + 1) / pages.length) * 100, label: `Schwärzen · Seite ${i + 1}` });
  }
  return {
    blob: pdfBlob(await doc.save()),
    filename: safeName(source.name.replace(/\.pdf$/i, '')) + '-geschwaerzt.pdf',
    kind: 'pdf',
    pages: pages.length,
    note: 'Die Ausgabe enthält ausschließlich die sichtbaren Seitenbilder. Bitte die vollständige PDF visuell kontrollieren.',
  };
}
