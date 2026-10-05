import {PDFDocument,PDFName,PDFDict,StandardFonts,rgb,type PDFPage} from 'pdf-lib';
import {extractPageText,selectRange,filenameStem,pdfBlob,MAX_PAGES,type Source,type PageItem,type JobResult,type ProgressUpdate} from './pdf-engine';
import {extraDefaults,resolvePair,type ExtraOptions,type ExtraTool} from './extra-options';
import {compareLines,reportText,type PdfReport} from './pdf-report';

type Options=ExtraOptions&{pageSize:'a4'|'letter'};
type Notify=(p:ProgressUpdate)=>void;
type Normalize=(dest:PDFDocument,page:PDFPage)=>Promise<PDFPage>;
const check=(signal:AbortSignal)=>{if(signal.aborted)throw new DOMException('Abgebrochen','AbortError');};
const tick=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function number(value:number,min:number,max:number,label:string,integer=false){
 if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new Error(`${label}: bitte ${min} bis ${max} eingeben.`);
 return value;
}
export function splitGroups(count:number,options:ExtraOptions):number[][] {
 let groups:number[][];
 if(options.splitMode==='every'){
  const n=number(options.splitEvery,1,MAX_PAGES,'Seiten pro Datei',true);
  groups=Array.from({length:Math.ceil(count/n)},(_,i)=>Array.from({length:Math.min(n,count-i*n)},(_,j)=>i*n+j));
 }else{
  if(!options.splitRanges.trim())throw new Error('Bitte Seitenbereiche eingeben, zum Beispiel 1-3; 4-6.');
  const parts=options.splitRanges.split(';');
  if(parts.some(p=>!p.trim()))throw new Error('Zwischen den Semikolons muss jeweils ein Seitenbereich stehen.');
  groups=parts.map(p=>[...selectRange(p,count)]);
 }
 if(groups.reduce((n,g)=>n+g.length,0)>MAX_PAGES)throw new Error('Die Teilung darf insgesamt höchstens 200 Ausgabeseiten erzeugen.');
 return groups;
}
export function bookletOrder(count:number):[number,number][] {
 const padded=Math.ceil(count/4)*4,spreads:[number,number][]=[];
 for(let i=0;i<padded/4;i++)spreads.push([padded-1-i*2,i*2],[i*2+1,padded-2-i*2]);
 return spreads;
}
export function interleaveIndices(first:number[],second:number[],reverse=false) {
 const b=reverse?[...second].reverse():second,order:number[]=[];
 for(let i=0;i<Math.max(first.length,b.length);i++){if(i<first.length)order.push(first[i]);if(i<b.length)order.push(b[i]);}
 return order;
}
export function safeAttachmentName(name:string) {
 return name.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'_').replace(/^\.+/,'').replace(/[. ]+$/,'').slice(0,150)||'Anhang';
}
export function rasterTransform(tool:string,options:ExtraOptions) {
 return (canvas:HTMLCanvasElement,width:number,height:number)=>{
  const ctx=canvas.getContext('2d')!,pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
  if(tool==='auto-crop'){
   const margin=number(options.cropPadding,0,20,'Rand in mm');
   let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const i=(y*canvas.width+x)*4;
    if(Math.min(data[i],data[i+1],data[i+2])<245){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   }
   if(right<left)return {canvas,width,height};
   const padX=Math.ceil(margin*72/25.4*canvas.width/width),padY=Math.ceil(margin*72/25.4*canvas.height/height);
   left=Math.max(0,left-padX);top=Math.max(0,top-padY);right=Math.min(canvas.width-1,right+padX);bottom=Math.min(canvas.height-1,bottom+padY);
   const out=document.createElement('canvas');out.width=right-left+1;out.height=bottom-top+1;
   out.getContext('2d')!.drawImage(canvas,left,top,out.width,out.height,0,0,out.width,out.height);
   return {canvas:out,width:width*out.width/canvas.width,height:height*out.height/canvas.height};
  }
  const threshold=tool==='bilevel'?number(options.threshold,1,254,'Schwellenwert',true):0;
  for(let i=0;i<data.length;i+=4){
   if(tool==='bilevel'){const v=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]>=threshold?255:0;data[i]=data[i+1]=data[i+2]=v;}
   else {data[i]=255-data[i];data[i+1]=255-data[i+1];data[i+2]=255-data[i+2];}
  }
  ctx.putImageData(pixels,0,0);return {canvas,width,height};
 };
}
function selectedPair(sources:Source[],pages:PageItem[],options:ExtraOptions){
 const [first,second]=resolvePair(sources,options);
 if(!first||!second)throw new Error('Bitte mindestens zwei Dateien öffnen und beide im Werkzeug auswählen.');
 const a=pages.flatMap((p,i)=>p.sourceId===first.id?[i]:[]),b=pages.flatMap((p,i)=>p.sourceId===second.id?[i]:[]);
 if(!a.length||!b.length)throw new Error('Bitte in beiden gewählten Dateien mindestens eine Seite auswählen.');
 return {first,second,a,b};
}
function reportResult(report:PdfReport,filename:string,pages:number,inputSize:number):JobResult {
 return {blob:new Blob(['\ufeff'+reportText(report)],{type:'text/plain;charset=utf-8'}),kind:'report',filename,pages,inputSize,report};
}
export async function runSourceTool(tool:ExtraTool,sources:Source[],pages:PageItem[],config:ExtraOptions,notify:Notify,signal:AbortSignal):Promise<JobResult>{
 const options={...extraDefaults,...config},selectedSources=sources.filter(s=>pages.some(p=>p.sourceId===s.id));
 const inputSize=selectedSources.reduce((n,s)=>n+s.size,0);check(signal);
 if(tool==='extract-images')return extractEmbeddedImages(sources,pages,notify,signal);
 if(tool==='compare'){
  const {first,second,a,b}=selectedPair(sources,pages,options),total=Math.max(a.length,b.length);
  const report:PdfReport={title:'PDF-Textvergleich',description:`A: ${first.name}\nB: ${second.name}\nVerglichen wird auslesbarer Text in der Reihenfolge der ausgewählten Seiten. Bilder, Layout und reine Scanänderungen werden nicht geprüft.`,stats:[],sections:[]};
  let changed=0,same=0,unreadable=0;
  for(let i=0;i<total;i++){
   check(signal);notify({percent:i/total*95,label:`Seitenpaar ${i+1} von ${total} vergleichen …`});
   const ap=pages[a[i]],bp=pages[b[i]],at=ap?await extractPageText(first,ap):'',bt=bp?await extractPageText(second,bp):'';
   check(signal);
   const title=`A: ${ap?`Seite ${ap.index+1}`:'keine Seite'} · B: ${bp?`Seite ${bp.index+1}`:'keine Seite'}`;
   if((ap&&!at.trim())||(bp&&!bt.trim())){unreadable++;report.sections.push({title,status:'Textvergleich unvollständig',lines:[{kind:'note',text:'Mindestens eine Seite hat keinen auslesbaren Text. Bitte vorher OCR anwenden; diese Seiten gelten nicht als identisch.'},...(at?[{kind:'removed' as const,text:at}]:[]),...(bt?[{kind:'added' as const,text:bt}]:[])]});}
   else{
    const lines=compareLines(at,bt),different=!ap||!bp||lines.some(l=>l.kind!=='same');
    different?changed++:same++;
    report.sections.push({title,status:different?'Text geändert':'Text gleich',lines:different?lines:[{kind:'same',text:'Der auslesbare Text stimmt überein.'}]});
   }
   await tick();
  }
  report.stats=[{label:'Geändert',value:String(changed)},{label:'Text gleich',value:String(same)},{label:'Nicht vollständig prüfbar',value:String(unreadable)}];
  notify({percent:100,label:'Vergleich fertig'});return reportResult(report,'PDF-Textvergleich.txt',a.length+b.length,first.size+second.size);
 }
 if(tool==='attachments'){
  const zip=new (await import('jszip')).default();let total=0,bytes=0;
  for(let i=0;i<selectedSources.length;i++){
   check(signal);const src=selectedSources[i];notify({percent:i/selectedSources.length*90,label:`Anhänge aus ${src.name} lesen …`});
   const attachments=await src.pdf.getAttachments();check(signal);
   for(const [id,attachment] of attachments||[]){
    const content=attachment.content??await src.pdf.getAttachmentContent(id);check(signal);
    if(!content)throw new Error(`Der Anhang „${attachment.filename}“ konnte nicht gelesen werden.`);
    bytes+=content.byteLength;if(bytes>100*1024*1024)throw new Error('Die eingebetteten Anhänge sind größer als 100 MB. Bitte weniger Dateien gleichzeitig auswählen.');
    total++;zip.file(`${String(i+1).padStart(2,'0')}-${filenameStem(src.name)}/${String(total).padStart(3,'0')}-${safeAttachmentName(attachment.filename)}`,content);
   }
  }
  if(!total)throw new Error('In den ausgewählten Dateien wurden keine eingebetteten Anhänge gefunden. Bilder auf PDF-Seiten sind keine Dateianhänge.');
  const blob=await zip.generateAsync({type:'blob'},()=>check(signal));check(signal);notify({percent:100,label:`${total} Anhänge extrahiert`});
  return {blob,filename:'PDF-Anhaenge.zip',kind:'zip',pages:pages.length,inputSize,note:`${total} eingebettete Dateien. Entpacke die ZIP-Datei, um sie zu öffnen.`};
 }
 const report:PdfReport={title:'PDF-Dokumentbericht',description:'Angaben aus den importierten Originaldateien. Die Dateiinformationen beziehen sich auf das gesamte Dokument.',stats:[{label:'Dateien',value:String(selectedSources.length)},{label:'Seiten gesamt',value:String(selectedSources.reduce((n,s)=>n+s.pdf.numPages,0))}],sections:[]};
 for(let i=0;i<selectedSources.length;i++){
  check(signal);const src=selectedSources[i];notify({percent:i/selectedSources.length*95,label:`${src.name} untersuchen …`});
  const metadata=await src.pdf.getMetadata(),info=metadata.info as Record<string,unknown>;
  const details=[{label:'Dateigröße',value:`${src.size.toLocaleString('de-DE')} Bytes`},{label:'Seiten',value:String(src.pdf.numPages)},...(['PDFFormatVersion','Title','Author','Subject','Keywords','Creator','Producer','CreationDate','ModDate'] as const).map(key=>({label:({PDFFormatVersion:'PDF-Version',Title:'Titel',Author:'Autor',Subject:'Betreff',Keywords:'Stichwörter',Creator:'Ersteller',Producer:'PDF-Software',CreationDate:'Erstellt',ModDate:'Geändert'})[key],value:String(info[key]??'—')}))];
  report.sections.push({title:src.name,details});
  const dimensions:string[]=[];
  for(let j=1;j<=src.pdf.numPages;j++){
   check(signal);const page=await src.pdf.getPage(j),v=page.getViewport({scale:1});
   dimensions.push(`Seite ${j}: ${(v.width*25.4/72).toFixed(1)} × ${(v.height*25.4/72).toFixed(1)} mm · Drehung ${page.rotate}°`);
  }
  report.sections.push({title:`Seitenformate · ${src.name}`,lines:dimensions.map(text=>({kind:'same',text}))});await tick();
 }
 check(signal);notify({percent:100,label:'Bericht fertig'});return reportResult(report,'PDF-Dokumentbericht.txt',pages.length,inputSize);
}
async function copyInOrder(doc:PDFDocument,order:number[]) {
 const out=await PDFDocument.create();for(const p of await out.copyPages(doc,order))out.addPage(p);return out;
}
async function fit(out:PDFDocument,target:PDFPage,source:PDFPage,x:number,y:number,w:number,h:number,opacity=1){
 if(!source.node.Contents())return;
 const image=await out.embedPage(source),scale=Math.min(w/source.getWidth(),h/source.getHeight());
 target.drawPage(image,{x:x+(w-source.getWidth()*scale)/2,y:y+(h-source.getHeight()*scale)/2,width:source.getWidth()*scale,height:source.getHeight()*scale,opacity});
}
export async function runExtraPdfTool(tool:ExtraTool,doc:PDFDocument,sources:Source[],pages:PageItem[],config:Options,normalize:Normalize,notify:Notify,signal:AbortSignal):Promise<JobResult>{
 const options={...extraDefaults,...config},stem=sources.length===1?filenameStem(sources[0].name):'Dokumente',inputSize=sources.filter(s=>pages.some(p=>p.sourceId===s.id)).reduce((n,s)=>n+s.size,0);
 check(signal);
 if(tool==='split-ranges'){
  const groups=splitGroups(doc.getPageCount(),options),zip=new (await import('jszip')).default();
  for(let i=0;i<groups.length;i++){check(signal);notify({percent:90+i/groups.length*9,label:`Teil ${i+1} von ${groups.length} erstellen …`});const part=await copyInOrder(doc,groups[i]);zip.file(`${stem}-Teil-${String(i+1).padStart(3,'0')}.pdf`,await part.save());}
  const blob=await zip.generateAsync({type:'blob'},()=>check(signal));check(signal);notify({percent:100,label:'Fertig'});
  return {blob,filename:`${stem}-Teildokumente.zip`,kind:'zip',pages:groups.reduce((n,g)=>n+g.length,0),inputSize,note:`${groups.length} Teildokumente. Entpacke die ZIP-Datei, um die PDFs zu öffnen.`};
 }
 if(tool==='interleave'){
  const {a,b}=selectedPair(sources,pages,options);doc=await copyInOrder(doc,interleaveIndices(a,b,options.reverseSecond));
 }
 if(tool==='remove-annotations'){
  for(const page of doc.getPages()){
   check(signal);const list=page.node.Annots();if(!list)continue;
   for(let i=list.size()-1;i>=0;i--){const annot=list.lookup(i);if(!(annot instanceof PDFDict))continue;const type=annot.get(PDFName.of('Subtype'))?.toString();if(type!=='/Widget'&&(type!=='/Link'||options.removeLinks))list.remove(i);}
  }
  // Copy reachable page objects into a clean document, excluding orphaned
  // annotation dictionaries and their comment contents from the saved file.
  doc=await copyInOrder(doc,doc.getPageIndices());
 }
 if(tool==='edit-metadata'){
  for(const text of [options.metaTitle,options.metaAuthor,options.metaSubject,options.metaKeywords])if(text.length>1000)throw new Error('Metadaten dürfen je Feld höchstens 1.000 Zeichen enthalten.');
  doc.catalog.delete(PDFName.of('Metadata'));doc.setTitle(options.metaTitle);doc.setAuthor(options.metaAuthor);doc.setSubject(options.metaSubject);doc.setKeywords(options.metaKeywords.split(',').map(s=>s.trim()).filter(Boolean));
 }
 if(['booklet','split-grid','overlay','stamp'].includes(tool)){
  await doc.flush();const normalized=await PDFDocument.create();
  for(const page of doc.getPages()){check(signal);await normalize(normalized,page);}await normalized.flush();doc=normalized;
 }
 if(tool==='booklet'){
  const out=await PDFDocument.create(),size:[number,number]=options.pageSize==='letter'?[792,612]:[841.89,595.28];
  const order=bookletOrder(doc.getPageCount()),margin=18,gap=12,w=(size[0]-margin*2-gap)/2,h=size[1]-margin*2;
  for(const spread of order){check(signal);const page=out.addPage(size);for(let side=0;side<2;side++)if(spread[side]<doc.getPageCount())await fit(out,page,doc.getPage(spread[side]),margin+side*(w+gap),margin,w,h);}
  doc=out;
 }
 if(tool==='split-grid'){
  if(!['2x1','1x2','2x2','3x3'].includes(options.tileLayout))throw new Error('Bitte ein gültiges Seitenraster wählen.');
  const [cols,rows]=options.tileLayout.split('x').map(Number),count=doc.getPageCount()*cols*rows;
  if(count>MAX_PAGES)throw new Error(`Das Raster würde ${count} Seiten erzeugen. Bitte die Auswahl auf höchstens ${Math.floor(MAX_PAGES/(cols*rows))} Seiten reduzieren.`);
  const out=await PDFDocument.create();
  for(const source of doc.getPages())for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   check(signal);const w=source.getWidth()/cols,h=source.getHeight()/rows,target=out.addPage([w,h]);
   if(source.node.Contents()){const image=await out.embedPage(source,{left:col*w,right:(col+1)*w,bottom:source.getHeight()-(row+1)*h,top:source.getHeight()-row*h});target.drawPage(image,{x:0,y:0,width:w,height:h});}
  }
  doc=out;
 }
 if(tool==='overlay'){
  const {a,b}=selectedPair(sources,pages,options),opacity=number(options.overlayOpacity,5,100,'Deckkraft')/100,out=await PDFDocument.create(),overlay=doc.getPage(b[0]);
  for(const index of a){check(signal);const base=doc.getPage(index),w=base.getWidth(),h=base.getHeight(),target=out.addPage([w,h]);
   if(options.overlayLayer==='back')await fit(out,target,overlay,0,0,w,h,opacity);
   await fit(out,target,base,0,0,w,h);
   if(options.overlayLayer==='front')await fit(out,target,overlay,0,0,w,h,opacity);
  }
  doc=out;
 }
 if(tool==='stamp'){
  const label=options.stampText.trim();if(!label||label.length>60)throw new Error('Bitte einen Stempeltext mit 1 bis 60 Zeichen eingeben.');
  let date='';if(options.stampDate){if(!/^\d{4}-\d{2}-\d{2}$/.test(options.stampDate)||new Date(options.stampDate+'T12:00:00Z').toISOString().slice(0,10)!==options.stampDate)throw new Error('Bitte ein gültiges Datum wählen.');date=options.stampDate.split('-').reverse().join('.');}
  const font=await doc.embedFont(StandardFonts.HelveticaBold),color=options.stampColor==='red'?rgb(.7,.17,.2):options.stampColor==='green'?rgb(.3,.5,.13):rgb(.02,.46,.45);
  const text=date?`${label} · ${date}`:label;let unitWidth:number;try{unitWidth=font.widthOfTextAtSize(text,1);}catch{throw new Error('Der Stempel unterstützt lateinische Schrift einschließlich Umlauten. Bitte keine Emojis verwenden.');}
  for(const page of doc.getPages()){
   check(signal);const w=page.getWidth(),h=page.getHeight(),margin=Math.min(24,w*.08,h*.08),size=Math.min(15,(w-margin*2-20)/unitWidth),boxW=unitWidth*size+20,boxH=size+18;
   if(size<3||boxH>h-margin*2)throw new Error('Mindestens eine Seite ist für diesen Stempel zu klein. Bitte einen kürzeren Text wählen.');
   const x=options.stampPosition.endsWith('right')?w-margin-boxW:margin,y=options.stampPosition.startsWith('top')?h-margin-boxH:margin;
   page.drawRectangle({x,y,width:boxW,height:boxH,borderWidth:1.25,borderColor:color,color:rgb(1,1,1),opacity:.92});page.drawText(text,{x:x+10,y:y+10,size,font,color});
  }
 }
 check(signal);const suffix:Record<string,string>={'interleave':'abwechselnd','booklet':'Broschuere','split-grid':'Ausschnitte','auto-crop':'ohne-weisse-Raender','bilevel':'Schwarzweiss','invert':'invertiert','stamp':'gestempelt','edit-metadata':'Metadaten','remove-annotations':'ohne-Anmerkungen','overlay':'ueberlagert'};
 const bytes=await doc.save();check(signal);notify({percent:100,label:'Fertig'});
 return {blob:pdfBlob(bytes),filename:`${stem}-${suffix[tool]}.pdf`,kind:'pdf',pages:doc.getPageCount(),inputSize};
}

