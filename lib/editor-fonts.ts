import type { PDFPageProxy } from 'pdfjs-dist';
import type { Source } from './pdf-engine';
import type { Mark } from './studio-engine';
import type { FontFamily } from './editor-model';
import {
  editorFontCatalog,
  fontFile,
  matchingEditorFont,
  readableFontName,
} from './editor-font-catalog';
import { fontFingerprint, unicodeFont } from './editor-font-cmap';
import { localFontBytes } from './local-font-bytes';

type Glyph = { id: number; advanceWidth: number; path: { commands: unknown[] } };
type Face = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  characterSet: number[];
  numGlyphs: number;
  glyphForCodePoint: (code: number) => Glyph;
  getGlyph: (id: number) => Glyph;
};
type PdfGlyph = { unicode: string; fontChar: string; originalCharCode: number; width: number };
export type EditorFont = {
  id: string;
  name: string;
  bytes: Uint8Array;
  family: FontFamily;
  bold: boolean;
  italic: boolean;
  ascent: number;
  descent: number;
  cssFamily: string;
  original: boolean;
  covers: (text: string) => boolean;
  measure: (text: string, size: number) => number;
};
export type EditorFontDescriptor = {
  name: string;
  family: FontFamily;
  bold: boolean;
  italic: boolean;
  originalId?: string;
  ascent?: number;
  descent?: number;
};
export type EditorTextRun = { fontKey: string; text: string; color: string; invisible: boolean };
export type EditorFontPage = { fonts: Map<string, EditorFontDescriptor>; runs: EditorTextRun[] };
type SourceFonts = {
  pages: Map<number, Promise<EditorFontPage>>;
  fonts: Map<string, EditorFont>;
  bytes: number;
};
const sources = new WeakMap<Source, SourceFonts>();
const localFonts = new Map<string, Promise<EditorFont>>();
const cssFonts = new WeakMap<EditorFont, Promise<void>>();
const fontFinalizer =
  typeof FinalizationRegistry === 'function'
    ? new FinalizationRegistry<FontFace>((face) => {
        if (typeof document !== 'undefined') document.fonts?.delete(face);
      })
    : undefined;
const validColor = (color: unknown): string =>
  typeof color === 'string' && /^#[a-f\d]{6}$/i.test(color) ? color : '#000000';
