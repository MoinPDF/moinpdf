import type { Mark, EditorTextRun } from './studio-engine';
import type { Source } from './pdf-engine';
import { editorSegments } from './editor-rich-text';
import { resolveEditorFont, type EditorFontResolution } from './editor-fonts';

export type PreparedEditorRun = EditorTextRun & { resolution: EditorFontResolution };
export async function prepareEditorRuns(mark: Mark, source?: Source): Promise<PreparedEditorRun[]> {
  return Promise.all(
    editorSegments(mark).map(async (run) => ({
      ...run,
      resolution: await resolveEditorFont(
        {
          ...mark,
          ...run.style,
          text: (mark.text || '').slice(run.start, run.end),
          runs: undefined,
        } as Mark,
        source,
      ),
    })),
  );
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
      for (const char of token) {
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
