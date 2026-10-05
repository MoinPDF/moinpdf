'use client';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {Check,ChevronDown,LoaderCircle} from 'lucide-react';
import {renderPage,type Source} from '@/lib/pdf-engine';
import type {FormField,FieldRect} from '@/lib/document-tools';

type Drag={id:string;widget:number;mode:'move'|'resize';start:{x:number;y:number};rect:FieldRect}|{mode:'draw';start:{x:number;y:number}};
const fit=(r:FieldRect):FieldRect=>{const w=Math.max(.01,Math.min(1,r.w)),h=Math.max(.01,Math.min(1,r.h));return{x:Math.max(0,Math.min(1-w,r.x)),y:Math.max(0,Math.min(1-h,r.y)),w,h};};
export function FormCanvas({source,pageIndex,fields,selectedId,creating,design,disabled,onSelect,onCreate,onRect}:{source:Source;pageIndex:number;fields:FormField[];selectedId:string;creating:boolean;design:boolean;disabled:boolean;onSelect:(id:string)=>void;onCreate:(rect:FieldRect)=>void;onRect:(id:string,widget:number,rect:FieldRect)=>void}){
 const [url,setUrl]=useState(''),[size,setSize]=useState({width:595,height:842}),[error,setError]=useState(''),[draft,setDraft]=useState<FieldRect|null>(null),[moving,setMoving]=useState('');
 const host=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null);
 useEffect(()=>{let live=true,objectUrl='';const abort=new AbortController();setUrl('');setError('');
  renderPage(source,{id:`form-${pageIndex}`,sourceId:source.id,index:pageIndex,rotation:0,selected:true},1600,abort.signal).then(async({canvas,width,height})=>{const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/jpeg',.94));canvas.width=canvas.height=0;if(live&&blob){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);setSize({width,height});}}).catch(()=>{if(live)setError('Die Seitenvorschau konnte nicht geladen werden.');});
  return()=>{live=false;abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[source,pageIndex]);
 useEffect(()=>{drag.current=null;setDraft(null);setMoving('');},[pageIndex,creating,design]);
 function position(e:PointerEvent){const r=host.current!.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
 function nextRect(e:PointerEvent){const d=drag.current!,p=position(e);if(d.mode==='draw')return{x:Math.min(p.x,d.start.x),y:Math.min(p.y,d.start.y),w:Math.abs(p.x-d.start.x),h:Math.abs(p.y-d.start.y)};
  return fit(d.mode==='move'?{...d.rect,x:d.rect.x+p.x-d.start.x,y:d.rect.y+p.y-d.start.y}:{...d.rect,w:d.rect.w+p.x-d.start.x,h:d.rect.h+p.y-d.start.y});}
 function start(e:PointerEvent,id?:string,widget=0,resize=false){if(disabled||!url)return;if(id){onSelect(id);const field=fields.find(f=>f.id===id)!;if(!design||field.existing)return;drag.current={id,widget,mode:resize?'resize':'move',start:position(e),rect:field.widgets[widget].rect};setMoving(`${id}:${widget}`);setDraft(field.widgets[widget].rect);}else{if(!creating)return;drag.current={mode:'draw',start:position(e)};setDraft({...position(e),w:0,h:0});}
  e.preventDefault();host.current!.setPointerCapture(e.pointerId);
 }
 function finish(e:PointerEvent){const d=drag.current;if(!d)return;const rect=nextRect(e);drag.current=null;setDraft(null);setMoving('');if(d.mode==='draw'){if(rect.w>=.015&&rect.h>=.012)onCreate(rect);}else onRect(d.id,d.widget,rect);}
 return <div className="form-canvas-wrap"><div ref={host} className={`form-sheet ${creating?'drawing':''}`} style={{aspectRatio:`${size.width}/${size.height}`,touchAction:creating||design?'none':'auto'}} role="region" aria-label="Formular-Seitenvorschau" onPointerDown={e=>start(e)} onPointerMove={e=>{if(drag.current)setDraft(nextRect(e));}} onPointerUp={finish} onPointerCancel={()=>{drag.current=null;setDraft(null);setMoving('');}}>
  {url?<img src={url} alt={`${source.name}, Seite ${pageIndex+1}`} draggable={false}/>:<div className="form-loading">{error||<LoaderCircle className="spin"/>}</div>}
  {url&&fields.filter(f=>!f.deleted).flatMap(field=>field.widgets.map((widget,index)=>{if(widget.page!==pageIndex)return null;const r=moving===`${field.id}:${index}`&&draft?draft:widget.rect,value=Array.isArray(field.value)?field.value.join(', '):String(field.value||'');const checked=field.kind==='checkbox'?field.value===true:field.kind==='radio'?value===widget.option:false;
   return <button key={`${field.id}:${index}`} type="button" className={`form-widget ${field.kind} ${selectedId===field.id?'chosen':''} ${field.readOnly?'readonly':''}`} style={{left:`${r.x*100}%`,top:`${r.y*100}%`,width:`${r.w*100}%`,height:`${r.h*100}%`}} disabled={disabled} aria-label={`Feld ${field.name} auswählen`} onClick={()=>onSelect(field.id)} onPointerDown={e=>{e.stopPropagation();start(e,field.id,index);}}>
    {(field.kind==='checkbox'||field.kind==='radio')?(checked?<Check size={18}/>:null):field.kind==='unsupported'?<span>Geschütztes Feld</span>:<span className={value?'':'placeholder'}>{value||field.name}</span>}{field.kind==='dropdown'&&<ChevronDown size={13}/>}
    {selectedId===field.id&&design&&!field.existing&&<span className="form-resize-handle" onPointerDown={e=>{e.stopPropagation();start(e,field.id,index,true);}}/>}
   </button>;
  }))}
  {draft&&drag.current?.mode==='draw'&&<div className="form-draw-rect" style={{left:`${draft.x*100}%`,top:`${draft.y*100}%`,width:`${draft.w*100}%`,height:`${draft.h*100}%`}}/>}
 </div></div>;
}
