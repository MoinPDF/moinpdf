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
const unavailable =
  'Die lokale Dateispeicherung ist in diesem Browser nicht verfügbar. Bitte ein normales Browserfenster verwenden und freien Speicher prüfen.';
type Lease = { token: string; expires: number };
/** Finish only after commit/abort, never in a bubbling request error. */
function watchTransaction(
  tx: IDBTransaction,
  resolve: () => void,
  reject: (error: unknown) => void,
  signal?: AbortSignal,
  timeout = 60000,
) {
  let failure: unknown,
    done = false;
  const finish = (error?: unknown) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    error ? reject(error) : resolve();
  };
  const fail = (error: unknown) => {
    failure = error;
    try {
      tx.abort();
    } catch {
      finish(error);
    }
  };
  const cancel = () => fail(signal?.reason || new DOMException('Abgebrochen', 'AbortError'));
  const timer = setTimeout(() => {
    const error = new Error(unavailable);
    fail(error);
    finish(error);
  }, timeout);
  tx.oncomplete = () => finish();
  tx.onabort = () => finish(failure || tx.error || new Error(unavailable));
  tx.onerror = (event) =>
    fail((event.target as IDBRequest).error || tx.error || new Error(unavailable));
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  return fail;
}
async function db(probe = false) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let done = false;
    const r = indexedDB.open(
      probe ? 'moinpdf.large-storage-check.v1' : 'moinpdf.large-documents.v1',
      1,
    );
    const fail = () => {
      done = true;
      clearTimeout(timer);
      reject(new Error(unavailable));
    };
    const timer = setTimeout(fail, 10000);
    r.onupgradeneeded = () => {
      if (done) {
        r.transaction?.abort();
        return;
      }
      for (const key of probe ? ['probe'] : ['jobs', 'originals', 'chunks', 'leases'])
        r.result.createObjectStore(key);
    };
    r.onsuccess = () => {
      if (done) {
        r.result.close();
        return;
      }
      done = true;
      clearTimeout(timer);
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = r.onblocked = fail;
  });
}
/** Some private browser profiles reject Blobs; check before acquiring a job lease. */
export async function checkLargeStorage(signal: AbortSignal) {
  signal.throwIfAborted();
  const d = await db(true);
  try {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction('probe', 'readwrite');
      const fail = watchTransaction(tx, resolve, reject, signal, 10000);
      const store = tx.objectStore('probe'),
        key = uid();
      const put = store.put(new Blob(['moinpdf']), key);
      put.onsuccess = () => {
        const request = store.get(key);
        request.onsuccess = () => {
          if (!(request.result instanceof Blob) || request.result.size !== 7) {
            fail(new Error(unavailable));
            return;
          }
          store.delete(key);
        };
      };
    });
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw new Error(unavailable, { cause: error });
  } finally {
    d.close();
  }
}
async function read<T>(store: string, key?: string): Promise<T> {
  const d = await db();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = d.transaction(store),
        s = tx.objectStore(store);
      const request = key === undefined ? s.getAll() : s.get(key);
      watchTransaction(tx, () => resolve(request.result as T), reject);
    });
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
      const fail = watchTransaction(tx, resolve, reject);
      const request = s.get(id);
      request.onsuccess = () => {
        try {
          const next = change(request.result);
          if (next) s.put(next, id);
          else s.delete(id);
        } catch (error) {
          fail(error);
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
      const fail = watchTransaction(tx, resolve, reject);
      const check = tx.objectStore('leases').get(job.id);
      check.onsuccess = () => {
        const current = check.result as Lease | undefined;
        if (current?.token !== token || current.expires <= Date.now()) {
          fail(new Error(stale));
          return;
        }
        const all = tx.objectStore('jobs').getAll();
        all.onsuccess = () => {
          const stored = (all.result as LargeJob[])
            .filter((j) => j.id !== job.id)
            .reduce((n, j) => n + j.size + j.chunks.reduce((s, c) => s + c.size, 0), 0);
          if (stored + job.size + job.chunks.reduce((s, c) => s + c.size, 0) > MAX_STORED) {
            fail(
              new Error(
                'Die Ablage für große PDFs ist voll. Bitte abgeschlossene Aufträge löschen.',
              ),
            );
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
        const fail = watchTransaction(tx, resolve, reject);
        const r = tx.objectStore('leases').get(id);
        r.onsuccess = () => {
          if (r.result?.token !== token || r.result.expires <= Date.now()) {
            fail(new Error(stale));
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
