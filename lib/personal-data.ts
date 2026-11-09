import type { EvidencePage } from './evidence-model';
import { validIban } from './invoice-create';
export function detectPersonalData(pages:EvidencePage[]){
  const found=new Map<string,{term:string;replacement:string}>(),counts=new Map<string,number>();
  const add=(value:string,kind:string)=>{const term=value.trim().replace(/[.,;:]$/,'');if(term.length<3||term.includes('=')||found.size>=500)return;const key=term.normalize('NFKC').toLocaleLowerCase('de-DE');if(found.has(key))return;const n=(counts.get(kind)||0)+1;counts.set(kind,n);found.set(key,{term,replacement:`[${kind} ${n}]`});};
  for(const page of pages)for(const line of page.lines){const s=line.text;
    for(const m of s.matchAll(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g))add(m[0],'E-Mail');
    for(const m of s.matchAll(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g))if(validIban(m[0]))add(m[0],'IBAN');
    for(const [pattern,kind] of [[/(?:Name|Ansprechpartner|Kontaktperson|Kunde|Patient)\s*:\s*([\p{L}][\p{L} .'-]{3,70})/giu,'Person'],[/(?:Telefon|Tel\.?|Mobil)\s*:?\s*([+\d][\d ()/.-]{6,24})/giu,'Telefon'],[/(?:Steuernummer|Steuer-ID|IdNr\.?|USt-IdNr\.?)\s*:?\s*([A-Z\d][\d /.-]{7,22})/giu,'Steuerangabe'],[/(?:Geburtsdatum|geboren am|Geb\.)\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/giu,'Geburtsdatum'],[/\b([\p{L} .'-]{2,55}(?:straße|strasse|str\.|weg|platz|allee)\s+\d{1,4}[a-z]?)\b/giu,'Anschrift']] as const)for(const m of s.matchAll(pattern))add(m[1],kind);
  }
  return [...found.values()].sort((a,b)=>b.term.length-a.term.length);
}
