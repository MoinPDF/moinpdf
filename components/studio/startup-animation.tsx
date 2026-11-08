'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createStartupSound, type StartupSound } from '../../lib/startup-sound';

export const STARTUP_DURATION_MS = 3000;

/** Photographic poses derived from the original sailor in the kettenzug header. */
export function StartupSailor() {
  return (
    <div className="startup-sailor" aria-hidden="true">
      <img
        className="startup-sailor-atlas"
        src="/branding/startup-sailor-tear-16.webp"
        width="1254"
        height="1254"
        alt=""
        fetchPriority="high"
        decoding="sync"
        draggable={false}
      />
      <img
        className="startup-sailor-atlas startup-sailor-blend"
        src="/branding/startup-sailor-tear-16.webp"
        width="1254"
        height="1254"
        alt=""
        decoding="sync"
        draggable={false}
      />
    </div>
  );
}

export function StartupAnimation({ language = 'de' }: { language?: 'de' | 'en' }) {
  const [visible, setVisible] = useState(true);
  const [soundActive, setSoundActive] = useState(false);
  const [soundAvailable, setSoundAvailable] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);
  const sound = useRef<StartupSound | null>(null);

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
    const audio = motion?.matches
      ? null
      : createStartupSound(() => performance.now() - started, setSoundActive);
    sound.current = audio;
    setSoundAvailable(Boolean(audio));
    let playSound = true;
    try {
      playSound = window.localStorage.getItem('moinpdf-startup-sound') !== 'off';
    } catch {
      /* Optional preference. */
    }
    if (audio && playSound) audio.enable();
    const finish = () => {
      audio?.dispose();
      sound.current = null;
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
      sound.current = null;
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
          <span className="startup-logo-shine" />
          <span className="startup-sparkle startup-sparkle-one" />
          <span className="startup-sparkle startup-sparkle-two" />
          <span className="startup-sparkle startup-sparkle-three" />
        </div>
      </div>
      {soundAvailable && (
        <button
          type="button"
          className="moinpdf-startup-sound"
          aria-pressed={soundActive}
          aria-label={
            language === 'en'
              ? soundActive
                ? 'Mute startup sound'
                : 'Enable startup sound'
              : soundActive
                ? 'Startton ausschalten'
                : 'Startton einschalten'
          }
          onClick={(event) => {
            event.stopPropagation();
            if (soundActive) sound.current?.mute();
            else sound.current?.enable();
            try {
              window.localStorage.setItem('moinpdf-startup-sound', soundActive ? 'off' : 'on');
            } catch {
              /* Optional preference. */
            }
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4 6 8H3v8h3l5 4Z" />
            {soundActive ? (
              <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
            ) : (
              <path d="m16 9 5 6m0-6-5 6" />
            )}
          </svg>
          <span>{language === 'en' ? 'Sound' : 'Ton'}</span>
        </button>
      )}
    </div>
  );
}
