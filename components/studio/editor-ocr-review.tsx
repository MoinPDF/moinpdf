'use client';
import { useEffect, useRef, useState } from 'react';
import type { Mark } from '@/lib/studio-engine';
import type { Source, PageItem } from '@/lib/pdf-engine';
import type { TextTarget } from '@/lib/editor-model';
import { recognizeEditorRegion, editorOcrNeedsReview } from '@/lib/editor-analysis';
import { ambiguousEditorNumber } from '@/lib/editor-scan';
import { EditorOriginalSnippet } from './editor-layout-help';
import type { EditorPatch } from './editor-typography';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
export function EditorOcrReview({
  mark,
  source,
  page,
  url,
  width,
  height,
  language,
  targets,
  onPick,
  onPatch,
}: {
  mark: Mark;
  source: Source;
  page: PageItem;
  url: string;
  width: number;
  height: number;
  language: string;
  targets: TextTarget[];
  onPick: (target: TextTarget) => void;
  onPatch: EditorPatch;
}) {
  const [busy, setBusy] = useState(false),
    [suggestion, setSuggestion] = useState(''),
    [notice, setNotice] = useState('');
  const task = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<{ label: string; text: string; confidence: number }[]>(
    [],
  );
  useEffect(() => {
    task.current?.abort();
    setBusy(false);
    setSuggestion('');
    setVariants([]);
    setNotice('');
    return () => task.current?.abort();
  }, [mark.id, source.id, page.index, page.rotation]);
  const uncertain = targets.filter(editorOcrNeedsReview);
  async function recognize() {
    if (!mark.sourceRect) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy(true);
    setNotice('');
    setSuggestion('');
    setVariants([]);
    try {
      const value = await recognizeEditorRegion(
        source,
        page,
        mark.sourceRect,
        language,
        controller.signal,
        (p) => setNotice(p.label),
      );
      if (!controller.signal.aborted) {
        setSuggestion(value.text);
        setVariants(value.variants);
        setNotice('Erkennungsvorschlag bitte am Original prüfen.');
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(error instanceof Error ? error.message : 'Texterkennung fehlgeschlagen.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <details className="editor-ocr-review" open={open}>
      <summary
        onClick={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
        }}
        aria-expanded={open}
      >
        {ui('Scantext prüfen und korrigieren')}
      </summary>
      <div className="editor-review-grid">
        <div>
          <strong>{ui('Original')}</strong>
          {mark.sourceRect && (
            <EditorOriginalSnippet url={url} rect={mark.sourceRect} width={width} height={height} />
          )}
        </div>
        <label>
          {ui('Erkannter Text')}
          <textarea
            aria-label={ui('OCR-Korrektur')}
            data-editor-history="true"
            value={mark.text || ''}
            maxLength={20000}
            onChange={(e) => onPatch(mark.id, { text: e.target.value }, 'typing')}
          />
        </label>
      </div>
      <p>{ui('Namen, Zahlen und Beträge besonders sorgfältig am Original prüfen.')}</p>
      {ambiguousEditorNumber(mark.text || '') && (
        <p className="editor-ocr-warning" role="status">
          {ui(
            'Diese Zahl enthält ähnlich aussehende Buchstaben, etwa O/0 oder l/1. Bitte am Original prüfen; es erfolgt keine automatische Ersetzung.',
          )}
        </p>
      )}
      <div className="editor-review-actions">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void recognize()}>
          {ui('Diesen Bereich erneut erkennen')}
        </Button>
        {busy && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              task.current?.abort();
              setBusy(false);
              setNotice('Texterkennung angehalten.');
            }}
          >
            {ui('Abbrechen')}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={!uncertain.length}
          onClick={() => {
            const index = uncertain.findIndex(
              (t) =>
                mark.sourceRect &&
                Math.abs(t.x - mark.sourceRect.x) < 0.00001 &&
                Math.abs(t.y - mark.sourceRect.y) < 0.00001,
            );
            onPick(uncertain[(index + 1) % uncertain.length]);
          }}
        >
          {ui('Nächste unsichere Stelle')} ({uncertain.length})
        </Button>
      </div>
      {notice && <p role="status">{ui(notice)}</p>}
      {!!variants.length && (
        <div className="editor-ocr-variants">
          {variants.map((v, i) => (
            <div key={i}>
              <strong>
                {ui(v.label)} · {Math.round(v.confidence)}%
              </strong>
              <p>{v.text || ui('Kein Text erkannt')}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={!v.text}
                onClick={() => setSuggestion(v.text)}
              >
                {ui('Als Korrekturvorschlag wählen')}
              </Button>
            </div>
          ))}
        </div>
      )}
      {suggestion && (
        <label>
          {ui('Neuer Erkennungsvorschlag')}
          <textarea
            aria-label={ui('Erkennungsvorschlag')}
            value={suggestion}
            maxLength={20000}
            onChange={(e) => setSuggestion(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              onPatch(mark.id, { text: suggestion });
              setSuggestion('');
            }}
          >
            {ui('Korrektur übernehmen')}
          </Button>
        </label>
      )}
    </details>
  );
}
