import { PDFDocument } from 'pdf-lib';
import { MAX_BYTES, openSource, uid, type Source, type PageItem } from './pdf-engine';
import type { Edits, Mark, Rect } from './studio-engine';
import { readTextTargets, editorParagraphs, editorRectsOverlap } from './editor-model';
import { editorTargetMark, editorBounds } from './editor-blocks';
import { loadEditorPdf, editorSinglePage } from './editor-native';
import { rejectSignedPdf } from './pdf-signature-guard';
import { prepareEditorLayout } from './editor-layout-plan';
import { prepareEditorRuns } from './editor-rich-layout';
import { distributeEditorFlow } from './editor-workflow';
import {
  prepareEditorAutoFlow,
  suggestEditorFlowBottom,
  type AutoFlowPlan,
  type FlowParagraph,
} from './editor-auto-flow';

const same = (a: Rect, b: Rect) =>
  (['x', 'y', 'w', 'h'] as const).every((key) => Math.abs(a[key] - b[key]) < 0.00001);
export async function prepareEditorAutoWorkspace(
  source: Source,
  page: PageItem,
  marks: Mark[],
  selectedId: string,
  bottom: number,
  pageCount: number,
  signal: AbortSignal,
) {
  const selected = marks.find((m) => m.id === selectedId);
  if (!selected?.sourceRect || selected.kind !== 'text' || selected.sourceIsScan || selected.flow)
    throw new Error(
      'Bitte einen vollständigen digitalen Absatz auswählen. Bereits verknüpfte Textfelder bitte über „Textfelder verknüpfen“ bearbeiten.',
    );
  const original = await loadEditorPdf(source.bytes, source, signal);
  rejectSignedPdf(original);
  if (
    original.catalog.has((await import('pdf-lib')).PDFName.of('AcroForm')) ||
    (await (await source.pdf.getPage(page.index + 1)).getAnnotations()).length
  )
    throw new Error('Absatzfluss ist auf Seiten mit Formularen oder Anmerkungen nicht verfügbar.');
  const { targets, width, height } = await readTextTargets(source, page),
    groupId = uid();
  const paragraphs = editorParagraphs(targets, width, height);
  const originalRect = (m: Mark) =>
    editorBounds(m.sourceRects?.length ? m.sourceRects : m.sourceRect ? [m.sourceRect] : [m]);
  const selectedRect = originalRect(selected);
  if (!paragraphs.some((p) => same(p, selectedRect)))
    throw new Error('Bitte zuerst den Absatzmodus wählen und den vollständigen Absatz anklicken.');
  const used = new Set<string>(),
    inputs: FlowParagraph[] = paragraphs.map((target, i) => {
      const existing = marks.filter(
        (m) => m.kind === 'text' && m.sourceRect && same(originalRect(m), target),
      );
      if (existing.length > 1)
        throw new Error(
          'Mehrere Änderungen betreffen denselben Absatz. Bitte die Auswahl bereinigen.',
        );
      if (existing[0]) used.add(existing[0].id);
      const mark =
        existing[0] ||
        editorTargetMark(
          { ...target, unsupportedReason: undefined },
          page.index,
          width,
          `${groupId}:original:${i}`,
        );
      return {
        mark,
        original: { x: target.x, y: target.y, w: target.w, h: target.h },
        unsupportedReason: target.unsupportedReason,
        fixed: false,
      };
    });
  const { inspectObjectTree } = await import('./native-pdf');
  const objects = await inspectObjectTree(
    await (await editorSinglePage(original, page)).save(),
    0,
    signal,
  );
  if (objects.some((o) => o.clipped || o.type === 'other'))
    throw new Error(
      'Die Seite enthält Inhalte, deren Abstand zum Text nicht zuverlässig bestimmt werden kann.',
    );
  const obstacles: Rect[] = [
    ...objects
      .filter((o) => !['text', 'group'].includes(o.type))
      .map((o) => {
        const x = Math.max(0, o.x - 0.5 / width),
          y = Math.max(0, o.y - 0.5 / height);
        return {
          x,
          y,
          w: Math.min(1, o.x + o.w + 0.5 / width) - x,
          h: Math.min(1, o.y + o.h + 0.5 / height) - y,
        };
      })
      .filter((o) => o.w > 0 && o.h > 0),
    ...marks.filter((m) => !used.has(m.id)),
  ];
  if (bottom === 0)
    bottom = suggestEditorFlowBottom(
      { ...selectedRect, w: Math.max(selected.w, selectedRect.w) },
      paragraphs,
      obstacles,
      height,
    );
  if (!Number.isFinite(bottom) || bottom <= selectedRect.y + selectedRect.h || bottom > 0.95)
    throw new Error('Die untere Textgrenze muss unter dem ausgewählten Absatz liegen.');
  for (const input of inputs) input.fixed = input.original.y >= bottom;
  const region = {
    x: selectedRect.x,
    y: selectedRect.y,
    w: Math.max(selected.w, selectedRect.w),
    h: bottom - selectedRect.y,
  };
  if (
    inputs.some(
      (p) =>
        p.mark.id !== selectedId &&
        marks.some((m) => !used.has(m.id) && editorRectsOverlap(m, p.original)),
    )
  )
    throw new Error(
      'Eine weitere Änderung überschneidet einen Absatz. Bitte zuerst diese Änderung abschließen.',
    );
  try {
    return await prepareEditorAutoFlow(
      {
        source,
        originalPageId: page.id,
        width,
        height,
        selectedId,
        paragraphs: inputs,
        obstacles,
        region,
        continuationRegion: { ...region, y: 0.1, h: bottom - 0.1 },
        groupId,
        documentPageCount: pageCount,
        signal,
      },
      { layout: prepareEditorLayout, distribute: distributeEditorFlow },
    );
  } catch (error) {
    signal.throwIfAborted();
    throw new Error(
      'Der Absatzfluss passt nicht sicher in die gewählte Spalte. Bitte Breite, untere Textgrenze und benachbarte Inhalte prüfen.',
      { cause: error },
    );
  }
}

