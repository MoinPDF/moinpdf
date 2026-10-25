import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const cachesMap=new Map(),events={},messages=[];
const cacheAPI={
 async has(n){return cachesMap.has(n)},async keys(){return [...cachesMap.keys()]},async delete(n){return cachesMap.delete(n)},
 async open(n){if(!cachesMap.has(n))cachesMap.set(n,new Map());const rows=cachesMap.get(n);return {async match(k){return rows.get(typeof k==='string'?k:k.url)?.clone()},async put(k,v){rows.set(typeof k==='string'?k:k.url,v.clone())}}}
};
let network=true,auth=true,broken=false,requested=[],delay=false,started;
const manifest={build:'fictional-build',version:'0.21.0',packs:[{id:'core',bytes:3,files:[{url:'/assets/app.js',size:3,integrity:'sha256-fictional'}]},{id:'language-deu',bytes:5,files:[{url:'/vendor/languages/deu.traineddata.gz',size:5,integrity:'sha256-language'}]}]};
const fetch=async(request,options={})=>{
 const path=typeof request==='string'?request:new URL(request.url).pathname;requested.push({path,options});
 if(delay){ started?.(); await new Promise((resolve,reject)=>{ if(options.signal?.aborted) reject(options.signal.reason); else options.signal?.addEventListener('abort',()=>reject(options.signal.reason),{once:true}); }); }
 if(!network)throw Error('offline');if(broken&&path.includes('traineddata'))throw Error('download failed');
 if(path==='/')return new Response(auth?'<html><meta name="moinpdf-offline" content="0.21.0">MoinPDF</html>':'Sign in',{status:auth?200:401,headers:{'content-type':'text/html','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Set-Cookie':'fixture=private'}});
 if(path==='/offline-manifest.json')return new Response(JSON.stringify(manifest));
 assert.ok(options.integrity,'Program downloads must require integrity');return new Response('asset');
};
const context={self:{location:{origin:'https://moinpdf.test'},clients:{claim:async()=>{}},addEventListener:(type,fn)=>events[type]=fn},caches:cacheAPI,fetch,Response,Headers,URL,Set,AbortController,console};
vm.runInNewContext((await readFile('scripts/offline-worker.js','utf8')).replace('__MOINPDF_OFFLINE_MANIFEST__',JSON.stringify(manifest)),context);
async function message(data){let promise;const list=[];events.message({data,source:{url:'https://moinpdf.test/'},ports:[{postMessage:value=>list.push(value)}],waitUntil:p=>promise=p});await promise;messages.push(...list);return list.at(-1);}
async function request(path,mode='cors',method='GET'){let response;events.fetch({request:{url:'https://moinpdf.test'+path,mode,method},respondWith:p=>response=p});return response?await response:undefined;}
assert.equal((await message({type:'status'})).result.ready.length,0);
assert.equal(cachesMap.size,0,'Checking status must not create empty caches');
await cacheAPI.open('unrelated-project-cache');
auth=false;assert((await message({type:'prepare',packs:['core']})).error);assert.equal((await message({type:'status'})).result.ready.length,0,'Sign-in HTML must never become an offline app');
auth=true;broken=true;assert((await message({type:'prepare',packs:['language-deu','core']})).error);assert.equal((await message({type:'status'})).result.ready.length,0,'Failed language preparation cannot activate a partial core');
broken=false;assert((await message({type:'prepare',packs:['core','language-deu']})).result.ready.includes('core'));
assert.equal(await request('/api/documents/jobs'),undefined,'No API interception');assert.equal(await request('/uploads/private.pdf'),undefined,'No document interception');assert.equal(await request('/assets/app.js','cors','POST'),undefined,'No mutation interception');
auth=false;assert.equal((await request('/','navigate')).status,401,'An online sign-in wall is not bypassed');
network=false;const offlineShell = await request('/','navigate');assert.equal(offlineShell.headers.get('Cross-Origin-Opener-Policy'),'same-origin');assert.equal(offlineShell.headers.get('Cross-Origin-Embedder-Policy'),'require-corp');assert.equal(offlineShell.headers.get('Set-Cookie'),null);assert.match(await(await request('/','navigate')).text(),/MoinPDF/);assert.equal(await(await request('/assets/app.js')).text(),'asset');assert.equal((await(await request('/offline-manifest.json')).json()).build,manifest.build);
await message({type:'remove',pack:'all'});assert(cachesMap.has('unrelated-project-cache'),'Removal is confined to offline program files');assert.equal((await request('/','navigate')).status,503);
assert((await message({type:'prepare',packs:['../../private']})).error);
network=true;auth=true;delay=true;const entered=new Promise(resolve=>started=resolve);const pending=message({type:'prepare',packs:['core']});await entered;await message({type:'cancel'});assert((await pending).error);assert.equal((await message({type:'status'})).result.ready.length,0,'Cancellation cannot complete a partially downloaded package');
console.log('PASS: offline package integrity requests, atomic completeness, sign-in wall preservation, offline restart shell, API/document exclusion, bounded cache removal and malformed package rejection.');
