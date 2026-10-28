import { PDFDocument, PDFName } from 'pdf-lib';
import { MAX_BYTES, MAX_PAGES, pdfImageOptions, renderPage, type Source } from './pdf-engine';
import { rejectSignedPdf } from './pdf-signature-guard';

const verified = new WeakMap<Source, Uint8Array>();

/** A structural rewrite is accepted only after checking every page against
 * the still-open original. Never replace the user's source bytes. */
export async function verifyEditorRepair(source: Source, bytes: Uint8Array, signal: AbortSignal) {
  signal.throwIfAborted();
  if (
    source.wasEncrypted ||
    (await source.pdf.getPermissions()) !== null ||
    (await source.pdf.getFieldObjects())
  )
    throw new Error('Geschützte PDFs und Formular-PDFs werden nicht automatisch repariert.');
  if (!bytes.length || bytes.length > MAX_BYTES || source.pdf.numPages > MAX_PAGES)
    throw new Error('Die reparierte PDF überschreitet die Größenbegrenzung.');
  const parsed = await PDFDocument.load(bytes.slice(), {
    updateMetadata: false,
    throwOnInvalidObject: true,
  });
  rejectSignedPdf(parsed);
  if (parsed.isEncrypted || parsed.catalog.has(PDFName.of('AcroForm')))
    throw new Error('Geschützte PDFs und Formular-PDFs werden nicht automatisch repariert.');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    ...pdfImageOptions(),
    data: bytes.slice(),
    cMapUrl: '/vendor/pdf/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/vendor/pdf/standard_fonts/',
    wasmUrl: '/vendor/pdf/wasm/',
  });
  const abort = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages !== source.pdf.numPages)
      throw new Error('Die Reparatur verändert die Seitenanzahl.');
    const candidate: Source = { ...source, bytes, pdf };
    for (let index = 0; index < pdf.numPages; index++) {
      signal.throwIfAborted();
      const original = await source.pdf.getPage(index + 1),
        next = await pdf.getPage(index + 1);
      if (
        original.isPureXfa ||
        next.isPureXfa ||
        (await original.getAnnotations()).length ||
        (await next.getAnnotations()).length
      )
        throw new Error(
          'PDF-Seiten mit Anmerkungen oder Formularen werden nicht automatisch repariert.',
        );
      if (
        original.rotate !== next.rotate ||
        original.userUnit !== next.userUnit ||
        original.view.some((n, i) => Math.abs(n - next.view[i]) > 1e-6)
      )
        throw new Error(`Die Reparatur verändert die Geometrie von Seite ${index + 1}.`);
      const a = (await original.getTextContent()).items.filter((t) => 'str' in t),
        b = (await next.getTextContent()).items.filter((t) => 'str' in t);
      if (
        a.length !== b.length ||
        a.some(
          (t, i) =>
            t.str !== b[i].str ||
            t.dir !== b[i].dir ||
            t.hasEOL !== b[i].hasEOL ||
            Math.abs(t.width - b[i].width) > 0.001 ||
            Math.abs(t.height - b[i].height) > 0.001 ||
            t.transform.some((n, j) => Math.abs(n - b[i].transform[j]) > 0.001),
        )
      )
        throw new Error(`Die Reparatur verändert Text oder Textpositionen auf Seite ${index + 1}.`);
      const item = { id: 'repair', sourceId: source.id, index, rotation: 0, selected: true };
      const first = await renderPage(source, item, 1200, signal);
      let second: Awaited<ReturnType<typeof renderPage>> | undefined;
      try {
        second = await renderPage(candidate, item, 1200, signal);
        if (
          first.canvas.width !== second.canvas.width ||
          first.canvas.height !== second.canvas.height
        )
          throw new Error('Abweichende Seitengröße nach Reparatur.');
        const x = first.canvas
            .getContext('2d')!
            .getImageData(0, 0, first.canvas.width, first.canvas.height).data,
          y = second.canvas
            .getContext('2d')!
            .getImageData(0, 0, second.canvas.width, second.canvas.height).data;
        if (x.some((value, i) => value !== y[i]))
          throw new Error(`Die Reparatur verändert die Darstellung von Seite ${index + 1}.`);
      } finally {
        first.canvas.width = first.canvas.height = 0;
        if (second) second.canvas.width = second.canvas.height = 0;
      }
    }
    signal.throwIfAborted();
  } finally {
    signal.removeEventListener('abort', abort);
    await task.destroy();
  }
}

export async function repairEditorSource(source: Source, signal: AbortSignal) {
  signal.throwIfAborted();
  const previous = verified.get(source);
  if (previous) return previous.slice();
  // Failed or aborted work is never retained, so a later explicit retry works.
  const { rewritePdf } = await import('./pdf-security');
  let bytes: Uint8Array;
  try {
    bytes = await rewritePdf(source.bytes, signal);
  } catch (error) {
    signal.throwIfAborted();
    // qpdf's WASM build may refuse a damaged stream length. A separate parser
    // can recover the stream boundary; its rewrite still faces every check.
    const recovered = await PDFDocument.load(source.bytes.slice(), {
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
    rejectSignedPdf(recovered);
    if (recovered.isEncrypted || recovered.catalog.has(PDFName.of('AcroForm'))) throw error;
    bytes = await rewritePdf(await recovered.save(), signal);
  }
  await verifyEditorRepair(source, bytes, signal);
  verified.set(source, bytes.slice());
  return bytes;
}
