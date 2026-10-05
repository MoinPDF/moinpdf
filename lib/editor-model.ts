import {StandardFonts} from 'pdf-lib';
import type {Source,PageItem} from './pdf-engine';
import type {Mark,Rect} from './studio-engine';

export type FontFamily='sans'|'serif'|'mono';
export type EditorAction='pick'|'replace-area'|'add-text'|'erase'|'image'|'select';
export type TextTarget=Rect&{id:string;text:string;fontSize:number;family:FontFamily};
export const editorTools=['edit-text','erase','insert-image'];
export const cssFont=(family?:FontFamily)=>family==='serif'?'Times New Roman':family==='mono'?'Courier New':'Arial';
export const hexColor=(value:string|undefined,fallback:string)=>/^#[0-9a-f]{6}$/i.test(value||'')?value!:fallback;
export function fontName(mark:Pick<Mark,'fontFamily'|'bold'|'italic'>){
 const index=(mark.bold?1:0)+(mark.italic?2:0);
 return (mark.fontFamily==='serif'?[StandardFonts.TimesRoman,StandardFonts.TimesRomanBold,StandardFonts.TimesRomanItalic,StandardFonts.TimesRomanBoldItalic]:mark.fontFamily==='mono'?[StandardFonts.Courier,StandardFonts.CourierBold,StandardFonts.CourierOblique,StandardFonts.CourierBoldOblique]:[StandardFonts.Helvetica,StandardFonts.HelveticaBold,StandardFonts.HelveticaOblique,StandardFonts.HelveticaBoldOblique])[index];
}
export function wrapEditorText(text:string,width:number,measure:(s:string)=>number){
 const lines:string[]=[];
 for(const paragraph of text.replace(/\t/g,'    ').split(/\r?\n/)){
  let line='';for(const word of paragraph.split(' ')){
   const candidate=line?line+' '+word:word;
   if(measure(candidate)<=width){line=candidate;continue;}
   if(line){lines.push(line);line='';}
   for(const char of word){if(line&&measure(line+char)>width){lines.push(line);line='';}line+=char;}
  }lines.push(line);
 }return lines;
}
export function fitRect(rect:Rect):Rect{
 const x=Math.max(0,Math.min(.99,rect.x)),y=Math.max(0,Math.min(.99,rect.y));
 return{x,y,w:Math.max(.01,Math.min(1-x,rect.w)),h:Math.max(.01,Math.min(1-y,rect.h))};
}
export async function readTextTargets(source:Source,item:PageItem):Promise<{targets:TextTarget[];width:number;height:number}>{
 const page=await source.pdf.getPage(item.index+1),viewport=page.getViewport({scale:1,rotation:(page.rotate+item.rotation)%360}),content=await page.getTextContent(),v=viewport.transform;
 const targets:TextTarget[]=[];
 for(const [i,part] of content.items.entries()){
  if(!('str'in part)||!part.str.trim())continue;
  const t=part.transform,dx=v[0]*t[0]+v[2]*t[1],dy=v[1]*t[0]+v[3]*t[1];
  // Upright text only. Rotated or vertical glyphs can be edited with a manual area.
  if(dx<=0||Math.abs(Math.atan2(dy,dx))>.04)continue;
  const fontSize=Math.hypot(v[2]*t[3]+v[0]*t[2],v[3]*t[3]+v[1]*t[2]);if(!fontSize)continue;
  const style=content.styles[part.fontName],ascent=style?.ascent??.85,descent=Math.abs(style?.descent??-.2),pad=Math.max(.8,fontSize*.08);
  const px=v[0]*t[4]+v[2]*t[5]+v[4],baseline=v[1]*t[4]+v[3]*t[5]+v[5];
  const left=Math.max(0,px-pad),top=Math.max(0,baseline-fontSize*ascent-pad),right=Math.min(viewport.width,px+part.width+pad),bottom=Math.min(viewport.height,baseline+fontSize*descent+pad);
  if(right<=left||bottom<=top)continue;
  targets.push({id:`text-${i}`,text:part.str,x:left/viewport.width,y:top/viewport.height,w:(right-left)/viewport.width,h:(bottom-top)/viewport.height,fontSize,family:style?.fontFamily?.includes('monospace')?'mono':style?.fontFamily==='serif'?'serif':'sans'});
 }return{targets,width:viewport.width,height:viewport.height};
}
