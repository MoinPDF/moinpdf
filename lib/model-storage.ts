import { localModelInfo } from './local-model';
const db = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('moinpdf.local-model.v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('models');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function cachedModel(): Promise<Blob | null> {
  const database = await db();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction('models', 'readonly')
        .objectStore('models')
        .get(localModelInfo.digest);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
export async function storeModel(file: Blob | null) {
  const database = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('models', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(tx.error || new Error('Die Modelldatei konnte nicht gespeichert werden.'));
      const store = tx.objectStore('models');
      store.clear();
      if (file) store.put(file, localModelInfo.digest);
    });
  } finally {
    database.close();
  }
}
