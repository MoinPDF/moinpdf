'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import { ui } from '@/lib/ui-language';
import { uid, type Source, type PageItem } from '@/lib/pdf-engine';
import type { Edits, Mark } from '@/lib/studio-engine';
import { editorMarkChanged, editorTextCollision, readTextTargets } from '@/lib/editor-model';
import { distributeEditorFlow, type EditorFlowFrame } from '@/lib/editor-workflow';
import { EditorLiveFlowPanel } from './editor-live-flow-panel';
import { EditorAutoFlowPanel } from './editor-auto-flow-panel';
import { EditorPreflightPanel } from './editor-preflight-panel';
import type { AutoFlowPlan } from '@/lib/editor-auto-flow';

export function EditorWorkflowPanel({
  sources,
  pages,
  edits,
  disabled,
  onApply,
  onReveal,
  activePageId,
  selectedMarkId,
  onApplyFlow,
}: {
  sources: Source[];
  pages: PageItem[];
  edits: Edits;
  disabled: boolean;
  onApply: (edits: Edits) => void;
  onReveal: (pageId: string, mark: Mark) => void;
  activePageId: string;
  selectedMarkId: string;
  onApplyFlow: (plan: AutoFlowPlan) => Promise<void>;
}) {
  useLanguage();
  const entries = pages.flatMap((page, index) =>
    (edits.marks[page.id] || []).map((mark) => ({ page, index, mark })),
  );
  const fields = entries.filter((e) => e.mark.kind === 'text' && !e.mark.textRotation);
  const [chosen, setChosen] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [proposal, setProposal] = useState<{
    key: string;
    edits: Edits;
    marks: { pageId: string; mark: Mark }[];
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const key = JSON.stringify([pages, edits, chosen]);
  const groups = new Map<string, typeof entries>();
  for (const e of entries.filter((e) => editorMarkChanged(e.mark))) {
    const id = e.mark.changeGroup || e.mark.id;
    groups.set(id, [...(groups.get(id) || []), e]);
  }
  async function prepare() {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setBusy(true);
    setError('');
    setProposal(null);
    try {
      const frames: EditorFlowFrame[] = [];
      for (const id of chosen) {
        const entry = fields.find((e) => e.mark.id === id);
        if (!entry)
          throw new Error('Die Auswahl hat sich geändert. Bitte die Textfelder erneut wählen.');
        const source = sources.find((s) => s.id === entry.page.sourceId)!;
        const pdfPage = await source.pdf.getPage(entry.page.index + 1);
        const { width, height } = pdfPage.getViewport({
          scale: 1,
          rotation: (pdfPage.rotate + entry.page.rotation) % 360,
        });
        frames.push({ mark: entry.mark, pageId: entry.page.id, width, height, source });
      }
      const redistributed = await distributeEditorFlow(frames, ctrl.signal);
      const group = uid(),
        previousGroups = new Set(frames.map((f) => f.mark.changeGroup).filter(Boolean));
      const next: Edits = {
        ...edits,
        marks: Object.fromEntries(
          Object.entries(edits.marks).map(([pageId, marks]) => [
            pageId,
            marks.map((m) =>
              m.changeGroup && previousGroups.has(m.changeGroup) ? { ...m, changeGroup: group } : m,
            ),
          ]),
        ),
      };
      redistributed.forEach((item, order) => {
        item.mark = { ...item.mark, flow: { id: group, order }, changeGroup: group };
        next.marks[item.pageId] = (next.marks[item.pageId] || []).map((m) =>
          m.id === item.mark.id ? item.mark : m,
        );
      });
      for (const pageId of new Set(redistributed.map((e) => e.pageId))) {
        const frame = frames.find((f) => f.pageId === pageId)!,
          page = pages.find((p) => p.id === pageId)!;
        const { targets } = await readTextTargets(frame.source, page);
        if (
          redistributed
            .filter((e) => e.pageId === pageId)
            .some((e) => editorTextCollision(e.mark, next.marks[pageId], targets))
        )
          throw new Error(
            'Der Textfluss würde einen anderen Inhalt überlappen. Bitte die Zielrahmen verschieben.',
          );
      }
      ctrl.signal.throwIfAborted();
      setProposal({ key, edits: next, marks: redistributed });
    } catch (e) {
      if (!ctrl.signal.aborted)
        setError(e instanceof Error ? e.message : 'Der Textfluss konnte nicht vorbereitet werden.');
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="editor-workflow-panel">
      <EditorLiveFlowPanel
        sources={sources}
        pages={pages}
        edits={edits}
        selectedMarkId={selectedMarkId}
        disabled={disabled}
        onApply={onApply}
      />
      <EditorPreflightPanel
        sources={sources}
        pages={pages}
        edits={edits}
        disabled={disabled}
        onApply={onApply}
        onReveal={onReveal}
      />
      <EditorAutoFlowPanel
        sources={sources}
        pages={pages}
        edits={edits}
        pageId={activePageId}
        markId={selectedMarkId}
        disabled={disabled}
        onApply={onApplyFlow}
      />
      <details className="editor-workflow-section">
        <summary>{ui('Textfelder verknüpfen')}</summary>
        <p>
          {ui(
            'Zuerst Textfelder auf den gewünschten Seiten anklicken oder anlegen. Dann die Flussreihenfolge wählen. Die Vorschau verteilt den Text ohne Verkleinern auf diese Rahmen.',
          )}
        </p>
        <div className="editor-flow-fields">
          {fields.map(({ page, index, mark }) => (
            <label key={mark.id}>
              <input
                type="checkbox"
                checked={chosen.includes(mark.id)}
                disabled={disabled || busy}
                onChange={() => {
                  setProposal(null);
                  setChosen((old) =>
                    old.includes(mark.id) ? old.filter((id) => id !== mark.id) : [...old, mark.id],
                  );
                }}
              />
              <span>
                {ui('Seite')} {index + 1} · {(mark.text || ui('Leeres Textfeld')).slice(0, 65)}
              </span>
              <button type="button" disabled={disabled} onClick={() => onReveal(page.id, mark)}>
                {ui('Anzeigen')}
              </button>
            </label>
          ))}
        </div>
        <ol>
          {chosen.map((id, i) => (
            <li key={id}>
              {(fields.find((f) => f.mark.id === id)?.mark.text || ui('Leeres Textfeld')).slice(
                0,
                40,
              )}{' '}
              <button
                type="button"
                disabled={disabled || busy || i === 0}
                aria-label={ui('Textfeld früher im Textfluss')}
                onClick={() =>
                  setChosen((old) => {
                    const next = [...old];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    return next;
                  })
                }
              >
                ↑
              </button>
              <button
                type="button"
                disabled={disabled || busy || i === chosen.length - 1}
                aria-label={ui('Textfeld später im Textfluss')}
                onClick={() =>
                  setChosen((old) => {
                    const next = [...old];
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    return next;
                  })
                }
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
        <Button
          variant="outline"
          disabled={disabled || busy || chosen.length < 2}
          onClick={() => void prepare()}
        >
          {ui(busy ? 'Textfluss wird geprüft …' : 'Textfluss vorschauen')}
        </Button>
        {error && <p role="alert">{ui(error)}</p>}
        {proposal && proposal.key === key && (
          <div className="editor-flow-preview">
            {proposal.marks.map(({ pageId, mark }) => (
              <p key={mark.id}>
                <strong>
                  {ui('Seite')} {pages.findIndex((p) => p.id === pageId) + 1}
                </strong>
                <br />
                {mark.text || ui('Leeres Textfeld')}
              </p>
            ))}
            <Button
              disabled={disabled}
              onClick={() => {
                onApply(proposal.edits);
                setProposal(null);
              }}
            >
              {ui('Textfluss übernehmen')}
            </Button>
          </div>
        )}
        <p className="fine-note">
          {ui(
            'Verknüpften Text auswählen: Die Textflussvorschau aktualisiert sich beim Schreiben. Änderungen nach Prüfung gemeinsam übernehmen. Rahmen, Seiten und Tabellen bleiben fest.',
          )}
        </p>
      </details>
      <details className="editor-workflow-section">
        <summary>
          {ui('Änderungen im Dokument')} · {groups.size}
        </summary>
        {!groups.size && <p>{ui('Noch keine Änderungen.')}</p>}
        {[...groups.entries()].map(([id, items]) => (
          <div key={id} className="editor-change-entry">
            {items.map(({ page, index, mark }) => (
              <div key={mark.id}>
                <button type="button" disabled={disabled} onClick={() => onReveal(page.id, mark)}>
                  {ui('Seite')} {index + 1} ·{' '}
                  {ui(
                    mark.kind === 'text' ? 'Textfeld' : mark.kind === 'image' ? 'Bild' : 'Bereich',
                  )}
                </button>
                {mark.kind === 'text' && (
                  <>
                    <div>
                      <strong>{ui('Vorher')}: </strong>
                      {(mark.originalText || '—').slice(0, 180)}
                    </div>
                    <div>
                      <strong>{ui('Nachher')}: </strong>
                      {(mark.text || '—').slice(0, 180)}
                    </div>
                  </>
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                const ids = new Set(items.map((e) => e.mark.id));
                const next = {
                  ...edits,
                  marks: Object.fromEntries(
                    Object.entries(edits.marks).map(([pageId, marks]) => [
                      pageId,
                      marks.filter((m) => !ids.has(m.id)),
                    ]),
                  ),
                };
                onApply(next);
              }}
            >
              {ui(
                items.length > 1
                  ? 'Verbundene Änderungen zurücknehmen'
                  : 'Diese Änderung zurücknehmen',
              )}
            </Button>
          </div>
        ))}
      </details>
    </div>
  );
}
