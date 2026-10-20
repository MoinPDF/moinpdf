import type { Page as OcrPage } from 'tesseract.js';
import { abortable, renderPage, type Source, type PageItem } from './pdf-engine';
import { readTextTargets, type TextTarget } from './editor-model';
import { parseOcrLanguages } from './ocr-languages';
import type { Rect } from './studio-engine';
import { estimateEditorSkew, preprocessEditorScan, ambiguousEditorNumber } from './editor-scan';
export const editorOcrNeedsReview = (target: TextTarget) =>
  target.origin === 'ocr' &&
  ((target.confidence ?? 100) < 75 || ambiguousEditorNumber(target.text));

export type EditorPageText = {
  targets: TextTarget[];
  width: number;
  height: number;
  ocr: boolean;
  replaceTextLayer: boolean;
  uncertain: number;
};
export type EditorProgress = { percent: number; label: string };
export type EditorRecognizer = {
  recognize: (
    canvas: HTMLCanvasElement,
    language: string,
    report: (p: EditorProgress) => void,
  ) => Promise<OcrPage>;
  dispose: () => Promise<void>;
};
const cache = new WeakMap<Source, Map<string, EditorPageText>>();
const keyFor = (page: Pick<PageItem, 'index' | 'rotation'>, language: string) =>
  `${page.index}:${page.rotation}:${language}`;
export function cachedEditorPage(
  source: Source,
  page: Pick<PageItem, 'index' | 'rotation'>,
  language = 'deu+eng',
) {
  return cache.get(source)?.get(keyFor(page, language));
}
export function readableEditorText(text: string) {
  const visible = text.replace(/\s/g, '');
  return (
    !!visible &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(visible) &&
    /[\p{L}\p{N}\p{P}\p{S}]/u.test(visible)
  );
}
export function intersection(a: Rect, b: Rect) {
  return (
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  );
}
export function remainingEditorTargets(targets: TextTarget[], removals: Rect[]) {
  // Any overlap removes the complete text run from the hidden layer. Never
  // restore a deleted word just because its centre lies outside the rectangle.
  return targets.filter((t) => !removals.some((r) => intersection(t, r) > 0.0000001));
}
export function mergeEditorTargets(native: TextTarget[], recognized: TextTarget[]) {
  return [
    ...native,
    ...recognized.filter(
      (t) => !native.some((n) => intersection(t, n) / Math.min(t.w * t.h, n.w * n.h) > 0.35),
    ),
  ].sort((a, b) => {
    const angle = (((Math.round((a.rotation || 0) / 90) * 90) % 360) + 360) % 360;
    if (angle === 90) return Math.abs(a.x - b.x) < Math.min(a.w, b.w) * 0.4 ? a.y - b.y : b.x - a.x;
    if (angle === 180)
      return Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.4 ? b.x - a.x : b.y - a.y;
    if (angle === 270)
      return Math.abs(a.x - b.x) < Math.min(a.w, b.w) * 0.4 ? b.y - a.y : a.x - b.x;
    return Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.4 ? a.x - b.x : a.y - b.y;
  });
}

// Lazy, owned worker session. Disposing its parent also terminates an OCR
// worker still initializing, for which Tesseract has not returned a handle yet.
export function createEditorRecognizer(signal: AbortSignal): EditorRecognizer {
  let session: Promise<EditorRecognizer> | undefined;
  let disposed = false;
  return {
    async recognize(canvas, language, report) {
      signal.throwIfAborted();
      if (disposed) throw new DOMException('Abgebrochen', 'AbortError');
      session ||= import('./editor-recognizer').then(({ openEditorRecognizer }) =>
        openEditorRecognizer(signal),
      );
      const active = await session;
      if (disposed || signal.aborted) {
        await active.dispose();
        signal.throwIfAborted();
        throw new DOMException('Abgebrochen', 'AbortError');
      }
      return active.recognize(canvas, language, report);
    },
    async dispose() {
      disposed = true;
      await (await session)?.dispose();
    },
  };
}

