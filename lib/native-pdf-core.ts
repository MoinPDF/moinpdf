import { init, type WrappedPdfiumModule } from '@embedpdf/pdfium';
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import * as hb from 'harfbuzzjs';
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
const bidi = bidiFactory();
// Local HTTP installations do not expose randomUUID; random bytes remain available.
export const nativeMarkerId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');

export type NativeRect = { x: number; y: number; w: number; h: number };
export type NativeMatrix = [number, number, number, number, number, number];
export type NativeObject = NativeRect & {
  index: number;
  path?: number[];
  textMode?: number;
  clipped?: boolean;
  transparent?: boolean;
  type: 'text' | 'image' | 'path' | 'group' | 'other';
  text: string;
  fontSize: number;
  children?: number;
  shaped?: boolean;
  imageCorners?: [number, number][];
  /** Segments use normalized display coordinates; stroke width uses points. */
  vector?: Omit<import('./editor-tables').TablePath, 'index' | 'root' | 'clipped' | 'transparent'>;
};
export type NativeImagePatch = {
  x: number;
  y: number;
  width: number;
  height: number;
  rgba: Uint8Array;
};
export type NativeChange = {
  index: number;
  order?: 'front' | 'back';
  flipX?: boolean;
  flipY?: boolean;
  remove?: boolean;
  text?: string;
  dx?: number;
  dy?: number;
  scale?: number;
  rotation?: number;
  image?: { width: number; height: number; rgba: Uint8Array };
  imageCrop?: NativeRect;
  imagePatches?: NativeImagePatch[];
  /** Internal transform in the containing Form's coordinate system. */
  transform?: NativeMatrix;
};
export type NativeRemoval = {
  page: number;
  rect: NativeRect;
  color?: string;
  textOnly?: boolean;
  textSlice?: { source: NativeRect; before: string; removed: string; after: string };
};
export type NativeParagraphStyle = {
  from: number;
  to: number;
  fontSize: number;
  color: string;
  fontBytes?: Uint8Array;
  baselineShift?: number;
};
export type NativeParagraph = {
  direction?: 'auto' | 'ltr' | 'rtl';
  fallbackFonts?: Uint8Array[];
  styles?: NativeParagraphStyle[];
  flow?: boolean;
  indices: number[];
  rect: NativeRect;
  text: string;
  fontBytes: Uint8Array;
  fontSize: number;
  lineHeight: number;
  padding: number;
  align: 'left' | 'center' | 'right';
  color: string;
};
export type NativeParagraphResult = {
  bytes: Uint8Array;
  lines: number;
  height: number;
  addedPages: number;
};
type NativeContext = {
  api: WrappedPdfiumModule;
  doc: number;
  alloc: (size: number) => number;
  free: (ptr: number) => void;
};
export async function createNativeEngine(wasmBinary: Uint8Array) {
  const api = await init({ wasmBinary });
  api.PDFiumExt_Init();
  return api;
}
const heap = (api: WrappedPdfiumModule) => (api.pdfium as unknown as { HEAPU8: Uint8Array }).HEAPU8;
function allocate(api: WrappedPdfiumModule, size: number) {
  const p = api.pdfium.wasmExports.malloc(size);
  if (!p) throw new Error('Nicht genügend Arbeitsspeicher für die PDF.');
  return p;
}
function open<T>(api: WrappedPdfiumModule, bytes: Uint8Array, job: (ctx: NativeContext) => T) {
  const input = allocate(api, bytes.length);
  heap(api).set(bytes, input);
  let doc = 0;
  try {
    doc = api.FPDF_LoadMemDocument(input, bytes.length, '');
    if (!doc)
      throw new Error(
        'Die PDF konnte nicht geöffnet werden. Passwortgeschützte Dateien zuerst entsperren.',
      );
    if (api.FPDF_GetPageCount(doc) > 1000)
      throw new Error('Bitte höchstens 1.000 Seiten auf einmal bearbeiten.');
    return job({
      api,
      doc,
      alloc: (size) => allocate(api, size),
      free: (p) => api.pdfium.wasmExports.free(p),
    });
  } finally {
    if (doc) api.FPDF_CloseDocument(doc);
    heap(api).fill(0, input, input + bytes.length);
    api.pdfium.wasmExports.free(input);
  }
}
function saved(ctx: NativeContext) {
  const { api, doc, alloc, free } = ctx,
    writer = api.PDFiumExt_OpenFileWriter();
  let output = 0;
  try {
    if (!api.PDFiumExt_SaveAsCopy(doc, writer))
      throw new Error('Die bearbeitete PDF konnte nicht gespeichert werden.');
    const size = api.PDFiumExt_GetFileWriterSize(writer);
    if (size < 8 || size > 256 * 1024 * 1024)
      throw new Error('Die Ausgabe ist leer oder größer als 256 MB.');
    output = alloc(size);
    api.PDFiumExt_GetFileWriterData(writer, output, size);
    return heap(api).slice(output, output + size);
  } finally {
    if (output) free(output);
    api.PDFiumExt_CloseFileWriter(writer);
  }
}
function pageHandle(ctx: NativeContext, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= ctx.api.FPDF_GetPageCount(ctx.doc))
    throw new Error('Ungültige Seite.');
  const page = ctx.api.FPDF_LoadPage(ctx.doc, index);
  if (!page) throw new Error('Die Seite konnte nicht geladen werden.');
  return page;
}
function requireSerializablePage(ctx: NativeContext, page: number) {
  for (let i = 0; i < ctx.api.FPDFPage_CountObjects(page); i++)
    if (![1, 2, 3, 5].includes(ctx.api.FPDFPageObj_GetType(ctx.api.FPDFPage_GetObject(page, i))))
      throw new Error(
        'Diese Seite enthält einen nicht unterstützten Grafiktyp. Der Originalinhalt bleibt erhalten.',
      );
}
function toPdf(ctx: NativeContext, page: number, x: number, y: number) {
  const { api, alloc, free } = ctx,
    p = alloc(16);
  try {
    if (
      !api.FPDF_DeviceToPage(
        page,
        0,
        0,
        100000,
        100000,
        0,
        Math.round(x * 100000),
        Math.round(y * 100000),
        p,
        p + 8,
      )
    )
      throw new Error('Seitenkoordinaten konnten nicht umgerechnet werden.');
    return [api.pdfium.getValue(p, 'double'), api.pdfium.getValue(p + 8, 'double')];
  } finally {
    free(p);
  }
}
function toView(ctx: NativeContext, page: number, x: number, y: number) {
  const { api, alloc, free } = ctx,
    p = alloc(8);
  try {
    if (!api.FPDF_PageToDevice(page, 0, 0, 100000, 100000, 0, x, y, p, p + 4))
      throw new Error('Seitenkoordinaten konnten nicht umgerechnet werden.');
    return [api.pdfium.getValue(p, 'i32') / 100000, api.pdfium.getValue(p + 4, 'i32') / 100000];
  } finally {
    free(p);
  }
}
const identity: NativeMatrix = [1, 0, 0, 1, 0, 0];
function multiply(a: NativeMatrix, b: NativeMatrix): NativeMatrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function inverse(m: NativeMatrix): NativeMatrix {
  const d = m[0] * m[3] - m[1] * m[2];
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12)
    throw new Error('Die Gruppe hat keine umkehrbare Transformation.');
  return [
    m[3] / d,
    -m[1] / d,
    -m[2] / d,
    m[0] / d,
    (m[2] * m[5] - m[3] * m[4]) / d,
    (m[1] * m[4] - m[0] * m[5]) / d,
  ];
}
function formScope(ctx: NativeContext, page: number, path: number[]) {
  if (path.length > 16) throw new Error('Objektgruppen dürfen höchstens 16 Ebenen tief sein.');
  let container = page,
    matrix: NativeMatrix = identity;
  for (const [depth, index] of path.entries()) {
    const count = depth
      ? ctx.api.FPDFFormObj_CountObjects(container)
      : ctx.api.FPDFPage_CountObjects(container);
    if (!Number.isInteger(index) || index < 0 || index >= count)
      throw new Error('Die ausgewählte Objektgruppe ist nicht mehr vorhanden.');
    const obj = depth
      ? ctx.api.FPDFFormObj_GetObject(container, index)
      : ctx.api.FPDFPage_GetObject(container, index);
    if (ctx.api.FPDFPageObj_GetType(obj) !== 5)
      throw new Error('Die Auswahl ist keine Objektgruppe.');
    const p = ctx.alloc(24);
    try {
      if (!ctx.api.FPDFPageObj_GetMatrix(obj, p))
        throw new Error('Die Gruppentransformation ist nicht lesbar.');
      const local = [0, 4, 8, 12, 16, 20].map((n) =>
        ctx.api.pdfium.getValue(p + n, 'float'),
      ) as NativeMatrix;
      matrix = multiply(matrix, local);
    } finally {
      ctx.free(p);
    }
    container = obj;
  }
  return { container, matrix };
}
function objectRect(
  ctx: NativeContext,
  page: number,
  obj: number,
  matrix: NativeMatrix = identity,
) {
  const { api, alloc, free } = ctx,
    p = alloc(16);
  try {
    if (!api.FPDFPageObj_GetBounds(obj, p, p + 4, p + 8, p + 12)) return null;
    const [l, b, r, t] = [0, 4, 8, 12].map((i) => api.pdfium.getValue(p + i, 'float'));
    const corners = [
      [l, b],
      [l, t],
      [r, b],
      [r, t],
    ].map(([x, y]) => [
      matrix[0] * x + matrix[2] * y + matrix[4],
      matrix[1] * x + matrix[3] * y + matrix[5],
    ]);
    const views = corners.map(([x, y]) => toView(ctx, page, x, y));
    const left = Math.min(...corners.map((v) => v[0])),
      right = Math.max(...corners.map((v) => v[0])),
      bottom = Math.min(...corners.map((v) => v[1])),
      top = Math.max(...corners.map((v) => v[1]));
    const x = Math.min(...views.map((v) => v[0])),
      y = Math.min(...views.map((v) => v[1]));
    return {
      x,
      y,
      w: Math.max(...views.map((v) => v[0])) - x,
      h: Math.max(...views.map((v) => v[1])) - y,
      left,
      bottom,
      right,
      top,
    };
  } finally {
    free(p);
  }
}
function objectText(ctx: NativeContext, obj: number, textPage: number) {
  const { api, alloc, free } = ctx,
    size = api.FPDFTextObj_GetText(obj, textPage, 0, 0);
  if (size < 2 || size > 200000) return '';
  const p = alloc(size);
  try {
    api.FPDFTextObj_GetText(obj, textPage, p, size);
    return api.pdfium.UTF16ToString(p).replace(/\u200b/g, '');
  } finally {
    free(p);
  }
}
/** Shaped outlines and their logical text must remain one editable cluster. */
function clusterMark(ctx: NativeContext, obj: number) {
  const { api } = ctx;
  const p = ctx.alloc(256),
    length = ctx.alloc(4);
  try {
    for (let i = 0; i < api.FPDFPageObj_CountMarks(obj); i++) {
      const mark = api.FPDFPageObj_GetMark(obj, i);
      if (api.FPDFPageObjMark_GetName(mark, p, 256, length)) {
        const value = api.pdfium.UTF16ToString(p);
        if (/^MoinCluster[a-f0-9]{32}$/.test(value)) return value;
      }
    }
  } finally {
    ctx.free(p);
    ctx.free(length);
  }
  return '';
}
function clusterMembers(ctx: NativeContext, handles: number[]) {
  const groups = new Map<string, number[]>(),
    byIndex = new Map<number, number[]>();
  handles.forEach((obj, i) => {
    const key = clusterMark(ctx, obj);
    if (key) {
      const ids = groups.get(key) || [];
      ids.push(i);
      groups.set(key, ids);
    }
  });
  for (const ids of groups.values()) for (const i of ids) byIndex.set(i, ids);
  return byIndex;
}
function logicalMarkedText(ctx: NativeContext, obj: number) {
  if (!clusterMark(ctx, obj)) return undefined;
  const length = ctx.alloc(4);
  try {
    for (let i = 0; i < ctx.api.FPDFPageObj_CountMarks(obj); i++) {
      const mark = ctx.api.FPDFPageObj_GetMark(obj, i);
      if (!ctx.api.FPDFPageObjMark_GetParamStringValue(mark, 'MoinTextHex', 0, 0, length)) continue;
      const size = ctx.api.pdfium.getValue(length, 'i32');
      if (size < 2 || size > 160002) continue;
      const p = ctx.alloc(size);
      try {
        if (!ctx.api.FPDFPageObjMark_GetParamStringValue(mark, 'MoinTextHex', p, size, length))
          continue;
        const hex: string = ctx.api.pdfium.UTF16ToString(p);
        if (!/^(?:[0-9a-f]{4})*$/.test(hex)) continue;
        return (hex.match(/.{4}/g) || []).map((n) => String.fromCharCode(parseInt(n, 16))).join('');
      } finally {
        ctx.free(p);
      }
    }
  } finally {
    ctx.free(length);
  }
}
function expandedIndices(ctx: NativeContext, handles: number[], indices: number[]) {
  if (indices.some((i) => !Number.isInteger(i) || i < 0 || !handles[i]))
    throw new Error('Ungültige Objektauswahl.');
  const members = clusterMembers(ctx, handles);
  return [...new Set(indices.flatMap((i) => members.get(i) || [i]))].sort((a, b) => a - b);
}
function combinedBounds(
  ctx: NativeContext,
  page: number,
  handles: number[],
  matrix: NativeMatrix = identity,
) {
  const visible = handles.filter(
    (obj) =>
      ctx.api.FPDFPageObj_GetType(obj) !== 1 || ctx.api.FPDFTextObj_GetTextRenderMode(obj) !== 3,
  );
  const rects = (visible.length ? visible : handles)
    .map((obj) => objectRect(ctx, page, obj, matrix))
    .filter((r) => r !== null);
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x)),
    y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    w: Math.max(...rects.map((r) => r.x + r.w)) - x,
    h: Math.max(...rects.map((r) => r.y + r.h)) - y,
    left: Math.min(...rects.map((r) => r.left)),
    bottom: Math.min(...rects.map((r) => r.bottom)),
    right: Math.max(...rects.map((r) => r.right)),
    top: Math.max(...rects.map((r) => r.top)),
  };
}
function inspectNativeVector(
  ctx: NativeContext,
  page: number,
  object: number,
): NativeObject['vector'] {
  const { api } = ctx,
    p = ctx.alloc(80);
  try {
    const count = api.FPDFPath_CountSegments(object),
      dashCount = api.FPDFPageObj_GetDashCount(object);
    if (
      count < 2 ||
      count > 4000 ||
      dashCount < 0 ||
      dashCount > 32 ||
      !api.FPDFPageObj_GetMatrix(object, p) ||
      !api.FPDFPageObj_GetStrokeWidth(object, p + 24) ||
      !api.FPDFPageObj_GetStrokeColor(object, p + 28, p + 32, p + 36, p + 40) ||
      !api.FPDFPath_GetDrawMode(object, p + 44, p + 48)
    )
      return;
    const matrix = [0, 4, 8, 12, 16, 20].map((n) =>
      api.pdfium.getValue(p + n, 'float'),
    ) as NativeMatrix;
    const [a, b, c, d, e, f] = matrix,
      sx = Math.hypot(a, b),
      sy = Math.hypot(c, d);
    if (
      !matrix.every(Number.isFinite) ||
      sx <= 0 ||
      Math.abs(sx - sy) > 1e-5 ||
      Math.abs(a * c + b * d) > 1e-5 ||
      !api.pdfium.getValue(p + 48, 'i32')
    )
      return;
    const segments: NonNullable<NativeObject['vector']>['segments'][number][] = [];
    let previous: [number, number] | undefined, start: [number, number] | undefined;
    for (let i = 0; i < count; i++) {
      const segment = api.FPDFPath_GetPathSegment(object, i),
        type = api.FPDFPathSegment_GetType(segment);
      if (![0, 2].includes(type) || !api.FPDFPathSegment_GetPoint(segment, p + 52, p + 56)) return;
      const x = api.pdfium.getValue(p + 52, 'float'),
        y = api.pdfium.getValue(p + 56, 'float');
      const point = toView(ctx, page, a * x + c * y + e, b * x + d * y + f) as [number, number];
      if (type === 2) {
        start = point;
      } else if (previous)
        segments.push({ x1: previous[0], y1: previous[1], x2: point[0], y2: point[1] });
      else return;
      previous = point;
      if (
        api.FPDFPathSegment_GetClose(segment) &&
        start &&
        (point[0] !== start[0] || point[1] !== start[1])
      ) {
        segments.push({ x1: point[0], y1: point[1], x2: start[0], y2: start[1] });
        previous = start;
      }
    }
    const rgba = [28, 32, 36, 40].map((n) => api.pdfium.getValue(p + n, 'i32')),
      cap = api.FPDFPageObj_GetLineCap(object);
    if (![0, 1, 2].includes(cap) || rgba.some((n) => n < 0 || n > 255)) return;
    return {
      segments,
      color:
        '#' +
        rgba
          .slice(0, 3)
          .map((n) => n.toString(16).padStart(2, '0'))
          .join(''),
      width: api.pdfium.getValue(p + 24, 'float') * sx,
      opacity: rgba[3] / 255,
      fill: !!api.pdfium.getValue(p + 44, 'i32'),
      dash: Array(dashCount).fill(1),
      lineCap: cap === 0 ? 'butt' : cap === 1 ? 'round' : 'square',
    };
  } finally {
    ctx.free(p);
  }
}
export function inspectNativeObjects(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  path: number[] = [],
): NativeObject[] {
  return open(api, bytes, (ctx) => {
    const page = pageHandle(ctx, index),
      textPage = api.FPDFText_LoadPage(page),
      sizePtr = ctx.alloc(4);
    try {
      const scope = formScope(ctx, page, path);
      const count = path.length
        ? api.FPDFFormObj_CountObjects(scope.container)
        : api.FPDFPage_CountObjects(page);
      if (count > 10000)
        throw new Error(
          'Diese Seite enthält mehr als 10.000 Objekte. Bitte einen kleineren Ausschnitt verwenden.',
        );
      const objects: NativeObject[] = [];
      const handles = Array.from({ length: count }, (_, i) =>
        path.length
          ? api.FPDFFormObj_GetObject(scope.container, i)
          : api.FPDFPage_GetObject(page, i),
      );
      const members = clusterMembers(ctx, handles);
      for (let i = 0; i < count; i++) {
        const ids = members.get(i) || [i];
        if (ids[0] !== i) continue;
        const obj = handles[i],
          r = combinedBounds(
            ctx,
            page,
            ids.map((id) => handles[id]),
            scope.matrix,
          );
        if (!r) continue;
        const type = api.FPDFPageObj_GetType(obj),
          text =
            type === 1
              ? (logicalMarkedText(ctx, obj) ??
                ids.map((id) => objectText(ctx, handles[id], textPage)).join(''))
              : '';
        let fontSize = 0;
        if (type === 1 && api.FPDFTextObj_GetFontSize(obj, sizePtr))
          fontSize = api.pdfium.getValue(sizePtr, 'float');
        let imageCorners: [number, number][] | undefined;
        if (type === 3) {
          const ptr = ctx.alloc(24);
          try {
            if (api.FPDFPageObj_GetMatrix(obj, ptr)) {
              const m = multiply(
                scope.matrix,
                [0, 4, 8, 12, 16, 20].map((n) =>
                  api.pdfium.getValue(ptr + n, 'float'),
                ) as NativeMatrix,
              );
              imageCorners = [
                [0, 1],
                [1, 1],
                [0, 0],
              ].map(
                ([x, y]) =>
                  toView(ctx, page, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]) as [
                    number,
                    number,
                  ],
              );
            }
          } finally {
            ctx.free(ptr);
          }
        }
        objects.push({
          index: i,
          path: [...path],
          ...(type === 1 ? { textMode: api.FPDFTextObj_GetTextRenderMode(obj) } : {}),
          clipped:
            !!api.FPDFPageObj_GetClipPath(obj) &&
            api.FPDFClipPath_CountPaths(api.FPDFPageObj_GetClipPath(obj)) >= 0,
          transparent: !!api.FPDFPageObj_HasTransparency(obj),
          type:
            type === 1
              ? 'text'
              : type === 2
                ? 'path'
                : type === 3
                  ? 'image'
                  : type === 5
                    ? 'group'
                    : 'other',
          text,
          fontSize,
          ...(imageCorners ? { imageCorners } : {}),
          ...(type === 2 && !path.length ? { vector: inspectNativeVector(ctx, page, obj) } : {}),
          ...(type === 5 ? { children: api.FPDFFormObj_CountObjects(obj) } : {}),
          ...(members.has(i) ? { shaped: true } : {}),
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
        });
      }
      return objects;
    } finally {
      ctx.free(sizePtr);
      api.FPDFText_ClosePage(textPage);
      api.FPDF_ClosePage(page);
    }
  });
}
/** Bounded instance tree. Paths refer to original container indices, never to
 * shared resource names, so reused Forms remain independently selectable. */
