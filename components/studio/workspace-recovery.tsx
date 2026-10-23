'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { openSource, type Source } from '@/lib/pdf-engine';
import { cleanProjectState, validateProject, type ProjectState } from '@/lib/local-projects';
import { loadRecovery, storeRecovery, clearRecovery, type Recovery } from '@/lib/workspace-storage';
import { useLanguage } from './appearance';
import { createRecoveryWriter, type RecoveryStatus } from '@/lib/recovery-writer';

export function WorkspaceRecovery({
  sources,
  state,
  locked,
  onRestore,
  onStatus,
}: {
  sources: Source[];
  state: ProjectState;
  locked: boolean;
  onRestore: (sources: Source[], state: ProjectState) => void;
  onStatus?: (status: RecoveryStatus) => void;
}) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<Recovery | null>(null),
    [ready, setReady] = useState(false),
    [working, setWorking] = useState(false),
    [host, setHost] = useState<HTMLElement | null>(null);
  const warned = useRef(false),
    live = useRef(false),
    writable = useRef(false),
    callbacks = useRef({ t, onStatus });
  callbacks.current = { t, onStatus };
  const writer = useRef<ReturnType<
    typeof createRecoveryWriter<{ sources: Source[]; state: ProjectState }>
  > | null>(null);
  if (!writer.current)
    writer.current = createRecoveryWriter(
      async ({ sources, state }) => {
        const data = sources.map(({ pdf: _pdf, ...source }) => source);
        validateProject(state, data);
        await storeRecovery({
          updated: Date.now(),
          sources: data,
          state: cleanProjectState(state),
        });
      },
      (status) => {
        if (!live.current) return;
        callbacks.current.onStatus?.(status);
        if (status.phase === 'saved') warned.current = false;
        if (status.phase === 'error' && !warned.current) {
          warned.current = true;
          toast.error(
            callbacks.current.t(
              'Automatische Sicherung nicht möglich. Bitte das Projekt speichern oder herunterladen.',
              'Automatic recovery is unavailable. Please save or download the project.',
            ),
          );
        }
      },
    );
  useEffect(() => {
    live.current = true;
    setHost(document.getElementById('moinpdf-recovery'));
    let active = true;
    void loadRecovery()
      .then((value) => {
        if (active) {
          setPending(value || null);
          setReady(!value);
          callbacks.current.onStatus?.({ phase: value ? 'restore' : 'idle' });
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      live.current = false;
      void writer.current?.cancel();
    };
  }, []);
  useEffect(() => {
    writable.current = ready;
    if (!ready || locked || !sources.length) return;
    writer.current!.schedule({ sources, state });
  }, [sources, state, ready, locked]);
  useEffect(() => {
    const flush = () => {
      if (writable.current) void writer.current!.flush();
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  async function discard() {
    writable.current = false;
    setReady(false);
    setPending(null);
    await writer.current!.cancel();
    try {
      await clearRecovery();
      if (live.current) callbacks.current.onStatus?.({ phase: 'idle' });
    } catch {
      if (live.current) callbacks.current.onStatus?.({ phase: 'error' });
    } finally {
      if (live.current) setReady(true);
    }
  }
  const discardRef = useRef(discard);
  discardRef.current = discard;
  useEffect(() => {
    const clear = () => {
      void discardRef.current();
    };
    window.addEventListener('moinpdf-clear-workspace', clear);
    return () => window.removeEventListener('moinpdf-clear-workspace', clear);
  }, []);
  async function restore() {
    if (!pending || locked || working) return;
    setWorking(true);
    const opened: Source[] = [];
    try {
      const { projectStateSchema, validateOpenedProject } = await import('@/lib/project-archive');
      const state = projectStateSchema.parse(pending.state) as ProjectState;
      for (const saved of pending.sources) {
        const source = await openSource(
          new File([new Uint8Array(saved.bytes)], saved.name, { type: 'application/pdf' }),
        );
        opened.push({ ...source, ...saved, pdf: source.pdf });
      }
      validateOpenedProject(state, opened);
      onRestore(opened, state);
      setPending(null);
      setReady(true);
    } catch (error) {
      opened.forEach((s) => void s.pdf.loadingTask.destroy());
      toast.error((error as Error).message);
    } finally {
      setWorking(false);
    }
  }
  if (!pending || !host) return null;
  return createPortal(
    <div className="advanced-actions">
      <Button
        variant="outline"
        size="sm"
        disabled={locked || working || sources.length > 0}
        onClick={() => void restore()}
      >
        {t('Letzten Arbeitsstand wiederherstellen', 'Restore previous workspace')}
      </Button>
      <Button variant="ghost" size="sm" disabled={working} onClick={() => void discard()}>
        {t('Verwerfen', 'Discard')}
      </Button>
    </div>,
    host,
  );
}
