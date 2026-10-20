import { englishTranslator } from './translation-test-utils.mjs';
const en = await englishTranslator();
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import ts from 'typescript';
import JSZip from 'jszip';
import {PDFDocument,StandardFonts,PDFName,PDFHexString,degrees} from 'pdf-lib';
import {createWorker,PSM} from 'tesseract.js';
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pdfRequire('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement(name){assert.equal(name,'canvas');return createCanvas(1,1);}}});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
// The same Tesseract engine and bundled languages; adapt only browser canvas/worker transport for Node.
globalThis.__evidenceOcr={PSM,async createWorker(languages,oem,options){
  const worker=await createWorker(languages,oem,{langPath:resolve('public/vendor/languages'),cachePath:resolve('.cache'),logger:options.logger});
  const recognize=worker.recognize.bind(worker);worker.recognize=(canvas,...args)=>recognize(canvas.toBuffer('image/png'),...args);return worker;
}};
await mkdir('.cache',{recursive:true});
for(const name of ['editor-rich-text','local-font-bytes','pdf-text','ocr-languages','content-compare','image-codecs','pdf-engine','editor-model','editor-font-catalog','editor-font-cmap','editor-fonts','document-tools','advanced-types','table-data','evidence-model','evidence-engine']) {
  let code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}-evidence-test.mjs${q}`);
  if(name==='evidence-engine')code=code.replace("import('tesseract.js')",'Promise.resolve(globalThis.__evidenceOcr)');
  await writeFile(`.cache/${name}-evidence-test.mjs`,code);
}
const model=await import('../.cache/evidence-model-evidence-test.mjs'),engine=await import('../.cache/evidence-engine-evidence-test.mjs');
const ctx={signal:new AbortController().signal,report:()=>{}},proxies=[];
async function source(bytes,name='Test.pdf') {
  const data=new Uint8Array(bytes),pdf=await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;proxies.push(pdf);
  return{id:crypto.randomUUID(),name,bytes:data,pdf,size:data.length,kind:'pdf'};
}
function page(lines,{id='a',name='A.pdf',page=0,mode='text'}={}) {
  const words=lines.flatMap((line,y)=>{let x=.08;return line.split(' ').map((text,i)=>{const w={id:`${y}-${i}`,text,x,y:.1+y*.06,w:text.length*.008,h:.02,confidence:95};x+=w.w+.008;return w;});});
  return model.groupWords({sourceId:id,name,page,mode,words});
}
async function textPdf(lines,name='Test.pdf',options={}) {
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),p=doc.addPage([595,842]);
  for(const [i,text] of lines.entries())p.drawText(text,{font,size:17,x:48,y:780-i*42});
  if(options.hidden)p.drawText(options.hidden,{font,size:12,x:48,y:400,opacity:0});
  if(options.rotation)p.setRotation(degrees(options.rotation));
  if(options.attachment)await doc.attach(new TextEncoder().encode('PRIVATE-ATTACHMENT-SENTINEL'),'private.txt');
  return source(await doc.save(),name);
}
const fontBytes=new Uint8Array(await readFile('public/vendor/invoice-font/NotoSans-Regular.ttf'));
try {
  // Semantic anchors survive reordered lines and page moves; repeated anchors remain unresolved.
  const old=[page(['Netto: 1.000,00 EUR','Zahlbar bis: 12.10.2026','Rabatt: 5 %','IBAN: DE89370400440532013000'])];
  const next=[page(['Rabatt: 5%','IBAN: DE89370400440532013000'],{id:'b',name:'B.pdf'}),page(['Netto: 1.200,00 EUR','Zahlbar bis: 2026-10-12'],{id:'b',name:'B.pdf',page:1})];
  const differences=model.compareNumbers(old,next);
  assert.equal(differences.length,1);assert.equal(differences[0].status,'changed');assert.equal(differences[0].after.page,1);assert.match(differences[0].newValue,/1.200/);
  const ambiguous=model.compareNumbers([page(['Netto: 10,00'])],[page(['Netto: 11,00','Netto: 12,00'],{id:'b'})]);assert(ambiguous.some(r=>/Mehrdeutig/.test(r.title)));assert(!ambiguous.some(r=>r.status==='changed'));
  assert.equal(model.numericValue('-1.200,50 EUR'),'-1200.5');assert.equal(model.numericValue('0,00'),'0');
  assert.equal(model.numberTokens('Datum 12.10.2026 und Rabatt 5 %').length,2);

  const rules=model.parseFieldRules(model.defaultFieldRules),data=[page(['Rechnungsnummer: R-107','Datum: 07.10.2026','Netto: 100,00 EUR','Gesamtbetrag: 119,00 EUR','IBAN: DE89370400440532013000'])];
  const englishRules=model.parseFieldRules(model.defaultFieldRules.split('\n').map(line=>{const at=line.indexOf('=');return en(line.slice(0,at).trim())+' = '+line.slice(at+1).trim()}).join('\n'));
  assert.deepEqual(englishRules.map(r=>r.kind),rules.map(r=>r.kind),'English default labels preserve field typing');assert.deepEqual(englishRules.map(r=>r.aliases),rules.map(r=>r.aliases),'Recognition aliases remain unchanged');assert.equal(model.parseFieldRules('Internet = Domain')[0].kind,'text');
  assert.equal(model.extractField(data,rules[0])[0].value,'R-107');assert.equal(model.extractField(data,rules[3])[0].value,'119,00 EUR');assert.equal(model.extractField(data,{id:'custom',label:'Kundennummer',aliases:['Kundennummer'],kind:'text'}).length,0);
  assert.throws(()=>model.parseFieldRules('Datum=Datum\nDatum=Date'),/eindeutigen/);
  const xml={number:'R-107',date:'2026-10-07',seller:{name:'Firma Alpha'},buyer:{name:'Firma Beta'},totals:{net:'100.00',gross:'999.00',due:'999.00'},payment:[{iban:'DE89370400440532013000'}]};
  const check=engine.compareInvoiceEvidence(xml,data);assert.equal(check.find(r=>r.title==='Nettobetrag').status,'match');assert.equal(check.find(r=>r.title==='Bruttobetrag').status,'changed');assert.equal(check.find(r=>r.title==='Verkäufer').status,'review');assert.equal(check.find(r=>r.title==='IBAN 1').status,'match');
  const unknown=engine.compareInvoiceEvidence(xml,[page(['Rechnung ohne passende Angaben'])]);assert(unknown.every(r=>r.status==='review'));

  const gaps=model.findPageGaps([page(['Seite 1 von 3']),page(['Seite 3 von 3'],{page:1}),page(['Seite 1 von 1'],{id:'b'})]);assert(gaps.some(r=>r.status==='missing'&&/2/.test(r.title)));assert.equal(gaps.filter(r=>r.status==='match').length,1);
  assert.equal(model.findPageGaps([page(['Seite 1 von 5','Seite 1 von 7'])])[0].status,'review');
  const pseudoRules=model.parsePseudonyms('Maria Muster = Person A\nM. Muster = Person A');
  const pseudoHits=model.findPseudonyms([page(['Maria Muster und Maria Mustermann','M. Muster bestätigt'],{mode:'ocr'})],pseudoRules);assert.equal(pseudoHits.length,2);assert.equal(pseudoHits[0].ref.rects.length,2);
  const plan=model.attachmentPlan([page(['Bitte siehe Anlage 3.']),page(['Anlage 3','Nachweise'],{id:'b',name:'Anlage-3.pdf'})]);assert.equal(plan.targets.length,1);assert.equal(plan.references.length,1);assert.equal(plan.references[0].target,plan.targets[0].id);
  const unresolved=model.attachmentPlan([page(['Bitte siehe Anlage 8.'])]);assert.equal(unresolved.references[0].target,'');
  const a=model.extractPositions([page(['1 Beratung 2 100,00 200,00','2 Porto 1 5,00 5,00'])]),b=model.extractPositions([page(['4 Beratung 3 100,00 300,00','5 Porto 1 5,00 5,00'],{id:'b'})]);
  assert.equal(a.length,2);const positions=model.reconcilePositions(a,b,'Angebot','Rechnung');assert.equal(positions.filter(r=>r.status==='changed').length,1);assert.equal(positions.filter(r=>r.status==='match').length,1);

  // Independent PDF parser verifies actual exports and preservation/removal boundaries.
  const original=await textPdf(['Rechnungsnummer: R-107','Gesamtbetrag: 119,00 EUR','Maria Muster','Bitte siehe Anlage 3.'],'Anschreiben.pdf',{attachment:true,hidden:'HIDDEN-PRIVATE-SENTINEL 9999.00'});
  const attachment=await textPdf(['Anlage 3','Dokumentierte Nachweise'],'Anlage-3.pdf');
  const evidence=await engine.readEvidence([original,attachment],'auto',ctx);assert(evidence.some(p=>p.lines.some(l=>l.text.includes('R-107'))));
  const actualPlan=model.attachmentPlan(evidence),linked=await engine.linkAttachments([original,attachment],actualPlan.targets,actualPlan.references,ctx);
  const linkedSource=await source(await linked.blob.arrayBuffer());assert.equal(linkedSource.pdf.numPages,2);
  const links=await (await linkedSource.pdf.getPage(1)).getAnnotations();assert(links.some(a=>a.subtype==='Link'&&a.dest));const destination=links.find(a=>a.dest).dest;assert.equal(await linkedSource.pdf.getPageIndex(destination[0]),1);
  assert((await linkedSource.pdf.getOutline()).some(o=>o.title.includes('anlage 3')));

  // Real bundled OCR must ignore an invisible, contradictory text object.
  const ocr=await engine.readEvidence([original],'ocr',ctx),ocrAll=ocr.map(p=>p.words.map(w=>w.text).join(' ')).join('\n');
  assert.match(ocrAll,/119[,.]00/);assert(!ocrAll.includes('HIDDEN-PRIVATE-SENTINEL'));assert(ocr[0].words.every(w=>typeof w.confidence==='number'));
  const numberWord=ocr[0].words.find(w=>/119[,.]00/.test(w.text));assert(numberWord);
  const corrections={[`${original.id}:0:${numberWord.id}`]:'120,00'},corrected=await engine.correctedOcr(original,ocr,corrections,ctx,fontBytes),correctedSource=await source(await corrected.blob.arrayBuffer());
  const correctedText=(await (await correctedSource.pdf.getPage(1)).getTextContent()).items.map(i=>i.str||'').join(' ');assert.match(correctedText,/120,00/);assert(!correctedText.includes('119,00'));assert(!correctedText.includes('HIDDEN-PRIVATE'));assert.equal(await correctedSource.pdf.getAttachments(),null);
  assert(engine.ocrReason({text:'1O0',confidence:99},85).includes('Zeichenverwechslung'));
  assert(engine.ocrText(ocr,corrections).includes('120,00'));
  const actualHits=model.findPseudonyms(ocr,pseudoRules);assert.equal(actualHits.length,1);
  const pseudonymized=await engine.pseudonymizedZip([original],pseudoRules,actualHits,ctx),zip=await JSZip.loadAsync(await pseudonymized.blob.arrayBuffer());assert.deepEqual(Object.keys(zip.files),['Dokument-001.pdf']);
  const clean=await source(await zip.file('Dokument-001.pdf').async('uint8array'));assert.equal((await (await clean.pdf.getPage(1)).getTextContent()).items.length,0);assert.equal(await clean.pdf.getAttachments(),null);assert(!(await clean.pdf.getMetadata()).info.Title);
  const visualCheck=await engine.readEvidence([clean],'ocr',ctx),cleanText=visualCheck.flatMap(p=>p.words.map(w=>w.text)).join(' ');assert(!/Maria|Muster/.test(cleanText));assert.match(cleanText,/Person A/);assert.match(cleanText,/119[,.]00/);

  // Comments are real PDF annotations, with source rectangles and independently read text.
  const annotated=await PDFDocument.load(original.bytes),p=annotated.getPage(0);
  p.node.set(PDFName.of('Annots'),annotated.context.obj([annotated.context.register(annotated.context.obj({Type:'Annot',Subtype:'Text',Rect:[45,665,210,690],Contents:PDFHexString.fromText('Bitte Betrag kontrollieren'),T:PDFHexString.fromText('Reviewer'),Name:'Comment'}))]));
  const commented=await source(await annotated.save(),'Kommentare.pdf'),comments=await engine.readComments([commented],ctx);assert.equal(comments.length,1);assert.equal(comments[0].comment,'Bitte Betrag kontrollieren');assert.equal(comments[0].author,'Reviewer');assert.equal(comments[0].ref.page,0);
  const malicious={...comments[0],comment:'=HYPERLINK("bad") <script>alert(1)</script>'};
  const translatedComments=engine.commentRows([{...malicious,comment:'Rechnung',author:'Rechnung',subject:'Rechnung'}],en);
  assert.equal(translatedComments[0][0],'Completed');assert.equal(translatedComments[1][3],'Rechnung');assert.equal(translatedComments[1][5],'Rechnung');assert.equal(translatedComments[1][6],'Rechnung');
  const findings=engine.findingRows([{id:'raw',title:'Rechnung',titleIsData:true,status:'review',detail:'Zahlenwert kontrollieren',oldValue:'Abbrechen',newValue:'Rechnung'}],en);
  assert.equal(findings[1][1],'Rechnung');assert.equal(findings[1][2],'Abbrechen');assert.equal(findings[1][3],'Rechnung');assert.notEqual(findings[1][4],'Zahlenwert kontrollieren');
  assert(!engine.ocrReason({text:'1O0,10',confidence:40},80,en).includes('OCR-Sicherheit'));
  const csv=await engine.exportRows(engine.commentRows([malicious]),'comments','csv');assert.match(await csv.blob.text(),/'=HYPERLINK/);
  const workbook=await engine.exportRows(engine.commentRows([malicious],en),'comments','xlsx',en('Tabelle')),workbookZip=await JSZip.loadAsync(await workbook.blob.arrayBuffer()),sheet=await workbookZip.file('xl/worksheets/sheet1.xml').async('string');assert.match(await workbookZip.file('xl/workbook.xml').async('string'),/name="Sheet"/);assert(!sheet.includes('<f>'));assert(sheet.includes('&lt;script&gt;'));assert(!sheet.includes('<script>'));
  assert((await engine.commentMarkdown(comments).blob.text()).includes('- [ ]'));

  const candidates=await engine.inspectScans([original,attachment],ctx);assert.equal(candidates.length,2);assert(candidates.every(c=>Number.isFinite(c.score)));
  const choices=engine.suggestScans(candidates,original.id);assert.equal(choices.length,1);assert.equal(choices[0].confirmed,false);
  await assert.rejects(()=>engine.saveBestScans([original,attachment],candidates,choices,ctx),/bestätigen/);
  const combined=await engine.saveBestScans([original,attachment],candidates,[{...choices[0],selected:candidates[1].key,confirmed:true},{...choices[0],selected:candidates[0].key,confirmed:true}],ctx);
  const combinedSource=await source(await combined.blob.arrayBuffer());assert.equal(combinedSource.pdf.numPages,2);assert((await (await combinedSource.pdf.getPage(1)).getTextContent()).items.some(i=>i.str==='Anlage 3'));
  const blank=createCanvas(50,50),g=blank.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,50,50);assert.equal(engine.scanMetrics(g.getImageData(0,0,50,50).data,50,50).score,0);
  await assert.rejects(()=>engine.readEvidence([original],'auto',{...ctx,signal:AbortSignal.abort()}),/Abgebrochen/);
  await assert.rejects(()=>engine.correctedOcr(original,[],{},ctx,fontBytes),/alle Seiten/);
  console.log('PASS: ten evidence tools: reordered amounts/dates/IBANs, ambiguous anchors, field extraction, XML mismatch/unknown, page gaps, actual OCR/corrected search layer, pseudonym pixels/no hidden payload, resolved PDF links, position differences, scan selection and safe comment exports.');
}finally{await Promise.all(proxies.map(p=>p.loadingTask.destroy()));}
