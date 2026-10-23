/** Local, bounded visual ranking. Scores are suggestions, never font identities. */
import type { Mark } from './studio-engine';
import type { Source, PageItem } from './pdf-engine';
import type { EditorFont } from './editor-fonts';
import { renderPageRegion } from './pdf-engine';
import { editorFontPage, originalEditorFont } from './editor-fonts';

type Pixels = { width: number; height: number; data: Uint8ClampedArray };
export type EditorInkSignature = {
  mask: Uint8Array;
  aspect: number;
  density: number;
  color: string;
  bounds: { x: number; y: number; width: number; height: number };
};
const W = 256,
  H = 40;
export function editorInkSignature(image: Pixels, coreGeometry = false): EditorInkSignature | null {
  const { width, height, data } = image;
  if (width < 2 || height < 2 || width * height > 4000000 || data.length !== width * height * 4)
    return null;
  const edges: number[][] = [[], [], []];
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 64)))
    for (const y of [0, height - 1])
      for (let c = 0; c < 3; c++) edges[c].push(data[(y * width + x) * 4 + c]);
  const bg = edges.map((channel) => channel.sort((a, b) => a - b)[Math.floor(channel.length / 2)]);
  const distance = (at: number) =>
    Math.hypot(data[at] - bg[0], data[at + 1] - bg[1], data[at + 2] - bg[2]);
  const edgeNoise = edges.reduce(
    (sum, channel, c) =>
      sum + channel.reduce((n, v) => n + Math.abs(v - bg[c]), 0) / channel.length,
    0,
  );
  if (edgeNoise > 90) return null;
  // Scan halos are not glyph outlines. Use the middle of the local paper/ink
  // contrast for typography geometry; retain the permissive mask elsewhere.
  let threshold = Math.max(55, edgeNoise * 2);
  if (coreGeometry) {
    const contrasts: number[] = [];
    const stride = Math.max(1, Math.floor((width * height) / 16384));
    for (let at = 0; at < width * height; at += stride)
      if (data[at * 4 + 3] > 200 && distance(at * 4) > threshold) contrasts.push(distance(at * 4));
    contrasts.sort((a, b) => b - a);
    threshold = Math.max(edgeNoise * 2, (contrasts[Math.floor(contrasts.length * 0.1)] || 110) / 2);
  }
  let left = width,
    right = -1,
    top = height,
    bottom = -1,
    ink = 0;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = y * width + x;
      if (data[at * 4 + 3] > 200 && distance(at * 4) > threshold) {
        mask[at] = 1;
        ink++;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  if (ink < 12 || right - left < 2 || bottom - top < 2) return null;
  const bw = right - left + 1,
    bh = bottom - top + 1,
    density = ink / (bw * bh);
  if (density < 0.02 || density > 0.75 || bw / bh < 0.15 || bw / bh > 120) return null;
  const normalized = new Uint8Array(W * H);
  // Area coverage retains thin stems when a long sample is downsampled.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const x0 = left + Math.floor((x * bw) / W),
        x1 = Math.min(
          right + 1,
          left + Math.max(Math.floor((x * bw) / W) + 1, Math.ceil(((x + 1) * bw) / W)),
        );
      const y0 = top + Math.floor((y * bh) / H),
        y1 = Math.min(
          bottom + 1,
          top + Math.max(Math.floor((y * bh) / H) + 1, Math.ceil(((y + 1) * bh) / H)),
        );
      let count = 0,
        total = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          count += mask[yy * width + xx];
          total++;
        }
      normalized[y * W + x] = Math.round((255 * count) / Math.max(1, total));
    }
  // Sample solid glyph interiors, not antialiased edges or the scan background.
  // Bound the sample independently of the rendered region's pixel count.
  const colors: { rgb: number[]; contrast: number }[] = [];
  const step = Math.max(1, Math.ceil((width * height) / 8192));
  for (let at = 0; at < mask.length; at += step)
    if (mask[at])
      colors.push({ rgb: [...data.subarray(at * 4, at * 4 + 3)], contrast: distance(at * 4) });
  colors.sort((a, b) => b.contrast - a.contrast);
  const core = colors.slice(0, Math.max(1, Math.ceil(colors.length / 4)));
  const color =
    '#' +
    [0, 1, 2]
      .map((c) => {
        const channel = core.map((p) => p.rgb[c]).sort((a, b) => a - b);
        return (channel[Math.floor(channel.length / 2)] ?? 0).toString(16).padStart(2, '0');
      })
      .join('');
  return {
    mask: normalized,
    aspect: bw / bh,
    density,
    color,
    bounds: { x: left, y: top, width: bw, height: bh },
  };
}
export function compareEditorFontShape(a: EditorInkSignature, b: EditorInkSignature) {
  let difference = 0,
    ink = 0;
  for (let i = 0; i < a.mask.length; i++) {
    difference += Math.abs(a.mask[i] - b.mask[i]);
    ink += Math.max(a.mask[i], b.mask[i]);
  }
  return (
    difference / Math.max(1, ink) +
    0.4 * Math.abs(Math.log(a.aspect / b.aspect)) +
    0.3 * Math.abs(a.density - b.density)
  );
}
/** A single scalar ordering is transitive even if only some candidates could
 * be compared visually. Fit is always the primary constraint. */
