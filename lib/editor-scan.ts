/** Local scan analysis. OCR preprocessing never replaces original PDF pixels. */
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

/** Bounded separable Gaussian used for measured scan edges, never whole pages. */
export function blurEditorScanChannel(
  input: Float32Array,
  width: number,
  height: number,
  sigma: number,
) {
  if (!Number.isFinite(sigma) || sigma <= 0) return input;
  if (input.length !== width * height || input.length > 4000000 || sigma > 24)
    throw new Error('Ungültiger Scanbereich.');
  const radius = Math.ceil(sigma * 3),
    kernel = Array.from({ length: radius * 2 + 1 }, (_, i) =>
      Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)),
    ),
    sum = kernel.reduce((a, b) => a + b, 0),
    temp = new Float32Array(input.length),
    output = new Float32Array(input.length);
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let d = -radius; d <= radius; d++)
        if (x + d >= 0 && x + d < width) value += input[y * width + x + d] * kernel[d + radius];
      temp[y * width + x] = value;
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let d = -radius; d <= radius; d++)
        if (y + d >= 0 && y + d < height) value += temp[(y + d) * width + x] * kernel[d + radius];
      output[y * width + x] = value;
    }
  return output;
}

export function editorScanBlur(
  mark: { sourceIsScan?: boolean; scanBlur?: number; fontScale?: number; textRotation?: number },
  width: number,
) {
  const value = mark.scanBlur;
  return mark.sourceIsScan &&
    !mark.textRotation &&
    Number.isFinite(value) &&
    value! > 0 &&
    value! <= 0.06
    ? value! * (mark.fontScale || 0.028) * width
    : 0;
}

/** Compare the original scan with the same unedited word. A soft edge is
 * accepted only when it measurably improves a close match over sharp text. */
export function matchEditorScanEdges(
  original: ImageData,
  candidate: ImageData,
  fontPixels: number,
  signal: AbortSignal,
) {
  const { width, height } = original;
  if (width !== candidate.width || height !== candidate.height || width * height > 140000)
    return null;
  const gray = (data: Uint8ClampedArray, at: number) =>
    data[at] * 0.2126 + data[at + 1] * 0.7152 + data[at + 2] * 0.0722;
  const edge: number[] = [],
    dark: number[] = [];
  for (let x = 0; x < width; x++)
    for (const y of [0, height - 1]) edge.push(gray(original.data, (y * width + x) * 4));
  edge.sort((a, b) => a - b);
  const paper = edge[Math.floor(edge.length / 2)];
  for (let at = 0; at < width * height; at++) {
    const v = gray(original.data, at * 4);
    if (paper - v > 40) dark.push(v);
  }
  dark.sort((a, b) => a - b);
  const contrast = paper - dark[Math.floor(dark.length * 0.1)];
  if (!Number.isFinite(contrast) || contrast < 60) return null;
  const reference = new Float32Array(width * height),
    sharp = new Float32Array(reference.length);
  let energy = 0;
  for (let at = 0; at < reference.length; at++) {
    reference[at] = Math.max(0, Math.min(1, (paper - gray(original.data, at * 4)) / contrast));
    sharp[at] = candidate.data[at * 4 + 3] / 255;
    energy += reference[at] ** 2;
  }
  if (energy < 20) return null;
  const score = (pixels: Float32Array, dx: number, dy: number) => {
    let error = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const xx = x - dx,
          yy = y - dy;
        const value = xx >= 0 && xx < width && yy >= 0 && yy < height ? pixels[yy * width + xx] : 0;
        error += (reference[y * width + x] - value) ** 2;
      }
    return error / energy;
  };
  let best = { score: Infinity, sigma: 0, dx: 0, dy: 0 },
    sharpScore = Infinity;
  const maximum = Math.min(6, fontPixels * 0.055);
  const evaluate = (sigma: number) => {
    signal.throwIfAborted();
    const pixels = blurEditorScanChannel(sharp, width, height, sigma);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const value = score(pixels, dx, dy);
        if (sigma === 0) sharpScore = Math.min(sharpScore, value);
        if (value < best.score) best = { score: value, sigma, dx, dy };
      }
  };
  for (const sigma of [0, ...[0.2, 0.4, 0.6, 0.8, 1].map((n) => n * maximum)]) evaluate(sigma);
  if (best.sigma > 0) {
    for (const step of [0.1, 0.05]) {
      const center = best.sigma;
      for (const sigma of [center - maximum * step, center + maximum * step])
        if (sigma > 0 && sigma <= maximum) evaluate(sigma);
    }
  }
  return best.sigma >= 0.6 && best.score < 0.2 && best.score < sharpScore * 0.82 ? best : null;
}

