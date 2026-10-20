'use client';
import { EditorLayoutHelp, EditorOriginalSnippet } from './editor-layout-help';
import { EditorOcrReview } from './editor-ocr-review';
import { EditorTextSearch } from './editor-text-search';
import { flushSync } from 'react-dom';
import { editorSegments, type EditorSelection } from '@/lib/editor-rich-text';
import type { EditorStartPoint } from './editor-rich-input';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type CSSProperties,
} from 'react';
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
        {editorSegments(mark).map((run, i) => (
          <span
            key={i}
            style={{
              fontWeight: run.style.bold ? 700 : 400,
              fontStyle: run.style.italic ? 'italic' : 'normal',
              color: run.style.color,
              fontSize: (run.style.fontScale || mark.fontScale || 0.028) * width,
              fontFamily: typography.runs?.[i]
                ? `"${typography.runs[i].resolution.font.cssFamily}"`
                : undefined,
            }}
          >
            {(mark.text || '').slice(run.start, run.end)}
          </span>
        ))}
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
  onTextSelection,
  autoOcr = false,
  language = 'deu+eng',
  zoom = 100,
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
  onTextSelection?: (selection: EditorSelection) => void;
  onDimensions: (dims: { width: number; height: number }) => void;
  autoOcr?: boolean;
  language?: string;
  zoom?: number;
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
  const [initialPoint, setInitialPoint] = useState<EditorStartPoint | null>(null);
  const [textSelection, setTextSelection] = useState<EditorSelection | null>(null);
  const [selectionRequest, setSelectionRequest] = useState<EditorSelection | null>(null);
  const [searchId, setSearchId] = useState('');
  const [searchRequest, setSearchRequest] = useState(0);
  const openSearch = (id: string) => {
    setSearchId(id);
    setSearchRequest((n) => n + 1);
  };
  const pageScroll = useRef<HTMLDivElement>(null),
    previousZoom = useRef(zoom);
  const previewSide = Math.min(
    3200,
    Math.max(
      1400,
      Math.ceil(
        (displayWidth *
          Math.max(1, dims.height / dims.width) *
          (typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2))) /
          700,
      ) * 700,
    ),
  );
  useLayoutEffect(() => {
    const element = pageScroll.current,
      ratio = zoom / previousZoom.current;
    previousZoom.current = zoom;
    if (element && ratio !== 1) {
      element.scrollLeft =
        (element.scrollLeft + element.clientWidth / 2) * ratio - element.clientWidth / 2;
      element.scrollTop =
        (element.scrollTop + element.clientHeight / 2) * ratio - element.clientHeight / 2;
    }
  }, [zoom]);
  const selectionChanged = (selection: EditorSelection) => {
    onTextSelection?.(selection);
    setTextSelection((old) =>
      old?.id === selection.id && old.start === selection.start && old.end === selection.end
        ? old
        : selection,
    );
  };
  const focusRange = (selection: EditorSelection) => {
    selectionChanged(selection);
    setSelectionRequest({ ...selection });
  };
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
            previewSide,
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
  }, [source, page, targets, removalKey, previewSide]);
  const renderedPage = useRef('');
  // A zoom render may still be pending while the current page is used by a
  // newly opened OCR crop. Keep that URL alive until React replaces it.
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => {
    let live = true;
    const cancel = new AbortController();
    const key = `${source.id}:${page.index}:${page.rotation}`;
    if (renderedPage.current !== key) setUrl('');
    renderedPage.current = key;
    setError('');
    renderPage(source, { index: page.index, rotation: page.rotation }, previewSide, cancel.signal)
      .then(async ({ canvas, width, height }) => {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );
        canvas.width = canvas.height = 0;
        if (!blob) throw new Error('Bild konnte nicht erstellt werden.');
        if (live && blob) {
          setUrl(URL.createObjectURL(blob));
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
    };
  }, [source, page.index, page.rotation, onDimensions, renderRetry, previewSide]);
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
  function startPoint(e: PointerEvent): Omit<EditorStartPoint, 'id'> {
    const rect = host.current?.getBoundingClientRect();
    return {
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
      ...(rect
        ? {
            pageX: (e.clientX - rect.left) / rect.width,
            pageY: (e.clientY - rect.top) / rect.height,
          }
        : {}),
    };
  }
  function pick(target: TextTarget, point?: Omit<EditorStartPoint, 'id'>) {
    if (disabled) return;
    const existing = marks.find(
      (m) =>
        m.sourceRect &&
        ['x', 'y', 'w', 'h'].every(
          (key) =>
            Math.abs(m.sourceRect![key as keyof Rect] - target[key as keyof Rect]) < 0.000001,
        ),
    );
    if (existing) {
      setInitialPoint(point ? { id: existing.id, ...point } : null);
      onSelect(existing.id);
      return;
    }
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
      originalText: text,
      ...(target.runs?.length
        ? {
            runs: target.runs.map((r) => ({
              ...r,
              style: { ...r.style, originalFontPage: page.index },
            })),
          }
        : {}),
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
    setInitialPoint(point ? { id: next.id, ...point } : null);
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
              {uncertain > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    const target = targets.find(
                      (t) => t.origin === 'ocr' && (t.confidence ?? 100) < 75,
                    );
                    if (target) pick(target);
                  }}
                >
                  {ui('Unsichere Textstellen prüfen')}
                </Button>
              )}
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
          selection={textSelection}
          source={source}
          width={dims.width}
          disabled={disabled}
          onPatch={onPatch}
          onDone={() => onSelect('')}
          onFocusText={() =>
            focusRange(
              textSelection?.id === selectedText.id
                ? textSelection
                : { id: selectedText.id, start: 0, end: 0 },
            )
          }
          onSearch={() => openSearch(selectedText.id)}
        />
      )}
      {selectedText && autoOcr && searchId === selectedText.id && (
        <EditorTextSearch
          key={selectedText.id}
          request={searchRequest}
          mark={selectedText}
          disabled={disabled}
          onPatch={onPatch}
          onRange={focusRange}
          onClose={() => {
            setSearchId('');
            focusRange(
              textSelection?.id === selectedText.id
                ? textSelection
                : { id: selectedText.id, start: 0, end: 0 },
            );
          }}
        />
      )}
      {selectedText && autoOcr && (
        <>
          <EditorLayoutHelp
            key={`layout-${selectedText.id}`}
            mark={selectedText}
            source={source}
            width={dims.width}
            height={dims.height}
            onPatch={onPatch}
          />
          {selectedText.sourceRect && (
            <details className="editor-font-compare">
              <summary>{ui('Schriftbild mit dem Original vergleichen')}</summary>
              <div className="editor-review-grid">
                <div>
                  <strong>{ui('Original')}</strong>
                  <div
                    style={{ width: selectedText.sourceRect.w * displayWidth, maxWidth: '100%' }}
                  >
                    <EditorOriginalSnippet
                      url={url}
                      rect={selectedText.sourceRect}
                      width={dims.width}
                      height={dims.height}
                    />
                  </div>
                </div>
                <div>
                  <strong>{ui('Aktuelle Bearbeitung')}</strong>
                  <div className="editor-font-sample">
                    <MarkContent
                      mark={{ ...selectedText, x: 0, y: 0, originalState: undefined }}
                      source={source}
                      width={displayWidth}
                      height={(displayWidth * dims.height) / dims.width}
                    />
                  </div>
                </div>
              </div>
            </details>
          )}
          {selectedText.sourceIsScan && (
            <EditorOcrReview
              key={`ocr-${selectedText.id}`}
              mark={selectedText}
              source={source}
              page={page}
              url={url}
              width={dims.width}
              height={dims.height}
              language={language}
              targets={targets}
              onPick={pick}
              onPatch={onPatch}
            />
          )}
        </>
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
      <div className="editor-page-scroll" ref={pageScroll}>
        <div
          className="canvas-holder"
          style={{ width: `${zoom}%`, maxWidth: `${(720 * zoom) / 100}px` }}
        >
          <div
            ref={host}
            className="document-sheet editor-sheet"
            style={{
              aspectRatio: `${dims.width}/${dims.height}`,
              touchAction: action === 'erase' || action === 'replace-area' ? 'none' : 'pan-x pan-y',
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
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (e.button === 0 && !disabled) {
                      e.preventDefault();
                      flushSync(() => pick(t, startPoint(e)));
                    }
                  }}
                  onClick={(e) => {
                    if (e.detail === 0) pick(t);
                  }}
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
                    if (selectedId !== m.id)
                      setInitialPoint({
                        id: m.id,
                        ...startPoint(e),
                      });
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
                    onSelection={selectionChanged}
                    initialPoint={initialPoint}
                    selectionRequest={selectionRequest}
                    onSearch={() => openSearch(m.id)}
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
    </div>
  );
}
