import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { createWorker, PSM } from 'tesseract.js';
const require = createRequire(import.meta.url), pr = createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData} = pr('@napi-rs/canvas');
Object.assign(globalThis, {DOMMatrix,Path2D,ImageData,document:{createElement(name){assert.equal(name,'canvas');return createCanvas(1,1);}}});
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'), assets = dirname(require.resolve('pdfjs-dist/package.json'));
const originalFetch = globalThis.fetch;
globalThis.fetch = async input => typeof input === 'string' && input.startsWith('/vendor/') ? new Response(await readFile('public'+input)) : originalFetch(input);
await mkdir('.cache/editor-auto', {recursive:true});
for (const name of ['local-font-bytes','pdf-text','ocr-languages','content-compare','image-codecs','pdf-engine','studio-engine','advanced-types','extra-options','extra-tools','pdf-report','pdf-signature-guard','editor-model','editor-font-catalog','editor-font-cmap','editor-fonts','editor-analysis','editor-text-layer','editor-native','native-pdf-core']) {
 const output=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);
 await writeFile(`.cache/editor-auto/${name}.mjs`,output);
}
await writeFile('.cache/editor-auto/native-pdf.mjs', `import {readFile} from 'node:fs/promises';import {createNativeEngine,removeNativeRegions} from './native-pdf-core.mjs';let api;export const removeRegions=async(bytes,removals)=>removeNativeRegions(await(api ||= readFile('public/vendor/pdfium/pdfium.wasm').then(b=>createNativeEngine(new Uint8Array(b)))),bytes,removals);`);
const {analyzeEditorPage,remainingEditorTargets,mergeEditorTargets,cachedEditorPage} = await import('../.cache/editor-auto/editor-analysis.mjs');
const {runStudioJob} = await import('../.cache/editor-auto/studio-engine.mjs');
const {renderPage} = await import('../.cache/editor-auto/pdf-engine.mjs');
const {addEditorTextLayer} = await import('../.cache/editor-auto/editor-text-layer.mjs');
const {readTextTargets} = await import('../.cache/editor-auto/editor-model.mjs');
const proxies=[];
async function source(bytes,name) {
 const data = new Uint8Array(bytes), pdf = await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/',cMapUrl:assets+'/cmaps/',cMapPacked:true}).promise;
 proxies.push(pdf); return {id:name,name,bytes:data,pdf,size:data.length,kind:'pdf'};
}
const pageOf=(s,index=0,rotation=0)=>({id:s.id+'-'+index,sourceId:s.id,index,rotation,selected:true});
const textOf=async(s,index=0)=>(await (await s.pdf.getPage(index+1)).getTextContent()).items.filter(t=>'str'in t).map(t=>t.str).join(' ');
const options={language:'deu',editorLanguage:'deu+eng',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'TEST',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2'};
let worker,recognitions=0;
const recognizer={async recognize(canvas){
 worker ||= await createWorker('deu+eng',1,{langPath:resolve('public/vendor/languages'),cacheMethod:'none'});
 await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO});recognitions++;
 return (await worker.recognize(canvas.toBuffer('image/png'),{}, {text:true,blocks:true})).data;
},async dispose(){await worker?.terminate();}};
const signal = new AbortController().signal;
const analyze=(s,p=pageOf(s),more={})=>analyzeEditorPage(s,p,{signal,recognizer,...more});
const exportPdf=async(s,pages,marks={})=>source(await (await runStudioJob('edit-text',[s],pages,options,{marks,crops:{}},()=>{},signal)).blob.arrayBuffer(),s.id+'-edited');
try {
 const digital=await PDFDocument.create(); digital.addPage([400,560]).drawText('Native text is ready',{x:35,y:480,size:18});
 const native=await source(await digital.save(),'native');let nativeReported=false;
 const nativeText=await analyze(native,pageOf(native),{onNative:v=>{nativeReported=true;assert(v.targets.length);}});
 assert(nativeReported);assert.equal(recognitions,0,'Digital text needs no OCR worker');assert(!nativeText.ocr);
 assert.equal(await analyze(native),nativeText,'Completed analysis is reused');
 const letterhead=await PDFDocument.load(native.bytes),logo=createCanvas(30,30);logo.getContext('2d').fillRect(0,0,30,30);letterhead.getPage(0).drawImage(await letterhead.embedPng(logo.toBuffer('image/png')),{x:350,y:500,width:20,height:20});const letter=await source(await letterhead.save(),'letterhead');await analyze(letter);assert.equal(recognitions,0,'A small letterhead logo does not delay existing editable text with OCR');
 const canvas=createCanvas(1000,1400),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,1400);ctx.fillStyle='#171717';ctx.font='42px sans-serif';
 ['Rechnung 2026','Betrag 125,50 EUR','Unchanged footer'].forEach((t,i)=>ctx.fillText(t,90,200+i*170));
 const scanDoc=await PDFDocument.create();const scanPage=scanDoc.addPage([400,560]);scanPage.drawImage(await scanDoc.embedPng(canvas.toBuffer('image/png')),{x:0,y:0,width:400,height:560});
 const scan=await source(await scanDoc.save(),'scan');const first=await analyze(scan);assert(first.ocr);assert(first.targets.some(t=>t.text.includes('Rechnung')));assert(first.targets.every(t=>t.x>=0&&t.y>=0&&t.x+t.w<=1&&t.y+t.h<=1));
 const forced=await analyze(native,pageOf(native),{forceOcr:true});assert.equal(forced.targets.find(t=>t.text==='Native text is ready').origin,'pdf','Forced OCR preserves visible native text');assert(!forced.replaceTextLayer,'Forced OCR must not rebuild ordinary digital text');
 const before=recognitions;await analyze(scan);assert.equal(recognitions,before,'Page revisit does not repeat OCR');
 const searchable=await exportPdf(scan,[pageOf(scan)]);assert.match(await textOf(searchable),/Rechnung/);assert.match(await textOf(searchable),/125,50/);
 const a=(await renderPage(scan,pageOf(scan),600)).canvas,b=(await renderPage(searchable,pageOf(searchable),600)).canvas;
 const pa=a.getContext('2d').getImageData(0,0,a.width,a.height).data,pb=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
 assert.deepEqual(pa,pb,'Adding OCR text must not change a single visible pixel');a.width=a.height=b.width=b.height=0;
 const target=first.targets.find(t=>t.text.includes('Rechnung'));
 const mark={id:'replacement',kind:'text',x:.1,y:.65,w:.75,h:.08,sourceRect:{x:target.x,y:target.y,w:target.w,h:target.h},text:'Korrigierte Rechnung',fontScale:.03,fontFamily:'sans',fill:'#ffffff'};
 const changed=await exportPdf(scan,[pageOf(scan)],{[pageOf(scan).id]:[mark]});const changedText=await textOf(changed);
 assert.match(changedText,/Korrigierte Rechnung/);assert.match(changedText,/125,50/);assert.match(changedText,/Unchanged/);assert.equal((changedText.match(/Rechnung/g)||[]).length,1,'Removed source text is not restored beneath its replacement');
 const removed=await exportPdf(scan,[pageOf(scan)],{[pageOf(scan).id]:[{...mark,text:''}]});assert.doesNotMatch(await textOf(removed),/Rechnung/);
 const existingOcr=(await readTextTargets(searchable,pageOf(searchable))).targets.find(t=>t.text.includes('Rechnung'));assert(existingOcr.invisible);await analyze(searchable);const existingEdit=await exportPdf(searchable,[pageOf(searchable)],{[pageOf(searchable).id]:[{...mark,sourceRect:{x:existingOcr.x,y:existingOcr.y,w:existingOcr.w,h:existingOcr.h}}]});assert.equal(((await textOf(existingEdit)).match(/Rechnung/g)||[]).length,1,'Editing a pre-existing invisible search layer removes its original scan text');
 const sample={id:'whole',text:'secret',x:.1,y:.1,w:.3,h:.1,fontSize:10,family:'sans'};
 assert.equal(remainingEditorTargets([sample],[{x:.1,y:.1,w:.01,h:.1}]).length,0,'Even a partial deletion must not restore a complete hidden word');
 assert.equal(mergeEditorTargets([sample],[{...sample,id:'ocr'}]).length,1,'Overlapping OCR cannot duplicate native text');
 // Explicit re-recognition replaces an incorrect hidden OCR layer.
 const wrongDoc=await PDFDocument.load(scan.bytes);wrongDoc.getPage(0).drawText('WRONG HIDDEN LAYER',{x:35,y:480,size:14,opacity:0});const wrong=await source(await wrongDoc.save(),'wrong-ocr');await analyze(wrong,pageOf(wrong),{forceOcr:true});const corrected=await exportPdf(wrong,[pageOf(wrong)]);assert.doesNotMatch(await textOf(corrected),/WRONG HIDDEN/);assert.match(await textOf(corrected),/Rechnung/);
 // An OCR runtime failure still allows a clearly labelled manual export.
 await writeFile('.cache/editor-auto/editor-recognizer.mjs',`export const openEditorRecognizer=()=>({recognize:async()=>{throw Error('model unavailable')},dispose:async()=>{}});`);
 const unavailable=await source(scan.bytes,'unavailable');const partial=await runStudioJob('edit-text',[unavailable],[pageOf(unavailable)],options,{marks:{[pageOf(unavailable).id]:[{...mark,sourceRect:undefined}]},crops:{}},()=>{},signal);assert.match(partial.note,/Texterkennung nicht abgeschlossen/);const manual=await source(await partial.blob.arrayBuffer(),'manual');assert.match(await textOf(manual),/Korrigierte Rechnung/);
 // A mixed PDF: native text, a scan page, a blank page, and a scan with existing OCR.
 const mixed=await PDFDocument.create();mixed.addPage([400,560]).drawText('Original vector text',{x:25,y:480,size:18});
 const [copy]=await mixed.copyPages(scanDoc,[0]);mixed.addPage(copy);mixed.addPage([400,560]);
 const [ocrCopy]=await mixed.copyPages(await PDFDocument.load(searchable.bytes),[0]);mixed.addPage(ocrCopy);
 const mix=await source(await mixed.save(),'mixed'),mixPages=Array.from({length:4},(_,i)=>pageOf(mix,i));
 for(const page of mixPages)await analyze(mix,page);
 const mixedOut=await exportPdf(mix,mixPages);assert.equal(mixedOut.pdf.numPages,4);assert.match(await textOf(mixedOut),/Original vector text/);assert.match(await textOf(mixedOut,1),/Rechnung/);assert.equal(await textOf(mixedOut,2),'');assert.equal(((await textOf(mixedOut,3)).match(/Rechnung/g)||[]).length,1,'Existing OCR is not duplicated');
 // Real OCR for a sideways scan; output coordinates must map back to the image.
 const sideways=await PDFDocument.load(scan.bytes);sideways.getPage(0).setRotation(degrees(90));sideways.getPage(0).setCropBox(10,10,380,540);
 const side=await source(await sideways.save(),'sideways'),sideText=await analyze(side);
 assert(sideText.targets.some(t=>t.text.includes('Rechnung')),'Sideways scan orientation recovery');
 const sideOut=await exportPdf(side,[pageOf(side)]);assert.match(await textOf(sideOut),/Rechnung/);
 const reopened=await readTextTargets(sideOut,pageOf(sideOut));const originalWord=sideText.targets.find(t=>t.text.includes('Rechnung')),readWord=reopened.targets.find(t=>t.text.includes('Rechnung'));
 assert(readWord);assert(Math.abs(originalWord.x-readWord.x)<.04&&Math.abs(originalWord.y-readWord.y)<.04,JSON.stringify({originalWord,readWord,all:sideText.targets}));
 // Existing native text remains selectable in every quarter-turn orientation.
 for (const rotation of [0,90,180,270]) {
  const p=pageOf(native,0,rotation),value=await analyze(native,p);assert(value.targets.length);assert(value.targets[0].rotation!==undefined);
 }
 // Forced retry is explicit and cached; blanks must not launch OCR.
 const calls=recognitions;await analyze(mix,mixPages[2],{forceOcr:true});assert.equal(recognitions,calls);
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(()=>analyzeEditorPage(scan,pageOf(scan),{signal:cancelled.signal}),{name:'AbortError'});
 const failed=await source(scan.bytes,'failed');await assert.rejects(()=>analyze(failed,pageOf(failed),{recognizer:{recognize:async()=>{throw Error('model unavailable');},dispose:async()=>{}}}),/model unavailable/);assert.equal(cachedEditorPage(failed,pageOf(failed)),undefined);await analyze(failed);assert(cachedEditorPage(failed,pageOf(failed)),'Failed OCR remains retryable');
 // Unicode fallback must be embedded and independently extractable.
 const unicode=await PDFDocument.create(),up=unicode.addPage([400,560]);await addEditorTextLayer(unicode,up,[{...sample,text:'Überweisung Привет',fontSize:12}],400,560);const unicodeSource=await source(await unicode.save(),'unicode');assert.match(await textOf(unicodeSource),/Привет/);
 const cjk=await PDFDocument.create();await addEditorTextLayer(cjk,cjk.addPage(),[{...sample,text:'漢字 日本語 हिन्दी',fontSize:12}],595,842);const cjkSource=await source(await cjk.save(),'cjk');assert.match(await textOf(cjkSource),/漢字 日本語 हिन्दी/);
 // Parser incompatibility falls back to a verified visible rendering.
 const broken={...native,id:'repair-fallback',bytes:new TextEncoder().encode('%PDF-1.7 broken')};await analyze(broken);await assert.rejects(()=>exportPdf(broken,[pageOf(broken)]),/originalgetreu/);options.editorAllowRaster=true;const repaired=await exportPdf(broken,[pageOf(broken)]);options.editorAllowRaster=false;assert.match(await textOf(repaired),/Native text/);
 await assert.rejects(()=>renderPage({pdf:{getPage:async()=>({isPureXfa:true})}},pageOf(scan),600,signal),/dynamische XFA/,'Dynamic XFA must never silently export a blank page');
 // Removal plus redaction never restores OCR behind the black output.
 const redact=await source(await (await runStudioJob('edit-text',[scan],[pageOf(scan)],options,{marks:{[pageOf(scan).id]:[{id:'red',kind:'redact',x:0,y:0,w:1,h:1}]},crops:{}},()=>{},signal)).blob.arrayBuffer(),'redacted');assert.equal(await textOf(redact),'');
 await writeFile('.cache/editor-auto/scan-edited.pdf',changed.bytes);
 console.log(`PASS: real scan OCR, digital fast path, mixed pages, existing OCR deduplication, blank-page skip, sideways scans and CropBox coordinates, pixel-identical searchable export, replacement/removal without hidden originals, Unicode fallback, parser recovery, retries, cancellation and redaction precedence (${recognitions} OCR passes).`);
} finally {await recognizer.dispose();await Promise.all(proxies.map(p=>p.loadingTask.destroy()));globalThis.fetch=originalFetch;}
