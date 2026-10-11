import { createWorker, PSM, type ImageLike, type Worker } from 'tesseract.js';
import { abortable } from './pdf-engine';
import { individualOcrLanguages } from './ocr-languages';
import { detectOcrLanguages } from './ocr-language-detection';
export async function probeOcrLanguages(image: ImageLike, signal: AbortSignal) {
  signal.throwIfAborted();
  let worker: Worker | undefined;
  const stop = () => {
    void worker?.terminate();
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    const creating = createWorker(
      individualOcrLanguages.map(([code]) => code),
      1,
      {
        workerPath: '/vendor/ocr/worker.min.js',
        corePath: '/vendor/ocr',
        langPath: '/vendor/languages',
        workerBlobURL: false,
      },
    );
    creating
      .then((w) => {
        if (signal.aborted) void w.terminate();
      })
      .catch(() => {});
    worker = await abortable(creating, signal);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await abortable(worker.recognize(image), signal);
    return detectOcrLanguages(data.text, data.confidence);
  } finally {
    signal.removeEventListener('abort', stop);
    await worker?.terminate();
  }
}
