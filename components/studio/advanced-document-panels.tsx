'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  readLinks,
  saveLinks,
  readAttachments,
  saveAttachments,
  coverToc,
  mergeFormData,
  type LinkDraft,
  type AttachmentDraft,
} from '@/lib/advanced-documents';
import { readDocumentDraft, type FormField } from '@/lib/document-tools';
import { uid, formatSize, downloadBlob } from '@/lib/pdf-engine';
import { parseDelimited } from '@/lib/table-data';
import {
  Field,
  Text,
  Choice,
  Tick,
  NumberField,
  PageSelect,
  PageStage,
  RectFields,
  EditTable,
  type PanelProps,
} from './advanced-shared';

export function LinksPanel({ source, busy, run }: PanelProps) {
  const [links, setLinks] = useState<LinkDraft[]>([]),
    [loaded, setLoaded] = useState(false),
    [selected, setSelected] = useState(''),
    [page, setPage] = useState(0);
  const link = links.find((l) => l.id === selected && !l.deleted),
    patch = (values: Partial<LinkDraft>) =>
      setLinks(links.map((l) => (l.id === selected ? { ...l, ...values } : l)));
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <Button
          variant="outline"
          disabled={busy || loaded}
          onClick={() =>
            run(async (c) => {
              const list = await readLinks(source, c);
              setLinks(list);
              setLoaded(true);
              setSelected(list[0]?.id || '');
              if (list[0]) setPage(list[0].page);
            })
          }
        >
          Vorhandene Links laden
        </Button>
        {loaded && (
          <>
            <p>{links.filter((l) => !l.deleted).length} Links</p>
            <div className="advanced-hit-list">
              {links
                .filter((l) => !l.deleted)
                .map((l) => (
                  <button
                    className={`link-list-item ${l.id === selected ? 'is-selected' : ''}`}
                    key={l.id}
                    onClick={() => {
                      setSelected(l.id);
                      setPage(l.page);
                    }}
                  >
                    Seite {l.page + 1} · {l.kind === 'page' ? '→ Seite ' : ''}
                    {l.target}
                  </button>
                ))}
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const id = uid();
                setLinks([
                  ...links,
                  {
                    id,
                    page,
                    rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.05 },
                    kind: 'url',
                    target: 'https://',
                  },
                ]);
                setSelected(id);
              }}
            >
              Link hinzufügen
            </Button>
            {link && (
              <>
                {link.kind === 'unsupported' ? (
                  <p className="fine-note">
                    Diese Spezialaktion bleibt erhalten. Du kannst sie bei Bedarf entfernen.
                  </p>
                ) : (
                  <>
                    <Choice
                      label="Verweist auf"
                      value={link.kind}
                      onChange={(v) =>
                        patch({
                          kind: v as 'page' | 'url',
                          target: v === 'page' ? '1' : 'https://',
                        })
                      }
                      items={[
                        ['url', 'Webseite, E-Mail oder Telefonnummer'],
                        ['page', 'Seite dieser PDF'],
                      ]}
                    />
                    <Text
                      label={link.kind === 'page' ? 'Zielseite' : 'Linkziel'}
                      value={link.target}
                      onChange={(target) => patch({ target })}
                    />
                    <RectFields rect={link.rect} onChange={(rect) => patch({ rect })} />
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    patch({ deleted: true });
                    setSelected('');
                  }}
                >
                  Diesen Link entfernen
                </Button>
              </>
            )}
            <Button disabled={busy} onClick={() => run((c) => saveLinks(source, links, c))}>
              PDF mit Links speichern
            </Button>
          </>
        )}
      </section>
      <section>
        <PageSelect source={source} page={page} onChange={setPage} />
        <PageStage
          source={source}
          page={page}
          rects={links
            .filter((l) => l.page === page && !l.deleted)
            .map((l) => ({ ...l.rect, label: l.id === selected ? 'Ausgewählt' : undefined }))}
          onRect={link && link.kind !== 'unsupported' ? (rect) => patch({ rect, page }) : undefined}
        />
      </section>
    </div>
  );
}
export function AttachmentsPanel({ source, busy, run }: PanelProps) {
  const [items, setItems] = useState<AttachmentDraft[]>([]),
    [loaded, setLoaded] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    replace = useRef<string | null>(null);
  return (
    <section className="advanced-card">
      <h2>Dateien innerhalb der PDF</h2>
      <p className="fine-note">
        Änderungen an Rechnungs-XML können eine E-Rechnung ungültig machen. Eine vorhandene digitale
        Signatur wird durch das Bearbeiten der PDF ungültig.
      </p>
      <Button
        disabled={busy || loaded}
        variant="outline"
        onClick={() =>
          run(async () => {
            setItems(await readAttachments(source));
            setLoaded(true);
          })
        }
      >
        Anhänge laden
      </Button>
      <input
        ref={input}
        type="file"
        multiple={!replace.current}
        className="sr-only"
        aria-label="Anhang auswählen"
        onChange={(e) => {
          const files = Array.from(e.target.files || []),
            replacement = replace.current;
          replace.current = null;
          e.target.value = '';
          if (files.length)
            void run(async () => {
              if (files.reduce((n, f) => n + f.size, 0) > 80 * 1024 * 1024)
                throw new Error('Anhänge dürfen zusammen höchstens 80 MB groß sein.');
              const incoming: AttachmentDraft[] = [];
              for (const file of replacement ? files.slice(0, 1) : files)
                incoming.push({
                  id: 'new-' + uid(),
                  name: file.name,
                  size: file.size,
                  bytes: new Uint8Array(await file.arrayBuffer()),
                });
              if (replacement) {
                const original = items.find((a) => a.id === replacement)!;
                setItems(
                  items.map((a) =>
                    a.id === replacement
                      ? { ...incoming[0], originalKey: original.originalKey }
                      : a,
                  ),
                );
              } else setItems([...items, ...incoming]);
            });
        }}
      />
      {loaded && (
        <>
          <p>{items.filter((a) => !a.deleted).length} Anhänge</p>
          {items
            .filter((a) => !a.deleted)
            .map((item) => (
              <div className="attachment-row" key={item.id}>
                <Text
                  label="Dateiname des Anhangs"
                  value={item.name}
                  onChange={(name) =>
                    setItems(items.map((a) => (a.id === item.id ? { ...a, name } : a)))
                  }
                />
                <small>{formatSize(item.size)}</small>
                <div className="advanced-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!item.bytes}
                    onClick={() =>
                      item.bytes && downloadBlob(new Blob([new Uint8Array(item.bytes)]), item.name)
                    }
                  >
                    Herunterladen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      replace.current = item.id;
                      if (input.current) input.current.multiple = false;
                      input.current?.click();
                    }}
                  >
                    Ersetzen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setItems(items.map((a) => (a.id === item.id ? { ...a, deleted: true } : a)))
                    }
                  >
                    Entfernen
                  </Button>
                </div>
              </div>
            ))}
          <div className="advanced-actions">
            <Button
              variant="outline"
              onClick={() => {
                replace.current = null;
                if (input.current) input.current.multiple = true;
                input.current?.click();
              }}
            >
              Anhänge hinzufügen
            </Button>
            <Button disabled={busy} onClick={() => run((c) => saveAttachments(source, items, c))}>
              PDF mit diesen Anhängen speichern
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
export function CoverPanel({ source, busy, run }: PanelProps) {
  const [title, setTitle] = useState(source.name.replace(/\.pdf$/i, '')),
    [subtitle, setSubtitle] = useState(''),
    [cover, setCover] = useState(true),
    [entries, setEntries] = useState('Dokument | 1');
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <Text label="Dokumenttitel" value={title} onChange={setTitle} />
        <Text label="Untertitel" value={subtitle} onChange={setSubtitle} />
        <Tick label="Zusätzlich ein Deckblatt einfügen" value={cover} onChange={setCover} />
        <Field label="Verzeichnis: Titel | Originalseite">
          <textarea
            aria-label="Verzeichnis: Titel | Originalseite"
            value={entries}
            onChange={(e) => setEntries(e.target.value)}
            rows={10}
          />
        </Field>
        <p className="fine-note">
          Ein Eintrag pro Zeile, zum Beispiel „Anhang | 5“. Die neuen Seitenzahlen werden
          automatisch berechnet. Verzeichniszeilen und Lesezeichen sind anklickbar.
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async (c) => {
              const draft = await readDocumentDraft(source, c.signal),
                items = draft.bookmarks.filter((b) => b.page !== null);
              if (!items.length) throw new Error('Keine Lesezeichen mit Zielseiten vorhanden.');
              setEntries(items.map((b) => `${b.title} | ${b.page! + 1}`).join('\n'));
            })
          }
        >
          Vorhandene Lesezeichen übernehmen
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            run((c) => {
              const items = entries
                .split(/\n/)
                .filter((l) => l.trim())
                .map((line) => {
                  const at = line.lastIndexOf('|');
                  if (at < 0)
                    throw new Error('Bitte jeden Titel mit | von der Originalseite trennen.');
                  return {
                    title: line.slice(0, at).trim(),
                    page: Number(line.slice(at + 1).trim()),
                  };
                });
              return coverToc(source, title, subtitle, items, cover, c);
            })
          }
        >
          Deckblatt und Verzeichnis erstellen
        </Button>
      </section>
      <PageStage source={source} />
    </div>
  );
}
export function MailMergePanel({ source, busy, run }: PanelProps) {
  const [rows, setRows] = useState<string[][]>([]),
    [fields, setFields] = useState<FormField[]>([]),
    [mapping, setMapping] = useState<Record<string, number>>({}),
    [nameColumn, setNameColumn] = useState(-1),
    [flatten, setFlatten] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="advanced-grid">
        <section className="advanced-card">
          <h2>Ein Formular, viele Empfänger</h2>
          <p>
            CSV oder TSV mit Kopfzeile auswählen und die Spalten deinen PDF-Feldern zuordnen.
            Maximal 500 Datensätze.
          </p>
          <input
            ref={input}
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file)
                void run(async (c) => {
                  if (file.size > 5_000_000) throw new Error('CSV: maximal 5 MB.');
                  const data = parseDelimited(
                    await file.text(),
                    file.name.endsWith('.tsv') ? '\t' : undefined,
                  );
                  if (data.length < 2 || data.length > 501)
                    throw new Error('Kopfzeile und 1 bis 500 Datensätze erforderlich.');
                  const draft = await readDocumentDraft(source, c.signal),
                    editable = draft.fields.filter((f) => !f.readOnly && f.kind !== 'unsupported');
                  if (!editable.length)
                    throw new Error('Diese PDF hat keine beschreibbaren Formularfelder.');
                  setRows(data);
                  setFields(editable);
                  const match: Record<string, number> = {};
                  for (const f of editable) {
                    const i = data[0].findIndex(
                      (h) => h.trim().toLowerCase() === f.name.toLowerCase(),
                    );
                    if (i >= 0) match[f.name] = i;
                  }
                  setMapping(match);
                  setNameColumn(-1);
                });
            }}
          />
          <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            Tabelle auswählen
          </Button>
          {!!rows.length && (
            <>
              <Choice
                label="Dateiname aus Spalte"
                value={String(nameColumn)}
                onChange={(v) => setNameColumn(Number(v))}
                items={[
                  ['-1', 'Fortlaufend nummerieren'],
                  ...rows[0].map((s, i) => [String(i), s || `Spalte ${i + 1}`] as [string, string]),
                ]}
              />
              {fields.map((f) => (
                <Choice
                  key={f.id}
                  label={`${f.name} (${f.kind})`}
                  value={String(mapping[f.name] ?? -1)}
                  onChange={(v) => setMapping({ ...mapping, [f.name]: Number(v) })}
                  items={[
                    ['-1', 'Nicht zuordnen'],
                    ...rows[0].map(
                      (s, i) => [String(i), s || `Spalte ${i + 1}`] as [string, string],
                    ),
                  ]}
                />
              ))}
              <Tick label="Ausgefüllte Felder fixieren" value={flatten} onChange={setFlatten} />
              <p className="fine-note">
                Checkboxen: ja/nein, 1/0 oder x. Mehrfachauswahl: Werte mit | trennen. Unterstützt
                werden gewöhnliche PDF-Formulare, keine XFA-Formulare.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  run((c) =>
                    mergeFormData(
                      source,
                      rows,
                      Object.fromEntries(Object.entries(mapping).filter(([, v]) => v >= 0)),
                      nameColumn,
                      flatten,
                      c,
                    ),
                  )
                }
              >
                {rows.length - 1} Formulare als ZIP erstellen
              </Button>
            </>
          )}
        </section>
        <PageStage source={source} />
      </div>
      {!!rows.length && (
        <section className="advanced-card">
          <h2>Datensätze prüfen und korrigieren</h2>
          <EditTable rows={rows} onChange={setRows} />
        </section>
      )}
    </>
  );
}
