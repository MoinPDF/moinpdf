'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import { downloadBlob, type Source } from '@/lib/pdf-engine';
import {
  batchIdentity,
  batchBytes,
  loadBatch,
  listBatches,
  clearBatch,
  resumeBatch,
  batchZip,
  batchStepCount,
  type BatchQueue,
  type BatchWorkflow,
} from '@/lib/batch-queue';
import type { PanelProps } from './advanced-shared';
export function BatchProgress({
  sources,
  workflow,
  password,
  busy,
  run,
}: {
  sources: Source[];
  workflow: BatchWorkflow;
  password: string;
  busy: boolean;
  run: PanelProps['run'];
}) {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<BatchQueue | null>(null),
    [error, setError] = useState('');
  const [saved, setSaved] = useState<BatchQueue[]>([]);
  const pause = useRef(false),
    signature = JSON.stringify(workflow);
  useEffect(() => {
    const controller = new AbortController();
    setQueue(null);
    setError('');
    void listBatches()
      .then((rows) => {
        if (!controller.signal.aborted) setSaved(rows);
      })
      .catch(() => {});
    void batchIdentity(sources, JSON.parse(signature), controller.signal)
      .then(async (initial) => {
        const saved = await loadBatch(initial.id);
        if (!controller.signal.aborted)
          setQueue(
            saved
              ? {
                  ...saved,
                  files: saved.files.map((f) => ({
                    ...f,
                    status: f.status === 'running' ? 'pending' : f.status,
                  })),
                }
              : initial,
          );
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => {
      controller.abort();
      pause.current = true;
    };
  }, [sources, signature]);
  const start = (retry = false) =>
    run(async (ctx) => {
      if (!queue) return;
      pause.current = false;
      const next = await resumeBatch(queue, sources, password, ctx, {
        pause: () => pause.current,
        retry,
        update: setQueue,
      });
      if (!ctx.signal.aborted && !pause.current && next.files.some((f) => f.status === 'done'))
        return batchZip(next, ctx.signal);
    });
  return (
    <section className="batch-progress" aria-label={t('Stapelstatus', 'Batch progress')}>
      {error && <p role="alert">{error}</p>}
      <div className="advanced-actions">
        <Button
          disabled={busy || !queue || !queue.files.some((f) => f.status === 'pending')}
          onClick={() => void start()}
        >
          {t('Starten / Fortsetzen', 'Start / Resume')}
        </Button>
        <Button
          variant="outline"
          disabled={!busy}
          onClick={() => {
            pause.current = true;
          }}
        >
          {t('Nach diesem Schritt pausieren', 'Pause after this step')}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !queue?.files.some((f) => f.status === 'failed')}
          onClick={() => void start(true)}
        >
          {t('Fehler erneut versuchen', 'Retry failed files')}
        </Button>
      </div>
      {queue && (
        <>
          <p>
            {t(
              'Zwischenstände werden lokal nach jedem Schritt gesichert. Zum Fortsetzen dieselben Dateien und denselben Ablauf öffnen.',
              'Checkpoints are saved locally after each step. Reopen the same files and workflow to resume.',
            )}
          </p>
          <ul>
            {queue.files.map((file, index) => (
              <li key={file.digest + index}>
                <span>
                  {file.name} · {file.step}/{batchStepCount(queue.workflow)} ·{' '}
                  {t(
                    { pending: 'Bereit', running: 'In Arbeit', done: 'Fertig', failed: 'Fehler' }[
                      file.status
                    ],
                    { pending: 'Ready', running: 'Processing', done: 'Done', failed: 'Failed' }[
                      file.status
                    ],
                  )}
                </span>
                {file.error && <p role="alert">{file.error}</p>}
                {file.status === 'done' && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void batchBytes(queue.id, index)
                        .then((blob) => {
                          if (blob) downloadBlob(blob, file.filename);
                        })
                        .catch((e) => setError(e.message))
                    }
                  >
                    {t('Herunterladen', 'Download')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="advanced-actions">
            <Button
              variant="outline"
              disabled={busy || !queue.files.some((f) => f.status === 'done')}
              onClick={() => void run((ctx) => batchZip(queue, ctx.signal))}
            >
              {t('Fertige Dateien als ZIP', 'Completed files as ZIP')}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void clearBatch(queue)
                  .then(() =>
                    setQueue({
                      ...queue,
                      files: queue.files.map((f) => ({
                        ...f,
                        step: 0,
                        next: undefined,
                        size: 0,
                        log: [],
                        status: 'pending',
                        error: undefined,
                      })),
                    }),
                  )
                  .catch((e) => setError(e.message))
              }
            >
              {t('Stapel zurücksetzen', 'Reset batch')}
            </Button>
          </div>
        </>
      )}
      {saved.some((s) => s.id !== queue?.id) && (
        <details>
          <summary>{t('Weitere gespeicherte Stapel', 'Other saved batches')}</summary>
          {saved
            .filter((s) => s.id !== queue?.id)
            .map((s) => (
              <div key={s.id} className="batch-saved">
                <strong>{s.workflow.name}</strong>
                <p>{s.files.map((f) => f.name).join(', ')}</p>
                <Button
                  variant="outline"
                  disabled={busy || !s.files.some((f) => f.status === 'done')}
                  onClick={() => void run((ctx) => batchZip(s, ctx.signal))}
                >
                  {t('Fertige Dateien als ZIP', 'Completed files as ZIP')}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void clearBatch(s)
                      .then(() => setSaved((old) => old.filter((q) => q.id !== s.id)))
                      .catch((e) => setError(e.message))
                  }
                >
                  {t('Gespeicherten Stapel löschen', 'Delete saved batch')}
                </Button>
              </div>
            ))}
        </details>
      )}
    </section>
  );
}
