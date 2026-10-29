import { PDFDocument, PDFName } from 'pdf-lib';
import type { WrappedPdfiumModule } from '@embedpdf/pdfium';
import { inspectNativeObjectTree, readNativeImage, type NativeObject } from './native-pdf-core';
import { editNativeDocument } from './nested-native';
import { rejectSignedPdf } from './pdf-signature-guard';
export type RepeatedImage = {
  id: string;
  page: number;
  index: number;
  path: number[];
  hash: string;
  width: number;
  height: number;
  rect: { x: number; y: number; w: number; h: number };
};
export type ImageCatalogue = { images: RepeatedImage[]; skipped: number };
async function inspectInput(bytes: Uint8Array) {
  if (bytes.length > 80 * 1024 * 1024) throw new Error('Bitte eine PDF bis 80 MB verwenden.');
  const pdf = await PDFDocument.load(bytes);
  rejectSignedPdf(pdf);
  if (pdf.getPageCount() > 50)
    throw new Error('Bitte höchstens 50 Seiten für den Bildaustausch verwenden.');
  if (pdf.catalog.getAcroForm()?.dict.has(PDFName.of('XFA')))
    throw new Error('Dynamische XFA-Formulare werden hier nicht unterstützt.');
  return pdf.getPageCount();
}
async function fingerprint(image: { width: number; height: number; rgba: Uint8Array }) {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(image.rgba));
  return (
    `${image.width}x${image.height}:` +
    Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, '0')).join('')
  );
}
const objectKey = (page: number, index: number, path: number[]) =>
  `${page}:${path.join('.')}:${index}`;
function eligible(object: NativeObject) {
  return (
    object.type === 'image' &&
    !object.clipped &&
    !object.transparent &&
    object.w > 0 &&
    object.h > 0
  );
}
export async function catalogueImages(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
): Promise<ImageCatalogue> {
  const count = await inspectInput(bytes),
    images: RepeatedImage[] = [];
  let skipped = 0,
    pixels = 0,
    visited = 0;
  for (let page = 0; page < count; page++)
    for (const object of inspectNativeObjectTree(api, bytes, page)) {
      if (object.type !== 'image') continue;
      if (++visited > 1000)
        throw new Error('Mehr als 1.000 Bildobjekte. Bitte weniger Seiten verwenden.');
      if (!eligible(object)) {
        skipped++;
        continue;
      }
      let image: ReturnType<typeof readNativeImage>;
      try {
        image = readNativeImage(api, bytes, page, object.index, object.path || []);
      } catch {
        skipped++;
        continue;
      }
      pixels += image.width * image.height;
      if (pixels > 48_000_000)
        throw new Error(
          'Die Bildanalyse überschreitet 48 Megapixel. Bitte weniger Seiten verwenden.',
        );
      images.push({
        id: objectKey(page, object.index, object.path || []),
        page,
        index: object.index,
        path: object.path || [],
        hash: await fingerprint(image),
        width: image.width,
        height: image.height,
        rect: { x: object.x, y: object.y, w: object.w, h: object.h },
      });
    }
  return { images, skipped };
}
export async function replaceRepeatedImages(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  targets: RepeatedImage[],
  replacement: { width: number; height: number; rgba: Uint8Array },
) {
  const count = await inspectInput(bytes);
  if (
    !targets.length ||
    targets.length > 100 ||
    new Set(targets.map((t) => t.id)).size !== targets.length ||
    new Set(targets.map((t) => t.hash)).size !== 1
  )
    throw new Error('Bitte 1 bis 100 eindeutige Vorkommen einer Bildgruppe auswählen.');
  if (
    !Number.isInteger(replacement.width) ||
    !Number.isInteger(replacement.height) ||
    replacement.width < 1 ||
    replacement.height < 1 ||
    replacement.width * replacement.height > 4_000_000 ||
    replacement.rgba.length !== replacement.width * replacement.height * 4
  )
    throw new Error('Das Ersatzbild darf höchstens 4 Megapixel haben.');
  const originalHashes = new Map<number, NativeObject[]>();
  for (const target of targets) {
    if (
      !Number.isInteger(target.page) ||
      target.page < 0 ||
      target.page >= count ||
      target.id !== objectKey(target.page, target.index, target.path)
    )
      throw new Error('Ungültige Bildfundstelle.');
    if (!originalHashes.has(target.page))
      originalHashes.set(target.page, inspectNativeObjectTree(api, bytes, target.page));
    const object = originalHashes
      .get(target.page)!
      .find(
        (o) =>
          o.index === target.index && JSON.stringify(o.path || []) === JSON.stringify(target.path),
      );
    if (
      !object ||
      !eligible(object) ||
      (await fingerprint(readNativeImage(api, bytes, target.page, target.index, target.path))) !==
        target.hash
    )
      throw new Error('Die Bildfundstelle hat sich geändert. Bilder erneut suchen.');
  }
  let output: Uint8Array = bytes.slice();
  const groups = new Map<string, RepeatedImage[]>();
  for (const target of targets) {
    const key = `${target.page}:${target.path.join('.')}`;
    groups.set(key, [...(groups.get(key) || []), target]);
  }
  for (const group of groups.values()) {
    output = await editNativeDocument(
      api,
      output,
      group[0].page,
      group.map((t) => ({ index: t.index, image: replacement })),
      group[0].path,
    );
    if (output.length > 160 * 1024 * 1024)
      throw new Error(
        'Die Ausgabe überschreitet 160 MB. Bitte ein kleineres Ersatzbild verwenden.',
      );
  }
  if ((await PDFDocument.load(output)).getPageCount() !== count)
    throw new Error('Die Seitenzahl hat sich unerwartet geändert.');
  return output;
}
