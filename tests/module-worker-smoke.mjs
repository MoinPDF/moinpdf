import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveObjectURL } from 'node:buffer';
import vm from 'node:vm';
import ts from 'typescript';

const code=ts.transpileModule(await readFile('lib/module-worker.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {createLocalModuleWorker}=await import('data:text/javascript,'+encodeURIComponent(code));
const original={Worker:globalThis.Worker,location:globalThis.location,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
class CaptureWorker {
 constructor(url,options){this.url=url;this.options=options;this.terminated=0;}
 terminate(){this.terminated++;}
}
try {
 globalThis.Worker=CaptureWorker;
 for(const origin of ['https://moinpdf.test','http://umbrel.local:8390']) {
  globalThis.location=new URL(origin+'/editor');
  const handle=createLocalModuleWorker('/_next/static/native-pdf-test.js');
  assert(handle.worker.url.startsWith('blob:'));
  assert.equal(handle.worker.options.type,'module');
  const blob=resolveObjectURL(handle.worker.url);
  assert.equal(blob.type,'text/javascript');
  const bootstrap=await blob.text();
  const ast=ts.createSourceFile('bootstrap.mjs',bootstrap,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const imports=ast.statements.filter(ts.isImportDeclaration);
  assert.equal(imports.length,1);
  assert.equal(imports[0].moduleSpecifier.text,origin+'/_next/static/native-pdf-test.js');
  // Exercise emitted fetch rebasing with real Request objects and URL parsing.
  const calls=[];
  const scope={fetch:async(...args)=>{calls.push(args);return 'loaded';}};
  vm.runInNewContext(bootstrap.slice(imports[0].end),{self:scope,URL});
  assert.equal(await scope.fetch('/vendor/pdfium/pdfium.wasm'),'loaded');
  assert.equal(calls.pop()[0].href,origin+'/vendor/pdfium/pdfium.wasm');
  await scope.fetch('./font.wasm',{credentials:'same-origin'});
  const [relative,options]=calls.pop();
  assert.equal(relative.href,origin+'/_next/static/font.wasm');
  assert.equal(options.credentials,'same-origin');
  const request=new Request(origin+'/asset');
  await scope.fetch(request);assert.equal(calls.pop()[0],request);
  await scope.fetch(new URL(origin+'/asset-2'));assert.equal(calls.pop()[0].href,origin+'/asset-2');
  handle.dispose();handle.dispose();
  assert.equal(handle.worker.terminated,1);
  assert.equal(resolveObjectURL(handle.worker.url),undefined);
 }
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{controller:{scriptURL:location.origin+'/sw.js'}}}});
 const direct=createLocalModuleWorker('/assets/editor-ocr.js');
 assert.equal(direct.worker.url,location.origin+'/assets/editor-ocr.js');
 direct.dispose();direct.dispose();assert.equal(direct.worker.terminated,1);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{controller:{scriptURL:location.origin+'/other-worker.js'}}}});
 const fallback=createLocalModuleWorker('/assets/editor-ocr.js');assert(fallback.worker.url.startsWith('blob:'));fallback.dispose();
 for(const url of ['file:///tmp/worker.js','https://external.test/worker.js','javascript:alert(1)','data:text/javascript,','blob:https://moinpdf.test/123'])
  assert.throws(()=>createLocalModuleWorker(url),/Ungültige Adresse/);
 let failedUrl;
 globalThis.Worker=class {constructor(url){failedUrl=url;throw Error('blocked by CSP');}};
 assert.throws(()=>createLocalModuleWorker('/worker.js'),/blocked by CSP/);
 assert.equal(resolveObjectURL(failedUrl),undefined);
 console.log('PASS: same-origin module bootstrap, HTTP selfhosting, root/relative fetches, Request preservation, idempotent disposal and constructor-failure cleanup.');
}finally {
 if(original.Worker===undefined)delete globalThis.Worker;else globalThis.Worker=original.Worker;
 if(original.location===undefined)delete globalThis.location;else globalThis.location=original.location;
 if(original.navigator)Object.defineProperty(globalThis,'navigator',original.navigator);else delete globalThis.navigator;
}
