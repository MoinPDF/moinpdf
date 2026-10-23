import type { Mark, EditorTextRun } from './studio-engine';
import type { Source } from './pdf-engine';
import { editorSegments, editorScriptMetrics } from './editor-rich-text';
import {
  resolveEditorFont,
  originalEditorFont,
  editorFontPage,
  type EditorFontResolution,
} from './editor-fonts';

export type PreparedEditorRun = EditorTextRun & {
  resolution: EditorFontResolution;
  listMarker?: EditorFontResolution;
};
export const hasRichEditorLayout = (mark: Mark, runs: PreparedEditorRun[]) =>
  !!(
    mark.runs?.length ||
    runs.length > 1 ||
    mark.underline ||
    (mark.script && mark.script !== 'normal') ||
    mark.align === 'justify' ||
    (mark.listStyle && mark.listStyle !== 'none') ||
    mark.paragraphSpacing
  );
const preparationCache = new WeakMap<
  Mark,
  { source?: Source; signature: string; pending: Promise<PreparedEditorRun[]> }
>();
export function prepareEditorRuns(mark: Mark, source?: Source): Promise<PreparedEditorRun[]> {
  const signature = JSON.stringify([
    editorSegments(mark),
    mark.text,
    mark.originalText,
    mark.sourceRect,
    mark.fontScale,
    mark.insetScale,
    mark.textScaleX,
    mark.tracking,
    mark.listStyle,
  ]);
  const previous = preparationCache.get(mark);
  if (previous && previous.source === source && previous.signature === signature)
    return previous.pending;
  const pending = prepareEditorRunsUncached(mark, source);
  preparationCache.set(mark, { source, signature, pending });
  pending.catch(() => {
    if (preparationCache.get(mark)?.pending === pending) preparationCache.delete(mark);
  });
  return pending;
}
async function prepareEditorRunsUncached(
  mark: Mark,
  source?: Source,
): Promise<PreparedEditorRun[]> {
  const prepared: PreparedEditorRun[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const run of editorSegments(mark)) {
    const part = {
      ...mark,
      ...run.style,
      text: (mark.text || '').slice(run.start, run.end),
      runs: undefined,
    };
    if (
      source &&
      part.originalFontId &&
      part.originalFontPage !== undefined &&
      !originalEditorFont(source, part.originalFontId)
    )
      await editorFontPage(source, part.originalFontPage);
    const original =
      source && (!part.fontChoice || part.fontChoice === 'auto')
        ? originalEditorFont(source, part.originalFontId)
        : undefined;
    if (!original || original.bold !== !!part.bold || original.italic !== !!part.italic) {
      prepared.push({ ...run, resolution: await resolveEditorFont(part, source) });
      continue;
    }
    const clusters = [...segmenter.segment(part.text)];
    const missing = clusters
      .filter((c) => !original.covers(c.segment))
      .map((c) => c.segment)
      .join('');
    const fallback = missing
      ? await resolveEditorFont({ ...part, text: missing }, source)
      : undefined;
    for (const cluster of clusters) {
      const resolution = original.covers(cluster.segment)
        ? { font: original, substituted: false }
        : fallback!;
      const start = run.start + cluster.index,
        end = start + cluster.segment.length;
      const previous = prepared[prepared.length - 1];
      if (
        previous &&
        previous.end === start &&
        previous.style === run.style &&
        previous.resolution.font === resolution.font
      )
        previous.end = end;
      else prepared.push({ ...run, start, end, resolution });
    }
  }
  if (prepared.length && mark.listStyle && mark.listStyle !== 'none') {
    const labels = mark.listStyle === 'bullet' ? '•' : '0123456789.';
    const first = prepared[0];
    const markerResolution = first.resolution.font.covers(labels)
      ? first.resolution
      : await resolveEditorFont(
          {
            ...mark,
            fontChoice: 'auto',
            originalFontId: undefined,
            originalFontName: undefined,
            customFont: undefined,
            text: labels,
          },
          source,
        );
    for (const run of prepared) run.listMarker = markerResolution;
  }
  return prepared;
}
export function richEditorLayout(
  mark: Mark,
  width: number,
  available: number,
  runs: PreparedEditorRun[],
) {
  type Piece = {
    text: string;
    start: number;
    end: number;
    run: PreparedEditorRun;
    size: number;
    width: number;
    x: number;
    shift: number;
    marker?: boolean;
  };
  type Line = {
    pieces: Piece[];
    width: number;
    size: number;
    baseline: number;
    descent: number;
    ascent: number;
    paragraph: number;
    last: boolean;
    indent: number;
  };
  const base = (mark.fontScale || 0.028) * width,
    tracking = (mark.tracking || 0) * base;
  const text = mark.text || '',
    lines: Line[] = [],
    tolerance = 0.05;
  const listed = !!mark.listStyle && mark.listStyle !== 'none';
  let number = mark.listStart || 1,
    sourceOffset = 0;
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  // Runs and tokens are ordered. Binary search avoids rescanning every style for every word.
  const piecesFor = (start: number, end: number): Piece[] => {
    let low = 0,
      high = runs.length;
    while (low < high) {
      const m = (low + high) >>> 1;
      if (runs[m].end <= start) low = m + 1;
      else high = m;
    }
    const pieces: Piece[] = [];
    for (let i = low; i < runs.length && runs[i].start < end; i++) {
      const run = runs[i],
        a = Math.max(start, run.start),
        b = Math.min(end, run.end),
        part = text.slice(a, b);
      const metrics = editorScriptMetrics(
        run.style,
        (run.style.fontScale || mark.fontScale || 0.028) * width,
      );
      pieces.push({
        text: part,
        start: a,
        end: b,
        run,
        ...metrics,
        width: run.resolution.font.measure(part, metrics.size) + [...part].length * tracking,
        x: 0,
      });
    }
    return pieces;
  };
  for (const [paragraph, value] of text.split('\n').entries()) {
    const first = runs.find((r) => r.end > sourceOffset) || runs[0];
    if (paragraph === 0 && mark.listContinuation && !value.trim() && mark.listStyle === 'numbered')
      number++;
    const label =
      listed && value.trim() ? (mark.listStyle === 'numbered' ? `${number++}.` : '•') : '';
    const marker = paragraph === 0 && mark.listContinuation ? '' : label;
    const markerRun = first && {
      ...first,
      resolution: first.listMarker || first.resolution,
      style: { ...first.style, script: 'normal' as const, underline: false },
    };
    const markerWidth = markerRun && label ? markerRun.resolution.font.measure(label, base) : 0;
    const indent = label ? Math.max(base * 1.5, markerWidth + base * 0.5) : 0;
    const usable = Math.max(0.1, available - indent);
    const fresh = (): Line => ({
      pieces: [],
      width: 0,
      size: base,
      baseline: 0,
      descent: 0,
      ascent: 0,
      paragraph,
      last: false,
      indent,
    });
    let line = fresh();
    const push = () => {
      lines.push(line);
      line = fresh();
    };
    const add = (piece: Piece) => {
      piece.x = indent + line.width;
      line.pieces.push(piece);
      line.width += piece.width;
      const nominal = (piece.run.style.fontScale || mark.fontScale || 0.028) * width;
      line.size = Math.max(line.size, nominal);
      line.ascent = Math.max(
        line.ascent,
        piece.run.resolution.font.ascent * piece.size - piece.shift,
      );
      line.descent = Math.max(
        line.descent,
        piece.run.resolution.font.measureDescent(piece.text) * piece.size + piece.shift,
        piece.run.style.underline ? piece.size * 0.16 + piece.shift : 0,
      );
    };
    const firstLine = lines.length;
    for (const match of value.matchAll(/[^\S\n]+|[^\s]+/gu)) {
      const start = sourceOffset + match.index!,
        token = match[0],
        pieces = piecesFor(start, start + token.length);
      const length = pieces.reduce((n, p) => n + p.width, 0);
      if (line.pieces.length && line.width + length - tracking > usable + tolerance) {
        push();
        if (/^\s+$/u.test(token)) continue;
      }
      if (length - tracking <= usable + tolerance) pieces.forEach(add);
      else {
        let index = start;
        for (const { segment } of segmenter.segment(token)) {
          const parts = piecesFor(index, index + segment.length),
            w = parts.reduce((n, p) => n + p.width, 0);
          if (line.pieces.length && line.width + w - tracking > usable + tolerance) push();
          parts.forEach(add);
          index += segment.length;
        }
      }
    }
    line.last = true;
    push();
    if (marker && markerRun)
      lines[firstLine].pieces.unshift({
        text: marker,
        start: sourceOffset,
        end: sourceOffset,
        run: markerRun,
        size: base,
        width: markerWidth,
        x: Math.max(0, indent - base * 0.5 - markerWidth),
        shift: 0,
        marker: true,
      });
    sourceOffset += value.length + 1;
  }
  let bottom = 0;
  lines.forEach((line, i) => {
    line.width = Math.max(0, line.width - tracking) + line.indent;
    const previous = lines[i - 1];
    line.baseline =
      i === 0
        ? Math.max((mark.baselineScale ?? 0.9) * line.size, line.ascent)
        : previous.baseline +
          Math.max(
            Math.max(previous.size, line.size) * (mark.lineHeight || 1.25),
            previous.descent + line.ascent,
          ) +
          (previous.paragraph !== line.paragraph ? (mark.paragraphSpacing || 0) * base : 0);
    const visible = line.pieces.filter((p) => !p.marker);
    const lastInk = visible.findLastIndex((p) => !!p.text.trim());
    const spaces = visible.slice(0, lastInk).filter((p) => /^\s+$/u.test(p.text));
    if (mark.align === 'justify' && !line.last && spaces.length && line.width < available) {
      const extra = (available - line.width) / spaces.length;
      let shift = 0;
      for (const piece of visible) {
        piece.x += shift;
        if (spaces.includes(piece)) {
          piece.width += extra;
          shift += extra;
        }
      }
      line.width = available;
    } else {
      const align =
        mark.align === 'center'
          ? (available - line.width) / 2
          : mark.align === 'right'
            ? available - line.width
            : 0;
      for (const piece of line.pieces) piece.x += align;
    }
    bottom = Math.max(bottom, line.baseline + line.descent);
  });
  return { lines, requiredHeight: bottom, tracking };
}
