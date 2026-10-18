import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const originalFetch = globalThis.fetch;
const source = await readFile(new URL('../lib/document-server.ts', import.meta.url), 'utf8');
async function load(integrated) {
  const javascript = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(`const __MOINPDF_SELF_HOSTED__ = ${integrated};\n` + javascript).toString('base64'));
}
try {
  const docker = await load(true), hosted = await load(false);
  let request;
  globalThis.fetch = async (url, options) => {
    request = {url, options};
    return new Response(JSON.stringify({apiVersion:1,service:'test',capabilities:{translate:true}}));
  };
  const signal = new AbortController().signal;
  await docker.serverCapabilities('/api/documents', '', signal);
  assert.equal(request.url, '/api/documents/v1/capabilities');
  assert.deepEqual(request.options.headers, {'X-MoinPDF-Client':'web'});
  assert.equal(request.options.credentials, 'same-origin');
  await docker.serverCapabilities('/api/website', '', signal);
  assert.equal(request.url, '/api/website/v1/capabilities');
  assert.deepEqual(request.options.headers, {'X-MoinPDF-Client':'web'});
  assert.equal(request.options.credentials, 'same-origin');
  assert.throws(()=>hosted.documentServerUrl('/api/website'));
  await assert.rejects(hosted.serverCapabilities('/api/documents','',signal), /API-Schlüssel/);
  assert.throws(()=>hosted.documentServerUrl('/api/documents'));
  assert.throws(()=>docker.documentServerUrl('//untrusted.example'));
  await assert.rejects(docker.serverCapabilities('https://external.example','',signal), /API-Schlüssel/);
  await hosted.serverCapabilities('https://external.example','a-test-key',signal);
  assert.equal(request.options.credentials,'omit');
  assert.equal(request.options.headers.Authorization,'Bearer a-test-key');
  const originalTimer=globalThis.setTimeout;
  try {
    globalThis.setTimeout=(callback)=>originalTimer(callback,1);
    globalThis.fetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
    await assert.rejects(docker.serverCapabilities('/api/documents','',signal),/antwortet gerade nicht/);
  } finally {globalThis.setTimeout=originalTimer;}
  await assert.rejects(docker.serverCapabilities('/api/documents','',AbortSignal.abort()),{name:'AbortError'});
  // Headers can arrive before the download stalls. Keep timeout and cancellation
  // active until the response body has actually been read.
  try {
    globalThis.fetch=async(_url,options)=>new Response(new ReadableStream({
      start(controller){options.signal.addEventListener('abort',()=>controller.error(options.signal.reason),{once:true});}
    }),{headers:{'content-type':'application/pdf'}});
    const bounded=promise=>Promise.race([promise,new Promise((_,reject)=>originalTimer(()=>reject(new Error('Response body remained pending')),150))]);
    const abort=new AbortController();
    const pending=docker.runServerJob('/api/documents','','/v1/office',new FormData(),abort.signal);
    originalTimer(()=>abort.abort(),5);
    await assert.rejects(bounded(pending),{name:'AbortError'});
    globalThis.setTimeout=callback=>originalTimer(callback,5);
    await assert.rejects(bounded(docker.runServerJob('/api/documents','','/v1/office',new FormData(),signal)),/dauert zu lange/);
    await assert.rejects(bounded(docker.serverCapabilities('/api/documents','',signal)),/antwortet gerade nicht/);
  } finally {globalThis.setTimeout=originalTimer;}
  const storage=new Map();
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  let ticket,jobId,requests=[];
  globalThis.fetch=async(url,options)=>{
    requests.push(url);
    assert.equal(options.headers['X-MoinPDF-Client'],'web');
    ticket=options.headers['X-MoinPDF-Job-Ticket'];assert.match(ticket,/^[a-f0-9]{64}$/);
    jobId=ticket.slice(0,32);
    if(url.endsWith('/v1/jobs')) {
      assert.equal(options.body.get('operation'),'/v1/office');
      return new Response(JSON.stringify({id:jobId,status:'queued',expires:Date.now()/1000+86400}));
    }
    if(url.endsWith('/result'))return new Response('PDF-result',{headers:{'content-type':'application/pdf','content-disposition':'attachment; filename="converted.pdf"'}});
    return new Response(JSON.stringify({id:jobId,status:'completed',expires:Date.now()/1000+86400}));
  };
  const body=new FormData();body.append('file',new File(['office'],'sample.docx'));
  const queued=await docker.runQueuedServerJob('/api/documents','','/v1/office',body,signal);
  assert.equal(queued.filename,'converted.pdf');assert.equal(await queued.blob.text(),'PDF-result');assert.equal(requests.length,3);
  const saved=docker.storedServerJobs()[0];assert.equal(saved.ticket,ticket);
  requests=[];
  await docker.resumeServerJob(saved,'',signal);
  assert.equal(requests.length,2);assert.ok(!requests.some(url=>url.endsWith('/v1/jobs')),'Resume must not upload the input again');
  let cancelled=false;
  globalThis.fetch=async(url)=>{
    if(url.endsWith('/cancel'))cancelled=true;
    return new Response(JSON.stringify({status:cancelled?'cancelled':'running',expires:Date.now()/1000+86400}));
  };
  const cancel=new AbortController();const waiting=docker.resumeServerJob(saved,'',cancel.signal);originalTimer(()=>cancel.abort(),5);
  await assert.rejects(waiting,{name:'AbortError'});assert.equal(cancelled,true,'User cancellation reaches the server');
  cancelled=false;
  const detach=new AbortController();const background=docker.resumeServerJob(saved,'',detach.signal);originalTimer(()=>detach.abort('detach'),5);
  await assert.rejects(background);assert.equal(cancelled,false,'Closing the view leaves the background job running');
  console.log('PASS: integrated authentication, same-origin credentials, timeouts and cancellation through complete response-body downloads.');
} finally { globalThis.fetch = originalFetch; }
