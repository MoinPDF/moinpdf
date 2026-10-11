import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import ts from 'typescript';
import JSZip from 'jszip';
import {PDFDocument,PDFName,PDFDict,PDFString,StandardFonts,rgb,degrees} from 'pdf-lib';
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,loadImage,DOMMatrix,Path2D,ImageData}=pdfRequire('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement(name){assert.equal(name,'canvas');return createCanvas(1,1);}}});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('.cache',{recursive:true});
for(const name of ['image-codecs','pdf-engine','studio-engine','advanced-types','extra-options','extra-tools','pdf-report','editor-model','document-tools']){
 const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}-document-test.mjs${q}`);
 await writeFile(`.cache/${name}-document-test.mjs`,code);
}
const {readDocumentDraft,saveDocumentDraft,newFormField,writeBookmarks,moveBookmark,indentBookmark}=await import('../.cache/document-tools-document-test.mjs');
const {extractEmbeddedImages}=await import('../.cache/extra-tools-document-test.mjs');
const proxies=[];
async function source(bytes,name='Formular-Test.pdf'){const data=new Uint8Array(bytes),pdf=await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;proxies.push(pdf);return{id:name,name,bytes:data,pdf,size:data.length,kind:'pdf'};}
const execute=(s,d,t='fill-form',flatten=false)=>saveDocumentDraft(s,d,t,flatten,new AbortController().signal);
const items=s=>Array.from({length:s.pdf.numPages},(_,index)=>({id:s.id+index,sourceId:s.id,index,rotation:0,selected:true}));
const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);doc.setTitle('Formular Original');
for(const angle of [0,90,180,270]){const p=doc.addPage([595,842]);p.drawText('FORMULAR / TESTDOKUMENT',{x:45,y:780,size:20,font,color:rgb(.05,.42,.44)});p.drawText('Nur fiktive Angaben zur Funktionspruefung.',{x:45,y:750,size:11,font});p.setCropBox(20,20,555,802);p.setRotation(degrees(angle));}
const form=doc.getForm(),page=doc.getPage(0),name=form.createTextField('Name');name.setText('Erika Beispiel');name.addToPage(page,{x:60,y:650,width:280,height:28,font});
page.drawText('Name',{x:60,y:690,size:12,font});
const checkbox=form.createCheckBox('Bestaetigung');checkbox.addToPage(page,{x:60,y:585,width:18,height:18});page.drawText('Angaben geprueft',{x:90,y:590,size:12,font});
const dropdown=form.createDropdown('Bereich');dropdown.setOptions(['Privat','Betrieb']);dropdown.select('Privat');dropdown.addToPage(page,{x:60,y:520,width:200,height:25,font});
const radio=form.createRadioGroup('Kontakt');radio.addOptionToPage('E-Mail',page,{x:60,y:470,width:16,height:16});radio.addOptionToPage('Telefon',page,{x:60,y:440,width:16,height:16});radio.select('E-Mail');
const readonly=form.createTextField('Referenz');readonly.setText('Unveraendert');readonly.addToPage(page,{x:60,y:380,width:200,height:25,font});readonly.enableReadOnly();
const list=form.createOptionList('Unterlagen');list.setOptions(['Rechnung','Beleg','Vertrag']);list.enableMultiselect();list.select(['Beleg']);list.addToPage(page,{x:60,y:270,width:200,height:90,font});
const canvas=createCanvas(12,8),ctx=canvas.getContext('2d');ctx.fillStyle='#64bfc3';ctx.fillRect(0,0,6,8);ctx.fillStyle='#9dd345';ctx.fillRect(6,0,6,8);ctx.clearRect(9,5,3,3);
const png=await doc.embedPng(canvas.toBuffer('image/png'));page.drawImage(png,{x:400,y:600,width:72,height:48});page.drawImage(png,{x:400,y:500,width:36,height:24});doc.getPage(1).drawImage(png,{x:60,y:60,width:72,height:48});
writeBookmarks(doc,[{id:'a',title:'Formular',page:0,depth:0,open:true,targetChanged:true},{id:'b',title:'Gedrehte Seite',page:1,depth:1,open:true,targetChanged:true},{id:'c',title:'Anhang',page:2,depth:0,open:true,targetChanged:true}]);
const original=await source(await doc.save());await writeFile('.cache/PDF-Formular-Test.pdf',original.bytes);
try{
 const draft=await readDocumentDraft(original);assert.equal(draft.fields.length,6);assert.equal(draft.bookmarks.length,3);assert.equal(draft.fields.find(f=>f.name==='Kontakt').widgets.length,2);assert.equal(draft.fields.find(f=>f.name==='Referenz').readOnly,true);
 const filled=structuredClone(draft);for(const f of filled.fields){if(f.name==='Name')f.value='Jörg Müller';if(f.name==='Bestaetigung')f.value=true;if(f.name==='Bereich')f.value='Betrieb';if(f.name==='Kontakt')f.value='Telefon';if(f.name==='Unterlagen')f.value=['Beleg','Vertrag'];if(f.name==='Referenz')f.value='DARF NICHT GEÄNDERT WERDEN';}
 const result=await execute(original,filled),resultDoc=await PDFDocument.load(await result.blob.arrayBuffer()),outForm=resultDoc.getForm();assert.equal(resultDoc.getPageCount(),4);assert.equal(resultDoc.getTitle(),'Formular Original');assert.equal(outForm.getTextField('Name').getText(),'Jörg Müller');assert.equal(outForm.getTextField('Referenz').getText(),'Unveraendert');assert(outForm.getCheckBox('Bestaetigung').isChecked());assert.deepEqual(outForm.getDropdown('Bereich').getSelected(),['Betrieb']);assert.equal(outForm.getRadioGroup('Kontakt').getSelected(),'Telefon');assert.deepEqual(outForm.getOptionList('Unterlagen').getSelected(),['Beleg','Vertrag']);
 const filledSource=await source(await result.blob.arrayBuffer(),'Ausgefuellt.pdf');assert.equal((await filledSource.pdf.getOutline()).length,2);assert.equal((await filledSource.pdf.getOutline())[0].items.length,1);
 const created=structuredClone(draft);const expected={x:.25,y:.60,w:.5,h:.06};for(let i=0;i<4;i++){const field=newFormField(created.fields,'text',i,expected);field.name='Neu_'+i;field.value='Neue Eingabe '+i;field.required=true;created.fields.push(field);}
 const newCheck=newFormField(created.fields,'checkbox',0,{x:.7,y:.4,w:.04,h:.03});newCheck.value=true;created.fields.push(newCheck);
 const newDrop=newFormField(created.fields,'dropdown',0,{x:.6,y:.7,w:.3,h:.05});newDrop.options=['Ja','Nein'];newDrop.value='Ja';created.fields.push(newDrop);
 const createdResult=await execute(original,created,'create-form'),createdSource=await source(await createdResult.blob.arrayBuffer(),'Neue-Felder.pdf'),createdDraft=await readDocumentDraft(createdSource);assert.equal(createdDraft.fields.length,12);
 for(let i=0;i<4;i++){const f=createdDraft.fields.find(f=>f.name==='Neu_'+i);assert(f.required);const actual=f.widgets[0].rect;for(const key of Object.keys(expected))assert(Math.abs(actual[key]-expected[key])<.001,`rotation ${i*90}, ${key}: ${actual[key]} vs ${expected[key]}`);}
 const createdDoc=await PDFDocument.load(createdSource.bytes);assert.equal(createdDoc.getForm().getDropdown(newDrop.name).getSelected()[0],'Ja');assert(createdDoc.getForm().getCheckBox(newCheck.name).isChecked());
 await writeFile('.cache/PDF-Neue-Felder-Test.pdf',createdSource.bytes);
 const flat=await execute(original,filled,'fill-form',true),flatDoc=await PDFDocument.load(await flat.blob.arrayBuffer());assert.equal(flatDoc.getForm().getFields().length,0);assert(flatDoc.catalog.get(PDFName.of('Outlines')));const flatSource=await source(await flat.blob.arrayBuffer(),'Fixiert.pdf'),text=(await(await flatSource.pdf.getPage(1)).getTextContent()).items.filter(i=>'str'in i).map(i=>i.str).join(' ');assert.match(text,/Jörg Müller/);
 const deleted=structuredClone(draft);deleted.fields[0].deleted=true;assert.equal((await PDFDocument.load(await(await execute(original,deleted,'create-form')).blob.arrayBuffer())).getForm().getFields().length,5);
 const changed=structuredClone(draft);changed.bookmarks[0].title='Übersicht';changed.bookmarks[1].page=3;changed.bookmarks[1].targetChanged=true;changed.bookmarks[1].open=false;const bookResult=await execute(original,changed,'bookmarks'),bookSource=await source(await bookResult.blob.arrayBuffer(),'Kapitel.pdf'),outline=await bookSource.pdf.getOutline();assert.equal(outline[0].title,'Übersicht');assert.equal(await bookSource.pdf.getPageIndex(outline[0].items[0].dest[0]),3);assert.equal((await PDFDocument.load(bookSource.bytes)).getForm().getFields().length,6,'Bookmarks preserve interactive forms');
 const combined=structuredClone(created);combined.bookmarks[0].title='Gemeinsam gespeichert';const combinedResult=await execute(original,combined,'bookmarks'),combinedSource=await source(await combinedResult.blob.arrayBuffer(),'Kombiniert.pdf');assert.equal((await PDFDocument.load(combinedSource.bytes)).getForm().getFields().length,12);assert.equal((await combinedSource.pdf.getOutline())[0].title,'Gemeinsam gespeichert');
 const externalDoc=await PDFDocument.load(original.bytes),externalFirst=externalDoc.catalog.lookup(PDFName.of('Outlines'),PDFDict).lookup(PDFName.of('First'),PDFDict);externalFirst.delete(PDFName.of('Dest'));externalFirst.set(PDFName.of('A'),externalDoc.context.obj({S:'URI',URI:PDFString.of('https://example.org/')}));const externalSource=await source(await externalDoc.save(),'Extern.pdf'),externalDraft=await readDocumentDraft(externalSource);assert.equal(externalDraft.bookmarks[0].page,null);externalDraft.bookmarks[0].title='Externer Verweis';const externalSaved=await PDFDocument.load(await(await execute(externalSource,externalDraft,'bookmarks')).blob.arrayBuffer());assert.equal(externalSaved.catalog.lookup(PDFName.of('Outlines'),PDFDict).lookup(PDFName.of('First'),PDFDict).lookup(PDFName.of('A'),PDFDict).lookup(PDFName.of('URI'),PDFString).decodeText(),'https://example.org/');
 const cleared=await execute(original,{...draft,bookmarks:[]},'bookmarks');assert.equal(await(await source(await cleared.blob.arrayBuffer(),'Ohne-Kapitel.pdf')).pdf.getOutline(),null);
 const tree=[{id:'p',depth:0},{id:'c1',depth:1},{id:'c2',depth:1},{id:'p2',depth:0}];assert.deepEqual(indentBookmark(tree,1,-1).map(b=>[b.id,b.depth]),[['p',0],['c2',1],['c1',0],['p2',0]]);
 assert.deepEqual(moveBookmark(draft.bookmarks,2,0).map(b=>b.title),['Anhang','Formular','Gedrehte Seite']);assert.equal(indentBookmark(draft.bookmarks,2,1)[2].depth,1);
 const duplicate=structuredClone(created);duplicate.fields.at(-1).name='Name';await assert.rejects(()=>execute(original,duplicate,'create-form'),/doppelt/);
 await assert.rejects(()=>execute(original,{...draft,bookmarks:[{id:'bad',title:'Kaputt',page:77,depth:0,open:true,targetChanged:true}]},'bookmarks'),/Zielseite/);
 await assert.rejects(()=>saveDocumentDraft(original,draft,'fill-form',false,AbortSignal.abort()),/Abgebrochen/);
 const inlineDoc=await PDFDocument.create(),inlinePage=inlineDoc.addPage([400,400]);let inlineOps='';for(let i=0;i<12;i++)inlineOps+=`q 10 0 0 10 ${i*12} 100 cm BI /W 2 /H 2 /CS /RGB /BPC 8 /F /AHx ID FF000000FF000000FFFFFFFF> EI Q\n`;inlinePage.node.set(PDFName.of('Contents'),inlineDoc.context.register(inlineDoc.context.flateStream(inlineOps)));const inlineSource=await source(await inlineDoc.save(),'Inline.pdf');const inlineZip=await JSZip.loadAsync(await(await extractEmbeddedImages([inlineSource],items(inlineSource),()=>{},new AbortController().signal)).blob.arrayBuffer());assert.equal(Object.values(inlineZip.files).filter(f=>!f.dir).length,12,'Inline images are also exported');
 const pictures=await extractEmbeddedImages([original],items(original).slice(0,2),()=>{},new AbortController().signal),zip=await JSZip.loadAsync(await pictures.blob.arrayBuffer()),entries=Object.values(zip.files).filter(f=>!f.dir);assert.equal(entries.length,2,'Repeated same image on a page is exported once');
 const first=await loadImage(await entries[0].async('nodebuffer'));assert.equal(first.width,12);assert.equal(first.height,8);const decoded=createCanvas(12,8);decoded.getContext('2d').drawImage(first,0,0);assert.deepEqual([...decoded.getContext('2d').getImageData(0,0,1,1).data],[100,191,195,255]);assert.equal(decoded.getContext('2d').getImageData(11,7,1,1).data[3],0,'Image transparency retained');
 await assert.rejects(()=>extractEmbeddedImages([original],[items(original)[2]],()=>{},new AbortController().signal),/Keine eigenständigen/);
 await assert.rejects(()=>extractEmbeddedImages([original],items(original),()=>{},AbortSignal.abort()),/Abgebrochen/);
 console.log('PASS: existing text/checkbox/dropdown/radio/multiselect values; readonly preservation; interactive field creation at 0/90/180/270 degrees with crop boxes; required fields; field deletion; flattening and visible text; original pages/metadata/bookmarks retained; nested bookmarks and target edits; bookmark removal/reordering; invalid names/targets; image extraction pixels, dimensions and deduplication; empty results and cancellation.');
}finally{for(const p of proxies)await p.loadingTask.destroy();}
