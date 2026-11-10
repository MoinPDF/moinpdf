'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createStartupSound } from '../../lib/startup-sound';

export const STARTUP_DURATION_MS = 3750;

export function StartupAnimation() {
  const [visible, setVisible] = useState(true);
  const overlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const element = overlay.current;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    // CSS may already have started during server rendering. Never restart its clock.
    const animation = element
      ?.getAnimations?.()
      .find((entry) => 'animationName' in entry && entry.animationName === 'moinpdf-startup-exit');
    const elapsed = typeof animation?.currentTime === 'number' ? animation.currentTime : 0;
    const remaining = Math.max(0, STARTUP_DURATION_MS - elapsed);
    const deadline = performance.now() + remaining;
    const started = deadline - STARTUP_DURATION_MS;
    const audio = motion?.matches ? null : createStartupSound(() => performance.now() - started);
    audio?.enable();
    const finish = () => {
      audio?.dispose();
      setVisible(false);
    };
    const timeout = window.setTimeout(finish, motion?.matches ? 0 : remaining);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') finish();
    };
    const onMotion = () => {
      if (motion?.matches) finish();
    };
    const onReturn = () => {
      if (document.hidden || performance.now() >= deadline) finish();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('pageshow', onReturn);
    motion?.addEventListener?.('change', onMotion);
    return () => {
      audio?.dispose();
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
      onClick={(event) => {
        event.stopPropagation();
        setVisible(false);
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'moinpdf-startup-exit')
          setVisible(false);
      }}
    >
      <div className="moinpdf-startup-lockup" aria-hidden="true">
        <span className="startup-logo-aura" />
        <span className="startup-logo-ripple startup-logo-ripple-one" />
        <span className="startup-logo-ripple startup-logo-ripple-two" />
        <div className="moinpdf-startup-logo">
          <span className="startup-logo-outline" />
          <div className="startup-logo-reveal">
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
          <span className="startup-logo-shine" />
          <span className="startup-sparkle startup-sparkle-one" />
          <span className="startup-sparkle startup-sparkle-two" />
          <span className="startup-sparkle startup-sparkle-three" />
        </div>
        <svg className="startup-logo-wave" viewBox="0 0 720 180" fill="none">
          <path
            className="startup-wave-trail"
            pathLength="100"
            d="M18 113C110 156 178 32 291 91S458 156 543 90s124-40 159-17"
          />
          <path
            className="startup-wave-crest"
            pathLength="100"
            d="M18 113C110 156 178 32 291 91S458 156 543 90s124-40 159-17"
          />
        </svg>
        <span className="startup-light-sweep" />
        <span className="startup-spray startup-spray-one" />
        <span className="startup-spray startup-spray-two" />
        <span className="startup-spray startup-spray-three" />
        <span className="startup-spray startup-spray-four" />
      </div>
    </div>
  );
}
