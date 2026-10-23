'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import type { Mark, Rect } from '@/lib/studio-engine';
import type { Source, PageItem } from '@/lib/pdf-engine';
import { editorTextGeometry, layoutEditorText } from '@/lib/editor-text-layer';
import { richEditorLayout } from '@/lib/editor-rich-layout';
import { editorLayoutPlan, fitEditorLayout } from '@/lib/editor-layout-plan';
import { editorSegments, replaceEditorRange } from '@/lib/editor-rich-text';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { editorTextCss, useEditorTypography, type EditorPatch } from './editor-typography';

export function EditorOriginalSnippet({
  url,
  rect,
  width,
  height,
}: {
  url: string;
  rect: Rect;
  width: number;
  height: number;
}) {
  return (
    <div
      className="editor-original-snippet"
      style={{ aspectRatio: `${rect.w * width} / ${rect.h * height}` }}
    >
      {url && (
        <img
          alt={ui('Originalausschnitt')}
          src={url}
          style={{
            position: 'absolute',
            width: `${100 / rect.w}%`,
            maxWidth: 'none',
            height: 'auto',
            left: `${(-100 * rect.x) / rect.w}%`,
            top: `${(-100 * rect.y) / rect.h}%`,
          }}
        />
      )}
    </div>
  );
}
export function EditorLayoutHelp({
  mark,
  source,
  width,
  height,
  onPatch,
  page,
  marks = [],
}: {
  mark: Mark;
  source: Source;
  width: number;
  height: number;
  onPatch: EditorPatch;
  page?: PageItem;
  marks?: Mark[];
}) {
  const [heightError, setHeightError] = useState(''),
    [heightBusy, setHeightBusy] = useState(false);
  const [proposal, setProposal] = useState<Partial<Mark> | null>(null),
    candidate = useMemo(() => ({ ...mark, ...proposal }), [mark, proposal]);
  const heightController = useRef<AbortController | null>(null);
  useEffect(() => {
    heightController.current?.abort();
    setProposal(null);
    setHeightBusy(false);
    setHeightError('');
    return () => heightController.current?.abort();
  }, [mark, source, page]);
  const typography = useEditorTypography(candidate, source),
    font = typography.resolution?.font;
  const geometry = editorTextGeometry(candidate, width, height, candidate.textRotation);
  const layout = font
    ? candidate.runs?.length && typography.runs
      ? richEditorLayout(
          candidate,
          width,
          geometry.width / (candidate.textScaleX || 1) -
            2 * (candidate.insetScale || 0) * (candidate.fontScale || 0.028) * width,
          typography.runs,
        )
      : layoutEditorText(
          candidate,
          width,
          height,
          font.measure,
          font.measureDescent(candidate.text || ''),
        )
    : undefined;
  const prepared =
    typography.runs ||
    (typography.resolution
      ? [
          {
            start: 0,
            end: (candidate.text || '').length,
            style: {},
            resolution: typography.resolution,
          },
        ]
      : []);
  const overflow =
    !!prepared.length && editorLayoutPlan(candidate, width, height, prepared).overflow;
  function reflow() {
    let next = { ...mark };
    const breaks = [...(next.text || '').matchAll(/(?<!\n)\n(?!\n)/gu)].reverse();
    for (const match of breaks)
      next = { ...next, ...replaceEditorRange(next, match.index!, match.index! + 1, ' ') };
    setProposal({ text: next.text, runs: next.runs });
  }
  return (
    <details className="editor-layout-help">
      <summary>
        {ui('Layout anpassen')}
        {overflow ? ` · ${ui('Textfeld zu klein')}` : ''}
      </summary>
      <p>
        {ui(
          'Anpassung zuerst ansehen und anschließend übernehmen. Andere Textfelder werden nicht verschoben.',
        )}
      </p>
      <div className="editor-review-actions">
        <Button
          size="sm"
          variant="outline"
          disabled={
            !overflow || typography.pending || !fitEditorLayout(candidate, width, height, prepared)
          }
          onClick={() => setProposal(fitEditorLayout(candidate, width, height, prepared))}
        >
          {ui('Schrift passend verkleinern')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!layout || !!mark.textRotation || !page || heightBusy}
          onClick={async () => {
            if (!page) return;
            heightController.current?.abort();
            const ctrl = new AbortController();
            heightController.current = ctrl;
            setHeightBusy(true);
            setHeightError('');
            try {
              const patch = await (
                await import('@/lib/editor-preflight')
              ).safeEditorHeight(source, page, candidate, marks, ctrl.signal);
              if (!ctrl.signal.aborted) setProposal({ ...proposal, ...patch });
            } catch (error) {
              if (!ctrl.signal.aborted)
                setHeightError(
                  error instanceof Error
                    ? error.message
                    : 'Die Höhenanpassung konnte nicht vorbereitet werden.',
                );
            } finally {
              if (!ctrl.signal.aborted) setHeightBusy(false);
            }
          }}
        >
          {ui('Textfeld vergrößern')}
        </Button>
        {heightError && <p role="status">{ui(heightError)}</p>}
        <Button size="sm" variant="outline" onClick={reflow}>
          {ui('Zeilen neu umbrechen')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!font}
          onClick={() => {
            const factor = 0.9;
            setProposal({
              fontScale: (candidate.fontScale || 0.028) * factor,
              runs: candidate.runs?.map((r) => ({
                ...r,
                style: {
                  ...r.style,
                  fontScale: (r.style.fontScale || candidate.fontScale || 0.028) * factor,
                },
              })),
            });
          }}
        >
          {ui('Schrift etwas verkleinern')}
        </Button>
      </div>
      {proposal && (
        <>
          <div
            className="editor-layout-sample"
            aria-label={ui('Anpassungsvorschau')}
            style={{
              height: Math.min(220, Math.max(50, geometry.height)),
              position: 'relative',
              overflow: 'auto',
            }}
          >
            <span
              className="editor-text-content"
              style={{
                ...editorTextCss(candidate, width, height, typography.resolution),
                position: 'relative',
                left: 0,
                top: 0,
                transform: 'none',
                display: 'block',
                width: geometry.width / (candidate.textScaleX || 1),
              }}
            >
              {editorSegments(candidate).map((run, i) => (
                <span
                  key={i}
                  style={{
                    fontWeight: run.style.bold ? 700 : 400,
                    fontStyle: run.style.italic ? 'italic' : 'normal',
                    color: run.style.color,
                    fontSize: (run.style.fontScale || candidate.fontScale || 0.028) * width,
                    fontFamily: typography.runs?.[i]
                      ? `"${typography.runs[i].resolution.font.cssFamily}"`
                      : undefined,
                  }}
                >
                  {(candidate.text || '').slice(run.start, run.end)}
                </span>
              ))}
            </span>
          </div>
          <p role="status">
            {ui(
              overflow
                ? 'Der Text passt noch nicht vollständig in das Textfeld.'
                : 'Die Anpassung wird in der Seitenvorschau übernommen. Überschneidungen werden dort geprüft.',
            )}
          </p>
          <div className="editor-review-actions">
            <Button
              size="sm"
              disabled={!!typography.error || typography.pending}
              onClick={() => {
                onPatch(mark.id, proposal);
                setProposal(null);
              }}
            >
              {ui('Übernehmen')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
              {ui('Verwerfen')}
            </Button>
          </div>
        </>
      )}
    </details>
  );
}
