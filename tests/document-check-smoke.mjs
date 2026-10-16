import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import ts from 'typescript';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement(name){assert.equal(name,'canvas');return createCanvas(1,1);}}});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('.cache',{recursive:true});
for(const name of ['pdf-text','ocr-languages','content-compare','image-codecs','pdf-engine','document-check']){
 const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}-check-test.mjs${q}`);await writeFile(`.cache/${name}-check-test.mjs`,code);
}
const {inspectPage,duplicateGroups,findPages,nearlyBlank}=await import('../.cache/document-check-check-test.mjs');
const {runJob}=await import('../.cache/pdf-engine-check-test.mjs');
const a=await PDFDocument.create(),font=await a.embedFont(StandardFonts.Helvetica);
function invoice(){const p=a.addPage([595.28,841.89]);p.drawText('Rechnung 2026-014',{font,size:26,x:60,y:720});p.drawText('Betrag: 350,00 EUR',{font,size:17,x:60,y:670});p.drawText('Beispiel fuer den Dokumentencheck',{font,size:13,x:60,y:610});}
invoice();a.addPage([595.28,841.89]);invoice();a.addPage([792,612]).drawText('Projektuebersicht und Notizen',{font,size:20,x:45,y:510});
const b=await PDFDocument.create(),bf=await b.embedFont(StandardFonts.Helvetica),scan=createCanvas(1240,1754),ctx=scan.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754);ctx.fillStyle='#222';ctx.font='bold 54px Arial';ctx.fillText('RECHNUNG SCAN',100,200);ctx.font='32px Arial';ctx.fillText('Dienstleistung: 90,00 EUR',100,310);ctx.fillText('Nur ein Beispieldokument.',100,430);const image=await b.embedPng(scan.toDataURL('image/png'));b.addPage([595.28,841.89]).drawImage(image,{x:0,y:0,width:595.28,height:841.89});b.addPage([595.28,841.89]).drawText('Fahrtkosten September',{font:bf,size:22,x:60,y:720});
const sources=[];for(const [id,doc,name] of [['a',a,'Testpaket-A.pdf'],['b',b,'Testpaket-B.pdf']]){const bytes=await doc.save(),pdf=await pdfjs.getDocument({data:bytes.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;sources.push({id,name,bytes,pdf,size:bytes.length,kind:'pdf'});await writeFile(`.cache/${name}`,bytes);}
const pages=sources.flatMap(s=>Array.from({length:s.pdf.numPages},(_,index)=>({id:s.id+index,sourceId:s.id,index,rotation:0,selected:true}))),rows=[];
try{
 for(const [i,page] of pages.entries())rows.push(await inspectPage(sources.find(s=>s.id===page.sourceId),page,i,new AbortController().signal));
 assert.deepEqual(rows.filter(r=>r.blank).map(r=>r.pageId),['a1']);assert.deepEqual(rows.filter(r=>r.needsOcr).map(r=>r.pageId),['b0']);assert.equal(new Set(rows.map(r=>r.format)).size,2);
 assert.deepEqual(duplicateGroups(rows).map(g=>g.map(r=>r.pageId)),[['a0','a2']]);
 assert.deepEqual(findPages(rows,'RECHNUNG').map(r=>r.pageId),['a0','a2']);assert.deepEqual(findPages(rows,'unbekannt, fahrtkosten').map(r=>r.pageId),['b1']);assert.equal(findPages(rows,'x').length,0);
 assert.equal(nearlyBlank(new Uint8ClampedArray([255,255,255,255]),'Unsichtbarer Text'),false);
 const chosen=findPages(rows,'Rechnung, Fahrtkosten').map(r=>pages.find(p=>p.id===r.pageId));
 const result=await runJob('organize',sources,chosen,{language:'deu',forceOcr:false,quality:'balanced',imageFormat:'png',watermark:'',numberStart:1},()=>{},new AbortController().signal);
 const out=await PDFDocument.load(await result.blob.arrayBuffer());assert.equal(out.getPageCount(),3);assert.equal(out.getCreator(),'PDF-Werkzeuge');
 await assert.rejects(()=>inspectPage(sources[0],pages[0],0,AbortSignal.abort()),/Abgebrochen/);
 console.log('PASS: native text index, scan detection, blank-page hint, exact preview duplicates, mixed page sizes, case-insensitive and comma-separated search, selected match export, brand-free output and cancellation.');
}finally{for(const s of sources)await s.pdf.loadingTask.destroy();}
