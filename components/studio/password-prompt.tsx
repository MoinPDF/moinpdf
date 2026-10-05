'use client';
import {useEffect,useState} from 'react';
import {LockKeyhole,Eye,EyeOff} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export type PasswordRequest={name:string;failed:boolean;resolve:(password:string|null)=>void};
export function PasswordPrompt({request,onClose}:{request:PasswordRequest|null;onClose:()=>void}){
 const [password,setPassword]=useState(''),[show,setShow]=useState(false);
 useEffect(()=>{setPassword('');setShow(false);},[request]);
 function finish(value:string|null){request?.resolve(value);setPassword('');onClose();}
 return <Dialog open={!!request} onOpenChange={open=>{if(!open)finish(null);}}><DialogContent className="password-prompt"><DialogHeader><div className="security-dialog-icon"><LockKeyhole size={26}/></div><DialogTitle>Diese PDF ist geschützt.</DialogTitle><DialogDescription><span className="password-filename">{request?.name}</span>Zum Bearbeiten wird eine lokale, entsperrte Arbeitskopie geöffnet. Deine Originaldatei bleibt geschützt.</DialogDescription></DialogHeader><form onSubmit={e=>{e.preventDefault();finish(password);}}><label className="field"><span>PDF-Passwort</span><div className="password-input"><Input autoFocus autoComplete="off" type={show?'text':'password'} value={password} aria-label="PDF-Passwort" onChange={e=>setPassword(e.target.value)}/><Button type="button" variant="ghost" size="icon" aria-label={show?'Passwort verbergen':'Passwort anzeigen'} onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</Button></div></label>{request?.failed&&<p className="error-box" role="alert">Das Passwort war nicht korrekt. Bitte erneut versuchen.</p>}<div className="password-actions"><Button type="button" variant="ghost" onClick={()=>finish(null)}>Datei überspringen</Button><Button type="submit">PDF öffnen</Button></div></form></DialogContent></Dialog>;
}
