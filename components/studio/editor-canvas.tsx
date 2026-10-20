'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useRef, useState, type PointerEvent, type CSSProperties } from 'react';
import { LoaderCircle, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analyzeEditorPage } from '@/lib/editor-analysis';
import {
  EditorInlineText,
  EditorInlineToolbar,
  editorTextCss,
  useEditorTypography,
  type EditorPatch,
} from './editor-typography';
import { renderPage, uid, type Source, type PageItem } from '@/lib/pdf-engine';
import { normalizedRect, type Mark, type Rect } from '@/lib/studio-engine';
import {
  fitRect,
  editorMarkSignature,
  editorMarkChanged,
  editorRemovalRects,
  editorParagraphs,
  editorRectsOverlap,
  editorTextCollision,
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
export function MarkContent({
  mark,
  width,
  height = (width * 841.89) / 595.28,
  source,
}: {
  mark: Mark;
  width: number;
  height?: number;
  source?: Source;
}) {
  useLanguage();
  const typography = useEditorTypography(mark, source);
  if (!editorMarkChanged(mark)) return null;
  if (mark.kind === 'text')
    return (
      <span
        className="editor-text-content"
        style={editorTextCss(mark, width, height, typography.resolution)}
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
export function MarkLayers({
  marks,
  width,
  height,
  source,
}: {
  marks: Mark[];
  width: number;
  height?: number;
  source?: Source;
}) {
  useLanguage();
  return (
    <>
      {marks
        .filter(editorMarkChanged)
        .flatMap((m) =>
          editorRemovalRects(m).map((rect, i) => (
            <div
              key={`erase-${m.id}-${i}`}
              className="editor-erasure"
              style={{ ...box(rect), background: m.fill || '#ffffff' }}
            />
          )),
        )}
      {[
        ...marks.filter((m) => m.kind !== 'redact'),
        ...marks.filter((m) => m.kind === 'redact'),
      ].map((m) => (
        <div key={m.id} className={`page-mark ${m.kind}`} style={box(m)}>
          <MarkContent mark={m} width={width} height={height} source={source} />
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
  autoOcr = false,
  language = 'deu+eng',
}: {
  source: Source;
  page: PageItem;
  marks: Mark[];
  crop?: Rect;
  action: EditorAction;
  selectedId: string;
  disabled: boolean;
  onMark: (mark: Mark) => void;
  onPatch: EditorPatch;
  onSelect: (id: string) => void;
  onDimensions: (dims: { width: number; height: number }) => void;
  autoOcr?: boolean;
  language?: string;
}) {
  useLanguage();
  const [url, setUrl] = useState(''),
    [dims, setDims] = useState({ width: 595.28, height: 841.89 }),
    [displayWidth, setDisplayWidth] = useState(595),
    [targets, setTargets] = useState<TextTarget[]>([]),
    [loadingText, setLoadingText] = useState(true),
    [error, setError] = useState('');
  const [detectionError, setDetectionError] = useState(''),
    [progress, setProgress] = useState({ percent: 0, label: 'Textstellen werden erkannt …' }),
    [uncertain, setUncertain] = useState(0),
    [retry, setRetry] = useState(0),
    [renderRetry, setRenderRetry] = useState(0),
    [paragraphMode, setParagraphMode] = useState(false);
  const recognition = useRef<AbortController | null>(null);
  const forceRecognition = useRef(false);
  const [background, setBackground] = useState({ key: '', url: '', failed: false });
  const [draft, setDraft] = useState<Rect | null>(null),
    [moving, setMoving] = useState<Mark | null>(null);
  const host = useRef<HTMLDivElement>(null),
    start = useRef<{ x: number; y: number } | null>(null),
    drag = useRef<{ mark: Mark; point: { x: number; y: number }; resize: boolean } | null>(null);
  const physicalRemovals = marks
    .filter(editorMarkChanged)
    .filter((m) => editorRemovalRects(m).length);
  const removalKey =
    autoOcr &&
    physicalRemovals.length &&
    physicalRemovals.every((m) => m.kind === 'text') &&
    targets.length &&
    !physicalRemovals.some((m) =>
      targets.some(
        (t) =>
          (t.origin === 'ocr' || t.invisible) &&
          editorRemovalRects(m).some((r) => editorRectsOverlap(t, r)),
      ),
    )
      ? JSON.stringify(
          physicalRemovals.map((m) => ({
            id: m.id,
            kind: m.kind,
            sourceRect: m.sourceRect,
            sourceRects: m.sourceRects,
          })),
        )
      : '';
  useEffect(() => {
    setBackground({ key: '', url: '', failed: false });
    if (!removalKey) return;
    const controller = new AbortController();
    let previewUrl = '';
    const timer = setTimeout(() => {
      void import('@/lib/editor-native')
        .then(({ renderEditorBackground }) =>
          renderEditorBackground(
            source,
            page,
            JSON.parse(removalKey) as Mark[],
            targets,
            controller.signal,
          ),
        )
        .then(async ({ canvas }) => {
          try {
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, 'image/png'),
            );
            if (!blob) throw new Error('Bild konnte nicht erstellt werden.');
            if (!controller.signal.aborted) {
              previewUrl = URL.createObjectURL(blob);
              setBackground({ key: removalKey, url: previewUrl, failed: false });
            }
          } finally {
            canvas.width = canvas.height = 0;
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setBackground({ key: removalKey, url: '', failed: true });
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [source, page, targets, removalKey]);
  useEffect(() => {
    let live = true,
      url = '';
    const cancel = new AbortController();
    setUrl('');
    setError('');
    renderPage(source, { index: page.index, rotation: page.rotation }, 1400, cancel.signal)
      .then(async ({ canvas, width, height }) => {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );
        canvas.width = canvas.height = 0;
        if (!blob) throw new Error('Bild konnte nicht erstellt werden.');
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
    return () => {
      live = false;
      cancel.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, page.index, page.rotation, onDimensions, renderRetry]);
  useEffect(() => {
    if (disabled) {
      setLoadingText(false);
      return;
    }
    const controller = new AbortController();
    recognition.current = controller;
    setTargets([]);
    setUncertain(0);
    setDetectionError('');
    setLoadingText(true);
    setProgress({ percent: 0, label: 'Textstellen werden erkannt …' });
    const forceOcr = forceRecognition.current;
    forceRecognition.current = false;
    const prepare = autoOcr
      ? analyzeEditorPage(source, page, {
          signal: controller.signal,
          language,
          forceOcr,
          report: (value) => {
            if (!controller.signal.aborted) setProgress(value);
          },
          onNative: (value) => {
            if (!controller.signal.aborted) setTargets(value.targets);
          },
        })
      : readTextTargets(source, page);
    void prepare
      .then((value) => {
        if (controller.signal.aborted) return;
        setTargets(value.targets);
        setUncertain(
          'uncertain' in value && typeof value.uncertain === 'number' ? value.uncertain : 0,
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setDetectionError(
            error instanceof Error
              ? error.message
              : 'Die Texterkennung konnte nicht gestartet werden.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingText(false);
      });
    return () => {
      controller.abort();
      if (recognition.current === controller) recognition.current = null;
    };
  }, [source, page, language, autoOcr, disabled, retry]);
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
            fontChoice: 'auto',
          },
    );
  }
  function pick(target: TextTarget) {
    if (disabled) return;
    if (target.unsupportedReason) {
      setDetectionError(target.unsupportedReason);
      return;
    }
    const { text, fontSize, family, x, y, w, h } = target;
    const r = { x, y, w, h };
    const rotation = (((Math.round((target.rotation || 0) / 90) * 90) % 360) + 360) % 360;
    const size = Math.max(0.1, fontSize);
    const fill = target.fill || '#ffffff';
    const brightness = [1, 3, 5].reduce(
      (sum, start, i) =>
        sum + parseInt(fill.slice(start, start + 2), 16) * [0.2126, 0.7152, 0.0722][i],
      0,
    );
    const next: Mark = {
      ...r,
      id: uid(),
      kind: 'text',
      text,
      sourceRect: { ...r },
      sourceIsScan: target.origin === 'ocr' || !!target.invisible,
      fill,
      color: target.color || (brightness < 110 ? '#ffffff' : '#222222'),
      textRotation: rotation,
      fontFamily: family,
      fontChoice: 'auto',
      bold: !!target.bold,
      italic: !!target.italic,
      originalFontId: target.originalFontId,
      originalFontName: target.fontName,
      originalFontPage: page.index,
      baselineScale: target.baselineScale,
      insetScale: target.insetScale,
      lineHeight: target.lineHeight,
      tracking: target.tracking,
      textScaleX: target.textScaleX,
      ...(target.fragments?.length
        ? { sourceRects: target.fragments.map(({ x, y, w, h }) => ({ x, y, w, h })) }
        : {}),
      fontScale: size / dims.width,
    };
    next.originalState = editorMarkSignature(next);
    onMark(next);
  }
  const displayed = marks.map((m) => (moving?.id === m.id ? moving : m)),
    removals = displayed.filter((m) => m.kind === 'erase' || m.sourceRect);
  const textTargets =
    paragraphMode && autoOcr ? editorParagraphs(targets, dims.width, dims.height) : targets;
  const selectedText = displayed.find((m) => m.id === selectedId && m.kind === 'text');
  const available = textTargets.filter(
    (t) =>
      !(t.fragments || [t]).some((part) =>
        removals.flatMap(editorRemovalRects).some((r) => editorRectsOverlap(part, r)),
      ),
  );
  return (
    <div className="editor-canvas-wrap">
      {(action === 'pick' || autoOcr) && (
        <div className="editor-preparation">
          <div className="editor-detection" role="status" aria-live="polite">
            {loadingText && (
              <>
                <LoaderCircle size={15} className="spin" /> {ui(progress.label)}{' '}
                {Math.round(progress.percent)}%<br />
              </>
            )}
            {available.length > 0
              ? ui(`${available.length} Textstellen · anklicken und bearbeiten`)
              : !loadingText &&
                ui(
                  'Kein lesbarer Text erkannt. Du kannst einen Bereich ersetzen oder neuen Text hinzufügen.',
                )}
            {uncertain > 0 && (
              <p className="editor-ocr-warning">
                {ui(
                  'Orange markierte Wörter wurden unsicher erkannt. Bitte vor der Übernahme am Original prüfen.',
                )}
              </p>
            )}
            {detectionError && <p role="alert">{ui(detectionError)}</p>}
          </div>
          {autoOcr && (
            <div className="editor-detection-actions">
              {loadingText ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    recognition.current?.abort();
                    setLoadingText(false);
                    setDetectionError(
                      'Texterkennung angehalten. Bereits erkannte Texte bleiben bearbeitbar.',
                    );
                  }}
                >
                  {ui('Erkennung anhalten')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    forceRecognition.current = true;
                    setRetry((n) => n + 1);
                  }}
                >
                  {ui('Text erneut erkennen')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {autoOcr && (
        <div className="editor-text-mode" role="group" aria-label={ui('Textauswahl')}>
          <Button
            size="sm"
            variant={paragraphMode ? 'secondary' : 'ghost'}
            aria-pressed={paragraphMode}
            onClick={() => setParagraphMode(true)}
          >
            {ui('Absätze')}
          </Button>
          <Button
            size="sm"
            variant={!paragraphMode ? 'secondary' : 'ghost'}
            aria-pressed={!paragraphMode}
            onClick={() => setParagraphMode(false)}
          >
            {ui('Einzelne Textstellen')}
          </Button>
          <span>{ui('Anklicken und direkt auf der Seite schreiben. Verschieben am Griff.')}</span>
          {paragraphMode && (
            <span>
              {ui(
                'Absätze bitte prüfen: Tabellenzellen und Spalten bei Bedarf einzeln bearbeiten.',
              )}
            </span>
          )}
        </div>
      )}
      {selectedText && autoOcr && (
        <EditorInlineToolbar
          mark={selectedText}
          source={source}
          width={dims.width}
          disabled={disabled}
          onPatch={onPatch}
          onDone={() => onSelect('')}
        />
      )}
      {selectedText && editorTextCollision(selectedText, displayed, targets) && (
        <p className="editor-layout-warning" role="alert">
          {ui(
            'Der Text überlappt einen anderen Inhalt. Bitte Text kürzen, Schriftgröße anpassen oder das Textfeld verschieben.',
          )}
        </p>
      )}
      {background.key === removalKey && background.failed && (
        <p className="editor-layout-warning" role="alert">
          {ui(
            'Die direkte Textentfernung konnte nicht bestätigt werden. Die Vorschau zeigt vorläufig eine Abdeckung; der Export prüft die Änderung erneut.',
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
            <img
              src={background.key === removalKey && background.url ? background.url : url}
              alt={ui(`${source.name}, Seite ${page.index + 1}`)}
              draggable={false}
            />
          ) : (
            <div className="canvas-loading">
              {error ? (
                <div>
                  {ui(error)}
                  <Button variant="outline" onClick={() => setRenderRetry((n) => n + 1)}>
                    {ui('Erneut versuchen')}
                  </Button>
                </div>
              ) : (
                <LoaderCircle className="spin" />
              )}
            </div>
          )}
          {removals
            .filter(() => !(background.key === removalKey && background.url))
            .filter(editorMarkChanged)
            .flatMap((m) =>
              editorRemovalRects(m).map((rect, i) => (
                <div
                  key={`erase-${m.id}-${i}`}
                  className="editor-erasure"
                  style={{ ...box(rect), background: m.fill || '#ffffff' }}
                />
              )),
            )}
          {url &&
            action === 'pick' &&
            available.map((t) => (
              <button
                className={`editor-text-target ${t.origin === 'ocr' && (t.confidence ?? 100) < 75 ? 'is-uncertain' : ''}`}
                key={t.id}
                style={box(t)}
                disabled={disabled}
                aria-label={ui(`Text bearbeiten: ${t.text}`)}
                title={
                  t.unsupportedReason
                    ? ui(t.unsupportedReason)
                    : t.origin === 'ocr'
                      ? `${t.text} · ${ui('Erkennungssicherheit')}: ${Math.round(t.confidence || 0)}%`
                      : t.text
                }
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
                touchAction: m.kind === 'text' ? 'pan-y' : 'none',
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
              onPointerDown={(e) => {
                if (m.kind === 'text') {
                  e.stopPropagation();
                  onSelect(m.id);
                } else begin(e, m);
              }}
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
              {selectedId === m.id && m.kind === 'text' && autoOcr ? (
                <EditorInlineText
                  mark={m}
                  source={source}
                  width={displayWidth}
                  height={(displayWidth * dims.height) / dims.width}
                  pageWidth={dims.width}
                  pageHeight={dims.height}
                  disabled={disabled}
                  onPatch={onPatch}
                  onDone={() => onSelect('')}
                />
              ) : (
                <MarkContent
                  mark={m}
                  width={displayWidth}
                  height={(displayWidth * dims.height) / dims.width}
                  source={source}
                />
              )}
              {selectedId === m.id && m.kind === 'text' && (
                <button
                  type="button"
                  className="editor-move-handle"
                  aria-label={ui('Textfeld verschieben')}
                  title={ui('Textfeld verschieben')}
                  onPointerDown={(e) => begin(e, m)}
                  disabled={disabled}
                >
                  <Move size={16} />
                </button>
              )}
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
