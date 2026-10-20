'use client';
import { useEffect, useRef, useState } from 'react';
import type { PageItem, Source } from '@/lib/pdf-engine';
import type { Edits, Rect } from '@/lib/studio-engine';
import {
  editorDocumentFingerprint,
  findEditorDocument,
  indexEditorDocument,
  replaceEditorDocument,
  type EditorDocumentIndex,
  type EditorDocumentMatch,
} from '@/lib/editor-document-search';
import { prepareEditorLayout } from '@/lib/editor-layout-plan';
import { editorTextCollision } from '@/lib/editor-model';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';

export function EditorDocumentSearch({
  sources,
  pages,
  edits,
  language,
  disabled,
  onApply,
  onReveal,
  onClose,
}: {
  sources: Source[];
  pages: PageItem[];
  edits: Edits;
  language: string;
  disabled: boolean;
  onApply: (next: Edits, fingerprint: string) => void;
  onReveal: (pageId: string, rect: Rect) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(''),
    [replacement, setReplacement] = useState(''),
    [scans, setScans] = useState(false),
    [matchCase, setMatchCase] = useState(false),
    [wholeWord, setWholeWord] = useState(false);
  const [index, setIndex] = useState<EditorDocumentIndex | null>(null),
    [chosen, setChosen] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [error, setError] = useState(''),
    [offset, setOffset] = useState(0);
  const controller = useRef<AbortController | null>(null),
    version = useRef(0),
    latest = useRef({ sources, pages, edits, onApply, disabled });
  latest.current = { sources, pages, edits, onApply, disabled };
  const fingerprint = editorDocumentFingerprint(sources, pages, edits);
  useEffect(() => {
    version.current++;
    controller.current?.abort();
    setIndex(null);
    setChosen([]);
    setBusy(false);
    setProgress('');
    setError('');
  }, [fingerprint, language, scans]);
  useEffect(
    () => () => {
      version.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    setChosen([]);
    setOffset(0);
  }, [query, matchCase, wholeWord]);
  let hits: EditorDocumentMatch[] = [],
    searchError = '';
  if (index)
    try {
      hits = findEditorDocument(index, query, matchCase, wholeWord);
    } catch (e) {
      searchError = (e as Error).message;
    }
  async function scan() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const token = ++version.current;
    setBusy(true);
    setError('');
    setIndex(null);
    setChosen([]);
    try {
      const result = await indexEditorDocument(
        sources,
        pages,
        edits,
        language,
        scans,
        c.signal,
        (page, total) => {
          if (token === version.current) setProgress(`${page} / ${total}`);
        },
      );
      if (token === version.current) setIndex(result);
    } catch (e) {
      if (!c.signal.aborted && token === version.current) setError((e as Error).message);
    } finally {
      if (token === version.current) {
        setBusy(false);
        setProgress('');
      }
    }
  }
  async function replace() {
    if (!index || disabled) return;
    const token = ++version.current,
      c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError('');
    try {
      const selected = hits.filter((h) => chosen.includes(h.id));
      const result = replaceEditorDocument(index, selected, replacement, edits);
      for (const { block, mark } of result.changes) {
        c.signal.throwIfAborted();
        const source = sources.find((s) => s.id === block.sourceId)!;
        const layout = await prepareEditorLayout(mark, block.width, block.height, source);
        if (
          layout.overflow ||
          editorTextCollision(
            mark,
            result.edits.marks[block.pageId],
            index.pageTargets[block.pageId] || [],
          )
        )
          throw new Error(
            ui('Ersetzung passt nicht in das Layout auf Seite') +
              ` ${block.pageNumber}. ` +
              ui('Bitte kürzeren Ersatztext verwenden oder diesen Treffer abwählen.'),
          );
      }
      const now = latest.current;
      if (
        token !== version.current ||
        now.disabled ||
        index.fingerprint !== editorDocumentFingerprint(now.sources, now.pages, now.edits)
      )
        return;
      now.onApply(result.edits, index.fingerprint);
      setIndex(null);
      setChosen([]);
      setProgress(ui('Ersetzt') + `: ${selected.length}`);
    } catch (e) {
      if (!c.signal.aborted && token === version.current) setError((e as Error).message);
    } finally {
      if (token === version.current) setBusy(false);
    }
  }
  const choose = (id: string) =>
    setChosen((old) => (old.includes(id) ? old.filter((x) => x !== id) : [...old, id]));
  return (
    <section
      className="editor-document-search"
      aria-label={ui('Dokument durchsuchen und ersetzen')}
    >
      <div className="editor-review-actions">
        <strong>{ui('Suchen im gesamten Dokument')}</strong>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {ui('Schließen')}
        </Button>
      </div>
      <p>
        {ui(
          'Alle geladenen Seiten durchsuchen. Treffer vor dem Ersetzen auswählen und auf der Seite prüfen. Sammeländerungen lassen sich gemeinsam rückgängig machen.',
        )}
      </p>
      <div className="editor-search-fields">
        <label>
          {ui('Suchtext')}
          <input
            aria-label={ui('Suchtext im Dokument')}
            value={query}
            maxLength={256}
            disabled={disabled || busy}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          {ui('Ersetzen durch')}
          <input
            aria-label={ui('Ersatztext im Dokument')}
            value={replacement}
            maxLength={20000}
            disabled={disabled || busy}
            onChange={(e) => setReplacement(e.target.value)}
          />
        </label>
      </div>
      <div className="editor-search-options">
        <label>
          <input
            type="checkbox"
            checked={matchCase}
            disabled={busy}
            onChange={(e) => setMatchCase(e.target.checked)}
          />
          {ui('Groß-/Kleinschreibung beachten')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={wholeWord}
            disabled={busy}
            onChange={(e) => setWholeWord(e.target.checked)}
          />
          {ui('Nur ganze Wörter')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={scans}
            disabled={busy}
            onChange={(e) => setScans(e.target.checked)}
          />
          {ui('Scans lokal erkennen (langsamer)')}
        </label>
      </div>
      <div className="editor-review-actions">
        <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => void scan()}>
          {ui('Alle Seiten durchsuchen')}
        </Button>
        {busy && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              controller.current?.abort();
              version.current++;
              setBusy(false);
              setProgress('');
            }}
          >
            {ui('Abbrechen')}
          </Button>
        )}
        <span role="status">
          {busy
            ? ui('Dokument wird geprüft …') + ' ' + progress
            : index
              ? `${hits.length} ${ui('Treffer')}`
              : progress}
        </span>
      </div>
      {index && (
        <>
          {!!index.skipped.length && (
            <p>
              {ui('Seiten ohne erkannten Text')}: {index.skipped.join(', ')}.{' '}
              {!scans && ui('Für Bildseiten die lokale OCR einschalten.')}
            </p>
          )}
          {!!index.failures.length && (
            <details>
              <summary>
                {ui('Nicht vollständig durchsuchte Seiten')}:{' '}
                {new Set(index.failures.map((f) => f.page)).size}
              </summary>
              {index.failures.map((f, i) => (
                <p key={i}>
                  {ui('Seite')} {f.page}: {ui(f.message)}
                </p>
              ))}
            </details>
          )}
          {!!hits.length && (
            <>
              <div className="editor-review-actions">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || busy}
                  onClick={() =>
                    setChosen(chosen.length === hits.length ? [] : hits.map((h) => h.id))
                  }
                >
                  {ui(
                    chosen.length === hits.length ? 'Auswahl aufheben' : 'Alle Treffer auswählen',
                  )}
                </Button>
                <Button
                  size="sm"
                  disabled={disabled || busy || !chosen.length}
                  onClick={() => void replace()}
                >
                  {ui('Ausgewählte Treffer ersetzen')} ({chosen.length})
                </Button>
              </div>
              <ol className="editor-document-hits" start={offset + 1}>
                {hits.slice(offset, offset + 50).map((hit) => {
                  const text = hit.block.mark.text || '';
                  return (
                    <li key={hit.id}>
                      <label>
                        <input
                          type="checkbox"
                          disabled={disabled || busy}
                          checked={chosen.includes(hit.id)}
                          onChange={() => choose(hit.id)}
                        />
                        <span>
                          {text.slice(Math.max(0, hit.start - 45), hit.start)}
                          <mark>{text.slice(hit.start, hit.end)}</mark>
                          {text.slice(hit.end, hit.end + 45)}
                          <small>
                            {ui('Ersetzen durch')}: {replacement || ui('(löschen)')}
                          </small>
                        </span>
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReveal(hit.block.pageId, hit.block.mark)}
                      >
                        {ui('Seite')} {hit.block.pageNumber}
                      </Button>
                    </li>
                  );
                })}
              </ol>
              {hits.length > 50 && (
                <div className="editor-review-actions">
                  <Button
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - 50))}
                  >
                    {ui('Zurück')}
                  </Button>
                  <span>
                    {offset + 1}–{Math.min(hits.length, offset + 50)} / {hits.length}
                  </span>
                  <Button
                    size="sm"
                    disabled={offset + 50 >= hits.length}
                    onClick={() => setOffset(offset + 50)}
                  >
                    {ui('Weiter')}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {(error || searchError) && <p role="alert">{ui(error || searchError)}</p>}
    </section>
  );
}
