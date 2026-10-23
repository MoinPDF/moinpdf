import type { Mark, EditorTextRun, EditorTextStyle } from './studio-engine';

export const editorStyleKeys = [
  'fontScale',
  'fontFamily',
  'fontChoice',
  'originalFontId',
  'originalFontName',
  'originalFontPage',
  'bold',
  'italic',
  'underline',
  'script',
  'color',
] as const;
export type EditorSelection = { id: string; start: number; end: number };
/** Logical PDF text, including generated list labels, used by independent export checks. */
export function editorExportText(mark: Mark) {
  let number = mark.listStart || 1;
  return (mark.text || '')
    .split('\n')
    .map((line, index) => {
      if (index === 0 && mark.listContinuation) {
        if (mark.listStyle === 'numbered') number++;
        return line;
      }
      if (!line.trim() || !mark.listStyle || mark.listStyle === 'none') return line;
      const marker = mark.listStyle === 'numbered' ? `${number++}. ` : '• ';
      return index === 0 && mark.listContinuation ? line : marker + line;
    })
    .join('\n');
}
/** Keep one list identity when a paragraph crosses a linked frame or page. */
export function editorListSlice(mark: Mark, offset: number): Partial<Mark> {
  if (!mark.listStyle || mark.listStyle === 'none') return {};
  const before = (mark.text || '').slice(0, offset).split('\n');
  before.pop();
  const text = mark.text || '',
    lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1,
    nextBreak = text.indexOf('\n', offset);
  const continued =
    offset > 0 &&
    text[offset - 1] !== '\n' &&
    !!text.slice(lineStart, nextBreak < 0 ? text.length : nextBreak).trim();
  return {
    listStyle: mark.listStyle,
    listStart: (mark.listStart || 1) + before.filter((line) => line.trim()).length,
    listContinuation: offset === 0 ? mark.listContinuation : continued,
  };
}
export function editorScriptMetrics(style: EditorTextStyle, base: number) {
  const script = style.script || 'normal';
  return {
    size: base * (script === 'normal' ? 1 : 0.65),
    shift: script === 'super' ? -base * 0.35 : script === 'sub' ? base * 0.2 : 0,
  };
}
/** The toolbar describes the range it will actually format, or the whole box. */
export function editorSelectionStyle(mark: Mark, selection?: EditorSelection | null) {
  const length = (mark.text || '').length;
  const selected = selection?.id === mark.id && selection.end > selection.start;
  const start = selected ? Math.max(0, Math.min(length, selection.start)) : 0;
  const end = selected ? Math.max(start, Math.min(length, selection.end)) : length;
  const runs = editorSegments(mark).filter((r) => r.start < end && r.end > start);
  const style = runs[0]?.style || editorStyle(mark);
  const mixed = new Set(
    editorStyleKeys.filter((key) => runs.some((r) => r.style[key] !== style[key])),
  );
  return { start, end, selected: !!selected, style, mixed };
}
export type EditorTextMatch = { start: number; end: number };
const searchLigatures: Record<string, string> = {
  ﬀ: 'ff',
  ﬁ: 'fi',
  ﬂ: 'fl',
  ﬃ: 'ffi',
  ﬄ: 'ffl',
  ﬅ: 'st',
  ﬆ: 'st',
};
/** Keep original UTF-16 offsets for edits and rich-text runs. A search must
 * never replace only half a ligature or part of a combining character. */
