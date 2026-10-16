import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import ts from 'typescript';
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';

await mkdir('.cache', { recursive: true });
await writeFile('.cache/pdf-text-portable-test.mjs', ts.transpileModule(
  await readFile('lib/pdf-text.ts', 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } },
).outputText);
const { readPdfText } = await import('../.cache/pdf-text-portable-test.mjs');

const options = { includeMarkedContent: true, disableNormalization: true };
const chunks = [
  { items: [{ type: 'beginMarkedContent', id: 'p1' }, { str: 'Grüße' }], styles: { f1: { ascent: 0.8 } }, lang: null },
  { items: [{ str: '世界' }, { type: 'endMarkedContent' }], styles: { f2: { descent: -0.2 } }, lang: 'de-DE' },
  { items: [{ str: 'Second page' }], styles: { f1: { ascent: 0.9 } }, lang: 'en-US' },
];
let stream;
const page = {
  streamTextContent(received) {
    assert.equal(received, options);
    stream = new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(chunk); c.close(); } });
    Object.defineProperty(stream, Symbol.asyncIterator, { value: undefined });
    return stream;
  },
  getTextContent() { throw new Error('Must not call the async-iterator path'); },
};
const content = await readPdfText(page, options);
assert.deepEqual(content.items, chunks.flatMap(c => c.items));
assert.deepEqual({ ...content.styles }, { f1: { ascent: 0.9 }, f2: { descent: -0.2 } });
assert.equal(content.lang, 'de-DE');
assert.equal(stream.locked, false);

const failure = new Error('Worker stream failed');
let pulls = 0;
const broken = new ReadableStream({ pull(c) { if (pulls++ === 0) c.enqueue(chunks[0]); else c.error(failure); } });
await assert.rejects(() => readPdfText({ streamTextContent: () => broken }), e => e === failure);
assert.equal(broken.locked, false, 'A failed read must release its lock and reject instead of returning partial text');
const empty = await readPdfText({ streamTextContent: () => new ReadableStream({ start(c) { c.close(); } }) });
assert.deepEqual(empty.items, []);
assert.equal(empty.lang, null);
const xfaContent = { items: [{ str: 'XFA value' }], styles: {}, lang: null };
assert.equal(await readPdfText({ isPureXfa: true, getTextContent: async p => { assert.equal(p, options); return xfaContent; } }, options), xfaContent);

const require = createRequire(import.meta.url);
const pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
const { DOMMatrix, Path2D, ImageData } = pdfRequire('@napi-rs/canvas');
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc = await PDFDocument.create();
doc.catalog.set(PDFName.of('Lang'), PDFString.of('de-DE'));
const font = await doc.embedFont(StandardFonts.Helvetica);
const sheet = doc.addPage([600, 2200]);
for (let i = 0; i < 120; i++) sheet.drawText(`Zeile ${i}: Grüße & Rechnung 25,50 EUR`, { x: 30, y: 2150 - i * 17, size: 11, font });
doc.addPage([600, 800]);
const task = pdfjs.getDocument({ data: await doc.save(), standardFontDataUrl: dirname(require.resolve('pdfjs-dist/package.json')) + '/standard_fonts/' });
const descriptor = Object.getOwnPropertyDescriptor(ReadableStream.prototype, Symbol.asyncIterator);
try {
  const pdf = await task.promise;
  const actualPage = await pdf.getPage(1);
  const expected = await actualPage.getTextContent(options);
  assert(expected.items.length > 100, 'Fixture spans multiple worker chunks');
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, { configurable: true, value: undefined });
  assert.deepEqual(await readPdfText(actualPage, options), expected, 'Every item, coordinate, font style and language must match PDF.js');
  assert.deepEqual((await readPdfText(await pdf.getPage(2))).items, [], 'Image-only/empty pages remain eligible for OCR');
} finally {
  if (descriptor) Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, descriptor);
  else delete ReadableStream.prototype[Symbol.asyncIterator];
  await task.destroy();
}
console.log('PASS: PDF text without stream async iteration, real multi-chunk PDF parity, empty scans, XFA, options and stream failures.');
