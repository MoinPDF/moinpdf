import type {EvidencePage,EvidenceRef} from './evidence-model';
import type {Rect} from './studio-engine';

export type ChronologyItem={sourceId:string;title:string;date:string;included:boolean;confirmed:boolean;candidates:{date:string;ref:EvidenceRef}[]};
export function validDate(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
  return y>=1000&&y<=9999&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export function dateCandidates(pages:EvidencePage[]) {
  const found:{date:string;ref:EvidenceRef}[]=[];
  for(const page of pages)for(const line of page.lines)for(const match of line.text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) {
    const date=match[1]?`${match[1]}-${match[2]}-${match[3]}`:`${match[6]}-${match[5].padStart(2,'0')}-${match[4].padStart(2,'0')}`;
    if(validDate(date)&&!found.some(f=>f.date===date&&f.ref.page===line.page))found.push({date,ref:line});
  }
  return found;
}
export function sortChronology(items:ChronologyItem[],descending=false) {
  return [...items].sort((a,b)=>!a.date&&!b.date?0:!a.date?1:!b.date?-1:(descending?-1:1)*a.date.localeCompare(b.date));
}

// Fixed six-place decimals: no floating-point rounding, and no implicit locale guesses.
const SCALE=1_000_000n;
export type NumberLocale='de'|'en';
export function decimal(value:string,locale:NumberLocale='de'):bigint {
  let clean=value.trim().replace(/(?:EUR|USD|GBP|€|\$|£)/gi,'').trim().replace(/\u2212/g,'-');
  if(/^\(.*\)$/.test(clean))clean='-'+clean.slice(1,-1).trim();
  const group=locale==='de'?'.':',',point=locale==='de'?',':'.';
  const [integer,...fraction]=clean.split(point);
  if(fraction.length>1||fraction[0]!==undefined&&!/^\d{1,6}$/.test(fraction[0]))throw new Error('Zahl mit höchstens sechs Nachkommastellen eingeben.');
  const signed=integer.replace(/^[+-]/,''),groupPattern=locale==='de'?/^\d{1,3}(?:\.\d{3})+$/:/^\d{1,3}(?:,\d{3})+$/;
  if(!/^\d+$/.test(signed)&&!groupPattern.test(signed)&&!/^\d{1,3}(?:[\u00a0\u202f]\d{3})+$/.test(signed))throw new Error('Zahlenformat prüfen; Tausender- und Dezimalzeichen müssen zur gewählten Sprache passen.');
  const digits=signed.split(group).join('').replace(/[\u00a0\u202f]/g,'');
  if(digits.length>15)throw new Error('Zahlen mit höchstens 15 Vorkommastellen verwenden.');
  return (integer.startsWith('-')?-1n:1n)*(BigInt(digits)*SCALE+BigInt((fraction[0]||'').padEnd(6,'0')));
}
export function decimalText(value:bigint,locale:NumberLocale='de') {
  const abs=value<0n?-value:value,frac=String(abs%SCALE).padStart(6,'0').replace(/0+$/,'').padEnd(2,'0');
  return `${value<0n?'-':''}${abs/SCALE}${locale==='de'?',':'.'}${frac}`;
}
export type ArithmeticRow={id:string;original:string;value:string;included:boolean;ref:EvidenceRef};
export function arithmeticCandidates(page:EvidencePage,area:Rect):ArithmeticRow[] {
  const rows:ArithmeticRow[]=[];
  for(const line of page.lines)for(const word of line.words) {
    // Keep ambiguous OCR glyphs together so "1O0" must be corrected, not added as 1 + 0.
    for(const match of word.text.matchAll(/(?<![\p{L}\d])\(?[+\-−]?[0-9OoIl]+(?:[.,\u00a0\u202f][0-9OoIl]+)*\)?(?:\s*(?:EUR|USD|GBP|€|\$|£|%))?(?![\p{L}\d.,])/gu)) {
      if(!/\d/.test(match[0]))continue;
      const text=match[0],rect={...word,x:word.x+word.w*(match.index||0)/word.text.length,w:word.w*text.length/word.text.length};
      if(rect.x+rect.w/2<area.x||rect.x+rect.w/2>area.x+area.w||rect.y+rect.h/2<area.y||rect.y+rect.h/2>area.y+area.h)continue;
      rows.push({id:`${word.id}-${match.index}`,original:text,value:text,included:true,ref:{sourceId:page.sourceId,name:page.name,page:page.page,mode:page.mode,text:word.text,rects:[rect]}});
    }
  }
  if(rows.length>1000)throw new Error('Bitte einen kleineren Bereich mit höchstens 1.000 Zahlen auswählen.');
  return rows;
}
export function arithmeticResult(rows:ArithmeticRow[],total:string,locale:NumberLocale) {
  const selected=rows.filter(r=>r.included);if(!selected.length)throw new Error('Mindestens einen Summanden auswählen.');
  const sum=selected.reduce((v,r)=>v+decimal(r.value,locale),0n),expected=decimal(total,locale);
  return {sum,expected,difference:sum-expected,count:selected.length};
}

export type Point={x:number;y:number};
export type Calibration={points:[Point,Point];length:number;unit:'mm'|'cm'|'m'};
export type Measurement={id:string;page:number;kind:'length'|'area';points:Point[];label:string};
const units={mm:.001,cm:.01,m:1};
export const pointDistance=(a:Point,b:Point,width:number,height:number)=>Math.hypot((a.x-b.x)*width,(a.y-b.y)*height);
export function metersPerPoint(calibration:Calibration,width:number,height:number) {
  const distance=pointDistance(...calibration.points,width,height);
  if(!Number.isFinite(calibration.length)||calibration.length<=0||!Number.isFinite(distance)||distance<.01)throw new Error('Zwei verschiedene Referenzpunkte und eine positive Referenzlänge angeben.');
  return calibration.length*units[calibration.unit]/distance;
}
function cross(a:Point,b:Point,c:Point){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function intersects(a:Point,b:Point,c:Point,d:Point) {
  const e=1e-10,between=(a:Point,b:Point,p:Point)=>p.x>=Math.min(a.x,b.x)-e&&p.x<=Math.max(a.x,b.x)+e&&p.y>=Math.min(a.y,b.y)-e&&p.y<=Math.max(a.y,b.y)+e;
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return x*y<0&&z*w<0||Math.abs(x)<e&&between(a,b,c)||Math.abs(y)<e&&between(a,b,d)||Math.abs(z)<e&&between(c,d,a)||Math.abs(w)<e&&between(c,d,b);
}
export function measurementValue(item:Measurement,calibration:Calibration,width:number,height:number) {
  const pts=item.points;if(pts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))throw new Error('Messpunkte müssen innerhalb der Seite liegen.');
  const ratio=metersPerPoint(calibration,width,height);
  if(item.kind==='length'){if(pts.length!==2)throw new Error('Eine Strecke benötigt zwei Punkte.');return pointDistance(pts[0],pts[1],width,height)*ratio;}
  if(pts.length<3||pts.length>100)throw new Error('Eine Fläche benötigt 3 bis 100 Eckpunkte.');
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)if(j!==i+1&&!(i===0&&j===pts.length-1)&&intersects(pts[i],pts[(i+1)%pts.length],pts[j],pts[(j+1)%pts.length]))throw new Error('Die Flächenbegrenzung darf sich nicht selbst kreuzen oder berühren.');
  const area=Math.abs(pts.reduce((v,p,i)=>{const q=pts[(i+1)%pts.length];return v+p.x*q.y-q.x*p.y;},0))/2*width*height*ratio*ratio;
  if(area<1e-12)throw new Error('Die Fläche ist zu klein oder ihre Punkte liegen auf einer Linie.');return area;
}
export function measurementText(value:number,kind:Measurement['kind']){return `${new Intl.NumberFormat('de-DE',{maximumSignificantDigits:6}).format(value)} ${kind==='area'?'m²':'m'}`;}

