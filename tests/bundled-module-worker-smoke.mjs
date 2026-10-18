// Runs the generated bootstrap and deployed PDF modules with HTTP module URLs
// in a VM. This checks actual WASM loading/message processing, not browser COEP.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { resolveObjectURL } from 'node:buffer';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import ts from 'typescript';

const root=path.resolve(process.argv[2]||'dist/client');
const assets=(await readdir(root)).includes('_next')?'_next/static':'assets';
const files=await readdir(path.join(root,assets));
const entries=[];
for(const name of files){
 if(/^native-pdf-[\w-]+\.js$/.test(name)&&!name.startsWith('native-pdf-core-')&&/self\.onmessage\s*=/.test(await readFile(path.join(root,assets,name),'utf8')))entries.push(name);
}
assert.equal(entries.length,1,'The production build contains one native PDF worker entry');
const entry='/'+assets+'/'+entries[0];
const origin='https://moinpdf.test';
const helper=ts.transpileModule(await readFile('lib/module-worker.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {createLocalModuleWorker}=await import('data:text/javascript,'+encodeURIComponent(helper));
globalThis.location=new URL(origin+'/editor');
globalThis.Worker=class {constructor(url){this.url=url;}terminate(){}};
const requested=new Set();
function assetPath(url){
 assert.equal(url.origin,origin,'All worker modules/assets must stay on the app origin');
 assert.equal(url.protocol,'https:');
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 assert(file.startsWith(root+path.sep));
 return file;
}
async function run(data){
 const handle=createLocalModuleWorker(entry);
 const bootstrap=await resolveObjectURL(handle.worker.url).text();
 let result,closed=false;
 const sandbox={console,Error,TypeError,DOMException,URL,TextEncoder,TextDecoder,Response,Request,Blob,WebAssembly,crypto,
  Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array,ArrayBuffer,SharedArrayBuffer,Atomics,
  atob,btoa,setTimeout,clearTimeout,performance,WorkerGlobalScope:class {},
  location:new URL('blob:'+origin+'/test'),
  postMessage:value=>{result=value;},close:()=>{closed=true;},
  fetch:async(input,init)=>{
   // Intentionally no fallback base: relative fetches from a blob must be fixed
   // by the generated bootstrap, just as they must be in the browser.
   const url=new URL(input instanceof Request?input.url:String(input));
   requested.add(url.pathname);
   return new Response(await readFile(assetPath(url)),{headers:{'content-type':url.pathname.endsWith('.wasm')?'application/wasm':'text/javascript'}});
  },
 };
 sandbox.self=sandbox;
 const context=vm.createContext(sandbox);
 const cache=new Map();
 async function getModule(href){
  if(cache.has(href))return cache.get(href);
  const pending=(async()=>new vm.SourceTextModule(await readFile(assetPath(new URL(href)),'utf8'),{
   context,identifier:href,
   initializeImportMeta:meta=>{meta.url=href;},
   importModuleDynamically:async(specifier,referencing)=>{
    const module=await getModule(new URL(specifier,referencing.identifier).href);
    if(module.status==='unlinked')await module.link(link);
    if(module.status==='linked')await module.evaluate();
    return module;
   },
  }))();
  cache.set(href,pending);return pending;
 }
 const link=(specifier,referencing)=>getModule(new URL(specifier,referencing.identifier).href);
 try {
  const module=new vm.SourceTextModule(bootstrap,{context,identifier:sandbox.location.href});
  await module.link(link);await module.evaluate();
  await sandbox.onmessage({data});
  assert(closed,'One-shot PDF worker must close after a result');
  if(result?.error)throw Error(result.error);
  assert(result&&'value'in result,'Worker did not return a result');
  return result.value;
 }finally{handle.dispose();}
}
const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([400,500]);
page.drawText('BEFORE 4815',{font,x:40,y:400,size:18});
page.drawText('KEEP THIS TEXT',{font,x:40,y:100,size:14});
const bytes=await pdf.save(),snapshot=bytes.slice();
const objects=await run({action:'inspect',bytes,page:0});
const target=objects.find(object=>object.text==='BEFORE 4815');assert(target);
const edited=await run({action:'edit',bytes,page:0,changes:[{index:target.index,text:'AFTER 2026'}]});
const after=await run({action:'inspect',bytes:edited,page:0});
assert(after.some(object=>object.text==='AFTER 2026'));
assert(after.some(object=>object.text==='KEEP THIS TEXT'));
assert(!after.some(object=>object.text.includes('BEFORE')));
assert.equal((await PDFDocument.load(edited)).getPageCount(),1);
assert.deepEqual(bytes,snapshot);
assert(requested.has('/vendor/pdfium/pdfium.wasm'));
assert([...requested].some(url=>/harfbuzz.*\.wasm$/.test(url)));
console.log('PASS: generated blob bootstrap imports deployed modules, loads same-origin WASM, inspects/edits/reopens PDF and preserves original bytes (VM, not a browser test).');
