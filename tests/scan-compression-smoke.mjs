import { englishTranslator } from './translation-test-utils.mjs';
const en = await englishTranslator();
// Fictional embedded scans: exercise actual PDF.js decoding and exported PDF objects.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { Worker as NodeWorker } from 'node:worker_threads';
import { deflateSync } from 'node:zlib';
import ts from 'typescript';
import {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFString,
  PDFHexString,
  degrees,
} from 'pdf-lib';
const require = createRequire(import.meta.url),
  pr = createRequire(require.resolve('pdfjs-dist/package.json'));
const { createCanvas, DOMMatrix, Path2D, ImageData } = pr('@napi-rs/canvas');
const makeCanvas = () => {
  const canvas = createCanvas(1, 1);
  canvas.toBlob = (cb, type, quality) =>
    cb(new Blob([canvas.toBuffer('image/jpeg', Math.round(quality * 100))], { type }));
  return canvas;
};
Object.assign(globalThis, {
  DOMMatrix,
  Path2D,
  ImageData,
  document: { createElement: makeCanvas },
  Worker: class {
    constructor() {
      this.worker = new NodeWorker(new URL('./security-worker-node.cjs', import.meta.url));
      this.worker.on('message', (data) => this.onmessage?.({ data }));
      this.worker.on('error', (error) => this.onerror?.(error));
    }
    postMessage(data, transfer) {
      this.worker.postMessage(data, transfer);
    }
    terminate() {
      void this.worker.terminate();
    }
  },
});
const assets = dirname(require.resolve('pdfjs-dist/package.json'));
const folder = '.cache/scan-compression';
await mkdir(folder, { recursive: true });
for (const name of [
  'pdf-compression',
  'pdf-recovery',
  'pdf-engine',
  'pdf-security',
  'pdf-signature-guard',
  'pdf-text',
  'ocr-languages',
  'image-codecs',
]) {
  const code = ts
    .transpileModule(await readFile(`lib/${name}.ts`, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    })
    .outputText.replace(/(['"])\.\/([a-z-]+)\1/g, (_, q, file) => `${q}./${file}.mjs${q}`)
    .replaceAll(
      "'/vendor/pdf/pdf.worker.min.mjs'",
      JSON.stringify(assets + '/legacy/build/pdf.worker.mjs'),
    )
    .replaceAll("'/vendor/pdf/standard_fonts/'", JSON.stringify(assets + '/standard_fonts/'))
    .replaceAll("'/vendor/pdf/wasm/'", JSON.stringify(assets + '/wasm/'));
  await writeFile(`${folder}/${name}.mjs`, code);
}
const { shrinkPdfImages, compressPreservingPdf } =
  await import('../.cache/scan-compression/pdf-compression.mjs');
const { optimizeBrowser } = await import('../.cache/scan-compression/pdf-recovery.mjs');
const { openSource, renderPage, sourcePages } =
  await import('../.cache/scan-compression/pdf-engine.mjs');
const signal = new AbortController().signal;
const options = { compressionMode: 'preserve', quality: 'small' };
const width = 1600,
  height = 2200;
const gray = new Uint8Array(width * height);
let seed = 72;
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    gray[y * width + x] =
      y < 160 ? 235 : x > 100 && x < 1450 && y % 80 < 14 ? 30 : 210 + (seed >>> 26);
  }
function addScan(doc, kind = 'gray', overrides = {}) {
  let data = gray,
    color = 'DeviceGray',
    extra = {};
  if (kind === 'predictor') {
    data = new Uint8Array((width + 1) * height);
    for (let y = 0; y < height; y++)
      data.set(gray.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
    extra.DecodeParms = { Predictor: 15, Colors: 1, BitsPerComponent: 8, Columns: width };
  }
  if (kind === 'indexed') {
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) palette.fill(i, i * 3, i * 3 + 3);
    color = doc.context.obj([
      'Indexed',
      'DeviceRGB',
      255,
      PDFHexString.of(Buffer.from(palette).toString('hex')),
    ]);
  }
  const stream = doc.context.stream(deflateSync(data), {
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    BitsPerComponent: 8,
    ColorSpace: color,
    Filter: 'FlateDecode',
    ...extra,
    ...overrides,
  });
  const ref = doc.context.register(stream);
  const page = doc.addPage([595, 842]);
  page.node.set(PDFName.of('Resources'), doc.context.obj({ XObject: { Scan: ref } }));
  page.node.set(
    PDFName.of('Contents'),
    doc.context.register(doc.context.flateStream('q 595 0 0 842 0 0 cm /Scan Do Q')),
  );
  return { ref, page, stream };
}
async function source(bytes, name = 'fictional-scan.pdf') {
  return openSource(new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }));
}
const opened = [];
async function keep(bytes, name) {
  const s = await source(bytes, name);
  opened.push(s);
  return s;
}
try {
  for (const kind of ['gray', 'predictor', 'indexed', 'inverted']) {
    const doc = await PDFDocument.create();
    const { ref, page } = addScan(doc, kind, kind === 'inverted' ? { Decode: [1, 0] } : {});
    const stream = doc.context.lookup(ref); // Array and indirect filters are valid PDFs too.
    stream.dict.set(PDFName.of('Filter'), doc.context.register(doc.context.obj(['FlateDecode'])));
    page.drawText('FICTIONAL OCR 4815', { x: 40, y: 770, size: 14 });
    page.setRotation(degrees(90));
    const field = doc.getForm().createTextField('Reference');
    field.setText('Keep editable');
    field.addToPage(page, { x: 40, y: 720, width: 160, height: 20 });
    page.node.addAnnot(
      doc.context.register(
        doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [40, 680, 160, 700],
          A: { S: 'URI', URI: PDFString.of('https://example.com/fictional') },
        }),
      ),
    );
    const input = await keep(await doc.save()),
      original = input.bytes.slice(),
      progress = [];
    const output = await compressPreservingPdf(
      [input],
      sourcePages(input),
      options,
      (p) => progress.push(p.percent),
      signal,
    );
    assert(output.blob.size < input.bytes.length * 0.6, `${kind}: meaningful scan reduction`);
    assert(!en(output.note).includes('Scanbilder'), 'Compression result is translated');
    const result = await keep(await output.blob.arrayBuffer(), kind + '.pdf');
    const parsed = await PDFDocument.load(result.bytes);
    assert.equal(parsed.getForm().getTextField('Reference').getText(), 'Keep editable');
    assert.equal(parsed.getPage(0).getRotation().angle, 90);
    assert.match(
      (await (await result.pdf.getPage(1)).getTextContent()).items.map((x) => x.str).join(' '),
      /FICTIONAL OCR 4815/,
    );
    assert(
      (await (await result.pdf.getPage(1)).getAnnotations()).some(
        (x) => x.url === 'https://example.com/fictional',
      ),
    );
    const before = await renderPage(input, sourcePages(input)[0], 500, signal);
    const after = await renderPage(result, sourcePages(result)[0], 500, signal);
    const a = before.canvas
      .getContext('2d')
      .getImageData(0, 0, before.canvas.width, before.canvas.height).data;
    const b = after.canvas
      .getContext('2d')
      .getImageData(0, 0, after.canvas.width, after.canvas.height).data;
    assert.equal(a.length, b.length);
    const mean = a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0) / a.length;
    assert(mean < 12, `${kind}: rendering remains comparable (${mean})`);
    before.canvas.width = after.canvas.width = 0;
    assert.deepEqual(input.bytes, original);
    assert(progress.some((x) => x > 15 && x < 65));
    console.log(
      `PASS: ${kind} ${input.bytes.length} -> ${output.blob.size} bytes; text, form, link, rotation, colors retained`,
    );
    if (kind === 'gray') {
      const updates = [];
      const target = await optimizeBrowser(input, 0.7, true, {
        signal,
        report: (p) => updates.push(p.percent),
      });
      assert(target.blob.size <= 0.7 * 1024 * 1024);
      assert.match(target.note, /Zielgröße erreicht/);
      assert(!en(target.note).includes('Scanbilder'), 'Target result is translated');
      assert(updates.every((x, i) => i === 0 || x >= updates[i - 1]));
      assert.equal(updates.at(-1), 100);
      const unchanged = await optimizeBrowser(input, 80, true, { signal, report: () => {} });
      assert.deepEqual(new Uint8Array(await unchanged.blob.arrayBuffer()), original);
      const impossible = await optimizeBrowser(input, 0.05, false, { signal, report: () => {} });
      assert.match(impossible.note, /nicht erreicht/);
      assert(impossible.blob.size <= input.bytes.length);
      const abort = new AbortController();
      await assert.rejects(
        () => shrinkPdfImages(input.bytes, 'small', abort.signal, () => abort.abort()),
        { name: 'AbortError' },
      );
      console.log(
        'PASS: measured target, monotonic progress, unchanged already-small input, unreachable lossless limit and in-flight cancellation',
      );
      await writeFile(folder + '/fictional-scan.pdf', original);
    }
  }
  const doc = await PDFDocument.create();
  const mask = addScan(doc).ref;
  const masked = addScan(doc, 'gray', { SMask: mask }).ref;
  const bilevel = addScan(doc, 'gray', { BitsPerComponent: 1 }).ref;
  const corrupt = addScan(doc).ref;
  doc.context.assign(
    corrupt,
    doc.context.stream(new Uint8Array(9000), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1600,
      Height: 2200,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'DCTDecode',
    }),
  );
  const input = new Uint8Array(await doc.save());
  const result = await shrinkPdfImages(input, 'small', signal);
  assert.equal(result.changed, 0);
  assert(result.skipped >= 3);
  assert.deepEqual(result.bytes, input);
  const defaults = await PDFDocument.create();
  const dependent = addScan(defaults);
  dependent.page.node
    .Resources()
    .set(
      PDFName.of('ColorSpace'),
      defaults.context.obj({ DefaultGray: ['CalGray', { WhitePoint: [1, 1, 1] }] }),
    );
  const defaultBytes = new Uint8Array(await defaults.save());
  assert.deepEqual((await shrinkPdfImages(defaultBytes, 'small', signal)).bytes, defaultBytes);
  console.log(
    'PASS: transparency parent AND mask, bilevel, corrupt JPEG and default color spaces stay untouched',
  );
} finally {
  for (const s of opened) await s.pdf.loadingTask.destroy();
}
