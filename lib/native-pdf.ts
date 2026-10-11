import type { NativeObject, NativeChange, NativeRemoval } from './native-pdf-core';
export type { NativeObject, NativeChange, NativeRemoval } from './native-pdf-core';
function nativeJob<T>(
  bytes: Uint8Array,
  options: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(new DOMException('Abgebrochen', 'AbortError'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/native-pdf.ts', import.meta.url), {
      type: 'module',
    });
    let settled = false;
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value!);
    };
    const abort = () => finish(new DOMException('Abgebrochen', 'AbortError')),
      timer = setTimeout(
        () =>
          finish(
            new Error(
              'Die Verarbeitung überschreitet zwei Minuten. Bitte weniger Seiten verwenden.',
            ),
          ),
        120000,
      );
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () =>
      finish(new Error('Der lokale PDF-Prozessor konnte nicht gestartet werden.'));
    worker.onmessage = ({ data }) =>
      finish(data.error ? new Error(data.error) : undefined, data.value);
    const copy = bytes.slice();
    worker.postMessage({ ...options, bytes: copy }, [copy.buffer]);
  });
}
export const inspectObjects = (bytes: Uint8Array, page: number, signal?: AbortSignal) =>
  nativeJob<NativeObject[]>(bytes, { action: 'inspect', page }, signal);
export const editObjects = (
  bytes: Uint8Array,
  page: number,
  changes: NativeChange[],
  signal?: AbortSignal,
) => nativeJob<Uint8Array>(bytes, { action: 'edit', page, changes }, signal);
export const removeRegions = (bytes: Uint8Array, removals: NativeRemoval[], signal?: AbortSignal) =>
  nativeJob<Uint8Array>(bytes, { action: 'redact', removals }, signal);
