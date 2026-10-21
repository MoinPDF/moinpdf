'use client';
import { useEffect, useRef, useState } from 'react';
import type { Source, PageItem } from '@/lib/pdf-engine';
import type { Edits } from '@/lib/studio-engine';
import type { AutoFlowPlan } from '@/lib/editor-auto-flow';
import { prepareEditorAutoWorkspace } from '@/lib/editor-auto-workspace';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';

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
  const [bottom, setBottom] = useState(85),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [proposal, setProposal] = useState<{ key: string; plan: AutoFlowPlan } | null>(null);
  const controller = useRef<AbortController | null>(null),
    key = JSON.stringify([pages, edits, pageId, markId, bottom]);
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
        bottom / 100,
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
          'Im Absatzmodus einen vollständigen digitalen Absatz auswählen. Die Vorschau verschiebt folgende Absätze in derselben Spalte und fügt bei Bedarf leere Fortsetzungsseiten ein. Schriftgrößen bleiben erhalten.',
        )}
      </p>
      <label className="field">
        <span>{ui('Untere Textgrenze in Prozent der Seitenhöhe')}</span>
        <input
          aria-label={ui('Untere Textgrenze in Prozent der Seitenhöhe')}
          type="number"
          min={20}
          max={95}
          value={bottom}
          disabled={disabled || busy}
          onChange={(e) => setBottom(Number(e.target.value))}
        />
      </label>
      <p className="fine-note">
        {ui(
          'Die Grenze oberhalb der Fußzeile setzen. Kopfzeilen, Fußzeilen und andere Spalten werden nicht auf neue Seiten kopiert.',
        )}
      </p>
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
            {ui('Neue Fortsetzungsseiten')}: {proposal.plan.pages.length - 1}
          </p>
          {proposal.plan.pages.map((slot) => (
            <div key={slot.pageId}>
              <strong>
                {ui('Seite')} {pages.findIndex((p) => p.id === pageId) + 1 + slot.slot}
              </strong>
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
