import type { Mark, EditorTextRun, EditorTextStyle } from './studio-engine';

export function editorDomOffset(root: HTMLElement, node: Node, offset: number) {
  if (node !== root && !root.contains(node)) return null;
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return null;
  }
}
export function editorDomSelection(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.anchorNode || !selection.focusNode) return null;
  const anchor = editorDomOffset(root, selection.anchorNode, selection.anchorOffset),
    focus = editorDomOffset(root, selection.focusNode, selection.focusOffset);
  return anchor === null || focus === null
    ? null
    : { anchor, focus, start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
}
function point(root: HTMLElement, offset: number): [Node, number] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null,
    last: Node | null = null;
  while ((node = walker.nextNode())) {
    last = node;
    if (offset <= (node.textContent || '').length) return [node, offset];
    offset -= (node.textContent || '').length;
  }
  return last ? [last, (last.textContent || '').length] : [root, 0];
}
export function setEditorDomSelection(root: HTMLElement, anchor: number, focus = anchor) {
  const selection = window.getSelection();
  if (!selection) return;
  const [a, ao] = point(root, Math.max(0, anchor)),
    [b, bo] = point(root, Math.max(0, focus));
  selection.setBaseAndExtent(a, ao, b, bo);
}
export function editorCaretAtPoint(root: HTMLElement, x: number, y: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos) return editorDomOffset(root, pos.offsetNode, pos.offset);
  const range = doc.caretRangeFromPoint?.(x, y);
  return range ? editorDomOffset(root, range.startContainer, range.startOffset) : null;
}
/** Read only text and our own bounded style records. Clipboard HTML is converted to scalar styles before it reaches this DOM. */
export function readEditorDom(
  root: HTMLElement,
  styles: EditorTextStyle[],
  fallback: EditorTextStyle,
) {
  let text = '';
  const runs: EditorTextRun[] = [];
  function visit(node: Node, style: EditorTextStyle) {
    if (node.nodeType === Node.TEXT_NODE) {
      const part = node.textContent || '';
      if (part) {
        runs.push({ start: text.length, end: text.length + part.length, style });
        text += part;
      }
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.editorTail) return;
    const index = Number(node.dataset.editorStyle);
    if (node.dataset.editorStyle !== undefined && Number.isSafeInteger(index) && styles[index])
      style = styles[index];
    if (node.tagName === 'BR') {
      runs.push({ start: text.length, end: text.length + 1, style });
      text += '\n';
      return;
    }
    const block = node !== root && ['DIV', 'P'].includes(node.tagName);
    if (block && text && !text.endsWith('\n')) {
      runs.push({ start: text.length, end: text.length + 1, style });
      text += '\n';
    }
    node.childNodes.forEach((child) => visit(child, style));
  }
  visit(root, fallback);
  return { text, runs };
}

/** Import text and a small scalar style allowlist from an inert template. No DOM,
 * stylesheets, images, URLs, event handlers or executable nodes reach the editor. */
export function parseEditorClipboard(html: string, plain: string, mark: Mark, pageWidth: number) {
  if (!html || html.length > 1000000) return null;
  const template = document.createElement('template');
  template.innerHTML = html;
  let text = '',
    count = 0;
  const runs: EditorTextRun[] = [];
  let listStyle: Mark['listStyle'];
  const append = (part: string, style: EditorTextStyle) => {
    if (text.length + part.length > 20000)
      throw new Error('Der eingefügte Text ist zu lang. Bitte kleinere Abschnitte einfügen.');
    if (part) {
      runs.push({ start: text.length, end: text.length + part.length, style: { ...style } });
      text += part;
    }
  };
  const visit = (node: Node, parent: EditorTextStyle, depth: number) => {
    if (++count > 5000 || depth > 30)
      throw new Error('Die Formatierung ist zu umfangreich. Bitte als Text einfügen.');
    if (node.nodeType === Node.TEXT_NODE) {
      append((node.textContent || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    '), parent);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (
      [
        'SCRIPT',
        'STYLE',
        'TEMPLATE',
        'IFRAME',
        'OBJECT',
        'SVG',
        'MATH',
        'IMG',
        'VIDEO',
        'AUDIO',
        'LINK',
        'META',
      ].includes(node.tagName)
    )
      return;
    const next = { ...parent };
    const css = node.style;
    if (
      ['B', 'STRONG'].includes(node.tagName) ||
      css.fontWeight === 'bold' ||
      Number(css.fontWeight) >= 600
    )
      next.bold = true;
    if (css.fontWeight === 'normal' || (css.fontWeight && Number(css.fontWeight) < 600))
      next.bold = false;
    if (['I', 'EM'].includes(node.tagName) || css.fontStyle === 'italic') next.italic = true;
    if (css.fontStyle === 'normal') next.italic = false;
    if (
      node.tagName === 'U' ||
      css.textDecoration.includes('underline') ||
      css.textDecorationLine.includes('underline')
    )
      next.underline = true;
    if (node.tagName === 'SUP' || css.verticalAlign === 'super') next.script = 'super';
    if (node.tagName === 'SUB' || css.verticalAlign === 'sub') next.script = 'sub';
    const size = css.fontSize.match(/^(\d+(?:\.\d+)?)(pt|px)$/);
    if (size) {
      const pt = Number(size[1]) * (size[2] === 'px' ? 0.75 : 1);
      if (pt >= 1 && pt <= 288) next.fontScale = pt / pageWidth;
    }
    const color = css.color.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
    if (color)
      next.color =
        '#' +
        color
          .slice(1)
          .map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0'))
          .join('');
    else if (/^#[a-f\d]{6}$/i.test(css.color)) next.color = css.color;
    if (css.fontFamily) {
      next.fontFamily = /mono|courier|consolas/i.test(css.fontFamily)
        ? 'mono'
        : /times|serif|georgia|cambria/i.test(css.fontFamily) && !/sans/i.test(css.fontFamily)
          ? 'serif'
          : 'sans';
      next.fontChoice = 'auto';
      next.originalFontId = undefined;
      next.originalFontName = undefined;
    }
    if (node.tagName === 'BR') {
      append('\n', next);
      return;
    }
    const block = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR'].includes(
      node.tagName,
    );
    if (block && text && !text.endsWith('\n')) append('\n', next);
    if (node.tagName === 'OL' && !listStyle) listStyle = 'numbered';
    if (node.tagName === 'UL' && !listStyle) listStyle = 'bullet';
    node.childNodes.forEach((child) => visit(child, next, depth + 1));
    if (block && text && !text.endsWith('\n')) append('\n', next);
  };
  template.content.childNodes.forEach((node) =>
    visit(node, { bold: false, italic: false, underline: false, script: 'normal' }, 0),
  );
  if (text.endsWith('\n') && !plain.endsWith('\n')) text = text.slice(0, -1);
  // Clipboard representations must describe the same content. Ignore rich data
  // from inconsistent or hostile producers; the plain-text path stays authoritative.
  const comparable = (value: string) => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const plainContent = listStyle ? plain.replace(/(^|\n)\s*(?:[•●▪]|\d+[.)])\s+/g, '$1') : plain;
  if (plain && comparable(text) !== comparable(plainContent)) return null;
  const clipped = runs
    .filter((r) => r.start < text.length)
    .map((r) => ({ ...r, end: Math.min(text.length, r.end) }));
  return text ? { text, runs: clipped, listStyle } : null;
}
