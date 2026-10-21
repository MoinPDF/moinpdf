import {
  openSource,
  renderPage,
  type Source,
  type PageItem,
  type ProgressUpdate,
} from './pdf-engine';
import type { Edits, Rect, Mark } from './studio-engine';
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
  sparseFields?: number;
  changedPages: number[];
  issues: { page: number; message: string; rect?: Rect }[];
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
  painted: Record<string, Mark[]> = {},
): Promise<EditorVerification> {
  const output = await openSource(
    new File([bytes.slice().buffer], 'Prüfung.pdf', { type: 'application/pdf' }),
  );
  const result: EditorVerification = {
    status: 'passed',
    textPages: 0,
    imagePages: 0,
    editedImageFields: 0,
    sparseFields: 0,
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
        let original =
          (marks.length ? analysis : undefined) || (await readTextTargets(source, page));
        const actual = await readTextTargets(output, outPage);
        const imageRegions = marks
          .filter((m) => m.nativeImage)
          .flatMap((m) => [m.nativeImage!.rect, m]);
        if (imageRegions.length)
          original = {
            ...original,
            targets: original.targets.filter(
              (t) => t.origin !== 'ocr' || !imageRegions.some((r) => editorRectsOverlap(t, r)),
            ),
          };
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
              .sort((a, b) =>
                Math.abs(a.y - b.y) * original.height < Math.min(a.fontSize, b.fontSize) * 0.4
                  ? a.x - b.x
                  : a.y - b.y,
              )
              .map((t) => t.text)
              .join(''),
          );
          if (!local.includes(normalized(mark.text || '')))
            throw new Error(
              `Exportprüfung fehlgeschlagen auf Seite ${i + 1}: Ein Text wurde nicht vollständig an seiner vorgesehenen Position gefunden. Die Bearbeitung bleibt geöffnet.`,
            );
        }
        result.textPages++;
        const changedText = (painted[page.id] || marks).filter(
          (m) => m.kind === 'text' && normalized(m.text || ''),
        );
        result.sparseFields! += (painted[page.id] || []).filter((m) => m.nativeTextSlice).length;
        if (changedText.length) {
          let background: Awaited<ReturnType<typeof renderPage>> | undefined,
            actualImage: Awaited<ReturnType<typeof renderPage>> | undefined,
            reference: HTMLCanvasElement | undefined;
          try {
            // Remove only actual replacement text, leaving scan fill, vectors,
            // and images as the reference background for direct glyph painting.
            const removals = changedText.map((m) => ({
              ...m,
              nativeTextSlice: undefined,
              sourceIsScan: false,
              sourceRects: actual.targets
                .filter((t) => editorRectsOverlap(t, m))
                .map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h })),
            }));
            if (removals.some((m) => !m.sourceRects.length)) throw new Error('Textposition unklar');
            const smallest = Math.min(
              ...changedText.flatMap((m) =>
                [
                  m.fontScale || 0.028,
                  ...(m.runs || []).map((r) => r.style.fontScale || m.fontScale || 0.028),
                ].map((size) => size * original.width),
              ),
            );
            // Three canvases and their pixel buffers coexist during comparison.
            // Bound their area so tiny text on large pages does not multiply
            // memory use beyond what a narrow-screen browser can reasonably hold.
            const comparisonSide = Math.min(
              3600,
              Math.floor(
                Math.max(original.width, original.height) *
                  Math.sqrt(4000000 / (original.width * original.height)),
              ),
              Math.max(
                1600,
                Math.ceil(
                  (Math.max(original.width, original.height) * 22) / Math.max(3, smallest) / 400,
                ) * 400,
              ),
            );
            background = await renderEditorBackground(
              output,
              outPage,
              removals,
              actual.targets,
              signal,
              comparisonSide,
            );
            actualImage = await renderPage(output, outPage, comparisonSide, signal);
            const base = background.canvas
              .getContext('2d')!
              .getImageData(0, 0, background.canvas.width, background.canvas.height);
            // Do not inherit a PDF renderer's transforms, clipping or colour
            // state. Browser rendering can leave state unlike the Node adapter.
            reference = document.createElement('canvas');
            reference.width = background.canvas.width;
            reference.height = background.canvas.height;
            const context = reference.getContext('2d')!;
            context.putImageData(base, 0, 0);
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
              if (comparison.missing > 0.12 || comparison.extra > 0.12)
                result.issues.push({
                  page: i,
                  rect: comparison.differenceRect || mark,
                  message:
                    'Das gespeicherte Schriftbild weicht innerhalb bearbeiteter Textfelder von der vorgesehenen Darstellung ab. Bitte Schrift, Größe, Farbe und Umbruch vergleichen.',
                });
              result.editedImageFields++;
            }
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
            if (reference) reference.width = reference.height = 0;
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
          marks.flatMap((m) => [
            m,
            ...editorRemovalRects(m),
            ...(m.nativeImage ? [m.nativeImage.rect] : []),
            ...(m.nativeTable
              ? [
                  {
                    x: m.nativeTable.original.rect.x / m.nativeTable.pageWidth,
                    y: m.nativeTable.original.rect.y / m.nativeTable.pageHeight,
                    w: m.nativeTable.original.rect.w / m.nativeTable.pageWidth,
                    h: m.nativeTable.original.rect.h / m.nativeTable.pageHeight,
                  },
                ]
              : []),
          ]),
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
