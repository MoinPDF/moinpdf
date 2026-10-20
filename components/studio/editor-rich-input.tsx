'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import type { Mark, EditorTextStyle } from '@/lib/studio-engine';
import type { PreparedEditorRun } from '@/lib/editor-rich-layout';
import {
  editorSegments,
  editorStyle,
  replaceEditorRange,
  type EditorSelection,
} from '@/lib/editor-rich-text';
import {
  editorCaretAtPoint,
  editorDomSelection,
  readEditorDom,
  setEditorDomSelection,
} from '@/lib/editor-dom';
import { ui } from '@/lib/ui-language';
import type { EditorPatch } from './editor-typography';

export type EditorStartPoint = {
  id: string;
  x: number;
  y: number;
  pointerType: string;
  pageX?: number;
  pageY?: number;
};
export function EditorRichInput({
  mark,
  width,
  style,
  runs,
  disabled,
  onPatch,
  onDone,
  onSelection,
  initialPoint,
}: {
  mark: Mark;
  width: number;
  style: CSSProperties;
  runs?: PreparedEditorRun[];
  disabled: boolean;
  onPatch: EditorPatch;
  onDone: () => void;
  onSelection?: (selection: EditorSelection) => void;
  initialPoint?: EditorStartPoint | null;
}) {
  const [repair, setRepair] = useState(0);
  const input = useRef<HTMLDivElement>(null),
    composing = useRef(false),
    signature = useRef(''),
    activeId = useRef(''),
    styles = useRef<EditorTextStyle[]>([]);
  const pendingCaret = useRef<number | null>(null),
    dragAnchor = useRef<number | null>(null),
    latest = useRef({ mark, onPatch, onSelection });
  latest.current = { mark, onPatch, onSelection };
  const remember = () => {
    const root = input.current;
    if (!root) return;
    const s = editorDomSelection(root);
    if (s) latest.current.onSelection?.({ id: latest.current.mark.id, start: s.start, end: s.end });
  };
  useLayoutEffect(() => {
    const root = input.current;
    if (!root || composing.current) return;
    const key = JSON.stringify([
      mark.text,
      mark.runs,
      editorStyle(mark),
      width,
      repair,
      style.color,
      runs?.map((r) => r.resolution.font.cssFamily),
    ]);
    if (signature.current === key) return;
    const selection = editorDomSelection(root),
      fresh = activeId.current !== mark.id;
    activeId.current = mark.id;
    signature.current = key;
    const segments = editorSegments(mark);
    styles.current = segments.map((r) => r.style);
    const nodes = segments.map((run, i) => {
      const span = document.createElement('span'),
        font = runs?.find((r) => r.start <= run.start && r.end >= run.end)?.resolution.font;
      span.dataset.editorStyle = String(i);
      span.textContent = (mark.text || '').slice(run.start, run.end);
      Object.assign(span.style, {
        fontWeight: run.style.bold ? '700' : '400',
        fontStyle: run.style.italic ? 'italic' : 'normal',
        color:
          style.color === 'transparent'
            ? 'transparent'
            : run.style.color || mark.color || '#222222',
        fontSize: `${(run.style.fontScale || mark.fontScale || 0.028) * width}px`,
        ...(font ? { fontFamily: `"${font.cssFamily}"` } : {}),
      });
      return span;
    });
    root.replaceChildren(...nodes);
    if (!mark.text || mark.text.endsWith('\n')) {
      const br = document.createElement('br');
      br.dataset.editorTail = 'true';
      root.append(br);
    }
    if (disabled) return;
    if (fresh) {
      root.focus({ preventScroll: true });
      const p = initialPoint?.id === mark.id ? initialPoint : undefined;
      let x = p?.x || 0,
        y = p?.y || 0;
      const sheet = root.closest('.editor-sheet');
      if (p && sheet && p.pageX !== undefined && p.pageY !== undefined) {
        // Opening the toolbar must not move the clicked line away from the pointer.
        const delta =
          sheet.getBoundingClientRect().top + p.pageY * sheet.getBoundingClientRect().height - p.y;
        let remaining = delta;
        for (
          let parent = sheet.parentElement;
          parent && Math.abs(remaining) > 0.5;
          parent = parent.parentElement
        ) {
          if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) {
            const previous = parent.scrollTop;
            parent.scrollTop += remaining;
            remaining -= parent.scrollTop - previous;
          }
        }
        if (Math.abs(remaining) > 0.5) window.scrollBy({ top: remaining, behavior: 'instant' });
        const box = sheet.getBoundingClientRect();
        x = box.left + p.pageX * box.width;
        y = box.top + p.pageY * box.height;
      }
      const caret = p ? editorCaretAtPoint(root, x, y) : 0;
      setEditorDomSelection(root, caret ?? 0);
      if (p?.pointerType === 'mouse') dragAnchor.current = caret ?? 0;
    } else if (pendingCaret.current !== null) {
      setEditorDomSelection(root, pendingCaret.current);
      pendingCaret.current = null;
    } else if (selection) setEditorDomSelection(root, selection.anchor, selection.focus);
    remember();
  });
  useEffect(() => {
    const selection = () => remember();
    const move = (e: PointerEvent) => {
      const root = input.current;
      if (!root || dragAnchor.current === null || e.buttons !== 1) return;
      const focus = editorCaretAtPoint(root, e.clientX, e.clientY);
      if (focus !== null) {
        setEditorDomSelection(root, dragAnchor.current, focus);
        remember();
      }
    };
    const up = () => {
      dragAnchor.current = null;
    };
    document.addEventListener('selectionchange', selection);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    return () => {
      document.removeEventListener('selectionchange', selection);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  }, []);
  function insert(text: string) {
    const root = input.current;
    if (!root) return;
    const selection = editorDomSelection(root);
    if (!selection) return;
    text = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    const capacity = 20000 - (mark.text || '').length + selection.end - selection.start;
    text = text.slice(0, Math.max(0, capacity));
    pendingCaret.current = selection.start + text.length;
    onPatch(mark.id, replaceEditorRange(mark, selection.start, selection.end, text), 'typing');
  }
  function change(e: FormEvent<HTMLDivElement>) {
    if (composing.current) return;
    const value = readEditorDom(e.currentTarget, styles.current, editorStyle(mark));
    if (value.text.length > 20000) {
      signature.current = '';
      setRepair((value) => value + 1);
      return;
    }
    onPatch(
      mark.id,
      {
        text: value.text,
        runs: mark.runs?.length ? editorSegments({ ...mark, ...value }) : undefined,
      },
      'typing',
    );
    remember();
  }
  return (
    <div
      ref={input}
      className="editor-inline-input"
      role="textbox"
      aria-multiline="true"
      aria-label={ui('Text direkt in der PDF bearbeiten')}
      data-editor-history="true"
      contentEditable={!disabled}
      suppressContentEditableWarning
      spellCheck={false}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onBeforeInput={(e) => {
        const type = (e.nativeEvent as InputEvent).inputType;
        if (type === 'insertParagraph' || type === 'insertLineBreak') {
          e.preventDefault();
          insert('\n');
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        insert(e.clipboardData.getData('text/plain'));
      }}
      onDrop={(e) => e.preventDefault()}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        change(e);
      }}
      onInput={change}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing || composing.current) return;
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          onDone();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          insert('\n');
        } else if ((e.ctrlKey || e.metaKey) && ['b', 'i'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          remember();
          const selection = input.current ? editorDomSelection(input.current) : null;
          const active =
            editorSegments(mark).find(
              (r) => r.start <= (selection?.start || 0) && r.end > (selection?.start || 0),
            )?.style || mark;
          onPatch(
            mark.id,
            e.key.toLowerCase() === 'b' ? { bold: !active.bold } : { italic: !active.italic },
          );
        }
      }}
    />
  );
}
