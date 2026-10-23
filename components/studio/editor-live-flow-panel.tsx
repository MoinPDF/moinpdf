'use client';
import { useEffect, useRef, useState } from 'react';
import type { Source, PageItem } from '@/lib/pdf-engine';
import type { Edits } from '@/lib/studio-engine';
import { prepareLinkedEditorFlow } from '@/lib/editor-live-flow';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';

export function EditorLiveFlowPanel({
  sources,
  pages,
  edits,
  selectedMarkId,
  disabled,
  onApply,
}: {
  sources: Source[];
  pages: PageItem[];
  edits: Edits;
  selectedMarkId: string;
  disabled: boolean;
  onApply: (edits: Edits) => void;
}) {
  const group = Object.values(edits.marks)
    .flat()
    .find((m) => m.id === selectedMarkId)?.flow?.id;
  const [enabled, setEnabled] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [proposal, setProposal] = useState<
    (Awaited<ReturnType<typeof prepareLinkedEditorFlow>> & { key: string }) | null
  >(null);
  const key = JSON.stringify([sources.map((s) => s.id), pages, edits, group]);
  const current = useRef(key);
  current.current = key;
  useEffect(() => {
    setProposal(null);
    setError('');
    setBusy(false);
    if (!enabled || disabled || !group) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      void prepareLinkedEditorFlow(sources, pages, edits, group, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted && current.current === key && result.changed)
            setProposal({ ...result, key });
        })
        .catch((e) => {
          if (!controller.signal.aborted && current.current === key)
            setError(e instanceof Error ? e.message : 'Textfluss prüfen');
        })
        .finally(() => {
          if (!controller.signal.aborted && current.current === key) setBusy(false);
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, enabled, disabled, group, sources, pages, edits]);
  if (!group) return null;
  return (
    <section className="editor-live-flow" aria-label={ui('Laufende Textflussvorschau')}>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{' '}
        {ui('Textfluss beim Schreiben vorschauen')}
      </label>
      {busy && <p role="status">{ui('Textfluss wird geprüft …')}</p>}
      {error && <p role="alert">{ui(error)}</p>}
      {proposal?.key === key && (
        <>
          <p>{ui('Die Vorschau ist aktuell. Textverteilung prüfen und gemeinsam übernehmen.')}</p>
          <details open>
            <summary>{ui('Vorschau')}</summary>
            {proposal.marks.map(({ pageId, mark }) => (
              <p key={mark.id}>
                <strong>
                  {ui('Seite')} {pages.findIndex((p) => p.id === pageId) + 1}
                </strong>
                <br />
                {mark.text || ui('Leeres Textfeld')}
              </p>
            ))}
          </details>
          <Button
            disabled={disabled || busy}
            onClick={() => {
              if (proposal.key === current.current) onApply(proposal.edits);
            }}
          >
            {ui('Textfluss übernehmen')}
          </Button>
        </>
      )}
    </section>
  );
}
