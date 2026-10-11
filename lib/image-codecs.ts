import { PDFDocument } from 'pdf-lib';
export type RasterFormat = 'png' | 'jpg' | 'webp' | 'tiff' | 'bmp';
export function encodeBmp(rgba: Uint8Array, width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 40000000 ||
    rgba.length !== width * height * 4
  )
    throw new Error('Ungültige Bildgröße.');
  const stride = (width * 3 + 3) & ~3,
    size = 54 + stride * height,
    bytes = new Uint8Array(size),
    v = new DataView(bytes.buffer);
  bytes.set([0x42, 0x4d]);
  v.setUint32(2, size, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, width, true);
  v.setInt32(22, height, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, stride * height, true);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = (y * width + x) * 4,
        b = 54 + (height - y - 1) * stride + x * 3,
        alpha = rgba[a + 3] / 255;
      for (let c = 0; c < 3; c++)
        bytes[b + c] = Math.round(rgba[a + 2 - c] * alpha + 255 * (1 - alpha));
    }
  return bytes;
}
export async function rasterBlob(
  canvas: HTMLCanvasElement,
  format: RasterFormat,
  quality = 0.92,
): Promise<Blob> {
  if (format === 'tiff' || format === 'bmp') {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    if (format === 'bmp')
      return new Blob([encodeBmp(new Uint8Array(data), canvas.width, canvas.height)], {
        type: 'image/bmp',
      });
    const { default: UTIF } = await import('utif');
    return new Blob([UTIF.encodeImage(new Uint8Array(data), canvas.width, canvas.height)], {
      type: 'image/tiff',
    });
  }
  const type = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob && blob.type === type
          ? resolve(blob)
          : reject(
              new Error(
                'Dieses Bildformat wird von deinem Browser nicht unterstützt. Bitte PNG oder JPG wählen.',
              ),
            ),
      type,
      quality,
    ),
  );
}
export function validateSvg(text: string) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
    throw new Error('Die SVG-Datei ist ungültig.');
  if (
    doc.querySelector('script,foreignObject,iframe,object,embed') ||
    /<!ENTITY|<!DOCTYPE|@import|url\(\s*['"]?(?!#)/i.test(text)
  )
    throw new Error('Bitte eine eigenständige SVG ohne Skripte oder externe Inhalte verwenden.');
  for (const el of doc.querySelectorAll('*'))
    for (const a of Array.from(el.attributes))
      if (
        /^on/i.test(a.name) ||
        (/(?:^|:)href$/.test(a.name) &&
          a.value &&
          !a.value.startsWith('#') &&
          !/^data:image\/(png|jpeg|webp);base64,/i.test(a.value))
      )
        throw new Error('Die SVG enthält aktive oder externe Inhalte.');
}
export async function imageFilePdf(file: File, bytes: Uint8Array) {
  const pdf = await PDFDocument.create();
  const add = async (canvas: HTMLCanvasElement) => {
    const jpg = await pdf.embedJpg(canvas.toDataURL('image/jpeg', 0.94)),
      size: [number, number] = canvas.width > canvas.height ? [841.89, 595.28] : [595.28, 841.89],
      page = pdf.addPage(size),
      fitted = jpg.scaleToFit(size[0] - 40, size[1] - 40);
    page.drawImage(jpg, {
      x: (size[0] - fitted.width) / 2,
      y: (size[1] - fitted.height) / 2,
      ...fitted,
    });
  };
  const tiff =
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 42) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[3] === 42);
  const special = /\.psd$/i.test(file.name) ? 'psd' : /\.hei[cf]$/i.test(file.name) ? 'heic' : null;
  if (special) {
    const { decodeSpecialImage } = await import('./image-decoder');
    const image = await decodeSpecialImage(bytes, special);
    const full = document.createElement('canvas'),
      small = document.createElement('canvas');
    try {
      full.width = image.width;
      full.height = image.height;
      full
        .getContext('2d')!
        .putImageData(
          new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height),
          0,
          0,
        );
      const scale = Math.min(1, 3500 / Math.max(image.width, image.height));
      small.width = Math.max(1, Math.round(image.width * scale));
      small.height = Math.max(1, Math.round(image.height * scale));
      const ctx = small.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, small.width, small.height);
      ctx.drawImage(full, 0, 0, small.width, small.height);
      await add(small);
    } finally {
      full.width = full.height = small.width = small.height = 0;
    }
  } else if (tiff) {
    const { default: UTIF } = await import('utif'),
      buffer = bytes.slice().buffer,
      pages = UTIF.decode(buffer);
    if (!pages.length || pages.length > 200)
      throw new Error('TIFF: Bitte 1 bis 200 Bildseiten verwenden.');
    let pixels = 0;
    for (const page of pages) {
      const w = Number((page.t256 as number[])?.[0]),
        h = Number((page.t257 as number[])?.[0]);
      if (
        !Number.isInteger(w) ||
        !Number.isInteger(h) ||
        w < 1 ||
        h < 1 ||
        w * h > 40000000 ||
        (pixels += w * h) > 100000000
      )
        throw new Error(
          'TIFF zu groß: höchstens 40 Megapixel je Seite und 100 Megapixel insgesamt.',
        );
      UTIF.decodeImage(buffer, page);
      const rgba = UTIF.toRGBA8(page),
        full = document.createElement('canvas'),
        small = document.createElement('canvas');
      try {
        full.width = w;
        full.height = h;
        full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
        const scale = Math.min(1, 3500 / Math.max(w, h));
        small.width = Math.round(w * scale);
        small.height = Math.round(h * scale);
        const ctx = small.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, small.width, small.height);
        ctx.drawImage(full, 0, 0, small.width, small.height);
        await add(small);
      } finally {
        full.width = full.height = small.width = small.height = 0;
        page.data = new Uint8Array(0);
      }
    }
  } else {
    const svg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml';
    if (svg) validateSvg(new TextDecoder().decode(bytes));
    const known =
      svg ||
      (bytes[0] === 0x89 && bytes[1] === 0x50) ||
      (bytes[0] === 0xff && bytes[1] === 0xd8) ||
      (bytes[0] === 0x42 && bytes[1] === 0x4d) ||
      (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
        new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP');
    if (!known)
      throw new Error(
        'Unterstützt werden PDF, Rechnungs-XML, JPG, PNG, WebP, BMP, TIFF, HEIC, PSD und eigenständige SVG.',
      );
    const url = URL.createObjectURL(
        svg ? new Blob([bytes.slice()], { type: 'image/svg+xml' }) : file,
      ),
      image = new Image(),
      canvas = document.createElement('canvas');
    try {
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 40000000)
        throw new Error('Das Bild darf höchstens 40 Megapixel haben.');
      const scale = Math.min(1, 3500 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      await add(canvas);
    } finally {
      URL.revokeObjectURL(url);
      canvas.width = canvas.height = 0;
    }
  }
  return new Uint8Array(await pdf.save());
}
