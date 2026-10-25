'use client';
import { useToolDraftState } from './workspace-drafts';
import { ui, uiLocale } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PagePreview } from './canvas';
import { uid } from '@/lib/pdf-engine';
import {
  Choice,
  Text,
  NumberField,
  Tick,
  PageSelect,
  PageStage,
  RectFields,
  type PanelProps,
} from './advanced-shared';
import { EvidenceLayout, RefButton, ReadOptions, Coverage, ReportButtons } from './evidence-panels';
import { readEvidence, exportRows } from '@/lib/evidence-engine';
import type { EvidencePage, EvidenceRef } from '@/lib/evidence-model';
import type { Rect } from '@/lib/studio-engine';
import {
  dateCandidates,
  sortChronology,
  validDate,
  arithmeticCandidates,
  arithmeticResult,
  decimalText,
  measurementValue,
  measurementText,
  metersPerPoint,
  type ChronologyItem,
  type ArithmeticRow,
  type NumberLocale,
  type Calibration,
  type Measurement,
  type Point,
} from '@/lib/century-model';
import {
  readFormResponses,
  formResponseRows,
  fieldEmpty,
  chronologyPdf,
  chronologyRows,
  arithmeticRows,
  arithmeticPdf,
  readLayers,
  layerConfig,
  renderLayerPage,
  layersPdf,
  editableLayersPdf,
  measurementRows,
  measurementsPdf,
  type FormResponse,
  type LayerChoice,
} from '@/lib/century-engine';
import {
  inspectSanitization,
  sanitizePdf,
  type SanitizeOptions,
  type SanitizeFinding,
} from '@/lib/pdf-sanitize';
type Props = PanelProps & { invalidate: () => void };

export function FormResponsesPanel({ sources, busy, run, invalidate }: Props) {
  useLanguage();
  const [responses, setResponses] = useToolDraftState<FormResponse[]>(
      'FormResponsesPanel.responses:' + sources.map((s) => s.id).join(':') + '',
      [],
    ),
    [selected, setSelected] = useToolDraftState(
      'FormResponsesPanel.selected:' + sources.map((s) => s.id).join(':') + '',
      '',
    ),
    [layout, setLayout] = useToolDraftState<'matrix' | 'details'>(
      'FormResponsesPanel.layout:' + sources.map((s) => s.id).join(':') + '',
      'matrix',
    ),
    [focus, setFocus] = useState<EvidenceRef>(),
    [limit, setLimit] = useState(60);
  const current = responses.find((r) => r.sourceId === selected) || responses[0];
  const update = (index: number, value: string) => {
    invalidate();
    setResponses((all) =>
      all.map((r) =>
        r === current
          ? { ...r, fields: r.fields.map((f, i) => (i === index ? { ...f, value } : f)) }
          : r,
      ),
    );
  };
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Ausgefüllte Formulare zusammenfassen')}</h2>
        <p>
          {sources.length}{' '}
          {ui(
            ' geöffnete Dateien. Gleichnamige Felder desselben Typs werden zu gemeinsamen Spalten. Unterschiedliche Feldtypen bleiben getrennt.',
          )}
        </p>
        <p className="fine-note">
          {ui(
            'Änderungen betreffen nur die Auswertung. Die Originalformulare bleiben erhalten. Unterschriften und XFA-Felder werden nicht als vollständige Formularantwort ausgewertet.',
          )}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              setResponses([]);
              setResponses(await readFormResponses(sources, ctx));
            })
          }
        >
          {ui('Formularwerte auslesen')}
        </Button>
      </section>
      {!!responses.length && (
        <section className="advanced-card">
          <Choice
            label={ui('Rücklauf prüfen')}
            value={current.sourceId}
            onChange={(v) => {
              setSelected(v);
              setLimit(60);
              setFocus(undefined);
            }}
            items={responses.map((r) => [r.sourceId, r.name])}
            translateItems={false}
          />
          {current.warnings.map((w) => (
            <p className="workbench-notice" key={ui(w)}>
              {ui(w)}
            </p>
          ))}
          <p>
            {current.fields.length} {ui(' Felder ·')}{' '}
            {current.fields.filter((f) => f.required && fieldEmpty(f)).length}{' '}
            {ui(' fehlende Pflichtwerte')}
          </p>
          {current.fields.slice(0, limit).map((f, i) => (
            <article
              key={f.name + '-' + i}
              className={`evidence-finding ${f.required && fieldEmpty(f) ? 'evidence-missing' : ''}`}
            >
              <h3>
                {f.name}
                {f.required ? ' *' : ''}
              </h3>
              <p className="fine-note">
                {f.kind} {ui(' · Original: ')}
                {f.original ? (f.kind === 'checkbox' ? ui(f.original) : f.original) : ui('Leer')}
              </p>
              {f.kind === 'checkbox' ? (
                <Choice
                  label={ui(`Exportwert für ${f.name}`)}
                  value={f.value}
                  onChange={(v) => update(i, v)}
                  items={[
                    ['Ja', 'Ja'],
                    ['Nein', 'Nein'],
                  ]}
                />
              ) : (
                <Text
                  label={ui(`Exportwert für ${f.name}`)}
                  value={f.value}
                  onChange={(v) => update(i, v)}
                />
              )}
              <RefButton value={f.ref} onFocus={setFocus} />
            </article>
          ))}
          {current.fields.length > limit && (
            <Button variant="outline" onClick={() => setLimit(limit + 60)}>
              {ui('Weitere Felder anzeigen')}
            </Button>
          )}
          <Choice
            label={ui('Tabellenaufbau')}
            value={layout}
            onChange={(v) => setLayout(v as typeof layout)}
            items={[
              ['matrix', 'Eine Zeile pro Datei'],
              ['details', 'Eine Zeile pro Feld mit Originalwert'],
            ]}
          />
          <div className="advanced-actions">
            <Button
              disabled={busy}
              onClick={() =>
                run(() =>
                  exportRows(
                    formResponseRows(responses, layout, ui),
                    ui('Formularruecklaeufe'),
                    'xlsx',
                    ui('Tabelle'),
                  ),
                )
              }
            >
              {ui('Excel erstellen')}
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() =>
                run(() =>
                  exportRows(
                    formResponseRows(responses, layout, ui),
                    ui('Formularruecklaeufe'),
                    'csv',
                    ui('Tabelle'),
                  ),
                )
              }
            >
              {ui('CSV erstellen')}
            </Button>
          </div>
        </section>
      )}
    </EvidenceLayout>
  );
}