const significant = (text: string) => [...text].filter((ch) => !/[\r\n\t]/.test(ch));
function stateFor(source: Source) {
  let state = sources.get(source);
  if (!state) {
    state = { pages: new Map(), fonts: new Map(), bytes: 0 };
    sources.set(source, state);
  }
  return state;
}
async function fontFace(bytes: Uint8Array) {
  const face = (await import('@pdf-lib/fontkit')).default.create(bytes) as unknown as Face;
  if (
    !Number.isFinite(face.unitsPerEm) ||
    face.unitsPerEm < 1 ||
    face.unitsPerEm > 16384 ||
    !Number.isFinite(face.ascent) ||
    !Number.isFinite(face.descent) ||
    face.numGlyphs > 65536 ||
    face.characterSet.length > 262144
  )
    throw new Error('Die Schrift enthält nicht unterstützte Zeichendaten.');
  return face;
}
async function makeFont(
  bytes: Uint8Array,
  metadata: Omit<EditorFont, 'bytes' | 'covers' | 'measure' | 'ascent' | 'descent'>,
): Promise<EditorFont> {
  const face = await fontFace(bytes);
  const coverage = new Set(face.characterSet.filter((code) => face.glyphForCodePoint(code).id > 0));
  return {
    ...metadata,
    bytes,
    ascent: face.ascent / face.unitsPerEm,
    descent: Math.abs(face.descent / face.unitsPerEm),
    covers: (text) => significant(text).every((ch) => coverage.has(ch.codePointAt(0)!)),
    measure: (text, size) =>
      (significant(text).reduce(
        (w, ch) => w + face.glyphForCodePoint(ch.codePointAt(0)!).advanceWidth,
        0,
      ) /
        face.unitsPerEm) *
      size,
  };
}
async function originalFont(
  raw: Record<string, unknown>,
  glyphs: PdfGlyph[],
  metadata: EditorFontDescriptor,
  previousFonts: Map<string, EditorFont>,
) {
  const data = raw.data;
  if (
    !(data instanceof Uint8Array) ||
    !data.length ||
    raw.isType3Font ||
    raw.missingFile ||
    data.length > 16 * 1024 * 1024
  )
    return;
  const fingerprint = fontFingerprint(data),
    id = 'original:' + metadata.name.slice(0, 170) + ':' + fingerprint,
    previous = previousFonts.get(id);
  const used = glyphs.map((glyph) => glyph.unicode).join('');
  if (previous?.covers(used)) return previous;
  const face = await fontFace(data),
    mapping = new Map(face.characterSet.map((c) => [c, face.glyphForCodePoint(c).id]));
  if (previous) {
    const oldFace = await fontFace(previous.bytes);
    for (const code of oldFace.characterSet) {
      const glyph = oldFace.glyphForCodePoint(code);
      if (glyph.id) mapping.set(code, glyph.id);
    }
  }
  for (const glyph of glyphs) {
    if ([...glyph.unicode].length !== 1 || !glyph.fontChar) continue;
    let id = face.glyphForCodePoint(glyph.fontChar.codePointAt(0)!).id;
    // PDF.js deliberately omits blank space outlines from its browser cmap.
    // A CID may still address the correct empty glyph with its exact advance.
    if (
      !id &&
      /\s/u.test(glyph.unicode) &&
      glyph.originalCharCode > 0 &&
      glyph.originalCharCode < face.numGlyphs
    ) {
      const blank = face.getGlyph(glyph.originalCharCode);
      if (
        !blank.path.commands.length &&
        Math.abs((blank.advanceWidth / face.unitsPerEm) * 1000 - glyph.width) < 1
      )
        id = blank.id;
    }
    if (id) mapping.set(glyph.unicode.codePointAt(0)!, id);
  }
  const bytes = unicodeFont(data, mapping);
  return makeFont(bytes, {
    ...metadata,
    id,
    cssFamily: 'MoinOriginal' + fingerprint + '_' + fontFingerprint(bytes, ['cmap']),
    original: true,
  });
}
async function readPage(source: Source, page: PDFPageProxy): Promise<EditorFontPage> {
  const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const ops = await page.getOperatorList();
  const glyphs = new Map<string, PdfGlyph[]>(),
    runs: EditorTextRun[] = [],
    keys = new Set<string>();
  let state = { font: '', color: '#000000', mode: 0, opacity: 1 };
  const stack: (typeof state)[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const op = ops.fnArray[i],
      args = ops.argsArray[i];
    if (op === OPS.save || op === OPS.paintFormXObjectBegin) stack.push({ ...state });
    else if (op === OPS.restore || op === OPS.paintFormXObjectEnd) state = stack.pop() || state;
    else if (op === OPS.setFont) {
      state.font = args[0];
      keys.add(state.font);
    } else if (op === OPS.setFillRGBColor) state.color = validColor(args[0]);
    else if (op === OPS.setGState) {
      for (const [key, value] of args[0] as [string, unknown][])
        if (key === 'ca' && typeof value === 'number') state.opacity = value;
    } else if (op === OPS.setTextRenderingMode) state.mode = args[0];
    else if (op === OPS.showText || op === OPS.showSpacedText) {
      const chars = (args[0] as unknown[]).filter(
        (g): g is PdfGlyph => !!g && typeof g === 'object' && 'unicode' in g && 'fontChar' in g,
      );
      const current = glyphs.get(state.font) || [];
      for (const glyph of chars) if (current.length < 100000) current.push(glyph);
      glyphs.set(state.font, current);
      runs.push({
        fontKey: state.font,
        text: chars.map((g) => g.unicode).join(''),
        color: state.color,
        invisible: state.mode === 3 || state.mode === 7 || state.opacity === 0,
      });
    }
  }
  const fonts = new Map<string, EditorFontDescriptor>(),
    sourceState = stateFor(source);
  for (const key of keys) {
    let raw: Record<string, unknown>;
    try {
      raw = page.commonObjs.get(key) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!raw) continue;
    const name = typeof raw.name === 'string' ? raw.name : '';
    const metadata: EditorFontDescriptor = {
      name: name ? readableFontName(name) : '',
      family:
        raw.isMonospace || raw.fallbackName === 'monospace'
          ? 'mono'
          : raw.isSerifFont || raw.fallbackName === 'serif'
            ? 'serif'
            : 'sans',
      bold: !!raw.bold || !!raw.black || /bold|black|heavy|demi/i.test(name),
      italic: !!raw.italic || /italic|oblique/i.test(name),
      ...(typeof raw.ascent === 'number' ? { ascent: raw.ascent } : {}),
      ...(typeof raw.descent === 'number' ? { descent: Math.abs(raw.descent) } : {}),
    };
    try {
      const font = await originalFont(raw, glyphs.get(key) || [], metadata, sourceState.fonts);
      if (
        font &&
        sourceState.bytes +
          font.bytes.length -
          (sourceState.fonts.get(font.id)?.bytes.length || 0) <=
          48 * 1024 * 1024
      ) {
        const previous = sourceState.fonts.get(font.id);
        sourceState.bytes += font.bytes.length - (previous?.bytes.length || 0);
        sourceState.fonts.set(font.id, font);
        metadata.originalId = font.id;
      }
    } catch {
      /* Unsupported or invalid fonts use an explicit, visible substitute. */
    }
    fonts.set(key, metadata);
  }
  return { fonts, runs };
}
export function editorFontPage(source: Source, index: number) {
  const state = stateFor(source);
  let pending = state.pages.get(index);
  if (!pending) {
    pending = source.pdf.getPage(index + 1).then((page) => readPage(source, page));
    state.pages.set(index, pending);
    pending.catch(() => state.pages.delete(index));
  }
  return pending;
}
export function originalEditorFont(source: Source, id?: string) {
  return id ? stateFor(source).fonts.get(id) : undefined;
}
async function localFont(choice: string, bold: boolean, italic: boolean) {
  const spec = fontFile(
    editorFontCatalog.find((f) => f.id === choice)?.id || 'liberation-sans',
    bold,
    italic,
  );
  const key = spec.path;
  let pending = localFonts.get(key);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(spec.path);
      if (!response.ok)
        throw new Error(
          'Die gewählte Schrift konnte nicht geladen werden. Bitte erneut versuchen.',
        );
      const bytes = new Uint8Array(await localFontBytes(response));
      return makeFont(bytes, {
        id: key,
        name: spec.name,
        family: spec.family,
        bold,
        italic,
        original: false,
        cssFamily: 'MoinLocal_' + spec.id + (bold ? '_bold' : '') + (italic ? '_italic' : ''),
      });
    })();
    localFonts.set(key, pending);
    pending.catch(() => localFonts.delete(key));
  }
  return pending;
}
export type EditorFontResolution = { font: EditorFont; substituted: boolean; reason?: string };
export async function resolveEditorFont(
  mark: Pick<
    Mark,
    | 'fontChoice'
    | 'originalFontId'
    | 'originalFontName'
    | 'originalFontPage'
    | 'bold'
    | 'italic'
    | 'fontFamily'
    | 'text'
  >,
  source?: Source,
): Promise<EditorFontResolution> {
  const text = mark.text || ' ',
    bold = !!mark.bold,
    italic = !!mark.italic;
  let reason: string | undefined;
  if ((!mark.fontChoice || mark.fontChoice === 'auto') && source && mark.originalFontId) {
    if (!originalEditorFont(source, mark.originalFontId) && mark.originalFontPage !== undefined)
      await editorFontPage(source, mark.originalFontPage).catch(() => {});
    const original = originalEditorFont(source, mark.originalFontId);
    if (original && original.bold === bold && original.italic === italic && original.covers(text))
      return { font: original, substituted: false };
    reason =
      original && !original.covers(text)
        ? 'Die eingebettete Originalschrift enthält nicht alle benötigten Zeichen.'
        : 'Die Originalschrift ist in diesem Schriftschnitt nicht wiederverwendbar.';
  } else if ((!mark.fontChoice || mark.fontChoice === 'auto') && mark.originalFontName)
    reason = 'Die Originalschrift ist nicht vollständig eingebettet oder nicht wiederverwendbar.';
  const choice =
    mark.fontChoice && mark.fontChoice !== 'auto'
      ? mark.fontChoice
      : matchingEditorFont(mark.originalFontName, mark.fontFamily);
  let font = await localFont(choice, bold, italic);
  if (!font.covers(text)) {
    if (mark.fontChoice && mark.fontChoice !== 'auto')
      throw new Error(
        'Die gewählte Schrift enthält nicht alle Zeichen. Bitte eine andere Schrift wählen.',
      );
    const fallback =
      mark.fontFamily === 'serif'
        ? 'dejavu-serif'
        : mark.fontFamily === 'mono'
          ? 'dejavu-mono'
          : 'dejavu-sans';
    font = await localFont(fallback, bold, italic);
    reason ||= 'Für einige Zeichen wird eine andere Schrift benötigt.';
  }
  if (!font.covers(text))
    throw new Error(
      'Der Text enthält nicht unterstützte Zeichen in der Ersatzschrift. Bitte im Werkzeug „PDF-Objekte bearbeiten“ eine passende Schrift verwenden.',
    );
  return { font, substituted: !!reason, ...(reason ? { reason } : {}) };
}
export async function loadEditorCssFont(font: EditorFont, source?: Source) {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  let pending = cssFonts.get(font);
  if (!pending) {
    pending = (async () => {
      const face = new FontFace(font.cssFamily, font.bytes.slice().buffer, {
        weight: font.bold ? '700' : '400',
        style: font.italic ? 'italic' : 'normal',
        ascentOverride: `${Math.max(0, font.ascent) * 100}%`,
        descentOverride: `${Math.max(0, font.descent) * 100}%`,
        lineGapOverride: '0%',
      });
      await face.load();
      document.fonts.add(face);
      if (source && font.original) fontFinalizer?.register(source, face);
    })();
    cssFonts.set(font, pending);
    pending.catch(() => cssFonts.delete(font));
  }
  return pending;
}
