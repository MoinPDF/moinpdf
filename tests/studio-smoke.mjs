import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pdfRequire('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement(name){assert.equal(name,'canvas');return createCanvas(1,1);}}});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
const assets=dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('.cache',{recursive:true});
for(const name of ['editor-rich-text','editor-rich-layout','editor-verification','local-font-bytes','pdf-text','ocr-languages','content-compare','image-codecs','pdf-engine','studio-engine','advanced-types','extra-options','extra-tools','pdf-report','editor-model','editor-font-catalog','editor-font-cmap','editor-fonts','editor-analysis','editor-text-layer']){
 const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,name)=>`${q}./${name}-studio-test.mjs${q}`);
 await writeFile(`.cache/${name}-studio-test.mjs`,code);
}
const {runStudioJob,emptyEdits,normalizedPage,removeDocumentMetadata}=await import('../.cache/studio-engine-studio-test.mjs');
const {renderPage}=await import('../.cache/pdf-engine-studio-test.mjs');
const proxies=[];
async function source(bytes,name='Fixture.pdf'){
 const data=new Uint8Array(bytes),pdf=await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/',cMapUrl:assets+'/cmaps/',cMapPacked:true}).promise;proxies.push(pdf);
 return{id:name,name,bytes:data,pdf,size:data.length,kind:'pdf'};
}
async function fromResult(result){return source(await result.blob.arrayBuffer(),result.filename);}
async function textOf(src,index=0){return(await(await src.pdf.getPage(index+1)).getTextContent()).items.filter(i=>'str'in i).map(i=>i.str).join(' ');}
const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica);
d.setTitle('Private title');d.setAuthor('Private author');
const page=d.addPage([200,300]);page.drawText('SECRET 4815',{font,size:18,x:20,y:200});page.drawRectangle({x:20,y:25,width:70,height:40,color:rgb(1,.1,.3)});
d.addPage([220,310]).drawText('SAFE PAGE',{font,size:16,x:25,y:250});d.addPage([200,300]);
const src=await source(await d.save()),pages=[0,1,2].map(index=>({id:'p'+index,sourceId:src.id,index,rotation:0,selected:true}));
const options={language:'deu',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'TEST',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2'};
const execute=(tool,edits=emptyEdits(),items=pages,config=options,signal=new AbortController().signal)=>runStudioJob(tool,[src],items,config,edits,()=>{},signal);
try{
 const red=emptyEdits();red.marks.p0=[{id:'r',kind:'redact',x:.05,y:.2,w:.9,h:.26}];
 const result=await fromResult(await execute('redact',red));
 assert.equal(await textOf(result),'','Redacted page must have no original text layer');assert.match(await textOf(result,1),/SAFE PAGE/,'Unchanged pages preserve text');
 const rendered=await renderPage(result,{...pages[0],sourceId:result.id},900);const pixel=rendered.canvas.getContext('2d').getImageData(Math.floor(rendered.canvas.width*.4),Math.floor(rendered.canvas.height*.3),1,1).data;assert.deepEqual([...pixel].slice(0,3),[0,0,0]);
 const redDoc=await PDFDocument.load(result.bytes,{updateMetadata:false});assert.equal(redDoc.context.trailerInfo.Info,undefined);
 const crop=emptyEdits();crop.crops.p0={x:.1,y:.15,w:.8,h:.65};const cropped=await fromResult(await execute('crop',crop,[pages[0]]));const cropDoc=await PDFDocument.load(cropped.bytes);assert.deepEqual(cropDoc.getPage(0).getSize(),{width:160,height:195});assert.equal(await textOf(cropped),'');
 const annotation=emptyEdits();annotation.marks.p0=[{id:'t',kind:'text',x:.1,y:.55,w:.8,h:.15,fontScale:.06,text:'Freigegeben'}];const annotated=await fromResult(await execute('annotate',annotation,[pages[0]]));assert.match(await textOf(annotated),/SECRET 4815/);assert.match(await textOf(annotated),/Freigegeben/);
 const annotatedNup=await fromResult(await execute('nup',annotation));assert.match(await textOf(annotatedNup),/Freigegeben/);
 const nup=await fromResult(await execute('nup'));assert.equal(nup.pdf.numPages,2);const nupDoc=await PDFDocument.load(nup.bytes);assert.equal(nupDoc.getPage(0).getWidth(),595.28);assert.match(await textOf(nup),/SECRET 4815/);assert.match(await textOf(nup),/SAFE PAGE/);
 const sized=await fromResult(await execute('resize',emptyEdits(),pages,{...options,pageSize:'letter',orientation:'landscape'}));const sizedDoc=await PDFDocument.load(sized.bytes);assert(sizedDoc.getPages().every(p=>p.getWidth()===792&&p.getHeight()===612));assert.equal(sizedDoc.getPageCount(),3);
 const infoResult=await fromResult(await execute('metadata'));const info=await PDFDocument.load(infoResult.bytes,{updateMetadata:false});assert.equal(info.context.trailerInfo.Info,undefined);assert.equal(info.catalog.has(PDFName.of('Metadata')),false);assert.match(await textOf(infoResult),/SECRET/);
 const fixed=await fromResult(await execute('flatten',emptyEdits(),[pages[0]]));assert.equal(await textOf(fixed),'');
 const gray=await fromResult(await execute('grayscale',emptyEdits(),[pages[0]]));const grayCanvas=(await renderPage(gray,{...pages[0],sourceId:gray.id},600)).canvas;const gp=grayCanvas.getContext('2d').getImageData(grayCanvas.width*.2,grayCanvas.height*.85,1,1).data;assert.equal(gp[0],gp[1]);assert.equal(gp[1],gp[2]);assert(gp[0]<200);
 // Match normalized visible crop and rotations against the actual PDF.js preview.
 for(const angle of [0,90,180,270]){
  const rotDoc=await PDFDocument.load(src.bytes);const rp=rotDoc.getPage(0);rp.setCropBox(10,15,180,260);rp.setRotation(degrees(angle));
  const rotated=await source(await rotDoc.save(),'rotation'+angle+'.pdf'),original={...pages[0],sourceId:rotated.id,rotation:90};
  const dest=await PDFDocument.create();await normalizedPage(dest,rp,90);const normalized=await source(await dest.save(),'normalized'+angle+'.pdf');
  const c1=(await renderPage(rotated,original,600)).canvas,c2=(await renderPage(normalized,{...pages[0],sourceId:normalized.id},600)).canvas;assert.equal(c1.width,c2.width);assert.equal(c1.height,c2.height);
  const px1=c1.getContext('2d').getImageData(0,0,c1.width,c1.height).data,px2=c2.getContext('2d').getImageData(0,0,c2.width,c2.height).data;let diff=0;for(let i=0;i<px1.length;i++)diff+=Math.abs(px1[i]-px2[i]);assert(diff/px1.length<2,`Visible rotation ${angle}+90 must match: ${diff/px1.length}`);
 }
 await assert.rejects(()=>execute('redact',red,pages,options,AbortSignal.abort()),/Abgebrochen/);
 console.log('PASS: redaction removes original text; black pixels are embedded; crop removes text and changes bounds; notes preserve text; N-up, blank pages, A4/Letter, grayscale, flatten, metadata removal, all rotations/crop offsets and cancellation.');
}finally{for(const p of proxies)await p.loadingTask.destroy();}
