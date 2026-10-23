// Lifecycle tests for the shared original/export detail viewer; no screenshot claim.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
const dir='.cache/editor-comparison';await mkdir(dir,{recursive:true});
const compiled=ts.transpileModule(await readFile('components/studio/editor-result-review.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/(['"])(@\/[^'"]+|\.\/[^'"]+)\1/g,(_,q,p)=>q+'./'+p.split('/').at(-1)+'.mjs'+q);
await writeFile(dir+'/review.mjs',compiled);
await writeFile(dir+'/ui-language.mjs','export const ui=s=>s;');
await writeFile(dir+'/advanced-shared.mjs','export const PageStage=()=>null;');
await writeFile(dir+'/button.mjs',`import React from 'react';export const Button=({variant,size,...props})=>React.createElement('button',props);`);
await writeFile(dir+'/pdf-engine.mjs',`export const jobs=[];export const renderPageRegion=(source,page,rect,signal)=>new Promise((resolve,reject)=>jobs.push({source,page,rect,signal,resolve,reject}));`);
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {EditorDetailPair,EditorResultReview}=await import('../.cache/editor-comparison/review.mjs');
const {jobs}=await import('../.cache/editor-comparison/pdf-engine.mjs');
const root=createRoot(document.getElementById('root')),source={id:'original'},output={id:'saved'};
const props={source,output,sourcePage:0,outputPage:0,rotation:0,rect:{x:.1,y:.1,w:.2,h:.05}};
const canvases=[];
function image(name){const canvas={width:600,height:100,toDataURL:()=>`data:image/png;base64,${name}`};canvases.push(canvas);return {canvas,width:72,height:12,scale:600/72};}
try {
 await act(async()=>root.render(React.createElement(EditorDetailPair,props)));
 assert.equal(jobs.length,2);assert.deepEqual(jobs[0].rect,jobs[1].rect,'Both renderers receive the same source region');
 await act(async()=>root.render(React.createElement(EditorDetailPair,{...props,rect:{...props.rect,x:.4}})));
 assert(jobs[0].signal.aborted&&jobs[1].signal.aborted,'Moving to another edit cancels both old renders');
 await act(async()=>{jobs[0].resolve(image('old'));jobs[1].resolve(image('old'));});
 assert.equal(document.querySelectorAll('img').length,0,'Stale results cannot appear as one half of the comparison');
 await act(async()=>{jobs[2].resolve(image('newA'));jobs[3].resolve(image('newB'));});
 const images=[...document.querySelectorAll('img')];assert.equal(images.length,2);assert(images.every(x=>x.style.width==='192px'));
 const zoom=document.querySelector('select');await act(async()=>{zoom.value='400';zoom.dispatchEvent(new Event('change',{bubbles:true}));});
 assert(images.every(x=>x.style.width==='384px'&&x.dataset.zoom==='400'),'Shared zoom changes the physical scale of both panels equally');
 assert.equal(jobs.length,4,'Zoom never starts a competing render or changes the PDF');
 const panes=[...document.querySelectorAll('.editor-detail-scroll')];await act(async()=>{panes[0].scrollLeft=73;panes[0].scrollTop=9;panes[0].dispatchEvent(new Event('scroll'));});
 assert.equal(panes[1].scrollLeft,73);assert.equal(panes[1].scrollTop,9);assert(panes.every(p=>p.tabIndex===0),'Detail panels are keyboard accessible');
 await act(async()=>root.render(React.createElement(EditorDetailPair,{...props,rect:{...props.rect,x:.6}})));
 await act(async()=>{jobs[4].resolve(image('partial'));jobs[5].reject(new Error('failed'));});
 assert.equal(document.querySelectorAll('img').length,0);assert.match(document.body.textContent,/konnte nicht geladen/);assert(canvases.every(c=>c.width===0&&c.height===0),'All completed bitmaps are released, including cancelled and partially failed pairs');
 const verification={status:'passed',textPages:1,imagePages:1,editedImageFields:1,changedPages:[0],issues:[],sourcePages:[{sourceId:source.id,index:0,rotation:0}],fidelity:[{page:0,rect:props.rect,text:'18',status:'uncertain',samples:3},{page:0,rect:props.rect,text:'August',status:'matched',samples:1}]};
 await act(async()=>root.render(React.createElement(EditorResultReview,{verification,sources:[source],output})));
 assert.match(document.body.textContent,/Exportprüfung abgeschlossen/);assert.match(document.querySelector('.editor-fidelity-status').textContent,/unsicher/,'Export success cannot imply original-font identity');
 const choose=document.querySelector('[aria-label="Änderung auswählen"]');await act(async()=>{choose.value='1';choose.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.match(document.querySelector('.editor-fidelity-status').textContent,/gute Annäherung/);assert.doesNotMatch(document.querySelector('.editor-fidelity-status').textContent,/Originalschrift verwendet/);
 console.log('PASS: identical detail regions and shared 100/200/400% scale, synchronized scroll, cancellation/stale-result and failure cleanup, accessible controls, independent export/fidelity status and edit selection.');
} finally {await act(async()=>root.unmount());dom.window.close();}
