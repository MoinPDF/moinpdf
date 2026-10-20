import {
  StandardFonts,
  PDFDocument,
  PDFPage,
  PDFFont,
  PDFName,
  pushGraphicsState,
  popGraphicsState,
  setTextRenderingMode,
  TextRenderingMode,
  beginText,
  endText,
  setFontAndSize,
  setTextMatrix,
  showText,
  setCharacterSpacing,
  setFillingRgbColor,
} from 'pdf-lib';
import type { TextTarget } from './editor-model';
import type { Mark, Rect } from './studio-engine';
import { fontName } from './editor-model';
import { wrapEditorText, hexColor } from './editor-model';
import { resolveEditorFont, type EditorFontResolution } from './editor-fonts';
import type { Source } from './pdf-engine';
import { localFontBytes } from './local-font-bytes';
import { prepareEditorRuns, richEditorLayout } from './editor-rich-layout';

const fonts = new WeakMap<PDFDocument, Map<string, Promise<PDFFont>>>();
const characterSets = new WeakMap<PDFFont, Set<number>>();
function characterSet(font: PDFFont) {
  let set = characterSets.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    characterSets.set(font, set);
  }
  return set;
}
const pageFonts = new WeakMap<PDFPage, Map<PDFFont, PDFName>>();
function cachedFont(doc: PDFDocument, name: string, build: () => Promise<PDFFont>) {
  let cache = fonts.get(doc);
  if (!cache) {
    cache = new Map();
    fonts.set(doc, cache);
  }
  let value = cache.get(name);
  if (!value) {
    value = build();
    cache.set(name, value);
    value.catch(() => cache!.delete(name));
  }
  return value;
}
export async function editorFont(
  doc: PDFDocument,
  text: string,
  mark?: Pick<
    Mark,
    | 'fontFamily'
    | 'bold'
    | 'italic'
    | 'fontChoice'
    | 'originalFontId'
    | 'originalFontName'
    | 'originalFontPage'
    | 'customFont'
    | 'originalText'
    | 'sourceRect'
    | 'fontScale'
    | 'insetScale'
    | 'tracking'
    | 'textScaleX'
  >,
  source?: Source,
  report?: (resolution: EditorFontResolution) => void,
) {
  if (mark?.fontChoice || mark?.originalFontId) {
    const resolution = await resolveEditorFont({ ...mark, text }, source);
    report?.(resolution);
    return cachedFont(doc, resolution.font.cssFamily, async () => {
      doc.registerFontkit((await import('@pdf-lib/fontkit')).default);
      return doc.embedFont(resolution.font.bytes, {
        subset: true,
        features: { liga: false, kern: false, clig: false },
      });
    });
  }
  const name = mark ? fontName(mark) : StandardFonts.Helvetica;
  const standard = await cachedFont(doc, name, () => doc.embedFont(name));
  try {
    standard.encodeText(text);
    return standard;
  } catch {
    /* Embedded Unicode fallback. */
  }
  const base =
    mark?.fontFamily === 'serif'
      ? 'DejaVuSerif'
      : mark?.fontFamily === 'mono'
        ? 'DejaVuSansMono'
        : 'DejaVuSans';
  const italic = base === 'DejaVuSerif' ? 'Italic' : 'Oblique';
  const suffix = mark?.bold
    ? '-Bold' + (mark.italic ? italic : '')
    : mark?.italic
      ? '-' + italic
      : '';
  const localName = base + suffix;
  const font = await cachedFont(doc, localName, async () => {
    const response = await fetch('/vendor/editor-fonts/' + localName + '.ttf');
    if (!response.ok)
      throw new Error(
        'Die lokale Ersatzschrift konnte nicht geladen werden. Bitte erneut versuchen.',
      );
    doc.registerFontkit((await import('@pdf-lib/fontkit')).default);
    return doc.embedFont(new Uint8Array(await localFontBytes(response)), { subset: true });
  });
  const available = characterSet(font);
  if ([...text].some((c) => !/[\n\r\t]/.test(c) && !available.has(c.codePointAt(0)!)))
    throw new Error(
      'Der Text enthält nicht unterstützte Zeichen in der Ersatzschrift. Bitte im Werkzeug „PDF-Objekte bearbeiten“ eine passende Schrift verwenden.',
    );
  return font;
}
async function searchFont(doc: PDFDocument, text: string) {
  const standard = await cachedFont(doc, StandardFonts.Helvetica, () =>
    doc.embedFont(StandardFonts.Helvetica),
  );
  try {
    standard.encodeText(text);
    return standard;
  } catch {
    /* Unicode search layer. */
  }
  const font = await cachedFont(doc, 'MoinPDFSearch', async () => {
    const response = await fetch('/vendor/editor-fonts/MoinPDFSearch-Regular.ttf');
    if (!response.ok)
      throw new Error(
        'Die lokale Suchschrift konnte nicht geladen werden. Bitte erneut versuchen.',
      );
    doc.registerFontkit((await import('@pdf-lib/fontkit')).default);
    return doc.embedFont(new Uint8Array(await localFontBytes(response)), { subset: true });
  });
  if ([...text].some((c) => !characterSet(font).has(c.codePointAt(0)!)))
    throw new Error(
      'Ein erkanntes Zeichen kann nicht in der Suchtextebene gespeichert werden. Bitte den Text prüfen.',
    );
  return font;
}

