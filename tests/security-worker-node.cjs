// Executes the production worker with Node transport, using the same WASM binary.
const {parentPort}=require('node:worker_threads');
const fs=require('node:fs');
const vm=require('node:vm');
global.self=global;
const createModule=require('@neslinesli93/qpdf-wasm');
global.Module=options=>createModule({...options,locateFile:()=>require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm')});
global.importScripts=()=>{};
global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);
global.close=()=>parentPort.close();
vm.runInThisContext(fs.readFileSync('public/workers/pdf-security.js','utf8'));
parentPort.on('message',data=>global.onmessage({data}));
