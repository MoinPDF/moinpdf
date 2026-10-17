'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { openSource, type Source } from '@/lib/pdf-engine';
import { cleanProjectState, validateProject, type ProjectState } from '@/lib/local-projects';
import { loadRecovery, storeRecovery, clearRecovery, type Recovery } from '@/lib/workspace-storage';
import { useLanguage } from './appearance';

export function WorkspaceRecovery({
  sources,
  state,
  locked,
  onRestore,
}: {
  sources: Source[];
  state: ProjectState;
  locked: boolean;
  onRestore: (sources: Source[], state: ProjectState) => void;
}) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<Recovery | null>(null),
    [ready, setReady] = useState(false),
    [working, setWorking] = useState(false),
    [host, setHost] = useState<HTMLElement | null>(null);
  const writes = useRef(Promise.resolve()),
    warned = useRef(false);
  const latest = useRef({ sources, state });
  latest.current = { sources, state };
  useEffect(() => {
    setHost(document.getElementById('moinpdf-recovery'));
    let live = true;
    void loadRecovery()
      .then((value) => {
        if (live) {
          setPending(value || null);
          setReady(!value);
        }
      })
      .catch(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || locked || !sources.length) return;
    const timer = setTimeout(() => {
      const { sources, state } = latest.current;
      const data = sources.map(({ pdf: _pdf, ...source }) => source);
      writes.current = writes.current
        .then(async () => {
          validateProject(state, data);
          await storeRecovery({
            updated: Date.now(),
            sources: data,
            state: cleanProjectState(state),
          });
        })
        .catch(() => {
          if (!warned.current) {
            warned.current = true;
            toast.error(
              t(
                'Automatische Sicherung nicht möglich. Bitte das Projekt speichern oder herunterladen.',
                'Automatic recovery is unavailable. Please save or download the project.',
              ),
            );
          }
        });
    }, 1200);
    return () => clearTimeout(timer);
  }, [sources, state, ready, locked, t]);
  useEffect(() => {
    const clear = () => {
      setPending(null);
      setReady(true);
      writes.current = writes.current
        .then(async () => {
          await clearRecovery();
        })
        .catch(() => {});
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
      <Button
        variant="ghost"
        size="sm"
        disabled={working}
        onClick={() => {
          setPending(null);
          setReady(true);
          void clearRecovery().catch(() => {});
        }}
      >
        {t('Verwerfen', 'Discard')}
      </Button>
    </div>,
    host,
  );
}
