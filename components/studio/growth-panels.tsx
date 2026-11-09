'use client';
import { useState } from 'react';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import { ui } from '@/lib/ui-language';
import { Choice, Text, Field, Tick, type PanelProps } from './advanced-shared';
import { EvidencePreview } from './evidence-panels';
import { createPortfolio, type PortfolioFile } from '@/lib/pdf-portfolio';
import {
  blankInvoice,
  invoiceCii,
  renderInvoiceDraft,
  draftFromInvoice,
  type InvoiceDraft,
  type InvoiceParty,
} from '@/lib/invoice-create';
import { parseInvoice } from '@/lib/invoice-engine';
import { integratedDocumentServer, runServerJob } from '@/lib/document-server';
import { readEvidence, exportRows } from '@/lib/evidence-engine';
import {
  extractField,
  dateValue,
  numericValue,
  extractPositions,
  type EvidencePage,
  type EvidenceRef,
} from '@/lib/evidence-model';
import { readStatement } from '@/lib/bank-datev/model';
import {
  reconcilePayments,
  paymentSuggestions,
  moneyCents,
  centsText,
  type Payment,
  type Receipt,
  type Allocation,
} from '@/lib/payment-match';
import { pdfBlob, uid } from '@/lib/pdf-engine';
function candidate(
  pages: EvidencePage[],
  aliases: string[],
  kind: 'text' | 'number' | 'date' | 'iban',
) {
  const values = extractField(pages, { id: 'candidate', label: aliases[0], aliases, kind });
  return new Set(values.map((v) => v.value)).size === 1 ? values[0]?.value || '' : '';
}
export function ServerConnection({
  base,
  token,
  setBase,
  setToken,
}: {
  base: string;
  token: string;
  setBase: (s: string) => void;
  setToken: (s: string) => void;
}) {
  return integratedDocumentServer ? (
    <p className="fine-note">
      {ui('Die Prüfung läuft auf dem Dokumentenserver dieser Installation.')}
    </p>
  ) : (
    <details>
      <summary>{ui('Eigenen Dokumentenserver verbinden')}</summary>
      <Text label="Serveradresse" value={base} onChange={setBase} />
      <Text label="API-Schlüssel" value={token} onChange={setToken} type="password" />
      <p className="fine-note">
        {ui(
          'Erst der gestartete Serverauftrag überträgt die ausgewählten Daten an diese Adresse. Der Schlüssel wird nicht gespeichert.',
        )}
      </p>
    </details>
  );
}
export function PortfolioPanel({
  sources,
  busy,
  run,
}: Pick<PanelProps, 'sources' | 'busy' | 'run'>) {
  useLanguage();
  const [files, setFiles] = useState<PortfolioFile[]>([]),
    [title, setTitle] = useState('');
  const add = (selected: File[]) =>
    run(async (ctx) => {
      if (
        selected.length + files.length > 100 ||
        selected.reduce((n, f) => n + f.size, 0) + files.reduce((n, f) => n + f.bytes.length, 0) >
          80 * 1024 * 1024
      )
        throw new Error('Bitte 1 bis 100 Dateien mit insgesamt höchstens 80 MB auswählen.');
      const next = [];
      for (const f of selected) {
        ctx.signal.throwIfAborted();
        next.push({
          name: f.name,
          type: f.type,
          bytes: new Uint8Array(await f.arrayBuffer()),
          description: '',
        });
      }
      ctx.signal.throwIfAborted();
      setFiles([...files, ...next]);
    });
  return (
    <section className="advanced-card">
      <h2>{ui('Originaldateien in einem Portfolio sammeln')}</h2>
      <Text label="Titel des Portfolios" value={title} onChange={setTitle} />
      <Field label="Dateien für das Portfolio">
        <input
          type="file"
          multiple
          disabled={busy}
          onChange={(e) => {
            void add(Array.from(e.target.files || []));
            e.target.value = '';
          }}
        />
      </Field>
      <Button
        variant="outline"
        disabled={busy || !sources.length}
        onClick={() =>
          add(sources.map((s) => new File([pdfBlob(s.bytes)], s.name, { type: 'application/pdf' })))
        }
      >
        {ui('Geöffnete PDFs hinzufügen')}
      </Button>
      {files.map((f, i) => (
        <article className="evidence-finding" key={i}>
          <strong>{f.name}</strong>
          <Text
            label="Beschreibung"
            value={f.description}
            onChange={(description) =>
              setFiles(files.map((v, n) => (n === i ? { ...v, description } : v)))
            }
          />
          <Button variant="ghost" onClick={() => setFiles(files.filter((_, n) => n !== i))}>
            {ui('Entfernen')}
          </Button>
        </article>
      ))}
      <p className="fine-note">
        {ui(
          'PDF, Tabellen, E-Mails und Bilder bleiben einzeln entnehmbar und bytegenau erhalten. Browser zeigen häufig nur das Inhaltsverzeichnis. Anlagen in einem geeigneten PDF-Programm öffnen.',
        )}
      </p>
      <Button
        disabled={busy || !files.length || !title.trim()}
        onClick={() => run((ctx) => createPortfolio(files, title, ctx))}
      >
        {ui('PDF-Portfolio erstellen')}
      </Button>
    </section>
  );
}
const partyFields: [keyof InvoiceParty, string][] = [
  ['name', 'Name / Firma'],
  ['street', 'Straße und Hausnummer'],
  ['postcode', 'Postleitzahl'],
  ['city', 'Ort'],
  ['country', 'Ländercode'],
  ['email', 'E-Mail-Adresse'],
  ['vatId', 'USt-IdNr.'],
  ['taxId', 'Steuernummer'],
  ['contact', 'Kontaktperson'],
  ['phone', 'Telefonnummer'],
];
export function InvoiceCreatePanel({ source, sources, busy, run }: PanelProps) {
  useLanguage();
  const [draft, setDraft] = useState<InvoiceDraft>(blankInvoice),
    [profile, setProfile] = useState<'xrechnung' | 'zugferd'>('xrechnung'),
    [reviewed, setReviewed] = useState(false),
    [base, setBase] = useState(integratedDocumentServer || ''),
    [token, setToken] = useState(''),
    [focus, setFocus] = useState<EvidenceRef>();
  const change = (next: InvoiceDraft) => {
    setDraft(next);
    setReviewed(false);
  };
  return (
    <div className="evidence-layout growth-invoice-layout">
      <section className="advanced-card">
        <h2>{ui('Rechnungsdaten erfassen und prüfen')}</h2>
        <p>
          {ui(
            'EUR-Rechnungen mit Nettopositionen, mehreren Steuersätzen oder begründeter Steuerbefreiung. Rabatte, Gutschriften und Vorauszahlungen werden nicht automatisch übernommen.',
          )}
        </p>
        <Choice
          label="Ausgabeformat"
          value={profile}
          items={[
            ['xrechnung', 'XRechnung'],
            ['zugferd', 'ZUGFeRD'],
          ]}
          onChange={(v) => {
            setProfile(v as typeof profile);
            setReviewed(false);
          }}
        />
        <Field label="Vorhandene E-Rechnung als Entwurf übernehmen">
          <input
            type="file"
            accept=".xml,application/xml,text/xml"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file)
                void run(async () => {
                  if (file.size > 5 * 1024 * 1024) throw new Error('Die XML-Datei ist zu groß.');
                  change(draftFromInvoice(parseInvoice(await file.text())));
                });
            }}
          />
        </Field>
        <Button
          variant="outline"
          disabled={busy || !source}
          onClick={() =>
            run(async (ctx) => {
              const pages = await readEvidence([source], 'auto', ctx),
                d = blankInvoice();
              d.number = candidate(
                pages,
                ['Rechnungsnummer', 'Rechnung-Nr.', 'Invoice number'],
                'text',
              );
              d.date = dateValue(candidate(pages, ['Rechnungsdatum', 'Invoice date'], 'date'));
              d.due = dateValue(
                candidate(pages, ['Fällig am', 'Fälligkeitsdatum', 'Due date'], 'date'),
              );
              d.iban = candidate(pages, ['IBAN'], 'iban');
              const positions = extractPositions(pages);
              if (positions.length)
                d.lines = positions.slice(0, 100).map((p) => ({
                  name: p.label,
                  quantity: numericValue(p.quantity),
                  price: numericValue(p.price),
                  tax: '',
                  exemption: '',
                  unit: 'C62',
                }));
              change(d);
              setFocus(pages[0]?.lines[0]);
            })
          }
        >
          {ui('Angaben aus der geöffneten PDF vorschlagen')}
        </Button>
        <p className="fine-note">
          {ui(
            'Erkennung ersetzt keine Prüfung: Anschriften, Steuerarten und fehlende Angaben ergänzen. Die sichtbare Rechnung wird aus den bestätigten Daten neu erstellt.',
          )}
        </p>
        {(
          [
            ['number', 'Rechnungsnummer', 'text'],
            ['date', 'Rechnungsdatum', 'date'],
            ['delivery', 'Leistungsdatum', 'date'],
            ['due', 'Fällig am', 'date'],
            ['reference', 'Käuferreferenz', 'text'],
            ['iban', 'IBAN', 'text'],
          ] as const
        ).map(([key, label, type]) => (
          <Text
            key={key}
            label={label}
            type={type}
            value={draft[key]}
            onChange={(v) => change({ ...draft, [key]: v })}
          />
        ))}
        {(['seller', 'buyer'] as const).map((key) => (
          <details key={key} open>
            <summary>{ui(key === 'seller' ? 'Rechnungssteller' : 'Rechnungsempfänger')}</summary>
            <div className="growth-form-grid">
              {partyFields
                .filter(
                  ([k]) => key === 'seller' || !['taxId', 'vatId', 'contact', 'phone'].includes(k),
                )
                .map(([k, label]) => (
                  <Text
                    key={k}
                    label={label}
                    value={draft[key][k]}
                    onChange={(v) => change({ ...draft, [key]: { ...draft[key], [k]: v } })}
                  />
                ))}
            </div>
          </details>
        ))}
        {draft.lines.map((l, i) => (
          <article className="evidence-finding" key={i}>
            <h3>
              {ui('Position')} {i + 1}
            </h3>
            <Text
              label="Bezeichnung"
              value={l.name}
              onChange={(name) =>
                change({
                  ...draft,
                  lines: draft.lines.map((v, n) => (n === i ? { ...v, name } : v)),
                })
              }
            />
            <div className="growth-form-grid">
              {(
                [
                  ['quantity', 'Menge'],
                  ['price', 'Netto-Einzelpreis'],
                  ['tax', 'Umsatzsteuer (%)'],
                  ['exemption', 'Befreiungsgrund'],
                ] as const
              ).map(([key, label]) => (
                <Text
                  key={key}
                  label={label}
                  value={l[key]}
                  onChange={(v) =>
                    change({
                      ...draft,
                      lines: draft.lines.map((a, n) => (n === i ? { ...a, [key]: v } : a)),
                    })
                  }
                />
              ))}
              <Choice
                label="Einheit"
                value={l.unit}
                items={[
                  ['C62', 'Stück'],
                  ['HUR', 'Stunden'],
                  ['DAY', 'Tage'],
                  ['KGM', 'Kilogramm'],
                  ['MTR', 'Meter'],
                ]}
                onChange={(unit) =>
                  change({
                    ...draft,
                    lines: draft.lines.map((a, n) => (n === i ? { ...a, unit } : a)),
                  })
                }
              />
            </div>
            <Button
              variant="ghost"
              disabled={draft.lines.length === 1}
              onClick={() => change({ ...draft, lines: draft.lines.filter((_, n) => n !== i) })}
            >
              {ui('Position entfernen')}
            </Button>
          </article>
        ))}
        <Button
          variant="outline"
          disabled={draft.lines.length >= 100}
          onClick={() =>
            change({
              ...draft,
              lines: [
                ...draft.lines,
                { name: '', quantity: '1', price: '', tax: '19', exemption: '', unit: 'C62' },
              ],
            })
          }
        >
          {ui('Position hinzufügen')}
        </Button>
        <Text
          label="Rechnungshinweis"
          value={draft.note}
          onChange={(note) => change({ ...draft, note })}
        />
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async (ctx) => ({
              blob: pdfBlob(await renderInvoiceDraft(draft, ctx.signal, ui)),
              filename: 'Rechnungsentwurf.pdf',
              kind: 'pdf',
              pages: 0,
              note: ui(
                'Lokaler Rechnungsentwurf. Die E-Rechnungsvalidierung ist noch nicht erfolgt.',
              ),
            }))
          }
        >
          {ui('Lokale PDF-Vorschau erstellen')}
        </Button>
        <Tick
          label="Ich habe Anschriften, Positionen, Steuerarten und Zahlungsdaten am Original geprüft."
          value={reviewed}
          onChange={setReviewed}
        />
        <ServerConnection base={base} token={token} setBase={setBase} setToken={setToken} />
        <Button
          disabled={busy || !reviewed || !base || (!integratedDocumentServer && !token)}
          onClick={() =>
            run(async (ctx) => {
              const xml = invoiceCii(draft, profile),
                pdf = await renderInvoiceDraft(draft, ctx.signal, ui),
                body = new FormData();
              ctx.report({ percent: 40, label: 'Rechnung wird unabhängig geprüft …' });
              body.append(
                'file',
                profile === 'xrechnung'
                  ? new Blob([xml], { type: 'application/xml' })
                  : pdfBlob(pdf),
                profile === 'xrechnung' ? 'Rechnung.xml' : 'Rechnung.pdf',
              );
              if (profile === 'zugferd') {
                body.append(
                  'invoice',
                  new Blob([xml], { type: 'application/xml' }),
                  'factur-x.xml',
                );
                body.append('profile', 'T');
              }
              const result = await runServerJob(
                base,
                token,
                profile === 'xrechnung' ? '/v1/xrechnung/validate' : '/v1/zugferd/create',
                body,
                ctx.signal,
              );
              if (result.blob.size > 85 * 1024 * 1024)
                throw new Error('Der Prüfbericht ist zu groß.');
              const zip = await JSZip.loadAsync(await result.blob.arrayBuffer()),
                file = zip.file('Ergebnis.json');
              if (!file) throw new Error('Der unabhängige Prüfbericht fehlt.');
              const report = JSON.parse(await file.async('string'));
              const passed =
                profile === 'xrechnung'
                  ? report.xrechnungAccepted === true &&
                    report.documentHashVerified === true &&
                    report.engine === 'KoSIT'
                  : report.compliant === true &&
                    report.mustangValid === true &&
                    report.pdfa3b === true &&
                    report.declaredPdfaValid === true;
              if (passed && profile === 'xrechnung') {
                zip.file('XRechnung.xml', xml);
                zip.file('Rechnung-Leseansicht.pdf', pdf);
              }
              return {
                blob: await zip.generateAsync({ type: 'blob' }),
                filename: passed ? 'Gepruefte-E-Rechnung.zip' : 'Rechnung-Prueffehler.zip',
                kind: 'zip',
                pages: 0,
                note: ui(
                  passed
                    ? 'Die erzeugte Rechnung hat die unabhängige Prüfung bestanden. Rechnung und Prüfberichte sind gemeinsam enthalten.'
                    : 'Die Rechnung hat die unabhängige Prüfung nicht bestanden. Angaben korrigieren und erneut prüfen.',
                ),
              };
            })
          }
        >
          {ui('E-Rechnung erstellen und unabhängig prüfen')}
        </Button>
      </section>
      {!!sources.length && <EvidencePreview sources={sources} focus={focus} />}
    </div>
  );
}

