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
  editorSelectionStyle,
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
  selectionRequest,
  onSearch,
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
  selectionRequest?: EditorSelection | null;
  onSearch?: () => void;
}) {
  const [repair, setRepair] = useState(0);
  const [magnifier, setMagnifier] = useState<{
    x: number;
    y: number;
    before: string;
    selected: string;
    after: string;
  } | null>(null);
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
    const segments = runs || editorSegments(mark);
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
        const pageScroller = root.closest('.editor-page-scroll');
        for (
          let parent = sheet.parentElement;
          parent && Math.abs(remaining) > 0.5;
          parent = parent.parentElement
        ) {
          // The toolbar moves the page viewport itself. Scrolling inside that
          // viewport would hide the clicked line above its clipped edge.
          if (
            parent !== pageScroller &&
            ['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)
          ) {
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
  useLayoutEffect(() => {
    const root = input.current;
    if (!root || disabled || selectionRequest?.id !== mark.id) return;
    root.focus({ preventScroll: true });
    setEditorDomSelection(root, selectionRequest.start, selectionRequest.end);
    const scroller = root.closest<HTMLElement>('.editor-page-scroll'),
      selection = window.getSelection();
    if (scroller && selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      if (typeof range.getBoundingClientRect === 'function') {
        scroller.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const rect = range.getBoundingClientRect(),
          viewport = scroller.getBoundingClientRect();
        if (rect.top < viewport.top + 16) scroller.scrollTop += rect.top - viewport.top - 16;
        else if (rect.bottom > viewport.bottom - 16)
          scroller.scrollTop += Math.min(
            rect.top - viewport.top - 16,
            rect.bottom - viewport.bottom + 16,
          );
        if (rect.left < viewport.left + 16) scroller.scrollLeft += rect.left - viewport.left - 16;
        else if (rect.right > viewport.right - 16)
          scroller.scrollLeft += Math.min(
            rect.left - viewport.left - 16,
            rect.right - viewport.right + 16,
          );
      }
    }
    remember();
  }, [selectionRequest, mark.id, disabled]);
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
  useEffect(() => {
    let frame = 0,
      touch = false,
      followCaret = true,
      position = { x: 0, y: 0 };
    const reveal = () => {
      cancelAnimationFrame(frame);
      if (!followCaret) return;
      frame = requestAnimationFrame(() => {
        const root = input.current,
          selection = window.getSelection();
        if (!followCaret || !root || document.activeElement !== root || !selection?.rangeCount)
          return;
        const range = selection.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return;
        if (typeof range.getBoundingClientRect !== 'function') return;
        const viewport = window.visualViewport;
        if (range.getBoundingClientRect().height > 0) {
          // The page has its own scroll area inside the workbench. Reveal the
          // caret through every clipping ancestor, rather than scrolling only
          // the page while its entire viewport remains hidden below controls.
          for (
            let parent = root.parentElement;
            parent && parent !== document.body;
            parent = parent.parentElement
          ) {
            if (!['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) continue;
            const box = parent.getBoundingClientRect(),
              rect = range.getBoundingClientRect();
            const toolbar = parent.querySelector<HTMLElement>('.editor-inline-toolbar'),
              toolbarBox = toolbar?.getBoundingClientRect(),
              inset =
                toolbar &&
                getComputedStyle(toolbar).position === 'sticky' &&
                toolbarBox &&
                toolbarBox.top <= box.top + 2
                  ? toolbarBox.height + 12
                  : 12;
            const top = box.top + inset,
              bottom = box.bottom - 12;
            if (bottom > top) {
              if (rect.bottom > bottom) parent.scrollTop += rect.bottom - bottom;
              else if (rect.top < top) parent.scrollTop -= top - rect.top;
            }
          }
          const rect = range.getBoundingClientRect(),
            top = (viewport?.offsetTop || 0) + 100,
            bottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 64;
          if (bottom > top && typeof window.scrollBy === 'function') {
            if (rect.bottom > bottom)
              window.scrollBy({ top: rect.bottom - bottom, behavior: 'instant' });
            else if (rect.top < top) window.scrollBy({ top: rect.top - top, behavior: 'instant' });
          }
        }
        if (touch) {
          const picked = editorDomSelection(root),
            text = latest.current.mark.text || '';
          if (picked)
            setMagnifier({
              x: Math.max(120, Math.min(window.innerWidth - 120, position.x)),
              y: Math.max((viewport?.offsetTop || 0) + 12, position.y - 90),
              before: text.slice(Math.max(0, picked.start - 12), picked.start),
              selected: text.slice(picked.start, picked.end).slice(0, 24),
              after: text.slice(picked.end, picked.end + 12),
            });
        }
      });
    };
    const pause = () => {
      // Manual scrolling and clicks on other controls take precedence over a
      // pending caret/layout update. Otherwise a late frame can move a button
      // between pointer-down and pointer-up, silently swallowing its click.
      followCaret = false;
      cancelAnimationFrame(frame);
    };
    const resume = () => {
      followCaret = true;
      reveal();
    };
    const down = (e: PointerEvent) => {
      if (!input.current?.contains(e.target as Node)) {
        pause();
        return;
      }
      followCaret = true;
      if (e.pointerType === 'touch' && input.current.closest('.is-touch-mode')) {
        touch = true;
        position = { x: e.clientX, y: e.clientY };
        reveal();
      }
    };
    const move = (e: PointerEvent) => {
      if (touch) {
        followCaret = true;
        position = { x: e.clientX, y: e.clientY };
        reveal();
      }
    };
    const up = () => {
      touch = false;
      setMagnifier(null);
    };
    const root = input.current;
    root?.addEventListener('keydown', resume, true);
    root?.addEventListener('beforeinput', resume);
    root?.addEventListener('focus', resume);
    document.addEventListener('selectionchange', reveal);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('scroll', pause, true);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    window.visualViewport?.addEventListener('resize', reveal);
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reveal);
    const canvas = input.current?.closest('.editor-canvas-wrap');
    if (canvas) resize?.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      root?.removeEventListener('keydown', resume, true);
      root?.removeEventListener('beforeinput', resume);
      root?.removeEventListener('focus', resume);
      document.removeEventListener('selectionchange', reveal);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('scroll', pause, true);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      window.visualViewport?.removeEventListener('resize', reveal);
      resize?.disconnect();
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
    <>
      {magnifier && (
        <div
          className="editor-selection-magnifier"
          aria-hidden="true"
          style={{ left: magnifier.x, top: magnifier.y }}
        >
          {magnifier.before}
          <mark>{magnifier.selected || '│'}</mark>
          {magnifier.after}
        </div>
      )}
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
          } else if (
            (e.ctrlKey || e.metaKey) &&
            ['f', 'h'].includes(e.key.toLowerCase()) &&
            onSearch
          ) {
            e.preventDefault();
            remember();
            onSearch();
          } else if ((e.ctrlKey || e.metaKey) && ['b', 'i'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            remember();
            const selection = input.current ? editorDomSelection(input.current) : null;
            const active = editorSelectionStyle(
              mark,
              selection ? { id: mark.id, ...selection } : null,
            );
            onPatch(
              mark.id,
              e.key.toLowerCase() === 'b'
                ? { bold: active.mixed.has('bold') || !active.style.bold }
                : { italic: active.mixed.has('italic') || !active.style.italic },
            );
          }
        }}
      />
    </>
  );
}
