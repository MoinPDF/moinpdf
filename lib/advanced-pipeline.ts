import JSZip from 'jszip';
import {openSource,sourcePages,type Source} from './pdf-engine';
import {runStudioJob,emptyEdits} from './studio-engine';
import {inspectPage} from './document-check';
import {protectPdf} from './pdf-security';
import {workflowOptions} from './advanced-text';
import {checkAbort,uniqueNames,type RunContext,type ExportFile} from './advanced-types';

export const stepLabels={ocr:'OCR',removeBlank:'Leerseiten entfernen',numbers:'Seitennummern',stamp:'Stempel',watermark:'Wasserzeichen',metadata:'Dokumentinfos entfernen',grayscale:'Graustufen',compress:'Scans komprimieren',protect:'Passwortschutz'};
export type StepKind=keyof typeof stepLabels;
export type WorkflowStep={kind:StepKind;text?:string;number?:number};
export type SavedWorkflow={version:1;name:string;steps:WorkflowStep[]};
export function validateWorkflow(value:unknown):SavedWorkflow{
 const v=value as SavedWorkflow;if(!v||v.version!==1||typeof v.name!=='string'||!v.name.trim()||v.name.length>100||!Array.isArray(v.steps)||!v.steps.length||v.steps.length>12)throw new Error('Ungültiger Arbeitsablauf: Name und 1 bis 12 Schritte erforderlich.');
 const steps=v.steps.map((s,i)=>{if(!s||!Object.hasOwn(stepLabels,s.kind))throw new Error('Unbekannter Arbeitsschritt.');if(s.kind==='protect'&&i!==v.steps.length-1)throw new Error('Passwortschutz muss der letzte Schritt sein.');if(s.text!==undefined&&(typeof s.text!=='string'||s.text.length>200))throw new Error('Schritttext: höchstens 200 Zeichen.');if(s.number!==undefined&&(!Number.isInteger(s.number)||s.number<1||s.number>999999))throw new Error('Startnummer: 1 bis 999999.');return{kind:s.kind,...(s.text!==undefined?{text:s.text}:{}),...(s.number!==undefined?{number:s.number}:{})};});return{version:1,name:v.name.trim(),steps};
}
export async function runPipeline(sources:Source[],workflow:SavedWorkflow,password:string,ctx:RunContext):Promise<ExportFile>{
 const {steps}=validateWorkflow(workflow);if(!sources.length)throw new Error('Bitte zuerst PDFs öffnen.');const zip=new JSZip(),names=uniqueNames(sources.map(s=>s.name.replace(/\.pdf$/i,'')+'-bearbeitet.pdf'));let totalPages=0;
 for(const [i,original] of sources.entries()){checkAbort(ctx.signal);let current=original,owned:Source|undefined,bytes=original.bytes;
  try{for(const [j,step] of steps.entries()){checkAbort(ctx.signal);const report=(p:{percent:number;label:string})=>ctx.report({percent:(i+(j+p.percent/100)/steps.length)/sources.length*100,label:`${i+1}/${sources.length} · ${stepLabels[step.kind]} · ${p.label}`});let pages=sourcePages(current);
    if(step.kind==='protect'){bytes=await protectPdf(bytes,{password,printing:'full',copying:true,editing:true},ctx.signal);continue;}
    if(step.kind==='removeBlank'){const keep=[];for(const [n,page] of pages.entries()){if(!(await inspectPage(current,page,n,ctx.signal)).blank)keep.push(page);report({percent:(n+1)/pages.length*100,label:`Seite ${n+1}`});}if(!keep.length)throw new Error(`${original.name}: Alle Seiten wurden als leer erkannt. Bitte den Schritt „Leerseiten entfernen“ prüfen.`);pages=keep;}
    const options={...workflowOptions,stampText:step.text||'GEPRÜFT',watermark:step.text||'ENTWURF',numberStart:step.number||1};const result=await runStudioJob(step.kind==='removeBlank'?'organize':step.kind,[current],pages,options,emptyEdits(),report,ctx.signal);bytes=new Uint8Array(await result.blob.arrayBuffer());if(owned)await owned.pdf.loadingTask.destroy();owned=undefined;current=await openSource(new File([new Uint8Array(bytes)],original.name,{type:'application/pdf'}));owned=current;
   }totalPages+=current.pdf.numPages;zip.file(names[i],bytes);
  }finally{if(owned)await owned.pdf.loadingTask.destroy();}
 }checkAbort(ctx.signal);return{blob:await zip.generateAsync({type:'blob',compression:'DEFLATE'}),filename:'PDF-Arbeitsablauf.zip',kind:'zip',pages:totalPages,note:`${sources.length} ${sources.length === 1 ? 'Datei' : 'Dateien'} · ${steps.map(s=>stepLabels[s.kind]).join(' → ')}`};
}