export function inspectNativeObjectTree(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
) {
  const result: NativeObject[] = [];
  let containers = 0;
  const visit = (path: number[], clipped = false, transparent = false) => {
    if (++containers > 128 || path.length > 16)
      throw new Error('Die Seite enthält zu viele verschachtelte Objektgruppen.');
    for (const object of inspectNativeObjects(api, bytes, index, path)) {
      const entry = {
        ...object,
        clipped: clipped || object.clipped,
        transparent: transparent || object.transparent,
      };
      result.push(entry);
      if (result.length > 10000) throw new Error('Die Seite enthält mehr als 10.000 Objekte.');
      if (entry.type === 'group') visit([...path, entry.index], entry.clipped, entry.transparent);
    }
  };
  visit([]);
  return result;
}
function changeMatrix(
  ctx: NativeContext,
  page: number,
  obj: number,
  change: NativeChange,
  parent: NativeMatrix = identity,
  linked?: number[],
): NativeMatrix | null {
  const dx = change.dx ?? 0,
    dy = change.dy ?? 0,
    scale = change.scale ?? 1,
    rotation = change.rotation ?? 0;
  if (
    ![dx, dy, scale, rotation].every(Number.isFinite) ||
    Math.abs(dx) > 1 ||
    Math.abs(dy) > 1 ||
    scale < 0.1 ||
    scale > 10 ||
    Math.abs(rotation) > 360
  )
    throw new Error('Ungültige Verschiebung, Größe oder Drehung.');
  if (!(dx || dy || scale !== 1 || rotation || change.flipX || change.flipY)) return null;
  const r = linked ? combinedBounds(ctx, page, linked, parent) : objectRect(ctx, page, obj, parent);
  if (!r) throw new Error('Die Objektposition ist nicht lesbar.');
  const center = [(r.left + r.right) / 2, (r.bottom + r.top) / 2],
    origin = toPdf(ctx, page, 0, 0),
    offset = toPdf(ctx, page, dx, dy),
    rad = (-rotation * Math.PI) / 180,
    c = Math.cos(rad) * scale,
    s = Math.sin(rad) * scale;
  const viewX = toPdf(ctx, page, 1, 0),
    swapped = Math.abs(viewX[1] - origin[1]) > Math.abs(viewX[0] - origin[0]);
  const fx = (swapped ? change.flipY : change.flipX) ? -1 : 1,
    fy = (swapped ? change.flipX : change.flipY) ? -1 : 1;
  const a = c * fx,
    b = s * fx,
    cc = -s * fy,
    d = c * fy;
  return [
    a,
    b,
    cc,
    d,
    center[0] - a * center[0] - cc * center[1] + offset[0] - origin[0],
    center[1] - b * center[0] - d * center[1] + offset[1] - origin[1],
  ] as NativeMatrix;
}
const maxNativeSourcePixels = 16000000;
const maxNativeTilePixels = 4000000;
type NativeBitmap = {
  bitmap: number;
  width: number;
  height: number;
  format: number;
  stride: number;
  buffer: number;
  channels: number;
};

