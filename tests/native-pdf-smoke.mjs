import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import ts from 'typescript';
import {PDFDocument,StandardFonts,rgb,degrees} from 'pdf-lib';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('.cache',{recursive:true});
await writeFile('.cache/native-core-test.mjs',ts.transpileModule(await readFile('lib/native-pdf-core.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const core=await import('../.cache/native-core-test.mjs');
const api=await core.createNativeEngine(new Uint8Array(await readFile('node_modules/@embedpdf/pdfium/dist/pdfium.wasm')));
function visualObjects(bytes) {
 const p=api.pdfium.wasmExports.malloc(bytes.length);api.pdfium.HEAPU8.set(bytes,p);const d=api.FPDF_LoadMemDocument(p,bytes.length,''),page=api.FPDF_LoadPage(d,0),q=api.pdfium.wasmExports.malloc(20),out=[];
 try{for(let i=0;i<api.FPDFPage_CountObjects(page);i++){const o=api.FPDFPage_GetObject(page,i);if(api.FPDFPageObj_GetType(o)!==1||api.FPDFTextObj_GetTextRenderMode(o)===3)continue;api.FPDFTextObj_GetFontSize(o,q);api.FPDFPageObj_GetBounds(o,q+4,q+8,q+12,q+16);out.push({size:api.pdfium.getValue(q,'float'),bottom:api.pdfium.getValue(q+8,'float')});}return out;}finally{api.pdfium.wasmExports.free(q);api.FPDF_ClosePage(page);api.FPDF_CloseDocument(d);api.pdfium.wasmExports.free(p);}
}
async function inspect(bytes){const p=await pdfjs.getDocument({data:bytes.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;try{const page=await p.getPage(1),content=await page.getTextContent(),v=page.getViewport({scale:1});const canvas=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;return{items:content.items.filter(t=>'str'in t),text:content.items.filter(t=>'str'in t).map(t=>t.str+(t.hasEOL?' ':'')).join(''),canvas};}finally{await p.loadingTask.destroy();}}
const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),page=doc.addPage([400,500]);
page.drawText('SECRET 4815',{x:40,y:400,font,size:20});page.drawText('KEEP THIS TEXT',{x:40,y:50,font,size:15});page.drawRectangle({x:40,y:220,width:100,height:60,color:rgb(0,1,0)});
const logo=createCanvas(50,50);logo.getContext('2d').fillStyle='#f00';logo.getContext('2d').fillRect(0,0,50,50);page.drawImage(await doc.embedPng(logo.toBuffer('image/png')),{x:220,y:220,width:50,height:50});
const bytes=await doc.save(),objects=core.inspectNativeObjects(api,bytes,0),target=objects.find(o=>o.text==='SECRET 4815');assert(target);assert(objects.some(o=>o.type==='image'));assert(objects.some(o=>o.type==='path'));
const changed=core.editNativeObjects(api,bytes,0,[{index:target.index,text:'PUBLIC 2026',dx:.05,dy:.1}]),view=await inspect(changed);
assert.match(view.text,/PUBLIC 2026/);assert.match(view.text,/KEEP THIS TEXT/);assert.doesNotMatch(view.text,/SECRET/);
const after=core.inspectNativeObjects(api,changed,0).find(o=>o.text==='PUBLIC 2026');assert(Math.abs(after.x-target.x-.05)<.002);assert(Math.abs(after.y-target.y-.1)<.002);
const deleted=await inspect(core.editNativeObjects(api,bytes,0,[{index:target.index,remove:true}]));assert.doesNotMatch(deleted.text,/SECRET/);assert.match(deleted.text,/KEEP THIS TEXT/);
for(const angle of [0,90,180,270]){const rotated=await PDFDocument.load(bytes);rotated.getPage(0).setRotation(degrees(angle));rotated.getPage(0).setCropBox(20,20,360,460);const b=await rotated.save(),o=core.inspectNativeObjects(api,b,0).find(o=>o.text==='SECRET 4815');assert(o);const rect={x:Math.max(0,o.x-.005),y:Math.max(0,o.y-.005),w:o.w+.01,h:o.h+.01};const redacted=core.removeNativeRegions(api,b,[{page:0,rect,color:'#ffeecc'}]),r=await inspect(redacted);assert.doesNotMatch(r.text,/SECRET/);assert.match(r.text,/KEEP THIS TEXT/);const pixel=r.canvas.getContext('2d').getImageData(Math.floor((rect.x+rect.w/2)*r.canvas.width),Math.floor((rect.y+rect.h/2)*r.canvas.height),1,1).data;assert.deepEqual([...pixel].slice(0,3),[255,238,204]);}
const img=objects.find(o=>o.type==='image'),imageRemoved=core.removeNativeRegions(api,bytes,[{page:0,rect:img,color:'#000000'}]);const ip=api.pdfium.wasmExports.malloc(imageRemoved.length);api.pdfium.HEAPU8.set(imageRemoved,ip);const id=api.FPDF_LoadMemDocument(ip,imageRemoved.length,''),pg=api.FPDF_LoadPage(id,0);try{for(let i=0;i<api.FPDFPage_CountObjects(pg);i++){const ob=api.FPDFPage_GetObject(pg,i);if(api.FPDFPageObj_GetType(ob)!==3)continue;const bm=api.FPDFImageObj_GetBitmap(ob);if(bm){const bp=api.FPDFBitmap_GetBuffer(bm),bs=api.FPDFBitmap_GetStride(bm)*api.FPDFBitmap_GetHeight(bm);assert.equal(api.FPDFBitmap_GetFormat(bm),2);const w=api.FPDFBitmap_GetWidth(bm),h=api.FPDFBitmap_GetHeight(bm),stride=api.FPDFBitmap_GetStride(bm);for(let y=0;y<h;y++)for(let x=0;x<w*3;x++)assert.equal(api.pdfium.HEAPU8[bp+y*stride+x],255,'Original red image pixels must be removed from the decoded image data');api.FPDFBitmap_Destroy(bm);}}}finally{api.FPDF_ClosePage(pg);api.FPDF_CloseDocument(id);api.pdfium.wasmExports.free(ip);}
const newImage=core.editNativeObjects(api,bytes,0,[{index:img.index,image:{width:1,height:1,rgba:new Uint8Array([0,0,255,255])}}]),imageView=await inspect(newImage);assert.deepEqual([...imageView.canvas.getContext('2d').getImageData(240,260,1,1).data],[0,0,255,255]);
assert.throws(()=>core.editNativeObjects(api,bytes,0,[{index:9999,remove:true}]),/ungültig/);
assert.throws(()=>core.editNativeObjects(api,bytes,0,[{index:target.index,text:'😀'}]),/Originalschrift/);
assert.throws(()=>core.removeNativeRegions(api,bytes,[{page:0,rect:{x:-1,y:0,w:1,h:1}}]),/Ungültig/);
await writeFile('.cache/native-result.pdf',changed);
console.log('PASS: Native original-font text editing, object movement/deletion, text-preserving region removal, image removal, all page rotations and CropBox coordinates; independent PDF.js text/render checks.');

const stack=await PDFDocument.create(),stackPage=stack.addPage([100,100]);stackPage.drawRectangle({x:10,y:10,width:70,height:70,color:rgb(1,0,0)});stackPage.drawRectangle({x:20,y:20,width:70,height:70,color:rgb(0,0,1)});
const stackBytes=await stack.save(),stackObjects=core.inspectNativeObjects(api,stackBytes,0);
const behind=core.editNativeObjects(api,stackBytes,0,[{index:stackObjects[1].index,order:'back'}]);assert.deepEqual([...(await inspect(behind)).canvas.getContext('2d').getImageData(50,50,1,1).data],[255,0,0,255]);
const front=core.editNativeObjects(api,stackBytes,0,[{index:stackObjects[0].index,order:'front'}]);assert.deepEqual([...(await inspect(front)).canvas.getContext('2d').getImageData(50,50,1,1).data],[255,0,0,255]);
assert.equal(core.inspectNativeObjects(api,behind,0).length,2);
console.log('PASS: native top-level object ordering persists after save and independent rendering.');

const paragraphFont=new Uint8Array(await readFile('public/vendor/invoice-font/NotoSans-Regular.ttf'));
const paragraphSettings={indices:[target.index],rect:{x:.1,y:.15,w:.7,h:.55},text:'Überarbeiteter Absatz mit 123 Euro. Dieser Text wird automatisch in mehrere Zeilen umbrochen.\n\nZweiter Absatz mit ÄÖÜ und €.',fontBytes:paragraphFont,fontSize:16,lineHeight:1.4,padding:4,align:'left',color:'#123456'};
for(const angle of [0,90,180,270]) {
  const original=await PDFDocument.load(bytes); original.getPage(0).setRotation(degrees(angle)); original.getPage(0).setCropBox(20,20,360,460);
  const input=await original.save(); const found=core.inspectNativeObjects(api,input,0).find(o=>o.text==='SECRET 4815');
  const updated=await core.replaceNativeParagraph(api,input,0,{...paragraphSettings,indices:[found.index]}),read=await inspect(updated.bytes);
  assert(updated.lines>3);assert.match(read.text,/Überarbeiteter Absatz/);assert.match(read.text,/Zweiter Absatz/);assert.doesNotMatch(read.text,/SECRET/);assert.match(read.text,/KEEP THIS TEXT/);
  const list=core.inspectNativeObjects(api,updated.bytes,0);assert(list.some(o=>o.type==='image'));assert(list.some(o=>o.type==='path'));
  for(const o of list.filter(o=>o.type==='text'&&o.text.trim()!=='KEEP THIS TEXT')) {assert(o.x>=.099,JSON.stringify({angle,o}));assert(o.y>=.149,JSON.stringify({angle,o}));assert(o.x+o.w<=.801);assert(o.y+o.h<=.701);}
}
const multiple=core.inspectNativeObjects(api,bytes,0).filter(o=>o.type==='text').map(o=>o.index);
const rightAligned=await core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,indices:multiple,align:'right',text:'Gemeinsamer Text'});
const rightView=await inspect(rightAligned.bytes);assert.match(rightView.text,/Gemeinsamer Text/);assert.doesNotMatch(rightView.text,/KEEP|SECRET/);
await assert.rejects(()=>core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,rect:{x:0,y:0,w:.2,h:.015}}),/Textüberlauf|kleiner/);
await assert.rejects(()=>core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,text:'漢字'}),/enthält das Zeichen/);
await assert.rejects(()=>core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,text:'مرحبا'}),/enthält das Zeichen/);
await assert.rejects(()=>core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,fontBytes:new Uint8Array(20)}),/TrueType/);
await assert.rejects(()=>core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,indices:[img.index]}),/ausschließlich Text/);
await assert.rejects(()=>core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,text:'Hello',rect:{x:.99,y:.1,w:.5,h:.5}}),/Textbereich/);
assert.match((await inspect(bytes)).text,/SECRET 4815/,'Rejected export cannot alter input');
await writeFile('.cache/paragraph-result.pdf',rightAligned.bytes);
console.log('PASS: Paragraph reflow, multi-object replacement, embedded Unicode font, line/box overflow and missing-glyph rejection, all rotations and CropBox offsets, independent PDF.js text and vector checks.');
const richText='Groß und klein. office fi A\u0301 bleibt richtig.';
const rich=await core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,text:richText,styles:[{from:0,to:4,fontSize:24,color:'#ff0000'},{from:5,to:14,fontSize:10,color:'#0000ff'}]});
const richRead=await inspect(rich.bytes);assert.match(richRead.text.normalize('NFC'),/office fi Á bleibt richtig/);assert.match(richRead.text.replace(/\s+/g,' '),/Groß und klein/);
const richObjects=core.inspectNativeObjects(api,rich.bytes,0).filter(o=>o.type==='text');assert(richObjects.some(o=>o.text.includes('office fi')));assert(visualObjects(rich.bytes).some(o=>Math.abs(o.size-24)<.01));assert(visualObjects(rich.bytes).some(o=>Math.abs(o.size-10)<.01));
let redPixels=0,bluePixels=0;const colored=richRead.canvas.getContext('2d').getImageData(0,0,richRead.canvas.width,richRead.canvas.height).data;for(let i=0;i<colored.length;i+=4){if(colored[i]>180&&colored[i+1]<80&&colored[i+2]<80)redPixels++;if(colored[i]<80&&colored[i+1]<80&&colored[i+2]>180)bluePixels++;}assert(redPixels>10&&bluePixels>10);
const flowDoc=await PDFDocument.load(bytes);flowDoc.addPage([400,500]).drawText('UNCHANGED TRAILING PAGE',{x:30,y:430});const flowInput=await flowDoc.save();
const longText=Array.from({length:12},(_,i)=>`Absatz ${i+1}: office bleibt als echter Text erhalten.`).join('\n');
const flowing=await core.replaceNativeParagraph(api,flowInput,0,{...paragraphSettings,rect:{x:.1,y:.1,w:.7,h:.22},fontSize:14,text:longText,flow:true});
assert(flowing.addedPages>0&&flowing.addedPages<20);
const flowPdf=await pdfjs.getDocument({data:flowing.bytes.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;
try {
 assert.equal(flowPdf.numPages,2+flowing.addedPages);let all='';for(let i=1;i<=flowPdf.numPages;i++)all+=(await(await flowPdf.getPage(i)).getTextContent()).items.filter(t=>'str'in t).map(t=>t.str).join(' ')+' ';
 for(let i=1;i<=12;i++)assert(all.includes(`Absatz ${i}:`));assert(!all.includes('SECRET'));assert(all.includes('KEEP THIS TEXT'));assert(all.endsWith('UNCHANGED TRAILING PAGE '));
}finally{await flowPdf.loadingTask.destroy();}
await assert.rejects(()=>core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,text:'A\u0301 und B',styles:[{from:1,to:2,fontSize:12,color:'#000000'}]}),/Zeichenfolge/);
await assert.rejects(()=>core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,text:richText,styles:[{from:0,to:8,fontSize:12,color:'#000000'},{from:4,to:12,fontSize:14,color:'#000000'}]}),/überschneiden/);
console.log('PASS: shaped ligatures/combining marks, mixed font sizes/colors, grapheme-safe styles and multi-page paragraph flow with untouched later pages.');

