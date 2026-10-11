'use client';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { decodeProjectFile, encodeProjectFile, validateOpenedProject } from '@/lib/project-archive';
import { isProjectArchive, encodeProjectArchive, decodeProjectArchive } from '@/lib/project-bundle';
import './project-manager.css';
export function ProjectManager({
  sources,
  state,
  locked,
  onRestore,
  identity,
  setIdentity,
}: {
  sources: Source[];
  state: ProjectState;
  locked: boolean;
  onRestore: (sources: Source[], state: ProjectState) => void;
  identity: { id?: string; name: string };
  setIdentity: Dispatch<SetStateAction<{ id?: string; name: string }>>;
}) {
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
  const job = async (work: () => Promise<void>) => {
    if (working || locked) return;
    setWorking(true);
    setNotice('');
    try {
      await work();
    } catch (e) {
      setNotice((e as Error).message || 'Der lokale Speicher ist nicht verfügbar.');
    } finally {
      setWorking(false);
    }
  };
  const refresh = async () => setProjects(await listProjects());
  const download = async (name: string, data: ProjectSource[], snapshot: ProjectState) => {
    const blob = await encodeProjectFile(name, data, snapshot);
    downloadBlob(blob, filenameStem(name + '.moinpdf') + '.moinpdf');
    setNotice(
      'Projektdatei heruntergeladen. Sie enthält diesen Arbeitsstand einschließlich Rückgängig-Verlauf.',
    );
  };
  const openSnapshot = async (data: ProjectSource[], snapshot: ProjectState) => {
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
      onRestore(opened, snapshot);
      setIdentity({ id: restoredId, name });
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
          <Button
            className="project-toggle"
            variant="outline"
            disabled={locked || working}
            onClick={() => {
              setOpen(true);
              void job(refresh);
            }}
          >
            <FolderOpen size={16} />
            Projekte
          </Button>,
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
            <DialogTitle>Lokale PDF-Projekte</DialogTitle>
            <DialogDescription>
              Dateien, Seitenanordnung, Editoränderungen, Formulare, Lesezeichen und
              Rückgängig-Verlauf später fortsetzen. Gespeichert werden die letzten fünf von dir
              angelegten Arbeitsstände.
            </DialogDescription>
          </DialogHeader>
          <label className="advanced-field">
            <span>Projektname</span>
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
                  const projectId = await saveProject(name, current, sources, state);
                  setCurrent(projectId);
                  await refresh();
                  setNotice('Arbeitsstand gespeichert.');
                })
              }
            >
              {current ? 'Neuen Arbeitsstand speichern' : 'Projekt speichern'}
            </Button>
            <Button
              variant="outline"
              disabled={working}
              onClick={() => {
                setCurrent(undefined);
                setName('Neues PDF-Projekt');
              }}
            >
              Als neues Projekt
            </Button>
          </div>
          <div className="project-actions">
            <Button
              variant="outline"
              disabled={working || locked || !sources.length}
              onClick={() => job(() => download(name, sources, state))}
            >
              Projektdatei herunterladen
            </Button>
            <Button
              variant="outline"
              disabled={working || locked}
              onClick={() => importInput.current?.click()}
            >
              Projektdatei öffnen
            </Button>
            <input
              ref={importInput}
              type="file"
              accept=".moinpdf,application/vnd.moinpdf.project,application/vnd.moinpdf.archive"
              className="sr-only"
              aria-label="MoinPDF-Projektdatei"
              disabled={working || locked}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file)
                  void job(async () => {
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
                      const imported = await decodeProjectFile(file);
                      await restore(imported.name, imported.sources, imported.state);
                    }
                  });
              }}
            />
          </div>
          <p className="fine-note">
            Bewusstes Speichern in diesem Browser, ohne Upload. Die gespeicherten PDFs liegen
            unverschlüsselt im Browserspeicher – auch zuvor entsperrte Dateien. Beim Löschen der
            Browserdaten können Projekte verloren gehen. Eine .moinpdf-Projektdatei überträgt den
            gewählten Stand auf einen anderen Browser oder Computer. Das Gesamtarchiv umfasst alle
            bis zu fünf gespeicherten Stände; beim Import entsteht ein neues Projekt. Beide
            enthalten auch Originale, frühere Bearbeitungen und gegebenenfalls entsperrte PDFs
            unverschlüsselt. Zum Weitergeben eines fertigen Dokuments die Ergebnis-PDF verwenden.
            Einstellungen und Zwischenergebnisse der Spezialwerkzeuge gehören erst nach „Ergebnis
            übernehmen“ zum Projekt.
          </p>
          {notice && <p role="status">{notice}</p>}
          {working && <p role="status">Arbeitsstand wird verarbeitet …</p>}
          <div className="project-list">
            {!projects.length && !working && <p>Noch keine gespeicherten Projekte.</p>}
            {projects.map((p) => (
              <section key={p.id}>
                <h3>
                  {p.name}
                  {current === p.id ? ' · aktiv' : ''}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={working || locked}
                  onClick={() =>
                    job(async () => {
                      const archive = await loadProjectArchive(p.id);
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
                  Gesamtes Projektarchiv herunterladen
                </Button>
                {p.versions.map((v, i) => (
                  <div className="project-version" key={v.id}>
                    <span>
                      {new Date(v.created).toLocaleString('de-DE')} · {v.pages} Seiten
                      {i === 0 ? ' · neuester Stand' : ''}
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
                      Öffnen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working || locked}
                      aria-label={`Arbeitsstand ${i + 1} von ${p.name} herunterladen`}
                      onClick={() =>
                        job(async () => {
                          const saved = await loadProject(v.id);
                          await download(p.name, saved.sources, saved.version.state);
                        })
                      }
                    >
                      Herunterladen
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={working}
                  onClick={() => setDeleteId(deleteId === p.id ? '' : p.id)}
                >
                  Projekt löschen
                </Button>
                {deleteId === p.id && (
                  <div className="project-actions">
                    <span>Alle gespeicherten Stände von „{p.name}“ löschen?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={working}
                      onClick={() =>
                        job(async () => {
                          await deleteProject(p.id);
                          if (current === p.id) setCurrent(undefined);
                          setDeleteId('');
                          await refresh();
                        })
                      }
                    >
                      Endgültig löschen
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleteId('')}>
                      Abbrechen
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
