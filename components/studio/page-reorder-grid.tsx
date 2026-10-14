'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from './appearance';
import {
  pageDropDestination,
  reorderPageItems,
  type PagePosition,
} from '@/lib/interaction-feedback';

export function PageReorderGrid({
  pages,
  locked,
  onMove,
  children,
}: {
  pages: { id: string }[];
  locked: boolean;
  onMove: (id: string, to: number) => void;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; to: number } | null>(null);
  const previous = useRef(new Map<string, PagePosition>());
  const animations = useRef<Animation[]>([]);
  const focusAfterMove = useRef<HTMLElement | null>(null);
  const [destination, setDestination] = useState<(PagePosition & { index: number }) | null>(null);
  const tiles = useCallback(
    () => Array.from(grid.current?.querySelectorAll<HTMLElement>(':scope > [data-page-id]') ?? []),
    [],
  );
  const positions = useCallback(
    (): PagePosition[] =>
      tiles().map((node) => ({
        id: node.dataset.pageId!,
        left: node.offsetLeft,
        top: node.offsetTop,
        width: node.offsetWidth,
        height: node.offsetHeight,
      })),
    [tiles],
  );
  const reset = useCallback(() => {
    drag.current = null;
    setDestination(null);
    for (const node of tiles()) {
      node.style.removeProperty('--page-shift-x');
      node.style.removeProperty('--page-shift-y');
      node.removeAttribute('data-drag-source');
    }
    grid.current?.removeAttribute('data-reordering');
  }, [tiles]);
  const rememberVisualPositions = () => {
    if (!grid.current) return;
    const bounds = grid.current.getBoundingClientRect();
    previous.current = new Map(
      tiles().map((node) => {
        const rect = node.getBoundingClientRect();
        return [
          node.dataset.pageId!,
          {
            id: node.dataset.pageId!,
            left: rect.left - bounds.left,
            top: rect.top - bounds.top,
            width: rect.width,
            height: rect.height,
          },
        ];
      }),
    );
  };

  useLayoutEffect(() => {
    const current = positions();
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    // Scroll to the final layout slot before applying the visual animation,
    // including long Home/End moves. The focused handle must remain visible.
    if (focusAfterMove.current?.isConnected) {
      focusAfterMove.current.focus({ preventScroll: true });
      focusAfterMove.current.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'instant',
      });
    }
    focusAfterMove.current = null;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const node of tiles()) {
      const before = previous.current.get(node.dataset.pageId!);
      const after = current.find((slot) => slot.id === node.dataset.pageId);
      if (!animate || !before || !after || !after.width || !node.animate) continue;
      const x = before.left - after.left,
        y = before.top - after.top;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) continue;
      animations.current.push(
        node.animate(
          [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 190, easing: 'ease-out' },
        ),
      );
    }
    previous.current = new Map(current.map((slot) => [slot.id, slot]));
  }, [pages, positions, tiles]);

  useEffect(() => {
    if (locked) reset();
  }, [locked, reset]);
  useEffect(() => {
    const resize = () => {
      reset();
      previous.current = new Map(positions().map((slot) => [slot.id, slot]));
    };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stopAnimation = () => animations.current.forEach((animation) => animation.cancel());
    window.addEventListener('dragend', reset);
    window.addEventListener('drop', reset);
    window.addEventListener('blur', reset);
    window.addEventListener('resize', resize);
    motion.addEventListener('change', stopAnimation);
    return () => {
      stopAnimation();
      window.removeEventListener('dragend', reset);
      window.removeEventListener('drop', reset);
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', resize);
      motion.removeEventListener('change', stopAnimation);
    };
  }, [positions, reset]);

  return (
    <div
      ref={grid}
      className="page-grid page-reorder-grid"
      onClickCapture={(event) => {
        const button =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>('.tile-actions [data-page-move]')
            : null;
        if (button) focusAfterMove.current = button;
      }}
      onDragStart={(event) => {
        const tile =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-page-id]')
            : null;
        if (locked || !tile || pages.length < 2) {
          event.preventDefault();
          return;
        }
        animations.current.forEach((animation) => animation.cancel());
        const id = tile.dataset.pageId!;
        drag.current = { id, to: pages.findIndex((page) => page.id === id) };
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => {
        const current = drag.current;
        if (!current || locked || !grid.current) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        const bounds = grid.current.getBoundingClientRect(),
          slots = positions();
        const to = pageDropDestination(
          slots,
          current.id,
          event.clientX - bounds.left,
          event.clientY - bounds.top,
        );
        if (to < 0) return;
        const order = reorderPageItems(slots, current.id, to);
        current.to = to;
        grid.current.setAttribute('data-reordering', '');
        for (const node of tiles()) {
          const original = slots.find((slot) => slot.id === node.dataset.pageId)!;
          const target = slots[order.findIndex((slot) => slot.id === node.dataset.pageId)];
          node.style.setProperty('--page-shift-x', `${target.left - original.left}px`);
          node.style.setProperty('--page-shift-y', `${target.top - original.top}px`);
          if (node.dataset.pageId === current.id) node.setAttribute('data-drag-source', '');
        }
        setDestination((old) => (old?.index === to ? old : { ...slots[to], index: to }));
      }}
      onDragLeave={(event) => {
        if (event.relatedTarget instanceof Node && grid.current?.contains(event.relatedTarget))
          return;
        const bounds = grid.current?.getBoundingClientRect();
        if (
          bounds &&
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom
        )
          return;
        // Keep the drag identity so returning to the grid still works; clear only the preview.
        const current = drag.current;
        reset();
        if (current)
          drag.current = { ...current, to: pages.findIndex((page) => page.id === current.id) };
      }}
      onDrop={(event) => {
        const current = drag.current;
        if (!current) return;
        event.preventDefault();
        event.stopPropagation();
        rememberVisualPositions();
        reset();
        if (!locked) onMove(current.id, current.to);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          reset();
          return;
        }
        if (locked || event.altKey || event.ctrlKey || event.metaKey) return;
        const handle =
          event.target instanceof Element ? event.target.closest('.page-drag-handle') : null;
        const tile = handle?.closest<HTMLElement>('[data-page-id]');
        if (!tile) return;
        const slots = positions(),
          from = pages.findIndex((page) => page.id === tile.dataset.pageId);
        const columns = slots.filter((slot) => Math.abs(slot.top - slots[0].top) < 2).length || 1;
        const targets: Record<string, number> = {
          ArrowLeft: from - 1,
          ArrowRight: from + 1,
          ArrowUp: from - columns,
          ArrowDown: from + columns,
          Home: 0,
          End: pages.length - 1,
        };
        if (!(event.key in targets)) return;
        event.preventDefault();
        const to = Math.max(0, Math.min(pages.length - 1, targets[event.key]));
        if (to === from) return;
        focusAfterMove.current = handle as HTMLElement;
        rememberVisualPositions();
        onMove(tile.dataset.pageId!, to);
      }}
    >
      {children}
      {destination && (
        <div
          className="page-insertion-marker"
          aria-hidden="true"
          style={{
            left: destination.left - 7,
            top: destination.top,
            height: destination.height,
          }}
        />
      )}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {destination
          ? `${t('Einfügen an Position', 'Insert at position')} ${destination.index + 1}`
          : ''}
      </span>
    </div>
  );
}
