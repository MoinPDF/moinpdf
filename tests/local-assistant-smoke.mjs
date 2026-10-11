import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import ts from 'typescript';
await mkdir('.cache',{recursive:true});
for(const name of ['grounded-assistant','content-digest']) {
  const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  await writeFile(`.cache/${name}-assistant.mjs`,code);
}
const {selectPassages,validateGroundedAnswer,assistantPrompt}=await import('../.cache/grounded-assistant-assistant.mjs');
const {contentDigestBlob}=await import('../.cache/content-digest-assistant.mjs');
const rects=[{x:.1,y:.2,w:.6,h:.03}];
const pages=[{sourceId:'a',name:'Plan.pdf',page:0,mode:'text',lines:[{text:'Die Projektnummer ist 7429.',rects}]},{sourceId:'b',name:'Brief.pdf',page:2,mode:'text',lines:[{text:'Die Abgabe erfolgt am 12. November 2026.',rects}]}];
const passages=selectPassages(pages,'Wann erfolgt die Abgabe?');
assert.equal(passages[0].name,'Brief.pdf');
assert.deepEqual(JSON.parse(assistantPrompt('Frage',passages)).document_data[0],{passageId:passages[0].id,file:'Brief.pdf',page:3,text:'Die Abgabe erfolgt am 12. November 2026.'});
const valid={answer:'Am 12. November 2026.',abstain:false,citations:[{passageId:passages[0].id}]};
const answer=validateGroundedAnswer(JSON.stringify(valid),passages);
assert.equal(answer.citations[0].quote,'Die Abgabe erfolgt am 12. November 2026.');assert.equal(answer.citations[0].sourceId,'b');assert.equal(answer.citations[0].page,2);assert.deepEqual(answer.citations[0].rects,rects);
for(const change of [{citations:[]},{citations:[{passageId:'erfunden'}]},{citations:[{passageId:passages[0].id,quote:'99. November 2026'}]},{abstain:'false'},{answer:'x'.repeat(4001)}]) assert.throws(()=>validateGroundedAnswer(JSON.stringify({...valid,...change}),passages));
for(const raw of ['null','[]','{}','{"answer":']) assert.throws(()=>validateGroundedAnswer(raw,passages));
assert.equal(validateGroundedAnswer(JSON.stringify({answer:'Unbekannt',abstain:true,citations:[]}),passages).abstain,true);
assert.throws(()=>validateGroundedAnswer(JSON.stringify({...valid,abstain:true}),passages));
assert.equal(validateGroundedAnswer(JSON.stringify({...valid,citations:[valid.citations[0],valid.citations[0]]}),passages).citations.length,1);
assert.equal(selectPassages(pages,'Wie hoch ist die monatliche Miete?').length,0);
for(const question of ['Welche monatliche Miete nennt der Projektplan für November 2026?','Miete November 2026?','Miete Miete Miete November 2026?']) assert.equal(selectPassages(pages,question).length,0,question);
assert.equal(selectPassages(pages,'An welchem Datum ist die Abgabe?')[0].name,'Brief.pdf');
assert(selectPassages(pages,'Fasse alle Angaben im Dokument zusammen.').length>0);
assert.equal(validateGroundedAnswer(JSON.stringify({...valid,answer:'Die Miete beträgt 12.000 Euro.'}),passages).reason,'unsupported-number');
assert.equal(validateGroundedAnswer(JSON.stringify({...valid,answer:'Die Miete beträgt −2026 Euro.'}),passages).reason,'unsupported-number');
for(const answer of ['Der Wert beträgt 1.2.','Der Wert beträgt 1,2.','Der Wert beträgt 2.026.']) assert.equal(validateGroundedAnswer(JSON.stringify({...valid,answer}),passages).reason,'unsupported-number');
assert.equal(validateGroundedAnswer(JSON.stringify({...valid,answer:'Am 12. November 2026.'}),passages).abstain,false);
const long=selectPassages([{...pages[0],lines:[{text:'a'.repeat(1600),rects}]}],'Fasse das Dokument zusammen.');assert.equal(long.length,3);assert(long.every(p=>p.text.length<=650));
for(const n of [0,55,56,63,64,65,1024*1024-1,1024*1024,1024*1024+57,2*1024*1024+1]) {
  const bytes=Uint8Array.from({length:n},(_,i)=>(i*71+19)%256);
  assert.equal(await contentDigestBlob(new Blob([bytes])),createHash('sha256').update(bytes).digest('hex'),`blob length ${n}`);
}
const stop=new AbortController();stop.abort();await assert.rejects(()=>contentDigestBlob(new Blob(['test']),stop.signal),{name:'AbortError'});
console.log('PASS: assistant passage provenance, fabricated citation rejection, abstention and streaming model checksum. Real inference is separately tested in Chromium.');
