'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { renderPage, sourcePages, uid, type Source } from '@/lib/pdf-engine';
import { invoiceEntries, type InvoiceEntry } from '@/lib/invoice-engine';
import { Choice, Field, PageSelect, PageStage, Tick, type PanelProps } from './advanced-shared';
import {
  compareNumbers,
  parseFieldRules,
  defaultFieldRules,
  extractField,
  findPageGaps,
  parsePseudonyms,
  findPseudonyms,
  attachmentPlan,
  extractPositions,
  reconcilePositions,
  pageRef,
  type EvidencePage,
  type EvidenceRef,
  type Finding,
  type FieldRule,
  type FieldCandidate,
  type PseudonymRule,
  type PseudonymHit,
  type AttachmentReference,
  type AttachmentTarget,
  type Position,
} from '@/lib/evidence-model';
import {
  readEvidence,
  coverage,
  refLabel,
  exportRows,
  findingRows,
  compareInvoiceEvidence,
  ocrReason,
  ocrText,
  correctedOcr,
  pseudonymizedZip,
  linkAttachments,
  readComments,
  commentRows,
  commentMarkdown,
  inspectScans,
  suggestScans,
  saveBestScans,
  type CommentRow,
  type ScanCandidate,
  type ScanChoice,
} from '@/lib/evidence-engine';

const labels = {
  changed: 'Abweichung',
  missing: 'Nicht gefunden',
  review: 'Bitte prüfen',
  match: 'Übereinstimmung',
};
function EvidencePreview({ sources, focus }: { sources: Source[]; focus?: EvidenceRef }) {
  useLanguage();
  const [sourceId, setSourceId] = useState(focus?.sourceId || sources[0]?.id || ''),
    [page, setPage] = useState(focus?.page || 0),
    [active, setActive] = useState<EvidenceRef | undefined>(focus),
    [crop, setCrop] = useState('');
  const box = useRef<HTMLElement>(null),
    source = sources.find((s) => s.id === sourceId) || sources[0];
  useEffect(() => {
    if (focus) {
      setSourceId(focus.sourceId);
      setPage(focus.page);
      setActive(focus);
      box.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focus]);
  useEffect(() => {
    const abort = new AbortController();
    setCrop('');
    if (!source || !active?.rects.length) return;
    void (async () => {
      const { canvas } = await renderPage(source, sourcePages(source)[page], 1600, abort.signal);
      try {
        const r = active.rects,
          left = Math.max(0, Math.min(...r.map((v) => v.x)) - 0.015),
          top = Math.max(0, Math.min(...r.map((v) => v.y)) - 0.02),
          right = Math.min(1, Math.max(...r.map((v) => v.x + v.w)) + 0.015),
          bottom = Math.min(1, Math.max(...r.map((v) => v.y + v.h)) + 0.02);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil((right - left) * canvas.width));
        c.height = Math.max(1, Math.ceil((bottom - top) * canvas.height));
        c.getContext('2d')!.drawImage(
          canvas,
          left * canvas.width,
          top * canvas.height,
          c.width,
          c.height,
          0,
          0,
          c.width,
          c.height,
        );
        if (!abort.signal.aborted) setCrop(c.toDataURL('image/png'));
        c.width = c.height = 0;
      } finally {
        canvas.width = canvas.height = 0;
      }
    })().catch(() => {});
    return () => abort.abort();
  }, [source, page, active]);
  if (!source) return null;
  return (
    <aside
      ref={box}
      className="evidence-preview advanced-card"
      aria-label={ui('Fundstellenvorschau')}
    >
      <h2>{ui('Fundstelle im Original')}</h2>
      <Choice
        label={ui('Vorschaudokument')}
        value={source.id}
        onChange={(id) => {
          setSourceId(id);
          setPage(0);
          setActive(undefined);
        }}
        items={sources.map((s) => [s.id, s.name])}
      />
      <PageSelect
        source={source}
        page={page}
        onChange={(p) => {
          setPage(p);
          setActive(undefined);
        }}
      />
      {crop && (
        <div className="evidence-crop">
          <img src={crop} alt={ui('Vergrößerter Ausschnitt der ausgewählten Fundstelle')} />
        </div>
      )}
      {active && (
        <p className="fine-note">
          {active.mode === 'ocr' ? ui('Per OCR erkannt') : ui('Aus der PDF-Textebene')}:{' '}
          {active.text}
        </p>
      )}
      <PageStage source={source} page={page} rects={active?.rects || []} />
    </aside>
  );
}
export function RefButton({
  value,
  onFocus,
  label,
}: {
  value?: EvidenceRef;
  onFocus: (r: EvidenceRef) => void;
  label?: string;
}) {
  useLanguage();
  return value ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="evidence-ref"
      onClick={() => onFocus({ ...value })}
    >
      {label ? ui(label) + ' · ' : ''}
      {ui(refLabel(value))}
    </Button>
  ) : null;
}
export function EvidenceLayout({
  sources,
  focus,
  children,
}: {
  sources: Source[];
  focus?: EvidenceRef;
  children: ReactNode;
}) {
  useLanguage();
  return (
    <div className="evidence-layout">
      <div className="evidence-controls">{children}</div>
      <EvidencePreview sources={sources} focus={focus} />
    </div>
  );
}
export function ReadOptions({ ocr, setOcr }: { ocr: boolean; setOcr: (v: boolean) => void }) {
  useLanguage();
  return (
    <>
      <Tick label={ui('Alle sichtbaren Seiten per OCR lesen')} value={ocr} onChange={setOcr} />
      <p className="fine-note">
        {ui(
          'Standard: vorhandene Textebene lesen, reine Scanseiten per OCR. Die vollständige OCR liest sichtbare Inhalte unabhängig von der Textebene. Verdrehte Seiten bitte zuerst ausrichten. Verarbeitung auf deinem Gerät; große Stapel brauchen Zeit.',
        )}
      </p>
    </>
  );
}
export function Coverage({ pages }: { pages: EvidencePage[] }) {
  useLanguage();
  return pages.length ? (
    <p className="workbench-notice" role="status">
      {ui(coverage(pages))}
    </p>
  ) : null;
}
export function ReportButtons({
  rows,
  name,
  run,
  busy,
}: {
  rows: string[][];
  name: string;
  run: PanelProps['run'];
  busy: boolean;
}) {
  useLanguage();
  return (
    <div className="advanced-actions">
      <Button disabled={busy} onClick={() => run(() => exportRows(rows, name))}>
        {ui('Excel erstellen')}
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => run(() => exportRows(rows, name, 'csv'))}
      >
        {ui('CSV erstellen')}
      </Button>
    </div>
  );
}
function Findings({
  rows,
  onFocus,
  run,
  busy,
  ready,
  note = 'Die Ergebnisse beruhen auf erkannten Angaben. Unklare Zuordnungen und OCR-Werte bitte im Original prüfen.',
}: {
  rows: Finding[];
  onFocus: (r: EvidenceRef) => void;
  run: PanelProps['run'];
  busy: boolean;
  ready: boolean;
  note?: string;
}) {
  useLanguage();
  const [limit, setLimit] = useState(30);
  if (!ready) return null;
  return (
    <section className="advanced-card">
      <h2>
        {rows.length} {ui(' Prüfergebnisse')}
      </h2>
      <p className="fine-note">{ui(note)}</p>
      {!rows.length && (
        <p>
          {ui(
            'Keine zuordenbaren Abweichungen gefunden. Das bestätigt weder Vollständigkeit noch Fehlerfreiheit.',
          )}
        </p>
      )}
      {rows.slice(0, limit).map((row, i) => (
        <article className={`evidence-finding evidence-${row.status}`} key={row.id + '-' + i}>
          <span className="evidence-status">{ui(labels[row.status])}</span>
          <h3>{ui(row.title)}</h3>
          {(row.oldValue || row.newValue) && (
            <dl className="evidence-values">
              <div>
                <dt>{ui('Erste Angabe')}</dt>
                <dd>{row.oldValue || '—'}</dd>
              </div>
              <div>
                <dt>{ui('Zweite Angabe')}</dt>
                <dd>{row.newValue || '—'}</dd>
              </div>
            </dl>
          )}
          <p>{ui(row.detail)}</p>
          <div className="advanced-actions">
            <RefButton value={row.before} onFocus={onFocus} />
            <RefButton value={row.after} onFocus={onFocus} />
          </div>
        </article>
      ))}
      {rows.length > limit && (
        <Button variant="outline" onClick={() => setLimit(limit + 30)}>
          {ui('Weitere Ergebnisse anzeigen')}
        </Button>
      )}
      <ReportButtons
        rows={findingRows(rows)}
        name="MoinPDF-Pruefergebnisse"
        run={run}
        busy={busy}
      />
    </section>
  );
}

