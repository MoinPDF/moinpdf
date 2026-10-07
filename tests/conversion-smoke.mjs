import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
import JSZip from 'jszip';

await mkdir('.sites-runtime',{recursive:true});
for(const name of ['import-routing','word-export']){
 const source=await readFile(`lib/${name}.ts`,'utf8');
 await writeFile(`.sites-runtime/${name}-test.mjs`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
}
const {conversionToolForFile}=await import('../.sites-runtime/import-routing-test.mjs');
for(const ext of ['doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp'])assert.equal(conversionToolForFile(`Büro.${ext.toUpperCase()}`),'office-pdf');
assert.equal(conversionToolForFile('Nachricht.EML'),'email-pdf');
assert.equal(conversionToolForFile('Nachricht.msg'),'email-pdf');
assert.equal(conversionToolForFile('Seite.HTML'),'html-pdf');
assert.equal(conversionToolForFile('Buch.EPUB'),'ebook-pdf');
assert.equal(conversionToolForFile('Buch.epub.exe'),null);
for(const name of ['Rechnung.pdf','Rechnung.xml','Scan.png','malicious.docx.exe','notes.docx.pdf'])assert.equal(conversionToolForFile(name),null);

const {createTextWordFile}=await import('../.sites-runtime/word-export-test.mjs');
const pages=[[
 {str:'Moin & Grüße',hasEOL:true},{str:'Rechnung',hasEOL:false},{str:'335,00 EUR',hasEOL:true}
],[{str:'Zweite Seite',hasEOL:true}]];
const document={name:'Muster.pdf',pdf:{numPages:2,getPage:async n=>({getTextContent:async()=>({items:pages[n-1]})})}};
const output=await createTextWordFile(document,new AbortController().signal);
assert.equal(output.filename,'Muster.docx');
const zip=await JSZip.loadAsync(await output.blob.arrayBuffer());
assert.ok(zip.file('[Content_Types].xml'),'Output is an actual Office Open XML document');
const xml=await zip.file('word/document.xml').async('string');
assert.match(xml,/Moin &amp; Grüße/);
assert.match(xml,/Rechnung 335,00 EUR/);
assert.match(xml,/Zweite Seite/);
assert.equal((xml.match(/<w:sectPr>/g)||[]).length,2,'Each source page retains its section');
await assert.rejects(()=>createTextWordFile(document,AbortSignal.abort()),{name:'AbortError'});
await assert.rejects(()=>createTextWordFile({name:'Scan.pdf',pdf:{numPages:1,getPage:async()=>({getTextContent:async()=>({items:[]})})}},new AbortController().signal),/OCR/);
console.log('PASS: direct Office/email/HTML import, format direction, valid DOCX, Unicode, page boundaries, cancellation and scanned-PDF guidance.');
