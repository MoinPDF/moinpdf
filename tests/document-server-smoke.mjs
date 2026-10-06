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
  console.log('PASS: integrated authentication, same-origin credentials, bounded readiness checks and cancellation.');
} finally { globalThis.fetch = originalFetch; }
