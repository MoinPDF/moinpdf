import {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  rectangle,
  clip,
  endPath,
  type PDFPage,
  type PDFImage,
} from 'pdf-lib';
import { pdfImageOptions, type PageItem, type Source } from './pdf-engine';
import type { Rect } from './studio-engine';

export function drawEditorScanImage(
  page: PDFPage,
  image: PDFImage,
  transforms: number[][],
  formClips: number[][] = [],
) {
  page.pushOperators(
    pushGraphicsState(),
    ...formClips.flatMap(([x0, y0, x1, y1]) => [
      rectangle(x0, y0, x1 - x0, y1 - y0),
      clip(),
      endPath(),
    ]),
    ...transforms.map((m) => concatTransformationMatrix(m[0], m[1], m[2], m[3], m[4], m[5])),
  );
  page.drawImage(image, { x: 0, y: 0, width: 1, height: 1 });
  page.pushOperators(popGraphicsState());
}

/** A searchable scan may sit inside a clipped Form with a slightly different
 * image aspect ratio. Keep its pixels AND physical placement. Never infer a
 * page-sized image from its rounded native bounds. */
export async function readEditorScanGeometry(
  original: PDFDocument,
  source: Source,
  item: PageItem,
  signal: AbortSignal,
) {
  const page = await source.pdf.getPage(item.index + 1),
    base = page.getViewport({ scale: 1 });
  if (page.rotate || item.rotation || page.view[0] || page.view[1]) return;
  const { OPS, getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const ops = await page.getOperatorList();
  const multiply = (a: number[], b: number[]) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  let matrix = [1, 0, 0, 1, 0, 0],
    transforms: number[][] = [],
    imageMatrix: number[] | undefined,
    imageTransforms: number[][] | undefined;
  const stack: { matrix: number[]; transforms: number[][] }[] = [],
    formClips: number[][] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i],
      args = ops.argsArray[i];
    if (fn === OPS.save) stack.push({ matrix: [...matrix], transforms: [...transforms] });
    else if (fn === OPS.restore) {
      const saved = stack.pop();
      if (!saved) return;
      ({ matrix, transforms } = saved);
    } else if (fn === OPS.transform) {
      const transform = Array.from(args) as number[];
      matrix = multiply(matrix, transform);
      transforms.push(transform);
    } else if (fn === OPS.paintFormXObjectBegin) {
      stack.push({ matrix: [...matrix], transforms: [...transforms] });
      if (args[0]) {
        const transform = Array.from(args[0]) as number[];
        matrix = multiply(matrix, transform);
        transforms.push(transform);
      }
      // Retain the bounds for the image-coverage check below.
      if (args[1]) {
        if (matrix[1] || matrix[2] || matrix[0] <= 0 || matrix[3] <= 0) return;
        const [x0, y0, x1, y1] = Array.from(args[1]) as number[];
        formClips.push([
          matrix[0] * x0 + matrix[4],
          matrix[3] * y0 + matrix[5],
          matrix[0] * x1 + matrix[4],
          matrix[3] * y1 + matrix[5],
        ]);
      }
    } else if (fn === OPS.paintFormXObjectEnd) {
      const saved = stack.pop();
      if (!saved) return;
      ({ matrix, transforms } = saved);
    } else if (fn === OPS.paintImageXObject) {
      if (imageMatrix) return;
      imageMatrix = [...matrix];
      imageTransforms = [...transforms];
    } else if (
      [
        OPS.clip,
        OPS.eoClip,
        OPS.beginGroup,
        OPS.paintInlineImageXObject,
        OPS.paintInlineImageXObjectGroup,
        OPS.paintImageXObjectRepeat,
        OPS.paintImageMaskXObject,
        OPS.paintImageMaskXObjectGroup,
        OPS.paintImageMaskXObjectRepeat,
        OPS.paintSolidColorImageMask,
      ].includes(fn)
    )
      return;
  }
  if (!imageMatrix || !imageTransforms || stack.length || !imageMatrix.every(Number.isFinite))
    return;
  const [w, b, c, h, x, y] = imageMatrix;
  if (b || c || w <= 0 || h <= 0) return;
  // Clipping may cover the image rather than the slightly larger white page.
  // It must not cut any image pixels visible inside the page.
  if (
    formClips.some(
      ([x0, y0, x1, y1]) =>
        x0 > Math.max(0, x) + 0.0001 ||
        y0 > Math.max(0, y) + 0.0001 ||
        x1 < Math.min(base.width, x + w) - 0.0001 ||
        y1 < Math.min(base.height, y + h) - 0.0001,
    )
  )
    return;
  const placement: Rect = {
    x: x / base.width,
    y: (base.height - y - h) / base.height,
    w: w / base.width,
    h: h / base.height,
  };
  if (
    Math.abs(placement.x) +
      Math.abs(placement.y) +
      Math.abs(placement.w - 1) +
      Math.abs(placement.h - 1) >
    0.001
  )
    return;
  const single = await PDFDocument.create();
  single.addPage((await single.copyPages(original, [item.index]))[0]);
  const images = single.context
    .enumerateIndirectObjects()
    .filter(
      ([, value]) =>
        value instanceof PDFRawStream &&
        value.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
    );
  if (images.length !== 1) return;
  const stream = images[0][1] as PDFRawStream,
    dict = stream.dict;
  if (
    dict.get(PDFName.of('ColorSpace')) !== PDFName.of('DeviceRGB') ||
    dict.get(PDFName.of('Filter')) !== PDFName.of('FlateDecode') ||
    dict.lookup(PDFName.of('BitsPerComponent'), PDFNumber).asNumber() !== 8 ||
    ['Mask', 'SMask', 'Decode', 'Interpolate', 'OC'].some((key) => dict.has(PDFName.of(key)))
  )
    return;
  const width = dict.lookup(PDFName.of('Width'), PDFNumber).asNumber(),
    height = dict.lookup(PDFName.of('Height'), PDFNumber).asNumber();
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 8000000
  )
    return;
  signal.throwIfAborted();
  const pixels = decodePDFRawStream(stream).decode();
  if (pixels.length !== width * height * 3) return;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    rgba[j] = pixels[i];
    rgba[j + 1] = pixels[i + 1];
    rgba[j + 2] = pixels[i + 2];
    rgba[j + 3] = 255;
  }
  const canvas = document.createElement('canvas'),
    reference = document.createElement('canvas'),
    candidate = document.createElement('canvas');
  let keep = false;
  let task: ReturnType<typeof getDocument> | undefined;
  const cancel = () => {
    void task?.destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0);
    const proof = await PDFDocument.create(),
      image = await proof.embedPng(canvas.toDataURL('image/png'));
    drawEditorScanImage(
      proof.addPage([base.width, base.height]),
      image,
      imageTransforms,
      formClips,
    );
    task = getDocument({ ...pdfImageOptions(), data: await proof.save() });
    const proxy = await task.promise,
      proofPage = await proxy.getPage(1);
    // Exact independent renders reject visible text, color effects, and any
    // other page content that the single decoded image cannot reproduce.
    for (const side of [800, 1600]) {
      signal.throwIfAborted();
      const viewport = page.getViewport({ scale: side / Math.max(base.width, base.height) });
      reference.width = candidate.width = Math.ceil(viewport.width);
      reference.height = candidate.height = Math.ceil(viewport.height);
      for (const [pdfPage, buffer] of [
        [page, reference],
        [proofPage, candidate],
      ] as const) {
        const render = pdfPage.render({ canvas: buffer, viewport, background: 'rgb(255,255,255)' }),
          abort = () => render.cancel();
        signal.addEventListener('abort', abort, { once: true });
        try {
          await render.promise;
        } finally {
          signal.removeEventListener('abort', abort);
        }
      }
      const a = reference
          .getContext('2d')!
          .getImageData(0, 0, reference.width, reference.height).data,
        b = candidate.getContext('2d')!.getImageData(0, 0, candidate.width, candidate.height).data;
      if (a.some((v, i) => v !== b[i])) return;
    }
    signal.throwIfAborted();
    keep = true;
    return {
      canvas,
      width: base.width,
      height: base.height,
      scale: width / w,
      placement,
      imageTransforms,
      formClips,
    };
  } finally {
    signal.removeEventListener('abort', cancel);
    await task?.destroy();
    reference.width = reference.height = candidate.width = candidate.height = 0;
    if (!keep) canvas.width = canvas.height = 0;
  }
}
