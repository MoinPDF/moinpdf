'use client';
import { useState } from 'react';
import type { Source } from '@/lib/pdf-engine';
import { uid } from '@/lib/pdf-engine';
import type { Mark } from '@/lib/studio-engine';
import { joinEditorBlocks, splitEditorBlock } from '@/lib/editor-blocks';
import { prepareEditorLayout } from '@/lib/editor-layout-plan';
import { replaceEditorRange, type EditorSelection } from '@/lib/editor-rich-text';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';

export function EditorBlockTools({
  source,
  width,
  height,
  choices,
  chosen,
  joining,
  selected,
  selection,
  disabled,
  onJoining,
  onToggle,
  onApply,
}: {
  source: Source;
  width: number;
  height: number;
  choices: { key: string; mark: Mark; existing: boolean }[];
  chosen: string[];
  joining: boolean;
  selected?: Mark;
  selection?: EditorSelection | null;
  disabled: boolean;
  onJoining: (value: boolean) => void;
  onToggle: (key: string) => void;
  onApply: (remove: string[], add: Mark[]) => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<{ original: Mark; parts: [Mark, Mark] } | null>(null);
  const entries = choices.filter((c) => chosen.includes(c.key));
  let joined: Mark | undefined,
    joinError = '';
  if (entries.length > 1)
    try {
      joined = joinEditorBlocks(
        entries.map((c) => c.mark),
        width,
        height,
        'joined-preview',
      );
    } catch (e) {
      joinError = (e as Error).message;
    }
  const at = selection && selection.id === selected?.id ? selection.start : 0;
  const validProposal = proposal?.original === selected ? proposal : null;
  async function split() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const text = selected.text || '';
      const first = { ...selected, ...replaceEditorRange(selected, at, text.length, '') };
      const second = { ...selected, ...replaceEditorRange(selected, 0, at, '') };
      const plans = await Promise.all(
        [first, second].map((m) => prepareEditorLayout(m, width, height, source)),
      );
      const parts = splitEditorBlock(
        selected,
        at,
        Math.max(2, plans[0].requiredHeight + 2),
        Math.max(2, plans[1].requiredHeight + 2),
        height,
        uid(),
      );
      setProposal({ original: selected, parts });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor-block-tools" aria-label={ui('Textfelder verbinden und trennen')}>
      <div className="editor-review-actions">
        <Button
          size="sm"
          variant={joining ? 'secondary' : 'outline'}
          aria-pressed={joining}
          disabled={disabled || busy}
          onClick={() => {
            onJoining(!joining);
            setProposal(null);
            setError('');
          }}
        >
          {ui(joining ? 'Verbinden beenden' : 'Textstellen verbinden')}
        </Button>
        {selected && !joining && (
          <Button
            size="sm"
            variant="outline"
            disabled={
              disabled ||
              busy ||
              !at ||
              at >= (selected.text || '').length ||
              !!selected.textRotation
            }
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => void split()}
          >
            {ui('Am Textcursor trennen')}
          </Button>
        )}
      </div>
      {joining && (
        <>
          <p>
            {ui(
              'Textstellen auf dieser Seite anklicken. Die Auswahl wird in Leserichtung verbunden; andere Inhalte bleiben an ihrer Position.',
            )}
          </p>
          <details>
            <summary>
              {ui('Textstellen als Liste auswählen')} ({entries.length})
            </summary>
            <div className="editor-block-list">
              {choices.map((c) => (
                <label key={c.key}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(c.key)}
                    disabled={disabled || busy}
                    onChange={() => onToggle(c.key)}
                  />
                  <span>{c.mark.text?.slice(0, 180)}</span>
                </label>
              ))}
            </div>
          </details>
          {joined && (
            <>
              <pre
                className="editor-block-preview"
                aria-label={ui('Vorschau des verbundenen Textfelds')}
              >
                {joined.text}
              </pre>
              <Button
                size="sm"
                disabled={disabled || busy}
                onClick={() => {
                  onApply(
                    entries.filter((c) => c.existing).map((c) => c.mark.id),
                    [{ ...joined, id: uid() }],
                  );
                  onJoining(false);
                }}
              >
                {ui('Auswahl verbinden')}
              </Button>
            </>
          )}
          {joinError && <p role="alert">{ui(joinError)}</p>}
        </>
      )}
      {validProposal && (
        <div className="editor-split-preview">
          <p>
            {ui(
              'Das zweite Textfeld beginnt unter dem ersten. Bitte beide Textteile vor dem Übernehmen prüfen.',
            )}
          </p>
          {validProposal.parts.map((m, i) => (
            <pre className="editor-block-preview" key={i}>
              {m.text}
            </pre>
          ))}
          <Button
            size="sm"
            disabled={disabled || busy}
            onClick={() => {
              onApply([validProposal.original.id], validProposal.parts);
              setProposal(null);
            }}
          >
            {ui('Teilung übernehmen')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
            {ui('Verwerfen')}
          </Button>
        </div>
      )}
      {error && <p role="alert">{ui(error)}</p>}
    </section>
  );
}
