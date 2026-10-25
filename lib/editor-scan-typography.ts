import type { Source, PageItem } from './pdf-engine';
import type { Mark } from './studio-engine';
import { abortable, renderPageRegion } from './pdf-engine';
import { editorStyle } from './editor-rich-text';
import { editorMarkSignature, editorScanStyleKey, editorRectsOverlap } from './editor-model';
import { editorFontCatalog } from './editor-font-catalog';
import { resolveEditorFont, type EditorFont } from './editor-fonts';
import { compareEditorFontShape, editorInkSignature, sampleEditorFont } from './editor-font-match';
import { matchEditorScanEdges } from './editor-scan';
import { prepareEditorLayout } from './editor-layout-plan';
import { paintEditorPlan } from './editor-ink-verification';
import { editorTextGeometry } from './editor-text-layer';

/** A scan has pixels, not a reusable font. Compare the unchanged original
 * before opening its editor, and retain the chosen face/geometry in the mark.
 * Never infer a new font from the user's replacement word or on every keystroke. */
export async function refineEditorScanTypography(
  mark: Mark,
  source: Source,
  page: Pick<PageItem, 'index' | 'rotation'>,
  width: number,
  height: number,
  signal: AbortSignal,
  references: Mark[] = [],
): Promise<Mark> {
  signal.throwIfAborted();
  const text = mark.originalText || mark.text || '';
  if (
    !mark.sourceIsScan ||
    !mark.sourceRect ||
    ((mark.textRotation || 0) % 90 && !mark.textAspect) ||
    !text.trim() ||
    (text.trim().length < 3 && references.length < 2) ||
    text.length > 120 ||
    text.includes('\n') ||
    // A line with mixed formatting needs per-run evidence, not one guessed face.
    new Set((mark.runs || []).map((r) => JSON.stringify(editorStyle(r.style)))).size > 1
  )
    return mark;
  const rendered = await renderPageRegion(source, page, mark.sourceRect, signal);
  const rotation = (((mark.textRotation || 0) % 360) + 360) % 360;
  const sourceGeometry = editorTextGeometry(
    { ...mark.sourceRect, textAspect: mark.textAspect },
    width,
    height,
    rotation,
  );
  const geometry = editorTextGeometry(mark, width, height, rotation);
  const radians = (rotation * Math.PI) / 180,
    cosine = Math.cos(radians),
    sine = Math.sin(radians);
  let upright = rendered.canvas;
  if (rotation) {
    upright = document.createElement('canvas');
    upright.width = Math.max(1, Math.ceil(sourceGeometry.width * rendered.scale));
    upright.height = Math.max(1, Math.ceil(sourceGeometry.height * rendered.scale));
    const context = upright.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, upright.width, upright.height);
    const dx = mark.sourceRect.x * width - sourceGeometry.x;
    const dy = mark.sourceRect.y * height - sourceGeometry.y;
    context.setTransform(
      cosine,
      -sine,
      sine,
      cosine,
      (cosine * dx + sine * dy) * rendered.scale,
      (-sine * dx + cosine * dy) * rendered.scale,
    );
    context.drawImage(rendered.canvas, 0, 0);
  }
  try {
    const ctx = upright.getContext('2d');
    if (!ctx) return mark;
    const reference = editorInkSignature(
      ctx.getImageData(0, 0, upright.width, upright.height),
      true,
    );
    if (!reference || reference.bounds.height < 12) return mark;
    // Additional samples must independently agree with the chosen face. Nearby
    // headings or different styles must never silently dictate a number's font.
    const peers: {
      text: string;
      signature: NonNullable<ReturnType<typeof editorInkSignature>>;
      scale: number;
    }[] = [];
    const seen = new Set([text]);
    const nearby = references
      .filter(
        (r) =>
          r.sourceIsScan &&
          r.sourceRect &&
          !r.textRotation &&
          !rotation &&
          !editorRectsOverlap(r.sourceRect, mark.sourceRect!) &&
          (r.originalText || '').trim().length >= 3 &&
          (r.originalText || '').length <= 80 &&
          !(r.originalText || '').includes('\n') &&
          new Set((r.runs || []).map((run) => JSON.stringify(editorStyle(run.style)))).size <= 1 &&
          Math.abs(r.y - mark.y) * height < Math.max(60, geometry.height * 5) &&
          r.h * height > geometry.height * 0.5 &&
          r.h * height < geometry.height * 1.8,
      )
      .sort(
        (a, b) =>
          Math.abs(a.y - mark.y) * height +
          Math.abs(a.x - mark.x) * width * 0.15 -
          Math.abs(b.y - mark.y) * height -
          Math.abs(b.x - mark.x) * width * 0.15,
      );
    for (const peer of nearby) {
      if (peers.length === 3) break;
      const peerText = peer.originalText!;
      if (seen.has(peerText)) continue;
      seen.add(peerText);
      const image = await renderPageRegion(source, page, peer.sourceRect!, signal);
      try {
        const signature = editorInkSignature(
          image.canvas
            .getContext('2d')!
            .getImageData(0, 0, image.canvas.width, image.canvas.height),
          true,
        );
        if (signature && signature.bounds.height >= 12)
          peers.push({ text: peerText, signature, scale: image.scale });
      } finally {
        image.canvas.width = image.canvas.height = 0;
      }
    }
    const choices = editorFontCatalog;
    const candidates: {
      choice: (typeof editorFontCatalog)[number];
      font: EditorFont;
      sample: NonNullable<Awaited<ReturnType<typeof sampleEditorFont>>>;
      score: number;
      peerScores: number[];
      support: number;
    }[] = [];
    for (const choice of choices) {
      signal.throwIfAborted();
      const faces = await Promise.all(
        [false, true].flatMap((bold) =>
          [false, true].map(async (italic) => {
            try {
              const { font } = await abortable(
                resolveEditorFont({
                  fontChoice: choice.id,
                  bold,
                  italic,
                  text,
                }),
                signal,
              );
              signal.throwIfAborted();
              const sample = await sampleEditorFont(font, text, signal, true);
              if (!sample) return null;
              const peerScores = await Promise.all(
                peers.map(async (peer) => {
                  if (!font.covers(peer.text)) return Infinity;
                  const other = await sampleEditorFont(font, peer.text, signal, true);
                  if (!other) return Infinity;
                  const size =
                    (reference.bounds.height / rendered.scale / sample.signature.bounds.height) *
                    sample.size;
                  const peerSize =
                    (peer.signature.bounds.height / peer.scale / other.signature.bounds.height) *
                    other.size;
                  return Math.abs(Math.log(peerSize / size)) > 0.22
                    ? Infinity
                    : compareEditorFontShape(peer.signature, other.signature);
                }),
              );
              return {
                choice,
                font,
                sample,
                score: compareEditorFontShape(reference, sample.signature),
                peerScores,
                support: 0,
              };
            } catch {
              signal.throwIfAborted();
              return null;
            }
          }),
        ),
      );
      candidates.push(...faces.filter((face) => face !== null));
      // Let touch/keyboard input and cancellation run between font families.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    candidates.sort((a, b) => a.score - b.score);
    const targetBest = candidates[0]?.score ?? Infinity;
    const peerBest = peers.map((_, i) => Math.min(...candidates.map((c) => c.peerScores[i])));
    for (const candidate of candidates) {
      candidate.support = candidate.peerScores.filter(
        (score, i) => score < 0.4 && score <= peerBest[i] + 0.035,
      ).length;
    }
    // Consensus may resolve close alternatives, but cannot override a clear
    // mismatch in the actual selected source region.
    candidates.sort((a, b) => {
      const score = (c: typeof a) =>
        c.score - (c.score <= targetBest + 0.06 && c.support >= 2 ? 0.045 : 0);
      return score(a) - score(b);
    });
    const best = candidates[0];
    if (!best || best.score > 0.55) return mark;
    if (text.trim().length < 3 && best.support < 2) return mark;
    const otherStyle = candidates.find(
      (c) => c.font.bold !== best.font.bold || c.font.italic !== best.font.italic,
    );
    if (!otherStyle || (otherStyle.score - best.score < 0.025 && best.support < 2)) return mark;
    const { sample, font, choice } = best;
    const ink = reference.bounds,
      sampleInk = sample.signature.bounds;
    const size = (ink.height / rendered.scale / sampleInk.height) * sample.size;
    const scaleX = ink.width / ink.height / (sampleInk.width / sampleInk.height);
    if (size < 3 || size > 96 || scaleX < 0.9 || scaleX > 1.1) return mark;
    // Recover the baseline and side bearing from the actual source glyphs.
    // A bounding-box height alone is not a font size (e.g. 2026 vs September).
    const baseline =
      ink.y / rendered.scale + ((sample.baseline - sampleInk.y) / sample.size) * size;
    const offsetX =
      ink.x / rendered.scale - ((sampleInk.x - sample.x) / sample.size) * size * scaleX;
    const originX = sourceGeometry.x + offsetX * cosine;
    const originY = sourceGeometry.y + offsetX * sine;
    const localWidth = Math.max(geometry.width - offsetX, font.measure(text, size) * scaleX);
    const localHeight = Math.max(geometry.height, baseline + font.descent * size);
    const x =
      (originX + Math.min(0, cosine * localWidth) + Math.min(0, -sine * localHeight)) / width;
    const y =
      (originY + Math.min(0, sine * localWidth) + Math.min(0, cosine * localHeight)) / height;
    const w = (Math.abs(cosine) * localWidth + Math.abs(sine) * localHeight) / width;
    const h = (Math.abs(sine) * localWidth + Math.abs(cosine) * localHeight) / height;
    if (x < 0 || y < 0 || x + w > 1 || y + h > 1 || baseline < 0 || baseline / size > 5)
      return mark;
    const style = {
      fontChoice: choice.id,
      fontFamily: choice.family,
      fontScale: size / width,
      bold: font.bold,
      italic: font.italic,
      color: reference.color,
    };
    const refined: Mark = {
      ...mark,
      ...style,
      x,
      y,
      w,
      h,
      textAspect: localWidth / localHeight,
      baselineScale: baseline / size,
      insetScale: 0,
      textScaleX: scaleX,
      tracking: 0,
      runs: mark.runs?.map((r) => ({ ...r, style: { ...r.style, ...style } })),
    };
    // Measure scan softness against the same original word, at a bounded
    // resolution. Never learn appearance from a replacement or another field.
    const original = document.createElement('canvas'),
      candidate = document.createElement('canvas');
    const factor = Math.min(1, 700 / rendered.canvas.width, 180 / rendered.canvas.height);
    original.width = candidate.width = Math.max(1, Math.floor(rendered.canvas.width * factor));
    original.height = candidate.height = Math.max(1, Math.floor(rendered.canvas.height * factor));
    try {
      const a = original.getContext('2d')!,
        b = candidate.getContext('2d')!;
      a.drawImage(rendered.canvas, 0, 0, original.width, original.height);
      const scale = rendered.scale * factor;
      b.scale(scale, scale);
      b.translate(-mark.sourceRect.x * width, -mark.sourceRect.y * height);
      const plan = await prepareEditorLayout(refined, width, height, source);
      if (!plan.overflow) {
        await paintEditorPlan(b, plan, signal);
        const matched = matchEditorScanEdges(
          a.getImageData(0, 0, original.width, original.height),
          b.getImageData(0, 0, candidate.width, candidate.height),
          size * scale,
          signal,
        );
        // Subpixel raster interpolation on a sharp scan is not scanner blur.
        if (matched && matched.sigma / scale >= 0.15 && !rotation) {
          refined.scanBlur = matched.sigma / scale / size;
          const dx = matched.dx / scale / width;
          if (refined.x + dx >= 0 && refined.x + dx + refined.w <= 1) {
            refined.x += dx;
            refined.w = Math.max(refined.w, w - dx);
          }
          refined.baselineScale = (baseline + matched.dy / scale) / size;
        }
      }
    } finally {
      original.width = original.height = candidate.width = candidate.height = 0;
    }
    // Selecting a scan must still be a no-op until the user changes its text.
    refined.scanMatch = {
      score: best.score,
      margin: Math.max(
        0,
        Math.min(10, Math.min(...candidates.slice(1).map((c) => c.score)) - best.score),
      ),
      samples: 1 + best.support,
      candidates: candidates.length,
      styleKey: editorScanStyleKey(refined),
    };
    refined.originalState = editorMarkSignature(refined);
    return refined;
  } finally {
    rendered.canvas.width = rendered.canvas.height = 0;
    if (upright !== rendered.canvas) upright.width = upright.height = 0;
  }
}