export function PaymentMatchPanel({ source, sources, busy, run }: PanelProps) {
  useLanguage();
  const [bankId, setBankId] = useState(source.id),
    [payments, setPayments] = useState<Payment[]>([]),
    [receipts, setReceipts] = useState<Receipt[]>([]),
    [allocations, setAllocations] = useState<Allocation[]>([]),
    [focus, setFocus] = useState<EvidenceRef>(),
    [reviewed, setReviewed] = useState(false),
    [paymentId, setPaymentId] = useState(''),
    [receiptId, setReceiptId] = useState(''),
    [amount, setAmount] = useState(''),
    [limit, setLimit] = useState(30);
  const clear = () => {
    setAllocations([]);
    setReviewed(false);
  };
  const original = (p: Payment | Receipt) => {
    const doc = sources.find((s) => s.id === p.sourceId);
    if (doc)
      setFocus({
        sourceId: doc.id,
        name: doc.name,
        page: p.page,
        text: '',
        mode: 'text',
        rects: [],
      });
  };
  let result: ReturnType<typeof reconcilePayments> | undefined,
    error = '';
  try {
    if (payments.length && receipts.length)
      result = reconcilePayments(payments, receipts, allocations);
  } catch (e) {
    error = (e as Error).message;
  }
  const statuses: Record<string, string> = {
    open: 'Offen',
    paid: 'Bezahlt',
    partial: 'Teilweise zugeordnet',
    overpaid: 'Überzahlung / mögliche Doppelzahlung',
    matched: 'Vollständig zugeordnet',
    unassigned: 'Beleg fehlt',
  };
  return (
    <div className="evidence-layout">
      <div>
        <section className="advanced-card">
          <h2>{ui('Belege und Bankbuchungen abgleichen')}</h2>
          <Choice
            label="Kontoauszug"
            value={bankId}
            items={sources.map((s) => [s.id, s.name])}
            translateItems={false}
            onChange={(v) => {
              setBankId(v);
              setPayments([]);
              setReceipts([]);
              clear();
            }}
          />
          <p>
            {ui(
              'Eine Datei als Kontoauszug wählen; jede weitere geöffnete PDF wird als ein Beleg vorgeschlagen. Sammeldateien vorher teilen. Erkannte Daten vor dem Abgleich korrigieren.',
            )}
          </p>
          <Button
            disabled={busy || sources.length < 2}
            onClick={() =>
              run(async (ctx) => {
                const bank = sources.find((s) => s.id === bankId);
                if (!bank) throw new Error('Bitte einen Kontoauszug auswählen.');
                const entry = await readStatement(bank, ctx.signal),
                  p: Payment[] = entry.draft.rows.map((row) => ({
                    id: row.id,
                    date: row.booking_date,
                    amount: row.amount,
                    direction:
                      row.direction === 'credit'
                        ? 'credit'
                        : row.direction === 'debit'
                          ? 'debit'
                          : '',
                    currency: entry.draft.currency,
                    text: row.text,
                    sourceId: bank.id,
                    page: Math.max(0, row.page - 1),
                  })),
                  r: Receipt[] = [];
                for (const doc of sources.filter((s) => s.id !== bankId)) {
                  const pages = await readEvidence([doc], 'auto', ctx);
                  r.push({
                    id: uid(),
                    sourceId: doc.id,
                    page: 0,
                    number: candidate(
                      pages,
                      ['Rechnungsnummer', 'Rechnung-Nr.', 'Invoice number'],
                      'text',
                    ),
                    date: candidate(pages, ['Rechnungsdatum', 'Invoice date'], 'date'),
                    amount: candidate(
                      pages,
                      ['Zahlbetrag', 'Rechnungsbetrag', 'Gesamtbetrag', 'Grand total'],
                      'number',
                    ),
                    partner: '',
                    direction: 'debit',
                    currency: entry.draft.currency || 'EUR',
                  });
                }
                setPayments(p);
                setReceipts(r);
                clear();
              })
            }
          >
            {ui('Buchungen und Belege einlesen')}
          </Button>
        </section>
        {!!payments.length && (
          <section className="advanced-card">
            <h2>{ui('Buchungen prüfen')}</h2>
            {payments.slice(0, limit).map((p, i) => (
              <article className="evidence-finding" key={p.id}>
                <strong>
                  {p.date} · {p.text}
                </strong>
                <div className="growth-form-grid">
                  <Text
                    label="Betrag"
                    value={p.amount}
                    onChange={(amount) => {
                      setPayments(payments.map((v, n) => (n === i ? { ...v, amount } : v)));
                      clear();
                    }}
                  />
                  <Choice
                    label="Zahlungsrichtung"
                    value={p.direction}
                    items={[
                      ['', 'Bitte wählen'],
                      ['debit', 'Ausgabe'],
                      ['credit', 'Einnahme'],
                    ]}
                    onChange={(direction) => {
                      setPayments(
                        payments.map((v, n) =>
                          n === i ? { ...v, direction: direction as Payment['direction'] } : v,
                        ),
                      );
                      clear();
                    }}
                  />
                  <Text
                    label="Währung"
                    value={p.currency}
                    onChange={(currency) => {
                      setPayments(
                        payments.map((v, n) =>
                          n === i ? { ...v, currency: currency.toUpperCase() } : v,
                        ),
                      );
                      clear();
                    }}
                  />
                </div>
                <p>
                  {ui(statuses[result?.payments[i]?.status || 'unassigned'])} ·{' '}
                  {result?.payments[i]?.remaining}
                </p>
                <Button variant="outline" onClick={() => original(p)}>
                  {ui('Original ansehen')}
                </Button>
              </article>
            ))}
            {payments.length > limit && (
              <Button onClick={() => setLimit(limit + 30)}>
                {ui('Weitere Buchungen anzeigen')}
              </Button>
            )}
          </section>
        )}
        {!!receipts.length && (
          <section className="advanced-card">
            <h2>{ui('Belege prüfen')}</h2>
            {receipts.map((r, i) => (
              <article className="evidence-finding" key={r.id}>
                <div className="growth-form-grid">
                  {(
                    [
                      ['number', 'Rechnungsnummer'],
                      ['partner', 'Geschäftspartner'],
                      ['amount', 'Betrag'],
                      ['currency', 'Währung'],
                    ] as const
                  ).map(([key, label]) => (
                    <Text
                      key={key}
                      label={label}
                      value={r[key]}
                      onChange={(v) => {
                        setReceipts(
                          receipts.map((r, n) =>
                            n === i ? { ...r, [key]: key === 'currency' ? v.toUpperCase() : v } : r,
                          ),
                        );
                        clear();
                      }}
                    />
                  ))}
                  <Choice
                    label="Zahlungsrichtung"
                    value={r.direction}
                    items={[
                      ['debit', 'Ausgabe'],
                      ['credit', 'Einnahme'],
                    ]}
                    onChange={(direction) => {
                      setReceipts(
                        receipts.map((v, n) =>
                          n === i ? { ...v, direction: direction as Receipt['direction'] } : v,
                        ),
                      );
                      clear();
                    }}
                  />
                </div>
                <p>
                  {ui(statuses[result?.receipts[i]?.status || 'open'])} ·{' '}
                  {result?.receipts[i]?.remaining}
                </p>
                {r.number && receipts.some((v, n) => n !== i && v.number === r.number) && (
                  <p>{ui('Doppelte Rechnungsnummer bitte prüfen.')}</p>
                )}
                <Button variant="outline" onClick={() => original(r)}>
                  {ui('Original ansehen')}
                </Button>
              </article>
            ))}
            <Tick
              label="Ich habe Beträge, Währungen und Zahlungsrichtungen geprüft."
              value={reviewed}
              onChange={(v) => {
                setReviewed(v);
                if (!v) setAllocations([]);
              }}
            />
            <Button
              disabled={busy || !reviewed || !!error}
              onClick={() =>
                run(async () => {
                  const suggestions = paymentSuggestions(payments, receipts);
                  setAllocations(
                    suggestions
                      .filter((s) => s.receiptIds.length === 1)
                      .map((s) => {
                        const p = payments.find((p) => p.id === s.paymentId)!,
                          r = receipts.find((r) => r.id === s.receiptIds[0])!,
                          amount =
                            moneyCents(p.amount) < moneyCents(r.amount) ? p.amount : r.amount;
                        return {
                          paymentId: p.id,
                          receiptId: r.id,
                          amount: centsText(moneyCents(amount)),
                          confirmed: false,
                        };
                      }),
                  );
                })
              }
            >
              {ui('Eindeutige Zuordnungen vorschlagen')}
            </Button>
            <Choice
              label="Buchung zuordnen"
              value={paymentId}
              items={[
                ['', ui('Bitte wählen')],
                ...payments.map((p): [string, string] => [
                  p.id,
                  `${p.date} · ${p.amount} · ${p.text}`,
                ]),
              ]}
              onChange={setPaymentId}
              translateItems={false}
            />
            <Choice
              label="Beleg zuordnen"
              value={receiptId}
              items={[
                ['', ui('Bitte wählen')],
                ...receipts.map((r): [string, string] => [
                  r.id,
                  `${r.number} · ${r.partner} · ${r.amount}`,
                ]),
              ]}
              onChange={setReceiptId}
              translateItems={false}
            />
            <Text label="Zugeordneter Teilbetrag" value={amount} onChange={setAmount} />
            <Button
              variant="outline"
              disabled={
                !reviewed ||
                !paymentId ||
                !receiptId ||
                !amount ||
                allocations.some((a) => a.paymentId === paymentId && a.receiptId === receiptId)
              }
              onClick={() =>
                setAllocations([...allocations, { paymentId, receiptId, amount, confirmed: false }])
              }
            >
              {ui('Zuordnung ergänzen')}
            </Button>
            {allocations.map((a, i) => (
              <article className="evidence-finding" key={`${a.paymentId}:${a.receiptId}`}>
                <p>
                  {payments.find((p) => p.id === a.paymentId)?.text} →{' '}
                  {receipts.find((r) => r.id === a.receiptId)?.number}
                </p>
                <Text
                  label="Zugeordneter Teilbetrag"
                  value={a.amount}
                  onChange={(amount) =>
                    setAllocations(
                      allocations.map((v, n) => (n === i ? { ...v, amount, confirmed: false } : v)),
                    )
                  }
                />
                <Tick
                  label="Diese Zuordnung ist geprüft."
                  value={a.confirmed}
                  onChange={(confirmed) =>
                    setAllocations(allocations.map((v, n) => (n === i ? { ...v, confirmed } : v)))
                  }
                />
                <Button
                  variant="ghost"
                  onClick={() => setAllocations(allocations.filter((_, n) => n !== i))}
                >
                  {ui('Zuordnung entfernen')}
                </Button>
              </article>
            ))}
            {error && (
              <p className="error-box" role="alert">
                {ui(error)}
              </p>
            )}
            <p className="fine-note">
              {ui(
                'Nur bestätigte Zuordnungen zählen als Zahlung. Gleiche Beträge allein beweisen keine Zahlung. Mehrdeutige Treffer und Überzahlungen bleiben zur Prüfung offen.',
              )}
            </p>
            <Button
              disabled={busy || !reviewed || !result || !!error}
              onClick={() =>
                run(() => {
                  const checked = reconcilePayments(payments, receipts, allocations),
                    sourceName = (id: string) => sources.find((s) => s.id === id)?.name || '';
                  return exportRows(
                    [
                      [
                        'Art',
                        'Nummer / Buchung',
                        'Betrag',
                        'Währung',
                        'Bestätigt zugeordnet',
                        'Restbetrag',
                        'Überzahlung',
                        'Status',
                        'Quelldatei',
                        'Seite',
                        'Zugeordneter Beleg',
                      ].map(ui),
                      ...checked.receipts.map((r) => [
                        ui('Beleg'),
                        r.number,
                        r.amount,
                        r.currency,
                        r.allocated,
                        r.remaining,
                        r.overpaid,
                        ui(statuses[r.status]),
                        sourceName(r.sourceId),
                        String(r.page + 1),
                        '',
                      ]),
                      ...checked.payments.map((p) => [
                        ui('Buchung'),
                        p.text,
                        p.amount,
                        p.currency,
                        p.allocated,
                        p.remaining,
                        '',
                        ui(statuses[p.status]),
                        sourceName(p.sourceId),
                        String(p.page + 1),
                        '',
                      ]),
                      ...allocations.map((a) => {
                        const p = payments.find((p) => p.id === a.paymentId)!,
                          r = receipts.find((r) => r.id === a.receiptId)!;
                        return [
                          ui('Zuordnung'),
                          p.text,
                          a.amount,
                          p.currency,
                          a.confirmed ? a.amount : '0.00',
                          '',
                          '',
                          ui(a.confirmed ? 'Bestätigt' : 'Noch nicht bestätigt'),
                          sourceName(p.sourceId),
                          String(p.page + 1),
                          `${r.number} · ${sourceName(r.sourceId)} · ${ui('Seite')} ${r.page + 1}`,
                        ];
                      }),
                    ],
                    'Zahlungsabgleich',
                    'xlsx',
                    ui('Abgleich'),
                  );
                })
              }
            >
              {ui('Prüfbaren Abgleich exportieren')}
            </Button>
          </section>
        )}
      </div>
      <EvidencePreview sources={sources} focus={focus} />
    </div>
  );
}
