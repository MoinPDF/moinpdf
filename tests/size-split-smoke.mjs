import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
import JSZip from 'jszip';
import {PDFDocument,PDFName,StandardFonts} from 'pdf-lib';
await mkdir('.sites-runtime',{recursive:true});
let code=ts.transpileModule(await readFile('lib/size-split.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
code=code.replace(/import .* from '.\/advanced-types';/,"const checkAbort=signal=>{if(signal?.aborted)throw new Error('Abgebrochen');};").replace(/import .* from '.\/pdf-engine';/,"const filenameStem=name=>name.replace(/\\.pdf$/i,'');");
await writeFile('.sites-runtime/size-split-test.mjs',code);
const {splitBySize,sizeSplitZip}=await import('../.sites-runtime/size-split-test.mjs');
const input=await PDFDocument.create(),font=await input.embedFont(StandardFonts.Helvetica);
for(let i=0;i<7;i++){const page=input.addPage();page.drawText('Seite '+(i+1),{font});const payload=new Uint8Array(19000+i*1100);crypto.getRandomValues(payload);page.node.set(PDFName.of('TestPageId'),input.context.obj(i+1));page.node.set(PDFName.of('TestPayload'),input.context.register(input.context.stream(payload)));}
const bytes=await input.save(),ctx={signal:new AbortController().signal,report:()=>{}},limit=50000,parts=await splitBySize(bytes,limit,ctx);
assert(parts.length>1);const order=[];
for(const part of parts){assert(part.bytes.length<=limit);const pdf=await PDFDocument.load(part.bytes);assert.equal(pdf.getPageCount(),part.last-part.first+1);for(const page of pdf.getPages())order.push(page.node.get(PDFName.of('TestPageId')).asNumber());}
assert.deepEqual(order,[1,2,3,4,5,6,7]);
const zip=await JSZip.loadAsync(await(await sizeSplitZip({name:'Dokument.pdf'},parts,ctx)).blob.arrayBuffer());assert.equal(Object.keys(zip.files).length,parts.length);
await assert.rejects(()=>splitBySize(bytes,2000,ctx),/Seite 1.*einzeln/);
await assert.rejects(()=>splitBySize(bytes,limit,{...ctx,signal:AbortSignal.abort()}),/Abgebrochen/);
assert.equal((await splitBySize(bytes,bytes.length*2,ctx)).length,1);
console.log('PASS: actual PDF byte limits, page order/completeness, oversize single-page rejection, cancellation and ZIP contents.');
