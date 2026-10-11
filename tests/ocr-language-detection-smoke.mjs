import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {createWorker,PSM} from 'tesseract.js';
import ts from 'typescript';
import {languageFixtures} from './ocr-language-fixtures.mjs';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json')),{createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
await mkdir('.cache',{recursive:true});
await writeFile('.cache/ocr-language-detection-test.mjs',ts.transpileModule(await readFile('lib/ocr-language-detection.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {detectOcrLanguages}=await import('../.cache/ocr-language-detection-test.mjs');
for(const [lang,text] of Object.entries(languageFixtures).filter(([l])=>l!=='rus')) assert.deepEqual(detectOcrLanguages(text,98),[lang]);
assert.throws(()=>detectOcrLanguages(languageFixtures.rus,95),/eindeutig/,'Close Russian/Bulgarian candidates are deliberately not guessed');
assert.throws(()=>detectOcrLanguages('123456 789,00\nAnna\nHallo Welt',99),/wenig/);
assert.throws(()=>detectOcrLanguages(languageFixtures.deu,35),/unsicher/);
assert.deepEqual(detectOcrLanguages('Dette dokument indeholder vigtige oplysninger om levering og betaling som skal behandles fortroligt af modtageren og alle medarbejdere i virksomheden.',90),['dan']);
const all=['deu','eng','fra','spa','ita','por','nld','pol','ces','dan','swe','nor','fin','tur','ukr','rus','ara','chi_sim','jpn','kor','hin'];
const rendered=[];
for(const lang of ['deu','eng','fra','spa','ita']) {
 const c=createCanvas(2800,250),ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';ctx.font='28px DejaVu Sans';
 const sentences=languageFixtures[lang].match(/[^.]+\./g);sentences.forEach((line,i)=>ctx.fillText(line.trim(),20,55+i*65));
 rendered.push({lang,bytes:c.toBuffer('image/png')});
}
const probe=await createWorker(all,1,{langPath:resolve('public/vendor/languages'),cacheMethod:'none'});const decisions=[];
try {await probe.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});for(const sample of rendered){const {data}=await probe.recognize(sample.bytes);const selected=detectOcrLanguages(data.text,data.confidence);assert.deepEqual(selected,[sample.lang],JSON.stringify(data.text));decisions.push({...sample,selected});}}finally{await probe.terminate();}
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
for(const sample of decisions){const worker=await createWorker(sample.selected,1,{langPath:resolve('public/vendor/languages'),cacheMethod:'none'});try{const {data}=await worker.recognize(sample.bytes,{},{text:true,pdf:true});assert(data.pdf?.length>1000);const pdf=await pdfjs.getDocument({data:new Uint8Array(data.pdf),standardFontDataUrl:assets+'/standard_fonts/'}).promise;try{assert.equal(pdf.numPages,1);const text=(await(await pdf.getPage(1)).getTextContent()).items.filter(i=>'str'in i).map(i=>i.str).join(' ');assert(text.length>100);assert(text.includes({deu:'Lieferung',eng:'delivery',fra:'livraison',spa:'entrega',ita:'consegna'}[sample.lang]));}finally{await pdf.loadingTask.destroy();}}finally{await worker.terminate();}}
console.log('PASS: actual 21-model probe OCR → five language decisions → final per-language OCR/PDF; Arabic text classification, low-confidence/short/ambiguous abstention. No universal accuracy claim.');
