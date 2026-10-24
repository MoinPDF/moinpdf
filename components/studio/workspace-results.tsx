'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Archive, Download, LoaderCircle, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { downloadBlob, formatSize, uuid, type JobResult } from '@/lib/pdf-engine';
import type { DownloadResult } from '@/lib/result-details';
import {
  storedResults,
  storeResult,
  removeResult,
  clearResults,
  type SavedResult,
} from '@/lib/workspace-storage';
import {
  storedServerJobs,
  inspectServerJob,
  resumeServerJob,
  cancelServerJob,
  type BackgroundJob,
} from '@/lib/document-server';
import { useLanguage } from './appearance';
import { ui, uiLocale } from '@/lib/ui-language';

import { ResultsContext, useWorkspaceResults } from './workspace-result-context';
export { useWorkspaceResults } from './workspace-result-context';
export function WorkspaceResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<SavedResult[]>([]);
  const ids = useRef(new WeakMap<Blob, { id: string; created: number }>());
  const writes = useRef(Promise.resolve());
  const generation = useRef(0);
  const warned = useRef(false);
  useEffect(() => {
    const current = generation.current;
    void storedResults()
      .then((saved) => {
        if (current === generation.current) {
          saved.forEach((s) => ids.current.set(s.blob, s));
          setResults(saved);
        }
      })
      .catch(() => {});
  }, []);
  const remember = useCallback((result: DownloadResult) => {
    if (!result.blob.size) return;
    const meta = ids.current.get(result.blob) || { id: uuid(), created: Date.now() };
    ids.current.set(result.blob, meta);
    const saved = { ...result, ...meta };
    const current = ++generation.current;
    setResults((old) => [saved, ...old.filter((r) => r.id !== saved.id)].slice(0, 10));
    writes.current = writes.current
      .then(async () => {
        const rows = await storeResult(saved);
        if (current === generation.current) setResults(rows);
      })
      .catch(() => {
        if (!warned.current) {
          warned.current = true;
          toast.error(
            ui(
              'Ergebnisse bleiben in dieser Sitzung verfügbar; der lokale Speicher ist nicht verfügbar oder voll. Bitte herunterladen.',
            ),
          );
        }
      });
  }, []);
  const remove = useCallback((id: string) => {
    generation.current++;
    setResults((old) => old.filter((r) => r.id !== id));
    writes.current = writes.current
      .then(async () => {
        await removeResult(id);
      })
      .catch(() => {});
  }, []);
  const clear = useCallback(() => {
    generation.current++;
    setResults([]);
    writes.current = writes.current
      .then(async () => {
        await clearResults();
      })
      .catch(() => {});
  }, []);
  return (
    <ResultsContext.Provider value={{ results, remember, remove, clear }}>
      {children}
    </ResultsContext.Provider>
  );
}

