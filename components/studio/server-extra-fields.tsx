'use client';
import type { ServerTool } from '@/lib/advanced-types';
import { Choice, Field, NumberField } from './advanced-shared';
export type ExtraSettings = {
  confidence: number;
  dpi: number;
  curve: number;
  side: string;
  terms: string;
  language: string;
  target: string;
  targetMB: number;
  optimizeMode: string;
  fontSize: number;
  paper: string;
};
export const initialExtraSettings: ExtraSettings = {
  confidence: 15,
  dpi: 150,
  curve: 5,
  side: 'left',
  terms: '',
  language: 'auto',
  target: 'en',
  targetMB: 2,
  optimizeMode: 'images',
  fontSize: 12,
  paper: 'a4',
};
export const extraActions: Partial<Record<ServerTool, string>> = {
  'optimize-pdf': 'optimize',
  'ebook-pdf': 'ebook',
  'pdf-powerpoint': 'powerpoint',
  'html-pdf': 'html',
  'auto-orient': 'orient',
  'book-dewarp': 'dewarp',
  'form-detect': 'form',
  'redaction-check': 'redaction',
  'print-check': 'print',
  'accessibility-check': 'accessibility',
  'translate-pdf': 'translate',
};
const languages: [string, string][] = [
  ['de', 'Deutsch'],
  ['en', 'Englisch'],
  ['fr', 'Französisch'],
  ['es', 'Spanisch'],
  ['it', 'Italienisch'],
  ['nl', 'Niederländisch'],
  ['pl', 'Polnisch'],
];
export function ServerExtraFields({
  tool,
  value,
  onChange,
}: {
  tool: ServerTool;
  value: ExtraSettings;
  onChange: (v: ExtraSettings) => void;
}) {
  const set = <K extends keyof ExtraSettings>(key: K, next: ExtraSettings[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <>
      {tool === 'optimize-pdf' && (
        <>
          <NumberField
            label="Gewünschte maximale Größe (MB)"
            value={value.targetMB}
            min={0.05}
            max={80}
            step={0.05}
            onChange={(v) => set('targetMB', v)}
          />
          <Choice
            label="Komprimierung"
            value={value.optimizeMode}
            onChange={(v) => set('optimizeMode', v)}
            items={[
              ['images', 'Bilder bei Bedarf verkleinern'],
              ['lossless', 'Nur verlustfrei optimieren'],
            ]}
          />
          <p className="fine-note">
            Text, Links und Formularfelder bleiben erhalten. Die Bildqualität kann sinken. Jede
            Variante wird nachgemessen; ist die Zielgröße nicht erreichbar, erhältst du die kleinste
            gefundene Datei mit einem Hinweis. Eine neu geschriebene PDF verliert vorhandene
            digitale Signaturen.
          </p>
        </>
      )}
      {tool === 'ebook-pdf' && (
        <>
          <Choice
            label="Seitenformat"
            value={value.paper}
            onChange={(v) => set('paper', v)}
            items={[
              ['a4', 'A4'],
              ['a5', 'A5'],
            ]}
          />
          <NumberField
            label="Grundschriftgröße (pt)"
            value={value.fontSize}
            min={8}
            max={24}
            onChange={(v) => set('fontSize', v)}
          />
          <p className="fine-note">
            Ungeschützte EPUB-Dateien, maximal 40 MB und 200 Ausgabeseiten. EPUBs mit
            verschlüsselten Inhalten oder geschützten Schriftdateien werden nicht unterstützt. Text
            und eingebettete Bilder werden neu umbrochen; vom Buch festgelegte Schriftgrößen können
            die Grundschriftgröße übersteuern. Externe Ressourcen werden nicht geladen. Interaktive
            Inhalte und Links werden nicht übernommen.
          </p>
        </>
      )}
      {tool === 'pdf-powerpoint' && (
        <p className="fine-note">
          Eine Folie je PDF-Seite, proportional auf 16:9 eingepasst. Seiten sind Bilder; Text ist in
          PowerPoint nicht einzeln editierbar. Höchstens 100 Seiten.
        </p>
      )}
      {tool === 'html-pdf' && (
        <p className="fine-note">
          Die Webseite zuerst als HTML speichern und hier auswählen. Überschriften, Absätze und
          Tabellen werden neu gesetzt. JavaScript, Bilder, externe Schriftdateien und CSS werden
          nicht übernommen.
        </p>
      )}
      {tool === 'auto-orient' && (
        <>
          <NumberField
            label="Mindestvertrauen der Erkennung"
            value={value.confidence}
            min={5}
            max={30}
            onChange={(v) => set('confidence', v)}
          />
          <p className="fine-note">
            15 ist der empfohlene Ausgangswert. Textarme oder unsichere Seiten bleiben unverändert.
            ZIP mit PDF und seitenweisem Bericht; höchstens 50 Seiten.
          </p>
        </>
      )}
      {tool === 'book-dewarp' && (
        <>
          <Choice
            label="Buchfalz auf der Seite"
            value={value.side}
            onChange={(v) => set('side', v)}
            items={[
              ['left', 'Links'],
              ['right', 'Rechts'],
            ]}
          />
          <NumberField
            label="Kurve am Falz (% der Seitenhöhe)"
            value={value.curve}
            min={-20}
            max={20}
            step={0.5}
            onChange={(v) => set('curve', v)}
          />
          <p className="fine-note">
            Eine manuell einstellbare, quadratische Spaltenkorrektur für gebogene Textzeilen.
            Positive Werte heben den Inhalt am Falz, negative senken ihn. Bei komplexen Wölbungen
            ist eine vollständige Entzerrung nicht garantiert. Ergebnis als neue Seitenbilder;
            danach bei Bedarf OCR ausführen.
          </p>
        </>
      )}
      {tool === 'form-detect' && (
        <p className="fine-note">
          Leere Rechtecke und Linien werden als Textfelder oder Checkboxen vorgeschlagen; bei Scans
          werden rechteckige Konturen gesucht. Ergebnis übernehmen und im Werkzeug „Formular
          erstellen“ Feldnamen, Typen und Positionen prüfen. Höchstens 50 Seiten und 500 neue
          Felder.
        </p>
      )}
      {tool === 'redaction-check' && (
        <>
          <Field label="Vertrauliche Begriffe zur Kontrolle (einer pro Zeile)">
            <textarea
              aria-label="Vertrauliche Begriffe zur Kontrolle"
              rows={5}
              value={value.terms}
              onChange={(e) => set('terms', e.target.value)}
              placeholder="Name, Kennnummer oder Textstelle"
            />
          </Field>
          <p className="fine-note">
            Sucht auslesbaren Text und mögliche dunkle Vektor-Überdeckungen. Ein Bericht ohne
            Treffer beweist keine sichere Schwärzung. Bildinhalte, frühere Revisionen und Anlagen
            zusätzlich prüfen.
          </p>
        </>
      )}
      {tool === 'print-check' && (
        <>
          <NumberField
            label="Mindestauflösung für Bilder (dpi)"
            value={value.dpi}
            min={72}
            max={600}
            step={10}
            onChange={(v) => set('dpi', v)}
          />
          <p className="fine-note">
            Basischeck für effektive Bildauflösung, eingebettete Schriften und Seitenboxen.
            Farbseparation, Überdruck und konkrete Druckerei-Vorgaben sind nicht Teil dieser
            Prüfung.
          </p>
        </>
      )}
      {tool === 'accessibility-check' && (
        <p className="fine-note">
          Technischer Basischeck. Lesereihenfolge, Alternativtexte, Kontraste und Bedienbarkeit
          zusätzlich prüfen. Dieser Bericht bestätigt keine PDF/UA- oder WCAG-Konformität.
        </p>
      )}
      {tool === 'translate-pdf' && (
        <>
          <Choice
            label="Ausgangssprache"
            value={value.language}
            onChange={(v) => set('language', v)}
            items={[['auto', 'Automatisch erkennen'], ...languages]}
          />
          <Choice
            label="Zielsprache"
            value={value.target}
            onChange={(v) => set('target', v)}
            items={languages}
          />
          <p className="fine-note">
            Originaltext und Übersetzung werden nebeneinander ausgegeben. Höchstens 60.000 Zeichen;
            maschinelle Übersetzungen bitte vor Verwendung prüfen.
          </p>
        </>
      )}
      {tool === 'word-mail-merge' && (
        <p className="fine-note">
          Platzhalter in Word: <code>{'{{Name}}'}</code> oder <code>{'{{Adresse}}'}</code>.
          Spaltennamen stehen in der ersten Zeile des ersten Excel-Tabellenblatts. Maximal 50
          Datensätze und 50 Spalten; Formeln vorher in Werte umwandeln. Verknüpfte externe Bilder
          werden nicht geladen.
        </p>
      )}
    </>
  );
}

export function StructuredReport({ raw }: { raw: string }) {
  let data: { title?: string; items?: Record<string, unknown>[]; note?: string };
  try {
    data = JSON.parse(raw);
  } catch {
    return <pre className="server-report">{raw}</pre>;
  }
  if (!Array.isArray(data.items)) return <pre className="server-report">{raw}</pre>;
  const labels: Record<string, string> = {
    page: 'Seite',
    scope: 'Bereich',
    status: 'Status',
    text: 'Text',
    rectangle: 'Position',
    files: 'Dateien',
    size_mm: 'Format in mm',
    image_dpi: 'Bildauflösungen (dpi)',
    trimbox: 'Endformat',
    bleedbox: 'Beschnitt',
    findings: 'Hinweise',
    title: 'Titel',
    language: 'Sprache',
    structure_tree_present: 'Strukturbaum vorhanden',
    bookmarks: 'Lesezeichen',
    text_characters: 'Textzeichen',
    images: 'Bilder',
    form_fields: 'Formularfelder',
  };
  const format = (value: unknown): string =>
    typeof value === 'boolean'
      ? value
        ? 'Ja'
        : 'Nein'
      : Array.isArray(value)
        ? value.map(format).join(' · ')
        : value === ''
          ? 'Fehlt'
          : String(value);
  return (
    <div className="document-report">
      <h3>{data.title}</h3>
      <p>{data.note}</p>
      {!data.items.length ? (
        <p>Keine Treffer in den ausgeführten Prüfungen.</p>
      ) : (
        data.items.map((item, i) => (
          <details key={i} open={i < 3}>
            <summary>
              {item.page ? `Seite ${item.page}` : String(item.scope || `Befund ${i + 1}`)}
              {item.status ? ` · ${item.status}` : ''}
            </summary>
            <dl>
              {Object.entries(item)
                .filter(([key]) => !['page', 'scope', 'status'].includes(key))
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{labels[key] || key}</dt>
                    <dd>{format(value) || 'Keine'}</dd>
                  </div>
                ))}
            </dl>
          </details>
        ))
      )}
    </div>
  );
}
