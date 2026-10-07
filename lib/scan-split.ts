import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {renderPage,sourcePages,filenameStem,type Source} from './pdf-engine';
import type {Rect} from './studio-engine';
import type {ExportFile,RunContext} from './advanced-types';
export type ScanRegions=Record<number,Rect[]>;

export function validRegion(r:Rect){return[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.x>=0&&r.y>=0&&r.w>=.01&&r.h>=.01&&r.x+r.w<=1.000001&&r.y+r.h<=1.000001;}

// Whitespace corridors work well for separately placed photos/documents on a
// light scanner bed. Proposals are always reviewed before export.
export function detectScanRegions(pixels:Uint8ClampedArray,width:number,height:number,gapPercent=3):Rect[]{
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>2000000||pixels.length!==width*height*4)throw new Error('Ungültiges Vorschaubild.');
 if(!Number.isFinite(gapPercent)||gapPercent<1||gapPercent>12)throw new Error('Der Trennabstand muss zwischen 1 und 12 % liegen.');
 const mask=new Uint8Array(width*height);
 for(let p=0;p<mask.length;p++)mask[p]=pixels[p*4+3]>32&&Math.min(pixels[p*4],pixels[p*4+1],pixels[p*4+2])<235?1:0;
 type Box={x:number;y:number;w:number;h:number};
 const regions:Box[]=[];
 function visit(input:Box,depth:number){
  const rows=new Uint32Array(input.h),cols=new Uint32Array(input.w);
  for(let y=0;y<input.h;y++)for(let x=0;x<input.w;x++)if(mask[(input.y+y)*width+input.x+x]){rows[y]++;cols[x]++;}
  // Ignore isolated dust; a content row/column needs at least 0.5% coverage.
  const xr=Array.from(cols, n=>n>Math.max(1,input.h*.005)),yr=Array.from(rows,n=>n>Math.max(1,input.w*.005));
  const left=xr.indexOf(true),top=yr.indexOf(true);if(left<0||top<0)return;
  const right=xr.lastIndexOf(true)+1,bottom=yr.lastIndexOf(true)+1;
  const box={x:input.x+left,y:input.y+top,w:right-left,h:bottom-top};
  if(box.w<width*.025||box.h<height*.025)return;
  const gaps:{axis:'x'|'y';start:number;end:number;score:number}[]=[];
  const find=(values:boolean[],start:number,end:number,axis:'x'|'y',full:number)=>{
   for(let n=start;n<end;){if(values[n]){n++;continue;}const a=n;while(n<end&&!values[n])n++;if(n-a>=full*gapPercent/100&&a-start>=full*.08&&end-n>=full*.08)gaps.push({axis,start:a,end:n,score:(n-a)/full});}
  };
  find(xr,left,right,'x',width);find(yr,top,bottom,'y',height);gaps.sort((a,b)=>b.score-a.score);
  const split=gaps[0];
  if(split&&depth<6&&regions.length<30){
   const cut=Math.floor((split.start+split.end)/2);
   if(split.axis==='x'){visit({x:input.x,y:box.y,w:cut,h:box.h},depth+1);visit({x:input.x+cut,y:box.y,w:input.w-cut,h:box.h},depth+1);}
   else{visit({x:box.x,y:input.y,w:box.w,h:cut},depth+1);visit({x:box.x,y:input.y+cut,w:box.w,h:input.h-cut},depth+1);}
  }else regions.push(box);
 }
 visit({x:0,y:0,w:width,h:height},0);
 return regions.slice(0,32).map(b=>{const x=Math.max(0,b.x/width-.008),y=Math.max(0,b.y/height-.008);return{x,y,w:Math.min(1,(b.x+b.w)/width+.008)-x,h:Math.min(1,(b.y+b.h)/height+.008)-y};}).sort((a,b)=>Math.abs(a.y-b.y)>.03?a.y-b.y:a.x-b.x);
}

