import type { Rect } from './studio-engine';
import type { Point } from './advanced-media';

/** Optional geometry keeps rectangular crops from existing projects usable. */
export type ScanPhoto = Rect & {
  corners?: Point[];
  rotation?: number;
  uncertain?: boolean;
};
export type PhotoDetection = { regions: ScanPhoto[]; limited: boolean };
export const photoCorners = (r: ScanPhoto): Point[] =>
  r.corners ?? [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
export function photoBounds(corners: Point[]): Rect {
  const x = Math.min(...corners.map((p) => p.x)),
    y = Math.min(...corners.map((p) => p.y));
  return {
    x,
    y,
    w: Math.max(...corners.map((p) => p.x)) - x,
    h: Math.max(...corners.map((p) => p.y)) - y,
  };
}
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function validPhoto(r: ScanPhoto) {
  if (!r.corners && (![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.w < 0.01 || r.h < 0.01))
    return false;
  const points = photoCorners(r);
  return (
    [0, 90, 180, 270].includes(r.rotation ?? 0) &&
    points.length === 4 &&
    points.every(
      (p, i) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 0 &&
        p.y >= 0 &&
        p.x <= 1 &&
        p.y <= 1 &&
        cross(p, points[(i + 1) % 4], points[(i + 2) % 4]) > 0.0001,
    )
  );
}
function hull(points: Point[]) {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (values: Point[]) => {
    const result: Point[] = [];
    for (const p of values) {
      while (
        result.length > 1 &&
        cross(result[result.length - 2], result[result.length - 1], p) <= 0
      )
        result.pop();
      result.push(p);
    }
    result.pop();
    return result;
  };
  return [...half(points), ...half([...points].reverse())];
}
/** Minimum-area enclosing rectangle of a component contour, in pixel space.
 * Axis projections alone cannot separate diagonally staggered photographs. */
function fittedRectangle(points: Point[]) {
  let best: { area: number; corners: Point[] } | undefined;
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length],
      angle = Math.atan2(q.y - p.y, q.x - p.x);
    const c = Math.cos(angle),
      s = Math.sin(angle);
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const v of points) {
      const x = v.x * c + v.y * s,
        y = -v.x * s + v.y * c;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const area = (x1 - x0) * (y1 - y0);
    if (!best || area < best.area) {
      // Include the outer pixel extent without a large scanner-background rim.
      const corners = [
        { x: x0 - 0.5, y: y0 - 0.5 },
        { x: x1 + 0.5, y: y0 - 0.5 },
        { x: x1 + 0.5, y: y1 + 0.5 },
        { x: x0 - 0.5, y: y1 + 0.5 },
      ].map((v) => ({ x: v.x * c - v.y * s, y: v.x * s + v.y * c }));
      let start = 0;
      for (let j = 1; j < 4; j++)
        if (corners[j].x + corners[j].y < corners[start].x + corners[start].y) start = j;
      best = { area, corners: [...corners.slice(start), ...corners.slice(0, start)] };
    }
  }
  return best;
}

/** Deterministic, local foreground segmentation. The dominant scanner-border
 * colour estimates the bed (white, gray or dark). Separate components exploit
 * gaps in any direction; a small closing bridges dust holes and thin highlights.
 * Deliberately conservative: touching photos may remain one uncertain proposal. */
