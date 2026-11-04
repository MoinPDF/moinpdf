'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, FileSpreadsheet, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob, pdfBlob, type Source } from '@/lib/pdf-engine';
import { bankMessage as ui } from '@/lib/bank-datev/messages';
import {
  balanceDifference,
  blankRow,
  exportEntries,
  readStatement,
  signedAmount,
  updateAmount,
  type Entries,
  type Entry,
  type Row,
  type Settings,
  type Draft,
} from '@/lib/bank-datev/model';
import { useLanguage } from './appearance';
import { WorkspaceContext } from './workspace-context';
import { BankDatevAI } from './bank-datev-ai';
import './bank-datev.css';

// Reviewed entries stay in memory when returning to the toolbox. Removing a
// workspace source also releases its entry without keeping client data on disk.
const memory = new WeakMap<Source, Entry>();
type Props = { sources: Source[]; onBack: () => void; onAdd: () => void };
export default function BankDatevWorkbench({ sources, onBack, onAdd }: Props) {
  const { t, language } = useLanguage();
  const [accessCode, setAccessCode] = useState('');
  const [accountLists, setAccountLists] = useState<Record<string, string>>({});

  const [entries, setEntries] = useState<Entries>({}),
    [selected, setSelected] = useState(sources[0]?.id);
  const [failures, setFailures] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [exporting, setExporting] = useState(false);
  const [revision, setRevision] = useState(0),
    [search, setSearch] = useState('');
  const source = sources.find((s) => s.id === selected) ?? sources[0],
    entry = entries[source?.id];
  const [ocrPage, setOcrPage] = useState<{ id: string; page: number }>();
  const [original, setOriginal] = useState('');
  useEffect(() => {
    if (!source) return;
    const url = URL.createObjectURL(pdfBlob(source.bytes));
    setOriginal(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [source]);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      for (const s of sources) {
        if (controller.signal.aborted) break;
        try {
          const e =
            memory.get(s) ??
            (await readStatement(s, controller.signal, (page) => {
              if (!controller.signal.aborted) setOcrPage({ id: s.id, page });
            }));
          if (controller.signal.aborted) break;
          memory.set(s, e);
          setEntries((old) => ({ ...old, [s.id]: e }));
        } catch (e) {
          if (!controller.signal.aborted)
            setFailures((old) => ({ ...old, [s.id]: (e as Error).message }));
        }
      }
    })();
    return () => controller.abort();
  }, [sources]);
  function update(next: Entry, confirmed = false) {
    const value = { ...next, draft: { ...next.draft, confirmed } };
    memory.set(source, value);
    setEntries((old) => ({ ...old, [source.id]: value }));
    setError('');
    setRevision((n) => n + 1);
  }
  function changeDraft(patch: Partial<Draft>) {
    update({ ...entry, draft: { ...entry.draft, ...patch } });
  }
  function changeRow(row: Row, patch: Partial<Row>) {
    changeDraft({ rows: entry.draft.rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)) });
  }
  async function save(all: boolean) {
    setError('');
    setExporting(true);
    try {
      const files = exportEntries(all ? sources.map((s) => entries[s.id]) : [entry]);
      if (files.length === 1 && !all) {
        downloadBlob(
          new Blob([files[0].bytes], { type: 'text/csv;charset=windows-1252' }),
          files[0].name,
        );
        return;
      }
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (const file of files) {
        let name = file.name,
          index = 1;
        while (zip.file(name)) name = file.name.replace(/\.csv$/i, '_' + ++index + '.csv');
        zip.file(name, file.bytes);
      }
      downloadBlob(
        await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
        'EXTF_Bank2DATEV.zip',
      );
    } catch (e) {
      setError(ui((e as Error).message));
    } finally {
      setExporting(false);
    }
  }
  const d = entry?.draft,
    settings = entry?.settings;
  const difference = d && balanceDifference(d);
  const ready = (value?: Entry) =>
    value?.draft.confirmed &&
    value.draft.currency === 'EUR' &&
    !!value.draft.period_start &&
    !!value.draft.period_end &&
    value.draft.rows.length > 0 &&
    balanceDifference(value.draft) === 0;
  const field = (key: keyof Settings, label: string) => (
    <label key={key}>
      {label}
      <input
        inputMode="numeric"
        type="text"
        value={settings[key]}
        autoComplete="off"
        onChange={(e) => update({ ...entry, settings: { ...settings, [key]: e.target.value } })}
      />
    </label>
  );
  const date = (iso: string) =>
    iso &&
    new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  const money = (value: string) =>
    value &&
    new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value.replace(',', '.')));
  const facts = d
    ? [
        [
          t('Zeitraum', 'Period'),
          [date(d.period_start), date(d.period_end)].filter(Boolean).join(' – '),
        ],
        [t('Anfangssaldo', 'Opening balance'), money(d.opening_balance)],
        [t('Endsaldo', 'Closing balance'), money(d.closing_balance)],
        [t('Auszugsnummer', 'Statement number'), d.statement_number],
        [t('Kontowährung', 'Account currency'), d.currency],
        ['IBAN', d.iban],
      ].filter(([, value]) => value)
    : [];
  return (
    <main className="document-workbench bank-datev">
      <WorkspaceContext sources={sources} locked={exporting} onAdd={onAdd} />
      <header className="workbench-header">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft size={17} />
          {t('Zurück zur Auswahl')}
        </Button>
        <Button variant="outline" onClick={onAdd}>
          {t('Datei hinzufügen')}
        </Button>
      </header>
      <div className="workbench-title">
        <div>
          <span className="studio-kicker">BANK2DATEV</span>
          <h1>
            <FileSpreadsheet />
            {t('Kontoauszug zu DATEV', 'Bank statement to DATEV')}
          </h1>
        </div>
      </div>
      {sources.length > 1 && (
        <nav className="bank-actions" aria-label={t('Kontoauszüge', 'Bank statements')}>
          {sources.map((s) => (
            <Button
              key={s.id}
              variant={s.id === source.id ? 'default' : 'outline'}
              aria-pressed={s.id === source.id}
              onClick={() => {
                setSelected(s.id);
                setSearch('');
                setError('');
              }}
            >
              {s.name}
            </Button>
          ))}
        </nav>
      )}
      {!source ? (
        <p role="status">{t('Kontoauszug als PDF hinzufügen.', 'Add a bank statement PDF.')}</p>
      ) : !d ? (
        <p role="status">
          {failures[source.id]
            ? ui(failures[source.id])
            : ocrPage?.id === source.id
              ? t('Lokale Texterkennung · Seite', 'Local text recognition · Page') +
                ' ' +
                ocrPage.page +
                ' / ' +
                source.pdf.numPages
              : t('Kontoauszug wird gelesen …', 'Reading bank statement…')}
        </p>
      ) : (
        <>
          <section className="bank-card">
            <h2>{t('Buchungsstapel einrichten', 'Set up posting batch')}</h2>
            <p>{source.name}</p>
            <div className="bank-fields">
              <label>
                {t('Kontenrahmen', 'Chart of accounts')}
                <select
                  aria-label={t('Kontenrahmen', 'Chart of accounts')}
                  value={settings.account_framework}
                  onChange={(e) =>
                    update({
                      ...entry,
                      settings: { ...settings, account_framework: e.target.value },
                    })
                  }
                >
                  <option value="03">SKR03</option>
                  <option value="04">SKR04</option>
                </select>
              </label>
              {field('bank_account', t('Konto (Bankkonto)', 'Account (bank account)'))}
              {field(
                'counteraccount',
                t(
                  'Gegenkonto für leere Zeilen (optional)',
                  'Offset account for empty entries (optional)',
                ),
              )}
              {field('adviser', t('Beraternummer', 'Advisor number'))}
              {field('client', t('Mandantennummer', 'Client number'))}
            </div>
            <div className="bank-heading bank-reading">
              {facts.length > 0 && (
                <details>
                  <summary>{t('Erkannte Auszugsdaten', 'Detected statement details')}</summary>
                  <dl>
                    {facts.map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
              {original && (
                <a href={original} target="_blank" rel="noreferrer">
                  {t('Original-PDF öffnen', 'Open original PDF')}
                </a>
              )}
            </div>
            {d.warnings.map((warning, i) => (
              <p key={i}>{ui(warning)}</p>
            ))}
          </section>
          <section className="bank-card">
            <div className="bank-heading">
              <h2>
                {t('Buchungen prüfen', 'Review postings')} ({d.rows.length})
              </h2>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  changeDraft({ rows: [...d.rows, blankRow()] });
                }}
              >
                <Plus size={16} />
                {t('Buchung ergänzen', 'Add posting')}
              </Button>
            </div>
            <p>
              {t(
                'Beträge mit + für Einzahlungen oder − für Auszahlungen eingeben. Ein leeres Gegenkonto übernimmt beim Export die eigene Vorgabe für diesen Auszug.',
                'Enter + for inflows or − for outflows. An empty offset account uses the default you entered for this statement when exporting.',
              )}
            </p>
            {d.rows.length > 0 && (
              <label>
                {t('Buchungen durchsuchen', 'Search postings')}
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
            )}
            {d.rows
              .map((row, i) => [row, i] as const)
              .filter(
                ([r]) =>
                  !search ||
                  [r.text, r.counteraccount, r.booking_date]
                    .join(' ')
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map(([r, i]) => (
                <fieldset className="bank-row" key={r.id}>
                  <legend>
                    {t('Buchung', 'Posting')} {i + 1}
                  </legend>
                  <div className="bank-fields">
                    <label>
                      {t('Buchungsdatum', 'Posting date')}
                      <input
                        type="date"
                        value={r.booking_date}
                        onChange={(e) => changeRow(r, { booking_date: e.target.value })}
                      />
                    </label>
                    <label>
                      {t('Wertstellung', 'Value date')}
                      <input
                        type="date"
                        value={r.value_date}
                        onChange={(e) => changeRow(r, { value_date: e.target.value })}
                      />
                    </label>
                    <label>
                      {t('Betrag (€)', 'Amount (€)')}
                      <input
                        type="text"
                        value={signedAmount(r)}
                        onChange={(e) => changeRow(r, updateAmount(e.target.value))}
                      />
                    </label>
                    <label>
                      {t('Gegenkonto', 'Offset account')}
                      <input
                        inputMode="numeric"
                        value={r.counteraccount}
                        placeholder={settings.counteraccount}
                        onChange={(e) => changeRow(r, { counteraccount: e.target.value })}
                      />
                    </label>
                    <label>
                      {t('BU-Schlüssel (optional)', 'Tax key (optional)')}
                      <input
                        inputMode="numeric"
                        value={r.tax_key}
                        onChange={(e) => changeRow(r, { tax_key: e.target.value })}
                      />
                    </label>
                  </div>
                  <label>
                    {t('Buchungstext', 'Posting text')}
                    <textarea
                      rows={2}
                      value={r.text}
                      onChange={(e) => changeRow(r, { text: e.target.value })}
                    />
                  </label>
                  <div className="bank-heading">
                    <details>
                      <summary>
                        {t('Quelle auf Seite', 'Source on page')} {r.page}
                      </summary>
                      <pre>{r.original}</pre>
                      {r.notes.map((n, j) => (
                        <p key={j}>{ui(n)}</p>
                      ))}
                    </details>
                    <Button
                      variant="ghost"
                      aria-label={t('Buchung entfernen', 'Remove posting') + ' ' + (i + 1)}
                      onClick={() => changeDraft({ rows: d.rows.filter((row) => row.id !== r.id) })}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </fieldset>
              ))}
          </section>
          <BankDatevAI
            key={source.id + '-' + revision}
            token={accessCode}
            setToken={setAccessCode}
            accounts={accountLists[source.id + settings.account_framework] || ''}
            setAccounts={(value) =>
              setAccountLists((old) => ({
                ...old,
                [source.id + settings.account_framework]: value,
              }))
            }
            rows={d.rows}
            settings={settings}
            onApply={(values) =>
              changeDraft({
                rows: d.rows.map((row) =>
                  row.counteraccount || !values.has(row.id)
                    ? row
                    : { ...row, counteraccount: values.get(row.id)! },
                ),
              })
            }
          />
          <section className="bank-card">
            <p>
              <strong>{t('Saldendifferenz', 'Balance difference')}</strong>
              {' · '}
              {difference == null
                ? t(
                    'Kein Abgleich möglich. Erkannten Auszug und Buchungen prüfen.',
                    'Unable to reconcile. Check the detected statement and postings.',
                  )
                : new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-GB', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(difference)}
            </p>

            <label className="bank-confirm">
              <input
                type="checkbox"
                checked={d.confirmed}
                onChange={(e) => update(entry, e.target.checked)}
              />
              {t(
                'Ich habe Buchungen, Kontierung und Salden mit dem Original abgeglichen.',
                'I have checked the entries, accounts and balances against the original.',
              )}
            </label>
            <div className="bank-actions">
              <Button disabled={!ready(entry) || exporting} onClick={() => save(false)}>
                {t('DATEV-Datei herunterladen', 'Download DATEV file')}
              </Button>
              {sources.length > 1 && (
                <Button
                  variant="outline"
                  disabled={exporting || !sources.every((s) => ready(entries[s.id]))}
                  onClick={() => save(true)}
                >
                  {t('Alle Auszüge als ZIP', 'Download all statements as ZIP')}
                </Button>
              )}
            </div>
            {error && <p role="alert">{error}</p>}
          </section>
        </>
      )}
    </main>
  );
}
