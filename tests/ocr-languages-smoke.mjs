import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createWorker,PSM} from 'tesseract.js';
import ts from 'typescript';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas}=pr('@napi-rs/canvas');
await mkdir('.cache',{recursive:true});
await writeFile('.cache/ocr-languages-test.mjs',ts.transpileModule(await readFile('lib/ocr-languages.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText);
const {ocrLanguages,parseOcrLanguages}=await import('../.cache/ocr-languages-test.mjs');
assert.deepEqual(parseOcrLanguages('deu+fra+spa+eng'),['deu','fra','spa','eng']);
for(const invalid of ['', 'deu+deu', 'deu+xxx', '../eng', 'deu+eng+fra+spa+ita+por+nld+pol+ces']) assert.throws(()=>parseOcrLanguages(invalid),/eine bis acht/);
const languages=ocrLanguages.map(([code])=>code).filter(code=>!code.includes('+'));
assert.equal(languages.length,21);
for(const language of languages){
  const worker=await createWorker(language,1,{langPath:resolve('public/vendor/languages'),cacheMethod:'none'});
  try{if(language==='fra'){const canvas=createCanvas(950,130),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,950,130);ctx.fillStyle='#000';ctx.font='52px sans-serif';ctx.fillText('Bonjour le monde',35,85);await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE});const {data}=await worker.recognize(canvas.toBuffer('image/png'));assert.match(data.text,/Bonjour le monde/i);}}
  finally{await worker.terminate();}
}
const mixed=await createWorker(parseOcrLanguages('deu+eng+fra+spa+ita+por+nld+pol'),1,{langPath:resolve('public/vendor/languages'),cacheMethod:'none'});
try {
 const canvas=createCanvas(1600,650),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1600,650);ctx.fillStyle='#000';ctx.font='44px sans-serif';
 ['Guten Morgen aus Hamburg','Hello world','Bonjour le monde','Buenos dias','Buongiorno a tutti','Bom dia Portugal','Goedemorgen Nederland','Dzien dobry Polska'].forEach((text,i)=>ctx.fillText(text,30,65+i*70));
 await mixed.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
 const {data}=await mixed.recognize(canvas.toBuffer('image/png'),{},{text:true,pdf:true});
 for(const text of ['Guten Morgen','Hello world','Bonjour le monde','Buenos','Buongiorno','Bom dia','Goedemorgen','dobry Polska']) assert(data.text.includes(text),`Missing recognized phrase: ${text}; got ${data.text}`);
 assert(data.pdf?.length>1000,'A mixed-language searchable PDF is produced');
} finally { await mixed.terminate(); }
console.log('PASS: all 21 shipped OCR language models initialize offline; French and an eight-language German/English/French/Spanish/Italian/Portuguese/Dutch/Polish scan are actually recognized; invalid/duplicate/excess combinations rejected.');
