'use client';
import { ui, uiLocale } from '@/lib/ui-language';

import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  captureProjectCheckpoint,
  matchesProjectCheckpoint,
  projectContentSignature,
  type ProjectCheckpoint,
} from '@/lib/project-checkpoint';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  listProjects,
  saveProject,
  loadProject,
  deleteProject,
  loadProjectArchive,
  importProjectArchive,
  type ProjectArchive,
  type ProjectMeta,
  type ProjectState,
  type ProjectSource,
} from '@/lib/local-projects';
import { openSource, filenameStem, downloadBlob, type Source } from '@/lib/pdf-engine';
import './project-manager.css';
export function ProjectManager({
  sources,
  state,
  locked,
  onRestore,
  identity,
  setIdentity,
  checkpoint,
  onCheckpoint,
  onBusy,
}: {
  sources: Source[];
  state: ProjectState;
  locked: boolean;
  onRestore: (
    sources: Source[],
    state: ProjectState,
    identity: { id: string; name: string },
  ) => void;
  identity: { id?: string; name: string };
  setIdentity: Dispatch<SetStateAction<{ id?: string; name: string }>>;
  checkpoint: ProjectCheckpoint | null;
  onCheckpoint: (checkpoint: ProjectCheckpoint | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false),
    [working, setWorking] = useState(false),
    [projects, setProjects] = useState<ProjectMeta[]>([]),
    [notice, setNotice] = useState(''),
    [deleteId, setDeleteId] = useState('');
  const importInput = useRef<HTMLInputElement>(null);
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  useEffect(() => setToolbar(document.getElementById('moinpdf-project-bar')), []);
  const name = identity.name,
    current = identity.id,
    setName = (name: string) => setIdentity((old) => ({ ...old, name })),
    setCurrent = (id: string | undefined) => setIdentity((old) => ({ ...old, id }));
  const { pages, edits, options, documentSessions } = state;
  const content = useMemo(
    () => projectContentSignature(name, { pages, edits, options, documentSessions }),
    [name, pages, edits, options, documentSessions],
  );
  const saved = matchesProjectCheckpoint(checkpoint, current, sources, content);
  const saveStatus = !sources.length ? 'empty' : saved ? 'saved' : 'dirty';
  const statusLabel = !sources.length
    ? t('Keine Dateien geöffnet')
    : saved
      ? t('Gespeichert', 'Saved')
      : t('Ungespeicherte Änderungen', 'Unsaved changes');
  const job = async (work: () => Promise<void>) => {
    if (working || locked) return;
    setWorking(true);
    onBusy(true);
    setNotice('');
    try {
      await work();
    } catch (e) {
      setNotice((e as Error).message || 'Der lokale Speicher ist nicht verfügbar.');
    } finally {
      setWorking(false);
      onBusy(false);
    }
  };
  const refresh = async () => setProjects(await listProjects());
  const download = async (name: string, data: ProjectSource[], snapshot: ProjectState) => {
    const { encodeProjectFile } = await import('@/lib/project-archive');
    const blob = await encodeProjectFile(name, data, snapshot);
    downloadBlob(blob, filenameStem(name + '.moinpdf') + '.moinpdf');
    setNotice(
      'Projektdatei heruntergeladen. Sie enthält diesen Arbeitsstand einschließlich Rückgängig-Verlauf.',
    );
  };
  const openSnapshot = async (data: ProjectSource[], snapshot: ProjectState) => {
    const { validateOpenedProject } = await import('@/lib/project-archive');
    const opened: Source[] = [];
    try {
      for (const s of data) {
        const loaded = await openSource(
          new File([new Uint8Array(s.bytes)], filenameStem(s.name) + '.pdf', {
            type: 'application/pdf',
          }),
        );
        opened.push({
          ...loaded,
          id: s.id,
          name: s.name,
          kind: s.kind,
          size: s.size,
          wasEncrypted: s.wasEncrypted,
          invoiceOriginal: s.invoiceOriginal,
          originalDigest: s.originalDigest,
        });
      }
      validateOpenedProject(snapshot, opened);
      return opened;
    } catch (e) {
      for (const s of opened) await s.pdf.loadingTask.destroy();
      throw e;
    }
  };
  const restore = async (
    name: string,
    data: ProjectSource[],
    snapshot: ProjectState,
    projectId?: string,
    archive?: ProjectArchive,
  ) => {
    const opened = await openSnapshot(data, snapshot);
    try {
      // Validate all files before changing local projects or replacing a session.
      if (sources.length)
        await saveProject(
          current ? identity.name : 'Automatische Sicherung vor Projektwechsel',
          current,
          sources,
          state,
        );
      const restoredId =
        projectId ||
        (archive
          ? await importProjectArchive(archive)
          : await saveProject(name, undefined, opened, snapshot));
      onRestore(opened, snapshot, { id: restoredId, name });
      setOpen(false);
    } catch (e) {
      for (const s of opened) await s.pdf.loadingTask.destroy();
      throw e;
    }
  };
  return (
    <>
      {toolbar &&
        createPortal(
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="project-toggle"
                  variant="outline"
                  aria-label={`${t('Projekte')} – ${statusLabel}`}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  disabled={locked || working}
                  onClick={() => {
                    setOpen(true);
                    void job(refresh);
                  }}
                >
                  <FolderOpen size={20} aria-hidden="true" />
                  <span>{t('Projekte')}</span>
                  {sources.length > 0 && (
                    <span
                      className="project-save-indicator"
                      data-state={saveStatus}
                      aria-hidden="true"
                    />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                {statusLabel}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>,
          toolbar,
        )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!working) setOpen(v);
        }}
      >
        <DialogContent className="project-dialog">
          <DialogHeader>
            <DialogTitle>{t('Lokale PDF-Projekte')}</DialogTitle>
            <DialogDescription>
              {t(
                'Dateien, Seitenanordnung, Editoränderungen, Formulare, Lesezeichen und Rückgängig-Verlauf später fortsetzen. Gespeichert werden die letzten fünf von dir angelegten Arbeitsstände.',
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="project-save-status" data-state={saveStatus} role="status">
            <span aria-hidden="true" className="project-save-indicator" data-state={saveStatus} />
            {statusLabel}
          </p>
          <label className="advanced-field">
            <span>{t('Projektname')}</span>
            <input
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              disabled={working}
            />
          </label>
          <div className="project-actions">
            <Button
              disabled={working || locked || !sources.length}
              onClick={() =>
                job(async () => {
                  const savedCheckpoint = captureProjectCheckpoint(
                    current ?? '',
                    name,
                    sources,
                    state,
                  );
                  const projectId = await saveProject(name, current, sources, state);
                  setCurrent(projectId);
                  onCheckpoint({ ...savedCheckpoint, projectId });
                  const message = t('Alles an Bord – gespeichert.', 'All aboard – saved.');
                  setNotice(message);
                  toast.success(message);
                  await refresh();
                })
              }
            >
              {current ? t('Neuen Arbeitsstand speichern') : t('Projekt speichern')}
            </Button>
            <Button
              variant="outline"
              disabled={working}
              onClick={() => {
                onCheckpoint(null);
                setCurrent(undefined);
                setName('Neues PDF-Projekt');
              }}
            >
              {t('Als neues Projekt')}
            </Button>
          </div>
          <div className="project-actions">
            <Button
              variant="outline"
              disabled={working || locked || !sources.length}
              onClick={() => job(() => download(name, sources, state))}
            >
              {t('Projektdatei herunterladen')}
            </Button>
            <Button
              variant="outline"
              disabled={working || locked}
              onClick={() => importInput.current?.click()}
            >
              {t('Projektdatei öffnen')}
            </Button>
            <input
              ref={importInput}
              type="file"
              accept=".moinpdf,application/vnd.moinpdf.project,application/vnd.moinpdf.archive"
              className="sr-only"
              aria-label={ui('MoinPDF-Projektdatei')}
              disabled={working || locked}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file)
                  void job(async () => {
                    const { isProjectArchive, decodeProjectArchive } =
                      await import('@/lib/project-bundle');
                    if (await isProjectArchive(file)) {
                      const archive = await decodeProjectArchive(file);
                      // Validate every retained PDF/history before committing any imported version.
                      for (const version of archive.versions.slice(1)) {
                        const checked = await openSnapshot(version.sources, version.state);
                        for (const source of checked) await source.pdf.loadingTask.destroy();
                      }
                      const latest = archive.versions[0];
                      await restore(archive.name, latest.sources, latest.state, undefined, archive);
                    } else {
                      const { decodeProjectFile } = await import('@/lib/project-archive');
                      const imported = await decodeProjectFile(file);
                      await restore(imported.name, imported.sources, imported.state);
                    }
                  });
              }}
            />
          </div>
          <p className="fine-note">
            {ui(
              'Bewusstes Speichern in diesem Browser, ohne Upload. Die gespeicherten PDFs liegen unverschlüsselt im Browserspeicher – auch zuvor entsperrte Dateien. Beim Löschen der Browserdaten können Projekte verloren gehen. Eine .moinpdf-Projektdatei überträgt den gewählten Stand auf einen anderen Browser oder Computer. Das Gesamtarchiv umfasst alle bis zu fünf gespeicherten Stände; beim Import entsteht ein neues Projekt. Beide enthalten auch Originale, frühere Bearbeitungen und gegebenenfalls entsperrte PDFs unverschlüsselt. Zum Weitergeben eines fertigen Dokuments die Ergebnis-PDF verwenden. Einstellungen und Zwischenergebnisse der Spezialwerkzeuge gehören erst nach „Ergebnis übernehmen“ zum Projekt.',
            )}
          </p>
          {notice && <p role="status">{ui(notice)}</p>}
          {working && <p role="status">{t('Arbeitsstand wird verarbeitet …')}</p>}
          <div className="project-list">
            {!projects.length && !working && <p>{t('Noch keine gespeicherten Projekte.')}</p>}
            {projects.map((p) => (
              <section key={p.id}>
                <h3>
                  {p.name}
                  {current === p.id ? ui(' · aktiv') : ''}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={working || locked}
                  onClick={() =>
                    job(async () => {
                      const archive = await loadProjectArchive(p.id);
                      const { encodeProjectArchive } = await import('@/lib/project-bundle');
                      downloadBlob(
                        await encodeProjectArchive(archive),
                        filenameStem(p.name + '.moinpdf') + '-gesamt.moinpdf',
                      );
                      setNotice(
                        `Gesamtarchiv mit ${archive.versions.length} gespeicherten Arbeitsständen heruntergeladen.`,
                      );
                    })
                  }
                >
                  {t('Gesamtes Projektarchiv herunterladen')}
                </Button>
                {p.versions.map((v, i) => (
                  <div className="project-version" key={v.id}>
                    <span>
                      {new Date(v.created).toLocaleString(uiLocale())} · {v.pages} {t('Seiten')}
                      {i === 0 ? ui(' · neuester Stand') : ''}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working || locked}
                      onClick={() =>
                        job(async () => {
                          const saved = await loadProject(v.id);
                          await restore(p.name, saved.sources, saved.version.state, p.id);
                        })
                      }
                    >
                      {t('Öffnen')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working || locked}
                      aria-label={ui(`Arbeitsstand ${i + 1} von ${p.name} herunterladen`)}
                      onClick={() =>
                        job(async () => {
                          const saved = await loadProject(v.id);
                          await download(p.name, saved.sources, saved.version.state);
                        })
                      }
                    >
                      {t('Herunterladen')}
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={working}
                  onClick={() => setDeleteId(deleteId === p.id ? '' : p.id)}
                >
                  {t('Projekt löschen')}
                </Button>
                {deleteId === p.id && (
                  <div className="project-actions">
                    <span>
                      {t('Alle gespeicherten Stände von „')}
                      {p.name}
                      {t('“ löschen?')}
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={working}
                      onClick={() =>
                        job(async () => {
                          await deleteProject(p.id);
                          if (current === p.id) {
                            onCheckpoint(null);
                            setCurrent(undefined);
                          }
                          setDeleteId('');
                          await refresh();
                        })
                      }
                    >
                      {t('Endgültig löschen')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleteId('')}>
                      {t('Abbrechen')}
                    </Button>
                  </div>
                )}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