/** The full decoded bitmap is bounded in WASM. Only the requested tile leaves it. */
function withNativeImage<T>(
  ctx: NativeContext,
  page: number,
  object: number,
  job: (image: NativeBitmap) => T,
) {
  const { api } = ctx,
    metadata = ctx.alloc(40),
    matrix = ctx.alloc(24);
  let bitmap = 0;
  let original: NativeMatrix | undefined;
  try {
    if (api.FPDFPageObj_GetType(object) !== 3) throw new Error('Kein einzelnes Bildobjekt.');
    if (!api.FPDFImageObj_GetImageMetadata(object, page, metadata))
      throw new Error('Die Bilddaten konnten nicht gelesen werden.');
    const inputWidth = api.pdfium.getValue(metadata, 'i32'),
      inputHeight = api.pdfium.getValue(metadata + 4, 'i32');
    if (
      !Number.isInteger(inputWidth) ||
      !Number.isInteger(inputHeight) ||
      inputWidth < 1 ||
      inputHeight < 1 ||
      inputWidth * inputHeight > maxNativeSourcePixels
    )
      throw new Error('Das Quellbild darf höchstens 16 Megapixel haben.');
    if (!api.FPDFPageObj_GetMatrix(object, matrix))
      throw new Error('Die Bildausrichtung konnte nicht gelesen werden.');
    original = [0, 4, 8, 12, 16, 20].map((n) =>
      api.pdfium.getValue(matrix + n, 'float'),
    ) as NativeMatrix;
    if (!api.FPDFImageObj_SetMatrix(object, inputWidth, 0, 0, inputHeight, 0, 0))
      throw new Error('Die Bildausrichtung konnte nicht gelesen werden.');
    bitmap = api.FPDFImageObj_GetRenderedBitmap(ctx.doc, page, object);
    if (!bitmap) throw new Error('Das Bild konnte nicht lokal dekodiert werden.');
    if (!api.FPDFImageObj_SetMatrix(object, ...original))
      throw new Error('Die Bildausrichtung konnte nicht wiederhergestellt werden.');
    const width = api.FPDFBitmap_GetWidth(bitmap),
      height = api.FPDFBitmap_GetHeight(bitmap),
      format = api.FPDFBitmap_GetFormat(bitmap),
      stride = api.FPDFBitmap_GetStride(bitmap),
      buffer = api.FPDFBitmap_GetBuffer(bitmap),
      channels = format === 1 ? 1 : format === 2 ? 3 : 4;
    if (
      width !== inputWidth ||
      height !== inputHeight ||
      ![1, 2, 3, 4].includes(format) ||
      stride < width * channels ||
      !buffer ||
      buffer + stride * height > heap(api).length
    )
      throw new Error('Das Bildformat ist nicht zum Zuschneiden geeignet.');
    return job({ bitmap, width, height, format, stride, buffer, channels });
  } finally {
    if (original) api.FPDFImageObj_SetMatrix(object, ...original);
    if (bitmap) api.FPDFBitmap_Destroy(bitmap);
    ctx.free(matrix);
    ctx.free(metadata);
  }
}

export function readNativeImage(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  objectIndex: number,
  path: number[] = [],
  region?: NativeRect,
) {
  return open(api, bytes, (ctx) => {
    const page = pageHandle(ctx, index);
    try {
      const scope = formScope(ctx, page, path),
        count = path.length
          ? api.FPDFFormObj_CountObjects(scope.container)
          : api.FPDFPage_CountObjects(page);
      if (!Number.isInteger(objectIndex) || objectIndex < 0 || objectIndex >= count)
        throw new Error('Ungültiges Bildobjekt.');
      const object = path.length
        ? api.FPDFFormObj_GetObject(scope.container, objectIndex)
        : api.FPDFPage_GetObject(page, objectIndex);
      return withNativeImage(ctx, page, object, (image) => {
        const r = region || { x: 0, y: 0, w: 1, h: 1 };
        if (
          ![r.x, r.y, r.w, r.h].every(Number.isFinite) ||
          r.x < 0 ||
          r.y < 0 ||
          r.w <= 0 ||
          r.h <= 0 ||
          r.x + r.w > 1 ||
          r.y + r.h > 1
        )
          throw new Error('Ungültiger Bildausschnitt.');
        const stable = (value: number) =>
          Math.abs(value - Math.round(value)) < 1e-7 ? Math.round(value) : value;
        const x = Math.floor(stable(r.x * image.width)),
          y = Math.floor(stable(r.y * image.height)),
          width = Math.min(image.width, Math.ceil(stable((r.x + r.w) * image.width))) - x,
          height = Math.min(image.height, Math.ceil(stable((r.y + r.h) * image.height))) - y;
        if (width * height > maxNativeTilePixels)
          throw new Error('Der Bildausschnitt darf höchstens 4 Megapixel haben.');
        const rgba = new Uint8Array(width * height * 4),
          data = heap(api);
        for (let row = 0; row < height; row++)
          for (let col = 0; col < width; col++) {
            const from = image.buffer + (y + row) * image.stride + (x + col) * image.channels,
              to = (row * width + col) * 4;
            rgba[to] = data[from + (image.channels === 1 ? 0 : 2)];
            rgba[to + 1] = data[from + (image.channels === 1 ? 0 : 1)];
            rgba[to + 2] = data[from];
            rgba[to + 3] = image.format === 4 ? data[from + 3] : 255;
          }
        return { x, y, width, height, sourceWidth: image.width, sourceHeight: image.height, rgba };
      });
    } finally {
      api.FPDF_ClosePage(page);
    }
  });
}

function requirePatchableImageState(ctx: NativeContext, object: number) {
  const { api } = ctx;
  if (api.FPDFPageObj_HasTransparency(object))
    throw new Error('Transparente Bilder werden nicht als Scan-Ausschnitt bearbeitet.');
  const clip = api.FPDFPageObj_GetClipPath(object);
  // PDFium returns -1 for no clip; zero can still represent text-only clipping.
  if (clip && api.FPDFClipPath_CountPaths(clip) >= 0)
    throw new Error('Beschnittene Bilder werden nicht als Scan-Ausschnitt bearbeitet.');
}

/** Check before any PDFium serialization: generating content can lose text-only clips. */
export function validateNativeImagePatchTargets(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  changes: NativeChange[],
  path: number[] = [],
) {
  if (!changes.some((c) => c.imagePatches)) return;
  return open(api, bytes, (ctx) => {
    const page = pageHandle(ctx, index);
    try {
      for (let depth = 1; depth <= path.length; depth++)
        requirePatchableImageState(ctx, formScope(ctx, page, path.slice(0, depth)).container);
      const scope = formScope(ctx, page, path),
        count = path.length
          ? api.FPDFFormObj_CountObjects(scope.container)
          : api.FPDFPage_CountObjects(page);
      for (const change of changes.filter((c) => c.imagePatches)) {
        if (!Number.isInteger(change.index) || change.index < 0 || change.index >= count)
          throw new Error('Ungültiges Bildobjekt.');
        const object = path.length
          ? api.FPDFFormObj_GetObject(scope.container, change.index)
          : api.FPDFPage_GetObject(page, change.index);
        if (api.FPDFPageObj_GetType(object) !== 3) throw new Error('Kein einzelnes Bildobjekt.');
        requirePatchableImageState(ctx, object);
      }
    } finally {
      api.FPDF_ClosePage(page);
    }
  });
}

/** Opaque source scans only; application-level geometry/render checks remain required. */
function patchNativeImage(
  ctx: NativeContext,
  page: number,
  object: number,
  patches: NativeImagePatch[],
) {
  const { api } = ctx;
  if (
    !Array.isArray(patches) ||
    patches.length < 1 ||
    patches.length > 200 ||
    patches.reduce((sum, p) => sum + p.width * p.height, 0) > maxNativeTilePixels
  )
    throw new Error('Bitte höchstens 200 Bildausschnitte mit zusammen 4 Megapixeln verwenden.');
  requirePatchableImageState(ctx, object);
  withNativeImage(ctx, page, object, (image) => {
    for (const p of patches) {
      if (
        ![p.x, p.y, p.width, p.height].every(Number.isInteger) ||
        p.x < 0 ||
        p.y < 0 ||
        p.width < 1 ||
        p.height < 1 ||
        p.x + p.width > image.width ||
        p.y + p.height > image.height ||
        !(p.rgba instanceof Uint8Array) ||
        p.rgba.length !== p.width * p.height * 4
      )
        throw new Error('Ungültiger Bildausschnitt.');
      for (let i = 3; i < p.rgba.length; i += 4)
        if (p.rgba[i] !== 255) throw new Error('Scan-Ausschnitte müssen undurchsichtig sein.');
    }
    // PDFium owns this BGRA buffer. Avoid a second full-size JavaScript pixel array.
    const output = api.FPDFBitmap_Create(image.width, image.height, 1);
    if (!output) throw new Error('Nicht genügend Arbeitsspeicher für das Scanbild.');
    try {
      const buffer = api.FPDFBitmap_GetBuffer(output),
        stride = api.FPDFBitmap_GetStride(output),
        data = heap(api);
      if (
        api.FPDFBitmap_GetFormat(output) !== 4 ||
        !buffer ||
        stride < image.width * 4 ||
        buffer + stride * image.height > data.length
      )
        throw new Error('Das Scanbild konnte nicht aufgebaut werden.');
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++) {
          const from = image.buffer + y * image.stride + x * image.channels,
            to = buffer + y * stride + x * 4;
          if (image.format === 4 && data[from + 3] !== 255)
            throw new Error('Transparente Bildpixel werden nicht als Scan-Ausschnitt bearbeitet.');
          data[to] = data[from];
          data[to + 1] = data[from + (image.channels === 1 ? 0 : 1)];
          data[to + 2] = data[from + (image.channels === 1 ? 0 : 2)];
          data[to + 3] = 255;
        }
      for (const p of patches)
        for (let y = 0; y < p.height; y++)
          for (let x = 0; x < p.width; x++) {
            const from = (y * p.width + x) * 4,
              to = buffer + (p.y + y) * stride + (p.x + x) * 4;
            data[to] = p.rgba[from + 2];
            data[to + 1] = p.rgba[from + 1];
            data[to + 2] = p.rgba[from];
            data[to + 3] = 255;
          }
      if (!api.FPDFImageObj_SetBitmap(0, 0, object, output))
        throw new Error('Die Scan-Ausschnitte konnten nicht übernommen werden.');
    } finally {
      api.FPDFBitmap_Destroy(output);
    }
  });
}

