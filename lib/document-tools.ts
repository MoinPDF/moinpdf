import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
  PDFSignature,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFString,
  PDFHexString,
  PDFNumber,
  StandardFonts,
  degrees,
  rgb,
  type PDFObject,
} from 'pdf-lib';
import {
  uid,
  filenameStem,
  pdfBlob,
  hasXfaForm,
  requireAcroForm,
  type Source,
  type JobResult,
} from './pdf-engine';

export const documentToolIds = ['fill-form', 'create-form', 'bookmarks'] as const;
export type DocumentTool = (typeof documentToolIds)[number];
export const isDocumentTool = (id: string): id is DocumentTool =>
  (documentToolIds as readonly string[]).includes(id);
export type FieldKind = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'list' | 'unsupported';
export type FieldRect = { x: number; y: number; w: number; h: number };
export type FieldWidget = { page: number; rect: FieldRect; option?: string };
export type FormField = {
  id: string;
  name: string;
  kind: FieldKind;
  value: string | boolean | string[];
  initialValue?: string | boolean | string[];
  options: string[];
  widgets: FieldWidget[];
  existing: boolean;
  required: boolean;
  readOnly: boolean;
  multiline: boolean;
  maxLength?: number;
  multiple?: boolean;
  deleted?: boolean;
  fontSize: number;
};
export type Bookmark = {
  id: string;
  title: string;
  page: number | null;
  depth: number;
  open: boolean;
  originalId?: string;
  targetChanged?: boolean;
};
export type DocumentDraft = {
  fields: FormField[];
  bookmarks: Bookmark[];
  signed: boolean;
  xfa: boolean;
  originalBookmarkCount: number;
  originalBookmarks: string;
};
export type DocumentHistory = {
  current: DocumentDraft;
  past: DocumentDraft[];
  future: DocumentDraft[];
};
export type DocumentSessions = Record<string, DocumentHistory>;
export const fieldLabels: Record<FieldKind, string> = {
  text: 'Textfeld',
  checkbox: 'Checkbox',
  dropdown: 'Auswahlliste',
  radio: 'Optionsgruppe',
  list: 'Listenfeld',
  unsupported: 'Spezialfeld',
};
const check = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
};
const readString = (obj?: PDFObject) =>
  obj instanceof PDFString || obj instanceof PDFHexString
    ? obj.decodeText()
    : obj instanceof PDFName
      ? obj.decodeText()
      : '';