export function editorTextGeometry(rect: Rect, width: number, height: number, angle = 0) {
  const rotation = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  const w = rect.w * width,
    h = rect.h * height;
  return {
    x: rect.x * width + (rotation === 90 || rotation === 180 ? w : 0),
    y: rect.y * height + (rotation === 180 || rotation === 270 ? h : 0),
    width: rotation % 180 ? h : w,
    height: rotation % 180 ? w : h,
    rotation,
  };
}
export function editorPointToPdf(page: PDFPage, x: number, y: number): [number, number] {
  const crop = page.getCropBox(),
    rotation = ((page.getRotation().angle % 360) + 360) % 360;
  if (rotation === 90) return [crop.x + y, crop.y + x];
  if (rotation === 180) return [crop.x + crop.width - x, crop.y + y];
  if (rotation === 270) return [crop.x + crop.width - y, crop.y + crop.height - x];
  return [crop.x + x, crop.y + crop.height - y];
}
export function layoutEditorText(
  mark: Mark,
  width: number,
  height: number,
  measure: (text: string, size: number) => number,
  descent = 0.2,
) {
  const geometry = editorTextGeometry(mark, width, height, mark.textRotation),
    size = (mark.fontScale || 0.028) * width;
  const scaleX = mark.textScaleX || 1,
    inset = (mark.insetScale || 0) * size,
    tracking = (mark.tracking || 0) * size;
  const available = Math.max(0.1, geometry.width / scaleX - 2 * inset);
  const measured = (text: string) =>
    measure(text, size) + Math.max(0, [...text].length - 1) * tracking;
  const lines = wrapEditorText(mark.text || '', available, measured),
    lineHeight = (mark.lineHeight || 1.25) * size;
  const baseline = (mark.baselineScale ?? 0.9) * size;
  const requiredHeight =
    mark.baselineScale === undefined
      ? lines.length * lineHeight
      : baseline + (lines.length - 1) * lineHeight + descent * size;
  return {
    geometry,
    size,
    scaleX,
    inset,
    tracking,
    available,
    measured,
    lines,
    lineHeight,
    baseline,
    requiredHeight,
    overflow:
      requiredHeight > geometry.height + 0.5 ||
      lines.some((line) => measured(line) > available + 0.05),
  };
}
export async function drawEditorText(
  doc: PDFDocument,
  page: PDFPage,
  mark: Mark,
  width: number,
  height: number,
  source?: Source,
  report?: (resolution: EditorFontResolution) => void,
) {
  if (mark.runs?.length) return drawRichEditorText(doc, page, mark, width, height, source, report);
  if (Math.abs((mark.textRotation || 0) - Math.round((mark.textRotation || 0) / 90) * 90) > 0.5)
    throw new Error(
      'Schräger, gespiegelter oder vertikaler Text kann hier nicht zuverlässig bearbeitet werden. Bitte „PDF-Objekte bearbeiten“ verwenden.',
    );
  let descent = 0.2;
  const font = await editorFont(doc, mark.text || '', mark, source, (resolution) => {
    descent = resolution.font.measureDescent(mark.text || '');
    report?.(resolution);
  });
  const layout = layoutEditorText(
    mark,
    width,
    height,
    (text, size) => font.widthOfTextAtSize(text, size),
    descent,
  );
  if (layout.overflow)
    throw new Error(
      'Ein Textfeld ist zu klein. Vergrößere seine Breite oder Höhe oder reduziere die Schriftgröße.',
    );
  let keys = pageFonts.get(page);
  if (!keys) {
    keys = new Map();
    pageFonts.set(page, keys);
  }
  let key = keys.get(font);
  if (!key) {
    key = page.node.newFontDictionary(font.name, font.ref);
    keys.set(font, key);
  }
  const color = hexColor(mark.color, '#222222'),
    radians = (layout.geometry.rotation * Math.PI) / 180;
  page.pushOperators(
    pushGraphicsState(),
    setTextRenderingMode(TextRenderingMode.Fill),
    setFillingRgbColor(
      parseInt(color.slice(1, 3), 16) / 255,
      parseInt(color.slice(3, 5), 16) / 255,
      parseInt(color.slice(5, 7), 16) / 255,
    ),
  );
  try {
    layout.lines.forEach((line, i) => {
      const offset =
        layout.inset +
        (mark.align === 'center'
          ? (layout.available - layout.measured(line)) / 2
          : mark.align === 'right'
            ? layout.available - layout.measured(line)
            : 0);
      const x = offset * layout.scaleX,
        y = layout.baseline + i * layout.lineHeight;
      const [px, py] = editorPointToPdf(
        page,
        layout.geometry.x + Math.cos(radians) * x - Math.sin(radians) * y,
        layout.geometry.y + Math.sin(radians) * x + Math.cos(radians) * y,
      );
      const [ex, ey] = editorPointToPdf(
        page,
        layout.geometry.x + Math.cos(radians) * (x + 1) - Math.sin(radians) * y,
        layout.geometry.y + Math.sin(radians) * (x + 1) + Math.cos(radians) * y,
      );
      const angle = Math.atan2(ey - py, ex - px);
      page.pushOperators(
        beginText(),
        setFontAndSize(key!, layout.size),
        setCharacterSpacing(layout.tracking),
        setTextMatrix(
          Math.cos(angle) * layout.scaleX,
          Math.sin(angle) * layout.scaleX,
          -Math.sin(angle),
          Math.cos(angle),
          px,
          py,
        ),
        showText(font.encodeText(line)),
        endText(),
      );
    });
  } finally {
    page.pushOperators(popGraphicsState());
  }
}
async function drawRichEditorText(
  doc: PDFDocument,
  page: PDFPage,
  mark: Mark,
  width: number,
  height: number,
  source?: Source,
  report?: (resolution: EditorFontResolution) => void,
) {
  const geometry = editorTextGeometry(mark, width, height, mark.textRotation),
    scaleX = mark.textScaleX || 1;
  const inset = (mark.insetScale || 0) * (mark.fontScale || 0.028) * width,
    available = geometry.width / scaleX - 2 * inset;
  const runs = await prepareEditorRuns(mark, source),
    layout = richEditorLayout(mark, width, available, runs);
  if (
    layout.requiredHeight > geometry.height + 0.5 ||
    layout.lines.some((line) => line.width > available + 0.5)
  )
    throw new Error(
      'Ein Textfeld ist zu klein. Vergrößere seine Breite oder Höhe oder reduziere die Schriftgröße.',
    );
  const embedded = new Map<(typeof runs)[number], PDFFont>();
  for (const run of runs) {
    report?.(run.resolution);
    embedded.set(
      run,
      await editorFont(
        doc,
        (mark.text || '').slice(run.start, run.end),
        { ...mark, ...run.style },
        source,
      ),
    );
  }
  const radians = (geometry.rotation * Math.PI) / 180;
  page.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Fill));
  try {
    for (const line of layout.lines)
      for (const piece of line.pieces) {
        const font = embedded.get(piece.run)!,
          key = page.node.newFontDictionary(font.name, font.ref);
        const align =
          mark.align === 'center'
            ? (available - line.width) / 2
            : mark.align === 'right'
              ? available - line.width
              : 0;
        const x = (inset + align + piece.x) * scaleX,
          y = line.baseline;
        const [px, py] = editorPointToPdf(
          page,
          geometry.x + Math.cos(radians) * x - Math.sin(radians) * y,
          geometry.y + Math.sin(radians) * x + Math.cos(radians) * y,
        );
        const [ex, ey] = editorPointToPdf(
          page,
          geometry.x + Math.cos(radians) * (x + 1) - Math.sin(radians) * y,
          geometry.y + Math.sin(radians) * (x + 1) + Math.cos(radians) * y,
        );
        const angle = Math.atan2(ey - py, ex - px),
          color = hexColor(piece.run.style.color, mark.color || '#222222');
        page.pushOperators(
          setFillingRgbColor(
            parseInt(color.slice(1, 3), 16) / 255,
            parseInt(color.slice(3, 5), 16) / 255,
            parseInt(color.slice(5, 7), 16) / 255,
          ),
          beginText(),
          setFontAndSize(key, piece.size),
          setCharacterSpacing(layout.tracking),
          setTextMatrix(
            Math.cos(angle) * scaleX,
            Math.sin(angle) * scaleX,
            -Math.sin(angle),
            Math.cos(angle),
            px,
            py,
          ),
          showText(font.encodeText(piece.text)),
          endText(),
        );
      }
  } finally {
    page.pushOperators(popGraphicsState());
  }
}
export async function addEditorTextLayer(
  doc: PDFDocument,
  page: PDFPage,
  targets: TextTarget[],
  width: number,
  height: number,
) {
  // Invisible rendering mode is scoped and restored; OCR never darkens the scan.
  page.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible));
  try {
    for (const target of targets) {
      if (!target.text.trim()) continue;
      const font = await searchFont(doc, target.text);
      const g = editorTextGeometry(target, width, height, target.rotation);
      const radians = (g.rotation * Math.PI) / 180;
      const size = Math.max(1, Math.min(target.fontSize, g.height / 1.05));
      const naturalWidth = font.widthOfTextAtSize(target.text, size);
      if (!naturalWidth) continue;
      const baseline = size * 0.85;
      const [x, y] = editorPointToPdf(
        page,
        g.x - Math.sin(radians) * baseline,
        g.y + Math.cos(radians) * baseline,
      );
      const [endX, endY] = editorPointToPdf(
        page,
        g.x + Math.cos(radians) - Math.sin(radians) * baseline,
        g.y + Math.sin(radians) + Math.cos(radians) * baseline,
      );
      let keys = pageFonts.get(page);
      if (!keys) {
        keys = new Map();
        pageFonts.set(page, keys);
      }
      let key = keys.get(font);
      if (!key) {
        key = page.node.newFontDictionary(font.name, font.ref);
        keys.set(font, key);
      }
      const angle = Math.atan2(endY - y, endX - x),
        fit = g.width / naturalWidth;
      page.pushOperators(
        beginText(),
        setFontAndSize(key, size),
        setTextMatrix(
          Math.cos(angle) * fit,
          Math.sin(angle) * fit,
          -Math.sin(angle),
          Math.cos(angle),
          x,
          y,
        ),
        showText(font.encodeText(target.text)),
        endText(),
      );
    }
  } finally {
    page.pushOperators(popGraphicsState());
  }
}
