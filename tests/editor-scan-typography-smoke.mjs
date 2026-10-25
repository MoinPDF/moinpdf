import {editorNativeAdapter} from './editor-native-adapter.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PDFDocument, PDFName, PDFRawStream, pushGraphicsState, popGraphicsState, beginText, endText, setFontAndSize, setTextMatrix, setTextRenderingMode, TextRenderingMode, showText, degrees} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createWorker, PSM} from 'tesseract.js';
import {resolve} from 'node:path';
const folder='.cache/editor-scan-typography';await mkdir(folder,{recursive:true});
for(const name of ['content-digest','local-font-bytes','pdf-text','ocr-languages','content-compare','image-codecs','pdf-engine','studio-engine','advanced-types','extra-options','extra-tools','pdf-report','pdf-signature-guard','editor-model','editor-rich-text','editor-rich-layout','editor-verification','editor-detail-verification','editor-layout-plan','editor-sparse','editor-scan','editor-workflow','editor-ink-verification','editor-blocks','editor-document-search','editor-analysis','editor-text-layer','editor-fonts','editor-font-outline','editor-font-match','editor-scan-typography','editor-font-cmap','editor-font-catalog','editor-native','editor-scan-pixels','editor-repair','pdf-security','native-pdf-core','nested-native','editor-project-codec','tool-draft-schema','local-projects','project-archive']){
 const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replaceAll("'/vendor/pdf/standard_fonts/'", "'public/vendor/pdf/standard_fonts/'").replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);await writeFile(`${folder}/${name}.mjs`,code);
}
await writeFile(folder+'/native-pdf.mjs',editorNativeAdapter);
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pdfRequire('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement:()=>createCanvas(1,1)}});
globalThis.pdfjsWorker=await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
const originalFetch=globalThis.fetch;globalThis.fetch=async input=>typeof input==='string' && input.startsWith('/vendor/')?new Response(await readFile('public'+input)):originalFetch(input);

const {refineEditorScanTypography}=await import('../.cache/editor-scan-typography/editor-scan-typography.mjs');
const {ocrEditorTargets,analyzeEditorPage}=await import('../.cache/editor-scan-typography/editor-analysis.mjs');
const {editorTargetMark}=await import('../.cache/editor-scan-typography/editor-blocks.mjs');
const {editorMarkChanged,readTextTargets,editorSelectionTargets}=await import('../.cache/editor-scan-typography/editor-model.mjs');
const {renderPage,openSource}=await import('../.cache/editor-scan-typography/pdf-engine.mjs');
const {drawEditorText}=await import('../.cache/editor-scan-typography/editor-text-layer.mjs');
const {prepareEditorLayout}=await import('../.cache/editor-scan-typography/editor-layout-plan.mjs');
const {resolveEditorFont}=await import('../.cache/editor-scan-typography/editor-fonts.mjs');
const {fontFile}=await import('../.cache/editor-scan-typography/editor-font-catalog.mjs');
const {editorInkSignature}=await import('../.cache/editor-scan-typography/editor-font-match.mjs');
const {runStudioJob}=await import('../.cache/editor-scan-typography/studio-engine.mjs');
const {editorScanBlur}=await import('../.cache/editor-scan-typography/editor-scan.mjs');
const softMark={sourceIsScan:true,scanBlur:.04,fontScale:.08};
assert.equal(editorScanBlur(softMark,800),2*editorScanBlur(softMark,400),'Scan appearance follows zoom in preview and physical size in export');
assert.equal(editorScanBlur({...softMark,sourceIsScan:false},400),0,'Native text stays vector text');
assert.equal(editorScanBlur({...softMark,scanBlur:Infinity},400),0,'Invalid softness is rejected');
const sources=[];
const source=async(bytes,name='fixture.pdf')=>{const s=await openSource(new File([bytes],name,{type:'application/pdf'}));sources.push(s);return s;};
const pageOf=s=>({id:'p0',sourceId:s.id,index:0,rotation:0,selected:true});
const signal=new AbortController().signal;
const worker=await createWorker('eng',1,{langPath:resolve('public/vendor/languages'),cacheMethod:'none'});
await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE});
const W=400,H=200,size=14,x=210,y=150;
async function documentFor(choice,bold,italic,text){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(await readFile('public'+fontFile(choice,bold,italic).path));
 doc.addPage([W,H]).drawText(text,{font,size,x,y});return source(await doc.save());
}
function bounds(canvas,rect){return editorInkSignature(canvas.getContext('2d').getImageData(...rect))?.bounds;}
try {
 const variants=[['liberation-sans',true,false],['liberation-sans',false,false],['liberation-sans',false,true],['liberation-sans',true,true],['liberation-serif',true,false],['carlito',true,false],['liberation-sans-narrow',true,false],['dejavu-sans',false,false],['dejavu-serif',true,false],['noto-sans',false,false],['rubik',false,false]];
 let captured;
 for(const [choice,bold,italic] of variants){
  const digital=await documentFor(choice,bold,italic,'September 2026');
  const image=await renderPage(digital,pageOf(digital),1600,signal);
  const scanDoc=await PDFDocument.create();scanDoc.addPage([W,H]).drawImage(await scanDoc.embedPng(image.canvas.toBuffer('image/png')),{x:0,y:0,width:W,height:H});
  const scan=await source(await scanDoc.save(),'scan-'+choice+'.pdf');
  const data=(await worker.recognize(image.canvas.toBuffer('image/png'),{},{text:true,blocks:true})).data;
  const target=ocrEditorTargets(data,image.canvas,W,H).find(t=>t.text==='September');
  assert(target,'Real OCR finds the original month');
  const mark=editorTargetMark(target,0,W,'month'), before=JSON.stringify(mark);
  const fitted=await refineEditorScanTypography(mark,scan,pageOf(scan),W,H,signal);
  assert.equal(JSON.stringify(mark),before,'Matching does not mutate the input');
  assert(!editorMarkChanged(fitted),'Selection alone never modifies a scanned PDF');
  assert.equal(fitted.bold,bold,choice+' keeps the source weight '+JSON.stringify({rotation:target.rotation,match:fitted.scanMatch}));
  assert.equal(fitted.italic,italic,choice+' keeps the source slope');
  assert.equal(fitted.fontChoice,choice,'Visual ranking selects the known fixture family');
  assert(Math.abs(fitted.fontScale*W-size)<.8,'Ink metrics recover size within 0.8 pt');
  assert(Math.abs(fitted.y*H+fitted.baselineScale*fitted.fontScale*W-(H-y))<.5,'Original baseline is recovered within 0.5 pt');
  assert(Math.abs(fitted.x*W-x)<.5,'Original side bearing is recovered within 0.5 pt');
  assert.deepEqual(fitted.sourceRect,mark.sourceRect,'Removal remains bound to original scan pixels');
  const changed={...fitted,text:'August'};
  const layout=await prepareEditorLayout(changed,W,H,scan);
  assert(!layout.overflow,'The shorter replacement fits without manual resizing');
  assert.equal(layout.pieces[0].font.bold,bold,'Preview uses the matched weight');
  const outputDoc=await PDFDocument.create();await drawEditorText(outputDoc,outputDoc.addPage([W,H]),changed,W,H,scan);
  const output=await source(await outputDoc.save());
  const written=(await readTextTargets(output,pageOf(output))).targets.find(t=>t.text==='August');
  assert(written,'The replacement is extractable PDF text');assert.equal(written.bold,bold);assert.equal(written.italic,italic);
  const expected=await documentFor(choice,bold,italic,'August');
  const actualRaster=await renderPage(output,pageOf(output),1600,signal),expectedRaster=await renderPage(expected,pageOf(expected),1600,signal);
  const rect=[Math.floor((x-3)*4),Math.floor((H-y-size-3)*4),500,100];
  const a=bounds(actualRaster.canvas,rect),b=bounds(expectedRaster.canvas,rect);
  for(const axis of ['x','y','width','height']) assert(Math.abs(a[axis]-b[axis])<=3,'Export ink '+axis+' agrees within 0.75 pt');
  if(!captured) captured={scan,mark:fitted,changed};
  image.canvas.width=image.canvas.height=actualRaster.canvas.width=actualRaster.canvas.height=expectedRaster.canvas.width=expectedRaster.canvas.height=0;
 }

 // Independent source metrics for a short number plus two same-size references.
 const peerDoc=await PDFDocument.create();peerDoc.registerFontkit(fontkit);
 const peerFont=await peerDoc.embedFont(await readFile('public'+fontFile('dejavu-sans').path));
 const peerPage=peerDoc.addPage([W,H]);
 for(const [t,y] of [['September',155],['Gehaltsabrechnung',130],['12',105]]) peerPage.drawText(t,{font:peerFont,x:45,y,size});
 const peerNative=await source(await peerDoc.save());const peerRaster=await renderPage(peerNative,pageOf(peerNative),1600,signal);
 const peerScanDoc=await PDFDocument.create();peerScanDoc.addPage([W,H]).drawImage(await peerScanDoc.embedPng(peerRaster.canvas.toBuffer('image/png')),{x:0,y:0,width:W,height:H});
 const peerScan=await source(await peerScanDoc.save());
 const peerMarks=(await readTextTargets(peerNative,pageOf(peerNative))).targets.map(t=>editorTargetMark({...t,origin:'ocr',originalFontId:undefined,fontName:undefined},0,W,t.id));
 const number=peerMarks.find(m=>m.text==='12');assert(number);
 const numberFit=await refineEditorScanTypography(number,peerScan,pageOf(peerScan),W,H,signal,peerMarks);
 assert.equal(numberFit.fontChoice,'dejavu-sans','Two independently agreeing samples resolve a short numeric field');
 assert(numberFit.scanMatch.samples>=3,'Evidence records source consensus');
 assert(Math.abs(numberFit.fontScale*W-size)<.5);assert(!editorMarkChanged(numberFit));
 const {editorScanMatchStatus}=await import('../.cache/editor-scan-typography/editor-model.mjs');
 assert.equal(editorScanMatchStatus({...numberFit,fontScale:numberFit.fontScale*1.5}),'changed','Manual formatting cannot reuse stale similarity evidence');
 const numberDoc=await PDFDocument.create();await drawEditorText(numberDoc,numberDoc.addPage([W,H]),{...numberFit,text:'18'},W,H,peerScan);
 const numberOutput=await source(await numberDoc.save());assert((await readTextTargets(numberOutput,pageOf(numberOutput))).targets.some(t=>t.text==='18'));
 // A right-angle scan keeps its original direction and physical baseline.
 const rotatedDoc=await PDFDocument.create();rotatedDoc.registerFontkit(fontkit);
 const rotatedFont=await rotatedDoc.embedFont(await readFile('public'+fontFile('dejavu-sans').path));
 rotatedDoc.addPage([W,H]).drawText('September',{font:rotatedFont,x:160,y:35,size,rotate:degrees(90)});
 const rotatedNative=await source(await rotatedDoc.save()),rotatedRaster=await renderPage(rotatedNative,pageOf(rotatedNative),1600,signal);
 const rotatedScanDoc=await PDFDocument.create();rotatedScanDoc.addPage([W,H]).drawImage(await rotatedScanDoc.embedPng(rotatedRaster.canvas.toBuffer('image/png')),{x:0,y:0,width:W,height:H});
 const rotatedScan=await source(await rotatedScanDoc.save());const rotatedTarget=(await readTextTargets(rotatedNative,pageOf(rotatedNative))).targets.find(t=>t.text==='September');
 const rotatedMark=editorTargetMark({...rotatedTarget,origin:'ocr',originalFontId:undefined,fontName:undefined},0,W,'rotated');
 const rotatedFit=await refineEditorScanTypography(rotatedMark,rotatedScan,pageOf(rotatedScan),W,H,signal);
 assert.equal(rotatedFit.fontChoice,'dejavu-sans');assert.equal(rotatedFit.textRotation,rotatedMark.textRotation);assert(Math.abs(rotatedFit.fontScale*W-size)<.5);
 const rotatedOutputDoc=await PDFDocument.create();await drawEditorText(rotatedOutputDoc,rotatedOutputDoc.addPage([W,H]),{...rotatedFit,text:'August'},W,H,rotatedScan);
 const rotatedOutput=await source(await rotatedOutputDoc.save());const writtenRotation=(await readTextTargets(rotatedOutput,pageOf(rotatedOutput))).targets.find(t=>t.text==='August');assert(writtenRotation);assert.equal(writtenRotation.rotation,rotatedTarget.rotation);
 for(const canvas of [peerRaster.canvas,rotatedRaster.canvas])canvas.width=canvas.height=0;
 // A scanner softens edges: compare to independently blurred PDF renderings,
 // so a perfect binary-font fixture cannot conceal a mismatch on a real scan.
 async function scannerImage(digital) {
  const image=await renderPage(digital,pageOf(digital),1600,signal);
  const blurred=createCanvas(image.canvas.width,image.canvas.height),ctx=blurred.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,blurred.width,blurred.height);
  ctx.filter='blur(1.2px)';ctx.drawImage(image.canvas,0,0);ctx.filter='none';
  image.canvas.width=image.canvas.height=0;
  return blurred;
 }
 function squaredError(a,b) {
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  const aa=a.getContext('2d').getImageData(0,0,a.width,a.height).data,bb=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
  let error=0;for(let i=0;i<aa.length;i+=4)for(let c=0;c<3;c++)error+=(aa[i+c]-bb[i+c])**2;
  return error;
 }
 for(const bold of [false,true]) {
  const digital=await documentFor('liberation-sans',bold,false,'September');
  const image=await scannerImage(digital);
  const scanDoc=await PDFDocument.create();scanDoc.addPage([W,H]).drawImage(await scanDoc.embedPng(image.toBuffer('image/png')),{x:0,y:0,width:W,height:H});
  const scan=await source(await scanDoc.save(),'soft-scan.pdf');
  const ocr=(await worker.recognize(image.toBuffer('image/png'),{},{text:true,blocks:true})).data;
  const target=ocrEditorTargets(ocr,image,W,H).find(t=>t.text==='September');assert(target);
  const fitted=await refineEditorScanTypography(editorTargetMark(target,0,W,'soft-month'),scan,pageOf(scan),W,H,signal);
  assert.equal(fitted.bold,bold,'Scanner blur must not turn a regular face bold');
  assert.equal(fitted.fontChoice,'liberation-sans');assert(!editorMarkChanged(fitted));
  assert(fitted.scanBlur*size>.15&&fitted.scanBlur*size<.5,'Recover scanner softness in physical page units');
  assert(Math.abs(fitted.fontScale*W-size)<.5,'Scan halos do not inflate point size');
  const expected=await scannerImage(await documentFor('liberation-sans',bold,false,'Oktober'));
  const outputs=[];
  for(const soft of [true,false]) {
   const doc=await PDFDocument.create();
   await drawEditorText(doc,doc.addPage([W,H]),{...fitted,text:'Oktober',...(soft?{}:{scanBlur:undefined})},W,H,scan);
   const output=await source(await doc.save());
   const written=(await readTextTargets(output,pageOf(output))).targets.filter(t=>t.text==='Oktober');
   assert.equal(written.length,1,'Replacement keeps exactly one searchable text object');
   assert.equal(written[0].invisible,soft,'Only the scan-matched appearance uses a search layer');
   const raster=await renderPage(output,pageOf(output),1600,signal);outputs.push(raster.canvas);
  }
  const softError=squaredError(outputs[0],expected),sharpError=squaredError(outputs[1],expected);
  assert(softError<sharpError*.7,`Measured edges improve the independent scanner comparison by at least 30% (${softError/sharpError})`);
  for(const canvas of [image,expected,...outputs])canvas.width=canvas.height=0;
 }
 // Exercise the real image-patch export as well as the shared text-layout path.
 const {scan,mark,changed}=captured;
 await analyzeEditorPage(scan,pageOf(scan),{signal,language:'eng',recognizer:{recognize:async canvas=>(await worker.recognize(canvas.toBuffer('image/png'),{},{text:true,blocks:true})).data,dispose:async()=>{}}});
 const result=await runStudioJob('edit-text',[scan],[pageOf(scan)],{language:'eng',editorLanguage:'eng',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'TEST',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2'},{marks:{p0:[changed]},crops:{}},()=>{},signal);
 const exported=await source(await result.blob.arrayBuffer());
 const exportedDocument=await PDFDocument.load(exported.bytes);
 const scanImages=exportedDocument.context.enumerateIndirectObjects().map(([,object])=>object).filter(object=>object instanceof PDFRawStream&&object.dict.get(PDFName.of('Subtype'))===PDFName.of('Image'));
 assert(scanImages.length>0);assert(scanImages.every(image=>!image.dict.has(PDFName.of('SMask'))),'Opaque scan patches must not introduce a soft mask that changes neighboring text interpolation');
 const text=(await readTextTargets(exported,pageOf(exported))).targets.map(t=>t.text).join(' ');
 assert.match(text,/August/);assert.doesNotMatch(text,/September/);
 await writeFile(folder+'/scan-original.pdf',scan.bytes);await writeFile(folder+'/scan-edited.pdf',exported.bytes);
 // Two OCR passes may describe one scan word with different, overlapping boxes.
 // The first, compressed search font clips the visible final letters.
 const duplicateDoc=await PDFDocument.load(scan.bytes);duplicateDoc.registerFontkit(fontkit);
 const hiddenFont=await duplicateDoc.embedFont(await readFile('public'+fontFile('liberation-sans',true,false).path));
 const duplicatePage=duplicateDoc.getPage(0),key=duplicatePage.node.newFontDictionary(hiddenFont.name,hiddenFont.ref);
 for(const scaleX of [.88,1]) duplicatePage.pushOperators(pushGraphicsState(),beginText(),setTextRenderingMode(TextRenderingMode.Invisible),setFontAndSize(key,size),setTextMatrix(scaleX,0,0,1,x,y),showText(hiddenFont.encodeText('September')),endText(),popGraphicsState());
 const duplicate=await source(await duplicateDoc.save(),'duplicate-search.pdf');
 const duplicateText=await (await duplicate.pdf.getPage(1)).getTextContent();
 assert.equal(duplicateText.items.filter(t=>t.str==='September').length,2,'Fixture contains two real hidden text objects');
 const extracted=await readTextTargets(duplicate,pageOf(duplicate));
 assert.equal(extracted.targets.length,2,'Raw extraction retains both original objects for export verification');
 const selections=editorSelectionTargets(extracted.targets,W,H);
 assert.equal(selections.length,1,'Overlapping identical hidden words form one selection before OCR completes');
 const mergedMark=editorTargetMark(selections[0],0,W,'merged-month');
 const mergedFit=await refineEditorScanTypography(mergedMark,duplicate,pageOf(duplicate),W,H,signal);
 assert.equal(mergedFit.fontChoice,'liberation-sans');assert.equal(mergedFit.bold,true,'The complete scan crop restores the bold match');
 assert(Math.abs(mergedFit.fontScale*W-size)<.8);assert(!editorMarkChanged(mergedFit));
 await analyzeEditorPage(duplicate,pageOf(duplicate),{signal,language:'eng',recognizer:{recognize:async canvas=>(await worker.recognize(canvas.toBuffer('image/png'),{},{text:true,blocks:true})).data,dispose:async()=>{}}});
 const duplicateResult=await runStudioJob('edit-text',[duplicate],[pageOf(duplicate)],{language:'eng',editorLanguage:'eng',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'TEST',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2'},{marks:{p0:[{...mergedFit,text:'August'}]},crops:{}},()=>{},signal);
 const duplicateOutput=await source(await duplicateResult.blob.arrayBuffer());
 const exportedText=(await (await duplicateOutput.pdf.getPage(1)).getTextContent()).items.filter(t=>'str' in t).map(t=>t.str).join(' ');
 assert.doesNotMatch(exportedText,/September/,'Both old search objects are removed');assert.equal((exportedText.match(/August/g)||[]).length,1);
 const duplicateRaster=await renderPage(duplicateOutput,pageOf(duplicateOutput),1600,signal);
 const singleRaster=await renderPage(exported,pageOf(exported),1600,signal);
 const comparisonRect=[Math.floor((x-3)*4),Math.floor((H-y-size-3)*4),Math.ceil(hiddenFont.widthOfTextAtSize('September',size)*4)+16,100];
 const duplicateBounds=bounds(duplicateRaster.canvas,comparisonRect),singleBounds=bounds(singleRaster.canvas,comparisonRect);
 for(const axis of ['x','y','width','height']) assert(Math.abs(duplicateBounds[axis]-singleBounds[axis])<=3,'Duplicate search layers retain the replacement ink '+axis+' within 0.75 pt');
 duplicateRaster.canvas.width=duplicateRaster.canvas.height=singleRaster.canvas.width=singleRaster.canvas.height=0;

 // A real searchable scan can be nested in a clipped Form. Its image's size
 // differs by a fraction of a pixel from the page; resizing shifts every line.
 const rawScan=await renderPage(scan,pageOf(scan),1600,signal);
 const geometryDoc=await PDFDocument.create(),geometryPage=geometryDoc.addPage([W,H]);
 const geometryImage=await geometryDoc.embedPng(rawScan.canvas.toDataURL('image/png'));
 geometryPage.drawImage(geometryImage,{x:0,y:0,width:W-.002,height:H+.003});
 for(const opacity of [0,0]) geometryPage.drawText('September',{x,y,size,opacity});
 await geometryDoc.flush();
 const nestedGeometry=await PDFDocument.create(),nestedPage=nestedGeometry.addPage([W,H]);
 nestedPage.drawPage(await nestedGeometry.embedPage(geometryPage,{left:0,bottom:0,right:W+1,top:H+1}),{x:0,y:0,xScale:1,yScale:1});
 const nestedScan=await source(await nestedGeometry.save(),'nested-scan.pdf');
 await writeFile(folder+'/nested-scan.pdf',nestedScan.bytes);
 const {readEditorScanPixels}=await import('../.cache/editor-scan-typography/editor-native.mjs');
 const preserved=await readEditorScanPixels(await PDFDocument.load(nestedScan.bytes),nestedScan,pageOf(nestedScan),signal,true);
 assert(preserved?.placement,'Nested scan keeps its original image geometry');
 assert.equal(preserved.canvas.width,rawScan.canvas.width);assert.equal(preserved.canvas.height,rawScan.canvas.height);
 assert.deepEqual(preserved.canvas.getContext('2d').getImageData(0,0,preserved.canvas.width,preserved.canvas.height).data,rawScan.canvas.getContext('2d').getImageData(0,0,rawScan.canvas.width,rawScan.canvas.height).data,'Decoded scan pixels are unchanged');
 preserved.canvas.width=preserved.canvas.height=rawScan.canvas.width=rawScan.canvas.height=0;
 await analyzeEditorPage(nestedScan,pageOf(nestedScan),{signal,language:'eng',recognizer:{recognize:async canvas=>(await worker.recognize(canvas.toBuffer('image/png'),{},{text:true,blocks:true})).data,dispose:async()=>{}}});
 const nestedResult=await runStudioJob('edit-text',[nestedScan],[pageOf(nestedScan)],{language:'eng',editorLanguage:'eng',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'TEST',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2'},{marks:{p0:[changed]},crops:{}},()=>{},signal);
 const nestedOutput=await source(await nestedResult.blob.arrayBuffer());
 const nestedText=(await (await nestedOutput.pdf.getPage(1)).getTextContent()).items.filter(t=>'str' in t).map(t=>t.str).join(' ');
 assert.doesNotMatch(nestedText,/September/);assert.equal((nestedText.match(/August/g)||[]).length,1);
 const beforeGeometry=await renderPage(nestedScan,pageOf(nestedScan),1600,signal),afterGeometry=await renderPage(nestedOutput,pageOf(nestedOutput),1600,signal);
 const beforePixels=beforeGeometry.canvas.getContext('2d').getImageData(0,0,beforeGeometry.canvas.width,beforeGeometry.canvas.height).data,afterPixels=afterGeometry.canvas.getContext('2d').getImageData(0,0,afterGeometry.canvas.width,afterGeometry.canvas.height).data;
 const rect=changed.sourceRect;
 let outsideChanges=0;
 for(let py=0;py<beforeGeometry.canvas.height;py++)for(let px=0;px<beforeGeometry.canvas.width;px++){
  if(px/beforeGeometry.canvas.width>rect.x-.015&&px/beforeGeometry.canvas.width<rect.x+rect.w+.015&&py/beforeGeometry.canvas.height>rect.y-.03&&py/beforeGeometry.canvas.height<rect.y+rect.h+.03)continue;
  const at=(py*beforeGeometry.canvas.width+px)*4;
  if([0,1,2].some(c=>beforePixels[at+c]!==afterPixels[at+c]))outsideChanges++;
 }
 assert.equal(outsideChanges,0,'Outside the changed word the exported scan is pixel-identical');
 beforeGeometry.canvas.width=beforeGeometry.canvas.height=afterGeometry.canvas.width=afterGeometry.canvas.height=0;
 const decorated=await PDFDocument.load(nestedScan.bytes);decorated.getPage(0).drawText('Visible overlay',{x:15,y:25,size:12});
 const decoratedSource=await source(await decorated.save());
 assert.equal(await readEditorScanPixels(decorated,decoratedSource,pageOf(decoratedSource),signal,true),undefined,'Extra visible content must not be discarded');
 const croppedForm=await PDFDocument.create();croppedForm.addPage([W,H]).drawPage(await croppedForm.embedPage(geometryPage,{left:0,bottom:0,right:W/2,top:H}),{x:0,y:0,xScale:1,yScale:1});
 const clippedSource=await source(await croppedForm.save());
 assert.equal(await readEditorScanPixels(croppedForm,clippedSource,pageOf(clippedSource),signal,true),undefined,'A Form clip that cuts the page keeps the normal fallback');

 const separateDoc=await PDFDocument.create(),separatePage=separateDoc.addPage([W,H]);
 for(const opacity of [1,1,0,0]) separatePage.drawText('Visible',{x:30,y:160,size:12,opacity});
 for(const [left,top,text] of [[30,110,'Repeated'],[180,110,'Repeated'],[30,70,'Repeated'],[30,110,'Different']]) separatePage.drawText(text,{x:left,y:top,size:12,opacity:0});
 const separate=await source(await separateDoc.save());
 const separateTargets=editorSelectionTargets((await readTextTargets(separate,pageOf(separate))).targets,W,H);
 assert.equal(separateTargets.filter(t=>t.text==='Visible'&&!t.invisible).length,2,'Visible overprinting remains untouched');
 assert.equal(separateTargets.filter(t=>t.text==='Visible'&&t.invisible).length,1,'Only matching invisible targets merge');
 assert.equal(separateTargets.filter(t=>t.text==='Repeated').length,3,'Adjacent words and separate lines remain independent');
 assert.equal(separateTargets.filter(t=>t.text==='Different').length,1,'Overlapping different text is not discarded');
 const native={...mark,sourceIsScan:false};assert.equal(await refineEditorScanTypography(native,scan,pageOf(scan),W,H,signal),native,'Native fonts are not replaced by scan estimates');
 const ambiguous={...mark,originalText:'X',text:'X'};assert.equal(await refineEditorScanTypography(ambiguous,scan,pageOf(scan),W,H,signal),ambiguous,'Very short samples retain manual fallback');
 const mixed={...mark,runs:[{start:0,end:2,style:{bold:true}},{start:2,end:9,style:{bold:false}}]};assert.equal(await refineEditorScanTypography(mixed,scan,pageOf(scan),W,H,signal),mixed,'Mixed runs cannot be flattened into one face');
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(()=>refineEditorScanTypography(mark,scan,pageOf(scan),W,H,cancelled.signal),{name:'AbortError'});
 console.log('PASS: real OCR September → August; eleven sharp scan font variants, short-number consensus and right-angle scan matching; independent soft-scanner fixtures, regular/bold preservation, optical export and single search layer; source weight/slope/family, size, side bearing and baseline; shared preview/export font; native scan-patch export; duplicate hidden search boxes and clean export; nested scan geometry and pixel-identical untouched regions; clipped/visible-overlay fallback; visible/repeated/different text preservation; selection no-op, native/mixed/short-sample guards and cancellation.');
} finally {await worker.terminate();await Promise.all(sources.map(s=>s.pdf.loadingTask.destroy()));globalThis.fetch=originalFetch;}
