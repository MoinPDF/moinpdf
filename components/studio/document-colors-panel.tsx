'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import { openSource, type Source } from '@/lib/pdf-engine';
import { defaultDocumentColors, type DocumentColors } from '@/lib/document-color-model';
import { exportDocumentColors } from '@/lib/document-color-engine';
import { useToolDraftState } from './workspace-drafts';
import { Choice, PageSelect, PageStage, Tick, type PanelProps } from './advanced-shared';
import './document-colors.css';

export function DocumentColorsPanel({
  source,
  run,
  busy,
  invalidate,
}: PanelProps & { invalidate: () => void }) {
  useLanguage();
  const [options, setOptions] = useToolDraftState<DocumentColors>(
    'DocumentColorsPanel.options:' + source.id,
    defaultDocumentColors,
  );
  const [page, setPage] = useState(0),
    [preview, setPreview] = useState<Source | null>(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState(true);
  const change = (next: DocumentColors) => {
    setOptions(next);
    invalidate();
  };
  const index = Math.min(page, source.pdf.numPages - 1);
  useEffect(() => {
    const abort = new AbortController();
    let owned: Source | undefined;
    setPreview(null);
    setError('');
    setPending(true);
    const timer = setTimeout(async () => {
      try {
        const output = await exportDocumentColors(
          source,
          options,
          { signal: abort.signal, report: () => {} },
          index,
        );
        if (abort.signal.aborted) return;
        owned = await openSource(
          new File([output.blob], 'preview.pdf', { type: 'application/pdf' }),
        );
        if (abort.signal.aborted) {
          await owned.pdf.loadingTask.destroy();
          return;
        }
        setPreview(owned);
      } catch (e) {
        if (!abort.signal.aborted) setError((e as Error).message);
      } finally {
        if (!abort.signal.aborted) setPending(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      abort.abort();
      void owned?.pdf.loadingTask.destroy();
    };
  }, [source, options, index]);
  return (
    <div className="advanced-panel document-colors">
      <div className="advanced-grid">
        <Choice
          label="Farbmodus"
          value={options.mode}
          items={[
            ['native', 'Text & Hintergrund – Text erhalten'],
            ['raster', 'Gesamte Seite als Bild'],
          ]}
          onChange={(v) => change({ ...options, mode: v as DocumentColors['mode'] })}
        />
        <div className="document-color-presets" role="group" aria-label={ui('Farbvorlagen')}>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => change({ ...defaultDocumentColors })}
          >
            {ui('Lesefreundlich')}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              change({ ...defaultDocumentColors, text: '#000000', background: '#ffffff' })
            }
          >
            {ui('Schwarz auf Weiß')}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              change({
                ...defaultDocumentColors,
                mode: 'raster',
                saturation: 0,
                brightness: 8,
                contrast: 10,
              })
            }
          >
            {ui('Graustufen-Druck')}
          </Button>
        </div>
      </div>
      <fieldset disabled={busy} className="document-color-controls">
        <legend>{ui('Farbeinstellungen')}</legend>
        {options.mode === 'native' ? (
          <>
            <div>
              <Tick
                label="Textfarbe ändern"
                value={options.textEnabled}
                onChange={(v) => change({ ...options, textEnabled: v })}
              />
              <label>
                {ui('Textfarbe')}
                <input
                  type="color"
                  aria-label={ui('Textfarbe')}
                  disabled={!options.textEnabled}
                  value={options.text}
                  onChange={(e) => change({ ...options, text: e.target.value })}
                />
                <code>{options.text}</code>
              </label>
            </div>
            <div>
              <Tick
                label="Hintergrund ergänzen"
                value={options.backgroundEnabled}
                onChange={(v) => change({ ...options, backgroundEnabled: v })}
              />
              <label>
                {ui('Hintergrundfarbe')}
                <input
                  type="color"
                  aria-label={ui('Hintergrundfarbe')}
                  disabled={!options.backgroundEnabled}
                  value={options.background}
                  onChange={(e) => change({ ...options, background: e.target.value })}
                />
                <code>{options.background}</code>
              </label>
            </div>
          </>
        ) : (
          (
            [
              ['brightness', 'Helligkeit', -100, 100],
              ['contrast', 'Kontrast', -100, 100],
              ['saturation', 'Sättigung', 0, 200],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {ui(label)}
              <input
                aria-label={ui(label)}
                type="range"
                min={min}
                max={max}
                value={options[key]}
                onChange={(e) => change({ ...options, [key]: Number(e.target.value) })}
              />
              <output>
                {options[key]}
                {key === 'saturation' ? '%' : ''}
              </output>
            </label>
          ))
        )}
      </fieldset>
      <p className="fine">
        {ui(
          options.mode === 'native'
            ? 'Dokumenttext bleibt erhalten. Bilder, Formularfelder und Kommentare werden nicht umgefärbt. Der Hintergrund liegt hinter dem vorhandenen Inhalt.'
            : 'Alle Seiten wurden als Bilder ausgegeben. Textsuche, Formularfelder und Links sind im Ergebnis nicht mehr verfügbar.',
        )}
      </p>
      {options.mode === 'native' && (
        <p className="fine">
          {ui(
            'Deckende Flächen und Scans können den neuen Hintergrund verdecken. Unsichtbarer OCR-Text bleibt unsichtbar.',
          )}
        </p>
      )}
      <PageSelect source={source} page={index} onChange={setPage} />
      <div className="document-color-preview">
        <section>
          <h3>{ui('Original')}</h3>
          <PageStage source={source} page={index} />
        </section>
        <section aria-busy={pending}>
          <h3>{ui('Farbvorschau')}</h3>
          {pending ? (
            <p role="status">{ui('Farbvorschau wird erstellt …')}</p>
          ) : error ? (
            <p role="alert">{ui(error)}</p>
          ) : preview ? (
            <PageStage source={preview} page={0} />
          ) : null}
        </section>
      </div>
      <p className="fine">
        {ui(
          'Die Vorschau zeigt eine Seite. Die Ausgabe wendet die Einstellungen auf alle Seiten an. Maximal 200 Seiten und 80 MB.',
        )}
      </p>
      <Button
        disabled={busy || pending || !!error}
        onClick={() => run((ctx) => exportDocumentColors(source, options, ctx))}
      >
        {ui('Farben auf alle Seiten anwenden')}
      </Button>
    </div>
  );
}
