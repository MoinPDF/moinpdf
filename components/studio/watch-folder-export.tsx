'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Text, Choice, type PanelProps } from './advanced-shared';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import { watchFolderWorkflow, type SavedWorkflow } from '@/lib/advanced-pipeline';
export function WatchFolderExport({
  workflow,
  run,
  busy,
}: { workflow: () => SavedWorkflow } & Pick<PanelProps, 'run' | 'busy'>) {
  useLanguage();
  const [mode, setMode] = useState('none'),
    [separator, setSeparator] = useState(''),
    [filename, setFilename] = useState('{original}-{part}'),
    [routes, setRoutes] = useState<{ contains: string; folder: string }[]>([]);
  return (
    <details>
      <summary>{ui('Eingangsordner: OCR, Trennung und Ablage')}</summary>
      <p>
        {ui(
          'Der eigene Dokumentenserver führt die oben eingestellten Schritte und Bedingungen aus. Für Textbedingungen auf Scans OCR als ersten Schritt anlegen.',
        )}
      </p>
      <Choice
        label="Sammeldateien trennen"
        value={mode}
        onChange={setMode}
        items={[
          ['none', 'Nicht trennen'],
          ['page', 'Jede Seite einzeln'],
          ['text', 'Neues Dokument bei Suchtext'],
        ]}
      />
      {mode === 'text' && (
        <Text
          label="Suchtext auf der ersten Dokumentseite"
          value={separator}
          onChange={setSeparator}
        />
      )}
      <Text label="Dateinamensmuster" value={filename} onChange={setFilename} />
      <p className="fine-note">
        {ui(
          'Platzhalter: {original}, {date}, {part}, {invoice}. Ein eindeutiger Zusatz verhindert Überschreiben. Ohne eindeutigen Treffer erfolgt die Ablage in Unsortiert oder Pruefen.',
        )}
      </p>
      {routes.map((r, i) => (
        <article className="evidence-finding" key={i}>
          <Text
            label="Wenn Dokumenttext enthält"
            value={r.contains}
            onChange={(contains) =>
              setRoutes(routes.map((v, n) => (n === i ? { ...v, contains } : v)))
            }
          />
          <Text
            label="Zielordner (Buchstaben, Zahlen, _ oder -)"
            value={r.folder}
            onChange={(folder) => setRoutes(routes.map((v, n) => (n === i ? { ...v, folder } : v)))}
          />
          <Button variant="ghost" onClick={() => setRoutes(routes.filter((_, n) => n !== i))}>
            {ui('Regel entfernen')}
          </Button>
        </article>
      ))}
      <Button
        variant="outline"
        disabled={routes.length >= 20}
        onClick={() => setRoutes([...routes, { contains: '', folder: '' }])}
      >
        {ui('Sortierregel hinzufügen')}
      </Button>
      <Button
        disabled={busy}
        onClick={() =>
          run(async () => {
            const value = watchFolderWorkflow(workflow());
            if (
              routes.some(
                (r) =>
                  !r.contains.trim() ||
                  r.contains.length > 200 ||
                  !/^[A-Za-z0-9_-]{1,64}$/.test(r.folder),
              ) ||
              (mode === 'text' && !separator.trim()) ||
              separator.length > 200 ||
              !filename ||
              filename.length > 120 ||
              /[<>:"/\\|?*\x00-\x1f]/.test(filename) ||
              filename.includes('..') ||
              /[{}]/.test(filename.replace(/\{(?:original|date|part|invoice)\}/g, ''))
            )
              throw new Error('Bitte Suchtexte, Ordnernamen und Dateinamensmuster prüfen.');
            return {
              blob: new Blob(
                [
                  JSON.stringify(
                    { ...value, version: 2, split: { mode, text: separator }, routes, filename },
                    null,
                    2,
                  ),
                ],
                { type: 'application/json' },
              ),
              filename: 'workflow.json',
              kind: 'data',
              pages: 0,
              note: ui(
                'workflow.json im Profilordner des Dokumentenservers speichern. PDFs in dessen inbox ablegen. Originale bleiben erhalten; Ergebnisse und Auftragsbericht werden separat gespeichert.',
              ),
            };
          })
        }
      >
        {ui('Für Eingangsordner exportieren')}
      </Button>
    </details>
  );
}
