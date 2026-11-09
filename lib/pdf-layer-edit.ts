import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFRawStream,
  PDFHexString,
  decodePDFRawStream,
} from 'pdf-lib';
import type { WrappedPdfiumModule } from '@embedpdf/pdfium';
import { markNativeLayerObjects, nativeMarkerId } from './native-pdf-core';
export type LayerAssignment = { page: number; indices: number[]; target: string; name: string };
const N = PDFName.of;
export async function assignPdfLayer(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  settings: LayerAssignment,
) {
  const { page: pageIndex, indices, target, name } = settings;
  if (
    !Number.isInteger(pageIndex) ||
    pageIndex < 0 ||
    !Array.isArray(indices) ||
    indices.length > 500 ||
    (target === 'new' && (!name.trim() || name.length > 200)) ||
    (target !== 'new' && !indices.length)
  )
    throw new Error('Ungültige Ebene oder Objektauswahl.');
  const marker = 'MoinLayer' + nativeMarkerId(),
    doc = await PDFDocument.load(
      indices.length ? markNativeLayerObjects(api, bytes, pageIndex, indices, marker) : bytes,
    );
  if (pageIndex >= doc.getPageCount()) throw new Error('Ungültige Seite.');
  let props = doc.catalog.lookupMaybe(N('OCProperties'), PDFDict);
  if (!props) {
    props = doc.context.obj({ OCGs: [], D: { Order: [], ON: [], OFF: [] } });
    doc.catalog.set(N('OCProperties'), props);
  }
  let groups = props.lookupMaybe(N('OCGs'), PDFArray);
  if (!groups) {
    groups = doc.context.obj([]);
    props.set(N('OCGs'), groups);
  }
  if (groups.size() >= 200) throw new Error('Höchstens 200 Ebenen pro Dokument.');
  let targetRef: PDFRef | undefined;
  if (target === 'new') {
    targetRef = doc.context.register(
      doc.context.obj({ Type: 'OCG', Name: PDFHexString.fromText(name.trim()) }),
    );
    groups.push(targetRef);
    let config = props.lookupMaybe(N('D'), PDFDict);
    if (!config) {
      config = doc.context.obj({});
      props.set(N('D'), config);
    }
    for (const key of ['Order', 'ON']) {
      let array = config.lookupMaybe(N(key), PDFArray);
      if (!array) {
        array = doc.context.obj([]);
        config.set(N(key), array);
      }
      array.push(targetRef);
    }
  } else if (target !== 'none') {
    targetRef = groups
      .asArray()
      .find(
        (ref) =>
          ref instanceof PDFRef && `${ref.objectNumber}R${ref.generationNumber || ''}` === target,
      ) as PDFRef | undefined;
    if (!targetRef)
      throw new Error('Die Zielebene wurde nicht eindeutig gefunden. Bitte neu laden.');
  }
  if (indices.length) {
    const page = doc.getPage(pageIndex),
      contents = page.node.Contents();
    if (!contents) throw new Error('Der Seiteninhalt fehlt.');
    const streams =
      contents instanceof PDFArray
        ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i, PDFRawStream))
        : [contents as PDFRawStream];
    let text = '';
    for (const stream of streams) {
      const data = decodePDFRawStream(stream).decode();
      if (data.length + text.length > 64 * 1024 * 1024)
        throw new Error('Der Seiteninhalt ist zu groß.');
      for (let i = 0; i < data.length; i += 8192)
        text += String.fromCharCode(...data.subarray(i, i + 8192));
      text += '\n';
    }
    const pattern = new RegExp('/' + marker + '\\s+BMC\\b', 'g');
    if (!pattern.test(text))
      throw new Error('Die Objekte konnten nicht eindeutig zugeordnet werden.');
    let replacement = '/MoinUnlayered BMC';
    if (targetRef) {
      const resources = page.node.Resources()?.clone(doc.context) || doc.context.obj({}),
        properties =
          resources.lookupMaybe(N('Properties'), PDFDict)?.clone(doc.context) ||
          doc.context.obj({}),
        key = properties.uniqueKey('MoinLayer');
      properties.set(key, targetRef);
      resources.set(N('Properties'), properties);
      page.node.set(N('Resources'), resources);
      replacement = `/OC ${key.toString()} BDC`;
    }
    page.node.set(
      N('Contents'),
      doc.context.register(
        doc.context.flateStream(
          Uint8Array.from(text.replace(pattern, replacement), (c) => c.charCodeAt(0)),
        ),
      ),
    );
  }
  return doc.save();
}