/** Premultiplied colour prevents dark fringes on coloured or transparent paper. */
export function softenEditorScanText(canvas: HTMLCanvasElement, sigma: number) {
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
    n = canvas.width * canvas.height;
  const channels = Array.from({ length: 4 }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const alpha = pixels.data[i * 4 + 3] / 255;
    channels[3][i] = alpha;
    for (let c = 0; c < 3; c++) channels[c][i] = pixels.data[i * 4 + c] * alpha;
  }
  const blurred = channels.map((channel) =>
    blurEditorScanChannel(channel, canvas.width, canvas.height, sigma),
  );
  for (let i = 0; i < n; i++) {
    const alpha = blurred[3][i];
    pixels.data[i * 4 + 3] = Math.round(alpha * 255);
    for (let c = 0; c < 3; c++) pixels.data[i * 4 + c] = alpha > 0.001 ? blurred[c][i] / alpha : 0;
  }
  ctx.putImageData(pixels, 0, 0);
}

/** Replace only selected pixels. Reconstruct paper from the outside border;
 * retain a crossing rule only when BOTH opposite edges independently show it. */
export function eraseEditorScanRegion(
  canvas: HTMLCanvasElement,
  rect: { x: number; y: number; w: number; h: number },
  mode: 'preserve' | 'solid' = 'preserve',
  fill = '#ffffff',
) {
  const { width, height } = canvas;
  // Normalized coordinates may round an exact pixel boundary down by a few
  // ulps after tile translation. Do not erase the adjacent original pixel.
  const x0 = Math.max(0, Math.floor(rect.x * width + 1e-7)),
    y0 = Math.max(0, Math.floor(rect.y * height + 1e-7)),
    x1 = Math.min(width, Math.ceil((rect.x + rect.w) * width - 1e-7)),
    y1 = Math.min(height, Math.ceil((rect.y + rect.h) * height - 1e-7));
  if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0)
    throw new Error('Ungültiger Scanbereich.');
  // A small correction only reads its own pixels plus a one-pixel border.
  // This avoids two whole-page RGBA copies on a high-resolution scan.
  const readX = Math.max(0, x0 - 1),
    readY = Math.max(0, y0 - 1),
    readWidth = Math.min(width, x1 + 1) - readX,
    readHeight = Math.min(height, y1 + 1) - readY;
  const context = canvas.getContext('2d')!,
    image = context.getImageData(readX, readY, readWidth, readHeight),
    original = new Uint8ClampedArray(image.data);
  const color = /^#[a-f\d]{6}$/i.test(fill) ? fill : '#ffffff';
  const solid = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const pixel = (x: number, y: number) => {
    const at = ((y - readY) * readWidth + x - readX) * 4;
    return [original[at], original[at + 1], original[at + 2]];
  };
  const sample = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? solid : pixel(x, y);
  const line = (a: number[], b: number[]) =>
    Math.max(...a) < 180 && Math.max(...b) < 180 && a.every((v, i) => Math.abs(v - b[i]) <= 28);
  const edge = x0 > 0 && y0 > 0 && x1 < width && y1 < height;
  const paper = (samples: number[][]) => {
    const clean = samples.filter((p) => Math.min(...p) >= 180);
    return clean.length
      ? solid.map((_, c) => clean.reduce((n, p) => n + p[c], 0) / clean.length)
      : solid;
  };
  const horizontal = new Set<number>(),
    vertical = new Set<number>();
  if (mode === 'preserve' && edge) {
    for (let y = y0; y < y1; y++) {
      const a = pixel(x0 - 1, y),
        b = pixel(x1, y);
      if (
        line(a, b) &&
        (() => {
          for (let x = x0; x < x1; x++) if (!line(a, pixel(x, y))) return false;
          return true;
        })()
      )
        horizontal.add(y);
    }
    for (let x = x0; x < x1; x++) {
      const a = pixel(x, y0 - 1),
        b = pixel(x, y1);
      if (
        line(a, b) &&
        (() => {
          for (let y = y0; y < y1; y++) if (!line(a, pixel(x, y))) return false;
          return true;
        })()
      )
        vertical.add(x);
    }
  }
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      let rgb = solid;
      if (mode === 'preserve' && edge) {
        const left = sample(x0 - 1, y),
          right = sample(x1, y),
          top = sample(x, y0 - 1),
          bottom = sample(x, y1);
        const fx = (x - x0 + 1) / (x1 - x0 + 1),
          fy = (y - y0 + 1) / (y1 - y0 + 1);
        rgb = horizontal.has(y)
          ? left.map((v, i) => v * (1 - fx) + right[i] * fx)
          : vertical.has(x)
            ? top.map((v, i) => v * (1 - fy) + bottom[i] * fy)
            : [left, right, top, bottom].some((p) => Math.min(...p) < 180)
              ? paper([left, right, top, bottom])
              : left.map(
                  (v, i) => (v * (1 - fx) + right[i] * fx + top[i] * (1 - fy) + bottom[i] * fy) / 2,
                );
      }
      const at = ((y - readY) * readWidth + x - readX) * 4;
      image.data[at] = rgb[0];
      image.data[at + 1] = rgb[1];
      image.data[at + 2] = rgb[2];
      image.data[at + 3] = 255;
    }
  context.putImageData(image, readX, readY, x0 - readX, y0 - readY, x1 - x0, y1 - y0);
}