/** Re-read only the selected scan region. It is a suggestion, never a second text layer. */
export async function recognizeEditorRegion(
  source: Source,
  page: Pick<PageItem, 'index' | 'rotation'>,
  rect: Rect,
  language: string,
  signal: AbortSignal,
  report: (p: EditorProgress) => void,
) {
  const rendered = await renderPage(source, page, 2800, signal),
    canvas = document.createElement('canvas'),
    recognizer = createEditorRecognizer(signal);
  try {
    const pad = 0.006,
      x = Math.max(0, rect.x - pad),
      y = Math.max(0, rect.y - pad),
      w = Math.min(1 - x, rect.w + 2 * pad),
      h = Math.min(1 - y, rect.h + 2 * pad);
    canvas.width = Math.max(1, Math.round(w * rendered.canvas.width));
    canvas.height = Math.max(1, Math.round(h * rendered.canvas.height));
    canvas
      .getContext('2d')!
      .drawImage(
        rendered.canvas,
        x * rendered.canvas.width,
        y * rendered.canvas.height,
        w * rendered.canvas.width,
        h * rendered.canvas.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    const original = await recognizer.recognize(canvas, language, report);
    const prepared = preprocessEditorScan(canvas);
    let processed: OcrPage;
    try {
      processed = await recognizer.recognize(prepared.canvas, language, report);
    } finally {
      prepared.canvas.width = prepared.canvas.height = 0;
    }
    const variants = [
      { label: 'Originalscan', data: original },
      { label: 'Aufbereitet: Ausrichtung, Schatten und Kontrast', data: processed },
    ]
      .sort((a, b) => ocrScore(b.data) - ocrScore(a.data))
      .map((v) => ({
        label: v.label,
        confidence: v.data.confidence,
        text: (v.data.blocks || [])
          .flatMap((b) =>
            b.paragraphs.flatMap((p) => p.lines.map((l) => l.words.map((w) => w.text).join(' '))),
          )
          .join('\n')
          .trim(),
      }));
    const data = ocrScore(processed) > ocrScore(original) ? processed : original;
    signal.throwIfAborted();
    const text = (data.blocks || [])
      .flatMap((b) =>
        b.paragraphs.flatMap((p) => p.lines.map((l) => l.words.map((w) => w.text).join(' '))),
      )
      .join('\n')
      .trim();
    if (!text)
      throw new Error(
        'In diesem Bereich wurde kein lesbarer Text erkannt. Bitte manuell korrigieren.',
      );
    return { text, confidence: data.confidence, variants };
  } finally {
    rendered.canvas.width = rendered.canvas.height = canvas.width = canvas.height = 0;
    await recognizer.dispose();
  }
}

function imageHasInk(canvas: HTMLCanvasElement) {
  const small = document.createElement('canvas');
  small.width = 160;
  small.height = 160;
  try {
    const ctx = small.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, 160, 160);
    const pixels = ctx.getImageData(0, 0, 160, 160).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 200) count++;
    return count > 12;
  } finally {
    small.width = small.height = 0;
  }
}
function rotatedCanvas(input: HTMLCanvasElement, quarter: number) {
  const canvas = document.createElement('canvas');
  canvas.width = quarter % 2 ? input.height : input.width;
  canvas.height = quarter % 2 ? input.width : input.height;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((quarter * Math.PI) / 2);
  ctx.drawImage(input, -input.width / 2, -input.height / 2);
  return canvas;
}
function restorePoint(x: number, y: number, quarter: number): [number, number] {
  if (quarter === 1) return [y, 1 - x];
  if (quarter === 2) return [1 - x, 1 - y];
  if (quarter === 3) return [1 - y, x];
  return [x, y];
}
function sampleFill(pixels: Uint8ClampedArray, width: number, height: number, r: Rect) {
  const points = [
    [r.x - 0.002, r.y],
    [r.x + r.w + 0.002, r.y],
    [r.x, r.y - 0.002],
    [r.x, r.y + r.h + 0.002],
  ];
  const colors = points.map(([x, y]) => {
    const px = Math.max(0, Math.min(width - 1, Math.round(x * width))),
      py = Math.max(0, Math.min(height - 1, Math.round(y * height)));
    const i = (py * width + px) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  });
  const rgb = [0, 1, 2].map((i) => colors.map((c) => c[i]).sort((a, b) => a - b)[2]);
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function ocrEditorTargets(
  data: OcrPage,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  quarter = 0,
  prepared?: { canvas: HTMLCanvasElement; restore: (x: number, y: number) => [number, number] },
): TextTarget[] {
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  const cw = quarter % 2 ? canvas.height : canvas.width,
    ch = quarter % 2 ? canvas.width : canvas.height;
  const words = (data.blocks || []).flatMap((b) =>
    b.paragraphs.flatMap((p) =>
      p.lines.flatMap((l) => l.words.map((word) => ({ word, baseline: l.baseline }))),
    ),
  );
  return words
    .filter(({ word }) => readableEditorText(word.text) && word.confidence >= 15)
    .map(({ word, baseline }, i) => {
      const { bbox: b } = word;
      const corners = [
        [b.x0, b.y0],
        [b.x1, b.y0],
        [b.x0, b.y1],
        [b.x1, b.y1],
      ]
        .map(([x, y]) => (prepared ? prepared.restore(x, y) : [x, y]))
        .map(([x, y]) => restorePoint(x / cw, y / ch, quarter));
      const x = Math.max(0, Math.min(...corners.map((p) => p[0])) - 0.001),
        y = Math.max(0, Math.min(...corners.map((p) => p[1])) - 0.001);
      const r = {
        x,
        y,
        w: Math.min(
          1 - x,
          Math.max(...corners.map((p) => p[0])) - Math.min(...corners.map((p) => p[0])) + 0.002,
        ),
        h: Math.min(
          1 - y,
          Math.max(...corners.map((p) => p[1])) - Math.min(...corners.map((p) => p[1])) + 0.002,
        ),
      };
      // Tesseract can recognise sideways lines without rotating the input. Its
      // baseline, not only our recovery rotation, defines the word orientation.
      const lineAngle = baseline
        ? Math.round(
            (Math.atan2(baseline.y1 - baseline.y0, baseline.x1 - baseline.x0) * 2) / Math.PI,
          ) * 90
        : 0;
      const rotation = (((lineAngle - quarter * 90) % 360) + 360) % 360;
      const thickness = Math.abs(lineAngle % 180) === 90 ? b.x1 - b.x0 : b.y1 - b.y0;
      const fontSize = thickness / (canvas.width / width) / 0.85;
      return {
        ...r,
        id: `ocr-${quarter}-${i}`,
        text: word.text,
        fontSize: Math.max(3, Math.min(96, fontSize)),
        family: 'sans' as const,
        origin: 'ocr' as const,
        confidence: word.confidence,
        rotation,
        fill: sampleFill(pixels, canvas.width, canvas.height, r),
      };
    })
    .filter((t) => t.w > 0 && t.h > 0 && Number.isFinite(t.fontSize));
}
function ocrScore(data: OcrPage) {
  const words = (data.blocks || []).flatMap((b) =>
    b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
  );
  const good = words.filter((w) => w.confidence >= 45 && /[\p{L}\p{N}]/u.test(w.text));
  return good.reduce((n, w) => n + (w.text.length * w.confidence) / 100, 0);
}

function imageCoverage(
  ops: { fnArray: number[]; argsArray: unknown[][] },
  codes: Record<string, number>,
  viewport: { transform: number[]; width: number; height: number },
) {
  const multiply = (a: number[], b: number[]) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  let matrix = [1, 0, 0, 1, 0, 0],
    coverage = 0;
  const stack: number[][] = [];
  const count = (m: number[]) => {
    const t = multiply(viewport.transform, m);
    const points = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ].map(([x, y]) => [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]]);
    const w = Math.max(
      0,
      Math.min(viewport.width, Math.max(...points.map((p) => p[0]))) -
        Math.max(0, Math.min(...points.map((p) => p[0]))),
    );
    const h = Math.max(
      0,
      Math.min(viewport.height, Math.max(...points.map((p) => p[1]))) -
        Math.max(0, Math.min(...points.map((p) => p[1]))),
    );
    if (Number.isFinite(w * h)) coverage += (w * h) / (viewport.width * viewport.height);
  };
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i],
      args = ops.argsArray[i];
    if (fn === codes.save) stack.push([...matrix]);
    else if (fn === codes.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === codes.transform) matrix = multiply(matrix, args as number[]);
    else if (fn === codes.paintFormXObjectBegin) {
      stack.push([...matrix]);
      if (Array.isArray(args[0])) matrix = multiply(matrix, args[0]);
    } else if (fn === codes.paintFormXObjectEnd) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (
      [
        codes.paintImageXObject,
        codes.paintInlineImageXObject,
        codes.paintImageMaskXObject,
      ].includes(fn)
    )
      count(matrix);
    else if (fn === codes.paintImageXObjectRepeat) {
      const positions = args[3] as number[];
      for (let j = 0; j < positions.length; j += 2)
        count(
          multiply(matrix, [
            Number(args[1]),
            0,
            0,
            Number(args[2]),
            positions[j],
            positions[j + 1],
          ]),
        );
    }
  }
  return Math.min(1, coverage);
}

