'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Superscript,
  Subscript,
  List,
  ListOrdered,
  Check,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import type { Source } from '@/lib/pdf-engine';
import type { EditorFontAxis } from '@/lib/editor-font-outline';
import type { Mark } from '@/lib/studio-engine';
import { editorFontCatalog, type EditorFontChoice } from '@/lib/editor-font-catalog';
import {
  loadEditorCssFont,
  resolveEditorFont,
  importEditorFont,
  type EditorFontResolution,
} from '@/lib/editor-fonts';
import { cssFont, editorMarkChanged, editorScanMatchStatus } from '@/lib/editor-model';
import { editorTextGeometry } from '@/lib/editor-text-layer';
import { prepareEditorRuns, type PreparedEditorRun } from '@/lib/editor-rich-layout';
import { editorLayoutPlan } from '@/lib/editor-layout-plan';
import { editorScanBlur } from '@/lib/editor-scan';
import { renderEditorScanText } from '@/lib/editor-ink-verification';
import {
  editorExportText,
  editorSelectionStyle,
  type EditorSelection,
} from '@/lib/editor-rich-text';
import { EditorRichInput, type EditorStartPoint } from './editor-rich-input';

export type EditorPatch = (id: string, patch: Partial<Mark>, mode?: 'typing') => void;
export function useEditorTypography(mark?: Mark, source?: Source) {
  const [value, setValue] = useState<{
    preparedMark?: Mark;
    preparedSource?: Source;
    resolution?: EditorFontResolution;
    runs?: PreparedEditorRun[];
    pending: boolean;
    error: string;
  }>({ pending: false, error: '' });
  useEffect(() => {
    let active = true;
    if (!mark || mark.kind !== 'text') {
      setValue({ pending: false, error: '' });
      return;
    }
    setValue((old) => ({ ...old, pending: true, error: '' }));
    (async () => {
      const runs = await prepareEditorRuns(mark, source);
      const resolution = runs?.[0]?.resolution || (await resolveEditorFont(mark, source));
      await Promise.all(
        [
          resolution.font,
          ...(runs || []).flatMap((r) => [
            r.resolution.font,
            ...(r.listMarker ? [r.listMarker.font] : []),
          ]),
        ].map((font) => loadEditorCssFont(font, source)),
      );
      if (active)
        setValue({
          preparedMark: mark,
          preparedSource: source,
          resolution,
          runs,
          pending: false,
          error: '',
        });
    })().catch((error) => {
      if (active)
        setValue({
          preparedMark: mark,
          preparedSource: source,
          pending: false,
          error:
            error instanceof Error ? error.message : 'Die Schrift konnte nicht vorbereitet werden.',
        });
    });
    return () => {
      active = false;
    };
  }, [source, mark]);
  // Resolved run offsets belong to one exact text/style revision. Applying a
  // shorter previous revision while fonts load would truncate undo/redo text.
  return mark?.kind === 'text' && (value.preparedMark !== mark || value.preparedSource !== source)
    ? { pending: true, error: '', resolution: undefined, runs: undefined }
    : value;
}
export function editorTextCss(
  mark: Mark,
  width: number,
  height: number,
  resolution?: EditorFontResolution,
): CSSProperties {
  const geometry = editorTextGeometry({ ...mark, x: 0, y: 0 }, width, height, mark.textRotation),
    font = resolution?.font;
  const size = (mark.fontScale || 0.028) * width,
    lineHeight = mark.lineHeight || 1.25,
    scaleX = mark.textScaleX || 1;
  const cssBaseline =
    (lineHeight - (font?.ascent ?? 0.9) - (font?.descent ?? 0.2)) / 2 + (font?.ascent ?? 0.9);
  const offset = ((mark.baselineScale ?? 0.9) - cssBaseline) * size,
    angle = (geometry.rotation * Math.PI) / 180;
  return {
    position: 'absolute',
    left: geometry.x - Math.sin(angle) * offset,
    top: geometry.y + Math.cos(angle) * offset,
    width: geometry.width / scaleX,
    height: geometry.height + Math.abs(offset),
    transformOrigin: 'top left',
    transform: `rotate(${geometry.rotation}deg) scaleX(${scaleX})`,
    padding: `0 ${(mark.insetScale || 0) * size}px`,
    boxSizing: 'border-box',
    tabSize: 4,
    fontSize: size,
    lineHeight,
    fontFamily: font
      ? `"${font.cssFamily}", ${cssFont(mark.fontFamily)}`
      : cssFont(mark.fontFamily),
    fontWeight: mark.bold ? 700 : 400,
    fontStyle: mark.italic ? 'italic' : 'normal',
    fontKerning: 'none',
    fontVariantLigatures: 'none',
    fontFeatureSettings: '"liga" 0, "kern" 0, "clig" 0',
    textSizeAdjust: 'none',
    WebkitTextSizeAdjust: 'none',
    letterSpacing: (mark.tracking || 0) * size,
    textAlign: mark.align || 'left',
    color: mark.color || '#222222',
    filter: editorScanBlur(mark, width) ? `blur(${editorScanBlur(mark, width)}px)` : undefined,
  };
}
/** Browser font hinting and CSS blur change thin scan glyphs at small zooms.
 * Paint their outlines at the physical PDF size, just like the export, then
 * scale the resulting patch with the page. No browser font fallback is involved. */
