// Exercise production session code with a controllable PDF.js transport boundary.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { getEventListeners } from 'node:events';
import { test } from 'node:test';
import ts from 'typescript';

const dir = '.cache/pdf-session';
await mkdir(dir, { recursive: true });
for (const name of ['pdf-engine', 'pdf-text']) {
  const source = await readFile(`lib/${name}.ts`, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
    .replace("from './pdf-text'", "from './pdf-text.mjs'")
    .replace("import('pdfjs-dist/legacy/build/pdf.mjs')", 'Promise.resolve(globalThis.testPdfRenderer)');
  await writeFile(`${dir}/${name}.mjs`, code);
}
const pending = () => Promise.withResolvers();
let state;
globalThis.testPdfRenderer = {
  GlobalWorkerOptions: {},
  PDFWorker: class {
    constructor() { this.calls = 0; state.workers.push(this); }
    destroy() { this.calls++; }
  },
  getDocument(options) {
    state.options.push(options);
    const current = state;
    return { promise: current.load.promise, destroy() { current.destroyCalls++; return current.shutdown.promise; } };
  },
};
const { withPdfDocument, PdfTimeoutError } = await import('../.cache/pdf-session/pdf-engine.mjs');
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const setup = t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  state = { load: pending(), shutdown: pending(), workers: [], options: [], destroyCalls: 0 };
  const parent = new AbortController();
  t.after(() => {
    assert.equal(getEventListeners(parent.signal, 'abort').length, 0, 'remove parent listener');
    assert(state.workers.every(w => w.calls === 1), 'terminate every owned worker exactly once');
  });
  return parent;
};
const bytes = new Uint8Array([1, 2, 3]);

await test('successful check copies input, preserves options and cleans up', async t => {
  const parent = setup(t);
  state.load.resolve({ numPages: 2 }); state.shutdown.resolve();
  let discarded = 0;
  const value = await withPdfDocument(bytes, parent.signal, async (pdf, signal, step) => {
    assert(!signal.aborted);
    return step('text', Promise.resolve(pdf.numPages));
  }, { disableFontFace: true, discard() { discarded++; } });
  assert.equal(value, 2); assert.equal(discarded, 0);
  assert.notEqual(state.options[0].data, bytes); assert.deepEqual(state.options[0].data, bytes);
  assert.equal(state.options[0].worker, state.workers[0]);
  assert.equal(state.options[0].disableFontFace, true); assert.equal(state.destroyCalls, 1);
});
await test('cancel during opening survives an unresponsive Terminate acknowledgement', async t => {
  const parent = setup(t); let used = false;
  const check = withPdfDocument(bytes, parent.signal, async () => { used = true; });
  const rejected = assert.rejects(check, { name: 'AbortError' });
  await flush(); parent.abort(); await flush();
  t.mock.timers.tick(1500); await rejected;
  assert(!used); assert.equal(state.destroyCalls, 1);
  state.load.resolve({}); await flush(); assert(!used, 'late load must not start a cancelled check');
});
await test('unanswered read times out with its stage and keeps the original input alive', async t => {
  const parent = setup(t); state.load.resolve({}); state.shutdown.resolve();
  const check = withPdfDocument(bytes, parent.signal, (_pdf, _signal, step) => step('operator-list', pending().promise));
  const rejected = assert.rejects(check, e => e instanceof PdfTimeoutError && e.stage === 'operator-list');
  await flush(); t.mock.timers.tick(60000); await rejected;
  assert.deepEqual(bytes, new Uint8Array([1, 2, 3])); assert(!parent.signal.aborted);
});
await test('document opening has the same deadline', async t => {
  const parent = setup(t); state.shutdown.resolve();
  const rejected = assert.rejects(withPdfDocument(bytes, parent.signal, async () => 1), e => e instanceof PdfTimeoutError && e.stage === 'document-open');
  await flush(); t.mock.timers.tick(60000); await rejected;
});
await test('late success after cancellation is discarded once and never delivered', async t => {
  const parent = setup(t); state.load.resolve({}); state.shutdown.resolve();
  const callback = pending(), value = { canvas: true }; const discarded = [];
  const rejected = assert.rejects(withPdfDocument(bytes, parent.signal, () => callback.promise, { discard(v) { discarded.push(v); } }), { name: 'AbortError' });
  await flush(); parent.abort(); await rejected; callback.resolve(value); await flush();
  assert.deepEqual(discarded, [value]);
});
await test('cancel during shutdown discards an already computed result', async t => {
  const parent = setup(t); state.load.resolve({}); const discarded = [];
  const rejected = assert.rejects(withPdfDocument(bytes, parent.signal, async () => 42, { discard(v) { discarded.push(v); } }), { name: 'AbortError' });
  await flush(); parent.abort(); await flush(); t.mock.timers.tick(1500); await rejected;
  assert.deepEqual(discarded, [42]);
});
await test('ordinary failures preserve their cause and still terminate', async t => {
  const parent = setup(t); state.load.resolve({}); state.shutdown.resolve();
  const failure = new Error('Text mismatch');
  await assert.rejects(withPdfDocument(bytes, parent.signal, async () => { throw failure; }), e => e === failure);
});
await test('successful verification cannot hang during shutdown', async t => {
  const parent = setup(t); state.load.resolve({});
  const check = withPdfDocument(bytes, parent.signal, async () => 42);
  await flush(); t.mock.timers.tick(1500); assert.equal(await check, 42);
});
await test('already aborted work creates no renderer', async t => {
  const parent = setup(t); parent.abort();
  await assert.rejects(withPdfDocument(bytes, parent.signal, async () => 42), { name: 'AbortError' });
  assert.equal(state.workers.length, 0);
});
console.log('PASS: temporary PDF session cancellation, deadlines, shutdown, immutable input and late-resource disposal.');