for(const angle of [0,90,180,270]) {
 const rotated=await PDFDocument.load(bytes);rotated.getPage(0).setRotation(degrees(angle));rotated.getPage(0).setCropBox(20,20,360,460);
 const input=await rotated.save(),objs=core.inspectNativeObjects(api,input,0),before=await inspect(input);
 const grouped=core.groupNativeObjects(api,input,0,objs.map(o=>o.index)),after=await inspect(grouped);
 assert.equal(core.inspectNativeObjects(api,grouped,0).length,1); assert.equal(core.inspectNativeObjects(api,grouped,0)[0].type,'group');
 const a=before.canvas.getContext('2d').getImageData(0,0,before.canvas.width,before.canvas.height).data,b=after.canvas.getContext('2d').getImageData(0,0,after.canvas.width,after.canvas.height).data;
 assert.equal(a.length,b.length);let diff=0;for(let i=0;i<a.length;i++)diff+=Math.abs(a[i]-b[i]);assert(diff/a.length<.05,`group rotation ${angle}: ${diff/a.length}`);
 const dup=core.groupNativeObjects(api,input,0,[objs[0].index],true);assert.equal(core.inspectNativeObjects(api,dup,0).length,objs.length+1);
}
console.log('PASS: native grouping and duplication preserve vectors, rotations, CropBox and rendered pixels.');
const rtlFont=new Uint8Array(await readFile('public/vendor/editor-fonts/DejaVuSans.ttf'));
for(const text of ['مرحبا بالعالم','שלום עולם','ABC 123 שלום (456) مرحبا']) {
 const out=await core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,text,fontBytes:rtlFont,direction:'auto'});const view=await inspect(out.bytes);assert(view.text.includes(text.includes('שלום')?'שלום':'مرحبا'),view.text);if(text.includes('456'))assert(view.text.includes('(456)'),view.text);
}
const baseline=await core.replaceNativeParagraph(api,bytes,0,{...paragraphSettings,text:'ABC',styles:[{from:1,to:2,fontSize:10,color:'#000000',baselineShift:4}]});
const bl=visualObjects(baseline.bytes).filter(o=>[10,16].includes(o.size));assert.equal(bl.length,3);assert(bl.find(o=>o.size===10).bottom>bl.find(o=>o.size===16).bottom+3.5);
console.log('PASS: Arabic/Hebrew/mixed text with bracket extraction and shifted baseline.');
