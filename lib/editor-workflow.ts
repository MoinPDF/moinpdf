import type { Mark, Rect, EditorTextRun } from './studio-engine';
import type { Source } from './pdf-engine';
import type { TextTarget } from './editor-model';
import { editorSegments, editorSelectionStyle, type EditorSelection } from './editor-rich-text';
import { prepareEditorRuns } from './editor-rich-layout';
import { editorLayoutPlan } from './editor-layout-plan';

export type EditorFormat = { patch: Partial<Mark>; width: number; sourceId?: string };
export function captureEditorFormat(
  mark: Mark,
  width: number,
  sourceId?: string,
  selection?: EditorSelection | null,
): EditorFormat {
  const { style } = editorSelectionStyle(mark, selection);
  return {
    width,
    sourceId,
    patch: {
      ...style,
      customFont: mark.customFont,
      lineHeight: mark.lineHeight,
      tracking: mark.tracking,
      align: mark.align,
    },
  };
}
export function applyEditorFormat(
  format: EditorFormat,
  width: number,
  sourceId?: string,
): Partial<Mark> {
  const patch = {
    ...format.patch,
    fontScale: ((format.patch.fontScale || 0.028) * format.width) / width,
  };
  if (format.sourceId !== sourceId) {
    patch.originalFontId = undefined;
    patch.originalFontName = undefined;
    patch.originalFontPage = undefined;
  }
  return patch;
}

export type EditorGuide = { axis: 'x' | 'y'; value: number; baseline?: boolean };
/** Distances are compared in displayed pixels; geometry remains in PDF units. */
export function snapEditorRect(
  mark: Mark,
  others: Mark[],
  targets: TextTarget[],
  width: number,
  height: number,
  displayWidth: number,
  resize = false,
) {
  const thresholdX = 6 / displayWidth,
    thresholdY = (thresholdX * width) / height;
  const vertical = [0, 0.5, 1],
    horizontal = [0, 0.5, 1];
  for (const r of [...others.filter((m) => m.id !== mark.id), ...targets]) {
    vertical.push(r.x, r.x + r.w, r.x + r.w / 2);
    horizontal.push(r.y, r.y + r.h, r.y + r.h / 2);
  }
  const guides: EditorGuide[] = [];
  const closest = (values: number[], anchors: number[], threshold: number) => {
    let best: { delta: number; value: number } | undefined;
    for (const value of values)
      for (const anchor of anchors) {
        const delta = value - anchor;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta)))
          best = { delta, value };
      }
    return best;
  };
  const x = closest(
    vertical,
    resize ? [mark.x + mark.w] : [mark.x, mark.x + mark.w / 2, mark.x + mark.w],
    thresholdX,
  );
  const y = closest(
    horizontal,
    resize ? [mark.y + mark.h] : [mark.y, mark.y + mark.h / 2, mark.y + mark.h],
    thresholdY,
  );
  const next = { ...mark };
  if (x) {
    if (resize) next.w += x.delta;
    else next.x += x.delta;
    guides.push({ axis: 'x', value: x.value });
  }
  if (y) {
    if (resize) next.h += y.delta;
    else next.y += y.delta;
    guides.push({ axis: 'y', value: y.value });
  }
  if (!resize && mark.kind === 'text' && !mark.textRotation) {
    const baseline = (m: Mark) =>
      m.y + ((m.baselineScale ?? 0.9) * (m.fontScale || 0.028) * width) / height;
    const values = [
      ...others
        .filter((m) => m.id !== mark.id && m.kind === 'text' && !m.textRotation)
        .map(baseline),
      ...targets
        .filter((t) => !t.rotation)
        .map((t) => t.y + ((t.baselineScale ?? 0.9) * t.fontSize) / height),
    ];
    const line = closest(values, [baseline(mark)], thresholdY);
    if (line && (!y || Math.abs(line.delta) <= Math.abs(y.delta))) {
      next.y = mark.y + line.delta;
      const at = guides.findIndex((g) => g.axis === 'y');
      if (at >= 0) guides.splice(at, 1);
      guides.push({ axis: 'y', value: line.value, baseline: true });
    }
  }
  if (
    next.x < 0 ||
    next.y < 0 ||
    next.w <= 0 ||
    next.h <= 0 ||
    next.x + next.w > 1.00001 ||
    next.y + next.h > 1.00001
  )
    return { mark, guides: [] };
  return { mark: next, guides };
}

