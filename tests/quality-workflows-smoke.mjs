// All documents below are generated fictional fixtures. Real PDF.js, PDFium,
// QPDF, Tesseract and DOCX output; only browser hosting is adapted for Node.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {Worker as NodeWorker} from 'node:worker_threads';
import ts from 'typescript';
import {PDFDocument,PDFName,PDFString,StandardFonts,rgb} from 'pdf-lib';
import JSZip from 'jszip';
import 'tesseract.js';
import 'fake-indexeddb/auto';
import {editorNativeAdapter} from './editor-native-adapter.mjs';
const require=createRequire(import.meta.url), pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,loadImage,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');
const canvas=()=>{
  const c=createCanvas(1,1);
  c.toBlob=(cb,type='image/png',quality=.9)=>cb(new Blob([type==='image/jpeg'?c.toBuffer('image/jpeg',Math.round(quality*100)):c.toBuffer('image/png')],{type}));
  return c;
};
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement:()=>canvas()},
  createImageBitmap:async blob=>{const image=await loadImage(Buffer.from(await blob.arrayBuffer()));image.close=()=>{};return image;},
  Worker:class{constructor(){this.w=new NodeWorker(new URL('./security-worker-node.cjs',import.meta.url));this.w.on('message',data=>this.onmessage?.({data}));this.w.on('error',e=>this.onerror?.(e));}postMessage(d,t){this.w.postMessage(d,t);}terminate(){void this.w.terminate();}}
});
const locks=new Set();
Object.defineProperty(navigator,'locks',{value:{request:async(name,options,callback)=>{if(locks.has(name))return callback(null);locks.add(name);try{return await callback({name});}finally{locks.delete(name);}}},configurable:true});
const folder='.cache/quality-workflows';await mkdir(folder,{recursive:true});
for(const file of await readdir('lib')){
  if(!file.endsWith('.ts'))continue;
  let code=ts.transpileModule(await readFile('lib/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
    .replace(/(['"])\.\/([a-z0-9-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`)
    .replaceAll("'/vendor/pdf/standard_fonts/'","'public/vendor/pdf/standard_fonts/'")
    .replaceAll("'/vendor/pdf/pdf.worker.min.mjs'",JSON.stringify(resolve('public/vendor/pdf/pdf.worker.min.mjs')));
  await writeFile(`${folder}/${file.replace(/\.ts$/,'.mjs')}`,code);
}
await writeFile(folder+'/native-pdf.mjs',editorNativeAdapter);
await writeFile(folder+'/editor-recognizer.mjs',`
import {createWorker,PSM} from 'tesseract.js';import {resolve} from 'node:path';
export function openEditorRecognizer(signal,layout){let worker,language;return {async recognize(canvas,lang,report){signal.throwIfAborted();if(!worker||language!==lang){await worker?.terminate();worker=await createWorker(lang,1,{langPath:resolve('public/vendor/languages'),cacheMethod:'none'});language=lang;await worker.setParameters({tessedit_pageseg_mode:layout||PSM.AUTO});}return (await worker.recognize(canvas.toBuffer('image/png'),{},{text:true,blocks:true})).data;},async dispose(){await worker?.terminate();}};}`);
const fetchOriginal=globalThis.fetch;globalThis.fetch=async url=>typeof url==='string'&&url.startsWith('/vendor/')?new Response(await readFile('public'+url)):fetchOriginal(url);
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'), assets=dirname(require.resolve('pdfjs-dist/package.json'));
const proxies=[];
async function source(bytes,name='fictional.pdf'){
  const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),standardFontDataUrl:assets+'/standard_fonts/',fontExtraProperties:true}).promise;proxies.push(pdf);
  return {id:name,name,bytes:new Uint8Array(bytes),size:bytes.length,kind:'pdf',pdf};
}
const signal=new AbortController().signal, options={language:'eng',ocrLayout:'3',forceOcr:false,autoLanguage:false,quality:'small',compressionMode:'preserve',imageFormat:'png',watermark:'TEST',numberStart:1};
const {sourcePages,renderPage,runJob}=await import('../.cache/quality-workflows/pdf-engine.mjs');
const {compressPreservingPdf}=await import('../.cache/quality-workflows/pdf-compression.mjs');
const {runDocumentOcr,writeOcrCorrections}=await import('../.cache/quality-workflows/ocr-document.mjs');
const {readTextTargets}=await import('../.cache/quality-workflows/editor-model.mjs');
const {ocrEditorTargets,analyzeEditorPage,cachedEditorPage}=await import('../.cache/quality-workflows/editor-analysis.mjs');
const {preprocessEditorScan}=await import('../.cache/quality-workflows/editor-scan.mjs');
const {readEditorTables,changeEditorTable}=await import('../.cache/quality-workflows/editor-table-workspace.mjs');
const {createStructuredWordFile,packStructuredWord}=await import('../.cache/quality-workflows/word-structure.mjs');
const {batchIdentity,resumeBatch,loadBatch,batchBytes,batchZip,clearBatch}=await import('../.cache/quality-workflows/batch-queue.mjs');
const text=async s=>(await (await s.pdf.getPage(1)).getTextContent()).items.map(t=>t.str||'').join(' ');
try {
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),p=doc.addPage([600,800]);
  p.drawText('FICTIONAL REPORT 4815',{x:35,y:750,font,size:15});
  const picture=canvas();picture.width=2400;picture.height=1600;const pc=picture.getContext('2d'), pixels=pc.createImageData(2400,1600);
  for(let i=0;i<pixels.data.length;i+=4){const n=(i/4*16807)%251;pixels.data[i]=n;pixels.data[i+1]=(n*5)%255;pixels.data[i+2]=130;pixels.data[i+3]=255;}
  pc.putImageData(pixels,0,0);p.drawImage(await doc.embedJpg(picture.toBuffer('image/jpeg',96)),{x:35,y:250,width:500,height:330});
  p.drawRectangle({x:35,y:210,width:100,height:20,color:rgb(.1,.8,.3)});
  const field=doc.getForm().createTextField('Reference');field.setText('Keep editable');field.addToPage(p,{x:35,y:120,width:180,height:25});
  const link=doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[35,700,180,725],A:{Type:'Action',S:'URI',URI:PDFString.of('https://example.com/fictional')}}));p.node.addAnnot(link);
  doc.setTitle('Fictional compression fixture');await doc.attach(new Uint8Array([65,66,67]),'fixture.txt');
  const original=await source(await doc.save()),before=original.bytes.slice();
  const compressed=await compressPreservingPdf([original],sourcePages(original),options,()=>{},signal);
  assert(compressed.blob.size<original.size*.85,'The photo fixture actually shrinks');assert.deepEqual(original.bytes,before);
  const result=await source(new Uint8Array(await compressed.blob.arrayBuffer()),'compressed.pdf');assert.match(await text(result),/FICTIONAL REPORT 4815/);
  const editable=await PDFDocument.load(result.bytes);assert.equal(editable.getForm().getTextField('Reference').getText(),'Keep editable');
  assert.equal(editable.getTitle(),'Fictional compression fixture');assert.equal((await result.pdf.getAttachmentContent('fixture.txt')).length,3);
  assert((await (await result.pdf.getPage(1)).getAnnotations()).some(a=>a.url==='https://example.com/fictional'));
  const native=await import('../.cache/quality-workflows/native-pdf.mjs');assert((await native.inspectObjectTree(result.bytes,0)).some(o=>o.type==='path'));
  const lossless=await compressPreservingPdf([original],sourcePages(original),{...options,compressionMode:'lossless'},()=>{},signal);
  const loss=await source(new Uint8Array(await lossless.blob.arrayBuffer()),'lossless.pdf');
  const a=await renderPage(original,sourcePages(original)[0],800,signal),b=await renderPage(loss,sourcePages(loss)[0],800,signal);
  assert.deepEqual(a.canvas.getContext('2d').getImageData(0,0,a.canvas.width,a.canvas.height).data,b.canvas.getContext('2d').getImageData(0,0,b.canvas.width,b.canvas.height).data,'Lossless optimization preserves rendered pixels');a.canvas.width=b.canvas.width=0;
  await assert.rejects(()=>compressPreservingPdf([original],[{...sourcePages(original)[0],rotation:90}],options,()=>{},signal),/vollständige/);
  await assert.rejects(()=>compressPreservingPdf([original],sourcePages(original),options,()=>{},AbortSignal.abort()),/abort/i);
  await writeFile(folder+'/compressed.pdf',result.bytes);
  console.log('PASS: real compression reduces image bytes and preserves text, vectors, links, form fields, attachment and metadata; lossless pixels match.');

  const scan=canvas();scan.width=1600;scan.height=650;const sc=scan.getContext('2d');sc.fillStyle='#efebe2';sc.fillRect(0,0,1600,650);sc.fillStyle='#111';sc.font='52px DejaVu Sans';
  sc.fillText('Fictional invoice 4815',65,150);sc.fillText('Total amount 125.50 EUR',65,260);sc.fillText('Please keep this document',65,370);
  const mixed=await PDFDocument.create(),mp=mixed.addPage([600,800]);mp.drawText('DIGITAL HEADER',{x:40,y:750,size:18});mp.drawImage(await mixed.embedPng(scan.toBuffer('image/png')),{x:30,y:350,width:540,height:220});
  const mix=await source(await mixed.save(),'mixed.pdf');
  const ocr=await runDocumentOcr([mix],sourcePages(mix),options,()=>{},signal);assert.match(ocr.text,/4815/);assert.match(ocr.text,/DIGITAL HEADER/);
  assert.equal(cachedEditorPage(mix,sourcePages(mix)[0],'eng'),undefined,'OCR output does not populate the editor cache');
  const data=structuredClone(ocr.ocrData),line=data[0].lines.find(l=>l.editable&&l.text.includes('4815'));assert(line);line.text=line.text.replace('4815','8426');
  assert(data[0].lines.some(l=>!l.editable&&l.text.includes('DIGITAL')));
  const corrected=await source(new Uint8Array(await (await writeOcrCorrections(ocr.ocrBase,data,signal)).arrayBuffer()),'corrected.pdf');
  assert.match(await text(corrected),/8426/);assert.doesNotMatch(await text(corrected),/4815/);
  const renderOriginal=await renderPage(mix,sourcePages(mix)[0],800,signal),renderCorrected=await renderPage(corrected,sourcePages(corrected)[0],800,signal);
  assert.deepEqual(renderOriginal.canvas.getContext('2d').getImageData(0,0,renderOriginal.canvas.width,renderOriginal.canvas.height).data,renderCorrected.canvas.getContext('2d').getImageData(0,0,renderCorrected.canvas.width,renderCorrected.canvas.height).data,'Corrected search text never paints over the scan');
  const second=await runDocumentOcr([corrected],sourcePages(corrected),options,()=>{},signal);
  const roundtrip=await source(new Uint8Array(await second.blob.arrayBuffer()),'ocr-roundtrip.pdf');assert.equal((await text(roundtrip)).match(/8426/g)?.length,1,'Existing hidden layers are replaced without duplicate search text');
  await writeFile(folder+'/ocr-corrected.pdf',corrected.bytes);
  // Exact skew geometry remains meaningful even if OCR confidence varies by engine/platform.
  const prepared=preprocessEditorScan(scan,-2),sample={blocks:[{paragraphs:[{lines:[{baseline:{x0:100,y0:100,x1:500,y1:100},words:[{text:'Fictional',confidence:99,bbox:{x0:100,y0:70,x1:300,y1:100}}]}]}]}]};
  const target=ocrEditorTargets(sample,scan,600,650*600/1600,0,prepared)[0];assert(Math.abs(target.rotation-2)<.01);assert(target.textAspect>1);prepared.canvas.width=0;
  console.log('PASS: real mixed-page OCR; corrected PDF search layer, preserved native header, unchanged visible pixels, repeat OCR without duplicate text and retained skew geometry.');

  const wordDoc=await PDFDocument.create(),regular=await wordDoc.embedFont(StandardFonts.Helvetica),bold=await wordDoc.embedFont(StandardFonts.HelveticaBold),wp=wordDoc.addPage([600,800]);
  wp.drawText('Fictional report',{x:40,y:720,font:bold,size:20});wp.drawText('Editable body paragraph.',{x:40,y:670,font:regular,size:12});
  for(const y of [600,550])wp.drawLine({start:{x:40,y},end:{x:440,y},thickness:1});for(const x of [40,240,440])wp.drawLine({start:{x,y:550},end:{x,y:600},thickness:1});
  wp.drawText('Item A',{x:55,y:570,font:bold,size:12});wp.drawText('125.50 EUR',{x:255,y:570,font:regular,size:12});
  const logo=canvas();logo.width=100;logo.height=50;logo.getContext('2d').fillStyle='#1269a2';logo.getContext('2d').fillRect(0,0,100,50);wp.drawImage(await wordDoc.embedPng(logo.toBuffer('image/png')),{x:40,y:400,width:100,height:50});
  const wordSource=await source(await wordDoc.save(),'structured-word.pdf'),wordPage=sourcePages(wordSource)[0];
  const tables=await readEditorTables(wordSource,wordPage,[],signal);assert.equal(tables.length,1,'Single-row tables are recognized');assert.equal(tables[0].cells.length,2);
  const changedTable=await changeEditorTable(wordSource,wordPage,[],tables[0],{kind:'insert',row:1,height:40},signal);assert(changedTable.add.some(m=>m.nativeTable?.rows.length===3));
  const word=await createStructuredWordFile(wordSource,signal),zip=await JSZip.loadAsync(await word.blob.arrayBuffer()),xml=await zip.file('word/document.xml').async('string');
  assert.match(xml,/<w:tbl>/);assert.match(xml,/Item A/);assert.match(xml,/125.50 EUR/);assert.match(xml,/<w:b/);assert.match(xml,/<w:drawing>/);assert(!xml.includes('<w:txbxContent>'),'New mode uses flowing paragraphs and real tables');
  const nativeText=(await readTextTargets(wordSource,wordPage)).targets;
  const furniture={...nativeText[0],id:'footer',text:'Seite 1',y:.95,h:.02,fontSize:10};
  const pages=[0,1,2].map(i=>({width:600,height:800,text:[...nativeText,{...furniture,text:`Seite ${i+1}`},{...furniture,id:'header',text:'FICTIONAL COMPANY',y:.03}],tables,images:[]}));
  const packed=await JSZip.loadAsync(await (await packStructuredWord(pages,signal)).arrayBuffer());assert.match(await packed.file('word/header1.xml').async('string'),/FICTIONAL COMPANY/);assert.match(await packed.file('word/footer1.xml').async('string'),/PAGE/);
  assert.doesNotMatch(await packed.file('word/document.xml').async('string'),/FICTIONAL COMPANY/);
  await writeFile(folder+'/structured.docx',new Uint8Array(await word.blob.arrayBuffer()));
  console.log('PASS: actual Word export contains flowing text, mixed font weights, native table cells and images, with separate repeating header/footer and a page-number field.');

  const workflow={version:1,name:'Fictional batch',steps:[{kind:'rotate90'},{kind:'protect',condition:{field:'filename',operator:'contains',value:'protected'}}]};
  const unprotected=await source(wordSource.bytes,'plain.pdf'),protectedSource=await source(wordSource.bytes,'protected.pdf'),inputs=[unprotected,protectedSource];
  const initial=await batchIdentity(inputs,workflow,signal);let pause=false;
  let state=await resumeBatch(initial,inputs,'short',{signal,report:()=>{}},{pause:()=>pause,update:q=>{if(q.files[0].step===1)pause=true;}});
  assert.equal(state.files[0].step,1);assert.equal(state.files[0].status,'pending');assert.equal((await loadBatch(initial.id)).files[0].step,1);
  state=await resumeBatch(state,inputs,'short',{signal,report:()=>{}},{pause:()=>false,update:()=>{}});
  assert.equal(state.files[0].status,'done');assert.equal(state.files[1].status,'failed');assert.equal(state.files[1].step,1);
  const first=new Uint8Array(await (await batchBytes(state.id,0)).arrayBuffer());assert.equal((await PDFDocument.load(first)).getPage(0).getRotation().angle,90,'Resume does not reapply a completed rotation');
  const partial=await JSZip.loadAsync(await (await batchZip(state,signal)).blob.arrayBuffer());assert(partial.file('plain-bearbeitet.pdf'));assert(!partial.file('protected-bearbeitet.pdf'));
  state=await resumeBatch(state,inputs,'Fictional-Password-2026!',{signal,report:()=>{}},{pause:()=>false,retry:true,update:()=>{}});assert(state.files.every(f=>f.status==='done'));
  assert.deepEqual(new Uint8Array(await (await batchBytes(state.id,0)).arrayBuffer()),first,'Retry leaves completed outputs unchanged');
  locks.add('moinpdf-batch:'+state.id);await assert.rejects(()=>resumeBatch(state,inputs,'',{signal,report:()=>{}},{pause:()=>false,update:()=>{}}),/anderen Tab/);locks.clear();
  const {workflowToGraph}=await import('../.cache/quality-workflows/workflow-graph.mjs');
  const graph=workflowToGraph({version:1,name:'Graph fixture',steps:[{kind:'rotate180',condition:{field:'filename',operator:'contains',value:'plain'}},{kind:'reverse'}]});
  const graphQueue=await batchIdentity([unprotected],graph,signal);const graphResult=await resumeBatch(graphQueue,[unprotected],'',{signal,report:()=>{}},{pause:()=>false,update:()=>{}});assert.equal(graphResult.files[0].status,'done');assert(graphResult.files[0].log.some(l=>l.includes('Ja')));
  assert.equal((await PDFDocument.load(await (await batchBytes(graphResult.id,0)).arrayBuffer())).getPage(0).getRotation().angle,180);
  await clearBatch(state);assert.equal(await loadBatch(state.id),undefined);await clearBatch(graphResult);
  // Local HTTP has no Web Locks API. Exercise the real IndexedDB lease, including
  // a suspended tab finishing after a second owner has taken over its expiry.
  Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const reading = new Promise(resolve => { entered = resolve; });
  const suspended = {...unprotected, pdf: {numPages:unprotected.pdf.numPages, getPage:async (...args) => { entered(); await gate; return unprotected.pdf.getPage(...args); }}};
  const leaseWorkflow = {version:1,name:'HTTP lease fixture',steps:[{kind:'rotate90',condition:{field:'text',operator:'contains',value:'Fictional'}}]};
  const leaseQueue = await batchIdentity([suspended],leaseWorkflow,signal);
  const running = resumeBatch(leaseQueue,[suspended],'',{signal,report:()=>{}},{pause:()=>false,update:()=>{}});
  await reading;
  await assert.rejects(()=>resumeBatch(leaseQueue,[unprotected],'',{signal,report:()=>{}},{pause:()=>false,update:()=>{}}),/anderen Tab/);
  await assert.rejects(()=>clearBatch(leaseQueue),/anderen Tab/);
  const database = await new Promise((resolve,reject)=>{const request=indexedDB.open('moinpdf.batch.v1',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise((resolve,reject)=>{const tx=database.transaction('leases','readwrite'),store=tx.objectStore('leases'),request=store.get(leaseQueue.id);request.onsuccess=()=>store.put({...request.result,expires:Date.now()-1},leaseQueue.id);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error);});
  database.close();
  const takeover = await resumeBatch(leaseQueue,[unprotected],'',{signal,report:()=>{}},{pause:()=>false,update:()=>{}});
  assert.equal(takeover.files[0].status,'done');
  const takeoverBytes = new Uint8Array(await (await batchBytes(leaseQueue.id,0)).arrayBuffer());
  const stopped = assert.rejects(()=>running,/abgelaufen/);release();await stopped;
  assert.deepEqual(new Uint8Array(await (await batchBytes(leaseQueue.id,0)).arrayBuffer()),takeoverBytes,'An expired tab cannot overwrite a newer checkpoint');
  assert.equal((await PDFDocument.load(takeoverBytes)).getPage(0).getRotation().angle,90);
  await clearBatch(takeover);
  console.log('PASS: IndexedDB atomic checkpoints, pause/resume, partial ZIP, failed-file retry, unchanged completed files, graph decisions, cross-tab exclusion and deletion.');
  console.log('PASS: local HTTP without Web Locks, atomic lease exclusion, expired-tab takeover and fencing of stale writes.');
} finally {for(const pdf of proxies)await pdf.loadingTask.destroy();globalThis.fetch=fetchOriginal;}
