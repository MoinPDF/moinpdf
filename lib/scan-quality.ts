import { scanMetrics } from './scan-metrics';
import type { Rect } from './studio-engine';
export type ScanQualityIssue = { kind: 'blur' | 'contrast' | 'shadow' | 'edge'; rect: Rect };
export type ScanQuality = { issues: ScanQualityIssue[]; checked: boolean };
export const qualityLabels = {
  blur: 'Möglicherweise unscharf',
  contrast: 'Schwacher Kontrast',
  shadow: 'Ungleichmäßige Helligkeit / Schatten',
  edge: 'Inhalt nahe dem Seitenrand',
};
/** Conservative raster hints, never a claim that a scan is complete or readable. */
export function analyzeScanQuality(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): ScanQuality {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 8 ||
    height < 8 ||
    width * height > 2_000_000 ||
    pixels.length !== width * height * 4
  )
    throw new Error('Ungültiges Vorschaubild.');
  const issues: ScanQualityIssue[] = [];
  const global = scanMetrics(pixels, width, height);
  // Each region has independent contrast/sharpness. Solid photos and empty paper
  // are not treated as text; natural image blur can still need manual review.
  const cells: { rect: Rect; background: number; foreground: number }[] = [];
  for (let gy = 0; gy < 3; gy++)
    for (let gx = 0; gx < 3; gx++) {
      const x = Math.floor((gx * width) / 3),
        y = Math.floor((gy * height) / 3),
        w = Math.floor(((gx + 1) * width) / 3) - x,
        h = Math.floor(((gy + 1) * height) / 3) - y;
      const data = new Uint8ClampedArray(w * h * 4),
        hist = new Uint32Array(256);
      let foreground = 0;
      for (let row = 0; row < h; row++)
        for (let col = 0; col < w; col++) {
          const from = ((y + row) * width + x + col) * 4,
            to = (row * w + col) * 4;
          data.set(pixels.subarray(from, from + 4), to);
          const gray = Math.round((pixels[from] + pixels[from + 1] + pixels[from + 2]) / 3);
          hist[gray]++;
          if (gray < 245) foreground++;
        }
      let sum = 0,
        background = 255;
      for (let i = 0; i < 256; i++) {
        sum += hist[i];
        if (sum >= w * h * 0.65) {
          background = i;
          break;
        }
      }
      // The page-wide percentile used by scanMetrics can be white on both
      // ends of a sparse text cell. Measure its foreground against its paper
      // instead, so a few sharp black letters do not become "low contrast".
      let dark = 255,
        darkCount = 0;
      const darkTarget = Math.max(1, Math.ceil(foreground * 0.1));
      for (let i = 0; i < 245; i++) {
        darkCount += hist[i];
        if (darkCount >= darkTarget) {
          dark = i;
          break;
        }
      }
      const rect = { x: x / width, y: y / height, w: w / width, h: h / height },
        m = scanMetrics(data, w, h),
        contrast = Math.max(0, background - dark) / 255,
        density = foreground / (w * h);
      cells.push({ rect, background, foreground: density });
      if (density > 0.005 && density < 0.65) {
        if (contrast < 0.22 && m.sharpness > 0.05) issues.push({ kind: 'contrast', rect });
        if (contrast > 0.22 && m.sharpness < 1.6) issues.push({ kind: 'blur', rect });
      }
    }
  const bright = Math.max(...cells.map((c) => c.background));
  for (const cell of cells)
    if (bright - cell.background > 45 && cell.background < 225 && cell.foreground > 0.3)
      issues.push({ kind: 'shadow', rect: cell.rect });
  if (global.edgeInk > 0.06) {
    for (const rect of [
      { x: 0, y: 0, w: 1, h: 0.025 },
      { x: 0, y: 0.975, w: 1, h: 0.025 },
      { x: 0, y: 0, w: 0.025, h: 1 },
      { x: 0.975, y: 0, w: 0.025, h: 1 },
    ]) {
      let ink = 0,
        count = 0;
      for (
        let y = Math.floor(rect.y * height);
        y < Math.min(height, Math.ceil((rect.y + rect.h) * height));
        y++
      )
        for (
          let x = Math.floor(rect.x * width);
          x < Math.min(width, Math.ceil((rect.x + rect.w) * width));
          x++
        ) {
          const i = (y * width + x) * 4;
          count++;
          if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 180) ink++;
        }
      if (ink / Math.max(1, count) > 0.06) issues.push({ kind: 'edge', rect });
    }
  }
  return { checked: true, issues };
}
