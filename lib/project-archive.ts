import { z } from 'zod';
import { toolDraftSchema } from './tool-draft-schema';
import { stringifyEditorProject, editorProjectReviver } from './editor-project-codec';
import {
  cleanProjectState,
  validateProject,
  type ProjectSource,
  type ProjectState,
} from './local-projects';
import type { Source } from './pdf-engine';
import { parseOcrLanguages } from './ocr-languages';

// A bounded, uncompressed container. PDF streams already carry their own
// compression; accepting no compressed archive entries avoids ZIP bombs.
const magic = new TextEncoder().encode('MOINPDF-PROJECT\n');
const headerSize = 32;
const maxManifest = 20 * 1024 * 1024;
const maxDocuments = 240 * 1024 * 1024;
export const MAX_PROJECT_FILE = headerSize + maxManifest + maxDocuments;
const identifier = z
  .string()
  .min(1)
  .max(250)
  .refine((v) => !['__proto__', 'constructor', 'prototype'].includes(v));
const short = z.string().max(1000);
const bounded = z.number().finite().min(-100).max(100);
const rect = z
  .object({ x: bounded, y: bounded, w: bounded.nonnegative(), h: bounded.nonnegative() })
  .strict();
const page = z
  .object({
    id: identifier,
    sourceId: identifier,
    index: z.number().int().min(0).max(199),
    rotation: z
      .number()
      .int()
      .refine((v) => Number.isSafeInteger(v) && v % 90 === 0),
    selected: z.boolean(),
  })
  .strict();
