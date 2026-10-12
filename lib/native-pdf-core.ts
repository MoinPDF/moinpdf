import { init, type WrappedPdfiumModule } from '@embedpdf/pdfium';
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
const bidi = bidiFactory();

export type NativeRect = { x: number; y: number; w: number; h: number };
export type NativeObject = NativeRect & {
  index: number;
  type: 'text' | 'image' | 'path' | 'group' | 'other';
  text: string;
  fontSize: number;
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
};
export type NativeRemoval = { page: number; rect: NativeRect; color?: string };
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
function objectRect(ctx: NativeContext, page: number, obj: number) {
  const { api, alloc, free } = ctx,
    p = alloc(16);
  try {
    if (!api.FPDFPageObj_GetBounds(obj, p, p + 4, p + 8, p + 12)) return null;
    const [l, b, r, t] = [0, 4, 8, 12].map((i) => api.pdfium.getValue(p + i, 'float')),
      a = toView(ctx, page, l, b),
      z = toView(ctx, page, r, t);
    return {
      x: Math.min(a[0], z[0]),
      y: Math.min(a[1], z[1]),
      w: Math.abs(z[0] - a[0]),
      h: Math.abs(z[1] - a[1]),
      left: l,
      bottom: b,
      right: r,
      top: t,
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
    return api.pdfium.UTF16ToString(p);
  } finally {
    free(p);
  }
}
export function inspectNativeObjects(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
): NativeObject[] {
  return open(api, bytes, (ctx) => {
    const page = pageHandle(ctx, index),
      textPage = api.FPDFText_LoadPage(page),
      sizePtr = ctx.alloc(4);
    try {
      const count = api.FPDFPage_CountObjects(page);
      if (count > 10000)
        throw new Error(
          'Diese Seite enthält mehr als 10.000 Objekte. Bitte einen kleineren Ausschnitt verwenden.',
        );
      const objects: NativeObject[] = [];
      for (let i = 0; i < count; i++) {
        const obj = api.FPDFPage_GetObject(page, i),
          r = objectRect(ctx, page, obj);
        if (!r) continue;
        const type = api.FPDFPageObj_GetType(obj),
          text = type === 1 ? objectText(ctx, obj, textPage) : '';
        let fontSize = 0;
        if (type === 1 && api.FPDFTextObj_GetFontSize(obj, sizePtr))
          fontSize = api.pdfium.getValue(sizePtr, 'float');
        objects.push({
          index: i,
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
      const handles = Array.from({ length: api.FPDFPage_CountObjects(page) }, (_, i) =>
        api.FPDFPage_GetObject(page, i),
      );
      for (const change of changes) {
        if (seen.has(change.index) || !handles[change.index])
          throw new Error('Doppeltes oder ungültiges Seitenobjekt.');
        seen.add(change.index);
        const obj = handles[change.index];
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
        if (dx || dy || scale !== 1 || rotation || change.flipX || change.flipY) {
          const r = objectRect(ctx, page, obj);
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
          api.FPDFPageObj_Transform(
            obj,
            a,
            b,
            cc,
            d,
            center[0] - a * center[0] - cc * center[1] + offset[0] - origin[0],
            center[1] - b * center[0] - d * center[1] + offset[1] - origin[1],
          );
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
/** Copy selected vector objects into a Form XObject; preserve the page's PDF coordinate space. */
export function groupNativeObjects(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  indices: number[],
  duplicate = false,
) {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  if (
    !sorted.length ||
    sorted.length > 500 ||
    (!duplicate && sorted.some((id, i) => id !== sorted[0] + i))
  )
    throw new Error('Zum Gruppieren aufeinanderfolgende Objekte in der Zeichenreihenfolge wählen.');
  return open(api, bytes, (target) =>
    open(api, bytes, (copy) => {
      const page = pageHandle(target, index),
        temp = pageHandle(copy, index);
      let xobject = 0;
      try {
        const handles = Array.from({ length: api.FPDFPage_CountObjects(page) }, (_, i) =>
          api.FPDFPage_GetObject(page, i),
        );
        if (sorted.some((id) => !Number.isInteger(id) || !handles[id]))
          throw new Error('Ungültige Objektauswahl.');
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
export function replaceNativeParagraph(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  settings: NativeParagraph,
): NativeParagraphResult {
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
  if (
    Array.from(text).some((ch) => {
      const cp = ch.codePointAt(0)!;
      return (
        (cp >= 0x900 && cp <= 0x109f) ||
        (cp >= 0x1780 && cp <= 0x18af) ||
        (cp >= 0x200b && cp <= 0x200f) ||
        (cp >= 0x202a && cp <= 0x202e) ||
        (cp >= 0x2060 && cp <= 0x206f) ||
        (cp >= 0xa980 && cp <= 0xa9df) ||
        (cp >= 0xaa00 && cp <= 0xaaff)
      );
    })
  )
    throw new Error(
      'Diese komplexe Schrift oder explizite Richtungssteuerung ist noch nicht freigegeben.',
    );
  const embedding = bidi.getEmbeddingLevels(
    text,
    settings.direction === 'auto' ? undefined : settings.direction,
  );
  type Glyph = { id: number; codePoints: number[] };
  type Position = { xAdvance: number; yAdvance: number; xOffset: number; yOffset: number };
  type Face = {
    unitsPerEm: number;
    ascent: number;
    descent: number;
    characterSet: number[];
    variationAxes?: object;
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
      font = { bytes: fontBytes, face, cids: new Map(), handle: 0 };
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
  type Part = { text: string; style: Style; start: number; level: number };
  const pieces: Part[] = graphemes.map((g) => ({
    text: g.segment,
    start: g.index,
    level: embedding.levels[g.index],
    style: styled.find((s) => g.index >= s.from && g.index < s.to)?.style || base,
  }));
  for (const p of pieces)
    for (const ch of p.text) {
      if (ch === '\n') continue;
      if (!p.style.font.face.characterSet.includes(ch.codePointAt(0)!))
        throw new Error(
          `Die gewählte Schrift enthält das Zeichen „${ch}“ nicht. Bitte eine passende TrueType-Schrift wählen.`,
        );
    }
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
      if (prev?.style === p.style && prev.level === p.level) prev.text += p.text;
      else groups.push({ ...p });
    }
    return groups
      .sort((a, b) => rank.get(a.start)! - rank.get(b.start)!)
      .map((p) => {
        const rtl = !!(p.level & 1);
        const mirrored = Array.from(p.text, (ch) =>
          rtl ? bidi.getMirroredCharacter(ch) || ch : ch,
        ).join('');
        const run = p.style.font.face.layout(
            mirrored,
            undefined,
            undefined,
            undefined,
            rtl ? 'rtl' : 'ltr',
          ),
          factor = p.style.size / p.style.font.face.unitsPerEm;
        if (
          run.glyphs.length !== run.positions.length ||
          run.positions.some(
            (pos) => ![pos.xAdvance, pos.yAdvance, pos.xOffset, pos.yOffset].every(Number.isFinite),
          )
        )
          throw new Error(
            'Die Zeichenformung der gewählten Schrift kann nicht zuverlässig gesetzt werden.',
          );
        // Keep logical Unicode in ToUnicode even where the displayed bracket is mirrored.
        if (rtl)
          for (const glyph of run.glyphs)
            glyph.codePoints = glyph.codePoints.map((cp) =>
              (
                bidi.getMirroredCharacter(String.fromCodePoint(cp)) || String.fromCodePoint(cp)
              ).codePointAt(0)!,
            );
        return {
          ...p,
          run,
          factor,
          width: run.positions.reduce((n, pos) => n + pos.xAdvance * factor, 0),
        };
      });
  };
  return open(api, bytes, (ctx) => {
    const first = pageHandle(ctx, index),
      opened = [first],
      pending: { page: number; objects: number[] }[] = [];
    try {
      const handles = indices.map((id) =>
        Number.isInteger(id) && id >= 0 && id < api.FPDFPage_CountObjects(first)
          ? api.FPDFPage_GetObject(first, id)
          : 0,
      );
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
      for (const p of pieces) {
        if (/^\s$/u.test(p.text)) {
          if (word.length) words.push(word);
          words.push([p]);
          word = [];
        } else word.push(p);
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
        for (const p of token) {
          if (measure([p]) > available + 0.001)
            throw new Error('Der Textbereich ist schmaler als eine einzelne Zeichenfolge.');
          if (current.length && measure([...current, p]) > available + 0.001) flush();
          current.push(p);
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
        for (const g of groups)
          for (const glyph of g.run.glyphs) {
            const key = glyph.id + ':' + glyph.codePoints.join(',');
            if (!g.style.font.cids.has(key))
              g.style.font.cids.set(key, { cid: g.style.font.cids.size + 1, glyph });
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
          '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /MoinParagraph def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n' +
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
      for (const page of opened) pending.push({ page, objects: [] });
      for (const line of layout) {
        const target = pending[line.page],
          page = target.page,
          o = toPdf(ctx, page, 0, 0),
          rr = toPdf(ctx, page, 1, 0),
          bb = toPdf(ctx, page, 0, 1),
          u = [rr[0] - o[0], rr[1] - o[1]],
          v = [bb[0] - o[0], bb[1] - o[1]];
        let x =
          padding +
          (align === 'right'
            ? available - line.width
            : align === 'center'
              ? (available - line.width) / 2
              : 0);
        for (const group of line.groups) {
          const channels = [1, 3, 5].map((j) => parseInt(group.style.color.slice(j, j + 2), 16));
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
            const cp = ctx.alloc(4);
            try {
              api.pdfium.setValue(
                cp,
                group.style.font.cids.get(glyph.id + ':' + glyph.codePoints.join(','))!.cid,
                'i32',
              );
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
          }
        }
      }
      for (const obj of handles) {
        if (!api.FPDFPage_RemoveObject(first, obj))
          throw new Error('Ein Originaltext konnte nicht entfernt werden.');
        api.FPDFPageObj_Destroy(obj);
      }
      for (const target of pending) {
        while (target.objects.length)
          api.FPDFPage_InsertObject(target.page, target.objects.shift()!);
        if (!api.FPDFPage_GenerateContent(target.page))
          throw new Error('Der Absatz konnte nicht gespeichert werden.');
      }
      return { bytes: saved(ctx), lines: lines.length, height: used, addedPages: pageNo };
    } finally {
      for (const t of pending) for (const obj of t.objects) api.FPDFPageObj_Destroy(obj);
      for (const page of opened) api.FPDF_ClosePage(page);
      for (const font of fonts) if (font.handle) api.FPDFFont_Close(font.handle);
    }
  });
}

export function removeNativeRegions(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  removals: NativeRemoval[],
) {
  if (!removals.length || removals.length > 2000)
    throw new Error('Bitte 1 bis 2.000 Bereiche auswählen.');
  return open(api, bytes, (ctx) => {
    for (const removal of removals) {
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
