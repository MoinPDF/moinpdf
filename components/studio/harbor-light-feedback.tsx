'use client';

import { useEffect, useRef } from 'react';

/** A short, non-interactive light echo survives an immediate tool change. */
export function HarborLightFeedback() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = layer.current;
    if (!host) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const forcedColors = window.matchMedia('(forced-colors: active)');
    const active = new Map<HTMLElement, { echo: HTMLSpanElement; timer: number }>();

    const remove = (target: HTMLElement) => {
      const entry = active.get(target);
      if (!entry) return;
      window.clearTimeout(entry.timer);
      entry.echo.remove();
      active.delete(target);
    };
    const clear = () => Array.from(active.keys()).forEach(remove);
    const illuminate = (event: MouseEvent) => {
      if (event.button !== 0 || reducedMotion.matches || forcedColors.matches) return;
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>('[data-harbor-light]');
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      // Pointer activation has already started the same pulse. A keyboard or
      // assistive-technology click still gets one, without delaying the action.
      if (event.type === 'click' && active.has(target)) return;
      remove(target);
      if (active.size >= 4) remove(active.keys().next().value!);
      const surface = target.querySelector<HTMLElement>('[data-harbor-light-surface]') ?? target;
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const keyboard = event.type === 'click' && event.detail === 0;
      const x = keyboard
        ? rect.width / 2
        : Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const y = keyboard
        ? rect.height / 2
        : Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const echo = document.createElement('span');
      echo.className = 'harbor-light-echo';
      echo.style.left = `${rect.left}px`;
      echo.style.top = `${rect.top}px`;
      echo.style.width = `${rect.width}px`;
      echo.style.height = `${rect.height}px`;
      echo.style.borderRadius = getComputedStyle(surface).borderRadius;
      echo.style.setProperty('--light-x', `${x}px`);
      echo.style.setProperty('--light-y', `${y}px`);
      host.append(echo);
      active.set(target, { echo, timer: window.setTimeout(() => remove(target), 620) });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.isPrimary) illuminate(event);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', illuminate, true);
    // A scroll gesture must not leave a floating tile or a stuck touch hover.
    document.addEventListener('scroll', clear, true);
    document.addEventListener('pointercancel', clear, true);
    window.addEventListener('resize', clear);
    reducedMotion.addEventListener('change', clear);
    forcedColors.addEventListener('change', clear);
    return () => {
      clear();
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', illuminate, true);
      document.removeEventListener('scroll', clear, true);
      document.removeEventListener('pointercancel', clear, true);
      window.removeEventListener('resize', clear);
      reducedMotion.removeEventListener('change', clear);
      forcedColors.removeEventListener('change', clear);
    };
  }, []);

  return <div ref={layer} className="harbor-light-layer" aria-hidden="true" />;
}
