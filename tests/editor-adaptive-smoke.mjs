// Synthetic CFF fixture and generator: CC0-1.0; no third-party font data.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import ts from 'typescript';
import fontkit from '@pdf-lib/fontkit';
import {PDFDocument} from 'pdf-lib';
const root='.cache/editor-adaptive'; await mkdir(root,{recursive:true});
const require=createRequire(import.meta.url), pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'));
const {createCanvas,DOMMatrix,Path2D,ImageData,GlobalFonts}=pdfRequire('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
const code=ts.transpileModule(await readFile('lib/editor-font-outline.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
await writeFile(root+'/editor-font-outline.mjs',code);
const {normalizeEditorOutline,readOutlineTables,writeOutlineSfnt,outlineChecksum}=await import('../.cache/editor-adaptive/editor-font-outline.mjs');
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const concat = arrays => Uint8Array.from(arrays.flatMap(x => [...x]));
const be16 = n => [n >> 8 & 255, n & 255];
const be32 = n => [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255];
const number = n => n >= -107 && n <= 107 ? [n + 139] : n >= 108 && n <= 1131 ? [247 + (n - 108 >> 8), n - 108 & 255] : n <= -108 && n >= -1131 ? [251 + (-n - 108 >> 8), -n - 108 & 255] : [28, ...be16(n)];
const dictLong = n => [29, ...be32(n)];
function index(items) {
  if (!items.length) return [0, 0];
  const positions = [1]; for (const item of items) positions.push(positions.at(-1) + item.length);
  return [...be16(items.length), 2, ...positions.flatMap(be16), ...items.flat()];
}
const op = (args, operator) => [...args.flatMap(number), operator];
function fixture() {
  const nameIndex = index([[...Buffer.from('MoinSyntheticCFF')]]), strings = [0, 0], globals = [0, 0];
  const charset = [0, ...be16(1), ...be16(34), ...be16(35)];
  const chars = index([[14], [...number(500), 14], [...op([600, 50, 0], 21), ...op([250, 700, 250, -700, -150, 0, -100, 300, -100, -300, -150, 0], 5), 14], [...op([600, 50, 0], 21), ...op([-50, 700, 550, 0, 0, -700, 0, -200, -500, 0, 0, 200], 8), 14]]);
  const top = (charOffset, charsetOffset) => [...dictLong(charOffset), 17, ...dictLong(charsetOffset), 15, 139, 139, 18, ...op([0, -200, 600, 750], 5)];
  const prefixLength = 4 + nameIndex.length + index([top(0, 0)]).length + strings.length + globals.length;
  const cff = Uint8Array.from([1, 0, 4, 4, ...nameIndex, ...index([top(prefixLength + charset.length, prefixLength)]), ...strings, ...globals, ...charset, ...chars]);
  const head = new Uint8Array(54), h = view(head); h.setUint32(0, 0x10000); h.setUint32(4, 0x10000); h.setUint32(12, 0x5f0f3cf5); h.setUint16(16, 3); h.setUint16(18, 1000); h.setInt16(38, -200); h.setInt16(40, 600); h.setInt16(42, 750); h.setUint16(46, 8); h.setInt16(48, 2);
  const hhea = new Uint8Array(36), hh = view(hhea); hh.setUint32(0, 0x10000); hh.setInt16(4, 800); hh.setInt16(6, -200); hh.setUint16(10, 600); hh.setInt16(16, 600); hh.setInt16(18, 1); hh.setUint16(34, 4);
  const maxp = Uint8Array.from([...be32(0x5000), ...be16(4)]), hmtx = Uint8Array.from([600, 500, 600, 600].flatMap(n => [...be16(n), 0, 0]));
  const cmap = new Uint8Array(64), cm = view(cmap); cm.setUint16(2, 1); cm.setUint16(4, 3); cm.setUint16(6, 10); cm.setUint32(8, 12); cm.setUint16(12, 12); cm.setUint32(16, 52); cm.setUint32(24, 3); [[32, 1], [65, 2], [937, 3]].forEach(([ch, gid], i) => { const p = 28 + i * 12; cm.setUint32(p, ch); cm.setUint32(p + 4, ch); cm.setUint32(p + 8, gid); });
  const os2 = new Uint8Array(78), os = view(os2); os.setInt16(2, 600); os.setUint16(4, 400); os.setUint16(6, 5); os2.set(Buffer.from('MOIN'), 58); os.setUint16(62, 64); os.setUint16(64, 32); os.setUint16(66, 937); os.setInt16(68, 800); os.setInt16(70, -200); os.setUint16(74, 800); os.setUint16(76, 200);
  const nameEntries = [[1, 'Moin Synthetic CFF'], [2, 'Regular'], [4, 'Moin Synthetic CFF Regular'], [6, 'MoinSyntheticCFF']];
  let storage = []; const records = nameEntries.flatMap(([id, str]) => { const data = [...str].flatMap(c => be16(c.charCodeAt(0))); const record = [...be16(3), ...be16(1), ...be16(0x409), ...be16(id), ...be16(data.length), ...be16(storage.length)]; storage.push(...data); return record; });
  const name = Uint8Array.from([0, 0, ...be16(nameEntries.length), ...be16(6 + nameEntries.length * 12), ...records, ...storage]);
  const post = new Uint8Array(32), pv = view(post); pv.setUint32(0, 0x30000); pv.setInt16(8, -100); pv.setInt16(10, 50);
  return writeOutlineSfnt([{tag:'CFF ',data:cff},{tag:'head',data:head},{tag:'hhea',data:hhea},{tag:'maxp',data:maxp},{tag:'hmtx',data:hmtx},{tag:'cmap',data:cmap},{tag:'OS/2',data:os2},{tag:'name',data:name},{tag:'post',data:post}], 0x4f54544f);
}
function raster(fontBytes, family, text, size = 140) {
  assert(GlobalFonts.register(fontBytes, family), `Native parser accepts ${family}`);
  const scale = size / 140, canvas = createCanvas(1600 * scale, 240 * scale), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000'; ctx.font = `${size}px "${family}"`; ctx.fontKerning = 'none'; ctx.fillText(text, 20 * scale, 180 * scale);
  return canvas;
}
function difference(a, b) {
  const x = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, y = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
  let ink = 0, changed = 0; for (let i = 0; i < x.length; i += 4) { const aa = x[i] < 180, bb = y[i] < 180; ink += aa; changed += aa !== bb; }
  return changed / Math.max(1, ink);
}
function exactBounds(commands) {
  let current = [0,0], bounds = [Infinity,Infinity,-Infinity,-Infinity];
  const include = p => { bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);bounds[3]=Math.max(bounds[3],p[1]); };
  for (const {command,args} of commands) {
    if(command==='closePath')continue;
    const end=args.slice(-2);include(end);
    if(command==='bezierCurveTo'||command==='quadraticCurveTo') {
      const points=[current,...Array.from({length:args.length/2},(_,i)=>args.slice(i*2,i*2+2))];
      const evalPoint=t=>points[0].map((_,axis)=>points.length===3?(1-t)**2*points[0][axis]+2*(1-t)*t*points[1][axis]+t*t*points[2][axis]:(1-t)**3*points[0][axis]+3*(1-t)**2*t*points[1][axis]+3*(1-t)*t*t*points[2][axis]+t**3*points[3][axis]);
      for(let axis=0;axis<2;axis++){
        const p=points.map(p=>p[axis]);let roots=[];
        if(p.length===3){const denominator=p[0]-2*p[1]+p[2];if(Math.abs(denominator)>1e-10)roots=[(p[0]-p[1])/denominator];}
        else { const a=-p[0]+3*p[1]-3*p[2]+p[3],b=2*(p[0]-2*p[1]+p[2]),c=p[1]-p[0];if(Math.abs(a)<1e-10){if(Math.abs(b)>1e-10)roots=[-c/b];}else {const discriminant=b*b-4*a*c;if(discriminant>=0)roots=[(-b+Math.sqrt(discriminant))/(2*a),(-b-Math.sqrt(discriminant))/(2*a)];}}
        for(const t of roots)if(t>0&&t<1)include(evalPoint(t));
      }
    }
    current=end;
  }
  return bounds;
}
async function validate(input, label, text) {
  const before = Buffer.from(input), output = await normalizeEditorOutline(input);
  assert.deepEqual(Buffer.from(input), before, 'Input remains immutable even for Buffer');
  assert.equal(outlineChecksum(output), 0xb1b0afba);
  const outputView=view(output); for(let i=0;i<outputView.getUint16(4);i++){const p=12+i*16,tag=Buffer.from(output.subarray(p,p+4)).toString(),start=outputView.getUint32(p+8),length=outputView.getUint32(p+12),data=Uint8Array.from(output.subarray(start,start+length));if(tag==='head')view(data).setUint32(8,0);assert.equal(outlineChecksum(data),outputView.getUint32(p+4),`${tag} table checksum`);}
  const sourceTables = new Map(readOutlineTables(input).map(t => [t.tag, t.data])), resultTables = new Map(readOutlineTables(output).map(t => [t.tag, t.data]));
  for (const tag of ['cmap', 'GSUB', 'GPOS', 'GDEF', 'name', 'OS/2']) if (sourceTables.has(tag)) assert.deepEqual(resultTables.get(tag), sourceTables.get(tag), `${tag} preserved`);
  assert(!resultTables.has('CFF ')); assert(resultTables.has('glyf')); assert(resultTables.has('loca')); assert.equal(view(resultTables.get('maxp')).getUint32(0), 0x10000);
  const original = fontkit.create(input), converted = fontkit.create(output); assert.equal(original.numGlyphs, converted.numGlyphs); assert.deepEqual(original.characterSet, converted.characterSet);
  // Source parser 1.1.1 has the same valid-empty-Private bug; native rasterizer below reads original bytes untouched.
  const sourceCff = original['CFF ']; for (const dict of sourceCff.topDict.FDArray || [sourceCff.topDict]) if (dict.Private == null && dict.length === 0) dict.Private = {Subrs:[],nominalWidthX:0,defaultWidthX:0};
  for (const cp of original.characterSet) { assert.equal(original.glyphForCodePoint(cp).id, converted.glyphForCodePoint(cp).id); assert.equal(original.glyphForCodePoint(cp).advanceWidth, converted.glyphForCodePoint(cp).advanceWidth); }
  let maximumBoundDifference = 0;
  for (let gid = 0; gid < converted.numGlyphs; gid++) { const glyph = converted.getGlyph(gid), source = original.getGlyph(gid); assert(glyph.path.commands.every(c => c.command !== 'bezierCurveTo')); if (source.path.commands.length) {const a=exactBounds(source.path.commands),b=exactBounds(glyph.path.commands);for(let axis=0;axis<4;axis++) maximumBoundDifference = Math.max(maximumBoundDifference, Math.abs(a[axis]-b[axis]));} }
  assert(maximumBoundDifference <= 1, `True outline bounds preserved within one design unit: ${maximumBoundDifference}`);
  const a = raster(input, `${label}Original`, text), b = raster(output, `${label}Converted`, text), ratio = difference(a, b);
  if (ratio >= .05) { await writeFile(join(root, `${label}-original.png`), a.toBuffer('image/png')); await writeFile(join(root, `${label}-converted.png`), b.toBuffer('image/png')); }
  // Inspect grid-fitting differences at ordinary display size separately. At
  // high resolution the strict native comparison measures actual shape drift.
  const highRatio = difference(raster(input, `${label}OriginalHigh`, text, 560), raster(output, `${label}ConvertedHigh`, text, 560));
  assert(highRatio < 0.025, `${label} high-resolution raster discrepancy ${(100 * highRatio).toFixed(2)}%`);
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit); const font = await pdf.embedFont(output, {subset:true, features:{liga:false,kern:false,clig:false}}); pdf.addPage([600,150]).drawText(text,{font,size:20,x:20,y:70});
  const document = await pdfjs.getDocument({data:await pdf.save(), fontExtraProperties:true}).promise;
  try { const content = await (await document.getPage(1)).getTextContent(); assert.equal(content.items.filter(x=>'str'in x).map(x=>x.str).join(''), text); } finally { await document.loadingTask.destroy(); }
  console.log(JSON.stringify({label,inputBytes:input.length,outputBytes:output.length,glyphs:converted.numGlyphs,rasterDifferencePct140px:+(ratio*100).toFixed(3),rasterDifferencePct560px:+(highRatio*100).toFixed(3),maxGlyphBoundDifference:+maximumBoundDifference.toFixed(4),pdfUnicodeRoundtrip:true}));
  return output;
}
const synthetic = fixture(); await writeFile(join(root, 'synthetic-cff.otf'), synthetic);
await validate(Buffer.concat([Buffer.alloc(7), Buffer.from(synthetic), Buffer.alloc(11)]).subarray(7, 7 + synthetic.length), 'Synthetic', 'A AΩ');
await assert.rejects(() => normalizeEditorOutline(new Uint8Array(8)), /Dateigröße/);
for (const tag of ['fvar','CFF2','gvar']) await assert.rejects(() => normalizeEditorOutline(writeOutlineSfnt([...readOutlineTables(synthetic),{tag,data:new Uint8Array(4)}],0x4f54544f)),/variable/);
const duplicate=Buffer.from(synthetic); duplicate.copy(duplicate,28,12,16); await assert.rejects(()=>normalizeEditorOutline(duplicate),/Tabelle/);
const corrupted=Buffer.from(synthetic); view(corrupted).setUint32(20,corrupted.length+4); await assert.rejects(()=>normalizeEditorOutline(corrupted),/Tabelle/);
const enormous = new Uint8Array(16*1024*1024+1); await assert.rejects(()=>normalizeEditorOutline(enormous),/Dateigröße/);
const tooManyGlyphs = readOutlineTables(synthetic);view(tooManyGlyphs.find(t=>t.tag==='maxp').data).setUint16(4,65535);await assert.rejects(()=>normalizeEditorOutline(writeOutlineSfnt(tooManyGlyphs,0x4f54544f)),/Schriftgröße/);


assert.deepEqual(synthetic,Uint8Array.from(await readFile('tests/fixtures/editor-static-cff.otf')),'Committed CC0 fixture matches generator');
console.log('PASS: static CFF normalization, immutable input, glyph metrics, independent raster comparison, searchable export and invalid-font guards.');

await import('./editor-image-patches-smoke.mjs');

await import('./editor-flow-smoke.mjs');

await import('./editor-tables-smoke.mjs');
