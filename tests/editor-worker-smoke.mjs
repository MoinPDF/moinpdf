import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';
import { mock } from 'node:test';
await mkdir('.cache/editor-worker',{recursive:true});
const engine=await readFile('lib/pdf-engine.ts','utf8');
const ast=ts.createSourceFile('engine.ts',engine,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const abortable=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='abortable').getText(ast);
await writeFile('.cache/editor-worker/helpers.mjs',ts.transpileModule(abortable,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
await writeFile('.cache/editor-worker/factory.mjs',`export const createLocalModuleWorker = url => globalThis.editorWorkerFactory(url);`);
const code=ts.transpileModule(await readFile('lib/editor-recognizer.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
 .replace(/import workerUrl from [^;]+;/,"const workerUrl = '/assets/editor-ocr-test.js';")
 .replace("'./module-worker'","'./factory.mjs'").replace("'./pdf-engine'","'./helpers.mjs'");
await writeFile('.cache/editor-worker/session.mjs',code);
const {openEditorRecognizer}=await import('../.cache/editor-worker/session.mjs');
const originalLocation=globalThis.location;
globalThis.location=new URL('https://moinpdf.test/editor');
let handles=[];
globalThis.editorWorkerFactory=url=>{
 assert.equal(url,'/assets/editor-ocr-test.js');
 const handle={disposed:0,messages:[],worker:{postMessage(data,transfer){handle.messages.push({data,transfer});}},dispose(){handle.disposed++;}};
 handles.push(handle);return handle;
};
const canvas={toBlob(callback){callback(new Blob(['pixels'],{type:'image/png'}));}};
async function sent(handle){for(let i=0;i<10&&!handle.messages.length;i++)await new Promise(r=>setImmediate(r));assert(handle.messages.length);return handle.messages.at(-1).data;}
try {
 const controller=new AbortController(),session=openEditorRecognizer(controller.signal),handle=handles.at(-1),progress=[];
 const first=session.recognize(canvas,'deu+eng',p=>progress.push(p));const m=await sent(handle);
 assert.equal(m.origin,'https://moinpdf.test');assert.equal(m.language,'deu+eng');assert(m.bytes instanceof ArrayBuffer);assert.equal(handle.messages[0].transfer[0],m.bytes);
 handle.worker.onmessage({data:{id:m.id+10,value:{text:'stale'}}});
 handle.worker.onmessage({data:{id:m.id,progress:{percent:40,label:'reading'}}});
 handle.worker.onmessage({data:{id:m.id,value:{text:'ready'}}});assert.equal((await first).text,'ready');assert(progress.some(p=>p.percent===40));
 const next=session.recognize(canvas,'deu+eng',()=>{});for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));assert.equal(handles.length,1,'A session reuses its worker');
 const reject=assert.rejects(next,{name:'AbortError'});controller.abort();await reject;assert.equal(handle.disposed,1);await session.dispose();assert.equal(handle.disposed,1,'Disposal is idempotent');
 // Error and timeout while the nested OCR engine is still initializing.
 const s2=openEditorRecognizer(new AbortController().signal),h2=handles.at(-1),p2=s2.recognize(canvas,'eng',()=>{});await sent(h2);
 const e2=assert.rejects(p2,/gestartet/);h2.worker.onerror();await e2;assert.equal(h2.disposed,1);
 const s3=openEditorRecognizer(new AbortController().signal),h3=handles.at(-1);
 mock.timers.enable({apis:['setTimeout']});
 const p3=s3.recognize(canvas,'eng',()=>{});await sent(h3);const e3=assert.rejects(p3,/dauert zu lange/);mock.timers.tick(90000);await e3;assert.equal(h3.disposed,1);mock.timers.reset();
 // Aborting before a page image is encoded must never post a job.
 const c4=new AbortController(),s4=openEditorRecognizer(c4.signal),h4=handles.at(-1);let finish;
 const p4=s4.recognize({toBlob(cb){finish=cb;}},'eng',()=>{});const e4=assert.rejects(p4,{name:'AbortError'});c4.abort();finish(new Blob(['late']));await e4;assert.equal(h4.messages.length,0);assert.equal(h4.disposed,1);
 console.log('PASS: OCR worker reuse, transferable images, progress, stale replies, abort during image encoding and initialization, timeout/error disposal and idempotent cleanup.');
} finally {mock.timers.reset();delete globalThis.editorWorkerFactory;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;}
