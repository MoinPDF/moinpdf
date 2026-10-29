import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import 'fake-indexeddb/auto';
import {PDFDocument} from 'pdf-lib';
const folder='.cache/tool-drafts';await mkdir(folder,{recursive:true});
for(const file of [...(await readdir('lib')).filter(f=>f.endsWith('.ts')&&!f.endsWith('.d.ts')).map(f=>'lib/'+f),'components/studio/workspace-drafts.tsx']){
  const code=ts.transpileModule(await readFile(file,'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/(['"])\.\/([a-z0-9-]+)\1/g,(_,q,n)=>`${q}./${n}.mjs${q}`);
  await writeFile(folder+'/'+file.split('/').at(-1).replace(/\.tsx?$/,'.mjs'),code);
}
const {toolDraftSchema}=await import('../.cache/tool-drafts/tool-draft-schema.mjs');
const {encodeProjectFile,decodeProjectFile}=await import('../.cache/tool-drafts/project-archive.mjs');
const {storeRecovery,loadRecovery}=await import('../.cache/tool-drafts/workspace-storage.mjs');
const doc=await PDFDocument.create();doc.addPage();const bytes=await doc.save();
const source={id:'source',name:'fictional.pdf',kind:'pdf',size:bytes.length,bytes};
const viewState={choosingTool:false,zoom:200,view:'pages',scrollX:0,scrollY:650,documentX:40,documentY:900};
const toolDrafts={'TablePanel.rows:source':[['Item','Amount'],['Fictional invoice','125.50']], 'OcrReviewPanel.corrections:source':{word:'Corrected value'}, 'MeasurePanel.manual:source':{x:.4,y:.5}};
Object.assign(toolDrafts, {
  'ScanSplitPanel.regions:source': {0:[{x:.1,y:.1,w:.3,h:.2,corners:[{x:.1,y:.1},{x:.4,y:.12},{x:.38,y:.3},{x:.1,y:.28}],rotation:90,uncertain:true},{x:.6,y:.2,w:.2,h:.2}]},
  'ScanSplitPanel.gap:source': 3,
  'ScanSplitPanel.sensitivity:source': 6,
  'ScanSplitPanel.format:source': 'combined-pdf',
  'ScanSplitPanel.notices:source': {0:'Fictional uncertain contour notice'},
});
assert(toolDraftSchema.safeParse(toolDrafts).success);
assert(toolDraftSchema.safeParse({'WorkflowPanel.steps:source':[{kind:'ocr',text:undefined,condition:undefined}]}).success,'Optional unset fields can be saved before JSON serialization');
for(const wrong of [ {'TablePanel.rows:source':[{unexpected:true}]}, {'MeasurePanel.manual:source':{x:'bad',y:0}}, {'Password:source':'never-persist'}, {'OcrReviewPanel.corrections:source':[1,2]}])assert(!toolDraftSchema.safeParse(wrong).success,'Untrusted draft shapes and unknown/secret fields are rejected');
const state={pages:[{id:'page',sourceId:'source',index:0,rotation:0,selected:true}],edits:{marks:{},crops:{}},options:{},history:[],future:[],documentSessions:{},activeId:'page',toolId:'table-export',viewState,toolDrafts,sourceIds:['source']};
const decoded=await decodeProjectFile(await encodeProjectFile('Fictional project',[source],state));assert.deepEqual(decoded.state.toolDrafts,toolDrafts);assert.deepEqual(decoded.state.viewState,viewState);
await storeRecovery({updated:1,sources:[source],state},'draft-test');const restored=await loadRecovery('draft-test');assert.deepEqual(restored.state.toolDrafts,toolDrafts);
const dom=new JSDOM('<div id="root"></div>',{url:'https://moinpdf.test'});for(const key of ['window','document','HTMLElement','Element','Node','Event'])globalThis[key]=dom.window[key];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {WorkspaceDraftProvider,useWorkspaceDrafts,useToolDraftState}=await import('../.cache/tool-drafts/workspace-drafts.mjs');
let store,field;
function Consumer({id='source',initial='initial'}){store=useWorkspaceDrafts();field=useToolDraftState('CoverPanel.title:'+id,initial);return React.createElement('output',null,field[0]);}
function App({id='source',show=true}){return React.createElement(WorkspaceDraftProvider,null,show?React.createElement(Consumer,{id,initial:id+' title'}):null);}
const root=createRoot(document.getElementById('root'));
try{
  await act(async()=>root.render(React.createElement(App,{})));
  await act(async()=>{field[1]('First');field[1](old=>old+' revision');});assert.equal(document.querySelector('output').textContent,'First revision');
  await act(async()=>root.render(React.createElement(App,{show:false})));
  await act(async()=>root.render(React.createElement(App,{})));assert.equal(document.querySelector('output').textContent,'First revision','Switching tools retains an unsaved input');
  await act(async()=>root.render(React.createElement(App,{id:'second'})));assert.equal(document.querySelector('output').textContent,'second title','A different document gets its own default');
  await act(async()=>field[1]('Second document'));
  await act(async()=>root.render(React.createElement(App,{})));assert.equal(document.querySelector('output').textContent,'First revision');
  await act(async()=>store.setDrafts({'CoverPanel.title:source':'Recovered input'}));assert.equal(document.querySelector('output').textContent,'Recovered input');
  await act(async()=>store.setDrafts({}));assert.equal(document.querySelector('output').textContent,'source title','Discarding the workspace resets tool inputs');
}finally{await act(async()=>root.unmount());dom.window.close();}
console.log('PASS: typed draft validation, secret/unknown-field rejection, project and IndexedDB roundtrip, view state, functional updates, tool remounts, document isolation, restore and clear.');
