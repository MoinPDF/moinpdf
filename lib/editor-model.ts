import { editorSegments } from './editor-rich-text';
import { readPdfText } from './pdf-text';
import { StandardFonts } from 'pdf-lib';
import type { Source, PageItem } from './pdf-engine';
import type { Mark, Rect, EditorTextRun } from './studio-engine';
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
  /** Width/height of the unrotated text frame; disambiguates 45° bounds. */
  textAspect?: number;
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
  runs?: EditorTextRun[];
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
  delete appearance.flow;
  delete appearance.changeGroup;
  delete appearance.spellcheck;
  delete appearance.scanMatch;
  return JSON.stringify(appearance);
}
/** Changing the text is expected; changing typography invalidates its old evidence. */
export function editorScanStyleKey(mark: Mark) {
  return JSON.stringify([
    mark.fontChoice,
    mark.customFont?.name,
    mark.fontScale,
    mark.bold,
    mark.italic,
    mark.color,
    mark.textScaleX,
    mark.tracking,
    mark.baselineScale,
    mark.scanBlur,
    [...new Set((mark.runs || []).map((r) => JSON.stringify(r.style)))],
  ]);
}
export function editorScanMatchStatus(mark: Mark) {
  const match = mark.scanMatch;
  if (!match) return 'unavailable';
  if (match.styleKey !== editorScanStyleKey(mark)) return 'changed';
  return match.score <= 0.3 && (match.margin >= 0.01 || match.samples >= 3)
    ? 'matched'
    : 'uncertain';
}
export const editorMarkChanged = (mark: Mark) =>
  !mark.originalState || mark.originalState !== editorMarkSignature(mark);
export const editorRectsOverlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) >
  0.0000001;