export function WorkspaceTray({
  locked,
  onUse,
  activeJob,
}: {
  locked: boolean;
  onUse: (result: JobResult) => Promise<void>;
  activeJob?: { percent: number; label: string };
}) {
  const { t } = useLanguage();
  const { results, remember, remove } = useWorkspaceResults();
  const [open, setOpen] = useState(false),
    [jobs, setJobs] = useState<BackgroundJob[]>([]),
    [working, setWorking] = useState('');
  const controller = useRef<AbortController | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById('moinpdf-results-bar'));
  }, []);
  const running =
    jobs.filter((job) => ['uploading', 'queued', 'running'].includes(job.status)).length +
    (activeJob ? 1 : 0);
  useEffect(() => {
    const refresh = () => setJobs([...storedServerJobs()]);
    refresh();
    const show = () => setOpen(true);
    window.addEventListener('moinpdf-open-results', show);
    window.addEventListener('moinpdf-jobs', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('moinpdf-open-results', show);
      window.removeEventListener('moinpdf-jobs', refresh);
      window.removeEventListener('storage', refresh);
      controller.current?.abort('detach');
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    void Promise.allSettled(
      storedServerJobs().map((job) => inspectServerJob(job, '', abort.signal)),
    );
    return () => abort.abort('detach');
  }, [open]);
  const work = async (id: string, fn: () => Promise<void>) => {
    setWorking(id);
    try {
      await fn();
    } catch (error) {
      toast.error(ui(String((error as Error).message || error)));
    } finally {
      setWorking('');
    }
  };
  const use = async (result: DownloadResult) => {
    await onUse({
      ...result,
      kind: 'pdf',
      pages: result.pages || 0,
      inputSize: result.inputSize || result.blob.size,
    });
    setOpen(false);
  };
  return (
    <>
      {host &&
        (results.length > 0 || jobs.length > 0 || activeJob) &&
        createPortal(
          <button
            type="button"
            className="results-shortcut"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            {running ? <LoaderCircle size={18} className="spin" /> : <Archive size={18} />}
            <span>
              {results.length
                ? `${results.length} ${t('Ergebnisse', 'results')}`
                : t('Aufträge', 'Jobs')}
            </span>
            {running > 0 && (
              <small>
                {running} {t('läuft', 'running')}
              </small>
            )}
          </button>,
          host,
        )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent placement="bottom" className="workspace-tray">
          <DialogHeader>
            <DialogTitle>{t('Ergebnisse und Aufträge', 'Results and jobs')}</DialogTitle>
            <DialogDescription>
              {t(
                'Die letzten zehn Ergebnisse werden lokal gespeichert (zusammen höchstens 160 MB). Serveraufträge bleiben 24 Stunden abrufbar.',
                'The latest ten results are saved locally (up to 160 MB in total). Server jobs remain available for 24 hours.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="workspace-tray-list">
            {activeJob && (
              <section
                className="advanced-card"
                aria-label={t('Aktuelle Verarbeitung', 'Current processing')}
              >
                <strong>{t('In Arbeit', 'In progress')}</strong>
                <p>{ui(activeJob.label)}</p>
                <progress
                  value={activeJob.percent}
                  max={100}
                  aria-label={t('Verarbeitungsfortschritt', 'Processing progress')}
                />
                <span>{Math.round(activeJob.percent)} %</span>
              </section>
            )}
            {!results.length && !jobs.length && !activeJob && (
              <p className="text-center">
                {t(
                  'Hier findest du deine nächsten Ergebnisse.',
                  'Your next results will appear here.',
                )}
              </p>
            )}
            {jobs.map((job) => (
              <section className="advanced-card" key={job.id}>
                <strong>{job.name}</strong>
                <p className="fine-note">
                  {t('Serverauftrag', 'Server job')} ·{' '}
                  {
                    {
                      uploading: t('Übertragung prüfen', 'Check upload'),
                      queued: t('Wartet', 'Queued'),
                      running: t('In Arbeit', 'Running'),
                      completed: t('Fertig', 'Completed'),
                      cancelled: t('Abgebrochen', 'Cancelled'),
                      failed: t('Fehlgeschlagen', 'Failed'),
                    }[job.status]
                  }
                </p>
                {job.error && <p role="alert">{t(job.error)}</p>}
                <div className="advanced-actions">
                  {!['cancelled', 'failed'].includes(job.status) && (
                    <Button
                      disabled={!!working}
                      onClick={() =>
                        void work(job.id, async () => {
                          controller.current = new AbortController();
                          const result = await resumeServerJob(job, '', controller.current.signal);
                          remember(result);
                          downloadBlob(result.blob, result.filename);
                        })
                      }
                    >
                      {working === job.id ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Download size={16} />
                      )}{' '}
                      {t('Ergebnis abrufen', 'Get result')}
                    </Button>
                  )}
                  {['uploading', 'queued', 'running'].includes(job.status) && (
                    <Button
                      variant="outline"
                      onClick={() => void work(job.id, () => cancelServerJob(job, ''))}
                    >
                      {t('Abbrechen', 'Cancel')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    aria-label={t('Auftrag löschen', 'Delete job')}
                    disabled={job.status === 'running'}
                    onClick={() =>
                      void work(job.id, async () => {
                        await cancelServerJob(job, '', true);
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </section>
            ))}
            {results.map((result) => (
              <section className="advanced-card" key={result.id}>
                <strong>{result.filename}</strong>
                <p className="fine-note">
                  {formatSize(result.blob.size, uiLocale())} ·{' '}
                  {new Date(result.created).toLocaleString(uiLocale())}
                </p>
                <div className="advanced-actions">
                  <Button onClick={() => downloadBlob(result.blob, result.filename)}>
                    <Download size={16} />
                    {t('Herunterladen', 'Download')}
                  </Button>
                  {result.blob.type.includes('pdf') && (
                    <Button
                      variant="outline"
                      disabled={locked || !!working}
                      onClick={() => void work(result.id, () => use(result))}
                    >
                      {t('Weiterbearbeiten', 'Keep editing')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    aria-label={t('Ergebnis löschen', 'Delete result')}
                    onClick={() => remove(result.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
