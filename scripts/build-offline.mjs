import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(process.argv[2] || 'dist/selfhost');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const packs = new Map();
async function visit(directory) {
  for (const name of (await readdir(directory)).sort()) {
    const path = resolve(directory, name), info = await stat(path);
    if (info.isDirectory()) { await visit(path); continue; }
    const url = '/' + relative(root, path).replaceAll('\\', '/');
    if (/\.(?:map|zip)$/.test(url) || /\/(?:media|component-notices)\//.test(url) ||
      ['/.assetsignore','/index.html','/sw.js','/offline-manifest.json','/_headers','/_redirects'].includes(url)) continue;
    if (!/\.gz\.part-\d+$/.test(url) && !/\.(?:js|mjs|css|html|json|wasm|gz|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf|pfb|bcmap|webmanifest|bin|data)$/.test(url)) continue;
    const language = /^\/vendor\/languages\/([a-z_]+)\.traineddata\.gz$/.exec(url);
    const id = language ? 'language-' + language[1] : url.startsWith('/vendor/office/') ? 'office' : url.startsWith('/vendor/llm/') ? 'assistant' : 'core';
    const bytes = await readFile(path);
    const file = { url, size: info.size, integrity: 'sha256-' + createHash('sha256').update(bytes).digest('base64') };
    if (!packs.has(id)) packs.set(id, { id, bytes: 0, files: [] });
    const pack = packs.get(id); pack.files.push(file); pack.bytes += info.size;
  }
}
await visit(root);
const all = [...packs.values()].sort((a,b) => a.id.localeCompare(b.id));
const build = createHash('sha256').update(version + JSON.stringify(all)).digest('hex').slice(0,24);
const manifest = { version, build, packs: all };
await writeFile(resolve(root,'offline-manifest.json'), JSON.stringify(manifest));
const worker = await readFile('scripts/offline-worker.js','utf8');
await writeFile(resolve(root,'sw.js'), worker.replace('__MOINPDF_OFFLINE_MANIFEST__', JSON.stringify(manifest)));
console.log(`Offline packages: ${all.length}; core ${Math.round(packs.get('core').bytes / 1024 ** 2)} MiB; build ${build}`);
