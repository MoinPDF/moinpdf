import type { Source } from './pdf-engine';
import type { ExportFile, RunContext } from './advanced-types';
import type { BatesOptions, LabelRule, PosterPrint } from './pro-tools';
export type ProJob =
  | { kind: 'bates'; options: BatesOptions }
  | { kind: 'page-labels'; rules: LabelRule[] }
  | { kind: 'rotate-free'; angle: number }
  | { kind: 'continuous-page'; width: number; gap: number }
  | { kind: 'poster-print'; columns: number; rows: number; overlap: number; print: PosterPrint };
export function runProJob(sources: Source[], job: ProJob, ctx: RunContext): Promise<ExportFile> {
  ctx.signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/pro-tools.ts', import.meta.url), {
      type: 'module',
    });
    const cleanup = () => {
      worker.terminate();
      ctx.signal.removeEventListener('abort', abort);
      clearTimeout(timer);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Abgebrochen', 'AbortError'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Der Seitenauftrag hat das Zeitlimit von fünf Minuten überschritten.'));
    }, 300000);
    ctx.signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(new Error('Der Worker für Seitenwerkzeuge konnte den Auftrag nicht ausführen.'));
    };
    worker.onmessage = ({ data }) => {
      if (data.progress) {
        ctx.report(data.progress);
        return;
      }
      cleanup();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.postMessage({
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        bytes: s.bytes,
        pages: s.pdf.numPages,
      })),
      job,
    });
  });
}
