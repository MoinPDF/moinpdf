'use client';
import { useState, useEffect, useRef } from 'react';
import { renderPageRegion, type Source } from '@/lib/pdf-engine';
import type { Rect } from '@/lib/studio-engine';
import type { EditorVerification } from '@/lib/editor-verification';
import { PageStage } from './advanced-shared';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
const fidelityLabels = {
  original: 'Originalschrift verwendet',
  matched: 'Schriftähnlichkeit: gute Annäherung',
  uncertain: 'Schriftähnlichkeit: unsicher',
  changed: 'Schriftähnlichkeit: Formatierung nach der Erkennung geändert',
  unavailable: 'Schriftähnlichkeit: nicht zuverlässig bestimmbar',
  substituted: 'Ersatzschrift verwendet',
} as const;

/** Both images use exactly the same source region and CSS scale. Rendering is
 * cancelled on selection changes; no stale half-pair is ever displayed. */
export function EditorDetailPair({
  source,
  output,
  sourcePage,
  outputPage,
  rotation,
  rect,
}: {
  source: Source;
  output: Source;
  sourcePage: number;
  outputPage: number;
  rotation: number;
  rect: Rect;
}) {
  const [zoom, setZoom] = useState(200);
  const [pair, setPair] = useState<{
    before: string;
    after: string;
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState(false);
  const left = useRef<HTMLDivElement>(null),
    right = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setPair(null);
    setError(false);
    const x = Math.max(0, rect.x - 0.008),
      y = Math.max(0, rect.y - 0.008);
    const region = {
      x,
      y,
      w: Math.min(1, rect.x + rect.w + 0.008) - x,
      h: Math.min(1, rect.y + rect.h + 0.008) - y,
    };
    void (async () => {
      const results = await Promise.allSettled([
        renderPageRegion(source, { index: sourcePage, rotation }, region, controller.signal),
        renderPageRegion(output, { index: outputPage, rotation: 0 }, region, controller.signal),
      ]);
      try {
        if (controller.signal.aborted) return;
        const a = results[0],
          b = results[1];
        if (a.status !== 'fulfilled' || b.status !== 'fulfilled') throw new Error('render');
        if (
          Math.abs(a.value.width - b.value.width) > 0.01 ||
          Math.abs(a.value.height - b.value.height) > 0.01
        )
          throw new Error('geometry');
        setPair({
          before: a.value.canvas.toDataURL('image/png'),
          after: b.value.canvas.toDataURL('image/png'),
          width: a.value.width,
          height: a.value.height,
        });
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        for (const result of results)
          if (result.status === 'fulfilled')
            result.value.canvas.width = result.value.canvas.height = 0;
      }
    })();
    return () => controller.abort();
  }, [source, output, sourcePage, outputPage, rotation, rect.x, rect.y, rect.w, rect.h]);
  return (
    <section
      className="editor-detail-pair"
      aria-label={ui('Original und Ergebnis im gleichen Maßstab')}
    >
      <label>
        {ui('Gemeinsamer Zoom')}{' '}
        <select
          aria-label={ui('Gemeinsamer Zoom')}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        >
          {[100, 200, 400].map((value) => (
            <option value={value} key={value}>
              {value}%
            </option>
          ))}
        </select>
      </label>
      {!pair ? (
        <p role="status">
          {ui(
            error
              ? 'Der Detailvergleich konnte nicht geladen werden.'
              : 'Detailvergleich wird geladen …',
          )}
        </p>
      ) : (
        <div className="editor-detail-grid">
          {(['before', 'after'] as const).map((side, i) => (
            <div key={side}>
              <h4>{ui(i ? 'Gespeicherte PDF' : 'Original')}</h4>
              <div
                ref={i ? right : left}
                className="editor-detail-scroll"
                tabIndex={0}
                aria-label={ui(i ? 'Ergebnis im Detail' : 'Original im Detail')}
                onScroll={(e) => {
                  const other = (i ? left : right).current;
                  if (other) {
                    if (other.scrollLeft !== e.currentTarget.scrollLeft)
                      other.scrollLeft = e.currentTarget.scrollLeft;
                    if (other.scrollTop !== e.currentTarget.scrollTop)
                      other.scrollTop = e.currentTarget.scrollTop;
                  }
                }}
              >
                <img
                  src={pair[side]}
                  alt={ui(i ? 'Ergebnis im Detail' : 'Original im Detail')}
                  draggable={false}
                  data-zoom={zoom}
                  style={{
                    width: (((pair.width * 96) / 72) * zoom) / 100,
                    height: (((pair.height * 96) / 72) * zoom) / 100,
                    maxWidth: 'none',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
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
  const [detailIndex, setDetailIndex] = useState(0);
  const detail = verification.fidelity?.[detailIndex];
  const detailRef = detail && verification.sourcePages[detail.page];
  const detailSource = sources.find((s) => s.id === detailRef?.sourceId);
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
      {!!verification.fidelity?.length && (
        <section className="editor-fidelity-review" aria-label={ui('Originaltreue vergleichen')}>
          <p>
            <strong>{ui('Originaltreue vergleichen')}</strong>
          </p>
          <p>
            {ui(
              'Eine erfolgreiche Exportprüfung bestätigt die gespeicherte Darstellung. Die Schriftähnlichkeit zum Original wird getrennt bewertet; ein Scan bleibt eine Annäherung.',
            )}
          </p>
          <label>
            {ui('Änderung auswählen')}{' '}
            <select
              aria-label={ui('Änderung auswählen')}
              value={detailIndex}
              onChange={(e) => setDetailIndex(Number(e.target.value))}
            >
              {verification.fidelity.map((entry, index) => (
                <option key={index} value={index}>
                  {ui('Seite')} {entry.page + 1}: {entry.text}
                </option>
              ))}
            </select>
          </label>
          {detail && (
            <p role="status" className="editor-fidelity-status">
              {ui(fidelityLabels[detail.status])}
              {detail.samples ? (
                <>
                  {' '}
                  · {ui('Verglichene Originalstellen')}: {detail.samples}
                </>
              ) : null}
            </p>
          )}
          {detail && detailRef && detailSource && (
            <EditorDetailPair
              source={detailSource}
              output={output}
              sourcePage={detailRef.index}
              outputPage={detail.page}
              rotation={detailRef.rotation}
              rect={detail.rect}
            />
          )}
        </section>
      )}
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
