import {
  extractPageText,
  renderPage,
  abortable,
  type Source,
  type PageItem,
  type ProgressUpdate,
} from './pdf-engine';
import type { ScanQuality } from './scan-quality';
import type { Worker } from 'tesseract.js';
import { parseOcrLanguages } from './ocr-languages';
export type PageIndex = {
  pageId: string;
  sourceId: string;
  originalIndex: number;
  name: string;
  position: number;
  width: number;
  height: number;
  format: string;
  text: string;
  preview: string;
  blank: boolean;
  needsOcr: boolean;
  ocrDone: boolean;
  error?: string;
  quality?: ScanQuality;
};
export const pageKey = (p: PageItem) => `${p.sourceId}:${p.index}:${p.rotation}`;
export const fold = (value: string) =>
  value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de-DE');
export function searchTerms(query: string) {
  return [
    ...new Set(
      query
        .split(',')
        .map((v) => fold(v.trim()))
        .filter((v) => v.length >= 2),
    ),
  ].slice(0, 20);
}
export function findPages(rows: PageIndex[], query: string) {
  const terms = searchTerms(query);
  return terms.length
    ? rows.filter((row) => terms.some((term) => fold(row.text).includes(term)))
    : [];
}
export function excerpt(text: string, query: string) {
  const clean = text.replace(/\s+/g, ' ').trim(),
    normalized = fold(clean),
    positions = searchTerms(query)
      .map((t) => normalized.indexOf(t))
      .filter((n) => n >= 0);
  const at = positions.length ? Math.min(...positions) : 0,
    start = Math.max(0, at - 55);
  return `${start ? '… ' : ''}${clean.slice(start, start + 185)}${clean.length > start + 185 ? ' …' : ''}`;
}
export function formatLabel(width: number, height: number) {
  const a = Math.round((width * 25.4) / 72),
    b = Math.round((height * 25.4) / 72);
  if (Math.abs(a - 210) <= 1 && Math.abs(b - 297) <= 1) return 'A4';
  if (Math.abs(a - 297) <= 1 && Math.abs(b - 210) <= 1) return 'A4 quer';
  if (Math.abs(a - 216) <= 1 && Math.abs(b - 279) <= 1) return 'Letter';
  return `${a} × ${b} mm`;
}
export function nearlyBlank(pixels: Uint8ClampedArray, text: string) {
  if (text.replace(/\s/g, '').length) return false;
  let ink = 0;
  for (let i = 0; i < pixels.length; i += 4)
    if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 235) ink++;
  return ink / (pixels.length / 4) < 0.00015;
}
export function duplicateGroups(rows: PageIndex[]) {
  const groups = new Map<string, PageIndex[]>();
  for (const row of rows) {
    if (row.blank || !row.preview || row.error) continue;
    const key = `${row.width.toFixed(1)}:${row.height.toFixed(1)}:${row.preview}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}
export async function inspectPage(
  source: Source,
  page: PageItem,
  position: number,
  signal: AbortSignal,
): Promise<PageIndex> {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const text = await extractPageText(source, page);
  const { canvas, width, height } = await renderPage(source, page, 384, signal);
  try {
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    const blank = nearlyBlank(
      canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data,
      text,
    );
    return {
      pageId: page.id,
      sourceId: source.id,
      originalIndex: page.index,
      name: source.name,
      position,
      width,
      height,
      format: formatLabel(width, height),
      text,
      preview: canvas.toDataURL('image/png'),
      blank,
      needsOcr: !blank && text.replace(/\s/g, '').length < 20,
      ocrDone: false,
    };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
export async function recognizeForSearch(
  sources: Source[],
  pages: PageItem[],
  language: string,
  onText: (page: PageItem, text: string) => void,
  report: (value: ProgressUpdate) => void,
  signal: AbortSignal,
) {
  if (!pages.length) return;
  let worker: Worker | undefined,
    current = 0;
  const stop = () => {
    void worker?.terminate();
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    report({ percent: 0, label: 'Texterkennung für die Suche wird geladen …' });
    const { createWorker, PSM } = await import('tesseract.js');
    const creating = createWorker(parseOcrLanguages(language), 1, {
      workerPath: '/vendor/ocr/worker.min.js',
      corePath: '/vendor/ocr',
      langPath: '/vendor/languages',
      workerBlobURL: false,
      logger: (m) => {
        if (!signal.aborted && m.status === 'recognizing text')
          report({
            percent: ((current + m.progress * 0.95) / pages.length) * 100,
            label: `Scan ${current + 1} von ${pages.length} erkennen …`,
          });
      },
    });
    creating
      .then((w) => {
        if (signal.aborted) void w.terminate();
      })
      .catch(() => {});
    worker = await abortable(creating, signal);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
    for (current = 0; current < pages.length; current++) {
      if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      const page = pages[current],
        source = sources.find((s) => s.id === page.sourceId)!;
      const { canvas, scale } = await renderPage(source, page, 2600, signal);
      try {
        await worker.setParameters({ user_defined_dpi: String(Math.round(scale * 72)) });
        const { data } = await abortable(worker.recognize(canvas, {}, { text: true }), signal);
        onText(page, data.text.trim());
      } finally {
        canvas.width = canvas.height = 0;
      }
      report({
        percent: ((current + 1) / pages.length) * 100,
        label: `${current + 1} von ${pages.length} Scans erkannt`,
      });
    }
  } finally {
    signal.removeEventListener('abort', stop);
    await worker?.terminate();
  }
}