export function editNativeObjects(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  changes: NativeChange[],
) {
  if (!changes.length || changes.length > 10000)
    throw new Error('Bitte mindestens eine Änderung auswählen.');
  return open(api, bytes, (ctx) => {
    const page = pageHandle(ctx, index),
      seen = new Set<number>();
    try {
      requireSerializablePage(ctx, page);
      const handles = Array.from({ length: api.FPDFPage_CountObjects(page) }, (_, i) =>
        api.FPDFPage_GetObject(page, i),
      );
      const members = clusterMembers(ctx, handles);
      const prepared = changes.flatMap((change) => {
        const ids = members.get(change.index);
        if (!ids) return [change];
        if (change.text !== undefined)
          throw new Error(
            'Geformte Zeichen bitte im Absatzmodus mit einer passenden Schrift bearbeiten.',
          );
        const transform =
          change.transform ||
          changeMatrix(
            ctx,
            page,
            handles[change.index],
            change,
            identity,
            ids.map((id) => handles[id]),
          );
        return (change.order === 'back' ? ids.slice().reverse() : ids).map((id) => ({
          ...change,
          index: id,
          ...(transform ? { transform } : {}),
        }));
      });
      for (const change of prepared) {
        if (seen.has(change.index) || !handles[change.index])
          throw new Error('Doppeltes oder ungültiges Seitenobjekt.');
        seen.add(change.index);
        const obj = handles[change.index];
        if (
          change.imagePatches &&
          (change.image || change.imageCrop || change.remove || change.text !== undefined)
        )
          throw new Error(
            'Bildausschnitte dürfen nicht mit Bildersatz, Zuschnitt oder Löschung kombiniert werden.',
          );
        if (change.imagePatches) patchNativeImage(ctx, page, obj, change.imagePatches);
        if (change.remove) {
          if (!api.FPDFPage_RemoveObject(page, obj))
            throw new Error('Das Objekt konnte nicht entfernt werden.');
          api.FPDFPageObj_Destroy(obj);
          continue;
        }
        if (change.order) {
          if (!['front', 'back'].includes(change.order))
            throw new Error('Ungültige Zeichenreihenfolge.');
          if (!api.FPDFPage_RemoveObject(page, obj))
            throw new Error('Das Objekt konnte nicht umgeordnet werden.');
          if (change.order === 'front') api.FPDFPage_InsertObject(page, obj);
          else if (!api.FPDFPage_InsertObjectAtIndex(page, obj, 0)) {
            api.FPDFPage_InsertObject(page, obj);
            throw new Error('Das Objekt konnte nicht nach hinten gestellt werden.');
          }
        }
        if (change.imageCrop) {
          const r = change.imageCrop;
          if (api.FPDFPageObj_GetType(obj) !== 3 || !validRemovalRect(r))
            throw new Error('Ungültiger Bildzuschnitt.');
          const ptr = ctx.alloc(24);
          try {
            if (!api.FPDFPageObj_GetMatrix(obj, ptr))
              throw new Error('Die Bildausrichtung konnte nicht gelesen werden.');
            const matrix = [0, 4, 8, 12, 16, 20].map((n) =>
              api.pdfium.getValue(ptr + n, 'float'),
            ) as NativeMatrix;
            const next = multiply(matrix, [r.w, 0, 0, r.h, r.x, 1 - r.y - r.h]);
            if (!api.FPDFImageObj_SetMatrix(obj, ...next))
              throw new Error('Der Bildzuschnitt konnte nicht gesetzt werden.');
          } finally {
            ctx.free(ptr);
          }
        }
        if (change.image) {
          const im = change.image;
          if (
            api.FPDFPageObj_GetType(obj) !== 3 ||
            !Number.isInteger(im.width) ||
            !Number.isInteger(im.height) ||
            im.width < 1 ||
            im.height < 1 ||
            im.width * im.height > 4000000 ||
            im.rgba.length !== im.width * im.height * 4
          )
            throw new Error('Ungültiges Ersatzbild (maximal 4 Megapixel).');
          const p = ctx.alloc(im.rgba.length);
          let bitmap = 0;
          try {
            const bgra = im.rgba.slice();
            for (let i = 0; i < bgra.length; i += 4) {
              const red = bgra[i];
              bgra[i] = bgra[i + 2];
              bgra[i + 2] = red;
            }
            heap(api).set(bgra, p);
            bitmap = api.FPDFBitmap_CreateEx(im.width, im.height, 4, p, im.width * 4);
            if (!bitmap || !api.FPDFImageObj_SetBitmap(0, 0, obj, bitmap))
              throw new Error('Das Bild konnte nicht ersetzt werden.');
          } finally {
            if (bitmap) api.FPDFBitmap_Destroy(bitmap);
            ctx.free(p);
          }
        }
        if (change.text !== undefined) {
          if (
            api.FPDFPageObj_GetType(obj) !== 1 ||
            change.text.length > 10000 ||
            /[\r\n\u0000]/.test(change.text)
          )
            throw new Error('Dieses Werkzeug bearbeitet einzelne Textobjekte ohne neue Zeilen.');
          const font = api.FPDFTextObj_GetFont(obj);
          for (const ch of change.text) {
            if (/\s/.test(ch)) continue;
            const glyph = api.FPDFFont_GetGlyphPath(font, ch.codePointAt(0)!, 12);
            if (!glyph)
              throw new Error(
                `Die Originalschrift enthält das Zeichen „${ch}“ nicht. Nutze dafür „Text bearbeiten“ mit einer Ersatzschrift.`,
              );
          }
          const size = (change.text.length + 1) * 2,
            p = ctx.alloc(size);
          try {
            api.pdfium.stringToUTF16(change.text, p, size);
            if (!api.FPDFText_SetText(obj, p))
              throw new Error('Der Text konnte mit der Originalschrift nicht ersetzt werden.');
          } finally {
            ctx.free(p);
          }
        }
        const transform = change.transform || changeMatrix(ctx, page, obj, change);
        if (transform) {
          if (
            transform.length !== 6 ||
            !transform.every((n) => Number.isFinite(n) && Math.abs(n) < 1e12)
          )
            throw new Error('Ungültige Objekttransformation.');
          api.FPDFPageObj_Transform(obj, ...transform);
        }
      }
      if (!api.FPDFPage_GenerateContent(page))
        throw new Error('Die bearbeitete Seite konnte nicht aufgebaut werden.');
      return saved(ctx);
    } finally {
      api.FPDF_ClosePage(page);
    }
  });
}
/** Resolve transformations before extracting nested content into a temporary page. */
export function scopedNativeChanges(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  path: number[],
  changes: NativeChange[],
): NativeChange[] {
  return open(api, bytes, (ctx) => {
    const page = pageHandle(ctx, index);
    try {
      const scope = formScope(ctx, page, path),
        inv = inverse(scope.matrix);
      const count = api.FPDFFormObj_CountObjects(scope.container);
      const handles = Array.from({ length: count }, (_, i) =>
          api.FPDFFormObj_GetObject(scope.container, i),
        ),
        members = clusterMembers(ctx, handles);
      return changes.map((change) => {
        if (!Number.isInteger(change.index) || change.index < 0 || change.index >= count)
          throw new Error('Ungültiges Gruppenobjekt.');
        const obj = api.FPDFFormObj_GetObject(scope.container, change.index);
        const transform = changeMatrix(
          ctx,
          page,
          obj,
          change,
          scope.matrix,
          (members.get(change.index) || [change.index]).map((i) => handles[i]),
        );
        return {
          ...change,
          ...(transform ? { transform: multiply(multiply(inv, transform), scope.matrix) } : {}),
        };
      });
    } finally {
      api.FPDF_ClosePage(page);
    }
  });
}
/** A unique content mark locates exactly one invocation, including shared XObjects. */
export function markNativeObject(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  objectIndex: number,
  marker: string,
) {
  if (!/^[A-Za-z][A-Za-z0-9]{8,90}$/.test(marker)) throw new Error('Ungültige Objektmarkierung.');
  return open(api, bytes, (ctx) => {
    const page = pageHandle(ctx, index);
    try {
      requireSerializablePage(ctx, page);
      if (
        !Number.isInteger(objectIndex) ||
        objectIndex < 0 ||
        objectIndex >= api.FPDFPage_CountObjects(page)
      )
        throw new Error('Ungültiges Seitenobjekt.');
      const obj = api.FPDFPage_GetObject(page, objectIndex);
      if (![3, 5].includes(api.FPDFPageObj_GetType(obj)) || !api.FPDFPageObj_AddMark(obj, marker))
        throw new Error('Das Objekt konnte nicht für die Bearbeitung vorbereitet werden.');
      if (!api.FPDFPage_GenerateContent(page))
        throw new Error('Die Objektmarkierung konnte nicht gespeichert werden.');
      return saved(ctx);
    } finally {
      api.FPDF_ClosePage(page);
    }
  });
}
/** Disposable document: move direct children, retaining resolved inherited graphics state. */
export function extractNativeForm(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  objectIndex: number,
  outputIndex: number,
) {
  return open(api, bytes, (ctx) => {
    const page = pageHandle(ctx, index);
    let temp = 0;
    try {
      const scope = formScope(ctx, page, [objectIndex]),
        count = api.FPDFFormObj_CountObjects(scope.container);
      if (count < 0 || count > 10000) throw new Error('Die Gruppe enthält zu viele Objekte.');
      temp = pageHandle(ctx, outputIndex);
      if (!temp) throw new Error('Die Gruppe konnte nicht geöffnet werden.');
      const children = Array.from({ length: count }, (_, n) =>
        api.FPDFFormObj_GetObject(scope.container, n),
      );
      if (children.some((obj) => ![1, 2, 3, 5].includes(api.FPDFPageObj_GetType(obj))))
        throw new Error(
          'Diese Gruppe enthält einen nicht unterstützten Grafiktyp. Der Originalinhalt bleibt erhalten.',
        );
      for (const obj of children) {
        if (!api.FPDFFormObj_RemoveObject(scope.container, obj))
          throw new Error('Der Gruppeninhalt konnte nicht getrennt werden.');
        api.FPDFPage_InsertObject(temp, obj);
      }
      if (!api.FPDFPage_GenerateContent(temp))
        throw new Error('Der Gruppeninhalt konnte nicht gespeichert werden.');
      return { bytes: saved(ctx), page: outputIndex };
    } finally {
      if (temp) api.FPDF_ClosePage(temp);
      api.FPDF_ClosePage(page);
    }
  });
}
/** Copy selected vector objects into a Form XObject; preserve the page's PDF coordinate space. */
export function groupNativeObjects(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  indices: number[],
  duplicate = false,
) {
  if (!indices.length || indices.length > 500)
    throw new Error('Zum Gruppieren aufeinanderfolgende Objekte in der Zeichenreihenfolge wählen.');
  return open(api, bytes, (target) =>
    open(api, bytes, (copy) => {
      const page = pageHandle(target, index),
        temp = pageHandle(copy, index);
      let xobject = 0;
      try {
        requireSerializablePage(target, page);
        const handles = Array.from({ length: api.FPDFPage_CountObjects(page) }, (_, i) =>
          api.FPDFPage_GetObject(page, i),
        );
        const sorted = expandedIndices(target, handles, indices);
        if (!duplicate && sorted.some((id, i) => id !== sorted[0] + i))
          throw new Error(
            'Zum Gruppieren aufeinanderfolgende Objekte in der Zeichenreihenfolge wählen.',
          );
        for (let i = api.FPDFPage_CountObjects(temp) - 1; i >= 0; i--)
          if (!sorted.includes(i)) {
            const obj = api.FPDFPage_GetObject(temp, i);
            if (!api.FPDFPage_RemoveObject(temp, obj))
              throw new Error('Die Objektkopie konnte nicht vorbereitet werden.');
            api.FPDFPageObj_Destroy(obj);
          }
        const box = copy.alloc(16);
        let l = 0,
          b = 0,
          r = 0,
          t = 0;
        try {
          if (!api.FPDFPage_GetMediaBox(temp, box, box + 4, box + 8, box + 12))
            throw new Error('Ungültige Seitengröße.');
          [l, b, r, t] = [0, 4, 8, 12].map((n) => api.pdfium.getValue(box + n, 'float'));
        } finally {
          copy.free(box);
        }
        api.FPDFPage_SetCropBox(temp, l, b, r, t);
        api.FPDFPage_SetRotation(temp, 0);
        if (!api.FPDFPage_GenerateContent(temp))
          throw new Error('Die Objektkopie konnte nicht aufgebaut werden.');
        xobject = api.FPDF_NewXObjectFromPage(target.doc, copy.doc, index);
        if (!xobject) throw new Error('Die Objektgruppe konnte nicht erstellt werden.');
        const group = api.FPDF_NewFormObjectFromXObject(xobject);
        if (!group) throw new Error('Die Objektgruppe konnte nicht eingefügt werden.');
        const origin = toPdf(target, page, 0, 0),
          offset = toPdf(target, page, duplicate ? 0.02 : 0, duplicate ? 0.02 : 0);
        api.FPDFPageObj_Transform(
          group,
          1,
          0,
          0,
          1,
          l + offset[0] - origin[0],
          b + offset[1] - origin[1],
        );
        if (!duplicate)
          for (const id of sorted) {
            if (!api.FPDFPage_RemoveObject(page, handles[id])) {
              api.FPDFPageObj_Destroy(group);
              throw new Error('Ein Originalobjekt konnte nicht entfernt werden.');
            }
            api.FPDFPageObj_Destroy(handles[id]);
          }
        if (duplicate) api.FPDFPage_InsertObject(page, group);
        else if (!api.FPDFPage_InsertObjectAtIndex(page, group, sorted[0])) {
          api.FPDFPageObj_Destroy(group);
          throw new Error('Die Zeichenreihenfolge konnte nicht erhalten werden.');
        }
        if (!api.FPDFPage_GenerateContent(page))
          throw new Error('Die Objektgruppe konnte nicht gespeichert werden.');
        return saved(target);
      } finally {
        if (xobject) api.FPDF_CloseXObject(xobject);
        api.FPDF_ClosePage(temp);
        api.FPDF_ClosePage(page);
      }
    }),
  );
}
/** Shape Unicode text with measured glyph advances before changing the PDF. */
export async function replaceNativeParagraph(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  settings: NativeParagraph,
): Promise<NativeParagraphResult> {
  const { rect: r, indices, padding, lineHeight, align } = settings;
  if (!indices.length || indices.length > 500 || new Set(indices).size !== indices.length)
    throw new Error('Bitte 1 bis 500 unterschiedliche Textobjekte auswählen.');
  if (
    ![r.x, r.y, r.w, r.h, padding, lineHeight].every(Number.isFinite) ||
    r.x < 0 ||
    r.y < 0 ||
    r.w <= 0 ||
    r.h <= 0 ||
    r.x + r.w > 1.00001 ||
    r.y + r.h > 1.00001 ||
    padding < 0 ||
    padding > 72 ||
    lineHeight < 1 ||
    lineHeight > 3 ||
    !['left', 'center', 'right'].includes(align)
  )
    throw new Error('Bitte Textbereich, Schriftgröße, Abstand und Farbe prüfen.');
  const text = settings.text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  if (!text.trim() || text.length > 20000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))
    throw new Error('Bitte 1 bis 20.000 Zeichen ohne Steuerzeichen eingeben.');
  if (!['auto', 'ltr', 'rtl'].includes(settings.direction || 'auto'))
    throw new Error('Ungültige Schreibrichtung.');
  if (/[\u202a-\u202e\u2066-\u2069]/u.test(text))
    throw new Error(
      'Explizite Richtungssteuerzeichen bitte entfernen und die Schreibrichtung auswählen.',
    );
  const embedding = bidi.getEmbeddingLevels(
    text,
    settings.direction === 'auto' ? undefined : settings.direction,
  );
  type Glyph = { id: number; codePoints: number[]; width?: number };
  const glyphKey = (glyph: Glyph) =>
    glyph.id + ':' + glyph.codePoints.join(',') + ':' + (glyph.width ?? 'visual');
  type Position = { xAdvance: number; yAdvance: number; xOffset: number; yOffset: number };
  type Face = {
    unitsPerEm: number;
    ascent: number;
    descent: number;
    characterSet: number[];
    variationAxes?: object;
    glyphForCodePoint: (codePoint: number) => { id: number };
    layout: (
      text: string,
      features?: string[],
      script?: string,
      language?: string,
      direction?: string,
    ) => { direction: string; glyphs: Glyph[]; positions: Position[] };
  };
  type Font = {
    bytes: Uint8Array;
    face: Face;
    cids: Map<string, { cid: number; glyph: Glyph }>;
    handle: number;
    shaping: hb.Font;
    cmapName: string;
  };
  type Style = { font: Font; size: number; color: string; shift: number };
  const fonts: Font[] = [];
  const getStyle = (fontBytes: Uint8Array, size: number, color: string, shift = 0): Style => {
    if (!Number.isFinite(shift) || Math.abs(shift) > 72)
      throw new Error('Ungültige Grundlinienverschiebung.');
    if (!Number.isFinite(size) || size < 6 || size > 144 || !/^#[0-9a-f]{6}$/i.test(color))
      throw new Error('Bitte Schriftgröße und Farbe prüfen.');
    let font = fonts.find((f) => f.bytes === fontBytes);
    if (!font) {
      if (
        fontBytes.length < 12 ||
        fontBytes.length > 10 * 1024 * 1024 ||
        new DataView(fontBytes.buffer, fontBytes.byteOffset, fontBytes.byteLength).getUint32(0) !==
          0x00010000
      )
        throw new Error('Bitte eine einzelne TrueType-Schrift (.ttf), höchstens 10 MB, verwenden.');
      let face: Face;
      try {
        face = fontkit.create(fontBytes) as unknown as Face;
      } catch {
        throw new Error('Die TrueType-Schrift ist nicht lesbar.');
      }
      if (
        !face.characterSet ||
        Object.keys(face.variationAxes || {}).length ||
        ![face.unitsPerEm, face.ascent, face.descent].every(Number.isFinite) ||
        face.unitsPerEm <= 0 ||
        face.ascent <= 0
      )
        throw new Error(
          'Bitte eine statische TrueType-Schrift mit gültigen Schriftmaßen verwenden.',
        );
      const shapingFace = new hb.Face(new hb.Blob(fontBytes.slice().buffer));
      const shaping = new hb.Font(shapingFace);
      shaping.setScale(face.unitsPerEm, face.unitsPerEm);
      font = {
        bytes: fontBytes,
        face,
        cids: new Map(),
        handle: 0,
        shaping,
        cmapName: 'MoinParagraph' + nativeMarkerId(),
      };
      fonts.push(font);
      if (fonts.reduce((n, f) => n + f.bytes.length, 0) > 40 * 1024 * 1024)
        throw new Error('Die Absatzschriften dürfen zusammen höchstens 40 MB groß sein.');
    }
    return { font, size, color, shift };
  };
  const base = getStyle(settings.fontBytes, settings.fontSize, settings.color);
  const ranges = [...(settings.styles || [])].sort((a, b) => a.from - b.from);
  if (ranges.length > 32 || (ranges.length && text !== settings.text))
    throw new Error(
      'Bitte höchstens 32 Formatierungen auf Text ohne Tabulatoren oder CR-Zeilenenden anwenden.',
    );
  const graphemes = Array.from(new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(text)),
    boundaries = new Set([0, text.length, ...graphemes.map((g) => g.index)]);
  let last = 0;
  const styled = ranges.map((range) => {
    if (
      !Number.isInteger(range.from) ||
      !Number.isInteger(range.to) ||
      range.from < last ||
      range.to <= range.from ||
      !boundaries.has(range.from) ||
      !boundaries.has(range.to)
    )
      throw new Error(
        'Formatierungen dürfen sich nicht überschneiden und keine Zeichenfolge teilen.',
      );
    last = range.to;
    return {
      ...range,
      style: getStyle(
        range.fontBytes || settings.fontBytes,
        range.fontSize,
        range.color,
        range.baselineShift,
      ),
    };
  });
  const scriptDefinitions = [
    ['Latin', 'Latn'],
    ['Greek', 'Grek'],
    ['Cyrillic', 'Cyrl'],
    ['Arabic', 'Arab'],
    ['Hebrew', 'Hebr'],
    ['Devanagari', 'Deva'],
    ['Bengali', 'Beng'],
    ['Gujarati', 'Gujr'],
    ['Gurmukhi', 'Guru'],
    ['Kannada', 'Knda'],
    ['Malayalam', 'Mlym'],
    ['Oriya', 'Orya'],
    ['Tamil', 'Taml'],
    ['Telugu', 'Telu'],
    ['Thai', 'Thai'],
    ['Lao', 'Laoo'],
    ['Khmer', 'Khmr'],
    ['Myanmar', 'Mymr'],
    ['Sinhala', 'Sinh'],
    ['Tibetan', 'Tibt'],
    ['Han', 'Hani'],
    ['Hangul', 'Hang'],
    ['Hiragana', 'Hira'],
    ['Katakana', 'Kana'],
  ].map(([name, tag]) => ({ tag, test: new RegExp('\\p{Script=' + name + '}', 'u') }));
  type Part = { text: string; style: Style; start: number; script?: string; level: number };
  const covers = (style: Style, value: string) =>
    Array.from(value).every(
      (ch) =>
        ch === '\n' ||
        /\p{Cf}/u.test(ch) ||
        style.font.face.characterSet.includes(ch.codePointAt(0)!),
    );
  if ((settings.fallbackFonts?.length || 0) > 16)
    throw new Error('Bitte höchstens 16 Ersatzschriften verwenden.');
  const fallbackStyles = new Map<Style, Style[]>();
  const pieces: Part[] = graphemes.map((g) => {
    let style = styled.find((s) => g.index >= s.from && g.index < s.to)?.style || base;
    if (!covers(style, g.segment)) {
      let candidates = fallbackStyles.get(style);
      if (!candidates) {
        candidates = (settings.fallbackFonts || []).map((bytes) =>
          getStyle(bytes, style.size, style.color, style.shift),
        );
        fallbackStyles.set(style, candidates);
      }
      const fallback = candidates.find((candidate) => covers(candidate, g.segment));
      if (!fallback)
        throw new Error(
          `Die gewählte Schrift enthält das Zeichen „${g.segment}“ nicht. Bitte eine passende TrueType-Schrift wählen.`,
        );
      style = fallback;
    }
    return {
      text: g.segment,
      start: g.index,
      level: embedding.levels[g.index],
      script: scriptDefinitions.find((definition) => definition.test.test(g.segment))?.tag,
      style,
    };
  });
  // Common characters belong to an adjacent script, without merging two strong scripts.
  for (let i = 0; i < pieces.length; i++) {
    if (!pieces[i].script && pieces[i].text !== '\n')
      pieces[i].script =
        (i && pieces[i - 1].text !== '\n' ? pieces[i - 1].script : undefined) ||
        pieces.slice(i + 1).find((p) => p.script || p.text === '\n')?.script;
  }
  const shapingBuffer = new hb.Buffer();
  const shape = (parts: Part[]) => {
    if (!parts.length) return [];
    const start = parts[0].start,
      end = parts.at(-1)!.start + parts.at(-1)!.text.length - 1;
    const visual = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    for (const [a, b] of bidi.getReorderSegments(text, embedding, start, end))
      visual.splice(a - start, b - a + 1, ...visual.slice(a - start, b - start + 1).reverse());
    const rank = new Map(visual.map((value, i) => [value, i]));
    const groups: Part[] = [];
    for (const p of parts) {
      const prev = groups.at(-1);
      if (
        prev?.style === p.style &&
        prev.level === p.level &&
        (!prev.script || !p.script || prev.script === p.script)
      ) {
        prev.text += p.text;
        prev.script ||= p.script;
      } else groups.push({ ...p });
    }
    return groups
      .sort((a, b) => rank.get(a.start)! - rank.get(b.start)!)
      .map((p) => {
        const rtl = !!(p.level & 1);
        shapingBuffer.reset();
        shapingBuffer.addText(p.text);
        shapingBuffer.setClusterLevel(hb.ClusterLevel.MONOTONE_GRAPHEMES);
        shapingBuffer.setDirection(rtl ? hb.Direction.RTL : hb.Direction.LTR);
        if (p.script) shapingBuffer.setScript(p.script);
        shapingBuffer.guessSegmentProperties();
        hb.shape(p.style.font.shaping, shapingBuffer);
        const infos = shapingBuffer.getGlyphInfos(),
          positions = shapingBuffer.getGlyphPositions();
        const clusters = [...new Set(infos.map((g) => g.cluster))].sort((a, b) => a - b);
        const clusterEnd = new Map(clusters.map((c, i) => [c, clusters[i + 1] ?? p.text.length]));
        const glyphs: Glyph[] = infos.map((g) => {
          const original = p.text.slice(g.cluster, clusterEnd.get(g.cluster));
          if (!g.codepoint && !/^[\p{Cf}\s]*$/u.test(original))
            throw new Error('Die Schrift kann diese Zeichenfolge nicht vollständig darstellen.');
          return { id: g.codepoint, codePoints: [0x200b] };
        });
        const records = clusters.map((cluster) => ({
          text: p.text.slice(cluster, clusterEnd.get(cluster)),
          ids: infos.flatMap((g, i) => (g.cluster === cluster ? [i] : [])),
        }));
        for (let i = 0; i < records.length - 1; i++) {
          if (!/^[\p{Cf}]+$/u.test(records[i].text)) continue;
          records[i + 1].text = records[i].text + records[i + 1].text;
          records[i + 1].ids.push(...records[i].ids);
          records.splice(i--, 1);
        }
        const logical = records
          .map((record) => {
            const ids = record.ids.sort((a, b) => a - b),
              advance = ids.reduce((n, i) => n + positions[i].xAdvance, 0);
            const tokens: string[] = [];
            let prefix = '';
            for (const ch of record.text) {
              if (/\p{Cf}/u.test(ch)) {
                if (tokens.length && /\p{Mn}/u.test(tokens.at(-1)!))
                  tokens[tokens.length - 1] += ch;
                else prefix += ch;
              } else {
                tokens.push(prefix + ch);
                prefix = '';
              }
            }
            // A trailing standalone format control must not hide the preceding visible scalar.
            if (prefix) tokens.push(prefix);
            if (rtl) tokens.reverse();
            const carrier = tokens.findIndex(
              (ch) => !/\p{Mn}/u.test(ch) && !/^[\p{Cf}]*$/u.test(ch),
            );
            return {
              first: ids[0],
              last: ids.at(-1)!,
              advance,
              text: record.text,
              glyphs: tokens.map((ch, i): Glyph => ({
                id: 0,
                codePoints: Array.from(ch, (c) => c.codePointAt(0)!),
                width:
                  i === carrier
                    ? (advance * 1000 * p.style.size) / (p.style.font.face.unitsPerEm * base.size)
                    : 0,
              })),
            };
          })
          .sort((a, b) => a.first - b.first);
        const run = { glyphs, positions },
          factor = p.style.size / p.style.font.face.unitsPerEm;
        if (
          glyphs.length !== positions.length ||
          positions.some(
            (pos) => ![pos.xAdvance, pos.yAdvance, pos.xOffset, pos.yOffset].every(Number.isFinite),
          )
        )
          throw new Error(
            'Die Zeichenformung der gewählten Schrift kann nicht zuverlässig gesetzt werden.',
          );
        return {
          ...p,
          clusters: clusters.map((c) => c + p.start),
          run,
          logical,
          factor,
          width: run.positions.reduce((n, pos) => n + pos.xAdvance * factor, 0),
        };
      });
  };
  // Validate formatting before it can interrupt a conjunct that Intl grapheme boundaries split.
  const unstyledFonts = new Map<Font, Style>();
  const unstyled = pieces.map((part) => {
    const font = fonts.find((f) => covers({ ...base, font: f }, part.text)) || part.style.font;
    let style = unstyledFonts.get(font);
    if (!style) {
      style = { ...base, font };
      unstyledFonts.set(font, style);
    }
    return { ...part, style };
  });
  const formatBoundaries = new Set<number>([0, text.length]);
  let unstyledParagraph: Part[] = [];
  for (const part of [...unstyled, { text: '\n', start: text.length, style: base, level: 0 }]) {
    if (part.text !== '\n') {
      unstyledParagraph.push(part);
      continue;
    }
    for (const group of shape(unstyledParagraph))
      for (const start of group.clusters) formatBoundaries.add(start);
    formatBoundaries.add(part.start);
    formatBoundaries.add(part.start + 1);
    unstyledParagraph = [];
  }
  if (ranges.some((range) => !formatBoundaries.has(range.from) || !formatBoundaries.has(range.to)))
    throw new Error('Formatierungen dürfen keine geformte Zeichenfolge teilen.');
  const result = open(api, bytes, (ctx) => {
    const first = pageHandle(ctx, index),
      opened = [first],
      pending: {
        page: number;
        objects: number[];
        semantics: { obj: number; start: number }[];
        marker: string;
        text: string;
        runs: { marker: string; text: string }[];
      }[] = [];
    try {
      requireSerializablePage(ctx, first);
      const all = Array.from({ length: api.FPDFPage_CountObjects(first) }, (_, i) =>
        api.FPDFPage_GetObject(first, i),
      );
      const handles = expandedIndices(ctx, all, indices).map((id) => all[id]);
      if (handles.some((obj) => !obj || api.FPDFPageObj_GetType(obj) !== 1))
        throw new Error(
          'Die Auswahl enthält ein ungültiges Objekt. Bitte ausschließlich Text auswählen.',
        );
      const origin = toPdf(ctx, first, 0, 0),
        right = toPdf(ctx, first, 1, 0),
        bottom = toPdf(ctx, first, 0, 1);
      const width = Math.hypot(right[0] - origin[0], right[1] - origin[1]),
        height = Math.hypot(bottom[0] - origin[0], bottom[1] - origin[1]);
      const available = r.w * width - 2 * padding,
        vertical = r.h * height - 2 * padding;
      if (available <= 0 || vertical <= 0)
        throw new Error('Der Textbereich ist kleiner als sein Innenabstand.');
      const safeBreaks = new Set<number>([0, text.length]);
      let paragraph: Part[] = [];
      for (const part of [...pieces, { text: '\n', start: text.length, style: base, level: 0 }]) {
        if (part.text !== '\n') {
          paragraph.push(part);
          continue;
        }
        for (const group of shape(paragraph))
          for (const start of group.clusters) safeBreaks.add(start);
        safeBreaks.add(part.start);
        safeBreaks.add(part.start + 1);
        paragraph = [];
      }
      const atoms: Part[][] = [];
      for (const part of pieces) {
        if (!atoms.length || safeBreaks.has(part.start)) atoms.push([part]);
        else atoms.at(-1)!.push(part);
      }
      const wordBreaks = new Set(
        Array.from(
          new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text),
          (s) => s.index,
        ),
      );
      const lines: ReturnType<typeof shape>[] = [];
      let current: Part[] = [];
      const measure = (p: Part[]) => shape(p).reduce((n, g) => n + g.width, 0);
      const flush = () => {
        while (current.length && /^\s+$/u.test(current.at(-1)!.text)) current.pop();
        lines.push(shape(current));
        current = [];
      };
      const words: Part[][] = [];
      let word: Part[] = [];
      for (const atom of atoms) {
        if (wordBreaks.has(atom[0].start) || /^\s$/u.test(atom[0].text)) {
          if (word.length) words.push(word);
          word = [];
        }
        if (/^\s$/u.test(atom[0].text)) words.push(atom);
        else word.push(...atom);
      }
      if (word.length) words.push(word);
      for (const token of words) {
        if (token[0].text === '\n') {
          flush();
          continue;
        }
        if (!current.length && token.every((p) => /^\s+$/u.test(p.text))) continue;
        if (measure([...current, ...token]) <= available + 0.001) {
          current.push(...token);
          continue;
        }
        if (current.length) flush();
        if (token.every((p) => /^\s+$/u.test(p.text))) continue;
        if (measure(token) <= available + 0.001) {
          current = token.slice();
          continue;
        }
        for (const atom of atoms.filter(
          (a) => a[0].start >= token[0].start && a[0].start <= token.at(-1)!.start,
        )) {
          if (measure(atom) > available + 0.001)
            throw new Error('Der Textbereich ist schmaler als eine einzelne Zeichenfolge.');
          if (current.length && measure([...current, ...atom]) > available + 0.001) flush();
          current.push(...atom);
        }
      }
      if (current.length || text.endsWith('\n')) flush();
      const layout: {
        groups: ReturnType<typeof shape>;
        page: number;
        top: number;
        ascent: number;
        width: number;
      }[] = [];
      let pageNo = 0,
        top = 0,
        used = 0;
      for (const groups of lines) {
        const styles = groups.length ? groups.map((g) => g.style) : [base];
        const ascent = Math.max(
            ...styles.map((s) => (s.font.face.ascent * s.size) / s.font.face.unitsPerEm + s.shift),
          ),
          descent = Math.max(
            ...styles.map(
              (s) => (Math.abs(s.font.face.descent) * s.size) / s.font.face.unitsPerEm - s.shift,
            ),
          );
        const advance = Math.max(ascent + descent, ...styles.map((s) => s.size * lineHeight));
        if (ascent + descent > vertical + 0.01)
          throw new Error('Textüberlauf: Eine Zeile ist höher als der Textbereich.');
        if (top + ascent + descent > vertical + 0.01) {
          if (!settings.flow)
            throw new Error(
              `Textüberlauf: ${lines.length} Zeilen passen nicht in den Bereich. Bereich vergrößern oder neue Folgeseiten zulassen.`,
            );
          pageNo++;
          top = 0;
        }
        if (pageNo >= 20) throw new Error('Der Absatz würde mehr als 20 Seiten benötigen.');
        layout.push({
          groups,
          page: pageNo,
          top,
          ascent,
          width: groups.reduce((n, g) => n + g.width, 0),
        });
        used = Math.max(used, top + ascent + descent + 2 * padding);
        top += advance;
        for (const g of groups) {
          for (const glyph of g.run.glyphs) {
            const key = glyphKey(glyph);
            if (!g.style.font.cids.has(key))
              g.style.font.cids.set(key, { cid: g.style.font.cids.size + 1, glyph });
          }
          for (const glyph of g.logical.flatMap((l) => l.glyphs)) {
            const key = glyphKey(glyph);
            if (!base.font.cids.has(key))
              base.font.cids.set(key, { cid: base.font.cids.size + 1, glyph });
          }
        }
      }
      for (const f of fonts) {
        if (!f.cids.size) continue;
        const values = [...f.cids.values()],
          map = new Uint8Array((values.length + 1) * 2);
        const sections: string[] = [];
        for (let offset = 0; offset < values.length; offset += 100) {
          const part = values.slice(offset, offset + 100);
          sections.push(
            part.length +
              ' beginbfchar\n' +
              part
                .map(({ cid, glyph }) => {
                  map[cid * 2] = glyph.id >> 8;
                  map[cid * 2 + 1] = glyph.id & 255;
                  const unicode = String.fromCodePoint(...glyph.codePoints)
                    .split('')
                    .map((ch) => ch.charCodeAt(0).toString(16).padStart(4, '0'))
                    .join('');
                  return '<' + cid.toString(16).padStart(4, '0') + '> <' + unicode + '>';
                })
                .join('\n') +
              '\nendbfchar',
          );
        }
        const cmap =
          '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /' +
          f.cmapName +
          ' def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n' +
          sections.join('\n') +
          '\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
        const fp = ctx.alloc(f.bytes.length),
          mp = ctx.alloc(map.length);
        try {
          heap(api).set(f.bytes, fp);
          heap(api).set(map, mp);
          f.handle = api.FPDFText_LoadCidType2Font(
            ctx.doc,
            fp,
            f.bytes.length,
            cmap,
            mp,
            map.length,
          );
        } finally {
          ctx.free(fp);
          ctx.free(mp);
        }
        if (!f.handle) throw new Error('Die geformte Schrift konnte nicht eingebettet werden.');
      }
      for (let n = 1; n <= pageNo; n++) {
        const page = api.FPDFPage_New(ctx.doc, index + n, width, height);
        if (!page) throw new Error('Eine Folgeseite konnte nicht erzeugt werden.');
        opened.push(page);
      }
      for (const page of opened)
        pending.push({
          page,
          objects: [],
          semantics: [],
          marker: 'MoinCluster' + nativeMarkerId(),
          text: '',
          runs: [],
        });
      for (const line of layout) {
        const target = pending[line.page],
          page = target.page,
          o = toPdf(ctx, page, 0, 0),
          rr = toPdf(ctx, page, 1, 0),
          bb = toPdf(ctx, page, 0, 1),
          u = [rr[0] - o[0], rr[1] - o[1]],
          v = [bb[0] - o[0], bb[1] - o[1]];
        if (target.text) target.text += '\n';
        target.text += [...line.groups]
          .sort((a, b) => a.start - b.start)
          .map((g) => g.text)
          .join('');
        let x =
          padding +
          (align === 'right'
            ? available - line.width
            : align === 'center'
              ? (available - line.width) / 2
              : 0);
        const semanticSegments = new Map<number, { start: number; marker: string; text: string }>();
        let segment: { start: number; marker: string; text: string } | undefined,
          previousLevel = -1;
        const minimumLevel = Math.min(...line.groups.map((g) => g.level));
        for (const group of [...line.groups].sort((a, b) => a.start - b.start)) {
          const level = minimumLevel & 1 ? 1 : Math.min(1, group.level);
          if (!segment || level !== previousLevel) {
            segment = {
              start: group.start,
              marker: target.marker + 'Run' + nativeMarkerId(),
              text: '',
            };
            target.runs.push(segment);
          }
          segment.text += group.text;
          semanticSegments.set(group.start, segment);
          previousLevel = level;
        }
        for (const group of line.groups) {
          const channels = [1, 3, 5].map((j) => parseInt(group.style.color.slice(j, j + 2), 16));
          let clusterStart = x,
            marker = '';
          const segment = semanticSegments.get(group.start)!;
          const runMarker = segment.marker;
          for (let j = 0; j < group.run.glyphs.length; j++) {
            const glyph = group.run.glyphs[j],
              pos = group.run.positions[j],
              obj = api.FPDFPageObj_CreateTextObj(
                ctx.doc,
                group.style.font.handle,
                group.style.size,
              );
            if (!obj) throw new Error('Ein Textzeichen konnte nicht erstellt werden.');
            target.objects.push(obj);
            const logical = group.logical.find((l) => j >= l.first && j <= l.last)!;
            if (j === logical.first) {
              clusterStart = x;
              marker = target.marker;
            }
            if (!api.FPDFPageObj_AddMark(obj, marker))
              throw new Error('Die Zeichenfolge konnte nicht markiert werden.');
            const cp = ctx.alloc(4);
            try {
              api.pdfium.setValue(cp, group.style.font.cids.get(glyphKey(glyph))!.cid, 'i32');
              if (!api.FPDFText_SetCharcodes(obj, cp, 1))
                throw new Error('Ein Textzeichen konnte nicht gesetzt werden.');
            } finally {
              ctx.free(cp);
            }
            const nx = r.x + (x + pos.xOffset * group.factor) / width,
              ny =
                r.y +
                (padding +
                  line.top +
                  line.ascent -
                  group.style.shift -
                  pos.yOffset * group.factor) /
                  height;
            api.FPDFPageObj_Transform(
              obj,
              u[0] / width,
              u[1] / width,
              -v[0] / height,
              -v[1] / height,
              o[0] + u[0] * nx + v[0] * ny,
              o[1] + u[1] * nx + v[1] * ny,
            );
            if (!api.FPDFPageObj_SetFillColor(obj, channels[0], channels[1], channels[2], 255))
              throw new Error('Die Textfarbe konnte nicht gesetzt werden.');
            const bounds = objectRect(ctx, page, obj);
            if (
              bounds &&
              bounds.w > 0 &&
              bounds.h > 0 &&
              (bounds.x < r.x - 0.0002 ||
                bounds.y < r.y - 0.0002 ||
                bounds.x + bounds.w > r.x + r.w + 0.0002 ||
                bounds.y + bounds.h > r.y + r.h + 0.0002)
            )
              throw new Error(
                'Die tatsächlichen Schriftkonturen ragen über den Textbereich. Innenabstand oder Bereich vergrößern.',
              );
            x += pos.xAdvance * group.factor;
            if (j === logical.last) {
              const semantic = api.FPDFPageObj_CreateTextObj(ctx.doc, base.font.handle, base.size);
              if (!semantic) throw new Error('Der logische Text konnte nicht erstellt werden.');
              target.semantics.push({ obj: semantic, start: segment.start });
              const codes = ctx.alloc(logical.glyphs.length * 4);
              try {
                logical.glyphs.forEach((g, i) =>
                  api.pdfium.setValue(codes + 4 * i, base.font.cids.get(glyphKey(g))!.cid, 'i32'),
                );
                if (
                  !api.FPDFText_SetCharcodes(semantic, codes, logical.glyphs.length) ||
                  !api.FPDFTextObj_SetTextRenderMode(semantic, 3) ||
                  !api.FPDFPageObj_AddMark(semantic, runMarker)
                )
                  throw new Error('Der logische Text konnte nicht gesetzt werden.');
              } finally {
                ctx.free(codes);
              }
              const sx = r.x + clusterStart / width,
                sy = r.y + (padding + line.top + line.ascent - group.style.shift) / height;
              api.FPDFPageObj_Transform(
                semantic,
                u[0] / width,
                u[1] / width,
                -v[0] / height,
                -v[1] / height,
                o[0] + u[0] * sx + v[0] * sy,
                o[1] + u[1] * sx + v[1] * sy,
              );
            }
          }
        }
      }
      for (const obj of handles) {
        if (!api.FPDFPage_RemoveObject(first, obj))
          throw new Error('Ein Originaltext konnte nicht entfernt werden.');
        api.FPDFPageObj_Destroy(obj);
      }
      for (const target of pending) {
        target.objects.push(
          ...target.semantics.sort((a, b) => a.start - b.start).map((s) => s.obj),
        );
        target.semantics.length = 0;
        while (target.objects.length)
          api.FPDFPage_InsertObject(target.page, target.objects.shift()!);
        if (!api.FPDFPage_GenerateContent(target.page))
          throw new Error('Der Absatz konnte nicht gespeichert werden.');
      }
      return {
        bytes: saved(ctx),
        lines: lines.length,
        height: used,
        addedPages: pageNo,
        marks: pending.map((t, n) => ({
          page: index + n,
          marker: t.marker,
          text: t.text,
          runs: t.runs,
        })),
      };
    } finally {
      for (const t of pending)
        for (const obj of [...t.objects, ...t.semantics.map((s) => s.obj)])
          api.FPDFPageObj_Destroy(obj);
      for (const page of opened) api.FPDF_ClosePage(page);
      for (const font of fonts) if (font.handle) api.FPDFFont_Close(font.handle);
    }
  });
  // Each visual glyph has its own matrix. Logical scalar widths describe the entire cluster
  // for selection/search, independently of reordered glyph outlines and combining marks.
  const document = await PDFDocument.load(result.bytes);
  const name = PDFName.of;
  let matched = 0;
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (
      !(object instanceof PDFDict) ||
      object.lookupMaybe(name('Subtype'), PDFName) !== name('Type0')
    )
      continue;
    const cmap = object.lookup(name('ToUnicode'));
    if (!(cmap instanceof PDFRawStream)) continue;
    const text = new TextDecoder().decode(decodePDFRawStream(cmap).decode());
    const font = fonts.find((f) => text.includes('/' + f.cmapName + ' '));
    if (!font) continue;
    const descendant = object.lookup(name('DescendantFonts'), PDFArray).lookup(0, PDFDict);
    const combined = document.context.obj([]);
    // Remove visual widths too: they carry only an invisible formatting marker.
    for (const { cid, glyph } of font.cids.values()) {
      combined.push(document.context.obj(cid));
      combined.push(document.context.obj([glyph.width ?? 0]));
    }
    descendant.set(name('W'), combined);
    matched++;
  }
  if (matched !== fonts.filter((f) => f.cids.size).length)
    throw new Error('Die logischen Zeichenbreiten konnten nicht gespeichert werden.');
  for (const mark of result.marks) {
    const textHex = (value: string) =>
      Array.from({ length: value.length }, (_, i) =>
        value.charCodeAt(i).toString(16).padStart(4, '0'),
      ).join('');
    const page = document.getPage(mark.page),
      contents = page.node.Contents();
    const streams =
      contents instanceof PDFArray
        ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i, PDFRawStream))
        : contents
          ? [contents as PDFRawStream]
          : [];
    const source = streams
      .map((stream) => {
        const data = decodePDFRawStream(stream).decode();
        let value = '';
        for (let i = 0; i < data.length; i += 8192)
          value += String.fromCharCode(...data.subarray(i, i + 8192));
        return value;
      })
      .join('\n');
    const pattern = new RegExp(
      '/' + mark.marker + '(?:Run[a-f0-9]{32})?\\s+BMC([\\s\\S]*?)\\bEMC',
      'g',
    );
    const spans = [...source.matchAll(pattern)];
    if (!spans.length) throw new Error('Die Absatzmarkierung konnte nicht gespeichert werden.');
    const first = spans[0].index!,
      last = spans.at(-1)!,
      end = last.index! + last[0].length;
    let inner = source.slice(first, end);
    const visualPattern = new RegExp('/' + mark.marker + '\\s+BMC([\\s\\S]*?)\\bEMC', 'g');
    inner = inner.replace(visualPattern, '$1');
    for (const run of mark.runs) {
      const runPattern = new RegExp('/' + run.marker + '\\s+BMC([\\s\\S]*?)\\bEMC', 'g'),
        parts = [...inner.matchAll(runPattern)];
      if (!parts.length) continue;
      const start = parts[0].index!,
        last = parts.at(-1)!,
        finish = last.index! + last[0].length;
      inner =
        inner.slice(0, start) +
        '/' +
        run.marker +
        ' << /ActualText <FEFF' +
        textHex(run.text) +
        '> >> BDC\n' +
        inner.slice(start, finish).replace(runPattern, '$1') +
        '\nEMC' +
        inner.slice(finish);
    }
    const hex = textHex(mark.text);
    const semanticStart = inner.search(new RegExp('/' + mark.marker + 'Run[a-f0-9]{32}\\b'));
    if (semanticStart < 0) throw new Error('Der logische Absatz konnte nicht zugeordnet werden.');
    // ActualText belongs to each logical line/direction segment. A page-wide
    // value maps line breaks onto glyphs and corrupts extraction in some readers.
    const normalized =
      source.slice(0, first) +
      '/' +
      mark.marker +
      ' << /MoinTextHex (' +
      hex +
      ') >> BDC\n/Span << /ActualText <> >> BDC\n' +
      inner.slice(0, semanticStart) +
      '\nEMC\n' +
      inner.slice(semanticStart) +
      '\nEMC' +
      source.slice(end);
    page.node.set(
      name('Contents'),
      document.context.register(
        document.context.flateStream(Uint8Array.from(normalized, (ch) => ch.charCodeAt(0))),
      ),
    );
  }
  return {
    lines: result.lines,
    height: result.height,
    addedPages: result.addedPages,
    bytes: await document.save(),
  };
}

