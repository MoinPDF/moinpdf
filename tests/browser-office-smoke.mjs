import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the shipped worker's complete destroy path, including the bundled
// converter. Stubbing only the page-side Worker misses nested pthread teardown.
const runtime = await readFile('public/vendor/office/browser.worker.global.js', 'utf8');
const loaded = 'self.postMessage({type:"loaded"});';
assert.equal(runtime.split(loaded).length, 2, 'Pinned worker has one initialization hook');
const setup = `self.prepareShutdownTest = (module, bindings, converter) => {
  E=module;c=bindings;b=true;W=converter?new Z():null;
  if(W){W.module=E;W.lokBindings=c;W.initialized=true;}
  self.testConverter=W;
  N.set('session',{docPtr:11,filePath:'/tmp/session.docx'});
  v={docPtr:22,filePath:'/tmp/cached.docx'};
  return ()=>({module:E,bindings:c,converter:W,initialized:b,sessions:N.size,cached:v});
};`;
for (const converter of [true, false]) {
  for (const throws of [false, true]) {
    const events = [], timers = [], self = {
      postMessage: data => events.push(['message', data.type, data.id]),
      close: () => events.push(['close']),
    };
    const context = vm.createContext({self,TextEncoder,TextDecoder,console:{log(){}},setTimeout:fn=>timers.push(fn)});
    vm.runInContext(runtime.replace(loaded, setup + loaded), context);
    events.length = 0;
    const child = {terminate:()=>events.push(['child-terminated'])};
    const pool = {terminateAllThreads:()=>events.push(['pool-terminated']),runningWorkers:[child],unusedWorkers:[child]};
    const bindings = {
      unregisterCallback: ptr => events.push(['unregister',ptr]),
      documentDestroy: ptr => events.push(['document-destroyed',ptr]),
      destroy: () => {events.push(['bindings-destroyed']);if(throws)throw new Error('Native cleanup failed');},
    };
    const state = self.prepareShutdownTest({PThread:pool,FS:{unlink:path=>events.push(['unlink',path])}},bindings,converter);
    const instance = self.testConverter;
    await self.onmessage({data:{type:'destroy',id:3}});
    assert.deepEqual(events,[
      ['unregister',11],['document-destroyed',11],['unlink','/tmp/session.docx'],
      ['document-destroyed',22],['unlink','/tmp/cached.docx'],
      ['bindings-destroyed'],['message','ready',3],
    ],'Document cleanup must acknowledge without terminating pthread children before their owner');
    assert.deepEqual(JSON.parse(JSON.stringify(state())),{module:null,bindings:null,converter:null,initialized:false,sessions:0,cached:null});
    if(instance){assert.equal(instance.getModule(),null);assert.equal(instance.getLokBindings(),null);assert.equal(instance.isReady(),false);}
    assert.equal(pool.runningWorkers.length,1,'The owner still owns its running children');
    assert.equal(pool.unusedWorkers.length,1,'The owner still owns its idle children');
    for(const timer of timers)timer();
    assert.deepEqual(events.at(-1),['close']);
  }
}

