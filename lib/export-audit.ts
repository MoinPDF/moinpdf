import type { PDFDocumentProxy } from 'pdfjs-dist';
import { withPdfDocument, PdfTimeoutError, type Source, type PageItem } from './pdf-engine';
import { readPdfText } from './pdf-text';
export type ExportAudit = {
  version: 1;
  status: 'checked' | 'review' | 'unavailable' | 'invalid';
  pages: number;
  checkedPages: number;
  issues: {
    code:
      | 'pages'
      | 'geometry'
      | 'text'
      | 'links'
      | 'forms'
      | 'partial'
      | 'encrypted'
      | 'unreadable'
      | 'timeout'
      | 'empty';
    page?: number;
    before?: number;
    after?: number;
  }[];
  compared: boolean;
};
type Summary = {
  width: number;
  height: number;
  words: Map<string, number>;
  links: number;
  forms: number;
  limited: boolean;
};
async function summarize(
  pdf: PDFDocumentProxy,
  index: number,
  rotation: number,
  signal: AbortSignal,
): Promise<Summary> {
  signal.throwIfAborted();
  const page = await pdf.getPage(index + 1);
  try {
    const viewport = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
    const text = await readPdfText(page),
      annotations = await page.getAnnotations();
    signal.throwIfAborted();
    const words = new Map<string, number>();
    let characters = 0,
      limited = false;
    for (const item of text.items)
      if ('str' in item) {
        characters += item.str.length;
        if (characters > 100_000) {
          limited = true;
          break;
        }
        for (const word of item.str.normalize('NFKC').split(/\s+/).filter(Boolean))
          words.set(word, (words.get(word) || 0) + 1);
      }
    return {
      width: viewport.width,
      height: viewport.height,
      words,
      links: annotations.filter((a) => a.subtype === 'Link').length,
      forms: annotations.filter((a) => a.subtype === 'Widget').length,
      limited,
    };
  } finally {
    page.cleanup();
  }
}
const preserveText = new Set([
  'compress',
  'watermark',
  'numbers',
  'organize',
  'merge',
  'images',
  'rotate',
  'metadata',
  'bookmarks',
  'unlock',
  'optimize-pdf',
]);
export async function auditPdfExport(
  blob: Blob,
  expectedPages: number | undefined,
  sources: Source[],
  mapping: PageItem[] | undefined,
  tool: string | undefined,
  signal: AbortSignal,
): Promise<ExportAudit> {
  const result: ExportAudit = {
    version: 1,
    status: 'checked',
    pages: 0,
    checkedPages: 0,
    issues: [],
    compared: !!mapping?.length,
  };
  if (!blob.size) return { ...result, status: 'invalid', issues: [{ code: 'empty' }] };
  signal.throwIfAborted();
  try {
    return await withPdfDocument(
      new Uint8Array(await blob.arrayBuffer()),
      signal,
      async (pdf, signal, step) => {
        result.pages = pdf.numPages;
        if (expectedPages && expectedPages !== pdf.numPages)
          result.issues.push({ code: 'pages', before: expectedPages, after: pdf.numPages });
        for (let index = 0; index < Math.min(200, pdf.numPages); index++) {
          const after = await step('audit-output', summarize(pdf, index, 0, signal));
          const ref = mapping?.[index],
            source = sources.find((s) => s.id === ref?.sourceId);
          if (after.limited) result.issues.push({ code: 'partial', page: index + 1 });
          if (ref && source) {
            const before = await step(
              'audit-original',
              summarize(source.pdf, ref.index, ref.rotation, signal),
            );
            const issue = (code: 'links' | 'forms', a: number, b: number) => {
              if (a !== b) result.issues.push({ code, page: index + 1, before: a, after: b });
            };
            issue('links', before.links, after.links);
            issue('forms', before.forms, after.forms);
            if (
              Math.abs(before.width - after.width) > 1 ||
              Math.abs(before.height - after.height) > 1
            )
              result.issues.push({ code: 'geometry', page: index + 1 });
            if (before.limited) result.issues.push({ code: 'partial', page: index + 1 });
            if (
              preserveText.has(tool || '') &&
              [...before.words].some(([word, count]) => (after.words.get(word) || 0) < count)
            )
              result.issues.push({ code: 'text', page: index + 1 });
          }
          result.checkedPages++;
          // Yield between pages so cancellation and the rest of the workplace stay responsive.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        if (pdf.numPages > result.checkedPages) result.issues.push({ code: 'partial' });
        if (result.issues.length) result.status = 'review';
        return result;
      },
      { disableFontFace: true },
    );
  } catch (error) {
    signal.throwIfAborted();
    return {
      ...result,
      status: (error as Error).name === 'PasswordException' ? 'unavailable' : 'invalid',
      issues: [
        {
          code:
            error instanceof PdfTimeoutError
              ? 'timeout'
              : (error as Error).name === 'PasswordException'
                ? 'encrypted'
                : 'unreadable',
        },
      ],
    };
  }
}
