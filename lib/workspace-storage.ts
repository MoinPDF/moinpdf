import type { DownloadResult } from './result-details';
import type { ProjectSource, ProjectState } from './local-projects';

export type SavedResult = DownloadResult & { id: string; created: number };
export type Recovery = {
  id: string;
  updated: number;
  sources: ProjectSource[];
  state: ProjectState;
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('moinpdf.workspace.v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('results', { keyPath: 'id' });
      request.result.createObjectStore('recovery', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode),
        request = work(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error || new Error('Lokales Speichern fehlgeschlagen.'));
    });
  } finally {
    db.close();
  }
}
export async function storedResults(): Promise<SavedResult[]> {
  return (await transaction('results', 'readonly', (s) => s.getAll())).sort(
    (a, b) => b.created - a.created,
  );
}
export async function storeResult(result: SavedResult) {
  if (result.blob.size > 160 * 1024 ** 2)
    throw new Error('Dieses Ergebnis ist zu groß für die lokale Ablage. Bitte herunterladen.');
  await transaction('results', 'readwrite', (s) => s.put(result));
  const results = await storedResults();
  let bytes = 0;
  for (let i = 0; i < results.length; i++) {
    bytes += results[i].blob.size;
    if (i >= 10 || bytes > 160 * 1024 ** 2) await removeResult(results[i].id);
  }
  return storedResults();
}
export const removeResult = (id: string) =>
  transaction('results', 'readwrite', (s) => s.delete(id));
export const clearResults = () => transaction('results', 'readwrite', (s) => s.clear());
export const loadRecovery = (): Promise<Recovery | undefined> =>
  transaction('recovery', 'readonly', (s) => s.get('current'));
export const storeRecovery = (value: Omit<Recovery, 'id'>) =>
  transaction('recovery', 'readwrite', (s) => s.put({ ...value, id: 'current' }));
export const clearRecovery = () => transaction('recovery', 'readwrite', (s) => s.delete('current'));
