'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { formatSize } from '@/lib/pdf-engine';
import type { ExportFile, RunContext } from '@/lib/advanced-types';
import {
  listLargeJobs,
  deleteLargeJob,
  type LargeJob,
  type LargeMode,
} from '@/lib/large-document-store';
import {
  createLargeJob,
  continueLargeJob,
  assembleLargeJob,
  replaceLargeChunk,
  exportLargeChunk,
  validateLargeJob,
} from '@/lib/large-document';
import { Choice } from './advanced-shared';

export function LargeDocumentPanel({
  busy,
  run,
  initialFile,
}: {
  busy: boolean;
  run: (job: (ctx: RunContext) => Promise<ExportFile | void>) => Promise<void>;
  initialFile?: File | null;
}) {
  const [file, setFile] = useState<File | null>(initialFile || null),
    [mode, setMode] = useState<LargeMode>('optimizeLossless'),
    [jobs, setJobs] = useState<LargeJob[]>([]),
    [selected, setSelected] = useState(''),
    [storageError, setStorageError] = useState('');
  const refresh = async () => {
    try {
      const values = await listLargeJobs();
      values.forEach(validateLargeJob);
      setJobs(values.sort((a, b) => b.updated - a.updated));
      setStorageError('');
    } catch {
      setStorageError(
        'Gespeicherte Aufträge konnten nicht gelesen werden. Bitte den lokalen Browserspeicher prüfen.',
      );
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const update = (job: LargeJob) => {
    setSelected(job.id);
    setJobs((previous) => [job, ...previous.filter((j) => j.id !== job.id)]);
  };
  const execute = (job: (ctx: RunContext) => Promise<ExportFile | void>) =>
    run(async (ctx) => {
      try {
        return await job(ctx);
      } finally {
        await refresh();
      }
    });
  const current = jobs.find((j) => j.id === selected),
    done = current?.chunks.at(-1)?.last || 0;
  return (
    <div className="advanced-stack large-document-panel">
      <p className="workbench-notice">
        {ui(
          'Bis 256 MB und 1.000 Seiten. Original und geprüfte Abschnitte bleiben unverschlüsselt in diesem Browser gespeichert, bis du den Auftrag löschst. Für große Dateien empfehlen wir einen Desktop-Browser.',
        )}
      </p>
      <p>
        {ui(
          'Drehen, verlustfrei optimieren oder OCR in Abschnitten mit höchstens 50 Seiten. Einzelne Abschnitte lassen sich anschließend im Editor bearbeiten und wieder einsetzen. Formulare, Signaturen, interne Verweise, Lesezeichen, Anhänge und Struktur-Tags werden vorab abgelehnt.',
        )}
      </p>
      <label className="field-label">
        {ui('Große PDF auswählen')}
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      {file && (
        <p>
          {file.name} · {formatSize(file.size)}
        </p>
      )}
      <Choice
        label={ui('Aktion')}
        value={mode}
        onChange={(value) => setMode(value as LargeMode)}
        items={[
          ['optimizeLossless', 'Verlustfrei optimieren'],
          ['rotate90', 'Alle Seiten um 90° drehen'],
          ['rotate180', 'Alle Seiten um 180° drehen'],
          ['ocr', 'Durchsuchbar machen (OCR)'],
        ]}
      />
      <Button
        disabled={busy || !file}
        onClick={() =>
          void execute(async (ctx) => {
            const job = await createLargeJob(file!, mode, ctx);
            update(job);
            await continueLargeJob(job.id, ctx, update);
          })
        }
      >
        {ui('Lokal sichern und starten')}
      </Button>
      {storageError && (
        <p role="alert" className="error-box">
          {ui(storageError)}
        </p>
      )}
      {jobs.length > 0 && (
        <Choice
          label={ui('Gespeicherter Auftrag')}
          value={selected}
          onChange={setSelected}
          translateItems={false}
          items={[
            ['', ui('Auftrag auswählen')],
            ...jobs.map((j): [string, string] => [
              j.id,
              `${j.name} · ${j.chunks.at(-1)?.last || 0} / ${j.pages}`,
            ]),
          ]}
        />
      )}
      {current && (
        <section className="advanced-stack" aria-label={ui('Auftragsfortschritt')}>
          <p>
            {ui('Geprüfte Seiten')}:{' '}
            <strong>
              {done} / {current.pages}
            </strong>{' '}
            · {ui('Aktion')}:{' '}
            {ui(
              {
                rotate90: 'Alle Seiten um 90° drehen',
                rotate180: 'Alle Seiten um 180° drehen',
                ocr: 'Durchsuchbar machen (OCR)',
                optimizeLossless: 'Verlustfrei optimieren',
              }[current.mode],
            )}
          </p>
          <p>
            {ui(
              'Abbrechen bewahrt die fertig geprüften Abschnitte. Zum Fortsetzen den gespeicherten Auftrag erneut öffnen. Gesamtausgaben werden erst nach Prüfung aller Seiten freigegeben.',
            )}
          </p>
          <div className="advanced-actions">
            <Button
              disabled={busy || done === current.pages}
              onClick={() =>
                void execute(async (ctx) => {
                  await continueLargeJob(current.id, ctx, update);
                })
              }
            >
              {ui('Auftrag fortsetzen')}
            </Button>
            <Button
              disabled={busy || done !== current.pages}
              onClick={() => void execute((ctx) => assembleLargeJob(current.id, ctx))}
            >
              {ui('Gesamtausgabe prüfen und erstellen')}
            </Button>
          </div>
          <details>
            <summary>{ui('Abschnitte herunterladen oder ersetzen')}</summary>
            {current.chunks.map((chunk, index) => (
              <div className="advanced-stack" key={index}>
                <p>
                  {ui('Seiten')} {chunk.first}–{chunk.last} · {formatSize(chunk.size)}{' '}
                  {chunk.replaced && '· ' + ui('Manuell ersetzt')}
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void execute((ctx) => exportLargeChunk(current.id, index, ctx))}
                >
                  {ui('Abschnitt als Ergebnis öffnen')}
                </Button>
                <label className="field-label">
                  {ui('Bearbeiteten Abschnitt einsetzen')}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={busy}
                    onChange={(e) => {
                      const replacement = e.target.files?.[0];
                      e.target.value = '';
                      if (replacement)
                        void execute(async (ctx) => {
                          update(await replaceLargeChunk(current.id, index, replacement, ctx));
                        });
                    }}
                  />
                </label>
              </div>
            ))}
            <p>
              {ui(
                'Ersatzabschnitte müssen dieselbe Seitenzahl haben. Ihre geprüften Inhalte bilden danach die Grundlage der Gesamtausgabe. Dokumentinfos werden nicht übernommen.',
              )}
            </p>
          </details>
          <details>
            <summary>{ui('Auftrag und lokale Dateien löschen')}</summary>
            <p>
              {ui(
                'Original und alle Abschnitte werden aus diesem Browser gelöscht. Bereits heruntergeladene Dateien bleiben erhalten.',
              )}
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void execute(async () => {
                  await deleteLargeJob(current.id);
                  setSelected('');
                })
              }
            >
              {ui('Diesen Auftrag endgültig löschen')}
            </Button>
          </details>
        </section>
      )}
    </div>
  );
}