export async function proposeScanRegions(source:Source,page:number,gap:number,signal:AbortSignal){
 signal.throwIfAborted();const {canvas}=await renderPage(source,sourcePages(source)[page],1000,signal);
 try{signal.throwIfAborted();return detectScanRegions(canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,gap);}
 finally{canvas.width=canvas.height=0;}
}

export async function exportScanRegions(source:Source,regions:ScanRegions,format:'pdf'|'png'|'jpeg',dpi:number,ctx:RunContext):Promise<ExportFile>{
 const entries=Object.entries(regions).map(([page,rects])=>[Number(page),rects] as const).filter(([,rects])=>rects.length).sort((a,b)=>a[0]-b[0]);
 const count=entries.reduce((n,[,r])=>n+r.length,0);
 if(!count||count>200||entries.some(([p,rects])=>!Number.isInteger(p)||p<0||p>=source.pdf.numPages||rects.some(r=>!validRegion(r))))throw new Error('Bitte 1 bis 200 gültige Ausschnitte innerhalb der Seiten markieren.');
 if(!['pdf','png','jpeg'].includes(format)||![150,300].includes(dpi))throw new Error('Ungültiges Ausgabeformat.');
 const zip=new JSZip();let done=0,totalBytes=0;
 for(const [index,rects] of entries){
  ctx.signal.throwIfAborted();const page=await source.pdf.getPage(index+1),viewport=page.getViewport({scale:1});
  const {canvas,width,height}=await renderPage(source,sourcePages(source)[index],Math.min(4096,Math.max(viewport.width,viewport.height)*dpi/72),ctx.signal);
  try{for(const [part,r] of rects.entries()){
   ctx.signal.throwIfAborted();const cropped=document.createElement('canvas');
   const x=Math.floor(r.x*canvas.width),y=Math.floor(r.y*canvas.height);
   cropped.width=Math.max(1,Math.min(canvas.width-x,Math.ceil(r.w*canvas.width)));cropped.height=Math.max(1,Math.min(canvas.height-y,Math.ceil(r.h*canvas.height)));
   try{
    cropped.getContext('2d')!.drawImage(canvas,x,y,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
    const image=await new Promise<Blob>((resolve,reject)=>cropped.toBlob(b=>b?resolve(b):reject(new Error('Ausschnitt konnte nicht erstellt werden.')),format==='jpeg'?'image/jpeg':'image/png',.92));
    let bytes=new Uint8Array(await image.arrayBuffer());
    if(format==='pdf'){const pdf=await PDFDocument.create(),embedded=await pdf.embedPng(bytes);pdf.addPage([width*r.w,height*r.h]).drawImage(embedded,{x:0,y:0,width:width*r.w,height:height*r.h});bytes=new Uint8Array(await pdf.save());}
    totalBytes+=bytes.length;if(totalBytes>160*1024*1024)throw new Error('Die Ausschnitte überschreiten 160 MB. Bitte weniger Seiten oder 150 dpi wählen.');
    zip.file(`${filenameStem(source.name)}-Seite-${String(index+1).padStart(3,'0')}-Ausschnitt-${part+1}.${format==='jpeg'?'jpg':format}`,bytes);
   }finally{cropped.width=cropped.height=0;}
   ctx.report({percent:++done/count*95,label:`Ausschnitt ${done} von ${count} erstellen …`});
  }}finally{canvas.width=canvas.height=0;}
 }
 const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'},()=>ctx.signal.throwIfAborted());ctx.signal.throwIfAborted();
 return{blob:new Blob([new Uint8Array(bytes)],{type:'application/zip'}),filename:filenameStem(source.name)+'-Ausschnitte.zip',kind:'zip',pages:count,note:`${count} Ausschnitte aus ${entries.length} markierten Seite(n). Unmarkierte Seiten werden ausgelassen. Die Ausgaben enthalten nur die sichtbaren Ausschnitte als Bilder; für durchsuchbare PDFs anschließend OCR ausführen.`};
}