export function NumberComparePanel({ source, sources, busy, run }: PanelProps) {
  useLanguage();
  const [other, setOther] = useState(sources.find((s) => s.id !== source.id)?.id || ''),
    [ocr, setOcr] = useState(false),
    [pages, setPages] = useState<EvidencePage[]>([]),
    [rows, setRows] = useState<Finding[]>([]),
    [focus, setFocus] = useState<EvidenceRef>();
  const clear = () => {
    setPages([]);
    setRows([]);
  };
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Zahlen zwischen zwei Fassungen vergleichen')}</h2>
        <Choice
          label={ui('Zweite Fassung')}
          value={other}
          onChange={(v) => {
            setOther(v);
            clear();
          }}
          items={[
            ['', 'Bitte wählen'],
            ...sources
              .filter((s) => s.id !== source.id)
              .map((s) => [s.id, s.name] as [string, string]),
          ]}
        />
        <ReadOptions
          ocr={ocr}
          setOcr={(v) => {
            setOcr(v);
            clear();
          }}
        />
        <p className="fine-note">
          {ui(
            'Vergleicht Beträge, Prozentwerte, Datumsangaben und mögliche IBANs anhand der Zeilenbeschriftungen. Mehrdeutige Zeilen werden zur Prüfung angezeigt.',
          )}
        </p>
        <Button
          disabled={busy || !other}
          onClick={() =>
            run(async (ctx) => {
              clear();
              const second = sources.find((s) => s.id === other);
              if (!second) throw new Error('Bitte eine zweite Datei hinzufügen.');
              const data = await readEvidence([source, second], ocr ? 'ocr' : 'auto', ctx);
              setRows(
                compareNumbers(
                  data.filter((p) => p.sourceId === source.id),
                  data.filter((p) => p.sourceId === other),
                ),
              );
              setPages(data);
            })
          }
        >
          {ui('Zahlen vergleichen')}
        </Button>
      </section>
      <Coverage pages={pages} />
      <Findings rows={rows} onFocus={setFocus} run={run} busy={busy} ready={!!pages.length} />
    </EvidenceLayout>
  );
}

