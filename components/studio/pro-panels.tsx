'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Choice, Text, NumberField, type PanelProps } from './advanced-shared';
import {
  batesPdfs,
  batesText,
  pageLabels,
  rotateFreely,
  continuousPage,
  posterPages,
  linearizeSources,
  structuredExport,
  packagePdfs,
  type ProTool,
  type LabelRule,
  type BatesOptions,
} from '@/lib/pro-tools';

export function ProPanel({ tool, source, sources, busy, run }: PanelProps & { tool: ProTool }) {
  const [template, setTemplate] = useState('AKTE-{nummer} · {seite}/{seiten}'),
    [start, setStart] = useState(1),
    [padding, setPadding] = useState(6),
    [size, setSize] = useState(10);
  const [position, setPosition] = useState<BatesOptions['position']>('bottom-right'),
    [angle, setAngle] = useState(15),
    [width, setWidth] = useState(595),
    [gap, setGap] = useState(12);
  const [columns, setColumns] = useState(2),
    [rows, setRows] = useState(2),
    [overlap, setOverlap] = useState(10);
  const [rules, setRules] = useState<LabelRule[]>([{ page: 1, style: 'D', prefix: '', start: 1 }]);
  const save = async (
    bytes: Uint8Array,
    suffix: string,
    pages = source.pdf.numPages,
    note?: string,
  ) =>
    packagePdfs(
      [{ name: source.name.replace(/\.pdf$/i, '') + suffix + '.pdf', bytes, pages }],
      note,
    );
  const structureNote =
    'Seiteninhalt bleibt als Text und Vektorgrafik erhalten. Interaktive Formulare werden festgeschrieben; Links, Anhänge, Lesezeichen und ursprüngliche Signaturen werden bei diesem Seitenneuaufbau nicht übernommen.';
  const actions = {
    bates: 'Nummerierung anwenden',
    'page-labels': 'Seitenbezeichnungen speichern',
    'rotate-free': 'Seiten drehen',
    'continuous-page': 'Lange Seite erstellen',
    'poster-print': 'Poster aufteilen',
    linearize: 'Webansicht optimieren',
    'structured-export': 'JSON exportieren',
  };
  return (
    <section className="advanced-card">
      {tool === 'bates' && (
        <>
          <p>
            {sources.length} Dateien werden in der geöffneten Reihenfolge nummeriert. Die
            Nummerierung läuft über alle Dateien weiter.
          </p>
          <Text label="Vorlage" value={template} onChange={setTemplate} />
          <p className="fine-note">
            Platzhalter: {'{nummer}'}, {'{seite}'}, {'{seiten}'}, {'{datei}'}
          </p>
          <NumberField
            label="Startnummer"
            value={start}
            onChange={setStart}
            min={0}
            max={999999999}
          />
          <NumberField
            label="Ziffernstellen"
            value={padding}
            onChange={setPadding}
            min={1}
            max={12}
          />
          <NumberField label="Schriftgröße (pt)" value={size} onChange={setSize} min={6} max={40} />
          <Choice
            label="Position"
            value={position}
            onChange={(v) => setPosition(v as typeof position)}
            items={[
              ['top-left', 'Oben links'],
              ['top-center', 'Oben mittig'],
              ['top-right', 'Oben rechts'],
              ['bottom-left', 'Unten links'],
              ['bottom-center', 'Unten mittig'],
              ['bottom-right', 'Unten rechts'],
            ]}
          />
          <p aria-live="polite">
            Vorschau:{' '}
            <strong>
              {batesText(template, start, padding, 1, source.pdf.numPages, source.name)}
            </strong>
          </p>
        </>
      )}
      {tool === 'page-labels' && (
        <>
          <p>
            Bezeichnungen erscheinen in der Seitennavigation geeigneter PDF-Programme. Sichtbare
            Seitennummern bleiben unverändert.
          </p>
          {rules.map((r, i) => (
            <div className="pro-rule" key={i}>
              <NumberField
                label={`Abschnitt ${i + 1}: ab Seite`}
                value={r.page}
                min={1}
                max={source.pdf.numPages}
                onChange={(v) =>
                  setRules((all) => all.map((x, n) => (n === i ? { ...x, page: v } : x)))
                }
              />
              <Choice
                label="Zählweise"
                value={r.style || 'none'}
                onChange={(v) =>
                  setRules((all) =>
                    all.map((x, n) =>
                      n === i ? { ...x, style: (v === 'none' ? '' : v) as LabelRule['style'] } : x,
                    ),
                  )
                }
                items={[
                  ['D', '1, 2, 3'],
                  ['r', 'i, ii, iii'],
                  ['R', 'I, II, III'],
                  ['a', 'a, b, c'],
                  ['A', 'A, B, C'],
                  ['none', 'Nur Präfix'],
                ]}
              />
              <Text
                label="Präfix"
                value={r.prefix}
                onChange={(v) =>
                  setRules((all) => all.map((x, n) => (n === i ? { ...x, prefix: v } : x)))
                }
              />
              <NumberField
                label="Startwert"
                value={r.start}
                min={1}
                max={999999}
                onChange={(v) =>
                  setRules((all) => all.map((x, n) => (n === i ? { ...x, start: v } : x)))
                }
              />
              {i > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setRules((all) => all.filter((_, n) => n !== i))}
                >
                  Abschnitt entfernen
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            disabled={rules.length >= source.pdf.numPages}
            onClick={() =>
              setRules((all) => [
                ...all,
                {
                  page: Math.min(source.pdf.numPages, Math.max(...all.map((r) => r.page)) + 1),
                  style: 'D',
                  prefix: '',
                  start: 1,
                },
              ])
            }
          >
            Abschnitt hinzufügen
          </Button>
        </>
      )}
      {tool === 'rotate-free' && (
        <>
          <NumberField
            label="Drehwinkel im Uhrzeigersinn (Grad)"
            value={angle}
            onChange={setAngle}
            min={-360}
            max={360}
            step={0.1}
          />
          <p>
            Die Seitengröße wird so angepasst, dass der gedrehte Inhalt vollständig hineinpasst.
          </p>
        </>
      )}
      {tool === 'continuous-page' && (
        <>
          <p>Alle geöffneten PDFs in der angezeigten Reihenfolge zu einer Seite verbinden.</p>
          <NumberField label="Breite (pt)" value={width} onChange={setWidth} min={100} max={2000} />
          <NumberField
            label="Abstand zwischen Seiten (pt)"
            value={gap}
            onChange={setGap}
            min={0}
            max={100}
          />
          <p className="fine-note">
            595 pt entsprechen ungefähr DIN A4. Maximale Seitenlänge: 5,08 Meter.
          </p>
        </>
      )}
      {tool === 'poster-print' && (
        <>
          <NumberField label="Spalten" value={columns} onChange={setColumns} min={1} max={8} />
          <NumberField label="Zeilen" value={rows} onChange={setRows} min={1} max={8} />
          <NumberField
            label="Überlappung (mm)"
            value={overlap}
            onChange={setOverlap}
            min={0}
            max={25}
          />
          <p>
            Ausgabe: {source.pdf.numPages * columns * rows} Kacheln, jeweils zeilenweise von links
            oben. Im Druckdialog die gewünschte Papiergröße wählen.
          </p>
        </>
      )}
      {(['rotate-free', 'continuous-page', 'poster-print'] as string[]).includes(tool) && (
        <p className="fine-note">{structureNote}</p>
      )}
      {tool === 'linearize' && (
        <p>
          Die erste Seite kann beim Abruf im Internet vor dem Rest der Datei geladen werden. Text,
          Seiten und Formularfelder bleiben erhalten. Der Webserver muss Teilabrufe unterstützen.
        </p>
      )}
      {tool === 'structured-export' && (
        <p>
          Exportiert auslesbaren Text mit Seitenzahlen, Positionen und Schriftreferenzen. Geeignet
          zur Weiterverarbeitung. Scans zuvor mit OCR durchsuchbar machen.
        </p>
      )}
      <Button
        disabled={busy}
        onClick={() =>
          run(async (ctx) => {
            if (tool === 'bates')
              return batesPdfs(sources, { template, start, padding, size, position }, ctx);
            if (tool === 'page-labels')
              return save(await pageLabels(source.bytes, rules), '-Seitenbezeichnungen');
            if (tool === 'rotate-free')
              return save(
                await rotateFreely(source.bytes, angle, ctx),
                '-gedreht',
                source.pdf.numPages,
                structureNote,
              );
            if (tool === 'continuous-page')
              return save(
                await continuousPage(sources, width, gap, ctx),
                '-Langseite',
                1,
                structureNote,
              );
            if (tool === 'poster-print')
              return save(
                await posterPages(source.bytes, columns, rows, (overlap * 72) / 25.4, ctx),
                '-Poster',
                source.pdf.numPages * columns * rows,
                structureNote,
              );
            if (tool === 'linearize') return linearizeSources(sources, ctx);
            return structuredExport(sources, ctx);
          })
        }
      >
        {actions[tool]}
      </Button>
    </section>
  );
}