export type AudioSection={id:string;title:string;text:string;enabled:boolean};
export function audioSections(pages:EvidencePage[],mode:'document'|'pages'|'chapters',bookmarks:{title:string;page:number|null;depth:number}[]=[]) {
  const sorted=[...pages].sort((a,b)=>a.page-b.page),text=(p:EvidencePage[])=>p.map(p=>p.lines.map(l=>l.text).join('\n')).join('\n\n');
  if(mode==='document')return[{id:'document',title:pages[0]?.name.replace(/\.pdf$/i,'')||'Dokument',text:text(sorted),enabled:true}];
  if(mode==='pages')return sorted.map(p=>({id:String(p.page),title:`Seite ${p.page+1}`,text:text([p]),enabled:!!p.words.length}));
  const starts=bookmarks.filter((b):b is typeof b&{page:number}=>b.depth===0&&b.page!==null&&b.page>=0&&b.page<(sorted.at(-1)?.page??-1)+1).sort((a,b)=>a.page-b.page).filter((b,i,all)=>i===0||b.page!==all[i-1].page);
  if(!starts.length)throw new Error('Keine Lesezeichen mit Seitenzielen vorhanden. Bitte nach Seiten oder als Gesamtdokument ausgeben.');
  if(starts[0].page>0)starts.unshift({title:'Einleitung',page:0,depth:0});
  return starts.map((b,i)=>{const content=text(sorted.filter(p=>p.page>=b.page&&p.page<(starts[i+1]?.page??Infinity)));return{id:String(b.page),title:b.title,text:content,enabled:!!content.trim()};});
}