type CollectedCell = {
  sourceId: string;
  ruleId: string;
  candidates: FieldCandidate[];
  selected: number;
  value: string;
  reviewed: boolean;
};
export function CollectFieldsPanel({ sources, busy, run }: PanelProps) {
  useLanguage();
  const [input, setInput] = useState(defaultFieldRules),
    [ocr, setOcr] = useState(false),
    [pages, setPages] = useState<EvidencePage[]>([]),
    [rules, setRules] = useState<FieldRule[]>([]),
    [cells, setCells] = useState<CollectedCell[]>([]),
    [focus, setFocus] = useState<EvidenceRef>(),
    [visible, setVisible] = useState(40);
  const clear = () => {
    setCells([]);
    setPages([]);
  };
  const change = (index: number, update: Partial<CollectedCell>) =>
    setCells(cells.map((c, i) => (i === index ? { ...c, ...update } : c)));
  const rows = [
    ['Datei', ...rules.flatMap((r) => [r.label, r.label + ' – Fundstelle', r.label + ' – Status'])],
    ...sources.map((s) => [
      s.name,
      ...rules.flatMap((r) => {
        const c = cells.find((v) => v.sourceId === s.id && v.ruleId === r.id),
          ref = c?.candidates[c.selected]?.ref;
        return [
          c?.value || '',
          refLabel(ref),
          c?.reviewed ? 'Geprüft' : c?.value ? 'Ungeprüft' : 'Nicht gefunden',
        ];
      }),
    ]),
  ];
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Gewünschte Felder festlegen')}</h2>
        <Field label={ui('Ein Feld pro Zeile: Feldname = Suchbegriff | Alternative')}>
          <textarea
            rows={7}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              clear();
            }}
          />
        </Field>
        <ReadOptions
          ocr={ocr}
          setOcr={(v) => {
            setOcr(v);
            clear();
          }}
        />
        <p className="fine-note">
          {ui(
            'Liest Werte nach einer passenden Beschriftung, bei Bedarf aus der folgenden Zeile. Für andere Dokumente kannst du eigene Felder ergänzen. Alle ',
          )}
          {sources.length} {ui(' geöffneten Dateien werden ausgewertet.')}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              clear();
              const definitions = parseFieldRules(input),
                data = await readEvidence(sources, ocr ? 'ocr' : 'auto', ctx);
              setRules(definitions);
              setPages(data);
              setCells(
                sources.flatMap((s) =>
                  definitions.map((r) => {
                    const candidates = extractField(
                      data.filter((p) => p.sourceId === s.id),
                      r,
                    );
                    return {
                      sourceId: s.id,
                      ruleId: r.id,
                      candidates,
                      selected: candidates.length ? 0 : -1,
                      value: candidates[0]?.value || '',
                      reviewed: false,
                    };
                  }),
                ),
              );
            })
          }
        >
          {ui('Felder aus allen Dateien sammeln')}
        </Button>
      </section>
      <Coverage pages={pages} />
      {!!cells.length && (
        <section className="advanced-card">
          <h2>{ui('Werte und Fundstellen prüfen')}</h2>
          {cells.slice(0, visible).map((cell, index) => {
            const rule = rules.find((r) => r.id === cell.ruleId)!,
              src = sources.find((s) => s.id === cell.sourceId)!;
            return (
              <article className="evidence-finding" key={`${cell.sourceId}-${cell.ruleId}`}>
                <h3>
                  {src.name} · {ui(rule.label)}
                </h3>
                {cell.candidates.length > 1 && (
                  <Choice
                    label={ui('Gefundene Angabe wählen')}
                    value={String(cell.selected)}
                    onChange={(v) => {
                      const selected = Number(v);
                      change(index, {
                        selected,
                        value: cell.candidates[selected]?.value || '',
                        reviewed: false,
                      });
                    }}
                    items={cell.candidates.map((c, i) => [
                      String(i),
                      `${c.value} · Seite ${c.ref.page + 1}`,
                    ])}
                  />
                )}
                <Field label={ui('Wert')}>
                  <input
                    value={cell.value}
                    onChange={(e) => change(index, { value: e.target.value, reviewed: false })}
                  />
                </Field>
                <p className="fine-note">
                  {!cell.candidates.length
                    ? ui('Nicht erkannt – Wert manuell ergänzen.')
                    : cell.candidates.length > 1
                      ? ui('Mehrere Kandidaten gefunden.')
                      : cell.candidates[0].uncertain
                        ? ui('Erkennung oder Zuordnung bitte kontrollieren.')
                        : ui('Passende Beschriftung gefunden.')}
                </p>
                <RefButton value={cell.candidates[cell.selected]?.ref} onFocus={setFocus} />
                <Tick
                  label={ui('Wert geprüft')}
                  value={cell.reviewed}
                  onChange={(reviewed) => change(index, { reviewed })}
                />
              </article>
            );
          })}
          {cells.length > visible && (
            <Button variant="outline" onClick={() => setVisible(visible + 40)}>
              {ui('Weitere Werte anzeigen')}
            </Button>
          )}
          <p className="fine-note">
            {ui('Ungeprüfte und fehlende Werte werden im Export ausdrücklich gekennzeichnet.')}
          </p>
          <ReportButtons rows={rows} name="Gesammelte-Belegfelder" run={run} busy={busy} />
        </section>
      )}
    </EvidenceLayout>
  );
}

export function InvoiceEvidencePanel({ source, sources, busy, run }: PanelProps) {
  useLanguage();
  const [entries, setEntries] = useState<InvoiceEntry[]>([]),
    [entry, setEntry] = useState('0'),
    [pages, setPages] = useState<EvidencePage[]>([]),
    [rows, setRows] = useState<Finding[]>([]),
    [focus, setFocus] = useState<EvidenceRef>();
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Sichtbare Rechnung mit ihrer XML vergleichen')}</h2>
        <p>
          {ui(
            'Die sichtbaren Seiten werden auf deinem Gerät per OCR gelesen und mit ausgewählten Rechnungsangaben aus der eingebetteten XML verglichen.',
          )}
        </p>
        <p className="fine-note">
          {ui(
            'Erste Angabe = XML, zweite Angabe = sichtbare Rechnung. Dies prüft weder Signaturen noch die Echtheit einer Rechnung. Ein nicht erkannter Wert bleibt ungeklärt.',
          )}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              setPages([]);
              setRows([]);
              setEntries([]);
              if (source.invoiceOriginal)
                throw new Error(
                  'Bitte eine originale Rechnungs-PDF mit eingebetteter XML öffnen. Eine aus XML erzeugte Leseansicht wäre kein unabhängiger Vergleich.',
                );
              const found = await invoiceEntries(source);
              setEntries(found);
              setEntry('0');
              const data = await readEvidence([source], 'ocr', ctx);
              setPages(data);
              setRows(compareInvoiceEvidence(found[0].invoice, data));
            })
          }
        >
          {ui('Rechnung und XML abgleichen')}
        </Button>
        {entries.length > 1 && (
          <Choice
            label={ui('Eingebettete Rechnung')}
            value={entry}
            onChange={(v) => {
              setEntry(v);
              setRows(compareInvoiceEvidence(entries[Number(v)].invoice, pages));
            }}
            items={entries.map((e, i) => [String(i), e.name])}
          />
        )}
      </section>
      <Coverage pages={pages} />
      <Findings rows={rows} onFocus={setFocus} run={run} busy={busy} ready={!!pages.length} />
    </EvidenceLayout>
  );
}

