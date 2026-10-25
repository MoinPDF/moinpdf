// React lifecycle check: hidden work must not block newly visible thumbnails.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const folder = '.cache/page-preview';
await mkdir(folder, { recursive: true });
const code = ts.transpileModule(await readFile('components/studio/canvas.tsx', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replace(/(['"])(@\/[^'"]+|\.\/[^'"]+)\1/g, (_, q, p) => q + './' + p.split('/').at(-1) + '.mjs' + q);
await writeFile(folder + '/canvas.mjs', code);
for (const [name, contents] of Object.entries({
  'ui-language': 'export const ui=value=>value;',
  appearance: 'export const useLanguage=()=>{};',
  'editor-canvas': 'export const MarkLayers=()=>null;',
  button: 'export const Button=()=>null;',
  'pdf-engine': 'export const renderPage=(...args)=>globalThis.previewRender(...args);export const uid=()=>"fixture";',
  'resource-budget': 'export const deviceBudget=()=>({previewRetentionMs:30});',
  'studio-engine': 'export const normalizedRect=()=>({});',
})) await writeFile(folder + '/' + name + '.mjs', contents);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://moinpdf.test' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const observers = [], jobs = [], cleaned = [], revoked = [];
globalThis.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe() {}
  disconnect() { this.disconnected = true; }
  visible(value) { this.callback([{ isIntersecting: value }]); }
};
globalThis.previewRender = (source, page, size, signal) => new Promise((resolve, reject) => {
  const canvas = { width: 216, height: 270, toBlob: callback => callback(new Blob(['fictional preview'])) };
  const job = { page, signal, canvas, finish: () => resolve({ canvas }) };
  jobs.push(job);
  signal.addEventListener('abort', () => reject(signal.reason), { once: true });
});
const revoke = URL.revokeObjectURL;
URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
const React = await import('react'), { createRoot } = await import('react-dom/client');
const { act } = React, { PagePreview } = await import('../.cache/page-preview/canvas.mjs');
const source = { id: 'source', name: 'fictional.pdf', pdf: { getPage: async index => ({ cleanup: () => cleaned.push(index) }) } };
const root = createRoot(document.getElementById('root'));
try {
  await act(async () => root.render(React.createElement(React.Fragment, null, ...[0, 1].map(index =>
    React.createElement(PagePreview, { key: index, source, page: { index, rotation: 0 }, small: true })))));
  await act(async () => observers[0].visible(true));
  assert.equal(jobs.length, 1);
  await act(async () => { observers[0].visible(false); observers[1].visible(true); });
  assert(jobs[0].signal.aborted, 'Leaving the viewport immediately cancels unfinished rendering');
  assert.equal(jobs.length, 2, 'The newly visible page starts without waiting for cache eviction');
  await act(async () => { jobs[0].finish(); jobs[1].finish(); });
  assert.equal(document.querySelectorAll('img').length, 1, 'Late hidden results never reappear');
  assert.equal(jobs[1].canvas.width, 0, 'The rendered canvas is released');
  assert.deepEqual(cleaned, [2]);
  const image = document.querySelector('img').src;
  await act(async () => observers[1].visible(false));
  assert.equal(document.querySelector('img').src, image, 'Completed images retain their bounded grace period');
  await act(async () => new Promise(resolve => setTimeout(resolve, 45)));
  assert.equal(document.querySelectorAll('img').length, 0);
  assert(revoked.includes(image));
  await act(async () => observers[1].visible(true));
  assert.equal(jobs.length, 3, 'Returning to an evicted page starts a fresh preview');
  await act(async () => jobs[2].finish());
  assert.equal(document.querySelectorAll('img').length, 1);
  const restored = document.querySelector('img').src;
  await act(async () => root.unmount());
  assert(revoked.includes(restored));
  assert(observers.every(observer => observer.disconnected));
} finally {
  URL.revokeObjectURL = revoke;
  dom.window.close();
}
console.log('PASS: hidden preview work is cancelled immediately, visible work proceeds, stale output is rejected and retained images are evicted/recreated/released.');
