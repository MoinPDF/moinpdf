'use client';
import { useState, type Dispatch, type SetStateAction } from 'react';
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
  type ProjectMeta,
  type ProjectState,
} from '@/lib/local-projects';
import { openSource, type Source } from '@/lib/pdf-engine';
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
  return (
    <>
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
      </Button>
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
          <p className="fine-note">
            Bewusstes Speichern in diesem Browser, ohne Upload. Die gespeicherten PDFs liegen
            unverschlüsselt im Browserspeicher – auch zuvor entsperrte Dateien. Beim Löschen der
            Browserdaten können Projekte verloren gehen. Wichtige Ergebnisse zusätzlich
            herunterladen. Einstellungen und Zwischenergebnisse der Spezialwerkzeuge gehören erst
            nach „Ergebnis übernehmen“ zum Projekt.
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
                          // Protect the current unsaved session before replacing it.
                          const saved = await loadProject(v.id),
                            opened: Source[] = [];
                          if (sources.length)
                            await saveProject(
                              current ? name : 'Automatische Sicherung vor Projektwechsel',
                              current,
                              sources,
                              state,
                            );
                          try {
                            for (const s of saved.sources) {
                              const loaded = await openSource(
                                new File(
                                  [new Uint8Array(s.bytes)],
                                  s.name.replace(/\.[^.]+$/, '') + '.pdf',
                                  {
                                    type: 'application/pdf',
                                  },
                                ),
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
                            if (
                              saved.version.state.pages.some(
                                (x) =>
                                  x.index >= opened.find((s) => s.id === x.sourceId)!.pdf.numPages,
                              )
                            )
                              throw new Error('Ungültige Seitenzahl im Projekt.');
                            onRestore(opened, saved.version.state);
                            setCurrent(p.id);
                            setName(p.name);
                            setOpen(false);
                          } catch (e) {
                            for (const s of opened) await s.pdf.loadingTask.destroy();
                            throw e;
                          }
                        })
                      }
                    >
                      Öffnen
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
