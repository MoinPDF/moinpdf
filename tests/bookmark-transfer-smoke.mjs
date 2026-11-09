import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';
await mkdir('.cache/bookmark-transfer', {recursive:true});
for (const name of ['bookmark-transfer','table-data','import-routing']) {
  const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);
  await writeFile(`.cache/bookmark-transfer/${name}.mjs`,code);
}
const {importBookmarks,exportBookmarks}=await import('../.cache/bookmark-transfer/bookmark-transfer.mjs');
const {conversionToolForFile,documentAccept}=await import('../.cache/bookmark-transfer/import-routing.mjs');
const entries=[{title:'Moin; "Kapitel"',page:1,level:1,open:false},{title:'=2+2',page:2,level:2,open:true},{title:"'Original",page:3,level:1,open:true}];
const bookmarks=importBookmarks(JSON.stringify({version:1,bookmarks:entries}),'json',3);
assert.deepEqual(bookmarks.map(b=>[b.page,b.depth,b.open]),[[0,0,false],[1,1,true],[2,0,true]]);
for(const format of ['json','csv']) {
  const serialized=exportBookmarks(bookmarks,format);
  const roundtrip=importBookmarks(serialized,format,3);
  assert.deepEqual(roundtrip.map(({id,...rest})=>rest),bookmarks.map(({id,...rest})=>rest));
  if(format==='csv')assert.match(serialized,/'=2\+2/,'CSV formula titles must be escaped');
}
assert.equal(importBookmarks('title,page,level\r\n"Hello, world",1,1','csv',1)[0].title,'Hello, world');
assert.equal(importBookmarks(JSON.stringify(Array.from({length:1000},(_,i)=>({title:'Chapter '+i,page:1,level:1}))),'json',1).length,1000);
for(const invalid of [[],[{...entries[0],page:0}],[{...entries[0],page:4}],[{...entries[0],level:2}],[entries[0],{...entries[1],level:3}],[{...entries[0],title:''}],[{...entries[0],open:'true'}],Array.from({length:1001},()=>entries[0])])
  assert.throws(()=>importBookmarks(JSON.stringify(invalid),'json',3),/Ungültige/);
assert.throws(()=>importBookmarks('{broken','json',3),/Ungültige/);
assert.throws(()=>importBookmarks('title,page,level\nTitle,no,1','csv',3));
assert.throws(()=>importBookmarks('title,page,level\n"Broken,1,1','csv',3));
assert.throws(()=>exportBookmarks([{...bookmarks[0],page:null}],'json'),/interne Zielseiten/);
for(const extension of ['fb2','cbz','xps','oxps']) {
  assert(documentAccept.includes('.'+extension));
  assert.equal(conversionToolForFile('EXAMPLE.'+extension.toUpperCase()),'ebook-pdf');
}
console.log('PASS: bookmark CSV/JSON round trips, hierarchy, formula escaping, page bounds, 1000-entry limit and expanded input routing.');
