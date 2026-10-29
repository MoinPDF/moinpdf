import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { setup } from './optimization-test-setup.mjs';
import { englishTranslator } from './translation-test-utils.mjs';

const env = await setup('scan-photos');
const { createCanvas, source, ctx } = env;
const { detectScanPhotos, validPhoto, photoCorners } = await import('../.cache/scan-photos/scan-photo-detection.mjs');
const { exportScanRegions, cropScanPhoto, proposeScanRegions } = await import('../.cache/scan-photos/scan-split.mjs');
const canvas = createCanvas(1000,750), g = canvas.getContext('2d');
const photo = (x,y,w,h,degrees,color) => {
  g.save(); g.translate(x,y); g.rotate(degrees*Math.PI/180);
  g.fillStyle=color; g.fillRect(-w/2,-h/2,w,h);
  // Internal detail and a white hole must not become extra photos.
  if (color !== '#eeeeee') {
    g.fillStyle='#fff'; g.fillRect(-w*.13,-h*.13,w*.26,h*.26);
    g.fillStyle='#ec4545'; g.fillRect(-w/2+10,-h/2+10,25,25);
  }
  g.restore();
};
const detect = threshold => detectScanPhotos(g.getImageData(0,0,1000,750).data,1000,750,threshold);
try {
  g.fillStyle='#fff'; g.fillRect(0,0,1000,750);
  photo(250,230,300,180,25,'#346c91'); photo(550,400,300,180,25,'#377457');
  photo(820,160,150,100,-20,'#eeeeee');
  const before = g.getImageData(0,0,1000,750).data.slice();
  for(let n=0;n<80;n++){g.fillStyle='#333';g.fillRect((n*97)%1000,(n*43)%750,1,1);}
  const normal=detect(18), faint=detect(6);
  assert.equal(normal.regions.length,2,'default ignores photo below threshold, no noise/hole false positives');
  assert.equal(faint.regions.length,3,'lower threshold recovers faint photo');
  assert(faint.regions.some(r=>r.uncertain),'faint photo is explicitly uncertain');
  assert(!faint.limited);
  for(const r of faint.regions) assert(validPhoto(r));
  const blue=normal.regions.find(r=>r.x<.2), points=photoCorners(blue);
  assert(Math.abs(Math.atan2((points[1].y-points[0].y)*750,(points[1].x-points[0].x)*1000)*180/Math.PI-25)<1,'skew recovered');
  const cropped=cropScanPhoto(canvas,blue), rotated=cropScanPhoto(canvas,{...blue,rotation:90});
  assert(Math.abs(cropped.width-300)<5 && Math.abs(cropped.height-180)<5);
  assert.equal(rotated.width,cropped.height);assert.equal(rotated.height,cropped.width);
  assert(cropped.getContext('2d').getImageData(20,20,1,1).data[0]>180,'top-left red marker retained');
  assert(rotated.getContext('2d').getImageData(rotated.width-21,20,1,1).data[0]>180,'marker really rotates clockwise');
  const scan=await PDFDocument.create(),embedded=await scan.embedPng(canvas.toDataURL('image/png'));
  const page=scan.addPage([1000,750]);page.drawImage(embedded,{x:0,y:0,width:1000,height:750});
  const font=await scan.embedFont(StandardFonts.Helvetica);
  page.drawText('FICTIONAL HIDDEN SOURCE TEXT',{font,size:8,x:50,y:30,opacity:0});scan.addPage([1000,750]);
  const input=await source(await scan.save()),original=input.bytes.slice();
  const proposed=await proposeScanRegions(input,0,6,ctx.signal);assert.equal(proposed.regions.length,3);
  assert.equal((await proposeScanRegions(input,1,18,ctx.signal)).regions.length,0);
  const regions={0:[{...blue,rotation:90},normal.regions[1]],1:[]};
  for(const format of ['png','jpeg','pdf','combined-pdf']){
    const result=await exportScanRegions(input,regions,format,150,ctx);
    assert.equal(result.pages,2);
    if(format==='combined-pdf'){
      const pdf=await PDFDocument.load(await result.blob.arrayBuffer());assert.equal(pdf.getPageCount(),2);
      const size=pdf.getPage(0).getSize();assert(size.width<size.height);
      const parsed=await source(await result.blob.arrayBuffer());
      assert.equal((await(await parsed.pdf.getPage(1)).getTextContent()).items.length,0);
      assert.equal(await parsed.pdf.getAttachments(),null);
    }else{
      const zip=await JSZip.loadAsync(await result.blob.arrayBuffer()),files=Object.values(zip.files);assert.equal(files.length,2);
      for(const file of files){
        const bytes=await file.async('uint8array');
        if(format==='png')assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
        if(format==='jpeg')assert.deepEqual([...bytes.slice(0,3)],[255,216,255]);
        if(format==='pdf')assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
      }
    }
  }
  // Rectangles from saved older projects still export; invalid quadrilaterals do not.
  const legacy={x:.1,y:.1,w:.2,h:.2};assert(validPhoto(legacy));
  assert(!validPhoto({x:.5,y:.5,w:-.2,h:-.2}));
  await exportScanRegions(input,{0:[legacy]},'png',150,ctx);
  const invalid={...blue,corners:[points[0],points[2],points[1],points[3]]};assert(!validPhoto(invalid));
  for(const bad of [{0:[invalid]},{0:[{...blue,rotation:45}]},{2:[blue]},{0:Array(201).fill(blue)}])
    await assert.rejects(()=>exportScanRegions(input,bad,'png',150,ctx),/gültige Ausschnitte/);
  await assert.rejects(()=>exportScanRegions(input,regions,'png',150,{...ctx,signal:AbortSignal.abort()}),{name:'AbortError'});
  const abort=new AbortController();await assert.rejects(()=>exportScanRegions(input,regions,'png',150,{signal:abort.signal,report:()=>abort.abort()}),{name:'AbortError'});
  assert.deepEqual(input.bytes,original,'source bytes immutable after every export and cancellation');
  const en=await englishTranslator(),translated=await exportScanRegions(input,{0:[legacy]},'png',150,{...ctx,translate:en});assert.match(translated.note,/original file remains unchanged/);
  // Dark/gray scanner beds, transparent blank inputs, edge clipping and overlaps.
  g.fillStyle='#333';g.fillRect(0,0,1000,750);photo(300,300,280,170,-13,'#aabbcc');assert.equal(detect(18).regions.length,1);
  g.fillStyle='#f2f2f2';g.fillRect(0,0,1000,750);photo(300,300,280,170,0,'#d6d6d6');assert.equal(detect(18).regions.length,1);
  g.clearRect(0,0,1000,750);assert.equal(detect(18).regions.length,0);
  g.fillStyle='#fff';g.fillRect(0,0,1000,750);photo(50,300,200,180,0,'#123456');assert(detect(18).regions.every(r=>r.uncertain));
  g.fillStyle='#fff';g.fillRect(0,0,1000,750);photo(300,300,300,200,0,'#123456');photo(480,410,250,200,0,'#345678');
  const overlap=detect(18);assert.equal(overlap.regions.length,1);assert(overlap.regions[0].uncertain,'overlapping pair cannot silently claim two clean photos');
  g.fillStyle='#fff';g.fillRect(0,0,1000,750);
  for(let y=0;y<6;y++)for(let x=0;x<6;x++)photo(80+x*160,60+y*120,70,50,0,'#123456');
  assert.equal(detect(18).regions.length,32);assert(detect(18).limited,'proposal truncation is explicit');
  assert.throws(()=>detectScanPhotos(new Uint8ClampedArray(4),1,1,NaN),/Kontrastschwelle/);
  assert.throws(()=>detectScanPhotos(before,10000,750),/Vorschaubild/);
  const saved=JSON.parse(JSON.stringify(regions));assert.deepEqual(saved,regions,'geometry persists as JSON');
  const catalog=await readFile('lib/tool-catalog.ts','utf8');assert(catalog.includes("title: 'Scanfotos automatisch trennen'"));
  console.log('PASS: contours, diagonal gaps, skew/size, faint photos, dust, holes, dark/gray/transparent backgrounds, overlap warnings, limits, real PNG/JPG/PDF crops, rotation pixels, legacy drafts, validation, English notes, cancellation and unchanged source.');
} finally { await env.close(); }
