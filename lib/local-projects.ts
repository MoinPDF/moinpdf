import { stringifyEditorProject } from './editor-project-codec';
import type { Source, PageItem } from './pdf-engine';
import type { Edits, StudioOptions } from './studio-engine';
import type { DocumentSessions } from './document-tools';
export type ProjectSnapshot = {
  pages: PageItem[];
  edits: Edits;
  sourceIds?: string[];
  documentSessions?: DocumentSessions;
  activeId?: string;
};
export type ProjectState = ProjectSnapshot & {
  viewState?: {
    zoom: number;
    view: string;
    scrollX: number;
    scrollY: number;
    documentX: number;
    documentY: number;
  };
  toolDrafts?: Record<string, unknown>;
  options: StudioOptions;
  history: ProjectSnapshot[];
  future: ProjectSnapshot[];
  documentSessions: DocumentSessions;
  activeId: string;
  toolId: string;
};
export type ProjectSource = Omit<Source, 'pdf'>;
export type ProjectMeta = {
  id: string;
  name: string;
  updated: number;
  versions: { id: string; created: number; pages: number }[];
};
export type ProjectVersion = {
  id: string;
  projectId: string;
  created: number;
  sourceIds: string[];
  sourceKeys?: string[];
  state: ProjectState;
};
export type ProjectArchive = {
  name: string;
  updated: number;
  versions: { created: number; sources: ProjectSource[]; state: ProjectState }[];
};
// Each undo snapshot owns its own page edits. Discard orphaned data in the
// current snapshot without erasing edits that a retained undo step still needs.
export function retainPageEdits(edits: Edits, pages: PageItem[]): Edits {
  const ids = new Set(pages.map((page) => page.id));
  return {
    marks: Object.fromEntries(Object.entries(edits.marks).filter(([id]) => ids.has(id))),
    crops: Object.fromEntries(Object.entries(edits.crops).filter(([id]) => ids.has(id))),
  };
}
export function cleanProjectState(state: ProjectState): ProjectState {
  const clean = (snapshot: ProjectSnapshot): ProjectSnapshot => ({
    ...snapshot,
    edits: retainPageEdits(snapshot.edits, snapshot.pages),
  });
  return {
    ...state,
    edits: retainPageEdits(state.edits, state.pages),
    history: state.history.map(clean),
    future: state.future.map(clean),
  };
}
const database = 'moinpdf.projects.v1';
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(database, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('projects', { keyPath: 'id' });
      d.createObjectStore('documents', { keyPath: 'key' }).createIndex('projectId', 'projectId');
      d.createObjectStore('versions', { keyPath: 'id' }).createIndex('projectId', 'projectId');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(new Error('Bitte andere geöffnete MoinPDF-Tabs schließen und erneut versuchen.'));
  });
}
const completed = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Speichern fehlgeschlagen.'));
    tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen.'));
  });
