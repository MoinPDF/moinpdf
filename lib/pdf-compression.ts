import {
  PDFArray,
  PDFBool,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFObjectCopier,
  PDFRawStream,
  PDFRef,
  type PDFObject,
} from 'pdf-lib';
import {
  filenameStem,
  pdfBlob,
  prepareSources,
  appendPage,
  withPdfDocument,
  type Source,
  type PageItem,
  type JobOptions,
  type JobResult,
  type ProgressUpdate,
} from './pdf-engine';
import { optimizePdf } from './pdf-security';
import { rejectSignedPdf } from './pdf-signature-guard';

/** Decode individual scan resources with their PDF color/filter semantics.
 * Replacing their existing references preserves page content, text and annotations.
 * Masks, bilevel images and resource-dependent/spot colors remain untouched. */
export async function shrinkPdfImages(
  bytes: Uint8Array,
  quality: string,
  signal: AbortSignal,
  report: (done: number, total: number) => void = () => {},
) {
  signal.throwIfAborted();
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const edge = quality === 'small' ? 1400 : quality === 'gentle' ? 2800 : 2000;
  const jpegQuality = quality === 'small' ? 0.58 : quality === 'gentle' ? 0.9 : 0.78;
  const images = doc.context
    .enumerateIndirectObjects()
    .filter(
      (entry): entry is [PDFRef, PDFRawStream] =>
        entry[1] instanceof PDFRawStream &&
        entry[1].dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
    );
  const masks = new Set<unknown>();
  for (const [, image] of images)
    for (const key of ['Mask', 'SMask']) {
      const mask = doc.context.lookup(image.dict.get(PDFName.of(key)));
      if (mask instanceof PDFRawStream) masks.add(mask);
    }
  // A default device color space may depend on the page or a nested Form XObject.
  const customDefaults = doc.context
    .enumerateIndirectObjects()
    .some(([, object]) =>
      /\/Default(?:RGB|Gray|CMYK)\b/.test(
        object instanceof PDFRawStream ? object.dict.toString() : object.toString(),
      ),
    );
  const selfContainedColor = (value: PDFObject | undefined, depth = 0): boolean => {
    if (depth > 8) return false;
    const color = doc.context.lookup(value);
    if (color instanceof PDFName)
      return ['DeviceRGB', 'DeviceGray', 'DeviceCMYK'].some((name) => color === PDFName.of(name));
    if (!(color instanceof PDFArray)) return false;
    const kind = color.lookup(0);
    if (kind === PDFName.of('CalRGB') || kind === PDFName.of('CalGray')) return true;
    if (kind === PDFName.of('Indexed')) return selfContainedColor(color.get(1), depth + 1);
    if (kind === PDFName.of('ICCBased')) {
      const profile = doc.context.lookup(color.get(1));
      if (!(profile instanceof PDFRawStream)) return false;
      const alternate = profile.dict.get(PDFName.of('Alternate'));
      return !alternate || selfContainedColor(alternate, depth + 1);
    }
    return false;
  };
  const sample = await PDFDocument.create();
  const copier = PDFObjectCopier.for(doc.context, sample.context);
  const candidates: { ref: PDFRef; stream: PDFRawStream; width: number; height: number }[] = [];
  let skipped = 0;
  for (const [ref, stream] of images) {
    signal.throwIfAborted();
    if (masks.has(stream)) continue;
    const d = stream.dict;
    const width = d.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber() || 0;
    const height = d.lookupMaybe(PDFName.of('Height'), PDFNumber)?.asNumber() || 0;
    const bits = d.lookupMaybe(PDFName.of('BitsPerComponent'), PDFNumber)?.asNumber();
    const supportedColor = selfContainedColor(d.get(PDFName.of('ColorSpace')));
    if (
      customDefaults ||
      !supportedColor ||
      !width ||
      !height ||
      width * height > 40000000 ||
      bits === 1 ||
      d.get(PDFName.of('ImageMask')) === PDFBool.True ||
      ['Mask', 'SMask', 'SMaskInData', 'Alternates'].some((key) => d.has(PDFName.of(key)))
    ) {
      skipped++;
      continue;
    }
    if (stream.contents.length < 8192) continue;
    const scale = Math.min(1, edge / Math.max(width, height));
    const outWidth = Math.max(1, Math.round(width * scale));
    const outHeight = Math.max(1, Math.round(height * scale));
    const copied = copier.copy(ref);
    // The temporary page has no layer configuration. Keep /OC in the real PDF.
    const copiedImage = sample.context.lookup(copied);
    if (copiedImage instanceof PDFRawStream) copiedImage.dict.delete(PDFName.of('OC'));
    const page = sample.addPage([outWidth, outHeight]);
    page.node.set(PDFName.of('Resources'), sample.context.obj({ XObject: { Scan: copied } }));
    page.node.set(
      PDFName.of('Contents'),
      sample.context.register(
        sample.context.flateStream(`q ${outWidth} 0 0 ${outHeight} 0 0 cm /Scan Do Q`),
      ),
    );
    candidates.push({ ref, stream, width: outWidth, height: outHeight });
  }
  let changed = 0;
  if (candidates.length) {
    const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    await withPdfDocument(new Uint8Array(await sample.save()), signal, async (pdf, child, step) => {
      for (const [index, candidate] of candidates.entries()) {
        child.throwIfAborted();
        report(index, candidates.length);
        await new Promise((resolve) => setTimeout(resolve, 0));
        const canvas = document.createElement('canvas');
        let page: Awaited<ReturnType<typeof pdf.getPage>> | undefined;
        try {
          page = await step('scan-image-page', pdf.getPage(index + 1));
          const operators = await step('scan-image-operators', page.getOperatorList());
          const position = operators.fnArray.indexOf(OPS.paintImageXObject);
          const id = operators.argsArray[position]?.[0];
          if (position < 0 || typeof id !== 'string') {
            skipped++;
            continue;
          }
          // PDF.js can successfully render a blank page after a failed image decode.
          // Never replace the original unless the decoded resource actually exists.
          const objects = id.startsWith('g_') ? page.commonObjs : page.objs;
          const decoded = await step(
            'scan-image-decode',
            new Promise<{
              width: number;
              height: number;
              bitmap?: ImageBitmap;
              data?: Uint8Array;
            } | null>((resolve) => objects.get(id, resolve)),
          );
          if (!decoded || !decoded.width || !decoded.height || (!decoded.bitmap && !decoded.data)) {
            skipped++;
            continue;
          }
          canvas.width = candidate.width;
          canvas.height = candidate.height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Das Bild konnte nicht komprimiert werden.');
          const render = page.render({
            canvas,
            canvasContext: context,
            viewport: page.getViewport({ scale: 1 }),
          });
          const cancel = () => render.cancel();
          child.addEventListener('abort', cancel, { once: true });
          try {
            await step('scan-image-render', render.promise);
          } finally {
            child.removeEventListener('abort', cancel);
          }
          const blob = await step(
            'scan-image-encode',
            new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (value) =>
                  value
                    ? resolve(value)
                    : reject(new Error('Das Bild konnte nicht gespeichert werden.')),
                'image/jpeg',
                jpegQuality,
              ),
            ),
          );
          child.throwIfAborted();
          if (blob.size >= candidate.stream.contents.length) continue;
          const content = new Uint8Array(await step('scan-image-bytes', blob.arrayBuffer()));
          const dict = candidate.stream.dict.clone(doc.context);
          for (const key of ['Decode', 'DecodeParms', 'F', 'FFilter', 'FDecodeParms'])
            dict.delete(PDFName.of(key));
          dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
          dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
          dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
          dict.set(PDFName.of('Width'), PDFNumber.of(canvas.width));
          dict.set(PDFName.of('Height'), PDFNumber.of(canvas.height));
          dict.set(PDFName.of('Length'), PDFNumber.of(content.length));
          doc.context.assign(candidate.ref, PDFRawStream.of(dict, content));
          changed++;
        } catch {
          child.throwIfAborted();
          // Unsupported or damaged individual images retain their original bytes.
          skipped++;
        } finally {
          canvas.width = canvas.height = 0;
          page?.cleanup();
          report(index + 1, candidates.length);
        }
      }
    });
  }
  signal.throwIfAborted();
  return {
    bytes: changed ? new Uint8Array(await doc.save({ updateFieldAppearances: false })) : bytes,
    changed,
    skipped,
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
      ? { bytes: input, changed: 0, skipped: 0 }
      : await shrinkPdfImages(input, options.quality, signal, (done, total) =>
          report({
            percent: 15 + (45 * done) / total,
            label: `Scanbilder komprimieren · ${done} / ${total}`,
          }),
        );
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
          ? options.compressionMode === 'lossless'
            ? 'Verlustfrei optimiert. Text, Links und Formularfunktionen bleiben erhalten.'
            : 'Nur die PDF-Struktur wurde optimiert. Keine Scanbilder konnten weiter verkleinert werden. Text, Links und Formularfunktionen bleiben erhalten.'
          : `Scanbilder wurden einzeln verkleinert. Text, Vektoren, Links und Formularfunktionen bleiben erhalten. Bildqualität in der Vorschau prüfen.${images.skipped ? '\nNicht unterstützte Bilder bleiben unverändert.' : ''}`,
  };
}