export async function materializeEditorAutoFlow(
  plan: AutoFlowPlan,
  source: Source,
  page: PageItem,
  pages: PageItem[],
  edits: Edits,
  signal: AbortSignal,
  open: typeof openSource = openSource,
) {
  signal.throwIfAborted();
  if (
    plan.sourceId !== source.id ||
    plan.originalPageId !== page.id ||
    !pages.some((p) => p.id === page.id) ||
    plan.pages.length > 21 ||
    pages.length + plan.pages.length - 1 > 200
  )
    throw new Error('Die Absatzvorschau gehört nicht mehr zum aktuellen Dokument.');
  let addedSource: Source | undefined;
  try {
    const continuation = plan.pages.slice(1);
    if (continuation.length) {
      const doc = await PDFDocument.create(),
        original = await loadEditorPdf(source.bytes, source, signal);
      const [reference] = await doc.copyPages(original, [page.index]);
      doc.addPage(reference);
      for (const slot of continuation) doc.addPage([slot.width, slot.height]);
      const bytes = await doc.save();
      if (bytes.length > MAX_BYTES)
        throw new Error('Die Fortsetzung überschreitet die Grenze von 80 MB.');
      addedSource = await open(
        new File([new Uint8Array(bytes)], 'Absatzfortsetzung.pdf', { type: 'application/pdf' }),
      );
      signal.throwIfAborted();
    }
    const next: Edits = { ...edits, marks: { ...edits.marks } },
      affected = new Set(plan.affectedParagraphIds);
    next.marks[page.id] = [
      ...(edits.marks[page.id] || []).filter((m) => !affected.has(m.id)),
      ...plan.pages[0].chunks.map((c) => c.mark),
    ];
    const inserted: PageItem[] = [];
    for (const slot of continuation) {
      const marks = slot.chunks.map(({ mark }) => ({
        ...mark,
        originalFontPage: mark.originalFontPage === undefined ? undefined : 0,
        runs: mark.runs?.map((r) => ({
          ...r,
          style: {
            ...r.style,
            originalFontPage: r.style.originalFontPage === undefined ? undefined : 0,
          },
        })),
      }));
      for (let i = 0; i < marks.length; i++) {
        const before = await prepareEditorRuns(slot.chunks[i].mark, source),
          after = await prepareEditorRuns(marks[i], addedSource);
        if (
          before.length !== after.length ||
          before.some((r, j) => r.resolution.font.id !== after[j].resolution.font.id)
        )
          throw new Error(
            'Die Schrift der Absatzfortsetzung konnte nicht unverändert übernommen werden.',
          );
        if ((await prepareEditorLayout(marks[i], slot.width, slot.height, addedSource)).overflow)
          throw new Error('Der Text passt nach der Übernahme nicht auf die Fortsetzungsseite.');
      }
      next.marks[slot.pageId] = marks;
      inserted.push({
        id: slot.pageId,
        sourceId: addedSource!.id,
        index: slot.slot,
        rotation: 0,
        selected: true,
      });
    }
    signal.throwIfAborted();
    const at = pages.findIndex((p) => p.id === page.id) + 1;
    return {
      addedSource,
      pages: [...pages.slice(0, at), ...inserted, ...pages.slice(at)],
      edits: next,
    };
  } catch (error) {
    if (addedSource) await addedSource.pdf.loadingTask.destroy();
    throw error;
  }
}