export function PageGapsPanel({ sources, busy, run }: PanelProps) {
  useLanguage();
  const [ocr, setOcr] = useState(false),
    [pages, setPages] = useState<EvidencePage[]>([]),
    [rows, setRows] = useState<Finding[]>([]),
    [focus, setFocus] = useState<EvidenceRef>();
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Gedruckte Seitenzählungen prüfen')}</h2>
        <p>
          {ui(
            'Findet Lücken, wiederholte Seitennummern und Sprünge in Angaben wie „Seite 3 von 7“. Jede Datei wird getrennt betrachtet.',
          )}
        </p>
        <ReadOptions
          ocr={ocr}
          setOcr={(v) => {
            setOcr(v);
            setPages([]);
            setRows([]);
          }}
        />
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              setPages([]);
              setRows([]);
              const data = await readEvidence(sources, ocr ? 'ocr' : 'auto', ctx);
              setPages(data);
              setRows(findPageGaps(data));
            })
          }
        >
          {ui('Dokumentlücken suchen')}
        </Button>
      </section>
      <Coverage pages={pages} />
      <Findings rows={rows} onFocus={setFocus} run={run} busy={busy} ready={!!pages.length} />
    </EvidenceLayout>
  );
}

export function OcrReviewPanel({ source, sources, busy, run }: PanelProps) {
  useLanguage();
  const [pages, setPages] = useState<EvidencePage[]>([]),
    [corrections, setCorrections] = useState<Record<string, string>>({}),
    [threshold, setThreshold] = useState('85'),
    [all, setAll] = useState(false),
    [focus, setFocus] = useState<EvidenceRef>(),
    [limit, setLimit] = useState(40);
  const words = useMemo(
    () =>
      pages
        .flatMap((p) =>
          p.words.map((w) => ({
            key: `${p.sourceId}:${p.page}:${w.id}`,
            word: w,
            page: p,
            reason: ocrReason(w, Number(threshold)),
          })),
        )
        .filter((w) => all || w.reason),
    [pages, threshold, all],
  );
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Erkannte Wörter am Original korrigieren')}</h2>
        <p>
          {ui(
            'Die OCR markiert unsichere Wörter und Zahlenwerte. Klicke auf eine Fundstelle, um den vergrößerten Originalausschnitt zu sehen.',
          )}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              setPages([]);
              setCorrections({});
              const data = await readEvidence([source], 'ocr', ctx);
              setPages(data);
            })
          }
        >
          {ui('OCR mit Wortprüfung starten')}
        </Button>
      </section>
      <Coverage pages={pages} />
      {!!pages.length && (
        <section className="advanced-card">
          <Choice
            label={ui('Wörter unter dieser OCR-Sicherheit markieren')}
            value={threshold}
            onChange={(v) => {
              setThreshold(v);
              setLimit(40);
            }}
            items={[
              ['70', '70 %'],
              ['85', '85 %'],
              ['95', '95 %'],
            ]}
          />
          <Tick
            label={ui('Alle Wörter anzeigen')}
            value={all}
            onChange={(v) => {
              setAll(v);
              setLimit(40);
            }}
          />
          <p>
            {words.length} {ui(' Wörter in dieser Ansicht · ')}
            {Object.keys(corrections).length} {ui(' bearbeitet')}
          </p>
          {!words.length && (
            <p>
              {ui(
                'Keine Wörter für diesen Filter gefunden. Über „Alle Wörter anzeigen“ kannst du die gesamte Erkennung kontrollieren.',
              )}
            </p>
          )}
          {words.slice(0, limit).map(({ key, word, page, reason }) => (
            <article className="evidence-finding" key={key}>
              <p className="fine-note">
                {ui('Seite ')}
                {page.page + 1} · {reason || ui('Manuelle Kontrolle')}
              </p>
              <Field label={ui(`Erkannt: ${word.text}`)}>
                <input
                  value={corrections[key] ?? word.text}
                  maxLength={200}
                  onChange={(e) => setCorrections({ ...corrections, [key]: e.target.value })}
                />
              </Field>
              <RefButton
                value={{ ...pageRef(page), text: word.text, rects: [word] }}
                onFocus={setFocus}
              />
            </article>
          ))}
          {words.length > limit && (
            <Button variant="outline" onClick={() => setLimit(limit + 40)}>
              {ui('Weitere Wörter anzeigen')}
            </Button>
          )}
          <p className="fine-note">
            {ui(
              'Die PDF-Ausgabe erhält korrigierten Suchtext hinter den unveränderten Seitenbildern. Sichtbare Schreibfehler im Original werden dadurch nicht geändert.',
            )}
          </p>
          <div className="advanced-actions">
            <Button
              disabled={busy || !pages.some((p) => p.words.length)}
              onClick={() => run((ctx) => correctedOcr(source, pages, corrections, ctx))}
            >
              {ui('PDF mit korrigierter Textebene')}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => ({
                  blob: new Blob([ocrText(pages, corrections)], {
                    type: 'text/plain;charset=utf-8',
                  }),
                  filename: 'OCR-korrigiert.txt',
                  kind: 'data',
                  pages: pages.length,
                }))
              }
            >
              {ui('Korrigierten Text exportieren')}
            </Button>
          </div>
        </section>
      )}
    </EvidenceLayout>
  );
}