export function editorFontMatchScore(value: {
  shape?: number;
  difference: number;
  overflow: boolean;
}) {
  return (
    (value.overflow ? 100 : 0) +
    (Number.isFinite(value.shape)
      ? value.shape! + Math.min(1, value.difference) * 0.25
      : 4 + Math.min(2, value.difference))
  );
}
export async function sampleEditorFont(
  font: EditorFont,
  text: string,
  signal: AbortSignal,
  core = false,
) {
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  const face = fontkit.create(font.bytes) as unknown as {
    unitsPerEm: number;
    glyphForCodePoint: (code: number) => {
      advanceWidth: number;
      path: { commands: { command: string; args: number[] }[] };
    };
  };
  const size = Math.min(64, 4000 / Math.max(1, font.measure(text, 1)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(font.measure(text, size) + 16);
  canvas.height = Math.ceil((font.ascent + font.descent) * size + 20);
  if (canvas.width * canvas.height > 1000000) {
    canvas.width = canvas.height = 0;
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    let x = 8;
    const y = 10 + font.ascent * size;
    for (const character of text) {
      signal.throwIfAborted();
      const glyph = face.glyphForCodePoint(character.codePointAt(0)!);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / face.unitsPerEm, -size / face.unitsPerEm);
      ctx.beginPath();
      for (const { command, args } of glyph.path.commands) {
        if (command === 'moveTo') ctx.moveTo(args[0], args[1]);
        else if (command === 'lineTo') ctx.lineTo(args[0], args[1]);
        else if (command === 'quadraticCurveTo')
          ctx.quadraticCurveTo(args[0], args[1], args[2], args[3]);
        else if (command === 'bezierCurveTo')
          ctx.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
        else if (command === 'closePath') ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
      x += (glyph.advanceWidth * size) / face.unitsPerEm;
    }
    const signature = editorInkSignature(ctx.getImageData(0, 0, canvas.width, canvas.height), core);
    return signature ? { signature, size, x: 8, baseline: y } : null;
  } finally {
    canvas.width = canvas.height = 0;
  }
}
async function sampleSignature(font: EditorFont, text: string, signal: AbortSignal) {
  return (await sampleEditorFont(font, text, signal))?.signature ?? null;
}
export async function prepareEditorFontMatch(
  mark: Mark,
  source: Source,
  page: Pick<PageItem, 'index' | 'rotation'>,
  signal: AbortSignal,
  sample?: { text: string; originalFontId?: string; originalFontPage?: number },
) {
  const text = (sample?.text || mark.originalText)?.trim();
  const fontId = sample?.originalFontId || mark.originalFontId;
  const fontPage = sample?.originalFontPage ?? mark.originalFontPage;
  if (fontId && fontPage !== undefined && !originalEditorFont(source, fontId))
    await editorFontPage(source, fontPage);
  const face = originalEditorFont(source, fontId);
  if (text && text.length <= 160 && !text.includes('\n') && face?.covers(text)) {
    const reference = await sampleSignature(face, text, signal);
    if (reference)
      return async (font: EditorFont) => {
        signal.throwIfAborted();
        if (!font.covers(text)) return undefined;
        const candidate = await sampleSignature(font, text, signal);
        return candidate ? compareEditorFontShape(reference, candidate) : undefined;
      };
  }
  if (sample) return null; // Never compare a selection to an unrelated full-line image.
  if (
    !mark.sourceRect ||
    !text ||
    text.length > 160 ||
    text.includes('\n') ||
    mark.textRotation ||
    (mark.runs?.length || 0) > 1
  )
    return null;
  const original = await renderPageRegion(source, page, mark.sourceRect, signal);
  let signature: EditorInkSignature | null;
  try {
    const ctx = original.canvas.getContext('2d');
    signature = ctx
      ? editorInkSignature(ctx.getImageData(0, 0, original.canvas.width, original.canvas.height))
      : null;
  } finally {
    original.canvas.width = original.canvas.height = 0;
  }
  if (!signature) return null;
  return async (font: EditorFont) => {
    signal.throwIfAborted();
    if (!font.covers(text)) return undefined;
    const candidate = await sampleSignature(font, text, signal);
    return candidate ? compareEditorFontShape(signature!, candidate) : undefined;
  };
}
