import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
import JSZip from 'jszip';
import { englishTranslator } from './translation-test-utils.mjs';

await mkdir('.cache',{recursive:true});
for(const name of ['pdf-text','import-routing','word-export']){
 const source=await readFile(`lib/${name}.ts`,'utf8');
 await writeFile(`.cache/${name}-test.mjs`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/pdf-text\1/g, '$1./pdf-text-test.mjs$1'));
}
const {conversionToolForFile}=await import('../.cache/import-routing-test.mjs');
for(const ext of ['doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp','pages','vsd','vsdx','pub'])assert.equal(conversionToolForFile(`Büro.${ext.toUpperCase()}`),'office-pdf');
assert.equal(conversionToolForFile('Nachricht.EML'),'email-pdf');
assert.equal(conversionToolForFile('Nachricht.msg'),'email-pdf');
assert.equal(conversionToolForFile('Seite.HTML'),'html-pdf');
assert.equal(conversionToolForFile('Buch.EPUB'),'ebook-pdf');
assert.equal(conversionToolForFile('Buch.epub.exe'),null);
for(const name of ['Rechnung.pdf','Rechnung.xml','Scan.png','malicious.docx.exe','notes.docx.pdf'])assert.equal(conversionToolForFile(name),null);

const {createTextWordFile}=await import('../.cache/word-export-test.mjs');
const pages=[[
 {str:'Moin & Grüße',hasEOL:true},{str:'Rechnung',hasEOL:false},{str:'335,00 EUR',hasEOL:true}
],[{str:'Zweite Seite',hasEOL:true}]];
const document={name:'Muster.pdf',pdf:{numPages:2,getPage:async n=>({streamTextContent:()=>new ReadableStream({start(c){c.enqueue({items:pages[n-1],styles:{},lang:null});c.close();}})})}};
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
await assert.rejects(()=>createTextWordFile({name:'Scan.pdf',pdf:{numPages:1,getPage:async()=>({streamTextContent:()=>new ReadableStream({start(c){c.enqueue({items:[],styles:{},lang:null});c.close();}})})}},new AbortController().signal,{recognizePage:async()=>[]}),/OCR/);
console.log('PASS: direct Office/email/HTML import, format direction, valid DOCX, Unicode, page boundaries, cancellation and scanned-PDF guidance.');

const mixed={name:'Mixed.pdf',pdf:{numPages:2,getPage:async n=>({streamTextContent:()=>new ReadableStream({start(c){c.enqueue({items:n===1?pages[0]:[],styles:{},lang:null});c.close();}})})}};
let recognized=[];
const mixedOutput=await createTextWordFile(mixed,new AbortController().signal,{recognizePage:async index=>{recognized.push(index);return ['Erkannter Scantext'];}});
const mixedXml=await(await JSZip.loadAsync(await mixedOutput.blob.arrayBuffer())).file('word/document.xml').async('string');
assert.deepEqual(recognized,[1]);assert.match(mixedXml,/Moin &amp; Grüße/);assert.match(mixedXml,/Erkannter Scantext/);assert.match(mixedOutput.note,/Eine Seite per OCR/);
const translate = await englishTranslator();
assert.match(translate(output.note), /^Editable text\./);
assert.match(translate(mixedOutput.note), /One page processed with OCR; please review the recognised text\./);
assert.doesNotMatch(translate(mixedOutput.note), /Bearbeitbarer|Seite|kontrollieren/);
const blankOutput = await createTextWordFile(mixed, new AbortController().signal, {recognizePage: async () => []});
assert.match(translate(blankOutput.note), /No text was recognised on one page\./);
assert.equal(translate('2 Seiten per OCR in bearbeitbare Absätze umgewandelt. Scanlayout und erkannte Texte bitte kontrollieren. 1 Seiten ohne erkannten Text.'), 'Pages converted to editable paragraphs using OCR: 2. Please review the scan layout and recognised text. Pages with no recognised text: 1.');
console.log('PASS: mixed native/scan Word export retains editable text on every page.');
