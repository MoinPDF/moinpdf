'use client';
import { useEffect, useRef, useState } from 'react';
import type { Source, PageItem } from '@/lib/pdf-engine';
import type { Edits } from '@/lib/studio-engine';
import type { AutoFlowPlan, AutoFlowPagePlan } from '@/lib/editor-auto-flow';
import { prepareEditorAutoWorkspace } from '@/lib/editor-auto-workspace';
import { MarkContent } from './editor-canvas';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';

function FlowMiniature({ slot, source }: { slot: AutoFlowPagePlan; source: Source }) {
  const root = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(280);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const height = (width * slot.height) / slot.width;
  return (
    <div
      ref={root}
      className="editor-flow-page"
      aria-label={`${ui('Textlayout')} ${slot.slot + 1}`}
      style={{
        height,
        position: 'relative',
        background: '#fff',
        color: '#111',
        border: '1px solid #ccc',
      }}
    >
      {slot.chunks
        .filter((c) => !c.deletionOnly)
        .map((c) => (
          <div
            key={c.mark.id}
            style={{
              position: 'absolute',
              left: `${c.mark.x * 100}%`,
              top: `${c.mark.y * 100}%`,
              width: `${c.mark.w * 100}%`,
              height: `${c.mark.h * 100}%`,
              outline: '1px dashed #0f766e',
            }}
          >
            <MarkContent
              mark={c.mark}
              width={width}
              height={height}
              pageWidth={slot.width}
              source={source}
            />
          </div>
        ))}
    </div>
  );
}
export function EditorAutoFlowPanel({
  sources,
  pages,
  edits,
  pageId,
  markId,
  disabled,
  onApply,
}: {
  sources: Source[];
  pages: PageItem[];
  edits: Edits;
  pageId: string;
  markId: string;
  disabled: boolean;
  onApply: (plan: AutoFlowPlan) => Promise<void>;
}) {
  const [automatic, setAutomatic] = useState(true);
  const [bottom, setBottom] = useState(85),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [proposal, setProposal] = useState<{ key: string; plan: AutoFlowPlan } | null>(null);
  const controller = useRef<AbortController | null>(null),
    key = JSON.stringify([pages, edits, pageId, markId, bottom, automatic]);
  useEffect(() => {
    controller.current?.abort();
    setBusy(false);
    setProposal(null);
  }, [key]);
  useEffect(() => () => controller.current?.abort(), []);
  const page = pages.find((p) => p.id === pageId),
    source = sources.find((s) => s.id === page?.sourceId),
    mark = (edits.marks[pageId] || []).find((m) => m.id === markId);
  async function preview() {
    if (!page || !source || !mark) return;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setBusy(true);
    setError('');
    setProposal(null);
    try {
      const plan = await prepareEditorAutoWorkspace(
        source,
        page,
        edits.marks[page.id] || [],
        mark.id,
        automatic ? 0 : bottom / 100,
        pages.length,
        ctrl.signal,
      );
      ctrl.signal.throwIfAborted();
      setProposal({ key, plan });
    } catch (error) {
      if (!ctrl.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : 'Der Absatzfluss konnte nicht vorbereitet werden.',
        );
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }
  return (
    <details className="editor-workflow-section">
      <summary>{ui('Absatz über Seiten fortsetzen')}</summary>
      <p>
        {ui(
          'Die Vorschau bestimmt einen freien Textbereich, verschiebt folgende Absätze in derselben Spalte und fügt bei Bedarf Fortsetzungsseiten ein. Schriftgrößen bleiben erhalten.',
        )}
      </p>
      <details>
        <summary>{ui('Textbereich anpassen')}</summary>
        <label>
          <input
            type="checkbox"
            checked={automatic}
            disabled={disabled || busy}
            onChange={(e) => setAutomatic(e.target.checked)}
          />
          {ui('Textgrenze automatisch bestimmen')}
        </label>
        <label className="field">
          <span>{ui('Untere Textgrenze in Prozent der Seitenhöhe')}</span>
          <input
            aria-label={ui('Untere Textgrenze in Prozent der Seitenhöhe')}
            type="number"
            min={20}
            max={95}
            value={bottom}
            disabled={automatic || disabled || busy}
            onChange={(e) => setBottom(Number(e.target.value))}
          />
        </label>
        <p className="fine-note">
          {ui(
            'Die Grenze oberhalb der Fußzeile setzen. Kopfzeilen, Fußzeilen und andere Spalten werden nicht auf neue Seiten kopiert.',
          )}
        </p>
      </details>
      <Button
        variant="outline"
        disabled={disabled || busy || !mark?.sourceRect || mark.kind !== 'text' || !!mark.flow}
        onClick={() => void preview()}
      >
        {ui(busy ? 'Absatzfluss wird geprüft …' : 'Absatzfluss vorschauen')}
      </Button>
      {error && <p role="alert">{ui(error)}</p>}
      {proposal && proposal.key === key && (
        <div className="editor-flow-preview">
          <p>
            {ui('Neue Fortsetzungsseiten')}: {proposal.plan.pages.length - 1} ·{' '}
            {ui('Betroffene Absätze')}: {proposal.plan.affectedParagraphIds.length}
          </p>
          {proposal.plan.pages.map((slot) => (
            <div key={slot.pageId}>
              <strong>
                {ui('Seite')} {pages.findIndex((p) => p.id === pageId) + 1 + slot.slot}
              </strong>
              {source && <FlowMiniature slot={slot} source={source} />}
              {slot.chunks
                .filter((c) => !c.deletionOnly)
                .map((c) => (
                  <p key={c.mark.id} style={{ whiteSpace: 'pre-wrap' }}>
                    {c.mark.text}
                  </p>
                ))}
            </div>
          ))}
          <Button
            disabled={disabled || busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await onApply(proposal.plan);
                setProposal(null);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : 'Der Absatzfluss konnte nicht übernommen werden.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {ui('Absatzfluss übernehmen')}
          </Button>
        </div>
      )}
    </details>
  );
}
