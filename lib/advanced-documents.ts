import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFString,
  PDFHexString,
  PDFNumber,
  PDFRef,
  degrees,
  rgb,
  type PDFPage,
  type PDFObject,
  type PDFPageDrawImageOptions,
} from 'pdf-lib';
import JSZip from 'jszip';
import { filenameStem, pdfBlob, uid, type Source } from './pdf-engine';
import { readDocumentDraft, saveDocumentDraft, writeBookmarks } from './document-tools';
import {
  checkAbort,
  safeName,
  uniqueNames,
  type RunContext,
  type ExportFile,
} from './advanced-types';
import type { Rect } from './studio-engine';

export function drawOnViewport(
  page: PDFPage,
  viewport: { convertToPdfPoint: (x: number, y: number) => number[] },
  x: number,
  y: number,
  w: number,
  h: number,
  draw: (position: PDFPageDrawImageOptions) => void,
) {
  const a = viewport.convertToPdfPoint(x, y),
    b = viewport.convertToPdfPoint(x + w, y),
    c = viewport.convertToPdfPoint(x, y + h);
  draw({
    x: c[0],
    y: c[1],
    width: Math.hypot(b[0] - a[0], b[1] - a[1]),
    height: Math.hypot(c[0] - a[0], c[1] - a[1]),
    rotate: degrees((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI),
  });
}
const asText = (obj: PDFObject | undefined) =>
  obj instanceof PDFString || obj instanceof PDFHexString
    ? obj.decodeText()
    : obj instanceof PDFName
      ? obj.decodeText()
      : '';
export type LinkDraft = {
  id: string;
  page: number;
  rect: Rect;
  kind: 'url' | 'page' | 'unsupported';
  target: string;
  originalIndex?: number;
  deleted?: boolean;
};
export async function readLinks(source: Source, ctx: RunContext): Promise<LinkDraft[]> {
  const doc = await PDFDocument.load(source.bytes),
    links: LinkDraft[] = [];
  for (const [index, page] of doc.getPages().entries()) {
    checkAbort(ctx.signal);
    const annotations = page.node.Annots(),
      pdfPage = await source.pdf.getPage(index + 1),
      v = pdfPage.getViewport({ scale: 1 });
    if (!annotations) continue;
    for (let n = 0; n < annotations.size(); n++) {
      const a = annotations.lookup(n);
      if (!(a instanceof PDFDict) || a.get(PDFName.of('Subtype'))?.toString() !== '/Link') continue;
      const r = a.lookupMaybe(PDFName.of('Rect'), PDFArray);
      if (!r || r.size() !== 4) continue;
      const coords = r
          .asArray()
          .map((o) => doc.context.lookup(o))
          .map((o) => (o instanceof PDFNumber ? o.asNumber() : 0)),
        p = v.convertToViewportPoint(coords[0], coords[1]),
        q = v.convertToViewportPoint(coords[2], coords[3]);
      const rect = {
        x: Math.min(p[0], q[0]) / v.width,
        y: Math.min(p[1], q[1]) / v.height,
        w: Math.abs(q[0] - p[0]) / v.width,
        h: Math.abs(q[1] - p[1]) / v.height,
      };
      const action = a.lookupMaybe(PDFName.of('A'), PDFDict);
      let kind: LinkDraft['kind'] = 'unsupported',
        target = 'Spezialaktion';
      if (action?.get(PDFName.of('S'))?.toString() === '/URI') {
        kind = 'url';
        target = asText(action.lookup(PDFName.of('URI')));
      } else {
        const dest = doc.context.lookup(a.get(PDFName.of('Dest')) || action?.get(PDFName.of('D')));
        let pageIndex = -1;
        if (dest instanceof PDFArray) {
          const ref = dest.get(0);
          pageIndex = doc.getPages().findIndex((p) => p.ref.toString() === ref?.toString());
          if (ref instanceof PDFNumber) pageIndex = ref.asNumber();
        } else {
          const name = asText(dest);
          if (name)
            try {
              const named = await source.pdf.getDestination(name);
              if (named)
                pageIndex =
                  typeof named[0] === 'number' ? named[0] : await source.pdf.getPageIndex(named[0]);
            } catch {}
        }
        if (pageIndex >= 0) {
          kind = 'page';
          target = String(pageIndex + 1);
        }
      }
      links.push({ id: uid(), page: index, rect, kind, target, originalIndex: n });
    }
  }
  return links;
}
export function validateLinkTarget(
  kind: 'url' | 'page' | 'unsupported',
  target: string,
  count: number,
) {
  if (kind === 'unsupported') return;
  if (kind === 'page') {
    if (!/^\d+$/.test(target) || Number(target) < 1 || Number(target) > count)
      throw new Error(`Zielseite muss zwischen 1 und ${count} liegen.`);
  } else {
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      throw new Error('Bitte eine vollständige URL mit https:// oder mailto: eingeben.');
    }
    if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol))
      throw new Error('Erlaubte Verweise: https, http, mailto und tel.');
  }
}
export async function saveLinks(
  source: Source,
  links: LinkDraft[],
  ctx: RunContext,
): Promise<ExportFile> {
  const doc = await PDFDocument.load(source.bytes, { updateMetadata: false });
  for (const [i, page] of doc.getPages().entries()) {
    checkAbort(ctx.signal);
    const old = page.node.Annots(),
      keep: PDFObject[] = [];
    if (old)
      for (let j = 0; j < old.size(); j++) {
        const value = old.get(j),
          resolved = doc.context.lookup(value);
        if (
          !(resolved instanceof PDFDict) ||
          resolved.get(PDFName.of('Subtype'))?.toString() !== '/Link'
        )
          keep.push(value);
      }
    const pdfPage = await source.pdf.getPage(i + 1),
      v = pdfPage.getViewport({ scale: 1 });
    for (const link of links.filter((l) => l.page === i && !l.deleted)) {
      if (link.kind === 'unsupported') {
        if (link.originalIndex !== undefined && old) keep.push(old.get(link.originalIndex));
        continue;
      }
      validateLinkTarget(link.kind, link.target, doc.getPageCount());
      const r = link.rect;
      if (
        Object.values(r).some((n) => !Number.isFinite(n)) ||
        r.w <= 0 ||
        r.h <= 0 ||
        r.x < 0 ||
        r.y < 0 ||
        r.x + r.w > 1.001 ||
        r.y + r.h > 1.001
      )
        throw new Error('Der Linkbereich muss innerhalb der Seite liegen.');
      const a = v.convertToPdfPoint(r.x * v.width, r.y * v.height),
        b = v.convertToPdfPoint((r.x + r.w) * v.width, (r.y + r.h) * v.height);
      const annotation = doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [
          Math.min(a[0], b[0]),
          Math.min(a[1], b[1]),
          Math.max(a[0], b[0]),
          Math.max(a[1], b[1]),
        ],
        Border: [0, 0, 0],
        P: page.ref,
      });
      if (link.kind === 'url')
        annotation.set(
          PDFName.of('A'),
          doc.context.obj({ S: 'URI', URI: PDFString.of(link.target) }),
        );
      else
        annotation.set(
          PDFName.of('Dest'),
          doc.context.obj([doc.getPage(Number(link.target) - 1).ref, 'Fit']),
        );
      keep.push(doc.context.register(annotation));
    }
    page.node.set(PDFName.of('Annots'), doc.context.obj(keep));
  }
  return {
    blob: pdfBlob(await doc.save()),
    filename: filenameStem(source.name) + '-Links.pdf',
    kind: 'pdf',
    pages: doc.getPageCount(),
  };
}
export type AttachmentDraft = {
  id: string;
  name: string;
  size: number;
  bytes?: Uint8Array;
  originalKey?: string;
  deleted?: boolean;
};
function embeddedEntries(doc: PDFDocument) {
  const result: { key: string; ref: PDFObject }[] = [],
    seen = new Set<PDFObject>();
  function walk(value: PDFObject | undefined, depth = 0) {
    const dict = doc.context.lookup(value);
    if (!(dict instanceof PDFDict) || seen.has(dict)) return;
    if (depth > 30 || result.length > 1000) throw new Error('Die Anhangsstruktur ist zu groß.');
    seen.add(dict);
    const names = dict.lookupMaybe(PDFName.of('Names'), PDFArray);
    if (names)
      for (let i = 0; i + 1 < names.size(); i += 2)
        result.push({ key: asText(doc.context.lookup(names.get(i))), ref: names.get(i + 1) });
    const kids = dict.lookupMaybe(PDFName.of('Kids'), PDFArray);
    if (kids) kids.asArray().forEach((k) => walk(k, depth + 1));
  }
  walk(doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)?.get(PDFName.of('EmbeddedFiles')));
  return result;
}
export async function readAttachments(source: Source): Promise<AttachmentDraft[]> {
  const doc = await PDFDocument.load(source.bytes),
    entries = embeddedEntries(doc),
    attachments = await source.pdf.getAttachments();
  const result: AttachmentDraft[] = [];
  let total = 0;
  for (const [i, e] of entries.entries()) {
    const dict = doc.context.lookup(e.ref, PDFDict),
      name = asText(dict.get(PDFName.of('UF'))) || asText(dict.get(PDFName.of('F'))) || e.key,
      pair = Array.from(attachments || []).find(([key, a]) => key === e.key || a.filename === name);
    const bytes = pair
      ? (pair[1].content ?? (await source.pdf.getAttachmentContent(pair[0])))
      : undefined;
    total += bytes?.length || 0;
    if (total > 80 * 1024 * 1024) throw new Error('Anhänge zusammen: höchstens 80 MB.');
    result.push({
      id: `attached-${i}`,
      name,
      size: bytes?.length || 0,
      bytes: bytes ? new Uint8Array(bytes) : undefined,
      originalKey: e.key,
    });
  }
  return result;
}
export async function saveAttachments(
  source: Source,
  items: AttachmentDraft[],
  ctx: RunContext,
): Promise<ExportFile> {
  const active = items.filter((a) => !a.deleted);
  if (new Set(active.map((a) => safeName(a.name).toLocaleLowerCase())).size !== active.length)
    throw new Error('Bitte für jeden Anhang einen eindeutigen Namen verwenden.');
  if (active.reduce((n, a) => n + a.size, 0) > 80 * 1024 * 1024)
    throw new Error('Anhänge zusammen: höchstens 80 MB.');
  const doc = await PDFDocument.load(source.bytes, { updateMetadata: false }),
    entries = embeddedEntries(doc),
    removeRefs = new Set<string>(),
    names: PDFObject[] = [];
  for (const e of entries) {
    const item = items.find((a) => a.originalKey === e.key);
    if (item && !item.deleted && !item.bytes) {
      names.push(PDFHexString.fromText(item.name), e.ref);
    } else if (
      item &&
      !item.deleted &&
      item.name ===
        (asText(doc.context.lookup(e.ref, PDFDict).get(PDFName.of('UF'))) ||
          asText(doc.context.lookup(e.ref, PDFDict).get(PDFName.of('F'))) ||
          e.key) &&
      item.id.startsWith('attached-')
    ) {
      names.push(PDFHexString.fromText(item.name), e.ref);
    } else removeRefs.add(e.ref.toString());
  }
  const root = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict) || doc.context.obj({});
  root.set(PDFName.of('EmbeddedFiles'), doc.context.obj({ Names: names }));
  doc.catalog.set(PDFName.of('Names'), root);
  // Remove Associated Files references too. QPDF then discards orphaned file streams.
  for (const [, object] of doc.context.enumerateIndirectObjects())
    if (object instanceof PDFDict) {
      const af = object.lookupMaybe(PDFName.of('AF'), PDFArray);
      if (af)
        object.set(
          PDFName.of('AF'),
          doc.context.obj(af.asArray().filter((ref) => !removeRefs.has(ref.toString()))),
        );
    }
  for (const page of doc.getPages()) {
    const annotations = page.node.Annots();
    if (annotations)
      page.node.set(
        PDFName.of('Annots'),
        doc.context.obj(
          annotations.asArray().filter((ref) => {
            const dict = doc.context.lookup(ref);
            return !(
              dict instanceof PDFDict &&
              dict.get(PDFName.of('Subtype'))?.toString() === '/FileAttachment' &&
              removeRefs.has(dict.get(PDFName.of('FS'))?.toString() || '')
            );
          }),
        ),
      );
  }
  for (const item of active) {
    checkAbort(ctx.signal);
    const original = entries.find((e) => e.key === item.originalKey);
    if (original && !removeRefs.has(original.ref.toString())) continue;
    if (!item.bytes) throw new Error(`Der Anhang „${item.name}“ konnte nicht gelesen werden.`);
    await doc.attach(item.bytes, safeName(item.name));
  }
  await doc.flush();
  const finalEntries = embeddedEntries(doc).sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );
  root.set(
    PDFName.of('EmbeddedFiles'),
    doc.context.obj({ Names: finalEntries.flatMap((e) => [PDFHexString.fromText(e.key), e.ref]) }),
  );
  const { rewritePdf } = await import('./pdf-security'),
    bytes = await rewritePdf(await doc.save(), ctx.signal);
  return {
    blob: pdfBlob(bytes),
    filename: filenameStem(source.name) + '-Anhaenge.pdf',
    kind: 'pdf',
    pages: doc.getPageCount(),
  };
}
export type TocItem = { title: string; page: number };
export async function coverToc(
  source: Source,
  title: string,
  subtitle: string,
  entries: TocItem[],
  includeCover: boolean,
  ctx: RunContext,
  fontBytes?: Uint8Array,
): Promise<ExportFile> {
  if (!title.trim()) throw new Error('Bitte einen Titel eingeben.');
  if (!entries.length) throw new Error('Bitte mindestens einen Inhaltsverzeichniseintrag anlegen.');
  if (entries.length > 200) throw new Error('Maximal 200 Verzeichniseinträge.');
  for (const e of entries)
    if (!e.title.trim() || !Number.isInteger(e.page) || e.page < 1 || e.page > source.pdf.numPages)
      throw new Error('Jeder Eintrag braucht einen Titel und eine gültige Originalseite.');
  const doc = await PDFDocument.load(source.bytes, { updateMetadata: false }),
    fontkit = (await import('@pdf-lib/fontkit')).default;
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    fontBytes ||
      (await fetch('/vendor/invoice-font/NotoSans-Regular.ttf').then((r) => {
        if (!r.ok) throw new Error('Schrift konnte nicht geladen werden.');
        return r.arrayBuffer();
      })),
    { subset: true },
  );
  const perPage = 29,
    tocCount = Math.ceil(entries.length / perPage),
    offset = tocCount + (includeCover ? 1 : 0),
    oldDraft = await readDocumentDraft(source, ctx.signal);
  for (let i = 0; i < offset; i++) doc.insertPage(i, [595.28, 841.89]);
  const fit = (s: string, size: number, width: number) => {
    let t = s;
    while (t.length && font.widthOfTextAtSize(t, size) > width) t = t.slice(0, -1);
    return t === s ? s : t.slice(0, -1) + '…';
  };
  if (includeCover) {
    const page = doc.getPage(0);
    page.drawRectangle({ x: 50, y: 660, width: 48, height: 5, color: rgb(0.02, 0.59, 0.58) });
    page.drawText(fit(title, 30, 495), {
      x: 50,
      y: 590,
      size: 30,
      font,
      color: rgb(0.06, 0.22, 0.23),
    });
    subtitle
      .split(/\n/)
      .slice(0, 8)
      .forEach((line, i) =>
        page.drawText(fit(line, 13, 495), { x: 50, y: 535 - i * 22, size: 13, font }),
      );
  }
  for (let n = 0; n < tocCount; n++) {
    checkAbort(ctx.signal);
    const page = doc.getPage((includeCover ? 1 : 0) + n);
    page.drawText('Inhaltsverzeichnis', {
      x: 50,
      y: 770,
      size: 25,
      font,
      color: rgb(0.02, 0.45, 0.44),
    });
    const annotations: PDFRef[] = [];
    for (const [j, entry] of entries.slice(n * perPage, (n + 1) * perPage).entries()) {
      const y = 720 - j * 22,
        target = entry.page - 1 + offset;
      page.drawText(fit(entry.title, 11, 435), { x: 50, y, size: 11, font });
      page.drawText(String(target + 1), { x: 515, y, size: 11, font });
      annotations.push(
        doc.context.register(
          doc.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [48, y - 4, 546, y + 16],
            Border: [0, 0, 0],
            Dest: [doc.getPage(target).ref, 'Fit'],
          }),
        ),
      );
    }
    page.node.set(PDFName.of('Annots'), doc.context.obj(annotations));
  }
  writeBookmarks(doc, [
    ...entries.map((e) => ({
      id: uid(),
      title: e.title,
      page: e.page - 1 + offset,
      depth: 0,
      open: true,
      targetChanged: true,
    })),
    ...oldDraft.bookmarks.map((b) => ({ ...b, page: b.page === null ? null : b.page + offset })),
  ]);
  return {
    blob: pdfBlob(await doc.save()),
    filename: filenameStem(source.name) + '-Inhaltsverzeichnis.pdf',
    kind: 'pdf',
    pages: doc.getPageCount(),
    note: `${offset} neue Seiten. Verzeichniseinträge verweisen auf die endgültigen Seitenzahlen.`,
  };
}
export async function mergeFormData(
  source: Source,
  rows: string[][],
  mapping: Record<string, number>,
  nameColumn: number,
  flatten: boolean,
  ctx: RunContext,
): Promise<ExportFile> {
  if (rows.length < 2 || rows.length > 501)
    throw new Error('Bitte eine Tabelle mit Kopfzeile und 1 bis 500 Datensätzen verwenden.');
  if (!Object.keys(mapping).length)
    throw new Error('Bitte mindestens ein Formularfeld einer Spalte zuordnen.');
  const draft = await readDocumentDraft(source, ctx.signal),
    zip = new JSZip(),
    names = uniqueNames(
      rows
        .slice(1)
        .map(
          (r, i) =>
            safeName(
              nameColumn >= 0 ? r[nameColumn] || `Datensatz-${i + 1}` : `Datensatz-${i + 1}`,
            ) + '.pdf',
        ),
    );
  for (const [i, row] of rows.slice(1).entries()) {
    checkAbort(ctx.signal);
    const next = structuredClone(draft);
    for (const field of next.fields) {
      const col = mapping[field.name];
      if (col === undefined || col < 0 || field.readOnly || field.kind === 'unsupported') continue;
      const value = row[col] || '';
      if (field.kind === 'checkbox') {
        if (!/^(|0|1|true|false|ja|nein|yes|no|x)$/i.test(value.trim()))
          throw new Error(`Zeile ${i + 2}, ${field.name}: Checkbox erwartet ja/nein, 1/0 oder x.`);
        field.value = /^(1|true|ja|yes|x)$/i.test(value.trim());
      } else if (field.kind === 'dropdown' || field.kind === 'list') {
        const selected = field.multiple
          ? value
              .split('|')
              .map((v) => v.trim())
              .filter(Boolean)
          : value
            ? [value]
            : [];
        if (selected.some((v) => !field.options.includes(v)))
          throw new Error(`Zeile ${i + 2}, ${field.name}: Unbekannte Auswahl „${value}“.`);
        field.value = selected;
      } else {
        if (field.kind === 'radio' && value && !field.options.includes(value))
          throw new Error(`Zeile ${i + 2}, ${field.name}: Unbekannte Option „${value}“.`);
        field.value = value;
      }
    }
    const result = await saveDocumentDraft(source, next, 'fill-form', flatten, ctx.signal);
    zip.file(names[i], await result.blob.arrayBuffer());
    ctx.report({
      percent: ((i + 1) / (rows.length - 1)) * 100,
      label: `Formular ${i + 1} von ${rows.length - 1}`,
    });
  }
  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    filename: 'Serienformulare.zip',
    kind: 'zip',
    pages: source.pdf.numPages * (rows.length - 1),
  };
}
