import { readPdfText } from './pdf-text';
import { StandardFonts } from 'pdf-lib';
import type { Source, PageItem } from './pdf-engine';
import type { Mark, Rect } from './studio-engine';
import { editorFontPage, originalEditorFont } from './editor-fonts';

export type FontFamily = 'sans' | 'serif' | 'mono';
export type EditorAction = 'pick' | 'replace-area' | 'add-text' | 'erase' | 'image' | 'select';
export type TextTarget = Rect & {
  id: string;
  text: string;
  fontSize: number;
  family: FontFamily;
  origin?: 'pdf' | 'ocr';
  /** Search-layer text has no visible glyphs; editing also needs to remove scan pixels. */
  invisible?: boolean;
  unsupportedReason?: string;
  confidence?: number;
  rotation?: number;
  fill?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  fontName?: string;
  originalFontId?: string;
  baselineScale?: number;
  insetScale?: number;
  tracking?: number;
  textScaleX?: number;
  lineHeight?: number;
  fragments?: TextTarget[];
};
export const editorRemovalRects = (mark: Mark): Rect[] =>
  mark.sourceRects?.length
    ? mark.sourceRects
    : mark.sourceRect
      ? [mark.sourceRect]
      : mark.kind === 'erase'
        ? [mark]
        : [];
export function editorMarkSignature(mark: Mark) {
  const appearance: Partial<Mark> = { ...mark };
  delete appearance.originalState;
  delete appearance.id;
  return JSON.stringify(appearance);
}
export const editorMarkChanged = (mark: Mark) =>
  !mark.originalState || mark.originalState !== editorMarkSignature(mark);
export const editorRectsOverlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) >
  0.0000001;
export function editorTextCollision(mark: Mark, marks: Mark[], targets: TextTarget[]) {
  if (mark.kind !== 'text' || !mark.sourceRect || !mark.text || !editorMarkChanged(mark))
    return false;
  const removed = marks.filter(editorMarkChanged).flatMap(editorRemovalRects);
  return (
    marks.some(
      (other) =>
        other.id !== mark.id &&
        other.kind === 'text' &&
        other.text &&
        editorMarkChanged(other) &&
        editorRectsOverlap(mark, other),
    ) ||
    targets.some(
      (target) =>
        !removed.some((rect) => editorRectsOverlap(rect, target)) &&
        editorRectsOverlap(mark, target),
    )
  );
}
export const editorTools = ['edit-text', 'erase', 'insert-image'];
export const cssFont = (family?: FontFamily) =>
  family === 'serif' ? 'Times New Roman' : family === 'mono' ? 'Courier New' : 'Arial';
