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
let workers=0,psdBundle=false;
globalThis.Worker=class{constructor(){workers++;this.closed=false;this.worker=new NodeWorker(new URL('./image-worker-node.cjs',import.meta.url),{workerData:{psdBundle}});this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));}postMessage(data,transfer){this.worker.postMessage(data,transfer);}terminate(){if(!this.closed){workers--;this.closed=true;}return this.worker.terminate();}};
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
// Independent PSD bytes cover both supported color modes and compression paths.
// Each PackBits row below is one literal run, not output from the decoder's writer.
function compositeFixture(channels,mode,rle){
 const body=rle?channels.flatMap(channel=>[1,...channel.slice(0,2),1,...channel.slice(2)]):channels.flat();
 const tableBytes=rle?channels.length*2*2:0;
 const bytes=new Uint8Array(40+tableBytes+body.length),v=new DataView(bytes.buffer);
 bytes.set(psd.subarray(0,40));v.setUint16(12,channels.length);v.setUint16(24,mode);v.setUint16(38,rle?1:0);
 if(rle)for(let offset=40;offset<40+tableBytes;offset+=2)v.setUint16(offset,3);
 bytes.set(body,40+tableBytes);return bytes;
}
for(const bundle of [false,true]){
 psdBundle=bundle;
 for(const rle of [false,true]){
  const gray=compositeFixture([[0,64,128,255]],1,rle),snapshot=gray.slice();
  const image=await decodeSpecialImage(gray,'psd');
  assert.deepEqual([...image.rgba],[0,0,0,255,64,64,64,255,128,128,128,255,255,255,255,255]);
  assert.deepEqual(gray,snapshot,'Import leaves original bytes intact');
  const rgb=compositeFixture([[255,0,0,255],[0,255,0,255],[0,0,255,255]],3,rle);
  assert.deepEqual([...(await decodeSpecialImage(rgb,'psd')).rgba],[...decoded.rgba]);
  const imported=await PDFDocument.load(await imageFilePdf(new File([rgb],'compressed.psd'),rgb));
  assert.equal(imported.getPageCount(),1);
  assert.deepEqual(imported.getPage(0).getSize(),{width:595.28,height:841.89});
 }
 // Layered RGBA files exercise skipped layer pixels, masks and saved composite alpha.
 const {writePsdUint8Array}=require('ag-psd');
 const rgba={width:2,height:2,data:new Uint8ClampedArray([255,0,0,255,0,255,0,128,0,0,255,64,255,255,255,0])};
 const layered=writePsdUint8Array({width:2,height:2,imageData:rgba,children:[{name:'Fictional layer',imageData:rgba}]});
 assert.deepEqual([...(await decodeSpecialImage(layered,'psd')).rgba],[...rgba.data]);
 for(const [offset,value] of [[4,2],[22,16],[24,4],[24,9]]){
  const unsupported=psd.slice();new DataView(unsupported.buffer).setUint16(offset,value);
  await assert.rejects(()=>decodeSpecialImage(unsupported,'psd'),/PSD-Import/);
 }
 await assert.rejects(()=>decodeSpecialImage(psd.slice(0,20),'psd'),/PSD-Import/);
 await assert.rejects(()=>decodeSpecialImage(psd.slice(0,42),'psd'));
 assert.equal(workers,0,'PSD decoder errors terminate both module and browser-bundle workers');
}
psdBundle=false;
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
console.log('PASS: module and shipped browser-bundle PSD decoders; raw/RLE RGB and grayscale pixels, layered RGBA composite, PDF import, unchanged inputs, malformed/unsupported-file rejection; primary HEIC, pixel limits and worker cleanup/cancellation.');
