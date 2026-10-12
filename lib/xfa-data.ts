import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRawStream,
  PDFString,
  PDFHexString,
  decodePDFRawStream,
} from 'pdf-lib';
import { rejectSignedPdf } from './pdf-signature-guard';
export type XfaDataField = { id: string; label: string; value: string };
const xfaNamespace = 'http://www.xfa.org/schema/xfa-data/1.0/';
function parseXml(text: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('XFA mit XML-Entitäten wird nicht bearbeitet.');
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (!xml.documentElement || xml.getElementsByTagName('parsererror').length)
    throw new Error('Die XFA-XML ist nicht lesbar.');
  return xml;
}
function fields(xml: Document) {
  const roots = xml.getElementsByTagNameNS(xfaNamespace, 'data');
  if (roots.length !== 1) throw new Error('Ein einzelner XFA-Datenbereich ist erforderlich.');
  const result: { field: XfaDataField; element: Element }[] = [];
  function walk(parent: Element, path: string[], labels: string[], depth = 0) {
    if (depth > 64) throw new Error('Die XFA-Daten sind zu tief verschachtelt.');
    const counts = new Map<string, number>();
    for (const child of Array.from(parent.childNodes).filter(
      (n): n is Element => n.nodeType === 1,
    )) {
      const name = `{${child.namespaceURI || ''}}${child.localName || child.nodeName}`,
        number = (counts.get(name) || 0) + 1;
      counts.set(name, number);
      const next = [...path, `${name}[${number}]`],
        label = [...labels, `${child.localName || child.nodeName}[${number}]`];
      if (Array.from(child.childNodes).some((n) => n.nodeType === 1))
        walk(child, next, label, depth + 1);
      else {
        const value = child.textContent || '';
        if (value.length > 20000 || result.length >= 1000)
          throw new Error('XFA: höchstens 1.000 Felder mit jeweils 20.000 Zeichen.');
        result.push({
          field: { id: JSON.stringify(next), label: label.join(' / '), value },
          element: child,
        });
      }
    }
  }
  walk(roots[0], [], []);
  return result;
}
async function open(bytes: Uint8Array) {
  if (bytes.length > 80 * 1024 * 1024)
    throw new Error('XFA: Die PDF darf höchstens 80 MB groß sein.');
  const doc = await PDFDocument.load(bytes);
  rejectSignedPdf(doc);
  const form = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict),
    array = form?.lookup(PDFName.of('XFA'));
  if (!(array instanceof PDFArray) || array.size() % 2)
    throw new Error('Nur einfache XFA-Formulare mit getrennten XML-Paketen werden unterstützt.');
  const ordinary = form?.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (ordinary?.size()) throw new Error('Hybride XFA-/AcroForm-Formulare werden nicht verändert.');
  if (array.size() > 64) throw new Error('Zu viele XFA-Pakete.');
  const packets: { name: string; data: Uint8Array; index: number }[] = [];
  for (let i = 0; i < array.size(); i += 2) {
    const name = doc.context.lookup(array.get(i));
    const stream = doc.context.lookup(array.get(i + 1));
    if (
      !(name instanceof PDFString || name instanceof PDFHexString) ||
      !(stream instanceof PDFRawStream)
    )
      throw new Error('Ungültiges XFA-Paket.');
    const data = decodePDFRawStream(stream).decode();
    if (data.length > 8 * 1024 * 1024) throw new Error('Ein XFA-Paket ist größer als 8 MB.');
    const xml = parseXml(new TextDecoder('utf-8', { fatal: true }).decode(data));
    for (const el of Array.from(xml.getElementsByTagName('*'))) {
      if (
        [
          'script',
          'calculate',
          'validate',
          'event',
          'execute',
          'submit',
          'connectionSet',
          'connect',
          'signature',
          'picture',
        ].includes(el.localName || el.nodeName) ||
        el.hasAttribute('usehref')
      )
        throw new Error(
          'XFA mit Skripten, Berechnungen oder Regeln benötigt die ursprüngliche Formularanwendung.',
        );
    }
    packets.push({ name: name.decodeText(), data, index: i + 1 });
  }
  if (
    packets.filter((p) => p.name === 'datasets').length !== 1 ||
    packets.filter((p) => p.name === 'template').length !== 1
  )
    throw new Error('XFA-Vorlage und Datenpaket müssen eindeutig vorhanden sein.');
  const packet = packets.find((p) => p.name === 'datasets')!,
    xml = parseXml(new TextDecoder().decode(packet.data));
  return { doc, array, packets, packet, xml, items: fields(xml) };
}
export async function readXfaData(bytes: Uint8Array): Promise<XfaDataField[]> {
  return (await open(bytes)).items.map((x) => x.field);
}
export async function writeXfaData(
  bytes: Uint8Array,
  values: Record<string, string>,
): Promise<Uint8Array> {
  const data = await open(bytes);
  const ids = new Set(data.items.map((x) => x.field.id));
  for (const [id, value] of Object.entries(values))
    if (
      !ids.has(id) ||
      typeof value !== 'string' ||
      value.length > 20000 ||
      Array.from(value).some((ch) => {
        const cp = ch.codePointAt(0)!;
        return cp < 32 && ![9, 10, 13].includes(cp);
      })
    )
      throw new Error('Ungültiger XFA-Feldwert.');
  for (const item of data.items)
    if (Object.hasOwn(values, item.field.id)) item.element.textContent = values[item.field.id];
  const serialized = new TextEncoder().encode(new XMLSerializer().serializeToString(data.xml));
  if (serialized.length > 8 * 1024 * 1024) throw new Error('Das XFA-Datenpaket ist zu groß.');
  data.array.set(
    data.packet.index,
    data.doc.context.register(data.doc.context.flateStream(serialized)),
  );
  const result = await data.doc.save(),
    check = await open(result);
  for (const item of check.items) {
    const expected = Object.hasOwn(values, item.field.id)
      ? values[item.field.id]
      : data.items.find((x) => x.field.id === item.field.id)?.field.value;
    if (item.field.value !== expected)
      throw new Error('Die XFA-Werte konnten nicht unverändert zurückgelesen werden.');
  }
  if (check.items.length !== data.items.length || check.packets.length !== data.packets.length)
    throw new Error('Die XFA-Struktur wurde unerwartet verändert.');
  for (let i = 0; i < data.packets.length; i++) {
    const a = data.packets[i],
      b = check.packets[i];
    if (
      a.name !== b.name ||
      (a.name !== 'datasets' &&
        (a.data.length !== b.data.length || a.data.some((v, j) => v !== b.data[j])))
    )
      throw new Error('Ein XFA-Vorlagenpaket wurde unerwartet verändert.');
  }
  return result;
}
