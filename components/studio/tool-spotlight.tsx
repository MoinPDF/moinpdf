'use client';

import { useEffect } from 'react';

export function ToolSpotlight() {
  useEffect(() => {
    const enabled = window.matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
    const forced = window.matchMedia('(forced-colors: active)');
    let target: HTMLElement | null = null,
      frame = 0,
      x = 0,
      y = 0;
    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      target?.removeAttribute('data-spotlight');
      target?.style.removeProperty('--spotlight-x');
      target?.style.removeProperty('--spotlight-y');
      target = null;
    };
    const move = (event: PointerEvent) => {
      if (!enabled.matches || forced.matches || event.pointerType !== 'mouse' || event.buttons) {
        clear();
        return;
      }
      const next =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              '.moinpdf-shell .tool-mosaic-card, .moinpdf-shell .chooser-tool',
            )
          : null;
      if (!next || next.matches(':disabled, [aria-disabled="true"]')) {
        clear();
        return;
      }
      if (target !== next) {
        clear();
        target = next;
      }
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!target?.isConnected) {
          clear();
          return;
        }
        const bounds = target.getBoundingClientRect();
        target.style.setProperty(
          '--spotlight-x',
          `${Math.max(0, Math.min(bounds.width, x - bounds.left))}px`,
        );
        target.style.setProperty(
          '--spotlight-y',
          `${Math.max(0, Math.min(bounds.height, y - bounds.top))}px`,
        );
        target.setAttribute('data-spotlight', '');
      });
    };
    const leave = (event: PointerEvent) => {
      if (
        target &&
        (!(event.relatedTarget instanceof Node) || !target.contains(event.relatedTarget))
      )
        clear();
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerout', leave, { passive: true });
    document.addEventListener('pointerdown', clear, true);
    document.addEventListener('scroll', clear, true);
    window.addEventListener('blur', clear);
    window.addEventListener('resize', clear);
    enabled.addEventListener('change', clear);
    forced.addEventListener('change', clear);
    return () => {
      clear();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('pointerdown', clear, true);
      document.removeEventListener('scroll', clear, true);
      window.removeEventListener('blur', clear);
      window.removeEventListener('resize', clear);
      enabled.removeEventListener('change', clear);
      forced.removeEventListener('change', clear);
    };
  }, []);
  return null;
}
