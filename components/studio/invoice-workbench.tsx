'use client';
import { ResultActions, ResultSummary, useResultName } from './result-actions';
import { WorkspaceContext } from './workspace-context';
import { JobStatusIcon, useFreshResult } from './ui-feedback';
import { ui, uiLocale } from '@/lib/ui-language';

import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ShieldCheck,
  ReceiptText,
  ClipboardCheck,
  Download,
  FileCode2,
  Table2,
  LoaderCircle,
  Check,
  TriangleAlert,
  CircleX,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  invoiceEntries,
  invoicePdf,
  invoiceCsv,
  checkInvoice,
  invoiceCheckText,
  INVOICE_CHECK_SCOPE,
  type InvoiceEntry,
  type InvoiceParty,
} from '@/lib/invoice-engine';
import { downloadBlob, filenameStem, formatSize, pdfBlob, type Source } from '@/lib/pdf-engine';
type Props = {
  tool: 'invoice-read' | 'invoice-check';
  sources: Source[];
  onBack: () => void;
  onTool: (tool: 'invoice-read' | 'invoice-check') => void;
  onBusy: (busy: boolean) => void;
  onAdd: () => void;
};
export function InvoiceWorkbench({ tool, sources, onBack, onTool, onBusy, onAdd }: Props) {
  const { t } = useLanguage();
  const [sourceId, setSourceId] = useState(
      sources.find((s) => s.invoiceOriginal)?.id || sources[0].id,
    ),
    [entries, setEntries] = useState<InvoiceEntry[]>([]),
    [index, setIndex] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [output, setOutput] = useState<{ blob: Blob; filename: string } | null>(null),
    [url, setUrl] = useState('');
  const resultFresh = useFreshResult(output);
  const [resultName, renameResult] = useResultName(output);
  const source = sources.find((s) => s.id === sourceId) || sources[0],
    entry = entries[index],
    i = entry?.invoice,
    checking = tool === 'invoice-check',
    locked = loading || busy;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    let live = true;
    setEntries([]);
    setIndex(0);
    setError('');
    setOutput(null);
    setLoading(true);
    invoiceEntries(source)
      .then((list) => {
        if (live) setEntries(list);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [source]);
  useEffect(() => {
    onBusy(locked);
    return () => onBusy(false);
  }, [locked, onBusy]);
  useEffect(() => {
    setOutput(null);
  }, [index, tool]);
  useEffect(() => {
    if (!output) {
      setUrl('');
      return;
    }
    const u = URL.createObjectURL(output.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [output]);
  async function savePdf() {
    if (!entry) return;
    setBusy(true);
    setError('');
    try {
      const bytes = await invoicePdf(entry, checking, undefined, ui);
      setOutput({
        blob: pdfBlob(bytes),
        filename: `${filenameStem(entry.name)}-${ui(checking ? 'Basischeck' : 'Leseansicht')}.pdf`,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const displayAmount = (s: string) => {
    const n = Number(s);
    if (!s || !Number.isFinite(n)) return s || '—';
    try {
      return new Intl.NumberFormat(uiLocale(), {
        style: 'currency',
        currency: i?.currency || 'EUR',
      }).format(n);
    } catch {
      return s + ' ' + (i?.currency || '');
    }
  };
  const date = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('.') : s || '—';
  const select = (
    label: string,
    v: string,
    items: [string, string][],
    change: (v: string) => void,
  ) => (
    <label className="field">
      <span>{ui(label)}</span>
      <Select value={v} onValueChange={change} disabled={locked}>
        <SelectTrigger aria-label={ui(label)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {ui(name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
  const party = (label: string, p: InvoiceParty) => (
    <div className="invoice-party">
      <span>{ui(label)}</span>
      <h3>{p.name || ui('Name fehlt')}</h3>
      <p>
        {p.address || ui('Adresse nicht angegeben')}
        {p.country && (
          <>
            <br />
            {p.country}
          </>
        )}
      </p>
      {p.vatId && (
        <small>
          {ui('USt-ID ')}
          {p.vatId}
        </small>
      )}
      {p.email && <small>{p.email}</small>}
    </div>
  );
  const errors = i?.checks.filter((c) => c.level === 'error').length || 0,
    warnings = i?.checks.filter((c) => c.level === 'warning').length || 0;
  return (
    <main className="document-workbench invoice-workbench">
      <WorkspaceContext sources={sources} locked={busy} onAdd={onAdd} />
      <header className="workbench-header">
        <Button variant="ghost" onClick={onBack} disabled={locked}>
          <ChevronLeft size={17} />
          {t('Zurück zur Auswahl')}
        </Button>
        <span className="device-tag">
          <ShieldCheck size={14} />
          {ui('LOKAL AUF DEINEM GERÄT')}
        </span>
        <Button variant="outline" disabled={locked} onClick={onAdd}>
          {ui('Datei hinzufügen')}
        </Button>
      </header>
      <div className="workbench-title">
        <div>
          <span className="studio-kicker">{ui('RECHNUNGSDATEN. AUF EINEN BLICK.')}</span>
          <h1>
            {checking ? <ClipboardCheck /> : <ReceiptText />}
            {checking ? ui('E-Rechnung prüfen') : ui('E-Rechnung lesen')}
          </h1>
        </div>
        <div className="workbench-modes">
          <Button
            variant={!checking ? 'default' : 'ghost'}
            disabled={locked}
            onClick={() => onTool('invoice-read')}
          >
            {ui('Leseansicht')}
          </Button>
          <Button
            variant={checking ? 'default' : 'ghost'}
            disabled={locked}
            onClick={() => onTool('invoice-check')}
          >
            {ui('Basischeck')}
          </Button>
        </div>
      </div>
      <div className="invoice-sourcebar">
        {select(
          t('Dokument'),
          source.id,
          sources.map((s) => [s.id, s.name]),
          setSourceId,
        )}
        {entries.length > 1 &&
          select(
            'Rechnungs-XML',
            String(index),
            entries.map((e, n) => [String(n), e.name]),
            (v) => setIndex(Number(v)),
          )}
        {entry && (
          <span className="invoice-format">
            <FileCode2 size={15} />
            {entry.invoice.format} · {formatSize(entry.bytes.length, uiLocale())}
          </span>
        )}
      </div>
      {error && (
        <div className="invoice-empty" role="alert">
          <FileCode2 size={34} />
          <h2>
            {entries.length
              ? ui('Die Ausgabe konnte nicht erstellt werden.')
              : ui('Keine lesbare E-Rechnung gefunden.')}
          </h2>
          <p>{ui(error)}</p>
          {!entries.length && (
            <Button variant="outline" onClick={onAdd} disabled={locked}>
              {ui('Rechnungsdatei hinzufügen')}
            </Button>
          )}
        </div>
      )}
      {loading && (
        <div className="invoice-empty" role="status">
          <LoaderCircle className="spin" />
          <p>{ui('Rechnungsdaten werden gelesen …')}</p>
        </div>
      )}
      {i && entry && (
        <>
          <div className="invoice-layout">
            <section className="invoice-sheet">
              <div className="invoice-heading">
                <div>
                  <span>{i.type === '381' ? ui('GUTSCHRIFT') : ui('RECHNUNG')}</span>
                  <h2>{i.number || ui('Ohne Nummer')}</h2>
                  <p>
                    {date(i.date)}
                    {i.dueDate && (
                      <>
                        {' '}
                        {ui(' · fällig ')}
                        {date(i.dueDate)}
                      </>
                    )}
                  </p>
                </div>
                <span className="invoice-profile">
                  {ui(i.profileLabel)}
                  <small>{ui('laut XML')}</small>
                </span>
              </div>
              {checking ? (
                <div className="invoice-checks">
                  <div className={`invoice-check-summary ${errors ? 'has-errors' : ''}`}>
                    <ClipboardCheck size={27} />
                    <div>
                      <h3>
                        {errors
                          ? ui(
                              `${errors} ${errors === 1 ? 'Auffälligkeit' : 'Auffälligkeiten'} gefunden`,
                            )
                          : ui('Keine Fehler im Basischeck gefunden')}
                      </h3>
                      <p>
                        {warnings} {warnings === 1 ? ui('Hinweis') : ui('Hinweise')} ·{' '}
                        {i.checks.length} {ui('ausgewählte Prüfungen')}
                      </p>
                    </div>
                  </div>
                  <p className="invoice-scope">
                    {ui(INVOICE_CHECK_SCOPE)}{' '}
                    {ui(' Ein fehlerfreier Basischeck bestätigt keine Normkonformität.')}
                  </p>
                  {checkInvoice(i, ui).map((c, n) => (
                    <article key={n} className={`invoice-check ${c.level}`}>
                      {c.level === 'pass' ? (
                        <Check size={18} />
                      ) : c.level === 'error' ? (
                        <CircleX size={18} />
                      ) : (
                        <TriangleAlert size={18} />
                      )}
                      <div>
                        <h4>{ui(c.title)}</h4>
                        <p>{ui(c.detail)}</p>
                      </div>
                      <span>
                        {c.level === 'pass'
                          ? ui('OK')
                          : c.level === 'error'
                            ? t('Prüfen')
                            : ui('Hinweis')}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <>
                  <div className="invoice-parties">
                    {party('VON', i.seller)}
                    {party('AN', i.buyer)}
                  </div>
                  {(i.buyerReference || i.orderReference) && (
                    <div className="invoice-references">
                      {i.buyerReference && (
                        <p>
                          <span>{ui('Käuferreferenz')}</span>
                          {i.buyerReference}
                        </p>
                      )}
                      {i.orderReference && (
                        <p>
                          <span>{ui('Bestellung')}</span>
                          {i.orderReference}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="invoice-lines">
                    <div className="invoice-section-heading">
                      <h3>{ui('Positionen')}</h3>
                      <span>{i.lines.length}</span>
                    </div>
                    <div
                      className="invoice-table-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label={ui('Rechnungspositionen')}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>{ui('Position')}</th>
                            <th>{ui('Menge')}</th>
                            <th>{ui('Einzelpreis')}</th>
                            <th>{ui('Steuer')}</th>
                            <th>{ui('Netto')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {i.lines.map((l, n) => (
                            <tr key={n}>
                              <td>
                                <small>{l.id}</small>
                                <strong>{l.name || ui('Ohne Bezeichnung')}</strong>
                                {l.description && <p>{l.description}</p>}
                              </td>
                              <td>
                                {l.quantity} <small>{l.unit}</small>
                              </td>
                              <td>
                                {displayAmount(l.price)}
                                {l.baseQuantity !== '1' && (
                                  <small>
                                    {ui('pro ')}
                                    {l.baseQuantity}
                                  </small>
                                )}
                              </td>
                              <td>{l.taxRate ? l.taxRate + ' %' : l.taxCategory || '—'}</td>
                              <td>{displayAmount(l.net)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!i.lines.length && (
                      <p className="fine-note">{ui('Keine Positionen ausgelesen.')}</p>
                    )}
                  </div>
                  {i.taxes.length > 0 && (
                    <div className="invoice-tax">
                      <h3>{ui('Steueraufschlüsselung')}</h3>
                      {i.taxes.map((t, n) => (
                        <div key={n}>
                          <span>
                            {t.category} · {t.rate || '—'} %
                            <small>{t.reason || ui(`Basis ${displayAmount(t.base)}`)}</small>
                          </span>
                          <b>{displayAmount(t.amount)}</b>
                        </div>
                      ))}
                    </div>
                  )}
                  {(i.payment.length > 0 || i.notes.length > 0) && (
                    <div className="invoice-payment">
                      <h3>{ui('Zahlung & Hinweise')}</h3>
                      {i.payment.map((p, n) => (
                        <div key={n}>
                          {p.name && <p>{p.name}</p>}
                          {p.iban && (
                            <p>
                              <span>{ui('Konto')}</span>
                              <b>{p.iban}</b>
                            </p>
                          )}
                          {p.bic && (
                            <p>
                              <span>{ui('BIC')}</span>
                              {p.bic}
                            </p>
                          )}
                          {p.reference && (
                            <p>
                              <span>{ui('Referenz')}</span>
                              {p.reference}
                            </p>
                          )}
                          {p.terms && <p>{p.terms}</p>}
                        </div>
                      ))}
                      {i.notes.map((n, j) => (
                        <p key={j}>{n}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
              <details className="invoice-xml">
                <summary>{ui('Original-XML ansehen')}</summary>
                <p>
                  {ui('Unveränderte Rechnungsdaten · ')}
                  {entry.name}
                </p>
                <pre>{entry.xml}</pre>
              </details>
            </section>
            <aside className="invoice-aside">
              <section className="invoice-total-card">
                <span>{ui('ZAHLBETRAG')}</span>
                <strong>{displayAmount(i.totals.due)}</strong>
                <p>
                  {i.dueDate
                    ? ui(`Fällig am ${date(i.dueDate)}`)
                    : i.type === '381'
                      ? ui('Gutschrift')
                      : ui('Laut Rechnungs-XML')}
                </p>
                <dl>
                  {(
                    [
                      ['Positionen', 'lines'],
                      ['Nachlässe', 'allowances'],
                      ['Zuschläge', 'charges'],
                      ['Netto', 'net'],
                      ['Steuer', 'tax'],
                      ['Brutto', 'gross'],
                      ['Bereits bezahlt', 'paid'],
                      ['Rundung', 'rounding'],
                    ] as const
                  )
                    .filter(([, key]) => i.totals[key])
                    .map(([label, key]) => (
                      <div key={key}>
                        <dt>{ui(label)}</dt>
                        <dd>{displayAmount(i.totals[key])}</dd>
                      </div>
                    ))}
                </dl>
              </section>
              <section className="invoice-exports">
                <h3>{checking ? ui('Prüfung speichern') : ui('Rechnung exportieren')}</h3>
                <Button disabled={locked} onClick={() => void savePdf()}>
                  {busy ? <JobStatusIcon working size={17} /> : <FileText size={17} />}{' '}
                  {checking ? ui('Prüfbericht als PDF') : ui('Lese-PDF erstellen')}
                </Button>
                {checking ? (
                  <Button
                    variant="outline"
                    disabled={locked}
                    onClick={() =>
                      downloadBlob(
                        new Blob([invoiceCheckText(i, ui)], { type: 'text/plain;charset=utf-8' }),
                        `${filenameStem(entry.name)}-Basischeck.txt`,
                      )
                    }
                  >
                    <Download size={17} />
                    {ui('Bericht als TXT')}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={locked}
                    onClick={() =>
                      downloadBlob(
                        new Blob([invoiceCsv(i, ui)], { type: 'text/csv;charset=utf-8' }),
                        `${filenameStem(entry.name)}${ui('-Positionen.csv')}`,
                      )
                    }
                  >
                    <Table2 size={17} />
                    {ui('Positionen als CSV')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={locked}
                  onClick={() =>
                    downloadBlob(
                      new Blob([new Uint8Array(entry.bytes)], { type: 'application/xml' }),
                      entry.name,
                    )
                  }
                >
                  <FileCode2 size={17} />
                  {ui('Original-XML speichern')}
                </Button>
                {output && (
                  <div className="invoice-output" role="status">
                    <JobStatusIcon fresh={resultFresh} size={18} />
                    <ResultSummary result={output} />
                    <ResultActions
                      result={output}
                      url={url}
                      filename={resultName}
                      onRename={renameResult}
                      fresh={resultFresh}
                      label={t('PDF herunterladen')}
                    />
                  </div>
                )}
                <p>
                  {ui(
                    'Die Lese-PDF zeigt ausgewählte Rechnungsangaben und enthält die Original-XML als Anhang. Sie ist keine zertifizierte ZUGFeRD- oder PDF/A-Datei.',
                  )}
                </p>
              </section>
              {!checking && (
                <button
                  className="invoice-check-link"
                  onClick={() => onTool('invoice-check')}
                  disabled={locked}
                >
                  <ClipboardCheck size={23} />
                  <span>
                    {ui('Angaben & Summen prüfen')}
                    <small>
                      {errors
                        ? ui(`${errors} Auffälligkeit${errors === 1 ? '' : 'en'} im Basischeck`)
                        : ui('Basischeck ansehen')}
                    </small>
                  </span>
                </button>
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
