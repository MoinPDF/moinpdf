import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {PDFDocument,PDFName,PDFDict,StandardFonts,rgb} from 'pdf-lib';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
const {DOMParser}=await import('@xmldom/xmldom');globalThis.DOMParser=DOMParser;
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('.cache/growth030',{recursive:true});await mkdir('.cache/growth-fixtures',{recursive:true});
const modules=['payment-match','invoice-create','local-font-bytes','content-digest','pdf-portfolio','personal-data','pdf-layer-edit','native-pdf-core','invoice-engine'];
for(const name of modules){let code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;for(const other of modules)code=code.replaceAll(`'./${other}'`,`'./${other}.mjs'`);code=code.replace("import { pdfBlob } from './pdf-engine';","const pdfBlob = bytes => new Blob([bytes], {type:'application/pdf'});");await writeFile(`.cache/growth030/${name}.mjs`,code);}
const {moneyCents,reconcilePayments,paymentSuggestions}=await import('../.cache/growth030/payment-match.mjs');
assert.equal(moneyCents('1.234,56'),123456n);assert.equal(moneyCents('0.01'),1n);assert.equal(moneyCents('999999999999.99'),99999999999999n);
for(const n of ['-1','1e2','1.234','1,234','NaN','Infinity','1000000000000','1.2.3'])assert.throws(()=>moneyCents(n));
const pay=(id,amount,text='')=>({id,amount,text,currency:'EUR',direction:'debit',date:'2026-11-09',sourceId:'bank',page:0});
const rec=(id,amount,number='RE-001')=>({...pay(id,amount),number,partner:'Fiktive Firma',sourceId:id});
const ps=[pay('p1','40.00','RE-001'),pay('p2','70.00','RE-001'),pay('p3','20.00')],rs=[rec('r1','100.00')];
let matches=reconcilePayments(ps,rs,[{paymentId:'p1',receiptId:'r1',amount:'40',confirmed:false}]);assert.equal(matches.receipts[0].status,'open');
matches=reconcilePayments(ps,rs,[{paymentId:'p1',receiptId:'r1',amount:'40',confirmed:true}]);assert.equal(matches.receipts[0].remaining,'60.00');assert.equal(matches.payments[0].status,'matched');
matches=reconcilePayments(ps,rs,[{paymentId:'p1',receiptId:'r1',amount:'40',confirmed:true},{paymentId:'p2',receiptId:'r1',amount:'70',confirmed:true}]);assert.equal(matches.receipts[0].overpaid,'10.00');assert.equal(matches.payments[2].status,'unassigned');
assert.throws(()=>reconcilePayments(ps,rs,[{paymentId:'p1',receiptId:'r1',amount:'41',confirmed:true}]));
assert.throws(()=>reconcilePayments(ps,[{...rs[0],currency:'USD'}],[{paymentId:'p1',receiptId:'r1',amount:'1',confirmed:true}]));
assert.throws(()=>reconcilePayments(ps,[{...rs[0],direction:'credit'}],[{paymentId:'p1',receiptId:'r1',amount:'1',confirmed:true}]));
assert.throws(()=>reconcilePayments([ps[0],ps[0]],rs,[]));
assert.equal(paymentSuggestions(ps,rs)[0].reason,'reference');assert.equal(paymentSuggestions([pay('a','20','prefixRE-001suffix')],rs)[0].receiptIds.length,0);
assert.deepEqual(paymentSuggestions([pay('a','100')],[rs[0],rec('r2','100')])[0].receiptIds,['r1','r2']);
console.log('PASS: exact cents, partial/unconfirmed payments, overpayment, ambiguous references and invalid allocations.');
const {blankInvoice,invoiceCii,invoiceTotals,validateInvoiceDraft,renderInvoiceDraft,validIban,draftFromInvoice}=await import('../.cache/growth030/invoice-create.mjs');
const {parseInvoice}=await import('../.cache/growth030/invoice-engine.mjs');
const d=blankInvoice();Object.assign(d,{number:'FICTIONAL-030',date:'2026-11-09',delivery:'2026-11-08',due:'2026-12-09',reference:'TEST-REVIEW',iban:'DE89370400440532013000',note:'Fiktives Testdokument – keine echte Forderung.'});
Object.assign(d.seller,{name:'Fiktive Küstenwerkstatt GmbH',street:'Musterstraße 1',postcode:'28195',city:'Bremen',country:'DE',email:'invoice@example.org',vatId:'DE123456789',contact:'Erika Muster',phone:'+49 421 000000'});
Object.assign(d.buyer,{name:'Fiktiver Kunde & Partner',street:'Beispielweg 2',postcode:'20095',city:'Hamburg',country:'DE',email:'buyer@example.org'});
d.lines=[{name:'Fiktive Dienstleistung',quantity:'2',price:'50.00',tax:'19',unit:'HUR',exemption:''},{name:'Fiktive Lieferung',quantity:'1',price:'10.00',tax:'7',unit:'C62',exemption:''}];
assert.equal(invoiceTotals(d).gross,12970n);assert(validIban(d.iban));assert(!validIban(d.iban.slice(0,-1)+'1'));
for(const mutate of [x=>x.date='2026-02-30',x=>x.due='2026-10-01',x=>x.iban='DE00000000000000000000',x=>x.seller.contact='',x=>x.lines[0].quantity='1e3',x=>x.lines[0].unit='BAD',x=>x.reference='',x=>x.lines[0].name='bad\u0000']){const bad=structuredClone(d);mutate(bad);assert.throws(()=>validateInvoiceDraft(bad,'xrechnung'));}
const originalFetch=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(String(url),'/vendor/invoice-font/NotoSans-Regular.ttf');return new Response(await readFile('public'+url));};
async function open(bytes){return pdfjs.getDocument({data:bytes.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;}
async function textOf(pdf){let text='';for(let p=1;p<=pdf.numPages;p++)text+=(await(await pdf.getPage(p)).getTextContent()).items.map(x=>x.str||'').join(' ')+' ';return text;}
for(const profile of ['xrechnung','zugferd'])for(const kind of ['standard','rounding','exempt']){const draft=structuredClone(d);if(kind==='rounding')draft.lines=[{...d.lines[0],quantity:'0.3333',price:'10.0050'}];if(kind==='exempt')draft.lines=[{...d.lines[0],tax:'0',exemption:'Steuerbefreite fiktive Leistung'}];const xml=invoiceCii(draft,profile),parsed=parseInvoice(xml);assert.equal(parsed.number,draft.number);assert.equal(parsed.totals.gross,kind==='standard'?'129.70':kind==='rounding'?'3.96':'100.00');assert.equal(draftFromInvoice(parsed).lines.length,draft.lines.length);await writeFile(`.cache/growth-fixtures/${profile}-${kind}.xml`,xml);}
const draftPdf=await renderInvoiceDraft(d);await writeFile('.cache/growth-fixtures/invoice.pdf',draftPdf);await writeFile('.cache/growth-fixtures/invoice.json',JSON.stringify(d,null,2));const invoice=await open(draftPdf);assert.match(await textOf(invoice),/129.70/);assert.match(await textOf(invoice),/Küstenwerkstatt/);await invoice.loadingTask.destroy();
const long=structuredClone(d);long.lines=Array.from({length:30},(_,i)=>({...d.lines[0],name:`Position ${i+1}: `+'ÄÖÜ € Beschreibung '.repeat(8)}));const longPdf=await open(await renderInvoiceDraft(long));assert(longPdf.numPages>3);assert.match(await textOf(longPdf),/Position 30:/);await longPdf.loadingTask.destroy();
await assert.rejects(()=>renderInvoiceDraft({...d,note:'漢字'}),/Zeichen/);await assert.rejects(()=>renderInvoiceDraft(d,AbortSignal.abort()));
console.log('PASS: invoice cents and tax rounding, profiles, XML import, invalid data, multipage Unicode rendering and cancellation.');
const {createPortfolio}=await import('../.cache/growth030/pdf-portfolio.mjs');
const files=[{name:'Rechnung.pdf',bytes:draftPdf,type:'application/pdf',description:'Fiktive Rechnung'},{name:'Rechnung.pdf',bytes:Uint8Array.from([0,1,2,255]),type:'application/octet-stream',description:'Binäre Testdaten'},{name:'../Test.eml',bytes:new TextEncoder().encode('Subject: Fictional\n\nTest'),type:'message/rfc822',description:''}];
const output=await createPortfolio(files,'Testportfolio',{signal:new AbortController().signal,report:()=>{}}),portfolioBytes=new Uint8Array(await output.blob.arrayBuffer()),portfolio=await open(portfolioBytes),attachments=await portfolio.getAttachments();assert.equal(attachments.size,3);
const names=[...attachments.keys()];for(let i=0;i<files.length;i++){const name=names.find(n=>i===0?n==='Rechnung.pdf':i===1?n==='2-Rechnung.pdf':n.endsWith('Test.eml'));assert(name);assert.deepEqual(new Uint8Array(await portfolio.getAttachmentContent(name)),files[i].bytes);assert((await textOf(portfolio)).includes(createHash('sha256').update(files[i].bytes).digest('hex')));}
assert((await PDFDocument.load(portfolioBytes)).catalog.lookup(PDFName.of('Collection'),PDFDict));await portfolio.loadingTask.destroy();await assert.rejects(()=>createPortfolio([],'Empty',{signal:new AbortController().signal,report:()=>{}}));await assert.rejects(()=>createPortfolio(files,'Abort',{signal:AbortSignal.abort(),report:()=>{}}));
const {detectPersonalData}=await import('../.cache/growth030/personal-data.mjs');const pii=detectPersonalData([{lines:[{text:'Name: Erika Muster'},{text:'Kontakt: erika@example.org'},{text:'IBAN: DE89 3704 0044 0532 0130 00'}]},{lines:[{text:'Name: Erika Muster'},{text:'erika@example.org'}]}]);assert.equal(pii.filter(x=>x.term==='Erika Muster').length,1);assert(pii.some(x=>x.replacement==='[IBAN 1]'));assert(pii.some(x=>x.term==='erika@example.org'));assert.equal(detectPersonalData([{lines:[{text:'Erika Muster'}]}]).length,0);
const labeledPii=detectPersonalData([{lines:[{text:'IBAN: DE89 3704 0044 0532 0130 00 BIC COBADEFFXXX'},{text:'USt-IdNr.: DE123456789'},{text:'Steuernummer: 60/272/12345'},{text:'IBAN: DE89 3704 0044 0532 0130 01 BIC COBADEFFXXX'}]}]);
assert(labeledPii.some(x=>x.term==='DE89 3704 0044 0532 0130 00'));
assert(labeledPii.some(x=>x.term==='DE123456789'&&x.replacement.startsWith('[Steuerangabe')));
assert(labeledPii.some(x=>x.term==='60/272/12345'));
assert.equal(labeledPii.filter(x=>x.replacement.startsWith('[IBAN')).length,1);
console.log('PASS: real PDF Collection, exact attachments, safe duplicate names, SHA-256 contents and consistent local personal-data suggestions.');
const core=await import('../.cache/growth030/native-pdf-core.mjs'),{assignPdfLayer}=await import('../.cache/growth030/pdf-layer-edit.mjs');const api=await core.createNativeEngine(new Uint8Array(await readFile('node_modules/@embedpdf/pdfium/dist/pdfium.wasm')));
const document=await PDFDocument.create(),page=document.addPage([200,200]),font=await document.embedFont(StandardFonts.Helvetica);page.drawRectangle({x:20,y:20,width:70,height:70,color:rgb(1,0,0)});page.drawRectangle({x:40,y:40,width:70,height:70,color:rgb(0,0,1)});page.drawText('KEEP',{x:20,y:150,font,size:12});const input=await document.save();
async function view(bytes,hide=false){const pdf=await open(bytes);try{const page=await pdf.getPage(1),config=await pdf.getOptionalContentConfig();if(hide)for(const id of Array.from(config, ([id]) => id))config.setVisibility(id,false);const canvas=createCanvas(200,200);await page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale:1}),optionalContentConfigPromise:Promise.resolve(config)}).promise;return {pixel:[...canvas.getContext('2d').getImageData(60,140,1,1).data],text:await textOf(pdf),ids:Array.from(config, ([id]) => id),pixels:canvas.getContext('2d').getImageData(0,0,200,200).data};}finally{await pdf.loadingTask.destroy();}}
let objects=core.inspectNativeObjects(api,input,0),blue=objects.filter(o=>o.type==='path')[1];assert(blue);const layered=await assignPdfLayer(api,input,{page:0,indices:[blue.index],target:'new',name:'Blau'});assert.deepEqual((await view(layered)).pixels,(await view(input)).pixels);assert.deepEqual((await view(layered,true)).pixel,[255,0,0,255]);assert.match((await view(layered,true)).text,/KEEP/);
const id=(await view(layered)).ids[0];objects=core.inspectNativeObjects(api,layered,0);const red=objects.filter(o=>o.type==='path')[0];const both=await assignPdfLayer(api,layered,{page:0,indices:[red.index],target:id,name:''});assert.deepEqual((await view(both,true)).pixel,[255,255,255,255]);
objects=core.inspectNativeObjects(api,both,0);const unlayered=await assignPdfLayer(api,both,{page:0,indices:[objects.filter(o=>o.type==='path')[1].index],target:'none',name:''});assert.deepEqual((await view(unlayered,true)).pixel,[0,0,255,255]);
await assert.rejects(()=>assignPdfLayer(api,input,{page:0,indices:[9999],target:'new',name:'Bad'}));await assert.rejects(()=>assignPdfLayer(api,input,{page:0,indices:[blue.index],target:'999R',name:''}));
const empty=await assignPdfLayer(api,input,{page:0,indices:[],target:'new',name:'Leer'});assert.equal((await view(empty)).ids.length,1);assert.deepEqual((await view(empty)).pixels,(await view(input)).pixels);
globalThis.fetch=originalFetch;await writeFile('.cache/growth-fixtures/layers.pdf',layered);console.log('PASS: native objects assigned to real OCGs, exact visible pixels, hide/reassign/remove, unchanged surrounding content and empty layers.');
