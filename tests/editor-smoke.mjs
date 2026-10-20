import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import ts from 'typescript';
import {PDFDocument,PDFName,StandardFonts,rgb,degrees} from 'pdf-lib';
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pdfRequire('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData,document:{createElement(name){assert.equal(name,'canvas');return createCanvas(1,1);}}});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),assets=dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('.cache',{recursive:true});
for(const name of ['editor-rich-text','editor-rich-layout','editor-verification','local-font-bytes','pdf-text','ocr-languages','content-compare','image-codecs','pdf-engine','studio-engine','advanced-types','extra-options','extra-tools','pdf-report','pdf-signature-guard','editor-model','editor-font-catalog','editor-font-cmap','editor-fonts','editor-analysis','editor-text-layer','editor-native','native-pdf-core']){
 const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(['"])\.\/([a-z-]+)\1/g,(_,q,n)=>`${q}./${n}-editor-test.mjs${q}`);
 await writeFile(`.cache/${name}-editor-test.mjs`,code);
}
await writeFile('.cache/native-pdf-editor-test.mjs', `import {readFile} from 'node:fs/promises';import {createNativeEngine,removeNativeRegions} from './native-pdf-core-editor-test.mjs';let api;export const removeRegions=async(bytes,removals)=>removeNativeRegions(await(api ||= readFile('public/vendor/pdfium/pdfium.wasm').then(b=>createNativeEngine(new Uint8Array(b)))),bytes,removals);`);
const {runStudioJob,emptyEdits}=await import('../.cache/studio-engine-editor-test.mjs');
const {readTextTargets,wrapEditorText}=await import('../.cache/editor-model-editor-test.mjs');
const {renderPage}=await import('../.cache/pdf-engine-editor-test.mjs');
const originalFetch=globalThis.fetch;globalThis.fetch=async input => typeof input==='string'&&input.startsWith('/vendor/') ? new Response(await readFile('public'+input)) : originalFetch(input);
const proxies=[];
async function source(bytes,name){const data=new Uint8Array(bytes),pdf=await pdfjs.getDocument({data:data.slice(),standardFontDataUrl:assets+'/standard_fonts/'}).promise;proxies.push(pdf);return{id:name,name,bytes:data,pdf,size:data.length,kind:'pdf'};}
const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica);
d.setTitle('SECRET 4815');const p=d.addPage([400,560]);p.drawText('SECRET 4815',{font,size:20,x:40,y:420});p.drawText('Original footer',{font,size:14,x:40,y:60});p.drawRectangle({x:40,y:240,width:100,height:60,color:rgb(.1,.6,.7)});d.addPage([400,560]).drawText('UNCHANGED PAGE',{font,size:20,x:40,y:420});
const src=await source(await d.save(),'Editor-Test.pdf'),pages=[0,1].map(index=>({id:'p'+index,sourceId:src.id,index,rotation:0,selected:true}));
await writeFile('.cache/Editor-Test.pdf',src.bytes);
const options={language:'deu',forceOcr:false,imageFormat:'png',quality:'balanced',watermark:'TEST',numberStart:1,pageSize:'a4',orientation:'portrait',perSheet:'2'};
const run=(tool,marks,selected=pages)=>runStudioJob(tool,[src],selected,options,{marks:{p0:marks},crops:{}},()=>{},new AbortController().signal);
const from=async r=>source(await r.blob.arrayBuffer(),r.filename);
const text=async(s,i=0)=>(await(await s.pdf.getPage(i+1)).getTextContent()).items.filter(t=>'str'in t).map(t=>t.str).join(' ');
try{
 const targets=await readTextTargets(src,pages[0]),target=targets.targets.find(t=>t.text==='SECRET 4815');assert(target);assert.equal(target.fontSize,20);assert.equal(targets.width,400);
 const {x,y,w,h}=target,rect={x,y,w,h};
 const replacement={id:'replacement',kind:'text',x:.1,y:.55,w:.8,h:.15,sourceRect:rect,text:'Korrigiert 2026',fontScale:.05,fontFamily:'sans',bold:true,color:'#008877',fill:'#ffffff',align:'center'};
 const edited=await from(await run('edit-text',[replacement]));assert.match(await text(edited),/Korrigiert 2026/);assert.doesNotMatch(await text(edited),/SECRET/);assert.match(await text(edited),/Original footer/);assert.match(await text(edited,1),/UNCHANGED PAGE/);
 const canvas=(await renderPage(edited,{...pages[0],sourceId:edited.id},1120)).canvas,ctx=canvas.getContext('2d');const area=ctx.getImageData(Math.ceil(x*canvas.width),Math.ceil(y*canvas.height),Math.floor(w*canvas.width)-2,Math.floor(h*canvas.height)-2).data;assert(area.every((v,i)=>i%4===3||v>248),'The original glyphs are physically removed even when replacement is moved');
 const parsed=await PDFDocument.load(edited.bytes,{updateMetadata:false});assert.equal(parsed.context.trailerInfo.Info,undefined);assert.equal(parsed.catalog.has(PDFName.of('Metadata')),false);
 const deleted=await from(await run('edit-text',[{...replacement,text:''}]));assert.doesNotMatch(await text(deleted),/SECRET/);assert.match(await text(deleted),/Original footer/);
 const erased=await from(await run('erase',[{id:'erase',kind:'erase',...rect,fill:'#ffeecc'}],[pages[0]]));assert.equal(await text(erased),'');const erasedCanvas=(await renderPage(erased,{...pages[0],sourceId:erased.id},1120)).canvas;assert.deepEqual([...erasedCanvas.getContext('2d').getImageData(Math.floor((x+w/2)*erasedCanvas.width),Math.floor((y+h/2)*erasedCanvas.height),1,1).data].slice(0,3),[255,238,204]);
 const logo=createCanvas(80,40);logo.getContext('2d').fillStyle='#09a094';logo.getContext('2d').fillRect(0,0,80,40);const image={id:'img',kind:'image',x:.5,y:.5,w:.2,h:.1,image:logo.toDataURL('image/png'),opacity:.6};
 const withImage=await from(await run('insert-image',[image],[pages[0]]));assert.match(await text(withImage),/SECRET 4815/);const ic=(await renderPage(withImage,{...pages[0],sourceId:withImage.id},1120)).canvas,pix=ic.getContext('2d').getImageData(ic.width*.6,ic.height*.55,1,1).data;assert(pix[1]>180&&pix[0]<180,'Image and opacity are applied');
 for(const family of ['sans','serif','mono']){const formatted=await from(await run('edit-text',[{...replacement,sourceRect:undefined,text:'Änderung 2026',fontFamily:family,italic:true}],[pages[0]]));assert.match(await text(formatted),/Änderung 2026/);assert.match(await text(formatted),/SECRET/);}
 await assert.rejects(()=>run('edit-text',[{...replacement,h:.01,text:'Too many words for the available area'}]),/Textfeld ist zu klein/);
 await assert.rejects(()=>run('edit-text',[{...replacement,text:'漢字'}]),/nicht unterstützte/);
 assert(wrapEditorText('abcdefghijkl',30,t=>t.length*10).every(line=>line.length<=3));
 // Rotated/cropped pages use their displayed coordinates for manual removal.
 for(const angle of [90,180,270]){const rd=await PDFDocument.load(src.bytes);rd.getPage(0).setRotation(degrees(angle));rd.getPage(0).setCropBox(20,20,360,520);const rs=await source(await rd.save(),'Rotated'+angle+'.pdf'),rp={...pages[0],sourceId:rs.id};const ts=await readTextTargets(rs,rp);assert(ts.targets.length>0,'Rotated text remains selectable');const result=await runStudioJob('erase',[rs],[rp],options,{marks:{p0:[{id:'whole',kind:'erase',x:0,y:0,w:1,h:1,fill:'#ffffff'}]},crops:{}},()=>{},new AbortController().signal);const out=await from(result);assert.equal(await text(out),'');}
 // Existing black redactions remain final and suppress all new text objects in that page.
 const redacted=await from(await run('edit-text',[replacement,{id:'red',kind:'redact',x:0,y:0,w:1,h:1}],[pages[0]]));assert.equal(await text(redacted),'');
 console.log('PASS: replace and move removes old glyphs and original text layer; new text is selectable; untouched pages retain text; erase color; image placement/opacity; 3 font families/bold/italic/Umlauts; overflow and Unicode validation; rotated/cropped pages; redaction precedence.');
}finally{for(const p of proxies)await p.loadingTask.destroy();}
