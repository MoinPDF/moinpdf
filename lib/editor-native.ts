import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, degrees } from 'pdf-lib';
import { renderPage, type PageItem, type Source } from './pdf-engine';
import type { Mark } from './studio-engine';
import { editorRemovalRects, editorImageCropBounds, type TextTarget } from './editor-model';
import { remainingEditorTargets } from './editor-analysis';
import { readPdfText } from './pdf-text';

export async function editorSinglePage(original: PDFDocument, item: PageItem) {
  const single = await PDFDocument.create(),
    [page] = await single.copyPages(original, [item.index]);
  page.setRotation(degrees((page.getRotation().angle + item.rotation) % 360));
  single.addPage(page);
  return single;
}
export async function readEditorImages(source: Source, item: PageItem, signal: AbortSignal) {
  const single = await editorSinglePage(await loadEditorPdf(source.bytes), item);
  const { inspectObjects } = await import('./native-pdf');
  return (await inspectObjects(await single.save(), 0, signal)).filter(
    (o) =>
      o.type === 'image' &&
      o.x >= 0 &&
      o.y >= 0 &&
      o.w > 0 &&
      o.h > 0 &&
      o.x + o.w <= 1.001 &&
      o.y + o.h <= 1.001 &&
      o.w * o.h < 0.8,
  );
}
async function replacementPixels(data: string, crop?: import('./studio-engine').Rect) {
  const image = new Image();
  image.src = data;
  await image.decode();
  const r = crop || { x: 0, y: 0, w: 1, h: 1 };
  if (image.naturalWidth * image.naturalHeight > 4000000)
    throw new Error('Das Ersatzbild darf höchstens 4 Megapixel haben.');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * r.w));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * r.h));
  try {
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      image,
      r.x * image.naturalWidth,
      r.y * image.naturalHeight,
      r.w * image.naturalWidth,
      r.h * image.naturalHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return {
      width: canvas.width,
      height: canvas.height,
      rgba: new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
    };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
export async function editorImagePreview(
  source: Source,
  item: PageItem,
  index: number,
  signal: AbortSignal,
) {
  const single = await editorSinglePage(await loadEditorPdf(source.bytes), item),
    { readImage } = await import('./native-pdf');
  const pixels = await readImage(await single.save(), 0, index, signal),
    canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  try {
    canvas
      .getContext('2d')!
      .putImageData(
        new ImageData(new Uint8ClampedArray(pixels.rgba), pixels.width, pixels.height),
        0,
        0,
      );
    return canvas.toDataURL('image/png');
  } finally {
    canvas.width = canvas.height = 0;
  }
}

/** pdf-lib may trim a real trailing CR/LF byte from compressed streams when
 * their /Length is an indirect reference parsed later. Restore only the exact,
 * unambiguous source bytes; never re-encode images or guess missing data. */
export async function loadEditorPdf(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes.slice(), { updateMetadata: false });
  const endstream = [101, 110, 100, 115, 116, 114, 101, 97, 109];
  for (const [ref, stream] of document.context.enumerateIndirectObjects()) {
    if (!(stream instanceof PDFRawStream)) continue;
    const length = stream.dict.lookupMaybe(PDFName.of('Length'), PDFNumber)?.asNumber();
    const contents = stream.getContents();
    if (length === undefined || length === contents.length) continue;
    let recovered: Uint8Array | undefined;
    const missing = length - contents.length;
    if (
      stream.dict.get(PDFName.of('Length')) instanceof PDFRef &&
      contents.length >= 16 &&
      (missing === 1 || missing === 2)
    ) {
      for (let at = bytes.indexOf(contents[0]); at >= 0; at = bytes.indexOf(contents[0], at + 1)) {
        if (at + length >= bytes.length || !contents.every((value, i) => bytes[at + i] === value))
          continue;
        const suffix = bytes.subarray(at + contents.length, at + length);
        if (!suffix.every((value) => value === 10 || value === 13)) continue;
        let end = at + length;
        while (end < at + length + 8 && [9, 10, 13, 32].includes(bytes[end])) end++;
        if (!endstream.every((value, i) => bytes[end + i] === value)) continue;
        const candidate = bytes.slice(at, at + length);
        if (recovered && !candidate.every((value, i) => value === recovered![i])) {
          recovered = undefined;
          break;
        }
        recovered = candidate;
      }
    }
    if (!recovered)
      throw new Error(
        'Ein PDF-Datenstrom konnte nicht verlustfrei gelesen werden. Bitte die Datei erneut als PDF speichern.',
      );
    document.context.assign(ref, PDFRawStream.of(stream.dict, recovered));
  }
  return document;
}

/** Remove old text with PDFium, then independently verify the surviving text.
 * The caller can rebuild from visible pixels if this document is unsupported. */