export type EditorCell = {
  target: TextTarget;
  row: number;
  column: number;
  rect: Rect;
  table: number;
};
/** Conservative aligned-row detection. Never joins cells or modifies table rules. */
export function detectEditorCells(
  targets: TextTarget[],
  width: number,
  height: number,
): EditorCell[] {
  const rows: TextTarget[][] = [];
  for (const t of targets
    .filter((t) => !t.rotation && !t.unsupportedReason)
    .sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find(
      (r) => Math.abs(r[0].y - t.y) * height < Math.min(r[0].fontSize, t.fontSize) * 0.35,
    );
    if (row) row.push(t);
    else rows.push([t]);
  }
  rows.forEach((r) => r.sort((a, b) => a.x - b.x));
  const cells: EditorCell[] = [];
  let table = 0;
  for (let i = 0; i < rows.length;) {
    const first = rows[i];
    const aligned = (a: TextTarget[], b: TextTarget[]) =>
      a.length >= 2 &&
      a.length <= 20 &&
      a.length === b.length &&
      b[0].y > a[0].y &&
      (b[0].y - a[0].y) * height < Math.max(...a.map((t) => t.fontSize)) * 4 &&
      a.every(
        (t, n) =>
          Math.abs(t.x - b[n].x) * width < 3 &&
          (n === 0 || t.x > a[n - 1].x + a[n - 1].w + 3 / width),
      );
    let end = i + 1;
    while (end < rows.length && aligned(rows[end - 1], rows[end])) end++;
    if (end - i < 2) {
      i++;
      continue;
    }
    for (let r = i; r < end; r++)
      for (let c = 0; c < first.length; c++) {
        const target = rows[r][c];
        const right =
          c + 1 < first.length
            ? Math.min(...rows.slice(i, end).map((row) => row[c + 1].x)) - 3 / width
            : Math.min(
                1,
                Math.max(...rows.slice(i, end).map((row) => row[c].x + row[c].w)) + 6 / width,
              );
        cells.push({
          target,
          row: r - i,
          column: c,
          table,
          rect: { ...target, w: Math.max(target.w, right - target.x) },
        });
      }
    table++;
    i = end;
  }
  return cells;
}

export type EditorFlowFrame = {
  mark: Mark;
  pageId: string;
  width: number;
  height: number;
  source: Source;
};
export async function distributeEditorFlow(frames: EditorFlowFrame[], signal: AbortSignal) {
  if (
    frames.length < 2 ||
    frames.length > 50 ||
    frames.some((f) => f.mark.kind !== 'text' || f.mark.textRotation)
  )
    throw new Error('Bitte 2 bis 50 waagerechte Textfelder verknüpfen.');
  if (
    new Set(frames.map((f) => f.source.id)).size > 1 ||
    new Set(frames.map((f) => f.mark.customFont?.data || '')).size > 1
  )
    throw new Error('Textfluss bitte innerhalb einer PDF mit derselben eigenen Schrift verwenden.');
  const combined: { text: string; runs: EditorTextRun[] } = { text: '', runs: [] };
  const baseWidth = frames[0].width;
  for (const [i, frame] of frames.entries()) {
    // Linked chunks already retain their boundary whitespace. New links use a paragraph boundary.
    if (i && !frames.every((f) => f.mark.flow?.id && f.mark.flow.id === frames[0].mark.flow?.id)) {
      combined.runs.push({
        start: combined.text.length,
        end: combined.text.length + 1,
        style: combined.runs.at(-1)?.style || {},
      });
      combined.text += '\n';
    }
    const offset = combined.text.length;
    combined.runs.push(
      ...editorSegments(frame.mark).map((r) => ({
        ...r,
        start: r.start + offset,
        end: r.end + offset,
        style: {
          ...r.style,
          fontScale:
            ((r.style.fontScale || frame.mark.fontScale || 0.028) * frame.width) / baseWidth,
        },
      })),
    );
    combined.text += frame.mark.text || '';
  }
  if (combined.text.length > 100000)
    throw new Error('Der verknüpfte Text ist zu lang. Bitte weniger Textfelder wählen.');
  const base = { ...frames[0].mark, ...combined },
    prepared = await prepareEditorRuns(base, frames[0].source);
  const output: { pageId: string; mark: Mark }[] = [];
  let offset = 0;
  for (const frame of frames) {
    signal.throwIfAborted();
    const make = (end: number): Mark => ({
      ...frame.mark,
      text: combined.text.slice(offset, end),
      runs: combined.runs
        .filter((r) => r.start < end && r.end > offset)
        .map((r) => ({
          ...r,
          start: Math.max(offset, r.start) - offset,
          end: Math.min(end, r.end) - offset,
          style: {
            ...r.style,
            fontScale: ((r.style.fontScale || 0.028) * baseWidth) / frame.width,
          },
        })),
    });
    const fits = (end: number) => {
      const mark = make(end);
      const runs = prepared
        .filter((r) => r.start < end && r.end > offset)
        .map((r) => ({
          ...r,
          start: Math.max(offset, r.start) - offset,
          end: Math.min(end, r.end) - offset,
          style: {
            ...r.style,
            fontScale: ((r.style.fontScale || 0.028) * baseWidth) / frame.width,
          },
        }));
      return !editorLayoutPlan(mark, frame.width, frame.height, runs).overflow;
    };
    const boundaries = [offset];
    let at = offset;
    for (const char of combined.text.slice(offset, offset + 20000)) {
      at += char.length;
      boundaries.push(at);
    }
    let low = 0,
      high = boundaries.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (fits(boundaries[mid])) low = mid;
      else high = mid - 1;
    }
    let end = boundaries[low];
    if (end < combined.text.length && end > offset) {
      const head = combined.text.slice(offset, end),
        boundary = [...head.matchAll(/\s+/gu)].at(-1);
      if (boundary && boundary.index! + boundary[0].length > 0)
        end = offset + boundary.index! + boundary[0].length;
    }
    output.push({ pageId: frame.pageId, mark: make(end) });
    offset = end;
  }
  if (offset < combined.text.length)
    throw new Error(
      'Der Text passt noch nicht in die verknüpften Felder. Bitte ein weiteres Feld auf dieser oder der nächsten Seite hinzufügen.',
    );
  return output;
}
