'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { uid } from '@/lib/pdf-engine';
import { ui } from '@/lib/ui-language';
import { readEvidence, coverage, exportRows } from '@/lib/evidence-engine';
import { pageRef, type EvidencePage, type EvidenceRef } from '@/lib/evidence-model';
import {
  checkDocuments,
  collectDocumentEvents,
  exportDocumentEvents,
  type ChecklistRule,
  type ChecklistFinding,
  type DocumentEvent,
} from '@/lib/document-intake';
import { useLanguage } from './appearance';
import { useToolDraftState } from './workspace-drafts';
import { EvidencePreview } from './evidence-panels';
import { Text, Choice, NumberField, type PanelProps } from './advanced-shared';
type Props = PanelProps & { invalidate: () => void };
const refKey = (ref: EvidenceRef) => `${ref.sourceId}:${ref.page}`;
const newRule = (): ChecklistRule => ({ id: uid(), title: '', keywords: '', month: '' });
function limitPages(sources: Props['sources']) {
  if (sources.reduce((sum, s) => sum + s.pdf.numPages, 0) > 200)
    throw new Error('Bitte höchstens 200 Seiten auswerten.');
}
export function ChecklistPanel({ sources, source, busy, run, invalidate }: Props) {
  useLanguage();
  const key = sources.map((s) => s.id).join(':');
  const [rules, setRules] = useToolDraftState<ChecklistRule[]>(
    'ChecklistPanel.rules:' + source.id,
    [newRule()],
  );
  const [pages, setPages] = useToolDraftState<EvidencePage[]>('ChecklistPanel.pages:' + key, []);
  const [findings, setFindings] = useToolDraftState<ChecklistFinding[]>(
    'ChecklistPanel.findings:' + key,
    [],
  );
  const [choices, setChoices] = useToolDraftState<Record<string, string>>(
    'ChecklistPanel.choices:' + key,
    {},
  );
  const [confirmed, setConfirmed] = useState<string[]>([]),
    [focus, setFocus] = useState<EvidenceRef>(),
    [year, setYear] = useState(new Date().getFullYear());
  const refs = pages.map(pageRef);
  const change = (next: ChecklistRule[]) => {
    setRules(next);
    setFindings([]);
    setConfirmed([]);
    setChoices({});
    invalidate();
  };
  const state = (finding: ChecklistFinding) =>
    confirmed.includes(finding.rule.id)
      ? choices[finding.rule.id]
        ? 'Vorhanden'
        : 'Fehlt laut Prüfung'
      : finding.candidates.length === 0 && !finding.unreadable
        ? 'Nicht gefunden'
        : 'Unklar';
  return (
    <div className="century-columns intake-panel">
      <section className="advanced-card">
        <h2>{ui('Unterlagen-Checkliste')}</h2>
        <p>
          {ui(
            'Erwartete Unterlagen festlegen, Fundstellen prüfen und fehlende oder unklare Zuordnungen dokumentieren.',
          )}
        </p>
        <fieldset disabled={busy}>
          <div className="advanced-actions">
            <NumberField
              label={ui('Jahr für Monatsvorlage')}
              value={year}
              min={1900}
              max={2199}
              onChange={setYear}
            />
            <Button
              variant="outline"
              onClick={() =>
                change(
                  Array.from({ length: 12 }, (_, i) => ({
                    id: uid(),
                    title: ui('Kontoauszug') + ' ' + `${year}-${String(i + 1).padStart(2, '0')}`,
                    keywords: ui('Kontoauszug'),
                    month: `${year}-${String(i + 1).padStart(2, '0')}`,
                  })),
                )
              }
            >
              {ui('Vorlage: zwölf Kontoauszüge')}
            </Button>
          </div>
          <p className="fine-note">
            {ui(
              'Alle kommagetrennten Suchwörter müssen auf derselben Seite vorkommen. Der Monat ist optional. Dateinamen allein gelten nicht als Nachweis.',
            )}
          </p>
          {rules.map((rule, i) => (
            <div className="intake-rule" key={rule.id}>
              <h3>
                {ui('Prüfpunkt')} {i + 1}
              </h3>
              <Text
                label={ui('Bezeichnung')}
                value={rule.title}
                onChange={(v) =>
                  change(rules.map((r) => (r.id === rule.id ? { ...r, title: v } : r)))
                }
              />
              <Text
                label={ui('Suchwörter')}
                value={rule.keywords}
                onChange={(v) =>
                  change(rules.map((r) => (r.id === rule.id ? { ...r, keywords: v } : r)))
                }
              />
              <label className="advanced-field">
                <span>{ui('Monat (optional)')}</span>
                <input
                  type="month"
                  value={rule.month}
                  onChange={(e) =>
                    change(
                      rules.map((r) => (r.id === rule.id ? { ...r, month: e.target.value } : r)),
                    )
                  }
                />
              </label>
              <Button
                variant="ghost"
                disabled={rules.length === 1}
                onClick={() => change(rules.filter((r) => r.id !== rule.id))}
              >
                {ui('Prüfpunkt entfernen')}
              </Button>
            </div>
          ))}
          <div className="advanced-actions">
            <Button
              variant="outline"
              disabled={rules.length >= 60}
              onClick={() => change([...rules, newRule()])}
            >
              {ui('Prüfpunkt hinzufügen')}
            </Button>
            <Button
              onClick={() =>
                run(async (ctx) => {
                  limitPages(sources);
                  checkDocuments([], rules);
                  const next = await readEvidence(sources, 'auto', ctx);
                  const found = checkDocuments(next, rules);
                  ctx.signal.throwIfAborted();
                  setPages(next);
                  setFindings(found);
                  setChoices({});
                  setConfirmed([]);
                })
              }
            >
              {ui('Unterlagen prüfen')}
            </Button>
          </div>
          {!!pages.length && <p role="status">{coverage(pages, ui)}</p>}
          {findings.map((finding) => {
            const id = finding.rule.id,
              chosen = refs.find((r) => refKey(r) === choices[id]);
            return (
              <article key={id} className="intake-rule">
                <h3>
                  {finding.rule.title} · {ui(state(finding))}
                </h3>
                <p>
                  {finding.candidates.length} {ui('mögliche Fundstellen')}
                </p>
                {finding.candidates.map((ref) => (
                  <Button
                    key={refKey(ref)}
                    variant="outline"
                    onClick={() => {
                      setFocus(ref);
                      setChoices({ ...choices, [id]: refKey(ref) });
                      setConfirmed(confirmed.filter((v) => v !== id));
                      invalidate();
                    }}
                  >
                    {ref.name} · {ui('Seite')} {ref.page + 1}
                  </Button>
                ))}
                <Choice
                  label={ui('Fundstelle zuordnen')}
                  value={choices[id] || ''}
                  translateItems={false}
                  items={[
                    ['', ui('Keine Zuordnung / fehlt')],
                    ...refs.map(
                      (r) =>
                        [refKey(r), `${r.name} · ${ui('Seite')} ${r.page + 1}`] as [string, string],
                    ),
                  ]}
                  onChange={(v) => {
                    setChoices({ ...choices, [id]: v });
                    setConfirmed(confirmed.filter((c) => c !== id));
                    setFocus(refs.find((r) => refKey(r) === v));
                    invalidate();
                  }}
                />
                {chosen && <p className="match-excerpt">{chosen.text.slice(0, 320)}</p>}
                <label className="advanced-tick">
                  <input
                    type="checkbox"
                    checked={confirmed.includes(id)}
                    onChange={(e) => {
                      setConfirmed(
                        e.target.checked ? [...confirmed, id] : confirmed.filter((c) => c !== id),
                      );
                      invalidate();
                    }}
                  />
                  <span>{ui('Diesen Prüfpunkt am Original geprüft')}</span>
                </label>
              </article>
            );
          })}
          <p className="fine-note">
            {ui(
              'Bis zu 60 Prüfpunkte und 200 Seiten. Textarme Seiten werden lokal per OCR gelesen. Ein nicht gefundener Treffer beweist nicht, dass eine Unterlage fehlt. Unlesbare Seiten und mehrdeutige Treffer manuell prüfen.',
            )}
          </p>
          <Button
            disabled={!findings.length || confirmed.length !== findings.length}
            onClick={() =>
              run(async () =>
                exportRows(
                  [
                    [ui('Prüfpunkt'), ui('Status'), ui('Datei'), ui('Seite'), ui('Fundstelle')],
                    ...findings.map((f) => {
                      const ref = refs.find((r) => refKey(r) === choices[f.rule.id]);
                      return [
                        f.rule.title,
                        ui(state(f)),
                        ref?.name || '',
                        ref ? String(ref.page + 1) : '',
                        ref?.text || '',
                      ];
                    }),
                  ],
                  'Unterlagen-Checkliste',
                  'csv',
                ),
              )
            }
          >
            {ui('Checkliste als CSV herunterladen')}
          </Button>
        </fieldset>
      </section>
      <EvidencePreview sources={sources} focus={focus} />
    </div>
  );
}
export function DocumentDatesPanel({ sources, source, busy, run, invalidate }: Props) {
  useLanguage();
  const key = sources.map((s) => s.id).join(':');
  const [events, setEvents] = useToolDraftState<DocumentEvent[]>(
    'DocumentDatesPanel.events:' + key,
    [],
  );
  const [note, setNote] = useToolDraftState('DocumentDatesPanel.note:' + key, '');
  const [confirmed, setConfirmed] = useState<string[]>([]),
    [focus, setFocus] = useState<EvidenceRef>();
  const change = (id: string, patch: Partial<DocumentEvent>) => {
    setEvents(events.map((e) => (e.id === id ? { ...e, ...patch, confirmed: false } : e)));
    setConfirmed(confirmed.filter((c) => c !== id));
    invalidate();
  };
  return (
    <div className="century-columns intake-panel">
      <section className="advanced-card">
        <h2>{ui('Termine aus PDFs übernehmen')}</h2>
        <p>
          {ui(
            'Gedruckte Datumsangaben mit Fundstelle sammeln. Nur ausdrücklich bestätigte Termine werden als Kalenderdatei ausgegeben.',
          )}
        </p>
        <fieldset disabled={busy}>
          <Button
            onClick={() =>
              run(async (ctx) => {
                limitPages(sources);
                const pages = await readEvidence(sources, 'auto', ctx);
                const next = collectDocumentEvents(pages);
                ctx.signal.throwIfAborted();
                setEvents(next);
                setConfirmed([]);
                setNote(coverage(pages, ui));
              })
            }
          >
            {ui('Datumsangaben suchen')}
          </Button>
          {note && (
            <p role="status">
              {note} · {events.length} {ui('Datumsfundstellen')}
            </p>
          )}
          {events.map((event, i) => (
            <article className="intake-rule" key={event.id}>
              <h3>
                {ui('Termin')} {i + 1}
              </h3>
              <Button variant="outline" onClick={() => setFocus(event.ref)}>
                {event.ref.name} · {ui('Seite')} {event.ref.page + 1}
              </Button>
              <p className="match-excerpt">{event.ref.text}</p>
              <Text
                label={ui('Termintitel')}
                value={event.title}
                onChange={(v) => change(event.id, { title: v })}
              />
              <label className="advanced-field">
                <span>{ui('Datum')}</span>
                <input
                  type="date"
                  value={event.date}
                  onChange={(e) => change(event.id, { date: e.target.value })}
                />
              </label>
              <label className="advanced-field">
                <span>{ui('Uhrzeit (leer = ganztägig)')}</span>
                <input
                  type="time"
                  value={event.time}
                  onChange={(e) => change(event.id, { time: e.target.value })}
                />
              </label>
              {event.time && (
                <NumberField
                  label={ui('Dauer in Minuten')}
                  value={event.minutes}
                  min={1}
                  max={1440}
                  onChange={(v) => change(event.id, { minutes: v })}
                />
              )}
              <label className="advanced-tick">
                <input
                  type="checkbox"
                  checked={confirmed.includes(event.id)}
                  onChange={(e) => {
                    setConfirmed(
                      e.target.checked
                        ? [...confirmed, event.id]
                        : confirmed.filter((c) => c !== event.id),
                    );
                    invalidate();
                  }}
                />
                <span>{ui('Termin geprüft und für den Export bestätigt')}</span>
              </label>
              <Button
                variant="ghost"
                onClick={() => {
                  setEvents(events.filter((e) => e.id !== event.id));
                  setConfirmed(confirmed.filter((c) => c !== event.id));
                  invalidate();
                }}
              >
                {ui('Termin entfernen')}
              </Button>
            </article>
          ))}
          <Button
            variant="outline"
            disabled={events.length >= 300}
            onClick={() => {
              setEvents([
                ...events,
                {
                  id: uid(),
                  date: '',
                  time: '',
                  minutes: 60,
                  title: '',
                  ref: {
                    sourceId: source.id,
                    name: source.name,
                    page: 0,
                    text: ui('Manuell erfasster Termin'),
                    rects: [],
                    mode: 'text',
                  },
                  confirmed: false,
                },
              ]);
              invalidate();
            }}
          >
            {ui('Termin manuell ergänzen')}
          </Button>
          <p className="fine-note">
            {ui(
              'Bis zu 200 Seiten und 300 Fundstellen. Erkannt werden vollständige Datumsangaben mit Jahr (1900–2199), keine relativen oder rechtlich berechneten Fristen. Mehrdeutige Schrägstrich-Daten manuell erfassen. Uhrzeiten gelten in der lokalen Zeitzone deines Kalenders; die vorgeschlagene Dauer ist 60 Minuten. Es wird nichts automatisch in einen Kalender eingetragen.',
            )}
          </p>
          <Button
            disabled={!confirmed.length}
            onClick={() =>
              run(() =>
                exportDocumentEvents(
                  events.map((e) => ({ ...e, confirmed: confirmed.includes(e.id) })),
                ),
              )
            }
          >
            {ui('Bestätigte Termine als ICS herunterladen')}
          </Button>
        </fieldset>
      </section>
      <EvidencePreview sources={sources} focus={focus} />
    </div>
  );
}
