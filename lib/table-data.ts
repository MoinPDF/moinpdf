import JSZip from 'jszip';
import type {Rect} from './studio-engine';
import type {TextTarget} from './editor-model';

export function parseDelimited(input:string,delimiter?:string):string[][]{
 input=input.replace(/^\uFEFF/,'');if(input.length>5_000_000)throw new Error('Die Tabelle darf höchstens 5 MB groß sein.');
 if(!delimiter){const head=input.split(/\r?\n/)[0]||'';delimiter=[';','\t',','].sort((a,b)=>head.split(b).length-head.split(a).length)[0];}
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<input.length;i++){const c=input[i];if(quoted){if(c==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}else if(c==='"'&&!cell&&!closed)quoted=true;else if(c===delimiter){row.push(cell);cell='';closed=false;}else if(c==='\r'||c==='\n'){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';closed=false;}else{if(closed&&c.trim())throw new Error('Ungültige CSV: Zeichen nach einem geschlossenen Textfeld.');cell+=c;}
  if(cell.length>10000||row.length>100||rows.length>1000)throw new Error('Maximal 1.000 Zeilen, 100 Spalten und 10.000 Zeichen pro Zelle.');
 }
 if(quoted)throw new Error('Ungültige CSV: Ein Anführungszeichen ist nicht geschlossen.');row.push(cell);if(row.some(v=>v!==''))rows.push(row);
 if(rows.length>1000||rows.some(r=>r.length>100))throw new Error('Maximal 1.000 Zeilen und 100 Spalten.');return rows;
}
export const csvText=(rows:string[][])=>'\uFEFF'+rows.map(row=>row.map(value=>'"'+(/^[\s]*[=+@-]/.test(value)?"'"+value:value).replace(/"/g,'""')+'"').join(';')).join('\r\n');
const xml=(text:string)=>text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const col=(index:number)=>{let out='';for(index++;index;index=Math.floor((index-1)/26))out=String.fromCharCode(65+(index-1)%26)+out;return out;};
export async function makeXlsx(rows:string[][]){
 const zip=new JSZip(),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
 zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.file('xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tabelle" sheetId="1" r:id="rId1"/></sheets></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
 zip.file('xl/worksheets/sheet1.xml',`<worksheet xmlns="${ns}"><sheetData>${rows.map((row,y)=>`<row r="${y+1}">${row.map((value,x)=>`<c r="${col(x)}${y+1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`);
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});
}
// Coordinates are normalized to the displayed page, including its rotation.
export function tableFromTargets(targets:TextTarget[],area:Rect,boundaries:number[]){
 const edges=[area.x,...boundaries.filter(x=>x>area.x&&x<area.x+area.w).sort((a,b)=>a-b),area.x+area.w];
 const candidates=targets.filter(t=>t.x+t.w/2>=area.x&&t.x+t.w/2<=area.x+area.w&&t.y+t.h/2>=area.y&&t.y+t.h/2<=area.y+area.h).sort((a,b)=>a.y+a.h/2-b.y-b.h/2||a.x-b.x);
 const lines:{center:number;height:number;items:TextTarget[]}[]=[];
 for(const t of candidates){const center=t.y+t.h/2;let line=lines.find(l=>Math.abs(l.center-center)<Math.max(.003,Math.min(l.height,t.h)*.45));if(!line){line={center,height:t.h,items:[]};lines.push(line);}line.items.push(t);}
 return lines.map(line=>{const row=Array.from({length:edges.length-1},()=>[] as TextTarget[]);for(const t of line.items){let at=edges.findIndex((e,i)=>i>0&&t.x+t.w/2<e)-1;if(at<0)at=row.length-1;row[at].push(t);}return row.map(cell=>cell.sort((a,b)=>a.x-b.x).map(t=>t.text).join(' '));});
}
