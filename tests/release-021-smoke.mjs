import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pbkdf2Sync, createDecipheriv } from 'node:crypto';
import ts from 'typescript';
import { PDFDocument, StandardFonts } from 'pdf-lib';
await mkdir('.cache', {recursive:true});
for (const name of ['project-encryption','storage-health','resource-budget','pdf-text','export-audit']) {
  let code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  code=code.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}-021-test.mjs${q}`)
    .replaceAll("'/vendor/pdf/pdf.worker.min.mjs'", "new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',import.meta.url).href");
  await writeFile(`.cache/${name}-021-test.mjs`,code);
}
const crypto=await import('../.cache/project-encryption-021-test.mjs');
const plain=new Blob([new Uint8Array(4*1024*1024+37).fill(93)]), password='Ein-langes-Passwort-äöü';
const encrypted=await crypto.encryptProject(plain,password);
assert(await crypto.isEncryptedProject(encrypted));assert(!await crypto.isEncryptedProject(plain));
assert.deepEqual(Buffer.from(await(await crypto.decryptProject(encrypted,password)).arrayBuffer()),Buffer.from(await plain.arrayBuffer()));
const bytes=Buffer.from(await encrypted.arrayBuffer()),header=bytes.subarray(0,64);
const key=pbkdf2Sync(password,header.subarray(32,48),600000,32,'sha256');
const iv=Buffer.alloc(12);header.copy(iv,0,48,56);
const aad=Buffer.concat([header,Buffer.alloc(4)]),cipher=bytes.subarray(64,64+4*1024*1024+16);
const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(aad);decipher.setAuthTag(cipher.subarray(-16));
assert.equal(Buffer.concat([decipher.update(cipher.subarray(0,-16)),decipher.final()]).length,4*1024*1024,'Independent Node AES-GCM decrypts the first authenticated chunk');
await assert.rejects(()=>crypto.decryptProject(encrypted,'falsches Passwort'),/Passwort/);
for(const index of [18,24,32,48,60,64,bytes.length-1]) { const changed=Buffer.from(bytes);changed[index]^=1;await assert.rejects(()=>crypto.decryptProject(new Blob([changed]),password),/beschädigt/); }
await assert.rejects(()=>crypto.decryptProject(encrypted.slice(0,-1),password),/beschädigt/);
await assert.rejects(()=>crypto.decryptProject(new Blob([encrypted,'extra']),password),/beschädigt/);
await assert.rejects(()=>crypto.encryptProject(plain,'short'),/12/);
await assert.rejects(()=>crypto.encryptProject(plain,password,AbortSignal.abort()),/abort/i);
const second=await crypto.encryptProject(new Blob(['abc']),password);
const third=await crypto.encryptProject(new Blob(['abc']),password);
assert.notDeepEqual(Buffer.from(await second.arrayBuffer()),Buffer.from(await third.arrayBuffer()),'Every archive uses fresh salt and IV');
const {storageHealth}=await import('../.cache/storage-health-021-test.mjs');
assert.equal((await storageHealth({estimate:async()=>({usage:90e6,quota:100e6}),persisted:async()=>false,persist:async()=>false})).pressure,true);
assert.equal((await storageHealth({estimate:async()=>{throw Error('denied')},persisted:async()=>{throw Error('denied')}})).usage,undefined);
const {createResourcePool,deviceBudget}=await import('../.cache/resource-budget-021-test.mjs');
assert.equal(deviceBudget({deviceMemory:2,hardwareConcurrency:8}).ocrWorkers,1);assert.equal(deviceBudget({deviceMemory:8,hardwareConcurrency:8}).ocrWorkers,2);
const pool=createResourcePool(1),release=await pool(new AbortController().signal),abort=new AbortController();
const wait=pool(abort.signal);abort.abort();await assert.rejects(()=>wait);
let entered=false;const next=pool(new AbortController().signal).then(r=>{entered=true;return r});await Promise.resolve();assert(!entered);release();release();const releaseNext=await next;assert(entered);releaseNext();
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',import.meta.url).href;
async function pdf(text,form=false) {const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const p=doc.addPage([300,400]);p.drawText(text,{font,size:12,x:20,y:300});if(form)doc.getForm().createTextField('Name').addToPage(p,{x:20,y:100,width:100,height:20});return doc.save();}
const original=await pdf('Original amount 123',true),task=pdfjs.getDocument({data:original.slice()});const source={id:'source',pdf:await task.promise};
const {auditPdfExport}=await import('../.cache/export-audit-021-test.mjs');
const mapping=[{sourceId:'source',index:0,rotation:0}],signal=new AbortController().signal;
try {
 const good=await auditPdfExport(new Blob([original]),1,[source],mapping,'compress',signal);assert.equal(good.status,'checked');
 const changed=await auditPdfExport(new Blob([await pdf('Changed 456')]),1,[source],mapping,'compress',signal);
 assert(changed.issues.some(i=>i.code==='text'));assert(changed.issues.some(i=>i.code==='forms'));assert.equal(changed.status,'review');
 const count=await auditPdfExport(new Blob([original]),2,[],undefined,undefined,signal);assert(count.issues.some(i=>i.code==='pages'));
 const invalid=await auditPdfExport(new Blob(['not a PDF']),1,[],undefined,undefined,signal);assert.equal(invalid.status,'invalid');
 await assert.rejects(()=>auditPdfExport(new Blob([original]),1,[],undefined,undefined,AbortSignal.abort()),/abort/i);
} finally {await task.destroy();}
console.log('PASS: authenticated project chunks and independent crypto roundtrip; wrong-password, tamper, truncation and cancellation rejection; storage pressure; bounded cancellable OCR leases; actual PDF export loss and corruption detection.');
