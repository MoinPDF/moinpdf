import {openSource,pdfBlob,MAX_BYTES,MAX_PAGES,filenameStem,type Source} from './pdf-engine';
import {rewritePdf,optimizePdf,PdfPasswordError} from './pdf-security';
import {PDFDocument} from 'pdf-lib';
import type {ExportFile,RunContext} from './advanced-types';

export async function repairFile(file:File,ctx:RunContext):Promise<ExportFile>{
 if(!file.size||file.size>MAX_BYTES)throw new Error('Bitte eine PDF mit höchstens 80 MB auswählen.');
 ctx.signal.throwIfAborted();const bytes=new Uint8Array(await file.arrayBuffer());
 if(!new TextDecoder().decode(bytes.subarray(0,1024)).includes('%PDF-'))throw new Error('Die Datei enthält keinen erkennbaren PDF-Dateikopf.');
 ctx.report({percent:10,label:'PDF-Struktur wiederherstellen …'});
 let repaired:Uint8Array;
 try{repaired=await rewritePdf(bytes,ctx.signal);}
 catch(error){
  ctx.signal.throwIfAborted();if(error instanceof PdfPasswordError)throw error;
  // Some WASM builds cannot reconstruct a missing cross-reference table.
  // Independently parse the original objects, then normalize that recovered tree.
  try{
   const recovered=await PDFDocument.load(bytes,{throwOnInvalidObject:true,updateMetadata:false});
   if(!recovered.getPageCount()||recovered.getPageCount()>MAX_PAGES)throw new Error();
   const rebuilt=await recovered.save({useObjectStreams:true});
   repaired=await rewritePdf(rebuilt,ctx.signal);
  }catch{ctx.signal.throwIfAborted();throw error;}
 }
 ctx.signal.throwIfAborted();
 const checked=await openSource(new File([new Uint8Array(repaired)],file.name,{type:'application/pdf'}));
 try{
  if(!checked.pdf.numPages||checked.pdf.numPages>MAX_PAGES)throw new Error('Die wiederhergestellte PDF muss 1 bis 200 Seiten enthalten.');
  for(let n=1;n<=checked.pdf.numPages;n++){
   ctx.signal.throwIfAborted();const page=await checked.pdf.getPage(n);await page.getOperatorList();
   ctx.report({percent:20+80*n/checked.pdf.numPages,label:`Wiederhergestellte Seite ${n} prüfen …`});
  }
  ctx.signal.throwIfAborted();
  return{blob:pdfBlob(repaired),filename:filenameStem(file.name)+'-wiederhergestellt.pdf',kind:'pdf',pages:checked.pdf.numPages,note:`${checked.pdf.numPages} Seiten lassen sich wieder öffnen. Bitte Inhalte und Vollständigkeit visuell prüfen: fehlende Daten werden nicht rekonstruiert. Bestehende digitale Signaturen sind in der neu geschriebenen Kopie nicht mehr gültig.`};
 }finally{await checked.pdf.loadingTask.destroy();}
}

export async function optimizeBrowser(source:Source,targetMB:number,images:boolean,ctx:RunContext):Promise<ExportFile>{
 if(!Number.isFinite(targetMB)||targetMB<.05||targetMB>80)throw new Error('Bitte eine Zielgröße zwischen 0,05 und 80 MB wählen.');
 const target=Math.floor(targetMB*1024*1024);let best:Uint8Array=source.bytes;
 const attempts:(number|undefined)[]=images?[undefined,90,75,60,45]:[undefined];
 if(best.length>target)for(const [i,quality] of attempts.entries()){
  ctx.signal.throwIfAborted();ctx.report({percent:i/attempts.length*95,label:quality?`Bilder optimieren · Qualität ${quality}`:'Verlustfrei optimieren …'});
  const candidate=await optimizePdf(source.bytes,quality,ctx.signal);
  if(candidate.length<best.length)best=candidate;
  if(best.length<=target)break;
 }
 ctx.signal.throwIfAborted();ctx.report({percent:100,label:'Dateigröße geprüft'});
 const changed=best!==source.bytes;
 return{blob:pdfBlob(best),filename:filenameStem(source.name)+(changed?'-optimiert':'-original')+'.pdf',kind:'pdf',pages:source.pdf.numPages,note:`${best.length<=target?'Zielgröße erreicht.':'Zielgröße nicht erreicht; die kleinste gefundene Datei wird ausgegeben.'} ${changed?`${Math.round((1-best.length/source.bytes.length)*100)} % kleiner. Text, Links und Formularfelder bleiben erhalten. Digitale Signaturen werden durch das Neuschreiben ungültig.`:'Das Original ist bereits die kleinste Variante und bleibt unverändert.'} In dieser Ausgabe werden Bilder bei Bedarf als JPEG komprimiert, jedoch nicht in ihrer Auflösung verkleinert.`};
}
