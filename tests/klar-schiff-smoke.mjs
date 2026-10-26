// Fictional documents; real PDF.js extraction/rendering, Tesseract OCR and PDF exports.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { createWorker, PSM } from 'tesseract.js';
import { englishTranslator } from './translation-test-utils.mjs';
const en = await englishTranslator();
const require = createRequire(import.meta.url), pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
const { createCanvas, DOMMatrix, Path2D, ImageData } = pdfRequire('@napi-rs/canvas');
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData, document: { createElement: () => createCanvas(1, 1) } });
globalThis.__klarOcr = { PSM, async createWorker(languages, oem, options) {
  const worker = await createWorker(languages, oem, { langPath: resolve('public/vendor/languages'), cachePath: resolve('.cache'), logger: options.logger });
  const recognise = worker.recognize.bind(worker);
  worker.recognize = (canvas, ...args) => recognise(canvas.toBuffer('image/png'), ...args);
  return worker;
} };
const folder = '.cache/klar-schiff'; await mkdir(folder, { recursive: true });
for (const name of (await readdir('lib')).filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))) {
  let code = ts.transpileModule(await readFile('lib/' + name, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
    .replace(/(['"])\.\/([a-z0-9-]+)\1/g, (_, q, name) => `${q}./${name}.mjs${q}`);
  if (name === 'evidence-engine.ts') code = code.replace("import('tesseract.js')", 'Promise.resolve(globalThis.__klarOcr)');
  await writeFile(folder + '/' + name.replace(/\.ts$/, '.mjs'), code);
}
const m = await import('../.cache/klar-schiff/klar-schiff-model.mjs');
const e = await import('../.cache/klar-schiff/klar-schiff-engine.mjs');
const { groupWords } = await import('../.cache/klar-schiff/evidence-model.mjs');
const { selectedAudioVoice, voicesForLanguage, defaultAudioVoices } = await import('../.cache/klar-schiff/audio-voices.mjs');
const { toolDraftSchema } = await import('../.cache/klar-schiff/tool-draft-schema.mjs');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'), assets = dirname(require.resolve('pdfjs-dist/package.json'));
const proxies = [], ctx = { signal: new AbortController().signal, report: () => {} };
const fontBytes = new Uint8Array(await readFile('public/vendor/invoice-font/NotoSans-Regular.ttf'));
async function source(bytes, name) {
  const data = new Uint8Array(bytes);
  const pdf = await pdfjs.getDocument({ data: data.slice(), standardFontDataUrl: assets + '/standard_fonts/' }).promise;
  proxies.push(pdf);
  return { id: name, name, kind: 'pdf', bytes: data, pdf, size: data.length };
}
async function makePdf(pages, name) {
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([595, 842]);
    lines.forEach((line, i) => page.drawText(line, { x: 45, y: 785 - i * 35, size: 16, font }));
  }
  return source(await doc.save(), name);
}
const invoice = (issuer, number, page = 1, total = 2) => [issuer, `Rechnung ${number}`, 'Rechnungsdatum: 26.10.2026', `Fictional service ${number}`, `Seite ${page} von ${total}`];
const expected = (sources) => sources.map((s) => ({ sourceId: s.id, pages: s.pdf.numPages }));
const confirm = (plan) => ({ ...plan, documents: plan.documents.map((d) => ({ ...d, confirmed: true })) });
const text = async (src, index) => (await (await src.pdf.getPage(index + 1)).getTextContent()).items.map((item) => item.str || '').join(' ');
try {
  const a = await makePdf([invoice('Nordlicht GmbH', 'N-100', 2), invoice('Suedwind GmbH', 'N-100', 1, 1), invoice('Nordlicht GmbH', 'N-100', 1)], 'scrambled.pdf');
  const b = await makePdf([invoice('Nordlicht GmbH', 'N-100', 1)], 'duplicate.pdf');
  const plan = await e.analyseKlarSchiff([a, b], ctx);
  const originalCrypto = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) } });
    const localHttp = await e.analyseKlarSchiff([a, b], ctx);
    assert.deepEqual(localHttp, plan, 'Local HTTP without SubtleCrypto retains identical grouping and duplicate detection');
  } finally {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
  }
  assert.equal(plan.documents.length, 2, 'Same invoice number from different senders stays separate');
  const north = plan.documents.find((d) => d.sender === 'Nordlicht GmbH');
  assert.deepEqual(north.pageIds.map((id) => plan.pages.find((p) => p.id === id).number), [1, 1, 2]);
  assert.equal(plan.pages.filter((p) => p.duplicateOf).length, 1, 'Rendered duplicate is flagged, never discarded');
  assert.equal(plan.documents.reduce((n, d) => n + d.pageIds.length, 0), 4);
  assert.throws(() => m.validateKlarPlan(plan, expected([a, b])), /prüfen/);
  m.validateKlarPlan(confirm(plan), expected([a, b]));
  assert(toolDraftSchema.safeParse({ 'KlarSchiffPanel.plan:test': plan, 'KlarSchiffPanel.stage:test': 2, 'KlarSchiffPanel.format:test': 'zip' }).success);
  assert(!toolDraftSchema.safeParse({ 'KlarSchiffPanel.plan:test': { ...plan, documents: [{ title: 'broken' }] } }).success);
  const duplicate = plan.pages.find((p) => p.duplicateOf);
  let changed = m.moveKlarPage(plan, duplicate.id, 'exclude');
  assert.equal(changed.excluded.length, 1);
  assert.equal(changed.documents.flatMap((d) => d.pageIds).length, 3);
  changed = m.moveKlarPage(changed, duplicate.id, 'new');
  assert.equal(changed.excluded.length, 0);
  const added = changed.documents.at(-1);
  changed = m.moveKlarPage(changed, added.pageIds[0], north.id);
  assert.equal(changed.documents.length, 2, 'Empty document disappears after a merge');
  changed = confirm(m.moveKlarPage(changed, duplicate.id, 'exclude'));
  m.validateKlarPlan(changed, expected([a, b]));
  for (const corrupted of [
    { ...changed, excluded: [] },
    { ...changed, excluded: [duplicate.id, duplicate.id] },
    { ...changed, pages: changed.pages.slice(1) },
    { ...changed, documents: changed.documents.map((d, i) => i ? d : { ...d, pageIds: [...d.pageIds, d.pageIds[0]] }) },
    { ...changed, pages: changed.pages.map((p, i) => i ? p : { ...p, page: 99 }) },
  ]) assert.throws(() => m.validateKlarPlan(corrupted, expected([a, b])), /Seitenzuordnung/);
  const gapSource = await makePdf([invoice('Nordlicht GmbH', 'GAP-300', 1, 3), invoice('Nordlicht GmbH', 'GAP-300', 3, 3)], 'gap.pdf');
  const gap = await e.analyseKlarSchiff([gapSource], ctx);
  assert(m.klarWarnings(gap, gap.documents[0]).some((s) => /Seitenlücke: 2/.test(s)));
  const ambiguous = await makePdf([['Unknown attachment without reference'], ['Continuation without reliable date']], 'unknown.pdf');
  const uncertain = await e.analyseKlarSchiff([ambiguous], ctx);
  assert.equal(uncertain.documents.length, 1);
  assert(m.klarWarnings(uncertain, uncertain.documents[0]).some((s) => /ursprünglichen Seitenfolge/.test(s)));
  const spoken = groupWords({ sourceId: 'en', name: 'letter.pdf', page: 0, mode: 'text', words: [
    {id:'a',text:'Dear customer',x:.1,y:.1,w:.4,h:.03}, {id:'b',text:'Date: 2026-10-26',x:.1,y:.2,w:.4,h:.03},
  ] });
  assert.equal(m.suggestKlarPlan([spoken], en).documents[0].title, 'Letter letter');
  const filenames = changed.documents.map((d) => ({ ...d, filename: '../report.pdf' }));
  const zipResult = await e.exportKlarSchiff([a, b], { ...changed, documents: filenames }, 'zip', ctx, fontBytes);
  const zip = await JSZip.loadAsync(await zipResult.blob.arrayBuffer());
  const paths = Object.keys(zip.files).filter((name) => name.endsWith('.pdf'));
  assert.equal(paths.length, 2); assert(paths.every((p) => !p.includes('/') && !p.includes('..')));
  const report = JSON.parse(await zip.file('Klar-Schiff.json').async('string'));
  assert.equal(report.excluded.length, 1);
  for (const [index, name] of paths.entries()) {
    const out = await source(await zip.file(name).async('uint8array'), name);
    const item = changed.documents[index]; assert.equal(out.pdf.numPages, item.pageIds.length);
    for (let i = 0; i < item.pageIds.length; i++) {
      const ref = plan.pages.find((p) => p.id === item.pageIds[i]);
      const original = [a, b].find((s) => s.id === ref.sourceId);
      assert.equal(await text(out, i), await text(original, ref.page), 'Every exported page matches its assigned original');
    }
  }
  const combined = await e.exportKlarSchiff([a, b], changed, 'pdf', { ...ctx, translate: en }, fontBytes);
  const out = await source(await combined.blob.arrayBuffer(), 'bundle.pdf');
  assert.equal(out.pdf.numPages, 4);
  assert.match(await text(out, 0), /Clear Deck/);
  const links = await (await out.pdf.getPage(1)).getAnnotations();
  assert.equal(links.length, 2);
  assert.deepEqual(await Promise.all(links.map((link) => out.pdf.getPageIndex(link.dest[0]))), [1, 3]);
  assert.equal((await out.pdf.getOutline()).length, 2);
  const doc = await PDFDocument.create(), page = doc.addPage([320, 460]);
  page.setRotation(degrees(90)); page.drawText('FICTIONAL FORM');
  doc.getForm().createTextField('name').addToPage(page, {x:40,y:80,width:140,height:30});
  doc.getForm().getTextField('name').setText('Checked value');
  const form = await source(await doc.save(), 'form.pdf');
  const formPlan = confirm(await e.analyseKlarSchiff([form], ctx));
  const formZip = await JSZip.loadAsync(await (await e.exportKlarSchiff([form], formPlan, 'zip', ctx, fontBytes)).blob.arrayBuffer());
  const formOut = await source(await formZip.file(Object.keys(formZip.files).find((p) => p.endsWith('.pdf'))).async('uint8array'), 'flat.pdf');
  assert.match(await text(formOut, 0), /Checked value/);
  assert.equal((await formOut.pdf.getPage(1)).rotate, 90);
  // An actual scanned page is recognised by the shipped DE+EN Tesseract models.
  const c = createCanvas(1000, 1400), dc = c.getContext('2d'); dc.fillStyle = 'white'; dc.fillRect(0, 0, 1000, 1400);
  dc.fillStyle = 'black'; dc.font = '34px sans-serif';
  ['Nordlicht GmbH', 'Rechnung SCAN-900', 'Rechnungsdatum: 26.10.2026', 'Seite 1 von 1'].forEach((line, i) => dc.fillText(line, 70, 100 + i * 95));
  const scanned = await PDFDocument.create(); const pic = await scanned.embedPng(c.toBuffer('image/png'));
  scanned.addPage([500,700]).drawImage(pic, {x:0,y:0,width:500,height:700});
  const scan = await source(await scanned.save(), 'fictional-scan.pdf');
  const scanPlan = await e.analyseKlarSchiff([scan], ctx);
  assert.equal(scanPlan.pages[0].reference, 'SCAN-900');
  assert.equal(scanPlan.documents[0].date, '2026-10-26');
  await assert.rejects(() => e.analyseKlarSchiff([a], {...ctx,signal:AbortSignal.abort()}), {name:'AbortError'});
  await assert.rejects(() => e.exportKlarSchiff([a,b],changed,'pdf',{...ctx,signal:AbortSignal.abort()},fontBytes), {name:'AbortError'});
  assert.equal(voicesForLanguage(defaultAudioVoices, 'en')[0].id, 'ljspeech');
  assert.equal(selectedAudioVoice(defaultAudioVoices, 'en', 'thorsten').id, 'ljspeech');
  assert.equal(selectedAudioVoice(defaultAudioVoices.slice(0,2), 'en', 'thorsten'), undefined, 'English never falls back to German');
  assert.equal(selectedAudioVoice(defaultAudioVoices, 'de', 'kerstin').id, 'kerstin');
  console.log('PASS: document identity and collisions, printed order/gaps, rendered duplicates, manual merge/split/exclusion, complete page partition, persisted schema, original-page ZIPs, TOC destinations, flattened rotated forms, real scan OCR, cancellation and independent English voice selection.');
} finally { await Promise.all(proxies.map((pdf) => pdf.loadingTask.destroy())); }
