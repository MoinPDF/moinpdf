import { uid } from './pdf-engine';
export type LargeMode = 'rotate90' | 'rotate180' | 'optimizeLossless' | 'ocr';
export type LargePageSummary = {
  width: number;
  height: number;
  rotation: number;
  text: string;
  links: string;
  pixels: string;
};
export type LargeChunk = {
  first: number;
  last: number;
  size: number;
  digest: string;
  summaries: LargePageSummary[];
  replaced?: boolean;
};
export type LargeJob = {
  version: 1;
  id: string;
  name: string;
  size: number;
  digest: string;
  pages: number;
  mode: LargeMode;
  chunks: LargeChunk[];
  updated: number;
};
const MAX_STORED = 768 * 1024 * 1024;
const locked = 'Diese große PDF wird bereits in einem anderen Tab verarbeitet.';
const stale = 'Die Auftragssperre ist abgelaufen. Bitte den gespeicherten Auftrag erneut öffnen.';
type Lease = { token: string; expires: number };
const value = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('moinpdf.large-documents.v1', 1);
    r.onupgradeneeded = () => {
      for (const key of ['jobs', 'originals', 'chunks', 'leases']) r.result.createObjectStore(key);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function read<T>(store: string, key?: string): Promise<T> {
  const d = await db();
  try {
    return await value(
      key === undefined
        ? d.transaction(store).objectStore(store).getAll()
        : d.transaction(store).objectStore(store).get(key),
    );
  } finally {
    d.close();
  }
}
export const listLargeJobs = () => read<LargeJob[]>('jobs');
export const loadLargeJob = (id: string) => read<LargeJob | undefined>('jobs', id);
export const largeOriginal = (id: string) => read<Blob | undefined>('originals', id);
export const largeChunkBlob = (id: string, index: number) =>
  read<Blob | undefined>('chunks', `${id}:${index}`);
async function lease(id: string, change: (current?: Lease) => Lease | undefined) {
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction('leases', 'readwrite'),
        s = tx.objectStore('leases');
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error(stale));
      const request = s.get(id);
      request.onsuccess = () => {
        try {
          const next = change(request.result);
          if (next) s.put(next, id);
          else s.delete(id);
        } catch (error) {
          reject(error);
          tx.abort();
        }
      };
    });
  } finally {
    d.close();
  }
}
export async function withLargeLease<T>(id: string, run: (token: string) => Promise<T>) {
  const token = uid();
  await lease(id, (current) => {
    if (current && current.expires > Date.now()) throw new Error(locked);
    return { token, expires: Date.now() + 60000 };
  });
  const timer = setInterval(() => {
    void lease(id, (current) => {
      if (current?.token !== token || current.expires <= Date.now()) throw new Error(stale);
      return { token, expires: Date.now() + 60000 };
    }).catch(() => {});
  }, 15000);
  try {
    const result = await run(token);
    await lease(id, (current) => {
      if (current?.token !== token || current.expires <= Date.now()) throw new Error(stale);
      return current;
    });
    return result;
  } finally {
    clearInterval(timer);
    await lease(id, (current) => (current?.token === token ? undefined : current)).catch(() => {});
  }
}
/** Cursor, output, digest and verified summaries commit in one fenced transaction. */
export async function saveLargeJob(
  job: LargeJob,
  token: string,
  blob?: Blob,
  index?: number,
  original?: Blob,
) {
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(['jobs', 'originals', 'chunks', 'leases'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(tx.error || new Error('Die große PDF konnte nicht lokal gesichert werden.'));
      const check = tx.objectStore('leases').get(job.id);
      check.onsuccess = () => {
        const current = check.result as Lease | undefined;
        if (current?.token !== token || current.expires <= Date.now()) {
          reject(new Error(stale));
          tx.abort();
          return;
        }
        const all = tx.objectStore('jobs').getAll();
        all.onsuccess = () => {
          const stored = (all.result as LargeJob[])
            .filter((j) => j.id !== job.id)
            .reduce((n, j) => n + j.size + j.chunks.reduce((s, c) => s + c.size, 0), 0);
          if (stored + job.size + job.chunks.reduce((s, c) => s + c.size, 0) > MAX_STORED) {
            reject(
              new Error(
                'Die Ablage für große PDFs ist voll. Bitte abgeschlossene Aufträge löschen.',
              ),
            );
            tx.abort();
            return;
          }
          tx.objectStore('jobs').put({ ...job, updated: Date.now() }, job.id);
          if (original) tx.objectStore('originals').put(original, job.id);
          if (blob && index !== undefined) tx.objectStore('chunks').put(blob, `${job.id}:${index}`);
        };
      };
    });
  } finally {
    d.close();
  }
}
export async function deleteLargeJob(id: string) {
  await withLargeLease(id, async (token) => {
    const job = await loadLargeJob(id);
    if (!job) return;
    const d = await db();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = d.transaction(['jobs', 'originals', 'chunks', 'leases'], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error || new Error(stale));
        const r = tx.objectStore('leases').get(id);
        r.onsuccess = () => {
          if (r.result?.token !== token || r.result.expires <= Date.now()) {
            reject(new Error(stale));
            tx.abort();
            return;
          }
          tx.objectStore('jobs').delete(id);
          tx.objectStore('originals').delete(id);
          job.chunks.forEach((_, i) => tx.objectStore('chunks').delete(`${id}:${i}`));
        };
      });
    } finally {
      d.close();
    }
  });
}