export function ChronologyPanel({ sources, busy, run, invalidate }: Props) {
  useLanguage();
  const [ocr, setOcr] = useToolDraftState(
      'ChronologyPanel.ocr:' + sources.map((s) => s.id).join(':') + '',
      false,
    ),
    [pages, setPages] = useToolDraftState<EvidencePage[]>(
      'ChronologyPanel.pages:' + sources.map((s) => s.id).join(':') + '',
      [],
    ),
    [items, setItems] = useToolDraftState<ChronologyItem[]>(
      'ChronologyPanel.items:' + sources.map((s) => s.id).join(':') + '',
      [],
    ),
    [focus, setFocus] = useState<EvidenceRef>();
  const update = (id: string, patch: Partial<ChronologyItem>) => {
    invalidate();
    setItems((all) => all.map((i) => (i.sourceId === id ? { ...i, ...patch } : i)));
  };
  const move = (index: number, delta: number) => {
    invalidate();
    setItems((all) => {
      const next = [...all];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  };
  const ready =
    items.some((i) => i.included) &&
    items.every(
      (i) => !i.included || (i.confirmed && !!i.title.trim() && (!i.date || validDate(i.date))),
    );
  return (
    <EvidenceLayout sources={sources} focus={focus}>
      <section className="advanced-card">
        <h2>{ui('Dokumentdatum und Reihenfolge prüfen')}</h2>
        <ReadOptions
          ocr={ocr}
          setOcr={(v) => {
            setOcr(v);
            setItems([]);
            setPages([]);
          }}
        />
        <p className="fine-note">
          {ui(
            'Ein Dokument kann mehrere Daten enthalten, etwa Briefdatum und Zahlungsfrist. Wähle das passende Datum und bestätige jeden Eintrag. Dateien ohne Datum können bewusst am Ende eingeordnet werden.',
          )}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              setItems([]);
              const data = await readEvidence(sources, ocr ? 'ocr' : 'auto', ctx);
              setPages(data);
              setItems(
                sortChronology(
                  sources.map((s) => {
                    const candidates = dateCandidates(data.filter((p) => p.sourceId === s.id));
                    return {
                      sourceId: s.id,
                      title: s.name.replace(/\.pdf$/i, ''),
                      date: candidates[0]?.date || '',
                      included: true,
                      confirmed: false,
                      candidates,
                    };
                  }),
                ),
              );
            })
          }
        >
          {ui('Daten im Inhalt suchen')}
        </Button>
      </section>
      <Coverage pages={pages} />
      {!!items.length && (
        <section className="advanced-card">
          <div className="advanced-actions">
            <Button
              variant="outline"
              onClick={() => {
                invalidate();
                setItems(sortChronology(items));
              }}
            >
              {ui('Älteste zuerst')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                invalidate();
                setItems(sortChronology(items, true));
              }}
            >
              {ui('Neueste zuerst')}
            </Button>
          </div>
          {items.map((item, index) => (
            <article key={item.sourceId} className="evidence-finding">
              <Tick
                label={`${index + 1}. ${sources.find((s) => s.id === item.sourceId)?.name}`}
                value={item.included}
                onChange={(included) => update(item.sourceId, { included })}
              />
              {item.included && (
                <>
                  <Text
                    label={ui('Titel im Inhaltsverzeichnis')}
                    value={item.title}
                    onChange={(title) => update(item.sourceId, { title, confirmed: false })}
                  />
                  <Text
                    label={ui('Datum (leer = ohne Datum)')}
                    type="date"
                    value={item.date}
                    onChange={(date) => update(item.sourceId, { date, confirmed: false })}
                  />
                  {!!item.candidates.length && (
                    <Choice
                      label={ui('Erkanntes Datum übernehmen')}
                      value=""
                      onChange={(v) => {
                        if (v) {
                          const c = item.candidates[Number(v) - 1];
                          update(item.sourceId, { date: c.date, confirmed: false });
                          setFocus(c.ref);
                        }
                      }}
                      items={[
                        ['', ui('Fundstelle wählen')],
                        ...item.candidates.map(
                          (c, i) =>
                            [
                              String(i + 1),
                              `${c.date} · ${ui(`Seite ${c.ref.page + 1}`)} · ${c.ref.text.slice(0, 90)}`,
                            ] as [string, string],
                        ),
                      ]}
                      translateItems={false}
                    />
                  )}
                  <Tick
                    label={ui('Datum beziehungsweise fehlendes Datum und Titel geprüft')}
                    value={item.confirmed}
                    onChange={(confirmed) => update(item.sourceId, { confirmed })}
                  />
                </>
              )}
              <div className="advanced-actions">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  {ui('Nach oben')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  {ui('Nach unten')}
                </Button>
              </div>
            </article>
          ))}
          <p className="fine-note">
            {ui(
              'Die aktuell angezeigte Reihenfolge wird exportiert. Das Inhaltsverzeichnis ist anklickbar. Formularwerte werden festgeschrieben; ursprüngliche Signaturen, Lesezeichen und Anhänge werden nicht übernommen.',
            )}
          </p>
          <Button
            disabled={busy || !ready}
            onClick={() => run((ctx) => chronologyPdf(sources, items, ctx))}
          >
            {ui('Chronologische PDF erstellen')}
          </Button>
          <ReportButtons
            rows={chronologyRows(items, ui)}
            name="Chronologie"
            run={run}
            busy={busy}
          />
        </section>
      )}
    </EvidenceLayout>
  );
}

