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
  'color',
] as const;
export type EditorSelection = { id: string; start: number; end: number };
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
