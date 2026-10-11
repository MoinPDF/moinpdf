'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Choice, Text, Tick, NumberField, type PanelProps } from './advanced-shared';
import {
  linearizeSources,
  structuredExport,
  type ProTool,
  type LabelRule,
  type BatesRule,
  type PosterPrint,
} from '@/lib/pro-tools';
import { runProJob, type ProJob } from '@/lib/pro-job';
import { BatesRules, defaultBatesRule } from './bates-rules';
import { OperationPreview } from './operation-preview';

export function ProPanel({ tool, source, sources, busy, run }: PanelProps & { tool: ProTool }) {
  const [batesRules, setBatesRules] = useState<BatesRule[]>([{ ...defaultBatesRule }]),
    [start, setStart] = useState(1);
  const [print, setPrint] = useState<PosterPrint>({
    paper: 'a4',
    landscape: false,
    margin: 18,
    marks: true,
  });
  const [angle, setAngle] = useState(15),
    [width, setWidth] = useState(595),
    [gap, setGap] = useState(12);
  const [columns, setColumns] = useState(2),
    [rows, setRows] = useState(2),
    [overlap, setOverlap] = useState(10);
  const [rules, setRules] = useState<LabelRule[]>([{ page: 1, style: 'D', prefix: '', start: 1 }]);
  const job: ProJob | null =
    tool === 'bates'
      ? { kind: tool, options: { ...batesRules[0], start, rules: batesRules } }
      : tool === 'page-labels'
        ? { kind: tool, rules }
        : tool === 'rotate-free'
          ? { kind: tool, angle }
          : tool === 'continuous-page'
            ? { kind: tool, width, gap }
            : tool === 'poster-print'
              ? { kind: tool, columns, rows, overlap: (overlap * 72) / 25.4, print }
              : null;
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
          <p>{sources.length} Dateien werden in der geöffneten Reihenfolge nummeriert.</p>
          <NumberField
            label="Globale Startnummer"
            value={start}
            min={0}
            max={999999999}
            onChange={setStart}
          />
          <BatesRules rules={batesRules} onChange={setBatesRules} />
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
          <Choice
            label="Druckpapier"
            value={print.paper}
            onChange={(v) => setPrint((p) => ({ ...p, paper: v as PosterPrint['paper'] }))}
            items={[
              ['a4', 'DIN A4'],
              ['a3', 'DIN A3'],
              ['letter', 'US Letter'],
              ['source', 'Kacheln in Originalgröße'],
            ]}
          />
          <Tick
            label="Querformat"
            value={print.landscape}
            onChange={(v) => setPrint((p) => ({ ...p, landscape: v }))}
          />
          <NumberField
            label="Druckrand (mm)"
            value={(print.margin * 25.4) / 72}
            min={0}
            max={25}
            step={0.1}
            onChange={(v) => setPrint((p) => ({ ...p, margin: (v * 72) / 25.4 }))}
          />
          <Tick
            label="Schnittmarken im Rand"
            value={print.marks}
            onChange={(v) => setPrint((p) => ({ ...p, marks: v }))}
          />
          <p>
            Ausgabe: {source.pdf.numPages * columns * rows} Blätter, zeilenweise von links oben.
            Inhalt wird proportional auf das gewählte Raster skaliert. Mit 100 % / tatsächlicher
            Größe drucken.
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
            if (job)
              return runProJob(
                tool === 'bates' || tool === 'continuous-page' ? sources : [source],
                job,
                ctx,
              );
            if (tool === 'linearize') return linearizeSources(sources, ctx);
            return structuredExport(sources, ctx);
          })
        }
      >
        {actions[tool]}
      </Button>
      {job && (
        <OperationPreview
          busy={busy}
          version={JSON.stringify({ job, ids: sources.map((s) => s.id), selected: source.id })}
          build={(signal) =>
            runProJob(
              job.kind === 'continuous-page' ? sources : [source],
              job.kind === 'bates'
                ? {
                    ...job,
                    options: {
                      ...job.options,
                      start:
                        job.options.start +
                        sources
                          .slice(
                            0,
                            Math.max(
                              0,
                              sources.findIndex((s) => s.id === source.id),
                            ),
                          )
                          .reduce((n, s) => n + s.pdf.numPages, 0),
                    },
                  }
                : job,
              { signal, report: () => {} },
            )
          }
        />
      )}
    </section>
  );
}