export function ArithmeticPanel({ source, busy, run, invalidate }: Props) {
  useLanguage();
  const [page, setPage] = useToolDraftState('ArithmeticPanel.page:' + source.id + '', 0),
    [area, setArea] = useToolDraftState<Rect>('ArithmeticPanel.area:' + source.id + '', {
      x: 0.55,
      y: 0.12,
      w: 0.4,
      h: 0.72,
    }),
    [ocr, setOcr] = useToolDraftState('ArithmeticPanel.ocr:' + source.id + '', false),
    [pages, setPages] = useToolDraftState<EvidencePage[]>(
      'ArithmeticPanel.pages:' + source.id + '',
      [],
    ),
    [rows, setRows] = useToolDraftState<ArithmeticRow[]>(
      'ArithmeticPanel.rows:' + source.id + '',
      [],
    ),
    [locale, setLocale] = useToolDraftState<NumberLocale>(
      'ArithmeticPanel.locale:' + source.id + '',
      'de',
    ),
    [total, setTotal] = useToolDraftState('ArithmeticPanel.total:' + source.id + '', ''),
    [totalId, setTotalId] = useToolDraftState('ArithmeticPanel.totalId:' + source.id + '', ''),
    [reviewed, setReviewed] = useState(false),
    [focus, setFocus] = useState<EvidenceRef>();
  const change = () => {
    invalidate();
    setReviewed(false);
  };
  const clear = () => {
    change();
    setRows([]);
    setTotal('');
    setTotalId('');
  };
  const update = (id: string, patch: Partial<ArithmeticRow>) => {
    change();
    setRows((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  let calculation: ReturnType<typeof arithmeticResult> | undefined,
    problem = '';
  try {
    if (rows.length && total) calculation = arithmeticResult(rows, total, locale);
  } catch (e) {
    problem = (e as Error).message;
  }
  return (
    <div className="century-columns">
      <section className="advanced-card">
        <h2>{ui('Zahlenspalte markieren')}</h2>
        <PageSelect
          source={source}
          page={page}
          onChange={(p) => {
            setPage(p);
            clear();
          }}
        />
        <PageStage
          source={source}
          page={page}
          rects={[area, ...(focus?.page === page ? focus.rects : [])]}
          onRect={(r) => {
            setArea(r);
            clear();
          }}
        />
        <RectFields
          rect={area}
          onChange={(r) => {
            setArea(r);
            clear();
          }}
        />
        <ReadOptions
          ocr={ocr}
          setOcr={(v) => {
            setOcr(v);
            setPages([]);
            clear();
          }}
        />
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              clear();
              const data = pages.length
                ? pages
                : await readEvidence([source], ocr ? 'ocr' : 'auto', ctx);
              setPages(data);
              setRows(
                arithmeticCandidates(
                  data.find((p) => p.page === page)!,
                  area,
                ),
              );
            })
          }
        >
          {ui('Zahlen im Bereich übernehmen')}
        </Button>
        <Coverage pages={pages} />
      </section>
      <section className="advanced-card">
        <h2>{ui('Summe gegenprüfen')}</h2>
        <p className="fine-note">
          {ui(
            'Wähle nur die zu addierenden Werte. Eine bereits gedruckte Summe darf nicht als Summand mitgerechnet werden. OCR, Vorzeichen und Dezimalzeichen am Original prüfen.',
          )}
        </p>
        <Choice
          label={ui('Zahlenformat')}
          value={locale}
          onChange={(v) => {
            setLocale(v as NumberLocale);
            change();
          }}
          items={[
            ['de', 'Deutsch: 1.234,56'],
            ['en', 'Englisch: 1,234.56'],
          ]}
        />
        {rows.map((row, i) => (
          <div className="century-number-row" key={row.id}>
            <Tick
              label={ui(`Wert ${i + 1} addieren`)}
              value={row.included}
              onChange={(included) => {
                update(row.id, { included });
                if (included && totalId === row.id) {
                  setTotalId('');
                }
              }}
            />
            <Text
              label={ui(`Wert ${i + 1} (Original: ${row.original})`)}
              value={row.value}
              onChange={(value) => {
                update(row.id, { value });
                if (totalId === row.id) setTotal(value);
              }}
            />
            <Button size="sm" variant="outline" onClick={() => setFocus(row.ref)}>
              {ui('Auf Seite zeigen')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                change();
                setTotal(row.value);
                setTotalId(row.id);
                setRows((all) => all.map((r) => (r.id === row.id ? { ...r, included: false } : r)));
                setFocus(row.ref);
              }}
            >
              {ui('Als angegebene Summe')}
            </Button>
          </div>
        ))}
        {!rows.length && (
          <p>{ui('Noch keine Zahlen ausgewählt. Bereich markieren und Zahlen übernehmen.')}</p>
        )}
        <Text
          label={ui('Angegebene Summe')}
          value={total}
          onChange={(v) => {
            change();
            setTotal(v);
            setTotalId('');
          }}
        />
        {problem && <p className="error-box">{ui(problem)}</p>}
        {calculation && (
          <div
            className={`evidence-finding ${calculation.difference === 0n ? 'evidence-match' : 'evidence-changed'}`}
            role="status"
          >
            <p>
              {calculation.count} {ui(' Summanden: ')}
              <strong>{decimalText(calculation.sum, locale)}</strong>
            </p>
            <p>
              {ui('Abweichung: ')}
              <strong>{decimalText(calculation.difference, locale)}</strong>
            </p>
            <p>
              {calculation.difference === 0n
                ? ui('Die ausgewählten Summanden ergeben die angegebene Summe.')
                : ui('Die ausgewählten Summanden weichen von der angegebenen Summe ab.')}
            </p>
          </div>
        )}
        <Tick
          label={ui('Summanden, Zahlenformat und angegebene Summe am Original geprüft')}
          value={reviewed}
          onChange={setReviewed}
        />
        <div className="advanced-actions">
          <Button
            disabled={busy || !reviewed || !calculation}
            onClick={() =>
              run((ctx) =>
                arithmeticPdf(
                  source,
                  rows,
                  total,
                  locale,
                  rows.find((r) => r.id === totalId)?.ref,
                  ctx,
                ),
              )
            }
          >
            {ui('Markierte PDF mit Rechenprotokoll')}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !reviewed || !calculation}
            onClick={() =>
              run(() =>
                exportRows(
                  arithmeticRows(rows, total, locale, ui),
                  ui('Rechenpruefung'),
                  'csv',
                  ui('Tabelle'),
                ),
              )
            }
          >
            {ui('CSV-Protokoll')}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function SanitizePanel({ source, busy, run }: Props) {
  useLanguage();
  const [findings, setFindings] = useState<SanitizeFinding[] | null>(null),
    [options, setOptions] = useState<SanitizeOptions>({
      attachments: true,
      comments: false,
      metadata: true,
    });
  const labels = {
    active: 'Aktive Inhalte',
    attachments: 'Anhänge',
    comments: 'Kommentare',
    metadata: 'Dokumentmetadaten',
  };
  return (
    <div className="century-columns">
      <section className="advanced-card">
        <h2>{ui('Inhalte prüfen und bereinigen')}</h2>
        <p>
          {ui(
            'Skripte, automatische Aktionen, riskante Verweise, dynamische XFA-Inhalte und eingebettete Medien werden entfernt. Gewöhnliche Web- und interne Seitenlinks bleiben erhalten.',
          )}
        </p>
        <p className="fine-note">
          {ui(
            'Kein Virenscan. Digitale Signaturen verlieren durch die Änderung ihre Gültigkeit. Dynamische Formulare können danach anders aussehen; bitte die Ergebnisvorschau prüfen.',
          )}
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              setFindings(await inspectSanitization(source));
            })
          }
        >
          {ui('Entfernbare Inhalte auflisten')}
        </Button>
        <Tick
          label={ui('Eingebettete Dateien und zugeordnete Anhänge entfernen')}
          value={options.attachments}
          onChange={(attachments) => setOptions({ ...options, attachments })}
        />
        <Tick
          label={ui('Kommentare und Markierungen entfernen')}
          value={options.comments}
          onChange={(comments) => setOptions({ ...options, comments })}
        />
        <Tick
          label={ui('Dokumenteigenschaften und XMP-Metadaten entfernen')}
          value={options.metadata}
          onChange={(metadata) => setOptions({ ...options, metadata })}
        />
        <Button
          disabled={busy || findings === null}
          onClick={() => run((ctx) => sanitizePdf(source, options, ctx))}
        >
          {ui('PDF bereinigen und nachprüfen')}
        </Button>
      </section>
      <section className="advanced-card">
        <h2>{ui('Gefundene Strukturen')}</h2>
        {findings === null ? (
          <p>{ui('Bitte zuerst die Inhalte auflisten.')}</p>
        ) : !findings.length ? (
          <p>
            {ui(
              'Keine der untersuchten Strukturen gefunden. Daraus folgt keine allgemeine Sicherheitsgarantie.',
            )}
          </p>
        ) : (
          findings.map((f) => (
            <p key={f.kind + f.detail}>
              <strong>{ui(labels[f.kind])}:</strong> {ui(f.detail)} · {f.count}{' '}
              {ui(f.count === 1 ? 'Fundstelle' : 'Fundstellen')}
            </p>
          ))
        )}
        <p className="fine-note">
          {ui(
            'Mehrere Struktureinträge können zur selben Aktion oder Datei gehören. Nach dem Export prüft das Werkzeug, ob die gewählten Kategorien entfernt sind.',
          )}
        </p>
      </section>
    </div>
  );
}

