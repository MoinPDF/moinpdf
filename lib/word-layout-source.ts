import { readTextTargets } from './editor-model';
import { readPdfText } from './pdf-text';
import { createEditorRecognizer, ocrEditorTargets, type EditorRecognizer } from './editor-analysis';
import { eraseEditorScanRegion } from './editor-scan';
import type { Source } from './pdf-engine';
import type { WordLayoutPage } from './word-layout';
import type { TextTarget } from './editor-model';

export { createEditorRecognizer };

function preservedRegions(targets: TextTarget[]) {
  if (targets.length > 15000)
    throw new Error(
      'Diese Seite enthält zu viele Textbereiche für Word. Bitte den einfachen Textexport verwenden.',
    );
  const preserved = new Set(targets.filter((t) => Math.abs(t.rotation || 0) > 0.01));
  // Process each newly preserved region once, including intersecting neighbours.
  const queue = [...preserved];
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i];
    for (const b of targets)
      if (
        !preserved.has(b) &&
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      ) {
        preserved.add(b);
        queue.push(b);
      }
  }
  return preserved;
}

/** Render graphics independently of the editable text. In particular a full
 * page screenshot with hidden text would leave old letters behind after edits. */
export async function readWordLayoutPage(
  source: Source,
  index: number,
  signal: AbortSignal,
  options: { report?: (text: string) => void; recognizer: EditorRecognizer },
): Promise<WordLayoutPage> {
  signal.throwIfAborted();
  const page = await source.pdf.getPage(index + 1);
  const viewport = page.getViewport({ scale: 1 });
  if (![viewport.width, viewport.height].every((n) => Number.isFinite(n) && n >= 10 && n <= 1584))
    throw new Error(
      'Dieses Seitenformat ist für Word zu groß. Bitte die PDF-Seiten zuerst verkleinern.',
    );
  const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const operators = await page.getOperatorList();
  const native = await readTextTargets(source, { index, rotation: 0 });
  const content = await readPdfText(page);
  const normalized = (value: string) => value.normalize('NFKC').replace(/\s/gu, '');
  const complete =
    normalized(content.items.map((item) => ('str' in item ? item.str : '')).join('')) ===
    normalized(native.targets.map((t) => t.text).join(''));
  signal.throwIfAborted();
  // Text used as a clipping mask and skewed/vertical glyphs cannot be removed
  // independently without changing artwork. Preserve these pages visibly and
  // disclose the image fallback instead of silently dropping their content.
  const imageOnly =
    !complete ||
    native.targets.some((t) => t.unsupportedReason) ||
    operators.fnArray.some(
      (op, i) => op === OPS.setTextRenderingMode && operators.argsArray[i][0] >= 4,
    );
  // Word and LibreOffice disagree about rotated text boxes. Keep just these
  // regions in the artwork; the other text remains editable. Expand intersecting
  // regions so a preserved crop can never duplicate a neighbouring text box.
  let preserved = preservedRegions(native.targets);
  let text = imageOnly ? [] : native.targets.filter((t) => !preserved.has(t));
  const ocr = !imageOnly && (!native.targets.length || text.some((t) => t.invisible));
  const canvas = document.createElement('canvas');
  const scale = Math.min(3, 2400 / Math.max(viewport.width, viewport.height));
  const rendering = page.getViewport({ scale });
  canvas.width = Math.ceil(rendering.width);
  canvas.height = Math.ceil(rendering.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Die PDF-Seite konnte nicht für Word vorbereitet werden.');
  const textOps = new Set([
    OPS.showText,
    OPS.showSpacedText,
    OPS.nextLineShowText,
    OPS.nextLineSetSpacingShowText,
  ]);
  // Annotation appearances are absent from getTextContent. Keep their text in
  // the artwork rather than stripping form values, stamps or FreeText notes.
  let annotation = false;
  const removeText = new Set<number>();
  operators.fnArray.forEach((op, i) => {
    if (op === OPS.beginAnnotation) annotation = true;
    else if (op === OPS.endAnnotation) annotation = false;
    else if (!annotation && textOps.has(op)) removeText.add(i);
  });
  const render = page.render({
    canvas,
    canvasContext: context,
    viewport: rendering,
    background: '#ffffff',
    operationsFilter: imageOnly ? undefined : (i) => !removeText.has(i),
  });
  const stop = () => render.cancel();
  signal.addEventListener('abort', stop, { once: true });
  try {
    await render.promise;
    signal.throwIfAborted();
    if (!imageOnly && preserved.size) {
      const original = document.createElement('canvas');
      original.width = canvas.width;
      original.height = canvas.height;
      const full = page.render({
        canvas: original,
        canvasContext: original.getContext('2d')!,
        viewport: rendering,
        background: '#ffffff',
      });
      const cancelFull = () => full.cancel();
      signal.addEventListener('abort', cancelFull, { once: true });
      try {
        await full.promise;
        signal.throwIfAborted();
        for (const target of preserved) {
          const x = Math.max(0, Math.floor(target.x * canvas.width)),
            y = Math.max(0, Math.floor(target.y * canvas.height));
          const w = Math.min(canvas.width - x, Math.ceil((target.x + target.w) * canvas.width) - x);
          const h = Math.min(
            canvas.height - y,
            Math.ceil((target.y + target.h) * canvas.height) - y,
          );
          if (w > 0 && h > 0) context.drawImage(original, x, y, w, h, x, y, w, h);
        }
      } finally {
        signal.removeEventListener('abort', cancelFull);
        original.width = original.height = 0;
      }
    }
    if (!imageOnly && !native.targets.length) {
      options.report?.(`Texterkennung · Seite ${index + 1} von ${source.pdf.numPages}`);
      const recognized = await options.recognizer.recognize(canvas, 'deu+eng', (p) =>
        options.report?.(p.label),
      );
      text = ocrEditorTargets(recognized, canvas, viewport.width, viewport.height);
      preserved = preservedRegions(text);
      text = text.filter((t) => !preserved.has(t));
    }
    // OCR text is part of a raster image. Remove the recognised pixels before
    // placing visible editable Word text, keeping surrounding graphics intact.
    for (const target of text) {
      signal.throwIfAborted();
      if (target.invisible || target.origin === 'ocr') eraseEditorScanRegion(canvas, target);
    }
    // OCR boxes measure ink, not font ems. Fit the replacement face to each ink
    // box so descenders do not make one word larger than its neighbours and
    // glyph advances do not close the original spaces between words.
    context.font = '100px Arial';
    text = text.map((target) => {
      if (target.origin !== 'ocr') return target;
      const metrics = context.measureText(target.text);
      const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      if (!(inkHeight > 0 && metrics.width > 0)) return target;
      const height = Math.max(1, (target.h - 0.002) * viewport.height);
      const width = Math.max(1, (target.w - 0.002) * viewport.width);
      const fontSize = Math.max(3, Math.min(96, (height * 100) / inkHeight));
      const baseline =
        (target.y + 0.001) * viewport.height + (metrics.actualBoundingBoxAscent * fontSize) / 100;
      return {
        ...target,
        fontSize,
        fontName: 'Arial',
        textScaleX: width / ((metrics.width * fontSize) / 100),
        x: target.x + 0.001,
        y: (baseline - fontSize * 0.8) / viewport.height,
        w: width / viewport.width,
        h: (fontSize * 1.2) / viewport.height,
      };
    });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error('Die PDF-Bilder konnten nicht für Word gespeichert werden.')),
        'image/png',
      ),
    );
    signal.throwIfAborted();
    return {
      width: viewport.width,
      height: viewport.height,
      text,
      background: new Uint8Array(await blob.arrayBuffer()),
      ocr,
      imageOnly: imageOnly || !text.length,
      preservedText: imageOnly ? native.targets.length : preserved.size,
    };
  } finally {
    signal.removeEventListener('abort', stop);
    canvas.width = canvas.height = 0;
  }
}