export function PseudonymPanel({ sources, busy, run }: PanelProps) {
  useLanguage();
  const [input, setInput] = useState(''),
    [rules, setRules] = useState<PseudonymRule[]>([]),
    [pages, setPages] = useState<EvidencePage[]>([]),
    [hits, setHits] = useState<PseudonymHit[]>([]),
    [focus, setFocus] = useState<EvidenceRef>(),
    [confirmed, setConfirmed] = useState(false),
    [limit, setLimit] = useState(40);
  const clear = () => {
    setPages([]);
    setHits([]);
    setConfirmed(false);
  };
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Gleiche Angaben überall gleich ersetzen')}</h2>
        <Field label={ui('Ein Originalbegriff = Platzhalter pro Zeile')}>
          <textarea
            rows={7}
            placeholder={ui('Max Mustermann = Person A\nMusterfirma GmbH = Firma B')}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              clear();
            }}
          />
        </Field>
        <p className="fine-note">
          {ui(
            'Namen, Schreibvarianten, E-Mail-Adressen oder Kontonummern ausdrücklich angeben. Gesucht wird ohne Beachtung der Großschreibung in den sichtbaren OCR-Wörtern. Unterschiedliche Schreibweisen können auf denselben Platzhalter verweisen. Eine automatische Erkennung aller personenbezogenen Angaben ist damit nicht verbunden.',
          )}
        </p>
        <Button
          disabled={busy || !input.trim()}
          onClick={() =>
            run(async (ctx) => {
              clear();
              const definitions = parsePseudonyms(input),
                data = await readEvidence(sources, 'ocr', ctx);
              setRules(definitions);
              setPages(data);
              setHits(findPseudonyms(data, definitions));
            })
          }
        >
          {ui('Treffer in allen Dateien suchen')}
        </Button>
      </section>
      <Coverage pages={pages} />
      {!!pages.length && (
        <section className="advanced-card">
          <h2>
            {hits.length} {ui(' Treffer prüfen')}
          </h2>
          {rules.map((r, i) => (
            <p key={i}>
              {r.term} → <strong>{r.replacement}</strong> ·{' '}
              {hits.filter((h) => h.rule === i).length} {ui(' Treffer')}
            </p>
          ))}
          {hits.slice(0, limit).map((hit, index) => (
            <article className="evidence-finding" key={hit.id}>
              <Tick
                label={`${hit.ref.text} → ${rules[hit.rule].replacement}`}
                value={hit.selected}
                onChange={(selected) => {
                  setHits(hits.map((h, i) => (i === index ? { ...h, selected } : h)));
                  setConfirmed(false);
                }}
              />
              <RefButton value={hit.ref} onFocus={setFocus} />
            </article>
          ))}
          {hits.length > limit && (
            <Button variant="outline" onClick={() => setLimit(limit + 40)}>
              {ui('Weitere Treffer anzeigen')}
            </Button>
          )}
          <p className="workbench-notice">
            {ui(
              'Nicht erkannte oder abgewählte Angaben bleiben sichtbar. Die Ausgabe enthält neue Seitenbilder mit neutralen Dateinamen; die Originaldateien bleiben erhalten.',
            )}
          </p>
          <Tick
            label={ui('Ich habe die Trefferbereiche und Platzhalter geprüft.')}
            value={confirmed}
            onChange={setConfirmed}
          />
          <Button
            disabled={busy || !confirmed || !hits.some((h) => h.selected)}
            onClick={() => run((ctx) => pseudonymizedZip(sources, rules, hits, ctx))}
          >
            {ui('Pseudonymisierte PDFs als ZIP erstellen')}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(() =>
                exportRows(
                  [
                    ['Original (vertraulich)', 'Platzhalter'],
                    ...rules.map((r) => [r.term, r.replacement]),
                  ],
                  'Vertrauliche-Zuordnung',
                  'csv',
                ),
              )
            }
          >
            {ui('Vertrauliche Zuordnung separat exportieren')}
          </Button>
          <p className="fine-note">
            {ui(
              'Die Zuordnungsdatei enthält die Originalangaben. Sie gehört nicht in das Paket für Empfänger.',
            )}
          </p>
        </section>
      )}
    </EvidenceLayout>
  );
}

export function AttachmentLinksPanel({ sources, busy, run }: PanelProps) {
  useLanguage();
  const [ocr, setOcr] = useState(false),
    [pages, setPages] = useState<EvidencePage[]>([]),
    [targets, setTargets] = useState<AttachmentTarget[]>([]),
    [refs, setRefs] = useState<AttachmentReference[]>([]),
    [focus, setFocus] = useState<EvidenceRef>(),
    [confirmed, setConfirmed] = useState(false),
    [limit, setLimit] = useState(40);
  const clear = () => {
    setPages([]);
    setRefs([]);
    setTargets([]);
    setConfirmed(false);
  };
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Anlagenverweise mit Zielseiten verbinden')}</h2>
        <p>
          {ui(
            'Erkennt Verweise wie „siehe Anlage 3“ und passende Überschriften oder Dateinamen. Das Ergebnis ist ein zusammenhängendes Dokument mit anklickbaren Verweisen.',
          )}
        </p>
        <ReadOptions
          ocr={ocr}
          setOcr={(v) => {
            setOcr(v);
            clear();
          }}
        />
        <p className="fine-note">
          {ui('Reihenfolge im Paket: ')}
          {sources.map((s) => s.name).join(' → ')}
          {ui('. Offene oder mehrdeutige Verweise kannst du einer beliebigen Seite zuordnen.')}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              clear();
              const data = await readEvidence(sources, ocr ? 'ocr' : 'auto', ctx),
                plan = attachmentPlan(data);
              setPages(data);
              setRefs(plan.references);
              setTargets([
                ...plan.targets,
                ...data
                  .filter(
                    (p) =>
                      !plan.targets.some(
                        (t) => t.ref.sourceId === p.sourceId && t.ref.page === p.page,
                      ),
                  )
                  .map((p, i) => ({ id: `manual-${i}`, label: 'Zielseite', ref: pageRef(p) })),
              ]);
            })
          }
        >
          {ui('Anlagenverweise erkennen')}
        </Button>
      </section>
      <Coverage pages={pages} />
      {!!pages.length && (
        <section className="advanced-card">
          <h2>
            {refs.length} {ui(' Verweise · ')}
            {refs.filter((r) => !r.target).length} {ui(' offen')}
          </h2>
          {!refs.length && (
            <p>
              {ui(
                'Keine Verweise im Fließtext gefunden. Erkannt werden „Anlage“, „Anhang“ oder „Appendix“ mit einer Nummer oder einem einzelnen Buchstaben.',
              )}
            </p>
          )}
          {refs.slice(0, limit).map((r, index) => (
            <article className="evidence-finding" key={r.id}>
              <h3>{r.label}</h3>
              <p>{r.ref.text}</p>
              <RefButton value={r.ref} onFocus={setFocus} />
              <Choice
                label={ui('Zielseite')}
                value={r.target}
                onChange={(target) => {
                  setRefs(refs.map((v, i) => (i === index ? { ...v, target } : v)));
                  setConfirmed(false);
                }}
                items={[
                  ['', 'Offen lassen'],
                  ...targets.map(
                    (t) => [t.id, `${t.label} · ${refLabel(t.ref)}`] as [string, string],
                  ),
                ]}
              />
              <RefButton
                value={targets.find((t) => t.id === r.target)?.ref}
                label={ui('Ziel prüfen')}
                onFocus={setFocus}
              />
              {r.candidates.length !== 1 && (
                <p className="fine-note">
                  {r.candidates.length
                    ? ui('Mehrere passende Anlagen gefunden.')
                    : ui('Keine eindeutige Anlagenüberschrift gefunden.')}
                </p>
              )}
            </article>
          ))}
          {refs.length > limit && (
            <Button variant="outline" onClick={() => setLimit(limit + 40)}>
              {ui('Weitere Verweise anzeigen')}
            </Button>
          )}
          <Tick
            label={ui('Ich habe die zugeordneten Zielseiten geprüft.')}
            value={confirmed}
            onChange={setConfirmed}
          />
          <Button
            disabled={busy || !confirmed || !refs.some((r) => r.target)}
            onClick={() => run((ctx) => linkAttachments(sources, targets, refs, ctx))}
          >
            {ui('PDF-Paket mit Anlagenlinks erstellen')}
          </Button>
          <ReportButtons
            rows={[
              ['Verweis', 'Datei / Seite', 'Text', 'Ziel', 'Status'],
              ...refs.map((r) => [
                r.label,
                refLabel(r.ref),
                r.ref.text,
                refLabel(targets.find((t) => t.id === r.target)?.ref),
                r.target ? 'Zugeordnet' : 'Offen',
              ]),
            ]}
            name="Anlagen-Zuordnung"
            run={run}
            busy={busy}
          />
        </section>
      )}
    </EvidenceLayout>
  );
}

