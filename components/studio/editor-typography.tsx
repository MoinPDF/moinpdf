'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bold, Italic, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import type { Source } from '@/lib/pdf-engine';
import type { Mark } from '@/lib/studio-engine';
import { editorFontCatalog, type EditorFontChoice } from '@/lib/editor-font-catalog';
import {
  loadEditorCssFont,
  resolveEditorFont,
  type EditorFontResolution,
} from '@/lib/editor-fonts';
import { cssFont, editorMarkChanged } from '@/lib/editor-model';
import { editorTextGeometry, layoutEditorText } from '@/lib/editor-text-layer';

export type EditorPatch = (id: string, patch: Partial<Mark>, mode?: 'typing') => void;
export function useEditorTypography(mark?: Mark, source?: Source) {
  const [value, setValue] = useState<{
    resolution?: EditorFontResolution;
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
    resolveEditorFont(mark, source)
      .then(async (resolution) => {
        await loadEditorCssFont(resolution.font, source);
        if (active) setValue({ resolution, pending: false, error: '' });
      })
      .catch((error) => {
        if (active)
          setValue({
            pending: false,
            error:
              error instanceof Error
                ? error.message
                : 'Die Schrift konnte nicht vorbereitet werden.',
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
}: {
  mark: Mark;
  disabled: boolean;
  onPatch: EditorPatch;
}) {
  useLanguage();
  return (
    <select
      aria-label={ui('Schriftart')}
      value={mark.fontChoice || 'auto'}
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
      <option value="auto">{ui('Automatisch / Originalschrift')}</option>
      {editorFontCatalog.map((font) => (
        <option key={font.id} value={font.id}>
          {font.name}
          {font.equivalent ? ` (${font.equivalent})` : ''}
        </option>
      ))}
    </select>
  );
}
export function EditorFontStatus({ mark, source }: { mark: Mark; source?: Source }) {
  useLanguage();
  const { resolution, error, pending } = useEditorTypography(mark, source);
  return (
    <div className="editor-font-status" aria-live="polite">
      {mark.originalFontName && (
        <span>
          {ui('Erkannte Schrift')}: <strong>{mark.originalFontName}</strong>
        </span>
      )}
      {error ? (
        <p role="alert">{ui(error)}</p>
      ) : resolution ? (
        <>
          <span>
            {ui(
              resolution.font.original
                ? 'Originalschrift wird verwendet'
                : resolution.substituted
                  ? 'Ersatzschrift'
                  : 'Verwendete Schrift',
            )}
            : <strong>{resolution.font.name}</strong>
          </span>
          {resolution.reason && <p className="editor-ocr-warning">{ui(resolution.reason)}</p>}
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
}: {
  mark: Mark;
  source: Source;
  width: number;
  disabled: boolean;
  onPatch: EditorPatch;
  onDone: () => void;
}) {
  useLanguage();
  return (
    <div
      className="editor-inline-toolbar"
      role="toolbar"
      aria-label={ui('Text direkt formatieren')}
    >
      <label>
        <span>{ui('Schriftart')}</span>
        <EditorFontPicker mark={mark} disabled={disabled} onPatch={onPatch} />
      </label>
      <label className="editor-inline-size">
        <span>{ui('Größe · pt')}</span>
        <input
          aria-label={ui('Textgröße in Punkt')}
          type="number"
          min={1}
          max={288}
          step={0.1}
          value={Math.round((mark.fontScale || 0.028) * width * 100) / 100}
          disabled={disabled}
          onChange={(e) => {
            const size = Number(e.target.value);
            if (size >= 1 && size <= 288) onPatch(mark.id, { fontScale: size / width });
          }}
        />
      </label>
      <div className="editor-inline-buttons">
        <Button
          size="sm"
          variant="ghost"
          title={ui('Fett')}
          aria-label={ui('Fett')}
          aria-pressed={!!mark.bold}
          disabled={disabled}
          onClick={() => onPatch(mark.id, { bold: !mark.bold })}
        >
          <Bold size={17} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          title={ui('Kursiv')}
          aria-label={ui('Kursiv')}
          aria-pressed={!!mark.italic}
          disabled={disabled}
          onClick={() => onPatch(mark.id, { italic: !mark.italic })}
        >
          <Italic size={17} />
        </Button>
        <label className="editor-inline-color" title={ui('Textfarbe')}>
          <input
            aria-label={ui('Textfarbe')}
            type="color"
            disabled={disabled}
            value={mark.color || '#222222'}
            onChange={(e) => onPatch(mark.id, { color: e.target.value })}
          />
        </label>
        <Button size="sm" variant="outline" disabled={disabled} onClick={onDone}>
          <Check size={17} />
          {ui('Fertig')}
        </Button>
      </div>
      <EditorFontStatus mark={mark} source={source} />
    </div>
  );
}
export function EditorInlineText({
  mark,
  source,
  width,
  height,
  pageWidth,
  pageHeight,
  disabled,
  onPatch,
  onDone,
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
}) {
  useLanguage();
  const typography = useEditorTypography(mark, source),
    input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  useEffect(() => {
    const field = input.current;
    if (field && !disabled) {
      field.focus({ preventScroll: true });
      field.setSelectionRange(field.value.length, field.value.length);
    }
  }, [mark.id, disabled]);
  function update(text: string) {
    const patch: Partial<Mark> = { text };
    const font = typography.resolution?.font;
    if (font && !composing.current) {
      const layout = layoutEditorText(
        { ...mark, text },
        pageWidth,
        pageHeight,
        font.measure,
        font.measureDescent(mark.text || ''),
      );
      if (layout.requiredHeight > layout.geometry.height) {
        if ((mark.textRotation || 0) % 180)
          patch.w = Math.min(
            1 - mark.x,
            Math.max(mark.w, (layout.requiredHeight + layout.size * 0.08) / pageWidth),
          );
        else
          patch.h = Math.min(
            1 - mark.y,
            Math.max(mark.h, (layout.requiredHeight + layout.size * 0.08) / pageHeight),
          );
      }
    }
    onPatch(mark.id, patch, 'typing');
  }
  return (
    <textarea
      ref={input}
      className="editor-inline-input"
      aria-label={ui('Text direkt in der PDF bearbeiten')}
      data-editor-history="true"
      disabled={disabled}
      value={mark.text || ''}
      maxLength={20000}
      spellCheck={false}
      style={{
        ...editorTextCss(mark, width, height, typography.resolution),
        ...(!editorMarkChanged(mark)
          ? { color: 'transparent', caretColor: mark.color || '#222222' }
          : {}),
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        update(e.currentTarget.value);
      }}
      onChange={(e) => update(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing || composing.current) return;
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          onDone();
        }
        if ((e.ctrlKey || e.metaKey) && ['b', 'i'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          onPatch(
            mark.id,
            e.key.toLowerCase() === 'b' ? { bold: !mark.bold } : { italic: !mark.italic },
          );
        }
      }}
    />
  );
}
