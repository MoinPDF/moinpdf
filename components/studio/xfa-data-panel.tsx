'use client';
import { ResultActions, ResultSummary, useResultName } from './result-actions';
import { useEffect, useMemo, useState } from 'react';
import { ui } from '@/lib/ui-language';
import { Button } from '@/components/ui/button';
import { readXfaData, writeXfaData, type XfaDataField } from '@/lib/xfa-data';
import { type Source, type JobResult } from '@/lib/pdf-engine';
export function XfaDataPanel({
  source,
  disabled,
  onBusy,
  onUse,
}: {
  source: Source;
  disabled: boolean;
  onBusy: (v: boolean) => void;
  onUse: (r: JobResult) => Promise<void>;
}) {
  const [fields, setFields] = useState<XfaDataField[] | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Uint8Array | null>(null),
    [url, setUrl] = useState('');
  const output = useMemo(
    () =>
      result
        ? {
            blob: new Blob([new Uint8Array(result)], { type: 'application/pdf' }),
            filename: source.name.replace(/\.pdf$/i, '') + '-XFA.pdf',
            kind: 'pdf',
            pages: source.pdf.numPages,
          }
        : null,
    [result, source],
  );
  const [resultName, renameResult] = useResultName(output);
  useEffect(() => {
    if (!result) {
      setUrl('');
      return;
    }
    const u = URL.createObjectURL(new Blob([new Uint8Array(result)], { type: 'application/pdf' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [result]);
  const run = async (job: () => Promise<void>) => {
    setError('');
    setBusy(true);
    onBusy(true);
    try {
      await job();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  return (
    <section className="advanced-card">
      <h2>{ui('XFA-Daten bearbeiten')}</h2>
      <p>
        {ui(
          'Einfache XFA-Datenfelder lassen sich lokal ändern. Dynamische Berechnungen, Skripte und hybride Formulare werden nicht unterstützt. Die gespeicherte Datei in einer XFA-fähigen Anwendung kontrollieren.',
        )}
      </p>
      <fieldset disabled={disabled || busy}>
        <Button
          onClick={() =>
            void run(async () => {
              const f = await readXfaData(source.bytes);
              setFields(f);
              setValues(Object.fromEntries(f.map((x) => [x.id, x.value])));
              setResult(null);
            })
          }
        >
          {ui('XFA-Daten laden')}
        </Button>
        {fields?.map((f) => (
          <label className="advanced-field" key={f.id}>
            <span>{f.label}</span>
            <textarea
              aria-label={f.label}
              value={values[f.id]}
              maxLength={20000}
              onChange={(e) => {
                setValues({ ...values, [f.id]: e.target.value });
                setResult(null);
              }}
            />
          </label>
        ))}
        {!!fields?.length && (
          <Button
            onClick={() =>
              void run(async () => setResult(await writeXfaData(source.bytes, values)))
            }
          >
            {ui('XFA-Daten speichern')}
          </Button>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="error-box">
          {ui(error)}
        </p>
      )}
      {result && output && (
        <>
          <ResultSummary result={output} />
          <ResultActions
            result={output}
            url={url}
            filename={resultName}
            onRename={renameResult}
            label={ui('PDF herunterladen')}
            disabled={disabled || busy}
          />
          <Button
            disabled={disabled || busy}
            onClick={() =>
              void run(() =>
                onUse({
                  blob: new Blob([new Uint8Array(result)], { type: 'application/pdf' }),
                  filename: resultName,
                  kind: 'pdf',
                  pages: source.pdf.numPages,
                  inputSize: source.size,
                  note: ui('XFA-Daten geändert; Darstellung in der Formularanwendung prüfen.'),
                }),
              )
            }
          >
            {ui('Ergebnis weiterbearbeiten')}
          </Button>
        </>
      )}
    </section>
  );
}
