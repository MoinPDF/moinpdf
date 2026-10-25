import workerUrl from '../workers/editor-ocr.ts?worker&url';
import { createLocalModuleWorker } from './module-worker';
import { abortable } from './pdf-engine';
import type { Page as OcrPage } from 'tesseract.js';
import type { EditorRecognizer, EditorProgress } from './editor-analysis';

export function openEditorRecognizer(signal: AbortSignal, layout?: string): EditorRecognizer {
  signal.throwIfAborted();
  const { worker, dispose } = createLocalModuleWorker(workerUrl);
  let closed = false,
    sequence = 0;
  let pending:
    | {
        id: number;
        report: (p: EditorProgress) => void;
        resolve: (data: OcrPage) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  const stop = (error: Error = new DOMException('Abgebrochen', 'AbortError')) => {
    if (closed) return;
    closed = true;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = undefined;
    }
    signal.removeEventListener('abort', abort);
    dispose();
  };
  const abort = () => stop();
  signal.addEventListener('abort', abort, { once: true });
  worker.onerror = () =>
    stop(new Error('Die Texterkennung konnte nicht gestartet werden. Bitte erneut versuchen.'));
  worker.onmessageerror = () =>
    stop(new Error('Die Texterkennung hat eine ungültige Antwort geliefert.'));
  worker.onmessage = ({ data }) => {
    if (!pending || data.id !== pending.id || closed) return;
    if (data.progress) {
      pending.report(data.progress);
      return;
    }
    if (data.error) {
      stop(new Error(data.error));
      return;
    }
    const job = pending;
    pending = undefined;
    clearTimeout(job.timer);
    job.resolve(data.value);
  };
  return {
    async recognize(canvas, language, report) {
      signal.throwIfAborted();
      if (closed) throw new Error('Die Texterkennung wurde beendet. Bitte erneut starten.');
      if (pending) throw new Error('Die vorherige Seite wird noch erkannt.');
      const blob = await abortable(
        new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error('Die Scan-Seite konnte nicht vorbereitet werden.')),
            'image/png',
          ),
        ),
        signal,
      );
      const bytes = await abortable(blob.arrayBuffer(), signal);
      signal.throwIfAborted();
      if (closed) throw new DOMException('Abgebrochen', 'AbortError');
      return new Promise<OcrPage>((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(
          () =>
            stop(
              new Error(
                'Die Texterkennung dauert zu lange. Bitte erneut versuchen oder eine kleinere Seite verwenden.',
              ),
            ),
          90000,
        );
        pending = { id, report, resolve, reject, timer };
        report({ percent: 5, label: 'Texterkennung wird vorbereitet …' });
        try {
          worker.postMessage({ id, language, layout, bytes, origin: location.origin }, [bytes]);
        } catch {
          stop(new Error('Die Scan-Seite konnte nicht vorbereitet werden.'));
        }
      });
    },
    async dispose() {
      stop();
    },
  };
}
