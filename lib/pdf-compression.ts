import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import {
  filenameStem,
  pdfBlob,
  prepareSources,
  appendPage,
  type Source,
  type PageItem,
  type JobOptions,
  type JobResult,
  type ProgressUpdate,
} from './pdf-engine';
import { optimizePdf } from './pdf-security';
import { rejectSignedPdf } from './pdf-signature-guard';

/** Replace only simple RGB JPEG resources. Their references and placement remain intact. */
export async function shrinkPdfImages(bytes: Uint8Array, quality: string, signal: AbortSignal) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const edge = quality === 'small' ? 1400 : quality === 'gentle' ? 2800 : 2000;
  const jpegQuality = quality === 'small' ? 0.58 : quality === 'gentle' ? 0.9 : 0.78;
  let changed = 0;
  for (const [ref, stream] of doc.context.enumerateIndirectObjects()) {
    signal.throwIfAborted();
    if (!(stream instanceof PDFRawStream)) continue;
    const d = stream.dict;
    if (
      d.get(PDFName.of('Subtype')) !== PDFName.of('Image') ||
      d.get(PDFName.of('Filter')) !== PDFName.of('DCTDecode') ||
      d.get(PDFName.of('ColorSpace')) !== PDFName.of('DeviceRGB') ||
      ['Mask', 'SMask', 'Decode', 'DecodeParms', 'ImageMask', 'Alternates'].some((k) =>
        d.has(PDFName.of(k)),
      )
    )
      continue;
    const width = d.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber() || 0;
    const height = d.lookupMaybe(PDFName.of('Height'), PDFNumber)?.asNumber() || 0;
    if (!width || !height || width * height > 16000000 || stream.contents.length < 8192) continue;
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(stream.contents)], { type: 'image/jpeg' }),
    );
    const canvas = document.createElement('canvas');
    try {
      signal.throwIfAborted();
      if (bitmap.width !== width || bitmap.height !== height) continue;
      const scale = Math.min(1, edge / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Das Bild konnte nicht komprimiert werden.');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Das Bild konnte nicht gespeichert werden.'))),
          'image/jpeg',
          jpegQuality,
        ),
      );
      signal.throwIfAborted();
      if (blob.size >= stream.contents.length) continue;
      const dict = d.clone(doc.context);
      dict.set(PDFName.of('Width'), PDFNumber.of(canvas.width));
      dict.set(PDFName.of('Height'), PDFNumber.of(canvas.height));
      const content = new Uint8Array(await blob.arrayBuffer());
      dict.set(PDFName.of('Length'), PDFNumber.of(content.length));
      doc.context.assign(ref, PDFRawStream.of(dict, content));
      changed++;
    } finally {
      bitmap.close();
      canvas.width = canvas.height = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return {
    bytes: changed ? new Uint8Array(await doc.save({ updateFieldAppearances: false })) : bytes,
    changed,
  };
}

export async function compressPreservingPdf(
  sources: Source[],
  pages: PageItem[],
  options: JobOptions,
  report: (p: ProgressUpdate) => void,
  signal: AbortSignal,
): Promise<JobResult> {
  signal.throwIfAborted();
  const source = sources.find((s) => s.id === pages[0]?.sourceId);
  if (!source || !pages.length) throw new Error('Bitte zuerst eine PDF auswählen.');
  for (const id of new Set(pages.map((p) => p.sourceId)))
    rejectSignedPdf(
      await PDFDocument.load(sources.find((s) => s.id === id)!.bytes, { updateMetadata: false }),
    );
  const whole =
    pages.length === source.pdf.numPages &&
    pages.every((p, i) => p.sourceId === source.id && p.index === i && p.rotation % 360 === 0);
  let input = source.bytes;
  if (!whole) {
    // Copying a page cannot retain arbitrary document-level form/bookmark destinations.
    for (const id of new Set(pages.map((p) => p.sourceId))) {
      const original = await PDFDocument.load(sources.find((s) => s.id === id)!.bytes);
      if (
        ['AcroForm', 'Outlines', 'Names', 'OCProperties', 'StructTreeRoot'].some((k) =>
          original.catalog.has(PDFName.of(k)),
        )
      )
        throw new Error(
          'Zum Erhalten von Formularen, Lesezeichen und Dokumentstruktur bitte jeweils eine vollständige PDF komprimieren.',
        );
    }
    const combined = await PDFDocument.create();
    const loaded = await prepareSources(sources, pages);
    for (const page of pages) {
      signal.throwIfAborted();
      await appendPage(combined, loaded, page);
    }
    input = new Uint8Array(await combined.save());
  }
  report({ percent: 15, label: 'PDF-Inhalte bleiben erhalten …' });
  const images =
    options.compressionMode === 'lossless'
      ? { bytes: input, changed: 0 }
      : await shrinkPdfImages(input, options.quality, signal);
  report({ percent: 65, label: 'PDF-Struktur wird optimiert …' });
  const optimized = await optimizePdf(images.bytes, undefined, signal);
  signal.throwIfAborted();
  const best = [input, images.bytes, optimized].reduce((a, b) => (b.length < a.length ? b : a));
  report({ percent: 100, label: 'Komprimierung abgeschlossen' });
  return {
    blob: pdfBlob(best),
    filename: `${filenameStem(source.name)}-komprimiert.pdf`,
    kind: 'pdf',
    pages: pages.length,
    inputSize: input.length,
    note:
      best === input
        ? 'Keine kleinere Ausgabe gefunden. Die PDF bleibt unverändert.'
        : options.compressionMode === 'lossless' || !images.changed
          ? 'Verlustfrei optimiert. Text, Links und Formularfunktionen bleiben erhalten.'
          : 'Geeignete JPEG-Bilder wurden einzeln optimiert. Text, Vektoren, Links und Formularfunktionen bleiben erhalten. Bildqualität in der Vorschau prüfen.',
  };
}
