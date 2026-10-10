'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Plus, Download, LoaderCircle, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Choice, Field, Tick, Text, NumberField } from './advanced-shared';
import { ReadOptions, Coverage } from './evidence-panels';
import { readEvidence } from '@/lib/evidence-engine';
import { readDocumentDraft } from '@/lib/document-tools';
import { audioSections, type AudioSection } from '@/lib/century-model';
import type { EvidencePage } from '@/lib/evidence-model';
import { selectRange, type Source } from '@/lib/pdf-engine';
import type { ExportFile, RunContext } from '@/lib/advanced-types';
import {
  integratedDocumentServer,
  serverCapabilities,
  runServerJob,
  type ServerCapabilities,
} from '@/lib/document-server';
import './evidence-workbench.css';
import './century-workbench.css';

export function AudioWorkbench({
  sources,
  onBack,
  onAdd,
  onBusy,
}: {
  sources: Source[];
  onBack: () => void;
  onAdd: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id || ''),
    [ocr, setOcr] = useState(false),
    [mode, setMode] = useState<'document' | 'pages' | 'chapters'>('document'),
    [pages, setPages] = useState<EvidencePage[]>([]),
    [sections, setSections] = useState<AudioSection[]>([]),
    [selected, setSelected] = useState(''),
    [range, setRange] = useState(''),
    [reviewed, setReviewed] = useState(false),
    [voice, setVoice] = useState('thorsten'),
    [speed, setSpeed] = useState(1),
    [caps, setCaps] = useState<ServerCapabilities | null>(null),
    [status, setStatus] = useState('Sprachausgabe wird geprüft …'),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState({ percent: 0, label: '' }),
    [error, setError] = useState(''),
    [result, setResult] = useState<ExportFile | null>(null),
    [url, setUrl] = useState('');
  const controller = useRef<AbortController | null>(null),
    output = useRef<HTMLElement>(null),
    source = sources.find((s) => s.id === sourceId) || sources[0],
    current = sections.find((s) => s.id === selected) || sections[0];
  const chosen = sections.filter((s) => s.enabled),
    characters = chosen.reduce((n, s) => n + s.text.length, 0),
    ready = !!caps?.capabilities.speech;
  const clear = () => {
    setResult(null);
    setReviewed(false);
  };
  useEffect(() => {
    setPages([]);
    setSections([]);
    setResult(null);
    setReviewed(false);
    setError('');
  }, [source?.id]);
  useEffect(() => {
    const abort = new AbortController();
    if (integratedDocumentServer)
      void serverCapabilities(integratedDocumentServer, '', abort.signal)
        .then((value) => {
          if (abort.signal.aborted) return;
          setCaps(value);
          setStatus(
            value.capabilities.speech
              ? 'Zwei deutsche Stimmen stehen auf deinem Dokumentenserver bereit.'
              : 'Die Sprachausgabe ist noch nicht verfügbar. Bitte die vollständige Installation aktualisieren.',
          );
        })
        .catch(() => {
          if (!abort.signal.aborted)
            setStatus(
              'Der Dokumentenserver ist gerade nicht erreichbar. Bitte später erneut öffnen.',
            );
        });
    else
      setStatus(
        'Audioexport benötigt den integrierten Dokumentenserver von MoinPDF. Hier kannst du den Vorlesetext vorbereiten und als TXT speichern.',
      );
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    if (!result) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(result.blob);
    setUrl(next);
    output.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return () => URL.revokeObjectURL(next);
  }, [result]);
  async function run(action: (ctx: RunContext) => Promise<ExportFile | void>) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    setResult(null);
    setProgress({ percent: 0, label: 'Verarbeitung wird vorbereitet …' });
    try {
      const out = await action({ signal: abort.signal, report: setProgress });
      if (!abort.signal.aborted && out) setResult(out);
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  const audio = (sample: boolean) =>
    run(async (ctx) => {
      if (!integratedDocumentServer || !ready)
        throw new Error('Die lokale Sprachausgabe ist nicht verfügbar.');
      const selected = sample
        ? [{ title: 'Stimmprobe', text: (current?.text || '').slice(0, 350) }]
        : chosen.map((s) => ({ title: s.title, text: s.text }));
      if (!selected.length || selected.some((s) => !s.text.trim()))
        throw new Error('Bitte nicht leere Abschnitte auswählen.');
      ctx.report({
        percent: 30,
        label: sample
          ? 'Stimmprobe wird erzeugt …'
          : 'Hörbuch wird auf deinem Dokumentenserver gesprochen …',
      });
      const body = new FormData();
      body.append('request', JSON.stringify({ voice, speed, sections: selected }));
      const out = await runServerJob(integratedDocumentServer, '', '/v1/audio', body, ctx.signal);
      return {
        ...out,
        ...(sample
          ? {
              filename: 'Stimmprobe.wav',
              note: 'Stimmprobe aus den ersten 350 Zeichen des angezeigten Abschnitts.',
            }
          : {
              note: 'Geprüfter Vorlesetext mit lokaler Sprachausgabe. Ein Abschnitt ergibt eine WAV-Datei; mehrere ergeben ein ZIP mit Kapitelübersicht und Wiedergabeliste.',
            }),
      };
    });
  return (
    <main className="document-workbench advanced-workbench">
      <header className="workbench-header">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <ChevronLeft size={17} />
          Alle Werkzeuge
        </Button>
        <Button variant="outline" onClick={onAdd} disabled={busy}>
          <Plus size={16} />
          Dateien hinzufügen
        </Button>
      </header>
      <div className="workbench-title">
        <div>
          <span className="studio-kicker">DEIN DOKUMENT ZUM ANHÖREN</span>
          <h1>
            <Headphones />
            PDF als Hörbuch
          </h1>
          <p>Text prüfen, Stimme wählen und als Audio speichern.</p>
        </div>
      </div>
      <p className="workbench-notice">{status}</p>
      <fieldset className="advanced-fields" disabled={busy} onChangeCapture={() => setResult(null)}>
        {!source ? (
          <p>Bitte zuerst eine PDF öffnen.</p>
        ) : (
          <div className="century-columns">
            <section className="advanced-card">
              <Choice
                label="Dokument"
                value={source.id}
                onChange={setSourceId}
                items={sources.map((s) => [s.id, s.name])}
              />
              <ReadOptions
                ocr={ocr}
                setOcr={(v) => {
                  setOcr(v);
                  setPages([]);
                  setSections([]);
                  clear();
                }}
              />
              <Choice
                label="Audio aufteilen"
                value={mode}
                onChange={(v) => {
                  setMode(v as typeof mode);
                  setSections([]);
                  clear();
                }}
                items={[
                  ['document', 'Eine Audiodatei für das Dokument'],
                  ['pages', 'Eine Audiodatei je ausgewählter Seite'],
                  ['chapters', 'Eine Audiodatei je Hauptlesezeichen'],
                ]}
              />
              <p className="fine-note">
                Die Lesereihenfolge folgt dem erkannten Seitentext. Tabellen, Spalten und OCR-Fehler
                bitte im Vorlesetext korrigieren. Kapitelgrenzen liegen auf den Zielseiten der
                Hauptlesezeichen.
              </p>
              <Button
                onClick={() =>
                  run(async (ctx) => {
                    clear();
                    setSections([]);
                    const data = pages.length
                      ? pages
                      : await readEvidence([source], ocr ? 'ocr' : 'auto', ctx);
                    setPages(data);
                    const draft =
                      mode === 'chapters' ? await readDocumentDraft(source, ctx.signal) : undefined;
                    const entries = audioSections(data, mode, draft?.bookmarks);
                    setSections(entries);
                    setSelected(entries[0]?.id || '');
                  })
                }
              >
                Vorlesetext vorbereiten
              </Button>
              <Coverage pages={pages} />
              {!!sections.length && (
                <>
                  <Text
                    label="Abschnitte auswählen (z. B. 1-5, 8; leer = alle)"
                    value={range}
                    onChange={setRange}
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      run(async () => {
                        const indices = selectRange(range, sections.length);
                        clear();
                        setSections(
                          sections.map((s, i) => ({
                            ...s,
                            enabled: indices.has(i) && !!s.text.trim(),
                          })),
                        );
                      })
                    }
                  >
                    Abschnittsauswahl übernehmen
                  </Button>
                  <Choice
                    label="Abschnitt bearbeiten"
                    value={current.id}
                    onChange={setSelected}
                    items={sections.map((s, i) => [
                      s.id,
                      `${i + 1}. ${s.title}${s.enabled ? '' : ' · ausgelassen'}`,
                    ])}
                  />
                  <Tick
                    label="Diesen Abschnitt ausgeben"
                    value={current.enabled}
                    onChange={(enabled) => {
                      clear();
                      setSections(
                        sections.map((s) => (s.id === current.id ? { ...s, enabled } : s)),
                      );
                    }}
                  />
                  <Field label="Abschnittstitel">
                    <input
                      value={current.title}
                      maxLength={200}
                      onChange={(e) => {
                        clear();
                        setSections(
                          sections.map((s) =>
                            s.id === current.id ? { ...s, title: e.target.value } : s,
                          ),
                        );
                      }}
                    />
                  </Field>
                  <Field label="Vorlesetext">
                    <textarea
                      className="century-audio-text"
                      rows={14}
                      value={current.text}
                      onChange={(e) => {
                        clear();
                        setSections(
                          sections.map((s) =>
                            s.id === current.id ? { ...s, text: e.target.value } : s,
                          ),
                        );
                      }}
                    />
                  </Field>
                </>
              )}
            </section>
            <section className="advanced-card">
              <h2>Stimme und Ausgabe</h2>
              <Choice
                label="Deutsche Stimme"
                value={voice}
                onChange={setVoice}
                items={(caps?.audioVoices?.length
                  ? caps.audioVoices
                  : [
                      { id: 'thorsten', label: 'Thorsten · Deutsch' },
                      { id: 'kerstin', label: 'Kerstin · Deutsch' },
                    ]
                ).map((v) => [v.id, v.label])}
              />
              <NumberField
                label="Sprechtempo"
                value={speed}
                onChange={setSpeed}
                min={0.75}
                max={1.5}
                step={0.05}
              />
              <p>
                {chosen.length} ausgewählte Abschnitte · {characters.toLocaleString('de-DE')} /
                20.000 Zeichen
              </p>
              <p className="fine-note">
                Bis zu 100 Abschnitte pro Auftrag. Bei langen Dokumenten bitte mehrere Aufträge
                erstellen. Die Audioverarbeitung benötigt je nach Textlänge einige Zeit.
              </p>
              <Button
                variant="outline"
                disabled={!ready || !current?.text.trim()}
                onClick={() => void audio(true)}
              >
                Stimme mit diesem Text probehören
              </Button>
              <Tick
                label="Lesereihenfolge und Vorlesetext der ausgewählten Abschnitte geprüft"
                value={reviewed}
                onChange={setReviewed}
              />
              <div className="advanced-actions">
                <Button
                  disabled={
                    !ready ||
                    !reviewed ||
                    !chosen.length ||
                    chosen.length > 100 ||
                    characters > 20000 ||
                    chosen.some((s) => !s.title.trim() || !s.text.trim())
                  }
                  onClick={() => void audio(false)}
                >
                  Hörbuch erstellen
                </Button>
                <Button
                  variant="outline"
                  disabled={!chosen.length}
                  onClick={() =>
                    run(async () => ({
                      blob: new Blob(
                        [chosen.map((s) => s.title + '\n\n' + s.text).join('\n\n---\n\n')],
                        { type: 'text/plain;charset=utf-8' },
                      ),
                      filename: 'Vorlesetext.txt',
                      kind: 'data',
                      pages: 0,
                    }))
                  }
                >
                  Vorlesetext als TXT
                </Button>
              </div>
              <p className="fine-note">
                Texterkennung erfolgt auf deinem Gerät. Nur der geprüfte Text geht an den
                integrierten Dokumentenserver. Die Stimmen arbeiten dort ohne Cloud-Dienst.
              </p>
            </section>
          </div>
        )}
      </fieldset>
      {busy && (
        <div className="advanced-progress" role="status">
          <LoaderCircle className="spin" size={18} />
          <span>{progress.label}</span>
          <progress max={100} value={progress.percent} />
          <Button
            variant="ghost"
            onClick={() => {
              controller.current?.abort();
              setError(
                'Abruf abgebrochen. Ein bereits gestarteter Audioauftrag auf dem Server endet spätestens nach drei Minuten.',
              );
            }}
          >
            Abruf abbrechen
          </Button>
        </div>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {result && (
        <section ref={output} className="advanced-result century-audio-output">
          <div>
            <h2>Dein Ergebnis ist bereit.</h2>
            <p>{result.filename}</p>
            {result.note && <p>{result.note}</p>}
            {result.blob.type.startsWith('audio/') && (
              <audio controls src={url} aria-label="Erzeugte Sprachausgabe" />
            )}
            <Button asChild>
              <a href={url} download={result.filename}>
                <Download size={17} />
                Herunterladen
              </a>
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