export function BestScansPanel({ source, sources, busy, run }: PanelProps) {
  useLanguage();
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]),
    [choices, setChoices] = useState<ScanChoice[]>([]),
    [focus, setFocus] = useState<EvidenceRef>(),
    [limit, setLimit] = useState(30);
  const ref = (c: ScanCandidate): EvidenceRef => ({
    sourceId: c.sourceId,
    name: c.name,
    page: c.page,
    text: `Qualitätsvorschlag ${Math.round(c.score)}/100 · Kontrast ${Math.round(c.contrast * 100)} %`,
    rects: [],
    mode: 'text',
  });
  const update = (index: number, change: Partial<ScanChoice>) =>
    setChoices(choices.map((c, i) => (i === index ? { ...c, ...change } : c)));
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Die besten Seiten aus mehreren Scans zusammenstellen')}</h2>
        <p>
          {ui(
            'Die gewählte Hauptdatei legt zunächst Seitenzahl und Reihenfolge fest. Ähnliche Seiten aus den weiteren Dateien werden anhand von Bildstruktur, Schärfe, Kontrast und Randinhalt vorgeschlagen.',
          )}
        </p>
        <p className="fine-note">
          {ui(
            'Rauschen kann scharf wirken und unterschiedliche Seiten können ähnlich aussehen. Die Bewertung ist eine Hilfe zur Auswahl; bestätige jede Seite am Original.',
          )}
        </p>
        <Button
          disabled={busy || sources.length < 2}
          onClick={() =>
            run(async (ctx) => {
              setCandidates([]);
              setChoices([]);
              const data = await inspectScans(sources, ctx);
              setCandidates(data);
              setChoices(suggestScans(data, source.id));
            })
          }
        >
          {ui('Scans vergleichen und Seiten vorschlagen')}
        </Button>
        {sources.length < 2 && (
          <p>{ui('Bitte mindestens zwei Scans desselben Dokuments hinzufügen.')}</p>
        )}
      </section>
      {!!candidates.length && (
        <section className="advanced-card">
          <h2>{ui('Ausgabeseiten zusammenstellen')}</h2>
          {choices.slice(0, limit).map((choice, index) => {
            const selected = candidates.find((c) => c.key === choice.selected),
              original = candidates.find((c) => c.key === choice.reference);
            return (
              <article className="evidence-finding" key={choice.id}>
                <h3>
                  {ui('Ausgabeseite ')}
                  {index + 1}
                </h3>
                <Choice
                  label={ui('Verwendete Originalseite')}
                  value={choice.selected}
                  onChange={(selected) => update(index, { selected, confirmed: false })}
                  items={candidates.map((c) => [
                    c.key,
                    `${c.name} · Seite ${c.page + 1} · Wert ${Math.round(c.score)}/100`,
                  ])}
                />
                <p className="fine-note">
                  {choice.confidence
                    ? ui(
                        `Automatischer Ähnlichkeitswert: ${Math.round(choice.confidence * 100)} %. `,
                      )
                    : ui('Keine eindeutig bessere Alternative vorgeschlagen. ')}
                  {ui('Inhalt und abgeschnittene Ränder bitte prüfen.')}
                </p>
                <div className="advanced-actions">
                  {original && (
                    <RefButton value={ref(original)} label={ui('Referenz')} onFocus={setFocus} />
                  )}{' '}
                  {selected && (
                    <RefButton value={ref(selected)} label={ui('Auswahl')} onFocus={setFocus} />
                  )}
                </div>
                <Tick
                  label={ui('Diese Ausgabeseite ist geprüft.')}
                  value={choice.confirmed}
                  onChange={(confirmed) => update(index, { confirmed })}
                />
                <div className="advanced-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...choices];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      setChoices(next);
                    }}
                  >
                    {ui('Nach oben')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === choices.length - 1}
                    onClick={() => {
                      const next = [...choices];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      setChoices(next);
                    }}
                  >
                    {ui('Nach unten')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setChoices(choices.filter((_, i) => i !== index))}
                  >
                    {ui('Entfernen')}
                  </Button>
                </div>
              </article>
            );
          })}
          {choices.length > limit && (
            <Button variant="outline" onClick={() => setLimit(limit + 30)}>
              {ui('Weitere Seiten anzeigen')}
            </Button>
          )}
          <div className="advanced-actions">
            <Button
              variant="outline"
              onClick={() => {
                setChoices([
                  ...choices,
                  {
                    id: uid(),
                    reference: candidates[0].key,
                    selected: candidates[0].key,
                    confidence: 0,
                    confirmed: false,
                  },
                ]);
                setLimit(choices.length + 1);
              }}
            >
              {ui('Weitere Seite hinzufügen')}
            </Button>
            <Button
              disabled={busy || !choices.length || choices.some((c) => !c.confirmed)}
              onClick={() => run((ctx) => saveBestScans(sources, candidates, choices, ctx))}
            >
              {ui('Bestätigte Seiten als PDF')}
            </Button>
          </div>
          <p className="fine-note">
            {choices.filter((c) => c.confirmed).length} {ui(' von ')}
            {choices.length}{' '}
            {ui(
              ' Seiten bestätigt. Gewählte Originalseiten werden ohne erneute Bildkomprimierung übernommen.',
            )}
          </p>
          <ReportButtons
            rows={[
              ['Ausgabeseite', 'Quelldatei', 'Quellseite', 'Qualitätswert', 'Geprüft'],
              ...choices.map((c, i) => {
                const found = candidates.find((v) => v.key === c.selected)!;
                return [
                  String(i + 1),
                  found.name,
                  String(found.page + 1),
                  String(Math.round(found.score)),
                  c.confirmed ? 'ja' : 'nein',
                ];
              }),
            ]}
            name="Scan-Seitenauswahl"
            run={run}
            busy={busy}
          />
        </section>
      )}
    </EvidenceLayout>
  );
}