export function removeNativeRegions(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  removals: NativeRemoval[],
) {
  if (!removals.length || removals.length > 2000)
    throw new Error('Bitte 1 bis 2.000 Bereiche auswählen.');
  return open(api, bytes, (ctx) => {
    // Text editing must not redact intersecting pictures, rules or backgrounds.
    // Remove whole text objects only; partial or ambiguous objects fail closed.
    const textPages = new Map<number, NativeRect[]>();
    for (const removal of removals.filter((r) => r.textOnly && !r.textSlice)) {
      const r = removal.rect;
      if (!validRemovalRect(r)) throw new Error('Ungültiger Löschbereich.');
      const rects = textPages.get(removal.page) || [];
      rects.push(r);
      textPages.set(removal.page, rects);
    }
    for (const [index, rects] of textPages) {
      const page = pageHandle(ctx, index);
      try {
        requireSerializablePage(ctx, page);
        const selected: number[] = [];
        for (let i = 0; i < api.FPDFPage_CountObjects(page); i++) {
          const obj = api.FPDFPage_GetObject(page, i),
            type = api.FPDFPageObj_GetType(obj),
            bounds = objectRect(ctx, page, obj);
          if (!bounds) throw new Error('Die Objektposition ist nicht lesbar.');
          if (!rects.some((r) => overlapsRemoval(bounds, r))) continue;
          if (type === 5 || clusterMark(ctx, obj))
            throw new Error('Der Text ist Teil einer komplexen Objektgruppe.');
          if (type !== 1) continue;
          const mode = api.FPDFTextObj_GetTextRenderMode(obj);
          if (mode < 0 || mode >= 3 || !rects.some((r) => containsRemoval(r, bounds)))
            throw new Error('Das Textobjekt kann nicht eindeutig und vollständig entfernt werden.');
          selected.push(obj);
        }
        if (!selected.length) throw new Error('Keine eindeutig löschbaren Textobjekte gefunden.');
        for (const obj of selected) {
          if (!api.FPDFPage_RemoveObject(page, obj))
            throw new Error('Das Objekt konnte nicht entfernt werden.');
          api.FPDFPageObj_Destroy(obj);
        }
        if (!api.FPDFPage_GenerateContent(page))
          throw new Error('Die bereinigte Seite konnte nicht gespeichert werden.');
      } finally {
        api.FPDF_ClosePage(page);
      }
    }
    for (const removal of removals.filter((r) => r.textOnly && r.textSlice)) {
      const page = pageHandle(ctx, removal.page),
        slice = removal.textSlice!;
      let textPage = 0,
        ptr = 0;
      try {
        requireSerializablePage(ctx, page);
        if (!validRemovalRect(slice.source) || !slice.removed.trim())
          throw new Error('Ungültige Wortänderung.');
        textPage = api.FPDFText_LoadPage(page);
        ptr = ctx.alloc(32);
        const matching: number[] = [];
        for (let i = 0; i < api.FPDFPage_CountObjects(page); i++) {
          const obj = api.FPDFPage_GetObject(page, i),
            bounds = objectRect(ctx, page, obj);
          if (!bounds || !overlapsRemoval(bounds, slice.source)) continue;
          if (api.FPDFPageObj_GetType(obj) === 5 || clusterMark(ctx, obj))
            throw new Error('Wortänderung in einer Objektgruppe.');
          if (api.FPDFPageObj_GetType(obj) !== 1) continue;
          if (
            !containsRemoval(slice.source, bounds) ||
            api.FPDFTextObj_GetTextRenderMode(obj) !== 0
          )
            throw new Error('Nicht eindeutig zugeordnetes Textobjekt.');
          matching.push(obj);
        }
        if (
          matching.length !== 1 ||
          objectText(ctx, matching[0], textPage) !== slice.before + slice.removed + slice.after
        )
          throw new Error('Die ursprüngliche Zeichenfolge ist nicht eindeutig.');
        const chars: {
          text: string;
          left: number;
          right: number;
          bottom: number;
          top: number;
          start: number;
          end: number;
        }[] = [];
        let offset = 0;
        for (let i = 0; i < api.FPDFText_CountChars(textPage); i++) {
          if (
            api.FPDFText_GetTextObject(textPage, i) !== matching[0] ||
            api.FPDFText_IsGenerated(textPage, i)
          )
            continue;
          if (api.FPDFText_HasUnicodeMapError(textPage, i))
            throw new Error('Unklare Zeichenzuordnung.');
          const value = api.FPDFText_GetUnicode(textPage, i);
          if (!value || !api.FPDFText_GetCharBox(textPage, i, ptr, ptr + 8, ptr + 16, ptr + 24))
            throw new Error('Unklare Zeichenposition.');
          const text = String.fromCodePoint(value);
          chars.push({
            text,
            left: api.pdfium.getValue(ptr, 'double'),
            right: api.pdfium.getValue(ptr + 8, 'double'),
            bottom: api.pdfium.getValue(ptr + 16, 'double'),
            top: api.pdfium.getValue(ptr + 24, 'double'),
            start: offset,
            end: offset + text.length,
          });
          offset += text.length;
        }
        if (chars.map((c) => c.text).join('') !== slice.before + slice.removed + slice.after)
          throw new Error('Ligaturen oder erzeugte Zeichen verhindern die Wortänderung.');
        const selected = chars.filter(
          (c) =>
            c.start >= slice.before.length &&
            c.end <= slice.before.length + slice.removed.length &&
            !/\s/u.test(c.text),
        );
        if (!selected.length) throw new Error('Keine löschbaren Zeichen.');
        const left = Math.min(...selected.map((c) => c.left)) - 0.01,
          right = Math.max(...selected.map((c) => c.right)) + 0.01,
          bottom = Math.min(...selected.map((c) => c.bottom)) - 0.01,
          top = Math.max(...selected.map((c) => c.top)) + 0.01;
        if (
          chars.some(
            (c) =>
              !selected.includes(c) &&
              !/^\s$/u.test(c.text) &&
              c.right > left &&
              c.left < right &&
              c.top > bottom &&
              c.bottom < top,
          )
        )
          throw new Error('Die Wortänderung berührt Nachbarzeichen.');
        api.FPDFText_ClosePage(textPage);
        textPage = 0;
        [left, top, right, bottom].forEach((n, i) => api.pdfium.setValue(ptr + i * 4, n, 'float'));
        if (
          !api.EPDFText_RedactInRect(page, ptr, false, false) ||
          !api.FPDFPage_GenerateContent(page)
        )
          throw new Error('Die Zeichen konnten nicht einzeln entfernt werden.');
      } finally {
        if (textPage) api.FPDFText_ClosePage(textPage);
        if (ptr) ctx.free(ptr);
        api.FPDF_ClosePage(page);
      }
    }
    for (const removal of removals.filter((r) => !r.textOnly)) {
      const page = pageHandle(ctx, removal.page),
        r = removal.rect;
      let annotation = 0,
        ptr = 0;
      try {
        if (
          ![r.x, r.y, r.w, r.h].every(Number.isFinite) ||
          r.x < 0 ||
          r.y < 0 ||
          r.w <= 0 ||
          r.h <= 0 ||
          r.x + r.w > 1.001 ||
          r.y + r.h > 1.001
        )
          throw new Error('Ungültiger Löschbereich.');
        const clearLogical = (obj: number, depth = 0) => {
          if (depth > 16) throw new Error('Objektgruppen dürfen höchstens 16 Ebenen tief sein.');
          if (clusterMark(ctx, obj))
            for (let i = 0; i < api.FPDFPageObj_CountMarks(obj); i++)
              for (const key of ['ActualText', 'MoinTextHex'])
                api.FPDFPageObjMark_RemoveParam(obj, api.FPDFPageObj_GetMark(obj, i), key);
          if (api.FPDFPageObj_GetType(obj) === 5)
            for (let i = 0; i < api.FPDFFormObj_CountObjects(obj); i++)
              clearLogical(api.FPDFFormObj_GetObject(obj, i), depth + 1);
        };
        for (let i = 0; i < api.FPDFPage_CountObjects(page); i++)
          clearLogical(api.FPDFPage_GetObject(page, i));
        const a = toPdf(ctx, page, r.x, r.y),
          b = toPdf(ctx, page, r.x + r.w, r.y + r.h);
        ptr = ctx.alloc(16);
        [
          Math.min(a[0], b[0]),
          Math.max(a[1], b[1]),
          Math.max(a[0], b[0]),
          Math.min(a[1], b[1]),
        ].forEach((n, i) => api.pdfium.setValue(ptr + i * 4, n, 'float'));
        annotation = api.FPDFPage_CreateAnnot(page, 28);
        if (!annotation || !api.FPDFAnnot_SetRect(annotation, ptr))
          throw new Error('Der Löschbereich konnte nicht gesetzt werden.');
        const color = /^#[0-9a-f]{6}$/i.test(removal.color || '') ? removal.color! : '#000000',
          channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
        api.FPDFAnnot_SetColor(annotation, 0, channels[0], channels[1], channels[2], 255);
        if (!api.EPDFAnnot_ApplyRedaction(page, annotation))
          throw new Error('Die Inhalte konnten nicht sicher entfernt werden.');
        const cover = api.FPDFPageObj_CreateNewRect(
          Math.min(a[0], b[0]),
          Math.min(a[1], b[1]),
          Math.abs(b[0] - a[0]),
          Math.abs(b[1] - a[1]),
        );
        if (!cover) throw new Error('Die Abdeckung konnte nicht erstellt werden.');
        api.FPDFPageObj_SetFillColor(cover, channels[0], channels[1], channels[2], 255);
        api.FPDFPath_SetDrawMode(cover, 2, false);
        api.FPDFPage_InsertObject(page, cover);
        if (!api.FPDFPage_GenerateContent(page))
          throw new Error('Die bereinigte Seite konnte nicht gespeichert werden.');
      } finally {
        if (annotation) api.FPDFPage_CloseAnnot(annotation);
        if (ptr) ctx.free(ptr);
        api.FPDF_ClosePage(page);
      }
    }
    return saved(ctx);
  });
}

function validRemovalRect(r: NativeRect) {
  return (
    [r.x, r.y, r.w, r.h].every(Number.isFinite) &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.w > 0 &&
    r.h > 0 &&
    r.x + r.w <= 1.001 &&
    r.y + r.h <= 1.001
  );
}
function overlapsRemoval(a: NativeRect, b: NativeRect) {
  return (
    Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
    Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y)
  );
}
function containsRemoval(a: NativeRect, b: NativeRect) {
  // Only account for PDFium's device coordinate rounding (1 / 100000).
  const epsilon = 0.00003;
  return (
    b.x >= a.x - epsilon &&
    b.y >= a.y - epsilon &&
    b.x + b.w <= a.x + a.w + epsilon &&
    b.y + b.h <= a.y + a.h + epsilon
  );
}
