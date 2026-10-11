'use client';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/pdf-engine';
import {
  stepLabels,
  validateWorkflow,
  runPipeline,
  type StepKind,
  type WorkflowStep,
  type SavedWorkflow,
} from '@/lib/advanced-pipeline';
import { Text, Choice, NumberField, type PanelProps } from './advanced-shared';
const storageKey = 'moinpdf.workflows.v1';
export function WorkflowPanel({
  sources,
  busy,
  run,
  batch = false,
}: PanelProps & { batch?: boolean }) {
  const [steps, setSteps] = useState<WorkflowStep[]>(
      batch
        ? [{ kind: 'stamp', text: 'GEPRÜFT' }]
        : [{ kind: 'ocr' }, { kind: 'removeBlank' }, { kind: 'numbers', number: 1 }],
    ),
    [name, setName] = useState('Mein Arbeitsablauf'),
    [password, setPassword] = useState(''),
    [saved, setSaved] = useState<SavedWorkflow[]>([]),
    [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) setSaved(stored.map(validateWorkflow).slice(0, 30));
    } catch {
      setNotice('Gespeicherte Abläufe konnten nicht geladen werden.');
    }
  }, []);
  const workflow = () => validateWorkflow({ version: 1, name, steps });
  const persist = (next: SavedWorkflow[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSaved(next);
  };
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <h2>
          {batch ? 'Ein Arbeitsschritt für alle Dateien' : 'Dein Ablauf, Schritt für Schritt'}
        </h2>
        {!batch && <Text label="Name des Arbeitsablaufs" value={name} onChange={setName} />}
        <ol className="workflow-steps">
          {steps.map((step, i) => (
            <li key={i}>
              <span className="step-index">{i + 1}</span>
              <div>
                <Choice
                  label={`Schritt ${i + 1}`}
                  value={step.kind}
                  onChange={(v) =>
                    setSteps(steps.map((s, j) => (j === i ? { kind: v as StepKind } : s)))
                  }
                  items={Object.entries(stepLabels) as [string, string][]}
                />
                {!batch && (
                  <>
                    <Choice
                      label={`Schritt ${i + 1} ausführen`}
                      value={step.condition?.field || 'always'}
                      items={[
                        ['always', 'Immer'],
                        ['filename', 'Wenn Dateiname …'],
                        ['text', 'Wenn vorhandener PDF-Text …'],
                        ['pages', 'Wenn Seitenzahl …'],
                      ]}
                      onChange={(v) =>
                        setSteps(
                          steps.map((s, j) =>
                            j === i
                              ? {
                                  ...s,
                                  condition:
                                    v === 'always'
                                      ? undefined
                                      : {
                                          field: v as 'filename' | 'text' | 'pages',
                                          operator: v === 'pages' ? 'gte' : 'contains',
                                          value: v === 'pages' ? '2' : '',
                                        },
                                  otherwise: undefined,
                                }
                              : s,
                          ),
                        )
                      }
                    />
                    {step.condition && (
                      <div className="pro-rule">
                        <Choice
                          label={`Bedingung ${i + 1}`}
                          value={step.condition.operator}
                          items={
                            step.condition.field === 'pages'
                              ? [
                                  ['gte', 'Mindestens'],
                                  ['lt', 'Weniger als'],
                                ]
                              : [
                                  ['contains', 'Enthält'],
                                  ['notContains', 'Enthält nicht'],
                                ]
                          }
                          onChange={(v) =>
                            setSteps(
                              steps.map((s, j) =>
                                j === i
                                  ? {
                                      ...s,
                                      condition: {
                                        ...s.condition!,
                                        operator: v as 'gte' | 'lt' | 'contains' | 'notContains',
                                      },
                                    }
                                  : s,
                              ),
                            )
                          }
                        />
                        <Text
                          label={`Vergleichswert ${i + 1}`}
                          value={step.condition.value}
                          onChange={(v) =>
                            setSteps(
                              steps.map((s, j) =>
                                j === i ? { ...s, condition: { ...s.condition!, value: v } } : s,
                              ),
                            )
                          }
                        />
                        <Choice
                          label={`Sonst ${i + 1}`}
                          value={step.otherwise?.kind || 'skip'}
                          items={[
                            ['skip', 'Diesen Schritt überspringen'],
                            ...Object.entries(stepLabels),
                          ]}
                          onChange={(v) =>
                            setSteps(
                              steps.map((s, j) =>
                                j === i
                                  ? {
                                      ...s,
                                      otherwise: v === 'skip' ? undefined : { kind: v as StepKind },
                                    }
                                  : s,
                              ),
                            )
                          }
                        />
                        {(step.otherwise?.kind === 'stamp' ||
                          step.otherwise?.kind === 'watermark') && (
                          <Text
                            label={`Text im Sonst-Zweig ${i + 1}`}
                            value={step.otherwise.text || ''}
                            onChange={(v) =>
                              setSteps(
                                steps.map((s, j) =>
                                  j === i ? { ...s, otherwise: { ...s.otherwise!, text: v } } : s,
                                ),
                              )
                            }
                          />
                        )}
                        {step.otherwise?.kind === 'numbers' && (
                          <NumberField
                            label={`Startnummer im Sonst-Zweig ${i + 1}`}
                            value={step.otherwise.number || 1}
                            min={1}
                            max={999999}
                            onChange={(v) =>
                              setSteps(
                                steps.map((s, j) =>
                                  j === i ? { ...s, otherwise: { ...s.otherwise!, number: v } } : s,
                                ),
                              )
                            }
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
                {(step.kind === 'stamp' || step.kind === 'watermark') && (
                  <Text
                    label={`Text für Schritt ${i + 1}`}
                    value={step.text || ''}
                    onChange={(v) =>
                      setSteps(steps.map((s, j) => (j === i ? { ...s, text: v } : s)))
                    }
                  />
                )}{' '}
                {step.kind === 'numbers' && (
                  <NumberField
                    label="Erste Seitennummer"
                    value={step.number || 1}
                    min={1}
                    max={999999}
                    onChange={(v) =>
                      setSteps(steps.map((s, j) => (j === i ? { ...s, number: v } : s)))
                    }
                  />
                )}
              </div>
              {!batch && (
                <div className="step-buttons">
                  <button
                    aria-label={`Schritt ${i + 1} nach oben`}
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...steps];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      setSteps(next);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Schritt ${i + 1} nach unten`}
                    disabled={i === steps.length - 1}
                    onClick={() => {
                      const next = [...steps];
                      [next[i + 1], next[i]] = [next[i], next[i + 1]];
                      setSteps(next);
                    }}
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Schritt ${i + 1} entfernen`}
                    disabled={steps.length === 1}
                    onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {!batch && (
          <Button
            variant="outline"
            disabled={steps.length >= 12}
            onClick={() => setSteps([...steps, { kind: 'numbers', number: 1 }])}
          >
            Schritt hinzufügen
          </Button>
        )}
        {steps.some((s) => s.kind === 'protect' || s.otherwise?.kind === 'protect') && (
          <>
            <Text
              label="Öffnungspasswort für diesen Durchlauf"
              type="password"
              value={password}
              onChange={setPassword}
            />
            <p className="fine-note">
              Mindestens 8 Zeichen. Passwortschutz muss am Ende stehen. Das Passwort wird nicht mit
              dem Ablauf gespeichert.
            </p>
          </>
        )}
        <p className="fine-note">
          Bedingungen werden am jeweiligen Zwischenstand geprüft. Textbedingungen lesen vorhandenen
          PDF-Text; bei Scans zuerst einen OCR-Schritt einsetzen. Das ZIP enthält ein Protokoll der
          ausgeführten und übersprungenen Schritte. Die Dateien werden einzeln verarbeitet. Bei OCR
          und Leerseitenerkennung bitte die Ausgabe kontrollieren.
        </p>
        <Button
          disabled={busy || !sources.length}
          onClick={() =>
            run(async (c) => {
              try {
                return await runPipeline(sources, workflow(), password, c);
              } finally {
                setPassword('');
              }
            })
          }
        >
          {sources.length} {sources.length === 1 ? 'Datei' : 'Dateien'} verarbeiten
        </Button>
      </section>
      <section className="advanced-card">
        {!batch && (
          <>
            <h2>Gespeicherte Abläufe</h2>
            <div className="advanced-actions">
              <Button
                variant="outline"
                onClick={() =>
                  run(async () => {
                    const v = workflow();
                    persist([...saved.filter((s) => s.name !== v.name), v].slice(-30));
                    setNotice('Arbeitsablauf gespeichert.');
                  })
                }
              >
                Ablauf speichern
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  run(async () => {
                    const v = workflow();
                    downloadBlob(
                      new Blob([JSON.stringify(v, null, 2)], { type: 'application/json' }),
                      'Arbeitsablauf.json',
                    );
                  })
                }
              >
                JSON exportieren
              </Button>
              <Button variant="outline" onClick={() => input.current?.click()}>
                JSON importieren
              </Button>
            </div>
            <input
              ref={input}
              className="sr-only"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f)
                  void run(async () => {
                    if (f.size > 100000) throw new Error('Die Ablaufdatei ist zu groß.');
                    const v = validateWorkflow(JSON.parse(await f.text()));
                    setName(v.name);
                    setSteps(v.steps);
                  });
              }}
            />
            {saved.map((v, i) => (
              <div className="advanced-list-row" key={i}>
                <strong>{v.name}</strong>
                <small>{v.steps.map((s) => stepLabels[s.kind]).join(' → ')}</small>
                <div className="advanced-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setName(v.name);
                      setSteps(structuredClone(v.steps));
                    }}
                  >
                    Laden
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(async () => persist(saved.filter((_, j) => j !== i)))}
                  >
                    Entfernen
                  </Button>
                </div>
              </div>
            ))}
            <p className="fine-note">
              Gespeichert werden ausschließlich Schritte und Einstellungen in diesem Browser.
            </p>
            <p role="status">{notice}</p>
          </>
        )}
        <h2>Dokumente im Stapel</h2>
        {sources.map((s) => (
          <p className="advanced-file-row" key={s.id}>
            <span>{s.name}</span>
            <small>{s.pdf.numPages} Seiten</small>
          </p>
        ))}
      </section>
    </div>
  );
}
