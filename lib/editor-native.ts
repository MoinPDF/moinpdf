import {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFObjectCopier,
  degrees,
} from 'pdf-lib';
import { renderPage, type PageItem, type Source } from './pdf-engine';
import type { Mark, Edits } from './studio-engine';
import {
  editorRemovalRects,
  editorImageCropBounds,
  editorRectsOverlap,
  editorMarkChanged,
  type TextTarget,
} from './editor-model';
import { remainingEditorTargets } from './editor-analysis';
import { readPdfText } from './pdf-text';

export async function editorSinglePage(original: PDFDocument, item: PageItem) {
  const single = await PDFDocument.create(),
    [page] = await single.copyPages(original, [item.index]);
  page.setRotation(degrees((page.getRotation().angle + item.rotation) % 360));
  single.addPage(page);
  return single;
}

/** Keep the original form tree and page references. Only page drawing streams
 * may change; widget appearance/actions/values are deliberately untouched. */
export async function requireEditorFormLayout(
  source: Source,
  pages: PageItem[],
  edits: Edits,
  signal: AbortSignal,
) {
  if (
    pages.length !== source.pdf.numPages ||
    pages.some(
      (p, i) => p.sourceId !== source.id || p.index !== i || p.rotation || edits.crops[p.id],
    )
  )
    throw new Error(
      'Formularfelder bleiben nur bei vollständiger, unveränderter Seitenreihenfolge ohne Drehung oder Beschnitt erhalten.',
    );
  for (const item of pages) {
    signal.throwIfAborted();
    const marks = (edits.marks[item.id] || []).filter(editorMarkChanged);
    if (marks.some((m) => m.kind === 'redact'))
      throw new Error('Formularseiten können nicht als Bild neu aufgebaut werden.');
    if (!marks.length) continue;
    const page = await source.pdf.getPage(item.index + 1),
      viewport = page.getViewport({ scale: 1 });
    for (const annotation of await page.getAnnotations()) {
      if (annotation.subtype !== 'Widget' || !Array.isArray(annotation.rect)) continue;
      const [ma, mb, mc, md, me, mf] = viewport.transform;
      const [x0, y0, x1, y1] = annotation.rect as number[];
      const [a, b, c, d] = [
        ma * x0 + mc * y0 + me,
        mb * x0 + md * y0 + mf,
        ma * x1 + mc * y1 + me,
        mb * x1 + md * y1 + mf,
      ];
      const rect = {
        x: Math.min(a, c) / viewport.width,
        y: Math.min(b, d) / viewport.height,
        w: Math.abs(c - a) / viewport.width,
        h: Math.abs(d - b) / viewport.height,
      };
      if (marks.some((m) => [m, ...editorRemovalRects(m)].some((r) => editorRectsOverlap(r, rect))))
        throw new Error(
          'Die Änderung berührt ein Formularfeld. Bitte den Text außerhalb des Formularfelds bearbeiten.',
        );
    }
  }
}
export async function preserveEditorForm(original: PDFDocument, edited: PDFDocument) {
  if (original.getPageCount() !== edited.getPageCount())
    throw new Error('Die Formularseiten stimmen nicht mehr überein.');
  await edited.flush();
  const copier = PDFObjectCopier.for(edited.context, original.context);
  original.getPages().forEach((page, i) => {
    const result = edited.getPage(i);
    if (
      page.getRotation().angle !== result.getRotation().angle ||
      JSON.stringify(page.getMediaBox()) !== JSON.stringify(result.getMediaBox()) ||
      JSON.stringify(page.getCropBox()) !== JSON.stringify(result.getCropBox())
    )
      throw new Error('Die Geometrie einer Formularseite wurde verändert.');
    for (const key of ['Contents', 'Resources']) {
      const value = key === 'Resources' ? result.node.Resources() : result.node.Contents();
      if (value) page.node.set(PDFName.of(key), copier.copy(value));
      else page.node.delete(PDFName.of(key));
    }
  });
  return original;
}
export async function readEditorImages(source: Source, item: PageItem, signal: AbortSignal) {
  const single = await editorSinglePage(await loadEditorPdf(source.bytes, source, signal), item);
  const { inspectObjectTree } = await import('./native-pdf');
  return (await inspectObjectTree(await single.save(), 0, signal)).filter(
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

/** Preserve the pixel grid of a simple full-page scan. A separate PDF.js render
 * must agree before using decoded image pixels; clipping, blend effects, extra
 * objects, annotations, layers, and ambiguous geometry keep the normal path. */
export async function readEditorScanPixels(
  original: PDFDocument,
  source: Source,
  item: PageItem,
  signal: AbortSignal,
): Promise<Awaited<ReturnType<typeof renderPage>> | undefined> {
  let canvas: HTMLCanvasElement | undefined,
    reference: HTMLCanvasElement | undefined,
    pixelsCanvas: HTMLCanvasElement | undefined;
  try {
    signal.throwIfAborted();
    if (original.catalog.has(PDFName.of('OCProperties'))) return;
    const pdfPage = await source.pdf.getPage(item.index + 1);
    if ((await pdfPage.getAnnotations()).length) return;
    const single = await editorSinglePage(original, item),
      bytes = await single.save();
    const { inspectObjects, readImage } = await import('./native-pdf');
    const objects = await inspectObjects(bytes, 0, signal),
      image = objects[0];
    if (objects.length !== 1 || image.type !== 'image' || !image.imageCorners) return;
    if (
      Math.abs(image.x) + Math.abs(image.y) + Math.abs(image.w - 1) + Math.abs(image.h - 1) >
      0.000001
    )
      return;
    if (
      image.imageCorners
        .flat()
        .some((v) => Math.abs(v - Math.round(v)) > 0.000001 || v < -0.000001 || v > 1.000001)
    )
      return;
    const [a, b, c] = image.imageCorners.map((p) => p.map(Math.round)),
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      ex = c[0] - a[0],
      ey = c[1] - a[1];
    if (Math.abs(dx * ey - dy * ex) !== 1 || dx * ex + dy * ey !== 0) return;
    const pixels = await readImage(bytes, 0, image.index, signal),
      width = dx ? pixels.width : pixels.height,
      height = dx ? pixels.height : pixels.width,
      base = pdfPage.getViewport({ scale: 1, rotation: (pdfPage.rotate + item.rotation) % 360 }),
      scale = width / base.width;
    if (Math.abs(base.height * scale - height) > 0.01) return;
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    pixelsCanvas = document.createElement('canvas');
    pixelsCanvas.width = pixels.width;
    pixelsCanvas.height = pixels.height;
    pixelsCanvas
      .getContext('2d')!
      .putImageData(
        new ImageData(new Uint8ClampedArray(pixels.rgba), pixels.width, pixels.height),
        0,
        0,
      );
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(
      (dx * width) / pixels.width,
      (dy * height) / pixels.width,
      (ex * width) / pixels.height,
      (ey * height) / pixels.height,
      a[0] * width,
      a[1] * height,
    );
    ctx.drawImage(pixelsCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    reference = document.createElement('canvas');
    reference.width = width;
    reference.height = height;
    const task = pdfPage.render({
        canvas: reference,
        viewport: pdfPage.getViewport({ scale, rotation: (pdfPage.rotate + item.rotation) % 360 }),
        background: 'rgb(255,255,255)',
      }),
      cancel = () => task.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      await task.promise;
      signal.throwIfAborted();
    } finally {
      signal.removeEventListener('abort', cancel);
    }
    const actual = reference.getContext('2d')!.getImageData(0, 0, width, height).data,
      candidate = ctx.getImageData(0, 0, width, height).data;
    let differences = 0;
    for (let i = 0; i < actual.length; i += 4) {
      if (
        Math.max(
          Math.abs(actual[i] - candidate[i]),
          Math.abs(actual[i + 1] - candidate[i + 1]),
          Math.abs(actual[i + 2] - candidate[i + 2]),
        ) > 12
      )
        differences++;
    }
    if (differences / (width * height) > 0.0001) return;
    const result = { canvas, width: base.width, height: base.height, scale };
    canvas = undefined;
    return result;
  } catch {
    signal.throwIfAborted();
    return;
  } finally {
    for (const buffer of [canvas, reference, pixelsCanvas])
      if (buffer) buffer.width = buffer.height = 0;
  }
}

/** Correct bounded tiles of a simple, upright full-page scan without resizing
 * the source image. Unsupported compositing remains an explicit fallback. */
export async function patchEditorScan(
  original: PDFDocument,
  source: Source,
  item: PageItem,
  marks: Mark[],
  targets: TextTarget[],
  replaceTextLayer: boolean,
  signal: AbortSignal,
) {
  if (original.catalog.has(PDFName.of('OCProperties'))) return;
  const page = await source.pdf.getPage(item.index + 1);
  if ((await page.getAnnotations()).length) return;
  const single = await editorSinglePage(original, item),
    bytes = await single.save();
  const { inspectObjects, readImage, editObjects } = await import('./native-pdf');
  const objects = await inspectObjects(bytes, 0, signal),
    images = objects.filter((o) => o.type === 'image'),
    image = images[0];
  if (
    images.length !== 1 ||
    objects.some((o) => !['image', 'text'].includes(o.type) || o.clipped) ||
    !image.imageCorners
  )
    return;
  const expected = [
    [0, 0],
    [1, 0],
    [0, 1],
  ];
  if (image.imageCorners.some((p, i) => p.some((n, j) => Math.abs(n - expected[i][j]) > 0.00001)))
    return;
  const parts = marks.flatMap((mark) =>
    editorRemovalRects(mark).map((rect) => ({
      rect,
      mode: mark.scanBackground || 'preserve',
      fill: mark.fill || '#ffffff',
    })),
  );
  if (!parts.length || parts.length > 200) return;
  const contains = (r: import('./studio-engine').Rect, o: import('./studio-engine').Rect) =>
    o.x >= r.x - 0.00003 &&
    o.y >= r.y - 0.00003 &&
    o.x + o.w <= r.x + r.w + 0.00003 &&
    o.y + o.h <= r.y + r.h + 0.00003;
  const hidden = objects.filter(
    (o) =>
      o.type === 'text' && (o.textMode === 3 || targets.some((t) => t.invisible && contains(t, o))),
  );
  const removed = hidden.filter(
    (o) => replaceTextLayer || parts.some((p) => editorRectsOverlap(p.rect, o)),
  );
  if (
    removed.some((o) => o.shaped || (!replaceTextLayer && !parts.some((p) => contains(p.rect, o))))
  )
    return;
  if (
    objects.some(
      (o) =>
        o.type === 'text' &&
        !hidden.includes(o) &&
        parts.some((p) => editorRectsOverlap(p.rect, o)),
    )
  )
    return;
  const contexts = parts.map(({ rect: r }) => {
    const x = Math.max(0, r.x - 0.005),
      y = Math.max(0, r.y - 0.005);
    return { x, y, w: Math.min(1, r.x + r.w + 0.005) - x, h: Math.min(1, r.y + r.h + 0.005) - y };
  });
  // Merge before sampling; an overlapping later tile must never restore pixels
  // removed by an earlier correction.
  for (let i = 0; i < contexts.length; i++)
    for (let j = i + 1; j < contexts.length; j++) {
      const a = contexts[i],
        b = contexts[j];
      if (a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h) {
        const x = Math.min(a.x, b.x),
          y = Math.min(a.y, b.y);
        contexts[i] = {
          x,
          y,
          w: Math.max(a.x + a.w, b.x + b.w) - x,
          h: Math.max(a.y + a.h, b.y + b.h) - y,
        };
        contexts.splice(j, 1);
        i = -1;
        break;
      }
    }
  const patches: import('./native-pdf-core').NativeImagePatch[] = [];
  const { eraseEditorScanRegion } = await import('./editor-scan');
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + item.rotation) % 360 });
  for (const region of contexts) {
    signal.throwIfAborted();
    const tile = await readImage(bytes, 0, image.index, signal, [], region),
      scale = tile.sourceWidth / base.width;
    if (
      Math.abs(base.height * scale - tile.sourceHeight) > 0.01 ||
      patches.reduce((n, p) => n + p.width * p.height, 0) + tile.width * tile.height > 4000000
    )
      return;
    const canvas = document.createElement('canvas'),
      reference = document.createElement('canvas');
    canvas.width = reference.width = tile.width;
    canvas.height = reference.height = tile.height;
    try {
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(
        new ImageData(new Uint8ClampedArray(tile.rgba), tile.width, tile.height),
        0,
        0,
      );
      const task = page.render({
        canvas: reference,
        viewport: page.getViewport({ scale, rotation: (page.rotate + item.rotation) % 360 }),
        transform: [1, 0, 0, 1, -tile.x, -tile.y],
        background: 'rgb(255,255,255)',
      });
      const cancel = () => task.cancel();
      signal.addEventListener('abort', cancel, { once: true });
      try {
        await task.promise;
        signal.throwIfAborted();
      } finally {
        signal.removeEventListener('abort', cancel);
      }
      const actual = reference.getContext('2d')!.getImageData(0, 0, tile.width, tile.height).data;
      let different = 0;
      for (let p = 0; p < actual.length; p += 4)
        if (Math.max(...[0, 1, 2].map((c) => Math.abs(actual[p + c] - tile.rgba[p + c]))) > 12)
          different++;
      if (different / (tile.width * tile.height) > 0.0001) return;
      for (const part of parts) {
        if (!editorRectsOverlap(part.rect, region)) continue;
        eraseEditorScanRegion(
          canvas,
          {
            x: (part.rect.x * tile.sourceWidth - tile.x) / tile.width,
            y: (part.rect.y * tile.sourceHeight - tile.y) / tile.height,
            w: (part.rect.w * tile.sourceWidth) / tile.width,
            h: (part.rect.h * tile.sourceHeight) / tile.height,
          },
          part.mode as 'preserve' | 'solid',
          part.fill,
        );
      }
      patches.push({
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
        rgba: new Uint8Array(ctx.getImageData(0, 0, tile.width, tile.height).data),
      });
    } finally {
      canvas.width = canvas.height = reference.width = reference.height = 0;
    }
  }
  const changed = await editObjects(
    bytes,
    0,
    [
      { index: image.index, imagePatches: patches },
      ...removed.map((o) => ({ index: o.index, remove: true })),
    ],
    signal,
  );
  signal.throwIfAborted();
  return PDFDocument.load(changed, { updateMetadata: false });
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
  path: number[] = [],
) {
  const single = await editorSinglePage(await loadEditorPdf(source.bytes, source, signal), item),
    { readImage } = await import('./native-pdf');
  const pixels = await readImage(await single.save(), 0, index, signal, path),
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
const repairedSources = new WeakSet<Source>();
export const editorSourceWasRepaired = (source: Source) => repairedSources.has(source);
export async function loadEditorPdf(bytes: Uint8Array, source?: Source, signal?: AbortSignal) {
  signal?.throwIfAborted();
  try {
    return await loadEditorPdfStrict(bytes);
  } catch (error) {
    signal?.throwIfAborted();
    if (!source || !signal) throw error;
    const recovered = await loadEditorPdfStrict(
      await (await import('./editor-repair')).repairEditorSource(source, signal),
    );
    repairedSources.add(source);
    return recovered;
  }
}
async function loadEditorPdfStrict(bytes: Uint8Array) {
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
  const { removeRegions, editObjects, readImage, inspectObjectTree } = await import('./native-pdf');
  let cleaned = await single.save();
  if (removals.some((r) => r.textOnly)) {
    const objects = await inspectObjectTree(cleaned, 0, signal);
    // Regenerating a page can discard text clipping. Check the unmodified
    // object tree before either root-level or nested editing is attempted.
    if (objects.some((o) => o.clipped))
      throw new Error(
        'Beschnittener Text oder Text in einer Schnittmaske kann hier nicht zuverlässig entfernt werden.',
      );
  }
  const images = marks.filter((m) => m.nativeImage);
  if (images.length) {
    const objects = await inspectObjectTree(cleaned, 0, signal);
    const identity = (index: number, path: number[] = []) => path.join('.') + ':' + index;
    if (
      new Set(images.map((m) => identity(m.nativeImage!.index, m.nativeImage!.path))).size !==
      images.length
    )
      throw new Error('Dasselbe Bild wurde mehrfach ausgewählt.');
    const groups = new Map<
      string,
      { path: number[]; changes: import('./native-pdf').NativeChange[] }
    >();
    for (const mark of images) {
      const native = mark.nativeImage!;
      const actual = objects.find(
        (o) =>
          identity(o.index, o.path) === identity(native.index, native.path) && o.type === 'image',
      );
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
        const pixels = await readImage(cleaned, 0, native.index, signal, native.path),
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
      const path = native.path || [],
        key = path.join('.');
      const group = groups.get(key) || { path, changes: [] };
      groups.set(key, group);
      group.changes.push({
        index: native.index,
        dx: mark.x + mark.w / 2 - r.x - r.w / 2,
        dy: mark.y + mark.h / 2 - r.y - r.h / 2,
        scale,
        ...(native.crop ? { imageCrop: native.crop } : {}),
        ...(image ? { image } : {}),
      });
    }
    for (const group of [...groups.values()].sort((a, b) => b.path.length - a.path.length))
      cleaned = await editObjects(cleaned, 0, group.changes, signal, group.path);
  }
  if (marks.some((m) => m.nativeTable))
    cleaned = await (
      await import('./editor-table-workspace')
    ).removeEditorTablePaths(cleaned, marks, targets, signal);
  if (removals.length) {
    try {
      cleaned = await removeRegions(cleaned, removals, signal);
    } catch (error) {
      signal.throwIfAborted();
      if (removals.some((r) => !r.textOnly || r.textSlice)) throw error;
      const objects = await inspectObjectTree(cleaned, 0, signal);
      if (
        !objects.some((o) => o.path?.length) ||
        objects.some((o) => o.clipped || o.type === 'other')
      )
        throw error;
      const groups = new Map<
        string,
        { path: number[]; changes: import('./native-pdf').NativeChange[] }
      >();
      for (const object of objects.filter(
        (o) => o.type === 'text' && removals.some((r) => editorRectsOverlap(o, r.rect)),
      )) {
        const contains = removals.some(
          ({ rect: r }) =>
            object.x >= r.x - 0.00003 &&
            object.y >= r.y - 0.00003 &&
            object.x + object.w <= r.x + r.w + 0.00003 &&
            object.y + object.h <= r.y + r.h + 0.00003,
        );
        if (
          !contains ||
          object.shaped ||
          object.textMode === undefined ||
          object.textMode < 0 ||
          object.textMode >= 3
        )
          throw error;
        const path = object.path || [],
          key = path.join('.'),
          group = groups.get(key) || { path, changes: [] };
        group.changes.push({ index: object.index, remove: true });
        groups.set(key, group);
      }
      if (!groups.size) throw error;
      const order = (a: number[], b: number[]) =>
        b.length - a.length || a.reduce((value, n, i) => value || (b[i] || 0) - n, 0);
      for (const group of [...groups.values()].sort((a, b) => order(a.path, b.path)))
        cleaned = await editObjects(cleaned, 0, group.changes, signal, group.path);
    }
  }
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
  const original = await loadEditorPdf(source.bytes, source, signal);
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
