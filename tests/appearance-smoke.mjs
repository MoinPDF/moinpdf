import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const names=['ui-language','tool-translations','tool-catalog','tool-search','localized-search'];
await mkdir('.cache/appearance',{recursive:true});
for(const name of names){
 const source=await readFile(`lib/${name}.ts`,'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 for(const other of names)code=code.replaceAll(`'./${other}'`,`'./${other}.mjs'`);
 await writeFile(`.cache/appearance/${name}.mjs`,code);
}
const {tools}=await import('../.cache/appearance/tool-catalog.mjs');
const {englishTools}=await import('../.cache/appearance/tool-translations.mjs');
const {searchTools}=await import('../.cache/appearance/localized-search.mjs');
const {translate}=await import('../.cache/appearance/ui-language.mjs');
assert.equal(translate('Papierkram. Läuft.','en'),'Paperwork. Sorted.');
assert.equal(translate('Papierkram. Läuft.','de'),'Papierkram. Läuft.');
assert.deepEqual(Object.keys(englishTools).sort(),tools.map(t=>t.id).sort());
const localized=tools.map(t=>({...t,...englishTools[t.id]}));
for(const tool of localized){
 assert.ok(tool.title&&tool.description&&tool.action);
 assert.equal(searchTools(tool.title,localized)[0]?.id,tool.id,tool.title);
}
for(const [query,id] of [['make my pdf smaller','compress'],['pdf to word','pdf-word'],['word to pdf','office-pdf'],['combine pdfs','merge'],['extract text','ocr'],['PDF kleiner machen','compress']]){
 assert.equal(searchTools(query,localized)[0]?.id,id,query);
}
for(const tool of tools)assert.equal(searchTools(tool.title,[...tools])[0]?.id,tool.id,tool.title);
assert.deepEqual(searchTools(' ',localized),[]);
const script=await readFile('public/appearance-init.js','utf8');
for(const preference of ['dark','light',null,'invalid']){
 let theme='',listener;
 const root={classList:{toggle:(_name,value)=>{theme=value?'dark':'light'}},style:{}};
 const sandbox={document:{documentElement:root},localStorage:{getItem:()=>preference},window:{addEventListener:(_name,fn)=>{listener=fn}}};
 vm.runInNewContext(script,sandbox);
 assert.equal(theme,preference==='dark'?'dark':'light');
 assert.equal(root.style.colorScheme,theme);
 sandbox.localStorage.getItem=()=>preference==='dark'?'light':'dark';
 listener({key:'moinpdf-theme'});
 assert.equal(theme,preference==='dark'?'light':'dark');
}
assert.doesNotThrow(()=>vm.runInNewContext(script,{document:{documentElement:{}},localStorage:{getItem:()=>{throw Error('blocked')}},window:{addEventListener(){}}}));
console.log('PASS: DE/EN catalogue, all translated tool titles, search directions, slogan, theme persistence, cross-tab sync and blocked storage.');
