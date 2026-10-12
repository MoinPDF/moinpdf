import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import * as hb from 'harfbuzzjs';
import fontkit from '@pdf-lib/fontkit';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const require=createRequire(import.meta.url),pr=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData}=pr('@napi-rs/canvas');Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
const native=JSON.parse(await readFile('tests/fixtures/native-shaping.json','utf8'));
const snapshot=await readFile('lib/native-pdf-core.ts','utf8');await writeFile('.cache/complex-script-core-test.mjs',ts.transpileModule(snapshot,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const core=await import('../.cache/complex-script-core-test.mjs');const api=await core.createNativeEngine(new Uint8Array(await readFile('node_modules/@embedpdf/pdfium/dist/pdfium.wasm')));
const source=await PDFDocument.create(),page=source.addPage([1200,300]),base=await source.embedFont(StandardFonts.Helvetica);page.drawText('Original',{x:30,y:220,size:20,font:base});const input=await source.save();
const cache=new Map();for(const c of native.cases)if(!cache.has(c.font))cache.set(c.font,new Uint8Array(await readFile(c.font)));
const latin=new Uint8Array(await readFile('public/vendor/invoice-font/NotoSans-Regular.ttf'));
const settings={indices:[0],rect:{x:.02,y:.1,w:.96,h:.8},fontSize:32,lineHeight:1.4,padding:12,align:'left',color:'#000000'};
const result={nativeVersion:native.harfbuzzVersion,jsVersion:hb.versionString(),sourceSha256:createHash('sha256').update(snapshot).digest('hex'),cases:[]};
async function inspect(bytes){const task=pdfjs.getDocument({data:bytes.slice()});try{const pdf=await task.promise,page=await pdf.getPage(1),content=await page.getTextContent({disableNormalization:true}),vp=page.getViewport({scale:2}),canvas=createCanvas(vp.width,vp.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;return{text:content.items.filter(t=>'str'in t).map(t=>t.str).join(''),canvas};}finally{await task.destroy();}}
let j=0;
for(const c of native.cases){
 const bytes=cache.get(c.font);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.fontSha256);const f=new hb.Font(new hb.Face(new hb.Blob(bytes.slice().buffer)));f.setScale(c.upem,c.upem);const buffer=new hb.Buffer();buffer.addText(c.text);buffer.setClusterLevel(hb.ClusterLevel.MONOTONE_GRAPHEMES);buffer.setDirection(hb.Direction.LTR);buffer.setScript(c.tag);buffer.guessSegmentProperties();hb.shape(f,buffer);
 const infos=buffer.getGlyphInfos(),pos=buffer.getGlyphPositions(),actual=infos.map((g,i)=>[g.codepoint,g.cluster,pos[i].xAdvance,pos[i].yAdvance,pos[i].xOffset,pos[i].yOffset]);
 const same=JSON.stringify(actual)===JSON.stringify(c.glyphs);const row={script:c.script,text:c.text,referenceMatch:same};if(!same)row.actualGlyphs=actual;
 try{
  const out=await core.replaceNativeParagraph(api,input,0,{...settings,text:c.text,fontBytes:bytes});const read=await inspect(out.bytes);
  row.extracted=read.text;row.extractEqual=read.text.normalize('NFC')===c.text.normalize('NFC');row.lines=out.lines;
  const face=fontkit.create(bytes),expected=createCanvas(2400,600),ctx=expected.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,2400,600);ctx.fillStyle='#000';const factor=32/c.upem;let x=36;const y=42+face.ascent*factor;
  for(const [gid,cluster,xa,ya,xo,yo] of c.glyphs){ctx.setTransform(factor*2,0,0,-factor*2,(x+xo*factor)*2,(y-yo*factor)*2);ctx.fill(new Path2D(face.getGlyph(gid).path.toSVG()));x+=xa*factor;}
  const a=read.canvas.getContext('2d').getImageData(0,0,2400,600).data,b=ctx.getImageData(0,0,2400,600).data;let dif=0,union=0,intersect=0,pixA=0,pixB=0;
  for(let i=0;i<a.length;i+=4){if(a[i]<220||b[i]<220){union++;dif+=Math.abs(a[i]-b[i]);}if(a[i]<160&&b[i]<160)intersect++;if(a[i]<160)pixA++;if(b[i]<160)pixB++;}
  row.pixelError=dif/(union||1);row.inkDice=2*intersect/(pixA+pixB||1);row.inkPixels=[pixA,pixB];
  if(!row.extractEqual||row.inkDice<.995){await writeFile(`.cache/shaping-research/${j}-${c.script}-actual.png`,read.canvas.toBuffer('image/png'));await writeFile(`.cache/shaping-research/${j}-${c.script}-expected.png`,expected.toBuffer('image/png'));}
  const mixed='MoinPDF '+c.text+' 123. Ende.';const mixOut=await core.replaceNativeParagraph(api,input,0,{...settings,text:mixed,fontBytes:latin,fallbackFonts:[...cache.values()]});const mix=await inspect(mixOut.bytes);row.mixedExtracted=mix.text;row.mixedEqual=mix.text.normalize('NFC')===mixed.normalize('NFC');
 }catch(e){row.error=e.message;}
 result.cases.push(row);assert(!row.error,JSON.stringify(row));assert(row.referenceMatch,JSON.stringify(row));assert(row.extractEqual,JSON.stringify(row));assert(row.mixedEqual,JSON.stringify(row));assert(row.inkDice>=.995,JSON.stringify(row));console.log('PASS: '+c.script+' shaping, exact Unicode, mixed fallback and independent native-HarfBuzz reference rendering');j++;
}

const devanagari=cache.get('public/vendor/editor-fonts/NotoSansDevanagari-Regular.ttf');
const sample='किताब क्षत्रिय कर्म';
const out=await core.replaceNativeParagraph(api,input,0,{...settings,text:sample,fontBytes:devanagari});
const objects=core.inspectNativeObjects(api,out.bytes,0);assert.equal(objects.length,1);assert.equal(objects[0].text,sample);
const moved=core.editNativeObjects(api,out.bytes,0,[{index:objects[0].index,dx:.01}]);
assert.equal((await inspect(moved)).text,sample);assert.equal(core.inspectNativeObjects(api,moved,0)[0].text,sample);
assert(Math.abs(core.inspectNativeObjects(api,moved,0)[0].x-objects[0].x-.01)<.0001);
const changed=await core.replaceNativeParagraph(api,moved,0,{...settings,indices:[core.inspectNativeObjects(api,moved,0)[0].index],text:'नमस्ते',fontBytes:devanagari});
assert.equal((await inspect(changed.bytes)).text,'नमस्ते');
const fresh=await core.replaceNativeParagraph(api,input,0,{...settings,text:'नमस्ते',fontBytes:devanagari});
const replacedPixels=(await inspect(changed.bytes)).canvas.getContext('2d').getImageData(0,0,2400,600).data;
const freshPixels=(await inspect(fresh.bytes)).canvas.getContext('2d').getImageData(0,0,2400,600).data;
assert.deepEqual(replacedPixels,freshPixels,'Replacing an adopted paragraph cannot leave old outlines');
const removed=core.editNativeObjects(api,out.bytes,0,[{index:objects[0].index,remove:true}]);
const blank=await inspect(removed);assert.equal(blank.text,'');const pixels=blank.canvas.getContext('2d').getImageData(0,0,2400,600).data;
assert(pixels.every((v)=>v===255),'Deleting logical text must delete all visible outlines');
for(const [name,text,from,to] of [['Kannada','ಕನ್ನಡ ಭಾಷೆ',3,4],['Myanmar','မြန်မာဘာသာ',5,7]]) {
 const font=cache.get('public/vendor/editor-fonts/NotoSans'+name+'-Regular.ttf');
 await assert.rejects(core.replaceNativeParagraph(api,input,0,{...settings,text,fontBytes:font,styles:[{from,to,fontSize:28,color:'#123456'}]}),/Zeichenfolge/);
}
const narrow=await core.replaceNativeParagraph(api,input,0,{...settings,rect:{x:.02,y:.05,w:.10,h:.9},fontSize:16,text:'क्षत्रिय कर्म किताब क्षत्रिय कर्म किताब',fontBytes:devanagari});
assert(narrow.lines>1);assert.equal((await inspect(narrow.bytes)).text.replace(/\s/g,''),'क्षत्रियकर्मकिताबक्षत्रियकर्मकिताब');
console.log('PASS: atomic paragraph move, deletion and repeated replacement; cluster-safe style and line boundaries.');

const rtlFont=new Uint8Array(await readFile('public/vendor/editor-fonts/DejaVuSans.ttf'));
for(const text of ['مرحبا بالعالم','שלום עולם','لا إله إلا الله','שָׁלוֹם עוֹלָם','ABC 123 שלום (456) مرحبا','Latin لا إله إلا الله (123) שלום Ende.','עברית English عربية']) {
 const settings2={...settings,text,fontBytes:rtlFont};
 for(const styles of [undefined,[{from:0,to:text.indexOf(' '),fontSize:28,color:'#123456'}]]) {
  const out=await core.replaceNativeParagraph(api,input,0,{...settings2,styles}),obj=core.inspectNativeObjects(api,out.bytes,0)[0];
  assert.equal(obj.text,text);const moved=core.editNativeObjects(api,out.bytes,0,[{index:obj.index,dy:.01}]);
  assert.equal((await inspect(moved)).text.normalize('NFC'),text.normalize('NFC'));
 }
}
console.log('PASS: exact RTL/mixed extraction with varied font sizes after move and save.');
const logicalBefore=core.inspectNativeObjects(api,out.bytes,0)[0];
const cleared=core.removeNativeRegions(api,out.bytes,[{page:0,rect:{x:0,y:0,w:1,h:1}}]);
assert(!core.inspectNativeObjects(api,cleared,0).some(o=>o.text.includes('किताब')),'Removed source text cannot remain in paragraph metadata');
