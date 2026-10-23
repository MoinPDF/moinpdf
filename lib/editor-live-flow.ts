import type { Source, PageItem } from './pdf-engine';
import type { Edits } from './studio-engine';
import { readTextTargets, editorTextCollision } from './editor-model';
import { distributeEditorFlow, type EditorFlowFrame } from './editor-workflow';
import { editorSegments } from './editor-rich-text';

/** Recalculate only explicitly linked, fixed frames. No page/geometry creation,
 * no font shrinking, no partial application when any frame fails. */
export async function prepareLinkedEditorFlow(
  sources: Source[],
  pages: PageItem[],
  edits: Edits,
  group: string,
  signal: AbortSignal,
) {
  const entries = pages
    .flatMap((page) =>
      (edits.marks[page.id] || [])
        .filter((mark) => mark.flow?.id === group)
        .map((mark) => ({ page, mark })),
    )
    .sort((a, b) => a.mark.flow!.order - b.mark.flow!.order);
  if (
    entries.length < 2 ||
    entries.some(
      (e, i) =>
        e.mark.flow!.order !== i ||
        e.mark.tableCell ||
        e.mark.sourceIsScan ||
        edits.crops[e.page.id],
    )
  )
    throw new Error(
      'Der verknüpfte Textfluss ist unvollständig oder enthält nicht unterstützte Bereiche.',
    );
  const frames: EditorFlowFrame[] = [];
  for (const { page, mark } of entries) {
    signal.throwIfAborted();
    const source = sources.find((s) => s.id === page.sourceId);
    if (!source) throw new Error('Das Originaldokument fehlt.');
    const pdfPage = await source.pdf.getPage(page.index + 1);
    const { width, height } = pdfPage.getViewport({
      scale: 1,
      rotation: (pdfPage.rotate + page.rotation) % 360,
    });
    frames.push({ mark, pageId: page.id, source, width, height });
  }
  const marks = (await distributeEditorFlow(frames, signal)).map((entry) => ({
    ...entry,
    mark: { ...entry.mark, runs: editorSegments(entry.mark) },
  }));
  const next: Edits = { ...edits, marks: { ...edits.marks } };
  for (const { pageId, mark } of marks)
    next.marks[pageId] = next.marks[pageId].map((m) => (m.id === mark.id ? mark : m));
  for (const pageId of new Set(marks.map((m) => m.pageId))) {
    signal.throwIfAborted();
    const frame = frames.find((f) => f.pageId === pageId)!;
    const { targets } = await readTextTargets(
      frame.source,
      pages.find((p) => p.id === pageId)!,
    );
    if (
      marks
        .filter((m) => m.pageId === pageId)
        .some((m) => editorTextCollision(m.mark, next.marks[pageId], targets))
    )
      throw new Error(
        'Der Textfluss würde einen anderen Inhalt überlappen. Bitte die Zielrahmen verschieben.',
      );
  }
  signal.throwIfAborted();
  const changed = marks.some((m) => {
    const old = frames.find((f) => f.mark.id === m.mark.id)!.mark;
    return (
      old.text !== m.mark.text ||
      JSON.stringify(editorSegments(old)) !== JSON.stringify(m.mark.runs) ||
      old.listStart !== m.mark.listStart ||
      old.listContinuation !== m.mark.listContinuation
    );
  });
  return { edits: next, marks, changed };
}
