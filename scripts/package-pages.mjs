import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import JSZip from 'jszip';

// Export only the standalone web build, never the repository or server secrets.
const root = path.resolve('dist/selfhost');
const output = path.resolve('dist/MoinPDF-Pages.zip');
const zip = new JSZip();
for (const name of ['index.html', 'impressum.html', 'datenschutz.html']) {
  if (!(await stat(path.join(root, name))).isFile()) throw new Error(`Missing ${name}; run pnpm run build:selfhost first.`);
}
async function add(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    const name = prefix + entry.name;
    if (entry.isDirectory()) await add(file, name + '/');
    else if (entry.isFile()) zip.file(name, createReadStream(file), { date: new Date('2026-01-01T00:00:00Z') });
    else throw new Error(`Refusing non-regular build entry: ${name}`);
  }
}
await add(root);
await pipeline(zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'DEFLATE', compressionOptions: { level: 6 } }), createWriteStream(output));
const hash = createHash('sha256');
for await (const part of createReadStream(output)) hash.update(part);
const size = (await stat(output)).size;
if (size > 100 * 1024 * 1024) throw new Error('The Pages ZIP exceeds the default 100 MiB upload limit.');
await writeFile(output + '.sha256', `${hash.digest('hex')}  ${path.basename(output)}\n`);
console.log(`Pages package: ${output} (${(size / 1024 / 1024).toFixed(1)} MiB)`);
console.log('Upload ZIP contents into the website root. /api/documents/* and /api/website/* must route to the Docker stack on the same hostname.');