export function ReconcilePanel({ source, sources, busy, run }: PanelProps) {
  useLanguage();
  const [order, setOrder] = useState(
      sources.filter((s) => s.id !== source.id).length > 1
        ? sources.find((s) => s.id !== source.id)!.id
        : '',
    ),
    [invoice, setInvoice] = useState(sources.filter((s) => s.id !== source.id).at(-1)?.id || ''),
    [ocr, setOcr] = useState(false),
    [pages, setPages] = useState<EvidencePage[]>([]),
    [positions, setPositions] = useState<Record<string, Position[]>>({}),
    [focus, setFocus] = useState<EvidenceRef>(),
    [rows, setRows] = useState<Finding[]>([]),
    [compared, setCompared] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const selected = sources.length
    ? [
        source,
        ...(order ? [sources.find((s) => s.id === order)!] : []),
        ...(invoice ? [sources.find((s) => s.id === invoice)!] : []),
      ].filter(Boolean)
    : [];
  const clear = () => {
    setPages([]);
    setPositions({});
    setRows([]);
    setCompared(false);
    setConfirmed(false);
  };
  const change = (id: string, index: number, update: Partial<Position>) => {
    setPositions({
      ...positions,
      [id]: positions[id].map((r, i) => (i === index ? { ...r, ...update } : r)),
    });
    setCompared(false);
    setConfirmed(false);
  };
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Angebot → Auftrag → Rechnung')}</h2>
        <p>
          {ui('Die oben gewählte Datei ist das Angebot. Ein Auftrag kann optional dazukommen.')}
        </p>
        <Choice
          label={ui('Auftrag (optional)')}
          value={order}
          onChange={(v) => {
            setOrder(v);
            clear();
          }}
          items={[
            ['', 'Ohne Auftrag'],
            ...sources
              .filter((s) => s.id !== source.id)
              .map((s) => [s.id, s.name] as [string, string]),
          ]}
        />
        <Choice
          label={ui('Rechnung')}
          value={invoice}
          onChange={(v) => {
            setInvoice(v);
            clear();
          }}
          items={[
            ['', 'Bitte wählen'],
            ...sources
              .filter((s) => s.id !== source.id)
              .map((s) => [s.id, s.name] as [string, string]),
          ]}
        />
        <ReadOptions
          ocr={ocr}
          setOcr={(v) => {
            setOcr(v);
            clear();
          }}
        />
        <p className="fine-note">
          {ui(
            'Vorschläge erkennen einfache Positionszeilen mit Positionsnummer, Beschreibung, Menge, Einzelpreis und Betrag. Abweichende Tabellen bitte vor dem Vergleich korrigieren. Preisbasis, Rabatte und Steuersätze werden nicht automatisch umgerechnet.',
          )}
        </p>
        <Button
          disabled={busy || !invoice || invoice === order}
          onClick={() =>
            run(async (ctx) => {
              clear();
              const data = await readEvidence(selected, ocr ? 'ocr' : 'auto', ctx);
              setPages(data);
              setPositions(
                Object.fromEntries(
                  selected.map((s) => [
                    s.id,
                    extractPositions(data.filter((p) => p.sourceId === s.id)),
                  ]),
                ),
              );
            })
          }
        >
          {ui('Positionen auslesen')}
        </Button>
        {invoice && invoice === order && (
          <p className="error-box">
            {ui('Auftrag und Rechnung müssen unterschiedliche Dateien sein.')}
          </p>
        )}
      </section>
      <Coverage pages={pages} />
      {!!pages.length && (
        <section className="advanced-card">
          <h2>{ui('Erfasste Positionen prüfen')}</h2>
          {selected.map((s) => (
            <section className="evidence-position-group" key={s.id}>
              <h3>
                {s.id === source.id
                  ? ui('Angebot')
                  : s.id === order
                    ? ui('Auftrag')
                    : ui('Rechnung')}{' '}
                · {s.name}
              </h3>
              {!(positions[s.id] || []).length && (
                <p>
                  {ui('Keine einfachen Positionszeilen erkannt. Du kannst sie manuell ergänzen.')}
                </p>
              )}
              {(positions[s.id] || []).map((p, index) => (
                <article className="evidence-finding" key={index}>
                  <Field label={ui('Beschreibung (für Zuordnung)')}>
                    <input
                      value={p.label}
                      onChange={(e) => change(s.id, index, { label: e.target.value })}
                    />
                  </Field>
                  <div className="evidence-position-values">
                    {(['quantity', 'price', 'total'] as const).map((k) => (
                      <Field
                        key={k}
                        label={
                          { quantity: 'Menge', price: 'Einzelpreis', total: 'Positionsbetrag' }[k]
                        }
                      >
                        <input
                          value={p[k]}
                          onChange={(e) => change(s.id, index, { [k]: e.target.value })}
                        />
                      </Field>
                    ))}
                  </div>
                  <Choice
                    label={ui('Fundstellenseite')}
                    value={String(p.ref.page)}
                    onChange={(v) => {
                      const page = pages.find((d) => d.sourceId === s.id && d.page === Number(v))!;
                      change(s.id, index, { ref: pageRef(page) });
                    }}
                    items={Array.from({ length: s.pdf.numPages }, (_, i) => [
                      String(i),
                      `Seite ${i + 1}`,
                    ])}
                  />
                  <RefButton value={p.ref} onFocus={setFocus} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPositions({
                        ...positions,
                        [s.id]: positions[s.id].filter((_, i) => i !== index),
                      });
                      setCompared(false);
                      setConfirmed(false);
                    }}
                  >
                    {ui('Position entfernen')}
                  </Button>
                </article>
              ))}
              <Button
                variant="outline"
                onClick={() => {
                  const page = pages.find((p) => p.sourceId === s.id)!;
                  setPositions({
                    ...positions,
                    [s.id]: [
                      ...(positions[s.id] || []),
                      {
                        id: uid(),
                        label: '',
                        quantity: '',
                        price: '',
                        total: '',
                        ref: pageRef(page),
                      },
                    ],
                  });
                  setCompared(false);
                  setConfirmed(false);
                }}
              >
                {ui('Position ergänzen')}
              </Button>
            </section>
          ))}
          <Tick
            label={ui(
              'Beschreibungen, Mengen, Preise und Beträge sind geprüft und haben dieselbe Einheit / Währung.',
            )}
            value={confirmed}
            onChange={setConfirmed}
          />
          <Button
            disabled={busy || !confirmed || selected.some((s) => !positions[s.id]?.length)}
            onClick={() =>
              run(async () => {
                if (
                  selected.some((s) =>
                    positions[s.id].some(
                      (p) => ![p.label, p.quantity, p.price, p.total].every((v) => v.trim()),
                    ),
                  )
                )
                  throw new Error('Bitte alle Angaben der erfassten Positionen ausfüllen.');
                setRows(
                  selected
                    .slice(0, -1)
                    .flatMap((s, i) =>
                      reconcilePositions(
                        positions[s.id],
                        positions[selected[i + 1].id],
                        s.name,
                        selected[i + 1].name,
                      ).map((r) => ({ ...r, id: `${i}-${r.id}` })),
                    ),
                );
                setCompared(true);
              })
            }
          >
            {ui('Geprüfte Positionen vergleichen')}
          </Button>
        </section>
      )}
      <Findings rows={rows} onFocus={setFocus} run={run} busy={busy} ready={compared} />
    </EvidenceLayout>
  );
}

