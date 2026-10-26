import {editorNativeAdapter} from './editor-native-adapter.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import ts from 'typescript';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, rgb, degrees } from 'pdf-lib';

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
for (const name of ['content-digest','tool-draft-schema','local-projects','project-archive','editor-project-codec','editor-live-flow','editor-tables','editor-table-workspace','editor-preflight','editor-auto-flow','editor-auto-workspace','editor-rich-text','editor-rich-layout','editor-verification','editor-detail-verification','editor-layout-plan','editor-sparse','editor-scan','editor-workflow','editor-ink-verification','editor-blocks','editor-document-search',
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
  'editor-font-outline','editor-font-cmap',
  'editor-font-catalog',
  'editor-native','editor-scan-pixels',
  'editor-repair','pdf-security','native-pdf-core','nested-native',
]) {
  const code = ts
    .transpileModule(await readFile(`lib/${name}.ts`, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    })
    .outputText.replaceAll("'/vendor/pdf/standard_fonts/'", "'public/vendor/pdf/standard_fonts/'").replace(/(['"])\.\/([a-z-]+)\1/g, (_, q, n) => `${q}./${n}.mjs${q}`);
  await writeFile(`${folder}/${name}.mjs`, code);
}
await writeFile(
  folder + '/native-pdf.mjs',
  editorNativeAdapter,
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
 // MuPDF and other independent producers truncate CID /W widths to integers.
 // Quantisation below one thousandth of an em must retain the original font.
 const quantized=await PDFDocument.load(input.bytes),fd=quantized.context.lookup(font.ref,PDFDict);
 const widths=fd.lookup(PDFName.of('DescendantFonts'),PDFArray).lookup(0,PDFDict).lookup(PDFName.of('W'),PDFArray);
 for(const entry of widths.asArray())if(entry instanceof PDFArray)for(let i=0;i<entry.size();i++)entry.set(i,PDFNumber.of(Math.floor(entry.lookup(i,PDFNumber).asNumber())));
 const qi=await source(await quantized.save(),'quantized-widths.pdf'),qp=pageOf(qi),qt=(await readTextTargets(qi,qp)).targets.find(t=>t.text===target.text);
 assert(qt.originalFontId,'Integer PDF widths must not force an unnecessary font substitution');
 const qm={...editorTargetMark(qt,0,400,'quantized'),text:edited.text};
 const qr=await runStudioJob('edit-text',[qi],[qp,{...qp,id:'p1',index:1}],options,{marks:{p0:[qm]},crops:{}},()=>{},signal);
 assert.equal(qr.editorVerification.sparseFields,1,'Quantized widths retain unchanged native prefix glyphs');
 const qo=await source(await qr.blob.arrayBuffer(),'quantized-output.pdf');assert.match((await readTextTargets(qo,pageOf(qo))).targets.sort((a,b)=>Math.abs(a.y-b.y)<.01?a.x-b.x:a.y-b.y).map(t=>t.text).join(' '),/Alpha beta\s+delta delta epsilon/);assert.doesNotMatch(await text(qo),/gamma/);

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
 const {prepareLinkedEditorFlow}=await import('../.cache/editor-workflow/editor-live-flow.mjs');
 const linked=distributed.map((entry,i)=>({...entry.mark,flow:{id:'linked',order:i}}));
 linked[0]={...linked[0],text:'Additional words to redistribute. '+linked[0].text,runs:undefined};
 const linkedEdits={marks:{p0:[linked[0]],p1:[linked[1]]},crops:{}},beforeLinked=JSON.stringify(linkedEdits);
 const live=await prepareLinkedEditorFlow([input],pages,linkedEdits,'linked',signal);
 assert(live.changed);assert.equal(live.marks.map(x=>x.mark.text).join(''),linked.map(m=>m.text).join(''));
 assert.equal(JSON.stringify(linkedEdits),beforeLinked,'Live preparation never mutates the current workspace');
 assert(live.marks.every((entry,i)=>entry.mark.w===linked[i].w&&entry.mark.h===linked[i].h&&entry.mark.flow.id==='linked'));
 const again=await prepareLinkedEditorFlow([input],pages,live.edits,'linked',signal);assert.equal(again.changed,false,'An applied preview is stable');
 await assert.rejects(()=>prepareLinkedEditorFlow([input],[pages[0]],linkedEdits,'linked',signal),/unvollständig/);
 await assert.rejects(()=>prepareLinkedEditorFlow([input],pages,{...linkedEdits,crops:{p0:{x:0,y:0,w:1,h:.9}}},'linked',signal),/unvollständig/);
 await assert.rejects(()=>prepareLinkedEditorFlow([input],pages,{...linkedEdits,marks:{...linkedEdits.marks,p1:[linked[1],{...linked[1],id:'obstacle',flow:undefined,text:'Obstacle'}]}},'linked',signal),/überlappen/);
 const abortLive=new AbortController();abortLive.abort();await assert.rejects(()=>prepareLinkedEditorFlow([input],pages,linkedEdits,'linked',abortLive.signal),{name:'AbortError'});
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
 // Repeated Form XObjects: only the selected instance changes, both for native
 // text removal and image cropping through the ordinary editor export.
 const nestedDoc=await PDFDocument.create(),nestedPage=nestedDoc.addPage([850,550]);
 const embedded=await nestedDoc.embedPage(doc.getPage(0));
 nestedPage.drawPage(embedded,{x:0,y:0});nestedPage.drawPage(embedded,{x:430,y:0});
 const ns=await source(await nestedDoc.save(),'nested-main.pdf'),ni=pageOf(ns),nt=await readTextTargets(ns,ni);
 const leftTarget=nt.targets.filter(t=>t.text===target.text).sort((a,b)=>a.x-b.x)[0];assert(leftTarget);
 const nm={...editorTargetMark(leftTarget,0,850,'word'),text:'Changed nested content',nativeTextSlice:undefined};
 const nr=await runStudioJob('edit-text',[ns],[ni],options,{marks:{p0:[nm]},crops:{}},()=>{},signal);
 const no=await source(await nr.blob.arrayBuffer(),'nested-main-edited.pdf');
 assert.equal((await contents(no)).filter(t=>t.str===target.text).length,1,'Only one repeated Form text is removed');
 assert.match(await text(no),/Changed nested content/);assert(!(nr.warnings||[]).some(w=>/Bildseite/.test(w)));
 const nestedImages=await readEditorImages(ns,ni,signal);assert.equal(nestedImages.length,2);assert(nestedImages.every(i=>i.path.length));
 const nestedImage=nestedImages.sort((a,b)=>a.x-b.x)[0],nestedCrop={x:0,y:0,w:.5,h:1};
 const ncm={id:'nested-image',kind:'image',...editorImageCropBounds(nestedImage,nestedImage.imageCorners,nestedCrop),nativeImage:{index:nestedImage.index,path:nestedImage.path,rect:{x:nestedImage.x,y:nestedImage.y,w:nestedImage.w,h:nestedImage.h},corners:nestedImage.imageCorners,crop:nestedCrop}};
 const ncr=await runStudioJob('edit-text',[ns],[ni],options,{marks:{p0:[ncm]},crops:{}},()=>{},signal),nco=await source(await ncr.blob.arrayBuffer(),'nested-crop.pdf');
 const changedImages=(await readEditorImages(nco,pageOf(nco),signal)).sort((a,b)=>a.x-b.x);
 assert.equal(readNativeImage(api,nco.bytes,0,changedImages[0].index,changedImages[0].path).width,25);
 assert.deepEqual(readNativeImage(api,nco.bytes,0,changedImages[1].index,changedImages[1].path).rgba,readNativeImage(api,ns.bytes,0,nestedImages[1].index,nestedImages[1].path).rgba);
 // The public scan correction path must preserve a source larger than the JS
 // image cap; only bounded tiles leave the native decoder.
 const {patchEditorScan}=await import('../.cache/editor-workflow/editor-native.mjs');
 const {eraseEditorScanRegion}=await import('../.cache/editor-workflow/editor-scan.mjs');
 const large=createCanvas(2500,3500),lc=large.getContext('2d');
 const gradient=lc.createLinearGradient(0,0,2500,3500);gradient.addColorStop(0,'#eee6d8');gradient.addColorStop(1,'#fff8ec');lc.fillStyle=gradient;lc.fillRect(0,0,2500,3500);
 lc.fillStyle='#151515';lc.fillRect(400,701,180,2);lc.font='40px sans-serif';lc.fillText('OLD',440,750);
 const largeDoc=await PDFDocument.create(),lp=largeDoc.addPage([500,700]);lp.drawImage(await largeDoc.embedPng(large.toBuffer('image/png')),{x:0,y:0,width:500,height:700});
 const ls=await source(await largeDoc.save(),'large-scan.pdf'),rect={x:430/2500,y:690/3500,w:135/2500,h:75/3500},lm={id:'large',kind:'text',...rect,sourceRect:rect,sourceIsScan:true,text:'',scanBackground:'preserve'};
 const patched=await patchEditorScan(largeDoc,ls,pageOf(ls),[lm],[],false,signal);assert(patched,'Large scan uses bounded original-grid correction');
 const ps=await source(await patched.save(),'large-patched.pdf'),pg=await ps.pdf.getPage(1),pc=createCanvas(2500,3500);await pg.render({canvas:pc,viewport:pg.getViewport({scale:5})}).promise;
 const before=lc.getImageData(0,0,2500,3500).data,after=pc.getContext('2d').getImageData(0,0,2500,3500).data;
 let changes=0;for(let y=0;y<3500;y++)for(let x=0;x<2500;x++)for(let c=0;c<4;c++){const at=(y*2500+x)*4+c;if(x>=430&&x<565&&y>=690&&y<765){changes+=before[at]!==after[at];}else assert.equal(after[at],before[at],`Outside scan correction ${x}/${y}/${c}`);}
 assert(changes>100);for(let x=430;x<565;x++)assert(after[(701*2500+x)*4]<30,'Continuous rule survives');
 const im=inspectNativeObjects(api,ps.bytes,0).find(o=>o.type==='image');assert(im);const tile=readNativeImage(api,ps.bytes,0,im.index,[],{x:0,y:0,w:.01,h:.01});assert.deepEqual([tile.sourceWidth,tile.sourceHeight],[2500,3500]);
 large.width=large.height=pc.width=pc.height=0;
 const paper=createCanvas(100,100),paperContext=paper.getContext('2d');paperContext.fillStyle='#eee4d0';paperContext.fillRect(0,0,100,100);paperContext.fillStyle='#111';paperContext.fillRect(19,30,4,3);paperContext.fillRect(40,40,15,15);
 eraseEditorScanRegion(paper,{x:.2,y:.2,w:.6,h:.6});const paperPixels=paperContext.getImageData(0,0,100,100).data;
 for(let y=20;y<80;y++)for(let x=20;x<80;x++)assert(paperPixels[(y*100+x)*4]>=235,'A one-sided glyph must not smear into the reconstructed paper');
 eraseEditorScanRegion(paper,{x:.2,y:.2,w:.6,h:.6},'solid','#c0d0e0');assert.deepEqual([...paperContext.getImageData(40,40,1,1).data],[192,208,224,255]);paper.width=paper.height=0;
 if(frenchBytes){const fs=await source(frenchBytes,'public-french.pdf'),pixels=await readEditorScanPixels(await loadEditorPdf(fs.bytes),fs,pageOf(fs),signal);assert(pixels,'Pinned French JPEG scan must retain its original pixels');assert.equal(pixels.canvas.width,900);assert.equal(pixels.canvas.height,900);pixels.canvas.width=pixels.canvas.height=0;}
 const scan=createCanvas(800,900),sc=scan.getContext('2d');sc.fillStyle='#eee';sc.fillRect(0,0,800,900);sc.translate(400,450);sc.rotate(2*Math.PI/180);sc.fillStyle='#111';sc.font='24px sans-serif';for(let i=0;i<16;i++)sc.fillText('Rechnung 2026. Betrag 125,50 EUR.',-300,-340+i*38);
 const {prepareEditorAutoWorkspace,materializeEditorAutoFlow}=await import('../.cache/editor-workflow/editor-auto-workspace.mjs');
 const flowDoc=await PDFDocument.create();flowDoc.registerFontkit(fontkit);const flowFont=await flowDoc.embedFont(await readFile('public/vendor/editor-fonts/DejaVuSans.ttf'),{subset:false}),fp=flowDoc.addPage([400,500]);
 fp.drawText('First paragraph.',{font:flowFont,x:40,y:400,size:12});fp.drawText('Following paragraph stays complete.',{font:flowFont,x:40,y:280,size:12});fp.drawText('FOOTER',{font:flowFont,x:30,y:30,size:10});fp.drawText('SIDE',{font:flowFont,x:330,y:380,size:10});
 flowDoc.addPage([400,500]).drawText('UNCHANGED ORIGINAL NEXT PAGE',{font:flowFont,x:35,y:400,size:12});
 const fsrc=await source(await flowDoc.save(),'automatic-flow.pdf'),fpage=pageOf(fsrc),fpages=[fpage,{...fpage,id:'f-next',index:1}];
 const ft=(await readTextTargets(fsrc,fpage)).targets.find(t=>t.text==='First paragraph.');
 const tokens=Array.from({length:360},(_,i)=>`token${String(i).padStart(3,'0')}`),fm={...editorTargetMark(ft,0,400,'automatic'),text:tokens.join(' '),w:.6};
 const fe={marks:{p0:[fm]},crops:{}},plan=await prepareEditorAutoWorkspace(fsrc,fpage,fe.marks.p0,fm.id,.85,fpages.length,signal);
 assert(plan.pages.length>1);assert.equal(plan.pages.flatMap(p=>p.chunks).filter(c=>c.paragraphId===fm.id).map(c=>c.mark.text||'').join(''),fm.text);
 const material=await materializeEditorAutoFlow(plan,fsrc,fpage,fpages,fe,signal,async(file)=>source(await file.arrayBuffer(),file.name));assert(material.addedSource);
 assert.equal(material.pages.at(-1).id,'f-next');assert(material.pages.filter(p=>p.sourceId===material.addedSource.id).every(p=>p.index>0),'Reference page is excluded from display/export');
 const fr=await runStudioJob('edit-text',[fsrc,material.addedSource],material.pages,options,material.edits,()=>{},signal),fout=await source(await fr.blob.arrayBuffer(),'automatic-flow-result.pdf');
 const ftext=(await Promise.all(Array.from({length:fout.pdf.numPages},async(_,i)=>(await(await fout.pdf.getPage(i+1)).getTextContent()).items.filter(t=>'str'in t).map(t=>t.str).join(' ')))).join(' ');
 for(const token of tokens)assert.equal((ftext.match(new RegExp(token,'g'))||[]).length,1,`${token} exactly once`);
 assert.equal((ftext.match(/Following paragraph stays complete/g)||[]).length,1);assert.equal((ftext.match(/FOOTER/g)||[]).length,1);assert.equal((ftext.match(/SIDE/g)||[]).length,1);
 assert.equal(fout.pdf.numPages,material.pages.length);const fo=await renderPage(fsrc,fpages[1],900),fn=await renderPage(fout,{...fpages[1],sourceId:fout.id,index:fout.pdf.numPages-1},900);assert.deepEqual(fo.canvas.getContext('2d').getImageData(0,0,fo.canvas.width,fo.canvas.height).data,fn.canvas.getContext('2d').getImageData(0,0,fn.canvas.width,fn.canvas.height).data);fo.canvas.width=fo.canvas.height=fn.canvas.width=fn.canvas.height=0;
 await writeFile(folder+'/automatic-flow.pdf',fout.bytes);
 const {preflightEditor,safeEditorHeight,editorDocumentState,testEditorRemoval,groupEditorPreflightIssues,canAdjustEditorHeight}=await import('../.cache/editor-workflow/editor-preflight.mjs');
 const tooSmall={...editorTargetMark(ft,0,400,'fit'),text:'A longer replacement line that needs several lines in this narrow frame.',w:.4,h:.01};
 const issues=await preflightEditor([fsrc],fpages,{marks:{p0:[tooSmall]},crops:{}},signal);assert(issues.some(i=>i.kind==='layout'));
 const brokenPage={...fpage,id:'broken',sourceId:'missing-source'},progress=[];
 const warning={pageId:'p0',markId:tooSmall.id,kind:'font',message:'Replacement font'};
 const grouped=groupEditorPreflightIssues([...issues,warning,warning,{...warning,pageId:'p1'}]);
 assert.equal(grouped.length,2);assert.equal(grouped[0].issues.filter(i=>i.kind==='font'&&i.message===warning.message).length,1);
 assert(canAdjustEditorHeight(tooSmall));
 for(const extra of [{textRotation:90},{sourceIsScan:true},{tableCell:{tableId:'t',cellId:'c'}},{kind:'erase'}]) assert(!canAdjustEditorHeight({...tooSmall,...extra}));
 const partial=await preflightEditor([fsrc],[brokenPage,...fpages],{marks:{broken:[{...tooSmall,id:'broken-mark'}],p0:[tooSmall]},crops:{}},signal,(completed,total)=>progress.push([completed,total]));
 assert(partial.some(i=>i.pageId==='broken'&&i.kind==='error'),'Unreadable pages produce an explicit page issue');
 assert(partial.some(i=>i.pageId==='p0'&&i.kind==='layout'),'One failed page does not suppress issues on later pages');
 assert.deepEqual(progress,[[0,2],[1,2],[2,2]],'Progress counts changed pages, including failed checks');
 await assert.rejects(()=>preflightEditor([fsrc],fpages,{marks:{p0:[tooSmall]},crops:{}},AbortSignal.abort()),{name:'AbortError'});
 const fix=await safeEditorHeight(fsrc,fpage,tooSmall,[tooSmall],signal);assert(fix.h>tooSmall.h);assert(fix.h<.2);
 const nearFooter={...tooSmall,y:.86};await assert.rejects(()=>safeEditorHeight(fsrc,fpage,nearFooter,[nearFooter],signal),/berühren|Seitengrenzen/);
 const conflict={id:'other',kind:'text',text:'Obstacle',x:.1,y:tooSmall.y+.03,w:.4,h:.04,fontScale:.03};await assert.rejects(()=>safeEditorHeight(fsrc,fpage,tooSmall,[tooSmall,conflict],signal),/berühren/);
 await testEditorRemoval(fsrc,fpage,[{...tooSmall,text:'Short',h:.1}],signal);
 const flaky={...fsrc,id:'retry-state',pdf:Object.create(fsrc.pdf)},getOriginal=fsrc.pdf.getPage.bind(fsrc.pdf);let stateReads=0;flaky.pdf.getPage=(n)=>++stateReads===1?Promise.reject(new Error('temporary page failure')):getOriginal(n);
 await assert.rejects(()=>editorDocumentState(flaky,fpage),/temporary/);assert((await editorDocumentState(flaky,fpage)).targets.length,'Rejected page-state promises are evicted for retry');

 const {readEditorTables,changeEditorTable,editorTablePaths}=await import('../.cache/editor-workflow/editor-table-workspace.mjs');
 const {editorTableSegments,validateEditorTableOriginal}=await import('../.cache/editor-workflow/editor-tables.mjs');
 const td=await PDFDocument.create();td.registerFontkit(fontkit);const tf=await td.embedFont(await readFile('public/vendor/editor-fonts/DejaVuSans.ttf'),{subset:false}),tp=td.addPage([400,500]);
 const line=(x1,y1,x2,y2)=>tp.drawLine({start:{x:x1,y:500-y1},end:{x:x2,y:500-y2},thickness:.7,color:rgb(.1,.2,.3)});
 for(const y of [60,100,140,180])line(30,y,330,y);for(const x of [30,330])line(x,60,x,180);line(180,100,180,180);
 for(const [text,x,y] of [['MERGED HEADING',40,84],['A1',40,124],['B1',190,124],['A2',40,164],['B2',190,164],['TABLE FOOTER',30,470]])tp.drawText(text,{x,y:500-y,size:12,font:tf});
 td.addPage([400,500]).drawText('TABLE UNCHANGED PAGE',{x:30,y:440,size:12,font:tf});
 const tsrc=await source(await td.save(),'vector-table.pdf'),tpage=pageOf(tsrc),tpages=[tpage,{...tpage,id:'table-next',index:1}];
 await writeFile(folder+'/table-original.pdf',tsrc.bytes);
 const tables=await readEditorTables(tsrc,tpage,[],signal);assert.equal(tables.length,1,'Native vector grid is recognized');let table=tables[0];assert.equal(table.cells[0].columnSpan,2);
 const columnDeletion=await changeEditorTable(tsrc,tpage,[],table,{kind:'delete-column',column:1},signal);
 const deletedColumnResult=await runStudioJob('edit-text',[tsrc],tpages,options,{marks:{p0:columnDeletion.add},crops:{}},()=>{},signal);
 const deletedColumnText=await text(await source(await deletedColumnResult.blob.arrayBuffer()));
 assert(!deletedColumnText.includes('B1')&&!deletedColumnText.includes('B2'),'Deleting a populated column physically removes all of its original text');
 assert(deletedColumnText.includes('A1')&&deletedColumnText.includes('A2')&&deletedColumnText.includes('MERGED HEADING'));
 const provenance=JSON.stringify(table.original);let tm=[];
 for(const operation of [{kind:'height',row:1,height:60},{kind:'height',row:1,height:55},{kind:'insert',row:2,height:45},{kind:'height',row:2,height:50}]){
   const change=await changeEditorTable(tsrc,tpage,tm,table,operation,signal);tm=[...tm.filter(m=>!change.remove.includes(m.id)),...change.add];table=tm.find(m=>m.nativeTable).nativeTable;assert.equal(JSON.stringify(table.original),provenance,'Repeated edits retain original path identities');
 }
 const inserted=table.cells.find(c=>c.row===2&&c.column===0);tm=tm.map(m=>m.tableCell?.cellId===inserted.id?{...m,text:'New line\nSecond line'}:m);
 const tr=await runStudioJob('edit-text',[tsrc],tpages,options,{marks:{p0:tm},crops:{}},()=>{},signal),tout=await source(await tr.blob.arrayBuffer(),'vector-table-result.pdf');
 assert.equal(tr.editorVerification.status,'passed',JSON.stringify(tr.editorVerification));assert(!(tr.warnings||[]).some(w=>/Bildseite/.test(w)));
 const tt=await text(tout);for(const value of ['MERGED HEADING','A1','B1','A2','B2','New line','Second line','TABLE FOOTER'])assert.equal(tt.split(value).length-1,1,`${value} once`);
 const paths=editorTablePaths(inspectNativeObjects(api,tout.bytes,0),400,500),actualSegments=paths.flatMap(p=>p.segments),wanted=editorTableSegments(table);
 assert.equal(actualSegments.length,wanted.length,'Export consists of the rebuilt vector grid');for(const segment of wanted)assert(actualSegments.some(s=>Object.keys(s).every(k=>Math.abs(s[k]-segment[k])<.01)),JSON.stringify(segment));
 const originalTable=await renderPage(tsrc,tpage,1000),newTable=await renderPage(tout,pageOf(tout),1000),ba=originalTable.canvas.getContext('2d').getImageData(0,0,800,1000).data,bb=newTable.canvas.getContext('2d').getImageData(0,0,800,1000).data;
 for(let y=0;y<1000;y++)for(let x=0;x<800;x++)if(x<56||x>664||y<116||y>(table.rows.at(-1)+2)*2)for(let c=0;c<4;c++)assert.equal(bb[(y*800+x)*4+c],ba[(y*800+x)*4+c],`Outside table ${x}/${y}`);
 const to=await renderPage(tsrc,tpages[1],900),tn=await renderPage(tout,{...tpages[1],sourceId:tout.id},900);assert.deepEqual(to.canvas.getContext('2d').getImageData(0,0,to.canvas.width,to.canvas.height).data,tn.canvas.getContext('2d').getImageData(0,0,tn.canvas.width,tn.canvas.height).data);
 for(const p of [originalTable,newTable,to,tn])p.canvas.width=p.canvas.height=0;
 const tampered=structuredClone(tm);tampered.find(m=>m.nativeTable).nativeTable.original.paths[0].index=999;
 await assert.rejects(()=>runStudioJob('edit-text',[tsrc],tpages,options,{marks:{p0:tampered},crops:{}},()=>{},signal),/exist|Tabelle|raster|Raster/);
 await assert.rejects(()=>changeEditorTable(tsrc,tpage,tm,table,{kind:'height',row:3,height:280},signal),/collid|outside|berühren/);
 // Real export after each structural operation, including previously edited cells.
 for (const operation of [
   {kind:'width',column:0,width:140},
   {kind:'insert-column',column:2,width:35},
   {kind:'merge',row:1,column:0,rowEnd:1,columnEnd:1},
   {kind:'split',cellId:table.cells.find(c=>c.row===1&&c.column===0).id},
   {kind:'delete-row',row:3},
   {kind:'delete-column',column:2},
 ]) {
   const change=await changeEditorTable(tsrc,tpage,tm,table,operation,signal);
   tm=[...tm.filter(m=>!change.remove.includes(m.id)),...change.add];table=tm.find(m=>m.nativeTable).nativeTable;
   const result=await runStudioJob('edit-text',[tsrc],tpages,options,{marks:{p0:tm},crops:{}},()=>{},signal);
   const exported=await source(await result.blob.arrayBuffer());const value=await text(exported);
   assert.equal(result.editorVerification.status,'passed',operation.kind+': '+JSON.stringify(result.editorVerification));
   assert(value.includes('TABLE FOOTER'));assert(value.includes('New line'));assert(value.includes('Second line'));
   if(operation.kind==='delete-row'||operation.kind==='delete-column'){assert(!value.includes('A2'));assert(!value.includes('B2'));}
   assert.equal(JSON.stringify(table.original),provenance);
 }
 const {encodeProjectFile,decodeProjectFile,projectStateSchema}=await import('../.cache/editor-workflow/project-archive.mjs');
 const tableState={pages:tpages,edits:{marks:{p0:tm},crops:{}},options:{...options,forceOcr:false},history:[],future:[],documentSessions:{},activeId:'p0',toolId:'edit-text'};
 const tableArchive=await encodeProjectFile('Table operations',[tsrc],tableState),restoredTable=await decodeProjectFile(tableArchive);
 const restoredMarks=restoredTable.state.edits.marks.p0;
 assert.deepEqual(restoredMarks.find(m=>m.nativeTable).nativeTable.removedTextIds,table.removedTextIds);
 assert(restoredMarks.some(m=>m.tableCell?.deleted&&m.text===''),'Explicit deletions survive project round-trip');
 const importedResult=await runStudioJob('edit-text',[tsrc],tpages,options,{marks:{p0:restoredMarks},crops:{}},()=>{},signal);
 assert.equal(importedResult.editorVerification.status,'passed');
 const badDeletion=structuredClone(tableState);badDeletion.edits.marks.p0.find(m=>m.tableCell?.deleted).text='Injected';
 assert.throws(()=>projectStateSchema.parse(badDeletion),'Nonempty deletion markers cannot be imported');
 const forged=structuredClone(tm);forged.find(m=>m.nativeTable).nativeTable.removedTextIds.push('foreign-text');
 await assert.rejects(()=>runStudioJob('edit-text',[tsrc],tpages,options,{marks:{p0:forged},crops:{}},()=>{},signal),/Zellinhalte|Tabellen/);
 await writeFile(folder+'/table-edited.pdf',tout.bytes);
 console.log('PASS: real merged vector table, repeated height changes, inserted multi-line row, immutable provenance, vector-only export, exact outside/unchanged-page pixels and tamper/collision rejection.');
 // High-resolution edits read only their bounded patch, including sampling border.
 const memoryCanvas=createCanvas(2000,2000),memoryCtx=memoryCanvas.getContext('2d');memoryCtx.fillStyle='#eee';memoryCtx.fillRect(0,0,2000,2000);
 const readPixels=memoryCtx.getImageData.bind(memoryCtx),reads=[];memoryCtx.getImageData=(...args)=>{reads.push(args);return readPixels(...args);};
 eraseEditorScanRegion(memoryCanvas,{x:.1,y:.1,w:.05,h:.025});
 assert.deepEqual(reads,[[199,199,102,52]],'A 4 MP page correction reads only 5,304 pixels');
 console.log('PATCH_MEMORY',JSON.stringify({pagePixels:4000000,readPixels:5304,rgbaCopyBytes:5304*8,previousWholePageCopyBytes:4000000*8}));
 memoryCanvas.width=memoryCanvas.height=0;
 const angle=estimateEditorSkew(scan);assert(Math.abs(angle+2)<=.5,`Deskew ${angle}`);const prepared=preprocessEditorScan(scan,angle);const point=prepared.restore(prepared.canvas.width/2,prepared.canvas.height/2);assert.deepEqual(point,[400,450]);assert(Math.abs(estimateEditorSkew(prepared.canvas))<=.5);prepared.canvas.width=prepared.canvas.height=0;
 assert(ambiguousEditorNumber('10O,50'));assert(ambiguousEditorNumber('l234'));assert(!ambiguousEditorNumber('IBAN DE12'));assert(!ambiguousEditorNumber('100,50'));
 await writeFile('.cache/editor-workflow/word-result.pdf',new Uint8Array(await result.blob.arrayBuffer()));
 await writeFile('.cache/editor-workflow/image-crop.pdf',new Uint8Array(await cropped.blob.arrayBuffer()));
 console.log('PASS: real word-level deletion, original glyph/image preservation, independent reopened text and unchanged-page pixels, table detection, point-preserving format transfer, guides, rich text flow across page sizes, overflow refusal, image crop, local deskew and numeric OCR review.');
} finally {for(const proxy of proxies)await proxy.loadingTask.destroy();}