function originalOutlines(doc: PDFDocument) {
  const result: { id: string; dict: PDFDict; depth: number }[] = [],
    seen = new Set<PDFObject>();
  const root = doc.catalog.lookupMaybe(PDFName.of('Outlines'), PDFDict);
  function walk(first: PDFObject | undefined, depth: number) {
    let next = first;
    while (next) {
      if (seen.has(next) || result.length >= 1000 || depth > 30)
        throw new Error('Die Lesezeichenstruktur ist zu groß oder beschädigt.');
      seen.add(next);
      const dict = doc.context.lookup(next);
      if (!(dict instanceof PDFDict)) break;
      result.push({ id: next.toString(), dict, depth });
      walk(dict.get(PDFName.of('First')), depth + 1);
      next = dict.get(PDFName.of('Next'));
    }
  }
  walk(root?.get(PDFName.of('First')), 0);
  return result;
}
async function bookmarkPage(
  source: Source,
  doc: PDFDocument,
  dict: PDFDict,
): Promise<number | null> {
  let dest = dict.get(PDFName.of('Dest'));
  const action = dict.lookupMaybe(PDFName.of('A'), PDFDict);
  if (!dest && action?.get(PDFName.of('S'))?.toString() === '/GoTo')
    dest = action.get(PDFName.of('D'));
  if (!dest) return null;
  const resolved = doc.context.lookup(dest);
  if (resolved instanceof PDFArray) {
    const ref = resolved.get(0);
    const index = doc.getPages().findIndex((p) => p.ref.toString() === ref?.toString());
    if (index >= 0) return index;
    if (ref instanceof PDFNumber && ref.asNumber() >= 0 && ref.asNumber() < doc.getPageCount())
      return ref.asNumber();
  }
  const name = readString(resolved);
  if (name)
    try {
      const named = await source.pdf.getDestination(name);
      if (named)
        return typeof named[0] === 'number' ? named[0] : await source.pdf.getPageIndex(named[0]);
    } catch {
      /* Keep unresolved destinations unchanged when saving. */
    }
  return null;
}
export async function readDocumentDraft(
  source: Source,
  signal?: AbortSignal,
): Promise<DocumentDraft> {
  check(signal);
  const doc = await PDFDocument.load(source.bytes, { updateMetadata: false });
  const fields: FormField[] = [],
    xfa = hasXfaForm(doc);
  let signed = false;
  for (const field of xfa ? [] : doc.getForm().getFields()) {
    if (fields.length >= 1000)
      throw new Error('Bitte eine PDF mit höchstens 1.000 Formularfeldern öffnen.');
    let kind: FieldKind = 'unsupported',
      value: FormField['value'] = '',
      options: string[] = [],
      multiline = false,
      maxLength: number | undefined,
      multiple = false;
    if (field instanceof PDFTextField) {
      kind = 'text';
      value = field.getText() || '';
      multiline = field.isMultiline();
      maxLength = field.getMaxLength();
    } else if (field instanceof PDFCheckBox) {
      kind = 'checkbox';
      value = field.isChecked();
    } else if (field instanceof PDFDropdown) {
      kind = 'dropdown';
      options = field.getOptions();
      value = field.getSelected();
      multiple = field.isMultiselect();
    } else if (field instanceof PDFRadioGroup) {
      kind = 'radio';
      options = field.getOptions();
      value = field.getSelected() || '';
    } else if (field instanceof PDFOptionList) {
      kind = 'list';
      options = field.getOptions();
      value = field.getSelected();
      multiple = field.isMultiselect();
    } else if (field instanceof PDFSignature && field.acroField.dict.get(PDFName.of('V')))
      signed = true;
    fields.push({
      id: uid(),
      name: field.getName(),
      kind,
      value,
      initialValue: structuredClone(value),
      options,
      widgets: [],
      existing: true,
      required: field.isRequired(),
      readOnly: field.isReadOnly(),
      multiline,
      maxLength,
      multiple,
      fontSize: 12,
    });
  }
  for (let i = 0; i < source.pdf.numPages; i++) {
    check(signal);
    const page = await source.pdf.getPage(i + 1),
      viewport = page.getViewport({ scale: 1 });
    for (const annotation of await page.getAnnotations({ intent: 'display' })) {
      if (annotation.subtype !== 'Widget' || !Array.isArray(annotation.rect)) continue;
      const field = fields.find((f) => f.name === annotation.fieldName);
      if (!field) continue;
      const a = viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1]),
        b = viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3]),
        r = [...a, ...b];
      field.widgets.push({
        page: i,
        rect: {
          x: Math.min(r[0], r[2]) / viewport.width,
          y: Math.min(r[1], r[3]) / viewport.height,
          w: Math.abs(r[2] - r[0]) / viewport.width,
          h: Math.abs(r[3] - r[1]) / viewport.height,
        },
        option: annotation.buttonValue || annotation.exportValue,
      });
    }
  }
  const bookmarks: Bookmark[] = [];
  for (const item of originalOutlines(doc)) {
    check(signal);
    const count = item.dict.lookupMaybe(PDFName.of('Count'), PDFNumber)?.asNumber() || 0;
    bookmarks.push({
      id: uid(),
      originalId: item.id,
      title: readString(item.dict.get(PDFName.of('Title'))) || 'Ohne Titel',
      page: await bookmarkPage(source, doc, item.dict),
      depth: item.depth,
      open: count >= 0,
    });
  }
  check(signal);
  return {
    fields,
    bookmarks,
    signed,
    xfa,
    originalBookmarkCount: bookmarks.length,
    originalBookmarks: JSON.stringify(bookmarks),
  };
}
export function newFormField(
  fields: FormField[],
  kind: 'text' | 'checkbox' | 'dropdown',
  page: number,
  rect: FieldRect,
  multiline = false,
): FormField {
  let index = 1;
  const stem = kind === 'text' ? 'Textfeld' : kind === 'checkbox' ? 'Checkbox' : 'Auswahl';
  while (fields.some((f) => f.name === `${stem}_${index}`)) index++;
  return {
    id: uid(),
    name: `${stem}_${index}`,
    kind,
    value: kind === 'checkbox' ? false : '',
    options: kind === 'dropdown' ? ['Option 1', 'Option 2'] : [],
    widgets: [{ page, rect }],
    existing: false,
    required: false,
    readOnly: false,
    multiline,
    fontSize: 12,
  };
}
export function bookmarkSubtreeEnd(items: Bookmark[], index: number) {
  let end = index + 1;
  while (end < items.length && items[end].depth > items[index].depth) end++;
  return end;
}
export function moveBookmark(items: Bookmark[], from: number, to: number): Bookmark[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const end = bookmarkSubtreeEnd(items, from);
  if (to > from && to < end) return items;
  const block = items.slice(from, end),
    delta = items[to].depth - block[0].depth,
    remaining = items.filter((_, i) => i < from || i >= end),
    at = remaining.findIndex((b) => b.id === items[to].id);
  remaining.splice(at, 0, ...block.map((b) => ({ ...b, depth: b.depth + delta })));
  return remaining;
}
export function indentBookmark(items: Bookmark[], index: number, delta: number): Bookmark[] {
  if (index < 0 || index >= items.length) return items;
  const end = bookmarkSubtreeEnd(items, index),
    depth = items[index].depth + delta;
  if (depth < 0 || depth > 8 || index === 0 || depth > items[index - 1].depth + 1) return items;
  if (delta < 0) {
    let parent = index - 1;
    while (parent >= 0 && items[parent].depth >= items[index].depth) parent--;
    if (parent < 0) return items;
    const block = items.slice(index, end).map((b) => ({ ...b, depth: b.depth - 1 })),
      remaining = items.filter((_, i) => i < index || i >= end);
    remaining.splice(bookmarkSubtreeEnd(remaining, parent), 0, ...block);
    return remaining;
  }
  return items.map((b, i) => (i >= index && i < end ? { ...b, depth: b.depth + delta } : b));
}
export function bookmarkSibling(items: Bookmark[], index: number, direction: number) {
  if (index < 0) return -1;
  if (direction > 0) {
    const next = bookmarkSubtreeEnd(items, index);
    return next < items.length && items[next].depth === items[index].depth ? next : -1;
  }
  let prev = index - 1;
  while (prev >= 0 && items[prev].depth > items[index].depth) prev--;
  return prev >= 0 && items[prev].depth === items[index].depth ? prev : -1;
}
export function writeBookmarks(doc: PDFDocument, items: Bookmark[]) {
  if (items.length > 1000) throw new Error('Maximal 1.000 Lesezeichen.');
  const originals = new Map(originalOutlines(doc).map((b) => [b.id, b.dict]));
  if (!items.length) {
    doc.catalog.delete(PDFName.of('Outlines'));
    if (doc.catalog.get(PDFName.of('PageMode'))?.toString() === '/UseOutlines')
      doc.catalog.delete(PDFName.of('PageMode'));
    return;
  }
  const root = doc.context.obj({ Type: 'Outlines' }),
    rootRef = doc.context.register(root);
  const nodes = items.map((item) => ({
      item,
      dict: doc.context.obj({ Title: PDFHexString.fromText(item.title.trim()) }),
      ref: undefined as PDFRef | undefined,
      children: [] as number[],
      parent: -1,
    })),
    stack: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const { item, dict } = nodes[i];
    if (!item.title.trim() || item.title.length > 300)
      throw new Error('Jedes Lesezeichen braucht einen Titel mit höchstens 300 Zeichen.');
    if (
      !Number.isInteger(item.depth) ||
      item.depth < 0 ||
      item.depth > 30 ||
      item.depth > (i ? items[i - 1].depth + 1 : 0)
    )
      throw new Error('Bitte die Einrückung der Lesezeichen prüfen.');
    const original = item.originalId ? originals.get(item.originalId) : undefined;
    if (original && !item.targetChanged) {
      for (const key of ['Dest', 'A', 'C', 'F']) {
        const value = original.get(PDFName.of(key));
        if (value) dict.set(PDFName.of(key), value);
      }
    } else {
      if (
        item.page === null ||
        !Number.isInteger(item.page) ||
        item.page < 0 ||
        item.page >= doc.getPageCount()
      )
        throw new Error('Bitte eine gültige Zielseite für jedes Lesezeichen wählen.');
      dict.set(PDFName.of('Dest'), doc.context.obj([doc.getPage(item.page).ref, 'Fit']));
    }
    nodes[i].ref = doc.context.register(dict);
    stack.length = item.depth;
    if (item.depth) {
      nodes[i].parent = stack[item.depth - 1];
      nodes[nodes[i].parent].children.push(i);
    }
    stack[item.depth] = i;
  }
  function linkChildren(parent: PDFDict, parentRef: PDFRef, children: number[]): number {
    if (!children.length) return 0;
    let visible = 0;
    parent.set(PDFName.of('First'), nodes[children[0]].ref!);
    parent.set(PDFName.of('Last'), nodes[children.at(-1)!].ref!);
    children.forEach((index, j) => {
      const node = nodes[index];
      node.dict.set(PDFName.of('Parent'), parentRef);
      if (j) node.dict.set(PDFName.of('Prev'), nodes[children[j - 1]].ref!);
      if (j + 1 < children.length) node.dict.set(PDFName.of('Next'), nodes[children[j + 1]].ref!);
      const count = linkChildren(node.dict, node.ref!, node.children);
      if (count) node.dict.set(PDFName.of('Count'), PDFNumber.of(node.item.open ? count : -count));
      visible += 1 + (node.item.open ? count : 0);
    });
    return visible;
  }
  root.set(
    PDFName.of('Count'),
    PDFNumber.of(
      linkChildren(
        root,
        rootRef,
        nodes.flatMap((n, i) => (n.parent === -1 ? [i] : [])),
      ),
    ),
  );
  doc.catalog.set(PDFName.of('Outlines'), rootRef);
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}
export async function saveDocumentDraft(
  source: Source,
  draft: DocumentDraft,
  tool: DocumentTool,
  flatten = false,
  signal?: AbortSignal,
): Promise<JobResult> {
  check(signal);
  const doc = await PDFDocument.load(source.bytes, { updateMetadata: false });
  if (tool === 'bookmarks' || JSON.stringify(draft.bookmarks) !== draft.originalBookmarks)
    writeBookmarks(doc, draft.bookmarks);
  if (
    tool !== 'bookmarks' ||
    draft.fields.some(
      (f) => f.deleted || !f.existing || JSON.stringify(f.value) !== JSON.stringify(f.initialValue),
    )
  ) {
    const form = requireAcroForm(doc);
    const names = new Set<string>(),
      font = await doc.embedFont(StandardFonts.Helvetica);
    for (const item of draft.fields) {
      check(signal);
      if (item.deleted) {
        if (item.existing) form.removeField(form.getField(item.name));
        continue;
      }
      if (
        !item.existing &&
        (!item.name.trim() || item.name.length > 150 || item.name.includes('.'))
      )
        throw new Error(
          'Feldnamen müssen eindeutig sein, höchstens 150 Zeichen lang und ohne Punkt.',
        );
      if (names.has(item.name)) throw new Error(`Der Feldname „${item.name}“ ist doppelt.`);
      names.add(item.name);
      const changed =
        !item.existing || JSON.stringify(item.value) !== JSON.stringify(item.initialValue);
      if (item.existing && (!changed || item.kind === 'unsupported' || item.readOnly)) continue;
      const field = item.existing
        ? form.getField(item.name)
        : item.kind === 'text'
          ? form.createTextField(item.name)
          : item.kind === 'checkbox'
            ? form.createCheckBox(item.name)
            : form.createDropdown(item.name);
      if (!item.existing) {
        item.required ? field.enableRequired() : field.disableRequired();
        if (field instanceof PDFTextField) {
          if (item.multiline) field.enableMultiline();
          if (item.maxLength) field.setMaxLength(item.maxLength);
        }
        if (field instanceof PDFDropdown) {
          if (
            !item.options.length ||
            item.options.some((v) => !v.trim()) ||
            new Set(item.options).size !== item.options.length
          )
            throw new Error('Auswahllisten brauchen eindeutige, nicht leere Optionen.');
          field.setOptions(item.options);
        }
        const widget = item.widgets[0];
        if (!widget) throw new Error('Das Formularfeld hat keine Position.');
        const page = await source.pdf.getPage(widget.page + 1),
          viewport = page.getViewport({ scale: 1 }),
          r = widget.rect;
        if (
          Object.values(r).some((v) => !Number.isFinite(v)) ||
          r.x < 0 ||
          r.y < 0 ||
          r.w < 0.005 ||
          r.h < 0.005 ||
          r.x + r.w > 1.001 ||
          r.y + r.h > 1.001
        )
          throw new Error('Bitte das Feld vollständig innerhalb der Seite platzieren.');
        const a = viewport.convertToPdfPoint(r.x * viewport.width, r.y * viewport.height),
          b = viewport.convertToPdfPoint(
            (r.x + r.w) * viewport.width,
            (r.y + r.h) * viewport.height,
          );
        const rect = {
          x: Math.min(a[0], b[0]),
          y: Math.min(a[1], b[1]),
          width: Math.abs(b[0] - a[0]),
          height: Math.abs(b[1] - a[1]),
        };
        const appearance = {
          x: rect.x,
          y: rect.y,
          width: r.w * viewport.width,
          height: r.h * viewport.height,
          borderWidth: 1,
          borderColor: rgb(0.1, 0.5, 0.51),
          backgroundColor: rgb(1, 1, 1),
          textColor: rgb(0.08, 0.15, 0.16),
          rotate: degrees(page.rotate),
          font,
        };
        if (
          field instanceof PDFTextField ||
          field instanceof PDFDropdown ||
          field instanceof PDFCheckBox
        )
          field.addToPage(doc.getPage(widget.page), appearance);
        field.acroField.getWidgets().at(-1)!.setRectangle(rect);
        if (field instanceof PDFTextField) {
          if (!Number.isFinite(item.fontSize) || item.fontSize < 6 || item.fontSize > 48)
            throw new Error('Schriftgröße: 6 bis 48 pt.');
          field.setFontSize(item.fontSize);
        }
      }
      try {
        if (field instanceof PDFTextField) {
          const value = String(item.value);
          if (item.maxLength && value.length > item.maxLength)
            throw new Error(`Maximal ${item.maxLength} Zeichen für „${item.name}“.`);
          field.setText(value);
          field.updateAppearances(font);
        } else if (field instanceof PDFCheckBox) {
          item.value ? field.check() : field.uncheck();
          field.updateAppearances();
        } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
          const selected = Array.isArray(item.value)
            ? item.value
            : item.value
              ? [String(item.value)]
              : [];
          if (selected.length) field.select(selected);
          else field.clear();
          field.updateAppearances(font);
        } else if (field instanceof PDFRadioGroup) {
          if (item.value) field.select(String(item.value));
          else field.clear();
          field.updateAppearances();
        }
      } catch (error) {
        if ((error as Error).message.includes('encode'))
          throw new Error(
            `„${item.name}“ enthält Zeichen, die die Ersatzschrift nicht unterstützt. Lateinische Buchstaben und Umlaute sind möglich.`,
          );
        throw error;
      }
    }
    if (flatten && tool !== 'bookmarks') form.flatten({ updateFieldAppearances: false });
  }
  check(signal);
  const bytes = await doc.save({ updateFieldAppearances: false });
  check(signal);
  const suffix =
    tool === 'bookmarks'
      ? 'Lesezeichen'
      : flatten
        ? 'Ausgefuellt-fixiert'
        : tool === 'create-form'
          ? 'Formular'
          : 'Ausgefuellt';
  return {
    blob: pdfBlob(bytes),
    filename: `${filenameStem(source.name)}-${suffix}.pdf`,
    kind: 'pdf',
    pages: doc.getPageCount(),
    inputSize: source.size,
  };
}
