import {
  openSource,
  renderPage,
  type Source,
  type PageItem,
  type ProgressUpdate,
} from './pdf-engine';
import type { Edits, Rect } from './studio-engine';
import {
  editorMarkChanged,
  editorRemovalRects,
  editorRectsOverlap,
  readTextTargets,
} from './editor-model';
import { cachedEditorPage, remainingEditorTargets } from './editor-analysis';
import { renderEditorBackground } from './editor-native';
import { paintEditorReference, compareEditorInk } from './editor-ink-verification';
import { editorBounds } from './editor-blocks';
export type EditorVerification = {
  status: 'passed' | 'review';
  textPages: number;
  imagePages: number;
  editedImageFields: number;
  changedPages: number[];
  issues: { page: number; message: string }[];
  sourcePages: Pick<PageItem, 'sourceId' | 'index' | 'rotation'>[];
};
const normalized = (text: string) => text.normalize('NFKC').replace(/\s/gu, '');
const characters = (texts: string[]) => {
  const counts = new Map<string, number>();
  for (const char of normalized(texts.join(''))) counts.set(char, (counts.get(char) || 0) + 1);
  return JSON.stringify([...counts].sort(([a], [b]) => a.localeCompare(b)));
};
export function compareEditorPixels(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
  width: number,
  height: number,
  masks: Rect[],
) {
  if (before.length !== after.length) return 1;
  const ignored = new Uint8Array(width * height);
  for (const r of masks) {
    // Rendering can extend antialiasing by a few pixels around the edit edge.
    const x0 = Math.max(0, Math.floor(r.x * width) - 3),
      x1 = Math.min(width, Math.ceil((r.x + r.w) * width) + 3),
      y0 = Math.max(0, Math.floor(r.y * height) - 3),
      y1 = Math.min(height, Math.ceil((r.y + r.h) * height) + 3);
    for (let y = y0; y < y1; y++) ignored.fill(1, y * width + x0, y * width + x1);
  }
  let changed = 0,
    checked = 0;
  for (let pixel = 0; pixel < ignored.length; pixel++) {
    if (ignored[pixel]) continue;
    checked++;
    const i = pixel * 4;
    if (
      Math.max(
        Math.abs(before[i] - after[i]),
        Math.abs(before[i + 1] - after[i + 1]),
        Math.abs(before[i + 2] - after[i + 2]),
        Math.abs(before[i + 3] - after[i + 3]),
      ) > 32
    )
      changed++;
  }
  return checked ? changed / checked : 0;
}
export async function verifyEditorExport(
  bytes: Uint8Array,
  sources: Source[],
  pages: PageItem[],
  edits: Edits,
  language: string,
  signal: AbortSignal,
  report: (progress: ProgressUpdate) => void,
): Promise<EditorVerification> {
  const output = await openSource(
    new File([bytes.slice().buffer], 'Prüfung.pdf', { type: 'application/pdf' }),
  );
  const result: EditorVerification = {
    status: 'passed',
    textPages: 0,
    imagePages: 0,
    editedImageFields: 0,
    changedPages: [],
    issues: [],
    sourcePages: pages.map(({ sourceId, index, rotation }) => ({ sourceId, index, rotation })),
  };
  try {
    if (output.pdf.numPages !== pages.length)
      throw new Error(
        'Exportprüfung fehlgeschlagen: Die Seitenanzahl stimmt nicht überein. Die Bearbeitung bleibt geöffnet.',
      );
    for (const [i, page] of pages.entries()) {
      signal.throwIfAborted();
      report({
        percent: 90 + (9 * i) / pages.length,
        label: `Gespeicherte PDF prüfen · Seite ${i + 1} / ${pages.length}`,
      });
      const source = sources.find((s) => s.id === page.sourceId)!,
        marks = (edits.marks[page.id] || []).filter(editorMarkChanged),
        crop = edits.crops[page.id];
      if (marks.length || crop) result.changedPages.push(i);
      const outPage = { ...page, sourceId: output.id, index: i, rotation: 0 };
      const analysis = cachedEditorPage(source, page, language);
      const incompatible = !!crop || marks.some((m) => !['text', 'image'].includes(m.kind));
      if (!incompatible) {
        const original = analysis || (await readTextTargets(source, page)),
          actual = await readTextTargets(output, outPage);
        const expected = [
          ...remainingEditorTargets(original.targets, marks.flatMap(editorRemovalRects)).map(
            (t) => t.text,
          ),
          ...marks.filter((m) => m.kind === 'text').map((m) => m.text || ''),
        ];
        if (characters(expected) !== characters(actual.targets.map((t) => t.text)))
          throw new Error(
            `Exportprüfung fehlgeschlagen auf Seite ${i + 1}: Der gespeicherte Text weicht von der Bearbeitung ab. Bitte Schrift und Textstellen prüfen. Die Bearbeitung bleibt geöffnet.`,
          );
        for (const mark of marks.filter((m) => m.kind === 'text' && normalized(m.text || ''))) {
          const local = normalized(
            actual.targets
              .filter((t) => editorRectsOverlap(t, mark))
              .map((t) => t.text)
              .join(''),
          );
          if (!local.includes(normalized(mark.text || '')))
            throw new Error(
              `Exportprüfung fehlgeschlagen auf Seite ${i + 1}: Ein Text wurde nicht vollständig an seiner vorgesehenen Position gefunden. Die Bearbeitung bleibt geöffnet.`,
            );
        }
        result.textPages++;
        const changedText = marks.filter((m) => m.kind === 'text' && normalized(m.text || ''));
        if (changedText.length) {
          let background: Awaited<ReturnType<typeof renderPage>> | undefined,
            actualImage: Awaited<ReturnType<typeof renderPage>> | undefined;
          try {
            // Remove only actual replacement text, leaving scan fill, vectors,
            // and images as the reference background for direct glyph painting.
            const removals = changedText.map((m) => ({
              ...m,
              sourceRects: actual.targets
                .filter((t) => editorRectsOverlap(t, m))
                .map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h })),
            }));
            if (removals.some((m) => !m.sourceRects.length)) throw new Error('Textposition unklar');
            background = await renderEditorBackground(
              output,
              outPage,
              removals,
              actual.targets,
              signal,
              1600,
            );
            actualImage = await renderPage(output, outPage, 1600, signal);
            const context = background.canvas.getContext('2d')!,
              base = context.getImageData(0, 0, background.canvas.width, background.canvas.height);
            for (const mark of changedText)
              await paintEditorReference(
                context,
                mark,
                original.width,
                original.height,
                source,
                signal,
              );
            const expectedImage = context.getImageData(
                0,
                0,
                background.canvas.width,
                background.canvas.height,
              ),
              savedImage = actualImage.canvas
                .getContext('2d')!
                .getImageData(0, 0, actualImage.canvas.width, actualImage.canvas.height);
            let mismatches = 0;
            for (const [n, mark] of changedText.entries()) {
              signal.throwIfAborted();
              const comparison = compareEditorInk(
                base,
                expectedImage,
                savedImage,
                editorBounds([mark, ...removals[n].sourceRects]),
              );
              if (comparison.expectedInk < 8)
                throw new Error('Schriftbild zu klein oder kontrastarm');
              if (comparison.missing > 0.12 || comparison.extra > 0.12) mismatches++;
              result.editedImageFields++;
            }
            if (mismatches)
              result.issues.push({
                page: i,
                message:
                  'Das gespeicherte Schriftbild weicht innerhalb bearbeiteter Textfelder von der vorgesehenen Darstellung ab. Bitte Schrift, Größe, Farbe und Umbruch vergleichen.',
              });
          } catch {
            signal.throwIfAborted();
            result.issues.push({
              page: i,
              message:
                'Die Schriftbildprüfung innerhalb bearbeiteter Textfelder konnte auf dieser Seite nicht vollständig abgeschlossen werden. Bitte diese Stellen selbst vergleichen.',
            });
          } finally {
            if (background) background.canvas.width = background.canvas.height = 0;
            if (actualImage) actualImage.canvas.width = actualImage.canvas.height = 0;
          }
        }
      } else
        result.issues.push({
          page: i,
          message:
            'Textprüfung für diese Seite wegen Zuschneiden oder zusätzlicher Bildbearbeitung eingeschränkt.',
        });
      if (crop) {
        result.issues.push({
          page: i,
          message: 'Der Bildvergleich ist für zugeschnittene Seiten nicht möglich.',
        });
        continue;
      }
      let before: Awaited<ReturnType<typeof renderPage>> | undefined,
        after: Awaited<ReturnType<typeof renderPage>> | undefined;
      try {
        before = await renderPage(source, page, 900, signal);
        after = await renderPage(output, outPage, 900, signal);
        if (
          Math.abs(before.width - after.width) > 0.1 ||
          Math.abs(before.height - after.height) > 0.1
        )
          throw new Error('Seitenmaß verändert');
        const a = before.canvas
            .getContext('2d')!
            .getImageData(0, 0, before.canvas.width, before.canvas.height),
          b = after.canvas
            .getContext('2d')!
            .getImageData(0, 0, after.canvas.width, after.canvas.height);
        const ratio = compareEditorPixels(
          a.data,
          b.data,
          a.width,
          a.height,
          marks.flatMap((m) => [m, ...editorRemovalRects(m)]),
        );
        if (ratio > 0.001)
          result.issues.push({
            page: i,
            message:
              'Sichtbare Abweichungen außerhalb der bearbeiteten Bereiche. Bitte Original und Ergebnis vergleichen.',
          });
        result.imagePages++;
      } catch (error) {
        signal.throwIfAborted();
        result.issues.push({
          page: i,
          message:
            error instanceof Error && error.message === 'Seitenmaß verändert'
              ? 'Die sichtbare Seitengröße hat sich verändert. Bitte das Ergebnis prüfen.'
              : 'Der Bildvergleich konnte auf dieser Seite nicht abgeschlossen werden.',
        });
      } finally {
        if (before) before.canvas.width = before.canvas.height = 0;
        if (after) after.canvas.width = after.canvas.height = 0;
      }
    }
    result.status = result.issues.length ? 'review' : 'passed';
    return result;
  } finally {
    await output.pdf.loadingTask.destroy();
  }
}
