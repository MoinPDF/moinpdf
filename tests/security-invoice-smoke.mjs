import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {Worker as NodeWorker} from 'node:worker_threads';
import {dirname} from 'node:path';
import {DOMParser} from '@xmldom/xmldom';
import {PDFDocument,PDFName,PDFNumber,PDFDict,StandardFonts} from 'pdf-lib';
import ts from 'typescript';
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {DOMMatrix,Path2D,ImageData}=pdfRequire('@napi-rs/canvas');Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
globalThis.DOMParser=class{parseFromString(xml,type){try{return new DOMParser({onError:()=>{throw Error('XML');}}).parseFromString(xml,type);}catch{return new DOMParser().parseFromString('<parsererror/>',type);}}};
globalThis.Worker=class {constructor(){this.worker=new NodeWorker(new URL('./security-worker-node.cjs',import.meta.url));this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));}postMessage(data,transfer){this.worker.postMessage(data,transfer);}terminate(){void this.worker.terminate();}};
await mkdir('.sites-runtime',{recursive:true});
for(const name of ['pdf-security','invoice-engine'])await writeFile(`.sites-runtime/${name}-test.mjs`,ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {protectPdf,unlockPdf,checkNewPassword,PdfPasswordError}=await import('../.sites-runtime/pdf-security-test.mjs');
const {parseInvoice,checkInvoice,invoiceFromBytes,invoicePdf,invoiceEntries,invoiceCsv,invoiceCheckText}=await import('../.sites-runtime/invoice-engine-test.mjs');
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json')),proxies=[];
async function open(bytes,password){const task=pdfjs.getDocument({data:bytes.slice(),password,standardFontDataUrl:assets+'/standard_fonts/'});try{const pdf=await task.promise;proxies.push(pdf);return pdf;}catch(e){await task.destroy();throw e;}}
const ubl=await readFile('tests/fixtures/invoice-ubl.xml','utf8'),cii=await readFile('tests/fixtures/invoice-cii.xml','utf8');
try{
 const a=parseInvoice(ubl),b=parseInvoice(cii);assert.equal(a.format,'UBL');assert.equal(b.format,'CII');
 for(const inv of [a,b]){assert.equal(inv.number,'123456XX');assert.equal(inv.lines.length,2);assert.equal(inv.date,'2016-04-04');assert.equal(inv.totals.due,'336.9');assert.equal(inv.payment[0].iban,'DE79000000001234567890');assert.equal(inv.checks.filter(c=>c.level==='error').length,0,JSON.stringify(inv.checks));}
 assert.throws(()=>parseInvoice('<xml/>'),/unterstützte/);assert.throws(()=>parseInvoice('<invalid'),/aufgebaut/);assert.throws(()=>parseInvoice('<!DOCTYPE x [<!ENTITY boom "x">]><x/>'),/Entitäten/);assert.throws(()=>parseInvoice('x'.repeat(5*1024*1024+1)),/5 MB/);
 const utf16=new Uint8Array(Buffer.concat([Buffer.from([255,254]),Buffer.from(ubl.replace('UTF-8','UTF-16'),'utf16le')]));assert.equal(invoiceFromBytes(utf16,'utf16.xml').invoice.number,a.number);
 const corrupt=structuredClone(a);corrupt.totals.due='999.00';corrupt.date='2026-02-30';assert(checkInvoice(corrupt).some(c=>c.title==='Zahlbetrag'&&c.level==='error'));assert(checkInvoice(corrupt).some(c=>c.title==='Datumsangaben'&&c.level==='error'));
 corrupt.lines[0].quantity='1e99';assert(checkInvoice(corrupt).some(c=>c.title==='Zahlen und Beträge'&&c.level==='error'));
 assert.equal(checkInvoice(corrupt).find(c=>c.title==='Menge × Preis').level,'warning','Skipped positions must not receive an OK result');
 for(const [xml,pattern] of [[ubl,/<cac:PaymentMeans\b[^>]*>[\s\S]*?<\/cac:PaymentMeans>/g],[cii,/<ram:SpecifiedTradeSettlementPaymentMeans\b[^>]*>[\s\S]*?<\/ram:SpecifiedTradeSettlementPaymentMeans>/g]]){
  const originalTerms=parseInvoice(xml).payment.map(p=>p.terms).filter(Boolean);assert(originalTerms.length>0);
  const withoutBank=parseInvoice(xml.replace(pattern,''));assert.deepEqual(withoutBank.payment.map(p=>p.terms).filter(Boolean),originalTerms,'Payment terms remain readable without bank details');
 }
 const namespaceSpoof=parseInvoice(ubl.replace(/cbc:/g,'fake:').replace('xmlns:cbc=','xmlns:fake=').replace('urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2','urn:wrong'));assert(namespaceSpoof.checks.some(c=>c.level==='error'));
 const credit=ubl.replace(/ubl:Invoice/g,'ubl:CreditNote').replace('xsd:Invoice-2','xsd:CreditNote-2').replace(/cac:InvoiceLine/g,'cac:CreditNoteLine').replace(/cbc:InvoiceTypeCode/g,'cbc:CreditNoteTypeCode').replace(/cbc:InvoicedQuantity/g,'cbc:CreditedQuantity').replace('>380<','>381<');assert.equal(parseInvoice(credit).type,'381');assert.equal(parseInvoice(credit).lines.length,2);
 const csvTest=structuredClone(a);csvTest.lines[0].name='=HYPERLINK("https://example.org")';assert.match(invoiceCsv(csvTest),/'=HYPERLINK/);assert.match(invoiceCheckText(a),/Keine vollständige/);
 const font=await readFile('public/vendor/invoice-font/NotoSans-Regular.ttf'),entry=invoiceFromBytes(new TextEncoder().encode(ubl),'Rechnung.xml');
 const rendered=await invoicePdf(entry,false,font),renderPdf=await open(rendered);assert(renderPdf.numPages>=1);const attached=await renderPdf.getAttachments();assert.equal(attached.get('Rechnung.xml').filename,'Rechnung.xml');assert.deepEqual(new Uint8Array(await renderPdf.getAttachmentContent('Rechnung.xml')),entry.bytes);
 const roundtrip=await invoiceEntries({pdf:renderPdf});assert.equal(roundtrip[0].invoice.number,a.number);
 const text=(await Promise.all(Array.from({length:renderPdf.numPages},async(_,n)=>(await(await renderPdf.getPage(n+1)).getTextContent()).items.filter(x=>'str'in x).map(x=>x.str).join(' ')))).join(' ');assert.match(text,/336.9/);assert.match(text,/Geschäftsbedingungen/);
 const report=await invoicePdf(entry,true,font);assert((await open(report)).numPages>0);
 const source=await PDFDocument.load(rendered);source.setTitle('Test: verschlüsselte Rechnung');const field=source.getForm().createTextField('Referenz');field.setText('Unverändert');field.addToPage(source.getPage(0),{x:45,y:5,width:180,height:14,font:await source.embedFont(StandardFonts.Helvetica)});
 const bytes=await source.save();const original=bytes.slice();
 const settings={password:'Test-Passwort-2026!',ownerPassword:'Test-Berechtigung-2026!',printing:'none',copying:false,editing:false};
 const encrypted=await protectPdf(bytes,settings);assert.deepEqual(bytes,original,'Original bytes retained');
 const encryptedDoc=await PDFDocument.load(encrypted,{ignoreEncryption:true});assert(encryptedDoc.isEncrypted);const enc=encryptedDoc.context.lookup(encryptedDoc.context.trailerInfo.Encrypt,PDFDict);assert.equal(enc.lookup(PDFName.of('R'),PDFNumber).asNumber(),6);assert.equal(enc.lookup(PDFName.of('Length'),PDFNumber).asNumber(),256);
 await assert.rejects(()=>open(encrypted),e=>e.name==='PasswordException');await assert.rejects(()=>open(encrypted,'incorrect'),e=>e.name==='PasswordException');
 const protectedPdf=await open(encrypted,settings.password);const permissions=await protectedPdf.getPermissions();assert(!permissions.has(pdfjs.PermissionFlag.PRINT));assert(!permissions.has(pdfjs.PermissionFlag.COPY));assert(!permissions.has(pdfjs.PermissionFlag.MODIFY_CONTENTS));assert.equal((await protectedPdf.getAttachmentContent('Rechnung.xml')).length,entry.bytes.length);
 await assert.rejects(()=>unlockPdf(encrypted,'incorrect'),e=>e instanceof PdfPasswordError);
 const decrypted=await unlockPdf(encrypted,settings.password),decryptedOwner=await unlockPdf(encrypted,settings.ownerPassword),unlocked=await PDFDocument.load(decrypted);assert(!unlocked.isEncrypted);assert.equal(unlocked.getForm().getTextField('Referenz').getText(),'Unverändert');assert.equal(unlocked.getTitle(),'Test: verschlüsselte Rechnung');assert((await PDFDocument.load(decryptedOwner)).getPageCount()>0);
 const unicode=await protectPdf(bytes,{...settings,password:'Übermäßig-sicher-2026!'});assert((await open(unicode,'Übermäßig-sicher-2026!')).numPages>0);
 const second=await protectPdf(bytes,settings);assert.notDeepEqual(encrypted,second,'Encryption uses fresh randomness');
 assert.throws(()=>checkNewPassword('short'),/8 Zeichen/);assert.throws(()=>checkNewPassword('ö'.repeat(64)),/127/);await assert.rejects(()=>protectPdf(bytes,{...settings,ownerPassword:settings.password}),/unterschiedlich/);await assert.rejects(()=>protectPdf(bytes,settings,AbortSignal.abort()),/Abgebrochen/);
 await writeFile('.sites-runtime/PDF-Passwort-Test.pdf',encrypted);await writeFile('.sites-runtime/E-Rechnung-Leseansicht-Test.pdf',rendered);await writeFile('.sites-runtime/E-Rechnung-Basischeck-Test.pdf',report);
 console.log('PASS: official UBL/CII, credit notes, namespace isolation, dates and total mismatches, malformed/oversized/DTD XML, UTF-16, CSV injection protection, PDF text + unchanged XML roundtrip, AES-256 R6 independently read by PDF.js, wrong/owner/Unicode passwords, permission flags, preserved form/metadata/attachments, unique encryption randomness, input preservation and cancellation.');
}finally{for(const p of proxies)await p.loadingTask.destroy();}
