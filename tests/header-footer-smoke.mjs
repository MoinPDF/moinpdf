// Fictional fixtures; production PDFium operations and independent PDF.js round trips.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import ts from 'typescript';
import {PDFDocument,StandardFonts,PDFName,PDFString,rgb,degrees} from 'pdf-lib';
import {editorNativeAdapter} from './editor-native-adapter.mjs';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement:()=>createCanvas(1,1)}});
const directory='.cache/header-footer';await mkdir(directory,{recursive:true});
for(const file of (await readdir('lib')).filter(f=>f.endsWith('.ts')&&!f.endsWith('.d.ts'))){
 const code=ts.transpileModule(await readFile('lib/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replaceAll("'/vendor/pdf/standard_fonts/'","'public/vendor/pdf/standard_fonts/'").replace(/(['"])\.\/([a-z0-9-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);
 await writeFile(directory+'/'+file.replace(/\.ts$/,'.mjs'),code);
}
await writeFile(directory+'/native-pdf.mjs',editorNativeAdapter);
const m=await import('../.cache/header-footer/header-footer-model.mjs'),e=await import('../.cache/header-footer/header-footer-engine.mjs');
const {toolDraftSchema}=await import('../.cache/header-footer/tool-draft-schema.mjs');
const {readTextTargets}=await import('../.cache/header-footer/editor-model.mjs');
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
const proxies=[],ctx={signal:new AbortController().signal,report:()=>{}},options={...m.defaultMarginSettings};
const realFetch=globalThis.fetch;globalThis.fetch=async input=>typeof input==='string'&&input.startsWith('/vendor/')?new Response(await readFile('public'+input)):realFetch(input);
async function source(bytes,name='fictional.pdf'){const data=new Uint8Array(bytes),pdf=await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/',fontExtraProperties:true}).promise;proxies.push(pdf);return{id:name,name,bytes:data,pdf,size:data.length,kind:'pdf'};}
async function text(s,page){return(await(await s.pdf.getPage(page+1)).getTextContent()).items.map(t=>t.str||'').join(' ');}
async function render(s,page=0){const p=await s.pdf.getPage(page+1),v=p.getViewport({scale:1}),canvas=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await p.render({canvas,viewport:v}).promise;return canvas;}
const target=(text,x,y,w=.3,h=.02)=>({text,x,y,w,h});
try {
 const pages=[0,1,2].map(page=>({page,width:600,height:800,targets:[target('example.test/article',.1,.04),target(`Seite ${page+1} von 3`,.4,.94),target('Body repeats',.1,.5),target('Only this '+page,.1,.08)]}));
 assert.equal(m.detectMarginHits(pages,options).length,6);
 assert.equal(m.detectMarginHits(pages,{...options,pageNumbers:false}).length,3);
 assert.equal(m.detectMarginHits([pages[0]],options).length,0);
 assert.equal(m.detectMarginHits([{...pages[0],targets:[...pages[0].targets,target('example.test/article',.6,.04)]}],options).length,0);
 assert(!m.detectMarginHits(pages,options).some(h=>h.text.includes('Body')));
 const numbered=(values)=>values.map((text,page)=>({page,width:600,height:800,targets:[target(text,.4,.94)]}));
 assert.equal(m.detectMarginHits(numbered(['I','II','III']),options).length,3);
 assert.equal(m.detectMarginHits(numbered(['I','II','III']),{...options,pageNumbers:false}).length,0);
 assert.equal(m.detectMarginHits(numbered(['MIX','CIVIC','2026']),options).length,0);
 assert.throws(()=>m.marginZone({x:0,y:.4,w:1,h:.1}),/Seitenviertel/);
 assert.throws(()=>m.marginZone({x:-1,y:0,w:1,h:.1}),/außerhalb/);
 assert.throws(()=>m.detectMarginHits(pages,{...options,top:NaN}),/Suchränder/);
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(let i=0;i<4;i++) {
  const p=doc.addPage([600,800]);p.drawText('example.test/article',{x:45,y:760,font,size:12});p.drawText(`Seite ${i+1} von 4`,{x:245,y:25,font,size:10});p.drawText(`KEEP BODY ${i+1} - 1234 Euro`,{x:45,y:420,font,size:15});p.drawRectangle({x:45,y:280,width:100,height:70,color:rgb(.2,.8,.4)});
 }
 const field=doc.getForm().createTextField('Body field');field.addToPage(doc.getPage(0),{x:300,y:300,width:130,height:22});field.setText('Keep value');
 const link=doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[45,180,180,200],A:{S:'URI',URI:PDFString.of('https://example.test/body')}});doc.getPage(0).node.set(PDFName.of('Annots'),doc.context.obj([...(doc.getPage(0).node.Annots()?.asArray()||[]),doc.context.register(link)]));
 const input=await source(await doc.save()),original=input.bytes.slice(),found=await e.findMarginHits(input,options,ctx);assert.equal(found.hits.length,8);
 found.hits.find(h=>h.page===0&&h.zone==='header').selected=false;
 assert(toolDraftSchema.safeParse({'HeaderFooterPanel.hits:fixture':found.hits,'HeaderFooterPanel.settings:fixture':options}).success);
 await assert.rejects(()=>e.exportMarginCleanup(input,found.hits,false,ctx),/zuerst/);
 assert((await(await input.pdf.getPage(1)).getAnnotations()).some(a=>a.url==='https://example.test/body'));
 const result=await e.exportMarginCleanup(input,found.hits,true,ctx),out=await source(await result.blob.arrayBuffer(),'cleaned.pdf');assert.equal(out.pdf.numPages,4);
 for(let i=0;i<4;i++){const content=await text(out,i);assert.match(content,/KEEP BODY/);assert(!content.includes('Seite'));assert.equal(content.includes('example.test'),i===0);const before=await render(input,i),after=await render(out,i);assert.deepEqual([...before.getContext('2d').getImageData(60,480,1,1).data],[...after.getContext('2d').getImageData(60,480,1,1).data]);before.width=before.height=after.width=after.height=0;}
 assert.deepEqual(input.bytes,original);const saved=await PDFDocument.load(out.bytes);assert.equal(saved.getForm().getTextField('Body field').getText(),'Keep value');assert((await(await out.pdf.getPage(1)).getAnnotations()).some(a=>a.url==='https://example.test/body'));
 const overlap=[...found.hits,{id:'manual-overlap',page:0,zone:'header',rect:{x:0,y:0,w:1,h:.12},selected:true,manual:true,text:'',group:'manual'}];await assert.rejects(()=>e.exportMarginCleanup(input,overlap,true,ctx),/ausgeschlossene/);
 const partial={...found.hits.find(h=>h.page===1&&h.zone==='header'),rect:{x:.09,y:.02,w:.04,h:.08}};await assert.rejects(()=>e.exportMarginCleanup(input,[partial],true,ctx),/Textzeile/);
 const protectedDoc=await PDFDocument.load(input.bytes);protectedDoc.catalog.set(PDFName.of('Perms'),protectedDoc.context.obj({DocMDP:protectedDoc.context.obj({Type:'Sig'})}));const signed=await source(await protectedDoc.save(),'signed.pdf');await assert.rejects(()=>e.findMarginHits(signed,options,ctx),/Signatur/);
 await assert.rejects(()=>e.exportMarginCleanup(input,found.hits,true,{...ctx,signal:AbortSignal.abort()}),/Abgebrochen|abort/i);
 // Actual visual positions on rotated pages with offset CropBoxes.
 const rotDoc=await PDFDocument.create(),rotFont=await rotDoc.embedFont(StandardFonts.Helvetica);
 for(const angle of [0,90,180,270]){const p=rotDoc.addPage([450,600]);p.setCropBox(20,30,400,500);p.setRotation(degrees(angle));}
 const seed=await source(await rotDoc.save(),'geometry.pdf');
 for(let i=0;i<4;i++) {const v=(await seed.pdf.getPage(i+1)).getViewport({scale:1}),[a,b,c,d,tx,ty]=v.transform,det=a*d-b*c;const point=(x,y)=>{const px=x*v.width-tx,py=y*v.height-ty;return{x:(d*px-c*py)/det,y:(-b*px+a*py)/det};};const p=rotDoc.getPage(i);p.drawText('Repeated header',{...point(.12,.07),font:rotFont,size:11,rotate:degrees(i*90)});p.drawText('Keep rotated body',{...point(.12,.5),font:rotFont,size:12,rotate:degrees(i*90)});}
 const rotated=await source(await rotDoc.save(),'rotated.pdf'),rotHits=await e.findMarginHits(rotated,options,ctx);assert.equal(rotHits.hits.length,4);const cleanRot=await source(await(await e.exportMarginCleanup(rotated,rotHits.hits,true,ctx)).blob.arrayBuffer(),'rot-clean.pdf');for(let i=0;i<4;i++){assert(!(await text(cleanRot,i)).includes('header'));assert((await text(cleanRot,i)).includes('Keep rotated body'));assert.equal((await cleanRot.pdf.getPage(i+1)).rotate,i*90);}
 // Image-only scans are cleaned by explicit areas; body pixels remain identical.
 const scan=await PDFDocument.create(),canvas=createCanvas(400,600),c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,400,600);c.fillStyle='#0000ff';c.fillRect(30,20,150,30);c.fillStyle='#ff0000';c.fillRect(30,240,150,80);const image=await scan.embedPng(canvas.toBuffer('image/png'));scan.addPage([400,600]).drawImage(image,{x:0,y:0,width:400,height:600});const scanSource=await source(await scan.save(),'scan.pdf');assert.equal((await e.findMarginHits(scanSource,options,ctx)).hits.length,0);
 const manual={id:'scan-area',page:0,zone:'header',rect:{x:.05,y:.02,w:.45,h:.08},selected:true,manual:true,text:'',group:'scan'};const scanOut=await source(await(await e.exportMarginCleanup(scanSource,[manual],true,ctx)).blob.arrayBuffer(),'scan-out.pdf'),pixels=await render(scanOut);assert.deepEqual([...pixels.getContext('2d').getImageData(60,30,1,1).data],[255,255,255,255]);assert.deepEqual([...pixels.getContext('2d').getImageData(60,270,1,1).data],[255,0,0,255]);
 const annotationDoc=await PDFDocument.load(input.bytes);annotationDoc.getPage(1).node.set(PDFName.of('Annots'),annotationDoc.context.obj([annotationDoc.context.register(annotationDoc.context.obj({Type:'Annot',Subtype:'Link',Rect:[40,745,180,780],A:{S:'URI',URI:PDFString.of('https://example.test/header')}}))]));const linked=await source(await annotationDoc.save(),'linked.pdf');await assert.rejects(()=>e.exportMarginCleanup(linked,found.hits,true,ctx),/Link/);
 const fullLink={id:'full-link',page:1,zone:'header',rect:{x:.03,y:.01,w:.8,h:.1},selected:true,manual:true,text:'',group:'link'};const unlinked=await source(await(await e.exportMarginCleanup(linked,[fullLink],true,ctx)).blob.arrayBuffer(),'unlinked.pdf');assert.equal((await(await unlinked.pdf.getPage(2)).getAnnotations()).filter(a=>a.subtype==='Link').length,0);assert(!(await text(unlinked,1)).includes('example.test'));assert((await(await unlinked.pdf.getPage(1)).getAnnotations()).some(a=>a.url==='https://example.test/body'));
 await writeFile(directory+'/fictional-headers.pdf',input.bytes);await writeFile(directory+'/cleaned.pdf',out.bytes);await writeFile(directory+'/fictional-scan.pdf',scanSource.bytes);await writeFile(directory+'/scan-cleaned.pdf',scanOut.bytes);
 console.log('PASS: repeated headers, varying page numbers, exclusions, real text/pixel removal, remaining text/forms/links, rotated CropBoxes, scans, ambiguous-area rejection, signatures, cancellation and project drafts.');
}finally{globalThis.fetch=realFetch;for(const p of proxies)await p.loadingTask.destroy();}
