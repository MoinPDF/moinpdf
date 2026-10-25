export type OfflineManifest = {
  version: string;
  build: string;
  packs: { id: string; bytes: number; files: { url: string; size: number; integrity: string }[] }[];
};
export type OfflineStatus = { build: string; version: string; ready: string[] };
export function offlineMessage<T>(
  worker: ServiceWorker,
  message: object,
  progress?: (value: { pack: string; done: number; total: number }) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      channel.port1.close();
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        finish();
        reject(new Error('Offline-Verbindung unterbrochen / Offline connection interrupted'));
      }, 120000);
    };
    channel.port1.onmessage = ({ data }) => {
      reset();
      if (data.progress) progress?.(data.progress);
      else if (data.error) {
        finish();
        reject(new Error(data.error));
      } else if ('result' in data) {
        finish();
        resolve(data.result);
      }
    };
    reset();
    try {
      worker.postMessage(message, [channel.port2]);
    } catch (error) {
      finish();
      reject(error);
    }
  });
}
export async function offlineWorker() {
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
  await registration.update();
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error('Offline-Funktion nicht verfügbar / Offline unavailable');
  if (worker.state === 'installing')
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.removeEventListener('statechange', check);
        reject(new Error('Offline-Installation unterbrochen / Offline installation interrupted'));
      }, 30000);
      const check = () => {
        if (worker.state !== 'installing') {
          clearTimeout(timer);
          worker.removeEventListener('statechange', check);
          worker.state === 'redundant'
            ? reject(new Error('Offline-Installation fehlgeschlagen / Offline installation failed'))
            : resolve();
        }
      };
      worker.addEventListener('statechange', check);
      check();
    });
  return worker;
}
