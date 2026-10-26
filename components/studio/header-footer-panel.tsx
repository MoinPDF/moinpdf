'use client';
import { useState } from 'react';
import { Search, Trash2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import { uid } from '@/lib/pdf-engine';
import type { Rect } from '@/lib/studio-engine';
import {
  defaultMarginSettings,
  marginZone,
  validateMarginHits,
  type MarginHit,
  type MarginSettings,
} from '@/lib/header-footer-model';
import { findMarginHits, exportMarginCleanup } from '@/lib/header-footer-engine';
import { useToolDraftState } from './workspace-drafts';
import {
  Choice,
  NumberField,
  PageSelect,
  PageStage,
  RectFields,
  Tick,
  type PanelProps,
} from './advanced-shared';
import './header-footer.css';

export function HeaderFooterPanel({
  source,
  run,
  busy,
  invalidate,
}: PanelProps & { invalidate: () => void }) {
  useLanguage();
  const [settings, setSettings] = useToolDraftState<MarginSettings>(
    'HeaderFooterPanel.settings:' + source.id,
    defaultMarginSettings,
  );
  const [hits, setHits] = useToolDraftState<MarginHit[]>('HeaderFooterPanel.hits:' + source.id, []);
  const [page, setPage] = useState(0),
    [reviewed, setReviewed] = useState(false),
    [cleanPreview, setCleanPreview] = useState(false);
  const [manual, setManual] = useState(false),
    [rect, setRect] = useState<Rect>({ x: 0.05, y: 0.025, w: 0.9, h: 0.055 }),
    [scope, setScope] = useState('current');
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const selected = hits.filter((h) => h.selected),
    affected = new Set(selected.map((h) => h.page)).size;
  let selectionError = '';
  if (hits.length)
    try {
      validateMarginHits(hits, source.pdf.numPages);
    } catch (e) {
      selectionError = (e as Error).message;
    }
  const change = (next: MarginHit[]) => {
    setHits(next);
    setReviewed(false);
    setError('');
    invalidate();
  };
  const configure = (next: MarginSettings) => {
    setSettings(next);
    change([]);
    setMessage('');
  };
  const label = (hit: MarginHit) =>
    hit.manual
      ? ui(hit.zone === 'header' ? 'Manueller Kopfbereich' : 'Manueller Fußbereich')
      : hit.text;
  const addManual = () => {
    try {
      const zone = marginZone(rect),
        group = uid(),
        pages = scope === 'all' ? Array.from({ length: source.pdf.numPages }, (_, i) => i) : [page];
      if (source.pdf.numPages > 200 || hits.length + pages.length > 2000)
        throw new Error('Bitte höchstens 2.000 Fundstellen auf 200 Seiten verwenden.');
      change(
        [
          ...hits,
          ...pages.map((index) => ({
            id: uid(),
            page: index,
            zone,
            text: '',
            rect: { ...rect },
            selected: true,
            manual: true,
            group,
          })),
        ].sort((a, b) => a.page - b.page || a.rect.y - b.rect.y),
      );
      setManual(false);
      setCleanPreview(false);
      setMessage('Manueller Bereich ergänzt. Bitte jede betroffene Seite prüfen.');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="margin-tool">
      <section className="advanced-card">
        <h2>{ui('1. Wiederkehrende Angaben erkennen')}</h2>
        <p>
          {ui(
            'Erkennt ähnliche Textzeilen an derselben Randposition auf mindestens zwei Seiten. Wechselnde Seitenzahlen können gemeinsam erkannt werden. Jeder Treffer bleibt abwählbar.',
          )}
        </p>
        <div className="margin-options">
          <Tick
            label="Kopfzeilen suchen"
            value={settings.headers}
            onChange={(headers) => configure({ ...settings, headers })}
          />
          <Tick
            label="Fußzeilen suchen"
            value={settings.footers}
            onChange={(footers) => configure({ ...settings, footers })}
          />
          <Tick
            label="Wechselnde Seitenzahlen erkennen"
            value={settings.pageNumbers}
            onChange={(pageNumbers) => configure({ ...settings, pageNumbers })}
          />
        </div>
        <div className="margin-options">
          <NumberField
            label="Oberer Suchrand (%)"
            value={settings.top}
            min={3}
            max={25}
            onChange={(top) => configure({ ...settings, top })}
          />
          <NumberField
            label="Unterer Suchrand (%)"
            value={settings.bottom}
            min={3}
            max={25}
            onChange={(bottom) => configure({ ...settings, bottom })}
          />
          <Button
            disabled={busy || (!settings.headers && !settings.footers)}
            onClick={() =>
              void run(async (ctx) => {
                change([]);
                setMessage('');
                const found = await findMarginHits(source, settings, ctx);
                setHits(found.hits);
                setPage(found.hits[0]?.page || 0);
                setMessage(
                  found.hits.length
                    ? 'Fundstellen erkannt. Bitte die Auswahl auf allen betroffenen Seiten prüfen.'
                    : 'Keine wiederkehrenden Randtexte gefunden. Du kannst Bereiche manuell markieren.',
                );
              })
            }
          >
            <Search size={16} />
            {ui('Kopf- und Fußzeilen erkennen')}
          </Button>
        </div>
        <p className="margin-hint">
          {ui(
            'Für reine Scans oder einzelne Seiten Bereiche manuell markieren. Suchränder ändern oder erneut erkennen setzt die Trefferliste zurück.',
          )}
        </p>
        {message && <p role="status">{ui(message)}</p>}
      </section>
      <section className="advanced-card">
        <h2>{ui('2. Fundstellen und Ausnahmen prüfen')}</h2>
        <div className="margin-options">
          <Button
            variant="outline"
            onClick={() => {
              setManual((v) => !v);
              setCleanPreview(false);
              setError('');
            }}
            aria-pressed={manual}
          >
            {ui('Bereich manuell markieren')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setCleanPreview((v) => !v)}
            disabled={manual}
            aria-pressed={cleanPreview}
          >
            {ui(cleanPreview ? 'Markierungen anzeigen' : 'Bereinigungsvorschau')}
          </Button>
          <span>
            {selected.length} {ui('Treffer zum Entfernen')} · {affected} {ui('Seiten betroffen')}
          </span>
        </div>
        <div className="margin-columns">
          <div className="margin-original">
            <div className="margin-page-nav">
              <Button
                variant="outline"
                aria-label={ui('Vorherige Seite')}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <PageSelect source={source} page={page} onChange={setPage} />
              <Button
                variant="outline"
                aria-label={ui('Nächste Seite')}
                disabled={page >= source.pdf.numPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
            <PageStage
              source={source}
              page={page}
              onRect={manual ? setRect : undefined}
              rects={
                manual
                  ? [rect]
                  : cleanPreview
                    ? []
                    : selected.filter((h) => h.page === page).map((h) => ({ ...h.rect }))
              }
            >
              {cleanPreview &&
                selected
                  .filter((h) => h.page === page)
                  .map((h) => (
                    <span
                      key={h.id}
                      className="margin-white-area"
                      style={{
                        left: h.rect.x * 100 + '%',
                        top: h.rect.y * 100 + '%',
                        width: h.rect.w * 100 + '%',
                        height: h.rect.h * 100 + '%',
                      }}
                    />
                  ))}
            </PageStage>
            <p className="margin-hint">
              {ui(
                'Die Vorschau zeigt die ausgewählten Bereiche weiß. Beim Export werden die Inhalte darin tatsächlich entfernt. Auch Bilder und Linien innerhalb der Bereiche werden gelöscht.',
              )}
            </p>
          </div>
          <div className="margin-settings">
            {manual && (
              <div className="margin-manual">
                <h3>{ui('Manueller Randbereich')}</h3>
                <p>
                  {ui(
                    'Bereich aufziehen oder Prozentwerte eingeben. Er muss vollständig im oberen oder unteren Seitenviertel liegen.',
                  )}
                </p>
                <RectFields rect={rect} onChange={setRect} />
                <Choice
                  label="Bereich anwenden auf"
                  value={scope}
                  onChange={setScope}
                  items={[
                    ['current', 'Aktuelle Seite'],
                    ['all', 'Alle Seiten'],
                  ]}
                />
                <p className="margin-hint">
                  {ui(
                    'Auf allen Seiten wird dieselbe relative Position verwendet. Unterschiedliche Seitenformate bitte einzeln prüfen.',
                  )}
                </p>
                <Button variant="outline" onClick={addManual}>
                  <Plus size={16} />
                  {ui('Randbereich hinzufügen')}
                </Button>
              </div>
            )}
            <div className="margin-options">
              <Button
                variant="outline"
                disabled={!hits.length}
                onClick={() => change(hits.map((h) => ({ ...h, selected: true })))}
              >
                {ui('Alle Fundstellen auswählen')}
              </Button>
              <Button
                variant="outline"
                disabled={!hits.length}
                onClick={() => change(hits.map((h) => ({ ...h, selected: false })))}
              >
                {ui('Alle Fundstellen ausschließen')}
              </Button>
            </div>
            {!hits.length && (
              <p>
                {ui(
                  'Noch keine Fundstellen. Starte die Erkennung oder ergänze einen manuellen Bereich.',
                )}
              </p>
            )}
            <div className="margin-hit-list" aria-label={ui('Erkannte Randbereiche')}>
              {hits.map((hit) => (
                <div
                  key={hit.id}
                  className={`margin-hit ${hit.selected ? 'selected' : ''} ${hit.page === page ? 'current-page' : ''}`}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={hit.selected}
                      onChange={(e) =>
                        change(
                          hits.map((h) =>
                            h.id === hit.id ? { ...h, selected: e.target.checked } : h,
                          ),
                        )
                      }
                    />
                    <span>
                      <strong>
                        {ui('Seite')} {hit.page + 1} ·{' '}
                        {ui(hit.zone === 'header' ? 'Kopfzeile' : 'Fußzeile')}
                      </strong>
                      <span>{label(hit)}</span>
                    </span>
                  </label>
                  <div className="margin-hit-actions">
                    <Button
                      variant="ghost"
                      aria-label={`${ui('Fundstelle anzeigen')} · ${ui('Seite')} ${hit.page + 1} · ${label(hit)}`}
                      onClick={() => {
                        setPage(hit.page);
                        setCleanPreview(false);
                        setManual(false);
                      }}
                    >
                      {ui('Anzeigen')}
                    </Button>
                    {hit.manual && (
                      <Button
                        variant="ghost"
                        aria-label={`${ui('Manuellen Bereich löschen')} · ${ui('Seite')} ${hit.page + 1}`}
                        onClick={() => change(hits.filter((h) => h.id !== hit.id))}
                      >
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {(error || selectionError) && (
          <p role="alert" className="error-box">
            {ui(error || selectionError)}
          </p>
        )}
      </section>
      <section className="advanced-card">
        <h2>{ui('3. Bereinigte Kopie speichern')}</h2>
        <p>
          {ui(
            'Das Original bleibt unverändert. Übriger auslesbarer Text und Seitengrößen werden nach dem Entfernen geprüft. Vollständig erfasste Links werden ebenfalls entfernt. Angeschnittene Textzeilen oder Links sowie berührte Kommentare oder Formularfelder müssen angepasst werden.',
          )}
        </p>
        <Tick
          label="Ich habe alle ausgewählten Fundstellen und Ausnahmen am Original geprüft."
          value={reviewed}
          onChange={setReviewed}
        />
        <Button
          disabled={busy || !reviewed || !selected.length || !!selectionError}
          onClick={() => void run((ctx) => exportMarginCleanup(source, hits, reviewed, ctx))}
        >
          <Trash2 size={16} />
          {ui('Bereinigte PDF erstellen')}
        </Button>
        <p className="margin-hint">
          {ui(
            'Bis zu 200 Seiten, 2.000 Fundstellen und 80 MB. Signierte PDFs und dynamische XFA werden abgewiesen. Anhänge und Dokumentinfos werden nicht bereinigt; dieses Werkzeug ersetzt keine vollständige Anonymisierung.',
          )}
        </p>
      </section>
    </div>
  );
}
