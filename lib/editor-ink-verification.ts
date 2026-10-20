import type { Source } from './pdf-engine';
import type { Mark, Rect } from './studio-engine';
import type { EditorFont } from './editor-fonts';
import { prepareEditorLayout } from './editor-layout-plan';

type Command = { command: string; args: number[] };
type OutlineFace = {
  unitsPerEm: number;
  layout: (
    text: string,
    features: Record<string, boolean>,
  ) => {
    glyphs: { advanceWidth: number; path: { commands: Command[] } }[];
  };
};
const faces = new WeakMap<EditorFont, Promise<OutlineFace>>();
function outlineFace(font: EditorFont) {
  let promise = faces.get(font);
  if (!promise) {
    promise = import('@pdf-lib/fontkit').then(
      (module) => module.default.create(font.bytes) as unknown as OutlineFace,
    );
    faces.set(font, promise);
  }
  return promise;
}
/** Independent reference: paint font outlines directly to Canvas, without PDF
 * text operators, embedding, or PDF.js's font conversion/rendering pipeline. */
export async function paintEditorReference(
  ctx: CanvasRenderingContext2D,
  mark: Mark,
  width: number,
  height: number,
  source: Source,
  signal: AbortSignal,
) {
  const plan = await prepareEditorLayout(mark, width, height, source);
  if (plan.overflow) throw new Error('Textfeld zu klein');
  ctx.save();
  try {
    ctx.scale(ctx.canvas.width / width, ctx.canvas.height / height);
    ctx.translate(plan.geometry.x, plan.geometry.y);
    ctx.rotate((plan.geometry.rotation * Math.PI) / 180);
    ctx.scale(plan.scaleX, 1);
    for (const piece of plan.pieces) {
      signal.throwIfAborted();
      const face = await outlineFace(piece.font);
      if (!Number.isFinite(face.unitsPerEm) || face.unitsPerEm <= 0)
        throw new Error('Schrift prüfen');
      const glyphs = face.layout(piece.text, { liga: false, kern: false, clig: false }).glyphs;
      let x = piece.x;
      ctx.fillStyle = piece.color;
      for (const glyph of glyphs) {
        ctx.save();
        try {
          ctx.translate(x, piece.y);
          const scale = piece.size / face.unitsPerEm;
          ctx.scale(scale, -scale);
          ctx.beginPath();
          for (const { command, args } of glyph.path.commands) {
            if (!args.every(Number.isFinite)) throw new Error('Schrift prüfen');
            switch (command) {
              case 'moveTo':
                ctx.moveTo(args[0], args[1]);
                break;
              case 'lineTo':
                ctx.lineTo(args[0], args[1]);
                break;
              case 'quadraticCurveTo':
                ctx.quadraticCurveTo(args[0], args[1], args[2], args[3]);
                break;
              case 'bezierCurveTo':
                ctx.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
                break;
              case 'closePath':
                ctx.closePath();
                break;
              default:
                throw new Error('Schrift prüfen');
            }
          }
          ctx.fill();
        } finally {
          ctx.restore();
        }
        x += (glyph.advanceWidth * piece.size) / face.unitsPerEm + piece.tracking;
      }
    }
  } finally {
    ctx.restore();
  }
}

/** Compare signed RGB ink coverage in a bounded edit region. One pixel of
 * positional tolerance accommodates grayscale/subpixel antialiasing. Coverage,
 * rather than a count of unmatched edge pixels, keeps thin glyph edges from
 * dominating the score; per-channel coverage still detects colour changes. */
export function compareEditorInk(
  background: ImageData,
  expected: ImageData,
  actual: ImageData,
  rect: Rect,
) {
  const { width, height } = background;
  if (
    expected.width !== width ||
    actual.width !== width ||
    expected.height !== height ||
    actual.height !== height
  )
    throw new Error('Seitenmaß verändert');
  const distance = (a: Uint8ClampedArray, b: Uint8ClampedArray, i: number, j = i) =>
    Math.max(Math.abs(a[i] - b[j]), Math.abs(a[i + 1] - b[j + 1]), Math.abs(a[i + 2] - b[j + 2]));
  const x0 = Math.max(0, Math.floor(rect.x * width) - 3),
    x1 = Math.min(width, Math.ceil((rect.x + rect.w) * width) + 3),
    y0 = Math.max(0, Math.floor(rect.y * height) - 3),
    y1 = Math.min(height, Math.ceil((rect.y + rect.h) * height) + 3);
  let expectedInk = 0,
    actualInk = 0,
    missing = 0,
    extra = 0,
    expectedCoverage = 0,
    actualCoverage = 0;
  let differenceLeft = width,
    differenceTop = height,
    differenceRight = 0,
    differenceBottom = 0;
  const locate = (x: number, y: number, coverage: number, loss: number) => {
    if (loss <= Math.max(90, coverage * 0.4)) return;
    differenceLeft = Math.min(differenceLeft, x);
    differenceTop = Math.min(differenceTop, y);
    differenceRight = Math.max(differenceRight, x + 1);
    differenceBottom = Math.max(differenceBottom, y + 1);
  };
  const uncovered = (from: Uint8ClampedArray, to: Uint8ClampedArray, x: number, y: number) => {
    const i = (y * width + x) * 4;
    const ink = [0, 1, 2].map((c) => background.data[i + c] - from[i + c]);
    const coverage = ink.reduce((sum, value) => sum + Math.abs(value), 0);
    let loss = coverage;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx,
          yy = y + dy;
        if (xx < x0 || xx >= x1 || yy < y0 || yy >= y1) continue;
        const j = (yy * width + xx) * 4;
        let difference = 0;
        for (let c = 0; c < 3; c++)
          difference += Math.max(
            0,
            Math.abs(ink[c]) - Math.sign(ink[c]) * (background.data[j + c] - to[j + c]),
          );
        loss = Math.min(loss, difference);
      }
    return { coverage, loss };
  };
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (distance(background.data, expected.data, i) > 40) {
        expectedInk++;
        const ink = uncovered(expected.data, actual.data, x, y);
        expectedCoverage += ink.coverage;
        missing += ink.loss;
        locate(x, y, ink.coverage, ink.loss);
      }
      if (distance(background.data, actual.data, i) > 40) {
        actualInk++;
        const ink = uncovered(actual.data, expected.data, x, y);
        actualCoverage += ink.coverage;
        extra += ink.loss;
        locate(x, y, ink.coverage, ink.loss);
      }
    }
  return {
    expectedInk,
    actualInk,
    missing: expectedCoverage ? missing / expectedCoverage : 0,
    extra: actualCoverage ? extra / actualCoverage : 0,
    differenceRect:
      differenceRight > differenceLeft
        ? {
            x: differenceLeft / width,
            y: differenceTop / height,
            w: (differenceRight - differenceLeft) / width,
            h: (differenceBottom - differenceTop) / height,
          }
        : undefined,
  };
}
