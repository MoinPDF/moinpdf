// Optional acceptance probe; not part of the released application or CI dependency set.
// node tests/research/office-wasm-probe.mjs /path/to/unpacked/package /path/to/rich.docx /path/to/result.pdf
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [enginePath,input,output]=process.argv.slice(2);
if(!enginePath||!input||!output)throw new Error('Expected unpacked engine directory, input DOCX and output PDF.');
const engine=await import(pathToFileURL(join(resolve(enginePath),'oxidocs_wasm.js')).href);
await engine.default({module_or_path:new Uint8Array(await readFile(join(enginePath,'oxidocs_wasm_bg.wasm')))});
const result=engine.docx_to_pdf(new Uint8Array(await readFile(input)));
await writeFile(output,result);
console.log(`Exported ${result.length} bytes. Independently render and compare to fixture; this is not an acceptance result.`);