// Export decoded image objects, independently of the page's drawing scale or clipping.
export async function extractEmbeddedImages(sources:Source[],pages:PageItem[],notify:Notify,signal:AbortSignal):Promise<JobResult>{
 const {OPS,ImageKind}=await import('pdfjs-dist'),zip=new (await import('jszip')).default();
 let count=0,bytes=0,pixels=0,masks=0;const seenPages=new Set<string>();
 for(let n=0;n<pages.length;n++){
  check(signal);const item=pages[n],source=sources.find(s=>s.id===item.sourceId)!;
  const pageKey=`${source.id}:${item.index}`;if(seenPages.has(pageKey))continue;seenPages.add(pageKey);
  notify({percent:n/pages.length*90,label:`Bilder aus Seite ${n+1} von ${pages.length} lesen …`});
  const page=await source.pdf.getPage(item.index+1),list=await page.getOperatorList(),seen=new Set<string>();let pageCount=0;
  const operations=list.fnArray.flatMap((op,i)=>op===OPS.paintInlineImageXObjectGroup?(list.argsArray[i][1] as {x:number;y:number;w:number;h:number}[]).map(rect=>({op:OPS.paintInlineImageXObject,args:[{...list.argsArray[i][0],extractionRect:rect}]})):[{op,args:list.argsArray[i]}]);
  for(const {op,args} of operations){
   check(signal);let image:any;
   if(op===OPS.paintImageMaskXObject||op===OPS.paintImageMaskXObjectGroup||op===OPS.paintImageMaskXObjectRepeat){masks++;continue;}
   if(op===OPS.paintImageXObject||op===OPS.paintImageXObjectRepeat){
    const id=String(args[0]);if(seen.has(id))continue;seen.add(id);const objects=id.startsWith('g_')?page.commonObjs:page.objs;
    image=await new Promise<any>((resolve,reject)=>{
     const fail=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new Error('Ein eingebettetes Bild konnte nicht vollständig gelesen werden.'));};
     const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Abgebrochen','AbortError'));};
     const timer=setTimeout(fail,15000);signal.addEventListener('abort',abort,{once:true});
     try{objects.get(id,(value:unknown)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);resolve(value);});}catch{fail();}
    });
   }else if(op===OPS.paintInlineImageXObject)image=args[0];else continue;
   check(signal);if(!image)throw new Error('Ein eingebettetes Bild ist nicht lesbar.');
   const {width,height}=image;if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new Error('Ungültige Bildabmessungen.');
   pixels+=width*height;if(width*height>40000000||pixels>120000000||count>=1000)throw new Error('Zu viele oder zu große Bilder. Bitte weniger Seiten auswählen.');
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;let exportCanvas=canvas;
   try{
    const ctx=canvas.getContext('2d')!;
    if(image.bitmap)ctx.drawImage(image.bitmap,0,0);else{
     const out=ctx.createImageData(width,height),data=image.data;if(!data)throw new Error('Die Bilddaten fehlen.');
     if(image.kind===ImageKind.RGBA_32BPP)out.data.set(data);
     else if(image.kind===ImageKind.RGB_24BPP){for(let p=0,j=0;p<out.data.length;p+=4,j+=3){out.data[p]=data[j];out.data[p+1]=data[j+1];out.data[p+2]=data[j+2];out.data[p+3]=255;}}
     else if(image.kind===ImageKind.GRAYSCALE_1BPP){const stride=Math.ceil(width/8);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=(y*width+x)*4,value=(data[y*stride+(x>>3)]&(128>>(x%8)))?255:0;out.data[p]=out.data[p+1]=out.data[p+2]=value;out.data[p+3]=255;}}
     else throw new Error('Ein Bildformat wird noch nicht unterstützt.');ctx.putImageData(out,0,0);
    }
    if(image.extractionRect){const r=image.extractionRect;if(r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>width||r.y+r.h>height)throw new Error('Ungültiger Bildausschnitt.');exportCanvas=document.createElement('canvas');exportCanvas.width=r.w;exportCanvas.height=r.h;exportCanvas.getContext('2d')!.drawImage(canvas,r.x,r.y,r.w,r.h,0,0,r.w,r.h);}
    const blob=await new Promise<Blob|null>(resolve=>exportCanvas.toBlob(resolve,'image/png'));check(signal);if(!blob)throw new Error('Ein Bild konnte nicht als PNG gespeichert werden.');
    bytes+=blob.size;if(bytes>100*1024*1024)throw new Error('Die extrahierten Bilder sind größer als 100 MB. Bitte weniger Seiten auswählen.');count++;pageCount++;
    const folder=`${String(sources.indexOf(source)+1).padStart(2,'0')}-${filenameStem(source.name)}`;
    zip.file(`${folder}/Seite-${String(item.index+1).padStart(3,'0')}-Bild-${String(pageCount).padStart(2,'0')}.png`,await blob.arrayBuffer());
   }finally{canvas.width=canvas.height=0;if(exportCanvas!==canvas)exportCanvas.width=exportCanvas.height=0;}
   await tick();
  }
 }
 if(!count)throw new Error('Keine eigenständigen Rasterbilder gefunden. Für komplette Seiten verwende „PDF zu Bildern“.');
 notify({percent:95,label:`${count} Bilder als ZIP zusammenstellen …`});const blob=await zip.generateAsync({type:'blob'},()=>check(signal));check(signal);notify({percent:100,label:'Bilder extrahiert'});
 return {blob,filename:'PDF-Bilder.zip',kind:'zip',pages:seenPages.size,inputSize:sources.filter(s=>pages.some(p=>p.sourceId===s.id)).reduce((a,s)=>a+s.size,0),note:`${count} Bilder als PNG, geordnet nach Datei und Originalseite.${masks?' Reine Bildmasken wurden übersprungen.':''}`};
}
