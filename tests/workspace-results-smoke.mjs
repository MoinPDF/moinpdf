import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const folder = '.cache/workspace-results';
await mkdir(folder, { recursive: true });
// Keep the real provider and context; only control the timing of persistence.
for (const file of ['components/studio/workspace-results.tsx', 'components/studio/workspace-result-context.tsx', 'lib/ui-language.ts']) {
  const code = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText.replace(/(['"])(@\/[^'"]+|\.\/[^'"]+)\1/g, (_, quote, path) => {
    const name = path.split('/').at(-1);
    return `${quote}./${['workspace-result-context','ui-language'].includes(name) ? name : 'services'}.mjs${quote}`;
  }).replace("from 'sonner'", "from './services.mjs'");
  await writeFile(`${folder}/${file.split('/').at(-1).replace(/\.tsx?$/, '.mjs')}`, code);
}
await writeFile(`${folder}/services.mjs`, `
export const pending=[],notices=[],operations=[];
export const toast={error:message=>notices.push(message)};
export const storedResults=async()=>[];
export const storeResult=result=>new Promise((resolve,reject)=>pending.push({result,resolve,reject}));
export const removeResult=async id=>operations.push(['remove',id]);
export const clearResults=async()=>operations.push(['clear']);
export const uuid=()=>crypto.randomUUID();
const unused=()=>{throw Error('Unexpected presentation service');};
export const useExportAudit=unused;
export const useLanguage=unused,downloadBlob=unused,formatSize=unused,storedServerJobs=unused,inspectServerJob=unused,resumeServerJob=unused,cancelServerJob=unused;
export const Button=unused,Dialog=unused,DialogContent=unused,DialogHeader=unused,DialogTitle=unused,DialogDescription=unused;
`);
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://moinpdf.test' });
for (const key of ['window','document','navigator','HTMLElement','Node'])
  Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createElement:h,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {WorkspaceResultsProvider,useWorkspaceResults}=await import('../.cache/workspace-results/workspace-results.mjs');
const {pending,notices,operations}=await import('../.cache/workspace-results/services.mjs');
const language=await import('../.cache/workspace-results/ui-language.mjs');
language.installEnglishCatalog(JSON.parse(await readFile('public/locales/en.json','utf8')));
language.setUiLanguage('en');
let api;
function Probe(){api=useWorkspaceResults();return h('output',null,api.results.map(x=>x.filename).join('|'));}
const root=createRoot(document.getElementById('root'));
const file=name=>({filename:name,blob:new Blob(['synthetic result'],{type:'application/pdf'})});
const finish=async()=>{const next=pending.shift();assert.ok(next);await act(async()=>next.resolve([next.result]));};
try {
  await act(async()=>root.render(h(WorkspaceResultsProvider,null,h(Probe))));
  await act(async()=>api.remember(file('clear-me.pdf')));
  assert.equal(api.results.length,1);
  await act(async()=>api.clear());
  assert.equal(api.results.length,0);
  await finish();
  assert.equal(api.results.length,0,'Clearing must not resurrect a pending stored result');
  assert.deepEqual(operations.at(-1),['clear']);

  await act(async()=>api.remember(file('remove-me.pdf')));
  const id=api.results[0].id;
  await act(async()=>api.remove(id));
  await finish();
  assert.equal(api.results.length,0,'Removing must not resurrect a pending stored result');
  assert.deepEqual(operations.at(-1),['remove',id]);

  await act(async()=>{api.remember(file('first.pdf'));api.remember(file('second.pdf'));});
  assert.deepEqual(api.results.map(x=>x.filename),['second.pdf','first.pdf']);
  const first=pending.shift();
  await act(async()=>first.resolve([first.result]));
  assert.deepEqual(api.results.map(x=>x.filename),['second.pdf','first.pdf'],'An older write must not hide a newer result');
  const second=pending.shift();
  await act(async()=>second.resolve([second.result,first.result]));

  await act(async()=>api.remember(file('storage-full.pdf')));
  await act(async()=>pending.shift().reject(Error('quota')));
  assert.equal(api.results[0].filename,'storage-full.pdf','A failed save keeps the downloadable result');
  assert.deepEqual(notices,['Results remain available in this session; local storage is unavailable or full. Please download them.']);
} finally {
  await act(async()=>root.unmount());
  dom.window.close();
}
console.log('PASS: real results provider keeps clear/remove authoritative during pending writes, retains newer results and translates storage errors.');
