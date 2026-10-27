import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {Worker as NodeWorker} from 'node:worker_threads';
import ts from 'typescript';
import {editorNativeAdapter} from './editor-native-adapter.mjs';
export async function setup(name){
 const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
 const {createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');
 Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement:()=>createCanvas(1,1)}});
 globalThis.Worker=class{constructor(url){this.worker=new NodeWorker(new URL(url.includes('large-document')?'./large-worker-node.cjs':'./security-worker-node.cjs',import.meta.url));this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));}postMessage(data,transfer){this.worker.postMessage(data,transfer);}terminate(){void this.worker.terminate();}};
 const folder='.cache/'+name;await mkdir(folder,{recursive:true});
 for(const file of (await readdir('lib')).filter(f=>f.endsWith('.ts')&&!f.endsWith('.d.ts'))){
  const code=ts.transpileModule(await readFile('lib/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replaceAll("'/vendor/pdf/standard_fonts/'","'public/vendor/pdf/standard_fonts/'").replace(/(['"])\.\/([a-z0-9-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);
  await writeFile(folder+'/'+file.replace(/\.ts$/,'.mjs'),code);
 }
 await writeFile(folder+'/native-pdf.mjs',editorNativeAdapter);
 globalThis.pdfjsWorker=await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json')),proxies=[];
 const realFetch=globalThis.fetch;globalThis.fetch=async input=>typeof input==='string'&&input.startsWith('/vendor/')?new Response(await readFile('public'+input)):realFetch(input);
 const source=async(bytes,name='fictional.pdf')=>{const data=new Uint8Array(bytes),pdf=await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/',fontExtraProperties:true}).promise;proxies.push(pdf);return{id:name,name,bytes:data,pdf,size:data.length,kind:'pdf'};};
 return{folder,source,createCanvas,ctx:{signal:new AbortController().signal,report:()=>{}},close:async()=>{globalThis.fetch=realFetch;for(const p of proxies)await p.loadingTask.destroy();}};
}
