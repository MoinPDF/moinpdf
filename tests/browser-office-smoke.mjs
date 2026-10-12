import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import ts from 'typescript';

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
      setTimeout(() => { this.events.push('destroyed'); this.emit({ type: 'ready', id: 3 }); }, 20);
    }
  }
  terminate() { this.events.push('terminated'); }
};
const { convertOfficeLocally, browserOfficeUnavailable } = await import('../.cache/office-adapter.mjs');
const file = new File(['document'], 'Moin.docx'), signal = new AbortController().signal;
assert.equal(browserOfficeUnavailable(), null);
assert.equal((await convertOfficeLocally(file, signal)).filename, 'Moin.pdf');
assert.deepEqual(workers.at(-1).events, ['init', 'convert', 'destroy', 'destroyed', 'terminated']);
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
assert.deepEqual(workers.at(-1).events, ['init', 'destroy', 'destroyed', 'terminated'], 'Late ready must not start a cancelled conversion');
assert.equal(liveUrls.size, 0);
started = undefined;
mode = 'success';
assert.equal((await convertOfficeLocally(file, signal)).filename, 'Moin.pdf');
assert.deepEqual(workers.at(-1).events, ['init', 'convert', 'destroy', 'destroyed', 'terminated']);

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
