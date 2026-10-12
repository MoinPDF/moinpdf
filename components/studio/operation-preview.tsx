'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useRef, useState } from 'react';
import { openSource, type Source } from '@/lib/pdf-engine';
import type { ExportFile } from '@/lib/advanced-types';
import { PageStage, PageSelect, Tick } from './advanced-shared';
export function OperationPreview({
  version,
  build,
  busy,
}: {
  version: string;
  build: (signal: AbortSignal) => Promise<ExportFile>;
  busy: boolean;
}) {
  useLanguage();
  const [enabled, setEnabled] = useState(true),
    [preview, setPreview] = useState<Source | null>(null),
    [page, setPage] = useState(0),
    [notice, setNotice] = useState('');
  const builder = useRef(build);
  builder.current = build;
  useEffect(() => {
    if (!enabled || busy) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    let opened: Source | null = null;
    setPreview(null);
    setNotice('Vorschau wird aktualisiert …');
    const timer = setTimeout(
      () =>
        void (async () => {
          try {
            const result = await builder.current(controller.signal);
            if (result.kind !== 'pdf')
              throw new Error('Für die Vorschau bitte eine einzelne PDF auswählen.');
            controller.signal.throwIfAborted();
            opened = await openSource(
              new File([result.blob], result.filename, { type: 'application/pdf' }),
            );
            if (controller.signal.aborted) {
              await opened.pdf.loadingTask.destroy();
              opened = null;
              return;
            }
            setPreview(opened);
            setPage((p) => Math.min(p, opened!.pdf.numPages - 1));
            setNotice('');
          } catch (error) {
            if (!controller.signal.aborted)
              setNotice(error instanceof Error ? error.message : 'Vorschau fehlgeschlagen.');
          }
        })(),
      650,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (opened) void opened.pdf.loadingTask.destroy();
    };
  }, [version, enabled, busy]);
  return (
    <section aria-label={ui('Live-Vorschau')} className="advanced-card">
      <Tick
        label={ui('Vorschau bei Änderungen automatisch aktualisieren')}
        value={enabled}
        onChange={setEnabled}
      />
      {enabled && notice && <p role="status">{ui(notice)}</p>}
      {enabled && preview && (
        <>
          <h3>{ui('Ergebnisvorschau')}</h3>
          <PageSelect source={preview} page={page} onChange={setPage} />
          <PageStage source={preview} page={page} />
        </>
      )}
    </section>
  );
}
