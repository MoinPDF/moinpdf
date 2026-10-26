import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
const folder = '.cache/release-022';
await mkdir(folder, { recursive: true });
const code = ts.transpileModule(await readFile('components/studio/word-export-options.tsx', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replaceAll("'@/lib/ui-language'", "'./ui-language.mjs'").replaceAll("'./advanced-shared'", "'./advanced-shared.mjs'");
await writeFile(folder + '/word-export-options.mjs', code);
await writeFile(folder + '/ui-language.mjs', 'export const ui=s=>s;');
await writeFile(folder + '/advanced-shared.mjs', `import {createElement as h} from 'react';
export const Choice=({label,value,onChange,items})=>h('label',null,label,h('select',{value,onChange:e=>onChange(e.target.value)},items.map(([v,t])=>h('option',{key:v,value:v},t))));
export const Tick=({label,value,onChange})=>h('label',null,h('input',{type:'checkbox',checked:value,onChange:e=>onChange(e.target.checked)}),label);`);
const dom = new JSDOM('<div id="root"></div>', { url: 'https://moinpdf.test' });
for (const name of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'MouseEvent']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement: h, useState, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { WordExportOptions } = await import('../.cache/release-022/word-export-options.mjs');
const root = createRoot(document.getElementById('root'));
let mode, local;
function Harness({initial='layout',server=false,disabled=false}) {
  const [value,setValue]=useState(initial), [processing,setProcessing]=useState('local');
  mode=value; local=processing==='local';
  return h(WordExportOptions,{mode,local,serverAvailable:server,disabled,onModeChange:setValue,onProcessingChange:setProcessing});
}
const click = async node => act(async () => node.click());
try {
  await act(async()=>root.render(h(Harness,{server:true})));
  const radios=()=>[...document.querySelectorAll('[type=radio]')];
  assert.equal(radios().length,2);assert(radios()[0].checked);
  assert(!document.querySelector('details').open,'A new local export starts with only the two goals');
  await click(radios()[1]);assert.equal(mode,'structured');
  await click(document.querySelector('summary'));
  await click(document.querySelector('[type=checkbox]'));assert.equal(mode,'text');
  assert(!radios().some(r=>r.checked),'Text-only export never falsely claims to preserve layout');
  assert.match(document.querySelector('[role=status]')?.textContent || document.querySelector('[aria-live]').textContent,/Nur Text/);
  await click(radios()[0]);assert.equal(mode,'layout');assert(!document.querySelector('[type=checkbox]').checked);
  await act(async()=>{const select=document.querySelector('select');select.value='server';select.dispatchEvent(new Event('change',{bubbles:true}));});
  assert(!local);assert.equal(radios().length,0);assert(document.querySelector('details').open);
  assert.match(document.body.textContent,/PDF an deinen Dokumentenserver übertragen/);
  await act(async()=>root.render(h(Harness,{key:'restore',initial:'text'})));
  assert(document.querySelector('details').open,'Restored text-only drafts expose their selected advanced option');
  assert.equal(document.querySelectorAll('select').length,0,'Hosted browser-only builds have no server switch');
  await act(async()=>root.render(h(Harness,{key:'busy',disabled:true})));
  assert(radios().every(r=>r.matches(':disabled')),'Conversion freezes the entire option group');
  await act(async()=>root.unmount());
} finally { dom.window.close(); }
console.log('PASS: two Word goals, advanced text-only/server choices, draft restoration and disabled conversion controls.');
