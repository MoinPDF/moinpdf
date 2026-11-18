const {parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs'),vm=require('node:vm');
global.self=global;
global.location={href:'https://fictional.test/workers/image-decode.js'};
global.importScripts=path=>{
 if(path==='/vendor/images/ag-psd.js'){
  if(workerData?.psdBundle)vm.runInThisContext(fs.readFileSync(require.resolve('ag-psd/dist/bundle.js'),'utf8'));
  else global.agPsd=require('ag-psd');
 }
 else if(path==='/vendor/images/libheif.js'){
  const factory=require('libheif-js/libheif-wasm/libheif.js');
  global.libheif=options=>factory({...options,locateFile:()=>require.resolve('libheif-js/libheif-wasm/libheif.wasm')});
 } else throw new Error('Unexpected external worker script: '+path);
};
global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);
global.importImageModule=async path=>{
 const {pathToFileURL}=require('node:url');
 if(path==='/vendor/images/jxr/decode.js'){
  const module=await import(pathToFileURL(require.resolve('@discourse/jxr/decode.js')).href);
  global.process=undefined;
  global.ImageData=class{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}};
  await module.init({wasmBinary:fs.readFileSync(require.resolve('@discourse/jxr/codec/dec/jxr_dec.wasm'))});
  return module;
 }
 if(path==='/vendor/images/pdf.image_decoders.mjs')return import(pathToFileURL(require.resolve('pdfjs-dist/image_decoders/pdf.image_decoders.mjs')).href);
 if(path==='./pnm-decode.mjs')return import(pathToFileURL(require('node:path').resolve('public/workers/pnm-decode.mjs')).href);
 throw new Error('Unexpected decoder module: '+path);
};
global.fetch=async path=>{
 if(!path.startsWith('/vendor/pdf/wasm/'))throw new Error('Unexpected decoder fetch: '+path);
 return new Response(fs.readFileSync(require.resolve('pdfjs-dist/wasm/'+path.split('/').pop())),{headers:{'Content-Type':'application/wasm'}});
};
vm.runInThisContext(fs.readFileSync('public/workers/image-decode.js','utf8').replaceAll('import(', 'global.importImageModule('));
parentPort.on('message',data=>global.onmessage({data}));
