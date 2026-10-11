import { createRequire } from 'node:module';
import { mkdir, copyFile, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const out = path.join(process.cwd(), 'public/vendor');
const tess = path.dirname(require.resolve('tesseract.js/package.json'));
const tessRequire = createRequire(path.join(tess, 'package.json'));
const core = path.dirname(tessRequire.resolve('tesseract.js-core/package.json'));
const pdf = path.dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir(path.join(out, 'ocr'), {recursive:true});
await mkdir(path.join(out, 'pdf'), {recursive:true});
await mkdir(path.join(out, 'languages'), {recursive:true});
await copyFile(path.join(tess, 'dist/worker.min.js'), path.join(out, 'ocr/worker.min.js'));
for (const file of await readdir(core)) {
  if (/^tesseract-core.*\.wasm(\.js)?$/.test(file)) await copyFile(path.join(core,file),path.join(out,'ocr',file));
}
for (const lang of ['deu','eng','fra','spa','ita','por','nld','pol','ces','dan','swe','nor','fin','tur','ukr','rus','ara','chi_sim','jpn','kor','hin']) {
  const dir = path.dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
  await copyFile(path.join(dir,['deu','eng'].includes(lang)?'4.0.0':'4.0.0_best_int',`${lang}.traineddata.gz`),path.join(out,'languages',`${lang}.traineddata.gz`));
}
await copyFile(path.join(pdf,'legacy/build/pdf.worker.min.mjs'),path.join(out,'pdf/pdf.worker.min.mjs'));
for (const dir of ['cmaps','standard_fonts','wasm']) await cp(path.join(pdf,dir),path.join(out,'pdf',dir),{recursive:true});
await mkdir(path.join(out, 'licenses'), {recursive:true});
await mkdir(path.join(out, 'pdfium'), {recursive:true});
await copyFile('node_modules/@embedpdf/pdfium/dist/pdfium.wasm',path.join(out,'pdfium/pdfium.wasm'));
await mkdir(path.join(out, 'qpdf'), {recursive:true});
const qpdfDir=path.dirname(require.resolve('@neslinesli93/qpdf-wasm'));
for(const file of ['qpdf.js','qpdf.wasm'])await copyFile(path.join(qpdfDir,file),path.join(out,'qpdf',file));
let copyright='';
const originalLog=console.log;
try{console.log=s=>{copyright+=s+'\n';};const qpdf=await require('@neslinesli93/qpdf-wasm')({});qpdf.callMain(['--copyright']);}finally{console.log=originalLog;}
await (await import('node:fs/promises')).writeFile(path.join(out,'licenses','qpdf-COPYRIGHT.txt'),copyright);
for (const name of ['@embedpdf/pdfium', 'utif', '@bwip-js/browser', '@zxing/library', 'pdfjs-dist', 'tesseract.js', 'pdf-lib', '@pdf-lib/fontkit', 'jszip', 'docx', '@fontsource-variable/manrope', '@fontsource-variable/space-grotesk', ...['deu','eng','fra','spa','ita','por','nld','pol','ces','dan','swe','nor','fin','tur','ukr','rus','ara','chi_sim','jpn','kor','hin'].map(l=>'@tesseract.js-data/'+l)]) {
  const dir = path.resolve('node_modules', name);
  for (const file of await readdir(dir)) {
    if (/^(LICENSE|OFL|NOTICE)(\.|$)/i.test(file)) await copyFile(path.join(dir,file),path.join(out,'licenses',`${name.replaceAll('/', '-')}-${file}`));
  }
}
await mkdir(path.join(out,'images'),{recursive:true});
for(const file of ['libheif.js','libheif.wasm'])await copyFile(path.join('node_modules/libheif-js/libheif-wasm',file),path.join(out,'images',file));
await copyFile('node_modules/ag-psd/dist/bundle.js',path.join(out,'images/ag-psd.js'));
await copyFile('node_modules/ag-psd/LICENSE',path.join(out,'licenses/ag-psd-LICENSE'));
await copyFile('node_modules/libheif-js/LICENSE',path.join(out,'licenses/libheif-js-LICENSE'));
await copyFile('node_modules/libheif-js/libheif-wasm/LICENSE',path.join(out,'licenses/libheif-WASM-LICENSE'));
await mkdir(path.join(out,'llm'),{recursive:true});
await copyFile('node_modules/@wllama/wllama/esm/wasm/wllama.wasm',path.join(out,'llm/wllama.wasm'));
await copyFile('node_modules/@wllama/wllama/LICENCE',path.join(out,'licenses/wllama-LICENCE'));
console.log('Local PDF and OCR assets prepared.');
