import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts,PDFName,PDFString,PDFRawStream,decodePDFRawStream,rgb,degrees} from 'pdf-lib';
import {setup} from './optimization-test-setup.mjs';
const {source,ctx,close}=await setup('native-redaction');
const {redactPreservingContent}=await import('../.cache/native-redaction/native-redaction.mjs');
const {readTextTargets}=await import('../.cache/native-redaction/editor-model.mjs');
const secret='FICTIONAL SECRET 880055';
const text=async(s,i=0)=>(await(await s.pdf.getPage(i+1)).getTextContent()).items.map(t=>t.str||'').join(' ');
try{
 const d=await PDFDocument.create(),f=await d.embedFont(StandardFonts.Helvetica);
 for(const angle of [0,90,180,270]){const p=d.addPage([600,800]);p.setCropBox(10,20,570,750);p.setRotation(degrees(angle));p.drawText(secret,{x:50,y:700,size:14,font:f});p.drawText('KEEP searchable text',{x:50,y:430,size:16,font:f});p.drawRectangle({x:50,y:300,width:70,height:50,color:rgb(.1,.7,.3)});p.node.set(PDFName.of('Annots'),d.context.obj([d.context.register(d.context.obj({Type:'Annot',Subtype:'Link',Rect:[50,200,180,220],A:{S:'URI',URI:PDFString.of('https://example.test/keep')}}))]));}
 d.setTitle(secret);const input=await source(await d.save()),original=input.bytes.slice(),regions=[];
 for(let i=0;i<4;i++){const t=(await readTextTargets(input,{index:i,rotation:0})).targets.find(t=>t.text.includes('SECRET'));regions.push({page:i,rect:{x:t.x-.015,y:t.y-.015,w:t.w+.03,h:t.h+.03}});}
 const result=await redactPreservingContent(input,regions,ctx),out=await source(await result.blob.arrayBuffer(),'redacted.pdf');
 assert.equal(out.pdf.numPages,4);for(let i=0;i<4;i++){assert(!(await text(out,i)).includes('SECRET'));assert((await text(out,i)).includes('KEEP searchable'));assert.equal((await out.pdf.getPage(i+1)).rotate,i*90);assert.equal((await(await out.pdf.getPage(i+1)).getAnnotations())[0].url,'https://example.test/keep');}
 assert.equal((await PDFDocument.load(out.bytes)).getTitle(),undefined);assert.deepEqual(input.bytes,original);
 const parsed=await PDFDocument.load(out.bytes);
 for(const [,object] of parsed.context.enumerateIndirectObjects())if(object instanceof PDFRawStream){const decoded=Buffer.from(decodePDFRawStream(object).decode()).toString('latin1');assert(!decoded.includes(secret));assert(!decoded.toUpperCase().includes(Buffer.from(secret).toString('hex').toUpperCase()));}
 const linkedDoc=await PDFDocument.load(input.bytes),annots=linkedDoc.getPage(0).node.Annots();annots.push(linkedDoc.context.register(linkedDoc.context.obj({Type:'Annot',Subtype:'Link',Rect:[55,701,150,705],A:{S:'URI',URI:PDFString.of('https://example.test/SECRET')}})));
 const linked=await source(await linkedDoc.save(),'inside-link.pdf');const unlinked=await source(await(await redactPreservingContent(linked,regions,ctx)).blob.arrayBuffer(),'unlinked.pdf');assert.equal((await(await unlinked.pdf.getPage(1)).getAnnotations()).length,1);

 await writeFile('.cache/native-redaction/fictional.pdf',input.bytes);await writeFile('.cache/native-redaction/redacted.pdf',out.bytes);
 const partial={page:0,rect:{...regions[0].rect,w:.03}};await assert.rejects(()=>redactPreservingContent(input,[partial],ctx),/Textzeile|geeignet/);
 for(const kind of ['form','marked','signed','image']){
  const doc=await PDFDocument.load(input.bytes);
  if(kind==='form')doc.getForm().createTextField('private').addToPage(doc.getPage(0),{x:300,y:100,width:100,height:20});
  if(kind==='marked')doc.catalog.set(PDFName.of('StructTreeRoot'),doc.context.obj({Type:'StructTreeRoot'}));
  if(kind==='signed')doc.catalog.set(PDFName.of('Perms'),doc.context.obj({DocMDP:doc.context.obj({Type:'Sig'})}));
  if(kind==='image')doc.getPage(0).drawRectangle({x:30,y:680,width:300,height:55,color:rgb(1,0,0),opacity:.2});
  const bad=await source(await doc.save(),kind+'.pdf');await assert.rejects(()=>redactPreservingContent(bad,regions,ctx));
 }
 await assert.rejects(()=>redactPreservingContent(input,regions,{...ctx,signal:AbortSignal.abort()}));
 console.log('PASS: native redaction removes whole confidential text objects; remaining searchable text, vector pixels, URI links, rotated CropBoxes, metadata cleanup, unsafe structures, partial text and cancellation.');
}finally{await close();}
