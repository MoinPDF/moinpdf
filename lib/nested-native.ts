import {
  PDFDocument,
  PDFRawStream,
  PDFName,
  PDFArray,
  PDFDict,
  PDFObjectCopier,
  decodePDFRawStream,
  PDFNumber,
  type PDFObject,
} from 'pdf-lib';
import type { WrappedPdfiumModule } from '@embedpdf/pdfium';
import {
  editNativeObjects,
  extractNativeForm,
  markNativeObject,
  scopedNativeChanges,
  type NativeChange,
} from './native-pdf-core';

const name = PDFName.of;
const decode = (stream: PDFRawStream) => {
  const data = decodePDFRawStream(stream).decode();
  if (data.length > 64 * 1024 * 1024) throw new Error('Der Gruppeninhalt ist zu groß.');
  let text = '';
  for (let i = 0; i < data.length; i += 8192)
    text += String.fromCharCode(...data.subarray(i, i + 8192));
  return text;
};
const encode = (text: string) => Uint8Array.from(text, (ch) => ch.charCodeAt(0));
function content(doc: PDFDocument, pageIndex: number) {
  const contents = doc.getPage(pageIndex).node.Contents();
  if (!contents) return '';
  const streams =
    contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i, PDFRawStream))
      : [contents as PDFRawStream];
  const text = streams.map(decode).join('\n');
  if (text.length > 64 * 1024 * 1024) throw new Error('Der Gruppeninhalt ist zu groß.');
  return text;
}
/** Generated PDFium marks contain a single XObject invocation, never arbitrary source tokens. */
async function locate(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  pageIndex: number,
  objectIndex: number,
) {
  const marker = 'MoinEdit' + crypto.randomUUID().replaceAll('-', '');
  const marked = markNativeObject(api, bytes, pageIndex, objectIndex, marker);
  const doc = await PDFDocument.load(marked),
    page = doc.getPage(pageIndex),
    text = content(doc, pageIndex);
  const pattern = new RegExp('/' + marker + '\\s+BMC([\\s\\S]*?)\\bEMC');
  const match = pattern.exec(text);
  const invocations = match ? [...match[1].matchAll(/\/([^\s<>[\](){}/%]+)\s+Do\b/g)] : [];
  if (
    !match ||
    invocations.length !== 1 ||
    text.indexOf('/' + marker, match.index + match[0].length) !== -1
  )
    throw new Error('Die ausgewählte Gruppeninstanz konnte nicht eindeutig zugeordnet werden.');
  const resources = page.node.Resources();
  if (!resources) throw new Error('Die Objektressourcen fehlen.');
  const xobjects = resources.lookup(name('XObject'), PDFDict);
  const objectName = PDFName.of(invocations[0][1]);
  const original = xobjects.lookup(objectName);
  if (!(original instanceof PDFRawStream)) throw new Error('Der Objektinhalt ist nicht lesbar.');
  const replace = (object: PDFRawStream) => {
    const nextResources = resources.clone(doc.context),
      nextObjects = xobjects.clone(doc.context);
    const key = nextObjects.uniqueKey('MoinObject');
    nextObjects.set(key, doc.context.register(object));
    nextResources.set(name('XObject'), nextObjects);
    page.node.set(name('Resources'), nextResources);
    const inner = match[1].replace(invocations[0][0], key.toString() + ' Do');
    const updated = text.slice(0, match.index) + inner + text.slice(match.index + match[0].length);
    page.node.set(name('Contents'), doc.context.register(doc.context.flateStream(encode(updated))));
  };
  return { doc, original, resources, replace };
}
function inverseMatrix(form: PDFRawStream) {
  const matrix = form.dict.lookupMaybe(name('Matrix'), PDFArray);
  if (!matrix) return '';
  if (matrix.size() !== 6) throw new Error('Ungültige Gruppentransformation.');
  const [a, b, c, d, e, f] = Array.from({ length: 6 }, (_, i) =>
    matrix.lookup(i, PDFNumber).asNumber(),
  );
  const determinant = a * d - b * c;
  if (![a, b, c, d, e, f, determinant].every(Number.isFinite) || Math.abs(determinant) < 1e-12)
    throw new Error('Die Gruppe hat keine umkehrbare Transformation.');
  return (
    [
      d / determinant,
      -b / determinant,
      -c / determinant,
      a / determinant,
      (c * f - d * e) / determinant,
      (b * e - a * f) / determinant,
    ]
      .map((n) => PDFNumber.of(n).toString())
      .join(' ') + ' cm\n'
  );
}
function inheritedResources(parent: PDFDict, own: PDFDict | undefined, doc: PDFDocument) {
  const result = parent.clone(doc.context);
  if (!own) return result;
  for (const [category, value] of own.entries()) {
    const local = doc.context.lookup(value);
    const inheritedValue = result.get(category);
    const inherited = inheritedValue ? doc.context.lookup(inheritedValue) : undefined;
    if (!(local instanceof PDFDict) || !(inherited instanceof PDFDict)) {
      result.set(category, value);
      continue;
    }
    const merged = inherited.clone(doc.context);
    for (const [key, entry] of local.entries()) {
      const previous = merged.get(key);
      if (category === name('ExtGState') && previous && !equivalentResource(doc, previous, entry))
        throw new Error(
          'Die Gruppe verwendet mehrdeutige geerbte Grafikzustände. Der Originalinhalt bleibt erhalten.',
        );
      merged.set(key, entry);
    }
    result.set(category, merged);
  }
  return result;
}
/** PDFium may duplicate an identical state under a new reference on every save. */
function equivalentResource(
  doc: PDFDocument,
  a: PDFObject,
  b: PDFObject,
  seen = new Map<PDFObject, Set<PDFObject>>(),
  depth = 0,
): boolean {
  if (a === b || a.toString() === b.toString()) return true;
  if (depth > 32) return false;
  const resolvedA = doc.context.lookup(a),
    resolvedB = doc.context.lookup(b);
  if (!resolvedA || !resolvedB) return false;
  a = resolvedA;
  b = resolvedB;
  if (a === b) return true;
  const pairs = seen.get(a) || new Set<PDFObject>();
  if (pairs.has(b)) return true;
  pairs.add(b);
  seen.set(a, pairs);
  if (a instanceof PDFDict && b instanceof PDFDict)
    return (
      a.keys().length === b.keys().length &&
      a.entries().every(([key, value]) => {
        const other = b.get(key);
        return !!other && equivalentResource(doc, value, other, seen, depth + 1);
      })
    );
  if (a instanceof PDFArray && b instanceof PDFArray)
    return (
      a.size() === b.size() &&
      Array.from({ length: a.size() }, (_, i) => i).every((i) =>
        equivalentResource(doc, a.get(i), b.get(i), seen, depth + 1),
      )
    );
  return (
    a.constructor === b.constructor && !(a instanceof PDFRawStream) && a.toString() === b.toString()
  );
}
async function isolateImages(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  page: number,
  changes: NativeChange[],
) {
  let result = bytes;
  for (const change of changes.filter((c) => c.image)) {
    const target = await locate(api, result, page, change.index);
    if (target.original.dict.lookup(name('Subtype'), PDFName) !== name('Image'))
      throw new Error('Die Auswahl ist kein Bild.');
    target.replace(
      PDFRawStream.of(
        target.original.dict.clone(target.doc.context),
        target.original.getContents().slice(),
      ),
    );
    result = await target.doc.save();
  }
  return result;
}
async function editContainer(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  page: number,
  path: number[],
  changes: NativeChange[],
): Promise<Uint8Array> {
  if (!path.length)
    return editNativeObjects(api, await isolateImages(api, bytes, page, changes), page, changes);
  const target = await locate(api, bytes, page, path[0]);
  if (target.original.dict.lookup(name('Subtype'), PDFName) !== name('Form'))
    throw new Error('Die Auswahl ist keine Objektgruppe.');
  const undoMatrix = inverseMatrix(target.original);
  const tempIndex = target.doc.getPageCount();
  const seed = target.doc.addPage([1000, 1000]);
  // Seed names before PDFium regeneration: inherited ExtGState/Pattern/ColorSpace must survive.
  seed.node.set(
    name('Resources'),
    inheritedResources(
      target.resources,
      target.original.dict.lookupMaybe(name('Resources'), PDFDict),
      target.doc,
    ),
  );
  const group = target.original.dict.get(name('Group'));
  if (group) seed.node.set(name('Group'), group);
  const seedBytes = await target.doc.save();
  target.doc.removePage(tempIndex);
  const extracted = extractNativeForm(api, seedBytes, page, path[0], tempIndex);
  const extractedDoc = await PDFDocument.load(extracted.bytes),
    temp = await PDFDocument.create();
  temp.addPage((await temp.copyPages(extractedDoc, [extracted.page]))[0]);
  const edited = await editContainer(api, await temp.save(), 0, path.slice(1), changes);
  const editedDoc = await PDFDocument.load(edited),
    editedPage = editedDoc.getPage(0);
  const copier = PDFObjectCopier.for(editedDoc.context, target.doc.context);
  const dictionary = target.original.dict.clone(target.doc.context);
  for (const key of ['Length', 'Filter', 'DecodeParms']) dictionary.delete(name(key));
  dictionary.set(name('Resources'), copier.copy(editedPage.node.Resources()!));
  // Child matrices already include the Form's Matrix; undo once while retaining its exact BBox/Group.
  const data = encode('q\n' + undoMatrix + content(editedDoc, 0) + '\nQ\n');
  target.replace(PDFRawStream.of(dictionary, data));
  return target.doc.save();
}
export async function editNativeDocument(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  page: number,
  changes: NativeChange[],
  path: number[] = [],
) {
  if (!changes.length || changes.length > 10000 || path.length > 16)
    throw new Error('Ungültige Objektauswahl.');
  const prepared = path.length ? scopedNativeChanges(api, bytes, page, path, changes) : changes;
  return editContainer(api, bytes, page, path, prepared);
}
