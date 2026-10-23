import type { Mark, Rect, EditorTextRun } from './studio-engine';
import type { TextTarget } from './editor-model';
import { editorMarkChanged, editorMarkSignature, editorRemovalRects } from './editor-model';
import { editorListSlice, editorSegments, replaceEditorRange } from './editor-rich-text';

export function editorTargetMark(
  target: TextTarget,
  pageIndex: number,
  width: number,
  id: string,
): Mark {
  if (target.unsupportedReason) throw new Error(target.unsupportedReason);
  const { x, y, w, h } = target;
  const fill = target.fill || '#ffffff';
  const brightness = [1, 3, 5].reduce(
    (sum, start, i) =>
      sum + parseInt(fill.slice(start, start + 2), 16) * [0.2126, 0.7152, 0.0722][i],
    0,
  );
  const mark: Mark = {
    id,
    kind: 'text',
    x,
    y,
    w,
    h,
    text: target.text,
    originalText: target.text,
    sourceRect: { x, y, w, h },
    sourceIsScan: target.origin === 'ocr' || !!target.invisible,
    fill,
    color: target.color || (brightness < 110 ? '#ffffff' : '#222222'),
    textRotation: (((target.rotation || 0) % 360) + 360) % 360,
    textAspect: target.textAspect,
    fontFamily: target.family,
    fontChoice: 'auto',
    bold: !!target.bold,
    italic: !!target.italic,
    originalFontId: target.originalFontId,
    originalFontName: target.fontName,
    originalFontPage: pageIndex,
    baselineScale: target.baselineScale,
    insetScale: target.insetScale,
    lineHeight: target.lineHeight,
    tracking: target.tracking,
    textScaleX: target.textScaleX,
    fontScale: Math.max(0.1, target.fontSize) / width,
    ...(target.runs?.length
      ? {
          runs: target.runs.map((r) => ({
            ...r,
            style: { ...r.style, originalFontPage: pageIndex },
          })),
        }
      : {}),
    ...(target.fragments?.length
      ? { sourceRects: target.fragments.map(({ x, y, w, h }) => ({ x, y, w, h })) }
      : {}),
  };
  mark.originalState = editorMarkSignature(mark);
  return mark;
}

export function editorBounds(rects: Rect[]): Rect {
  if (!rects.length) throw new Error('Bitte mindestens eine Textstelle auswählen.');
  const x = Math.min(...rects.map((r) => r.x)),
    y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    w: Math.max(...rects.map((r) => r.x + r.w)) - x,
    h: Math.max(...rects.map((r) => r.y + r.h)) - y,
  };
}

/** Explicit grouping, never inferred across a column or page boundary. Source
 * rectangles remain separate so editing a joined field cannot erase its gaps. */
export function joinEditorBlocks(marks: Mark[], width: number, height: number, id: string): Mark {
  if (
    marks.length < 2 ||
    marks.length > 50 ||
    marks.some((m) => m.kind !== 'text' || m.textRotation)
  )
    throw new Error('Bitte 2 bis 50 waagerechte Textfelder auf derselben Seite auswählen.');
  if (new Set(marks.map((m) => m.customFont?.data || '')).size > 1)
    throw new Error(
      'Textfelder mit unterschiedlichen eigenen Schriften bitte getrennt bearbeiten.',
    );
  if (marks.some((m) => m.sourceIsScan) && new Set(marks.map((m) => m.fill || '#ffffff')).size > 1)
    throw new Error('Scanbereiche mit verschiedenen Hintergründen bitte getrennt bearbeiten.');
  const sorted = [...marks].sort((a, b) =>
    Math.abs(a.y - b.y) * height <
    Math.min(a.fontScale || 0.028, b.fontScale || 0.028) * width * 0.3
      ? a.x - b.x
      : a.y - b.y,
  );
  let text = '';
  const runs: EditorTextRun[] = [];
  for (const [index, mark] of sorted.entries()) {
    if (index) {
      const before = sorted[index - 1];
      const sameLine =
        Math.abs(mark.y - before.y) * height <
        Math.min(mark.fontScale || 0.028, before.fontScale || 0.028) * width * 0.3;
      const separator = sameLine
        ? /\s$/u.test(text) || /^\s/u.test(mark.text || '')
          ? ''
          : ' '
        : '\n';
      if (separator)
        runs.push({
          start: text.length,
          end: text.length + separator.length,
          style: runs.at(-1)?.style || {},
        });
      text += separator;
    }
    const offset = text.length;
    runs.push(
      ...editorSegments(mark).map((run) => ({
        ...run,
        start: run.start + offset,
        end: run.end + offset,
      })),
    );
    text += mark.text || '';
  }
  if (text.length > 20000) throw new Error('Ein Textfeld darf höchstens 20.000 Zeichen enthalten.');
  const removals = marks.flatMap(editorRemovalRects);
  const next: Mark = {
    ...sorted[0],
    ...editorBounds(marks),
    id,
    text,
    runs,
    originalText: text,
    originalState: undefined,
    sourceRect: removals.length ? editorBounds(removals) : undefined,
    sourceRects: removals.length ? removals : undefined,
    sourceIsScan: marks.some((m) => m.sourceIsScan),
  };
  const secondLine = sorted.find(
    (m) => (m.y - sorted[0].y) * height > (sorted[0].fontScale || 0.028) * width * 0.5,
  );
  if (secondLine)
    next.lineHeight = Math.max(
      1,
      Math.min(
        3,
        ((secondLine.y - sorted[0].y) * height) / ((sorted[0].fontScale || 0.028) * width),
      ),
    );
  if (marks.every((m) => !editorMarkChanged(m))) next.originalState = editorMarkSignature(next);
  return next;
}

/** Splitting is an explicit layout change. Only the first half owns original
 * removals; the second is added text, so old glyphs are removed exactly once. */
export function splitEditorBlock(
  mark: Mark,
  at: number,
  firstHeight: number,
  secondHeight: number,
  pageHeight: number,
  id: string,
): [Mark, Mark] {
  const text = mark.text || '';
  if (
    mark.textRotation ||
    !Number.isSafeInteger(at) ||
    at <= 0 ||
    at >= text.length ||
    !text.slice(0, at).trim() ||
    !text.slice(at).trim() ||
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text).containing(at)
      ?.index !== at
  )
    throw new Error(
      'Bitte den Textcursor zwischen zwei Textteilen im waagerechten Textfeld setzen.',
    );
  const first = {
    ...mark,
    changeGroup: mark.changeGroup || id,
    ...replaceEditorRange(mark, at, text.length, ''),
    originalState: undefined,
    h: firstHeight / pageHeight,
  };
  const second: Mark = {
    ...mark,
    changeGroup: mark.changeGroup || id,
    ...replaceEditorRange(mark, 0, at, ''),
    ...editorListSlice(mark, at),
    id,
    originalState: undefined,
    originalText: undefined,
    sourceRect: undefined,
    sourceRects: undefined,
    sourceIsScan: false,
    y: mark.y + first.h,
    h: secondHeight / pageHeight,
  };
  if (
    ![firstHeight, secondHeight, pageHeight].every((n) => Number.isFinite(n) && n > 0) ||
    second.y + second.h > 1 + 0.00001
  )
    throw new Error(
      'Für zwei Textfelder ist unterhalb dieser Stelle nicht genug Platz. Bitte zuerst verschieben oder verkleinern.',
    );
  return [first, second];
}
