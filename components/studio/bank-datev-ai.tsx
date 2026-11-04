'use client';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from './appearance';
import { Button } from '@/components/ui/button';
import type { Row, Settings } from '@/lib/bank-datev/model';
import {
  eligibleRows,
  parseAccounts,
  previewText,
  type Suggestion,
} from '@/lib/bank-datev/suggestions';
import { ui } from '@/lib/ui-language';

export function BankDatevAI({
  rows,
  settings,
  onApply,
  token,
  setToken,
  accounts,
  setAccounts,
}: {
  rows: Row[];
  settings: Settings;
  token: string;
  setToken: (value: string) => void;
  accounts: string;
  setAccounts: (value: string) => void;
  onApply: (values: Map<string, string>) => void;
}) {
  const { t } = useLanguage();
  const [availability, setAvailability] = useState<'idle' | 'enabled' | 'off'>('idle');
  const [offset, setOffset] = useState(0);
  const [edits, setEdits] = useState<Record<string, string>>({}),
    [results, setResults] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lifecycle = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = new AbortController();
    lifecycle.current = c;
    return () => c.abort();
  }, []);
  const eligible = eligibleRows(rows),
    page = eligible.slice(offset, offset + 20);
  const payloadRows = page.map((row, i) => ({
    id: i + 1,
    direction: row.direction,
    text: (edits[row.id] ?? previewText(row.text)).trim(),
  }));
  const acceptable = (account: string | null) =>
    account &&
    account !== settings.bank_account &&
    account.length <= Math.max(4, settings.bank_account.length) + 1;
  async function status() {
    try {
      const r = await fetch('/api/datev/status', {
        headers: { 'X-MoinPDF-Client': 'web' },
        cache: 'no-store',
        signal: lifecycle.current?.signal,
      });
      const ok = r.ok && (await r.json()).enabled === true;
      setAvailability(ok ? 'enabled' : 'off');
    } catch {
      if (!lifecycle.current?.signal.aborted) setAvailability('off');
    }
  }
  async function suggest() {
    setBusy(true);
    setResults([]);
    setError('');
    try {
      const candidates = parseAccounts(accounts);
      const r = await fetch('/api/datev/suggest', {
        method: 'POST',
        cache: 'no-store',
        redirect: 'error',
        signal: lifecycle.current?.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-MoinPDF-Client': 'web',
          'X-Datev-Access': token,
        },
        body: JSON.stringify({
          framework: settings.account_framework,
          accounts: candidates,
          rows: payloadRows,
        }),
      });
      if (!r.ok)
        throw Error(
          r.status === 403
            ? t('KI-Zugangscode prüfen.', 'Check the AI access code.')
            : r.status === 429
              ? t(
                  'Anfragelimit erreicht. Bitte später erneut versuchen.',
                  'Request limit reached. Try again later.',
                )
              : t(
                  'KI-Dienst nicht erreichbar oder Antwort unbrauchbar. Die manuelle Kontierung ist verfügbar.',
                  'The AI service is unavailable or returned an unusable response. Manual entry is available.',
                ),
        );
      const { suggestions } = (await r.json()) as { suggestions: Suggestion[] };
      if (!Array.isArray(suggestions) || suggestions.length !== page.length)
        throw Error(t('Unvollständige KI-Antwort.', 'Incomplete AI response.'));
      setResults(suggestions);
    } catch (e) {
      if (!lifecycle.current?.signal.aborted) setError(ui((e as Error).message));
    } finally {
      if (!lifecycle.current?.signal.aborted) setBusy(false);
    }
  }
  return (
    <details
      className="bank-card"
      onToggle={(e) => {
        if (e.currentTarget.open && availability === 'idle') void status();
      }}
    >
      <summary>{t('KI-Kontierung · optional', 'AI posting suggestions · optional')}</summary>
      {availability !== 'enabled' ? (
        <p>
          {availability === 'idle'
            ? t('Verfügbarkeit wird geprüft.', 'Checking availability.')
            : t(
                'Auf dieser Installation ist die KI-Kontierung deaktiviert.',
                'AI suggestions are disabled on this installation.',
              )}
        </p>
      ) : (
        <>
          <p>
            {t(
              'Prüfe und kürze die Texte vor dem Senden. OpenAI erhält den Kontenrahmen, die angezeigten Buchungstexte und Zahlungsrichtungen sowie eine eventuell eingegebene Kontenliste. Namen können im Freitext enthalten sein.',
              'Review and shorten the text before sending. OpenAI receives the chart, the displayed transaction text and directions, and any account list you enter. Free text may contain names.',
            )}
          </p>
          <fieldset disabled={busy} className="bank-ai-fields">
            <label>
              {t('Privater KI-Zugangscode', 'Private AI access code')}
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <label>
              {t(
                'Zulässige Gegenkonten mit Bezeichnung (optional, eines je Zeile)',
                'Allowed offset accounts with labels (optional, one per line)',
              )}
              <textarea
                rows={2}
                value={accounts}
                onChange={(e) => {
                  setAccounts(e.target.value);
                  setResults([]);
                }}
              />
            </label>
            {page.map((row, i) => (
              <label key={row.id}>
                {offset + i + 1} ·{' '}
                {row.direction === 'debit' ? t('Auszahlung', 'Outflow') : t('Einzahlung', 'Inflow')}
                <input
                  maxLength={240}
                  value={edits[row.id] ?? previewText(row.text)}
                  onChange={(e) => {
                    setEdits({ ...edits, [row.id]: e.target.value });
                    setResults([]);
                  }}
                />
              </label>
            ))}
            {eligible.length > 20 && (
              <div className="bank-actions">
                <button
                  disabled={!offset}
                  onClick={() => {
                    setOffset(offset - 20);
                    setResults([]);
                  }}
                >
                  {t('Zurück', 'Previous')}
                </button>
                <button
                  disabled={offset + 20 >= eligible.length}
                  onClick={() => {
                    setOffset(offset + 20);
                    setResults([]);
                  }}
                >
                  {t('Weiter', 'Next')}
                </button>
              </div>
            )}
            {!page.length ? (
              <p>
                {t(
                  'Es gibt keine offenen Zeilen mit Buchungstext und Zahlungsrichtung.',
                  'There are no open entries with a description and direction.',
                )}
              </p>
            ) : (
              <Button disabled={!token || payloadRows.some((r) => !r.text)} onClick={suggest}>
                {busy
                  ? t('Vorschläge werden erstellt …', 'Generating suggestions…')
                  : t('Angezeigte Daten an OpenAI senden', 'Send displayed data to OpenAI')}
              </Button>
            )}
          </fieldset>
          {error && <p role="alert">{error}</p>}
          {results.length > 0 && (
            <div>
              <h3>{t('Kontierungsvorschläge prüfen', 'Review suggestions')}</h3>
              {results.map((r) => (
                <p key={r.id}>
                  <strong>
                    {offset + r.id} · {acceptable(r.account) ? r.account : t('Offen', 'Unresolved')}
                  </strong>{' '}
                  {r.reason}
                </p>
              ))}
              <Button
                variant="outline"
                disabled={!results.some((r) => acceptable(r.account))}
                onClick={() => {
                  const values = new Map<string, string>();
                  for (const item of results)
                    if (acceptable(item.account) && item.account)
                      values.set(page[item.id - 1].id, item.account);
                  onApply(values);
                }}
              >
                {t(
                  'Vorschläge in die bearbeitbaren Zeilen übernehmen',
                  'Apply suggestions to editable entries',
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </details>
  );
}
