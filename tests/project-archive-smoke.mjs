import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import 'fake-indexeddb/auto';
await mkdir('.cache', {recursive:true});
for (const name of ['project-archive','project-bundle','content-digest','local-projects','ocr-languages','editor-font-catalog']) {
  const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}-archive-test.mjs${q}`);
  await writeFile(`.cache/${name}-archive-test.mjs`,code);
}
const {encodeProjectFile,decodeProjectFile,validateOpenedProject,MAX_PROJECT_FILE}=await import('../.cache/project-archive-archive-test.mjs');
const projects=await import('../.cache/local-projects-archive-test.mjs');
const {editorFontCatalog}=await import('../.cache/editor-font-catalog-archive-test.mjs');
const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
doc.addPage([400,500]).drawText('Original bleibt erhalten',{x:20,y:420,size:18,font});
doc.addPage([400,500]).drawText('Zweite Seite',{x:20,y:420,size:18,font});
const bytes=await doc.save(),source={id:'original',name:'Rechnung.xml',bytes,size:bytes.length,kind:'invoice',wasEncrypted:true,invoiceOriginal:{name:'Rechnung.xml',bytes:new TextEncoder().encode('<Invoice>123</Invoice>')},pdf:{numPages:2}};
source.originalDigest=createHash('sha256').update(source.invoiceOriginal.bytes).digest('hex');
const pages=[{id:'one',sourceId:'original',index:1,rotation:90,selected:true},{id:'two',sourceId:'original',index:0,rotation:0,selected:false}];
const rect={x:.1,y:.1,w:.3,h:.1};
const edits={marks:{one:[{id:'redact',kind:'redact',...rect},{id:'text',kind:'text',text:'Geändert',textRotation:90,...rect,fontScale:.03,fontFamily:'sans',fontChoice:'auto',originalFontId:'original:LiberationSans:abc',originalFontName:'LiberationSans',originalFontPage:1,originalState:'{original}',sourceRect:rect,sourceRects:[rect],baselineScale:.98,insetScale:.08,lineHeight:1.2,tracking:.04,textScaleX:1.1,bold:true,color:'#000000'}]},crops:{two:{x:.1,y:.2,w:.8,h:.7}}};
edits.marks.two=editorFontCatalog.map(font=>({id:font.id,kind:'text',...rect,text:'ÄÖÜ ß €',fontChoice:font.id,fontFamily:font.family}));
const draft={fields:[{id:'field',name:'Name',kind:'text',value:'Denny',initialValue:'',options:[],widgets:[{page:1,rect}],existing:true,required:true,readOnly:false,multiline:false,fontSize:12}],bookmarks:[{id:'bookmark',title:'Kapitel',page:1,depth:0,open:true}],signed:false,xfa:false,originalBookmarkCount:0,originalBookmarks:'[]'};
const state={pages,edits,options:{editorLanguage:'deu+eng',language:'deu+fra+spa',ocrLayout:'6',compareMode:'content'},history:[{pages:[...pages].reverse(),edits:{marks:{},crops:{}}}],future:[],documentSessions:{original:{current:draft,past:[],future:[]}},activeId:'one',toolId:'edit-text'};
const archive=await encodeProjectFile('Übertragbares Projekt',[source],state);
await writeFile('.cache/project-transfer.moinpdf',new Uint8Array(await archive.arrayBuffer()));
const decoded=await decodeProjectFile(archive);
assert.equal(decoded.name,'Übertragbares Projekt');
assert.deepEqual(decoded.state,state);
assert.deepEqual(decoded.sources[0].bytes,bytes);
assert.deepEqual(decoded.sources[0].invoiceOriginal,source.invoiceOriginal);
assert.equal(decoded.sources[0].wasEncrypted,true);
assert.equal(decoded.sources[0].originalDigest,source.originalDigest,'Original upload checksum survives project transfer');
assert.equal((await PDFDocument.load(decoded.sources[0].bytes)).getPageCount(),2);
validateOpenedProject(decoded.state,[{...decoded.sources[0],pdf:{numPages:2}}]);
const existing=await projects.saveProject('Vorhandenes Projekt',undefined,[source],state);
await projects.saveProject(decoded.name,undefined,decoded.sources.map(s=>({...s,pdf:{numPages:2}})),decoded.state);
assert.equal((await projects.listProjects()).length,2,'Transfer creates a distinct project, even for the same source IDs');
const saved=await projects.loadProject((await projects.listProjects()).find(p=>p.id===existing).versions[0].id);
assert.deepEqual(saved.version.state,state);
assert.equal(saved.sources[0].originalDigest,source.originalDigest,'Original upload checksum survives local project storage');
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

const {contentDigest}=await import('../.cache/content-digest-archive-test.mjs');
const vectors=[new Uint8Array(),new TextEncoder().encode('abc'),...Array.from({length:10},(_,i)=>new Uint8Array(54+i).map((_,n)=>n)),new Uint8Array(1024*1024+17).fill(97)];
for(const vector of vectors) assert.equal(await contentDigest(vector),createHash('sha256').update(vector).digest('hex'));
const cryptoDescriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
try {
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});
 for(const vector of vectors) assert.equal(await contentDigest(vector),createHash('sha256').update(vector).digest('hex'),'HTTP SHA256 fallback matches independent Node reference');
 await assert.rejects(()=>contentDigest(bytes,AbortSignal.abort()),/Abgebrochen/);
} finally {Object.defineProperty(globalThis,'crypto',cryptoDescriptor);}
const bundles=await import('../.cache/project-bundle-archive-test.mjs');
const oldVersion=(await projects.listProjects()).find(p=>p.id===existing).versions[0].id;
const changedDoc=await PDFDocument.load(bytes);changedDoc.getPage(0).drawText('NEUER ARBEITSSTAND',{x:20,y:100,size:12});
const changedBytes=await changedDoc.save(),changedSource={...source,bytes:changedBytes,size:changedBytes.length};
await projects.saveProject('Vorhandenes Projekt',existing,[changedSource],state);
assert.deepEqual((await projects.loadProject(oldVersion)).sources[0].bytes,bytes,'Saving same source ID with changed data must not corrupt a historical version');
for(let i=0;i<5;i++) await projects.saveProject('Vorhandenes Projekt',existing,[i%2?source:changedSource],{...state,toolId:'archive-'+i});
const whole=await projects.loadProjectArchive(existing);
assert.equal(whole.versions.length,5);
assert.equal(whole.versions[0].state.toolId,'archive-4');
await assert.rejects(()=>projects.loadProject(oldVersion),/nicht gefunden/);
const allFile=await bundles.encodeProjectArchive(whole);
assert.equal(await bundles.isProjectArchive(allFile),true);
assert.equal(await bundles.isProjectArchive(archive),false);
const allBytes=new Uint8Array(await allFile.arrayBuffer()),allView=new DataView(allBytes.buffer),jsonLength=allView.getUint32(20);
const manifest=JSON.parse(new TextDecoder().decode(allBytes.subarray(64,64+jsonLength)));
assert.equal(manifest.parts.length,3,'Binary pool deduplicates identical PDFs/XML across five versions');
const roundtrip=await bundles.decodeProjectArchive(allFile);
for(let i=0;i<5;i++){
 assert.deepEqual(roundtrip.versions[i].state,whole.versions[i].state);
 assert.deepEqual(roundtrip.versions[i].sources[0].bytes,whole.versions[i].sources[0].bytes);
 assert.equal((await PDFDocument.load(roundtrip.versions[i].sources[0].bytes)).getPageCount(),2);
}
const importedId=await projects.importProjectArchive(roundtrip);
assert.notEqual(importedId,existing);
assert.deepEqual((await projects.loadProjectArchive(importedId)).versions.map(v=>v.state),whole.versions.map(v=>v.state));
assert.deepEqual((await projects.loadProjectArchive(importedId)).versions.map(v=>v.created),whole.versions.map(v=>v.created));
const brokenAll=allBytes.slice();brokenAll[brokenAll.length-1]^=1;
await assert.rejects(()=>bundles.decodeProjectArchive(new Blob([brokenAll])),/beschädigt/);
await assert.rejects(()=>bundles.decodeProjectArchive(allFile.slice(0,-1)),/beschädigt/);
await assert.rejects(()=>bundles.decodeProjectArchive({size:bundles.MAX_PROJECT_ARCHIVE+1}),/größer/);
await assert.rejects(()=>bundles.encodeProjectArchive({...whole,versions:[...whole.versions,whole.versions[0]]}),/ungültige/);
await assert.rejects(()=>bundles.decodeProjectArchive(allFile,AbortSignal.abort()),/Abgebrochen/);
async function editBundle(change){
 const m=JSON.parse(JSON.stringify(manifest));change(m);
 const json=new TextEncoder().encode(JSON.stringify(m)),payload=allBytes.slice(64+jsonLength),out=new Uint8Array(64+json.length+payload.length),view=new DataView(out.buffer);
 out.set(allBytes.subarray(0,64));out.set(json,64);out.set(payload,64+json.length);
 view.setUint32(20,json.length);view.setUint32(24,out.length);out.set(createHash('sha256').update(json).digest(),32);
 return new Blob([out]);
}
await assert.rejects(()=>editBundle(m=>m.versions[4].sources[0].pdf='0'.repeat(64)).then(bundles.decodeProjectArchive),/fehlende Dokumentdaten/);
await assert.rejects(()=>editBundle(m=>m.versions[4].state.pages[0].sourceId='missing').then(bundles.decodeProjectArchive),/Seitenverweise/);
await assert.rejects(()=>editBundle(m=>m.parts.push(m.parts[0])).then(bundles.decodeProjectArchive),/doppelte/);
const beforeCount=(await projects.listProjects()).length;
await assert.rejects(()=>projects.importProjectArchive({...roundtrip,versions:[...roundtrip.versions,{...roundtrip.versions[0],sources:[]}]}),/Ungültiges/);
assert.equal((await projects.listProjects()).length,beforeCount,'Invalid import leaves all projects untouched');
console.log('PASS: immutable historical bytes, five complete snapshots, SHA256 checks including local HTTP fallback, deduplicated binary archive, preserved timestamps, independent PDF reopen, fresh project IDs, bounded and atomic validated import.');

// A deleted page may remain in undo history, but unrelated removed-file edits
// must never leak into the current snapshot or any exported history snapshot.
const orphan={id:'orphan',kind:'text',text:'REMOVED-FILE-PRIVATE-NOTE',...rect,fontScale:.03};
const dirtyEdits={marks:{...edits.marks,removed:[orphan]},crops:{...edits.crops,removed:rect}};
const emptyState={...state,pages:[],edits:dirtyEdits,activeId:'',
  history:[{pages,edits:dirtyEdits}],future:[{pages:[pages[0]],edits:dirtyEdits}]};
const cleanEmpty=projects.cleanProjectState(emptyState);
assert.deepEqual(cleanEmpty.edits,{marks:{},crops:{}});
assert.deepEqual(cleanEmpty.history[0].edits,edits,'Undo keeps edits for pages present in that historical snapshot');
assert.deepEqual(cleanEmpty.future[0].edits,{marks:{one:edits.marks.one},crops:{}});
assert.equal(emptyState.edits.marks.removed[0].text,orphan.text,'Cleanup does not mutate the active undo state');
const emptyId=await projects.saveProject('Leere Seitenliste',undefined,[source],emptyState);
const emptyRecord=(await projects.listProjects()).find(p=>p.id===emptyId);
assert.equal(emptyRecord.versions[0].pages,0);
assert.deepEqual((await projects.loadProject(emptyRecord.versions[0].id)).version.state,cleanEmpty);
const emptyFile=await encodeProjectFile('Leere Seitenliste',[source],emptyState);
assert.deepEqual((await decodeProjectFile(emptyFile)).state,cleanEmpty);
const emptyBundle={name:'Leere Seitenliste',updated:Date.now(),versions:[{created:Date.now(),state:emptyState,sources:[source]}]};
assert.deepEqual((await bundles.decodeProjectArchive(await bundles.encodeProjectArchive(emptyBundle))).versions[0].state,cleanEmpty);
const emptyImportId=await projects.importProjectArchive(emptyBundle);
assert.deepEqual((await projects.loadProjectArchive(emptyImportId)).versions[0].state,cleanEmpty);
// Heal older, correctly checksummed files on import as well as on new exports.
assert.deepEqual((await decodeProjectFile(await edited(m=>m.state=emptyState))).state,cleanEmpty);
assert.deepEqual((await bundles.decodeProjectArchive(await editBundle(m=>m.versions[0].state=emptyState))).versions[0].state,cleanEmpty);
for(const file of [emptyFile,await bundles.encodeProjectArchive(emptyBundle)]) {
  assert.ok(!(await file.text()).includes(orphan.text),'Removed-file content is absent from exported bytes');
}
console.log('PASS: zero-page projects save and transfer without blocking project switches; orphaned notes/crops are removed across current, undo, redo and legacy imports while valid undo edits survive.');

const revised={...source,id:'revised',name:'Ergebnis.pdf',kind:'pdf'};
const revisedPages=pages.map(p=>({...p,sourceId:'revised'}));
const adopted={...state,pages:revisedPages,sourceIds:['revised'],documentSessions:{},history:[{...state,sourceIds:['original'],documentSessions:state.documentSessions,pages:state.pages,edits:state.edits}]};
// Snapshots contain document identity and form state, not nested project history.
delete adopted.history[0].history;delete adopted.history[0].future;delete adopted.history[0].options;delete adopted.history[0].toolId;
const adoption=await decodeProjectFile(await encodeProjectFile('Ergebnis übernommen',[revised,source],adopted));
assert.deepEqual(adoption.state.sourceIds,['revised']);assert.deepEqual(adoption.state.history[0].sourceIds,['original']);
assert.equal(adoption.state.history[0].documentSessions.original.current.fields[0].value,'Denny');
validateOpenedProject(adoption.state,[revised,source]);
console.log('PASS: project export/import preserves undo across adopted documents and form drafts.');
