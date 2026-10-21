import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {PDFDocument,rgb,degrees} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
const out='.cache/editor-browser/adaptive';await mkdir(out,{recursive:true});
const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas}=pdfRequire('@napi-rs/canvas');
const bytes=await readFile('public/vendor/editor-fonts/DejaVuSans.ttf');
async function doc(){const d=await PDFDocument.create();d.registerFontkit(fontkit);return [d,await d.embedFont(bytes,{subset:false})];}
const save=(name,d)=>d.save({useObjectStreams:false}).then(b=>writeFile(out+'/'+name+'.pdf',b));
{
 const [d,f]=await doc(),p=d.addPage([400,500]);p.drawText('First paragraph.',{font:f,x:40,y:400,size:12});p.drawText('Following paragraph stays complete.',{font:f,x:40,y:280,size:12});p.drawText('FOOTER',{font:f,x:30,y:30,size:10});p.drawText('SIDE',{font:f,x:330,y:380,size:10});d.addPage([400,500]).drawText('UNCHANGED ORIGINAL NEXT PAGE',{font:f,x:35,y:400,size:12});await save('flow',d);
}
{
 const [d,f]=await doc(),p=d.addPage([400,500]);const line=(x1,y1,x2,y2)=>p.drawLine({start:{x:x1,y:500-y1},end:{x:x2,y:500-y2},thickness:.7,color:rgb(.1,.2,.3)});
 for(const y of [60,100,140,180])line(30,y,330,y);for(const x of [30,330])line(x,60,x,180);line(180,100,180,180);
 for(const [text,x,y] of [['MERGED HEADING',40,84],['A1',40,124],['B1',190,124],['A2',40,164],['B2',190,164],['TABLE FOOTER',30,470]])p.drawText(text,{x,y:500-y,size:12,font:f});d.addPage([400,500]).drawText('TABLE UNCHANGED PAGE',{x:30,y:440,size:12,font:f});await save('table',d);
}
{
 const [d,f]=await doc();d.addPage([500,700]).drawText('Original heading',{font:f,x:50,y:600,size:16});d.addPage([500,700]).drawText('FORM PAGE TWO',{font:f,x:50,y:600,size:12});
 const shared=d.getForm().createTextField('Shared');shared.setText('Denny');for(const p of d.getPages())shared.addToPage(p,{x:50,y:300,width:180,height:24});const checked=d.getForm().createCheckBox('Confirmed');checked.addToPage(d.getPage(1),{x:50,y:200,width:20,height:20});checked.check();await save('form',d);
}
{
 const [d,f]=await doc(),p=d.addPage([500,700]);p.setCropBox(20,20,460,660);p.drawText('SLOPED',{font:f,x:220,y:350,size:18,rotate:degrees(20)});p.drawText('KEEP FOOTER',{font:f,x:40,y:40,size:12});await save('angle',d);
}
{
 const [inner,f]=await doc(),p=inner.addPage([400,500]);p.drawText('NESTED ORIGINAL',{font:f,x:40,y:420,size:14});p.drawText('NESTED FOOTER',{font:f,x:40,y:40,size:11});const c=createCanvas(60,40),x=c.getContext('2d');x.fillStyle='#e00000';x.fillRect(0,0,30,40);x.fillStyle='#0000e0';x.fillRect(30,0,30,40);p.drawImage(await inner.embedPng(c.toBuffer('image/png')),{x:40,y:300,width:60,height:40});
 await inner.flush();const d=await PDFDocument.create(),outer=d.addPage([850,500]),embed=await d.embedPage(p);outer.drawPage(embed,{x:0,y:0});outer.drawPage(embed,{x:430,y:0});await save('nested',d);
}
{
 const [d,f]=await doc();for(let i=0;i<3;i++){const p=d.addPage([400,560]);p.drawText('Repair page '+i,{x:40,y:450,size:14});p.drawRectangle({x:40,y:60,width:100,height:40,color:rgb(.2,.4,.6)});}
 const original=await d.save({useObjectStreams:false}),damaged=Buffer.from(Buffer.from(original).toString('latin1').replace(/\/Length (\d+)/,(_,n)=>'/Length '+(Number(n)+2)),'latin1');await writeFile(out+'/repair.pdf',damaged);
}
{
 const c=createCanvas(2500,3500),x=c.getContext('2d'),g=x.createLinearGradient(0,0,2500,3500);g.addColorStop(0,'#eee6d8');g.addColorStop(1,'#fff8ec');x.fillStyle=g;x.fillRect(0,0,2500,3500);x.fillStyle='#111';x.font='96px sans-serif';x.fillText('Rechnung 2026',250,500);x.fillText('Betrag 125,50 EUR',250,1000);x.fillRect(200,520,2000,3);const d=await PDFDocument.create(),p=d.addPage([500,700]);p.drawImage(await d.embedPng(c.toBuffer('image/png')),{x:0,y:0,width:500,height:700});await save('high-scan',d);
}
{
 const d=await PDFDocument.create();d.registerFontkit({...fontkit,create(...args){const f=fontkit.create(...args),c=f['CFF '];if(c)for(const dict of c.topDict.FDArray||[c.topDict])if(dict.Private==null&&dict.length===0)dict.Private={Subrs:[],nominalWidthX:0,defaultWidthX:0};return f;}});
 const f=await d.embedFont(await readFile('tests/fixtures/editor-static-cff.otf'),{subset:false});d.addPage([400,500]).drawText('A AΩ',{font:f,x:40,y:400,size:24});await save('cff',d);
}
console.log('Prepared eight synthetic adaptive-browser PDF fixtures.');
