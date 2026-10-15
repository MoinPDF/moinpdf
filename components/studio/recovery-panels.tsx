'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_BYTES, filenameStem, type Source } from '@/lib/pdf-engine';
import type { RunContext, ExportFile } from '@/lib/advanced-types';
import { repairFile } from '@/lib/pdf-recovery';
import { exportReading, type ReadingFormat } from '@/lib/reading-export';
import {
  exportScanRegions,
  proposeScanRegions,
  validRegion,
  type ScanRegions,
} from '@/lib/scan-split';
import {
  Choice,
  Text,
  PageStage,
  PageSelect,
  NumberField,
  RectFields,
  type PanelProps,
} from './advanced-shared';
import type { Rect } from '@/lib/studio-engine';

export function RepairPanel({
  source,
  busy,
  run,
  initialFile,
}: {
  source?: Source;
  busy: boolean;
  run: (job: (ctx: RunContext) => Promise<ExportFile | void>) => Promise<void>;
  initialFile?: File | null;
}) {
  useLanguage();
  const [file, setFile] = useState<File | null>(initialFile || null),
    [error, setError] = useState('');
  useEffect(() => {
    if (initialFile) setFile(initialFile);
  }, [initialFile]);
  const selected =
    file ||
    (source
      ? new File([new Uint8Array(source.bytes)], source.name, { type: 'application/pdf' })
      : null);
  return (
    <section className="advanced-card">
      <h2>{ui('Beschädigte PDF wieder öffnen')}</h2>
      <p>
        {ui(
          'Eine Datei kann direkt ausgewählt werden, auch wenn sie sich in der normalen Vorschau nicht öffnen lässt.',
        )}
      </p>
      <label className="advanced-field">
        <span>{ui('PDF zur Reparatur')}</span>
        <input
          type="file"
          accept=".pdf,application/pdf"
          aria-label={ui('PDF zur Reparatur')}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (f.size > MAX_BYTES) {
              setError('Bitte höchstens 80 MB auswählen.');
              return;
            }
            setError('');
            setFile(f);
          }}
        />
      </label>
      {selected && <p>{selected.name}</p>}
      {error && (
        <p role="alert" className="error-box">
          {ui(error)}
        </p>
      )}
      <p className="fine-note">
        {ui(
          'Stellt lesbare PDF-Objekte und die Dateistruktur wieder her. Fehlende Inhalte können nicht zurückgeholt werden. Das Ergebnis anschließend auf Vollständigkeit prüfen. Vorhandene digitale Signaturen werden durch das Neuschreiben ungültig.',
        )}
      </p>
      <Button
        disabled={busy || !selected}
        onClick={() => selected && run((ctx) => repairFile(selected, ctx))}
      >
        {ui('Reparatur versuchen')}
      </Button>
    </section>
  );
}

export function ReadingPanel({
  source,
  format,
  run,
  busy,
}: PanelProps & { format: ReadingFormat }) {
  useLanguage();
  const [title, setTitle] = useState(filenameStem(source.name)),
    [language, setLanguage] = useState('de');
  return (
    <section className="advanced-card">
      <Text label={ui('Dokumenttitel')} value={title} onChange={setTitle} />
      <Choice
        label={ui('Dokumentsprache')}
        value={language}
        onChange={setLanguage}
        items={[
          ['de', 'Deutsch'],
          ['en', 'Englisch'],
          ['fr', 'Französisch'],
          ['es', 'Spanisch'],
          ['it', 'Italienisch'],
          ['nl', 'Niederländisch'],
          ['pl', 'Polnisch'],
        ]}
      />
      <p className="fine-note">
        {ui(
          'Lesbare Textausgabe mit erkannten Überschriften und einem Abschnitt pro PDF-Seite. Bilder und das ursprüngliche Tabellen- und Seitenlayout werden nicht übernommen. Reine Scans zuerst mit „OCR & Text“ auslesen und das Ergebnis übernehmen. EPUB ist ein anpassbares E-Book mit Inhaltsverzeichnis.',
        )}
      </p>
      <Button
        disabled={busy}
        onClick={() => run((ctx) => exportReading(source, format, title, language, ctx))}
      >
        {format === 'markdown' ? ui('Markdown') : format === 'html' ? ui('HTML') : ui('EPUB')}{' '}
        {ui(' erstellen')}
      </Button>
    </section>
  );
}