export function LayersPanel({ source, busy, run, invalidate }: Props) {
  useLanguage();
  const [layers, setLayers] = useState<LayerChoice[] | null>(null),
    [page, setPage] = useState(0),
    [preview, setPreview] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!layers) return;
    const abort = new AbortController();
    setPreview('');
    setError('');
    setLoading(true);
    void renderLayerPage(source, page, layers, 1300, abort.signal)
      .then(({ canvas }) => {
        if (!abort.signal.aborted) setPreview(canvas.toDataURL('image/png'));
        canvas.width = canvas.height = 0;
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError((e as Error).message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [source, page, layers]);
  return (
    <div className="century-columns">
      <section className="advanced-card">
        <h2>{ui('Ebenen ein- und ausblenden')}</h2>
        <Button
          disabled={busy}
          onClick={() =>
            run(async () => {
              setLayers(await readLayers(source));
            })
          }
        >
          {ui('Ebenen laden')}
        </Button>
        {layers && !layers.length && (
          <p>{ui('Dieses PDF enthält keine schaltbaren PDF-Ebenen.')}</p>
        )}
        {layers?.map((l, i) => (
          <div key={l.id} className="pro-rule">
            <Text
              label={ui(`Name der Ebene ${i + 1}`)}
              value={l.name}
              onChange={(name) => {
                invalidate();
                setLayers((old) => old!.map((x) => (x.id === l.id ? { ...x, name } : x)));
              }}
            />
            <Button
              variant="outline"
              disabled={busy || i === 0}
              onClick={() => {
                invalidate();
                setLayers((old) => {
                  const next = [...old!];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  return next;
                });
              }}
            >
              {ui('In der Ebenenliste nach oben')}
            </Button>
            <Tick
              key={l.id}
              label={l.name}
              value={l.visible}
              onChange={(visible) => {
                invalidate();
                void run(async () => {
                  const config = await layerConfig(source, layers, { id: l.id, visible });
                  setLayers(
                    layers.map((old) => ({ ...old, visible: config.getGroup(old.id).visible })),
                  );
                });
              }}
            />
          </div>
        ))}
        <Button
          disabled={busy || !layers?.length || loading || !!error}
          onClick={() => run((ctx) => editableLayersPdf(source, layers!, ctx))}
        >
          {ui('Schaltbare Ebenen speichern')}
        </Button>
        <p className="fine-note">
          {ui(
            'Beim Speichern schaltbarer Ebenen bleiben Text, Grafiken und ausgeblendete Inhalte erhalten. Die Vorschau zeigt die gewählte Ansicht. Sich gegenseitig ausschließende Ebenen werden gemeinsam umgeschaltet. Die Ausgabe schreibt diese Ansicht als Seitenbilder fest: ausgeblendete Inhalte, Suchtext, Links, Formulare und Anhänge werden nicht übernommen.',
          )}
        </p>
        <Button
          disabled={busy || !layers?.length || loading || !!error}
          onClick={() => run((ctx) => layersPdf(source, layers!, ctx))}
        >
          {ui('Gewählte Ansicht als PDF exportieren')}
        </Button>
      </section>
      <section className="advanced-card">
        <PageSelect source={source} page={page} onChange={setPage} />
        {loading && <p role="status">{ui('Ebenenansicht wird aufgebaut …')}</p>}
        {error && <p className="error-box">{ui(error)}</p>}
        {preview && (
          <img
            className="century-page-image"
            src={preview}
            alt={ui(`Gewählte Ebenen auf Seite ${page + 1}`)}
          />
        )}
      </section>
    </div>
  );
}

export function MeasurePanel({ source, busy, run, invalidate }: Props) {
  useLanguage();
  const [page, setPage] = useToolDraftState('MeasurePanel.page:' + source.id + '', 0),
    [size, setSize] = useToolDraftState('MeasurePanel.size:' + source.id + '', {
      width: 595,
      height: 842,
    }),
    [mode, setMode] = useToolDraftState<'calibrate' | 'length' | 'area'>(
      'MeasurePanel.mode:' + source.id + '',
      'calibrate',
    ),
    [points, setPoints] = useToolDraftState<Point[]>('MeasurePanel.points:' + source.id + '', []),
    [length, setLength] = useToolDraftState('MeasurePanel.length:' + source.id + '', 1),
    [unit, setUnit] = useToolDraftState<Calibration['unit']>(
      'MeasurePanel.unit:' + source.id + '',
      'm',
    ),
    [calibrations, setCalibrations] = useToolDraftState<Record<number, Calibration>>(
      'MeasurePanel.calibrations:' + source.id + '',
      {},
    ),
    [items, setItems] = useToolDraftState<Measurement[]>(
      'MeasurePanel.items:' + source.id + '',
      [],
    ),
    [error, setError] = useState(''),
    [manual, setManual] = useToolDraftState('MeasurePanel.manual:' + source.id + '', {
      x: 0.5,
      y: 0.5,
    });
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    source.pdf
      .getPage(page + 1)
      .then((p) => {
        const v = p.getViewport({ scale: 1 });
        if (active) setSize({ width: v.width, height: v.height });
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [source, page, setSize]);
  const reset = () => {
    invalidate();
    setPoints([]);
    setError('');
  };
  const add = (point: Point) => {
    if (busy) return;
    invalidate();
    setError('');
    setPoints((old) => [...old, point].slice(0, mode === 'area' ? 100 : 2));
  };
  const save = () => {
    try {
      if (mode === 'calibrate') {
        if (points.length !== 2) throw new Error('Zwei Referenzpunkte auswählen.');
        const calibration = { points: points as [Point, Point], length, unit };
        metersPerPoint(calibration, size.width, size.height);
        setCalibrations({ ...calibrations, [page]: calibration });
        setMode('length');
      } else {
        if (!calibrations[page]) throw new Error('Diese Seite zuerst kalibrieren.');
        const item: Measurement = {
          id: uid(),
          page,
          kind: mode,
          points,
          label: `${ui(mode === 'area' ? 'Fläche' : 'Strecke')} ${items.length + 1}`,
        };
        measurementValue(item, calibrations[page], size.width, size.height);
        setItems([...items, item]);
      }
      reset();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const visible = items.filter((i) => i.page === page),
    label = (item: Measurement) => {
      try {
        return measurementText(
          measurementValue(item, calibrations[page], size.width, size.height),
          item.kind,
          uiLocale(),
        );
      } catch {
        return ui('Kalibrierung fehlt');
      }
    };
  return (
    <div className="century-columns century-measure">
      <section className="advanced-card">
        <h2>{ui('Referenz festlegen und messen')}</h2>
        <PageSelect
          source={source}
          page={page}
          onChange={(p) => {
            setPage(p);
            reset();
          }}
        />
        <div
          className="century-measure-surface"
          ref={surface}
          style={{ aspectRatio: `${size.width}/${size.height}` }}
          onPointerUp={(e) => {
            const rect = surface.current!.getBoundingClientRect();
            add({
              x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
              y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
            });
          }}
        >
          <PagePreview
            source={source}
            page={{
              id: `measure-${source.id}-${page}`,
              sourceId: source.id,
              index: page,
              rotation: 0,
              selected: true,
            }}
          />
          <svg
            viewBox={`0 0 ${size.width} ${size.height}`}
            aria-label={ui('Messpunkte und Strecken')}
          >
            {visible.map((item) => (
              <g key={item.id}>
                <polyline
                  points={[...item.points, ...(item.kind === 'area' ? [item.points[0]] : [])]
                    .map((p) => `${p.x * size.width},${p.y * size.height}`)
                    .join(' ')}
                  fill={item.kind === 'area' ? 'rgba(0,140,125,.12)' : 'none'}
                  stroke="#006e64"
                  strokeWidth="2"
                />
                <text
                  x={item.points[0].x * size.width}
                  y={Math.max(14, item.points[0].y * size.height - 8)}
                  fontSize="12"
                  stroke="white"
                  strokeWidth="3"
                  paintOrder="stroke"
                  fill="#00483f"
                >
                  {item.label}: {ui(label(item))}
                </text>
              </g>
            ))}
            <polyline
              points={points.map((p) => `${p.x * size.width},${p.y * size.height}`).join(' ')}
              fill="none"
              stroke="#ce6430"
              strokeWidth="2"
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x * size.width} cy={p.y * size.height} r="4" fill="#ce6430" />
            ))}
            {calibrations[page]?.points.map((p, i) => (
              <circle
                key={'ref' + i}
                cx={p.x * size.width}
                cy={p.y * size.height}
                r="5"
                fill="none"
                stroke="#3066cf"
                strokeWidth="2"
              />
            ))}
          </svg>
        </div>
        <p className="fine-note">
          {ui(
            'Punkte auf der Seite antippen. Blaue Kreise markieren die Referenz. Für genaue Platzierung können die Prozentkoordinaten verwendet werden.',
          )}
        </p>
      </section>
      <section className="advanced-card">
        <Choice
          label={ui('Messaufgabe')}
          value={mode}
          onChange={(v) => {
            setMode(v as typeof mode);
            reset();
          }}
          items={[
            ['calibrate', 'Referenzlänge festlegen'],
            ['length', 'Strecke messen'],
            ['area', 'Fläche messen'],
          ]}
        />
        {calibrations[page] ? (
          <p className="workbench-notice">
            {ui('Seite ')}
            {page + 1}
            {ui(': Referenz ')}
            {calibrations[page].length} {calibrations[page].unit}
            {ui('. Neue Kalibrierung berechnet vorhandene Messungen neu.')}
          </p>
        ) : (
          <p className="workbench-notice">
            {ui('Diese Seite muss zuerst mit einer bekannten Strecke kalibriert werden.')}
          </p>
        )}
        {mode === 'calibrate' && (
          <>
            <NumberField
              label={ui('Bekannte Referenzlänge')}
              value={length}
              min={0.000001}
              max={1000000}
              step={0.01}
              onChange={setLength}
            />
            <Choice
              label={ui('Referenzeinheit')}
              value={unit}
              onChange={(v) => setUnit(v as typeof unit)}
              items={[
                ['mm', 'Millimeter'],
                ['cm', 'Zentimeter'],
                ['m', 'Meter'],
              ]}
            />
          </>
        )}
        <div className="advanced-coordinates">
          <NumberField
            label={ui('Punkt X (%)')}
            value={manual.x * 100}
            step={0.1}
            onChange={(x) => setManual({ ...manual, x: x / 100 })}
          />
          <NumberField
            label={ui('Punkt Y (%)')}
            value={manual.y * 100}
            step={0.1}
            onChange={(y) => setManual({ ...manual, y: y / 100 })}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => add(manual)}
          disabled={busy || points.length >= (mode === 'area' ? 100 : 2)}
        >
          {ui('Punkt hinzufügen')}
        </Button>
        <p>
          {points.length} {ui(' Punkte gesetzt')}
        </p>
        <div className="advanced-actions">
          <Button
            variant="outline"
            disabled={!points.length}
            onClick={() => {
              invalidate();
              setPoints(points.slice(0, -1));
              setError('');
            }}
          >
            {ui('Letzten Punkt zurücknehmen')}
          </Button>
          <Button
            disabled={
              busy ||
              points.length < (mode === 'area' ? 3 : 2) ||
              (mode !== 'calibrate' && !calibrations[page])
            }
            onClick={save}
          >
            {mode === 'calibrate'
              ? ui('Referenz übernehmen')
              : mode === 'area'
                ? ui('Fläche abschließen')
                : ui('Strecke übernehmen')}
          </Button>
        </div>
        {error && (
          <p className="error-box" role="alert">
            {ui(error)}
          </p>
        )}
        <p className="fine-note">
          {ui(
            'Messhilfe mit selbst festgelegtem Maßstab. Verzerrte Scans können abweichende Maße ergeben. Die Kalibrierung gilt jeweils nur für die aktuelle Seite.',
          )}
        </p>
        {visible.map((item) => (
          <article key={item.id} className="evidence-finding">
            <Text
              label={ui('Bezeichnung')}
              value={item.label}
              onChange={(text) => {
                invalidate();
                setItems(items.map((i) => (i.id === item.id ? { ...i, label: text } : i)));
              }}
            />
            <strong>{ui(label(item))}</strong>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                invalidate();
                setItems(items.filter((i) => i.id !== item.id));
              }}
            >
              {ui('Messung löschen')}
            </Button>
          </article>
        ))}
        <p>
          {items.length} {ui(' Messungen im Dokument')}
        </p>
        <div className="advanced-actions">
          <Button
            disabled={busy || !items.length}
            onClick={() => run((ctx) => measurementsPdf(source, items, calibrations, ctx))}
          >
            {ui('PDF mit Messungen erstellen')}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !items.length}
            onClick={() =>
              run(async () =>
                exportRows(
                  await measurementRows(source, items, calibrations, ui),
                  ui('Messungen'),
                  'csv',
                  ui('Tabelle'),
                ),
              )
            }
          >
            {ui('Messwerte als CSV')}
          </Button>
        </div>
      </section>
    </div>
  );
}
