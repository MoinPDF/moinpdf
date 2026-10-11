import {batesPdfs,pageLabels,rotateFreely,continuousPage,posterPages,packagePdfs} from '../lib/pro-tools';
import type {ProJob} from '../lib/pro-job';
self.onmessage=async ({data}:{data:{sources:{id:string;name:string;bytes:Uint8Array;pages:number}[];job:ProJob}})=>{
  const sources=data.sources.map(s=>({...s,pdf:{numPages:s.pages}}));
  const source=sources[0],job=data.job;
  const ctx={signal:new AbortController().signal,report:(progress:{percent:number;label:string})=>self.postMessage({progress})};
  try {
    if(!source) throw new Error('Keine PDF ausgewählt.');
    if(job.kind==='bates') {self.postMessage({result:await batesPdfs(sources,job.options,ctx)});return;}
    const bytes=job.kind==='page-labels'?await pageLabels(source.bytes,job.rules):job.kind==='rotate-free'?await rotateFreely(source.bytes,job.angle,ctx):job.kind==='continuous-page'?await continuousPage(sources,job.width,job.gap,ctx):await posterPages(source.bytes,job.columns,job.rows,job.overlap,ctx,job.print);
    const suffix={'page-labels':'Seitenbezeichnungen','rotate-free':'gedreht','continuous-page':'Langseite','poster-print':'Poster'}[job.kind];
    const pages=job.kind==='continuous-page'?1:job.kind==='poster-print'?source.pdf.numPages*job.columns*job.rows:source.pdf.numPages;
    const note=job.kind==='page-labels'?undefined:'Seiteninhalt bleibt als Text und Vektorgrafik erhalten. Interaktive Formulare werden festgeschrieben; Links, Anhänge, Lesezeichen und ursprüngliche Signaturen werden bei diesem Seitenneuaufbau nicht übernommen.';
    self.postMessage({result:await packagePdfs([{name:source.name.replace(/\.pdf$/i,'')+'-'+suffix+'.pdf',bytes,pages}],note)});
  } catch(error) {self.postMessage({error:error instanceof Error?error.message:'Der Seitenauftrag ist fehlgeschlagen.'});}
};
