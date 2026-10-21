import type { Source } from './pdf-engine';
import type { Mark } from './studio-engine';
import { editorTextGeometry, layoutEditorText } from './editor-text-layer';
import { prepareEditorRuns, richEditorLayout, type PreparedEditorRun } from './editor-rich-layout';
import { type EditorFont } from './editor-fonts';

export type EditorPlannedPiece = {
  text: string;
  x: number;
  y: number;
  size: number;
  font: EditorFont;
  color: string;
  tracking: number;
};
export function editorLayoutPlan(
  mark: Mark,
  width: number,
  height: number,
  runs: PreparedEditorRun[],
) {
  const geometry = editorTextGeometry(mark, width, height, mark.textRotation),
    scaleX = mark.textScaleX || 1;
  const size = (mark.fontScale || 0.028) * width,
    inset = (mark.insetScale || 0) * size;
  const available = Math.max(0.1, geometry.width / scaleX - 2 * inset);
  const pieces: EditorPlannedPiece[] = [];
  let requiredHeight = 0,
    overflow = false,
    lineCount = 0;
  if (mark.runs?.length || runs.length > 1) {
    const layout = richEditorLayout(mark, width, available, runs);
    requiredHeight = layout.requiredHeight;
    lineCount = layout.lines.length;
    overflow =
      requiredHeight > geometry.height + 0.5 || layout.lines.some((l) => l.width > available + 0.5);
    for (const line of layout.lines) {
      const align =
        mark.align === 'center'
          ? (available - line.width) / 2
          : mark.align === 'right'
            ? available - line.width
            : 0;
      for (const p of line.pieces)
        pieces.push({
          text: p.text,
          x: inset + align + p.x,
          y: line.baseline,
          size: p.size,
          font: p.run.resolution.font,
          color: p.run.style.color || mark.color || '#222222',
          tracking: layout.tracking,
        });
    }
  } else if (runs[0]) {
    const font = runs[0].resolution.font,
      layout = layoutEditorText(
        mark,
        width,
        height,
        font.measure,
        font.measureDescent(mark.text || ''),
      );
    requiredHeight = layout.requiredHeight;
    overflow = layout.overflow;
    lineCount = layout.lines.length;
    layout.lines.forEach((text, i) =>
      pieces.push({
        text,
        x:
          layout.inset +
          (mark.align === 'center'
            ? (layout.available - layout.measured(text)) / 2
            : mark.align === 'right'
              ? layout.available - layout.measured(text)
              : 0),
        y: layout.baseline + i * layout.lineHeight,
        size: layout.size,
        font,
        color: mark.color || '#222222',
        tracking: layout.tracking,
      }),
    );
  }
  return { geometry, scaleX, pieces, requiredHeight, overflow, lineCount, available };
}
export async function prepareEditorLayout(
  mark: Mark,
  width: number,
  height: number,
  source?: Source,
) {
  const runs = await prepareEditorRuns(mark, source);
  return editorLayoutPlan(mark, width, height, runs);
}

/** Uniformly scale mixed styles, retaining their relative sizes. Never shrink
 * below six points without an explicit manual font-size choice. */
export function fitEditorLayout(
  mark: Mark,
  width: number,
  height: number,
  runs: PreparedEditorRun[],
): Partial<Mark> | null {
  const minimum = Math.min(
    (mark.fontScale || 0.028) * width,
    ...runs.map((r) => (r.style.fontScale || mark.fontScale || 0.028) * width),
  );
  if (minimum <= 6) return null;
  const scaled = (factor: number) => ({
    fontScale: (mark.fontScale || 0.028) * factor,
    runs: mark.runs?.map((r) => ({
      ...r,
      style: { ...r.style, fontScale: (r.style.fontScale || mark.fontScale || 0.028) * factor },
    })),
  });
  const fits = (factor: number) =>
    !editorLayoutPlan(
      { ...mark, ...scaled(factor) },
      width,
      height,
      runs.map((r) => ({
        ...r,
        style: { ...r.style, fontScale: (r.style.fontScale || mark.fontScale || 0.028) * factor },
      })),
    ).overflow;
  let low = 6 / minimum,
    high = 1;
  if (!fits(low)) return null;
  if (fits(high)) return scaled(1);
  for (let i = 0; i < 16; i++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return scaled(low);
}
