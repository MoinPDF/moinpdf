/* Replaced by build-offline.mjs. Only explicitly selected, build-listed program
 * files are cached. Documents, requests to APIs and cross-origin traffic never
 * enter this cache. Downloads are verified by Fetch integrity before storage. */
const manifest = __MOINPDF_OFFLINE_MANIFEST__;
const prefix = 'moinpdf-offline-';
const mark = '/__moinpdf_offline_complete__';
const shell = '/__moinpdf_offline_shell__';
const cacheName = id => `${prefix}${manifest.build}-${id}`;
const allowed = new Set(manifest.packs.flatMap(p => p.files.map(f => f.url)));
let job = false;
let stopped = false;
let controller;
allowed.add('/offline-manifest.json');
self.addEventListener('activate', event => event.waitUntil((async () => {
  if (await complete('core')) for (const name of await caches.keys()) if (name.startsWith(prefix) && !name.startsWith(`${prefix}${manifest.build}-`)) await caches.delete(name);
  await self.clients.claim();
})()));
async function complete(id) { return await caches.has(cacheName(id)) && !!(await (await caches.open(cacheName(id))).match(mark)); }
async function status() {
  const ready = [];
  for (const pack of manifest.packs) if (await complete(pack.id)) ready.push(pack.id);
  return { build: manifest.build, version: manifest.version, ready };
}
async function prepare(ids, port) {
  const packs = ids.map(id => manifest.packs.find(p => p.id === id));
  if (packs.some(p => !p)) throw new Error('Unknown offline package');
  // Activate the new app only after all requested language/engine packs exist.
  packs.sort((a,b) => Number(a.id === 'core') - Number(b.id === 'core'));
  for (const pack of packs) {
    if (stopped) throw new Error('Abgebrochen / Cancelled');
    if (await complete(pack.id)) continue;
    const name = cacheName(pack.id), cache = await caches.open(name);
    try {
      let done = 0;
      for (const file of pack.files) {
        if (stopped) throw new Error('Abgebrochen / Cancelled');
        const response = await fetch(file.url, { cache: 'no-store', credentials: 'same-origin', integrity: file.integrity, signal: controller.signal });
        if (!response.ok || response.redirected || response.type === 'opaque') throw new Error('Offline-Datei nicht verfügbar / Offline file unavailable');
        await cache.put(file.url, response);
        done += file.size;
        port.postMessage({ progress: { pack: pack.id, done, total: pack.bytes } });
      }
      if (pack.id === 'core') {
        const response = await fetch('/', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        const html = await response.text();
        if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html') ||
          !html.includes('name="moinpdf-offline"') || !html.includes(`content="${manifest.version}"`))
          throw new Error('Bitte MoinPDF online öffnen und erneut versuchen / Open MoinPDF online and retry');
        await cache.put('/offline-manifest.json', new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }));
        // Keep security/isolation policies required by local WASM engines, never cookies or authentication headers.
        const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
        for (const name of ['Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy', 'Cross-Origin-Resource-Policy', 'Content-Security-Policy', 'Referrer-Policy', 'Permissions-Policy']) {
          const value = response.headers.get(name); if (value) headers.set(name, value);
        }
        await cache.put(shell, new Response(html, { headers }));
      }
      if (stopped) throw new Error('Abgebrochen / Cancelled');
      await cache.put(mark, new Response(manifest.build));
    } catch (error) { await caches.delete(name); throw error; }
  }
  // A waiting update activates when all older app tabs close. Never replace the
  // worker underneath an active editor or force a page reload.
}
self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port || !event.source || new URL(event.source.url).origin !== self.location.origin) return;
  const message = event.data;
  event.waitUntil((async () => {
    try {
      if (message?.type === 'status') port.postMessage({ result: await status() });
      else if (message?.type === 'cancel') { stopped = true; controller?.abort(); port.postMessage({ result: true }); }
      else if (message?.type === 'prepare') {
        if (job) throw new Error('Offline-Download läuft bereits / Offline download already running');
        if (!Array.isArray(message.packs) || message.packs.length > manifest.packs.length) throw new Error('Invalid packages');
        job = true; stopped = false; controller = new AbortController();
        try { await prepare([...new Set(message.packs)], port); port.postMessage({ result: await status() }); }
        finally { job = false; }
      } else if (message?.type === 'remove') {
        if (job) throw new Error('Bitte zuerst den Download abbrechen / Cancel the download first');
        if (message.pack === 'all') {
          for (const name of await caches.keys()) if (name.startsWith(prefix)) await caches.delete(name);
        } else if (manifest.packs.some(p => p.id === message.pack)) await caches.delete(cacheName(message.pack));
        else throw new Error('Invalid package');
        port.postMessage({ result: await status() });
      }
    } catch (error) { port.postMessage({ error: String(error?.message || error) }); }
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  if (!navigation && !allowed.has(url.pathname)) return;
  event.respondWith((async () => {
    if (url.pathname === '/offline-manifest.json') {
      try { return await fetch(request); } catch {
        if (await complete('core')) { const saved = await (await caches.open(cacheName('core'))).match(url.pathname); if (saved) return saved; }
        return new Response('{}', {status:503, headers:{'Content-Type':'application/json'}});
      }
    }
    if (navigation) {
      // An online sign-in wall is never bypassed with the saved application.
      try { return await fetch(request); }
      catch {
        if (await complete('core')) {
          const saved = await (await caches.open(cacheName('core'))).match(shell);
          if (saved) return saved;
        }
        return new Response('MoinPDF ist noch nicht offline eingerichtet. / MoinPDF has not been prepared for offline use.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    }
    for (const pack of manifest.packs) if (pack.files.some(file => file.url === url.pathname) && await complete(pack.id)) {
      const response = await (await caches.open(cacheName(pack.id))).match(url.pathname);
      if (response) return response;
    }
    return fetch(request);
  })());
});
