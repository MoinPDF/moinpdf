import { init, type WrappedPdfiumModule } from '@embedpdf/pdfium';
import fontkit from '@pdf-lib/fontkit';

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
  remove?: boolean;
  text?: string;
  dx?: number;
  dy?: number;
  scale?: number;
  rotation?: number;
  image?: { width: number; height: number; rgba: Uint8Array };
};
export type NativeRemoval = { page: number; rect: NativeRect; color?: string };
export type NativeParagraph = {
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
export type NativeParagraphResult = { bytes: Uint8Array; lines: number; height: number };
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
        if (dx || dy || scale !== 1 || rotation) {
          const r = objectRect(ctx, page, obj);
          if (!r) throw new Error('Die Objektposition ist nicht lesbar.');
          const center = [(r.left + r.right) / 2, (r.bottom + r.top) / 2],
            origin = toPdf(ctx, page, 0, 0),
            offset = toPdf(ctx, page, dx, dy),
            rad = (-rotation * Math.PI) / 180,
            c = Math.cos(rad) * scale,
            s = Math.sin(rad) * scale;
          api.FPDFPageObj_Transform(
            obj,
            c,
            s,
            -s,
            c,
            center[0] - c * center[0] + s * center[1] + offset[0] - origin[0],
            center[1] - s * center[0] - c * center[1] + offset[1] - origin[1],
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
/** Replace explicitly selected top-level text objects by one consistently styled paragraph.
 * All validation and layout happen before any original object is removed. */
export function replaceNativeParagraph(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  index: number,
  settings: NativeParagraph,
): NativeParagraphResult {
  const { rect: r, fontSize, padding, lineHeight, align, indices, fontBytes, color } = settings;
  if (!indices.length || indices.length > 500 || new Set(indices).size !== indices.length)
    throw new Error('Bitte 1 bis 500 unterschiedliche Textobjekte auswählen.');
  if (
    ![r.x, r.y, r.w, r.h, fontSize, padding, lineHeight].every(Number.isFinite) ||
    r.x < 0 ||
    r.y < 0 ||
    r.w <= 0 ||
    r.h <= 0 ||
    r.x + r.w > 1.00001 ||
    r.y + r.h > 1.00001 ||
    fontSize < 6 ||
    fontSize > 144 ||
    padding < 0 ||
    padding > 72 ||
    lineHeight < 1 ||
    lineHeight > 3 ||
    !['left', 'center', 'right'].includes(align) ||
    !/^#[0-9a-f]{6}$/i.test(color)
  )
    throw new Error('Bitte Textbereich, Schriftgröße, Abstand und Farbe prüfen.');
  const text = settings.text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').normalize('NFC');
  if (!text.trim() || text.length > 20000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))
    throw new Error('Bitte 1 bis 20.000 Zeichen ohne Steuerzeichen eingeben.');
  // This engine positions Unicode characters without a shaping/bidi engine.
  // Fail explicitly rather than silently producing disconnected or reversed text.
  const complexRanges = [
    [0x590, 0x109f],
    [0x1780, 0x18af],
    [0x200b, 0x200f],
    [0x202a, 0x202e],
    [0x2060, 0x206f],
    [0xa980, 0xa9df],
    [0xaa00, 0xaaff],
    [0xfb1d, 0xfeff],
  ];
  if (
    Array.from(text).some((ch) => {
      const code = ch.codePointAt(0)!;
      return (
        /\p{M}/u.test(ch) || code > 0xffff || complexRanges.some(([a, b]) => code >= a && code <= b)
      );
    })
  )
    throw new Error(
      'Dieser Absatzeditor unterstützt links-nach-rechts gesetzte Schrift ohne komplexe Zeichenformung. Bitte lateinische, griechische oder kyrillische Texte verwenden.',
    );
  if (
    fontBytes.length < 12 ||
    fontBytes.length > 10 * 1024 * 1024 ||
    new DataView(fontBytes.buffer, fontBytes.byteOffset, fontBytes.byteLength).getUint32(0) !==
      0x00010000
  )
    throw new Error('Bitte eine einzelne TrueType-Schrift (.ttf), höchstens 10 MB, verwenden.');
  let fontInfo;
  try {
    fontInfo = fontkit.create(fontBytes);
  } catch {
    throw new Error('Die TrueType-Schrift ist nicht lesbar.');
  }
  if (
    !fontInfo.characterSet ||
    ('variationAxes' in fontInfo && Object.keys(fontInfo.variationAxes as object).length)
  )
    throw new Error(
      'Bitte eine statische TrueType-Schrift verwenden, keine variable Schrift oder Schriftsammlung.',
    );
  const characterSet = new Set<number>(fontInfo.characterSet);
  for (const ch of text) {
    if (ch === '\n') continue;
    if (!characterSet.has(ch.charCodeAt(0)))
      throw new Error(
        `Die gewählte Schrift enthält das Zeichen „${ch}“ nicht. Bitte eine passende TrueType-Schrift wählen.`,
      );
  }
  return open(api, bytes, (ctx) => {
    const page = pageHandle(ctx, index),
      handles: number[] = [];
    let font = 0;
    try {
      const count = api.FPDFPage_CountObjects(page);
      if (count > 10000) throw new Error('Diese Seite enthält zu viele Objekte.');
      for (const id of indices) {
        const obj =
          Number.isInteger(id) && id >= 0 && id < count ? api.FPDFPage_GetObject(page, id) : 0;
        if (!obj || api.FPDFPageObj_GetType(obj) !== 1)
          throw new Error(
            'Die Auswahl enthält ein ungültiges Objekt. Bitte ausschließlich Text auswählen.',
          );
        handles.push(obj);
      }
      const fp = ctx.alloc(fontBytes.length);
      try {
        heap(api).set(fontBytes, fp);
        font = api.FPDFText_LoadFont(ctx.doc, fp, fontBytes.length, 2, true);
      } finally {
        ctx.free(fp);
      }
      if (!font) throw new Error('Die Schrift konnte nicht eingebettet werden.');
      const origin = toPdf(ctx, page, 0, 0),
        right = toPdf(ctx, page, 1, 0),
        bottom = toPdf(ctx, page, 0, 1);
      const u = [right[0] - origin[0], right[1] - origin[1]],
        v = [bottom[0] - origin[0], bottom[1] - origin[1]];
      const width = Math.hypot(...u),
        height = Math.hypot(...v),
        available = r.w * width - 2 * padding;
      if (available <= 0 || r.h * height <= 2 * padding)
        throw new Error('Der Textbereich ist kleiner als sein Innenabstand.');
      const metrics = ctx.alloc(8),
        advances = new Map<string, number>();
      let ascent: number, descent: number;
      try {
        if (
          !api.FPDFFont_GetAscent(font, fontSize, metrics) ||
          !api.FPDFFont_GetDescent(font, fontSize, metrics + 4)
        )
          throw new Error('Die Schriftmaße sind nicht lesbar.');
        ascent = api.pdfium.getValue(metrics, 'float');
        descent = Math.abs(api.pdfium.getValue(metrics + 4, 'float'));
        for (const ch of text) {
          if (ch === '\n' || advances.has(ch)) continue;
          if (!api.FPDFFont_GetGlyphWidth(font, ch.charCodeAt(0), fontSize, metrics))
            throw new Error(`Die Breite des Zeichens „${ch}“ ist nicht lesbar.`);
          const value = api.pdfium.getValue(metrics, 'float');
          if (!Number.isFinite(value) || value < 0) throw new Error('Ungültige Zeichenbreite.');
          advances.set(ch, value);
        }
      } finally {
        ctx.free(metrics);
      }
      if (![ascent, descent].every(Number.isFinite) || ascent <= 0)
        throw new Error('Ungültige Schriftmaße.');
      const measure = (value: string) =>
        Array.from(value).reduce((total, ch) => total + (advances.get(ch) || 0), 0);
      const lines: string[] = [];
      for (const explicit of text.split('\n')) {
        // Break at ordinary spaces; NBSP is kept within a word. Oversized words
        // are split by characters, without introducing or deleting letters.
        let line = '';
        for (const word of explicit.trim().split(/ +/)) {
          if (!word) continue;
          const candidate = line ? line + ' ' + word : word;
          if (measure(candidate) <= available + 0.001) {
            line = candidate;
            continue;
          }
          if (line) {
            lines.push(line);
            line = '';
          }
          for (const ch of word) {
            if (measure(ch) > available + 0.001)
              throw new Error('Der Textbereich ist schmaler als ein einzelnes Zeichen.');
            if (line && measure(line + ch) > available + 0.001) {
              lines.push(line);
              line = '';
            }
            line += ch;
          }
        }
        lines.push(line);
      }
      const advance = Math.max(fontSize * lineHeight, ascent + descent),
        used = ascent + descent + (lines.length - 1) * advance + 2 * padding;
      if (used > r.h * height + 0.01)
        throw new Error(
          `Textüberlauf: ${lines.length} Zeilen benötigen ${Math.ceil(used)} pt Höhe, verfügbar sind ${Math.floor(r.h * height)} pt. Bereich vergrößern, Text kürzen oder Schrift verkleinern.`,
        );
      const objects: number[] = [];
      try {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          const obj = api.FPDFPageObj_CreateTextObj(ctx.doc, font, fontSize);
          if (!obj) throw new Error('Eine Textzeile konnte nicht erzeugt werden.');
          objects.push(obj);
          const size = (line.length + 1) * 2,
            p = ctx.alloc(size);
          try {
            api.pdfium.stringToUTF16(line, p, size);
            if (!api.FPDFText_SetText(obj, p))
              throw new Error('Eine Textzeile konnte nicht gesetzt werden.');
          } finally {
            ctx.free(p);
          }
          const offset =
            align === 'right'
              ? available - measure(line)
              : align === 'center'
                ? (available - measure(line)) / 2
                : 0;
          const x = r.x + (padding + offset) / width,
            y = r.y + (padding + ascent + i * advance) / height;
          const e = origin[0] + u[0] * x + v[0] * y,
            f = origin[1] + u[1] * x + v[1] * y;
          api.FPDFPageObj_Transform(
            obj,
            u[0] / width,
            u[1] / width,
            -v[0] / height,
            -v[1] / height,
            e,
            f,
          );
          const channels = [1, 3, 5].map((j) => parseInt(color.slice(j, j + 2), 16));
          if (!api.FPDFPageObj_SetFillColor(obj, channels[0], channels[1], channels[2], 255))
            throw new Error('Die Textfarbe konnte nicht gesetzt werden.');
          const bounds = objectRect(ctx, page, obj);
          if (
            !bounds ||
            bounds.x < r.x - 0.0001 ||
            bounds.y < r.y - 0.0001 ||
            bounds.x + bounds.w > r.x + r.w + 0.0001 ||
            bounds.y + bounds.h > r.y + r.h + 0.0001
          )
            throw new Error(
              'Die tatsächlichen Schriftkonturen ragen über den Textbereich. Innenabstand oder Bereich vergrößern.',
            );
        }
        for (const obj of handles) {
          if (!api.FPDFPage_RemoveObject(page, obj))
            throw new Error('Ein Originaltext konnte nicht entfernt werden.');
          api.FPDFPageObj_Destroy(obj);
        }
        while (objects.length) api.FPDFPage_InsertObject(page, objects.shift()!);
        if (!api.FPDFPage_GenerateContent(page))
          throw new Error('Der Absatz konnte nicht gespeichert werden.');
        return { bytes: saved(ctx), lines: lines.length, height: used };
      } finally {
        for (const obj of objects) api.FPDFPageObj_Destroy(obj);
      }
    } finally {
      api.FPDF_ClosePage(page);
      if (font) api.FPDFFont_Close(font);
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