function useEditorScanImage(
  mark: Mark,
  width: number,
  height: number,
  pageWidth: number,
  runs?: PreparedEditorRun[],
) {
  const [image, setImage] = useState<{
    mark: Mark;
    pageWidth: number;
    aspect: number;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>();
  const aspect = height / width;
  useEffect(() => {
    if (!mark.sourceIsScan || mark.textRotation || !runs?.length) return;
    const controller = new AbortController();
    const plan = editorLayoutPlan({ ...mark, x: 0, y: 0 }, pageWidth, pageWidth * aspect, runs);
    void renderEditorScanText(plan, editorScanBlur(mark, pageWidth), controller.signal)
      .then((patch) => {
        try {
          if (!controller.signal.aborted)
            setImage({
              mark,
              pageWidth,
              aspect,
              url: patch.canvas.toDataURL('image/png'),
              x: patch.x,
              y: patch.y,
              width: patch.width,
              height: patch.height,
            });
        } finally {
          patch.canvas.width = patch.canvas.height = 0;
        }
      })
      .catch(() => {}); // The ordinary preview remains available if rasterization fails.
    return () => controller.abort();
  }, [mark, pageWidth, aspect, runs]);
  if (image?.mark !== mark || image.pageWidth !== pageWidth || image.aspect !== aspect) return;
  const scale = width / pageWidth;
  return {
    url: image.url,
    style: {
      position: 'absolute' as const,
      left: image.x * scale,
      top: image.y * scale,
      width: image.width * scale,
      height: image.height * scale,
      maxWidth: 'none',
      pointerEvents: 'none' as const,
    },
  };
}

/** The idle preview uses the same baselines, wrapping and advances as PDF export. */
export function EditorTextPreview({
  mark,
  width,
  height,
  pageWidth = 595.28,
  runs,
}: {
  mark: Mark;
  width: number;
  height: number;
  pageWidth?: number;
  runs: PreparedEditorRun[];
}) {
  const scan = useEditorScanImage(mark, width, height, pageWidth, runs);
  if (scan)
    return (
      <img
        className="editor-scan-content"
        src={scan.url}
        alt={editorExportText(mark)}
        style={scan.style}
        draggable={false}
      />
    );
  const plan = editorLayoutPlan({ ...mark, x: 0, y: 0 }, width, height, runs);
  return (
    <svg
      className="editor-text-content"
      role="img"
      aria-label={editorExportText(mark)}
      width={Math.max(1, plan.geometry.width / plan.scaleX)}
      height={Math.max(1, plan.geometry.height)}
      style={{
        width: Math.max(1, plan.geometry.width / plan.scaleX),
        height: Math.max(1, plan.geometry.height),
        position: 'absolute',
        left: plan.geometry.x,
        top: plan.geometry.y,
        overflow: 'visible',
        transformOrigin: 'top left',
        transform: `rotate(${plan.geometry.rotation}deg) scaleX(${plan.scaleX})`,
        filter: editorScanBlur(mark, width) ? `blur(${editorScanBlur(mark, width)}px)` : undefined,
      }}
    >
      {plan.pieces.map((piece, i) => (
        <g key={i}>
          <text
            x={piece.x}
            y={piece.y}
            fill={piece.color}
            fontSize={piece.size}
            fontFamily={`"${piece.font.cssFamily}", ${cssFont(mark.fontFamily)}`}
            fontWeight={piece.font.bold ? 700 : 400}
            fontStyle={piece.font.italic ? 'italic' : 'normal'}
            letterSpacing={piece.tracking}
            xmlSpace="preserve"
            style={{
              whiteSpace: 'pre',
              fontKerning: 'none',
              fontVariantLigatures: 'none',
              fontFeatureSettings: '"liga" 0, "kern" 0, "clig" 0',
            }}
          >
            {piece.text}
          </text>
          {piece.underline && (
            <line
              x1={piece.x}
              x2={piece.x + (piece.advance || 0)}
              y1={piece.y + piece.size * 0.12}
              y2={piece.y + piece.size * 0.12}
              stroke={piece.color}
              strokeWidth={Math.max((0.35 * width) / 595.28, piece.size * 0.055)}
            />
          )}
        </g>
      ))}
    </svg>
  );
}
export function EditorFontPicker({
  mark,
  disabled,
  onPatch,
  mixed = false,
}: {
  mark: Mark;
  disabled: boolean;
  onPatch: EditorPatch;
  mixed?: boolean;
}) {
  useLanguage();
  return (
    <select
      aria-label={ui('Schriftart')}
      value={mixed ? 'mixed' : mark.fontChoice || 'auto'}
      disabled={disabled}
      onChange={(event) => {
        const value = event.target.value as EditorFontChoice,
          font = editorFontCatalog.find((item) => item.id === value);
        onPatch(mark.id, {
          fontChoice: value,
          ...(font ? { fontFamily: font.family, tracking: 0, textScaleX: 1 } : {}),
        });
      }}
    >
      {mixed && (
        <option value="mixed" disabled>
          {ui('Gemischt')}
        </option>
      )}
      <option value="auto">{ui('Automatisch / Originalschrift')}</option>
      {mark.customFont && (
        <option value="custom">
          {mark.customFont.name} · {ui('Eigene Schrift')}
        </option>
      )}
      {editorFontCatalog.map((font) => (
        <option key={font.id} value={font.id}>
          {font.name}
          {font.equivalent ? ` (${font.equivalent})` : ''}
        </option>
      ))}
    </select>
  );
}
export function EditorFontStatus({
  mark,
  source,
  selection,
}: {
  mark: Mark;
  source?: Source;
  selection?: EditorSelection | null;
}) {
  useLanguage();
  const typography = useEditorTypography(mark, source),
    { error, pending } = typography;
  const context = editorSelectionStyle(mark, selection);
  const selectedRuns = typography.runs?.filter(
    (r) => r.start < context.end && r.end > context.start,
  );
  const resolution = selectedRuns?.[0]?.resolution || typography.resolution;
  const resolutions = selectedRuns?.length
    ? selectedRuns.map((r) => r.resolution)
    : resolution
      ? [resolution]
      : [];
  const names = [...new Set(resolutions.map((r) => r.font.name))];
  const reasons = [...new Set(resolutions.map((r) => r.reason).filter(Boolean))];
  const originalName = context.mixed.has('originalFontName') ? '' : context.style.originalFontName;
  return (
    <div className="editor-font-status" aria-live="polite">
      {mark.sourceIsScan && (
        <p className="editor-ocr-warning">
          {ui('Bei Scans wird die Schrift visuell angenähert. Bitte mit dem Original vergleichen.')}
        </p>
      )}
      {mark.sourceIsScan && mark.scanMatch && (
        <p className="editor-scan-match" role="status">
          {ui(
            editorScanMatchStatus(mark) === 'matched'
              ? 'Schriftähnlichkeit: gute Annäherung'
              : editorScanMatchStatus(mark) === 'changed'
                ? 'Schriftähnlichkeit: Formatierung nach der Erkennung geändert'
                : 'Schriftähnlichkeit: unsicher',
          )}
          {' · '}
          {ui('Verglichene Originalstellen')}: {mark.scanMatch.samples}
        </p>
      )}
      {originalName && (
        <span>
          {ui('Erkannte Schrift')}: <strong>{originalName}</strong>
        </span>
      )}
      {error ? (
        <p role="alert">{ui(error)}</p>
      ) : resolution ? (
        <>
          <span>
            {ui(
              names.length > 1
                ? 'Verwendete Schriften'
                : resolution.font.original
                  ? 'Originalschrift wird verwendet'
                  : resolution.substituted
                    ? 'Ersatzschrift'
                    : 'Verwendete Schrift',
            )}
            : <strong>{names.join(', ')}</strong>
          </span>
          {reasons.map((reason) => (
            <p key={reason} className="editor-ocr-warning">
              {ui(reason!)}
            </p>
          ))}
          {resolutions.length === 1 && resolution.widthDeviation !== undefined && (
            <span>
              {ui('Abweichung der Textbreite')}: {Math.round(resolution.widthDeviation * 10) / 10}%
              · {ui('am ursprünglichen Text gemessen')}
            </span>
          )}
        </>
      ) : pending ? (
        <span>{ui('Schrift wird vorbereitet …')}</span>
      ) : null}
      {!mark.originalFontName && mark.sourceRect && (
        <p>
          {ui(
            'Bei Scans sind Schriftart und Größe geschätzt. Bitte das Schriftbild am Original prüfen.',
          )}
        </p>
      )}
    </div>
  );
}
export function EditorInlineToolbar({
  mark,
  source,
  width,
  disabled,
  onPatch,
  onDone,
  selection,
  onFocusText,
  onSearch,
}: {
  mark: Mark;
  source: Source;
  width: number;
  disabled: boolean;
  onPatch: EditorPatch;
  onDone: () => void;
  selection?: EditorSelection | null;
  onFocusText?: () => void;
  onSearch?: () => void;
}) {
  useLanguage();
  const [fontError, setFontError] = useState('');
  const [fontLoading, setFontLoading] = useState(false);
  const [variable, setVariable] = useState<{
    file: File;
    axes: EditorFontAxis[];
    coordinates: Record<string, number>;
  } | null>(null);
  const fontJob = useRef(0),
    currentFontMark = useRef(mark);
  currentFontMark.current = mark;
  useEffect(() => {
    const generation = fontJob;
    generation.current++;
    setVariable(null);
    setFontLoading(false);
    return () => {
      generation.current++;
    };
  }, [mark.id]);
  async function loadFont(file: File, coordinates?: Record<string, number>) {
    const token = ++fontJob.current;
    setFontError('');
    setFontLoading(true);
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error('Eigene Schriften dürfen höchstens 2 MB groß sein.');
      if (!coordinates) {
        const axes = (await import('@/lib/editor-font-outline')).editorFontAxes(
          new Uint8Array(await file.arrayBuffer()),
        );
        if (token !== fontJob.current) return;
        if (axes.length) {
          setVariable({
            file,
            axes,
            coordinates: Object.fromEntries(axes.map((a) => [a.tag, a.default])),
          });
          return;
        }
      }
      const customFont = await importEditorFont(file, coordinates);
      if (token !== fontJob.current) return;
      onPatch(mark.id, {
        customFont,
        fontChoice: 'custom',
        bold: customFont.bold,
        italic: customFont.italic,
        runs: currentFontMark.current.runs?.map((r) => ({
          ...r,
          style: {
            ...r.style,
            fontChoice: 'custom',
            bold: customFont.bold,
            italic: customFont.italic,
          },
        })),
      });
      setVariable(null);
    } catch (error) {
      if (token === fontJob.current)
        setFontError(
          error instanceof Error ? error.message : 'Die Schrift konnte nicht vorbereitet werden.',
        );
    } finally {
      if (token === fontJob.current) setFontLoading(false);
    }
  }
  const [details, setDetails] = useState(false);
  const context = editorSelectionStyle(mark, selection),
    active = { ...mark, ...context.style };
  const mixedFont =
    context.mixed.has('fontChoice') ||
    context.mixed.has('fontFamily') ||
    ((active.fontChoice || 'auto') === 'auto' &&
      (context.mixed.has('originalFontId') || context.mixed.has('originalFontName')));
  return (
    <div
      className={`editor-inline-toolbar${details ? ' show-touch-details' : ''}`}
      role="toolbar"
      aria-label={ui('Text direkt formatieren')}
    >
      <label>
        <span>{ui('Schriftart')}</span>
        <EditorFontPicker
          mark={active}
          mixed={mixedFont}
          disabled={disabled}
          onPatch={(id, patch) => {
            onPatch(id, patch);
            onFocusText?.();
          }}
        />
      </label>
      <label className="editor-inline-size">
        <span>{ui('Größe · pt')}</span>
        <input
          aria-label={ui('Textgröße in Punkt')}
          type="number"
          min={1}
          max={288}
          step={0.1}
          value={
            context.mixed.has('fontScale')
              ? ''
              : Math.round((active.fontScale || 0.028) * width * 100) / 100
          }
          placeholder={context.mixed.has('fontScale') ? ui('Gemischt') : undefined}
          disabled={disabled}
          onChange={(e) => {
            const size = Number(e.target.value);
            if (size >= 1 && size <= 288) onPatch(mark.id, { fontScale: size / width });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              onFocusText?.();
            }
          }}
        />
      </label>
      <div className="editor-inline-buttons">
        <Button
          size="sm"
          variant="ghost"
          title={ui('Fett')}
          aria-label={ui('Fett')}
          aria-pressed={context.mixed.has('bold') ? 'mixed' : !!active.bold}
          disabled={disabled}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            onPatch(mark.id, { bold: context.mixed.has('bold') || !active.bold });
            onFocusText?.();
          }}
        >
          <Bold size={17} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          title={ui('Kursiv')}
          aria-label={ui('Kursiv')}
          aria-pressed={context.mixed.has('italic') ? 'mixed' : !!active.italic}
          disabled={disabled}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            onPatch(mark.id, { italic: context.mixed.has('italic') || !active.italic });
            onFocusText?.();
          }}
        >
          <Italic size={17} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={ui('Unterstreichen')}
          title={ui('Unterstreichen')}
          aria-pressed={context.mixed.has('underline') ? 'mixed' : !!active.underline}
          disabled={disabled}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            onPatch(mark.id, { underline: context.mixed.has('underline') || !active.underline });
            onFocusText?.();
          }}
        >
          <Underline size={17} />
        </Button>
        <details className="editor-format-more">
          <summary>{ui('Mehr')}</summary>
          <div className="editor-format-popover">
            {(
              [
                ['super', Superscript, 'Hochgestellt'],
                ['sub', Subscript, 'Tiefgestellt'],
              ] as const
            ).map(([value, Icon, label]) => (
              <Button
                key={value}
                size="sm"
                variant="ghost"
                disabled={disabled}
                aria-label={ui(label)}
                aria-pressed={active.script === value}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPatch(mark.id, { script: active.script === value ? 'normal' : value });
                  onFocusText?.();
                }}
              >
                <Icon size={17} />
                {ui(label)}
              </Button>
            ))}
            <label>
              <span>{ui('Ausrichtung')}</span>
              <select
                aria-label={ui('Ausrichtung')}
                disabled={disabled}
                value={mark.align || 'left'}
                onChange={(e) => onPatch(mark.id, { align: e.target.value as Mark['align'] })}
              >
                <option value="left">{ui('Linksbündig')}</option>
                <option value="center">{ui('Zentriert')}</option>
                <option value="right">{ui('Rechtsbündig')}</option>
                <option value="justify">{ui('Blocksatz')}</option>
              </select>
            </label>
            {(
              [
                ['bullet', List, 'Aufzählung'],
                ['numbered', ListOrdered, 'Nummerierte Liste'],
              ] as const
            ).map(([value, Icon, label]) => (
              <Button
                key={value}
                size="sm"
                variant="ghost"
                disabled={disabled}
                aria-label={ui(label)}
                aria-pressed={mark.listStyle === value}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPatch(mark.id, { listStyle: mark.listStyle === value ? 'none' : value });
                  onFocusText?.();
                }}
              >
                <Icon size={17} />
                {ui(label)}
              </Button>
            ))}
            {mark.listStyle === 'numbered' && (
              <label>
                <span>{ui('Beginnen bei')}</span>
                <input
                  aria-label={ui('Beginnen bei')}
                  type="number"
                  min={1}
                  max={9999}
                  disabled={disabled}
                  value={mark.listStart || 1}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 1 && n <= 9999)
                      onPatch(mark.id, { listStart: n });
                  }}
                />
              </label>
            )}
            <label>
              <span>{ui('Abstand nach Absatz')}</span>
              <input
                aria-label={ui('Abstand nach Absatz')}
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={mark.paragraphSpacing || 0}
                disabled={disabled}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 0 && n <= 5) onPatch(mark.id, { paragraphSpacing: n });
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={!!mark.spellcheck}
                disabled={disabled}
                onChange={(e) => onPatch(mark.id, { spellcheck: e.target.checked })}
              />
              {ui('Rechtschreibung prüfen')}
            </label>
          </div>
        </details>
        <label
          className={`editor-inline-color${context.mixed.has('color') ? ' is-mixed' : ''}`}
          title={ui(context.mixed.has('color') ? 'Gemischte Textfarben' : 'Textfarbe')}
        >
          <input
            aria-label={ui('Textfarbe')}
            type="color"
            disabled={disabled}
            value={active.color || '#222222'}
            onChange={(e) => onPatch(mark.id, { color: e.target.value })}
          />
        </label>
        {onSearch && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={ui('Suchen und ersetzen')}
            title={ui('Suchen und ersetzen')}
            disabled={disabled}
            onClick={onSearch}
          >
            <Search size={17} />
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={disabled} onClick={onDone}>
          <Check size={17} />
          {ui('Fertig')}
        </Button>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="editor-touch-details"
        aria-expanded={details}
        onClick={() => setDetails(!details)}
      >
        {ui(details ? 'Weniger Textoptionen' : 'Mehr Textoptionen')}
      </Button>
      <EditorFontStatus mark={mark} source={source} selection={selection} />
      <small className="editor-selection-help">
        <strong>
          {ui(context.selected ? 'Formatierung: markierter Text' : 'Formatierung: ganzes Textfeld')}
          {context.mixed.size ? ` · ${ui('Gemischt')}` : ''}
        </strong>{' '}
        {ui(
          'Markiere Wörter, um nur diese zu formatieren. Ohne Markierung gilt die Formatierung für das ganze Textfeld.',
        )}
      </small>
      <label className="editor-font-upload">
        <span>{ui('Eigenen Schriftschnitt für dieses Textfeld laden')}</span>
        <input
          type="file"
          accept=".ttf,.otf"
          aria-label={ui('Eigene Schriftdatei')}
          disabled={disabled || fontLoading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void loadFont(file);
          }}
        />
        <small>
          {ui(
            'Lokal verarbeitet. Bitte nur Schriften verwenden, die du einbetten darfst. Die Schrift wird im Projekt mitgespeichert.',
          )}
        </small>
      </label>
      {variable && (
        <div
          className="editor-variable-font"
          role="group"
          aria-label={ui('Variablen Schriftschnitt wählen')}
        >
          <strong>{ui('Variablen Schriftschnitt wählen')}</strong>
          {variable.axes.map((axis) => (
            <label key={axis.tag}>
              <span>
                {ui(
                  axis.tag === 'wght'
                    ? 'Schriftstärke'
                    : axis.tag === 'wdth'
                      ? 'Schriftbreite'
                      : axis.tag === 'opsz'
                        ? 'Optische Größe'
                        : axis.tag === 'slnt'
                          ? 'Neigung'
                          : axis.tag === 'ital'
                            ? 'Kursiv'
                            : axis.tag,
                )}
              </span>
              <input
                type="number"
                min={axis.min}
                max={axis.max}
                step="any"
                value={variable.coordinates[axis.tag]}
                disabled={fontLoading || disabled}
                onChange={(e) =>
                  setVariable({
                    ...variable,
                    coordinates: { ...variable.coordinates, [axis.tag]: e.target.valueAsNumber },
                  })
                }
              />
            </label>
          ))}
          <Button
            size="sm"
            disabled={
              fontLoading ||
              disabled ||
              variable.axes.some(
                (a) =>
                  !Number.isFinite(variable.coordinates[a.tag]) ||
                  variable.coordinates[a.tag] < a.min ||
                  variable.coordinates[a.tag] > a.max,
              )
            }
            onClick={() => void loadFont(variable.file, variable.coordinates)}
          >
            {ui('Schriftschnitt übernehmen')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setVariable(null)}>
            {ui('Abbrechen')}
          </Button>
        </div>
      )}
      {fontError && <p role="alert">{ui(fontError)}</p>}
    </div>
  );
}
export function EditorInlineText({
  mark,
  source,
  width,
  height,
  pageWidth,
  disabled,
  onPatch,
  onDone,
  onSelection,
  initialPoint,
  selectionRequest,
  onSearch,
}: {
  mark: Mark;
  source: Source;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  disabled: boolean;
  onPatch: EditorPatch;
  onDone: () => void;
  onSelection?: (selection: EditorSelection) => void;
  initialPoint?: EditorStartPoint | null;
  selectionRequest?: EditorSelection | null;
  onSearch?: () => void;
}) {
  useLanguage();
  const typography = useEditorTypography(mark, source);
  const scan = useEditorScanImage(mark, width, height, pageWidth, typography.runs);
  const changed = editorMarkChanged(mark);
  return (
    <>
      {changed && scan && (
        <img
          className="editor-scan-content"
          src={scan.url}
          alt=""
          aria-hidden="true"
          style={scan.style}
          draggable={false}
        />
      )}
      <EditorRichInput
        mark={mark}
        width={width}
        pageWidth={pageWidth}
        runs={typography.runs}
        disabled={disabled}
        onPatch={onPatch}
        onDone={onDone}
        onSelection={onSelection}
        initialPoint={initialPoint}
        selectionRequest={selectionRequest}
        onSearch={onSearch}
        style={{
          ...editorTextCss(mark, width, height, typography.resolution),
          ...(!changed || scan
            ? { color: 'transparent', caretColor: mark.color || '#222222', filter: undefined }
            : {}),
        }}
      />
    </>
  );
}
