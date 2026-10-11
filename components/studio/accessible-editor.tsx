'use client';
import { Button } from '@/components/ui/button';
import { Choice, Text, Field } from './advanced-shared';
import {
  accessibleTextDraft,
  validateAccessibleDocument,
  type AccessibleDocument,
  type AccessibleBlock,
} from '@/lib/accessible-document';
import { downloadBlob, type Source } from '@/lib/pdf-engine';

export const initialAccessibleDocument: AccessibleDocument = {
  title: 'Mein Dokument',
  language: 'de-DE',
  blocks: [{ kind: 'h1', text: 'Mein Dokument' }],
};
export function AccessibleEditor({
  value,
  onChange,
  source,
  run,
}: {
  value: AccessibleDocument;
  onChange: (value: AccessibleDocument) => void;
  source?: Source;
  run: (action: (signal: AbortSignal) => Promise<void>) => Promise<void>;
}) {
  const update = (index: number, block: AccessibleBlock) =>
    onChange({ ...value, blocks: value.blocks.map((b, i) => (i === index ? block : b)) });
  const move = (index: number, delta: number) => {
    const blocks = [...value.blocks];
    [blocks[index], blocks[index + delta]] = [blocks[index + delta], blocks[index]];
    onChange({ ...value, blocks });
  };
  return (
    <div className="accessible-editor">
      <h2>Inhalt und Lesereihenfolge</h2>
      <p>
        Erstellt ein neues Dokument aus diesen Blöcken. Die Reihenfolge unten ist die
        Lesereihenfolge. Das ursprüngliche Seitenlayout, Tabellen, Formulare und Bilder werden beim
        Textimport nicht übernommen. Benötigte Bilder einzeln mit Beschreibung ergänzen.
      </p>
      <Text
        label="Dokumenttitel"
        value={value.title}
        onChange={(title) => onChange({ ...value, title })}
      />
      <Choice
        label="Dokumentsprache"
        value={value.language}
        onChange={(language) =>
          onChange({ ...value, language: language as AccessibleDocument['language'] })
        }
        items={[
          ['de-DE', 'Deutsch'],
          ['en-US', 'Englisch'],
          ['fr-FR', 'Französisch'],
          ['es-ES', 'Spanisch'],
          ['it-IT', 'Italienisch'],
          ['nl-NL', 'Niederländisch'],
          ['pl-PL', 'Polnisch'],
        ]}
      />
      <Button
        variant="outline"
        disabled={!source}
        onClick={() =>
          run(async (signal) => {
            if (!source) return;
            const blocks = await accessibleTextDraft(source, signal);
            if (blocks.length + value.blocks.length > 200)
              throw new Error(
                'Der Import würde 200 Blöcke überschreiten. Vorhandene Blöcke reduzieren.',
              );
            onChange({ ...value, blocks: [...value.blocks, ...blocks] });
          })
        }
      >
        Text der ausgewählten PDF anhängen
      </Button>
      <p className="fine-note">
        Der Import ist ein Entwurf. Spalten, Trennungen, Reihenfolge und Vollständigkeit prüfen und
        Überschriften zuweisen. Für Tabellen und komplexe Formulare das Original in einem geeigneten
        Autorenprogramm bearbeiten.
      </p>
      {value.blocks.map((block, i) => (
        <section className="accessible-block" key={i} aria-label={`Inhaltsblock ${i + 1}`}>
          <strong>Block {i + 1}</strong>
          {block.kind === 'figure' ? (
            <>
              {/* Raster data is selected locally; SVG and external URLs are not accepted. */}
              <img
                src={`data:${block.data.startsWith('iVBOR') ? 'image/png' : 'image/jpeg'};base64,${block.data}`}
                alt={block.alt || 'Ausgewähltes Bild, Beschreibung fehlt'}
              />
              <Field label={`Bildbeschreibung für Block ${i + 1}`}>
                <textarea
                  aria-label={`Bildbeschreibung für Block ${i + 1}`}
                  rows={3}
                  maxLength={2000}
                  value={block.alt}
                  onChange={(e) => update(i, { ...block, alt: e.target.value })}
                />
              </Field>
            </>
          ) : (
            <>
              <Choice
                label={`Rolle für Block ${i + 1}`}
                value={block.kind}
                onChange={(kind) => update(i, { ...block, kind: kind as 'p' | 'h1' | 'h2' | 'h3' })}
                items={[
                  ['p', 'Absatz'],
                  ['h1', 'Überschrift 1'],
                  ['h2', 'Überschrift 2'],
                  ['h3', 'Überschrift 3'],
                ]}
              />
              <Field label={`Text für Block ${i + 1}`}>
                <textarea
                  aria-label={`Text für Block ${i + 1}`}
                  rows={block.kind === 'p' ? 5 : 2}
                  maxLength={10000}
                  value={block.text}
                  onChange={(e) => update(i, { ...block, text: e.target.value })}
                />
              </Field>
            </>
          )}
          <div className="accessible-block-actions">
            <Button
              variant="outline"
              disabled={i === 0}
              aria-label={`Block ${i + 1} nach oben`}
              onClick={() => move(i, -1)}
            >
              Nach oben
            </Button>
            <Button
              variant="outline"
              disabled={i === value.blocks.length - 1}
              aria-label={`Block ${i + 1} nach unten`}
              onClick={() => move(i, 1)}
            >
              Nach unten
            </Button>
            <Button
              variant="outline"
              aria-label={`Block ${i + 1} entfernen`}
              onClick={() => onChange({ ...value, blocks: value.blocks.filter((_, j) => i !== j) })}
            >
              Entfernen
            </Button>
          </div>
        </section>
      ))}
      <Button
        variant="outline"
        disabled={value.blocks.length >= 200}
        onClick={() => onChange({ ...value, blocks: [...value.blocks, { kind: 'p', text: '' }] })}
      >
        Absatz hinzufügen
      </Button>
      <Field label="Bild hinzufügen (PNG/JPEG)">
        <input
          aria-label="Bild hinzufügen (PNG/JPEG)"
          type="file"
          accept="image/png,image/jpeg"
          disabled={value.blocks.length >= 200}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void run(async (signal) => {
              if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 3 * 1024 * 1024)
                throw new Error('Bitte PNG oder JPEG mit höchstens 3 MB auswählen.');
              const image = await createImageBitmap(file);
              try {
                if (image.width * image.height > 4000000)
                  throw new Error('Bitte ein Bild mit höchstens 4 Megapixeln verwenden.');
              } finally {
                image.close();
              }
              const buffer = new Uint8Array(await file.arrayBuffer());
              let binary = '';
              for (let i = 0; i < buffer.length; i += 8192)
                binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
              signal.throwIfAborted();
              if (value.blocks.filter((b) => b.kind === 'figure').length >= 10)
                throw new Error('Höchstens zehn Bilder verwenden.');
              onChange({
                ...value,
                blocks: [...value.blocks, { kind: 'figure', alt: '', data: btoa(binary) }],
              });
            });
          }}
        />
      </Field>
      <Button
        variant="outline"
        onClick={() =>
          run(async () => {
            const document = validateAccessibleDocument(value);
            downloadBlob(
              new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }),
              'MoinPDF-Struktur.json',
            );
          })
        }
      >
        Strukturdatei herunterladen
      </Button>
      <Field label="Strukturdatei öffnen">
        <input
          aria-label="Strukturdatei öffnen"
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file)
              void run(async (signal) => {
                if (file.size > 8 * 1024 * 1024) throw new Error('Strukturdatei größer als 8 MB.');
                const next = validateAccessibleDocument(JSON.parse(await file.text()));
                signal.throwIfAborted();
                onChange(next);
              });
          }}
        />
      </Field>
      <p className="fine-note">
        Ausgabe: A4 mit eingebetteten Schriften, Überschriften-Tags, Absatz-Tags und
        Bildbeschreibungen. Die ZIP-Datei enthält ein PDF nur bei bestandener technischer
        PDF/UA-1-Prüfung, dazu den vollständigen Prüfbericht. Inhalte, Sprache, Alternativtexte und
        Lesereihenfolge zusätzlich selbst kontrollieren.
      </p>
    </div>
  );
}
