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
function bootAppearance({preference=null,dark=false,blocked=false,legacy=false,startupOnly=false,mediaSupported=true}={}){
 const state={preference,theme:''};
 const events=new Map();
 let systemListener;
 const root={classList:{toggle:(_name,value)=>{state.theme=value?'dark':'light'}},style:{}};
 const system={matches:dark};
 if(legacy)system.addListener=fn=>{systemListener=fn};
 else system.addEventListener=(name,fn)=>{assert.equal(name,'change');systemListener=fn};
 const window={addEventListener:(name,fn)=>events.set(name,fn)};
 if(mediaSupported)window.matchMedia=query=>{assert.equal(query,'(prefers-color-scheme: dark)');return system};
 vm.runInNewContext(script,{
  document:{documentElement:root,currentScript:{hasAttribute:name=>startupOnly&&name==='data-theme-startup-only'}},
  localStorage:{getItem:key=>{assert.equal(key,'moinpdf-theme');if(blocked)throw Error('blocked');return state.preference}},
  window,
 });
 return {state,root,system,events,changeSystem(value){system.matches=value;systemListener?.({matches:value})},get systemListener(){return systemListener}};
}
for(const dark of [false,true]){
 for(const preference of ['dark','light',null,'system','invalid']){
  const app=bootAppearance({preference,dark});
  const expected=preference==='dark'?'dark':preference==='light'?'light':dark?'dark':'light';
  assert.equal(app.state.theme,expected,`initial ${preference}/${dark}`);
  assert.equal(app.root.style.colorScheme,expected);
  app.changeSystem(!dark);
  assert.equal(app.state.theme,preference==='dark'?'dark':preference==='light'?'light':dark?'light':'dark');
  app.state.preference=dark?'dark':'light';
  app.events.get('storage')({key:'moinpdf-theme'});
  assert.equal(app.state.theme,app.state.preference,'manual choice from another tab wins');
  app.state.preference=null;
  app.events.get('storage')({key:'unrelated'});
  assert.equal(app.state.theme,dark?'dark':'light','unrelated storage changes are ignored');
  app.events.get('storage')({key:null});
  assert.equal(app.state.theme,dark?'light':'dark','clearing preferences restores system appearance');
  app.system.matches=dark;
  app.events.get('pageshow')({persisted:true});
  assert.equal(app.state.theme,dark?'dark':'light','restored information pages refresh appearance');
 }
 const blocked=bootAppearance({dark,blocked:true,preference:dark?'light':'dark'});
 assert.equal(blocked.state.theme,dark?'dark':'light');
 blocked.changeSystem(!dark);
 assert.equal(blocked.state.theme,dark?'light':'dark','blocked storage still follows system changes');
 const startup=bootAppearance({dark,startupOnly:true});
 assert.equal(startup.state.theme,dark?'dark':'light');
 assert.equal(startup.events.size,0,'React owns runtime updates on the self-hosted app');
 assert.equal(startup.systemListener,undefined);
}
const legacy=bootAppearance({dark:true,legacy:true});
legacy.changeSystem(false);
assert.equal(legacy.state.theme,'light');
assert.equal(bootAppearance({mediaSupported:false}).state.theme,'light');
assert.equal(bootAppearance({mediaSupported:false,preference:'dark'}).state.theme,'dark');
console.log('PASS: DE/EN catalogue, translated tool titles, search, slogan, system appearance, manual overrides, live changes, cross-tab sync, page restoration, startup handoff and blocked storage.');
const extended = JSON.parse(await readFile('public/locales/en.json','utf8'));
const {installEnglishCatalog, ui, setUiLanguage, uiLocale} = await import('../.cache/appearance/ui-language.mjs');
installEnglishCatalog(extended);
setUiLanguage('en');
assert.equal(ui('EINSTELLUNGEN'),'SETTINGS');
assert.equal(ui('Querformat'),'Landscape');
assert.equal(ui('Seite 7 auswählen'),'Select page 7');
assert.equal(ui('Originaldokument.pdf schließen'),'Close Originaldokument.pdf');
assert.equal(ui('  PDF-Passwort  '),'  PDF password  ');
assert.equal(ui('Weitere 20 Einträge anzeigen (100 von 200)'),'Show 20 more entries (100 of 200)');
assert.equal(uiLocale(),'en-GB');
assert.equal(ui('Textfeld auswählen: Abbrechen'),'Select text field: Abbrechen');
assert.equal(ui('Bild auswählen'),'Select image');
assert.equal(ui('1 Auffälligkeit gefunden'),'1 issue found');
assert.equal(ui('3 Auffälligkeiten gefunden'),'3 issues found');
assert.equal(ui('2 Auffälligkeiten im Basischeck'),'2 issues in the basic check');
for(const [source,target] of Object.entries(extended)) {
 assert.deepEqual(source.match(/\{\d+\}/g)?.sort()??[],target.match(/\{\d+\}/g)?.sort()??[],source);
 assert.ok(!/ZXQ|QXZ|\}Z/.test(target),source);
}
setUiLanguage('de');
assert.equal(ui('PDF-Passwort'),'PDF-Passwort');
assert.equal(uiLocale(),'de-DE');
// The rendered information pages work in English without a JS translation pass.
for(const route of ['documentation','media','legal','privacy']){
 const html=await readFile(`public/en/${route}.html`,'utf8');
 assert.ok(html.includes('<html lang="en">'));
 assert.ok(html.includes('/en/privacy.html'));
 assert.ok(html.includes('Paperwork. Sorted.'));
}
const languageScript=await readFile('public/language-init.js','utf8');
for(const [path,stored,expected] of [
 ['/dokumentation.html','en','/en/documentation.html#werkzeug-ocr'],
 ['/en/documentation.html','de',null],
 ['/dokumentation.html','de',null],
]){
 let redirected=null,listener;
 vm.runInNewContext(languageScript,{URLSearchParams,localStorage:{getItem:()=>stored},window:{location:{pathname:path,search:'',hash:'#werkzeug-ocr',replace:(value)=>{redirected=value}},addEventListener:(_,fn)=>{listener=fn}}});
 assert.equal(redirected,expected);
 if(path.startsWith('/en/')){
  listener({key:'moinpdf-language',newValue:'de'});
  assert.equal(redirected,'/dokumentation.html#werkzeug-ocr');
 }
}
console.log('PASS: full English catalogue, interpolation, PDF filenames, whitespace, information pages, cross-tab language and locale.');
