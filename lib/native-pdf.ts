import nativePdfWorkerUrl from '../workers/native-pdf.ts?worker&url';
import { createLocalModuleWorker } from './module-worker';
import type {
  NativeObject,
  NativeChange,
  NativeRemoval,
  NativeParagraph,
  NativeParagraphResult,
} from './native-pdf-core';
export type {
  NativeObject,
  NativeChange,
  NativeRemoval,
  NativeParagraph,
  NativeParagraphStyle,
} from './native-pdf-core';
function nativeJob<T>(
  bytes: Uint8Array,
  options: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(new DOMException('Abgebrochen', 'AbortError'));
  return new Promise((resolve, reject) => {
    const { worker, dispose } = createLocalModuleWorker(nativePdfWorkerUrl);
    let settled = false;
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      dispose();
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
export const inspectObjects = (
  bytes: Uint8Array,
  page: number,
  signal?: AbortSignal,
  path: number[] = [],
) => nativeJob<NativeObject[]>(bytes, { action: 'inspect', page, path }, signal);
export const readImage = (bytes: Uint8Array, page: number, index: number, signal?: AbortSignal) =>
  nativeJob<{ width: number; height: number; rgba: Uint8Array }>(
    bytes,
    { action: 'image', page, index },
    signal,
  );
export const editObjects = (
  bytes: Uint8Array,
  page: number,
  changes: NativeChange[],
  signal?: AbortSignal,
  path: number[] = [],
) => nativeJob<Uint8Array>(bytes, { action: 'edit', page, changes, path }, signal);
export const removeRegions = (bytes: Uint8Array, removals: NativeRemoval[], signal?: AbortSignal) =>
  nativeJob<Uint8Array>(bytes, { action: 'redact', removals }, signal);
export const replaceParagraph = (
  bytes: Uint8Array,
  page: number,
  settings: NativeParagraph,
  signal?: AbortSignal,
) => nativeJob<NativeParagraphResult>(bytes, { action: 'paragraph', page, settings }, signal);

export const groupObjects = (
  bytes: Uint8Array,
  page: number,
  indices: number[],
  duplicate: boolean,
  signal?: AbortSignal,
) => nativeJob<Uint8Array>(bytes, { action: 'group', page, indices, duplicate }, signal);
