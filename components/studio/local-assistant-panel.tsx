'use client';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Text, Tick, PageStage, type PanelProps } from './advanced-shared';
import { LocalDocumentModel, localModelInfo, verifyLocalModel } from '@/lib/local-model';
import { cachedModel, storeModel } from '@/lib/model-storage';
import { readEvidence } from '@/lib/evidence-engine';
import type { EvidencePage, EvidenceRef } from '@/lib/evidence-model';
import {
  assistantSchema,
  assistantSystem,
  assistantPrompt,
  selectPassages,
  validateGroundedAnswer,
  type GroundedAnswer,
} from '@/lib/grounded-assistant';
export function LocalAssistantPanel({ sources, busy, run }: PanelProps) {
  const [file, setFile] = useState<Blob | null>(null),
    [remember, setRemember] = useState(false),
    [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState<GroundedAnswer | null>(null),
    [focus, setFocus] = useState<EvidenceRef | null>(null),
    [notice, setNotice] = useState('');
  const model = useRef<LocalDocumentModel | null>(null),
    evidence = useRef<EvidencePage[] | null>(null);
  useEffect(() => {
    model.current = new LocalDocumentModel();
    let active = true;
    void cachedModel()
      .then((value) => {
        if (active && value) {
          setFile(value);
          setNotice('Gespeicherte Modelldatei gefunden. Sie wird vor dem Laden erneut geprüft.');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      void model.current?.close();
    };
  }, []);
  useEffect(() => {
    setAnswer(null);
    setFocus(null);
  }, [question]);
  const source = sources.find((s) => s.id === focus?.sourceId);
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <h2>Fragen an deine PDFs</h2>
        <p>
          Das Sprachmodell läuft auf diesem Gerät. Dokumente, Fragen und Antworten werden nicht an
          einen KI-Dienst übertragen.
        </p>
        <p className="fine-note">
          Einmalig {localModelInfo.name} herunterladen (409 MB, Apache-2.0) und hier auswählen. Die
          Prüfsumme wird vor der Verwendung kontrolliert. Die Berechnung benötigt zusätzlichen
          Arbeitsspeicher und kann auf kleinen Geräten langsam sein.
        </p>
        <a href={localModelInfo.url} target="_blank" rel="noreferrer">
          Geprüfte Modelldatei herunterladen
        </a>
        <Tick
          label="Modelldatei für spätere Sitzungen auf diesem Gerät speichern"
          value={remember}
          onChange={setRemember}
        />
        <label className="advanced-field">
          <span>Lokale Modelldatei (.gguf)</span>
          <input
            type="file"
            accept=".gguf"
            aria-label="Lokale Modelldatei"
            disabled={busy}
            onChange={(event) => {
              const next = event.target.files?.[0];
              event.target.value = '';
              if (next)
                void run(async (ctx) => {
                  setNotice('');
                  await verifyLocalModel(next, ctx.signal);
                  await model.current?.close();
                  if (remember) await storeModel(next);
                  setFile(next);
                  setAnswer(null);
                  setNotice('Modelldatei geprüft. Die Inferenz beginnt mit deiner Frage.');
                });
            }}
          />
        </label>
        {file && <p role="status">{localModelInfo.name} · Modelldatei verfügbar</p>}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await model.current?.close();
              await storeModel(null);
              setFile(null);
              setAnswer(null);
              setNotice('Modelldatei und Laufzeit entladen.');
            })
          }
        >
          Modell entladen und gespeicherte Kopie löschen
        </Button>
        <Text label="Frage zu den geöffneten Dokumenten" value={question} onChange={setQuestion} />
        <Button
          disabled={busy || !file || !question.trim() || question.length > 600}
          onClick={() =>
            void run(async (ctx) => {
              setAnswer(null);
              setFocus(null);
              if (!file || !model.current)
                throw new Error('Bitte zuerst die Modelldatei auswählen.');
              if (!evidence.current) evidence.current = await readEvidence(sources, 'auto', ctx);
              const passages = selectPassages(evidence.current, question);
              if (!passages.length)
                throw new Error('Keine lesbaren Fundstellen gefunden. Bitte zuerst OCR prüfen.');
              await model.current.load(file, ctx);
              ctx.report({ percent: 40, label: 'Lokale Antwort mit Quellen erzeugen' });
              const raw = await model.current.answer(
                assistantSystem,
                assistantPrompt(question, passages),
                assistantSchema(passages),
                ctx.signal,
              );
              ctx.signal.throwIfAborted();
              const result = validateGroundedAnswer(raw, passages);
              setAnswer(result);
              setFocus(result.citations[0] || null);
              ctx.report({ percent: 100, label: 'Quellenangaben geprüft' });
              return {
                blob: new Blob(
                  [
                    JSON.stringify(
                      {
                        model: localModelInfo.name,
                        revision: localModelInfo.revision,
                        question,
                        ...result,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                ),
                filename: 'PDF-Assistent-Antwort.json',
                kind: 'data',
                pages: 0,
                note: 'Lokal erzeugte Modellantwort mit überprüften Originalzitaten.',
              };
            })
          }
        >
          Frage lokal beantworten
        </Button>
        {notice && <p role="status">{notice}</p>}
        {answer && (
          <section aria-label="Antwort des lokalen Assistenten" aria-live="polite">
            <h3>{answer.abstain ? 'Keine belegte Antwort' : 'Modellantwort'}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{answer.answer}</p>
            {answer.citations.map((citation, index) => (
              <div key={index}>
                <blockquote>{citation.quote}</blockquote>
                <Button variant="outline" onClick={() => setFocus(citation)}>
                  {citation.name} · Seite {citation.page + 1} anzeigen
                </Button>
              </div>
            ))}
            <p className="fine-note">
              Zitate werden unverändert aus den ausgewählten Originalpassagen übernommen. Die
              Auslegung durch das Modell kann trotzdem falsch sein; bei OCR zusätzlich das
              Seitenbild kontrollieren. Für die Antwort wurden lokal ausgewählte Passagen verwendet.
            </p>
          </section>
        )}
      </section>
      {source && focus && (
        <aside className="advanced-card">
          <h3>Fundstelle im Original</h3>
          <p>
            {source.name} · Seite {focus.page + 1}
          </p>
          <PageStage source={source} page={focus.page} rects={focus.rects} />
        </aside>
      )}
    </div>
  );
}
