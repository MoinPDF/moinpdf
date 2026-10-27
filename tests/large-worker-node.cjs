// Production worker and QPDF binary. Only FileReaderSync is adapted for Node.
const {parentPort}=require('node:worker_threads'),fs=require('node:fs'),vm=require('node:vm');
const NativeBlob=Blob;
class TestBlob extends NativeBlob{constructor(bytes){super([bytes]);this.bytes=bytes;}slice(start=0,end=this.size){return new TestBlob(this.bytes.subarray(start,end));}}
global.Blob=TestBlob;global.FileReaderSync=class{readAsArrayBuffer(blob){return blob.bytes.slice().buffer;}};
global.WorkerGlobalScope=class{};global.self=global;const createModule=require('@neslinesli93/qpdf-wasm');
global.Module=options=>createModule({...options,locateFile:()=>require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm')});
global.importScripts=()=>{};global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);global.close=()=>parentPort.close();
vm.runInThisContext(fs.readFileSync('public/workers/large-document.js','utf8').replace('} catch(error) {', "} catch(error) { process.stderr.write(error.stack+'\\n');").replace('printErr: () => {}', 'printErr: line => process.stderr.write(line)'));

parentPort.on('message',async data=>{data.files=await Promise.all(data.files.map(async file=>new TestBlob(new Uint8Array(await file.arrayBuffer()))));global.onmessage({data});});
