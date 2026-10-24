import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { DOMParser } from '@xmldom/xmldom';
import { englishTranslator } from './translation-test-utils.mjs';
import { createWorker, PSM } from 'tesseract.js';

const require = createRequire(import.meta.url);
const pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
const { createCanvas, DOMMatrix, Path2D, ImageData } = pdfRequire('@napi-rs/canvas');
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData, document: { createElement(tag) {
  assert.equal(tag, 'canvas');
  const canvas = createCanvas(1, 1);
  canvas.toBlob = (callback) => callback(new Blob([canvas.toBuffer('image/png')], { type: 'image/png' }));
  return canvas;
} } });
const folder = '.cache/word-layout';
await mkdir(folder, { recursive: true });
for (const filename of await readdir('lib')) {
  if (!filename.endsWith('.ts')) continue;
  const code = ts.transpileModule(await readFile(`lib/${filename}`, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
    .replace(/(['"])\.\/([a-z0-9-]+)\1/g, (_, q, n) => `${q}./${n}.mjs${q}`);
  await writeFile(`${folder}/${filename.replace(/\.ts$/, '.mjs')}`, code);
}
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const assets = dirname(require.resolve('pdfjs-dist/package.json'));
const { readWordLayoutPage } = await import('../.cache/word-layout/word-layout-source.mjs');
const { wordLayoutSection, packWordLayout } = await import('../.cache/word-layout/word-layout.mjs');
const { createLayoutWordFile } = await import('../.cache/word-layout/word-export.mjs');
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const picture = createCanvas(100, 80), ctx = picture.getContext('2d');
ctx.fillStyle = '#d82040'; ctx.fillRect(0, 0, 100, 80);
ctx.fillStyle = '#006d68'; ctx.fillRect(10, 10, 40, 60);
const image = await doc.embedPng(picture.toBuffer('image/png'));
const portrait = doc.addPage([500, 700]);
portrait.drawText('MoinPDF Layout Test', { x: 40, y: 640, size: 24, font: bold, color: rgb(0, .4, .4) });
portrait.drawImage(image, { x: 340, y: 470, width: 120, height: 96 });
for (let i = 0; i < 6; i++) {
  portrait.drawText(`Left column line ${i+1}`, { x: 40, y: 570 - i * 20, size: 12, font });
  portrait.drawText(`Right ${i+1}`, { x: 260, y: 570 - i * 20, size: 12, font });
}
for (let i = 0; i < 4; i++) portrait.drawLine({ start: { x: 40, y: 400-i*30 }, end: { x: 460, y: 400-i*30 }, thickness: 1 });
for (const x of [40, 250, 460]) portrait.drawLine({ start: { x, y: 310 }, end: { x, y: 400 }, thickness: 1 });
portrait.drawText('Table cell A', { x: 50, y: 380, size: 12, font });
portrait.drawText('123,45 EUR', { x: 265, y: 350, size: 12, font });
portrait.drawText('Rotated text', { x: 100, y: 100, size: 14, font, rotate: degrees(30) });
const landscape = doc.addPage([500, 700]);
landscape.setRotation(degrees(90));
landscape.drawText('Rotated page', { x: 45, y: 610, size: 18, font });
landscape.drawImage(image, { x: 250, y: 450, width: 120, height: 96 });
const blank = doc.addPage([400, 300]);
const bytes = new Uint8Array(await doc.save());
await writeFile(`${folder}/fixture.pdf`, bytes);
const loading = pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl: assets + '/standard_fonts/', cMapUrl: assets + '/cmaps/', cMapPacked: true, fontExtraProperties: true });
const pdf = await loading.promise;
const source = { id: 'fixture', name: 'fixture.pdf', bytes, pdf, size: bytes.length, kind: 'pdf' };
const signal = new AbortController().signal;
let ocrCalls = 0;
const recognizer = { async recognize() { ocrCalls++; return { blocks: [] }; }, async dispose() {} };
try {
  const pages = [];
  for (let i = 0; i < 3; i++) pages.push(await readWordLayoutPage(source, i, signal, { recognizer }));
  assert.equal(pages[0].text.length, 15);
  assert.equal(pages[1].width, 700); assert.equal(pages[1].height, 500);
  assert.equal(pages[2].imageOnly, true); assert.equal(ocrCalls, 1);
  assert(pages[0].text.some(t => t.bold && t.color === '#006666'));
  assert.equal(pages[0].preservedText, 1); assert.equal(pages[1].imageOnly, true);
  const bg = await pdfRequire('@napi-rs/canvas').loadImage(pages[0].background);
  const check = createCanvas(bg.width, bg.height), g = check.getContext('2d'); g.drawImage(bg, 0, 0);
  // Editable title pixels really disappear from the graphic background.
  const region = g.getImageData(35*3, 35*3, 300*3, 40*3).data;
  assert(!region.some((v,i) => i%4 !== 3 && v < 245), 'Native text is absent from the background');
  const pixel = g.getImageData(450*3, 150*3, 1, 1).data;
  assert(pixel[0] > 180 && pixel[1] < 80, 'The embedded image is retained in its original position');
  const line = g.getImageData(100*3, 300*3, 1, 1).data;
  assert(line[0] < 100, 'Table lines are retained');
  const output = await packWordLayout(pages.map(wordLayoutSection), signal);
  await writeFile(`${folder}/fixture.docx`, new Uint8Array(await output.arrayBuffer()));
  await writeFile(`${folder}/background.png`, pages[0].background);
  const zip = await JSZip.loadAsync(await output.arrayBuffer());
  const xml = await zip.file('word/document.xml').async('string');
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  assert.equal(parsed.getElementsByTagName('w:sectPr').length, 3, 'Three original pages remain three sections');
  assert.equal(parsed.getElementsByTagName('w:txbxContent').length, 15, 'Native text uses editable text boxes');
  assert.equal(parsed.getElementsByTagName('pic:pic').length, 3, 'Every page retains its graphics');
  assert.equal((xml.match(/MoinPDF Layout Test/g)||[]).length, 1, 'Text is not duplicated');
  assert.match(xml, /w:sz w:val="48"/); assert.match(xml, /w:color w:val="006666"/);
  assert.match(xml, /w:orient="landscape"/); assert.match(xml, /w:w="14000" w:h="10000"/);
  assert.doesNotMatch(xml, /Rotated text|Rotated page/);
  assert.doesNotMatch(xml, /w:vanish/);
  await assert.rejects(() => readWordLayoutPage(source, 0, AbortSignal.abort(), { recognizer }), { name: 'AbortError' });
  await assert.rejects(() => packWordLayout([], AbortSignal.abort()), { name: 'AbortError' });
  await assert.rejects(() => createLayoutWordFile({pdf:{numPages:201}},signal), /200/);
  assert.throws(() => wordLayoutSection({...pages[0],width:2000}), /Seitenformat/);
  const translate = await englishTranslator();
  assert.equal(translate('Seitenlayout mit Bildern'), 'Page layout with images');
  assert.match(translate('2 Seiten per OCR für Word aufbereitet. Erkannte Texte und Bildbereiche bitte kontrollieren.'), /OCR: 2/);
  console.log('PASS: real PDF extraction, separate graphics, editable styled text, columns/table positions, image and blank pages, rotated text/pages, page dimensions, limits and cancellation.');
} finally { await loading.destroy(); }

// A real OCR pass verifies that scanned letters are replaced rather than
// duplicated and that nearby artwork survives. All content is fictional.
const scanCanvas = createCanvas(1200, 750), sg = scanCanvas.getContext('2d');
sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, 1200, 750);
sg.fillStyle = '#000000'; sg.font = '60px sans-serif';
sg.fillText('Scan sample 2026', 90, 180);
sg.fillStyle = '#d82040'; sg.fillRect(900, 360, 180, 240);
const scanDoc = await PDFDocument.create();
scanDoc.addPage([400, 250]).drawImage(await scanDoc.embedPng(scanCanvas.toBuffer('image/png')), { x: 0, y: 0, width: 400, height: 250 });
const scanBytes = new Uint8Array(await scanDoc.save());
await writeFile(`${folder}/scan.pdf`, scanBytes);
const scanLoading = pdfjs.getDocument({data:scanBytes.slice(),standardFontDataUrl:assets+'/standard_fonts/',fontExtraProperties:true});
const scanSource = {...source,bytes:scanBytes,pdf:await scanLoading.promise,name:'scan.pdf'};
const worker = await createWorker('eng', 1, {langPath:resolve('public/vendor/languages'),cacheMethod:'none'});
let recognized;
const realRecognizer = {async recognize(canvas) {
  await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO});
  recognized = (await worker.recognize(canvas.toBuffer('image/png'),{}, {text:true,blocks:true})).data;
  return recognized;
},async dispose(){}};
try {
  const result = await readWordLayoutPage(scanSource,0,signal,{recognizer:realRecognizer});
  assert.equal(result.ocr,true);
  assert.match(result.text.map(t=>t.text).join(' '),/Scan sample 2026/);
  const background = await pdfRequire('@napi-rs/canvas').loadImage(result.background);
  const check = createCanvas(background.width,background.height), cg=check.getContext('2d');cg.drawImage(background,0,0);
  const ink = cg.getImageData(75,105,650,85).data;
  assert(ink.filter((v,i)=>i%4!==3&&v<100).length<100,'Recognised scan letters are removed from the background');
  assert(cg.getImageData(950,400,1,1).data[0]>180,'Scan picture survives text replacement');
  await writeFile(`${folder}/scan.docx`,new Uint8Array(await (await packWordLayout([wordLayoutSection(result)],signal)).arrayBuffer()));
  const rotated = structuredClone(recognized);
  for(const block of rotated.blocks)for(const p of block.paragraphs)for(const line of p.lines)line.baseline={x0:0,y0:0,x1:0,y1:100};
  const preserved = await readWordLayoutPage(scanSource,0,signal,{recognizer:{...realRecognizer,recognize:async()=>rotated}});
  assert.equal(preserved.text.length,0,'Sideways OCR remains visible as artwork');
  assert(preserved.preservedText>0);
  console.log('PASS: actual scan OCR, visible editable text, no duplicate scan lettering, retained picture and sideways OCR fallback.');
} finally {await worker.terminate();await scanLoading.destroy();}

const formDoc=await PDFDocument.create(), formPage=formDoc.addPage([400,300]);
formPage.drawText('Native heading',{x:30,y:250,size:18});
const field=formDoc.getForm().createTextField('fixture');field.setText('Visible form value');field.addToPage(formPage,{x:30,y:150,width:250,height:40});
const formBytes=new Uint8Array(await formDoc.save());
const formLoading=pdfjs.getDocument({data:formBytes.slice(),standardFontDataUrl:assets+'/standard_fonts/',fontExtraProperties:true});
try {
  const result=await readWordLayoutPage({...source,pdf:await formLoading.promise,bytes:formBytes},0,signal,{recognizer});
  assert(result.text.some(t=>t.text==='Native heading'));
  const background=await pdfRequire('@napi-rs/canvas').loadImage(result.background);
  const check=createCanvas(background.width,background.height),cg=check.getContext('2d');cg.drawImage(background,0,0);
  assert(cg.getImageData(110,350,650,80).data.some((v,i)=>i%4!==3&&v<100),'Form appearance text remains in page artwork');
  console.log('PASS: form annotation appearance is retained independently of editable body text.');
}finally{await formLoading.destroy();}