export async function analyzeEditorPage(
  source: Source,
  page: Pick<PageItem, 'index' | 'rotation'>,
  options: {
    signal: AbortSignal;
    language?: string;
    forceOcr?: boolean;
    recognizer?: EditorRecognizer;
    report?: (p: EditorProgress) => void;
    onNative?: (value: EditorPageText) => void;
  },
): Promise<EditorPageText> {
  const { signal } = options,
    language = options.language || 'deu+eng',
    report = options.report || (() => {});
  signal.throwIfAborted();
  parseOcrLanguages(language);
  const key = keyFor(page, language),
    existing = cache.get(source)?.get(key);
  if (existing && !options.forceOcr) {
    options.onNative?.(existing);
    return existing;
  }
  report({ percent: 0, label: 'Textstellen werden erkannt …' });
  const pdfPage = await abortable(source.pdf.getPage(page.index + 1), signal);
  const viewport = pdfPage.getViewport({
    scale: 1,
    rotation: (pdfPage.rotate + page.rotation) % 360,
  });
  let extracted: Awaited<ReturnType<typeof readTextTargets>>;
  try {
    extracted = await abortable(readTextTargets(source, page), signal);
  } catch {
    signal.throwIfAborted();
    extracted = { targets: [], width: viewport.width, height: viewport.height };
  }
  const valid = extracted.targets.filter((t) => readableEditorText(t.text));
  const base: EditorPageText = {
    ...extracted,
    targets: valid,
    ocr: false,
    replaceTextLayer: valid.length !== extracted.targets.length,
    uncertain: 0,
  };
  options.onNative?.(base);
  // Image operators are inspected without decoding full-resolution image data.
  // Mixed pages are recognized too, then matched against existing text positions.
  let hasImage = false;
  if (valid.length) {
    try {
      const ops = await abortable(pdfPage.getOperatorList(), signal);
      const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      hasImage = imageCoverage(ops, OPS, viewport) >= 0.08;
    } catch {
      signal.throwIfAborted();
      hasImage = true;
    }
  }
  if (valid.length && !hasImage && !base.replaceTextLayer && !options.forceOcr) {
    const entries = cache.get(source) || new Map();
    entries.set(key, base);
    cache.set(source, entries);
    return base;
  }
  const rendered = await renderPage(source, page, 2400, signal);
  let recognizer = options.recognizer;
  try {
    signal.throwIfAborted();
    let recognized: TextTarget[] = [];
    if (imageHasInk(rendered.canvas)) {
      recognizer ||= createEditorRecognizer(signal);
      let data = await recognizer.recognize(rendered.canvas, language, report),
        quarter = 0,
        score = ocrScore(data);
      let prepared: ReturnType<typeof preprocessEditorScan> | undefined;
      // Only difficult pages take the slower orientation recovery path.
      if (data.confidence < 55 || score < 4) {
        for (const turn of [2, 1, 3]) {
          signal.throwIfAborted();
          report({ percent: 15, label: 'Schriftausrichtung wird geprüft …' });
          const rotated = rotatedCanvas(rendered.canvas, turn);
          try {
            const next = await recognizer.recognize(rotated, language, report),
              nextScore = ocrScore(next);
            if (nextScore > score * 1.15) {
              data = next;
              score = nextScore;
              quarter = turn;
            }
            if (data.confidence >= 75 && score >= 12) break;
          } finally {
            rotated.width = rotated.height = 0;
          }
        }
      }
      const oriented = quarter ? rotatedCanvas(rendered.canvas, quarter) : rendered.canvas;
      try {
        const skew = estimateEditorSkew(oriented);
        if (data.confidence < 80 || score < 20 || skew) {
          signal.throwIfAborted();
          report({ percent: 25, label: 'Scan wird lokal aufbereitet und verglichen …' });
          const candidate = preprocessEditorScan(oriented, skew);
          try {
            const next = await recognizer.recognize(candidate.canvas, language, report),
              nextScore = ocrScore(next);
            if (nextScore > score * 1.08 && next.confidence >= data.confidence - 3) {
              data = next;
              score = nextScore;
              prepared = candidate;
            }
          } finally {
            if (prepared !== candidate) candidate.canvas.width = candidate.canvas.height = 0;
          }
        }
      } finally {
        if (oriented !== rendered.canvas) oriented.width = oriented.height = 0;
      }
      recognized = ocrEditorTargets(
        data,
        rendered.canvas,
        rendered.width,
        rendered.height,
        quarter,
        prepared,
      );
      if (prepared) prepared.canvas.width = prepared.canvas.height = 0;
    }
    signal.throwIfAborted();
    // Re-recognition can replace an existing invisible search layer, but must
    // never discard visible native text and its font/geometry on mixed pages.
    const replaceSearch = !!options.forceOcr && recognized.length > 0;
    const targets = mergeEditorTargets(
      replaceSearch ? valid.filter((t) => !t.invisible) : valid,
      recognized,
    );
    const result: EditorPageText = {
      targets,
      width: rendered.width,
      height: rendered.height,
      ocr: true,
      replaceTextLayer: base.replaceTextLayer || (replaceSearch && valid.some((t) => t.invisible)),
      uncertain: targets.filter(editorOcrNeedsReview).length,
    };
    const entries = cache.get(source) || new Map();
    // Only text/coordinates are retained, never canvases or document copies.
    entries.set(key, result);
    cache.set(source, entries);
    report({
      percent: 100,
      label: targets.length
        ? 'Text ist zur Bearbeitung bereit.'
        : 'Kein lesbarer Text erkannt. Du kannst einen Bereich ersetzen oder neuen Text hinzufügen.',
    });
    return result;
  } finally {
    rendered.canvas.width = rendered.canvas.height = 0;
    if (!options.recognizer) await recognizer?.dispose();
  }
}
