import type { Source, PageItem } from './pdf-engine';
import type { Edits, Mark, Rect } from './studio-engine';
import {
  readTextTargets,
  editorMarkChanged,
  editorRectsOverlap,
  editorRemovalRects,
  editorTextCollision,
} from './editor-model';
import { prepareEditorRuns } from './editor-rich-layout';
import { editorLayoutPlan, prepareEditorLayout } from './editor-layout-plan';

async function readState(source: Source, page: PageItem) {
  const text = await readTextTargets(source, page),
    pdfPage = await source.pdf.getPage(page.index + 1),
    viewport = pdfPage.getViewport({ scale: 1, rotation: (pdfPage.rotate + page.rotation) % 360 });
  const widgets: Rect[] = [];
  for (const a of await pdfPage.getAnnotations())
    if (a.subtype === 'Widget' && Array.isArray(a.rect)) {
      const [ma, mb, mc, md, me, mf] = viewport.transform,
        [ax, ay, bx, by] = a.rect;
      const [x0, y0, x1, y1] = [
        ma * ax + mc * ay + me,
        mb * ax + md * ay + mf,
        ma * bx + mc * by + me,
        mb * bx + md * by + mf,
      ];
      widgets.push({
        x: Math.min(x0, x1) / text.width,
        y: Math.min(y0, y1) / text.height,
        w: Math.abs(x1 - x0) / text.width,
        h: Math.abs(y1 - y0) / text.height,
      });
    }
  return { ...text, widgets };
}
const documentState = new WeakMap<
  Source,
  Map<string, Promise<Awaited<ReturnType<typeof readState>>>>
>();
export function editorDocumentState(source: Source, page: PageItem) {
  const cache =
      documentState.get(source) ||
      new Map<string, Promise<Awaited<ReturnType<typeof readState>>>>(),
    key = `${page.index}:${page.rotation}`;
  documentState.set(source, cache);
  let pending = cache.get(key);
  if (pending) {
    cache.delete(key);
    cache.set(key, pending);
    return pending;
  }
  pending = readState(source, page);
  cache.set(key, pending);
  // Transient parser/worker failures must remain retryable.
  void pending.catch(() => {
    if (cache.get(key) === pending) cache.delete(key);
  });
  while (cache.size > 16) cache.delete(cache.keys().next().value!);
  return pending;
}
export type EditorPreflightIssue = {
  pageId: string;
  markId: string;
  message: string;
  kind: 'layout' | 'font' | 'collision' | 'error';
};
export async function preflightEditor(
  sources: Source[],
  pages: PageItem[],
  edits: Edits,
  signal: AbortSignal,
) {
  const issues: EditorPreflightIssue[] = [];
  for (const page of pages) {
    const marks = (edits.marks[page.id] || []).filter(editorMarkChanged);
    if (!marks.length) continue;
    signal.throwIfAborted();
    const source = sources.find((s) => s.id === page.sourceId);
    if (!source) throw new Error('Das Quelldokument fehlt.');
    const state = await editorDocumentState(source, page);
    signal.throwIfAborted();
    for (const mark of marks) {
      const add = (kind: EditorPreflightIssue['kind'], message: string) =>
        issues.push({ pageId: page.id, markId: mark.id, kind, message });
      if (
        state.widgets.some((r) =>
          [mark, ...editorRemovalRects(mark)].some((m) => editorRectsOverlap(m, r)),
        )
      )
        add('collision', 'Die Änderung berührt ein Formularfeld.');
      if (mark.kind !== 'text' || !mark.text) continue;
      if (editorTextCollision(mark, marks, state.targets))
        add('collision', 'Der Text überlappt einen anderen Inhalt.');
      try {
        const runs = await prepareEditorRuns(mark, source);
        signal.throwIfAborted();
        if (editorLayoutPlan(mark, state.width, state.height, runs).overflow)
          add('layout', 'Das Textfeld ist zu klein.');
        if (runs.some((r) => r.resolution.substituted))
          add('font', 'Ein Teil des Texts verwendet eine Ersatzschrift.');
      } catch (error) {
        signal.throwIfAborted();
        add(
          'error',
          error instanceof Error ? error.message : 'Die Schrift konnte nicht vorbereitet werden.',
        );
      }
    }
  }
  return issues;
}

/** Increase height only. Recheck real non-text objects and widgets before
 * offering a change; never shrink or move neighbouring content. */
export async function safeEditorHeight(
  source: Source,
  page: PageItem,
  mark: Mark,
  marks: Mark[],
  signal: AbortSignal,
): Promise<Partial<Mark>> {
  if (mark.tableCell)
    throw new Error('Die Höhe einer Tabellenzelle bitte über die Tabellenzeile anpassen.');
  if (mark.kind !== 'text' || mark.textRotation)
    throw new Error('Die automatische Höhenanpassung ist nur für waagerechten Text verfügbar.');
  const state = await editorDocumentState(source, page),
    layout = await prepareEditorLayout(mark, state.width, state.height, source);
  const next = { ...mark, h: Math.max(mark.h, (layout.requiredHeight + 2) / state.height) };
  if (
    next.y + next.h > 1 ||
    next.x < 0 ||
    next.x + next.w > 1 ||
    (await prepareEditorLayout(next, state.width, state.height, source)).overflow
  )
    throw new Error('Der Text passt nicht innerhalb der Seitengrenzen.');
  if (
    editorTextCollision(
      next,
      marks.map((m) => (m.id === mark.id ? next : m)),
      state.targets,
    ) ||
    state.widgets.some((r) => editorRectsOverlap(next, r))
  )
    throw new Error('Die größere Textfläche würde einen anderen Inhalt berühren.');
  const { loadEditorPdf, editorSinglePage } = await import('./editor-native'),
    { inspectObjectTree } = await import('./native-pdf');
  const single = await editorSinglePage(await loadEditorPdf(source.bytes, source, signal), page),
    objects = await inspectObjectTree(await single.save(), 0, signal);
  if (
    objects.some(
      (o) =>
        !['text', 'group'].includes(o.type) &&
        editorRectsOverlap(next, {
          x: o.x - 0.5 / state.width,
          y: o.y - 0.5 / state.height,
          w: o.w + 1 / state.width,
          h: o.h + 1 / state.height,
        }),
    )
  )
    throw new Error('Die größere Textfläche würde ein Bild oder eine Linie berühren.');
  signal.throwIfAborted();
  return { h: next.h };
}

export async function testEditorRemoval(
  source: Source,
  page: PageItem,
  marks: Mark[],
  signal: AbortSignal,
) {
  const selected = marks.filter((m) => m.kind === 'text' && m.sourceRect && editorMarkChanged(m));
  if (!selected.length) return;
  if (selected.some((m) => m.sourceIsScan))
    throw new Error('Scan-Korrekturen werden beim Export anhand der Bildpixel geprüft.');
  const state = await editorDocumentState(source, page),
    { loadEditorPdf, removeEditorContent } = await import('./editor-native');
  await removeEditorContent(
    await loadEditorPdf(source.bytes, source, signal),
    page,
    selected,
    state.targets,
    signal,
  );
  signal.throwIfAborted();
}
