import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {Worker as NodeWorker} from 'node:worker_threads';
import ts from 'typescript';
import {PDFDocument, PDFName, PDFString, StandardFonts, rgb} from 'pdf-lib';
import {JSDOM} from 'jsdom';
import JSZip from 'jszip';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');
Object.defineProperty(Object.getPrototypeOf(createCanvas(1,1)).constructor,'name',{value:'HTMLCanvasElement'});
const dom=new JSDOM('');
Object.assign(globalThis,{DOMParser:dom.window.DOMParser,DOMMatrix,Path2D,ImageData,document:{createElement:()=>createCanvas(1,1)}});
globalThis.Worker=class{constructor(){this.worker=new NodeWorker(new URL('./security-worker-node.cjs',import.meta.url));this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));}postMessage(data,transfer){this.worker.postMessage(data,transfer);}terminate(){void this.worker.terminate();}};
const assets=dirname(require.resolve('pdfjs-dist/package.json')),pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
await mkdir('.cache/formats',{recursive:true});
const modules=['format-tools','text-import','writer-model','writer-pdf','local-font-bytes','pdf-text','pdf-security','pdf-engine','image-codecs','pro-tools','advanced-types'];
const compiled=new Set();
async function compile(name){
 if(compiled.has(name))return;compiled.add(name);
 let code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const dependencies=[...code.matchAll(/(['"])\.\/([a-z][a-z0-9-]*)\1/g)].map(m=>m[2]);
 code=code.replace(/(['"])\.\/([a-z][a-z0-9-]*)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);
 if(name==='pdf-engine')code=code.replace("'/vendor/pdf/pdf.worker.min.mjs'",JSON.stringify(assets+'/legacy/build/pdf.worker.mjs'));
 await writeFile(`.cache/formats/${name}.mjs`,code);
 for(const child of dependencies)await compile(child);
}
for(const m of modules)await compile(m);
const f=await import('../.cache/formats/format-tools.mjs'),t=await import('../.cache/formats/text-import.mjs'),writer=await import('../.cache/formats/writer-pdf.mjs'),pro=await import('../.cache/formats/pro-tools.mjs');
const ctx={signal:new AbortController().signal,report:()=>{}},opened=[];
const source=async bytes=>{const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes).slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;opened.push(pdf);return{id:'fictional-test',name:'Fiktiv.pdf',bytes:new Uint8Array(bytes),pdf,kind:'pdf'};};
const textOf=async pdf=>{let value='';for(let i=1;i<=pdf.numPages;i++)value+=(await(await pdf.getPage(i)).getTextContent()).items.map(v=>v.str||'').join(' ')+' ';return value;};
globalThis.fetch=async url=>{assert(String(url).startsWith('/vendor/editor-fonts/'));return new Response(await readFile('public'+url));};
try{
 assert.deepEqual(t.parseCsv('A;B\r\n"a;b";"x\n""y"""\r\n',';'),[['A','B'],['a;b','x\n"y"']]);
 assert.equal(t.detectDelimiter('name,value\nAlice,"1,23"'),',');
 for(const bad of ['"open','a"b,c','a,b\n1,2,3'])assert.throws(()=>t.parseCsv(bad,','));
 assert.throws(()=>t.textImportDocument('x'.repeat(300001),'txt','t',t.textImportDefaults));
 assert.throws(()=>t.xmlRows('<!DOCTYPE a [<!ENTITY e SYSTEM "file:///etc/passwd">]><a>&e;</a>','tree'));
 assert.throws(()=>t.xmlRows('<broken>','tree'));
 assert.deepEqual(t.xmlRows('<rows><row id="1"><name>A &amp; B</name></row><row id="2"><name>C</name></row></rows>','table'),[['@id','name'],['1','A & B'],['2','C']]);
 assert.throws(()=>t.xmlRows('<a><b><c x="1">v</c></b></a>','table'));
 const inputs={txt:'Grüße ÄÖÜ €\nZweite Zeile',markdown:'# Überschrift\n\n**Fett** und *kursiv*.\n\n- Punkt A\n- Punkt B\n\n```js\nconst value = 42;\n```\n\n| Name | Wert |\n|---|---|\n| Test | 123 |\n\n<script>alert(1)</script>\n\n![Logo](https://example.org/tracker.png)',csv:'Name;Betrag\n"Test; Firma";"1.234,56"',xml:'<root><name>Test &amp; Prüfung</name><amount currency="EUR">123.45</amount></root>'};
 for(const [format,input] of Object.entries(inputs)){
  const doc=t.textImportDocument(input,format,'Fiktiv',t.textImportDefaults),definition=writer.writerPdfDefinition(doc);
  assert(definition.content.length);const blob=await writer.createWriterPdf(doc),out=await source(await blob.arrayBuffer()),txt=await textOf(out.pdf);
  assert.match(txt,format==='txt'?/Grüße/:format==='markdown'?/Überschrift/:/Test/);
  await writeFile(`.cache/formats/${format}.pdf`,new Uint8Array(await blob.arrayBuffer()));
 }
 const many=t.textImportDocument('Name;Wert\n'+Array.from({length:250},(_,i)=>`Zeile ${i};${i}`).join('\n'),'csv','Rows',t.textImportDefaults);
 const manyPdf=await source(await(await writer.createWriterPdf(many)).arrayBuffer());assert(manyPdf.pdf.numPages>3);assert.match(await textOf(manyPdf.pdf),/Zeile 249/);
 console.log('PASS: real text/Markdown/CSV/XML PDFs, Unicode, multipage rows, quoted CSV, malformed XML and external-entity rejection.');
 const doc=await PDFDocument.create(),page=doc.addPage([300,400]),font=await doc.embedFont(StandardFonts.Helvetica);
 page.drawText('PAGE ONE',{font,x:35,y:330,size:18});page.drawRectangle({x:20,y:20,width:50,height:50,color:rgb(1,0,0)});doc.addPage([400,300]);
 const form=doc.getForm().createTextField('keep');form.setText('Value');form.addToPage(page,{x:30,y:220,width:100,height:25});
 await doc.attach(new Uint8Array([1,2,3,255]),'fixture.bin');
 doc.catalog.set(PDFName.of('OpenAction'),doc.context.obj({S:'JavaScript',JS:PDFString.of('globalThis.mustNeverRun = true;')}));
 const stream=doc.context.register(doc.context.flateStream(new TextEncoder().encode('console.log("compressed");')));
 page.node.set(PDFName.of('AA'),doc.context.obj({O:{S:'JavaScript',JS:stream}}));
 const input=await source(await doc.save()),saved=input.bytes.slice();
 const scripts=await f.inspectPdfJavaScript(input.bytes,ctx.signal);assert.equal(scripts.length,2);assert(scripts.some(s=>s.code.includes('compressed')));assert.equal(globalThis.mustNeverRun,undefined);
 const json=await f.exportPdfJson(input,ctx),parsed=JSON.parse(await json.blob.text());f.validatePdfJson(parsed);
 const restored=await f.importPdfJson(new File([json.blob],'roundtrip.pdf.json'),ctx),roundtrip=await source(await restored.blob.arrayBuffer()),pd=await PDFDocument.load(await restored.blob.arrayBuffer());
 assert.equal(roundtrip.pdf.numPages,2);assert.match(await textOf(roundtrip.pdf),/PAGE ONE/);assert.equal(pd.getForm().getTextField('keep').getText(),'Value');
 assert.deepEqual(new Uint8Array(await roundtrip.pdf.getAttachmentContent('fixture.bin')),new Uint8Array([1,2,3,255]));assert.equal((await f.inspectPdfJavaScript(roundtrip.bytes,ctx.signal)).length,2);
 assert.throws(()=>f.validatePdfJson({hello:'world'}));const external=structuredClone(parsed);Object.values(external.qpdf[1]).find(v=>v.stream).stream.datafile='/etc/passwd';assert.throws(()=>f.validatePdfJson(external),/Externe/);
 const omitted=structuredClone(parsed);delete Object.values(omitted.qpdf[1]).find(v=>v.stream).stream.data;assert.throws(()=>f.validatePdfJson(omitted),/Stream/);
 await assert.rejects(()=>f.importPdfJson(new File(['{}'],'bad.json'),ctx));await assert.rejects(()=>f.exportPdfJson(input,{...ctx,signal:AbortSignal.abort()}));
 console.log('PASS: genuine QPDF JSON roundtrip preserves pages, text, forms, attachments and scripts; rejects arbitrary JSON and external streams; no script execution.');
 const ai=await f.exportAiDocuments(input,ctx),records=JSON.parse(await ai.blob.text());assert.equal(records.length,2);assert.equal(records[0].metadata.page_number,1);assert.match(records[0].text,/PAGE ONE/);assert.equal(records[1].text,'');await writeFile('.cache/formats/llamaindex.json',await ai.blob.text());
 const xml=await pro.structuredExport([input],ctx,'xml');const xmldoc=new dom.window.DOMParser().parseFromString(await xml.blob.text(),'application/xml');assert(!xmldoc.querySelector('parsererror'));assert.equal(xmldoc.querySelectorAll('page').length,2);assert.match(xmldoc.documentElement.textContent,/PAGE ONE/);
 for(const fmt of ['png','jpg']){
  const cbz=await f.exportCbz(input,100,fmt,ctx),zip=await JSZip.loadAsync(await cbz.blob.arrayBuffer());assert.deepEqual(Object.keys(zip.files),[`0001.${fmt}`,`0002.${fmt}`]);const image=await zip.file(`0001.${fmt}`).async('uint8array');assert(image.length>500);
 }
 const scan=await f.scanEffect(input,{...f.scanEffectDefaults,dpi:100},ctx),scanSource=await source(await scan.blob.arrayBuffer());assert.equal(scanSource.pdf.numPages,2);assert.equal((await textOf(scanSource.pdf)).trim(),'');assert.deepEqual((await PDFDocument.load(await scan.blob.arrayBuffer())).getPage(0).getSize(),{width:300,height:400});
 await writeFile('.cache/formats/scan.pdf',new Uint8Array(await scan.blob.arrayBuffer()));
 const pixels=new Uint8ClampedArray([255,0,0,255,0,255,0,255]),clone=pixels.slice();f.applyScanPixels(pixels,10,true);f.applyScanPixels(clone,10,true);assert.deepEqual(pixels,clone);assert.equal(pixels[0],pixels[1]);
 await assert.rejects(()=>f.scanEffect(input,{...f.scanEffectDefaults,noise:NaN},ctx));await assert.rejects(()=>f.exportCbz(input,150,'jpg',{...ctx,signal:AbortSignal.abort()}));assert.deepEqual(input.bytes,saved);
 console.log('PASS: per-page LlamaIndex and XML exports, empty-page metadata, CBZ PNG/JPEG order, rasterized scanner effect, dimensions, deterministic grayscale, cancellation and unchanged originals.');
}finally{for(const p of opened)await p.loadingTask.destroy();}
