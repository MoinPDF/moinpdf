import {editorNativeAdapter} from './editor-native-adapter.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PDFDocument,StandardFonts,rgb,PDFName,PDFNumber} from 'pdf-lib';
const folder='.cache/editor-rich';await mkdir(folder,{recursive:true});
for(const name of ['content-digest','local-font-bytes','pdf-text','ocr-languages','content-compare','image-codecs','pdf-engine','studio-engine','advanced-types','extra-options','extra-tools','pdf-report','pdf-signature-guard','editor-model','editor-rich-text','editor-rich-layout','editor-verification','editor-detail-verification','editor-layout-plan','editor-sparse','editor-scan','editor-workflow','editor-ink-verification','editor-blocks','editor-document-search','editor-analysis','editor-text-layer','editor-fonts','editor-font-outline','editor-font-match','editor-font-cmap','editor-font-catalog','editor-native','editor-scan-pixels','editor-repair','pdf-security','native-pdf-core','nested-native','editor-project-codec','local-projects','project-archive']){
 const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replaceAll("'/vendor/pdf/standard_fonts/'", "'public/vendor/pdf/standard_fonts/'").replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);await writeFile(`${folder}/${name}.mjs`,code);
}
await writeFile(folder+'/native-pdf.mjs',editorNativeAdapter);
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
 const typographyText='🧾 Oﬃce Cafe\u0301 Netto\u00a0 \nBetrag Rech\u00adnung';
 const normalized=(query,whole=false)=>rich.findEditorText(typographyText,query,false,whole,true);
 for(const [query,original] of [['Office','Oﬃce'],['Café','Cafe\u0301'],['Netto Betrag','Netto\u00a0 \nBetrag'],['Rechnung','Rech\u00adnung']]){
  const found=normalized(query);assert.equal(found.length,1,query);assert.equal(typographyText.slice(found[0].start,found[0].end),original,'Original UTF-16 range includes complete graphemes');
 }
 assert.equal(rich.findEditorText(typographyText,'Office').length,0,'Exact matching remains available');
 assert.equal(normalized('fi').length,0,'A partial ffi ligature is never replaced as fi');
 assert.equal(normalized('f').length,1,'The plain f in Café matches, never part of the ffi ligature');
 assert.equal(normalized('Rech',true).length,0,'Invisible hyphens do not create a false word boundary');
 assert.equal(rich.findEditorText('क्व','क',false,false,true).length,0,'Partial Indic grapheme is excluded');
 assert.equal(rich.findEditorText('👩‍👩‍👧','👩',false,false,true).length,0,'An emoji sequence cannot be cut apart');
 assert.deepEqual(rich.findEditorText('ﬃfififi','ififi',false,false,true),[{start:2,end:7}],'Rejected partial ligature must not hide a later complete match');
 assert.deepEqual(rich.findEditorText('  \t A',' ',false,false,true),[{start:0,end:4}]);
 assert.deepEqual(rich.findEditorText('x','\u00ad',false,false,true),[],'An all-ignorable query produces no empty matches');
 const typographicMark={...matchMark,text:typographyText,runs:[{start:3,end:7,style:{bold:true}}]};
 const typographicReplacement={...typographicMark,...rich.replaceEditorMatches(typographicMark,normalized('Office'),'Büro')};
 assert.equal(typographicReplacement.text,'🧾 Büro Cafe\u0301 Netto\u00a0 \nBetrag Rech\u00adnung');
 assert(rich.editorSegments(typographicReplacement).find(r=>r.start===3).style.bold,'Replacement retains the original match style');
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
 const alternating=[...'EDITED'].map((text,i)=>({...targets[0],id:'alternating-'+i,text,x:.1+i*.015,y:(100-(i%2?.9:1.1)*12)/700,w:.015,h:.03,fontSize:12,baselineScale:i%2?.9:1.1,insetScale:0,runs:undefined,fragments:undefined}));
 const baselineJoined=editorParagraphs(alternating,500,700,'line');assert.equal(baselineJoined.length,1);assert.equal(baselineJoined[0].text,'EDITED','Different ascenders must not reorder alternating original/fallback glyphs');assert(Math.abs(baselineJoined[0].y*700+baselineJoined[0].baselineScale*12-100)<1e-8,'Merged selection retains the shared baseline');
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
 assert.throws(()=>splitEditorBlock({...joined,text:'Ae\u0301B'},2,20,20,700,'bad'),/Textcursor/);
 const numberedSplit=splitEditorBlock({...joined,text:'First\nSecond item\nThird',runs:undefined,listStyle:'numbered',listStart:4},6,20,40,700,'list-split');
 assert.equal(rich.editorExportText(numberedSplit[0])+rich.editorExportText(numberedSplit[1]),'4. First\n5. Second item\n6. Third','Splitting between list items retains numbering');
 const continuedSplit=splitEditorBlock({...joined,text:'First\nSecond item\nThird',runs:undefined,listStyle:'numbered',listStart:4},13,20,40,700,'list-cont');
 assert.equal(rich.editorExportText(continuedSplit[0])+rich.editorExportText(continuedSplit[1]),'4. First\n5. Second item\n6. Third','Splitting inside a list item does not duplicate its label');
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

 // New formats are real PDF text and paths, and the independent export verifier checks them.
 const formatted=[
  {...mark,id:'under',text:'Unterstrichen',runs:undefined,underline:true,y:.28,w:.8,h:.08,fontScale:16/500},
  {...mark,id:'scripts',text:'H2O x2',runs:[{start:1,end:2,style:{script:'sub'}},{start:5,end:6,style:{script:'super'}}],y:.4,w:.8,h:.08,fontScale:18/500},
  {...mark,id:'numbered',text:'Erster Punkt mit Worten\nZweiter Punkt',runs:undefined,listStyle:'numbered',listStart:4,paragraphSpacing:.3,y:.52,w:.8,h:.15,fontScale:14/500},
  {...mark,id:'justify',text:'Blocksatz verteilt die Wörter auf volle Zeilen und lässt die letzte Zeile links stehen.',runs:undefined,align:'justify',y:.74,w:.5,h:.16,fontScale:12/500},
 ];
 const formattedPdf=await PDFDocument.load(originalBytes);for(const field of formatted)await drawEditorText(formattedPdf,formattedPdf.getPage(0),field,500,700,originalSource);
 const formattedBytes=await formattedPdf.save();await writeFile(folder+'/formatted.pdf',formattedBytes);
 const formattedSource=await source(formattedBytes),formattedTargets=(await readTextTargets(formattedSource,pageOf(formattedSource))).targets;
 const visibleText=formattedTargets.map(t=>t.text).join(' ');assert.match(visibleText,/4\./);assert.match(visibleText,/5\./);assert.equal((visibleText.match(/Erster/g)||[]).length,1);
 const scriptPlan=await prepareEditorLayout(formatted[1],500,700);const small=scriptPlan.pieces.filter(p=>p.text==='2');assert.equal(small.length,2);assert(small.every(p=>Math.abs(p.size-11.7)<.001));assert(small[0].y>small[1].y,'Subscript baseline is lower than superscript');
 const checked=await verifyEditorExport(formattedBytes,[originalSource],pages,{marks:{p0:formatted},crops:{}},'deu+eng',new AbortController().signal,()=>{});
 assert.equal(checked.status,'passed',JSON.stringify(checked));assert.equal(checked.editedImageFields,4);
 const list=formatted[2],continuation={...list,...rich.editorListSlice(list,7),text:list.text.slice(7)};
 assert(continuation.listContinuation);assert.equal(continuation.listStart,4);assert(rich.editorExportText(continuation).includes('5. Zweiter Punkt'));
 const originalTarget=(await readTextTargets(originalSource,pageOf(originalSource))).targets[0];
 const matching=await (await import('../.cache/editor-rich/editor-font-match.mjs')).prepareEditorFontMatch({...mark,sourceRect:originalTarget,originalText:originalTarget.text,runs:undefined},originalSource,pageOf(originalSource),new AbortController().signal);
 assert(matching,'A plain original text line supports local shape matching');
 const matchingFont=(await resolveEditorFont({...mark,fontChoice:'liberation-sans',bold:false,italic:false})).font;
 const differentFont=(await resolveEditorFont({...mark,fontChoice:'liberation-mono',bold:false,italic:false})).font;
 const sameScore=await matching(matchingFont),differentScore=await matching(differentFont);assert(sameScore<differentScore,`Original shape ranks before monospace: ${sameScore} < ${differentScore}`);

 const {prepareEditorFontMatch,editorFontMatchScore}=await import('../.cache/editor-rich/editor-font-match.mjs');
 const selectionTarget=spacedTargets.find(t=>t.text.includes('NEU'));
 assert(selectionTarget.originalFontId,'Embedded font fixture exposes original outlines');
 const selectionMatch=await prepareEditorFontMatch({...spaced,originalFontId:selectionTarget.originalFontId},spacedSource,pageOf(spacedSource),new AbortController().signal,{text:'NE',originalFontId:selectionTarget.originalFontId,originalFontPage:0});
 assert(selectionMatch,'A selected word is compared to its own original glyph outlines');
 const selectionFace=(await resolveEditorFont({...mark,runs:undefined,fontChoice:'liberation-sans',bold:true,italic:true})).font;
 assert((await selectionMatch(selectionFace))<(await selectionMatch(differentFont)),'Matching selected glyphs rank before an unrelated face');
 assert.equal(await prepareEditorFontMatch({...mark,originalFontId:undefined},originalSource,pageOf(originalSource),new AbortController().signal,{text:'unrelated'}),null,'A selection without known outlines is never compared to the full line');
 const scores=[{shape:.1,difference:.2,overflow:true},{difference:0,overflow:false},{shape:.2,difference:.3,overflow:false}].sort((a,b)=>editorFontMatchScore(a)-editorFontMatchScore(b));
 assert.equal(scores[0].shape,.2);assert.equal(scores.at(-1).overflow,true);
 const {compareEditorDetail,verifyEditorDetails,verifyEditorStructure}=await import('../.cache/editor-rich/editor-detail-verification.mjs');
 const tiny=createCanvas(180,50),tinyCtx=tiny.getContext('2d');tinyCtx.fillStyle='white';tinyCtx.fillRect(0,0,180,50);const blankDetail=tinyCtx.getImageData(0,0,180,50);
 tinyCtx.fillStyle='black';tinyCtx.fillRect(70,30,3,3);const punctuation=tinyCtx.getImageData(0,0,180,50);
 assert.equal(compareEditorDetail(blankDetail,blankDetail).count,0);
 assert(compareEditorDetail(blankDetail,punctuation).rect,'A missing decimal point survives local comparison');
 tinyCtx.fillStyle='white';tinyCtx.fillRect(0,0,180,50);tinyCtx.fillStyle='black';tinyCtx.fillRect(71,30,3,3);
 assert.equal(compareEditorDetail(punctuation,tinyCtx.getImageData(0,0,180,50)).count,0,'One-pixel raster alignment is tolerated');
 const makeOrdered=async(reverse=false)=>{const doc=await PDFDocument.create(),page=doc.addPage([300,300]),font=await doc.embedFont(StandardFonts.Helvetica);for(const i of reverse?[1,0]:[0,1])page.drawText(['First 1.23','Second 4.56'][i],{x:30,y:240-i*40,size:9,font});return source(await doc.save());};
 const ordered=await makeOrdered(),reversed=await makeOrdered(true),orderTargets=(await readTextTargets(ordered,pageOf(ordered))).targets;
 const orderIssues=await verifyEditorDetails(ordered,pageOf(ordered),reversed,pageOf(reversed),orderTargets,(await readTextTargets(reversed,pageOf(reversed))).targets,[],300,300,new AbortController().signal);
 assert(orderIssues.some(i=>i.message.includes('Reihenfolge')),'Visual equality does not hide changed PDF extraction order');
 assert(!orderIssues.some(i=>i.message.includes('Detailprüfung')),'Unchanged rendered text passes detail comparison');
 // Real tagged PDF: marked content, parent tree and page structure references.
 const taggedDoc=await PDFDocument.create(),taggedPage=taggedDoc.addPage([300,300]),taggedFont=await taggedDoc.embedFont(StandardFonts.Helvetica);
 const fontKey=taggedPage.node.newFontDictionary('F',taggedFont.ref);
 const stream=taggedDoc.context.flateStream(`/P <</MCID 0>> BDC BT /${fontKey.asString().slice(1)} 12 Tf 30 240 Td (Tagged text) Tj ET EMC /P <</MCID 1>> BDC BT /${fontKey.asString().slice(1)} 12 Tf 30 210 Td (Second paragraph) Tj ET EMC`);
 taggedPage.node.addContentStream(taggedDoc.context.register(stream));taggedPage.node.set(PDFName.of('StructParents'),PDFNumber.of(0));
 const structRef=taggedDoc.context.nextRef(),elementRef=taggedDoc.context.nextRef(),secondRef=taggedDoc.context.nextRef();
 taggedDoc.context.assign(elementRef,taggedDoc.context.obj({Type:'StructElem',S:'P',P:structRef,Pg:taggedPage.ref,K:0}));
 taggedDoc.context.assign(secondRef,taggedDoc.context.obj({Type:'StructElem',S:'P',P:structRef,Pg:taggedPage.ref,K:1}));
 taggedDoc.context.assign(structRef,taggedDoc.context.obj({Type:'StructTreeRoot',K:[elementRef,secondRef],ParentTree:{Nums:[0,[elementRef,secondRef]]},ParentTreeNextKey:1}));
 taggedDoc.catalog.set(PDFName.of('StructTreeRoot'),structRef);taggedDoc.catalog.set(PDFName.of('MarkInfo'),taggedDoc.context.obj({Marked:true}));
 const taggedBytes=await taggedDoc.save(),tagged=await source(taggedBytes);
 assert(await(await tagged.pdf.getPage(1)).getStructTree(),'Fixture has a parsed real structure tree');
 assert.deepEqual(await verifyEditorStructure(tagged,pageOf(tagged),tagged,pageOf(tagged),[{kind:'text',text:'Tagged text'}],new AbortController().signal),[]);
 const swappedTags=await PDFDocument.load(taggedBytes);swappedTags.context.lookup(structRef).set(PDFName.of('K'),swappedTags.context.obj([secondRef,elementRef]));const swapped=await source(await swappedTags.save());
 assert((await verifyEditorStructure(tagged,pageOf(tagged),swapped,pageOf(swapped),[],new AbortController().signal)).some(x=>x.includes('Lesereihenfolge')),'Reordered paragraphs with identical tag roles are detected through their actual marked text');
 const untaggedDoc=await PDFDocument.load(taggedBytes);untaggedDoc.catalog.delete(PDFName.of('StructTreeRoot'));const untagged=await source(await untaggedDoc.save());
 assert((await verifyEditorStructure(tagged,pageOf(tagged),untagged,pageOf(untagged),[],new AbortController().signal)).some(x=>x.includes('Strukturinformationen')),'Lost tags produce a review finding');
 assert((await verifyEditorStructure(tagged,pageOf(tagged),tagged,pageOf(tagged),[{kind:'text',text:'New text outside tags'}],new AbortController().signal)).some(x=>x.includes('nicht vollständig')),'Untagged edited text is reported');
 console.log('PASS: selected-glyph font ranking, punctuation detail checks, extraction order and real tagged-PDF preservation checks.');
 console.log('PASS: real underline, super/subscript, list labels, justification and visual font ranking with independent PDF verification.');

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
 const secureFontId=(await resolveEditorFont(customMark)).font.id,cryptoDescriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{value:{},configurable:true});try{assert.equal((await resolveEditorFont(customMark)).font.id,secureFontId,'Custom fonts work on local HTTP with the same SHA-256 identity');}finally{Object.defineProperty(globalThis,'crypto',cryptoDescriptor);}
 const variable=await importEditorFont(new File([await readFile('tests/fixtures/editor-variable.otf')],'Variable.otf'),{wght:700});assert(variable.bold);const variableResolved=await resolveEditorFont({...customMark,customFont:variable,text:'A',bold:true,italic:false});assert.equal(variableResolved.font.measure('A',1000),750,'Imported instance has the selected advance');
 const otf=await importEditorFont(new File([await readFile('tests/fixtures/editor-static-cff.otf')],'Synthetic.otf'));
 const otfMark={...customMark,text:'A Ω',customFont:otf,bold:false,italic:false};
 assert((await resolveEditorFont(otfMark)).font.covers('A Ω'),'Static OTF import retains Unicode coverage');
 await assert.rejects(()=>importEditorFont(new File([new Uint8Array(12)],'broken.ttf')),/TrueType/);
 await assert.rejects(()=>resolveEditorFont({...customMark,bold:true}),/Schriftschnitt/);
 const customPdf=await PDFDocument.create();await drawEditorText(customPdf,customPdf.addPage([500,700]),customMark,500,700);
 const customSource=await source(await customPdf.save());assert.equal((await readTextTargets(customSource,pageOf(customSource))).targets.map(t=>t.text).join(''),mark.text,'Custom font embeds and reopens with full Unicode text');
 const state={pages,edits:{marks:{p0:[customMark,...formatted]},crops:{}},options:{language:'deu',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2'},history:[],future:[],documentSessions:{},activeId:'p0',toolId:'edit-text'};
 state.history=Array.from({length:25},()=>({pages,edits:state.edits}));
 const json=stringifyEditorProject(state);assert(json.length<custom.data.length*2,'Font bytes are stored once across the undo history');
 assert.equal(JSON.parse(json,editorProjectReviver()).history[24].edits.marks.p0[0].customFont.data,custom.data);
 const archive=await encodeProjectFile('Rich text',[originalSource],state),restored=await decodeProjectFile(archive);assert.equal(restored.state.edits.marks.p0[0].customFont.data,custom.data);
 for(let i=0;i<formatted.length;i++){const got=restored.state.edits.marks.p0[i+1];assert.equal(got.underline,formatted[i].underline);assert.equal(got.listStyle,formatted[i].listStyle);assert.equal(got.align,formatted[i].align);assert.deepEqual(got.runs,formatted[i].runs);}
 assert.throws(()=>JSON.parse('{"customFont":{"data":"@font:999"}}',editorProjectReviver()),/Schriftverweis/);
 console.log('PASS: selected-word formatting, styled insertion, Unicode offsets, embedded mixed fonts/colors, paragraph/table boundaries, reopened export checks, missing/duplicated text rejection, masked pixel comparison, local font validation and deduplicated project/font round trip.');
}finally{for(const s of sources)await s.pdf.loadingTask.destroy();globalThis.fetch=originalFetch;}
