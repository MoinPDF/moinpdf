'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { uid } from '@/lib/pdf-engine';
import { newFormField, type DocumentDraft, type FormField } from '@/lib/document-tools';
import {
  decodeProfiles,
  emptyProfile,
  storeProfile,
  suggestProfileEntry,
  PROFILE_STORAGE_KEY,
  layoutReceipts,
  type FormProfile,
  type ReceiptItem,
  type ReceiptOptions,
} from '@/lib/everyday-model';
import {
  readHelperForm,
  exportHelperForm,
  receiptItems,
  exportReceipts,
} from '@/lib/everyday-engine';
import { useLanguage } from './appearance';
import { useToolDraftState } from './workspace-drafts';
import {
  Choice,
  Field,
  NumberField,
  PageSelect,
  PageStage,
  RectFields,
  Text,
  Tick,
  type PanelProps,
} from './advanced-shared';
import { FormCanvas } from './form-canvas';
import { PagePreview } from './canvas';
import './everyday-tools.css';

type Props = PanelProps & { invalidate: () => void };
export function FormHelperPanel({ source, run, busy, invalidate }: Props) {
  useLanguage();
  const freshProfile = () => {
    const next = emptyProfile();
    return { ...next, entries: next.entries.map((e) => ({ ...e, label: ui(e.label) })) };
  };
  const [profiles, setProfiles] = useState<FormProfile[]>([]);
  const [profile, setProfile] = useState<FormProfile>(freshProfile);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useToolDraftState<DocumentDraft | null>(
    'FormHelperPanel.draft:' + source.id,
    null,
  );
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState(''),
    [entryId, setEntryId] = useState('entry-0');
  const [placing, setPlacing] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [flatten, setFlatten] = useState(false);
  useEffect(() => {
    try {
      setProfiles(decodeProfiles(localStorage.getItem(PROFILE_STORAGE_KEY)));
      setStorageReady(true);
    } catch {
      setStorageError(
        'Gespeicherte Profile sind nicht verfügbar. Du kannst Angaben weiterhin ohne Speicherung verwenden.',
      );
    }
  }, []);
  const change = (next: DocumentDraft) => {
    invalidate();
    setReviewed(false);
    setDraft(next);
  };
  const updateField = (id: string, patch: Partial<FormField>) => {
    if (draft)
      change({ ...draft, fields: draft.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  };
  const protectedFields =
    draft?.fields.filter(
      (f) => f.existing && f.readOnly && !f.deleted && f.kind !== 'unsupported',
    ) || [];
  const hasUnlocked = protectedFields.some((f) => f.unlockReadOnly);
  const unlockField = (id: string, enabled: boolean) => {
    if (enabled) setFlatten(false);
    updateField(id, { unlockReadOnly: enabled });
  };
  const field = draft?.fields.find((f) => f.id === selected && !f.deleted);
  const entry = profile.entries.find((e) => e.id === entryId) || profile.entries[0];
  const persist = (next: FormProfile[]) => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
      setProfiles(next);
      setStorageError('');
      return true;
    } catch {
      setStorageError('Das Profil konnte nicht gespeichert werden. Bitte Browserspeicher prüfen.');
      return false;
    }
  };
  const save = () => {
    try {
      const next = { ...profile, id: profile.id || uid() };
      if (persist(storeProfile(profiles, next))) {
        setProfile(next);
        setMessage('Profil auf diesem Gerät gespeichert.');
      }
    } catch (error) {
      setStorageError((error as Error).message);
    }
  };
  const choose = (id: string) => {
    const next = profiles.find((p) => p.id === id);
    setProfile(next ? structuredClone(next) : freshProfile());
    setMessage('');
    setPlacing(false);
  };
  const pickField = (id: string) => {
    setSelected(id);
    const f = draft?.fields.find((f) => f.id === id);
    if (f?.widgets[0]) setPage(f.widgets[0].page);
  };
  return (
    <div className="everyday-tool form-helper">
      <section className="advanced-card">
        <h2>{ui('1. Deine wiederkehrenden Angaben')}</h2>
        <p>
          {ui(
            'Profile werden nur über „Profil speichern“ dauerhaft auf diesem Gerät abgelegt, unverschlüsselt im Browser. Du kannst sie hier wieder löschen. Ohne Speichern gelten deine Angaben nur für diese Sitzung.',
          )}
        </p>
        <div className="everyday-row">
          <Choice
            label="Gespeichertes Profil"
            value={profile.id}
            onChange={choose}
            translateItems={false}
            items={[
              ['', ui('Neues Profil')],
              ...profiles.map((p) => [p.id, p.name] as [string, string]),
            ]}
          />
          <Text
            label="Profilname"
            value={profile.name}
            onChange={(name) => {
              setProfile({ ...profile, name });
              setMessage('');
            }}
          />
        </div>
        <div className="profile-entries">
          {profile.entries.map((item, index) => (
            <div key={item.id} className="profile-entry">
              <label>
                <span className="sr-only">
                  {ui('Bezeichnung')} {index + 1}
                </span>
                <input
                  maxLength={80}
                  aria-label={`${ui('Bezeichnung')} ${index + 1}`}
                  value={item.label}
                  onChange={(e) => {
                    setProfile({
                      ...profile,
                      entries: profile.entries.map((v) =>
                        v.id === item.id ? { ...v, label: e.target.value } : v,
                      ),
                    });
                    setMessage('');
                  }}
                />
              </label>
              <input
                aria-label={ui(item.label)}
                placeholder={ui('Angabe eingeben')}
                value={item.value}
                maxLength={500}
                autoComplete="off"
                onChange={(e) => {
                  setProfile({
                    ...profile,
                    entries: profile.entries.map((v) =>
                      v.id === item.id ? { ...v, value: e.target.value } : v,
                    ),
                  });
                  setMessage('');
                }}
              />
              <Button
                variant="ghost"
                aria-label={`${ui('Angabe entfernen')}: ${item.label}`}
                disabled={profile.entries.length <= 1}
                onClick={() =>
                  setProfile({
                    ...profile,
                    entries: profile.entries.filter((v) => v.id !== item.id),
                  })
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>
        <div className="everyday-actions">
          <Button
            variant="outline"
            disabled={profile.entries.length >= 30}
            onClick={() =>
              setProfile({
                ...profile,
                entries: [...profile.entries, { id: uid(), label: ui('Eigene Angabe'), value: '' }],
              })
            }
          >
            <Plus size={16} />
            {ui('Angabe ergänzen')}
          </Button>
          <Button disabled={!storageReady || !profile.name.trim()} onClick={save}>
            {ui('Profil speichern')}
          </Button>
          {profile.id && (
            <Button
              variant="outline"
              onClick={() => {
                setProfile({ ...profile, id: '', name: profile.name + ' ' + ui('Kopie') });
                setMessage('');
              }}
            >
              {ui('Als neues Profil')}
            </Button>
          )}
          {profile.id && (
            <Button
              variant="ghost"
              onClick={() => {
                if (persist(profiles.filter((p) => p.id !== profile.id))) {
                  setProfile(freshProfile());
                  setMessage('Profil gelöscht.');
                }
              }}
            >
              {ui('Profil löschen')}
            </Button>
          )}
        </div>
        {storageError && (
          <p className="error-box" role="alert">
            {ui(storageError)}
          </p>
        )}
        {message && <p role="status">{ui(message)}</p>}
      </section>
      <section className="advanced-card">
        <h2>{ui('2. Formular ausfüllen und prüfen')}</h2>
        {!draft ? (
          <>
            <p>
              {ui(
                'Vorhandene Textfelder erhalten passende Vorschläge. Auf Scans kannst du Angaben selbst platzieren. Bestehende Einträge werden nicht automatisch überschrieben.',
              )}
            </p>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async (ctx) => {
                  const next = await readHelperForm(source, ctx);
                  change(next);
                  setSelected(next.fields[0]?.id || '');
                })
              }
            >
              {ui('Formularfelder laden')}
            </Button>
          </>
        ) : (
          <>
            <div className="everyday-actions">
              <Button
                variant="outline"
                onClick={() => {
                  let count = 0;
                  change({
                    ...draft,
                    fields: draft.fields.map((f) => {
                      const match = suggestProfileEntry(f, profile.entries);
                      if (!match) return f;
                      count++;
                      return { ...f, value: match.value };
                    }),
                  });
                  setMessage(
                    count
                      ? 'Vorschläge eingesetzt. Bitte alle Angaben am Original prüfen.'
                      : 'Keine eindeutige Zuordnung gefunden. Angaben bitte selbst zuordnen.',
                  );
                }}
              >
                {ui('Angaben vorschlagen')}
              </Button>
              <Choice
                label="Angabe zum Platzieren"
                value={entry?.id || ''}
                onChange={setEntryId}
                translateItems={false}
                items={profile.entries.map((e) => [e.id, `${e.label}: ${e.value}`])}
              />
              <Button
                variant={placing ? 'default' : 'outline'}
                disabled={!entry?.value.trim()}
                onClick={() => setPlacing(!placing)}
              >
                {ui(placing ? 'Platzierung beenden' : 'Angabe auf Seite platzieren')}
              </Button>
            </div>
            {placing && (
              <p role="status">
                {ui(
                  'Ziehe auf der Seite einen Bereich für die gewählte Angabe auf. Alternativ füge einen Bereich hinzu und passe seine Prozentwerte an.',
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    const next = newFormField(draft.fields, 'text', page, {
                      x: 0.1,
                      y: 0.1,
                      w: 0.55,
                      h: 0.05,
                    });
                    next.value = entry.value;
                    change({ ...draft, fields: [...draft.fields, next] });
                    setSelected(next.id);
                    setPlacing(false);
                  }}
                >
                  {ui('Bereich hinzufügen')}
                </Button>
              </p>
            )}
            {protectedFields.length > 0 && (
              <details className="advanced-card">
                <summary>{ui('Schreibgeschützte Formularfelder freigeben')}</summary>
                <p>
                  {ui(
                    'Wähle die Felder, die in der neuen PDF wieder ausfüllbar sein sollen. Vorhandene Werte bleiben erhalten. Andere Feldregeln und Passwortschutz werden dadurch nicht aufgehoben.',
                  )}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const enable = !protectedFields.every((f) => f.unlockReadOnly);
                    if (enable) setFlatten(false);
                    change({
                      ...draft,
                      fields: draft.fields.map((f) =>
                        protectedFields.some((p) => p.id === f.id)
                          ? { ...f, unlockReadOnly: enable }
                          : f,
                      ),
                    });
                  }}
                >
                  {ui(
                    protectedFields.every((f) => f.unlockReadOnly)
                      ? 'Freigaben zurücknehmen'
                      : 'Alle angezeigten Felder freigeben',
                  )}
                </Button>
                {protectedFields.map((f) => (
                  <label className="advanced-tick" key={f.id}>
                    <input
                      type="checkbox"
                      checked={!!f.unlockReadOnly}
                      onChange={(e) => unlockField(f.id, e.target.checked)}
                    />
                    <span>{f.name}</span>
                  </label>
                ))}
              </details>
            )}
            <div className="everyday-columns">
              <div className="everyday-original">
                <PageSelect source={source} page={page} onChange={setPage} />
                <FormCanvas
                  source={source}
                  pageIndex={page}
                  fields={draft.fields}
                  selectedId={selected}
                  creating={placing}
                  design
                  disabled={busy}
                  onSelect={pickField}
                  onCreate={(rect) => {
                    if (!entry) return;
                    const next = newFormField(draft.fields, 'text', page, rect);
                    next.value = entry.value;
                    change({ ...draft, fields: [...draft.fields, next] });
                    setSelected(next.id);
                    setPlacing(false);
                  }}
                  onRect={(id, widget, rect) => {
                    const f = draft.fields.find((v) => v.id === id);
                    if (f)
                      updateField(id, {
                        widgets: f.widgets.map((w, i) => (i === widget ? { ...w, rect } : w)),
                      });
                  }}
                />
              </div>
              <div className="everyday-settings">
                {!draft.fields.some((f) => !f.deleted) && (
                  <p>
                    {ui(
                      'Keine interaktiven Felder gefunden. Wähle eine Angabe und platziere sie auf der Seite.',
                    )}
                  </p>
                )}
                <div className="helper-field-list" aria-label={ui('Formularfelder')}>
                  {draft.fields
                    .filter((f) => !f.deleted)
                    .map((f) => (
                      <button
                        type="button"
                        key={f.id}
                        aria-pressed={f.id === selected}
                        onClick={() => pickField(f.id)}
                      >
                        <strong>{f.name}</strong>
                        <span>{String(f.value || '') || ui('Noch leer')}</span>
                      </button>
                    ))}
                </div>
                {field && (
                  <div className="helper-field-editor">
                    <h3>{field.name}</h3>
                    {field.kind === 'text' && (!field.readOnly || field.unlockReadOnly) ? (
                      <>
                        <Choice
                          label="Angabe zuordnen"
                          value=""
                          onChange={(id) => {
                            const found = profile.entries.find((e) => e.id === id);
                            if (found) updateField(field.id, { value: found.value });
                          }}
                          translateItems={false}
                          items={[
                            ['', ui('Bitte wählen')],
                            ...profile.entries.map((e) => [e.id, e.label] as [string, string]),
                          ]}
                        />
                        <Field label="Feldinhalt">
                          <textarea
                            aria-label={ui('Feldinhalt')}
                            rows={field.multiline ? 4 : 2}
                            value={String(field.value)}
                            maxLength={Math.min(500, field.maxLength || 500)}
                            onChange={(e) => updateField(field.id, { value: e.target.value })}
                          />
                        </Field>
                        {!field.existing && (
                          <>
                            <NumberField
                              label="Schriftgröße (pt)"
                              value={field.fontSize}
                              min={6}
                              max={48}
                              onChange={(fontSize) => updateField(field.id, { fontSize })}
                            />
                            <RectFields
                              rect={field.widgets[0].rect}
                              onChange={(rect) =>
                                updateField(field.id, { widgets: [{ ...field.widgets[0], rect }] })
                              }
                            />
                            <Button
                              variant="ghost"
                              onClick={() => {
                                change({
                                  ...draft,
                                  fields: draft.fields.filter((f) => f.id !== field.id),
                                });
                                setSelected('');
                              }}
                            >
                              {ui('Platzierten Eintrag entfernen')}
                            </Button>
                          </>
                        )}
                        {field.existing && (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              updateField(field.id, { value: field.initialValue || '' })
                            }
                          >
                            {ui('Ursprünglichen Wert wiederherstellen')}
                          </Button>
                        )}
                      </>
                    ) : (
                      <p>
                        {ui(
                          'Dieses Feld bleibt unverändert. Checkboxen und Auswahllisten kannst du im Werkzeug „Formulare ausfüllen“ bearbeiten.',
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            {hasUnlocked ? (
              <p className="fine-note">
                {ui(
                  'Freigegebene Felder bleiben ausfüllbar. Die Ausgabe wird nicht festgeschrieben.',
                )}
              </p>
            ) : (
              <Tick
                label="Formularwerte dauerhaft festschreiben"
                value={flatten}
                onChange={(v) => {
                  invalidate();
                  setFlatten(v);
                  setReviewed(false);
                }}
              />
            )}
            <Tick
              label="Ich habe Angaben und Positionen am Original geprüft."
              value={reviewed}
              onChange={setReviewed}
            />
            <Button
              disabled={!reviewed || busy}
              onClick={() =>
                void run((ctx) => exportHelperForm(source, draft, reviewed, flatten, ctx))
              }
            >
              {ui('Ausgefüllte PDF erstellen')}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}

export function ReceiptsPanel({ sources, run, busy, invalidate }: Props) {
  useLanguage();
  const key = sources.map((s) => s.id).join(':');
  const [items, setItems] = useToolDraftState<ReceiptItem[]>('ReceiptsPanel.items:' + key, []);
  const [options, setOptions] = useToolDraftState<ReceiptOptions>('ReceiptsPanel.options:' + key, {
    margin: 10,
    gap: 5,
    numbers: true,
  });
  const [selected, setSelected] = useState(''),
    [sheet, setSheet] = useState(0),
    [stage, setStage] = useState<'edit' | 'preview'>('edit');
  const [removed, setRemoved] = useState<{ item: ReceiptItem; index: number } | null>(null);
  const item = items.find((i) => i.id === selected) || items[0],
    source = sources.find((s) => s.id === item?.sourceId);
  const change = (next: ReceiptItem[]) => {
    invalidate();
    setItems(next);
  };
  const update = (patch: Partial<ReceiptItem>) => {
    if (item) change(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
  };
  let layout: ReturnType<typeof layoutReceipts> | undefined,
    layoutError = '';
  if (items.length)
    try {
      layout = layoutReceipts(items, options);
    } catch (error) {
      layoutError = (error as Error).message;
    }
  const currentSheet = Math.min(sheet, Math.max(0, (layout?.sheets || 1) - 1));
  const reorder = (offset: number) => {
    const next = [...items],
      from = next.findIndex((i) => i.id === item.id),
      to = from + offset;
    if (to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    change(next);
  };
  return (
    <div className="everyday-tool receipts-tool">
      {!items.length ? (
        <section className="advanced-card">
          <h2>{ui('Kleine Belege. Ordentlich auf A4.')}</h2>
          <p>
            {ui(
              'Öffne alle Fotos und PDFs. Schneide jeden Beleg zu, bestimme seine Druckbreite und prüfe die A4-Vorschau. Lange Belege werden ohne Verkleinerung in aufeinanderfolgende Teile aufgeteilt.',
            )}
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async (ctx) => {
                change(await receiptItems(sources, ctx));
                setStage('edit');
              })
            }
          >
            {ui('Belege laden')}
          </Button>
          {removed && (
            <Button
              variant="outline"
              onClick={() => {
                change([removed.item]);
                setRemoved(null);
              }}
            >
              {ui('Letzten Beleg wiederherstellen')}
            </Button>
          )}
        </section>
      ) : (
        <>
          <div className="everyday-actions everyday-tabs">
            <Button
              variant={stage === 'edit' ? 'default' : 'outline'}
              onClick={() => setStage('edit')}
            >
              {ui('Belege zuschneiden')}
            </Button>
            <Button
              variant={stage === 'preview' ? 'default' : 'outline'}
              disabled={!layout}
              onClick={() => setStage('preview')}
            >
              {ui('A4-Vorschau')}
            </Button>
            <span>
              {items.length} {ui('Belege')} · {layout?.sheets || '—'} {ui('A4-Seiten')}
            </span>
          </div>
          {stage === 'edit' && item && source && (
            <div className="everyday-columns">
              <div className="everyday-original">
                <Choice
                  label="Beleg auswählen"
                  value={item.id}
                  onChange={setSelected}
                  translateItems={false}
                  items={items.map((i, index) => [
                    i.id,
                    `${index + 1}. ${sources.find((s) => s.id === i.sourceId)?.name || ''} · ${ui('Seite')} ${i.page + 1}`,
                  ])}
                />
                <p>
                  {ui(
                    'Ziehe einen Rahmen um den Beleg. Die Prozentwerte erlauben eine genaue Korrektur.',
                  )}
                </p>
                <PageStage
                  source={source}
                  page={item.page}
                  rotation={item.rotation}
                  rects={[item.rect]}
                  onRect={(rect) => update({ rect })}
                />
              </div>
              <section className="advanced-card everyday-settings">
                <h2>{ui('Beleg vorbereiten')}</h2>
                <Text
                  label="Beschriftung (optional)"
                  value={item.label}
                  onChange={(label) => update({ label: label.slice(0, 80) })}
                />
                <NumberField
                  label="Druckbreite (mm)"
                  value={item.widthMm}
                  min={30}
                  max={190}
                  onChange={(widthMm) => update({ widthMm })}
                />
                <p>
                  {ui(
                    '80 mm eignet sich als Startwert für Kassenbons. Die passende Breite hängt vom Original ab.',
                  )}
                </p>
                <RectFields rect={item.rect} onChange={(rect) => update({ rect })} />
                <div className="everyday-actions">
                  <Button
                    variant="outline"
                    onClick={() => update({ rect: { x: 0, y: 0, w: 1, h: 1 } })}
                  >
                    {ui('Ganze Seite verwenden')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      update({
                        rotation: (item.rotation + 90) % 360,
                        pageWidth: item.pageHeight,
                        pageHeight: item.pageWidth,
                        rect: { x: 0, y: 0, w: 1, h: 1 },
                      })
                    }
                  >
                    <RotateCw size={16} />
                    {ui('Drehen und Zuschnitt zurücksetzen')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={items.length >= 200}
                    onClick={() => {
                      const added = {
                        ...item,
                        id: uid(),
                        label: '',
                        rect: { x: 0, y: 0, w: 1, h: 1 },
                      };
                      const at = items.findIndex((i) => i.id === item.id);
                      change([...items.slice(0, at + 1), added, ...items.slice(at + 1)]);
                      setSelected(added.id);
                    }}
                  >
                    <Plus size={16} />
                    {ui('Weiterer Beleg auf dieser Seite')}
                  </Button>
                </div>
                <div className="everyday-actions">
                  <Button
                    variant="outline"
                    disabled={items[0]?.id === item.id}
                    onClick={() => reorder(-1)}
                  >
                    <ArrowUp size={16} />
                    {ui('Nach vorne')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={items.at(-1)?.id === item.id}
                    onClick={() => reorder(1)}
                  >
                    <ArrowDown size={16} />
                    {ui('Nach hinten')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setRemoved({ item, index: items.findIndex((i) => i.id === item.id) });
                      change(items.filter((i) => i.id !== item.id));
                      setSelected('');
                    }}
                  >
                    <Trash2 size={16} />
                    {ui('Beleg entfernen')}
                  </Button>
                  {removed && (
                    <Button
                      variant="outline"
                      disabled={items.length >= 200}
                      onClick={() => {
                        const next = [...items];
                        next.splice(removed.index, 0, removed.item);
                        change(next);
                        setRemoved(null);
                      }}
                    >
                      {ui('Letzten Beleg wiederherstellen')}
                    </Button>
                  )}
                </div>
              </section>
            </div>
          )}
          <section className="advanced-card">
            <div className="everyday-row">
              <NumberField
                label="Seitenrand (mm)"
                value={options.margin}
                min={5}
                max={25}
                onChange={(margin) => {
                  invalidate();
                  setOptions({ ...options, margin });
                }}
              />
              <NumberField
                label="Abstand (mm)"
                value={options.gap}
                min={2}
                max={20}
                onChange={(gap) => {
                  invalidate();
                  setOptions({ ...options, gap });
                }}
              />
              <Tick
                label="Belege nummerieren"
                value={options.numbers}
                onChange={(numbers) => {
                  invalidate();
                  setOptions({ ...options, numbers });
                }}
              />
            </div>
            {layoutError && (
              <p className="error-box" role="alert">
                {ui(layoutError)}
              </p>
            )}
            {stage === 'preview' && layout && (
              <>
                <Choice
                  label="A4-Seite"
                  value={String(currentSheet)}
                  onChange={(v) => setSheet(Number(v))}
                  translateItems={false}
                  items={Array.from({ length: layout.sheets }, (_, i) => [
                    String(i),
                    `${ui('Seite')} ${i + 1} / ${layout.sheets}`,
                  ])}
                />
                <div className="receipt-sheet" aria-label={ui('A4-Druckvorschau')}>
                  {layout.placements
                    .filter((p) => p.sheet === currentSheet)
                    .map((p) => {
                      const receipt = items.find((i) => i.id === p.itemId)!,
                        src = sources.find((s) => s.id === receipt.sourceId)!;
                      return (
                        <div
                          key={`${p.itemId}:${p.part}`}
                          className="receipt-placement"
                          style={{
                            left: `${(p.x / 210) * 100}%`,
                            top: `${(p.y / 297) * 100}%`,
                            width: `${(p.width / 210) * 100}%`,
                            height: `${(p.height / 297) * 100}%`,
                          }}
                        >
                          <div className="receipt-crop">
                            <div
                              className="receipt-source"
                              style={{
                                width: `${100 / p.rect.w}%`,
                                height: `${100 / p.rect.h}%`,
                                left: `${(-p.rect.x / p.rect.w) * 100}%`,
                                top: `${(-p.rect.y / p.rect.h) * 100}%`,
                              }}
                            >
                              <PagePreview
                                source={src}
                                page={{
                                  id: receipt.id,
                                  sourceId: src.id,
                                  index: receipt.page,
                                  rotation: receipt.rotation,
                                  selected: true,
                                }}
                                resolution={1400}
                              />
                            </div>
                          </div>
                          {p.caption && <span className="receipt-caption">{p.caption}</span>}
                        </div>
                      );
                    })}
                </div>
                <p>
                  {ui(
                    'Die Vorschau zeigt Reihenfolge und Druckgröße. Prüfe die erzeugte PDF vor dem Drucken. Wähle im Druckdialog 100 % / Tatsächliche Größe.',
                  )}
                </p>
              </>
            )}
            <p>
              {ui(
                'Ausgabe als zugeschnittene Seitenbilder. Suchtext, Links, Formularfelder, Anhänge und Signaturen der Originale werden nicht übernommen.',
              )}
            </p>
            <Button
              disabled={busy || !layout}
              onClick={() => void run((ctx) => exportReceipts(sources, items, options, ctx))}
            >
              {ui('Belege als A4-PDF erstellen')}
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
