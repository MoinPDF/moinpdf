import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {PDFDocument,PDFName,PDFDict,PDFSignature,PDFButton,degrees} from 'pdf-lib';
import {decodePnm} from '../public/workers/pnm-decode.mjs';
import {createTransferHandler,memoryTransferStore,TTL} from '../docker/datev/transfer.mjs';
import {once} from 'node:events';
import {createDatevServer} from '../docker/datev/server.mjs';
import {timestampHandler} from '../docker/datev/timestamp.mjs';
await mkdir('.cache/release-036',{recursive:true});
for(const name of ['pdf-signature-guard','form-actions','pdf-timestamp','scan-transfer']){
 const out=ts.transpileModule(await readFile('lib/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);
 await writeFile('.cache/release-036/'+name+'.mjs',out);
}
const {sealTransfer,openTransfer,randomHex,transferFromHash}=await import('../.cache/release-036/scan-transfer.mjs');
// Exercise real PDF creation with the same extraction-backed fixture as the form suite.
for(const name of ['form-actions','pdf-signature-guard'])await writeFile('.cache/'+name+'-document-test.mjs',ts.transpileModule(await readFile('lib/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
await import('./document-tools-smoke.mjs');
const {newFormField,saveDocumentDraft,readDocumentDraft}=await import('../.cache/document-tools-document-test.mjs');
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
for(const rotation of [0,90,180,270]){
 const doc=await PDFDocument.create();doc.addPage([300,400]).setRotation(degrees(rotation));const bytes=await doc.save();
 const pdf=await pdfjs.getDocument({data:bytes.slice()}).promise;const source={id:'test',name:'Synthetic.pdf',bytes,pdf,size:bytes.length,kind:'pdf'};
 try{const draft=await readDocumentDraft(source);
  for(const kind of ['signature','button'])draft.fields.push(newFormField(draft.fields,kind,0,{x:.1,y:.15,w:.5,h:.1}));
  const out=await saveDocumentDraft(source,draft,'create-form');const saved=await PDFDocument.load(await out.blob.arrayBuffer());
  const [signature,button]=saved.getForm().getFields();assert(signature instanceof PDFSignature);assert(button instanceof PDFButton);assert(!signature.acroField.dict.has(PDFName.of('V')));
  assert.equal(button.acroField.getWidgets()[0].dict.lookup(PDFName.of('A'),PDFDict).get(PDFName.of('S')).toString(),'/ResetForm');
  assert.equal(saved.getPage(0).getRotation().angle,rotation);
  await assert.rejects(()=>saveDocumentDraft(source,draft,'create-form',true),/interaktiv/);
  draft.fields[1].action={kind:'submit',url:'https://example.org/form'};
  const submit=await PDFDocument.load(await(await saveDocumentDraft(source,draft,'create-form')).blob.arrayBuffer());
  assert.equal(submit.getForm().getButton(draft.fields[1].name).acroField.getWidgets()[0].dict.lookup(PDFName.of('A'),PDFDict).get(PDFName.of('S')).toString(),'/SubmitForm');
  draft.fields[1].action={kind:'submit',url:'javascript:alert(1)'};await assert.rejects(()=>saveDocumentDraft(source,draft,'create-form'),/HTTPS/);
 }finally{await pdf.loadingTask.destroy();}
}
const text=s=>new TextEncoder().encode(s),join=(a,b)=>new Uint8Array([...text(a),...b]);
for(const bytes of [text('P1\n#comment\n2 1\n1 0\n'),text('P2\n2 1\n255\n0 255'),text('P3\n2 1\n255\n0 0 0 255 255 255'),join('P4\n2 1\n',[128]),join('P5\n2 1\n255\n',[0,255]),join('P6\n2 1\n255\n',[0,0,0,255,255,255]),join('P7\nWIDTH 2\nHEIGHT 1\nDEPTH 1\nMAXVAL 255\nTUPLTYPE GRAYSCALE\nENDHDR\n',[0,255])]){
 const out=decodePnm(bytes);assert.equal(out.width,2);assert.deepEqual([...out.data],[0,0,0,255,255,255,255,255]);
}
assert.deepEqual([...decodePnm(join('P5\r\n1 1\r\n255\r\n',[10])).data],[10,10,10,255]);
assert.deepEqual([...decodePnm(join('P5\n1 1\n65535\n',[128,0])).data],[128,128,128,255]);
for(const b of [text('P6\n99999999 99999999\n255\n'),join('P6\n2 2\n255\n',[1]),text('P1\n1 1\n2')])assert.throws(()=>decodePnm(b));
let now=100000;const handler=createTransferHandler(memoryTransferStore(),()=>now);
const call=(s,role,action='',init={})=>handler(new Request('https://moin.test/api/transfer'+(s?'/'+s.id:'')+action,{...init,headers:{'X-MoinPDF-Client':'web',...(s?{Authorization:'Bearer '+s[role]}:{}),...init.headers}}));
const session=await(await call(null,null,'',{method:'POST'})).json();const key=randomHex(32),id=randomHex(16),file=new File([text('synthetic scan')],'Scan.pdf',{type:'application/pdf'}),cipher=await sealTransfer(file,key,id);
assert.equal((await call(session,'send','/file',{method:'PUT',headers:{'X-Transfer-Id':id},body:cipher})).status,201);
assert.equal((await call(session,'send','/file?id='+id)).status,405,'Sender cannot retrieve files');
const received=new Uint8Array(await(await call(session,'receive','/file?id='+id)).arrayBuffer());assert.equal(await(await openTransfer(received,key,id)).text(),'synthetic scan');
const tampered=received.slice();tampered[20]^=1;await assert.rejects(()=>openTransfer(tampered,key,id));await assert.rejects(()=>openTransfer(received,key,randomHex(16)));
assert.equal((await call(session,'send','/ack',{method:'POST',headers:{'X-Transfer-Id':id}})).status,405);
assert.equal((await call(session,'receive','/ack',{method:'POST',headers:{'X-Transfer-Id':id}})).status,200);
assert.equal((await(await call(session,'send')).json()).ack,id);
assert.equal((await call(session,'send','/file',{method:'PUT',headers:{'X-Transfer-Id':id},body:cipher})).status,200,'Retry is idempotent');
assert.equal((await call(session,'receive','/file?id='+id)).status,404,'Acknowledged content is deleted');
assert(!transferFromHash('#unrelated'));assert.throws(()=>transferFromHash('#moin-transfer=invalid'));
now+=TTL;assert.equal((await call(session,'send')).status,410);
assert.equal((await handler(new Request('https://moin.test/api/transfer',{method:'POST'}))).status,403);
assert.equal((await handler(new Request('http://moin.test/api/transfer',{method:'POST',headers:{'X-MoinPDF-Client':'web','Origin':'https://moin.test','Sec-Fetch-Site':'same-origin'}}))).status,201,'TLS terminated at reverse proxy');
assert.equal((await handler(new Request('http://moin.test/api/transfer',{method:'POST',headers:{'X-MoinPDF-Client':'web','Origin':'https://other.test','Sec-Fetch-Site':'same-origin'}}))).status,403);
let forwarded=false;assert.equal((await timestampHandler(new Request('https://moin.test/api/timestamp',{method:'POST',headers:{'X-MoinPDF-Client':'web'},body:new Uint8Array(4097)}),()=>{forwarded=true;})).status,413);assert.equal(forwarded,false);
// Exercise the actual HTTP adapter: binary ciphertext must not pass through UTF-8.
const server=createDatevServer({});server.listen(0,'127.0.0.1');await once(server,'listening');
try{
 const origin='http://127.0.0.1:'+server.address().port;
 const created=await fetch(origin+'/api/transfer',{method:'POST',headers:{'X-MoinPDF-Client':'web'}});assert.equal(created.status,201);const live=await created.json();
 const url=origin+'/api/transfer/'+live.id;
 const upload=await fetch(url+'/file',{method:'PUT',headers:{'X-MoinPDF-Client':'web',Authorization:'Bearer '+live.send,'X-Transfer-Id':id},body:cipher});assert.equal(upload.status,201);
 const download=await fetch(url+'/file?id='+id,{headers:{'X-MoinPDF-Client':'web',Authorization:'Bearer '+live.receive}});assert.equal(download.status,200);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),cipher);
 const close=await fetch(url,{method:'DELETE',headers:{'X-MoinPDF-Client':'web',Authorization:'Bearer '+live.receive}});assert.equal(close.status,200);
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
// Independent OpenSSL TSA with critical EKU and ESS certificate binding; no network dependency.
const path='.cache/release-036/',openssl=args=>execFileSync('openssl',args,{stdio:'pipe'});
openssl(['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path+'tsa.key','-out',path+'tsa.crt','-days','2','-subj','/CN=MoinPDF fictional TSA','-addext','extendedKeyUsage=critical,timeStamping','-addext','keyUsage=critical,digitalSignature']);
await writeFile(path+'serial','01\n');await writeFile(path+'tsa.cnf',`[tsa]\ndefault_tsa=tsa_config\n[tsa_config]\nserial=${path}serial\ncrypto_device=builtin\nsigner_cert=${path}tsa.crt\nsigner_key=${path}tsa.key\ncerts=${path}tsa.crt\nsigner_digest=sha256\ndefault_policy=1.2.3.4.1\ndigests=sha256\naccuracy=secs:1\nordering=yes\ntsa_name=yes\ness_cert_id_chain=no\ness_cert_id_alg=sha256\n`);
const {timestampPdf}=await import('../.cache/release-036/pdf-timestamp.mjs');const original=await PDFDocument.create();original.addPage().drawText('Fictional timestamp fixture');
const exchange=async body=>{await writeFile(path+'request.der',new Uint8Array(body));openssl(['ts','-reply','-config',path+'tsa.cnf','-queryfile',path+'request.der','-out',path+'reply.der']);const b=await readFile(path+'reply.der');return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);};
const originalBytes=await original.save();const stamped=await timestampPdf(originalBytes,exchange);await writeFile(path+'timestamp.pdf',stamped.bytes);
const output=Buffer.from(stamped.bytes).toString('latin1'),range=/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(output).slice(1).map(Number);assert.equal(range[2]+range[3],stamped.bytes.length);
await writeFile(path+'signed.bin',Buffer.concat([stamped.bytes.subarray(0,range[1]),stamped.bytes.subarray(range[2])]));
openssl(['ts','-verify','-in',path+'reply.der','-data',path+'signed.bin','-CAfile',path+'tsa.crt']);
await assert.rejects(()=>timestampPdf(stamped.bytes,exchange),/Signatur/);
await assert.rejects(()=>timestampPdf(originalBytes,async body=>{const b=new Uint8Array(await exchange(body));b[b.length-3]^=1;return b.buffer;}));

console.log('PASS: PDF signature fields and actions, seven PNM variants, transfer encryption/roles/acknowledgement/expiry, bounded TSA proxy and independently verified RFC3161 PDF timestamp.');