const editorStyleSchema = z
  .object({
    fontScale: z.number().finite().min(0.00001).max(10).optional(),
    fontFamily: z.enum(['sans', 'serif', 'mono']).optional(),
    fontChoice: z
      .enum([
        'auto',
        'custom',
        'liberation-sans',
        'liberation-serif',
        'liberation-mono',
        'carlito',
        'caladea',
        'dejavu-sans',
        'dejavu-serif',
        'dejavu-mono',
        'noto-sans',
        'noto-serif',
        'rubik',
        'liberation-sans-narrow',
        'dejavu-sans-condensed',
        'dejavu-serif-condensed',
      ])
      .optional(),
    originalFontId: short.optional(),
    originalFontName: short.optional(),
    originalFontPage: z.number().int().min(0).max(199).optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    script: z.enum(['normal', 'super', 'sub']).optional(),
    color: z
      .string()
      .regex(/^#[a-f\d]{6}$/i)
      .optional(),
  })
  .strict();
const tablePoint = z.number().finite().min(-100000).max(100000);
const tableRectSchema = z
  .object({ x: tablePoint, y: tablePoint, w: tablePoint.positive(), h: tablePoint.positive() })
  .strict();
const tablePathSchema = z
  .object({
    index: z.number().int().min(0).max(9999),
    segments: z
      .array(z.object({ x1: tablePoint, y1: tablePoint, x2: tablePoint, y2: tablePoint }).strict())
      .min(1)
      .max(4000),
    color: z.string().regex(/^#[a-f\d]{6}$/i),
    width: z.number().finite().positive().max(4),
    opacity: z.literal(1),
    fill: z.literal(false),
    dash: z.array(z.number()).length(0),
    lineCap: z.literal('butt'),
    root: z.literal(true),
    clipped: z.literal(false),
    transparent: z.literal(false),
  })
  .strict();
const tableSchema = z
  .object({
    id: identifier,
    pageWidth: tablePoint.positive(),
    pageHeight: tablePoint.positive(),
    columns: z.array(tablePoint).min(2).max(51),
    rows: z.array(tablePoint).min(2).max(101),
    cells: z
      .array(
        z
          .object({
            id: identifier,
            row: z.number().int().min(0).max(99),
            column: z.number().int().min(0).max(49),
            rowSpan: z.number().int().min(1).max(100),
            columnSpan: z.number().int().min(1).max(50),
            textIds: z.array(identifier).max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(2000),
    color: z.string().regex(/^#[a-f\d]{6}$/i),
    width: z.number().finite().positive().max(4),
    original: z
      .object({ paths: z.array(tablePathSchema).min(1).max(4000), rect: tableRectSchema })
      .strict(),
    removedTextIds: z.array(identifier).max(2000).optional(),
    nextCellId: z.number().int().min(2).max(100000),
  })
  .strict()
  .refine((t) => t.original.paths.reduce((n, p) => n + p.segments.length, 0) <= 4000);
const mark = rect.extend({
  id: identifier,
  kind: z.enum(['redact', 'highlight', 'text', 'signature', 'erase', 'image']),
  text: z.string().max(100000).optional(),
  originalText: z.string().max(100000).optional(),
  runs: z
    .array(
      z
        .object({
          start: z.number().int().min(0).max(100000),
          end: z.number().int().min(1).max(100000),
          style: editorStyleSchema,
        })
        .strict(),
    )
    .max(4000)
    .optional(),
  customFont: z
    .object({
      name: z.string().min(1).max(120),
      data: z
        .string()
        .max(2800000)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      bold: z.boolean(),
      italic: z.boolean(),
    })
    .strict()
    .optional(),
  fontScale: z.number().finite().min(0).max(10).optional(),
  textRotation: z.number().finite().min(0).lt(360).optional(),
  textAspect: z.number().finite().positive().max(10000).optional(),
  image: z
    .string()
    .max(maxManifest)
    .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  sourceRect: rect.optional(),
  nativeTable: tableSchema.optional(),
  tableCell: z
    .object({ tableId: identifier, cellId: identifier, deleted: z.boolean().optional() })
    .strict()
    .optional(),
  nativeImage: z
    .object({
      path: z.array(z.number().int().min(0).max(9999)).max(16).optional(),
      index: z.number().int().min(0).max(9999),
      rect,
      crop: rect.optional(),
      corners: z
        .array(z.tuple([z.number().finite().min(-2).max(2), z.number().finite().min(-2).max(2)]))
        .length(3)
        .optional(),
    })
    .strict()
    .optional(),
  sourceRects: z.array(rect).max(2000).optional(),
  sourceIsScan: z.boolean().optional(),
  scanBackground: z.enum(['preserve', 'solid']).optional(),
  scanBlur: z.number().finite().min(0).max(0.06).optional(),
  scanMatch: z
    .object({
      score: z.number().finite().min(0).max(10),
      margin: z.number().finite().min(0).max(10),
      samples: z.number().int().min(1).max(4),
      candidates: z.number().int().min(1).max(56),
      styleKey: z.string().max(16000),
    })
    .strict()
    .optional(),
  fontFamily: z.enum(['sans', 'serif', 'mono']).optional(),
  fontChoice: z
    .enum([
      'auto',
      'custom',
      'liberation-sans',
      'liberation-serif',
      'liberation-mono',
      'carlito',
      'caladea',
      'dejavu-sans',
      'dejavu-serif',
      'dejavu-mono',
      'noto-sans',
      'noto-serif',
      'rubik',
      'liberation-sans-narrow',
      'dejavu-sans-condensed',
      'dejavu-serif-condensed',
    ])
    .optional(),
  originalFontId: short.optional(),
  originalFontName: short.optional(),
  originalFontPage: z.number().int().min(0).max(199).optional(),
  originalState: z.string().max(500000).optional(),
  flow: z
    .object({ id: identifier, order: z.number().int().min(0).max(199) })
    .strict()
    .optional(),
  changeGroup: identifier.optional(),
  baselineScale: z.number().finite().min(0).max(5).optional(),
  insetScale: z.number().finite().min(0).max(5).optional(),
  lineHeight: z.number().finite().min(0.5).max(5).optional(),
  tracking: z.number().finite().min(-0.5).max(0.5).optional(),
  textScaleX: z.number().finite().min(0.1).max(10).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  script: z.enum(['normal', 'super', 'sub']).optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  listStyle: z.enum(['none', 'bullet', 'numbered']).optional(),
  listStart: z.number().int().min(1).max(9999).optional(),
  listContinuation: z.boolean().optional(),
  paragraphSpacing: z.number().finite().min(0).max(5).optional(),
  spellcheck: z.boolean().optional(),
  color: z
    .string()
    .regex(/^#[a-f\d]{6}$/i)
    .optional(),
  fill: z
    .string()
    .regex(/^#[a-f\d]{6}$/i)
    .optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
});
const validMark = mark.superRefine((value, ctx) => {
  if (
    value.nativeTable &&
    (value.kind !== 'image' ||
      value.image ||
      value.nativeImage ||
      value.sourceRect ||
      value.sourceRects?.length ||
      value.tableCell)
  )
    ctx.addIssue({ code: 'custom', message: 'Invalid native table edit' });
  if (value.tableCell && value.kind !== 'text')
    ctx.addIssue({ code: 'custom', message: 'Invalid table cell' });
  if (value.textRotation && value.textRotation % 90 && !value.textAspect)
    ctx.addIssue({ code: 'custom', message: 'Missing rotated text geometry' });
  if (
    value.nativeImage &&
    (value.kind !== 'image' || value.sourceRect || value.sourceRects?.length)
  )
    ctx.addIssue({ code: 'custom', message: 'Invalid original image edit' });
  let end = 0;
  for (const run of value.runs || []) {
    if (run.start < end || run.end <= run.start || run.end > (value.text || '').length)
      ctx.addIssue({ code: 'custom', message: 'Invalid rich text range' });
    end = run.end;
  }
});
const pageMarks = z
  .array(validMark)
  .max(10000)
  .superRefine((values, ctx) => {
    const tables = values.flatMap((m) => (m.nativeTable ? [m.nativeTable] : []));
    const invalid = () =>
      ctx.addIssue({ code: 'custom', message: 'Invalid table cell references' });
    if (new Set(tables.map((t) => t.id)).size !== tables.length) invalid();
    for (const table of tables)
      for (const cell of table.cells)
        if (
          values.filter((m) => m.tableCell?.tableId === table.id && m.tableCell.cellId === cell.id)
            .length !== 1
        )
          invalid();
    for (const table of tables) {
      const deleted = values.filter(
        (m) => m.tableCell?.tableId === table.id && m.tableCell.deleted,
      );
      if (deleted.length !== (table.removedTextIds?.length ? 1 : 0)) invalid();
    }
    for (const m of values)
      if (
        m.tableCell &&
        !tables.some(
          (t) =>
            t.id === m.tableCell!.tableId &&
            (m.tableCell!.deleted
              ? !!t.removedTextIds?.length && m.tableCell!.cellId === t.id + ':deleted' && !m.text
              : t.cells.some((c) => c.id === m.tableCell!.cellId)),
        )
      )
        invalid();
  });
const snapshot = z
  .object({
    pages: z.array(page).max(200),
    sourceIds: z.array(identifier).max(200).optional(),
    activeId: z.string().max(250).optional(),
    documentSessions: z
      .lazy(() =>
        z.record(
          identifier,
          z
            .object({
              current: draft,
              past: z.array(draft).max(100),
              future: z.array(draft).max(100),
            })
            .strict(),
        ),
      )
      .optional(),
    edits: z
      .object({
        marks: z.record(identifier, pageMarks),
        crops: z.record(identifier, rect),
      })
      .strict(),
  })
  .strict();
const field = z
  .object({
    id: identifier,
    name: short,
    kind: z.enum(['text', 'checkbox', 'dropdown', 'radio', 'list', 'unsupported']),
    value: z.union([z.string().max(100000), z.boolean(), z.array(short).max(1000)]),
    initialValue: z
      .union([z.string().max(100000), z.boolean(), z.array(short).max(1000)])
      .optional(),
    options: z.array(short).max(10000),
    widgets: z
      .array(
        z
          .object({ page: z.number().int().min(0).max(199), rect, option: short.optional() })
          .strict(),
      )
      .max(10000),
    existing: z.boolean(),
    required: z.boolean(),
    readOnly: z.boolean(),
    multiline: z.boolean(),
    maxLength: z.number().int().nonnegative().optional(),
    multiple: z.boolean().optional(),
    deleted: z.boolean().optional(),
    fontSize: z.number().finite().min(0).max(1000),
  })
  .strict();
const draft = z
  .object({
    fields: z.array(field).max(10000),
    bookmarks: z
      .array(
        z
          .object({
            id: identifier,
            title: short,
            page: z.number().int().min(0).max(199).nullable(),
            depth: z.number().int().min(0).max(30),
            open: z.boolean(),
            originalId: short.optional(),
            targetChanged: z.boolean().optional(),
          })
          .strict(),
      )
      .max(1000),
    signed: z.boolean(),
    xfa: z.boolean(),
    originalBookmarkCount: z.number().int().nonnegative(),
    originalBookmarks: z.string().max(maxManifest),
  })
  .strict();
const options = z
  .object({
    editorAllowRaster: z.boolean().optional(),
    editorLanguage: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          parseOcrLanguages(v);
          return true;
        } catch {
          return false;
        }
      })
      .optional(),
    language: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          parseOcrLanguages(v);
          return true;
        } catch {
          return false;
        }
      }),
    ocrLayout: z.enum(['3', '4', '6', '7', '11']),
    forceOcr: z.boolean(),
    autoLanguage: z.boolean().optional(),
    imageFormat: z.enum(['png', 'jpg', 'webp', 'tiff', 'bmp']),
    quality: short,
    compressionMode: z.enum(['preserve', 'lossless', 'raster']).optional(),
    watermark: short,
    numberStart: z.number().int().min(0).max(999999),
    firstSource: short,
    secondSource: short,
    reverseSecond: z.boolean(),
    compareMode: z.enum(['pages', 'content']),
    splitMode: z.enum(['every', 'ranges']),
    splitEvery: z.number().int().min(1).max(200),
    splitRanges: z.string().max(1200),
    tileLayout: z.enum(['2x1', '1x2', '2x2', '3x3']),
    cropPadding: z.number().finite(),
    threshold: z.number().finite(),
    stampText: short,
    stampDate: short,
    stampPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
    stampColor: z.enum(['teal', 'green', 'red']),
    metaTitle: short,
    metaAuthor: short,
    metaSubject: short,
    metaKeywords: short,
    removeLinks: z.boolean(),
    overlayOpacity: z.number().finite().min(0).max(100),
    overlayLayer: z.enum(['front', 'back']),
    pageSize: z.enum(['a4', 'letter']),
    orientation: z.enum(['portrait', 'landscape']),
    perSheet: z.enum(['2', '4']),
  })
  .partial()
  .strict();
export const projectStateSchema = snapshot.extend({
  viewState: z
    .object({
      choosingTool: z.boolean().optional(),
      zoom: z.number().finite().min(50).max(400),
      view: z.string().max(50),
      scrollX: z.number().finite().nonnegative().max(10000000),
      scrollY: z.number().finite().nonnegative().max(10000000),
      documentX: z.number().finite().nonnegative().max(10000000),
      documentY: z.number().finite().nonnegative().max(10000000),
    })
    .strict()
    .optional(),
  toolDrafts: toolDraftSchema.optional(),
  options,
  history: z.array(snapshot).max(100),
  future: z.array(snapshot).max(100),
  documentSessions: z.record(
    identifier,
    z
      .object({ current: draft, past: z.array(draft).max(100), future: z.array(draft).max(100) })
      .strict(),
  ),
  activeId: z.string().max(250),
  toolId: z.string().max(100),
});
const part = z.object({ length: z.number().int().min(1).max(maxDocuments) }).strict();
const manifestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    created: z.number().int().nonnegative(),
    state: projectStateSchema,
    sources: z
      .array(
        z
          .object({
            id: identifier,
            name: z.string().min(1).max(1000),
            size: z.number().int().nonnegative().max(maxDocuments),
            kind: z.enum(['pdf', 'image', 'invoice']),
            wasEncrypted: z.boolean().optional(),
            originalDigest: z
              .string()
              .regex(/^[a-f0-9]{64}$/)
              .optional(),
            pdf: part,
            invoice: part.extend({ name: z.string().min(1).max(1000) }).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(600),
  })
  .strict();
function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
}
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
// CRC catches damaged transfers, not deliberate tampering. Shape and reference
// validation below is independent of the checksum and applies on every import.
async function checksum(bytes: Uint8Array, signal?: AbortSignal) {
  let crc = 0xffffffff;
  for (let offset = 0; offset < bytes.length; offset += 4 * 1024 * 1024) {
    check(signal);
    const end = Math.min(bytes.length, offset + 4 * 1024 * 1024);
    for (let i = offset; i < end; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 255];
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  check(signal);
  return (crc ^ 0xffffffff) >>> 0;
}
export function validateProjectReferences(
  state: ProjectState,
  sources: ProjectSource[],
  counts?: Map<string, number>,
) {
  validateProject(state, sources);
  if (state.toolDrafts && !toolDraftSchema.safeParse(state.toolDrafts).success)
    throw new Error('Der Arbeitsstand enthält ungültige Werkzeugeingaben.');
  const ids = new Set(sources.map((s) => s.id));
  for (const snapshot of [state, ...state.history, ...state.future]) {
    if (
      new Set(snapshot.pages.map((p) => p.id)).size !== snapshot.pages.length ||
      (snapshot.sourceIds &&
        (new Set(snapshot.sourceIds).size !== snapshot.sourceIds.length ||
          snapshot.sourceIds.some((id) => !ids.has(id)) ||
          snapshot.pages.some((p) => !snapshot.sourceIds!.includes(p.sourceId)))) ||
      snapshot.pages.some(
        (p) => !ids.has(p.sourceId) || (counts && p.index >= counts.get(p.sourceId)!),
      )
    )
      throw new Error(
        'Die Projektdatei enthält ungültige Seitenverweise im Arbeitsstand oder Verlauf.',
      );
  }
  for (const snapshot of [state, ...state.history, ...state.future])
    for (const [sourceId, session] of Object.entries(snapshot.documentSessions || {})) {
      if (!ids.has(sourceId))
        throw new Error('Ein Formular im Projekt verweist auf eine fehlende Datei.');
      if (counts)
        for (const d of [session.current, ...session.past, ...session.future]) {
          const count = counts.get(sourceId)!;
          if (
            d.fields.some((f) => f.widgets.some((w) => w.page >= count)) ||
            d.bookmarks.some((b) => b.page !== null && b.page >= count)
          )
            throw new Error('Formulare oder Lesezeichen enthalten ungültige Seitenzahlen.');
        }
    }
}
export function validateOpenedProject(state: ProjectState, sources: Source[]) {
  validateProjectReferences(state, sources, new Map(sources.map((s) => [s.id, s.pdf.numPages])));
}
export async function encodeProjectFile(
  name: string,
  sources: ProjectSource[],
  state: ProjectState,
  signal?: AbortSignal,
) {
  check(signal);
  state = cleanProjectState(state);
  validateProjectReferences(state, sources);
  const manifest = manifestSchema.safeParse({
    name,
    created: Date.now(),
    state,
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      size: s.size,
      kind: s.kind,
      wasEncrypted: s.wasEncrypted,
      originalDigest: s.originalDigest,
      pdf: { length: s.bytes.length },
      invoice: s.invoiceOriginal
        ? { length: s.invoiceOriginal.bytes.length, name: s.invoiceOriginal.name }
        : undefined,
    })),
  });
  if (!manifest.success)
    throw new Error(
      'Der Arbeitsstand enthält ungültige Einstellungen. Bitte Eingaben prüfen oder das PDF-Ergebnis übernehmen.',
    );
  const json = new TextEncoder().encode(stringifyEditorProject(manifest.data));
  const parts = sources.flatMap((s) => [
    s.bytes,
    ...(s.invoiceOriginal ? [s.invoiceOriginal.bytes] : []),
  ]);
  const documentSize = parts.reduce((n, p) => n + p.length, 0);
  if (json.length > maxManifest || documentSize > maxDocuments)
    throw new Error(
      'Eine Projektdatei darf höchstens 240 MB Dokumente und 20 MB Bearbeitungsdaten enthalten.',
    );
  const bytes = new Uint8Array(headerSize + json.length + documentSize),
    view = new DataView(bytes.buffer);
  bytes.set(magic);
  view.setUint32(16, 1);
  view.setUint32(20, json.length);
  view.setUint32(24, bytes.length);
  bytes.set(json, headerSize);
  let offset = headerSize + json.length;
  for (const p of parts) {
    bytes.set(p, offset);
    offset += p.length;
  }
  view.setUint32(28, await checksum(bytes.subarray(headerSize), signal));
  return new Blob([bytes], { type: 'application/vnd.moinpdf.project' });
}
export async function decodeProjectFile(file: Blob, signal?: AbortSignal) {
  check(signal);
  if (file.size < headerSize || file.size > MAX_PROJECT_FILE)
    throw new Error('Die Projektdatei ist leer, beschädigt oder größer als 260 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer()),
    view = new DataView(bytes.buffer);
  if (!magic.every((b, i) => bytes[i] === b))
    throw new Error('Das ist keine MoinPDF-Projektdatei (.moinpdf).');
  if (view.getUint32(16) !== 1)
    throw new Error(
      'Diese Projektversion wird noch nicht unterstützt. Bitte MoinPDF aktualisieren.',
    );
  const length = view.getUint32(20);
  if (
    length < 2 ||
    length > maxManifest ||
    headerSize + length > bytes.length ||
    view.getUint32(24) !== bytes.length ||
    view.getUint32(28) !== (await checksum(bytes.subarray(headerSize), signal))
  )
    throw new Error('Die Projektdatei ist beschädigt oder unvollständig.');
  let value: unknown;
  try {
    value = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(headerSize, headerSize + length),
      ),
      editorProjectReviver(),
    );
  } catch {
    throw new Error('Die Projektbeschreibung ist beschädigt.');
  }
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('Die Projektdatei enthält ungültige Daten oder Einstellungen.');
  const manifest = parsed.data;
  let offset = headerSize + length;
  const take = (length: number) => {
    if (offset + length > bytes.length)
      throw new Error('In der Projektdatei fehlen Dokumentdaten.');
    const data = bytes.slice(offset, offset + length);
    offset += length;
    return data;
  };
  const sources: ProjectSource[] = manifest.sources.map(({ pdf, invoice, ...s }) => {
    const data = take(pdf.length);
    if (!new TextDecoder().decode(data.subarray(0, 1024)).includes('%PDF-'))
      throw new Error('Eine enthaltene Datei ist keine PDF.');
    return {
      ...s,
      bytes: data,
      invoiceOriginal: invoice ? { bytes: take(invoice.length), name: invoice.name } : undefined,
    };
  });
  if (offset !== bytes.length || bytes.length - headerSize - length > maxDocuments)
    throw new Error('Die Projektdatei enthält unerwartete Daten.');
  const state = manifest.state as ProjectState;
  validateProjectReferences(state, sources);
  check(signal);
  return {
    name: manifest.name,
    created: manifest.created,
    sources,
    state: cleanProjectState(state),
  };
}
