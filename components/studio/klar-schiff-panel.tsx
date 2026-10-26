'use client';
import { useState } from 'react';
import { Anchor, ArrowDown, ArrowUp, Check, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import { useToolDraftState } from './workspace-drafts';
import { Choice, Field, PageStage, Tick, type PanelProps } from './advanced-shared';
import { ui } from '@/lib/ui-language';
import { validDate } from '@/lib/century-model';
import { analyseKlarSchiff, exportKlarSchiff } from '@/lib/klar-schiff-engine';
import {
  emptyKlarPlan,
  klarFilename,
  klarWarnings,
  moveKlarPage,
  type KlarDocument,
  type KlarPlan,
} from '@/lib/klar-schiff-model';
import './klar-schiff.css';

export function KlarSchiffPanel({
  sources,
  run,
  busy,
  invalidate,
}: PanelProps & { invalidate: () => void }) {
  useLanguage();
  const key = sources.map((source) => source.id).join(':');
  const [plan, setPlan] = useToolDraftState<KlarPlan>('KlarSchiffPanel.plan:' + key, emptyKlarPlan);
  const [stage, setStage] = useToolDraftState<1 | 2 | 3>('KlarSchiffPanel.stage:' + key, 1);
  const [format, setFormat] = useToolDraftState<'zip' | 'pdf'>(
    'KlarSchiffPanel.format:' + key,
    'zip',
  );
  const [selected, setSelected] = useState('');
  const [previewId, setPreviewId] = useState('');
  const item = plan.documents.find((document) => document.id === selected) || plan.documents[0];
  const preview =
    plan.pages.find((page) => page.id === previewId) ||
    plan.pages.find((page) => page.id === item?.pageIds[0]);
  const previewSource = sources.find((source) => source.id === preview?.sourceId);
  const confirmed = plan.documents.filter((document) => document.confirmed).length;
  const ready = !!plan.documents.length && confirmed === plan.documents.length;
  const total = sources.reduce((count, source) => count + source.pdf.numPages, 0);
  const warnings = item ? klarWarnings(plan, item) : [];
  const change = (next: KlarPlan) => {
    invalidate();
    setPlan(next);
  };
  const update = (patch: Partial<KlarDocument>) => {
    if (!item) return;
    change({
      ...plan,
      documents: plan.documents.map((document) =>
        document.id === item.id
          ? { ...document, ...patch, confirmed: patch.confirmed ?? false }
          : document,
      ),
    });
  };
  const move = (pageId: string, target: string) => {
    const next = moveKlarPage(plan, pageId, target, ui);
    change(next);
    if (target === 'new') setSelected(next.documents[next.documents.length - 1].id);
  };
  const reorder = (id: string, offset: number, pages = false) => {
    if (pages && item) {
      const ids = [...item.pageIds],
        index = ids.indexOf(id),
        next = index + offset;
      if (index < 0 || next < 0 || next >= ids.length) return;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      update({ pageIds: ids });
    } else {
      const items = [...plan.documents],
        index = items.findIndex((document) => document.id === id),
        next = index + offset;
      if (index < 0 || next < 0 || next >= items.length) return;
      [items[index], items[next]] = [items[next], items[index]];
      change({ ...plan, documents: items });
    }
  };
  const choose = (document: KlarDocument) => {
    setSelected(document.id);
    setPreviewId(document.pageIds[0]);
  };
  return (
    <div className="klar-schiff">
      <nav className="klar-steps" aria-label={ui('Klar-Schiff-Schritte')}>
        {(['Erkennen', 'Vorschläge prüfen', 'Exportieren'] as const).map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={stage === index + 1 ? 'step' : undefined}
            disabled={busy || (index > 0 && !plan.pages.length) || (index === 2 && !ready)}
            onClick={() => setStage((index + 1) as 1 | 2 | 3)}
          >
            <span>{index + 1}</span>
            {ui(label)}
          </button>
        ))}
      </nav>
      {stage === 1 && (
        <section className="advanced-card klar-intro">
          <Anchor size={32} aria-hidden="true" />
          <h2>{ui('Papierchaos rein. Ordnung raus.')}</h2>
          <p>
            {ui(
              'Rechnungen und Briefe erkennen, zusammengehörige Seiten ordnen und Dateinamen vorschlagen. Scans werden automatisch auf deinem Gerät gelesen.',
            )}
          </p>
          <p className="klar-count">{ui(`${sources.length} Dateien · ${total} Seiten`)}</p>
          <Button
            disabled={busy || !total}
            onClick={() =>
              void run(async (ctx) => {
                const next = await analyseKlarSchiff(sources, ctx);
                if (ctx.signal.aborted) return;
                change(next);
                setSelected(next.documents[0]?.id || '');
                setPreviewId('');
                setStage(2);
              })
            }
          >
            <FileSearch size={17} />
            {ui(plan.pages.length ? 'Stapel erneut erkennen' : 'Stapel erkennen')}
          </Button>
          <p className="fine-note">
            {ui(
              'Alle Seiten bleiben zunächst erhalten. Unklare Zuordnungen, mögliche Duplikate und Seitenlücken werden zur Prüfung markiert.',
            )}
          </p>
        </section>
      )}
      {stage === 2 && (
        <>
          <div className="klar-summary" role="status">
            <div>
              <strong>{ui(`${plan.documents.length} Dokumente vorgeschlagen`)}</strong>
              <p>
                {ui(
                  `${confirmed} von ${plan.documents.length} geprüft · ${plan.excluded.length} Seiten ausgelassen`,
                )}
              </p>
            </div>
            <Button disabled={!ready} onClick={() => setStage(3)}>
              {ui('Weiter zum Export')}
            </Button>
          </div>
          <div className="klar-review">
            <section className="klar-document-list" aria-label={ui('Vorgeschlagene Dokumente')}>
              <Button
                variant="outline"
                disabled={!plan.documents.length}
                onClick={() =>
                  change({
                    ...plan,
                    documents: [...plan.documents].sort((a, b) =>
                      (a.date || '9999').localeCompare(b.date || '9999'),
                    ),
                  })
                }
              >
                {ui('Nach Datum ordnen')}
              </Button>
              {plan.documents.map((document, index) => (
                <div
                  className={`klar-document ${document.id === item?.id ? 'is-selected' : ''}`}
                  key={document.id}
                >
                  <button
                    className="klar-document-pick"
                    type="button"
                    onClick={() => choose(document)}
                    aria-pressed={document.id === item?.id}
                  >
                    <span className="klar-document-number">
                      {document.confirmed ? <Check size={17} /> : index + 1}
                    </span>
                    <span>
                      <strong>{document.title}</strong>
                      <small>{document.sender || ui('Absender offen')}</small>
                      <small>
                        {document.date || ui('Ohne Datum')} ·{' '}
                        {ui(`${document.pageIds.length} Seiten`)}
                      </small>
                      <span className="klar-state">
                        {ui(document.confirmed ? 'Geprüft' : 'Bitte prüfen')}
                      </span>
                    </span>
                  </button>
                  <div className="klar-order">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={ui('Dokument nach oben')}
                      disabled={index === 0}
                      onClick={() => reorder(document.id, -1)}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={ui('Dokument nach unten')}
                      disabled={index === plan.documents.length - 1}
                      onClick={() => reorder(document.id, 1)}
                    >
                      <ArrowDown size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </section>
            <section
              className="advanced-card klar-detail"
              aria-label={ui('Dokumentzuordnung prüfen')}
            >
              {item ? (
                <>
                  <h2>{ui('Dokument prüfen')}</h2>
                  <div className="klar-metadata">
                    <Field label={ui('Titel')}>
                      <input
                        maxLength={160}
                        value={item.title}
                        onChange={(event) => update({ title: event.target.value })}
                      />
                    </Field>
                    <Field label={ui('Absender')}>
                      <input
                        maxLength={100}
                        value={item.sender}
                        onChange={(event) => update({ sender: event.target.value })}
                      />
                    </Field>
                    <Field label={ui('Dokumentdatum')}>
                      <input
                        type="date"
                        value={item.date}
                        onChange={(event) => update({ date: event.target.value })}
                      />
                    </Field>
                    <Field label={ui('Dateiname')}>
                      <input
                        maxLength={150}
                        value={item.filename}
                        onChange={(event) => update({ filename: event.target.value })}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => update({ filename: klarFilename(item) })}
                  >
                    {ui('Dateiname aus Angaben bilden')}
                  </Button>
                  {!!warnings.length && (
                    <details className="klar-warnings" open={!item.confirmed}>
                      <summary>{ui(`${warnings.length} Prüfhinweise`)}</summary>
                      <ul>
                        {warnings.map((warning) => (
                          <li key={warning}>{ui(warning)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <h3>{ui('Seiten zuordnen')}</h3>
                  <p className="fine-note">
                    {ui(
                      'Seite auswählen, im Original prüfen und bei Bedarf einem anderen oder neuen Dokument zuordnen.',
                    )}
                  </p>
                  <ol className="klar-pages">
                    {item.pageIds.map((id, index) => {
                      const page = plan.pages.find((candidate) => candidate.id === id)!;
                      return (
                        <li key={id} className={preview?.id === id ? 'is-selected' : ''}>
                          <button
                            type="button"
                            className="klar-page-pick"
                            onClick={() => setPreviewId(id)}
                          >
                            <strong>
                              {index + 1}. {page.name}
                            </strong>
                            <small>
                              {ui(`Originalseite ${page.page + 1}`)}
                              {page.number !== null && (
                                <> · {ui(`Gedruckte Seite ${page.number} von ${page.total}`)}</>
                              )}
                              {page.duplicateOf && <> · {ui('Mögliches Duplikat')}</>}
                            </small>
                          </button>
                          <div className="klar-page-actions">
                            <Choice
                              label={ui('Zuordnen zu')}
                              value={item.id}
                              onChange={(target) => move(id, target)}
                              translateItems={false}
                              items={[
                                ...plan.documents.map((document, i): [string, string] => [
                                  document.id,
                                  `${i + 1}. ${document.title}`,
                                ]),
                                ['new', ui('Neues Dokument aus dieser Seite')],
                                ['exclude', ui('Seite auslassen')],
                              ]}
                            />
                            <div className="klar-order">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={ui('Seite nach oben')}
                                disabled={index === 0}
                                onClick={() => reorder(id, -1, true)}
                              >
                                <ArrowUp size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={ui('Seite nach unten')}
                                disabled={index === item.pageIds.length - 1}
                                onClick={() => reorder(id, 1, true)}
                              >
                                <ArrowDown size={16} />
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <Tick
                    label={ui('Zuordnung, Reihenfolge und Angaben dieses Dokuments geprüft')}
                    value={item.confirmed}
                    onChange={(confirmed) => {
                      if (
                        !item.title.trim() ||
                        !item.filename.trim() ||
                        (item.date && !validDate(item.date))
                      )
                        return;
                      update({ confirmed });
                    }}
                  />
                  {(!item.title.trim() ||
                    !item.filename.trim() ||
                    (item.date && !validDate(item.date))) && (
                    <p className="error-box">
                      {ui('Titel, Dateiname und Datum prüfen. Das Datum darf leer bleiben.')}
                    </p>
                  )}
                  {plan.documents.some(
                    (document) => !document.confirmed && document.id !== item.id,
                  ) && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        choose(
                          plan.documents.find(
                            (document) => !document.confirmed && document.id !== item.id,
                          )!,
                        )
                      }
                    >
                      {ui('Nächstes ungeprüftes Dokument')}
                    </Button>
                  )}
                </>
              ) : (
                <p>
                  {ui('Alle Seiten sind ausgelassen. Stelle mindestens eine Seite wieder her.')}
                </p>
              )}
            </section>
            <aside className="advanced-card klar-preview" aria-label={ui('Originalvorschau')}>
              <h2>{ui('Originalvorschau')}</h2>
              {preview && previewSource && (
                <>
                  <p>
                    {preview.name} · {ui(`Seite ${preview.page + 1}`)}
                  </p>
                  <PageStage source={previewSource} page={preview.page} />
                  {preview.duplicateOf && (
                    <Button variant="outline" onClick={() => setPreviewId(preview.duplicateOf)}>
                      {ui('Mögliches Duplikat vergleichen')}
                    </Button>
                  )}
                  <details>
                    <summary>{ui('Erkannte Angaben ansehen')}</summary>
                    <pre className="klar-excerpt">{preview.excerpt || ui('Kein Text erkannt')}</pre>
                  </details>
                </>
              )}
            </aside>
          </div>
          {!!plan.excluded.length && (
            <details className="advanced-card klar-excluded" open>
              <summary>{ui(`Ausgelassene Seiten: ${plan.excluded.length}`)}</summary>
              {plan.excluded.map((id) => {
                const page = plan.pages.find((candidate) => candidate.id === id)!;
                return (
                  <div key={id}>
                    <button type="button" onClick={() => setPreviewId(id)}>
                      {page.name} · {ui(`Seite ${page.page + 1}`)}
                    </button>
                    <Button variant="outline" onClick={() => move(id, 'new')}>
                      {ui('Als Dokument wiederherstellen')}
                    </Button>
                  </div>
                );
              })}
            </details>
          )}
        </>
      )}
      {stage === 3 && (
        <section className="advanced-card klar-export">
          <h2>{ui('Deine Unterlagen sind geordnet.')}</h2>
          <p>
            {ui(
              `${plan.documents.length} Dokumente · ${plan.pages.length - plan.excluded.length} Seiten für den Export`,
            )}
          </p>
          {!!plan.excluded.length && (
            <p className="workbench-notice">
              {ui(`${plan.excluded.length} bewusst ausgelassene Seiten werden nicht exportiert.`)}
            </p>
          )}
          <Choice
            label={ui('Ausgabe')}
            value={format}
            onChange={(value) => {
              invalidate();
              setFormat(value as 'zip' | 'pdf');
            }}
            items={[
              ['zip', 'Einzelne PDFs im ZIP'],
              ['pdf', 'Gesamt-PDF mit Inhaltsverzeichnis'],
            ]}
          />
          <p className="fine-note">
            {ui(
              'Originalseiten werden übernommen. Scans bleiben Bildseiten. Formularwerte werden festgeschrieben; ursprüngliche Signaturen, Lesezeichen und Anhänge werden nicht übernommen.',
            )}
          </p>
          <div className="advanced-actions">
            <Button variant="outline" onClick={() => setStage(2)}>
              {ui('Zuordnungen ansehen')}
            </Button>
            <Button
              disabled={!ready || busy}
              onClick={() => void run((ctx) => exportKlarSchiff(sources, plan, format, ctx))}
            >
              {ui('Geordnete Unterlagen erstellen')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
