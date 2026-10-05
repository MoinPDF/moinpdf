export type DiffLine = {kind:'same'|'added'|'removed'|'note';text:string};
export type PdfReport = {
 title:string;description:string;stats:{label:string;value:string}[];
 sections:{title:string;status?:string;details?:{label:string;value:string}[];lines?:DiffLine[]}[];
};
export function reportText(report:PdfReport) {
 const sign={same:'  ',added:'+ ',removed:'− ',note:'! '};
 return [report.title,report.description,'',...report.stats.map(s=>`${s.label}: ${s.value}`),'',...report.sections.flatMap(s=>[s.title+(s.status?` · ${s.status}`:''),...(s.details||[]).map(d=>`${d.label}: ${d.value}`),...(s.lines||[]).map(l=>sign[l.kind]+l.text),''])].join('\n');
}
// Compare lines, preserving case and ignoring whitespace within a line. Large
// pages fall back to complete removed/added blocks rather than an unbounded LCS.
export function compareLines(before:string,after:string):DiffLine[] {
 const split=(s:string)=>s.split(/\r?\n/).map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
 const a=split(before),b=split(after);
 if(a.length*b.length>1_000_000)return [...a.map(text=>({kind:'removed' as const,text})),...b.map(text=>({kind:'added' as const,text}))];
 const stride=b.length+1,dp=new Uint16Array((a.length+1)*stride);
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i*stride+j]=a[i]===b[j]?1+dp[(i+1)*stride+j+1]:Math.max(dp[(i+1)*stride+j],dp[i*stride+j+1]);
 const lines:DiffLine[]=[];let i=0,j=0;
 while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i]===b[j]){lines.push({kind:'same',text:a[i++]});j++;}
  else if(j<b.length&&(i===a.length||dp[i*stride+j+1]>dp[(i+1)*stride+j]))lines.push({kind:'added',text:b[j++]});
  else lines.push({kind:'removed',text:a[i++]});
 }
 return lines;
}
