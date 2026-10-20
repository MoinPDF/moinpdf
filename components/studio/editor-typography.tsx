'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { Bold, Italic, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import type { Source } from '@/lib/pdf-engine';
import type { Mark } from '@/lib/studio-engine';
import { editorFontCatalog, type EditorFontChoice } from '@/lib/editor-font-catalog';
import {
  loadEditorCssFont,
  resolveEditorFont,
  importEditorFont,
  type EditorFontResolution,
} from '@/lib/editor-fonts';
import { cssFont, editorMarkChanged } from '@/lib/editor-model';
import { editorTextGeometry } from '@/lib/editor-text-layer';
import { prepareEditorRuns, type PreparedEditorRun } from '@/lib/editor-rich-layout';
import { editorSelectionStyle, type EditorSelection } from '@/lib/editor-rich-text';
import { EditorRichInput, type EditorStartPoint } from './editor-rich-input';

export type EditorPatch = (id: string, patch: Partial<Mark>, mode?: 'typing') => void;
export function useEditorTypography(mark?: Mark, source?: Source) {
  const [value, setValue] = useState<{
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
      const runs = mark.runs?.length ? await prepareEditorRuns(mark, source) : undefined;
      const resolution = runs?.[0]?.resolution || (await resolveEditorFont(mark, source));
      await Promise.all(
        [resolution.font, ...(runs || []).map((r) => r.resolution.font)].map((font) =>
          loadEditorCssFont(font, source),
        ),
      );
      if (active) setValue({ resolution, runs, pending: false, error: '' });
    })().catch((error) => {
      if (active)
        setValue({
          pending: false,
          error:
            error instanceof Error ? error.message : 'Die Schrift konnte nicht vorbereitet werden.',
        });
    });
    return () => {
      active = false;
    };
  }, [source, mark]);
  return value;
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
    letterSpacing: (mark.tracking || 0) * size,
    textAlign: mark.align || 'left',
    color: mark.color || '#222222',
  };
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
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setFontError('');
            setFontLoading(true);
            try {
              const customFont = await importEditorFont(file);
              onPatch(mark.id, {
                customFont,
                fontChoice: 'custom',
                bold: customFont.bold,
                italic: customFont.italic,
                runs: mark.runs?.map((r) => ({
                  ...r,
                  style: {
                    ...r.style,
                    fontChoice: 'custom',
                    bold: customFont.bold,
                    italic: customFont.italic,
                  },
                })),
              });
            } catch (error) {
              setFontError(
                error instanceof Error
                  ? error.message
                  : 'Die Schrift konnte nicht vorbereitet werden.',
              );
            } finally {
              setFontLoading(false);
            }
          }}
        />
        <small>
          {ui(
            'Lokal verarbeitet. Bitte nur Schriften verwenden, die du einbetten darfst. Die Schrift wird im Projekt mitgespeichert.',
          )}
        </small>
      </label>
      {fontError && <p role="alert">{ui(fontError)}</p>}
    </div>
  );
}
export function EditorInlineText({
  mark,
  source,
  width,
  height,
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
  return (
    <EditorRichInput
      mark={mark}
      width={width}
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
        ...(!editorMarkChanged(mark)
          ? { color: 'transparent', caretColor: mark.color || '#222222' }
          : {}),
      }}
    />
  );
}
