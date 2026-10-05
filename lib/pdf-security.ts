export type SecuritySettings = {password:string;ownerPassword?:string;printing:'full'|'low'|'none';copying:boolean;editing:boolean};
export class PdfPasswordError extends Error { constructor(){super('Das Passwort ist nicht korrekt. Bitte erneut versuchen.');this.name='PdfPasswordError';} }
export function checkNewPassword(password:string){
 if(password.length<8)throw new Error('Bitte ein Passwort mit mindestens 8 Zeichen verwenden.');
 if(new TextEncoder().encode(password).length>127)throw new Error('Das Passwort darf höchstens 127 UTF-8-Bytes lang sein.');
 if(/[\x00-\x1f\x7f]/.test(password))throw new Error('Das Passwort darf keine Steuerzeichen enthalten.');
}
function workerJob(bytes:Uint8Array,operation:'encrypt'|'decrypt'|'rewrite',settings:Partial<SecuritySettings>,signal?:AbortSignal):Promise<Uint8Array>{
 if(signal?.aborted)return Promise.reject(new DOMException('Abgebrochen','AbortError'));
 return new Promise((resolve,reject)=>{
  const worker=new Worker('/workers/pdf-security.js');let settled=false;
  const finish=(error?:Error,result?:Uint8Array)=>{if(settled)return;settled=true;worker.terminate();clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(result!);};
  const abort=()=>finish(new DOMException('Abgebrochen','AbortError'));
  const timer=setTimeout(()=>finish(new Error('Die Verarbeitung hat zu lange gedauert. Bitte eine kleinere PDF versuchen.')),120000);
  signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=()=>finish(new Error('Der lokale PDF-Prozessor konnte nicht gestartet werden. Bitte die Seite neu laden.'));
  worker.onmessage=({data})=>{if(data.error)finish(data.error==='password'?new PdfPasswordError():new Error('Die PDF konnte nicht verarbeitet werden. Bitte eine unbeschädigte PDF verwenden.'));else finish(undefined,new Uint8Array(data.bytes));};
  const copy=bytes.slice();worker.postMessage({operation,bytes:copy,settings},[copy.buffer]);
 });
}
export async function protectPdf(bytes:Uint8Array,settings:SecuritySettings,signal?:AbortSignal){
 checkNewPassword(settings.password);
 if(settings.ownerPassword){checkNewPassword(settings.ownerPassword);if(settings.ownerPassword===settings.password)throw new Error('Öffnungs- und Berechtigungspasswort müssen unterschiedlich sein.');}
 const ownerPassword=settings.ownerPassword||Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
 return workerJob(bytes,'encrypt',{...settings,ownerPassword},signal);
}
export function unlockPdf(bytes:Uint8Array,password:string,signal?:AbortSignal){return workerJob(bytes,'decrypt',{password},signal);}
export function rewritePdf(bytes:Uint8Array,signal?:AbortSignal){return workerJob(bytes,'rewrite',{},signal);}
