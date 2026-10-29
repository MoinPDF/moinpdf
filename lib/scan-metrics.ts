export function scanMetrics(data: Uint8ClampedArray, width: number, height: number) {
  const gray = new Float32Array(width * height),
    hist = new Uint32Array(256),
    signature = Array<number>(256).fill(0),
    counts = Array<number>(256).fill(0);
  let ink = 0,
    edges = 0,
    edgeCount = 0,
    sharpness = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        j = i * 4,
        v = Math.round(0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]);
      gray[i] = v;
      hist[v]++;
      const cell =
        Math.min(15, Math.floor((y / height) * 16)) * 16 +
        Math.min(15, Math.floor((x / width) * 16));
      signature[cell] += 255 - v;
      counts[cell]++;
      if (v < 200) ink++;
      if (x < width * 0.012 || x > width * 0.988 || y < height * 0.012 || y > height * 0.988) {
        edgeCount++;
        if (v < 180) edges++;
      }
    }
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      sharpness += Math.abs(
        gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i],
      );
    }
  const percentile = (fraction: number) => {
    let n = 0;
    for (let i = 0; i < 256; i++) {
      n += hist[i];
      if (n >= width * height * fraction) return i;
    }
    return 255;
  };
  const contrast = (percentile(0.98) - percentile(0.02)) / 255,
    edgeInk = edges / Math.max(1, edgeCount);
  sharpness /= Math.max(1, (width - 2) * (height - 2));
  ink /= width * height;
  const score =
    ink < 0.002 ? 0 : Math.max(0, Math.min(100, sharpness * 3 + contrast * 35 - edgeInk * 40));
  return {
    signature: signature.map((v, i) => v / Math.max(1, counts[i]) / 255),
    score,
    sharpness,
    contrast,
    edgeInk,
    ink,
  };
}