export function editorImageCropBounds(rect: Rect, corners?: [number, number][], crop?: Rect): Rect {
  if (!crop) return rect;
  if (!corners || corners.length !== 3)
    throw new Error('Die Bildausrichtung konnte nicht gelesen werden.');
  const [a, b, c] = corners;
  const points = [
    [crop.x, crop.y],
    [crop.x + crop.w, crop.y],
    [crop.x, crop.y + crop.h],
    [crop.x + crop.w, crop.y + crop.h],
  ].map(([x, y]) => [
    a[0] + x * (b[0] - a[0]) + y * (c[0] - a[0]),
    a[1] + x * (b[1] - a[1]) + y * (c[1] - a[1]),
  ]);
  const x = Math.min(...points.map((p) => p[0])),
    y = Math.min(...points.map((p) => p[1]));
  return {
    x,
    y,
    w: Math.max(...points.map((p) => p[0])) - x,
    h: Math.max(...points.map((p) => p[1])) - y,
  };
}
export function editorTextCollision(mark: Mark, marks: Mark[], targets: TextTarget[]) {
  if (mark.kind !== 'text' || !mark.text || !editorMarkChanged(mark)) return false;
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

/** Repeated OCR passes can leave the same invisible word in several fonts with
 * different bounds. Keep one selection covering all of them: the narrower
 * search box may clip visible glyphs and cannot be used for scan matching.
 * Raw extraction stays intact for export preservation and text verification. */
export function editorSelectionTargets(targets: TextTarget[], width: number, height: number) {
  const result: TextTarget[] = [];
  const words = new Map<string, number[]>();
  for (const target of targets) {
    if (!target.invisible || target.rotation || target.unsupportedReason) {
      result.push(target);
      continue;
    }
    const key = target.text.trim(),
      indices = words.get(key) || [];
    const index = indices.find((i) => {
      const prior = result[i];
      const overlap =
        Math.max(
          0,
          Math.min(prior.x + prior.w, target.x + target.w) - Math.max(prior.x, target.x),
        ) *
        Math.max(0, Math.min(prior.y + prior.h, target.y + target.h) - Math.max(prior.y, target.y));
      return overlap / Math.min(prior.w * prior.h, target.w * target.h) >= 0.8;
    });
    if (index === undefined) {
      indices.push(result.length);
      words.set(key, indices);
      result.push(target);
      continue;
    }
    const prior = result[index],
      base = prior.w * prior.h >= target.w * target.h ? prior : target,
      x = Math.min(prior.x, target.x),
      y = Math.min(prior.y, target.y),
      w = Math.max(prior.x + prior.w, target.x + target.w) - x,
      h = Math.max(prior.y + prior.h, target.y + target.h) - y;
    result[index] = {
      ...base,
      id: prior.id,
      x,
      y,
      w,
      h,
      textAspect: (w * width) / (h * height),
      baselineScale: (base.baselineScale ?? 0.9) + ((base.y - y) * height) / base.fontSize,
      insetScale:
        (base.insetScale || 0) + ((base.x - x) * width) / (base.fontSize * (base.textScaleX || 1)),
    };
  }
  return result;
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
  const characterStyles = new Map<string, { text: string; color: string; invisible: boolean }[]>(),
    styleOffsets = new Map<string, number>();
  for (const run of typography?.runs || []) {
    const queue = characterStyles.get(run.fontKey) || [];
    for (const char of run.text)
      if (!/\s/u.test(char)) queue.push({ text: char, color: run.color, invisible: run.invisible });
    characterStyles.set(run.fontKey, queue);
  }
  function readStyles(font: string, text: string) {
    const queue = characterStyles.get(font),
      start = styleOffsets.get(font) || 0,
      chars = [...text].filter((c) => !/\s/u.test(c));
    if (!queue || chars.some((c, i) => queue[start + i]?.text !== c)) return [];
    styleOffsets.set(font, start + chars.length);
    const result: { start: number; end: number; color: string; invisible: boolean }[] = [];
    let index = 0,
      offset = 0;
    for (const char of text) {
      const style = queue[start + Math.min(index, chars.length - 1)];
      if (!style) continue;
      const last = result.at(-1);
      if (last && last.color === style.color && last.invisible === style.invisible)
        last.end = offset + char.length;
      else
        result.push({
          start: offset,
          end: offset + char.length,
          color: style.color,
          invisible: style.invisible,
        });
      if (!/\s/u.test(char)) index++;
      offset += char.length;
    }
    return result;
  }
  const targets: TextTarget[] = [];
  for (const [i, part] of content.items.entries()) {
    if (!('str' in part) || !part.str.trim()) continue;
    const t = part.transform,
      dx = v[0] * t[0] + v[2] * t[1],
      dy = v[1] * t[0] + v[3] * t[1];
    const angle = Math.atan2(dy, dx);
    const fontSize = Math.hypot(v[2] * t[3] + v[0] * t[2], v[3] * t[3] + v[1] * t[2]);
    if (
      !Number.isFinite(fontSize) ||
      fontSize <= 0 ||
      !t.every(Number.isFinite) ||
      !Number.isFinite(part.width) ||
      part.width < 0
    )
      continue;
    const style = content.styles[part.fontName],
      metricFont = originalEditorFont(source, typography?.fonts.get(part.fontName)?.originalId),
      // Some valid standard Type-1 and CFF fonts expose NaN PDF.js metrics.
      // Their normalized font program provides finite units-based metrics.
      ascent =
        Number.isFinite(style?.ascent) && style.ascent >= 0
          ? style.ascent
          : (metricFont?.ascent ?? 0.85),
      descent = Number.isFinite(style?.descent)
        ? Math.abs(style.descent)
        : (metricFont?.descent ?? 0.2),
      pad = Math.max(0.8, fontSize * 0.08);
    const px = v[0] * t[4] + v[2] * t[5] + v[4],
      baseline = v[1] * t[4] + v[3] * t[5] + v[5];
    const points = [
      [-pad, -fontSize * ascent - pad],
      [part.width + pad, -fontSize * ascent - pad],
      [-pad, fontSize * descent + pad],
      [part.width + pad, fontSize * descent + pad],
    ].map(([x, y]) => [
      px + x * Math.cos(angle) - y * Math.sin(angle),
      baseline + x * Math.sin(angle) + y * Math.cos(angle),
    ]);
    const left = Math.max(0, Math.min(...points.map((p) => p[0]))),
      top = Math.max(0, Math.min(...points.map((p) => p[1]))),
      right = Math.min(viewport.width, Math.max(...points.map((p) => p[0]))),
      bottom = Math.min(viewport.height, Math.max(...points.map((p) => p[1])));
    if (right <= left || bottom <= top) continue;
    const styled = readStyles(part.fontName, part.str);
    const run = runsForText.get(part.fontName + ':' + part.str.replace(/\s/gu, ''))?.pop(),
      invisible =
        run?.invisible ?? (fontsWithRuns.has(part.fontName) && !colorsForFont.has(part.fontName)),
      // An OCR search layer's invisible font is not the font in the scan.
      // Keep its native origin so export does not add a duplicate search layer.
      metadata = invisible ? undefined : typography?.fonts.get(part.fontName),
      font = originalEditorFont(source, metadata?.originalId),
      fontColors = colorsForFont.get(part.fontName),
      color =
        !invisible && styled.length
          ? styled[0].color
          : !invisible && run
            ? run.color
            : fontColors?.size === 1
              ? [...fontColors][0]
              : '#000000',
      scaleX = Math.hypot(dx, dy) / fontSize;
    const natural = font?.covers(part.str) ? font.measure(part.str, fontSize) * scaleX : part.width;
    const vx = v[0] * t[2] + v[2] * t[3],
      vy = v[1] * t[2] + v[3] * t[3],
      rotation = (angle * 180) / Math.PI;
    const unsupported =
      style?.vertical ||
      Math.abs(dx * vx + dy * vy) > Math.hypot(dx, dy) * fontSize * 0.02 ||
      dx * vy - dy * vx >= 0;
    const spacing =
      part.str.length > 1 ? (part.width - natural) / (part.str.length - 1) / fontSize / scaleX : 0;
    targets.push({
      id: `text-${i}`,
      text: part.str,
      ...(styled.length > 1
        ? { runs: styled.map((r) => ({ start: r.start, end: r.end, style: { color: r.color } })) }
        : {}),
      x: left / viewport.width,
      y: top / viewport.height,
      w: (right - left) / viewport.width,
      h: (bottom - top) / viewport.height,
      fontSize,
      origin: 'pdf',
      invisible: !!invisible,
      rotation,
      textAspect: (part.width + 2 * pad) / (fontSize * (ascent + descent) + 2 * pad),
      ...(unsupported
        ? {
            unsupportedReason:
              'Gespiegelter, gescherter oder vertikaler Text kann hier nicht zuverlässig bearbeitet werden. Bitte „PDF-Objekte bearbeiten“ verwenden.',
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
  mode: 'paragraph' | 'line' = 'paragraph',
): TextTarget[] {
  // Different font ascenders give adjacent glyphs different selection tops.
  // Cluster by their shared baseline first, then read each line left to right.
  const baseline = (target: TextTarget) =>
    target.y * height + (target.baselineScale ?? 0.9) * target.fontSize;
  const rows: TextTarget[][] = [];
  for (const target of [...targets].sort((a, b) => baseline(a) - baseline(b) || a.x - b.x)) {
    const row = rows.at(-1),
      anchor = row?.[0];
    if (
      anchor &&
      Math.abs(baseline(anchor) - baseline(target)) <=
        Math.min(anchor.fontSize, target.fontSize) * 0.2
    )
      row!.push(target);
    else rows.push([target]);
  }
  const sorted = rows.flatMap((row) => row.sort((a, b) => a.x - b.x)),
    groups: TextTarget[][] = [];
  const same = (a: TextTarget, b: TextTarget) =>
    !a.unsupportedReason &&
    !b.unsupportedReason &&
    !a.rotation &&
    !b.rotation &&
    a.origin === b.origin &&
    a.invisible === b.invisible &&
    a.fill === b.fill &&
    Math.abs(a.fontSize - b.fontSize) < Math.max(0.5, a.fontSize * 0.08);
  for (const target of sorted) {
    const previous = groups.at(-1),
      last = previous?.at(-1);
    if (
      last &&
      same(last, target) &&
      Math.abs(baseline(last) - baseline(target)) <=
        Math.min(last.fontSize, target.fontSize) * 0.2 &&
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
    let text = '';
    const runs: EditorTextRun[] = [];
    for (const [i, p] of parts.entries()) {
      if (i) {
        const previous = parts[i - 1];
        // Targets include selection padding. Measure the actual glyph gap so
        // a narrow space between different font faces is not swallowed.
        const gap =
          (p.x - previous.x - previous.w) * width +
          (previous.insetScale || 0) * previous.fontSize +
          (p.insetScale || 0) * p.fontSize;
        const join =
          separator === '\n'
            ? '\n'
            : /\s$/u.test(previous.text) || /^\s/u.test(p.text) || gap < previous.fontSize * 0.12
              ? ''
              : ' ';
        if (join) {
          runs.push({
            start: text.length,
            end: text.length + join.length,
            style: runs.at(-1)?.style || {},
          });
          text += join;
        }
      }
      const offset = text.length;
      const nested = editorSegments({
        runs: p.runs,
        text: p.text,
        fontScale: p.fontSize / width,
        fontFamily: p.family,
        fontChoice: 'auto',
        originalFontId: p.originalFontId,
        originalFontName: p.fontName,
        bold: !!p.bold,
        italic: !!p.italic,
        color: p.color || '#222222',
      });
      runs.push(...nested.map((r) => ({ ...r, start: r.start + offset, end: r.end + offset })));
      text += p.text;
    }
    return {
      ...parts[0],
      id: 'paragraph-' + parts.map((p) => p.id).join('-'),
      x,
      y,
      w: Math.max(...parts.map((p) => p.x + p.w)) - x,
      h: Math.max(...parts.map((p) => p.y + p.h)) - y,
      baselineScale: (baseline(parts[0]) - y * height) / parts[0].fontSize,
      // Keep intentional line breaks and interior spacing on first edit.
      text,
      runs,
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
  const lines = groups.map((g) => merge(g, ' '));
  if (mode === 'line') return lines;
  const tableRow = (line: TextTarget) =>
    line.w * width < line.fontSize * 14 &&
    lines.some(
      (peer) =>
        peer !== line &&
        Math.abs(peer.y - line.y) * height < line.fontSize * 0.3 &&
        (peer.x >= line.x + line.w || line.x >= peer.x + peer.w),
    );
  for (const line of lines) {
    // Follow the same column even when extraction interleaves left/right rows.
    // Require one unambiguous predecessor; table rows remain independent.
    const candidates = paragraphs.filter((group) => {
      const last = group.at(-1)!;
      const gap = ((line.y - last.y) * height) / last.fontSize;
      return (
        same(last, line) &&
        !!last.bold === !!line.bold &&
        !tableRow(last) &&
        !tableRow(line) &&
        Math.abs(last.x - line.x) * width < last.fontSize * 0.65 &&
        gap >= 0.75 &&
        gap <= 1.65 &&
        last.w >= line.w * 0.65
      );
    });
    if (candidates.length === 1) candidates[0].push(line);
    else paragraphs.push([line]);
  }
  return paragraphs.map((p) => merge(p, '\n'));
}
