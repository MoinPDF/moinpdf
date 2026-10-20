'use client';
import { useState } from 'react';
import type { Source } from '@/lib/pdf-engine';
import type { EditorVerification } from '@/lib/editor-verification';
import { PageStage } from './advanced-shared';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
export function EditorResultReview({
  verification,
  sources,
  output,
}: {
  verification: EditorVerification;
  sources: Source[];
  output: Source;
}) {
  const choices = [
    ...new Set([...verification.changedPages, ...verification.issues.map((i) => i.page)]),
  ].sort((a, b) => a - b);
  if (!choices.length) choices.push(0);
  const [page, setPage] = useState(choices[0]),
    [view, setView] = useState<'before' | 'after' | 'both'>('both');
  const [issueIndex, setIssueIndex] = useState<number | null>(null);
  const issueRect =
    issueIndex !== null && verification.issues[issueIndex]?.page === page
      ? verification.issues[issueIndex].rect
      : undefined;
  const ref = verification.sourcePages[page],
    original = sources.find((s) => s.id === ref?.sourceId);
  return (
    <section className="editor-result-review" aria-label={ui('Exportprüfung und Vergleich')}>
      <p role="status">
        <strong>
          {ui(
            verification.status === 'passed'
              ? 'Exportprüfung abgeschlossen'
              : 'Exportprüfung: Bitte Abweichungen prüfen',
          )}
        </strong>
      </p>
      <p>
        {ui('Text geprüfter Seiten')}: {verification.textPages} ·{' '}
        {ui('Bildvergleich geprüfter Seiten')}: {verification.imagePages}
        {' · '}
        {ui('Schriftbild geprüfter Textfelder')}: {verification.editedImageFields || 0}
        {!!verification.sparseFields && (
          <>
            {' '}
            · {ui('Textfelder mit erhaltenen Originalzeichen')}: {verification.sparseFields}
          </>
        )}
      </p>
      <p>
        {ui(
          'Der Bildvergleich prüft unveränderte Bereiche und vergleicht bearbeitete Texte mit den vorgesehenen Schriftkonturen in begrenzter Auflösung. Kleine Abweichungen und OCR-Erkennungsfehler können unentdeckt bleiben. Bitte wichtige Dokumente zusätzlich selbst prüfen.',
        )}
      </p>
      {!!verification.issues.length && (
        <ul>
          {verification.issues.map((issue, i) => (
            <li key={i}>
              {ui('Seite')} {issue.page + 1}: {ui(issue.message)}
              {issue.rect && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPage(issue.page);
                    setIssueIndex(i);
                    setView('both');
                  }}
                >
                  {ui('Abweichung auf der Seite zeigen')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="editor-review-actions">
        <label>
          {ui('Vergleichsseite')}{' '}
          <select
            aria-label={ui('Vergleichsseite')}
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
          >
            {choices.map((p) => (
              <option key={p} value={p}>
                {ui('Seite')} {p + 1}
              </option>
            ))}
          </select>
        </label>
        {(['before', 'after', 'both'] as const).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={view === mode ? 'secondary' : 'outline'}
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
          >
            {ui(
              mode === 'before'
                ? 'Original'
                : mode === 'after'
                  ? 'Gespeicherte PDF'
                  : 'Nebeneinander',
            )}
          </Button>
        ))}
      </div>
      <div className={`editor-export-compare ${view === 'both' ? 'is-both' : ''}`}>
        {view !== 'after' && original && (
          <div>
            <h4>{ui('Original')}</h4>
            <PageStage source={original} page={ref.index} rotation={ref.rotation}>
              {issueRect && (
                <div
                  className="editor-verification-region"
                  style={{
                    left: `${issueRect.x * 100}%`,
                    top: `${issueRect.y * 100}%`,
                    width: `${issueRect.w * 100}%`,
                    height: `${issueRect.h * 100}%`,
                  }}
                />
              )}
            </PageStage>
          </div>
        )}
        {view !== 'before' && (
          <div>
            <h4>{ui('Gespeicherte PDF')}</h4>
            <PageStage source={output} page={page}>
              {issueRect && (
                <div
                  className="editor-verification-region"
                  style={{
                    left: `${issueRect.x * 100}%`,
                    top: `${issueRect.y * 100}%`,
                    width: `${issueRect.w * 100}%`,
                    height: `${issueRect.h * 100}%`,
                  }}
                />
              )}
            </PageStage>
          </div>
        )}
      </div>
    </section>
  );
}
