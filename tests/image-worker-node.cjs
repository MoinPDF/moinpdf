const {parentPort}=require('node:worker_threads');
const fs=require('node:fs'),vm=require('node:vm');
global.self=global;
global.importScripts=path=>{
 if(path==='/vendor/images/ag-psd.js')global.agPsd=require('ag-psd');
 else if(path==='/vendor/images/libheif.js'){
  const factory=require('libheif-js/libheif-wasm/libheif.js');
  global.libheif=options=>factory({...options,locateFile:()=>require.resolve('libheif-js/libheif-wasm/libheif.wasm')});
 } else throw new Error('Unexpected external worker script: '+path);
};
global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);
vm.runInThisContext(fs.readFileSync('public/workers/image-decode.js','utf8'));
parentPort.on('message',data=>global.onmessage({data}));
