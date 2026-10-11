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
async function inspect(bytes){const p=await pdfjs.getDocument({data:bytes.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;try{const page=await p.getPage(1),content=await page.getTextContent(),v=page.getViewport({scale:1});const canvas=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;return{text:content.items.filter(t=>'str'in t).map(t=>t.str).join(' '),canvas};}finally{await p.loadingTask.destroy();}}
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
