'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { LoaderCircle, PenLine, Trash2, Undo2 } from 'lucide-react';
import { MarkLayers } from './editor-canvas';
import { Button } from '@/components/ui/button';
import { renderPage, uid, type Source, type PageItem } from '@/lib/pdf-engine';
import { normalizedRect, type Mark, type Rect } from '@/lib/studio-engine';

export type Signature = { image: string; aspect: number };
export type EditMode = 'redact' | 'crop' | 'text' | 'highlight' | 'signature' | null;
let queue = Promise.resolve();
export function PagePreview({
  source,
  page,
  small = false,
}: {
  source: Source;
  page: PageItem;
  small?: boolean;
}) {
  const [image, setImage] = useState(''),
    [error, setError] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true,
      url = '';
    const cancel = new AbortController();
    setImage('');
    setError(false);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        queue = queue
          .catch(() => {})
          .then(async () => {
            if (!active) return;
            try {
              const { canvas } = await renderPage(source, page, small ? 270 : 1200, cancel.signal);
              const blob = await new Promise<Blob | null>((r) =>
                canvas.toBlob(r, 'image/jpeg', 0.88),
              );
              canvas.width = canvas.height = 0;
              if (active && blob) {
                url = URL.createObjectURL(blob);
                setImage(url);
              }
            } catch {
              if (active) setError(true);
            }
          });
      },
      { rootMargin: '100px' },
    );
    if (holder.current) observer.observe(holder.current);
    return () => {
      active = false;
      cancel.abort();
      observer.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, page.id, page.rotation, small]);
  return (
    <div ref={holder} className={`page-preview ${small ? 'small' : ''}`}>
      {image ? (
        <img
          src={image}
          alt={`${source.name}, Originalseite ${page.index + 1}`}
          draggable={false}
        />
      ) : error ? (
        <span>Vorschau nicht verfügbar</span>
      ) : (
        <LoaderCircle className="spin" size={21} />
      )}
    </div>
  );
}
export function PageCanvas({
  source,
  page,
  marks,
  crop,
  mode,
  noteText,
  fontSize,
  signature,
  onMark,
  onCrop,
  disabled,
}: {
  source: Source;
  page: PageItem;
  marks: Mark[];
  crop?: Rect;
  mode: EditMode;
  noteText: string;
  fontSize: number;
  signature: Signature | null;
  onMark: (mark: Mark) => void;
  onCrop: (rect: Rect) => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState(''),
    [dims, setDims] = useState({ width: 595.28, height: 841.89 }),
    [draft, setDraft] = useState<Rect | null>(null),
    [error, setError] = useState(false),
    [displayWidth, setDisplayWidth] = useState(595);
  const start = useRef<{ x: number; y: number } | null>(null),
    host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true,
      objectUrl = '';
    const ctrl = new AbortController();
    setUrl('');
    setError(false);
    renderPage(source, page, 1600, ctrl.signal)
      .then(async ({ canvas, width, height }) => {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
        canvas.width = canvas.height = 0;
        if (active && blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
          setDims({ width, height });
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, page.id, page.rotation]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setDisplayWidth(entries[0].contentRect.width);
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    start.current = null;
    setDraft(null);
  }, [page.id, mode]);
  function position(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (!mode || disabled || !url) return;
    event.preventDefault();
    const p = position(event);
    if (mode === 'text') {
      if (!noteText.trim()) return;
      const h = Math.min(0.22, 1 - p.y);
      onMark({
        id: uid(),
        kind: 'text',
        x: p.x,
        y: p.y,
        w: Math.min(0.48, 1 - p.x),
        h,
        text: noteText,
        fontScale: fontSize / dims.width,
      });
      return;
    }
    if (mode === 'signature') {
      if (!signature) return;
      const w = Math.min(0.35, 1 - p.x),
        h = (w * (dims.width / dims.height)) / signature.aspect;
      onMark({
        id: uid(),
        kind: 'signature',
        x: p.x,
        y: Math.min(p.y, 1 - h),
        w,
        h,
        image: signature.image,
      });
      return;
    }
    start.current = p;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ ...p, w: 0, h: 0 });
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (start.current) setDraft(normalizedRect(start.current, position(event)));
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const rect = normalizedRect(start.current, position(event));
    start.current = null;
    setDraft(null);
    if (rect.w < 0.005 || rect.h < 0.005) return;
    if (mode === 'crop') onCrop(rect);
    else if (mode === 'redact' || mode === 'highlight') onMark({ ...rect, id: uid(), kind: mode });
  }
  return (
    <div className="canvas-holder">
      <div
        ref={host}
        className={`document-sheet ${mode ? 'editable' : ''}`}
        style={{ aspectRatio: `${dims.width}/${dims.height}`, touchAction: mode ? 'none' : 'auto' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          start.current = null;
          setDraft(null);
        }}
        aria-label="Dokumentfläche"
        role="region"
      >
        {url ? (
          <img src={url} alt={`${source.name}, Seite ${page.index + 1}`} draggable={false} />
        ) : (
          <div className="canvas-loading">
            {error ? 'Vorschau nicht verfügbar' : <LoaderCircle className="spin" />}
          </div>
        )}
        <MarkLayers marks={marks} width={displayWidth} />
        {crop && (
          <div
            className="crop-selection"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.w * 100}%`,
              height: `${crop.h * 100}%`,
            }}
          >
            <span>AUSSCHNITT</span>
          </div>
        )}
        {draft && (
          <div
            className={`draw-selection ${mode}`}
            style={{
              left: `${draft.x * 100}%`,
              top: `${draft.y * 100}%`,
              width: `${draft.w * 100}%`,
              height: `${draft.h * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}
export function SignaturePad({ onSave }: { onSave: (signature: Signature) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false),
    [hasInk, setHasInk] = useState(false);
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * e.currentTarget.width) / r.width,
      y: ((e.clientY - r.top) * e.currentTarget.height) / r.height,
    };
  }
  function clear() {
    canvas.current?.getContext('2d')?.clearRect(0, 0, 700, 240);
    setHasInk(false);
  }
  function save() {
    const c = canvas.current!,
      ctx = c.getContext('2d')!,
      d = ctx.getImageData(0, 0, c.width, c.height);
    let minX = c.width,
      minY = c.height,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d.data[(y * c.width + x) * 4 + 3] > 5) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
    if (minX > maxX) return;
    const out = document.createElement('canvas');
    out.width = maxX - minX + 15;
    out.height = maxY - minY + 15;
    out
      .getContext('2d')!
      .drawImage(
        c,
        minX,
        minY,
        maxX - minX + 1,
        maxY - minY + 1,
        7,
        7,
        maxX - minX + 1,
        maxY - minY + 1,
      );
    onSave({ image: out.toDataURL('image/png'), aspect: out.width / out.height });
  }
  return (
    <div className="signature-pad">
      <div className="signature-paper">
        <canvas
          ref={canvas}
          width={700}
          height={240}
          aria-label="Unterschrift mit Maus oder Finger zeichnen"
          onPointerDown={(e) => {
            const p = point(e),
              ctx = e.currentTarget.getContext('2d')!;
            ctx.strokeStyle = '#211f2a';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setHasInk(true);
          }}
          onPointerMove={(e) => {
            if (drawing.current) {
              const p = point(e),
                ctx = e.currentTarget.getContext('2d')!;
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
            }
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
          onPointerCancel={() => {
            drawing.current = false;
          }}
        />
        {!hasInk && <span>Hier unterschreiben</span>}
      </div>
      <div className="signature-actions">
        <Button variant="ghost" onClick={clear}>
          <Trash2 size={16} />
          Leeren
        </Button>
        <Button onClick={save} disabled={!hasInk}>
          <PenLine size={16} />
          Unterschrift übernehmen
        </Button>
      </div>
      <p>
        Die Unterschrift wird als Bild eingefügt. Es wird keine digitale Zertifikatssignatur
        erstellt.
      </p>
    </div>
  );
}
