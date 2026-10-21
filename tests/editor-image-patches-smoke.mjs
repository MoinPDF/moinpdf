import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {PDFDocument,PDFName,PDFDict,PDFRawStream,StandardFonts}=require('pdf-lib');
const pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')));
const folder='.cache/editor-image-patches'; await mkdir(folder,{recursive:true});
const ts=(await import('typescript')).default;
for(const name of ['native-pdf-core','nested-native']) {
 const code=ts.transpileModule(await readFile('lib/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>q+'./'+n+'.mjs'+q);
 await writeFile(folder+'/'+name+'.mjs',code);
}
const {createNativeEngine,readNativeImage,inspectNativeObjects}=await import('../.cache/editor-image-patches/native-pdf-core.mjs');
const {editNativeDocument}=await import('../.cache/editor-image-patches/nested-native.mjs');
const api=await createNativeEngine(new Uint8Array(await readFile(require.resolve('@embedpdf/pdfium').replace(/[^\\/]+$/,'pdfium.wasm'))));
function imageFlags(bytes,index){
  const ptr=api.pdfium.wasmExports.malloc(bytes.length);api.pdfium.HEAPU8.set(bytes,ptr);
  const doc=api.FPDF_LoadMemDocument(ptr,bytes.length,''),page=api.FPDF_LoadPage(doc,0),object=api.FPDFPage_GetObject(page,index),clip=api.FPDFPageObj_GetClipPath(object);
  try{return {clip,paths:clip?api.FPDFClipPath_CountPaths(clip):null,transparent:api.FPDFPageObj_HasTransparency(object)};}
  finally{api.FPDF_ClosePage(page);api.FPDF_CloseDocument(doc);api.pdfium.wasmExports.free(ptr);}
}
const W=2500,H=3500,RGB=new Uint8Array(W*H*3);
function sourcePixel(x,y){return [(x*7+y*3)%256,(Math.floor(x/9)+y*5)%256,(x+Math.floor(y/7)*11)%256];}
for(let y=0;y<H;y++)for(let x=0;x<W;x++)RGB.set(sourcePixel(x,y),(y*W+x)*3);
const fixture=await PDFDocument.create(),c=fixture.context,name=PDFName.of;
const imageRef=c.register(c.flateStream(RGB,{Type:'XObject',Subtype:'Image',Width:W,Height:H,ColorSpace:'DeviceRGB',BitsPerComponent:8,Interpolate:false}));
for(let i=0;i<2;i++){
  const page=fixture.addPage(i===0?[500,350]:[250,350]);
  page.node.set(name('Resources'),c.obj({XObject:{Scan:imageRef}}));
  page.node.set(name('Contents'),c.register(c.flateStream('q 250 0 0 350 0 0 cm /Scan Do Q\n'+(i===0?'q 250 0 0 350 250 0 cm /Scan Do Q\n':''))));
}
const original=await fixture.save(),originalSnapshot=original.slice(),results=[];
async function check(label,job){const start=performance.now();try{const detail=await job();results.push({label,pass:true,ms:Math.round(performance.now()-start),detail});console.log('PASS: '+label,detail||'');}catch(e){results.push({label,pass:false,error:e.stack});console.error('FAIL: '+label,e);}}
const patch={x:430,y:710,width:170,height:95,rgba:new Uint8Array(170*95*4)};
for(let y=0;y<patch.height;y++)for(let x=0;x<patch.width;x++)patch.rgba.set([230+(x%20),234+(y%18),239,255],(y*patch.width+x)*4);
let output;
await check('read bounded region from 8.75 MP image at original source grid',()=>{
  const tile=readNativeImage(api,original,0,0,[],{x:.2,y:.2,w:.1,h:.1});
  assert.deepEqual([tile.sourceWidth,tile.sourceHeight,tile.x,tile.y,tile.width,tile.height],[W,H,500,700,250,350]);
  for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++)assert.deepEqual([...tile.rgba.subarray((y*tile.width+x)*4,(y*tile.width+x)*4+4)],[...sourcePixel(tile.x+x,tile.y+y),255]);
  return {source:[W,H],returned:[tile.width,tile.height],bytes:tile.rgba.length};
});
await check('full-image JavaScript read stays bounded to 4 MP',()=>assert.throws(()=>readNativeImage(api,original,0,0),/4 Megapixel/));
await check('patch only one selected repeated image resource',async()=>{
  output=await editNativeDocument(api,original,0,[{index:0,imagePatches:[patch]}]);
  const d=await PDFDocument.load(output),images=d.context.enumerateIndirectObjects().filter(([,obj])=>obj instanceof PDFRawStream&&obj.dict.lookupMaybe(name('Subtype'),PDFName)===name('Image'));
  assert(images.length>=2,'A separate image resource is required');
  assert(images.every(([,im])=>im.dict.lookup(name('Width')).asNumber()===W&&im.dict.lookup(name('Height')).asNumber()===H));
  const before=inspectNativeObjects(api,original,0),after=inspectNativeObjects(api,output,0);
  assert.deepEqual(after.map(({x,y,w,h})=>[x,y,w,h]),before.map(({x,y,w,h})=>[x,y,w,h]));
  assert.deepEqual(original,originalSnapshot);
  return {outputBytes:output.length,imageResources:images.length};
});
async function verifyRendered(which,pageNumber,left=0){
  const task=pdfjs.getDocument({data:output.slice(),standardFontDataUrl:dirname(require.resolve('pdfjs-dist/package.json'))+'/standard_fonts/'});
  try{
    const doc=await task.promise,page=await doc.getPage(pageNumber),canvas=createCanvas(W,H);
    await page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale:10}),transform:[1,0,0,1,-left,0],background:'rgb(255,255,255)'}).promise;
    const pixels=canvas.getContext('2d').getImageData(0,0,W,H).data;
    let changed=0,outsideDifferences=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const inside=which==='selected'&&x>=patch.x&&x<patch.x+patch.width&&y>=patch.y&&y<patch.y+patch.height;
      const from=((y-patch.y)*patch.width+x-patch.x)*4,expected=inside?patch.rgba.subarray(from,from+3):sourcePixel(x,y),offset=(y*W+x)*4;
      for(let k=0;k<3;k++)if(pixels[offset+k]!==expected[k]){
        if(!inside)outsideDifferences++;
        else changed++;
      }
      assert.equal(pixels[offset+3],255);
    }
    assert.equal(outsideDifferences,0,'All original pixels outside correction must remain exact');
    assert.equal(changed,0,'All corrected pixels must match patch exactly');
    canvas.width=canvas.height=0;
    return {pixelCount:W*H,outsideDifferences,patchDifferences:changed};
  }finally{await task.destroy();}
}
if(output){
  await check('independent PDF.js render: original dimensions, exact pixels outside patch',()=>verifyRendered('selected',1));
  await check('independent PDF.js render: entire reused sibling image unchanged',()=>verifyRendered('sibling',1,W));
  await check('independent PDF.js render: entire other page unchanged',()=>verifyRendered('other-page',2));
}
await check('invalid, oversized, transparent and ambiguous patch requests reject',async()=>{
  const requests=[
    {imagePatches:[]},
    {imagePatches:Array.from({length:201},()=>patch)},
    {imagePatches:[{...patch,x:-1}]},
    {imagePatches:[{...patch,x:W-1}]},
    {imagePatches:[{...patch,width:4001,height:1000,rgba:new Uint8Array(0)}]},
    {imagePatches:[{...patch,rgba:new Uint8Array(patch.rgba.length)}]},
    {imagePatches:[patch],imageCrop:{x:0,y:0,w:.5,h:.5}},
    {imagePatches:[patch],remove:true},
  ];
  for(const change of requests)await assert.rejects(()=>editNativeDocument(api,original,0,[{index:0,...change}]));
  assert.deepEqual(original,originalSnapshot);
  return {rejected:requests.length};
});
await check('16 MP source guard rejects before decoding an oversized declared image',async()=>{
  const d=await PDFDocument.create(),ctx=d.context,p=d.addPage([200,200]);
  const im=ctx.register(ctx.stream(new Uint8Array([0]),{Type:'XObject',Subtype:'Image',Width:5000,Height:4000,ColorSpace:'DeviceGray',BitsPerComponent:8}));
  p.node.set(name('Resources'),ctx.obj({XObject:{I:im}}));p.node.set(name('Contents'),ctx.register(ctx.flateStream('q 200 0 0 200 0 0 cm /I Do Q')));
  const bytes=await d.save();
  assert.throws(()=>readNativeImage(api,bytes,0,0,[],{x:0,y:0,w:.01,h:.01}),/16 Megapixel/);
});
async function smallFixture({gray=false,mask=false,clip=false,textClip=false,nested=false}={}){
  const d=await PDFDocument.create(),ctx=d.context,p=d.addPage([100,100]),channels=gray?1:3;
  const bytes=Uint8Array.from({length:17*23*channels},(_,i)=>(i*17)%256);
  const smask=mask?ctx.register(ctx.flateStream(new Uint8Array(17*23).fill(128),{Type:'XObject',Subtype:'Image',Width:17,Height:23,ColorSpace:'DeviceGray',BitsPerComponent:8})):undefined;
  const im=ctx.register(ctx.flateStream(bytes,{Type:'XObject',Subtype:'Image',Width:17,Height:23,ColorSpace:gray?'DeviceGray':'DeviceRGB',BitsPerComponent:8,...(smask?{SMask:smask}:{})}));
  const font=textClip?await d.embedFont(StandardFonts.Helvetica):undefined;
  const content=(clip?'q 0 0 8 23 re W n ':'')+(textClip?'BT /F 15 Tf 0 8 Td 7 Tr (MASK) Tj ET ':'')+'q 17 0 0 23 0 0 cm /I Do Q'+(clip?' Q':'');
  if(nested){
    const form=ctx.register(ctx.flateStream(content,{Type:'XObject',Subtype:'Form',BBox:[-10,-10,100,100],Matrix:[1,0,0,1,0,0],Resources:{XObject:{I:im}}}));
    p.node.set(name('Resources'),ctx.obj({XObject:{F:form}}));
    p.node.set(name('Contents'),ctx.register(ctx.flateStream('q 1 0 0 1 10 10 cm /F Do Q q 1 0 0 1 50 10 cm /F Do Q')));
  }else{
    p.node.set(name('Resources'),ctx.obj({XObject:{I:im},...(font?{Font:{F:font.ref}}:{})}));p.node.set(name('Contents'),ctx.register(ctx.flateStream(content)));
  }
  return d.save();
}
await check('odd-stride grayscale and nested image patches preserve untouched pixels',async()=>{
  const p={x:2,y:3,width:4,height:5,rgba:new Uint8Array(4*5*4)};
  for(let i=0;i<p.rgba.length;i+=4)p.rgba.set([240,230,220,255],i);
  for(const nested of[false,true]){
    const input=await smallFixture({gray:true,nested}),path=nested?[0]:[],before=readNativeImage(api,input,0,0,path);
    const next=await editNativeDocument(api,input,0,[{index:0,imagePatches:[p]}],path),after=readNativeImage(api,next,0,0,path);
    for(let y=0;y<23;y++)for(let x=0;x<17;x++){
      const offset=(y*17+x)*4,inside=x>=2&&x<6&&y>=3&&y<8;
      assert.deepEqual(after.rgba.subarray(offset,offset+4),inside?p.rgba.subarray(0,4):before.rgba.subarray(offset,offset+4));
    }
    if(nested)assert.deepEqual(readNativeImage(api,next,0,0,[1]).rgba,before.rgba,'Unselected nested Form image stays exact');
  }
  return {grayDimensions:[17,23],nestedInstanceIsolation:true};
});
await check('source soft masks and image clipping reject patch mode',async()=>{
  const p={x:2,y:3,width:1,height:1,rgba:new Uint8Array([255,255,255,255])};
  for(const settings of[{mask:true},{clip:true},{textClip:true}]){
    const bytes=await smallFixture(settings);
    const image=inspectNativeObjects(api,bytes,0).find(o=>o.type==='image');assert(image);
    console.log('Source exclusion flags',settings,imageFlags(bytes,image.index));
    await assert.rejects(()=>editNativeDocument(api,bytes,0,[{index:image.index,imagePatches:[p]}]),/Transparente|Beschnittene/,JSON.stringify(settings));
  }
  return {rejectedSourceKinds:3};
});
await writeFile(folder+'/scan-patches-results.json',JSON.stringify({sourcePixels:W*H,patchPixels:patch.width*patch.height,results},null,2));
if(output)await writeFile(folder+'/scan-patches-output.pdf',output);
if(results.some(r=>!r.pass))process.exitCode=1;
