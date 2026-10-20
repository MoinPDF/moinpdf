'use client';
import { useEffect, useRef, useState } from 'react';
import type { Mark } from '@/lib/studio-engine';
import type { Source } from '@/lib/pdf-engine';
import { editorFontCatalog } from '@/lib/editor-font-catalog';
import {
  applyEditorPatch,
  editorSegments,
  editorSelectionStyle,
  type EditorSelection,
} from '@/lib/editor-rich-text';
import { prepareEditorLayout } from '@/lib/editor-layout-plan';
import { loadEditorCssFont } from '@/lib/editor-fonts';
import { editorTextCss, useEditorTypography, type EditorPatch } from './editor-typography';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';

type Alternative = {
  name: string;
  mark: Mark;
  patch: Partial<Mark>;
  lines: number;
  overflow: boolean;
  difference: number;
};
function Sample({
  mark,
  source,
  width,
  height,
}: {
  mark: Mark;
  source: Source;
  width: number;
  height: number;
}) {
  const t = useEditorTypography(mark, source);
  const scale = Math.min(1, 320 / Math.max(1, mark.w * width));
  return (
    <div
      className="editor-alternative-sample"
      style={{ height: Math.min(150, Math.max(45, mark.h * height * scale)) }}
    >
      <div
        style={{
          ...editorTextCss({ ...mark, x: 0, y: 0 }, width * scale, height * scale, t.resolution),
          position: 'relative',
          left: 0,
          top: 0,
        }}
      >
        {editorSegments(mark).map((r, i) => (
          <span
            key={i}
            style={{
              fontFamily: t.runs?.[i] ? `"${t.runs[i].resolution.font.cssFamily}"` : undefined,
              fontSize: (r.style.fontScale || mark.fontScale || 0.028) * width * scale,
              fontWeight: r.style.bold ? 700 : 400,
              fontStyle: r.style.italic ? 'italic' : 'normal',
              color: r.style.color,
            }}
          >
            {(mark.text || '').slice(r.start, r.end)}
          </span>
        ))}
      </div>
    </div>
  );
}
export function EditorFontAlternatives({
  mark,
  source,
  width,
  height,
  selection,
  disabled,
  onPatch,
}: {
  mark: Mark;
  source: Source;
  width: number;
  height: number;
  selection?: EditorSelection | null;
  disabled: boolean;
  onPatch: EditorPatch;
}) {
  const [alternatives, setAlternatives] = useState<Alternative[]>([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setAlternatives([]);
    setPending(false);
    setError('');
  }, [mark, selection?.start, selection?.end, source]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function compare() {
    const token = ++generation.current;
    setPending(true);
    setError('');
    try {
      const context = editorSelectionStyle(mark, selection);
      const base = await prepareEditorLayout(mark, width, height, source);
      const baseWidth = Math.max(
        0.001,
        ...base.pieces.map((p) => p.x + p.font.measure(p.text, p.size)),
      );
      const results = await Promise.all(
        editorFontCatalog
          .filter((f) => f.family === (context.style.fontFamily || 'sans'))
          .map(async (f): Promise<Alternative | null> => {
            try {
              const patch: Partial<Mark> = {
                fontChoice: f.id,
                fontFamily: f.family,
                tracking: 0,
                textScaleX: 1,
              };
              const candidate = { ...mark, ...applyEditorPatch(mark, patch, selection) };
              const layout = await prepareEditorLayout(candidate, width, height, source);
              for (const piece of layout.pieces) await loadEditorCssFont(piece.font, source);
              const inkWidth = Math.max(
                0.001,
                ...layout.pieces.map((p) => p.x + p.font.measure(p.text, p.size)),
              );
              return {
                name: f.name,
                mark: candidate,
                patch,
                lines: layout.lineCount,
                overflow: layout.overflow,
                difference: Math.abs(inkWidth / baseWidth - 1),
              };
            } catch {
              return null;
            }
          }),
      );
      if (token === generation.current) {
        const valid = results
          .filter((r): r is Alternative => !!r)
          .sort((a, b) => Number(a.overflow) - Number(b.overflow) || a.difference - b.difference)
          .slice(0, 3);
        setAlternatives(valid);
        if (!valid.length)
          setError('Keine passende lokale Ersatzschrift für diese Zeichen gefunden.');
      }
    } catch (e) {
      if (token === generation.current) setError((e as Error).message);
    } finally {
      if (token === generation.current) setPending(false);
    }
  }
  return (
    <div className="editor-font-alternatives">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || pending}
        onClick={() => void compare()}
      >
        {ui(
          pending
            ? 'Schriftvorschläge werden vorbereitet …'
            : 'Passende Ersatzschriften vergleichen',
        )}
      </Button>
      {alternatives.length > 0 && (
        <>
          <p>
            {ui(
              'Vorschläge aus lokalen Schriften. Vergleiche Form und Umbruch mit dem Original. Eine Markierung begrenzt die Schriftänderung auf den ausgewählten Text.',
            )}
          </p>
          <div className="editor-font-alternative-grid">
            {alternatives.map((a) => (
              <article key={a.name}>
                <strong>{a.name}</strong>
                <Sample mark={a.mark} source={source} width={width} height={height} />
                <small>
                  {ui('Zeilen')}: {a.lines} ·{' '}
                  {ui(a.overflow ? 'Textfeld zu klein' : 'Passt in das Textfeld')}
                </small>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => onPatch(mark.id, a.patch)}
                >
                  {ui('Diese Schrift verwenden')}
                </Button>
              </article>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert">{ui(error)}</p>}
    </div>
  );
}
