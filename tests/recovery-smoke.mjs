import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {Worker as NodeWorker} from 'node:worker_threads';
import {dirname} from 'node:path';
import ts from 'typescript';
import JSZip from 'jszip';
import {PDFDocument,StandardFonts,PDFName} from 'pdf-lib';
import {DOMParser} from '@xmldom/xmldom';

const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pdfRequire('@napi-rs/canvas');
Object.defineProperty(Object.getPrototypeOf(createCanvas(1,1)).constructor,'name',{value:'HTMLCanvasElement'});
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement(name){assert.equal(name,'canvas');return createCanvas(1,1);}}});
globalThis.Worker=class{constructor(){this.worker=new NodeWorker(new URL('./security-worker-node.cjs',import.meta.url));this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));}postMessage(data,transfer){this.worker.postMessage(data,transfer);}terminate(){void this.worker.terminate();}};
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('.cache',{recursive:true});
for(const name of ['ocr-languages','reading-export','pdf-recovery','pdf-security','image-codecs','pdf-engine','scan-split']){
 let code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}-recovery-test.mjs${q}`);
 if(name==='pdf-engine')code=code.replace("'/vendor/pdf/pdf.worker.min.mjs'",JSON.stringify(assets+'/legacy/build/pdf.worker.mjs')).replace("'/vendor/pdf/standard_fonts/'",JSON.stringify(assets+'/standard_fonts/'));
 await writeFile(`.cache/${name}-recovery-test.mjs`,code);
}
const {exportReading}=await import('../.cache/reading-export-recovery-test.mjs');
const {repairFile,optimizeBrowser}=await import('../.cache/pdf-recovery-recovery-test.mjs');
const {detectScanRegions,exportScanRegions}=await import('../.cache/scan-split-recovery-test.mjs');
const {optimizePdf}=await import('../.cache/pdf-security-recovery-test.mjs');
const ctx={signal:new AbortController().signal,report:()=>{}},opened=[];
async function source(bytes,name='Grüße.pdf'){const data=new Uint8Array(bytes),pdf=await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;opened.push(pdf);return{id:crypto.randomUUID(),name,bytes:data,size:data.length,pdf,kind:'pdf'};}
try{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 const page=pdf.addPage([595,842]);page.drawText('Moin & Grüße',{font,size:24,x:40,y:770});page.drawText('<script>alert(1)</script> [nicht ausführen]',{font,size:12,x:40,y:720});page.drawText('Ein längerer Absatz mit lesbarem Text für das E-Book.',{font,size:12,x:40,y:685});pdf.addPage();
 const field=pdf.getForm().createTextField('Name');field.setText('Erhalten');field.addToPage(page,{x:40,y:630,width:200,height:20,font});
 const input=await source(await pdf.save({useObjectStreams:false})),original=input.bytes.slice();
 let epub;
 for(const format of ['markdown','html','epub']){
  const result=await exportReading(input,format,'Moin <script> & Grüße','de',ctx);assert.match(result.note,/1 Seite\(n\)/);
  if(format==='markdown'){const text=await result.blob.text();assert.match(text,/Seite 2/);assert.match(text,/kein Text gefunden/);assert(!text.includes('<script>'));}
  if(format==='html'){const text=await result.blob.text();assert.match(text,/&lt;script&gt;/);assert(!text.includes('<script>'));assert.match(text,/href="#seite-2"/);}
  if(format==='epub'){
   epub=new Uint8Array(await result.blob.arrayBuffer());const zip=await JSZip.loadAsync(epub);assert.equal(await zip.file('mimetype').async('string'),'application/epub+zip');assert.equal(Buffer.from(epub).readUInt16LE(8),0,'First ZIP entry is stored');assert.equal(Buffer.from(epub).subarray(30,38).toString(),'mimetype');
   for(const [name,entry] of Object.entries(zip.files))if(/\.(xhtml|opf|xml)$/.test(name)){const xml=await entry.async('string');assert(!xml.includes('<script>'));new DOMParser({onError:()=>{throw Error(name+' is invalid XML');}}).parseFromString(xml,'application/xml');}
   assert.equal((await zip.file('EPUB/package.opf').async('string')).match(/<itemref /g).length,2);
  }
 }
 await writeFile('.cache/reading-roundtrip.epub',epub);
 await assert.rejects(()=>exportReading({...input,pdf:{numPages:1,getPage:async()=>({getTextContent:async()=>({items:[]})})}},'epub','','de',ctx),/OCR/);
 const uuidDescriptor=Object.getOwnPropertyDescriptor(crypto,'randomUUID');
 Object.defineProperty(crypto,'randomUUID',{configurable:true,value:undefined});
 try {
  const localEpub=await exportReading(input,'epub','Lokaler HTTP-Zugriff','de',ctx);
  const archive=await JSZip.loadAsync(await localEpub.blob.arrayBuffer());
  assert.match(await archive.file('EPUB/package.opf').async('string'),/urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/);
 }finally{if(uuidDescriptor)Object.defineProperty(crypto,'randomUUID',uuidDescriptor);else delete crypto.randomUUID;}
 await assert.rejects(()=>exportReading(input,'html','','de',{...ctx,signal:AbortSignal.abort()}),{name:'AbortError'});
 // A wrong startxref is recoverable. Missing content is never manufactured.
 const damaged=Buffer.from(input.bytes).toString('latin1').replace(/startxref\s+\d+/, 'startxref\n1');
 const restored=await repairFile(new File([Buffer.from(damaged,'latin1')],'defekt.pdf'),ctx).catch(error=>{throw new Error('Repair failed',{cause:error});});
 assert.equal((await PDFDocument.load(await restored.blob.arrayBuffer())).getPageCount(),2);assert.match(restored.note,/Vollständigkeit/);
 await assert.rejects(()=>repairFile(new File(['not pdf'],'bad.pdf'),ctx),/Dateikopf/);
 await assert.rejects(()=>repairFile(new File(['%PDF-1.7\nmissing'],'bad.pdf'),ctx),/nicht wiederhergestellt/);
 for(const quality of [undefined,75]){const optimized=await optimizePdf(input.bytes,quality,ctx.signal).catch(error=>{throw new Error(`Optimize quality ${quality} failed`,{cause:error});});const parsed=await PDFDocument.load(optimized);assert.equal(parsed.getForm().getTextField('Name').getText(),'Erhalten');assert.equal(parsed.getPageCount(),2);}
 const noNeed=await optimizeBrowser(input,2,true,ctx);assert.deepEqual(new Uint8Array(await noNeed.blob.arrayBuffer()),original);assert.match(noNeed.note,/Zielgröße erreicht/);
 // An incompressible attachment cannot fit into 0.05 MB; report honestly.
 const random=new Uint8Array(100000);for(let i=0;i<random.length;i+=60000)crypto.getRandomValues(random.subarray(i,Math.min(i+60000,random.length)));await pdf.attach(random,'random.bin');
 const large=await source(await pdf.save()),limited=await optimizeBrowser(large,.05,false,ctx);assert(limited.blob.size>.05*1024*1024);assert.match(limited.note,/nicht erreicht/);assert(limited.blob.size<=large.bytes.length);
 const image=createCanvas(400,600),g=image.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,400,600);g.fillStyle='#285058';g.fillRect(30,30,145,200);g.fillRect(230,30,140,200);g.fillRect(30,310,145,240);g.fillRect(230,310,140,240);
 const boxes=detectScanRegions(g.getImageData(0,0,400,600).data,400,600,3);assert.equal(boxes.length,4);assert(boxes.every(r=>r.w<.4&&r.h<.45));assert.throws(()=>detectScanRegions(new Uint8ClampedArray(4),1,1,NaN),/Trennabstand/);
 const white=new Uint8ClampedArray(100*100*4).fill(255);assert.equal(detectScanRegions(white,100,100).length,0);
 const scan=await PDFDocument.create(),photo=await scan.embedPng(image.toDataURL('image/png'));scan.addPage([400,600]).drawImage(photo,{x:0,y:0,width:400,height:600});const scanSource=await source(await scan.save());
 const zip=await JSZip.loadAsync(await(await exportScanRegions(scanSource,{0:boxes},'pdf',150,ctx)).blob.arrayBuffer());assert.equal(Object.keys(zip.files).length,4);
 for(const entry of Object.values(zip.files)){const part=await source(await entry.async('uint8array'));assert.equal(part.pdf.numPages,1);assert.equal((await(await part.pdf.getPage(1)).getTextContent()).items.length,0);const size=(await PDFDocument.load(part.bytes)).getPage(0).getSize();assert(size.width<200&&size.height<300);}
 await assert.rejects(()=>exportScanRegions(scanSource,{0:[{x:.9,y:0,w:.2,h:1}]},'pdf',150,ctx),/gültige Ausschnitte/);
 assert.deepEqual(input.bytes,original,'Source remains unchanged');
 console.log('PASS: malformed PDF recovery, unreadable-file errors, unchanged originals/forms, measured unattainable target, safe Markdown/HTML, valid EPUB packaging, missing-text hints, photo-region detection, real crop PDFs and cancellation.');
}finally{for(const pdf of opened)await pdf.loadingTask.destroy();}