export function ScanSplitPanel({
  source,
  run,
  busy,
  invalidate,
}: PanelProps & { invalidate: () => void }) {
  useLanguage();
  const [page, setPage] = useState(0),
    [regions, setRegions] = useState<ScanRegions>({}),
    [gap, setGap] = useState(3),
    [format, setFormat] = useState<'pdf' | 'png' | 'jpeg'>('pdf'),
    [dpi, setDpi] = useState(150),
    [reviewed, setReviewed] = useState(false);
  const current = regions[page] || [],
    count = Object.values(regions).reduce((n, r) => n + r.length, 0);
  const update = (rects: Rect[]) => {
    invalidate();
    setRegions((old) => ({ ...old, [page]: rects }));
    setReviewed(false);
  };
  const detect = (all: boolean) =>
    run(async (ctx) => {
      const next = { ...regions },
        indices = all ? Array.from({ length: source.pdf.numPages }, (_, i) => i) : [page];
      if (indices.length > 50)
        throw new Error('Bitte für die automatische Erkennung höchstens 50 Seiten verwenden.');
      for (const [i, p] of indices.entries()) {
        next[p] = await proposeScanRegions(source, p, gap, ctx.signal);
        ctx.report({
          percent: ((i + 1) / indices.length) * 100,
          label: `Ausschnitte suchen · Seite ${p + 1}`,
        });
      }
      ctx.signal.throwIfAborted();
      setRegions(next);
      setReviewed(false);
    });
  return (
    <section className="advanced-card">
      <h2>{ui('Mehrere Vorlagen auf einem Scan trennen')}</h2>
      <p>
        {ui(
          'Fotos oder Belege auf hellem Hintergrund automatisch erkennen. Vorschläge auf jeder Seite prüfen, entfernen oder einen eigenen Rahmen aufziehen.',
        )}
      </p>
      <div className="advanced-actions">
        <Button variant="outline" disabled={busy} onClick={() => detect(false)}>
          {ui('Diese Seite erkennen')}
        </Button>
        <Button
          variant="outline"
          disabled={busy || source.pdf.numPages > 50}
          onClick={() => detect(true)}
        >
          {ui('Alle Seiten erkennen')}
        </Button>
      </div>
      <NumberField
        label={ui('Freier Abstand zwischen Vorlagen (%)')}
        value={gap}
        min={1}
        max={12}
        step={0.5}
        onChange={setGap}
      />
      <p className="fine-note">
        {ui(
          'Größere Werte vermeiden das Trennen an Absatzabständen. Bei dunklem Hintergrund, schiefen oder überlappenden Vorlagen eigene Rahmen verwenden.',
        )}
      </p>
      <PageSelect source={source} page={page} onChange={setPage} />
      <PageStage
        source={source}
        page={page}
        rects={current.map((r, i) => ({ ...r, label: String(i + 1) }))}
        onRect={
          busy
            ? undefined
            : (r) => {
                if (count < 200) update([...current, r]);
              }
        }
      />
      {current.map((r, i) => (
        <details key={`${page}-${i}`}>
          <summary>
            {ui('Ausschnitt ')}
            {i + 1}
            {!validRegion(r) ? ui(' · außerhalb der Seite') : ''}
          </summary>
          <RectFields
            rect={r}
            onChange={(next) => update(current.map((old, j) => (i === j ? next : old)))}
          />
          <Button variant="outline" onClick={() => update(current.filter((_, j) => j !== i))}>
            {ui('Ausschnitt entfernen')}
          </Button>
        </details>
      ))}
      <p>
        {count} {ui(' Ausschnitt(e) auf ')}
        {Object.values(regions).filter((r) => r.length).length} {ui(' von')} {source.pdf.numPages}{' '}
        {ui(' Seiten.')}
      </p>
      <Choice
        label={ui('Einzeldateien im ZIP')}
        value={format}
        onChange={(v) => setFormat(v as typeof format)}
        items={[
          ['pdf', 'Eine Bild-PDF je Ausschnitt'],
          ['png', 'PNG-Bilder'],
          ['jpeg', 'JPG-Fotos'],
        ]}
      />
      <Choice
        label={ui('Auflösung')}
        value={String(dpi)}
        onChange={(v) => setDpi(Number(v))}
        items={[
          ['150', '150 dpi · kleinere Dateien'],
          ['300', '300 dpi · höhere Qualität'],
        ]}
      />
      <p className="fine-note">
        {ui(
          'Bei sehr großen Seiten ist die Auflösung auf 4096 Pixel an der längsten Seite begrenzt. Nur markierte Seiten werden exportiert. Die Reihenfolge entspricht den nummerierten Rahmen.',
        )}
      </p>
      <label className="advanced-tick">
        <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
        <span>{ui('Ich habe die Ausschnitte auf allen markierten Seiten geprüft.')}</span>
      </label>
      <Button
        disabled={
          busy ||
          !count ||
          count > 200 ||
          !reviewed ||
          Object.values(regions)
            .flat()
            .some((r) => !validRegion(r))
        }
        onClick={() => run((ctx) => exportScanRegions(source, regions, format, dpi, ctx))}
      >
        {ui('Ausschnitte herunterladen')}
      </Button>
    </section>
  );
}
