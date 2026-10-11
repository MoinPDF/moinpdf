import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PDFDocument} from 'pdf-lib';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,ImageData}=pr('@napi-rs/canvas');
Object.assign(globalThis,{ImageData,document:{createElement:()=>createCanvas(1,1)}});
let workers=0;
globalThis.Worker=class{constructor(){workers++;this.closed=false;this.worker=new NodeWorker(new URL('./image-worker-node.cjs',import.meta.url));this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));}postMessage(data,transfer){this.worker.postMessage(data,transfer);}terminate(){if(!this.closed){workers--;this.closed=true;}return this.worker.terminate();}};
await mkdir('.cache',{recursive:true});
for(const name of ['image-decoder','image-codecs'])await writeFile(`.cache/${name}-special-test.mjs`,ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}-special-test.mjs${q}`));
const {decodeSpecialImage}=await import('../.cache/image-decoder-special-test.mjs');
const {imageFilePdf}=await import('../.cache/image-codecs-special-test.mjs');
const psd=new Uint8Array(26+12+2+12),view=new DataView(psd.buffer);
psd.set(new TextEncoder().encode('8BPS'));view.setUint16(4,1);view.setUint16(12,3);view.setUint32(14,2);view.setUint32(18,2);view.setUint16(22,8);view.setUint16(24,3);
// Empty color/resources/layer sections, then uncompressed planar RGB.
psd.set([255,0,0,255,0,255,0,255,0,0,255,255],40);
const decoded=await decodeSpecialImage(psd,'psd');
assert.equal(decoded.width,2);assert.equal(decoded.height,2);
assert.deepEqual([...decoded.rgba],[255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
const psdPdf=await PDFDocument.load(await imageFilePdf(new File([psd],'image.psd'),psd));assert.equal(psdPdf.getPageCount(),1);
const invalid=psd.slice();new DataView(invalid.buffer).setUint16(24,4);await assert.rejects(()=>decodeSpecialImage(invalid,'psd'),/CMYK/);
const huge=psd.slice();new DataView(huge.buffer).setUint32(18,40000000);await assert.rejects(()=>decodeSpecialImage(huge,'psd'),/Megapixel/);
let heic;
try{heic=new Uint8Array(await readFile('.cache/import-fixture.heic'));}catch{
 const response=await fetch('https://raw.githubusercontent.com/strukturag/libheif/v1.20.2/examples/example.heic');assert.equal(response.status,200);heic=new Uint8Array(await response.arrayBuffer());await writeFile('.cache/import-fixture.heic',heic);
}
assert.equal(createHash('sha256').update(heic).digest('hex'),'7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2');
const photo=await decodeSpecialImage(heic,'heic');assert.equal(photo.width,1280);assert.equal(photo.height,854);assert.equal(photo.rgba.length,1280*854*4);assert(photo.rgba.some((v,i)=>i%4!==3&&v!==255));
const heicPdf=await PDFDocument.load(await imageFilePdf(new File([heic],'image.heic'),heic));assert.equal(heicPdf.getPageCount(),1,'Import selects primary HEIC image');
await assert.rejects(()=>decodeSpecialImage(psd,'psd',AbortSignal.abort()),/Abgebrochen/);
const controller=new AbortController();const work=decodeSpecialImage(heic,'heic',controller.signal);controller.abort();await assert.rejects(()=>work,/Abgebrochen/);
assert.equal(workers,0,'Every success, decoder error and cancellation terminates its worker');
console.log('PASS: real worker PSD pixels, primary HEIC decoding and independent PDF import, CMYK/pixel-limit rejection and worker cleanup/cancellation.');
