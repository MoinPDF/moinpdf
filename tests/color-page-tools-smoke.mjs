// Fictional PDFs: real PDFium/PDF.js, visible pixels, retained text and form flags.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import ts from 'typescript';
import {PDFDocument,StandardFonts,PDFName,rgb,degrees} from 'pdf-lib';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement:()=>{const c=createCanvas(1,1);c.toBlob=cb=>cb(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}}});
const directory='.cache/color-page-tools';await mkdir(directory,{recursive:true});
for(const file of (await readdir('lib')).filter(f=>f.endsWith('.ts')&&!f.endsWith('.d.ts'))){const code=ts.transpileModule(await readFile('lib/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z0-9-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);await writeFile(directory+'/'+file.replace(/\.ts$/,'.mjs'),code);}
await writeFile(directory+'/native-pdf.mjs',`import{createNativeEngine}from'./native-pdf-core.mjs';import{recolorDocumentText}from'./document-color-native.mjs';import{readFile}from'node:fs/promises';const api=await createNativeEngine(new Uint8Array(await readFile('node_modules/@embedpdf/pdfium/dist/pdfium.wasm')));export const recolorText=(bytes,pages,color,signal)=>{signal.throwIfAborted();return recolorDocumentText(api,bytes,pages,color)};`);
const {exportDocumentColors}=await import('../.cache/color-page-tools/document-color-engine.mjs');
const {defaultDocumentColors,adjustDocumentPixels}=await import('../.cache/color-page-tools/document-color-model.mjs');
const {cropPreservingContent}=await import('../.cache/color-page-tools/page-adjustments.mjs');
const {duplexOrder,extraDefaults}=await import('../.cache/color-page-tools/extra-options.mjs');
const {runExtraPdfTool}=await import('../.cache/color-page-tools/extra-tools.mjs');
const {sourcePages}=await import('../.cache/color-page-tools/pdf-engine.mjs');
const {toolDraftSchema}=await import('../.cache/color-page-tools/tool-draft-schema.mjs');
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
const proxies=[],ctx={signal:new AbortController().signal,report:()=>{}};
async function source(bytes,name='fictional.pdf'){const data=new Uint8Array(bytes),pdf=await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;proxies.push(pdf);return{id:name,name,bytes:data,pdf,size:data.length,kind:'pdf'};}
async function text(s,n=0){return(await(await s.pdf.getPage(n+1)).getTextContent()).items.map(i=>i.str||'').join(' ');}
async function render(s,n=0){const p=await s.pdf.getPage(n+1),v=p.getViewport({scale:1}),c=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await p.render({canvas:c,viewport:v}).promise;return c;}
try{
 const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica),p=d.addPage([300,400]);
 p.drawText('FICTIONAL TEXT',{x:30,y:300,font,size:20,color:rgb(0,0,0)});p.drawText('OUTSIDE CROP',{x:20,y:20,font,size:10});p.drawRectangle({x:100,y:100,width:50,height:50,color:rgb(1,0,0)});
 // Invisible OCR must remain invisible; nested shared Form text must also change.
 const hidden=d.context.register(d.context.flateStream(`q BT /${p.node.Resources().lookup(PDFName.of('Font')).keys()[0].asString()} 12 Tf 3 Tr 1 0 0 1 20 230 Tm (HIDDEN OCR) Tj ET Q`));p.node.addContentStream(hidden);
 const inner=d.context.register(d.context.flateStream('BT /F1 14 Tf 1 0 0 1 5 10 Tm (NESTED) Tj ET',{Type:'XObject',Subtype:'Form',BBox:[0,0,100,30],Resources:{Font:{F1:font.ref}}}));
 p.node.Resources().set(PDFName.of('XObject'),d.context.obj({Nested:inner}));p.node.addContentStream(d.context.register(d.context.flateStream('q 1 0 0 1 20 180 cm /Nested Do Q q 1 0 0 1 150 180 cm /Nested Do Q')));
 const f=d.getForm().createTextField('Keep value');f.addToPage(p,{x:20,y:50,width:100,height:20,font});f.setText('Saved');f.enableReadOnly();
 const original=await source(await d.save()),settings={...defaultDocumentColors,text:'#0000ff',background:'#ffff00'};
 assert(toolDraftSchema.safeParse({'DocumentColorsPanel.options:fictional':settings}).success);
 const output=await exportDocumentColors(original,settings,ctx),colored=await source(await output.blob.arrayBuffer(),'colored.pdf');
 const before=await text(original),after=await text(colored);assert.equal(after,before,'Text, including hidden OCR, retained');
 const doc=await PDFDocument.load(colored.bytes);assert.equal(doc.getForm().getTextField('Keep value').getText(),'Saved');assert(doc.getForm().getTextField('Keep value').isReadOnly());
 const canvas=await render(colored),pixels=canvas.getContext('2d');assert.deepEqual([...pixels.getImageData(280,20,1,1).data],[255,255,0,255],'New background');assert.deepEqual([...pixels.getImageData(110,280,1,1).data],[255,0,0,255],'Existing red graphics stay red');
 const all=pixels.getImageData(0,70,300,150).data;let blue=0;for(let i=0;i<all.length;i+=4)if(all[i]<40&&all[i+1]<40&&all[i+2]>200)blue++;assert(blue>250,'Real glyph pixels are recolored, including nested text');canvas.width=canvas.height=0;
 const data=new Uint8ClampedArray([255,0,0,255]);adjustDocumentPixels(data,{...settings,mode:'raster',saturation:0});assert.equal(data[0],data[1]);assert.equal(data[1],data[2]);
 const raster=await source(await(await exportDocumentColors(original,{...settings,mode:'raster',saturation:0},ctx)).blob.arrayBuffer(),'raster.pdf');assert.equal((await text(raster)).trim(),'');assert.equal((await PDFDocument.load(raster.bytes)).getForm().getFields().length,0);
 const rc=await render(raster),px=rc.getContext('2d').getImageData(110,280,1,1).data;assert(Math.abs(px[0]-px[1])<2&&Math.abs(px[1]-px[2])<2);rc.width=rc.height=0;
 await assert.rejects(()=>exportDocumentColors(original,{...settings,contrast:NaN},ctx),/Ungültig/);await assert.rejects(()=>exportDocumentColors(original,settings,{...ctx,signal:AbortSignal.abort()}),/abort/i);
 const signed=await PDFDocument.load(original.bytes);signed.catalog.set(PDFName.of('Perms'),signed.context.obj({DocMDP:signed.context.obj({Type:'Sig'})}));const signedSource=await source(await signed.save(),'signed.pdf');await assert.rejects(()=>exportDocumentColors(signedSource,settings,ctx),/Signatur/);
 for(const angle of [0,90,180,270]){
  const doc=await PDFDocument.load(original.bytes);doc.getPage(0).setCropBox(10,10,280,380);doc.getPage(0).setRotation(degrees(angle));
  const s=await source(await doc.save(),'crop-'+angle+'.pdf'),items=sourcePages(s);items[0].rotation=90;
  const crop={x:.1,y:.2,w:.7,h:.6},edits={marks:{},crops:{[items[0].id]:crop}};
  const out=await cropPreservingContent([s],items,edits,ctx.report,ctx.signal),loaded=await PDFDocument.load(await out.blob.arrayBuffer());
  const sourcePage=await s.pdf.getPage(1),v=sourcePage.getViewport({scale:1,rotation:(angle+90)%360}),a=v.convertToPdfPoint(v.width*.1,v.height*.2),b=v.convertToPdfPoint(v.width*.8,v.height*.8),box=loaded.getPage(0).getCropBox();
  for(const [value,expected] of [[box.x,Math.min(a[0],b[0])],[box.y,Math.min(a[1],b[1])],[box.width,Math.abs(a[0]-b[0])],[box.height,Math.abs(a[1]-b[1])]])assert(Math.abs(value-expected)<.00001);
  assert(loaded.getForm().getTextField('Keep value').isReadOnly());assert.equal(loaded.getForm().getTextField('Keep value').getText(),'Saved');
  loaded.getPage(0).setCropBox(0,0,300,400);const uncropped=await source(await loaded.save(),'restored-'+angle+'.pdf');assert.match(await text(uncropped),/OUTSIDE CROP/,'Hidden content is retained deliberately');
 }
 assert.deepEqual(duplexOrder(6,3,true).order,[0,5,1,4,2,3]);assert.deepEqual(duplexOrder(5).order,[0,3,1,4,2]);assert(duplexOrder(5).unequal);assert.throws(()=>duplexOrder(1));assert.throws(()=>duplexOrder(6,6));
 const six=await PDFDocument.create();for(let i=0;i<6;i++)six.addPage([100,100]).drawText('PAGE '+(i+1),{x:5,y:50,size:10});const scan=await source(await six.save(),'duplex.pdf'),pages=sourcePages(scan);
 const result=await runExtraPdfTool('interleave',await PDFDocument.load(scan.bytes),[scan],pages,{...extraDefaults,interleaveMode:'single',duplexSplit:3,reverseSecond:true},()=>{throw Error('not used')},ctx.report,ctx.signal);
 const reordered=await source(await result.blob.arrayBuffer(),'collated.pdf');for(const[i,n]of[1,6,2,5,3,4].entries())assert.match(await text(reordered,i),new RegExp('PAGE '+n));
 await writeFile(directory+'/fictional-colors.pdf',original.bytes);await writeFile(directory+'/colored.pdf',colored.bytes);await writeFile(directory+'/fictional-duplex.pdf',scan.bytes);
 console.log('PASS: real glyph colors, nested shared forms, invisible OCR, unchanged graphics/fields, raster grayscale, rotated CropBoxes, recoverable hidden text, exact duplex export, guards and drafts.');
}finally{for(const p of proxies)await p.loadingTask.destroy();}
