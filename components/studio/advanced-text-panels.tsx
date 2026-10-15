'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/pdf-engine';
import {
  suggestNames,
  renamedZip,
  planSplit,
  saveSplit,
  textTargets,
  findRedactions,
  redactHits,
  type SplitPart,
  type RedactionHit,
} from '@/lib/advanced-text';
import { makeXlsx, csvText, tableFromTargets } from '@/lib/table-data';
import type { TextTarget } from '@/lib/editor-model';
import type { Rect } from '@/lib/studio-engine';
import {
  Field,
  Text,
  Choice,
  Tick,
  PageSelect,
  PageStage,
  RectFields,
  EditTable,
  type PanelProps,
} from './advanced-shared';

export function RenamePanel({ sources, busy, run }: PanelProps) {
  useLanguage();
  const [template, setTemplate] = useState('{datum}_{nummer}_{titel}'),
    [rows, setRows] = useState<Awaited<ReturnType<typeof suggestNames>>>([]);
  return (
    <section className="advanced-card">
      <Text
        label={ui('Namensmuster')}
        value={template}
        onChange={(v) => {
          setTemplate(v);
          setRows([]);
        }}
      />
      <p className="fine-note">
        {ui('Platzhalter: ')}
        {ui('{datum}')}, {ui('{nummer}')}, {ui('{titel}')}
        {ui('. Ausgelesen werden die ersten drei Seiten. Für Scans zuerst OCR verwenden.')}
      </p>
      <Button
        disabled={busy}
        onClick={() =>
          run(async (c) => {
            setRows(await suggestNames(sources, template, c));
          })
        }
      >
        {ui('Namen vorschlagen')}
      </Button>
      {rows.map((r, i) => (
        <div className="rename-row" key={r.id}>
          <span>
            {sources[i].name}
            {!r.hasText && <small>{ui('Kein auslesbarer Text · Dateiname übernommen')}</small>}
          </span>
          <Text
            label={ui(`Neuer Name ${i + 1}`)}
            value={r.name}
            onChange={(v) =>
              setRows(rows.map((item, n) => (n === i ? { ...item, name: v } : item)))
            }
          />
        </div>
      ))}
      {!!rows.length && (
        <Button
          disabled={busy}
          onClick={() =>
            run(() =>
              renamedZip(
                sources,
                rows.map((r) => r.name),
              ),
            )
          }
        >
          {ui('PDFs mit diesen Namen als ZIP speichern')}
        </Button>
      )}
    </section>
  );
}
export function SplitPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [mode, setMode] = useState<'text' | 'bookmarks' | 'blank' | 'qr'>('text'),
    [query, setQuery] = useState('Rechnung'),
    [exclude, setExclude] = useState(true),
    [parts, setParts] = useState<SplitPart[]>([]),
    [page, setPage] = useState(0);
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <Choice
          label={ui('Trennen nach')}
          value={mode}
          onChange={(v) => {
            setMode(v as typeof mode);
            setParts([]);
          }}
          items={[
            ['text', 'Text auf der ersten Abschnittsseite'],
            ['bookmarks', 'Lesezeichen der ersten Ebene'],
            ['blank', 'Leeren Trennseiten'],
            ['qr', 'QR-/Barcode-Trennseiten'],
          ]}
        />
        {(mode === 'text' || mode === 'qr') && (
          <Text
            label={mode === 'text' ? ui('Trenntext') : ui('Code enthält (leer = jeder Code)')}
            value={query}
            onChange={(v) => {
              setQuery(v);
              setParts([]);
            }}
          />
        )}
        {(mode === 'blank' || mode === 'qr') && (
          <Tick
            label={ui('Trennseiten aus der Ausgabe entfernen')}
            value={exclude}
            onChange={(v) => {
              setExclude(v);
              setParts([]);
            }}
          />
        )}
        <p className="fine-note">
          {ui(
            'Die Vorschau zeigt die Originalseiten jedes Abschnitts. Textsuche benötigt auslesbaren Text; Erkennungen bitte kontrollieren.',
          )}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            run(async (c) => {
              setParts(await planSplit(source, mode, query, exclude, c));
            })
          }
        >
          {ui('Trennstellen suchen')}
        </Button>
        {parts.map((p, i) => (
          <div className="advanced-list-row" key={i}>
            <Text
              label={ui(`Abschnitt ${i + 1}`)}
              value={p.name}
              onChange={(v) =>
                setParts(parts.map((part, n) => (n === i ? { ...part, name: v } : part)))
              }
            />
            <button className="advanced-text-button" onClick={() => setPage(p.pages[0])}>
              {ui('Seiten ')}
              {p.pages.map((n) => n + 1).join(', ')}
            </button>
          </div>
        ))}
        {!!parts.length && (
          <Button disabled={busy} onClick={() => run((c) => saveSplit(source, parts, c))}>
            {ui('Diese Abschnitte als ZIP erstellen')}
          </Button>
        )}
      </section>
      <section>
        <PageSelect source={source} page={page} onChange={setPage} />
        <PageStage source={source} page={page} />
      </section>
    </div>
  );
}
export function TablePanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [page, setPage] = useState(0),
    [area, setArea] = useState<Rect>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 }),
    [boundaries, setBoundaries] = useState('35, 65'),
    [ocr, setOcr] = useState(false),
    [targets, setTargets] = useState<TextTarget[]>([]),
    [rows, setRows] = useState<string[][]>([]);
  const split = (t: TextTarget[], r = area, b = boundaries) => {
    const edges = b
      .split(/[;,\s]+/)
      .filter(Boolean)
      .map(Number);
    if (edges.some((n) => !Number.isFinite(n) || n < 0 || n > 100))
      throw new Error('Spaltengrenzen als Prozentwerte von 0 bis 100 eingeben.');
    setRows(
      tableFromTargets(
        t,
        r,
        edges.map((n) => n / 100),
      ),
    );
  };
  return (
    <>
      <div className="advanced-grid">
        <section className="advanced-card">
          <PageSelect
            source={source}
            page={page}
            onChange={(v) => {
              setPage(v);
              setTargets([]);
              setRows([]);
            }}
          />
          <Tick
            label={ui('OCR verwenden (Scans oder gedrehte Texte)')}
            value={ocr}
            onChange={setOcr}
          />
          <RectFields
            rect={area}
            onChange={(v) => {
              setArea(v);
              setRows([]);
            }}
          />
          <Text
            label={ui('Spaltengrenzen ab linkem Seitenrand (%)')}
            value={boundaries}
            onChange={(v) => {
              setBoundaries(v);
              setRows([]);
            }}
          />
          <p className="fine-note">
            {ui(
              'Beispiel: 35, 65 ergibt drei Spalten. Erkennung arbeitet seitenweise. Werte und Spalten vor dem Export korrigieren.',
            )}
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              run(async (c) => {
                const t = await textTargets(source, page, ocr, c);
                setTargets(t);
                split(t);
                if (!t.length)
                  throw new Error('Kein Text gefunden. Für einen Scan bitte OCR aktivieren.');
              })
            }
          >
            {ui('Tabelle erkennen')}
          </Button>
          {!!targets.length && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => run(async () => split(targets))}
            >
              {ui('Spalten neu aufteilen')}
            </Button>
          )}
        </section>
        <PageStage
          source={source}
          page={page}
          rects={[area]}
          onRect={(v) => {
            setArea(v);
            setRows([]);
          }}
        />
      </div>
      {!!rows.length && (
        <section className="advanced-card">
          <h2>{ui('Werte korrigieren')}</h2>
          <EditTable rows={rows} onChange={setRows} />
          <div className="advanced-actions">
            <Button
              variant="outline"
              onClick={() =>
                setRows([...rows, Array.from({ length: rows[0]?.length || 1 }, () => '')])
              }
            >
              {ui('Zeile hinzufügen')}
            </Button>
            <Button variant="outline" onClick={() => setRows(rows.map((r) => [...r, '']))}>
              {ui('Spalte hinzufügen')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRows(rows.map((r) => r.slice(0, -1)))}
              disabled={(rows[0]?.length || 0) <= 1}
            >
              {ui('Letzte Spalte entfernen')}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => ({
                  blob: await makeXlsx(rows, ui('Tabelle')),
                  filename: 'PDF-Tabelle.xlsx',
                  kind: 'data',
                  pages: 1,
                }))
              }
            >
              {ui('Excel-Datei erstellen')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }),
                  'PDF-Tabelle.csv',
                )
              }
            >
              {ui('CSV herunterladen')}
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
export function RedactPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [terms, setTerms] = useState(''),
    [email, setEmail] = useState(true),
    [iban, setIban] = useState(true),
    [ocr, setOcr] = useState(false),
    [hits, setHits] = useState<RedactionHit[]>([]),
    [page, setPage] = useState(0),
    [review, setReview] = useState(false),
    [searched, setSearched] = useState(false);
  const reset = () => {
    setHits([]);
    setReview(false);
    setSearched(false);
  };
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <Field label={ui('Namen oder Suchbegriffe (eine Zeile pro Begriff)')}>
          <textarea
            aria-label={ui('Namen oder Suchbegriffe')}
            value={terms}
            rows={4}
            onChange={(e) => {
              setTerms(e.target.value);
              reset();
            }}
          />
        </Field>
        <Tick
          label={ui('E-Mail-Adressen erkennen')}
          value={email}
          onChange={(v) => {
            setEmail(v);
            reset();
          }}
        />
        <Tick
          label={ui('Mögliche IBANs erkennen')}
          value={iban}
          onChange={(v) => {
            setIban(v);
            reset();
          }}
        />
        <Tick
          label={ui('Alle Seiten mit OCR durchsuchen')}
          value={ocr}
          onChange={(v) => {
            setOcr(v);
            reset();
          }}
        />
        <p className="fine-note">
          {ui(
            'Text- und OCR-Erkennung können Treffer übersehen. Es werden ganze Textblöcke bzw. OCR-Wörter geschwärzt. Namen als Suchbegriffe eingeben.',
          )}
        </p>
        <Button
          disabled={busy || (!terms.trim() && !email && !iban)}
          onClick={() =>
            run(async (c) => {
              setHits(await findRedactions(source, terms, email, iban, ocr, c));
              setReview(false);
              setSearched(true);
            })
          }
        >
          {ui('Fundstellen suchen')}
        </Button>
        {searched && (
          <p role="status">
            {hits.length} {ui(' Fundstellen · ')}
            {hits.filter((h) => h.selected).length} {ui(' ausgewählt')}
          </p>
        )}
        <div className="advanced-hit-list">
          {hits.map((hit) => (
            <div className="advanced-hit" key={hit.id}>
              <Tick
                label={ui(`Seite ${hit.page + 1}: ${hit.text}`)}
                value={hit.selected}
                onChange={(v) => {
                  setHits(hits.map((h) => (h.id === hit.id ? { ...h, selected: v } : h)));
                  setReview(false);
                }}
              />
              <button className="advanced-text-button" onClick={() => setPage(hit.page)}>
                {ui('Ansehen')}
              </button>
            </div>
          ))}
        </div>
        {hits.some((h) => h.selected) && (
          <>
            <Tick
              label={ui('Ich habe die ausgewählten Bereiche in der Vorschau kontrolliert.')}
              value={review}
              onChange={setReview}
            />
            <Button
              disabled={busy || !review}
              onClick={() => run((c) => redactHits(source, hits, c))}
            >
              {ui('Ausgewählte Fundstellen schwärzen')}
            </Button>
            <p className="fine-note">
              {ui(
                'Die Ausgabe wird vollständig als Seitenbilder neu aufgebaut; Textschichten, Anhänge und Formulare werden entfernt.',
              )}
            </p>
          </>
        )}
      </section>
      <section>
        <PageSelect source={source} page={page} onChange={setPage} />
        <PageStage
          source={source}
          page={page}
          rects={hits.filter((h) => h.page === page && h.selected).flatMap((h) => h.rects)}
        />
      </section>
    </div>
  );
}
