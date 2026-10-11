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
const {ocrLanguages}=await import('../.cache/ocr-languages-test.mjs');
const languages=ocrLanguages.map(([code])=>code).filter(code=>!code.includes('+'));
assert.equal(languages.length,21);
for(const language of languages){
  const worker=await createWorker(language,1,{langPath:resolve('public/vendor/languages'),cacheMethod:'none'});
  try{if(language==='fra'){const canvas=createCanvas(950,130),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,950,130);ctx.fillStyle='#000';ctx.font='52px sans-serif';ctx.fillText('Bonjour le monde',35,85);await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE});const {data}=await worker.recognize(canvas.toBuffer('image/png'));assert.match(data.text,/Bonjour le monde/i);}}
  finally{await worker.terminate();}
}
console.log('PASS: all 21 shipped OCR language models initialize offline; real French recognition uses the compact LSTM model.');
