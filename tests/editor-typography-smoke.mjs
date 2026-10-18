import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import ts from 'typescript';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, degrees, pushGraphicsState, popGraphicsState, beginText, endText, setFontAndSize, setTextMatrix, setCharacterSpacing, setTextRenderingMode, TextRenderingMode, showText } from 'pdf-lib';

const require = createRequire(import.meta.url), pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
const { createCanvas, DOMMatrix, Path2D, ImageData, GlobalFonts } = pdfRequire('@napi-rs/canvas');
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData, document: { createElement(tag) { assert.equal(tag, 'canvas'); return createCanvas(1, 1); } } });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'), assets = dirname(require.resolve('pdfjs-dist/package.json'));
const folder = '.cache/editor-typography'; await mkdir(folder, { recursive: true });
for (const name of ['local-font-bytes','pdf-text','ocr-languages','content-compare','image-codecs','pdf-engine','studio-engine','advanced-types','extra-options','extra-tools','pdf-report','editor-model','editor-analysis','editor-text-layer','editor-fonts','editor-font-cmap','editor-font-catalog','editor-native','native-pdf-core']) {
  const code = ts.transpileModule(await readFile(`lib/${name}.ts`, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/(['"])\.\/([a-z-]+)\1/g, (_, q, n) => `${q}./${n}.mjs${q}`);
  await writeFile(`${folder}/${name}.mjs`, code);
}
await writeFile(folder + '/native-pdf.mjs', `import {readFile} from 'node:fs/promises';import {createNativeEngine,removeNativeRegions} from './native-pdf-core.mjs';let api;export const removeRegions=async(bytes,removals)=>removeNativeRegions(await(api ||= readFile('public/vendor/pdfium/pdfium.wasm').then(b=>createNativeEngine(new Uint8Array(b)))),bytes,removals);`);
const { readTextTargets, editorParagraphs, editorMarkSignature, editorMarkChanged, editorTextCollision, wrapEditorText } = await import('../.cache/editor-typography/editor-model.mjs');
const { resolveEditorFont, originalEditorFont } = await import('../.cache/editor-typography/editor-fonts.mjs');
const { drawEditorText, layoutEditorText } = await import('../.cache/editor-typography/editor-text-layer.mjs');
const { editorFontCatalog, matchingEditorFont } = await import('../.cache/editor-typography/editor-font-catalog.mjs');
const { sfntTables } = await import('../.cache/editor-typography/editor-font-cmap.mjs');
const { runStudioJob, countEdits } = await import('../.cache/editor-typography/studio-engine.mjs');
const originalFetch = globalThis.fetch;
globalThis.fetch = async input => typeof input === 'string' && input.startsWith('/vendor/') ? new Response(process.env.MOINPDF_TEST_COMPRESSED_FONTS ? gzipSync(await readFile('public' + input)) : await readFile('public' + input)) : originalFetch(input);
const proxies = [];
async function source(bytes, name = 'fixture.pdf') {
  const data = new Uint8Array(bytes), pdf = await pdfjs.getDocument({ data: data.slice(), standardFontDataUrl: assets + '/standard_fonts/', cMapUrl: assets + '/cmaps/', cMapPacked: true, fontExtraProperties: true }).promise;
  proxies.push(pdf); return { id: name, name, bytes: data, pdf, size: data.length, kind: 'pdf' };
}
const pageOf = (s, rotation = 0) => ({ id: 'p0', sourceId: s.id, index: 0, rotation, selected: true });
const contents = async s => (await (await s.pdf.getPage(1)).getTextContent()).items.filter(t => 'str' in t);
const text = async s => (await contents(s)).map(t => t.str).join(' ');
const options = { language:'deu',editorLanguage:'deu+eng',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'TEST',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2' };
const run = (s, marks, rotation = 0) => runStudioJob('edit-text', [s], [pageOf(s, rotation)], options, { marks: { p0: marks }, crops: {} }, () => {}, new AbortController().signal);
const markFor = (t, width = 500) => ({ id:'replace', kind:'text', x:t.x,y:t.y,w:t.w,h:t.h,sourceRect:{x:t.x,y:t.y,w:t.w,h:t.h},text:t.text,fontScale:t.fontSize/width,fontFamily:t.family,fontChoice:'auto',originalFontName:t.fontName,originalFontId:t.originalFontId,originalFontPage:0,bold:t.bold,italic:t.italic,color:t.color,fill:'#ffffff',baselineScale:t.baselineScale,insetScale:t.insetScale,tracking:t.tracking,textScaleX:t.textScaleX,textRotation:t.rotation,lineHeight:t.lineHeight });
async function render(s) { const page = await s.pdf.getPage(1), viewport = page.getViewport({scale:2}); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)); await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise; return canvas; }
function ink(canvas, region) { const data = canvas.getContext('2d').getImageData(...region).data; const result=[]; for(let i=0;i<data.length;i+=4) result.push(Math.min(data[i],data[i+1],data[i+2]) < 180 ? 1 : 0); return result; }
const bytes = new Uint8Array(await readFile('public/vendor/editor-fonts/LiberationSans-BoldItalic.ttf'));
try {
  const cataloguePdf = await PDFDocument.create(), sampleText = 'ÄÖÜ äöü ß € 2026', catalogueNames = [];
  for (const choice of editorFontCatalog) for (const bold of [false,true]) for (const italic of [false,true]) {
    const {font} = await resolveEditorFont({fontChoice:choice.id,bold,italic,text:'ÄÖÜ äöü ß € 2026'});
    assert(font.covers('ÄÖÜ äöü ß € 2026')); assert.equal(font.bold,bold); assert.equal(font.italic,italic);
    assert(font.measure('Hallo',12)>0); assert(GlobalFonts.register(font.bytes, font.cssFamily), `${choice.id} is accepted by the independent native font parser`);
    const postscriptName = fontkit.create(font.bytes).postscriptName;
    assert.equal(matchingEditorFont('ABCDEF+' + postscriptName),choice.id,'Automatic matching preserves the selected family, including condensed faces');
    catalogueNames.push(postscriptName);
    await drawEditorText(cataloguePdf,cataloguePdf.addPage([500,100]),{id:choice.id,kind:'text',text:sampleText,x:.05,y:.1,w:.9,h:.8,fontScale:14/500,fontChoice:choice.id,fontFamily:choice.family,bold,italic,color:'#000000'},500,100);
  }
  const catalogueSource = await source(await cataloguePdf.save(),'catalogue.pdf');
  for (let index=0;index<catalogueNames.length;index++) {
    const targets = (await readTextTargets(catalogueSource,{...pageOf(catalogueSource),index})).targets;
    assert.equal(targets.map(t=>t.text).join(' '),sampleText,'All catalogue faces export searchable Unicode text');
    assert.equal(targets[0].fontName,catalogueNames[index],'The actual selected font is embedded in the output');
  }
  assert.throws(()=>sfntTables(new Uint8Array(8)),/Schrift/);
  for (const subset of [false,true]) {
    const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(bytes,{subset});
    const page=doc.addPage([500,700]);page.drawText('Original Größe ÄÖÜ 2026',{font,size:13.5,x:45,y:600,color:rgb(.1,.2,.7)});page.drawText('Footer remains vector',{font,size:10,x:45,y:40});page.drawRectangle({x:350,y:300,width:60,height:90,color:rgb(.2,.8,.3)});
    const s=await source(await doc.save(),`fonts-${subset}.pdf`), targets=await readTextTargets(s,pageOf(s)), t=targets.targets.find(t=>t.text.startsWith('Original'));
    assert(t.originalFontId,'Embedded fonts are reusable');assert.equal(t.fontName,'LiberationSans-BoldItalic');assert.equal(t.fontSize,13.5);assert(t.bold && t.italic);assert.equal(t.color,'#1a33b2');
    const mark=markFor(t), resolution=await resolveEditorFont(mark,s); assert(resolution.font.original && !resolution.substituted); assert(resolution.font.covers(t.text),'Spaces and Unicode in a subset are remapped correctly');
    assert(Math.abs(resolution.font.measure(t.text,t.fontSize)-font.widthOfTextAtSize(t.text,t.fontSize))<.001);
    await writeFile(`${folder}/reused-${subset}.ttf`,resolution.font.bytes);assert(GlobalFonts.register(resolution.font.bytes,resolution.font.cssFamily));
    const reopened=await source(s.bytes,`reopened-${subset}.pdf`); const again=(await readTextTargets(reopened,pageOf(reopened))).targets.find(t=>t.text.startsWith('Original'));assert.equal(again.originalFontId,t.originalFontId,'Original font identity survives reopening a project');
    const selected={...mark};selected.originalState=editorMarkSignature(selected);assert(!editorMarkChanged(selected));assert.equal(countEdits({marks:{p0:[selected]},crops:{}},[pageOf(s)]),0);
    const noop=await source(await(await run(s,[selected])).blob.arrayBuffer()); const ops=await(await noop.pdf.getPage(1)).getOperatorList();assert(!ops.fnArray.includes(pdfjs.OPS.paintImageXObject),'Selection alone never rasterizes or rewrites the page');
    // Rebuild identical text at its detected geometry, then compare rendered ink
    // against the original. This detects baseline, inset, glyph and size drift.
    const rebuilt=await PDFDocument.create(), rp=rebuilt.addPage([500,700]);await drawEditorText(rebuilt,rp,mark,500,700,s);
    const reconstructed=await source(await rebuilt.save()), originalCanvas=await render(s), newCanvas=await render(reconstructed);
    const a=ink(originalCanvas,[80,165,420,65]),b=ink(newCanvas,[80,165,420,65]);const different=a.reduce((n,v,i)=>n+(v!==b[i]),0), total=a.reduce((n,v)=>n+v,0);
    assert(different/total<.035,`Original glyph and baseline reconstruction differs by ${(100*different/total).toFixed(2)}% of ink`);
    const changed={...mark,text:'Größe 2026'}; const result=await run(s,[changed]); assert(!result.note?.includes('Hintergrund wurde als Bild'),result.note);
    const output=await source(await result.blob.arrayBuffer());assert.match(await text(output),/Größe 2026/);assert.doesNotMatch(await text(output),/Original/);assert.match(await text(output),/Footer remains vector/);const repeatTarget=(await readTextTargets(output,pageOf(output))).targets.find(t=>t.text==='Größe 2026');assert((await resolveEditorFont(markFor(repeatTarget),output)).font.original,'Exported text remains directly editable with its embedded font');
    const outOps=await(await output.pdf.getPage(1)).getOperatorList();assert(!outOps.fnArray.includes(pdfjs.OPS.paintImageXObject),'Native page paths and untouched glyphs remain vectors');
    assert.deepEqual([... (await render(output)).getContext('2d').getImageData(750,650,1,1).data],[51,204,77,255]);
    const fallback=await resolveEditorFont({...mark,text:'Zusätzlicher Text XQ'},s);
    assert.equal(fallback.substituted,subset,'Only genuinely missing subset characters require substitution');
    if(subset) {assert.equal(fallback.font.name,'Liberation Sans');assert.match(fallback.reason,/Zeichen/);}
    const overflow={...changed,w:.03,h:.01}; await assert.rejects(()=>run(s,[overflow]),/Textfeld ist zu klein/);
  }
  // Horizontal scaling, character spacing and rotated CropBoxes.
  for (const rotation of [0,90,180,270]) {
    const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(bytes);const page=doc.addPage([500,700]);
    const key=page.node.newFontDictionary(font.name,font.ref);
    page.pushOperators(pushGraphicsState(),beginText(),setFontAndSize(key,12),setCharacterSpacing(.7),setTextMatrix(1.2,0,0,1,50,600),showText(font.encodeText('Spacing 2026')),endText(),popGraphicsState());
    page.drawText('Keep footer',{font,size:12,x:50,y:50});page.setRotation(degrees(rotation));page.setCropBox(20,20,460,660);
    const s=await source(await doc.save(),`rotated-${rotation}.pdf`), geometry=await readTextTargets(s,pageOf(s)), t=geometry.targets.find(t=>t.text==='Spacing 2026');
    assert(t);assert(Math.abs(t.textScaleX-1.2)<.001);assert(Math.abs(t.tracking- .7/12)<.001);
    const rotatedMark={...markFor(t,geometry.width),text:'Spacing 2026'};const fontInfo=await resolveEditorFont(rotatedMark,s);const layout=layoutEditorText(rotatedMark,geometry.width,geometry.height,fontInfo.font.measure,fontInfo.font.descent);assert(!layout.overflow,'Detected text fits exactly without rounding-induced wrapping');const result=await run(s,[rotatedMark]);assert(!result.note?.includes('Hintergrund wurde als Bild'),result.note); const out=await source(await result.blob.arrayBuffer());
    const resultTarget=(await readTextTargets(out,pageOf(out))).targets.find(t=>t.text==='Spacing 2026'); assert(resultTarget);assert(Math.abs(t.x-resultTarget.x)<.002 && Math.abs(t.y-resultTarget.y)<.002,'Rotated text is placed at the original position');
  }
  const hiddenDoc=await PDFDocument.create();hiddenDoc.registerFontkit(fontkit);const hiddenFont=await hiddenDoc.embedFont(bytes);const hiddenPage=hiddenDoc.addPage([500,700]);
  hiddenPage.pushOperators(pushGraphicsState(),setTextRenderingMode(TextRenderingMode.Invisible));hiddenPage.drawText('OCR search layer',{font:hiddenFont,size:12,x:50,y:600});hiddenPage.pushOperators(popGraphicsState());
  const hiddenSource=await source(await hiddenDoc.save(),'existing-ocr.pdf'), hiddenTarget=(await readTextTargets(hiddenSource,pageOf(hiddenSource))).targets[0];
  assert.equal(hiddenTarget.origin,'pdf','An existing search layer is not exported twice');assert.equal(hiddenTarget.originalFontId,undefined,'An invisible OCR font must not be presented as the scan original font');assert.equal(hiddenTarget.fontName,undefined);
  const line={id:'a',x:.1,y:.1,w:.5,h:.02,text:'First line of a paragraph',fontSize:12,family:'sans',origin:'pdf',bold:false,color:'#000000'};
  const paragraph=editorParagraphs([line,{...line,id:'b',y:.12,text:'second line'}],500,700);assert.equal(paragraph.length,1);assert.equal(paragraph[0].text,'First line of a paragraph second line');assert.equal(paragraph[0].fragments.length,2);
  assert.equal(editorParagraphs([line,{...line,id:'b',y:.12,text:'Heading',bold:true}],500,700).length,2);
  assert.equal(editorParagraphs([line,{...line,id:'b',x:.65}],500,700).length,2);
  const enlarged={...markFor(line),text:'Longer',h:.2};assert(editorTextCollision(enlarged,[enlarged],[line,{...line,id:'b',y:.22}]));
  assert(!editorTextCollision({...enlarged,y:.4},[{...enlarged,y:.4}],[line,{...line,id:'b',y:.22}]));
  assert.deepEqual(wrapEditorText('A  B\nC',100,s=>s.length*10),['A  B','C']);
  console.log(`PASS: ${editorFontCatalog.length*4} local font faces, PDF embedding, Unicode round-trip and automatic family matching; true original full/subset glyphs; cmap space repair; independent raster and font-parser comparisons; font/size/style/color/tracking detection; automatic explicit substitutions; native vector-preserving editing; no-op selections; rotation/CropBox geometry; conservative paragraph reflow, collision and overflow checks.`);
} finally { for (const p of proxies) await p.loadingTask.destroy(); globalThis.fetch=originalFetch; }
