/** Local OCR working images only. Never writes processed pixels into the PDF. */
export function estimateEditorSkew(canvas: HTMLCanvasElement) {
  const small = document.createElement('canvas'),
    scale = Math.min(1, 800 / canvas.width);
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  try {
    const ctx = small.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, small.width, small.height);
    const { data } = ctx.getImageData(0, 0, small.width, small.height),
      points: [number, number][] = [];
    for (let y = 2; y < small.height - 2; y++)
      for (let x = 2; x < small.width - 2; x += 2) {
        const i = (y * small.width + x) * 4;
        if (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722 < 120)
          points.push([x - small.width / 2, y - small.height / 2]);
      }
    if (points.length < 80 || points.length > small.width * small.height * 0.12) return 0;
    const score = (angle: number) => {
      const rad = (angle * Math.PI) / 180,
        s = Math.sin(rad),
        c = Math.cos(rad),
        bins = new Uint32Array(small.height + small.width + 8);
      for (const [x, y] of points) bins[Math.round(s * x + c * y + bins.length / 2)]++;
      return bins.reduce((sum, n) => sum + n * n, 0);
    };
    const base = score(0);
    let angle = 0,
      best = base;
    for (let a = -4; a <= 4; a += 0.25) {
      const value = score(a);
      if (value > best) {
        best = value;
        angle = a;
      }
    }
    return Math.abs(angle) < 0.5 || Math.abs(angle) >= 4 || best < base * 1.08 ? 0 : angle;
  } finally {
    small.width = small.height = 0;
  }
}
export function preprocessEditorScan(input: HTMLCanvasElement, angle = estimateEditorSkew(input)) {
  const work = document.createElement('canvas');
  work.width = input.width;
  work.height = input.height;
  const context = work.getContext('2d')!;
  context.drawImage(input, 0, 0);
  const pixels = context.getImageData(0, 0, work.width, work.height),
    { width, height } = work;
  // A coarse local background estimate removes broad shadows without applying
  // a destructive threshold to fine punctuation and diacritics.
  const gridWidth = Math.max(1, Math.ceil(width / 48)),
    gridHeight = Math.max(1, Math.ceil(height / 48)),
    background = new Float32Array(gridWidth * gridHeight);
  for (let gy = 0; gy < gridHeight; gy++)
    for (let gx = 0; gx < gridWidth; gx++) {
      const samples: number[] = [];
      for (let y = gy * 48; y < Math.min(height, (gy + 1) * 48); y += 3)
        for (let x = gx * 48; x < Math.min(width, (gx + 1) * 48); x += 3) {
          const i = (y * width + x) * 4;
          samples.push(
            pixels.data[i] * 0.2126 + pixels.data[i + 1] * 0.7152 + pixels.data[i + 2] * 0.0722,
          );
        }
      samples.sort((a, b) => a - b);
      background[gy * gridWidth + gx] = Math.max(
        100,
        samples[Math.floor(samples.length * 0.8)] || 255,
      );
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4,
        gx = Math.max(0, Math.min(gridWidth - 1, x / 48 - 0.5)),
        gy = Math.max(0, Math.min(gridHeight - 1, y / 48 - 0.5)),
        x0 = Math.floor(gx),
        y0 = Math.floor(gy),
        x1 = Math.min(gridWidth - 1, x0 + 1),
        y1 = Math.min(gridHeight - 1, y0 + 1),
        dx = gx - x0,
        dy = gy - y0;
      const bg =
        (background[y0 * gridWidth + x0] * (1 - dx) + background[y0 * gridWidth + x1] * dx) *
          (1 - dy) +
        (background[y1 * gridWidth + x0] * (1 - dx) + background[y1 * gridWidth + x1] * dx) * dy;
      const gray =
        pixels.data[i] * 0.2126 + pixels.data[i + 1] * 0.7152 + pixels.data[i + 2] * 0.0722;
      const value = Math.max(0, Math.min(255, (((gray / bg) * 255 - 16) * 255) / 239));
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
  // Remove only isolated dark pixels surrounded by near-white neighbours.
  const clean = new Uint8ClampedArray(pixels.data);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (pixels.data[i] >= 160) continue;
      let white = 0;
      for (let yy = -1; yy <= 1; yy++)
        for (let xx = -1; xx <= 1; xx++)
          if ((xx || yy) && pixels.data[((y + yy) * width + x + xx) * 4] > 235) white++;
      if (white === 8) clean[i] = clean[i + 1] = clean[i + 2] = 255;
    }
  pixels.data.set(clean);
  context.putImageData(pixels, 0, 0);
  const rad = (angle * Math.PI) / 180,
    c = Math.cos(rad),
    s = Math.sin(rad),
    canvas = document.createElement('canvas');
  canvas.width = Math.ceil(Math.abs(width * c) + Math.abs(height * s)) + 24;
  canvas.height = Math.ceil(Math.abs(height * c) + Math.abs(width * s)) + 24;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(work, -width / 2, -height / 2);
  work.width = work.height = 0;
  return {
    canvas,
    angle,
    restore: (x: number, y: number): [number, number] => {
      const dx = x - canvas.width / 2,
        dy = y - canvas.height / 2;
      return [c * dx + s * dy + width / 2, -s * dx + c * dy + height / 2];
    },
  };
}
export const ambiguousEditorNumber = (text: string) =>
  /\d/.test(text) && /[OIlSB]/.test(text) && /^[\dOIlSB.,:/+%€$£()\s-]+$/.test(text);
