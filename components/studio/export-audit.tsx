'use client';
import { useEffect, useState } from 'react';
import type { Source, PageItem } from '@/lib/pdf-engine';
import type { DownloadResult } from '@/lib/result-details';
import type { ExportAudit } from '@/lib/export-audit';
import { useWorkspaceResults } from './workspace-result-context';
import { useLanguage } from './appearance';
const noSources: Source[] = [];
export function useExportAudit(
  result: DownloadResult,
  sources = noSources,
  pages?: PageItem[],
  tool?: string,
) {
  const { t } = useLanguage(),
    { remember } = useWorkspaceResults();
  const pdf =
    result.kind === 'pdf' ||
    result.blob.type === 'application/pdf' ||
    /\.pdf$/i.test(result.filename);
  const [state, setState] = useState<{ blob: Blob; report?: ExportAudit }>({ blob: result.blob });
  const [accepted, setAccepted] = useState<Blob | null>(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!pdf) return;
    const controller = new AbortController();
    setState({ blob: result.blob });
    setAccepted(null);
    if (result.exportAudit?.version === 1 && !pages?.length && !retry) {
      setState({ blob: result.blob, report: result.exportAudit });
      return;
    }
    void import('@/lib/export-audit')
      .then((m) =>
        m.auditPdfExport(result.blob, result.pages, sources, pages, tool, controller.signal),
      )
      .then((report) => {
        if (!controller.signal.aborted) {
          setState({ blob: result.blob, report });
          remember({ ...result, exportAudit: report });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({
            blob: result.blob,
            report: {
              version: 1,
              status: 'invalid',
              pages: 0,
              checkedPages: 0,
              compared: false,
              issues: [{ code: 'unreadable' }],
            },
          });
      });
    return () => controller.abort();
    // Input mappings belong to this immutable result, not subsequent UI selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.blob, retry]);
  const report = state.blob === result.blob ? state.report : undefined;
  const blocked =
    pdf &&
    (!report ||
      report.status === 'invalid' ||
      (report.status === 'review' && accepted !== result.blob));
  const label = (code: ExportAudit['issues'][number]['code']) =>
    ({
      pages: t('Abweichende Seitenzahl', 'Page count differs'),
      geometry: t('Geänderte Seitenmaße', 'Page dimensions changed'),
      text: t('Originaltext nicht vollständig wiedergefunden', 'Some original text was not found'),
      links: t('Geänderte Anzahl von Links', 'Link count changed'),
      forms: t('Geänderte Anzahl von Formularfeldern', 'Form field count changed'),
      partial: t('Prüfung ist unvollständig', 'Verification is incomplete'),
      encrypted: t(
        'Passwortgeschützte Ausgabe: Inhalt konnte nicht geprüft werden.',
        'Password-protected output: content could not be verified.',
      ),
      unreadable: t(
        'Ausgabe konnte nicht zuverlässig gelesen werden. Bitte erneut prüfen oder neu erzeugen.',
        'Output could not be read reliably. Please retry verification or regenerate it.',
      ),
      empty: t('Die Ausgabedatei ist leer.', 'The output file is empty.'),
    })[code];
  const panel = !pdf ? null : (
    <section className="export-audit" aria-label={t('Exportprüfung', 'Export verification')}>
      <p role="status">
        <strong>
          {!report
            ? t('Export wird geprüft …', 'Verifying export …')
            : report.status === 'checked'
              ? t(
                  'Technische Exportprüfung abgeschlossen',
                  'Technical export verification complete',
                )
              : t('Exportprüfung: bitte beachten', 'Export verification: please review')}
        </strong>
        {report && ` · ${report.checkedPages}/${report.pages} ${t('Seiten', 'pages')}`}
      </p>
      {report && (
        <details open={report.status !== 'checked'}>
          <summary>{t('Prüfumfang und Hinweise', 'Scope and findings')}</summary>
          <p>
            {report.compared
              ? t(
                  'Lesbarkeit, Seitenmaße, Links und Formularfelder wurden mit den gewählten Originalseiten verglichen. Textvergleich gilt für Werkzeuge mit Texterhalt.',
                  'Readability, page dimensions, links and form fields were compared with the selected original pages. Text comparison applies to tools that preserve text.',
                )
              : t(
                  'Lesbarkeit und verfügbare Seitenangaben geprüft. Kein Originalvergleich für diesen Export.',
                  'Readability and available page count checked. No original comparison for this export.',
                )}{' '}
            {t(
              'Kein vollständiger Bildvergleich oder Nachweis inhaltlicher Richtigkeit.',
              'Not a complete visual comparison or proof of content accuracy.',
            )}
          </p>
          {report.issues.length > 0 && (
            <ul>
              {report.issues.slice(0, 30).map((issue, i) => (
                <li key={i}>
                  {issue.page ? `${t('Seite', 'Page')} ${issue.page}: ` : ''}
                  {label(issue.code)}
                  {issue.before !== undefined && ` (${issue.before} → ${issue.after})`}
                </li>
              ))}
            </ul>
          )}
          {report.issues.length > 30 && (
            <p>
              {t('Weitere Hinweise auf zusätzlichen Seiten.', 'More findings on additional pages.')}
            </p>
          )}
        </details>
      )}
      {report?.status === 'review' && (
        <label>
          <input
            type="checkbox"
            checked={accepted === result.blob}
            onChange={(e) => setAccepted(e.target.checked ? result.blob : null)}
          />{' '}
          {t('Änderungen und Prüflücken geprüft', 'Changes and verification gaps reviewed')}
        </label>
      )}
      {report?.status === 'invalid' && (
        <button type="button" onClick={() => setRetry((n) => n + 1)}>
          {t('Erneut prüfen', 'Retry verification')}
        </button>
      )}
    </section>
  );
  return { blocked, panel };
}
