'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import { Field, Choice, Tick, NumberField, type PanelProps } from './advanced-shared';
import { ProcessingAvailability } from './growth-panels';
import { integratedDocumentServer } from '@/lib/document-server';
import { runFormatExport } from '@/lib/format-server';
import { textImportDocument, textImportDefaults, type TextImportFormat } from '@/lib/text-import';
import { createWriterPdf } from '@/lib/writer-pdf';
import {
  exportPdfJson,
  importPdfJson,
  exportCbz,
  scanEffect,
  scanEffectDefaults,
  inspectPdfJavaScript,
  exportAiDocuments,
  type ScriptEntry,
} from '@/lib/format-tools';
import { filenameStem, type Source } from '@/lib/pdf-engine';

type ImportProps = Pick<PanelProps, 'busy' | 'run'> & {
  source?: Source;
  initialFile?: File | null;
};
export function TextImportPanel({ busy, run, initialFile }: ImportProps) {
  const { language } = useLanguage();
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [format, setFormat] = useState<TextImportFormat>(
    initialFile?.name.match(/\.(md|markdown)$/i)
      ? 'markdown'
      : initialFile?.name.match(/\.csv$/i)
        ? 'csv'
        : initialFile?.name.match(/\.xml$/i)
          ? 'xml'
          : 'txt',
  );
  const [options, setOptions] = useState(textImportDefaults),
    [encoding, setEncoding] = useState('utf-8');
  return (
    <section className="advanced-card">
      <Field label="Text- oder Datendatei">
        <input
          type="file"
          accept=".md,.markdown,.txt,.csv,.xml,text/plain,text/markdown,text/csv,application/xml"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            if (f)
              setFormat(
                /\.(md|markdown)$/i.test(f.name)
                  ? 'markdown'
                  : /\.csv$/i.test(f.name)
                    ? 'csv'
                    : /\.xml$/i.test(f.name)
                      ? 'xml'
                      : 'txt',
              );
          }}
        />
      </Field>
      {file && <p>{file.name}</p>}
      <Choice
        label="Eingabeformat"
        value={format}
        onChange={(v) => setFormat(v as TextImportFormat)}
        items={[
          ['markdown', 'Markdown'],
          ['txt', 'TXT'],
          ['csv', 'CSV'],
          ['xml', 'XML'],
        ]}
      />
      <Choice
        label="Zeichenkodierung"
        value={encoding}
        onChange={setEncoding}
        items={[
          ['utf-8', 'UTF-8'],
          ['windows-1252', 'Windows-1252'],
          ['utf-16le', 'UTF-16 LE'],
        ]}
      />
      <Choice
        label="Papierformat"
        value={options.paper}
        onChange={(v) => setOptions({ ...options, paper: v as typeof options.paper })}
        items={[
          ['A4', 'A4'],
          ['A5', 'A5'],
          ['LETTER', 'Letter'],
        ]}
      />
      <Tick
        label="Querformat"
        value={options.landscape}
        onChange={(landscape) => setOptions({ ...options, landscape })}
      />
      {format === 'csv' && (
        <>
          <Choice
            label="CSV-Trennzeichen"
            value={options.delimiter}
            onChange={(v) => setOptions({ ...options, delimiter: v as typeof options.delimiter })}
            items={[
              ['auto', 'Automatisch'],
              [';', ';'],
              [',', ','],
              ['\t', 'Tabulator'],
              ['|', '|'],
            ]}
          />
          <Tick
            label="Erste Zeile als Tabellenkopf"
            value={options.header}
            onChange={(header) => setOptions({ ...options, header })}
          />
        </>
      )}
      {format === 'xml' && (
        <Choice
          label="XML-Darstellung"
          value={options.xmlLayout}
          onChange={(v) => setOptions({ ...options, xmlLayout: v as typeof options.xmlLayout })}
          items={[
            ['tree', 'Pfade und Werte'],
            ['table', 'Datensätze als Tabelle'],
          ]}
        />
      )}
      <p className="fine-note">
        {ui(
          'Lokal im Browser. Bis 300.000 Zeichen, Tabellen mit höchstens 12 Spalten und 2.000 Zeilen. Markdown unterstützt Überschriften, Listen, Tabellen und Code; Bilder erscheinen als Alternativtext, HTML als Text. Externe Inhalte werden nicht geladen.',
        )}
      </p>
      <Button
        disabled={busy || !file}
        onClick={() =>
          run(async (ctx) => {
            if (!file || file.size > 2 * 1024 * 1024)
              throw new Error('Bitte eine Textdatei mit höchstens 2 MB auswählen.');
            let input: string;
            try {
              input = new TextDecoder(encoding, { fatal: true }).decode(await file.arrayBuffer());
            } catch {
              throw new Error(
                'Die Zeichenkodierung passt nicht zur Datei. Bitte eine andere Kodierung wählen.',
              );
            }
            const doc = textImportDocument(input, format, file.name, options);
            ctx.signal.throwIfAborted();
            ctx.report({ percent: 30, label: 'PDF erstellen' });
            const blob = await createWriterPdf(doc, language);
            ctx.signal.throwIfAborted();
            return { blob, filename: filenameStem(file.name) + '.pdf', kind: 'pdf', pages: 0 };
          })
        }
      >
        {ui('PDF erstellen')}
      </Button>
    </section>
  );
}
export function PdfJsonPanel({ source, initialFile, busy, run }: ImportProps) {
  useLanguage();
  const [mode, setMode] = useState(initialFile ? 'import' : 'export'),
    [file, setFile] = useState<File | null>(initialFile || null);
  return (
    <section className="advanced-card">
      <Choice
        label="Richtung"
        value={mode}
        onChange={setMode}
        items={[
          ['export', 'PDF zu JSON'],
          ['import', 'JSON zu PDF'],
        ]}
      />
      <p>
        {ui(
          'Vollständige PDF-Objektstruktur im QPDF-JSON-Format 2, einschließlich eingebetteter Stream-Daten. Unterstützt die Rückumwandlung dieses Formats; beliebige JSON-Dateien und Bento-/CPDF-JSON werden nicht unterstützt.',
        )}
      </p>
      <p className="fine-note">
        {ui(
          'Bis 80 MB und 200 PDF-Seiten. Enthält möglicherweise aktive Inhalte. Eine Rückumwandlung bewahrt keine gültigen digitalen Signaturen und ist keine Bereinigung.',
        )}
      </p>
      {mode === 'import' && (
        <>
          <Field label="PDF-JSON-Datei">
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
          {file && <p>{file.name}</p>}
        </>
      )}
      {mode === 'export' && !source && <p>{ui('Bitte zuerst eine PDF öffnen.')}</p>}
      <Button
        disabled={busy || (mode === 'export' ? !source : !file)}
        onClick={() =>
          run((ctx) =>
            mode === 'export' ? exportPdfJson(source!, ctx) : importPdfJson(file!, ctx),
          )
        }
      >
        {ui(mode === 'export' ? 'PDF-Struktur exportieren' : 'PDF wiederherstellen')}
      </Button>
    </section>
  );
}
const dpiItems: [string, string][] = [72, 100, 150, 200, 300].map((v) => [String(v), `${v} dpi`]);
export function ComicPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [format, setFormat] = useState('cbz'),
    [dpi, setDpi] = useState('150'),
    [imageFormat, setImageFormat] = useState('jpg');
  const base = integratedDocumentServer || '',
    token = '';
  return (
    <section className="advanced-card">
      <Choice
        label="Comicformat"
        value={format}
        onChange={setFormat}
        items={[
          ['cbz', 'CBZ (ZIP)'],
          ['cbr', 'CBR (RAR, optional)'],
        ]}
      />
      <Choice label="Auflösung" value={dpi} onChange={setDpi} items={dpiItems} />
      <Choice
        label="Bildformat"
        value={imageFormat}
        onChange={setImageFormat}
        items={[
          ['jpg', 'JPEG'],
          ['png', 'PNG'],
        ]}
      />
      <p className="fine-note">
        {ui(
          'Eine Bilddatei pro Seite in natürlicher Lesereihenfolge. Bis 200 Seiten, 80 MB Bilddaten und 16 Megapixel je Seite. Textsuche und interaktive Elemente werden nicht übernommen.',
        )}
      </p>
      {format === 'cbr' && (
        <>
          <p>
            {ui(
              'CBR ist nur mit eingerichtetem RAR-Konverter verfügbar. Alternativ CBZ auswählen.',
            )}
          </p>
          <ProcessingAvailability />
        </>
      )}
      <Button
        disabled={busy || (format === 'cbr' && (!base || (!integratedDocumentServer && !token)))}
        onClick={() =>
          run((ctx) =>
            format === 'cbz'
              ? exportCbz(source, +dpi, imageFormat as 'png' | 'jpg', ctx)
              : runFormatExport(source, 'cbr', { dpi: +dpi, imageFormat }, base, token, ctx),
          )
        }
      >
        {ui('Comicarchiv erstellen')}
      </Button>
    </section>
  );
}
export function ScanEffectPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [options, setOptions] = useState(scanEffectDefaults);
  return (
    <section className="advanced-card">
      <Choice
        label="Auflösung"
        value={String(options.dpi)}
        onChange={(v) => setOptions({ ...options, dpi: +v })}
        items={dpiItems}
      />
      <NumberField
        label="Bildrauschen"
        value={options.noise}
        min={0}
        max={30}
        onChange={(noise) => setOptions({ ...options, noise })}
      />
      <NumberField
        label="Leichte Drehung (Grad)"
        value={options.angle}
        min={-3}
        max={3}
        step={0.1}
        onChange={(angle) => setOptions({ ...options, angle })}
      />
      <NumberField
        label="Unschärfe (Pixel)"
        value={options.blur}
        min={0}
        max={2}
        step={0.1}
        onChange={(blur) => setOptions({ ...options, blur })}
      />
      <Tick
        label="Graustufen"
        value={options.gray}
        onChange={(gray) => setOptions({ ...options, gray })}
      />
      <p className="fine-note">
        {ui(
          'Erzeugt eine Bild-PDF im Scannerstil. Die Vorschau zeigt die fertige Ausgabe. Textsuche, Links, Formulare, Anhänge und digitale Signaturen werden nicht übernommen.',
        )}
      </p>
      <Button disabled={busy} onClick={() => run((ctx) => scanEffect(source, options, ctx))}>
        {ui('Scannereffekt anwenden')}
      </Button>
    </section>
  );
}
export function JavaScriptPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [scripts, setScripts] = useState<ScriptEntry[] | null>(null);
  return (
    <section className="advanced-card">
      <p>
        {ui(
          'Zeigt JavaScript-Aktionen aus der PDF-Objektstruktur als Text. Skripte werden nicht ausgeführt. Dies ist keine Prüfung der Sicherheit des Dokuments.',
        )}
      </p>
      <Button
        disabled={busy}
        onClick={() =>
          run(async (ctx) => {
            setScripts(null);
            const entries = await inspectPdfJavaScript(source.bytes, ctx.signal);
            ctx.signal.throwIfAborted();
            setScripts(entries);
            return {
              blob: new Blob([JSON.stringify({ file: source.name, scripts: entries }, null, 2)], {
                type: 'application/json',
              }),
              filename: filenameStem(source.name) + '-JavaScript.json',
              pages: 0,
              kind: 'data',
            };
          })
        }
      >
        {ui('JavaScript anzeigen')}
      </Button>
      {scripts?.length === 0 && (
        <p role="status">
          {ui('Keine JavaScript-Einträge in der untersuchten PDF-Objektstruktur gefunden.')}
        </p>
      )}
      {scripts?.map((entry, i) => (
        <details key={i}>
          <summary>{entry.location}</summary>
          {entry.readable ? (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                maxHeight: '24rem',
                overflow: 'auto',
              }}
            >
              {entry.code}
            </pre>
          ) : (
            <p>{ui('Dieser Skripteintrag konnte nicht dekodiert werden.')}</p>
          )}
        </details>
      ))}
    </section>
  );
}
export function AiExportPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  return (
    <section className="advanced-card">
      <p>
        {ui(
          'Exportiert ein LlamaIndex-Dokument je PDF-Seite mit Text, Dateiname und Seitenangaben. Keine KI-Abfrage und kein Upload. Bilder und Tabellenlayout werden nicht übernommen; Scans vorher mit OCR bearbeiten.',
        )}
      </p>
      <Button disabled={busy} onClick={() => run((ctx) => exportAiDocuments(source, ctx))}>
        {ui('LlamaIndex-JSON erstellen')}
      </Button>
    </section>
  );
}