export const hexColor = (value: string | undefined, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value || '') ? value! : fallback;
export function fontName(mark: Pick<Mark, 'fontFamily' | 'bold' | 'italic'>) {
  const index = (mark.bold ? 1 : 0) + (mark.italic ? 2 : 0);
  return (
    mark.fontFamily === 'serif'
      ? [
          StandardFonts.TimesRoman,
          StandardFonts.TimesRomanBold,
          StandardFonts.TimesRomanItalic,
          StandardFonts.TimesRomanBoldItalic,
        ]
      : mark.fontFamily === 'mono'
        ? [
            StandardFonts.Courier,
            StandardFonts.CourierBold,
            StandardFonts.CourierOblique,
            StandardFonts.CourierBoldOblique,
          ]
        : [
            StandardFonts.Helvetica,
            StandardFonts.HelveticaBold,
            StandardFonts.HelveticaOblique,
            StandardFonts.HelveticaBoldOblique,
          ]
  )[index];
}
export function wrapEditorText(text: string, width: number, measure: (s: string) => number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\t/g, '    ').split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.match(/\S+| +/gu) || []) {
      const candidate = line + word;
      if (measure(candidate) <= width + 0.0001) {
        line = candidate;
        continue;
      }
      if (/^ +$/.test(word)) {
        // Spaces at a soft line boundary have no visible ink. Preserve interior
        // spacing and explicit newlines, without manufacturing blank lines.
        if (line) lines.push(line);
        line = '';
        continue;
      }
      if (line) {
        lines.push(line.trimEnd());
        line = '';
      }
      for (const char of word) {
        if (line && measure(line + char) > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}
export function fitRect(rect: Rect): Rect {
  const x = Math.max(0, Math.min(0.99, rect.x)),
    y = Math.max(0, Math.min(0.99, rect.y));
  return {
    x,
    y,
    w: Math.max(0.01, Math.min(1 - x, rect.w)),
    h: Math.max(0.01, Math.min(1 - y, rect.h)),
  };
}
export async function readTextTargets(
  source: Source,
  item: PageItem | Pick<PageItem, 'index' | 'rotation'>,
): Promise<{ targets: TextTarget[]; width: number; height: number }> {
  const page = await source.pdf.getPage(item.index + 1),
    viewport = page.getViewport({ scale: 1, rotation: (page.rotate + item.rotation) % 360 }),
    content = await readPdfText(page),
    v = viewport.transform;
  const typography = await editorFontPage(source, item.index).catch(() => undefined);
  const runsForText = new Map<string, { color: string; invisible: boolean }[]>(),
    fontsWithRuns = new Set<string>(),
    colorsForFont = new Map<string, Set<string>>();
  for (const run of typography?.runs || []) {
    fontsWithRuns.add(run.fontKey);
    const key = run.fontKey + ':' + run.text.replace(/\s/gu, '');
    const entries = runsForText.get(key) || [];
    entries.push(run);
    runsForText.set(key, entries);
    if (run.invisible) continue;
    const colors = colorsForFont.get(run.fontKey) || new Set<string>();
    colors.add(run.color);
    colorsForFont.set(run.fontKey, colors);
  }
  for (const runs of runsForText.values()) runs.reverse();
  const targets: TextTarget[] = [];
  for (const [i, part] of content.items.entries()) {
    if (!('str' in part) || !part.str.trim()) continue;
    const t = part.transform,
      dx = v[0] * t[0] + v[2] * t[1],
      dy = v[1] * t[0] + v[3] * t[1];
    const angle = Math.atan2(dy, dx);
    const fontSize = Math.hypot(v[2] * t[3] + v[0] * t[2], v[3] * t[3] + v[1] * t[2]);
    if (!fontSize) continue;
    const style = content.styles[part.fontName],
      ascent = style?.ascent ?? 0.85,
      descent = Math.abs(style?.descent ?? -0.2),
      pad = Math.max(0.8, fontSize * 0.08);
    const px = v[0] * t[4] + v[2] * t[5] + v[4],
      baseline = v[1] * t[4] + v[3] * t[5] + v[5];
    const points = [
      [0, -fontSize * ascent],
      [part.width, -fontSize * ascent],
      [0, fontSize * descent],
      [part.width, fontSize * descent],
    ].map(([x, y]) => [
      px + x * Math.cos(angle) - y * Math.sin(angle),
      baseline + x * Math.sin(angle) + y * Math.cos(angle),
    ]);
    const left = Math.max(0, Math.min(...points.map((p) => p[0])) - pad),
      top = Math.max(0, Math.min(...points.map((p) => p[1])) - pad),
      right = Math.min(viewport.width, Math.max(...points.map((p) => p[0])) + pad),
      bottom = Math.min(viewport.height, Math.max(...points.map((p) => p[1])) + pad);
    if (right <= left || bottom <= top) continue;
    const run = runsForText.get(part.fontName + ':' + part.str.replace(/\s/gu, ''))?.pop(),
      invisible =
        run?.invisible ?? (fontsWithRuns.has(part.fontName) && !colorsForFont.has(part.fontName)),
      // An OCR search layer's invisible font is not the font in the scan.
      // Keep its native origin so export does not add a duplicate search layer.
      metadata = invisible ? undefined : typography?.fonts.get(part.fontName),
      font = originalEditorFont(source, metadata?.originalId),
      fontColors = colorsForFont.get(part.fontName),
      color =
        !invisible && run ? run.color : fontColors?.size === 1 ? [...fontColors][0] : '#000000',
      scaleX = Math.hypot(dx, dy) / fontSize;
    const natural = font?.covers(part.str) ? font.measure(part.str, fontSize) * scaleX : part.width;
    const vx = v[0] * t[2] + v[2] * t[3],
      vy = v[1] * t[2] + v[3] * t[3],
      rotation = (angle * 180) / Math.PI;
    const unsupported =
      style?.vertical ||
      Math.abs(rotation - Math.round(rotation / 90) * 90) > 0.5 ||
      Math.abs(dx * vx + dy * vy) > Math.hypot(dx, dy) * fontSize * 0.02 ||
      dx * vy - dy * vx >= 0;
    const spacing =
      part.str.length > 1 ? (part.width - natural) / (part.str.length - 1) / fontSize / scaleX : 0;
    targets.push({
      id: `text-${i}`,
      text: part.str,
      x: left / viewport.width,
      y: top / viewport.height,
      w: (right - left) / viewport.width,
      h: (bottom - top) / viewport.height,
      fontSize,
      origin: 'pdf',
      invisible: !!invisible,
      rotation,
      ...(unsupported
        ? {
            unsupportedReason:
              'Schräger, gespiegelter oder vertikaler Text kann hier nicht zuverlässig bearbeitet werden. Bitte „PDF-Objekte bearbeiten“ verwenden.',
          }
        : {}),
      ...(metadata?.name ? { fontName: metadata.name } : {}),
      ...(metadata?.originalId ? { originalFontId: metadata.originalId } : {}),
      bold: metadata?.bold || false,
      italic: metadata?.italic || false,
      color,
      baselineScale: ascent + pad / fontSize,
      insetScale: pad / fontSize / scaleX,
      tracking: Number.isFinite(spacing) && Math.abs(spacing) < 0.5 ? spacing : 0,
      textScaleX: Number.isFinite(scaleX) && scaleX >= 0.1 && scaleX <= 10 ? scaleX : 1,
      family: invisible
        ? 'sans'
        : metadata?.family ||
          (style?.fontFamily?.includes('monospace')
            ? 'mono'
            : style?.fontFamily === 'serif'
              ? 'serif'
              : 'sans'),
    });
  }
  return { targets, width: viewport.width, height: viewport.height };
}

// Conservative paragraph grouping: separate columns, font changes, headings,
// rotations and large vertical gaps remain independently editable.
export function editorParagraphs(
  targets: TextTarget[],
  width: number,
  height: number,
): TextTarget[] {
  const sorted = [...targets].sort((a, b) => a.y - b.y || a.x - b.x),
    groups: TextTarget[][] = [];
  const same = (a: TextTarget, b: TextTarget) =>
    !a.unsupportedReason &&
    !b.unsupportedReason &&
    !a.rotation &&
    !b.rotation &&
    a.origin === b.origin &&
    a.invisible === b.invisible &&
    a.originalFontId === b.originalFontId &&
    a.fontName === b.fontName &&
    a.family === b.family &&
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    a.color === b.color &&
    a.fill === b.fill &&
    Math.abs(a.fontSize - b.fontSize) < Math.max(0.5, a.fontSize * 0.08);
  for (const target of sorted) {
    const previous = groups.at(-1),
      last = previous?.at(-1);
    if (
      last &&
      same(last, target) &&
      Math.abs(last.y - target.y) * height < last.fontSize * 0.3 &&
      target.x >= last.x &&
      (target.x - last.x - last.w) * width < last.fontSize * 0.6
    )
      previous!.push(target);
    else groups.push([target]);
  }
  const merge = (parts: TextTarget[], separator: string): TextTarget => {
    if (parts.length === 1) return parts[0];
    const x = Math.min(...parts.map((p) => p.x)),
      y = Math.min(...parts.map((p) => p.y));
    return {
      ...parts[0],
      id: 'paragraph-' + parts.map((p) => p.id).join('-'),
      x,
      y,
      w: Math.max(...parts.map((p) => p.x + p.w)) - x,
      h: Math.max(...parts.map((p) => p.y + p.h)) - y,
      // Keep intentional line breaks and interior spacing on first edit.
      text: parts.map((p) => p.text.trim()).join(separator),
      fragments: parts.flatMap((p) => p.fragments || [p]),
      ...(separator === '\n'
        ? {
            lineHeight: Math.max(
              1,
              Math.min(3, ((parts[1].y - parts[0].y) * height) / parts[0].fontSize),
            ),
          }
        : {}),
      confidence: Math.min(...parts.map((p) => p.confidence ?? 100)),
    };
  };
  const paragraphs: TextTarget[][] = [];
  for (const line of groups.map((g) => merge(g, ' '))) {
    const previous = paragraphs.at(-1),
      last = previous?.at(-1);
    const gap = last ? ((line.y - last.y) * height) / last.fontSize : 0;
    if (
      last &&
      same(last, line) &&
      Math.abs(last.x - line.x) * width < last.fontSize * 0.65 &&
      gap >= 0.75 &&
      gap <= 1.65 &&
      last.w >= line.w * 0.65
    )
      previous!.push(line);
    else paragraphs.push([line]);
  }
  return paragraphs.map((p) => merge(p, '\n'));
}
