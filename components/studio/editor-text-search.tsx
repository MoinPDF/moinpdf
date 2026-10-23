'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import type { Mark } from '@/lib/studio-engine';
import { findEditorText, replaceEditorMatches, type EditorSelection } from '@/lib/editor-rich-text';
import type { EditorPatch } from './editor-typography';

export function EditorTextSearch({
  mark,
  disabled,
  onPatch,
  onRange,
  onClose,
  request = 0,
}: {
  mark: Mark;
  disabled: boolean;
  onPatch: EditorPatch;
  onRange: (range: EditorSelection) => void;
  onClose: () => void;
  request?: number;
}) {
  const [query, setQuery] = useState(''),
    [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false),
    [wholeWord, setWholeWord] = useState(false),
    [typography, setTypography] = useState(true);
  const [cursor, setCursor] = useState(-1),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(
    () => findEditorText(mark.text || '', query, matchCase, wholeWord, typography),
    [mark.text, query, matchCase, wholeWord, typography],
  );
  const active = cursor >= 0 && cursor < matches.length ? cursor : -1;
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, [request]);
  function move(direction: number) {
    if (!matches.length) return;
    const index =
      active < 0
        ? direction > 0
          ? 0
          : matches.length - 1
        : (active + direction + matches.length) % matches.length;
    setCursor(index);
    onRange({ id: mark.id, ...matches[index] });
  }
  function replace(all: boolean) {
    if (!matches.length) return;
    const index = active < 0 ? 0 : active,
      chosen = all ? matches : [matches[index]];
    try {
      const patch = replaceEditorMatches(mark, chosen, replacement);
      onPatch(mark.id, patch);
      setError('');
      setMessage(ui('Ersetzt') + ': ' + chosen.length);
      setCursor(-1);
      if (!all) {
        const start = chosen[0].start;
        onRange({
          id: mark.id,
          start,
          end: start + replacement.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').length,
        });
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Die Suchtreffer sind nicht mehr gültig. Bitte erneut suchen.',
      );
    }
  }
  return (
    <section
      className="editor-text-search"
      aria-label={ui('Suchen und ersetzen im Textfeld')}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing || disabled) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        } else if (
          e.key === 'Enter' &&
          e.target instanceof HTMLInputElement &&
          e.target.type === 'text'
        ) {
          e.preventDefault();
          move(e.shiftKey ? -1 : 1);
        }
      }}
    >
      <p>{ui('Sucht nur im ausgewählten Textfeld. Ersetzungen lassen sich rückgängig machen.')}</p>
      <div className="editor-search-fields">
        <label>
          {ui('Suchtext')}
          <input
            ref={input}
            type="text"
            value={query}
            maxLength={256}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(-1);
              setMessage('');
              setError('');
            }}
          />
        </label>
        <label>
          {ui('Ersetzen durch')}
          <input
            type="text"
            value={replacement}
            maxLength={20000}
            disabled={disabled}
            onChange={(e) => {
              setReplacement(e.target.value);
              setMessage('');
              setError('');
            }}
          />
        </label>
      </div>
      <div className="editor-search-options">
        <label>
          <input
            type="checkbox"
            checked={matchCase}
            disabled={disabled}
            onChange={(e) => {
              setMatchCase(e.target.checked);
              setCursor(-1);
            }}
          />
          {ui('Groß-/Kleinschreibung beachten')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={wholeWord}
            disabled={disabled}
            onChange={(e) => {
              setWholeWord(e.target.checked);
              setCursor(-1);
            }}
          />
          {ui('Nur ganze Wörter')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={typography}
            disabled={disabled}
            onChange={(e) => {
              setTypography(e.target.checked);
              setCursor(-1);
            }}
          />
          {ui('PDF-Schreibweisen ausgleichen')}
        </label>
        <span role="status">
          {ui('Treffer im Textfeld')}:{' '}
          {active < 0 ? matches.length : `${active + 1} / ${matches.length}`}
          {message ? ` · ${message}` : ''}
        </span>
      </div>
      {typography && (
        <p className="fine-note">
          {ui(
            'Findet auch Ligaturen, kombinierte Akzente und abweichende Leerzeichen. Ersetzt werden immer vollständige Zeichen.',
          )}
        </p>
      )}
      <div className="editor-search-actions">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !matches.length}
          onClick={() => move(-1)}
        >
          {ui('Vorheriger Treffer')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !matches.length}
          onClick={() => move(1)}
        >
          {ui('Nächster Treffer')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !matches.length}
          onClick={() => replace(false)}
        >
          {ui('Treffer ersetzen')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !matches.length}
          onClick={() => replace(true)}
        >
          {ui('Alle im Textfeld ersetzen')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {ui('Suche schließen')}
        </Button>
      </div>
      {error && <p role="alert">{ui(error)}</p>}
    </section>
  );
}
