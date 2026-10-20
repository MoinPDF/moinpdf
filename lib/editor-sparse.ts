import type { Source } from './pdf-engine';
import type { Mark } from './studio-engine';
import { originalEditorFont } from './editor-fonts';
import { editorMarkSignature } from './editor-model';

/** Conservative single-line word edits. The native engine checks the actual
 * glyphs again before touching a stream; any ambiguity uses the whole-field path. */
export function sparseEditorMark(mark: Mark, width: number, source: Source): Mark {
  if (
    mark.kind !== 'text' ||
    mark.sourceIsScan ||
    mark.textRotation ||
    mark.runs?.length ||
    mark.sourceRects?.length ||
    !mark.sourceRect ||
    !mark.originalState ||
    !mark.originalText ||
    mark.italic ||
    /[\n\r\p{M}\p{Script=Arabic}\p{Script=Hebrew}]/u.test(mark.originalText + (mark.text || ''))
  )
    return mark;
  let original: Mark;
  try {
    original = JSON.parse(mark.originalState) as Mark;
  } catch {
    return mark;
  }
  if (
    editorMarkSignature({ ...mark, text: original.text, runs: original.runs }) !==
    editorMarkSignature(original)
  )
    return mark;
  const font = originalEditorFont(source, mark.originalFontId),
    before = mark.originalText,
    after = mark.text || '';
  if (!font || !font.covers(before) || before === after) return mark;
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix])
    prefix++;
  while (prefix > 0 && !/\s/u.test(before[prefix - 1])) prefix--;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  )
    suffix++;
  while (suffix > 0 && !/\s/u.test(before[before.length - suffix])) suffix--;
  const size = (mark.fontScale || 0.028) * width,
    scale = mark.textScaleX || 1,
    tracking = (mark.tracking || 0) * size;
  const advance = (s: string) => font.measure(s, size) + [...s].length * tracking;
  // The unchanged suffix can only stay put if its new origin really agrees.
  if (
    !font.covers(after) ||
    Math.abs(
      advance(before.slice(0, before.length - suffix)) -
        advance(after.slice(0, after.length - suffix)),
    ) > 0.03
  )
    suffix = 0;
  if (prefix === 0 && suffix === 0) return mark;
  const removed = before.slice(prefix, before.length - suffix),
    replacement = after.slice(prefix, after.length - suffix);
  if (!removed.trim()) return mark;
  const x =
    mark.x + (((mark.insetScale || 0) * size + advance(before.slice(0, prefix))) * scale) / width;
  const right = suffix
    ? mark.x +
      (((mark.insetScale || 0) * size + advance(before.slice(0, before.length - suffix))) * scale) /
        width
    : mark.x + mark.w;
  if (right <= x || x < mark.x || right > mark.x + mark.w + 0.001) return mark;
  return {
    ...mark,
    x,
    w: right - x,
    text: replacement,
    insetScale: 0,
    originalState: undefined,
    sourceRect: { ...mark.sourceRect, x, w: right - x },
    nativeTextSlice: {
      source: mark.sourceRect,
      before: before.slice(0, prefix),
      removed,
      after: before.slice(before.length - suffix),
    },
  };
}