const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const id = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
export function validateProject(state: ProjectState, sources: ProjectSource[]) {
  if (
    !sources.length ||
    sources.length > 600 ||
    state.pages.length > 200 ||
    sources.reduce((n, s) => n + s.bytes.length + (s.invoiceOriginal?.bytes.length || 0), 0) >
      240 * 1024 * 1024
  )
    throw new Error(
      'Ein Projekt darf höchstens 200 aktive Seiten und 240 MB PDF-Daten einschließlich Verlauf enthalten.',
    );
  if (
    new Set(sources.map((s) => s.id)).size !== sources.length ||
    new Set(state.pages.map((p) => p.id)).size !== state.pages.length ||
    state.pages.some(
      (p) => !sources.some((s) => s.id === p.sourceId) || !Number.isInteger(p.index) || p.index < 0,
    )
  )
    throw new Error('Der Projektstand enthält ungültige Seitenverweise.');
  if (stringifyEditorProject(state).length > 20 * 1024 * 1024)
    throw new Error(
      'Dieser Arbeitsstand enthält zu viele Bearbeitungsdaten. Bitte das aktuelle PDF-Ergebnis übernehmen und dann speichern.',
    );
}
// Keep the large tool schema off the initial application path. Storage awaits
// validation before opening a write transaction, including automatic recovery.
export async function validateStoredProject(state: ProjectState, sources: ProjectSource[]) {
  validateProject(state, sources);
  if (state.toolDrafts !== undefined) {
    const { toolDraftSchema } = await import('./tool-draft-schema');
    if (!toolDraftSchema.safeParse(state.toolDrafts).success)
      throw new Error('Der Arbeitsstand enthält ungültige Werkzeugeingaben.');
  }
}
export async function listProjects() {
  const d = await db();
  try {
    return (
      (await request(
        d.transaction('projects', 'readonly').objectStore('projects').getAll(),
      )) as ProjectMeta[]
    ).sort((a, b) => b.updated - a.updated);
  } finally {
    d.close();
  }
}
export async function saveProject(
  name: string,
  projectId: string | undefined,
  sources: Source[],
  state: ProjectState,
) {
  if (!name.trim() || name.trim().length > 100)
    throw new Error('Bitte einen Projektnamen mit 1 bis 100 Zeichen eingeben.');
  const sourceData = sources.map(({ pdf: _pdf, ...source }) => source);
  state = cleanProjectState(state);
  await validateStoredProject(state, sourceData);
  const d = await db(),
    pid = projectId || id(),
    now = Date.now(),
    vid = id();
  try {
    const tx = d.transaction(['projects', 'documents', 'versions'], 'readwrite'),
      done = completed(tx),
      projects = tx.objectStore('projects'),
      get = projects.get(pid);
    get.onsuccess = () => {
      const previous = get.result as ProjectMeta | undefined,
        versions = [
          { id: vid, created: now, pages: state.pages.length },
          ...(previous?.versions || []),
        ];
      projects.put({
        id: pid,
        name: name.trim(),
        updated: now,
        versions: versions.slice(0, 5),
      } satisfies ProjectMeta);
      for (const old of versions.slice(5)) {
        const oldRequest = tx.objectStore('versions').get(old.id);
        oldRequest.onsuccess = () => {
          const oldVersion = oldRequest.result as ProjectVersion | undefined;
          // Legacy keys may be shared by several snapshots. Immutable version
          // keys belong to exactly one snapshot and can be collected safely.
          for (const key of oldVersion?.sourceKeys || []) tx.objectStore('documents').delete(key);
          tx.objectStore('versions').delete(old.id);
        };
      }
      for (const s of sourceData)
        tx.objectStore('documents').put({
          ...s,
          key: pid + ':' + vid + ':' + s.id,
          projectId: pid,
        });
      tx.objectStore('versions').put({
        id: vid,
        projectId: pid,
        created: now,
        sourceIds: sources.map((s) => s.id),
        sourceKeys: sources.map((s) => pid + ':' + vid + ':' + s.id),
        state,
      } satisfies ProjectVersion);
    };
    await done;
    return pid;
  } catch (e) {
    if ((e as DOMException).name === 'QuotaExceededError')
      throw new Error(
        'Der lokale Speicher ist voll. Bitte ein nicht mehr benötigtes Projekt löschen oder eine PDF-Kopie herunterladen.',
      );
    throw e;
  } finally {
    d.close();
  }
}
export async function loadProject(versionId: string) {
  const d = await db();
  try {
    const tx = d.transaction(['versions', 'documents'], 'readonly');
    const version = (await request(tx.objectStore('versions').get(versionId))) as
      ProjectVersion | undefined;
    if (!version) throw new Error('Der Arbeitsstand wurde nicht gefunden.');
    const sources = (await Promise.all(
      (version.sourceKeys || version.sourceIds.map((s) => version.projectId + ':' + s)).map((key) =>
        request(tx.objectStore('documents').get(key)),
      ),
    )) as ProjectSource[];
    if (sources.some((s) => !s)) throw new Error('Zu diesem Arbeitsstand fehlen Originaldateien.');
    await validateStoredProject(version.state, sources);
    return { version: { ...version, state: cleanProjectState(version.state) }, sources };
  } finally {
    d.close();
  }
}
export async function deleteProject(projectId: string) {
  const d = await db();
  try {
    const tx = d.transaction(['projects', 'documents', 'versions'], 'readwrite'),
      done = completed(tx);
    tx.objectStore('projects').delete(projectId);
    for (const store of ['documents', 'versions']) {
      const r = tx.objectStore(store).index('projectId').openKeyCursor(IDBKeyRange.only(projectId));
      r.onsuccess = () => {
        const cursor = r.result;
        if (cursor) {
          tx.objectStore(store).delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    }
    await done;
  } finally {
    d.close();
  }
}

// Read the metadata, snapshots and immutable bytes in the same transaction.
export async function loadProjectArchive(projectId: string): Promise<ProjectArchive> {
  const d = await db();
  try {
    const tx = d.transaction(['projects', 'versions', 'documents'], 'readonly');
    const [project, versions, documents] = await Promise.all([
      request(tx.objectStore('projects').get(projectId)) as Promise<ProjectMeta | undefined>,
      request(tx.objectStore('versions').index('projectId').getAll(projectId)) as Promise<
        ProjectVersion[]
      >,
      request(tx.objectStore('documents').index('projectId').getAll(projectId)) as Promise<
        (ProjectSource & { key: string })[]
      >,
    ]);
    if (!project) throw new Error('Das Projekt wurde nicht gefunden.');
    const byKey = new Map(documents.map((source) => [source.key, source]));
    return {
      name: project.name,
      updated: project.updated,
      versions: await Promise.all(
        project.versions.map(async (entry) => {
          const version = versions.find((v) => v.id === entry.id);
          if (!version) throw new Error('Ein gespeicherter Arbeitsstand fehlt.');
          const sources = (
            version.sourceKeys || version.sourceIds.map((s) => projectId + ':' + s)
          ).map((key) => {
            const source = byKey.get(key);
            if (!source) throw new Error('Zu einem Arbeitsstand fehlen Originaldateien.');
            return source;
          });
          await validateStoredProject(version.state, sources);
          return { created: version.created, state: cleanProjectState(version.state), sources };
        }),
      ),
    };
  } finally {
    d.close();
  }
}
// Import only after archive/PDF validation. One transaction either stores all
// versions under fresh identities, or leaves the existing database untouched.
export async function importProjectArchive(archive: ProjectArchive) {
  if (
    !archive.name.trim() ||
    archive.name.length > 100 ||
    !archive.versions.length ||
    archive.versions.length > 5
  )
    throw new Error('Ungültiges Projektarchiv.');
  for (const version of archive.versions)
    await validateStoredProject(version.state, version.sources);
  const d = await db(),
    pid = id();
  try {
    const tx = d.transaction(['projects', 'versions', 'documents'], 'readwrite'),
      done = completed(tx);
    try {
      const versions = archive.versions.map((version) => {
        const vid = id(),
          sourceKeys = version.sources.map((s) => pid + ':' + vid + ':' + s.id);
        version.sources.forEach((s, index) =>
          tx.objectStore('documents').put({ ...s, key: sourceKeys[index], projectId: pid }),
        );
        tx.objectStore('versions').put({
          id: vid,
          projectId: pid,
          created: version.created,
          sourceIds: version.sources.map((s) => s.id),
          sourceKeys,
          state: cleanProjectState(version.state),
        } satisfies ProjectVersion);
        return { id: vid, created: version.created, pages: version.state.pages.length };
      });
      tx.objectStore('projects').put({
        id: pid,
        name: archive.name,
        updated: archive.updated,
        versions,
      } satisfies ProjectMeta);
      await done;
    } catch (error) {
      try {
        tx.abort();
      } catch {}
      await done.catch(() => {});
      throw error;
    }
    return pid;
  } finally {
    d.close();
  }
}
