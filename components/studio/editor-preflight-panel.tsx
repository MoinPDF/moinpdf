'use client';
import { useEffect, useRef, useState } from 'react';
import type { Source, PageItem } from '@/lib/pdf-engine';
import type { Edits, Mark } from '@/lib/studio-engine';
import {
  preflightEditor,
  safeEditorHeight,
  testEditorRemoval,
  type EditorPreflightIssue,
} from '@/lib/editor-preflight';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { editorMarkChanged } from '@/lib/editor-model';
export function EditorPreflightPanel({
  sources,
  pages,
  edits,
  disabled,
  onApply,
  onReveal,
}: {
  sources: Source[];
  pages: PageItem[];
  edits: Edits;
  disabled: boolean;
  onApply: (edits: Edits) => void;
  onReveal: (pageId: string, mark: Mark) => void;
}) {
  const [issues, setIssues] = useState<EditorPreflightIssue[]>([]),
    [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [completedKey, setCompletedKey] = useState(''),
    [progress, setProgress] = useState({ completed: 0, total: 0 });
  const changedCount = pages.reduce(
    (total, page) => total + (edits.marks[page.id] || []).filter(editorMarkChanged).length,
    0,
  );
  const key = JSON.stringify([pages, edits]),
    current = useRef(key),
    controller = useRef<AbortController | null>(null);
  current.current = key;
  useEffect(() => {
    controller.current?.abort();
    setBusy(false);
    setMessage('');
    setIssues([]);
    setCompletedKey('');
    setProgress({ completed: 0, total: 0 });
    if (disabled) {
      setPending(false);
      return;
    }
    const ctrl = new AbortController();
    setPending(true);
    const timer = setTimeout(() => {
      void preflightEditor(sources, pages, edits, ctrl.signal, (completed, total) => {
        if (!ctrl.signal.aborted) setProgress({ completed, total });
      })
        .then((value) => {
          if (!ctrl.signal.aborted) {
            setIssues(value);
            setCompletedKey(key);
          }
        })
        .catch((error) => {
          if (!ctrl.signal.aborted)
            setMessage(
              error instanceof Error
                ? error.message
                : 'Die Vorprüfung konnte nicht abgeschlossen werden.',
            );
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setPending(false);
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
      controller.current?.abort();
    };
  }, [sources, pages, edits, disabled, key]);
  async function fix(issue: EditorPreflightIssue) {
    const page = pages.find((p) => p.id === issue.pageId),
      mark = edits.marks[issue.pageId]?.find((m) => m.id === issue.markId),
      source = sources.find((s) => s.id === page?.sourceId);
    if (!page || !mark || !source) return;
    const ctrl = new AbortController();
    controller.current?.abort();
    controller.current = ctrl;
    setBusy(true);
    setMessage('');
    try {
      const patch = await safeEditorHeight(source, page, mark, edits.marks[page.id], ctrl.signal);
      ctrl.signal.throwIfAborted();
      if (current.current !== key) return;
      onApply({
        ...edits,
        marks: {
          ...edits.marks,
          [page.id]: edits.marks[page.id].map((m) => (m.id === mark.id ? { ...m, ...patch } : m)),
        },
      });
    } catch (error) {
      if (!ctrl.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Die Höhenanpassung konnte nicht vorbereitet werden.',
        );
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }
  async function physical() {
    const ctrl = new AbortController();
    controller.current?.abort();
    controller.current = ctrl;
    setBusy(true);
    setMessage('');
    try {
      for (const page of pages) {
        const source = sources.find((s) => s.id === page.sourceId)!;
        await testEditorRemoval(source, page, edits.marks[page.id] || [], ctrl.signal);
      }
      ctrl.signal.throwIfAborted();
      if (current.current === key)
        setMessage(
          'Originaltext lässt sich physisch entfernen. Das Ergebnis wird beim Export nochmals geprüft.',
        );
    } catch (error) {
      if (!ctrl.signal.aborted)
        setMessage(
          error instanceof Error ? error.message : 'Die Entfernung konnte nicht geprüft werden.',
        );
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }
  return (
    <details className="editor-workflow-section">
      <summary>
        {ui('Änderungen vorprüfen')} ·{' '}
        {pending
          ? ui('Prüfung läuft …') +
            (progress.total ? ` ${progress.completed}/${progress.total}` : '')
          : disabled || completedKey !== key
            ? ui('Noch nicht geprüft')
            : issues.length}
      </summary>
      <p>
        {ui(
          'Text, Schrift, Platzbedarf und Formularfelder werden geprüft. Die vollständige Prüfung erfolgt beim Export.',
        )}
      </p>
      {!disabled && completedKey === key && !pending && !issues.length && !message && (
        <p role="status">
          {ui(changedCount ? 'Keine Auffälligkeiten in der Vorprüfung.' : 'Noch keine Änderungen.')}
        </p>
      )}
      {issues.map((issue, i) => {
        const mark = edits.marks[issue.pageId]?.find((m) => m.id === issue.markId);
        return (
          <div key={i}>
            <p>
              {ui('Seite')} {pages.findIndex((p) => p.id === issue.pageId) + 1}: {ui(issue.message)}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || busy || !mark}
              onClick={() => mark && onReveal(issue.pageId, mark)}
            >
              {ui('Anzeigen')}
            </Button>
            {issue.kind === 'layout' && (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled || busy}
                onClick={() => void fix(issue)}
              >
                {ui('Höhe sicher anpassen')}
              </Button>
            )}
          </div>
        );
      })}
      <Button
        variant="outline"
        disabled={disabled || busy || pending || !changedCount || completedKey !== key}
        onClick={() => void physical()}
      >
        {ui(busy ? 'Änderung wird geprüft …' : 'Originaltextentfernung testen')}
      </Button>
      {message && <p role="status">{ui(message)}</p>}
    </details>
  );
}
