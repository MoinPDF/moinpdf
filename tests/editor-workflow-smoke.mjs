import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import ts from 'typescript';
import { PDFDocument, PDFName, rgb, degrees } from 'pdf-lib';

const require = createRequire(import.meta.url),
  pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
const { createCanvas, DOMMatrix, Path2D, ImageData, Image } = pdfRequire('@napi-rs/canvas');
Object.assign(globalThis, {
  DOMMatrix,
  Image,
  Path2D,
  ImageData,
  document: {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return createCanvas(1, 1);
    },
  },
});
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'),
  assets = dirname(require.resolve('pdfjs-dist/package.json'));
const folder = '.cache/editor-workflow';
await mkdir(folder, { recursive: true });
for (const name of ['editor-rich-text','editor-rich-layout','editor-verification','editor-layout-plan','editor-sparse','editor-scan','editor-workflow','editor-ink-verification','editor-blocks','editor-document-search',
  'local-font-bytes',
  'pdf-text',
  'ocr-languages',
  'content-compare',
  'image-codecs',
  'pdf-engine',
  'studio-engine',
  'advanced-types',
  'extra-options',
  'extra-tools',
  'pdf-report',
  'pdf-signature-guard',
  'editor-model',
  'editor-analysis',
  'editor-text-layer',
  'editor-fonts',
  'editor-font-cmap',
  'editor-font-catalog',
  'editor-native',
  'native-pdf-core',
]) {
  const code = ts
    .transpileModule(await readFile(`lib/${name}.ts`, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    })
    .outputText.replace(/(['"])\.\/([a-z-]+)\1/g, (_, q, n) => `${q}./${n}.mjs${q}`);
  await writeFile(`${folder}/${name}.mjs`, code);
}
await writeFile(
  folder + '/native-pdf.mjs',
  `import {readFile} from 'node:fs/promises';import {createNativeEngine,removeNativeRegions,inspectNativeObjects,editNativeObjects,readNativeImage} from './native-pdf-core.mjs';let api;export const removeRegions=async(bytes,removals)=>removeNativeRegions(await(api ||= readFile('public/vendor/pdfium/pdfium.wasm').then(b=>createNativeEngine(new Uint8Array(b)))),bytes,removals);export const inspectObjects=async(bytes,page)=>inspectNativeObjects(await api,bytes,page);export const editObjects=async(bytes,page,changes)=>editNativeObjects(await(api ||= readFile('public/vendor/pdfium/pdfium.wasm').then(b=>createNativeEngine(new Uint8Array(b)))),bytes,page,changes);export const readImage=async(bytes,page,index)=>readNativeImage(await api,bytes,page,index);`,
);
const { readTextTargets } = await import('../.cache/editor-workflow/editor-model.mjs');
const { drawEditorText, layoutEditorText } =
  await import('../.cache/editor-workflow/editor-text-layer.mjs');
const { runStudioJob } = await import('../.cache/editor-workflow/studio-engine.mjs');
const { loadEditorPdf, readEditorImages, readEditorScanPixels } = await import('../.cache/editor-workflow/editor-native.mjs');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) =>
  typeof input === 'string' && input.startsWith('/vendor/')
    ? new Response(await readFile('public' + input))
    : originalFetch(input);
const proxies = [];
async function source(bytes, name = 'fixture.pdf') {
  const data = new Uint8Array(bytes),
    pdf = await pdfjs.getDocument({
      data: data.slice(),
      standardFontDataUrl: assets + '/standard_fonts/',
      cMapUrl: assets + '/cmaps/',
      cMapPacked: true,
      fontExtraProperties: true,
    }).promise;
  proxies.push(pdf);
  return { id: name, name, bytes: data, pdf, size: data.length, kind: 'pdf' };
}
const pageOf = (s, rotation = 0) => ({
  id: 'p0',
  sourceId: s.id,
  index: 0,
  rotation,
  selected: true,
});
const contents = async (s) =>
  (await (await s.pdf.getPage(1)).getTextContent()).items.filter((t) => 'str' in t);
const text = async (s) => (await contents(s)).map((t) => t.str).join(' ');
const {editorTargetMark}=await import('../.cache/editor-workflow/editor-blocks.mjs');
const {editorImageCropBounds}=await import('../.cache/editor-workflow/editor-model.mjs');
const {sparseEditorMark}=await import('../.cache/editor-workflow/editor-sparse.mjs');
const {distributeEditorFlow,detectEditorCells,captureEditorFormat,applyEditorFormat,snapEditorRect}=await import('../.cache/editor-workflow/editor-workflow.mjs');
const {estimateEditorSkew,preprocessEditorScan,ambiguousEditorNumber}=await import('../.cache/editor-workflow/editor-scan.mjs');
const {createNativeEngine,inspectNativeObjects,readNativeImage}=await import('../.cache/editor-workflow/native-pdf-core.mjs');
const {renderPage}=await import('../.cache/editor-workflow/pdf-engine.mjs');
const {default:fontkit}=await import('@pdf-lib/fontkit');
const options={language:'deu',editorLanguage:'deu+eng',imageFormat:'png',quality:'balanced',watermark:'TEST',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2'};
const signal=new AbortController().signal;
try {
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(await readFile('public/vendor/editor-fonts/DejaVuSans.ttf'),{subset:false});
 const p=doc.addPage([400,500]);p.drawText('Alpha beta gamma delta epsilon',{x:35,y:445,size:12,font});
 for(let r=0;r<3;r++)for(let c=0;c<3;c++)p.drawText(`R${r+1}C${c+1}`,{x:35+105*c,y:200-30*r,size:11,font});
 for(let r=0;r<4;r++)p.drawLine({start:{x:30,y:216-30*r},end:{x:350,y:216-30*r},thickness:.7,color:rgb(.2,.2,.2)});
 const logo=createCanvas(50,50),ctx=logo.getContext('2d');ctx.fillStyle='#e00000';ctx.fillRect(0,0,25,50);ctx.fillStyle='#0000e0';ctx.fillRect(25,0,25,50);
 p.drawImage(await doc.embedPng(logo.toBuffer('image/png')),{x:310,y:300,width:50,height:50});
 doc.addPage([600,400]).drawText('UNTOUCHED PAGE Übergröße €',{x:40,y:340,font,size:12});
 const input=await source(await doc.save(),'workflow.pdf'),page=pageOf(input),pages=[page,{...page,id:'p1',index:1}];
 const original=await readTextTargets(input,page);const target=original.targets.find(t=>t.text==='Alpha beta gamma delta epsilon');assert(target);assert(target.originalFontId);
 const selected=editorTargetMark(target,0,400,'word');const edited={...selected,text:'Alpha beta delta delta epsilon'};
 const sparse=sparseEditorMark(edited,400,input);assert(sparse.nativeTextSlice,JSON.stringify(sparse));assert.equal(sparse.nativeTextSlice.before,'Alpha beta ');
 const result=await runStudioJob('edit-text',[input],pages,options,{marks:{p0:[edited]},crops:{}},()=>{},signal);
 assert.equal(result.editorVerification.status,'passed',JSON.stringify(result.editorVerification));
 assert.equal(result.editorVerification.sparseFields,1,'Export must use verified word-level physical removal, not silently fall back');
 const reopened=await source(await result.blob.arrayBuffer(),'word-result.pdf');
 const actual=(await readTextTargets(reopened,{...page,sourceId:reopened.id})).targets.sort((a,b)=>Math.abs(a.y-b.y)<.01?a.x-b.x:a.y-b.y).map(t=>t.text).join(' ');
 assert.match(actual,/Alpha beta\s+delta delta epsilon/);assert.doesNotMatch(actual,/gamma/);
 const api=await createNativeEngine(new Uint8Array(await readFile('public/vendor/pdfium/pdfium.wasm')));
 const objects=inspectNativeObjects(api,reopened.bytes,0);
 assert(objects.filter(o=>o.type==='text').some(o=>o.text.includes('Alpha beta')),'Original prefix remains a native object');
 for(const [a,b] of [[input,reopened]]){const before=await renderPage(a,pages[1],900),after=await renderPage(b,{...pages[1],sourceId:b.id},900);assert.deepEqual(before.canvas.getContext('2d').getImageData(0,0,before.canvas.width,before.canvas.height).data,after.canvas.getContext('2d').getImageData(0,0,after.canvas.width,after.canvas.height).data);before.canvas.width=after.canvas.width=0;}
 const cells=detectEditorCells(original.targets,400,500);assert.equal(cells.length,9);assert.deepEqual(cells.map(c=>[c.row,c.column]),[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]]);
 assert.equal(detectEditorCells(original.targets.filter(t=>t.text.startsWith('R1')),400,500).length,0,'An isolated aligned row is not a table');
 const format=captureEditorFormat({...selected,bold:true,color:'#120045',lineHeight:1.7},400,input.id);
 const applied=applyEditorFormat(format,600,input.id);assert.equal(applied.fontScale*600,selected.fontScale*400);assert.equal(applied.bold,true);assert.equal(applied.lineHeight,1.7);assert.equal(applyEditorFormat(format,600,'other').originalFontId,undefined);
 const snapped=snapEditorRect({...selected,id:'move',x:.102,y:.301,w:.3,h:.1},[{...selected,id:'anchor',x:.1,y:.3,w:.3,h:.1}],[],400,500,800);assert(Math.abs(snapped.mark.x-.1)<1e-10);assert(snapped.guides.length>=1);
 const flowA={id:'flow-a',kind:'text',x:.1,y:.15,w:.6,h:.06,text:'First paragraph with several words. Second paragraph with several words.',fontScale:12/400,fontFamily:'sans',fontChoice:'dejavu-sans',color:'#222222'};
 const flowB={...flowA,id:'flow-b',y:.3,text:'',fontScale:12/600,w:.7,h:.45};
 const frames=[{mark:flowA,pageId:'p0',source:input,width:400,height:500},{mark:flowB,pageId:'p1',source:input,width:600,height:400}];
 const distributed=await distributeEditorFlow(frames,signal);assert.equal(distributed.map(x=>x.mark.text).join(''),flowA.text+'\n');assert(distributed[1].mark.text.trim());assert.equal(distributed[1].mark.runs[0].style.fontScale*600,12);
 await assert.rejects(()=>distributeEditorFlow(frames.map(f=>({...f,mark:{...f.mark,h:.0001}})),signal),/passt noch nicht/);
 const flowResult=await runStudioJob('edit-text',[input],pages,options,{marks:{p0:[distributed[0].mark],p1:[distributed[1].mark]},crops:{}},()=>{},signal);assert.equal(flowResult.editorVerification.textPages,2);
 const native=inspectNativeObjects(api,input.bytes,0).find(o=>o.type==='image');assert(native);
 const {index,x,y,w,h}=native;const imageMark={id:'logo',kind:'image',x:x-.15,y:y+.1,w,h,nativeImage:{index,rect:{x,y,w,h}}};
 const moved=await runStudioJob('edit-text',[input],pages,options,{marks:{p0:[imageMark]},crops:{}},()=>{},signal),movedSource=await source(await moved.blob.arrayBuffer(),'moved.pdf');
 const movedImage=inspectNativeObjects(api,movedSource.bytes,0).find(o=>o.type==='image');assert(Math.abs(movedImage.x-imageMark.x)<.0001);assert(Math.abs(movedImage.y-imageMark.y)<.0001);
 assert.deepEqual(readNativeImage(api,movedSource.bytes,0,movedImage.index).rgba,readNativeImage(api,input.bytes,0,index).rgba,'Moving keeps original image content');
 const cropped=await runStudioJob('edit-text',[input],pages,options,{marks:{p0:[{...imageMark,w:imageMark.w*.5,nativeImage:{...imageMark.nativeImage,crop:{x:0,y:0,w:.5,h:1}}}]},crops:{}},()=>{},signal);
 const croppedSource=await source(await cropped.blob.arrayBuffer(),'cropped.pdf'),croppedObject=inspectNativeObjects(api,croppedSource.bytes,0).find(o=>o.type==='image'),pixels=readNativeImage(api,croppedSource.bytes,0,croppedObject.index);
 assert.equal(pixels.width,25);assert(pixels.rgba.every((value,i)=>i%4===0?value>=220:i%4===3?value===255:value<=5),'Crop removes blue pixels rather than covering them');
 for(const rotation of [0,90,180,270]) {
   const rotatedDoc=await PDFDocument.create(),rp=rotatedDoc.addPage([400,500]);
   rp.setCropBox(40,30,320,430);rp.setRotation(degrees(rotation));
   rp.drawText('PRESERVED ROTATION',{x:60,y:400,size:11});
   rp.drawImage(await rotatedDoc.embedPng(logo.toBuffer('image/png')),{x:150,y:250,width:50,height:50,rotate:degrees(23)});
   const rs=await source(await rotatedDoc.save(),`rotation-${rotation}.pdf`),ri=pageOf(rs,90);
   const [im]=await readEditorImages(rs,ri,signal);assert(im?.imageCorners);
   const crop={x:0,y:0,w:.5,h:1},bounds=editorImageCropBounds(im,im.imageCorners,crop);
   const cm={id:'rotated-crop',kind:'image',...bounds,nativeImage:{index:im.index,rect:{x:im.x,y:im.y,w:im.w,h:im.h},corners:im.imageCorners,crop}};
   const rr=await runStudioJob('edit-text',[rs],[ri],options,{marks:{p0:[cm]},crops:{}},()=>{},signal);
   const ro=await source(await rr.blob.arrayBuffer(),`crop-${rotation}.pdf`),io=inspectNativeObjects(api,ro.bytes,0).find(o=>o.type==='image');
   for(const key of ['x','y','w','h'])assert(Math.abs(io[key]-bounds[key])<.0001,`${rotation} crop ${key}: ${io[key]} != ${bounds[key]}`);
   const px=readNativeImage(api,ro.bytes,0,io.index);assert.equal(px.width,25);assert(px.rgba.every((v,i)=>i%4===0?v>=220:i%4===3?v===255:v<=5));
 }
 for(const rotation of [0,90,180,270]) {
   const originalScan=await PDFDocument.create(),sp=originalScan.addPage([216,216]);sp.setRotation(degrees(rotation));sp.drawImage(await originalScan.embedPng(logo.toBuffer('image/png')),{x:0,y:0,width:216,height:216});
   const ss=await source(await originalScan.save(),`pixel-scan-${rotation}.pdf`),si=pageOf(ss),pixels=await readEditorScanPixels(originalScan,ss,si,signal);
   assert(pixels,`Full-page scan at ${rotation} degrees should retain its pixel grid`);assert.equal(pixels.canvas.width,50);assert.equal(pixels.canvas.height,50);pixels.canvas.width=pixels.canvas.height=0;
   if(rotation===0){
     originalScan.catalog.set(PDFName.of('OCProperties'),originalScan.context.obj({}));
     assert.equal(await readEditorScanPixels(originalScan,ss,si,signal),undefined,'Layers retain the normal rendering path');
     originalScan.catalog.delete(PDFName.of('OCProperties'));
     sp.node.set(PDFName.of('Annots'),originalScan.context.obj([originalScan.context.register(originalScan.context.obj({Type:'Annot',Subtype:'Text',Rect:[10,10,20,20]}))]));
     const annotated=await source(await originalScan.save(),'annotated-scan.pdf');
     assert.equal(await readEditorScanPixels(originalScan,annotated,pageOf(annotated),signal),undefined,'Annotations cannot disappear through the pixel preservation path');
     sp.node.delete(PDFName.of('Annots'));
     sp.drawText('EXTRA',{x:10,y:30,size:10});
     const extra=await source(await originalScan.save(),'extra-scan.pdf');
     assert.equal(await readEditorScanPixels(originalScan,extra,pageOf(extra),signal),undefined,'Extra objects prevent direct image reuse');
   }
 }
 const frenchBytes=await readFile('.cache/editor-corpus/francais.pdf').catch(error=>{if(error.code==='ENOENT')return;throw error;});
 if(frenchBytes){const fs=await source(frenchBytes,'public-french.pdf'),pixels=await readEditorScanPixels(await loadEditorPdf(fs.bytes),fs,pageOf(fs),signal);assert(pixels,'Pinned French JPEG scan must retain its original pixels');assert.equal(pixels.canvas.width,900);assert.equal(pixels.canvas.height,900);pixels.canvas.width=pixels.canvas.height=0;}
 const scan=createCanvas(800,900),sc=scan.getContext('2d');sc.fillStyle='#eee';sc.fillRect(0,0,800,900);sc.translate(400,450);sc.rotate(2*Math.PI/180);sc.fillStyle='#111';sc.font='24px sans-serif';for(let i=0;i<16;i++)sc.fillText('Rechnung 2026. Betrag 125,50 EUR.',-300,-340+i*38);
 const angle=estimateEditorSkew(scan);assert(Math.abs(angle+2)<=.5,`Deskew ${angle}`);const prepared=preprocessEditorScan(scan,angle);const point=prepared.restore(prepared.canvas.width/2,prepared.canvas.height/2);assert.deepEqual(point,[400,450]);assert(Math.abs(estimateEditorSkew(prepared.canvas))<=.5);prepared.canvas.width=prepared.canvas.height=0;
 assert(ambiguousEditorNumber('10O,50'));assert(ambiguousEditorNumber('l234'));assert(!ambiguousEditorNumber('IBAN DE12'));assert(!ambiguousEditorNumber('100,50'));
 await writeFile('.cache/editor-workflow/word-result.pdf',new Uint8Array(await result.blob.arrayBuffer()));
 await writeFile('.cache/editor-workflow/image-crop.pdf',new Uint8Array(await cropped.blob.arrayBuffer()));
 console.log('PASS: real word-level deletion, original glyph/image preservation, independent reopened text and unchanged-page pixels, table detection, point-preserving format transfer, guides, rich text flow across page sizes, overflow refusal, image crop, local deskew and numeric OCR review.');
} finally {for(const proxy of proxies)await proxy.loadingTask.destroy();}
