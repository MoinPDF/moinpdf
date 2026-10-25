import type { Worker as OcrWorker } from 'tesseract.js';
import { parseOcrLanguages } from '../lib/ocr-languages';
let worker: OcrWorker | undefined;
let currentLanguage = '',
  activeId = 0;
let rejectFailure: (reason: Error) => void = () => {};
let failure: Promise<never>;
self.onmessage = async ({ data }) => {
  const { id, language, bytes, origin, layout } = data;
  activeId = id;
  try {
    const languages = parseOcrLanguages(language);
    if (!worker || currentLanguage !== language) {
      await worker?.terminate();
      worker = undefined;
      const { createWorker, PSM } = await import('tesseract.js');
      failure = new Promise<never>((_, reject) => {
        rejectFailure = reject;
      });
      void failure.catch(() => {});
      worker = await Promise.race([
        createWorker(languages, 1, {
          workerPath: new URL('/vendor/ocr/worker.min.js', origin).href,
          corePath: new URL('/vendor/ocr', origin).href,
          langPath: new URL('/vendor/languages', origin).href,
          workerBlobURL: true,
          errorHandler: (error: unknown) =>
            rejectFailure(
              new Error(
                typeof error === 'string'
                  ? error
                  : 'Die Texterkennung konnte nicht gestartet werden.',
              ),
            ),
          logger: (m) => {
            if (m.status === 'recognizing text')
              self.postMessage({
                id: activeId,
                progress: {
                  percent: Math.round(15 + m.progress * 80),
                  label: 'Scan wird in bearbeitbaren Text umgewandelt …',
                },
              });
          },
        }),
        failure,
      ]);
      currentLanguage = language;
      await Promise.race([
        worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' }),
        failure,
      ]);
    }
    if (['3', '4', '6', '7', '11'].includes(layout))
      await worker.setParameters({ tessedit_pageseg_mode: layout });
    const { data: result } = await Promise.race([
      worker.recognize(
        new Blob([bytes], { type: 'image/png' }),
        { rotateAuto: false },
        { text: true, blocks: true },
      ),
      failure,
    ]);
    self.postMessage({ id, value: result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'Die Texterkennung ist fehlgeschlagen.',
    });
  }
};
