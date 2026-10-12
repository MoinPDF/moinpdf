import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const version='2.7.2',digest='14d670936fe220ee49becbfd40bf233ceabb94981fa9987fccde345449ee2c3a',cache='.cache/browser-office',out='public/vendor/office';
const sha=b=>createHash('sha256').update(b).digest('hex');
const patches=JSON.parse(await readFile('public/component-notices/browser-office/MOINPDF-PATCHES.json','utf8'));
await mkdir(cache,{recursive:true});
let archive;try{archive=await readFile(cache+'/runtime.tgz');if(sha(archive)!==digest)archive=null;}catch{}
if(!archive){for(let attempt=0;attempt<3;attempt++){const r=await fetch('https://registry.npmjs.org/@matbee/libreoffice-converter/-/libreoffice-converter-'+version+'.tgz');if(!r.ok)throw new Error('Office runtime download failed: '+r.status);const bytes=Buffer.from(await r.arrayBuffer());if(sha(bytes)===digest){archive=bytes;break;}}if(!archive)throw new Error('Office archive checksum mismatch');await writeFile(cache+'/runtime.tgz',archive);}
const paths=['dist/browser.worker.global.js','wasm/soffice.js','wasm/soffice.worker.js','wasm/soffice.wasm','wasm/soffice.data'];
execFileSync('tar',['-xzf',cache+'/runtime.tgz','-C',cache,...paths.map(p=>'package/'+p)]);
await rm(out,{recursive:true,force:true});await mkdir(out+'/chunks',{recursive:true});
const files=[];
for(const path of paths){let raw=await readFile(cache+'/package/'+path);const name=path.split('/').at(-1),binary=/\.(wasm|data)$/.test(name);
 if(name==='browser.worker.global.js'){let code=raw.toString('utf8');for(const {before,after} of patches.replacements){if(code.split(before).length!==2)throw new Error('Pinned Office worker patch did not match exactly once: '+before);code=code.replace(before,after);}raw=Buffer.from(code);}
 const item={path:name,rawBytes:raw.length,rawSha256:sha(raw)};
 if(binary){const compressed=gzipSync(raw,{level:9});item.encoding='gzip';item.bytes=compressed.length;item.sha256=sha(compressed);item.parts=[];for(let offset=0;offset<compressed.length;offset+=8*1024*1024){const chunk=compressed.subarray(offset,offset+8*1024*1024),chunkPath='chunks/'+name+'.gz.part-'+String(item.parts.length).padStart(2,'0');await writeFile(out+'/'+chunkPath,chunk);item.parts.push({path:chunkPath,bytes:chunk.length,sha256:sha(chunk)});}}
 else{await writeFile(out+'/'+name,raw);item.bytes=raw.length;item.sha256=item.rawSha256;}
 files.push(item);
}
await writeFile(out+'/manifest.json',JSON.stringify({version,patch:patches.id,tarballSha256:digest,files},null,2)+'\n');
console.log('Verified local Office runtime prepared (LibreOffice/WASM '+version+').');