export function detectScanPhotos(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  sensitivity = 18,
): PhotoDetection {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 2000000 ||
    pixels.length !== width * height * 4
  )
    throw new Error('Ungültiges Vorschaubild.');
  if (!Number.isFinite(sensitivity) || sensitivity < 6 || sensitivity > 60)
    throw new Error('Die Kontrastschwelle muss zwischen 6 und 60 liegen.');
  // Composite transparent inputs against the same white bed used by PDF rendering.
  const channel = (at: number, c: number) =>
    pixels[at * 4 + c] * (pixels[at * 4 + 3] / 255) + 255 * (1 - pixels[at * 4 + 3] / 255);
  const bins = new Map<string, number[]>();
  const rim = Math.max(1, Math.floor(Math.min(width, height) * 0.015));
  for (let y = 0; y < height; y += 2)
    for (let x = 0; x < width; x += 2) {
      if (x >= rim && x < width - rim && y >= rim && y < height - rim) continue;
      const at = y * width + x,
        key = [0, 1, 2].map((c) => Math.floor(channel(at, c) / 16)).join(':');
      const bin = bins.get(key) ?? [];
      bin.push(at);
      bins.set(key, bin);
    }
  const samples = [...bins.values()].sort((a, b) => b.length - a.length)[0] ?? [0];
  const background = [0, 1, 2].map((c) => {
    const values = samples.map((at) => channel(at, c)).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
  const size = width * height,
    mask = new Uint8Array(size),
    difference = new Uint8Array(size);
  for (let at = 0; at < size; at++) {
    const d = Math.max(...background.map((v, c) => Math.abs(channel(at, c) - v)));
    difference[at] = Math.round(d);
    mask[at] = d >= sensitivity ? 1 : 0;
  }
  // Close one-pixel cracks without merging photographs separated by a visible gap.
  const dilated = new Uint8Array(size);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (mask[at + dy * width + dx]) dilated[at] = 1;
    }
  for (let y = 2; y < height - 2; y++)
    for (let x = 2; x < width - 2; x++) {
      const at = y * width + x;
      let filled = 1;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (!dilated[at + dy * width + dx]) filled = 0;
      mask[at] = filled;
    }
  const queue = new Uint32Array(size),
    regions: ScanPhoto[] = [];
  let limited = false;
  for (let seed = 0; seed < size; seed++) {
    if (!mask[seed]) continue;
    let end = 1,
      contrast = 0;
    queue[0] = seed;
    mask[seed] = 0;
    const rows = new Map<number, [number, number]>();
    for (let head = 0; head < end; head++) {
      const at = queue[head],
        x = at % width,
        y = Math.floor(at / width);
      contrast += difference[at];
      const row = rows.get(y);
      if (row) {
        row[0] = Math.min(row[0], x);
        row[1] = Math.max(row[1], x);
      } else rows.set(y, [x, x]);
      // No wrapping across the left/right image boundaries.
      for (const n of [
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
        y > 0 ? at - width : -1,
        y < height - 1 ? at + width : -1,
      ])
        if (n >= 0 && mask[n]) {
          mask[n] = 0;
          queue[end++] = n;
        }
    }
    if (end < Math.max(36, size * 0.002)) continue; // dust, not small photographs
    const contour = hull(
      [...rows].flatMap(([y, [left, right]]) => [
        { x: left, y },
        { x: right, y },
      ]),
    );
    const fit = fittedRectangle(contour);
    if (!fit || fit.area < size * 0.003 || fit.area > size * 0.93) continue;
    const clipped = fit.corners.some(
      (p) => p.x < 1 || p.y < 1 || p.x > width - 2 || p.y > height - 2,
    );
    const corners = fit.corners.map((p) => ({
      x: Math.max(0, Math.min(1, p.x / width)),
      y: Math.max(0, Math.min(1, p.y / height)),
    }));
    const bounds = photoBounds(corners);
    if (bounds.w < 0.025 || bounds.h < 0.025) continue;
    const region = {
      ...bounds,
      corners,
      rotation: 0,
      uncertain: clipped || end / fit.area < 0.9 || contrast / end < 32,
    };
    if (!validPhoto(region)) continue;
    if (regions.length === 32) {
      limited = true;
      continue;
    }
    regions.push(region);
  }
  // Stable reading order, independent of connected-component traversal order.
  regions.sort((a, b) => (Math.abs(a.y - b.y) > 0.03 ? a.y - b.y : a.x - b.x));
  return { regions, limited };
}