export function CommentExportPanel({ sources, busy, run }: PanelProps) {
  useLanguage();
  const [rows, setRows] = useState<CommentRow[]>([]),
    [ready, setReady] = useState(false),
    [focus, setFocus] = useState<EvidenceRef>(),
    [limit, setLimit] = useState(40);
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Kommentare und Markierungen als Arbeitsliste')}</h2>
        <p>
          {ui(
            'Liest PDF-Anmerkungen samt Autor, Seite und markiertem Text aus allen geöffneten Dateien. Du kannst Aufgaben bearbeiten und abhaken.',
          )}
        </p>
        <p className="fine-note">
          {ui(
            'In Seitenbilder eingebrannte Kommentare sind keine PDF-Anmerkungen und werden nicht erkannt. Markierter Text ist nur bei auslesbarer Textebene verfügbar. Änderungen hier betreffen die exportierte Arbeitsliste.',
          )}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              setRows([]);
              setReady(false);
              setRows(await readComments(sources, ctx));
              setReady(true);
            })
          }
        >
          {ui('Kommentare sammeln')}
        </Button>
      </section>
      {ready && (
        <section className="advanced-card">
          <h2>
            {rows.length} {ui(' Anmerkungen gefunden')}
          </h2>
          {!rows.length && (
            <p>{ui('Keine unterstützten PDF-Kommentare oder Markierungen gefunden.')}</p>
          )}
          {rows.slice(0, limit).map((row, index) => (
            <article className="evidence-finding" key={row.id}>
              <h3>
                {ui(row.type)} · {row.author || ui('Ohne Autor')}
              </h3>
              {row.quote && <blockquote>{row.quote}</blockquote>}
              <Field label={ui('Kommentar / Aufgabe')}>
                <textarea
                  rows={3}
                  value={row.comment}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, i) => (i === index ? { ...r, comment: e.target.value } : r)),
                    )
                  }
                />
              </Field>
              <Tick
                label={ui('Erledigt')}
                value={row.done}
                onChange={(done) => setRows(rows.map((r, i) => (i === index ? { ...r, done } : r)))}
              />
              <RefButton value={row.ref} onFocus={setFocus} />
            </article>
          ))}
          {rows.length > limit && (
            <Button variant="outline" onClick={() => setLimit(limit + 40)}>
              {ui('Weitere Kommentare anzeigen')}
            </Button>
          )}
          <ReportButtons rows={commentRows(rows)} name="PDF-Kommentare" run={run} busy={busy} />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(async () => commentMarkdown(rows))}
          >
            {ui('Markdown-Aufgabenliste erstellen')}
          </Button>
        </section>
      )}
    </EvidenceLayout>
  );
}
