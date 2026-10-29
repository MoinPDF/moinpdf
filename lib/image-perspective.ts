import type { Point } from './advanced-media';
const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};
// Eight-parameter projective transform, output rectangle -> source quadrilateral.
export function homography(points: Point[], width: number, height: number) {
  if (points.length !== 4) throw new Error('Vier Ecken werden benötigt.');
  const dest = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dest[i],
      p = points[i];
    rows.push([x, y, 1, 0, 0, 0, -p.x * x, -p.x * y, p.x]);
    rows.push([0, 0, 0, x, y, 1, -p.y * x, -p.y * y, p.y]);
  }
  for (let i = 0; i < 8; i++) {
    let pivot = i;
    for (let j = i + 1; j < 8; j++) if (Math.abs(rows[j][i]) > Math.abs(rows[pivot][i])) pivot = j;
    [rows[i], rows[pivot]] = [rows[pivot], rows[i]];
    if (Math.abs(rows[i][i]) < 1e-9)
      throw new Error('Die Ecken bilden keinen gültigen Ausschnitt.');
    const value = rows[i][i];
    for (let k = i; k < 9; k++) rows[i][k] /= value;
    for (let j = 0; j < 8; j++)
      if (j !== i) {
        const factor = rows[j][i];
        for (let k = i; k < 9; k++) rows[j][k] -= rows[i][k] * factor;
      }
  }
  return rows.map((r) => r[8]);
}
export function perspectiveCanvas(
  source: HTMLCanvasElement,
  corners: Point[],
  maxSide = 2400,
  minSide = 30,
) {
  const p = corners.map((c) => ({ x: c.x * source.width, y: c.y * source.height }));
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  if (p.some((v, i) => cross(v, p[(i + 1) % 4], p[(i + 2) % 4]) <= 1))
    throw new Error(
      'Ecken im Uhrzeigersinn setzen: links oben, rechts oben, rechts unten, links unten.',
    );
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y),
    w = Math.round(Math.max(distance(p[0], p[1]), distance(p[3], p[2]))),
    h = Math.round(Math.max(distance(p[0], p[3]), distance(p[1], p[2])));
  if (w < minSide || h < minSide) throw new Error('Bitte einen größeren Ausschnitt wählen.');
  const scale = Math.min(1, maxSide / Math.max(w, h)),
    out = makeCanvas(w * scale, h * scale),
    m = homography(p, out.width, out.height),
    original = source.getContext('2d')!.getImageData(0, 0, source.width, source.height),
    ctx = out.getContext('2d')!,
    image = ctx.createImageData(out.width, out.height);
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const denominator = m[6] * x + m[7] * y + 1,
        sx = Math.max(0, Math.min(source.width - 1, (m[0] * x + m[1] * y + m[2]) / denominator)),
        sy = Math.max(0, Math.min(source.height - 1, (m[3] * x + m[4] * y + m[5]) / denominator)),
        x0 = Math.floor(sx),
        y0 = Math.floor(sy),
        x1 = Math.min(source.width - 1, x0 + 1),
        y1 = Math.min(source.height - 1, y0 + 1),
        fx = sx - x0,
        fy = sy - y0,
        at = (y * out.width + x) * 4;
      for (let c = 0; c < 3; c++)
        image.data[at + c] =
          original.data[(y0 * source.width + x0) * 4 + c] * (1 - fx) * (1 - fy) +
          original.data[(y0 * source.width + x1) * 4 + c] * fx * (1 - fy) +
          original.data[(y1 * source.width + x0) * 4 + c] * (1 - fx) * fy +
          original.data[(y1 * source.width + x1) * 4 + c] * fx * fy;
      image.data[at + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  return out;
}
