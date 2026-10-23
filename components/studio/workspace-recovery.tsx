'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { openSource, uid, type Source } from '@/lib/pdf-engine';
import { cleanProjectState, validateProject, type ProjectState } from '@/lib/local-projects';
import {
  listRecoveries,
  loadRecovery,
  storeRecovery,
  clearRecovery,
  type RecoverySummary,
} from '@/lib/workspace-storage';
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
  const [saved, setSaved] = useState<RecoverySummary[]>([]),
    [pending, setPending] = useState<RecoverySummary | null>(null),
    [ready, setReady] = useState(false),
    [working, setWorking] = useState(false),
    [host, setHost] = useState<HTMLElement | null>(null);
  const warned = useRef(false),
    live = useRef(false),
    writable = useRef(false),
    callbacks = useRef({ t, onStatus });
  callbacks.current = { t, onStatus };
  // A fresh identity per mounted tab also isolates duplicated tabs (which can
  // inherit sessionStorage). Each document set has its own writer and snapshot.
  const session = useRef('');
  if (!session.current) session.current = uid();
  const activeKey = useRef('');
  const writers = useRef(
    new Map<
      string,
      ReturnType<typeof createRecoveryWriter<{ sources: Source[]; state: ProjectState }>>
    >(),
  );
  function writerFor(key: string) {
    let writer = writers.current.get(key);
    if (!writer) {
      writer = createRecoveryWriter(
        async ({ sources, state }) => {
          const data = sources.map(({ pdf: _pdf, ...source }) => source);
          validateProject(state, data);
          await storeRecovery(
            { updated: Date.now(), sources: data, state: cleanProjectState(state) },
            key,
          );
        },
        (status) => {
          if (!live.current || activeKey.current !== key) return;
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
      writers.current.set(key, writer);
    }
    return writer;
  }
  useEffect(() => {
    live.current = true;
    const sessionWriters = writers.current;
    setHost(document.getElementById('moinpdf-recovery'));
    let active = true;
    void listRecoveries()
      .then((values) => {
        const value = values[0];
        if (active) {
          setSaved(values);
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
      for (const writer of sessionWriters.values()) void writer.flush();
    };
  }, []);
  useEffect(() => {
    // Opening a new document explicitly begins work in this tab. Other saved
    // snapshots must not block its automatic recovery in the background.
    if (sources.length && pending && !working) {
      setPending(null);
      setReady(true);
    }
  }, [sources.length, pending, working]);
  useEffect(() => {
    writable.current = ready;
    if (!ready || locked || !sources.length) return;
    const documentKey = JSON.stringify(sources.map((s) => s.id).sort());
    const key = session.current + ':' + documentKey;
    if (activeKey.current && activeKey.current !== key)
      void writers.current.get(activeKey.current)?.flush();
    activeKey.current = key;
    writerFor(key).schedule({ sources, state });
  }, [sources, state, ready, locked]);
  useEffect(() => {
    const flush = () => {
      if (writable.current) for (const writer of writers.current.values()) void writer.flush();
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
  async function discard(id = pending?.id || activeKey.current) {
    writable.current = false;
    setReady(false);
    setPending(null);
    let next: RecoverySummary | null = null;
    await writers.current.get(id)?.cancel();
    try {
      if (id) await clearRecovery(id);
      const values = await listRecoveries();
      next = pending?.id === id ? values[0] || null : null;
      if (live.current) {
        setSaved(values);
        setPending(next);
        callbacks.current.onStatus?.({ phase: next ? 'restore' : 'idle' });
      }
    } catch {
      if (live.current) callbacks.current.onStatus?.({ phase: 'error' });
    } finally {
      if (live.current) setReady(!next);
    }
  }
  const discardRef = useRef(discard);
  discardRef.current = discard;
  useEffect(() => {
    const clear = () => {
      void discardRef.current(activeKey.current);
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
      const recovery = await loadRecovery(pending.id);
      if (!recovery)
        throw new Error(
          t(
            'Dieser Arbeitsstand ist nicht mehr verfügbar.',
            'This workspace is no longer available.',
          ),
        );
      const state = projectStateSchema.parse(recovery.state) as ProjectState;
      for (const saved of recovery.sources) {
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
  if (!host || !pending) return null;
  return createPortal(
    <div className="advanced-actions workspace-recovery">
      <Button
        variant="outline"
        size="sm"
        disabled={locked || working || sources.length > 0}
        onClick={() => void restore()}
      >
        {pending.id === saved[0]?.id
          ? t('Letzten Arbeitsstand wiederherstellen', 'Restore previous workspace')
          : t('Arbeitsstand wiederherstellen', 'Restore workspace')}
      </Button>
      <Button variant="ghost" size="sm" disabled={working} onClick={() => void discard()}>
        {t('Verwerfen', 'Discard')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={locked || working}
            aria-label={t('Weitere Optionen zur Wiederherstellung', 'More recovery options')}
            title={t('Weitere Optionen zur Wiederherstellung', 'More recovery options')}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" collisionPadding={12} className="workspace-recovery-menu">
          {saved.length > 1 && (
            <>
              <DropdownMenuLabel>
                {t('Gesicherte Arbeitsstände', 'Saved workspaces')}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={pending.id}
                onValueChange={(id) => setPending(saved.find((value) => value.id === id) || null)}
              >
                {saved.map((value, index) => (
                  <DropdownMenuRadioItem key={value.id} value={value.id}>
                    {t('Arbeitsstand', 'Workspace')} {index + 1} ·{' '}
                    {new Date(value.updated).toLocaleString(t('de-DE', 'en-GB'), {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setPending(null);
              setReady(true);
              callbacks.current.onStatus?.({ phase: 'idle' });
            }}
          >
            {t('Ohne Wiederherstellung beginnen', 'Start without restoring')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>,
    host,
  );
}
