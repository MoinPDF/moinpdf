'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';

export const STARTUP_DURATION_MS = 2750;

/** A small vector rig keeps the hands and torn paper moving as one object. */
export function StartupSailor() {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;
  return (
    <svg className="startup-sailor" viewBox="0 0 400 350" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={`${id}-coat`}
          x1="120"
          y1="190"
          x2="280"
          y2="330"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffe16c" />
          <stop offset="1" stopColor="#edae26" />
        </linearGradient>
        <linearGradient
          id={`${id}-skin`}
          x1="170"
          y1="110"
          x2="220"
          y2="190"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#f9d5af" />
          <stop offset="1" stopColor="#e9ac7d" />
        </linearGradient>
        <linearGradient
          id={`${id}-beard`}
          x1="170"
          y1="145"
          x2="220"
          y2="232"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fffdf4" />
          <stop offset="0.65" stopColor="#eae7db" />
          <stop offset="1" stopColor="#b9c7bf" />
        </linearGradient>
        <linearGradient
          id={`${id}-hat`}
          x1="154"
          y1="55"
          x2="247"
          y2="117"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#24515a" />
          <stop offset="1" stopColor="#102e37" />
        </linearGradient>
        <linearGradient
          id={`${id}-paper`}
          x1="200"
          y1="225"
          x2="200"
          y2="326"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fffef9" />
          <stop offset="1" stopColor="#eaf1eb" />
        </linearGradient>
      </defs>

      <ellipse
        className="startup-ground"
        cx="200"
        cy="334"
        rx="105"
        ry="9"
        fill="#123b36"
        opacity="0.1"
      />
      <g
        className="startup-sailor-body"
        stroke="#173f48"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path
          d="M119 219Q132 195 166 192H234Q269 198 281 220L295 310Q252 329 200 328Q147 329 105 310Z"
          fill={paint('coat')}
        />
        <path d="M170 202H230L241 322H159Z" fill="#faf7e8" strokeWidth="2" />
        <path
          d="M167 233H233M165 252H235M163 271H237M161 290H239M160 310H240"
          stroke="#2d6c70"
          strokeWidth="9"
        />
        <path
          d="M157 198L139 222L163 236L151 252L172 320M243 198L261 222L237 236L249 252L228 320"
          fill={paint('coat')}
        />
        <path d="M124 264L116 301M276 264L284 301" stroke="#c78c21" strokeWidth="2" />
        <circle cx="153" cy="273" r="3" fill="#173f48" stroke="none" />
        <circle cx="247" cy="273" r="3" fill="#173f48" stroke="none" />
      </g>

      <g
        className="startup-sailor-head"
        stroke="#173f48"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path
          d="M151 123Q137 115 138 135Q138 153 153 153M249 123Q263 115 262 135Q262 153 247 153"
          fill={paint('skin')}
        />
        <path d="M145 130L151 139M255 130L249 139" stroke="#b87754" strokeWidth="2" />
        <path
          d="M150 105Q153 72 200 72Q247 72 250 105L248 158Q239 191 200 194Q161 191 152 158Z"
          fill={paint('skin')}
        />
        <path
          d="M152 120Q149 135 155 145L164 137L162 113M248 120Q251 135 245 145L236 137L238 113"
          fill="#e9e6dc"
        />
        <path
          d="M152 147Q146 159 152 181L143 177Q147 193 163 200L159 204Q171 223 191 226L200 239L210 227Q234 221 242 205L238 200Q255 191 257 177L248 181Q254 158 248 147Q236 152 225 149L200 161L175 149Q164 152 152 147Z"
          fill={paint('beard')}
        />
        <path
          d="M163 179Q165 198 178 207M173 184Q178 207 189 215M237 179Q235 198 223 207M226 188Q221 207 211 216M195 189L199 218M205 190L204 214"
          stroke="#adbeb6"
          strokeWidth="2"
        />
        <path
          d="M177 168Q200 183 223 168Q217 192 200 192Q183 192 177 168Z"
          fill="#855342"
          strokeWidth="2"
        />
        <path d="M186 178Q201 184 215 177" stroke="#f0bc93" strokeWidth="3" />
        <path
          d="M168 127Q178 120 188 125M212 125Q223 120 232 127"
          stroke="#f8f4e8"
          strokeWidth="7"
        />
        <g className="startup-sailor-eyes">
          <path d="M170 137Q179 132 188 137M212 137Q221 132 230 137" strokeWidth="2" />
          <ellipse cx="181" cy="138" rx="3.1" ry="4" fill="#173f48" stroke="none" />
          <ellipse cx="219" cy="138" rx="3.1" ry="4" fill="#173f48" stroke="none" />
          <circle cx="182" cy="136" r="1" fill="white" stroke="none" />
          <circle cx="220" cy="136" r="1" fill="white" stroke="none" />
        </g>
        <path
          d="M199 136Q190 147 192 153Q200 158 208 153"
          fill={paint('skin')}
          stroke="#bd805a"
          strokeWidth="1.8"
        />
        <path
          d="M199 158Q187 146 175 157Q168 164 158 162Q167 177 183 175Q194 175 200 165Q206 175 217 175Q233 177 242 162Q232 164 225 157Q213 146 201 158Z"
          fill="#fff9e9"
          strokeWidth="2"
        />
        <path
          d="M178 160Q186 156 193 162M207 162Q215 156 222 160"
          stroke="#b5c1b4"
          strokeWidth="1.5"
        />
        <path
          d="M152 103Q148 82 167 62Q177 48 200 49Q224 48 236 62Q251 78 248 103Z"
          fill={paint('hat')}
        />
        <path
          d="M168 85Q166 67 181 57M181 88Q179 63 191 53M195 88L196 54M210 88Q214 65 208 54M224 89Q231 72 222 60M237 89Q240 79 235 69"
          stroke="#37626a"
          strokeWidth="2"
        />
        <path d="M148 94Q200 82 252 94L253 116Q200 105 147 116Z" fill="#20434c" />
        <path
          d="M157 99V109M167 97V107M177 96V106M187 94V104M197 94V104M207 94V104M217 95V105M227 96V106M237 98V108M246 100V110"
          stroke="#44666a"
          strokeWidth="2"
        />
        <path d="M213 99L231 101L230 111L212 109Z" fill="#e0c773" strokeWidth="1.5" />
        <path d="M220 101V107M217 104Q216 110 224 107" stroke="#24464d" strokeWidth="1.2" />
      </g>

      <g
        className="startup-grip startup-grip-left"
        stroke="#173f48"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path
          d="M127 221Q112 215 101 233L88 264Q84 280 101 285L142 278L150 252L118 254L132 237"
          fill={paint('coat')}
        />
        <path d="M130 252L141 278L155 273L147 249Z" fill="#e8ab29" />
        <path
          d="M143 239Q143 232 151 234L165 245L161 271L148 271Q139 267 140 260Z"
          fill={paint('skin')}
        />
        <path
          d="M151 220H200L196 229L204 240L197 251L204 263L195 276L202 288L195 302L201 314L198 326H151Q145 326 145 320V226Q145 220 151 220Z"
          fill={paint('paper')}
          stroke="none"
        />
        <path
          d="M159 238H186M159 247H184M159 260H189M159 269H181M159 282H187"
          stroke="#c0d8cb"
          strokeWidth="3.5"
        />
        <path
          d="M143 246Q146 242 151 246L160 255Q163 261 158 264Q154 266 150 261L143 257"
          fill={paint('skin')}
        />
        <path d="M140 262L147 265M141 268L149 271" stroke="#bb8058" strokeWidth="1.6" />
      </g>
      <g
        className="startup-grip startup-grip-right"
        stroke="#173f48"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path
          d="M273 221Q288 215 299 233L312 264Q316 280 299 285L258 278L250 252L282 254L268 237"
          fill={paint('coat')}
        />
        <path d="M270 252L259 278L245 273L253 249Z" fill="#e8ab29" />
        <path
          d="M257 239Q257 232 249 234L235 245L239 271L252 271Q261 267 260 260Z"
          fill={paint('skin')}
        />
        <path
          d="M200 220H249Q255 220 255 226V320Q255 326 249 326H198L201 314L195 302L202 288L195 276L204 263L197 251L204 240L196 229Z"
          fill={paint('paper')}
          stroke="none"
        />
        <path
          d="M213 238H241M214 247H241M211 260H241M215 269H241M212 282H233"
          stroke="#c0d8cb"
          strokeWidth="3.5"
        />
        <path
          d="M257 246Q254 242 249 246L240 255Q237 261 242 264Q246 266 250 261L257 257"
          fill={paint('skin')}
        />
        <path d="M260 262L253 265M259 268L251 271" stroke="#bb8058" strokeWidth="1.6" />
      </g>
      <g className="startup-paper-fibres" stroke="#fffdf5" strokeWidth="2" strokeLinecap="round">
        <path d="M197 302L201 295M203 311L208 305M195 315L191 309M201 323L205 320" />
      </g>
      <g className="startup-tear-lines" stroke="#529183" strokeWidth="2.5" strokeLinecap="round">
        <path d="M190 209L183 198M200 205V193M210 209L217 198" />
      </g>
    </svg>
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
