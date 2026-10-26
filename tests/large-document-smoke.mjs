import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts,PDFName,PDFString} from 'pdf-lib';
import {indexedDB} from 'fake-indexeddb';
import {setup} from './optimization-test-setup.mjs';
const {ctx,close}=await setup('large-document');globalThis.indexedDB=indexedDB;
const e=await import('../.cache/large-document/large-document.mjs'),s=await import('../.cache/large-document/large-document-store.mjs');
const {withPdfDocument}=await import('../.cache/large-document/pdf-engine.mjs');
try{
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),count=process.env.LARGE_TEST_PAGES?Number(process.env.LARGE_TEST_PAGES):101;
 for(let i=1;i<=count;i++){const p=doc.addPage([320,450]);p.drawText('FICTIONAL PAGE '+i,{x:20,y:380,size:14,font});if(i===count)p.node.set(PDFName.of('Annots'),doc.context.obj([doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[20,20,170,40],A:{S:'URI',URI:PDFString.of('https://example.test/final')}}))]));}
 const bytes=await doc.save(),file=new File([bytes],'fictional-large.pdf',{type:'application/pdf'}),job=await e.createLargeJob(file,'rotate90',ctx);
 assert.equal(job.pages,count);assert.equal((await s.listLargeJobs()).length,1);
 const controller=new AbortController();let checkpoints=0;
 await assert.rejects(()=>e.continueLargeJob(job.id,{...ctx,signal:controller.signal},()=>{checkpoints++;controller.abort();}),error=>{assert.equal(error.name,"AbortError",error.stack);return true;});
 assert.equal(checkpoints,1);const checkpoint=await s.loadLargeJob(job.id);assert.equal(checkpoint.chunks[0].last,Math.min(count,50));
 // Concurrent tabs are fenced and only committed sections survive cancellation.
 await s.withLargeLease(job.id,async()=>{await assert.rejects(()=>s.withLargeLease(job.id,async()=>{}),/anderen Tab/);});
 await assert.rejects(()=>s.saveLargeJob(checkpoint,'stale-token'),/abgelaufen/);
 const finished=await e.continueLargeJob(job.id,ctx,()=>{});assert.equal(finished.chunks.at(-1).last,count);
 assert.equal(finished.chunks[0].digest,checkpoint.chunks[0].digest,'resume reuses completed bytes');
 const output=await e.assembleLargeJob(job.id,ctx);assert.equal(output.exportAudit.checkedPages,count);
 await withPdfDocument(output.blob,ctx.signal,async(pdf)=>{assert.equal(pdf.numPages,count);for(const i of [1,Math.min(50,count),Math.min(51,count),count]){const p=await pdf.getPage(i);assert.equal(p.rotate,90);assert((await p.getTextContent()).items.some(t=>t.str?.includes('PAGE '+i)));}});
 const chunk=await e.exportLargeChunk(job.id,0,ctx);assert.equal(chunk.pages,Math.min(count,50));
 const wrong=await PDFDocument.create();wrong.addPage();await assert.rejects(async()=>e.replaceLargeChunk(job.id,0,new File([await wrong.save()],'wrong.pdf'),ctx),/Seitenzahl/);
 assert.throws(()=>e.validateLargeJob({...finished,chunks:[{...finished.chunks[0],first:2}]}));
 assert.throws(()=>e.checkLargeStructure({pages:[{}],qpdf:[{'/Outlines':'1 0 R'}]}),/Lesezeichen/);
 assert.throws(()=>e.checkLargeStructure({pages:[{}],encrypt:{encrypted:true},qpdf:[]}),/unverschlüsselte/);
 await writeFile(`.cache/large-document/fictional-${count}.pdf`,bytes);await writeFile(`.cache/large-document/rotated-${count}.pdf`,new Uint8Array(await output.blob.arrayBuffer()));

 // Quota rejection leaves the last checkpoint intact; corrupted output is never released.
 await s.withLargeLease(job.id,async token=>{
  await assert.rejects(()=>s.saveLargeJob({...finished,size:768*1024*1024},token),/Ablage.*voll/);
 });
 assert.equal((await s.loadLargeJob(job.id)).size,finished.size);
 await s.withLargeLease(job.id,token=>s.saveLargeJob(finished,token,new Blob(['corrupt']),0));
 await assert.rejects(()=>e.assembleLargeJob(job.id,ctx),/beschädigt/);
 await assert.rejects(()=>e.exportLargeChunk(job.id,0,ctx),/beschädigt/);
 await s.deleteLargeJob(job.id);assert.equal((await s.listLargeJobs()).length,0);assert.equal(await s.largeOriginal(job.id),undefined);assert.equal(await s.largeChunkBlob(job.id,0),undefined);
 console.log('PASS: '+count+' real PDF pages, file-range reading, QPDF WORKERFS extraction/assembly, full-page verification, durable checkpoints, cancellation/resume, tab leases, chunk export, incompatible replacement, corruption, unsupported structures and deletion.');
}finally{await close();}
