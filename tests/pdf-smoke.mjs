import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PDFDocument, PDFName, StandardFonts, degrees } from 'pdf-lib';
import JSZip from 'jszip';
await mkdir('.cache', {recursive:true});
for (const name of ['ocr-languages', 'pdf-engine']) {
  const source = await readFile(`lib/${name}.ts`, 'utf8');
  await writeFile(`.cache/${name}-test.mjs`, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/(['"])\.\/ocr-languages\1/g, '$1./ocr-languages-test.mjs$1'));
}
const { runJob, selectRange, makeDemoFile } = await import('../.cache/pdf-engine-test.mjs');
const a = await PDFDocument.create(), b = await PDFDocument.create();
const font = await a.embedFont(StandardFonts.Helvetica);
a.addPage([595,842]).drawText('Erste Seite - Rechnung 335,00 EUR', {font,size:18,x:40,y:750});
a.addPage([500,700]).drawText('Zweite Seite', {font,size:18,x:40,y:600});
b.addPage([300,600]).setRotation(degrees(90));
const bytesA = await a.save(), bytesB = await b.save();
const sources = [{id:'a',name:'A.pdf',bytes:bytesA,size:bytesA.length},{id:'b',name:'B.pdf',bytes:bytesB,size:bytesB.length}];
const pages = [{id:'b0',sourceId:'b',index:0,rotation:90,selected:true},{id:'a1',sourceId:'a',index:1,rotation:0,selected:true},{id:'a0',sourceId:'a',index:0,rotation:270,selected:true}];
const options = {language:'deu',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'ENTWURF',numberStart:7};
const execute = (tool, items=pages, config=options, signal=new AbortController().signal) => runJob(tool,sources,items,config,()=>{},signal);
const load = async result => PDFDocument.load(await result.blob.arrayBuffer());
const merged=await load(await execute('merge'));
assert.equal(merged.getPageCount(),3);
assert.deepEqual(merged.getPages().map(p=>[p.getWidth(),p.getHeight(),p.getRotation().angle]), [[300,600,180],[500,700,0],[595,842,270]]);
const extracted=await load(await execute('organize',[pages[1]]));
assert.equal(extracted.getPageCount(),1); assert.equal(extracted.getPage(0).getWidth(),500);
const zip=await JSZip.loadAsync(await (await execute('split')).blob.arrayBuffer());
assert.equal(Object.keys(zip.files).length,3);
for (const part of Object.values(zip.files)) assert.equal((await PDFDocument.load(await part.async('uint8array'))).getPageCount(),1);
for (const tool of ['numbers','watermark','images']) assert.equal((await load(await execute(tool))).getPageCount(),3);
await assert.rejects(()=>execute('watermark',pages,{...options,watermark:'😀'}), /Sonderzeichen/);
await assert.rejects(()=>execute('merge',[]), /mindestens/);
await assert.rejects(()=>execute('merge',pages,options,AbortSignal.abort()), /Abgebrochen/);
assert.deepEqual([...selectRange('1, 3-5',5)], [0,2,3,4]);
for (const invalid of ['0','6','3-1','1,','a']) assert.throws(()=>selectRange(invalid,5));
const xfaDoc=await PDFDocument.load(bytesA),xfaStream=xfaDoc.context.register(xfaDoc.context.flateStream('<xdp/>'));
xfaDoc.catalog.set(PDFName.of('AcroForm'),xfaDoc.context.obj({Fields:[],XFA:xfaStream}));
const xfaBytes=await xfaDoc.save({updateFieldAppearances:false}),xfaSource={...sources[0],bytes:xfaBytes};
for(const tool of ['merge','organize','split','numbers','watermark'])await assert.rejects(()=>runJob(tool,[xfaSource],[pages[1]],options,()=>{},new AbortController().signal),/XFA/);
console.log('PASS: merge order, original + added rotation, selected-page export, ZIP splitting, numbering, watermark, image-page assembly, Unicode validation, cancellation and invalid ranges.');

// Exercise the generated scan, including the text actually drawn on each image.
const require = createRequire(import.meta.url);
const { createCanvas } = createRequire(require.resolve('pdfjs-dist/package.json'))('@napi-rs/canvas');
const previousDocument = globalThis.document;
let drawnPages;
globalThis.document = {createElement(name) {
  assert.equal(name, 'canvas');
  const canvas = createCanvas(1, 1), ctx = canvas.getContext('2d'), lines = [];
  drawnPages.push(lines);
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y) => {
    assert.ok(x >= 0 && x + ctx.measureText(text).width < canvas.width - 50, `Sample text overflows: ${text}`);
    assert.ok(y > 0 && y < canvas.height - 50, `Sample text overflows vertically: ${text}`);
    lines.push(text);
    fillText(text, x, y);
  };
  return canvas;
}};
try {
  for (const language of [undefined, 'en', 'de']) {
    drawnPages = [];
    const file = await makeDemoFile(language), english = language === 'en';
    assert.equal(file.name, english ? 'Sample-Scan.pdf' : 'Beispiel-Scan.pdf');
    assert.equal(file.type, 'application/pdf');
    const sample = await PDFDocument.load(await file.arrayBuffer());
    assert.equal(sample.getPageCount(), 2);
    assert.deepEqual(drawnPages.map(lines => lines[0]), english ? ['Sample invoice', 'Project overview'] : ['Musterrechnung', 'Projektübersicht']);
    const text = drawnPages.flat().join('\n');
    for (const phrase of english ? ['4 October 2026', '335.00 EUR', 'sample data only', 'text recognition'] : ['04.10.2026', '335,00 EUR', 'ausschließlich Beispieldaten', 'Texterkennung']) assert.ok(text.includes(phrase), phrase);
    assert.equal(/Musterrechnung|Projektübersicht|Beispieldokument|Gesamtbetrag|Vielen Dank/.test(text), !english);
    for (const page of sample.getPages()) {
      assert.equal(page.getWidth(), 595.28);
      assert.equal(page.getHeight(), 841.89);
      const resources = page.node.Resources();
      assert.equal(resources.lookup(PDFName.of('XObject')).keys().length, 1, 'Each sample page remains an image for OCR');
      assert.equal(resources.lookup(PDFName.of('Font')).keys().length, 0, 'Do not replace the scan with searchable text');
    }
  }
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}
console.log('PASS: DE/EN sample PDF filenames, invoice and project content, locale formats, page bounds, scan images and German default.');
