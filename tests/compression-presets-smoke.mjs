import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import ts from 'typescript';
import { PDFDocument, PDFName, PDFRawStream, StandardFonts, rgb } from 'pdf-lib';

const require = createRequire(import.meta.url);
const pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
const { createCanvas, DOMMatrix, Path2D, ImageData } = pdfRequire('@napi-rs/canvas');
Object.assign(globalThis, {
  DOMMatrix,
  Path2D,
  ImageData,
  document: {
    createElement(name) {
      assert.equal(name, 'canvas');
      return createCanvas(1, 1);
    },
  },
});
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const assets = dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('.cache/compression-presets', { recursive: true });
for (const name of ['ocr-languages', 'pdf-engine', 'image-codecs']) {
  const code = ts
    .transpileModule(await readFile(`lib/${name}.ts`, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    })
    .outputText.replace(/(['"])\.\/([a-z-]+)\1/g, (_, q, file) => `${q}./${file}.mjs${q}`);
  await writeFile(`.cache/compression-presets/${name}.mjs`, code);
}
const { runJob } = await import('../.cache/compression-presets/pdf-engine.mjs');
const fixture = await PDFDocument.create();
const font = await fixture.embedFont(StandardFonts.Helvetica);
const sheet = fixture.addPage([595, 842]);
sheet.drawText('Compression quality fixture', { x: 30, y: 800, size: 18, font });
for (let y = 0; y < 50; y++)
  for (let x = 0; x < 35; x++) {
    sheet.drawRectangle({
      x: 30 + x * 15,
      y: 30 + y * 14,
      width: 11,
      height: 10,
      color: rgb(((x * 7 + y * 3) % 17) / 17, ((x + y * 5) % 19) / 19, ((x * 3 + y) % 23) / 23),
    });
  }
fixture.addPage([300, 400]).drawText('This page is not selected', { x: 20, y: 200, font });
const bytes = await fixture.save();
const original = bytes.slice();
const pdf = await pdfjs.getDocument({
  data: bytes.slice(),
  standardFontDataUrl: assets + '/standard_fonts/',
}).promise;
const source = { id: 'fixture', name: 'Fixture.pdf', bytes, size: bytes.length, pdf, kind: 'pdf' };
const selected = [{ id: 'p1', sourceId: source.id, index: 0, rotation: 90, selected: true }];
const options = {
  language: 'deu',
  forceOcr: false,
  imageFormat: 'png',
  watermark: '',
  numberStart: 1,
};
const sizes = [];
try {
  for (const [quality, expectedWidth] of [
    ['gentle', 2400],
    ['balanced', 2000],
    ['small', 1400],
  ]) {
    const result = await runJob(
      'compress',
      [source],
      selected,
      { ...options, quality },
      () => {},
      new AbortController().signal,
    );
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    assert.equal(result.kind, 'pdf');
    assert.equal(output.getPageCount(), 1, 'Only selected pages are exported');
    assert.deepEqual(
      output.getPage(0).getSize(),
      { width: 842, height: 595 },
      'Rotation and physical page size survive compression',
    );
    const images = output.context
      .enumerateIndirectObjects()
      .map(([, value]) => value)
      .filter(
        (value) =>
          value instanceof PDFRawStream &&
          value.dict.get(PDFName.of('Subtype'))?.toString() === '/Image',
      );
    assert.equal(images.length, 1);
    assert.equal(
      images[0].dict.get(PDFName.of('Width')).asNumber(),
      expectedWidth,
      `${quality} has its own rendering resolution`,
    );
    sizes.push(result.blob.size);
    assert.deepEqual(bytes, original, 'Original data is never overwritten');
  }
  assert.ok(
    sizes[0] > sizes[1] && sizes[1] > sizes[2],
    'The detailed fixture has progressively stronger compression',
  );
  await assert.rejects(
    () =>
      runJob(
        'compress',
        [source],
        selected,
        { ...options, quality: 'gentle' },
        () => {},
        AbortSignal.abort(),
      ),
    /Abgebrochen/,
  );
  console.log(
    'PASS: gentle/balanced/strong actual raster exports, distinct resolutions and sizes, selected page, rotation, original preservation and cancellation.',
  );
} finally {
  await pdf.loadingTask.destroy();
}
