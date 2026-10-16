// Actual React/Tiptap document switching and IndexedDB persistence. No visual-browser claim.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';

const modules = {
  'lib/writer-model.ts': 'writer-model',
  'lib/writer-extensions.ts': 'writer-extensions',
  'lib/result-details.ts': 'result-details',
  'lib/utils.ts': 'utils',
  'components/ui/button.tsx': 'button',
  'components/ui/dialog.tsx': 'dialog',
  'components/studio/result-actions.tsx': 'result-actions',
  'components/studio/document-writer.tsx': 'document-writer',
};
await mkdir('.cache/writer-ui', { recursive: true });
for (const [source, name] of Object.entries(modules)) {
  let code = ts.transpileModule(await readFile(source, 'utf8'), {
    fileName: source,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [from, to] of Object.entries({
    '@/lib/writer-model': './writer-model.mjs', '@/lib/writer-extensions': './writer-extensions.mjs',
    './writer-model': './writer-model.mjs', '@/lib/result-details': './result-details.mjs',
    '@/lib/utils': './utils.mjs', '@/components/ui/button': './button.mjs',
    '@/components/ui/dialog': './dialog.mjs', './result-actions': './result-actions.mjs',
    './appearance': './appearance.mjs', sonner: './toast.mjs', '@/lib/pdf-engine': './pdf-engine.mjs',
  })) code = code.replaceAll(`'${from}'`, `'${to}'`).replaceAll(`"${from}"`, `"${to}"`);
  await writeFile(`.cache/writer-ui/${name}.mjs`, code);
}
await writeFile('.cache/writer-ui/appearance.mjs', `const t=(de,en)=>de; export const useLanguage=()=>({language:'de',t});`);
await writeFile('.cache/writer-ui/toast.mjs', `export const errors=[]; export const toast={error:value=>errors.push(value),success(){}};`);
await writeFile('.cache/writer-ui/pdf-engine.mjs', `const unused=()=>{throw Error('PDF operations are covered by writer-smoke and browser CI')}; export const downloadBlob=unused,openSource=unused,renderPage=unused;`);

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://moinpdf.test', pretendToBeVisual: true });
for (const key of ['window','document','navigator','HTMLElement','Element','Node','NodeFilter','HTMLInputElement','HTMLButtonElement','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','FocusEvent','DOMParser','getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom.window : dom.window[key] });
}
Object.assign(globalThis, { indexedDB, requestAnimationFrame: cb=>setTimeout(cb,1), cancelAnimationFrame: clearTimeout, IS_REACT_ACT_ENVIRONMENT: true });
const { act, createElement: h } = await import('react');
const { createRoot } = await import('react-dom/client');
const { DocumentWriter } = await import('../.cache/writer-ui/document-writer.mjs');
const model = await import('../.cache/writer-ui/writer-model.mjs');
const { errors } = await import('../.cache/writer-ui/toast.mjs');
const failures = [];
const root = createRoot(document.querySelector('#root'), { onUncaughtError: error => failures.push(error) });
const flush = () => act(async () => { await new Promise(resolve=>setTimeout(resolve,30)); });
const button = text => [...document.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')===text || el.textContent===text);
const click = async text => {
  const target = button(text); assert(target, `Button exists: ${text}`);
  await act(async () => target.click()); await flush();
  if (failures.length) throw failures[0];
};
const content = () => document.querySelector('[role=textbox][aria-label="Dokumentinhalt"]');
let current = model.emptyWriterDocument('Retained draft');
const initialId = current.id;
try {
  await act(async () => root.render(h(DocumentWriter, { initial: current, onChange: doc=>{current=doc;}, onBack(){}, onBusy(){}, onSaved(){} })));
  await flush();
  assert(content(), 'Editor is mounted');
  await act(async () => content().editor.commands.insertContent('Original saved contents.'));
  await click('Entwurf speichern');
  assert.equal((await model.listWriterDrafts()).find(doc=>doc.id===initialId).content.content[0].content[0].text, 'Original saved contents.');
  for (let cycle=0; cycle<3; cycle++) {
    await click('Entwürfe');
    await click('Leeres Dokument');
    assert(content(), 'Blank-document switch retains the mounted editor');
    assert.equal(content().textContent, '');
    assert.notEqual(current.id, initialId);
    assert.equal(content().editor.can().undo(), false, 'Undo cannot cross document boundaries');
    await act(async () => content().editor.commands.insertContent('Separate document.'));
    await click('Entwurf speichern');
    await click('Entwürfe');
    const saved = [...document.querySelectorAll('.writer-draft-open')].find(el=>el.querySelector('strong').textContent==='Retained draft');
    assert(saved, 'The original saved draft remains available');
    await act(async () => saved.click()); await flush();
    if (failures.length) throw failures[0];
    assert.equal(content().textContent, 'Original saved contents.');
    assert.equal(current.id, initialId);
    assert.equal(content().editor.can().undo(), false, 'Opening a draft starts independent undo history');
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log('PASS: real React/Tiptap editor switches repeatedly between blank and saved documents, retains content in IndexedDB and isolates undo histories.');
} finally {
  await act(async () => root.unmount()); await flush();
  dom.window.close();
}