function editorSearchProjection(text: string) {
  let value = '';
  const starts = new Map<number, number>(),
    ends = new Map<number, number>();
  for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    const normalized = part.segment
      .normalize('NFC')
      .replace(/[ﬀ-ﬆ]/gu, (c) => searchLigatures[c])
      .replace(/[\u00ad\u200b]/gu, '');
    if (!normalized) continue;
    const whitespace = /^\s+$/u.test(normalized);
    if (whitespace && value.endsWith(' ')) {
      ends.set(value.length, part.index + part.segment.length);
      continue;
    }
    starts.set(value.length, part.index);
    value += whitespace ? ' ' : normalized;
    ends.set(value.length, part.index + part.segment.length);
  }
  return { value, starts, ends };
}
export function findEditorText(
  text: string,
  query: string,
  matchCase = false,
  wholeWord = false,
  typography = false,
): EditorTextMatch[] {
  if (!query || query.length > 256) return [];
  const projected = typography ? editorSearchProjection(text) : undefined;
  const searched = projected?.value ?? text;
  const needle = typography ? editorSearchProjection(query).value : query;
  if (!needle) return [];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches: EditorTextMatch[] = [];
  const pattern = new RegExp(escaped, matchCase ? 'gu' : 'giu');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(searched))) {
    const at = match.index!,
      limit = at + match[0].length;
    const start = projected ? projected.starts.get(at) : at,
      end = projected ? projected.ends.get(limit) : limit;
    if (start === undefined || end === undefined) {
      // A rejected partial grapheme must not consume a later valid match.
      pattern.lastIndex = at + (searched.codePointAt(at)! > 0xffff ? 2 : 1);
      continue;
    }
    if (
      wholeWord &&
      (/[\p{L}\p{N}\p{M}_]$/u.test(searched.slice(Math.max(0, at - 2), at)) ||
        /^[\p{L}\p{N}\p{M}_]/u.test(searched.slice(limit, limit + 2)))
    )
      continue;
    matches.push({ start, end });
  }
  return matches;
}
export function replaceEditorMatches(
  mark: Mark,
  matches: EditorTextMatch[],
  replacement: string,
): Partial<Mark> {
  replacement = replacement.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  const sorted = [...matches].sort((a, b) => a.start - b.start),
    length = (mark.text || '').length;
  if (
    sorted.some(
      (m, i) =>
        !Number.isSafeInteger(m.start) ||
        !Number.isSafeInteger(m.end) ||
        m.start < 0 ||
        m.end <= m.start ||
        m.end > length ||
        (i > 0 && m.start < sorted[i - 1].end),
    )
  )
    throw new Error('Die Suchtreffer sind nicht mehr gültig. Bitte erneut suchen.');
  if (length + sorted.reduce((n, m) => n + replacement.length - (m.end - m.start), 0) > 20000)
    throw new Error('Das Ergebnis wäre länger als 20.000 Zeichen. Bitte weniger Text ersetzen.');
  const text = mark.text || '',
    segments = editorSegments(mark),
    chunks: string[] = [],
    runs: EditorTextRun[] = [];
  let sourceOffset = 0,
    outputOffset = 0,
    runIndex = 0;
  const append = (part: string, style: EditorTextStyle) => {
    if (!part) return;
    chunks.push(part);
    const start = outputOffset;
    outputOffset += part.length;
    const last = runs.at(-1);
    if (last && sameStyle(last.style, style)) last.end = outputOffset;
    else runs.push({ start, end: outputOffset, style });
  };
  const advanceRun = (offset: number) => {
    while (runIndex < segments.length - 1 && segments[runIndex].end <= offset) runIndex++;
  };
  const copy = (end: number) => {
    while (sourceOffset < end) {
      advanceRun(sourceOffset);
      const run = segments[runIndex],
        stop = Math.min(end, run?.end ?? end);
      append(text.slice(sourceOffset, stop), run?.style || editorStyle(mark));
      sourceOffset = stop;
    }
  };
  for (const match of sorted) {
    copy(match.start);
    advanceRun(match.start);
    append(replacement, segments[runIndex]?.style || editorStyle(mark));
    sourceOffset = match.end;
  }
  copy(length);
  return { text: chunks.join(''), runs: mark.runs?.length ? runs : undefined };
}
export function editorStyle(mark: EditorTextStyle): EditorTextStyle {
  return Object.fromEntries(
    editorStyleKeys.filter((key) => mark[key] !== undefined).map((key) => [key, mark[key]]),
  );
}
const sameStyle = (a: EditorTextStyle, b: EditorTextStyle) =>
  editorStyleKeys.every((key) => a[key] === b[key]);
