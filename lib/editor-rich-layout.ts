import type { Mark, EditorTextRun } from './studio-engine';
import type { Source } from './pdf-engine';
import { editorSegments } from './editor-rich-text';
import {
  resolveEditorFont,
  originalEditorFont,
  editorFontPage,
  type EditorFontResolution,
} from './editor-fonts';

export type PreparedEditorRun = EditorTextRun & { resolution: EditorFontResolution };
export async function prepareEditorRuns(mark: Mark, source?: Source): Promise<PreparedEditorRun[]> {
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
  };
  type Line = { pieces: Piece[]; width: number; size: number; baseline: number; descent: number };
  const base = (mark.fontScale || 0.028) * width,
    tracking = (mark.tracking || 0) * base;
  // PDF widths and reconstructed embedded glyph advances can differ by tiny
  // fractions of a point. Do not create a new line for rounding noise.
  const tolerance = 0.05;
  const text = mark.text || '',
    lines: Line[] = [];
  let line: Line = { pieces: [], width: 0, size: base, baseline: 0, descent: 0 };
  const next = () => {
    lines.push(line);
    line = { pieces: [], width: 0, size: base, baseline: 0, descent: 0 };
  };
  const piecesFor = (start: number, end: number): Piece[] =>
    runs
      .filter((r) => r.start < end && r.end > start)
      .map((run) => {
        const a = Math.max(start, run.start),
          b = Math.min(end, run.end),
          part = text.slice(a, b),
          size = (run.style.fontScale || mark.fontScale || 0.028) * width;
        return {
          text: part,
          start: a,
          end: b,
          run,
          size,
          width: run.resolution.font.measure(part, size) + [...part].length * tracking,
          x: 0,
        };
      });
  const add = (piece: Piece) => {
    piece.x = line.width;
    line.pieces.push(piece);
    line.width += piece.width;
    line.size = Math.max(line.size, piece.size);
    line.descent = Math.max(
      line.descent,
      piece.run.resolution.font.measureDescent(piece.text) * piece.size,
    );
  };
  for (const match of text.matchAll(/\n|[^\S\n]+|[^\s]+/gu)) {
    const start = match.index!,
      token = match[0];
    if (token === '\n') {
      next();
      continue;
    }
    const pieces = piecesFor(start, start + token.length),
      length = pieces.reduce((n, p) => n + p.width, 0);
    if (line.pieces.length && line.width + length - tracking > available + tolerance) {
      next();
      if (/^\s+$/u.test(token)) continue;
    }
    if (length - tracking <= available + tolerance) pieces.forEach(add);
    else {
      let index = start;
      for (const { segment: char } of new Intl.Segmenter(undefined, {
        granularity: 'grapheme',
      }).segment(token)) {
        const parts = piecesFor(index, index + char.length),
          w = parts.reduce((n, p) => n + p.width, 0);
        if (line.pieces.length && line.width + w - tracking > available + tolerance) next();
        parts.forEach(add);
        index += char.length;
      }
    }
  }
  next();
  let bottom = 0;
  lines.forEach((entry, i) => {
    entry.width = Math.max(0, entry.width - tracking);
    entry.baseline =
      i === 0
        ? (mark.baselineScale ?? 0.9) * entry.size
        : lines[i - 1].baseline +
          Math.max(lines[i - 1].size, entry.size) * (mark.lineHeight || 1.25);
    bottom = Math.max(bottom, entry.baseline + entry.descent);
  });
  return { lines, requiredHeight: bottom, tracking };
}
