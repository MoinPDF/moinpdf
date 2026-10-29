'use client';
import { useToolDraftState } from './workspace-drafts';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_BYTES, filenameStem, type Source } from '@/lib/pdf-engine';
import type { RunContext, ExportFile } from '@/lib/advanced-types';
import { repairFile } from '@/lib/pdf-recovery';
import { exportReading, type ReadingFormat } from '@/lib/reading-export';
import { Choice, Text, type PanelProps } from './advanced-shared';

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
  const [title, setTitle] = useToolDraftState(
      'ReadingPanel.title:' + source.id + '',
      filenameStem(source.name),
    ),
    [language, setLanguage] = useToolDraftState('ReadingPanel.language:' + source.id + '', 'de');
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

export { ScanSplitPanel } from './scan-photo-panel';
