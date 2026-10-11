import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import 'fake-indexeddb/auto';
await mkdir('.cache', {recursive:true});
for (const name of ['project-archive','local-projects','ocr-languages']) {
  const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}-archive-test.mjs${q}`);
  await writeFile(`.cache/${name}-archive-test.mjs`,code);
}
const {encodeProjectFile,decodeProjectFile,validateOpenedProject,MAX_PROJECT_FILE}=await import('../.cache/project-archive-archive-test.mjs');
const projects=await import('../.cache/local-projects-archive-test.mjs');
const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
doc.addPage([400,500]).drawText('Original bleibt erhalten',{x:20,y:420,size:18,font});
doc.addPage([400,500]).drawText('Zweite Seite',{x:20,y:420,size:18,font});
const bytes=await doc.save(),source={id:'original',name:'Rechnung.xml',bytes,size:bytes.length,kind:'invoice',wasEncrypted:true,invoiceOriginal:{name:'Rechnung.xml',bytes:new TextEncoder().encode('<Invoice>123</Invoice>')},pdf:{numPages:2}};
const pages=[{id:'one',sourceId:'original',index:1,rotation:90,selected:true},{id:'two',sourceId:'original',index:0,rotation:0,selected:false}];
const rect={x:.1,y:.1,w:.3,h:.1};
const edits={marks:{one:[{id:'redact',kind:'redact',...rect},{id:'text',kind:'text',text:'Geändert',...rect,fontScale:.03,fontFamily:'sans',bold:true,color:'#000000'}]},crops:{two:{x:.1,y:.2,w:.8,h:.7}}};
const draft={fields:[{id:'field',name:'Name',kind:'text',value:'Denny',initialValue:'',options:[],widgets:[{page:1,rect}],existing:true,required:true,readOnly:false,multiline:false,fontSize:12}],bookmarks:[{id:'bookmark',title:'Kapitel',page:1,depth:0,open:true}],signed:false,xfa:false,originalBookmarkCount:0,originalBookmarks:'[]'};
const state={pages,edits,options:{language:'deu+fra+spa',ocrLayout:'6',compareMode:'content'},history:[{pages:[...pages].reverse(),edits:{marks:{},crops:{}}}],future:[],documentSessions:{original:{current:draft,past:[],future:[]}},activeId:'one',toolId:'edit-text'};
const archive=await encodeProjectFile('Übertragbares Projekt',[source],state);
await writeFile('.cache/project-transfer.moinpdf',new Uint8Array(await archive.arrayBuffer()));
const decoded=await decodeProjectFile(archive);
assert.equal(decoded.name,'Übertragbares Projekt');
assert.deepEqual(decoded.state,state);
assert.deepEqual(decoded.sources[0].bytes,bytes);
assert.deepEqual(decoded.sources[0].invoiceOriginal,source.invoiceOriginal);
assert.equal(decoded.sources[0].wasEncrypted,true);
assert.equal((await PDFDocument.load(decoded.sources[0].bytes)).getPageCount(),2);
validateOpenedProject(decoded.state,[{...decoded.sources[0],pdf:{numPages:2}}]);
const existing=await projects.saveProject('Vorhandenes Projekt',undefined,[source],state);
await projects.saveProject(decoded.name,undefined,decoded.sources.map(s=>({...s,pdf:{numPages:2}})),decoded.state);
assert.equal((await projects.listProjects()).length,2,'Transfer creates a distinct project, even for the same source IDs');
assert.deepEqual((await projects.loadProject((await projects.listProjects()).find(p=>p.id===existing).versions[0].id)).version.state,state);
const corrupt=new Uint8Array(await archive.arrayBuffer());corrupt[corrupt.length-1]^=1;
await assert.rejects(()=>decodeProjectFile(new Blob([corrupt])),/beschädigt/);
await assert.rejects(()=>decodeProjectFile(archive.slice(0,archive.size-1)),/beschädigt/);
await assert.rejects(()=>decodeProjectFile(new Blob(['ordinary PDF file'])),/beschädigt|keine MoinPDF/);
await assert.rejects(()=>decodeProjectFile({size:MAX_PROJECT_FILE+1}),/größer/);
const unsupported=new Uint8Array(await archive.arrayBuffer());new DataView(unsupported.buffer).setUint32(16,2);
await assert.rejects(()=>decodeProjectFile(new Blob([unsupported])),/Projektversion/);
// Produce valid checksums for invalid payloads: validation must not depend on
// trusting an accidental-corruption checksum or on archives written by us.
async function edited(change){
 const input=new Uint8Array(await archive.arrayBuffer()),iv=new DataView(input.buffer),oldLength=iv.getUint32(20);
 const manifest=JSON.parse(new TextDecoder().decode(input.subarray(32,32+oldLength)));change(manifest);
 const json=new TextEncoder().encode(JSON.stringify(manifest)),payload=input.subarray(32+oldLength);
 const output=new Uint8Array(32+json.length+payload.length),view=new DataView(output.buffer);output.set(input.subarray(0,32));output.set(json,32);output.set(payload,32+json.length);view.setUint32(20,json.length);view.setUint32(24,output.length);
 let crc=0xffffffff;for(const b of output.subarray(32)){crc^=b;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}view.setUint32(28,(crc^0xffffffff)>>>0);
 return new Blob([output]);
}
await assert.rejects(()=>edited(m=>m.state.history[0].pages[0].sourceId='missing').then(decodeProjectFile),/Seitenverweise/);
await assert.rejects(()=>edited(m=>m.sources.push(m.sources[0])).then(decodeProjectFile),/Dokumentdaten/);
await assert.rejects(()=>edited(m=>m.state.options.language='../remote').then(decodeProjectFile),/ungültige/);
await assert.rejects(()=>edited(m=>m.state.edits.marks.one[0].image='https://example.com/tracker.png').then(decodeProjectFile),/ungültige/);
await assert.rejects(()=>edited(m=>m.state.options.constructor={polluted:true}).then(decodeProjectFile),/Projektbeschreibung/);
await assert.rejects(()=>edited(m=>m.sources[0].pdf.length=1).then(decodeProjectFile),/keine PDF/);
const badIndex=await decodeProjectFile(await edited(m=>m.state.history[0].pages[0].index=3));
assert.throws(()=>validateOpenedProject(badIndex.state,[source]),/Seitenverweise/);
const badWidget=await decodeProjectFile(await edited(m=>m.state.documentSessions.original.current.fields[0].widgets[0].page=2));
assert.throws(()=>validateOpenedProject(badWidget.state,[source]),/Seitenzahlen/);
await assert.rejects(()=>decodeProjectFile(archive,AbortSignal.abort()),/Abgebrochen/);
await assert.rejects(()=>encodeProjectFile('Test',[source],state,AbortSignal.abort()),/Abgebrochen/);
console.log('PASS: portable project preserves PDF/XML bytes, edits, crop, page order/rotation, OCR settings, undo, forms and bookmarks; independent PDF reopen, separate imported project, CRC/truncation/version/size limits, malicious data and history/widget reference rejection, cancellation.');
