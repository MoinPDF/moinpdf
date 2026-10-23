// Recovery concurrency and lifecycle regression tests, without browser mocks of storage timing.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const folder = '.cache/editor-resilience';
await mkdir(folder, { recursive: true });
for (const file of ['lib/recovery-writer.ts', 'components/studio/workspace-recovery.tsx']) {
  const code = ts.transpileModule(await readFile(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText.replace(/(['"])(@\/[^'"]+|\.\/[^'"]+)\1/g, (_, q, p) => q + './' + p.split('/').at(-1) + '.mjs' + q);
  await writeFile(folder + '/' + file.split('/').at(-1).replace(/\.tsx?$/, '.mjs'), code);
}
const { createRecoveryWriter } = await import('../.cache/editor-resilience/recovery-writer.mjs');
const states = [], stored = [], pending = [];
const writer = createRecoveryWriter(value => new Promise((resolve, reject) => {
  stored.push(value); pending.push({ resolve, reject });
}), state => states.push(state), 20);
writer.schedule('first'); writer.schedule('second');
const flushed = writer.flush();
await Promise.resolve();
assert.deepEqual(stored, ['second'], 'Only the newest debounced snapshot is written');
for (let i = 0; i < 100; i++) writer.schedule(`revision-${i}`);
pending[0].resolve();
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(stored, ['second', 'revision-99'], 'One active write and at most one waiting snapshot');
assert(!states.some(s => s.phase === 'saved'), 'An old write never marks newer edits as saved');
pending[1].resolve(); await flushed;
assert.equal(states.at(-1).phase, 'saved'); assert(states.at(-1).updated > 0);
writer.schedule('cancelled'); await writer.cancel(); await writer.flush();
assert.equal(stored.length, 2, 'Cancelled work never reappears');
writer.schedule('quota'); const failed = writer.flush(); await Promise.resolve();
pending[2].reject(new Error('QuotaExceededError')); await failed;
assert.equal(states.at(-1).phase, 'error');
writer.schedule('retry'); const retried = writer.flush(); await Promise.resolve();
pending[3].resolve(); await retried;
assert.equal(states.at(-1).phase, 'saved', 'Storage failures do not poison the queue');
writer.schedule('timer'); await new Promise(resolve => setTimeout(resolve, 30));
assert.equal(stored.at(-1), 'timer', 'Idle typing saves without an explicit flush');
const cancelledWhileWriting = writer.cancel(); pending[4].resolve(); await cancelledWhileWriting;
await writer.cancel();

await writeFile(folder + '/button.mjs', `import React from 'react';export const Button=({variant,size,...p})=>React.createElement('button',p);`);
await writeFile(folder + '/appearance.mjs', `export const useLanguage=()=>({t:de=>de});`);
await writeFile(folder + '/pdf-engine.mjs', `export const openSource=async()=>{throw Error('Unexpected restore')};`);
await writeFile(folder + '/local-projects.mjs', `export const cleanProjectState=s=>s;export const validateProject=()=>{};`);
await writeFile(folder + '/workspace-storage.mjs', `export const writes=[],jobs=[],events=[];export const loadRecovery=async()=>undefined;export const storeRecovery=value=>new Promise(resolve=>{writes.push(value);events.push('write');jobs.push(resolve)});export const clearRecovery=async()=>events.push('clear');`);
const dom = new JSDOM('<div id="root"></div><div id="moinpdf-recovery"></div>', { url: 'https://moinpdf.test' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react'), { createRoot } = await import('react-dom/client'), { act } = React;
const { WorkspaceRecovery } = await import('../.cache/editor-resilience/workspace-recovery.mjs');
const storage = await import('../.cache/editor-resilience/workspace-storage.mjs');
const root = createRoot(document.getElementById('root'));
const sources = [{ id: 'source', name: 'private.pdf', bytes: new Uint8Array([1, 2, 3]), pdf: {} }];
const statuses = [], state = { pages: [], edits: { marks: {}, crops: {} } };
const props = { sources, state, locked: false, onRestore: () => {}, onStatus: value => statuses.push(value) };
Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
try {
  await act(async () => root.render(React.createElement(WorkspaceRecovery, props)));
  assert.equal(statuses.at(-1).phase, 'pending');
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(storage.writes.length, 1, 'App switching flushes the pending snapshot without waiting for debounce');
  assert(!('pdf' in storage.writes[0].sources[0]), 'PDF worker handles are never persisted');
  const newest = { ...state, activeId: 'edited-page' };
  await act(async () => root.render(React.createElement(WorkspaceRecovery, { ...props, state: newest })));
  await act(async () => window.dispatchEvent(new Event('pagehide')));
  await act(async () => storage.jobs[0]());
  assert.equal(storage.writes.length, 2);
  assert.equal(storage.writes[1].state.activeId, 'edited-page');
  assert(!statuses.some(s => s.phase === 'saved'));
  await act(async () => storage.jobs[1]());
  assert.equal(statuses.at(-1).phase, 'saved');
  await act(async () => root.render(React.createElement(WorkspaceRecovery, { ...props, state: { ...newest, activeId: 'clear-me' } })));
  await act(async () => window.dispatchEvent(new Event('pagehide')));
  await act(async () => {
    window.dispatchEvent(new Event('moinpdf-clear-workspace'));
    root.render(React.createElement(WorkspaceRecovery, { ...props, sources: [], state }));
  });
  assert.equal(storage.events.at(-1), 'write', 'Clearing waits for an in-flight write');
  await act(async () => storage.jobs[2]());
  assert.equal(storage.events.at(-1), 'clear', 'A late write cannot resurrect a discarded workspace');
  await act(async () => window.dispatchEvent(new Event('pagehide')));
  assert.equal(storage.writes.length, 3);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
console.log('PASS: coalesced recovery, newest-revision status, failure/retry, visibility/pagehide flush and ordered workspace clearing.');
