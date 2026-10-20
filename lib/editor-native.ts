import { PDFDocument, degrees } from 'pdf-lib';
import { renderPage, type PageItem, type Source } from './pdf-engine';
import type { Mark } from './studio-engine';
import { editorRemovalRects, type TextTarget } from './editor-model';
import { remainingEditorTargets } from './editor-analysis';
import { readPdfText } from './pdf-text';

/** Remove old text with PDFium, then independently verify the surviving text.
 * The caller can rebuild from visible pixels if this document is unsupported. */
export async function removeEditorContent(
  original: PDFDocument,
  item: PageItem,
  marks: Mark[],
  targets: TextTarget[],
  signal: AbortSignal,
) {
  const single = await PDFDocument.create();
  const [page] = await single.copyPages(original, [item.index]);
  page.setRotation(degrees((page.getRotation().angle + item.rotation) % 360));
  single.addPage(page);
  const removals = marks.flatMap((mark) =>
    editorRemovalRects(mark).map((rect) => ({
      page: 0,
      rect,
      color: mark.fill || '#ffffff',
      textOnly: mark.kind === 'text',
    })),
  );
  const { removeRegions } = await import('./native-pdf');
  const cleaned = await removeRegions(await single.save(), removals, signal);
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: cleaned.slice(),
    disableFontFace: true,
    standardFontDataUrl: '/vendor/pdf/standard_fonts/',
    cMapUrl: '/vendor/pdf/cmaps/',
    cMapPacked: true,
  });
  const cancel = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const proxy = await task.promise;
    const content = await readPdfText(await proxy.getPage(1));
    const actual = content.items
      .filter((p) => 'str' in p)
      .map((p) => ('str' in p ? p.str : ''))
      .join('');
    const expected = remainingEditorTargets(
      targets,
      removals.map((r) => r.rect),
    )
      .map((t) => t.text)
      .join('');
    const normalized = (text: string) => text.normalize('NFKC').replace(/\s/gu, '');
    if (normalized(actual) !== normalized(expected))
      throw new Error('Die verbleibenden Textinhalte konnten nicht vollständig bestätigt werden.');
  } finally {
    signal.removeEventListener('abort', cancel);
    await task.destroy();
  }
  return PDFDocument.load(cleaned, { updateMetadata: false });
}

/** The editor background uses the same physical removal as export. It is keyed
 * by removal rectangles, not replacement text, so typing does not rerun PDFium. */
export async function renderEditorBackground(
  source: Source,
  item: PageItem,
  marks: Mark[],
  targets: TextTarget[],
  signal: AbortSignal,
) {
  const original = await PDFDocument.load(source.bytes.slice(), { updateMetadata: false });
  const cleaned = await removeEditorContent(original, item, marks, targets, signal);
  signal.throwIfAborted();
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: await cleaned.save(),
    standardFontDataUrl: '/vendor/pdf/standard_fonts/',
    cMapUrl: '/vendor/pdf/cmaps/',
    cMapPacked: true,
    wasmUrl: '/vendor/pdf/wasm/',
  });
  const cancel = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const pdf = await task.promise;
    signal.throwIfAborted();
    return await renderPage({ ...source, pdf }, { index: 0, rotation: 0 }, 1400, signal);
  } finally {
    signal.removeEventListener('abort', cancel);
    await task.destroy();
  }
}
