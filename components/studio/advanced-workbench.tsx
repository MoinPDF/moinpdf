'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ChevronLeft,Plus,ShieldCheck,Download,LoaderCircle,Check} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {tools} from '@/lib/tool-catalog';
import {openSource,formatSize,type Source,type JobResult} from '@/lib/pdf-engine';
import type {AdvancedTool,ExportFile,RunContext} from '@/lib/advanced-types';
import {Choice,PageStage,PageSelect} from './advanced-shared';
import {SplitSizePanel} from './expansion-panels';
import {WorkflowPanel} from './advanced-workflows';
import {RenamePanel,SplitPanel,TablePanel,RedactPanel} from './advanced-text-panels';
import {EnhancePanel,ComparePanel,BarcodePanel,CameraPanel} from './advanced-media-panels';
import {LinksPanel,AttachmentsPanel,CoverPanel,MailMergePanel} from './advanced-document-panels';

export function AdvancedWorkbench({tool,sources,onBack,onAdd,onBusy,onUse,pending}:{tool:AdvancedTool;sources:Source[];onBack:()=>void;onAdd:()=>void;onBusy:(busy:boolean)=>void;onUse:(result:JobResult)=>Promise<void>;pending:boolean}){
 const [sourceId,setSourceId]=useState(sources[0]?.id||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState({percent:0,label:''}),[result,setResult]=useState<ExportFile|null>(null),[url,setUrl]=useState(''),[preview,setPreview]=useState<Source|null>(null),[page,setPage]=useState(0);
 const resultRef=useRef<HTMLElement>(null);const controller=useRef<AbortController|null>(null),info=tools.find(t=>t.id===tool)!,source=sources.find(s=>s.id===sourceId)||sources[0];
 useEffect(()=>{window.scrollTo(0,0);return()=>controller.current?.abort();},[]);useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
 useEffect(()=>{setResult(null);setError('');},[source?.id,tool]);
 useEffect(()=>{if(!result){setUrl('');setPreview(null);return;}requestAnimationFrame(()=>resultRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));const objectUrl=URL.createObjectURL(result.blob);setUrl(objectUrl);setPage(0);let active=true,owned:Source|undefined;if(result.kind==='pdf')openSource(new File([result.blob],result.filename,{type:'application/pdf'})).then(s=>{owned=s;if(active)setPreview(s);else void s.pdf.loadingTask.destroy();}).catch(()=>{});return()=>{active=false;URL.revokeObjectURL(objectUrl);if(owned)void owned.pdf.loadingTask.destroy();};},[result]);
 const run=useCallback(async(job:(ctx:RunContext)=>Promise<ExportFile|void>)=>{if(controller.current)return;const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setResult(null);setProgress({percent:0,label:'Verarbeitung wird vorbereitet …'});try{const out=await job({signal:abort.signal,report:setProgress});if(!abort.signal.aborted&&out)setResult(out);}catch(e){if(!abort.signal.aborted)setError((e as Error).message||'Die Verarbeitung ist fehlgeschlagen.');}finally{setBusy(false);controller.current=null;}},[]);
 const props={source,sources,busy,run},multi=tool==='batch'||tool==='workflows'||tool==='auto-rename';
 return <main className="document-workbench advanced-workbench"><header className="workbench-header"><Button variant="ghost" onClick={onBack} disabled={busy}><ChevronLeft size={17}/>Alle Werkzeuge</Button><div className="advanced-actions"><Button variant="outline" onClick={onAdd} disabled={busy}><Plus size={16}/>Dateien hinzufügen</Button><span className="device-tag"><ShieldCheck size={14}/>LOKAL AUF DEINEM GERÄT</span></div></header><div className="workbench-title"><div><span className="studio-kicker">MEHR MÖGLICHKEITEN FÜR DEINE DOKUMENTE</span><h1><info.icon/>{info.title}</h1><p>{info.description}</p></div></div>{pending&&<p className="workbench-notice">Dieses Werkzeug verarbeitet die vollständigen geöffneten Dateien. Änderungen aus anderen Werkzeugen zuerst anwenden und als Arbeitsdokument übernehmen.</p>}
 {!multi&&tool!=='camera-scan'&&source&&<fieldset disabled={busy} className="advanced-fields advanced-source"><Choice label={tool==='visual-compare'?'Erste Datei':'Dokument'} value={source.id} onChange={setSourceId} items={sources.map(s=>[s.id,s.name])}/></fieldset>}
 <fieldset disabled={busy} className="advanced-fields" onChangeCapture={()=>setResult(null)} key={`${tool}-${multi?'all':source?.id||'camera'}`}>
 {tool==='camera-scan'?<CameraPanel busy={busy} run={run}/>:!source?<div className="advanced-empty">Bitte zuerst eine PDF öffnen.</div>:<>
 {(tool==='batch'||tool==='workflows')&&<WorkflowPanel {...props} batch={tool==='batch'}/>}{tool==='auto-rename'&&<RenamePanel {...props}/>} {tool==='split-size'&&<SplitSizePanel {...props}/>} {tool==='smart-split'&&<SplitPanel {...props}/>} {tool==='table-export'&&<TablePanel {...props}/>} {tool==='search-redact'&&<RedactPanel {...props}/>} {tool==='visual-compare'&&<ComparePanel {...props}/>} {tool==='scan-enhance'&&<EnhancePanel {...props}/>} {tool==='qr-barcode'&&<BarcodePanel {...props}/>} {tool==='link-editor'&&<LinksPanel {...props}/>} {tool==='attachment-manager'&&<AttachmentsPanel {...props}/>} {tool==='cover-toc'&&<CoverPanel {...props}/>} {tool==='mail-merge'&&<MailMergePanel {...props}/>}
 </>}
 </fieldset>{busy&&<div className="advanced-progress" role="status"><LoaderCircle className="spin" size={18}/><span>{progress.label}</span><progress max={100} value={progress.percent}/><Button variant="ghost" onClick={()=>controller.current?.abort()}>Abbrechen</Button></div>}{error&&<p className="error-box" role="alert">{error}</p>}
 {result&&<section ref={resultRef} className="advanced-result" role="status"><div><h2><Check size={22}/>Dein Ergebnis ist bereit.</h2><p>{result.filename} · {formatSize(result.blob.size)}</p>{result.note&&<p>{result.note}</p>}<div className="advanced-actions"><Button asChild><a href={url} download={result.filename}><Download size={17}/>Herunterladen</a></Button>{result.kind==='pdf'&&<Button variant="outline" disabled={busy} onClick={()=>run(async()=>{await onUse({...result,kind:'pdf',inputSize:sources.reduce((n,s)=>n+s.size,0)});})}>Ergebnis weiterbearbeiten</Button>}</div></div>{preview&&<div className="advanced-result-preview"><PageSelect source={preview} page={page} onChange={setPage}/><PageStage source={preview} page={page}/></div>}</section>}
 </main>;
}
