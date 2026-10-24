import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
const folder = '.cache/ui-efficiency';
await mkdir(folder, { recursive: true });
for (const file of [
  'lib/tool-preferences.ts',
  'components/studio/responsive-inspector.tsx',
  'components/studio/result-next-steps.tsx',
  'components/studio/compression-presets.tsx',
]) {
  const name = file
    .split('/')
    .at(-1)
    .replace(/\.tsx?$/, '.mjs');
  const code = ts
    .transpileModule(await readFile(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    .outputText.replaceAll("'./appearance'", "'./appearance.mjs'")
    .replaceAll("'@/components/ui/select'", "'./appearance.mjs'");
  await writeFile(`${folder}/${name}`, code);
}
await writeFile(
  `${folder}/appearance.mjs`,
  `import {createContext} from 'react'; export const SelectPortalContainer=createContext(null); export const useLanguage=()=>({t:(de,en)=>de});`,
);
const { defaultFavorites, parseToolPreferences, recordToolUse } =
  await import('../.cache/ui-efficiency/tool-preferences.mjs');
const ids = [...defaultFavorites, 'organize', 'split'];
for (const raw of [null, 'broken', 'null', '[]', '{"favorites":[]}'])
  assert.deepEqual(parseToolPreferences(raw, ids), { favorites: defaultFavorites, recent: [] });
const prefs = parseToolPreferences(
  JSON.stringify({
    favorites: ['split', 'merge', 'split', 'unknown'],
    recent: ['organize', 'unknown', 'organize', 'merge'],
    filename: 'private.pdf',
  }),
  ids,
);
assert.deepEqual(prefs, { favorites: ['split', 'merge'], recent: ['organize', 'merge'] });
let recent = prefs;
for (const id of ids) recent = recordToolUse(recent, id);
recent = recordToolUse(recent, 'merge');
assert.equal(recent.recent.length, 5);
assert.equal(recent.recent[0], 'merge');
assert.equal(new Set(recent.recent).size, 5);
assert.deepEqual(recent.favorites, prefs.favorites);
const dom = new JSDOM(
  '<!doctype html><button id="mobile-editor-format">Format</button><div id="root"></div>',
  { url: 'http://moinpdf.test', pretendToBeVisual: true },
);
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'CustomEvent',
  'Event',
  'localStorage',
])
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === 'window' ? dom.window : dom.window[key],
  });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
  this.dispatchEvent(new Event('close'));
};
const { act, createElement: h, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
const { ResponsiveInspector } = await import('../.cache/ui-efficiency/responsive-inspector.mjs');
const { ResultNextSteps } = await import('../.cache/ui-efficiency/result-next-steps.mjs');
const { CompressionPresets, savedCompressionQuality } =
  await import('../.cache/ui-efficiency/compression-presets.mjs');
let mounts = 0;
function Draft() {
  const [value, setValue] = useState(() => {
    mounts++;
    return 0;
  });
  return h('button', { id: 'draft', onClick: () => setValue(value + 1) }, String(value));
}
let setOpen;
function Inspector() {
  const [open, change] = useState(false);
  setOpen = change;
  return h(ResponsiveInspector, { editor: true, open, onOpenChange: change }, h(Draft));
}
const root = createRoot(document.getElementById('root'));
await act(async () => root.render(h(Inspector)));
const initial = mounts;
await act(async () => setOpen(true));
assert.equal(document.querySelector('dialog').open, true);
assert.equal(document.activeElement.id, 'editor-sheet-title');
await act(async () => document.getElementById('draft').click());
await act(async () => setOpen(false));
assert.equal(document.querySelector('dialog').open, false);
await act(async () => setOpen(true));
assert.equal(document.getElementById('draft').textContent, '1');
assert.equal(mounts, initial, 'Closing settings must retain uncommitted workflow drafts');
await act(async () => setOpen(false));
assert.equal(document.activeElement.id, 'mobile-editor-format');
const result = {
  blob: new Blob(['fictional output'], { type: 'application/pdf' }),
  filename: 'Renamed.pdf',
};
let next;
window.addEventListener('moinpdf-continue-result', (event) => (next = event.detail));
await act(async () => root.render(h(ResultNextSteps, { result, disabled: false })));
await act(async () => document.querySelector('.result-next-steps button').click());
assert.equal(next.result, result);
assert.equal(next.tool, 'edit-text');
await act(async () =>
  root.render(
    h(ResultNextSteps, {
      result: { ...result, blob: new Blob(['zip'], { type: 'application/zip' }) },
      disabled: false,
    }),
  ),
);
assert.equal(document.querySelector('.result-next-steps'), null);
assert.equal(savedCompressionQuality(), null);
localStorage.setItem('moinpdf-compression-preference-v1', 'malformed');
assert.equal(savedCompressionQuality(), null);
let value = 'balanced';
await act(async () =>
  root.render(
    h(CompressionPresets, { value, onChange: (next) => (value = next), disabled: false }),
  ),
);
await act(async () => document.querySelector('.preference-check input').click());
assert.equal(savedCompressionQuality(), 'balanced');
await act(async () => document.querySelector('.compression-preset-grid button').click());
assert.equal(value, 'small');
assert.equal(savedCompressionQuality(), 'small');
await act(async () => document.querySelector('.preference-check input').click());
assert.equal(savedCompressionQuality(), null);
await act(async () => root.unmount());
dom.window.close();
console.log(
  'PASS: sanitized favorites and recent history, retained mobile inspector drafts/focus, correct result handoff and opt-in compression preference.',
);
