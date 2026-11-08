'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export const STARTUP_DURATION_MS = 2750;

/** Photographic poses derived from the original sailor in the kettenzug header. */
export function StartupSailor() {
  return (
    <div className="startup-sailor" aria-hidden="true">
      <img
        className="startup-sailor-atlas"
        src="/branding/startup-sailor-tear.webp"
        width="1774"
        height="887"
        alt=""
        fetchPriority="high"
        decoding="sync"
        draggable={false}
      />
    </div>
  );
}

export function StartupAnimation() {
  const [visible, setVisible] = useState(true);
  const overlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const element = overlay.current;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const finish = () => setVisible(false);
    // CSS may already have started during server rendering. Never restart its clock.
    const animation = element
      ?.getAnimations?.()
      .find((entry) => 'animationName' in entry && entry.animationName === 'moinpdf-startup-exit');
    const elapsed = typeof animation?.currentTime === 'number' ? animation.currentTime : 0;
    const remaining = Math.max(0, STARTUP_DURATION_MS - elapsed);
    const deadline = performance.now() + remaining;
    const timeout = window.setTimeout(finish, motion?.matches ? 0 : remaining);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') finish();
    };
    const onMotion = () => {
      if (motion?.matches) finish();
    };
    const onReturn = () => {
      if (performance.now() >= deadline) finish();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('pageshow', onReturn);
    motion?.addEventListener?.('change', onMotion);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('pageshow', onReturn);
      motion?.removeEventListener?.('change', onMotion);
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div
      ref={overlay}
      className="moinpdf-startup"
      style={{ '--startup-duration': `${STARTUP_DURATION_MS}ms` } as CSSProperties}
      aria-hidden="true"
      onClick={(event) => {
        event.stopPropagation();
        setVisible(false);
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'moinpdf-startup-exit')
          setVisible(false);
      }}
    >
      <div className="moinpdf-startup-lockup">
        <div className="moinpdf-startup-illustration">
          <div className="moinpdf-startup-halo" />
          <StartupSailor />
        </div>
        <div className="moinpdf-startup-logo">
          <img
            src="/branding/moinpdf-logo.svg"
            alt=""
            width="680"
            height="225"
            className="startup-logo-light"
            fetchPriority="high"
          />
          <img
            src="/branding/moinpdf-logo-dark.svg"
            alt=""
            width="680"
            height="225"
            className="startup-logo-dark"
            fetchPriority="high"
          />
        </div>
      </div>
    </div>
  );
}
