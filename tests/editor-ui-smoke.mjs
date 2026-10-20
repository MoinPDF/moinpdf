// React lifecycle/accessibility checks in jsdom; not a visual browser test.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
const folder='.cache/editor-ui';await mkdir(folder,{recursive:true});
for(const file of ['lib/local-font-bytes.ts','components/studio/editor-canvas.tsx','components/studio/editor-typography.tsx','lib/editor-font-catalog.ts','lib/editor-model.ts','lib/editor-text-layer.ts','lib/ui-language.ts']) {
 const code=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/(['"])(@\/[^'"]+|\.\/[^'"]+)\1/g,(_,q,p)=>q+'./'+p.split('/').at(-1)+'.mjs'+q);
 await writeFile(folder+'/'+file.split('/').at(-1).replace(/\.tsx?$/,'.mjs'),code);
}
await writeFile(folder+'/editor-fonts.mjs',`export const editorFontPage=async()=>({fonts:new Map(),runs:[]});export const originalEditorFont=()=>undefined;export const loadEditorCssFont=async()=>{};export const resolveEditorFont=async(mark)=>({font:{name:'Liberation Sans',cssFamily:'TestFont',ascent:.9,descent:.2,original:false,measureDescent:()=>.2,measure:(text,size)=>text.length*size*.5},substituted:false});`);
await writeFile(folder+'/pdf-text.mjs','export const readPdfText=async()=>({items:[],styles:{}});');
await writeFile(folder+'/appearance.mjs','export const useLanguage=()=>({});');
await writeFile(folder+'/button.mjs',`import React from 'react';export function Button({variant,size,...props}){return React.createElement('button',props);}`);
await writeFile(folder+'/studio-engine.mjs','export const normalizedRect=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)});');
await writeFile(folder+'/pdf-engine.mjs',`export const uid=()=> 'new-mark';export async function renderPage(){return {canvas:{width:400,height:560,toBlob(fn){fn(new Blob(['pixels']));}},width:400,height:560};}`);
await writeFile(folder+'/editor-analysis.mjs',`export const jobs=[];export function analyzeEditorPage(source,page,options){return new Promise((resolve,reject)=>jobs.push({source,page,options,resolve,reject}));}`);
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://moinpdf.test'});
for(const name of ['window','document','HTMLElement','Element','Node','Event','MouseEvent','KeyboardEvent','InputEvent','CompositionEvent']) globalThis[name]=dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
const React=await import('react'),{createRoot}=await import('react-dom/client');const {act}=React;
const {EditorInlineText,EditorFontPicker}=await import('../.cache/editor-ui/editor-typography.mjs');
const {EditorCanvas}=await import('../.cache/editor-ui/editor-canvas.mjs'),{jobs}=await import('../.cache/editor-ui/editor-analysis.mjs');
const root=createRoot(document.getElementById('root'));
const source={id:'source',name:'fixture.pdf'},page={id:'p0',sourceId:'source',index:0,rotation:0,selected:true};
const marks=[];let picked;
const props={source,page,marks,action:'pick',selectedId:'',disabled:false,onMark:m=>picked=m,onPatch:()=>{},onSelect:()=>{},onDimensions:()=>{},autoOcr:true,language:'deu+eng'};
const target={id:'word',text:'Rechnung',x:.1,y:.2,w:.2,h:.04,fontSize:15,family:'sans',origin:'ocr',confidence:60,rotation:90,fill:'#f2eee8'};
const result={targets:[target],width:400,height:560,ocr:true,replaceTextLayer:false,uncertain:1};
const click=async(button)=>act(async()=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));
try {
 await act(async()=>root.render(React.createElement(EditorCanvas,props)));
 assert.equal(jobs.length,1,'Opening the editor starts analysis without another button');assert(document.querySelector('img'),'Preview is shown before OCR finishes');
 await act(async()=>jobs[0].options.onNative({...result,targets:[{...target,origin:'pdf',confidence:100}]}));
 assert(document.querySelector('[aria-label="Text bearbeiten: Rechnung"]'),'Existing text can be selected while OCR is running');
 await act(async()=>jobs[0].resolve(result));assert(document.querySelector('.is-uncertain'));assert.match(document.body.textContent,/Orange markierte/);
 await click(document.querySelector('[aria-label="Text bearbeiten: Rechnung"]'));assert.equal(picked.text,'Rechnung');assert.equal(picked.textRotation,90);assert.equal(picked.fill,'#f2eee8');assert.deepEqual(picked.sourceRect,{x:.1,y:.2,w:.2,h:.04});
 await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Text erneut erkennen'));assert.equal(jobs.length,2);assert.equal(jobs[1].options.forceOcr,true);
 await act(async()=>root.render(React.createElement(EditorCanvas,{...props,page:{...page,id:'p1',index:1}})));assert(jobs[1].options.signal.aborted,'Switching page cancels its old OCR');assert.equal(jobs.length,3);
 await act(async()=>jobs[1].resolve(result));assert(!document.querySelector('[aria-label="Text bearbeiten: Rechnung"]'),'Late results from the old page do not leak into the new one');
 await act(async()=>jobs[2].options.onNative({...result,targets:[{...target,text:'Seite zwei'}]}));
 await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Erkennung anhalten'));assert(jobs[2].options.signal.aborted);assert(document.querySelector('[aria-label="Text bearbeiten: Seite zwei"]'),'Stopping OCR retains existing selectable text');
 await act(async()=>root.render(React.createElement(EditorCanvas,{...props,disabled:true})));assert(document.querySelector('[aria-label="Text bearbeiten: Seite zwei"]').disabled);
 await act(async()=>root.unmount());assert(jobs.every(j=>j.options.signal.aborted));
 const inlineHost=document.createElement('div');document.body.append(inlineHost);const inlineRoot=createRoot(inlineHost);
 let current={...picked,text:'Original',textRotation:0,w:.6,h:.08,baselineScale:.9,fontScale:15/400};const patches=[];let done=0;
 function Harness(){const [mark,setMark]=React.useState(current);current=mark;const onPatch=(id,patch,mode)=>{patches.push({id,patch,mode});setMark(old=>({...old,...patch}));};return React.createElement(React.Fragment,null,React.createElement(EditorFontPicker,{mark,disabled:false,onPatch}),React.createElement(EditorInlineText,{mark,source,width:400,height:560,pageWidth:400,pageHeight:560,disabled:false,onPatch,onDone:()=>done++}));}
 await act(async()=>inlineRoot.render(React.createElement(Harness)));
 let field=inlineHost.querySelector('textarea');assert.equal(document.activeElement,field);assert.equal(field.selectionStart,8);
 const setText=async text=>act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(field,text);field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));});
 await setText('Direkt geändert');assert.equal(current.text,'Direkt geändert');assert.equal(patches.at(-1).mode,'typing');assert.equal(document.activeElement,field);
 await act(async()=>field.dispatchEvent(new KeyboardEvent('keydown',{key:'b',ctrlKey:true,bubbles:true})));assert(current.bold,'Ctrl+B applies formatting without moving the text field');
 const before={x:current.x,y:current.y};await act(async()=>field.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));assert.deepEqual({x:current.x,y:current.y},before,'Arrow keys stay inside the text cursor');
 await act(async()=>{field.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});await setText('Änderung');await act(async()=>field.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'Änderung'})));assert.equal(current.text,'Änderung','IME composition preserves the completed text');
 const selector=inlineHost.querySelector('select');assert.equal(selector.options.length,15);await act(async()=>{selector.value='noto-serif';selector.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(current.fontChoice,'noto-serif');assert.equal(current.fontFamily,'serif');
 await setText('Ein längerer Absatz mit mehreren Zeilen. '.repeat(6));assert(current.h>.08,'Growing text expands the field instead of silently clipping it');
 await act(async()=>field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true})));assert.equal(done,1);
 await act(async()=>inlineRoot.unmount());
 console.log('PASS: inline textarea focus, typing, cursor keys, IME composition, font selection, keyboard formatting, field growth and done shortcut; automatic preparation, preview before OCR, early text selection, confidence styling, scan replacement/rotation, forced retry, page-switch race, stop, disabled controls and unmount cancellation.');
} finally {dom.window.close();}
