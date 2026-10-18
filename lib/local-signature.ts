import localSignatureWorkerUrl from '../workers/local-signature.ts?worker&url';
import { createLocalModuleWorker } from './module-worker';

export function signLocally(
  bytes: Uint8Array,
  certificate: Uint8Array,
  password: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) return Promise.reject(new DOMException('Abgebrochen', 'AbortError'));
  return new Promise((resolve, reject) => {
    const { worker, dispose } = createLocalModuleWorker(localSignatureWorkerUrl);
    let settled = false;
    const finish = (error?: Error, value?: Uint8Array) => {
      if (settled) return;
      settled = true;
      dispose();
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value!);
    };
    const abort = () => finish(new DOMException('Abgebrochen', 'AbortError')),
      timer = setTimeout(
        () => finish(new Error('Die lokale Signatur überschreitet zwei Minuten.')),
        120000,
      );
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => finish(new Error('Die lokale Signatur konnte nicht gestartet werden.'));
    worker.onmessage = ({ data }) =>
      finish(data.error ? new Error(data.error) : undefined, data.bytes);
    const pdf = bytes.slice(),
      p12 = certificate.slice();
    worker.postMessage({ bytes: pdf, certificate: p12, password }, [pdf.buffer, p12.buffer]);
  });
}
