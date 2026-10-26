// Fictional documents only. Real PDF.js rendering and pdf-lib form round trips.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import ts from 'typescript';
import {PDFDocument,StandardFonts,PDFName,rgb,degrees} from 'pdf-lib';
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pdfRequire('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement:()=>createCanvas(1,1)}});
const directory='.cache/everyday';await mkdir(directory,{recursive:true});
for(const file of (await readdir('lib')).filter(f=>f.endsWith('.ts')&&!f.endsWith('.d.ts'))){
 const code=ts.transpileModule(await readFile('lib/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z0-9-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);
 await writeFile(directory+'/'+file.replace(/\.ts$/,'.mjs'),code);
}
const m=await import('../.cache/everyday/everyday-model.mjs'), e=await import('../.cache/everyday/everyday-engine.mjs');
const {newFormField,readDocumentDraft}=await import('../.cache/everyday/document-tools.mjs');
const {toolDraftSchema}=await import('../.cache/everyday/tool-draft-schema.mjs');
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
const proxies=[],ctx={signal:new AbortController().signal,report:()=>{}};
const fontBytes=await readFile('public/vendor/invoice-font/NotoSans-Regular.ttf');
const realFetch=globalThis.fetch;
globalThis.fetch=async(url)=>{assert.equal(url,'/vendor/invoice-font/NotoSans-Regular.ttf');return new Response(fontBytes);};
async function source(bytes,name){const data=new Uint8Array(bytes),pdf=await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;proxies.push(pdf);return{id:name,name,bytes:data,pdf,size:data.length,kind:'pdf'};}
async function text(s,page=0){return(await(await s.pdf.getPage(page+1)).getTextContent()).items.map(i=>i.str||'').join(' ');}
async function render(s,page=0){const proxy=await s.pdf.getPage(page+1),viewport=proxy.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await proxy.render({canvas,viewport}).promise;return canvas;}
try{
 const profile=m.emptyProfile();profile.id='person';profile.name='Fiktives Testprofil';profile.entries[0].value='Jörg';profile.entries[1].value='Müller';
 assert.deepEqual(m.decodeProfiles(JSON.stringify(m.storeProfile([],profile))),[profile]);
 assert.throws(()=>m.decodeProfiles('[{"id":"x"}]'));
 assert.throws(()=>m.decodeProfiles(JSON.stringify([profile,profile])));
 const base={id:'x',name:'first_name',kind:'text',value:'',readOnly:false};
 assert.equal(m.suggestProfileEntry(base,profile.entries).value,'Jörg');
 assert.equal(m.suggestProfileEntry({...base,name:'Vorname des Kindes'},profile.entries),undefined,'No guesses about another person');
 assert.equal(m.suggestProfileEntry({...base,name:'Name'},profile.entries),undefined,'Generic name stays ambiguous');
 assert.equal(m.suggestProfileEntry({...base,value:'Existing'},profile.entries),undefined,'Existing values are kept');
 assert.equal(m.suggestProfileEntry(base,[...profile.entries,{id:'duplicate',label:'Vorname',value:'Other'}]),undefined);
 assert.equal(m.suggestProfileEntry({...base,readOnly:true},profile.entries),undefined);
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(const angle of [0,90,180,270]){const page=doc.addPage([595,842]);page.setCropBox(20,20,555,802);page.setRotation(degrees(angle));page.drawRectangle({x:20,y:20,width:555,height:802,color:rgb(.86,.96,.91)});page.drawText('Fictional form - keep original',{x:45,y:770,font,size:12});}
 const form=doc.getForm();for(const [name,value] of [['Vorname',''],['Nachname','Original']]){const f=form.createTextField(name);f.addToPage(doc.getPage(0),{x:60,y:name==='Vorname'?650:600,width:220,height:26,font});f.setText(value);}
 const locked=form.createTextField('Referenz');locked.addToPage(doc.getPage(0),{x:60,y:550,width:220,height:26,font});locked.setText('Do not change');locked.enableReadOnly();
 const original=await source(await doc.save(),'fictional-form.pdf'),draft=await e.readHelperForm(original,ctx);
 draft.fields=draft.fields.map(f=>{const hit=m.suggestProfileEntry(f,profile.entries);return hit?{...f,value:hit.value}:f;});
 for(let page=0;page<4;page++){const field=newFormField(draft.fields,'text',page,{x:.20,y:.5,w:.55,h:.05});field.value='Müller – Beispiel';draft.fields.push(field);}
 assert(toolDraftSchema.safeParse({'FormHelperPanel.draft:fictional':draft}).success,'Draft survives project save');
 await assert.rejects(()=>e.exportHelperForm(original,draft,false,false,ctx),/prüfen/);
 const result=await e.exportHelperForm(original,draft,true,false,ctx),reopened=await source(await result.blob.arrayBuffer(),'filled.pdf'),reopenedDoc=await PDFDocument.load(reopened.bytes);
 assert.equal(reopenedDoc.getForm().getTextField('Vorname').getText(),'Jörg');assert.equal(reopenedDoc.getForm().getTextField('Nachname').getText(),'Original');assert.equal(reopenedDoc.getForm().getTextField('Referenz').getText(),'Do not change');
 const restored=await readDocumentDraft(reopened);
 for(let page=0;page<4;page++){
   assert.match(await text(reopened,page),/Fictional form/);
   const field=restored.fields.find(f=>f.name===draft.fields[3+page].name);assert(Math.abs(field.widgets[0].rect.y-.5)<.001,'Rotation and nonzero CropBox retained');
   const canvas=await render(reopened,page);assert(canvas.width>0);canvas.width=canvas.height=0;
   const widget=reopenedDoc.getForm().getTextField(field.name).acroField.getWidgets()[0];assert(!widget.getAppearanceCharacteristics()?.getBackgroundColor(),'No white box over scan');
 }
 const flat=await e.exportHelperForm(original,draft,true,true,ctx),flatDoc=await PDFDocument.load(await flat.blob.arrayBuffer());assert.equal(flatDoc.getForm().getFields().length,0);
 const flatSource=await source(await flat.blob.arrayBuffer(),'flat.pdf');
 for(let page=0;page<4;page++)assert.match(await text(flatSource,page),/Müller/,'Flattened entries are real text');
 const tooLong=structuredClone(draft);tooLong.fields.at(-1).value='Long '.repeat(90);await assert.rejects(()=>e.exportHelperForm(original,tooLong,true,false,ctx),/passt/);
 const badGlyph=structuredClone(draft);badGlyph.fields.at(-1).value='😀';await assert.rejects(()=>e.exportHelperForm(original,badGlyph,true,false,ctx),/Zeichen/);
 const sig=await PDFDocument.load(original.bytes);sig.catalog.set(PDFName.of('Perms'),sig.context.obj({DocMDP: sig.context.obj({Type:'Sig'})}));const signed=await source(await sig.save(),'signed.pdf');await assert.rejects(()=>e.readHelperForm(signed,ctx),/Signatur/);
 const receipts=await PDFDocument.create();const p=receipts.addPage([400,800]);p.drawRectangle({x:0,y:0,width:200,height:800,color:rgb(1,0,0)});p.drawRectangle({x:200,y:0,width:200,height:800,color:rgb(0,0.7,0)});p.drawText('OUTSIDE CROP SECRET',{x:210,y:400,size:12});
 const input=await source(await receipts.save(),'receipt.pdf'),items=await e.receiptItems([input],ctx);items[0].rect={x:0,y:0,w:.5,h:1};items[0].label='Büro';items[0].widthMm=80;
 const options={margin:10,gap:5,numbers:true},layout=m.layoutReceipts(items,options);
 assert.equal(layout.placements.length,2,'Long receipt split instead of downscaled');assert.equal(layout.sheets,1,'Consecutive parts can share a sheet when space allows');
 assert(Math.abs(layout.placements.reduce((n,p)=>n+p.rect.h,0)-1)<1e-9,'Slices cover entire crop exactly once');
 for(const p of layout.placements){assert.equal(p.width,80);assert(p.y+p.height+p.captionHeight<=287.000001);}
 assert(toolDraftSchema.safeParse({'ReceiptsPanel.items:fictional':items,'ReceiptsPanel.options:fictional':options}).success);
 const output=await e.exportReceipts([input],items,options,ctx),a4=await source(await output.blob.arrayBuffer(),'receipts-a4.pdf');assert.equal(a4.pdf.numPages,layout.sheets);
 for(let i=0;i<a4.pdf.numPages;i++){
   const page=await a4.pdf.getPage(i+1),v=page.getViewport({scale:1});assert(Math.abs(v.width-595.276)<.01);assert(Math.abs(v.height-841.89)<.01);
   assert(!/SECRET/.test(await text(a4,i)));assert.match(await text(a4,i),/Büro/);
   const canvas=await render(a4,i),pixel=canvas.getContext('2d').getImageData(60,60,1,1).data;assert(pixel[0]>240&&pixel[1]<10&&pixel[2]<10,'Correct selected pixels printed');canvas.width=canvas.height=0;
 }
 const rotated={...items[0],rotation:90,pageWidth:800,pageHeight:400,rect:{x:0,y:0,w:1,h:.5},label:'',widthMm:120};
 const rotOut=await source(await(await e.exportReceipts([input],[rotated],options,ctx)).blob.arrayBuffer(),'rotated.pdf');assert.equal(rotOut.pdf.numPages,1);
 const rotCanvas=await render(rotOut),pixel=rotCanvas.getContext('2d').getImageData(60,60,1,1).data;assert(pixel[0]>240&&pixel[1]<10,'Rotated crop uses visual coordinates');rotCanvas.width=rotCanvas.height=0;
 const small=[0,1,2].map(i=>({...items[0],id:'item-'+i,rect:{x:0,y:0,w:.5,h:.2},label:''}));assert.equal(m.layoutReceipts(small,options).sheets,1,'Small receipts packed on a sheet');
 for(const corrupted of [{...items[0],widthMm:NaN},{...items[0],rect:{x:1,y:0,w:1,h:1}},{...items[0],rotation:45}])assert.throws(()=>m.layoutReceipts([corrupted],options));
 assert.throws(()=>m.layoutReceipts([{...items[0],widthMm:190}],{...options,margin:25}),/breiter/);
 await assert.rejects(()=>e.exportReceipts([input],items,options,{...ctx,signal:AbortSignal.abort()}),/abort|Abgebrochen/i);
 await writeFile(directory+'/fictional-form.pdf',original.bytes);await writeFile(directory+'/filled.pdf',reopened.bytes);await writeFile(directory+'/receipts-a4.pdf',a4.bytes);await writeFile(directory+'/receipt.pdf',input.bytes);
 console.log('PASS: profiles, conservative mapping, protected values, Unicode, transparent scan fields, rotated CropBoxes, PDF round trips, long receipt slices, real cropped pixels, A4 packing, invalid inputs, drafts and cancellation.');
}finally{globalThis.fetch=realFetch;for(const p of proxies)await p.loadingTask.destroy();}
