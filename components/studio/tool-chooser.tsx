'use client';
import {useMemo,useState} from 'react';
import {FileText,Plus,X,ShieldCheck,Trash2,LoaderCircle,LayoutGrid,FileSearch,RefreshCw,Layers,PenLine,Files,Server} from 'lucide-react';
import {Command,CommandInput,CommandList,CommandItem} from '@/components/ui/command';
import {Button} from '@/components/ui/button';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {tools,groups,type WorkspaceTool} from '@/lib/tool-catalog';
import {suggestTools} from '@/lib/tool-search';
import type {Source} from '@/lib/pdf-engine';

type Props={sources:Source[];pageCount:number;locked:boolean;loading:boolean;dragOver:boolean;onChoose:(id:WorkspaceTool)=>void;onAdd:()=>void;onRemove:(id:string)=>void;onClear:()=>void};
export function ToolChooser({sources,pageCount,locked,loading,dragOver,onChoose,onAdd,onRemove,onClear}:Props){
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all');
 const categories=[{value:'all',label:'Alle',icon:LayoutGrid},{value:'0',label:'Prüfen',icon:FileSearch},{value:'1',label:'Umwandeln',icon:RefreshCw},{value:'2',label:'Seiten',icon:Layers},{value:'3',label:'Bearbeiten',icon:PenLine},{value:'4',label:'Stapel',icon:Files},{value:'5',label:'Server',icon:Server}];
 const suggestions=useMemo(()=>suggestTools(query).slice(0,5),[query]);
 return <main className="tool-chooser">
  <header className="chooser-header">
   <span className="chooser-document-count"><FileText size={17}/>{sources.length} {sources.length===1?'Datei':'Dateien'}<span>·</span>{pageCount} {pageCount===1?'Seite':'Seiten'}</span>
   <div className="chooser-file-actions"><Button variant="ghost" onClick={onAdd} disabled={locked}>{loading?<LoaderCircle size={17} className="spin"/>:<Plus size={17}/>}Dateien hinzufügen</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Arbeitsbereich leeren" disabled={locked}><Trash2 size={17}/></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Arbeitsbereich leeren?</AlertDialogTitle><AlertDialogDescription>Geöffnete Dokumente und Änderungen werden aus dieser Sitzung entfernt. Deine Originaldateien bleiben erhalten.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Behalten</AlertDialogCancel><AlertDialogAction onClick={onClear}>Leeren</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
  </header>
  <section className="chooser-content" aria-labelledby="chooser-title">
   <div className="chooser-files" aria-label="Geöffnete Dateien">{sources.map(s=><span className="chooser-file" key={s.id}><FileText size={13}/><span title={s.name}>{s.name}</span><button onClick={()=>onRemove(s.id)} disabled={locked} aria-label={`${s.name} schließen`}><X size={13}/></button></span>)}</div>
   <h1 id="chooser-title">Was möchtest du tun?</h1>
   <Command shouldFilter={false} className="intent-command" loop label="Werkzeugvorschläge">
    <div className="intent-search"><CommandInput value={query} onValueChange={setQuery} placeholder="Zum Beispiel: PDF kleiner machen …" aria-label="Was möchtest du tun?" disabled={locked}/>{query&&<button className="intent-clear" onClick={()=>setQuery('')} aria-label="Suche leeren"><X size={18}/></button>}</div>
    <CommandList className={query.trim()?'intent-results':'intent-results is-empty'}>
     {query.trim()&&<><p className="intent-results-label" role="status">{suggestions.length?'Passende Werkzeuge':'Kein passender Vorschlag'}</p>{suggestions.length?suggestions.map((tool,i)=><CommandItem key={tool.id} value={tool.id} onSelect={()=>onChoose(tool.id)} disabled={locked} className="intent-result"><span className={`intent-result-icon tone-${tool.group}`}><tool.icon size={22} strokeWidth={1.6}/></span><span><strong>{tool.title}</strong><small>{tool.description}</small></span>{i===0&&<kbd>↵</kbd>}</CommandItem>):<p className="intent-no-match">Versuche zum Beispiel „Text auslesen“, „zusammenfügen“ oder wähle unten ein Werkzeug.</p>}</>}
    </CommandList>
   </Command>
   <div className="chooser-tools-heading"><h2>Alle Werkzeuge</h2><span>{tools.length}</span></div>
   <Tabs value={category} onValueChange={setCategory} className="chooser-categories">
    <TabsList aria-label="Werkzeugkategorien" className="chooser-category-list">
     {categories.map(({value,label,icon:Icon})=><TabsTrigger key={value} value={value} className={`chooser-category-chip${value==='all'?' category-all':''}`}><Icon size={18}/><span>{label}</span><small>{value==='all'?tools.length:tools.filter(t=>t.group===Number(value)).length}</small></TabsTrigger>)}
    </TabsList>
    {categories.map(({value,label})=><TabsContent value={value} key={value}>
     {(value==='all'?groups.map((_,i)=>i):[Number(value)]).map(group=><section className="chooser-tool-section" key={group} aria-label={groups[group]}>
      <div className="chooser-section-heading"><h3>{groups[group]}</h3>{group===5&&<span><Server size={13}/>Eigener Server</span>}</div>
      <nav className="chooser-tool-grid" aria-label={`Werkzeuge: ${groups[group]}`}>{tools.filter(tool=>tool.group===group).map(tool=><button key={tool.id} disabled={locked} onClick={()=>onChoose(tool.id)} title={tool.description} className={`chooser-tool tone-${tool.group}`}><span><tool.icon size={27} strokeWidth={1.45}/></span><strong>{tool.title}</strong></button>)}</nav>
     </section>)}
    </TabsContent>)}
   </Tabs>

   <p className="chooser-local"><ShieldCheck size={14}/>Browserwerkzeuge verarbeiten deine Dokumente auf deinem Gerät.</p>
  </section>
  {dragOver&&<div className="drop-overlay"><Plus size={60} strokeWidth={1}/><strong>Dateien hinzufügen.</strong><span>Einfach hier loslassen.</span></div>}
 </main>;
}
