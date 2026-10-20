import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
const folder='.cache/editor-rich';await mkdir(folder,{recursive:true});
for(const name of ['local-font-bytes','pdf-text','ocr-languages','content-compare','image-codecs','pdf-engine','studio-engine','advanced-types','extra-options','extra-tools','pdf-report','pdf-signature-guard','editor-model','editor-rich-text','editor-rich-layout','editor-verification','editor-layout-plan','editor-ink-verification','editor-blocks','editor-document-search','editor-analysis','editor-text-layer','editor-fonts','editor-font-cmap','editor-font-catalog','editor-native','native-pdf-core','editor-project-codec','local-projects','project-archive']){
 const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);await writeFile(`${folder}/${name}.mjs`,code);
}
await writeFile(folder+'/native-pdf.mjs',`import {readFile} from 'node:fs/promises';import {createNativeEngine,removeNativeRegions} from './native-pdf-core.mjs';let api;export const removeRegions=async(bytes,removals)=>removeNativeRegions(await(api ||= readFile('public/vendor/pdfium/pdfium.wasm').then(b=>createNativeEngine(new Uint8Array(b)))),bytes,removals);`);
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pdfRequire('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement:()=>createCanvas(1,1)}});
globalThis.pdfjsWorker=await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
const originalFetch=globalThis.fetch;globalThis.fetch=async input=>typeof input==='string' && input.startsWith('/vendor/')?new Response(await readFile('public'+input)):originalFetch(input);
const rich=await import('../.cache/editor-rich/editor-rich-text.mjs');
const {drawEditorText}=await import('../.cache/editor-rich/editor-text-layer.mjs');
const {readTextTargets,editorParagraphs}=await import('../.cache/editor-rich/editor-model.mjs');
const {verifyEditorExport,compareEditorPixels}=await import('../.cache/editor-rich/editor-verification.mjs');
const {compareEditorInk}=await import('../.cache/editor-rich/editor-ink-verification.mjs');
const {importEditorFont,resolveEditorFont}=await import('../.cache/editor-rich/editor-fonts.mjs');
const {encodeProjectFile,decodeProjectFile}=await import('../.cache/editor-rich/project-archive.mjs');
const {stringifyEditorProject,editorProjectReviver}=await import('../.cache/editor-rich/editor-project-codec.mjs');
const {openSource}=await import('../.cache/editor-rich/pdf-engine.mjs');
const sources=[];const source=async(bytes,name='fixture.pdf')=>{const s=await openSource(new File([bytes],name,{type:'application/pdf'}));sources.push(s);return s;};
const pageOf=s=>({id:'p0',sourceId:s.id,index:0,rotation:0,selected:true});
try{
 // A thin edge may be gray in a vector rasterizer and coloured in a browser's
 // subpixel rasterizer. Compare coverage against neighbouring ink, while still
 // rejecting a real colour change in the solid glyph interior.
 const inkImage=()=>({width:12,height:12,data:new Uint8ClampedArray(12*12*4).fill(255)});
 const inkBase=inkImage(),inkReference=inkImage(),inkBrowser=inkImage(),inkWrong=inkImage();
 for(let y=2;y<10;y++)for(let x=4;x<8;x++){
  const i=(y*12+x)*4,edge=x===4||x===7;
  inkReference.data.set(edge?[150,150,150,255]:[0,0,0,255],i);
  inkBrowser.data.set(edge?[110,170,220,255]:[0,0,0,255],i);
  inkWrong.data.set(edge?[255,150,150,255]:[255,0,0,255],i);
 }
 const inkRect={x:0,y:0,w:1,h:1};
 const antialias=compareEditorInk(inkBase,inkReference,inkBrowser,inkRect);
 assert(antialias.missing<.12&&antialias.extra<.12,'Subpixel edge colours alone are not an export error');
 assert(compareEditorInk(inkBase,inkReference,inkWrong,inkRect).missing>.12,'A black-to-red change is still detected');
 const matchMark={id:'matches',kind:'text',text:'Äpfel ÄPFEL Apfelmus 🧾 Apfel a.b',fontScale:.03,color:'#000000',runs:[{start:0,end:5,style:{bold:true}},{start:6,end:11,style:{italic:true,color:'#006644'}}]};
 assert.deepEqual(rich.findEditorText(matchMark.text,'äpfel',false,true),[{start:0,end:5},{start:6,end:11}]);
 assert.equal(rich.findEditorText(matchMark.text,'Äpfel',true,true).length,1);
 assert.equal(rich.findEditorText(matchMark.text,'Apfel',false,true).length,1,'Whole-word search excludes Apfelmus');
 assert.equal(rich.findEditorText(matchMark.text,'a.b').length,1,'Search is literal, never a user-supplied regular expression');
 const searched={...matchMark,...rich.replaceEditorMatches(matchMark,rich.findEditorText(matchMark.text,'äpfel',false,true),'Birne')};
 assert.equal(searched.text,'Birne Birne Apfelmus 🧾 Apfel a.b');
 assert.equal(rich.editorSegments(searched)[0].style.bold,true);assert(rich.editorSegments(searched).find(r=>r.start===6).style.italic,'Each replacement inherits its own match style');
 const selectionState=rich.editorSelectionStyle(searched,{id:'matches',start:0,end:11});assert(selectionState.mixed.has('bold')&&selectionState.mixed.has('italic')&&selectionState.mixed.has('color'));
 assert.equal(rich.editorSelectionStyle(searched,{id:'matches',start:6,end:11}).style.color,'#006644');
 const removed=rich.replaceEditorMatches(searched,rich.findEditorText(searched.text,'Birne'),'');assert.equal(removed.text,'  Apfelmus 🧾 Apfel a.b');
 assert.throws(()=>rich.replaceEditorMatches(matchMark,[{start:0,end:5}], 'x'.repeat(20000)),/20.000/);
 assert.throws(()=>rich.replaceEditorMatches(matchMark,[{start:0,end:5},{start:2,end:6}],'bad'),/gültig/);
 const repeated={...matchMark,text:'x '.repeat(5000),runs:undefined};assert.equal(rich.replaceEditorMatches(repeated,rich.findEditorText(repeated.text,'x'),'y').text,'y '.repeat(5000),'Bulk replacement remains bounded and preserves spacing');
 let mark={id:'rich',kind:'text',x:.1,y:.1,w:.8,h:.3,text:'Netto 123,45 € brutto',fontScale:16/500,fontChoice:'liberation-sans',bold:false,italic:false,color:'#000000'};
 mark={...mark,...rich.applyEditorPatch(mark,{bold:true,color:'#cc0000'},{id:'rich',start:6,end:14})};
 let parts=rich.editorSegments(mark);assert.equal(parts[0].style.bold,false);assert.equal(parts[1].style.bold,true);assert.equal(parts[2].style.bold,false);assert.equal(parts[1].style.color,'#cc0000');
 assert.equal(mark.bold,false,'Formatting a selection never changes the whole field');
 assert.equal(rich.replaceEditorRange(mark,6,12,'987,65').text,'Netto 987,65 € brutto');mark={...mark,...rich.replaceEditorMatches(mark,rich.findEditorText(mark.text,'123,45'),'987,65')};assert.equal(mark.text,'Netto 987,65 € brutto');assert.equal(rich.editorSegments(mark)[1].style.bold,true);
 const emoji={...mark,text:'A😀B',runs:[{start:1,end:3,style:{bold:true}}]};assert.equal(rich.replaceEditorText(emoji,'A😀ZB').text,'A😀ZB');
 const output=await PDFDocument.create();await drawEditorText(output,output.addPage([500,700]),mark,500,700);
 const bytes=await output.save();await writeFile(folder+'/rich.pdf',bytes);const opened=await source(bytes);
 const targets=(await readTextTargets(opened,pageOf(opened))).targets;
 assert.equal(targets.map(t=>t.text).join('').replace(/\s/g,''),'Netto987,65€brutto');
 assert(targets.some(t=>t.text.includes('987,65') && t.bold && t.color==='#cc0000'));
 assert(targets.some(t=>t.text.includes('Netto') && !t.bold && t.color==='#000000'));
 const mixed=editorParagraphs(targets,500,700);assert.equal(mixed.length,1,'Inline font/color changes stay in one paragraph');assert(mixed[0].runs.some(r=>r.style.bold));

 const {editorTargetMark,joinEditorBlocks,splitEditorBlock}=await import('../.cache/editor-rich/editor-blocks.mjs');
 const {indexEditorDocument,findEditorDocument,replaceEditorDocument,editorDocumentFingerprint}=await import('../.cache/editor-rich/editor-document-search.mjs');
 const {prepareEditorLayout,fitEditorLayout}=await import('../.cache/editor-rich/editor-layout-plan.mjs');
 const {prepareEditorRuns}=await import('../.cache/editor-rich/editor-rich-layout.mjs');
 const {editorMarkChanged,editorTextCollision,editorRemovalRects}=await import('../.cache/editor-rich/editor-model.mjs');
 const columnTargets=[0,1].flatMap(row=>[0,1].map(col=>({id:`col-${row}-${col}`,text:`Column ${col} line ${row}`,x:.05+col*.5,y:.1+row*.024,w:.4,h:.02,fontSize:12,family:'sans',origin:'pdf'})));
 const columns=editorParagraphs(columnTargets,500,700);assert.equal(columns.length,2);assert(columns.every(c=>c.text.includes('line 0\n')&&c.text.includes('line 1')),'Interleaved extraction follows each column without merging columns');
 const blocks=columnTargets.filter(t=>t.x===.05).map((t,i)=>editorTargetMark(t,0,500,'b'+i));
 blocks[1].bold=true;blocks[1].color='#cc0000';
 const joined=joinEditorBlocks(blocks,500,700,'joined');assert.equal(joined.text,blocks.map(b=>b.text).join('\n'));assert.equal(editorRemovalRects(joined).length,2);assert(rich.editorSegments(joined).at(-1).style.bold);assert(editorMarkChanged(joined));
 const unchanged=columnTargets.filter(t=>t.x===.05).map((t,i)=>editorTargetMark(t,0,500,'u'+i));assert(!editorMarkChanged(joinEditorBlocks(unchanged,500,700,'group')),'Grouping alone does not rewrite original PDF content');
 const split=splitEditorBlock(joined,joined.text.indexOf('\n')+1,20,20,700,'split');assert.equal(split[0].text+split[1].text,joined.text);assert.equal(editorRemovalRects(split[0]).length,2);assert.equal(editorRemovalRects(split[1]).length,0);assert(rich.editorSegments(split[1])[0].style.bold);
 assert.throws(()=>splitEditorBlock({...joined,text:'A😀B'},2,20,20,700,'bad'),/Textcursor/);
 assert.throws(()=>splitEditorBlock({...joined,y:.99},5,20,20,700,'bad'),/genug Platz/);
 assert.throws(()=>joinEditorBlocks([{...blocks[0],textRotation:90},blocks[1]],500,700,'bad'),/waagerechte/);

 const roundingMark={...mark,text:'Absatz zwei',fontScale:14/500,w:(74.69+2.24)/500,insetScale:.08,runs:[{start:0,end:11,style:{fontScale:14/500}}]};assert.equal((await prepareEditorLayout(roundingMark,500,700)).lineCount,1,'Seven thousandths of a point in reconstructed advances cannot insert a spurious line break');
 const tooTall={...mark,text:'Text with several words '.repeat(4),w:.3,h:.06,runs:undefined};const prepared=await prepareEditorRuns(tooTall);assert((await prepareEditorLayout(tooTall,500,700)).overflow);
 const fit=fitEditorLayout(tooTall,500,700,prepared);assert(fit);assert(!(await prepareEditorLayout({...tooTall,...fit},500,700)).overflow);assert(fit.fontScale*500>=6);
 assert(editorTextCollision({...mark,id:'new',sourceRect:undefined},[],[{...columnTargets[0],x:mark.x,y:mark.y}]),'Added text gets collision checks too');
 const table=[0,1].flatMap(row=>[0,1].map(col=>({id:`${row}-${col}`,text:'Zelle',x:.1+col*.4,y:.1+row*.024,w:.1,h:.02,fontSize:12,family:'sans',origin:'pdf'})));
 assert.equal(editorParagraphs(table,500,700).length,4,'Aligned table cells never become one paragraph');
 const colored={...mark,runs:undefined,text:'Links ROT rechts',bold:false};
 Object.assign(colored,rich.formatEditorRange(colored,6,9,{color:'#cc0000'}));
 const colorPdf=await PDFDocument.create();await drawEditorText(colorPdf,colorPdf.addPage([500,700]),colored,500,700);
 const colorSource=await source(await colorPdf.save()),colorTargets=(await readTextTargets(colorSource,pageOf(colorSource))).targets;
 const colorParagraph=editorParagraphs(colorTargets,500,700)[0];
 assert.equal(colorParagraph.text,'Links ROT rechts');
 assert(colorParagraph.runs.some(r=>r.style.color==='#cc0000' && colorParagraph.text.slice(r.start,r.end).trim()==='ROT'),'Colour changes within the same PDF font are recovered');
 const spaced={...mark,runs:undefined,text:'NEU ÄÖÜ €',fontScale:18/500};
 Object.assign(spaced,rich.formatEditorRange(spaced,0,3,{bold:true,italic:true,color:'#006644'}));
 const spacedPdf=await PDFDocument.create();await drawEditorText(spacedPdf,spacedPdf.addPage([500,700]),spaced,500,700);
 const spacedSource=await source(await spacedPdf.save()),spacedTargets=(await readTextTargets(spacedSource,pageOf(spacedSource))).targets;
 assert.equal(editorParagraphs(spacedTargets,500,700)[0].text,spaced.text,'Reopened mixed-style paragraphs preserve inter-word spaces despite selection padding');
 const original=await PDFDocument.create(),p=original.addPage([500,700]);p.drawText('KEEP 4815',{x:50,y:600,size:18,font:await original.embedFont(StandardFonts.Helvetica)});
 const untouched=original.addPage([420,500]);untouched.drawText('Untouched ÄÖÜ €',{x:40,y:400,size:14});
 const originalBytes=await original.save();await writeFile(folder+'/original.pdf',originalBytes);const originalSource=await source(originalBytes);
 const added={...mark,y:.3};
 const edited=await PDFDocument.load(originalBytes);await drawEditorText(edited,edited.getPage(0),added,500,700,originalSource);
 const editedBytes=await edited.save();await writeFile(folder+'/edited.pdf',editedBytes);
 const pages=[pageOf(originalSource),{...pageOf(originalSource),id:'p1',index:1}],edits={marks:{p0:[added]},crops:{}};
 const result=await verifyEditorExport(editedBytes,[originalSource],pages,edits,'deu+eng',new AbortController().signal,()=>{});
 assert.equal(result.editedImageFields,1,JSON.stringify(result));assert.equal(result.status,'passed',JSON.stringify(result));assert.equal(result.textPages,2);assert.deepEqual(result.changedPages,[0]);assert.equal(result.imagePages,2);
 await assert.rejects(()=>verifyEditorExport(originalBytes,[originalSource],pages,edits,'deu+eng',new AbortController().signal,()=>{}),/gespeicherte Text/,'Missing edited text is rejected');

 for(const [name,patch] of [['shift',{x:added.x+.008}],['size',{fontScale:added.fontScale*.8,runs:added.runs?.map(r=>({...r,style:{...r.style,fontScale:(r.style.fontScale||added.fontScale)*.8}}))}],['colour',{color:'#6600cc',runs:added.runs?.map(r=>({...r,style:{...r.style,color:'#6600cc'}}))}],['font',{fontChoice:'liberation-mono',runs:added.runs?.map(r=>({...r,style:{...r.style,fontChoice:'liberation-mono',fontFamily:'mono'}}))}]]) {
  const broken=await PDFDocument.load(originalBytes);await drawEditorText(broken,broken.getPage(0),{...added,...patch},500,700,originalSource);
  const verdict=await verifyEditorExport(await broken.save(),[originalSource],pages,edits,'deu+eng',new AbortController().signal,()=>{});
  assert.equal(verdict.status,'review',name+': '+JSON.stringify(verdict));assert.equal(verdict.editedImageFields,1);assert(verdict.issues.some(i=>i.message.includes('Schriftbild weicht')),name+': mismatch must be found, not an unavailable check');
 }
 const index=await indexEditorDocument([originalSource],pages,{marks:{},crops:{}},'eng',false,new AbortController().signal,()=>{});
 assert.equal(index.failures.length,0);const matches=findEditorDocument(index,'KEEP',true,true);assert.equal(matches.length,1);
 const documentChange=replaceEditorDocument(index,matches,'EDIT',{marks:{},crops:{}});assert.equal(documentChange.changes.length,1);assert(documentChange.changes[0].mark.text.includes('EDIT'));assert.equal(documentChange.edits.marks.p0.length,1);assert(editorMarkChanged(documentChange.changes[0].mark));
 const unchangedPick=editorTargetMark((await readTextTargets(originalSource,pages[0])).targets[0],0,500,'selection-only');assert.equal(editorDocumentFingerprint([originalSource],pages,{marks:{p0:[unchangedPick]},crops:{}}),index.fingerprint,'Selecting unchanged text does not invalidate whole-document search');
 const nextIndex=await indexEditorDocument([originalSource],pages,documentChange.edits,'eng',false,new AbortController().signal,()=>{});assert.equal(findEditorDocument(nextIndex,'KEEP').length,0);assert.equal(findEditorDocument(nextIndex,'EDIT').length,1,'Replacement hides the original from later searches');
 assert.throws(()=>replaceEditorDocument(nextIndex,matches,'stale',documentChange.edits),/aktuell/);
 const allOriginals=await indexEditorDocument([originalSource],pages,{marks:{},crops:{}},'eng',false,new AbortController().signal,()=>{});assert.notEqual(allOriginals.blocks[0].mark.id,index.blocks[0].mark.id,'Fresh search targets never reuse an existing replacement mark ID');
 const duplicate=await PDFDocument.load(editedBytes);duplicate.getPage(0).drawText('KEEP 4815',{x:50,y:550,size:18});
 // Duplicated old text, even at a different position, must fail the content check.
 const duplicateBytes=await duplicate.save();await assert.rejects(()=>verifyEditorExport(duplicateBytes,[originalSource],pages,edits,'deu+eng',new AbortController().signal,()=>{}),/gespeicherte Text/);
 const pixels=new Uint8ClampedArray(10*10*4).fill(255),changed=pixels.slice();changed[0]=0;
 assert(compareEditorPixels(pixels,changed,10,10,[])>0);assert.equal(compareEditorPixels(pixels,changed,10,10,[{x:0,y:0,w:.1,h:.1}]),0);
 const fontBytes=await readFile('public/vendor/editor-fonts/LiberationSans-Regular.ttf'),custom=await importEditorFont(new File([fontBytes],'My-font.ttf'));
 const customMark={...mark,runs:undefined,fontChoice:'custom',customFont:custom};assert((await resolveEditorFont(customMark)).font.covers(mark.text));
 await assert.rejects(()=>importEditorFont(new File([new Uint8Array(12)],'broken.ttf')),/TrueType/);
 await assert.rejects(()=>resolveEditorFont({...customMark,bold:true}),/Schriftschnitt/);
 const customPdf=await PDFDocument.create();await drawEditorText(customPdf,customPdf.addPage([500,700]),customMark,500,700);
 const customSource=await source(await customPdf.save());assert.equal((await readTextTargets(customSource,pageOf(customSource))).targets.map(t=>t.text).join(''),mark.text,'Custom font embeds and reopens with full Unicode text');
 const state={pages,edits:{marks:{p0:[customMark]},crops:{}},options:{language:'deu',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2'},history:[],future:[],documentSessions:{},activeId:'p0',toolId:'edit-text'};
 state.history=Array.from({length:25},()=>({pages,edits:state.edits}));
 const json=stringifyEditorProject(state);assert(json.length<custom.data.length*2,'Font bytes are stored once across the undo history');
 assert.equal(JSON.parse(json,editorProjectReviver()).history[24].edits.marks.p0[0].customFont.data,custom.data);
 const archive=await encodeProjectFile('Rich text',[originalSource],state),restored=await decodeProjectFile(archive);assert.equal(restored.state.edits.marks.p0[0].customFont.data,custom.data);
 assert.throws(()=>JSON.parse('{"customFont":{"data":"@font:999"}}',editorProjectReviver()),/Schriftverweis/);
 console.log('PASS: selected-word formatting, styled insertion, Unicode offsets, embedded mixed fonts/colors, paragraph/table boundaries, reopened export checks, missing/duplicated text rejection, masked pixel comparison, local font validation and deduplicated project/font round trip.');
}finally{for(const s of sources)await s.pdf.loadingTask.destroy();globalThis.fetch=originalFetch;}
