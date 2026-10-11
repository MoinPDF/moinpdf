import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { createWorkerConverter } = await import(pathToFileURL(path.join(root, 'package/dist/server.js')));
const bootStart = performance.now();
if (!process.argv[2]) throw new Error('Office fixture directory argument required');
const fixtureDir = path.resolve(process.argv[2]);
const outDir = path.join(root, 'results');
await fs.mkdir(outDir, { recursive: true });
const watchdog = setTimeout(() => {
  console.error('PROBE_WATCHDOG_TIMEOUT');
  process.exit(2);
}, 180000);
const converter = await createWorkerConverter({
  wasmPath: path.join(root, 'package/wasm'),
  verbose: false,
});
console.log('INITIALIZED', JSON.stringify({ms:Math.round(performance.now()-bootStart),rss:process.memoryUsage().rss}));
const results = [];
try {
  for (const name of ['sample.docx','sample.xlsx','sample.pptx','sample.odt','sample.ods','sample.odp','rich.docx','rich.xlsx','rich.pptx']) {
    const file = path.join(name.startsWith('rich.') ? path.join(root,'fixtures') : fixtureDir, name);
    const input = await fs.readFile(file);
    const started = performance.now();
    try {
      const result = await converter.convert(input, { outputFormat: 'pdf', inputFormat: name.split('.').pop() }, name);
      const target = path.join(outDir, `${name}.pdf`);
      await fs.writeFile(target, result.data);
      const record = { name, bytes: result.data.length, ms: Math.round(performance.now()-started), target, header: Buffer.from(result.data.slice(0,8)).toString() };
      results.push(record);
      console.log('RESULT', JSON.stringify(record));
    } catch (error) {
      const record = { name, error: String(error) };
      results.push(record);
      console.log('RESULT', JSON.stringify(record));
    }
  }
} finally {
  console.log('MEMORY', JSON.stringify(process.memoryUsage()));
  await fs.writeFile(path.join(outDir,'results.json'), JSON.stringify(results,null,2));
  await converter.destroy();
  clearTimeout(watchdog);
}
process.exit(results.every(r => !r.error) ? 0 : 1);
