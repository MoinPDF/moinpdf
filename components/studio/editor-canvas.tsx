'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useRef, useState, type PointerEvent, type CSSProperties } from 'react';
import { LoaderCircle } from 'lucide-react';
import { renderPage, uid, type Source, type PageItem } from '@/lib/pdf-engine';
import { normalizedRect, type Mark, type Rect } from '@/lib/studio-engine';
import {
  cssFont,
  fitRect,
  readTextTargets,
  type EditorAction,
  type TextTarget,
} from '@/lib/editor-model';

const box = (r: Rect): CSSProperties => ({
  left: `${r.x * 100}%`,
  top: `${r.y * 100}%`,
  width: `${r.w * 100}%`,
  height: `${r.h * 100}%`,
});
export function MarkContent({ mark, width }: { mark: Mark; width: number }) {
  useLanguage();
  if (mark.kind === 'text')
    return (
      <span
        className="editor-text-content"
        style={{
          fontSize: `${(mark.fontScale || 0.028) * width}px`,
          fontFamily: cssFont(mark.fontFamily),
          fontWeight: mark.bold ? 700 : 400,
          fontStyle: mark.italic ? 'italic' : 'normal',
          textAlign: mark.align || 'left',
          color: mark.color || '#222222',
        }}
      >
        {mark.text}
      </span>
    );
  if (mark.kind === 'image' || mark.kind === 'signature')
    return (
      <img
        className="editor-image-content"
        src={mark.image}
        alt={mark.kind === 'signature' ? ui('Unterschrift') : ui('Eingefügtes Bild')}
        draggable={false}
        style={{ opacity: mark.opacity ?? 1 }}
      />
    );
  return null;
}
export function MarkLayers({ marks, width }: { marks: Mark[]; width: number }) {
  useLanguage();
  return (
    <>
      {marks
        .filter((m) => m.kind === 'erase' || m.sourceRect)
        .map((m) => (
          <div
            key={`erase-${m.id}`}
            className="editor-erasure"
            style={{ ...box(m.sourceRect || m), background: m.fill || '#ffffff' }}
          />
        ))}
      {[
        ...marks.filter((m) => m.kind !== 'redact'),
        ...marks.filter((m) => m.kind === 'redact'),
      ].map((m) => (
        <div key={m.id} className={`page-mark ${m.kind}`} style={box(m)}>
          <MarkContent mark={m} width={width} />
        </div>
      ))}
    </>
  );
}
export function EditorCanvas({
  source,
  page,
  marks,
  crop,
  action,
  selectedId,
  disabled,
  onMark,
  onPatch,
  onSelect,
  onDimensions,
}: {
  source: Source;
  page: PageItem;
  marks: Mark[];
  crop?: Rect;
  action: EditorAction;
  selectedId: string;
  disabled: boolean;
  onMark: (mark: Mark) => void;
  onPatch: (id: string, patch: Partial<Mark>) => void;
  onSelect: (id: string) => void;
  onDimensions: (dims: { width: number; height: number }) => void;
}) {
  useLanguage();
  const [url, setUrl] = useState(''),
    [dims, setDims] = useState({ width: 595.28, height: 841.89 }),
    [displayWidth, setDisplayWidth] = useState(595),
    [targets, setTargets] = useState<TextTarget[]>([]),
    [loadingText, setLoadingText] = useState(true),
    [error, setError] = useState('');
  const [draft, setDraft] = useState<Rect | null>(null),
    [moving, setMoving] = useState<Mark | null>(null);
  const host = useRef<HTMLDivElement>(null),
    start = useRef<{ x: number; y: number } | null>(null),
    drag = useRef<{ mark: Mark; point: { x: number; y: number }; resize: boolean } | null>(null);
  useEffect(() => {
    let live = true,
      url = '';
    const cancel = new AbortController();
    setUrl('');
    setTargets([]);
    setLoadingText(true);
    setError('');
    renderPage(source, { index: page.index, rotation: page.rotation }, 1800, cancel.signal)
      .then(async ({ canvas, width, height }) => {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );
        canvas.width = canvas.height = 0;
        if (live && blob) {
          url = URL.createObjectURL(blob);
          setUrl(url);
          setDims({ width, height });
          onDimensions({ width, height });
        }
      })
      .catch(() => {
        if (live) setError('Diese Seite konnte nicht angezeigt werden.');
      });
    readTextTargets(source, { index: page.index, rotation: page.rotation })
      .then((value) => {
        if (live) setTargets(value.targets);
      })
      .catch(() => {
        if (live) setTargets([]);
      })
      .finally(() => {
        if (live) setLoadingText(false);
      });
    return () => {
      live = false;
      cancel.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, page.index, page.rotation, onDimensions]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setDisplayWidth(entries[0].contentRect.width);
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    start.current = null;
    drag.current = null;
    setDraft(null);
    setMoving(null);
  }, [page.id, action]);
  const position = (event: { clientX: number; clientY: number }) => {
    const b = host.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - b.left) / b.width)),
      y: Math.max(0, Math.min(1, (event.clientY - b.top) / b.height)),
    };
  };
  function down(e: PointerEvent<HTMLDivElement>) {
    if (disabled || !url || e.button !== 0) return;
    const p = position(e);
    onSelect('');
    if (action !== 'replace-area' && action !== 'erase') return;
    e.preventDefault();
    start.current = p;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({ ...p, w: 0, h: 0 });
  }
  function begin(e: PointerEvent<HTMLElement>, mark: Mark, resize = false) {
    if (disabled || !url) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(mark.id);
    drag.current = { mark, point: position(e), resize };
    host.current!.setPointerCapture(e.pointerId);
  }
  function transform(p: { x: number; y: number }) {
    const d = drag.current!;
    let r: Rect;
    if (d.resize) {
      r = { ...d.mark, w: Math.max(0.02, p.x - d.mark.x), h: Math.max(0.015, p.y - d.mark.y) };
      if (d.mark.kind === 'image' || d.mark.kind === 'signature') {
        r.w = Math.min(1 - r.x, r.w, ((1 - r.y) * d.mark.w) / d.mark.h);
        r.h = (r.w * d.mark.h) / d.mark.w;
      }
    } else
      r = {
        ...d.mark,
        x: Math.max(0, Math.min(1 - d.mark.w, d.mark.x + p.x - d.point.x)),
        y: Math.max(0, Math.min(1 - d.mark.h, d.mark.y + p.y - d.point.y)),
      };
    return { ...d.mark, ...fitRect(r) };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (drag.current) {
      setMoving(transform(position(e)));
      return;
    }
    if (start.current) setDraft(normalizedRect(start.current, position(e)));
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (drag.current) {
      const m = transform(position(e));
      drag.current = null;
      setMoving(null);
      onPatch(m.id, m);
      return;
    }
    if (!start.current) return;
    const r = normalizedRect(start.current, position(e));
    start.current = null;
    setDraft(null);
    if (r.w < 0.008 || r.h < 0.008) return;
    onMark(
      action === 'erase'
        ? { ...r, id: uid(), kind: 'erase', fill: '#ffffff' }
        : {
            ...r,
            id: uid(),
            kind: 'text',
            text: '',
            sourceRect: { ...r },
            fill: '#ffffff',
            fontScale: 12 / dims.width,
            fontFamily: 'sans',
          },
    );
  }
  function pick(target: TextTarget) {
    if (disabled) return;
    const { text, fontSize, family, x, y, w, h } = target;
    const r = { x, y, w, h };
    onMark({
      ...r,
      id: uid(),
      kind: 'text',
      text,
      sourceRect: { ...r },
      fill: '#ffffff',
      fontFamily: family,
      fontScale: Math.max(6, Math.min(72, fontSize)) / dims.width,
      w: Math.min(1 - r.x, Math.max(r.w, 0.16)),
      h: Math.min(1 - r.y, Math.max(r.h, (fontSize * 1.65) / dims.height)),
    });
  }
  const displayed = marks.map((m) => (moving?.id === m.id ? moving : m)),
    removals = displayed.filter((m) => m.kind === 'erase' || m.sourceRect);
  const available = targets.filter(
    (t) =>
      !removals.some((m) => {
        const r = m.sourceRect || m;
        return (
          t.x + t.w / 2 >= r.x &&
          t.x + t.w / 2 <= r.x + r.w &&
          t.y + t.h / 2 >= r.y &&
          t.y + t.h / 2 <= r.y + r.h
        );
      }),
  );
  return (
    <div className="editor-canvas-wrap">
      {action === 'pick' && (
        <p className="editor-detection" aria-live="polite">
          {loadingText
            ? ui('Textstellen werden erkannt …')
            : available.length
              ? ui(`${available.length} Textstellen · anklicken und bearbeiten`)
              : ui(
                  'Keine weiteren geraden Textstellen erkannt. Bei Scans oder gedrehter Schrift „Bereich ersetzen“ verwenden.',
                )}
        </p>
      )}
      <div className="canvas-holder">
        <div
          ref={host}
          className="document-sheet editor-sheet"
          style={{
            aspectRatio: `${dims.width}/${dims.height}`,
            touchAction: action === 'erase' || action === 'replace-area' ? 'none' : 'pan-y',
          }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            start.current = null;
            drag.current = null;
            setDraft(null);
            setMoving(null);
          }}
          aria-label={ui('PDF-Bearbeitungsfläche')}
          role="region"
        >
          {url ? (
            <img src={url} alt={ui(`${source.name}, Seite ${page.index + 1}`)} draggable={false} />
          ) : (
            <div className="canvas-loading">{error || <LoaderCircle className="spin" />}</div>
          )}
          {removals.map((m) => (
            <div
              key={`erase-${m.id}`}
              className="editor-erasure"
              style={{ ...box(m.sourceRect || m), background: m.fill || '#ffffff' }}
            />
          ))}
          {url &&
            action === 'pick' &&
            available.map((t) => (
              <button
                className="editor-text-target"
                key={t.id}
                style={box(t)}
                disabled={disabled}
                aria-label={ui(`Text bearbeiten: ${t.text}`)}
                title={t.text}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => pick(t)}
              />
            ))}
          {[
            ...displayed.filter((m) => m.kind !== 'redact'),
            ...displayed.filter((m) => m.kind === 'redact'),
          ].map((m) => (
            <div
              key={m.id}
              className={`page-mark editor-object ${m.kind} ${selectedId === m.id ? 'is-selected' : ''}`}
              style={{
                ...box(m),
                touchAction: 'none',
                background: m.kind === 'erase' ? m.fill || '#ffffff' : undefined,
              }}
              tabIndex={disabled ? -1 : 0}
              role="button"
              aria-label={ui(
                `${m.kind === 'text' ? 'Textfeld' : m.kind === 'erase' ? 'Entfernter Bereich' : m.kind === 'image' ? 'Bild' : 'Markierung'} auswählen${m.kind === 'text' && m.text ? `: ${m.text.slice(0, 60)}` : ''}`,
              )}
              aria-pressed={selectedId === m.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(m.id);
              }}
              onPointerDown={(e) => begin(e, m)}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(m.id);
                }
                const shifts: Record<string, [number, number]> = {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                };
                const s = shifts[e.key];
                if (s) {
                  e.preventDefault();
                  const step = e.shiftKey ? 10 : 1;
                  onPatch(
                    m.id,
                    fitRect({
                      ...m,
                      x: Math.min(1 - m.w, m.x + (s[0] * step) / dims.width),
                      y: Math.min(1 - m.h, m.y + (s[1] * step) / dims.height),
                    }),
                  );
                }
              }}
            >
              <MarkContent mark={m} width={displayWidth} />
              {selectedId === m.id && (
                <span
                  className="editor-resize"
                  title={ui('Größe ändern')}
                  onPointerDown={(e) => begin(e, m, true)}
                />
              )}
            </div>
          ))}
          {crop && (
            <div className="crop-selection" style={box(crop)}>
              <span>{ui('AUSSCHNITT')}</span>
            </div>
          )}
          {draft && <div className="editor-area-draft" style={box(draft)} />}
        </div>
      </div>
    </div>
  );
}