export function editorSegments(
  mark: Pick<Mark, 'text' | 'runs'> & EditorTextStyle,
): EditorTextRun[] {
  const length = (mark.text || '').length;
  const runs = (mark.runs || []).filter(
    (r) =>
      Number.isSafeInteger(r.start) &&
      Number.isSafeInteger(r.end) &&
      r.start >= 0 &&
      r.end > r.start &&
      r.end <= length,
  );
  const cuts = [...new Set([0, length, ...runs.flatMap((r) => [r.start, r.end])])].sort(
    (a, b) => a - b,
  );
  const result: EditorTextRun[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i],
      end = cuts[i + 1];
    if (start === end) continue;
    const style = {
      bold: false,
      italic: false,
      color: '#222222',
      fontChoice: 'auto' as const,
      ...editorStyle(mark),
      ...runs.find((r) => r.start <= start && r.end >= end)?.style,
    };
    const last = result.at(-1);
    if (last && sameStyle(last.style, style)) last.end = end;
    else result.push({ start, end, style });
  }
  return result;
}
export function formatEditorRange(
  mark: Mark,
  start: number,
  end: number,
  patch: EditorTextStyle,
): Partial<Mark> {
  const length = (mark.text || '').length;
  start = Math.max(0, Math.min(length, start));
  end = Math.max(start, Math.min(length, end));
  const style = editorStyle(patch);
  if (start === end)
    return {
      ...style,
      runs: editorSegments(mark).map((r) => ({ ...r, style: { ...r.style, ...style } })),
    };
  const runs: EditorTextRun[] = [];
  for (const r of editorSegments(mark)) {
    const a = Math.max(start, r.start),
      b = Math.min(end, r.end);
    if (a >= b) {
      runs.push(r);
      continue;
    }
    if (r.start < a) runs.push({ ...r, end: a });
    runs.push({ start: a, end: b, style: { ...r.style, ...style } });
    if (b < r.end) runs.push({ ...r, start: b });
  }
  return { runs: editorSegments({ ...mark, runs }) };
}
export function replaceEditorRange(
  mark: Mark,
  start: number,
  end: number,
  inserted: string,
): Partial<Mark> {
  const old = mark.text || '';
  start = Math.max(0, Math.min(old.length, start));
  end = Math.max(start, Math.min(old.length, end));
  const text = old.slice(0, start) + inserted + old.slice(end),
    shift = inserted.length - (end - start);
  const segments = editorSegments(mark),
    runs: EditorTextRun[] = [];
  const inherited =
    (end > start
      ? segments.find((r) => r.start <= start && r.end > start)?.style
      : segments.find((r) => r.start < start && r.end >= start)?.style) ||
    segments.find((r) => r.start <= start && r.end > start)?.style ||
    editorStyle(mark);
  for (const r of segments) {
    if (r.start < start) runs.push({ ...r, end: Math.min(r.end, start) });
    if (r.end > end) runs.push({ ...r, start: Math.max(r.start, end) + shift, end: r.end + shift });
  }
  if (inserted) runs.push({ start, end: start + inserted.length, style: inherited });
  runs.sort((a, b) => a.start - b.start);
  return { text, runs: mark.runs?.length ? editorSegments({ ...mark, text, runs }) : undefined };
}
/** Plain-text sidebar edits retain formatting outside the actual replacement. */
export function replaceEditorText(mark: Mark, text: string): Partial<Mark> {
  const old = mark.text || '';
  let start = 0,
    end = old.length,
    nextEnd = text.length;
  while (start < end && start < nextEnd && old[start] === text[start]) start++;
  while (end > start && nextEnd > start && old[end - 1] === text[nextEnd - 1]) {
    end--;
    nextEnd--;
  }
  // Do not split a surrogate pair at the edit boundary.
  if (start && /[\uDC00-\uDFFF]/.test(old[start] || text[start])) start--;
  return replaceEditorRange(mark, start, end, text.slice(start, nextEnd));
}
export function applyEditorPatch(
  mark: Mark,
  patch: Partial<Mark>,
  selection?: EditorSelection | null,
): Partial<Mark> {
  if (patch.text !== undefined && patch.runs === undefined)
    patch = { ...replaceEditorText(mark, patch.text), ...patch };
  const keys = Object.keys(patch);
  if (
    keys.length &&
    keys.every(
      (k) =>
        (editorStyleKeys as readonly string[]).includes(k) ||
        ['tracking', 'textScaleX'].includes(k),
    ) &&
    editorStyleKeys.some((k) => patch[k] !== undefined)
  ) {
    const range = selection?.id === mark.id ? selection : undefined;
    const ranged = !!range && range.start !== range.end;
    return {
      ...(ranged ? {} : patch),
      ...formatEditorRange(mark, range?.start || 0, range?.end || 0, patch),
    };
  }
  return patch;
}

export function insertEditorFragment(
  mark: Mark,
  start: number,
  end: number,
  fragment: { text: string; runs: EditorTextRun[]; listStyle?: Mark['listStyle'] },
  keepFormatting: boolean,
): Partial<Mark> {
  const base = { ...mark, runs: editorSegments(mark) };
  const patch = replaceEditorRange(base, start, end, fragment.text);
  if (!keepFormatting) return patch;
  const inherited =
    editorSegments({ ...base, ...patch }).find((r) => r.start <= start && r.end > start)?.style ||
    editorStyle(mark);
  const applied: EditorTextRun[] = [];
  for (const r of patch.runs || []) {
    if (r.start < start) applied.push({ ...r, end: Math.min(start, r.end) });
    if (r.end > start + fragment.text.length)
      applied.push({ ...r, start: Math.max(r.start, start + fragment.text.length) });
  }
  applied.push(
    ...fragment.runs.map((r) => ({
      ...r,
      start: r.start + start,
      end: r.end + start,
      style: { ...inherited, ...r.style },
    })),
  );
  applied.sort((a, b) => a.start - b.start);
  return {
    ...patch,
    runs: editorSegments({ ...mark, ...patch, runs: applied }),
    ...(keepFormatting && start === 0 && end === (mark.text || '').length && fragment.listStyle
      ? { listStyle: fragment.listStyle }
      : {}),
  };
}
