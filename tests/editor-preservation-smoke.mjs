import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import ts from 'typescript';
import { PDFDocument, PDFName, rgb, degrees } from 'pdf-lib';

const require = createRequire(import.meta.url),
  pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
const { createCanvas, DOMMatrix, Path2D, ImageData } = pdfRequire('@napi-rs/canvas');
Object.assign(globalThis, {
  DOMMatrix,
  Path2D,
  ImageData,
  document: {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return createCanvas(1, 1);
    },
  },
});
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'),
  assets = dirname(require.resolve('pdfjs-dist/package.json'));
const folder = '.cache/editor-preservation';
await mkdir(folder, { recursive: true });
for (const name of [
  'local-font-bytes',
  'pdf-text',
  'ocr-languages',
  'content-compare',
  'image-codecs',
  'pdf-engine',
  'studio-engine',
  'advanced-types',
  'extra-options',
  'extra-tools',
  'pdf-report',
  'pdf-signature-guard',
  'editor-model',
  'editor-analysis',
  'editor-text-layer',
  'editor-fonts',
  'editor-font-cmap',
  'editor-font-catalog',
  'editor-native',
  'native-pdf-core',
]) {
  const code = ts
    .transpileModule(await readFile(`lib/${name}.ts`, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    })
    .outputText.replace(/(['"])\.\/([a-z-]+)\1/g, (_, q, n) => `${q}./${n}.mjs${q}`);
  await writeFile(`${folder}/${name}.mjs`, code);
}
await writeFile(
  folder + '/native-pdf.mjs',
  `import {readFile} from 'node:fs/promises';import {createNativeEngine,removeNativeRegions} from './native-pdf-core.mjs';let api;export const removeRegions=async(bytes,removals)=>removeNativeRegions(await(api ||= readFile('public/vendor/pdfium/pdfium.wasm').then(b=>createNativeEngine(new Uint8Array(b)))),bytes,removals);`,
);
const { readTextTargets } = await import('../.cache/editor-preservation/editor-model.mjs');
const { drawEditorText, layoutEditorText } =
  await import('../.cache/editor-preservation/editor-text-layer.mjs');
const { runStudioJob } = await import('../.cache/editor-preservation/studio-engine.mjs');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) =>
  typeof input === 'string' && input.startsWith('/vendor/')
    ? new Response(await readFile('public' + input))
    : originalFetch(input);
const proxies = [];
async function source(bytes, name = 'fixture.pdf') {
  const data = new Uint8Array(bytes),
    pdf = await pdfjs.getDocument({
      data: data.slice(),
      standardFontDataUrl: assets + '/standard_fonts/',
      cMapUrl: assets + '/cmaps/',
      cMapPacked: true,
      fontExtraProperties: true,
    }).promise;
  proxies.push(pdf);
  return { id: name, name, bytes: data, pdf, size: data.length, kind: 'pdf' };
}
const pageOf = (s, rotation = 0) => ({
  id: 'p0',
  sourceId: s.id,
  index: 0,
  rotation,
  selected: true,
});
const contents = async (s) =>
  (await (await s.pdf.getPage(1)).getTextContent()).items.filter((t) => 'str' in t);
const text = async (s) => (await contents(s)).map((t) => t.str).join(' ');
const options = {
  language: 'deu',
  editorLanguage: 'deu+eng',
  forceOcr: false,
  imageFormat: 'png',
  quality: 'balanced',
  watermark: 'TEST',
  numberStart: 1,
  pageSize: 'a4',
  orientation: 'portrait',
  perSheet: '2',
};
const run = (s, marks, rotation = 0) =>
  runStudioJob(
    'edit-text',
    [s],
    [pageOf(s, rotation)],
    options,
    { marks: { p0: marks }, crops: {} },
    () => {},
    new AbortController().signal,
  );
const markFor = (t, width = 500) => ({
  id: 'replace',
  kind: 'text',
  x: t.x,
  y: t.y,
  w: t.w,
  h: t.h,
  sourceRect: { x: t.x, y: t.y, w: t.w, h: t.h },
  text: t.text,
  fontScale: t.fontSize / width,
  fontFamily: t.family,
  fontChoice: 'auto',
  originalFontName: t.fontName,
  originalFontId: t.originalFontId,
  originalFontPage: 0,
  bold: t.bold,
  italic: t.italic,
  color: t.color,
  fill: '#ffffff',
  baselineScale: t.baselineScale,
  insetScale: t.insetScale,
  tracking: t.tracking,
  textScaleX: t.textScaleX,
  textRotation: t.rotation,
  lineHeight: t.lineHeight,
});
async function render(s) {
  const page = await s.pdf.getPage(1),
    viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

// No OCR words in the solid-color image. This fixture deliberately exercises the
// mixed-page path without depending on an OCR model for an image with no text.
await writeFile(
  folder + '/editor-recognizer.mjs',
  `export const openEditorRecognizer=()=>({recognize:async()=>({blocks:[],confidence:100}),dispose:async()=>{}});`,
);
try {
  const d = await PDFDocument.create(),
    p = d.addPage([500, 700]);
  p.drawRectangle({ x: 0, y: 0, width: 500, height: 700, color: rgb(0.83, 0.91, 0.98) });
  const tile = createCanvas(100, 100);
  tile.getContext('2d').fillStyle = '#b0d5a0';
  tile.getContext('2d').fillRect(0, 0, 100, 100);
  p.drawImage(await d.embedPng(tile.toBuffer('image/png')), {
    x: 25,
    y: 550,
    width: 450,
    height: 100,
  });
  p.drawText('ORIGINAL 4815', { x: 50, y: 600, size: 18 });
  p.drawText('KEEP VECTOR FOOTER', { x: 50, y: 60, size: 12 });
  // A table rule intersects the selection padding, but not the text ink.
  p.drawLine({
    start: { x: 40, y: 595 },
    end: { x: 460, y: 595 },
    thickness: 0.4,
    color: rgb(0.8, 0.1, 0.1),
  });
  const link = d.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [350, 40, 460, 70],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: 'https://example.org/' },
  });
  p.node.set(PDFName.of('Annots'), d.context.obj([d.context.register(link)]));
  d.addPage([420, 300]).drawText('UNTOUCHED 123', { x: 30, y: 240, size: 20 });
  const src = await source(await d.save(), 'preservation.pdf'),
    t = (await readTextTargets(src, pageOf(src))).targets.find((t) => t.text === 'ORIGINAL 4815');
  const m = { ...markFor(t), text: 'NEU 2026' };
  const pages = [pageOf(src), { ...pageOf(src), id: 'p1', index: 1 }];
  const exportMarks = (marks, more = {}) =>
    runStudioJob(
      'edit-text',
      [src],
      pages,
      { ...options, ...more },
      { marks: { p0: marks }, crops: {} },
      () => {},
      new AbortController().signal,
    );
  const result = await exportMarks([m]);
  assert(!result.note?.includes('Als Bild'), result.note);
  const out = await source(await result.blob.arrayBuffer(), 'preserved.pdf');
  assert(!/ORIGINAL|4815/.test(await text(out)));
  assert.match(await text(out), /NEU 2026/);
  assert.match(await text(out), /KEEP VECTOR FOOTER/);
  const originalCanvas = await render(src),
    outCanvas = await render(out);
  // Compare all background and foreground pixels outside the changed glyphs.
  const before = originalCanvas.getContext('2d').getImageData(0, 0, 1000, 1400).data,
    after = outCanvas.getContext('2d').getImageData(0, 0, 1000, 1400).data;
  let difference = 0,
    channels = 0;
  for (let y = 0; y < 1400; y++)
    for (let x = 0; x < 1000; x++) {
      if (
        x >= t.x * 1000 - 2 &&
        x <= (t.x + t.w) * 1000 + 2 &&
        y >= t.y * 1400 - 2 &&
        y <= (t.y + t.h) * 1400 + 2
      )
        continue;
      for (let c = 0; c < 3; c++) {
        difference += Math.abs(before[(y * 1000 + x) * 4 + c] - after[(y * 1000 + x) * 4 + c]);
        channels++;
      }
    }
  assert(difference / channels < 0.03, `Unchanged pixels drifted by ${difference / channels}`);
  // The blank part inside the old text rectangle keeps the image's green pixels,
  // not a white rectangle. The old generic redaction implementation failed this.
  assert.deepEqual(
    [...outCanvas.getContext('2d').getImageData(300, 204, 1, 1).data],
    [176, 213, 160, 255],
  );
  const parsed = await PDFDocument.load(out.bytes);
  assert.equal(parsed.getPage(0).node.Annots().size(), 1, 'Link annotation retained');
  assert.equal(parsed.getPage(1).getWidth(), 420);
  assert.equal(parsed.getPage(1).getHeight(), 300);
  const { renderPage } = await import('../.cache/editor-preservation/pdf-engine.mjs');
  const c1 = (await renderPage(src, { index: 1, rotation: 0 }, 800)).canvas,
    c2 = (await renderPage(out, { index: 1, rotation: 0 }, 800)).canvas;
  assert.deepEqual(
    c1.getContext('2d').getImageData(0, 0, c1.width, c1.height).data,
    c2.getContext('2d').getImageData(0, 0, c2.width, c2.height).data,
    'Untouched page is pixel-identical',
  );
  const added = await source(
    await (
      await exportMarks([
        { ...m, sourceRect: undefined, x: 0.1, y: 0.5, w: 0.7, h: 0.1, text: 'Zusatz ÄÖÜ ß €' },
      ])
    ).blob.arrayBuffer(),
  );
  assert.equal(
    (await PDFDocument.load(added.bytes)).getPage(0).node.Annots().size(),
    1,
    'Adding text retains links',
  );
  assert(
    layoutEditorText({ ...m, text: 'W', w: 0.001, h: 0.5 }, 500, 700, () => 100).overflow,
    'A single glyph wider than the box must block export',
  );
  const partial = { ...m, sourceRect: { ...m.sourceRect, w: m.sourceRect.w * 0.3 } };
  await assert.rejects(
    () => exportMarks([partial]),
    /Originaltext.*nicht sicher/,
    'Partial object removal fails closed',
  );
  const deliberate = await exportMarks([partial], { editorAllowRaster: true });
  assert.match(deliberate.note, /Als Bild neu aufgebaut/);
  const f = await PDFDocument.create();
  f.addPage([500, 700]);
  f.getForm()
    .createTextField('Name')
    .addToPage(f.getPage(0), { x: 50, y: 500, width: 100, height: 30 });
  const fs = await source(await f.save(), 'form.pdf');
  await assert.rejects(
    () => run(fs, []),
    /Formularfelder/,
    'Interactive forms cannot be silently flattened',
  );
  const signed = await PDFDocument.create();
  signed.addPage();
  signed.catalog.set(
    PDFName.of('Perms'),
    signed.context.obj({ DocMDP: signed.context.obj({ Type: 'Sig' }) }),
  );
  const signedSource = await source(await signed.save(), 'signed.pdf');
  await assert.rejects(() => run(signedSource, []), /Signatur/);
  const tilted = await PDFDocument.create();
  tilted.addPage([500, 700]).drawText('TILTED', { x: 100, y: 300, size: 18, rotate: degrees(20) });
  const tsrc = await source(await tilted.save(), 'tilted.pdf');
  const tiltedTarget = (await readTextTargets(tsrc, pageOf(tsrc))).targets[0];
  assert(tiltedTarget.unsupportedReason);
  await assert.rejects(
    async () => drawEditorText(await PDFDocument.create(), p, { ...m, textRotation: 20 }, 500, 700),
    /Schräger/,
  );
  const opacity = await PDFDocument.create();
  opacity.addPage().drawText('INVISIBLE', { x: 40, y: 500, size: 14, opacity: 0 });
  const os = await source(await opacity.save(), 'invisible.pdf');
  assert(
    (await readTextTargets(os, pageOf(os))).targets[0].invisible,
    'Zero-opacity search layers are not visible source text',
  );
  await writeFile(folder + '/original.pdf', src.bytes);
  await writeFile(folder + '/edited.pdf', out.bytes);
  await writeFile(folder + '/edited.png', outCanvas.toBuffer('image/png'));
  const translate = await (await import('./translation-test-utils.mjs')).englishTranslator();
  for (const message of [
    'Seiten als Bild neu aufbauen',
    'Absätze bitte prüfen: Tabellenzellen und Spalten bei Bedarf einzeln bearbeiten.',
    'Seite 2: Als Bild neu aufgebaut. Hintergrund, OCR und unveränderte Bereiche bitte im Ergebnis prüfen.',
  ])
    assert.notEqual(translate(message), message);
  console.log(
    'PASS: actual text deletion preserves image background, table rules, vector footer, links and unchanged page pixels/sizes; adding text retains links; ambiguous objects/forms/signatures fail closed; explicit rebuild; slanted-text guard, invisible layer and DE/EN messages.',
  );
} finally {
  for (const p of proxies) await p.loadingTask.destroy();
  globalThis.fetch = originalFetch;
}
