import {editorNativeAdapter} from './editor-native-adapter.mjs';
import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import ts from 'typescript';
import { PDFDocument, PDFName, rgb, degrees } from 'pdf-lib';

const require = createRequire(import.meta.url),
  pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
const { createCanvas, DOMMatrix, Path2D, ImageData } = pdfRequire('@napi-rs/canvas');
Object.assign(globalThis, {
  DOMMatrix,
  Path2D,
  ImageData,
  document: {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return createCanvas(1, 1);
    },
  },
});
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'),
  assets = dirname(require.resolve('pdfjs-dist/package.json'));
const folder = '.cache/editor-preservation';
await mkdir(folder, { recursive: true });
for (const name of ['editor-rich-text','editor-rich-layout','editor-verification','editor-detail-verification','editor-layout-plan','editor-sparse','editor-scan','editor-workflow','editor-ink-verification','editor-blocks','editor-document-search',
  'local-font-bytes',
  'pdf-text',
  'ocr-languages',
  'content-compare',
  'image-codecs',
  'pdf-engine',
  'studio-engine',
  'advanced-types',
  'extra-options',
  'extra-tools',
  'pdf-report',
  'pdf-signature-guard',
  'editor-model',
  'editor-analysis',
  'editor-text-layer',
  'editor-fonts',
  'editor-font-outline','editor-font-cmap',
  'editor-font-catalog',
  'editor-native','editor-scan-pixels',
  'editor-repair','pdf-security','native-pdf-core','nested-native',
]) {
  const code = ts
    .transpileModule(await readFile(`lib/${name}.ts`, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    })
    .outputText.replaceAll("'/vendor/pdf/standard_fonts/'", "'public/vendor/pdf/standard_fonts/'").replace(/(['"])\.\/([a-z-]+)\1/g, (_, q, n) => `${q}./${n}.mjs${q}`);
  await writeFile(`${folder}/${name}.mjs`, code);
}
await writeFile(
  folder + '/native-pdf.mjs',
  editorNativeAdapter,
);
const { readTextTargets } = await import('../.cache/editor-preservation/editor-model.mjs');
const { drawEditorText, layoutEditorText } =
  await import('../.cache/editor-preservation/editor-text-layer.mjs');
const { runStudioJob } = await import('../.cache/editor-preservation/studio-engine.mjs');
const { loadEditorPdf } = await import('../.cache/editor-preservation/editor-native.mjs');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) =>
  typeof input === 'string' && input.startsWith('/vendor/')
    ? new Response(await readFile('public' + input))
    : originalFetch(input);
const proxies = [];
async function source(bytes, name = 'fixture.pdf') {
  const data = new Uint8Array(bytes),
    pdf = await pdfjs.getDocument({
      data: data.slice(),
      standardFontDataUrl: assets + '/standard_fonts/',
      cMapUrl: assets + '/cmaps/',
      cMapPacked: true,
      fontExtraProperties: true,
    }).promise;
  proxies.push(pdf);
  return { id: name, name, bytes: data, pdf, size: data.length, kind: 'pdf' };
}
const pageOf = (s, rotation = 0) => ({
  id: 'p0',
  sourceId: s.id,
  index: 0,
  rotation,
  selected: true,
});
const contents = async (s) =>
  (await (await s.pdf.getPage(1)).getTextContent()).items.filter((t) => 'str' in t);
const text = async (s) => (await contents(s)).map((t) => t.str).join(' ').replace(/\s+/g,' ');
const options = {
  language: 'deu',
  editorLanguage: 'deu+eng',
  forceOcr: false,
  imageFormat: 'png',
  quality: 'balanced',
  watermark: 'TEST',
  numberStart: 1,
  pageSize: 'a4',
  orientation: 'portrait',
  perSheet: '2',
};
const run = (s, marks, rotation = 0) =>
  runStudioJob(
    'edit-text',
    [s],
    [pageOf(s, rotation)],
    options,
    { marks: { p0: marks }, crops: {} },
    () => {},
    new AbortController().signal,
  );
const markFor = (t, width = 500) => ({
  id: 'replace',
  kind: 'text',
  x: t.x,
  y: t.y,
  w: t.w,
  h: t.h,
  sourceRect: { x: t.x, y: t.y, w: t.w, h: t.h },
  text: t.text,
  fontScale: t.fontSize / width,
  fontFamily: t.family,
  fontChoice: 'auto',
  originalFontName: t.fontName,
  originalFontId: t.originalFontId,
  originalFontPage: 0,
  bold: t.bold,
  italic: t.italic,
  color: t.color,
  fill: '#ffffff',
  baselineScale: t.baselineScale,
  insetScale: t.insetScale,
  tracking: t.tracking,
  textScaleX: t.textScaleX,
  textRotation: t.rotation,
  textAspect: t.textAspect,
  lineHeight: t.lineHeight,
});
async function render(s) {
  const page = await s.pdf.getPage(1),
    viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

// No OCR words in the solid-color image. This fixture deliberately exercises the
// mixed-page path without depending on an OCR model for an image with no text.
await writeFile(
  folder + '/editor-recognizer.mjs',
  `export const openEditorRecognizer=()=>({recognize:async()=>({blocks:[],confidence:100}),dispose:async()=>{}});`,
);
try {
  // Real compressed payload ends in CR, followed by the PDF's LF separator.
  // A forward /Length reference must not make the parser trim that real byte.
  const pixels = Uint8Array.from({ length: 64 }, (_, i) => (i * 37) % 256);
  pixels[63] = (12 - pixels.slice(0, 63).reduce((sum, n) => sum + n, 0)) & 255;
  const compressed = deflateSync(pixels);
  assert.equal(compressed.at(-1), 13);
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 64 64] /Resources << /XObject << /Im0 4 0 R >> >> >>',
    ),
    Buffer.concat([
      Buffer.from(
        '<< /Type /XObject /Subtype /Image /Width 64 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length 5 0 R >>\nstream\n',
      ),
      compressed,
      Buffer.from('\nendstream'),
    ]),
    Buffer.from(String(compressed.length)),
  ];
  const parts = [Buffer.from('%PDF-1.7\n')],
    offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.concat(parts).length);
    parts.push(Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n'));
  });
  const xref = Buffer.concat(parts).length;
  parts.push(
    Buffer.from(
      `xref\n0 6\n0000000000 65535 f \n${offsets.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    ),
  );
  const recovered = await loadEditorPdf(new Uint8Array(Buffer.concat(parts)));
  const repairedImage = recovered.context
    .enumerateIndirectObjects()
    .find(([ref]) => ref.objectNumber === 4)[1];
  assert.deepEqual(new Uint8Array(inflateSync(repairedImage.getContents())), pixels);
  // Real local qpdf repair, followed by all-page text/geometry/pixel comparison.
  const repairDoc=await PDFDocument.create();for(let i=0;i<3;i++){const p=repairDoc.addPage([400,560]);p.drawText('Repair page '+i,{x:40,y:450,size:14});p.drawRectangle({x:40,y:60,width:100,height:40,color:rgb(.2,.4,.6)});}
  const validRepair=await repairDoc.save({useObjectStreams:false}),damagedRepair=Uint8Array.from(Buffer.from(Buffer.from(validRepair).toString('latin1').replace(/\/Length (\d+)/,(_,n)=>'/Length '+(Number(n)+2)),'latin1'));
  const repairSource=await source(damagedRepair,'damaged-length.pdf'),repairSnapshot=damagedRepair.slice();
  await assert.rejects(()=>loadEditorPdf(damagedRepair),/Datenstrom/);
  let repairWorkers=0;
  const savedWorker=globalThis.Worker;
  globalThis.Worker=class {constructor(){repairWorkers++;this.worker=new NodeWorker(new URL('./security-worker-node.cjs',import.meta.url));this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));}postMessage(data,transfer){this.worker.postMessage(data,transfer);}terminate(){void this.worker.terminate();}};
  try {
    const {verifyEditorRepair,repairEditorSource}=await import('../.cache/editor-preservation/editor-repair.mjs');
    const signal=new AbortController().signal;
    const fixed=await loadEditorPdf(damagedRepair,repairSource,signal);assert.equal(fixed.getPageCount(),3);assert.equal(repairWorkers,2);assert.deepEqual(damagedRepair,repairSnapshot);
    await loadEditorPdf(damagedRepair,repairSource,signal);assert.equal(repairWorkers,2,'A verified repair is reused, with a fresh mutable document');
    const visited=new Set(),getPage=repairSource.pdf.getPage.bind(repairSource.pdf);repairSource.pdf.getPage=async(n)=>{visited.add(n);return getPage(n);};
    await verifyEditorRepair(repairSource,await fixed.save(),signal);assert.deepEqual([...visited].sort(),[1,2,3],'Every page is checked');
    const changed=await PDFDocument.load(await fixed.save());changed.getPage(2).drawText('Changed last page',{x:30,y:90,size:12});const changedBytes=await changed.save();await assert.rejects(()=>verifyEditorRepair(repairSource,changedBytes,signal),/Text.*Seite 3/);
    const visual=await PDFDocument.load(await fixed.save());visual.getPage(1).drawRectangle({x:180,y:80,width:10,height:10,color:rgb(1,0,0)});const visualBytes=await visual.save();await assert.rejects(()=>verifyEditorRepair(repairSource,visualBytes,signal),/Darstellung.*Seite 2/);
    await assert.rejects(()=>verifyEditorRepair(repairSource,changedBytes,AbortSignal.abort()),{name:'AbortError'});
    const retrySource={...repairSource,id:'retry-repair'};await assert.rejects(()=>repairEditorSource(retrySource,AbortSignal.abort()),{name:'AbortError'});await repairEditorSource(retrySource,signal);assert.equal(repairWorkers,4,'Aborted repair can be retried');
  } finally {globalThis.Worker=savedWorker;}

  const d = await PDFDocument.create(),
    p = d.addPage([500, 700]);
  p.drawRectangle({ x: 0, y: 0, width: 500, height: 700, color: rgb(0.83, 0.91, 0.98) });
  const tile = createCanvas(100, 100);
  tile.getContext('2d').fillStyle = '#b0d5a0';
  tile.getContext('2d').fillRect(0, 0, 100, 100);
  p.drawImage(await d.embedPng(tile.toBuffer('image/png')), {
    x: 25,
    y: 550,
    width: 450,
    height: 100,
  });
  p.drawText('ORIGINAL 4815', { x: 50, y: 600, size: 18 });
  p.drawText('KEEP VECTOR FOOTER', { x: 50, y: 60, size: 12 });
  // A table rule intersects the selection padding, but not the text ink.
  p.drawLine({
    start: { x: 40, y: 595 },
    end: { x: 460, y: 595 },
    thickness: 0.4,
    color: rgb(0.8, 0.1, 0.1),
  });
  const link = d.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [350, 40, 460, 70],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: 'https://example.org/' },
  });
  p.node.set(PDFName.of('Annots'), d.context.obj([d.context.register(link)]));
  d.addPage([420, 300]).drawText('UNTOUCHED 123', { x: 30, y: 240, size: 20 });
  const src = await source(await d.save(), 'preservation.pdf'),
    t = (await readTextTargets(src, pageOf(src))).targets.find((t) => t.text === 'ORIGINAL 4815');
  const m = { ...markFor(t), text: 'NEU 2026' };
  const pages = [pageOf(src), { ...pageOf(src), id: 'p1', index: 1 }];
  const exportMarks = (marks, more = {}) =>
    runStudioJob(
      'edit-text',
      [src],
      pages,
      { ...options, ...more },
      { marks: { p0: marks }, crops: {} },
      () => {},
      new AbortController().signal,
    );
  const result = await exportMarks([m]);
  assert(!result.note?.includes('Als Bild'), result.note);
  const out = await source(await result.blob.arrayBuffer(), 'preserved.pdf');
  assert(!/ORIGINAL|4815/.test(await text(out)));
  assert.match(await text(out), /NEU 2026/);
  assert.match(await text(out), /KEEP VECTOR FOOTER/);
  const originalCanvas = await render(src),
    outCanvas = await render(out);
  // Compare all background and foreground pixels outside the changed glyphs.
  const before = originalCanvas.getContext('2d').getImageData(0, 0, 1000, 1400).data,
    after = outCanvas.getContext('2d').getImageData(0, 0, 1000, 1400).data;
  let difference = 0,
    channels = 0;
  for (let y = 0; y < 1400; y++)
    for (let x = 0; x < 1000; x++) {
      if (
        x >= t.x * 1000 - 2 &&
        x <= (t.x + t.w) * 1000 + 2 &&
        y >= t.y * 1400 - 2 &&
        y <= (t.y + t.h) * 1400 + 2
      )
        continue;
      for (let c = 0; c < 3; c++) {
        difference += Math.abs(before[(y * 1000 + x) * 4 + c] - after[(y * 1000 + x) * 4 + c]);
        channels++;
      }
    }
  assert(difference / channels < 0.03, `Unchanged pixels drifted by ${difference / channels}`);
  // The blank part inside the old text rectangle keeps the image's green pixels,
  // not a white rectangle. The old generic redaction implementation failed this.
  assert.deepEqual(
    [...outCanvas.getContext('2d').getImageData(300, 204, 1, 1).data],
    [176, 213, 160, 255],
  );
  const parsed = await PDFDocument.load(out.bytes);
  assert.equal(parsed.getPage(0).node.Annots().size(), 1, 'Link annotation retained');
  assert.equal(parsed.getPage(1).getWidth(), 420);
  assert.equal(parsed.getPage(1).getHeight(), 300);
  const { renderPage } = await import('../.cache/editor-preservation/pdf-engine.mjs');
  const c1 = (await renderPage(src, { index: 1, rotation: 0 }, 800)).canvas,
    c2 = (await renderPage(out, { index: 1, rotation: 0 }, 800)).canvas;
  assert.deepEqual(
    c1.getContext('2d').getImageData(0, 0, c1.width, c1.height).data,
    c2.getContext('2d').getImageData(0, 0, c2.width, c2.height).data,
    'Untouched page is pixel-identical',
  );
  const added = await source(
    await (
      await exportMarks([
        { ...m, sourceRect: undefined, x: 0.1, y: 0.5, w: 0.7, h: 0.1, text: 'Zusatz ÄÖÜ ß €' },
      ])
    ).blob.arrayBuffer(),
  );
  assert.equal(
    (await PDFDocument.load(added.bytes)).getPage(0).node.Annots().size(),
    1,
    'Adding text retains links',
  );
  assert(
    layoutEditorText({ ...m, text: 'W', w: 0.001, h: 0.5 }, 500, 700, () => 100).overflow,
    'A single glyph wider than the box must block export',
  );
  const partial = { ...m, sourceRect: { ...m.sourceRect, w: m.sourceRect.w * 0.3 } };
  await assert.rejects(
    () => exportMarks([partial]),
    /Originaltext.*nicht sicher/,
    'Partial object removal fails closed',
  );
  const deliberate = await exportMarks([partial], { editorAllowRaster: true });
  assert.match(deliberate.note, /Als Bild neu aufgebaut/);
  const f = await PDFDocument.create();
  f.addPage([500, 700]);
  f.getForm()
    .createTextField('Name')
    .addToPage(f.getPage(0), { x: 50, y: 500, width: 100, height: 30 });
  const fs = await source(await f.save(), 'form.pdf');
  const keptForm=await PDFDocument.load(await (await run(fs,[])).blob.arrayBuffer());
  assert.equal(keptForm.getForm().getTextField('Name').acroField.getWidgets().length,1,'Interactive fields survive unchanged export');
  await assert.rejects(()=>run(fs,[{id:'overlap',kind:'text',text:'collision',x:.1,y:.24,w:.2,h:.05,fontScale:.02}]),/Formularfeld/);
  const formDoc=await PDFDocument.create(); formDoc.addPage([500,700]);formDoc.addPage([500,700]);
  formDoc.getPage(0).drawText('Original heading',{x:50,y:600,size:16});
  const shared=formDoc.getForm().createTextField('Shared');shared.setText('Denny');
  for(const page of formDoc.getPages())shared.addToPage(page,{x:50,y:300,width:180,height:24});
  const checked=formDoc.getForm().createCheckBox('Confirmed');checked.addToPage(formDoc.getPage(1),{x:50,y:200,width:20,height:20});checked.check();
  const formSource=await source(await formDoc.save(),'multi-form.pdf');
  const formPages=[pageOf(formSource),{...pageOf(formSource),id:'p1',index:1}];
  const heading=(await readTextTargets(formSource,formPages[0])).targets.find(t=>t.text==='Original heading');
  const formResult=await runStudioJob('edit-text',[formSource],formPages,options,{marks:{p0:[{...markFor(heading),text:'Edited heading',w:.7}]},crops:{}},()=>{},new AbortController().signal);
  const formSaved=await PDFDocument.load(await formResult.blob.arrayBuffer());
  assert.equal(formSaved.getForm().getTextField('Shared').getText(),'Denny');
  assert.equal(formSaved.getForm().getTextField('Shared').acroField.getWidgets().length,2);
  assert(formSaved.getForm().getCheckBox('Confirmed').isChecked());
  const formReopened=await source(await formResult.blob.arrayBuffer(),'form-edited.pdf');assert.match(await text(formReopened),/Edited heading/);assert.doesNotMatch(await text(formReopened),/Original heading/);
  await assert.rejects(()=>run(formSource,[]),/Seitenreihenfolge/,'Omitting a form page cannot silently remove its widget');
  const signed = await PDFDocument.create();
  signed.addPage();
  signed.catalog.set(
    PDFName.of('Perms'),
    signed.context.obj({ DocMDP: signed.context.obj({ Type: 'Sig' }) }),
  );
  const signedSource = await source(await signed.save(), 'signed.pdf');
  await assert.rejects(() => run(signedSource, []), /Signatur/);
  const tilted = await PDFDocument.create();
  tilted.addPage([500, 700]).drawText('TILTED', { x: 100, y: 300, size: 18, rotate: degrees(20) });
  const tsrc = await source(await tilted.save(), 'tilted.pdf');
  const tiltedTarget = (await readTextTargets(tsrc, pageOf(tsrc))).targets[0];
  assert(!tiltedTarget.unsupportedReason);
  await assert.rejects(
    async () => drawEditorText(await PDFDocument.create(), p, { ...m, textAspect:undefined,textRotation: 20 }, 500, 700),
    /Geometrie/,
  );
  for(const angle of [20,45,135,225,315]) for(const rotation of [0,90]) {
    const d=await PDFDocument.create(),p=d.addPage([500,700]);p.setCropBox(20,20,460,660);p.setRotation(degrees(rotation));
    p.drawText('SLOPED',{x:220,y:350,size:18,rotate:degrees(angle)});p.drawText('KEEP',{x:30,y:40,size:12});
    const s=await source(await d.save(),`sloped-${angle}-${rotation}.pdf`),ts=(await readTextTargets(s,pageOf(s))),t=ts.targets.find(t=>t.text==='SLOPED');assert(!t.unsupportedReason);
    const {editorTargetMark}=await import('../.cache/editor-preservation/editor-blocks.mjs');
    const mark={...editorTargetMark(t,0,ts.width,'angle'),text:'SLIM'};
    const changed=await run(s,[mark]),out=await source(await changed.blob.arrayBuffer(),'sloped-output.pdf');
    assert.doesNotMatch(await text(out),/SLOPED/);assert.match(await text(out),/SLIM/);assert.match(await text(out),/KEEP/);
    const before=(await contents(s)).find(t=>t.str==='SLOPED'),after=(await contents(out)).find(t=>t.str==='SLIM');
    for(const k of [4,5])assert(Math.abs(before.transform[k]-after.transform[k])<.05,`Baseline preserved angle ${angle}/${rotation}: ${before.transform} vs ${after.transform}`);
    for(const k of [0,1,2,3])assert(Math.abs(before.transform[k]-after.transform[k])<.05,`Direction and point size preserved ${angle}/${rotation}`);
  }
  const opacity = await PDFDocument.create();
  opacity.addPage().drawText('INVISIBLE', { x: 40, y: 500, size: 14, opacity: 0 });
  const os = await source(await opacity.save(), 'invisible.pdf');
  assert(
    (await readTextTargets(os, pageOf(os))).targets[0].invisible,
    'Zero-opacity search layers are not visible source text',
  );
  await writeFile(folder + '/original.pdf', src.bytes);
  await writeFile(folder + '/edited.pdf', out.bytes);
  await writeFile(folder + '/edited.png', outCanvas.toBuffer('image/png'));
  const translate = await (await import('./translation-test-utils.mjs')).englishTranslator();
  for (const message of [
    'Seiten als Bild neu aufbauen',
    'Absätze bitte prüfen: Tabellenzellen und Spalten bei Bedarf einzeln bearbeiten.',
    'Seite 2: Als Bild neu aufgebaut. Hintergrund, OCR und unveränderte Bereiche bitte im Ergebnis prüfen.',
  ])
    assert.notEqual(translate(message), message);
  console.log(
    'PASS: actual text deletion preserves image background, table rules, vector footer, links and unchanged page pixels/sizes; adding text retains links; ambiguous objects/forms/signatures fail closed; explicit rebuild; slanted-text guard, invisible layer and DE/EN messages.',
  );
  // Optional, independently produced two-column paper. Keep third-party PDFs
  // outside git; the audit records its upstream URL and checksum.
  if (process.env.MOINPDF_EDITOR_CORPUS) {
    const paper = await source(await readFile(process.env.MOINPDF_EDITOR_CORPUS), 'paper.pdf');
    const heading = (await readTextTargets(paper, pageOf(paper))).targets.find(
      (target) => target.text === 'Abstract',
    );
    assert(heading, 'Expected the public paper abstract heading');
    assert.equal(heading.family, 'serif');
    assert.equal(heading.bold, true);
    const replacement = { ...markFor(heading, 612), text: 'Edited' };
    const allPages = Array.from({ length: paper.pdf.numPages }, (_, index) => ({
      ...pageOf(paper),
      id: index === 0 ? 'p0' : `p${index}`,
      index,
    }));
    const result = await runStudioJob(
      'edit-text',
      [paper],
      allPages,
      options,
      { marks: { p0: [replacement] }, crops: {} },
      () => {},
      new AbortController().signal,
    );
    assert.doesNotMatch(result.note || '', /als Bild neu aufgebaut/i);
    assert(heading.originalFontId,'The actual embedded Type1 font is reusable');
    assert.doesNotMatch(result.note || '', /Schriftersatz/);
    const editedPaper = await source(await result.blob.arrayBuffer(), 'edited-paper.pdf');
    assert.match(await text(editedPaper), /Edited/);
    assert.doesNotMatch(await text(editedPaper), /\bAbstract\b/);
    assert.equal(editedPaper.pdf.numPages, paper.pdf.numPages);
    for (let index = 2; index <= paper.pdf.numPages; index++) {
      const before = await (await paper.pdf.getPage(index)).getTextContent();
      const after = await (await editedPaper.pdf.getPage(index)).getTextContent();
      const geometry = (content) => content.items.map(({ fontName, ...item }) => item);
      assert.deepEqual(geometry(after), geometry(before), `Unchanged public paper page ${index}`);
      const canvases=[];
      for(const source of [paper,editedPaper]){
        const page=await source.pdf.getPage(index),viewport=page.getViewport({scale:1.5});
        const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
        await page.render({canvas,viewport}).promise;canvases.push(canvas);
      }
      assert.deepEqual(canvases[0].getContext('2d').getImageData(0,0,canvases[0].width,canvases[0].height).data,
        canvases[1].getContext('2d').getImageData(0,0,canvases[1].width,canvases[1].height).data,`Unchanged page ${index} pixels`);
      for(const canvas of canvases)canvas.width=canvas.height=0;
    }
    await writeFile(folder + '/public-paper-edited.pdf', editedPaper.bytes);
    console.log(
      'PASS: independently produced 14-page two-column paper: actual replacement, no raster fallback, all other page text and positions unchanged.',
    );
  }
} finally {
  for (const p of proxies) await p.loadingTask.destroy();
  globalThis.fetch = originalFetch;
}
