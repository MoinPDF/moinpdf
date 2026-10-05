'use client';
import {useId,type CSSProperties} from 'react';
import {File,FileText,Plus,Check,LoaderCircle} from 'lucide-react';

export type ImportState={phase:'idle'|'reading'|'done';name:string;completed:number;total:number};

export function UploadEntry({dragOver,loading,state,onOpen,onCamera,onOffice,onEmail,onTools}:{dragOver:boolean;loading:boolean;state:ImportState;onOpen:()=>void;onCamera?:()=>void;onOffice?:()=>void;onEmail?:()=>void;onTools?:()=>void}){
 const phase=state.phase==='idle'&&dragOver?'drag':state.phase;
 const id=useId().replace(/:/g,'');
 const paperId=`${id}-paper`,edgeId=`${id}-edge`,scanId=`${id}-scan`,maskId=`${id}-mask`;
 return <main className="upload-entry">
  <button className={`upload-field is-${phase}`} onClick={onOpen} disabled={loading} aria-label="PDFs oder E-Rechnungen auswählen" aria-busy={loading}>
   <span className="upload-document-stage" aria-hidden="true">
    <span className="upload-document-float">
     <FileText className="upload-document-icon" size={288} strokeWidth={.17} style={{'--paper-fill':`url(#${paperId})`,'--paper-edge':`url(#${edgeId})`} as CSSProperties}>
      <defs>
       <linearGradient id={paperId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f7fffd"/><stop offset="45%" stopColor="#def4ee"/><stop offset="100%" stopColor="#d7edb1"/>
       </linearGradient>
       <linearGradient id={edgeId} x1="0%" y1="0%" x2="100%" y2="90%">
        <stop offset="0%" stopColor="#68c2c2"/><stop offset="48%" stopColor="#059a98"/><stop offset="100%" stopColor="#94d33e"/>
       </linearGradient>
       <linearGradient id={scanId} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#68c2c2" stopOpacity="0"/><stop offset="75%" stopColor="#68c2c2" stopOpacity=".13"/><stop offset="96%" stopColor="#ffffff" stopOpacity=".65"/><stop offset="100%" stopColor="#059a98" stopOpacity=".28"/>
       </linearGradient>
       <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <File size={24} stroke="none" fill="white"/>
       </mask>
      </defs>
      <g mask={`url(#${maskId})`} stroke="none"><rect className="upload-document-scan" x="0" y="-8" width="24" height="8" fill={`url(#${scanId})`}/></g>
     </FileText>
     <span className="upload-document-badge">{state.phase==='done'?<Check size={24} strokeWidth={1.8}/>:state.phase==='reading'?<LoaderCircle size={23} strokeWidth={1.6}/>:<Plus size={26} strokeWidth={1.6}/>}</span>
    </span>
   </span>
   <span className="upload-field-inner">
    <span className="upload-title" role="heading" aria-level={1}>{state.phase==='done'?'Alles bereit.':state.phase==='reading'?'Wird geöffnet …':dragOver?'Hier loslassen.':'PDFs hier ablegen.'}</span>
    <span className="upload-description">{state.phase==='done'?`${state.completed} ${state.completed===1?'Datei geöffnet':'Dateien geöffnet'}`:state.phase==='reading'?state.name:dragOver?'Eine oder mehrere Dateien':'oder klicken · auch Rechnungs-XML'}</span>
    {loading&&<span className="upload-progress" role="progressbar" aria-label="Dateien öffnen" aria-valuenow={state.completed} aria-valuemin={0} aria-valuemax={Math.max(1,state.total)}><span style={{width:`${state.total?state.completed/state.total*100:0}%`}}/></span>}
   </span>
  </button>
  <div className="upload-alternatives"><button disabled={loading} onClick={onCamera}>Kamera-Scanner</button><span>·</span><button disabled={loading} onClick={onOffice}>Office zu PDF</button><span>·</span><button disabled={loading} onClick={onEmail}>E-Mails zu PDF</button><span>·</span><button disabled={loading} onClick={onTools}>Alle Werkzeuge</button></div>
  <span className="sr-only" role="status" aria-live="polite">{loading?`${state.completed} von ${state.total} Dateien verarbeitet`:''}</span>
 </main>;
}