export async function removeEditorContent(
  original: PDFDocument,
  item: PageItem,
  marks: Mark[],
  targets: TextTarget[],
  signal: AbortSignal,
) {
  const single = await editorSinglePage(original, item);
  const removals = marks.flatMap((mark) =>
    editorRemovalRects(mark).map((rect) => ({
      page: 0,
      rect,
      color: mark.fill || '#ffffff',
      textOnly: mark.kind === 'text',
      ...(mark.nativeTextSlice ? { textSlice: mark.nativeTextSlice } : {}),
    })),
  );
  const { removeRegions, editObjects, readImage, inspectObjects } = await import('./native-pdf');
  let cleaned = await single.save();
  const images = marks.filter((m) => m.nativeImage);
  if (images.length) {
    const objects = await inspectObjects(cleaned, 0, signal);
    if (new Set(images.map((m) => m.nativeImage!.index)).size !== images.length)
      throw new Error('Dasselbe Bild wurde mehrfach ausgewählt.');
    const changes = [];
    for (const mark of images) {
      const native = mark.nativeImage!;
      const actual = objects.find((o) => o.index === native.index && o.type === 'image');
      if (
        !actual ||
        (['x', 'y', 'w', 'h'] as const).some(
          (key) => Math.abs(actual[key] - native.rect[key]) > 0.0001,
        )
      )
        throw new Error('Das ursprüngliche Bildobjekt stimmt nicht mehr mit der Auswahl überein.');
      const r = editorImageCropBounds(native.rect, actual.imageCorners, native.crop),
        scale = mark.w / r.w;
      if (Math.abs(mark.h / r.h - scale) > 0.001)
        throw new Error('Vorhandene Bilder bitte proportional skalieren.');
      let image = mark.image ? await replacementPixels(mark.image, native.crop) : undefined;
      if (native.crop && !image) {
        const pixels = await readImage(cleaned, 0, native.index, signal),
          canvas = document.createElement('canvas');
        canvas.width = pixels.width;
        canvas.height = pixels.height;
        try {
          canvas
            .getContext('2d')!
            .putImageData(
              new ImageData(new Uint8ClampedArray(pixels.rgba), pixels.width, pixels.height),
              0,
              0,
            );
          image = await replacementPixels(canvas.toDataURL('image/png'), native.crop);
        } finally {
          canvas.width = canvas.height = 0;
        }
      }
      changes.push({
        index: native.index,
        dx: mark.x + mark.w / 2 - r.x - r.w / 2,
        dy: mark.y + mark.h / 2 - r.y - r.h / 2,
        scale,
        ...(native.crop ? { imageCrop: native.crop } : {}),
        ...(image ? { image } : {}),
      });
    }
    cleaned = await editObjects(cleaned, 0, changes, signal);
  }
  if (removals.length) cleaned = await removeRegions(cleaned, removals, signal);
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: cleaned.slice(),
    disableFontFace: true,
    standardFontDataUrl: '/vendor/pdf/standard_fonts/',
    cMapUrl: '/vendor/pdf/cmaps/',
    cMapPacked: true,
  });
  const cancel = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const proxy = await task.promise;
    const content = await readPdfText(await proxy.getPage(1));
    const actual = content.items
      .filter((p) => 'str' in p)
      .map((p) => ('str' in p ? p.str : ''))
      .join('');
    const expected =
      remainingEditorTargets(
        targets,
        removals.map((r) => r.rect),
      )
        .map((t) => t.text)
        .join('') +
      marks
        .filter((m) => m.nativeTextSlice)
        .map((m) => m.nativeTextSlice!.before + m.nativeTextSlice!.after)
        .join('');
    const normalized = (text: string) => text.normalize('NFKC').replace(/\s/gu, '');
    const counts = (text: string) => [...normalized(text)].sort().join('');
    if (counts(actual) !== counts(expected))
      throw new Error('Die verbleibenden Textinhalte konnten nicht vollständig bestätigt werden.');
  } finally {
    signal.removeEventListener('abort', cancel);
    await task.destroy();
  }
  return PDFDocument.load(cleaned, { updateMetadata: false });
}

/** The editor background uses the same physical removal as export. It is keyed
 * by removal rectangles, not replacement text, so typing does not rerun PDFium. */
export async function renderEditorBackground(
  source: Source,
  item: PageItem,
  marks: Mark[],
  targets: TextTarget[],
  signal: AbortSignal,
  previewSide = 1400,
) {
  const original = await loadEditorPdf(source.bytes);
  const cleaned = await removeEditorContent(original, item, marks, targets, signal);
  signal.throwIfAborted();
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: await cleaned.save(),
    standardFontDataUrl: '/vendor/pdf/standard_fonts/',
    cMapUrl: '/vendor/pdf/cmaps/',
    cMapPacked: true,
    wasmUrl: '/vendor/pdf/wasm/',
  });
  const cancel = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const pdf = await task.promise;
    signal.throwIfAborted();
    return await renderPage({ ...source, pdf }, { index: 0, rotation: 0 }, previewSide, signal);
  } finally {
    signal.removeEventListener('abort', cancel);
    await task.destroy();
  }
}
