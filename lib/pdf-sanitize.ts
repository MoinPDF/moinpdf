import {PDFDocument,PDFDict,PDFArray,PDFName,PDFString,PDFHexString,PDFStream,type PDFObject} from 'pdf-lib';
import {rewritePdf} from './pdf-security';
import {pdfBlob,filenameStem,type Source} from './pdf-engine';
import {checkAbort,type RunContext,type ExportFile} from './advanced-types';

export type SanitizeOptions={attachments:boolean;comments:boolean;metadata:boolean};
export type SanitizeFinding={kind:'active'|'attachments'|'comments'|'metadata';detail:string;count:number};
const activeKeys=new Set(['OpenAction','AA','JS','JavaScript','XFA','RichMediaContent','RichMediaSettings','Collection']);
const mediaTypes=new Set(['RichMedia','Movie','Sound','Screen','3D']);
const valueText=(value:PDFObject|undefined)=>value instanceof PDFString||value instanceof PDFHexString?value.decodeText():'';
function inspectAndClean(doc:PDFDocument,options:SanitizeOptions,apply:boolean) {
  const counts=new Map<string,SanitizeFinding>(),seen=new Set<PDFObject>();let visited=0;
  const finding=(kind:SanitizeFinding['kind'],detail:string)=>{const key=kind+detail,old=counts.get(key);counts.set(key,{kind,detail,count:(old?.count||0)+1});};
  const resolved=(value:PDFObject|undefined)=>value?doc.context.lookup(value):undefined;
  const actionSafe=(a:PDFDict)=>{const kind=a.get(PDFName.of('S'))?.toString();if(kind==='/GoTo')return true;if(kind!=='/URI')return false;const uri=valueText(resolved(a.get(PDFName.of('URI'))));try{return['https:','http:','mailto:','tel:'].includes(new URL(uri).protocol);}catch{return false;}};
  function walk(value:PDFObject|undefined,depth=0) {
    const object=resolved(value);if(!object||seen.has(object))return;seen.add(object);
    if(++visited>250000||depth>100)throw new Error('Die PDF-Objektstruktur ist für eine sichere Bereinigung zu komplex.');
    if(object instanceof PDFStream){walk(object.dict,depth+1);return;}
    if(object instanceof PDFArray){for(const entry of [...object.asArray()])walk(entry,depth+1);return;}
    if(!(object instanceof PDFDict))return;
    // Action dictionaries can be reached from outlines, fields or nested /Next chains.
    const action=object.get(PDFName.of('S'))?.toString();
    if(action&&['/JavaScript','/Launch','/SubmitForm','/ImportData','/GoToR','/GoToE','/Rendition','/Movie','/Sound','/Hide','/ResetForm','/SetOCGState','/Named','/Trans','/GoTo3DView'].includes(action)) {
      finding('active',`Aktion ${action.slice(1)}`);
      if(apply){for(const key of object.keys())object.delete(key);return;}
    }
    for(const [key,raw] of [...object.entries()]) {
      const name=key.decodeText(),child=resolved(raw);let kind:SanitizeFinding['kind']|undefined,detail=name;
      if(activeKeys.has(name)||name==='Next'&&!!action){kind='active';}
      else if(name==='A'&&child instanceof PDFDict&&!actionSafe(child)){kind='active';detail=`Aktion ${child.get(PDFName.of('S'))?.toString()||'unbekannt'}`;}
      else if(['EmbeddedFiles','AF','EF'].includes(name)){kind='attachments';}
      else if(['Metadata','PieceInfo','LastModified'].includes(name)){kind='metadata';}
      if(kind){finding(kind,detail);if(apply&&(kind==='active'||options[kind])){object.delete(key);continue;}}
      if(name==='Annots'&&child instanceof PDFArray) {
        for(let i=child.size()-1;i>=0;i--){const annotation=resolved(child.get(i));if(!(annotation instanceof PDFDict))continue;const subtype=annotation.get(PDFName.of('Subtype'))?.toString().slice(1)||'Unbekannt';let category:SanitizeFinding['kind']|undefined;
          if(mediaTypes.has(subtype))category='active';else if(subtype==='FileAttachment')category='attachments';else if(!['Widget','Link'].includes(subtype))category='comments';
          if(category){finding(category,`Annotation ${subtype}`);if(apply&&(category==='active'||options[category]))child.remove(i);}
        }
      }
      walk(raw,depth+1);
    }
  }
  // Include indirect dictionaries that may only be referenced via unusual extension keys.
  walk(doc.catalog);for(const [,object] of doc.context.enumerateIndirectObjects())walk(object);
  if(doc.context.trailerInfo.Info){finding('metadata','Dokumenteigenschaften');if(apply&&options.metadata)doc.context.trailerInfo.Info=undefined;}
  return [...counts.values()];
}
export async function inspectSanitization(source:Source) {
  return inspectAndClean(await PDFDocument.load(source.bytes,{updateMetadata:false}),{attachments:true,comments:true,metadata:true},false);
}
export async function sanitizePdf(source:Source,options:SanitizeOptions,ctx:RunContext):Promise<ExportFile> {
  checkAbort(ctx.signal);ctx.report({percent:15,label:'Aktive Inhalte und gewählte Zusatzdaten entfernen …'});
  const doc=await PDFDocument.load(source.bytes,{updateMetadata:false});inspectAndClean(doc,options,true);
  // Rewrite discards unreachable script streams, old metadata and embedded file bytes.
  ctx.report({percent:50,label:'Nicht mehr referenzierte Objekte verwerfen …'});
  const bytes=await rewritePdf(await doc.save({updateFieldAppearances:false}),ctx.signal);checkAbort(ctx.signal);
  const verification=inspectAndClean(await PDFDocument.load(bytes,{updateMetadata:false}),options,false).filter(f=>f.kind==='active'||options[f.kind]);
  if(verification.length)throw new Error('Die Nachprüfung hat weitere zu entfernende Inhalte gefunden. Es wird kein unvollständig bereinigtes Ergebnis ausgegeben.');
  return{blob:pdfBlob(bytes),filename:filenameStem(source.name)+'-bereinigt.pdf',kind:'pdf',pages:doc.getPageCount(),note:'Skripte, automatische und riskante Aktionen sowie die gewählten Zusatzdaten wurden entfernt und nachgeprüft. Reguläre Web- und Seitenlinks bleiben erhalten. Dies ist kein Virenscan. Digitale Signaturen werden durch die Änderung ungültig.'};
}
