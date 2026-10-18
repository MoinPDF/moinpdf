import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
await mkdir('.cache', { recursive: true });
for (const name of ['local-font-bytes','writer-model', 'writer-extensions', 'writer-pdf']) {
  const source = await readFile(`lib/${name}.ts`, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/(['"])\.\/(writer-[a-z]+|local-font-bytes)\1/g, '$1./$2-test.mjs$1');
  await writeFile(`.cache/${name}-test.mjs`, code);
}
const model = await import('../.cache/writer-model-test.mjs');
Object.assign(globalThis, { indexedDB });
// LAN/HTTP installations expose random bytes, but not crypto.randomUUID.
const originalUUID = crypto.randomUUID;
Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
const base = model.emptyWriterDocument('Prüfung ÄÖÜ – €');
assert.match(base.id, /^[a-f0-9]{32}$/);
assert.notEqual(model.writerDocumentId(), base.id);
Object.defineProperty(crypto, 'randomUUID', { value: originalUUID, configurable: true });
assert.equal(model.writerFilename('../Bericht:Test', 'pdf'), '..-Bericht-Test.pdf');
assert.deepEqual(model.writerPageSize({ ...base.settings, landscape: true }), [297, 210]);
assert.equal(model.localWriterImage('https://example.com/tracker.png'), false);
assert.equal(model.localWriterImage('data:image/svg+xml;base64,AAAA'), false);
assert.throws(() => model.validateWriterDocument({ ...base, version: 2 }));
assert.throws(() => model.normalizeWriterContent({ type: 'doc', content: [{ type: 'iframe' }] }));
assert.throws(() => model.normalizeWriterContent({ type: 'doc', content: [{ type: 'image', attrs: { src: 'https://example.com/x.png' } }] }));
const roundtrip = await model.decodeWriterDocument(model.encodeWriterDocument(base));
await model.saveWriterDraft(roundtrip);
assert.equal((await model.listWriterDrafts())[0].title, base.title);
await Promise.all([model.saveWriterDraft({ ...base, updated: 10, title: 'v1' }), model.saveWriterDraft({ ...base, updated: 11, title: 'v2' })]);
assert.equal((await model.listWriterDrafts())[0].title, 'v2');
await model.deleteWriterDraft(base.id);
assert.equal((await model.listWriterDrafts()).length, 0);

// Exercise the real editor schema, selection, formatting and undo, without a browser.
const dom = new JSDOM('<!doctype html><html><body><div id="editor"></div></body></html>', { pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Node: dom.window.Node, HTMLElement: dom.window.HTMLElement, getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { Editor } = await import('@tiptap/core');
const { writerExtensions } = await import('../.cache/writer-extensions-test.mjs');
const editor = new Editor({ element: document.getElementById('editor'), extensions: writerExtensions(), content: base.content });
editor.commands.insertContent('MoinPDF Dokument');
editor.commands.setTextSelection({ from: 1, to: 8 });
editor.chain().toggleBold().toggleItalic().toggleUnderline().setFontFamily('MoinSerif').setFontSize('18pt').setColor('#176c64').run();
assert(editor.getJSON().content[0].content[0].marks.some(m => m.type === 'bold'));
assert.equal(editor.getJSON().content[0].content[0].marks.find(m => m.type === 'textStyle').attrs.fontSize, '18pt');
editor.commands.undo(); editor.commands.redo();
assert(editor.getJSON().content[0].content[0].marks.some(m => m.type === 'underline'));
editor.commands.setContent('<p>Sauber</p><img src="https://example.com/tracker.png"><script>alert(1)</script>');
assert(!JSON.stringify(editor.getJSON()).includes('tracker'));
editor.commands.setTextSelection('end');
editor.commands.insertTable({ rows: 3, cols: 2, withHeaderRow: true });
assert(JSON.stringify(editor.getJSON()).includes('tableHeader'));
editor.commands.addRowAfter();
assert.doesNotThrow(() => model.normalizeWriterContent(editor.getJSON()));
editor.destroy();

const canvasRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
const { createCanvas, DOMMatrix, Path2D, ImageData } = canvasRequire('@napi-rs/canvas');
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
const imageCanvas = createCanvas(120, 60);
imageCanvas.getContext('2d').fillStyle = '#16cb73'; imageCanvas.getContext('2d').fillRect(0, 0, 120, 60);
const image = imageCanvas.toDataURL('image/png');
const p = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const rich = { ...base, settings: { ...base.settings, header: 'Kopfzeile – MoinPDF', footer: 'Vertraulicher Entwurf', pageNumbers: true }, content: { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Meine Ideen' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Änderung 2026 – 1.234,56 €', marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }, { type: 'textStyle', attrs: { fontFamily: 'MoinSerif', fontSize: '18pt', color: '#176c64' } }] }] },
  { type: 'bulletList', content: [{ type: 'listItem', content: [p('Erster Punkt')] }, { type: 'listItem', content: [p('Zweiter Punkt')] }] },
  { type: 'table', content: [
    { type: 'tableRow', content: [{ type: 'tableHeader', content: [p('Position')] }, { type: 'tableHeader', content: [p('Betrag')] }] },
    { type: 'tableRow', content: [{ type: 'tableCell', content: [p('Beratung')] }, { type: 'tableCell', content: [p('120,00 €')] }] },
  ] },
  { type: 'image', attrs: { src: image, alt: 'Grünes Bild', widthPercent: 25 } },
  { type: 'pageBreak' },
  p('ZWEITE SEITE'),
  ...Array.from({ length: 65 }, (_, i) => p(`Absatz ${i + 1}: Dies ist ein mehrseitiger Dokumententest mit vollständigem Text.`)),
] } };
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  assert.match(String(url), /^\/vendor\/editor-fonts\/[\w.-]+\.ttf$/);
  const bytes = await readFile('public' + url);
  return new Response(process.env.MOINPDF_TEST_COMPRESSED_FONTS ? gzipSync(bytes) : bytes);
};
const { createWriterPdf, writerPdfDefinition } = await import('../.cache/writer-pdf-test.mjs');
const blob = await createWriterPdf(rich);
const bytes = new Uint8Array(await blob.arrayBuffer());
await writeFile('.cache/writer-proof.pdf', bytes);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const source = await pdfjs.getDocument({ data: bytes }).promise;
assert(source.numPages >= 4);
const texts = [];
for (let n = 1; n <= source.numPages; n++) {
  const page = await source.getPage(n);
  texts.push((await page.getTextContent()).items.filter(x => 'str' in x).map(x => x.str).join(' '));
}
assert.match(texts[0], /Meine Ideen/);
assert.match(texts[0], /Änderung 2026 – 1.234,56 €/);
assert.match(texts[0], /Beratung/); assert.match(texts[0], /120,00 €/);
assert(!texts[0].includes('ZWEITE SEITE'));
assert.match(texts[1], /ZWEITE SEITE/);
for (let i = 0; i < texts.length; i++) {
  assert.match(texts[i], /Kopfzeile – MoinPDF/);
  assert.match(texts[i], new RegExp(`Seite ${i + 1} von ${texts.length}`));
}
assert.match(texts.join(' '), /Absatz 65:/);
const first = await source.getPage(1), viewport = first.getViewport({ scale: 1.3 }), preview = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
await first.render({ canvas: preview, viewport }).promise;
await writeFile('.cache/writer-proof.png', preview.toBuffer('image/png'));
await source.loadingTask.destroy();
for (const paper of ['A4', 'A5', 'LETTER']) for (const landscape of [false, true]) {
  const value = { ...base, settings: { ...base.settings, paper, landscape } };
  const definition = writerPdfDefinition(value);
  assert.equal(definition.content.length, 1);
  const empty = await createWriterPdf(value, 'en');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await empty.arrayBuffer()) }).promise;
  assert.equal(pdf.numPages, 1);
  const size = (await pdf.getPage(1)).getViewport({ scale: 1 });
  assert.equal(size.width > size.height, landscape);
  await pdf.loadingTask.destroy();
}
globalThis.fetch = originalFetch;
dom.window.close();
await import('./writer-ui-smoke.mjs');
console.log('PASS: real editor formatting/undo/table schema; safe paste; local draft save/reopen/delete; draft file roundtrip; selectable multilingual PDF text, fonts, lists, tables, image, explicit and automatic page breaks, repeated headers/footers, complete multi-page content; empty documents in all 6 page formats/orientations.');
