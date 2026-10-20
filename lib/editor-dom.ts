import type { EditorTextRun, EditorTextStyle } from './studio-engine';

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
/** Read only text and our own bounded style records. Pasted HTML is never imported. */
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