await mkdir('.cache', { recursive: true });
const code = ts.transpileModule(await readFile('lib/browser-office.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace(/import \{ openSource \} from '.\/pdf-engine';/, "const openSource=async()=>({pdf:{numPages:1,loadingTask:{destroy:async()=>{}}}});");
await writeFile('.cache/office-adapter.mjs', code);
Object.assign(globalThis, { window: {}, isSecureContext: true, crossOriginIsolated: true, location: { href: 'https://moin.test/' } });
const digest = bytes => createHash('sha256').update(bytes).digest('hex'), assets = new Map(), files = [];
for (const name of ['browser.worker.global.js', 'soffice.js', 'soffice.worker.js', 'soffice.wasm', 'soffice.data']) {
  const raw = Buffer.from('runtime:' + name), binary = /\.(wasm|data)$/.test(name), data = binary ? gzipSync(raw) : raw;
  const path = binary ? 'chunks/' + name + '.gz.part-00' : name;
  assets.set('/vendor/office/' + path, data);
  files.push({ path: name, bytes: data.length, sha256: digest(data), rawBytes: raw.length, rawSha256: digest(raw), ...(binary ? { encoding: 'gzip', parts: [{ path, bytes: data.length, sha256: digest(data) }] } : {}) });
}
let bad = false, mode = 'success', started;
const requests = [], workers = [], liveUrls = new Set();
const createUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL;
URL.createObjectURL = blob => { const url = createUrl(blob); liveUrls.add(url); return url; };
URL.revokeObjectURL = url => { liveUrls.delete(url); revokeUrl(url); };
globalThis.fetch = async (url, options) => {
  requests.push([String(url), options]);
  if (String(url).endsWith('manifest.json')) return Response.json({ version: '2.7.2', files });
  return new Response(bad ? Buffer.from('tampered') : assets.get(String(url).split('?')[0]));
};
globalThis.Worker = class {
  constructor() {
    this.events = []; this.mode = mode; workers.push(this);
    queueMicrotask(() => this.emit({ type: 'loaded' }));
  }
  emit(data) { this.onmessage?.({ data }); }
  postMessage(data) {
    this.events.push(data.type);
    if (data.type === 'init') {
      started?.();
      if (this.mode !== 'abort-init') queueMicrotask(() => this.emit({ type: 'ready', id: 1 }));
    } else if (data.type === 'convert') {
      queueMicrotask(() => this.emit({ type: 'result', id: 2, data: new TextEncoder().encode('%PDF-1.7\nfixture') }));
    } else if (data.type === 'destroy') {
      // An initialization already in flight can finish after cancellation.
      this.emit({ type: 'ready', id: 1 });
      if (this.mode === 'unresponsive') return;
      if (this.mode === 'destroy-throws') throw new Error('Worker already closed');
      setTimeout(() => {
        this.events.push('destroyed');
        this.emit({ type: 'ready', id: 3 });
        setTimeout(() => {
          if (!this.events.includes('terminated')) this.events.push('self-closed');
        }, 100);
      }, 20);
    }
  }
  terminate() { this.events.push('terminated'); }
};
const { convertOfficeLocally, browserOfficeUnavailable } = await import('../.cache/office-adapter.mjs');
const file = new File(['document'], 'Moin.docx'), signal = new AbortController().signal;
assert.equal(browserOfficeUnavailable(), null);
assert.equal((await convertOfficeLocally(file, signal)).filename, 'Moin.pdf');
assert.deepEqual(workers.at(-1).events, ['init', 'convert', 'destroy', 'destroyed', 'self-closed', 'terminated']);
assert.equal(liveUrls.size, 0);
assert(requests.every(([url, options]) => url.startsWith('/vendor/office/') && !options?.method));

bad = true;
await assert.rejects(convertOfficeLocally(file, signal), /Prüfsumme/);
bad = false;
mode = 'abort-init';
const abort = new AbortController();
const initialized = new Promise(resolve => { started = resolve; });
let settled = false;
const job = convertOfficeLocally(file, abort.signal).finally(() => { settled = true; });
const rejected = assert.rejects(job, { name: 'AbortError' });
await initialized;
abort.abort();
assert.equal(settled, false, 'Caller must await cleanup before starting the next conversion');
assert.equal(liveUrls.size, 2, 'Runtime URLs remain available during teardown');
await rejected;
assert.deepEqual(workers.at(-1).events, ['init', 'destroy', 'destroyed', 'self-closed', 'terminated'], 'Late ready must not start a cancelled conversion; responsive cleanup may close its own worker first');
assert.equal(liveUrls.size, 0);
started = undefined;
mode = 'success';
assert.equal((await convertOfficeLocally(file, signal)).filename, 'Moin.pdf');
assert.deepEqual(workers.at(-1).events, ['init', 'convert', 'destroy', 'destroyed', 'self-closed', 'terminated']);

for (mode of ['unresponsive', 'destroy-throws']) {
  const begin = Date.now();
  assert.equal((await convertOfficeLocally(file, signal)).filename, 'Moin.pdf');
  assert.deepEqual(workers.at(-1).events, ['init', 'convert', 'destroy', 'terminated']);
  assert(Date.now() - begin < 2500, 'Hard termination bounds unresponsive cleanup');
  assert.equal(liveUrls.size, 0);
}
await assert.rejects(convertOfficeLocally(new File(['x'], 'bad.pub'), signal), /unterstützt/);
globalThis.crossOriginIsolated = false;
await assert.rejects(convertOfficeLocally(file, signal), /isoliertem/);
console.log('PASS: Office integrity, no uploads, acknowledged cleanup, abort during initialization, ignored late ready, restart and bounded termination fallback.');
