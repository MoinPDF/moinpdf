'use client';
import { useEffect, useRef, useState } from 'react';
import type { Mark } from '@/lib/studio-engine';
import type { Source, PageItem } from '@/lib/pdf-engine';
import { editorFontCatalog } from '@/lib/editor-font-catalog';
import {
  applyEditorPatch,
  editorSelectionStyle,
  type EditorSelection,
} from '@/lib/editor-rich-text';
import { prepareEditorLayout } from '@/lib/editor-layout-plan';
import { loadEditorCssFont, resolveEditorFont } from '@/lib/editor-fonts';
import { EditorTextPreview, useEditorTypography, type EditorPatch } from './editor-typography';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { editorFontMatchScore } from '@/lib/editor-font-match';

type Alternative = {
  name: string;
  mark: Mark;
  patch: Partial<Mark>;
  lines: number;
  overflow: boolean;
  difference: number;
  shape?: number;
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
      {t.runs && (
        <EditorTextPreview
          mark={mark}
          width={width * scale}
          height={height * scale}
          pageWidth={width}
          runs={t.runs}
        />
      )}
    </div>
  );
}
export function EditorFontAlternatives({
  mark,
  page,
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
  page?: Pick<PageItem, 'index' | 'rotation'>;
  selection?: EditorSelection | null;
  disabled: boolean;
  onPatch: EditorPatch;
}) {
  const [alternatives, setAlternatives] = useState<Alternative[]>([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    generation.current++;
    controller.current?.abort();
    setAlternatives([]);
    setPending(false);
    setError('');
  }, [mark, selection?.start, selection?.end, source]);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  async function compare() {
    const token = ++generation.current;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setPending(true);
    setError('');
    try {
      const context = editorSelectionStyle(mark, selection);
      const base = await prepareEditorLayout(mark, width, height, source);
      const shapeMatch = page
        ? await (
            await import('@/lib/editor-font-match')
          )
            .prepareEditorFontMatch(
              mark,
              source,
              page,
              ctrl.signal,
              context.selected && selection
                ? {
                    text: (mark.text || '').slice(selection.start, selection.end),
                    originalFontId: context.style.originalFontId,
                    originalFontPage: context.style.originalFontPage,
                  }
                : undefined,
            )
            .catch(() => null)
        : null;
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
              ctrl.signal.throwIfAborted();
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
                shape:
                  shapeMatch && layout.pieces[0]
                    ? await shapeMatch(
                        (
                          await resolveEditorFont(
                            {
                              ...mark,
                              ...context.style,
                              ...patch,
                              text:
                                context.selected && selection
                                  ? (mark.text || '').slice(selection.start, selection.end)
                                  : mark.text || '',
                            },
                            source,
                          )
                        ).font,
                      )
                    : undefined,
              };
            } catch {
              return null;
            }
          }),
      );
      if (token === generation.current) {
        const valid = results
          .filter((r): r is Alternative => !!r)
          .sort(
            (a, b) =>
              editorFontMatchScore(a) - editorFontMatchScore(b) || a.name.localeCompare(b.name),
          )
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
            {alternatives.map((a, index) => (
              <article key={a.name}>
                <strong>{a.name}</strong>
                {index === 0 && !a.overflow && (
                  <span>{ui('Beste Übereinstimmung der geprüften Schriften')}</span>
                )}
                <Sample mark={a.mark} source={source} width={width} height={height} />
                <small>
                  {a.shape !== undefined && <>{ui('Mit Originalschriftbild verglichen')} · </>}
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
