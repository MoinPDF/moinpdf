import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import JSZip from 'jszip';
await mkdir('.cache/table-layout',{recursive:true});
for(const name of ['table-layout','table-data','tool-draft-schema']){
 const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 await writeFile(`.cache/table-layout/${name}.mjs`,code);
}
const {analyseTableLayout:analyse,combineTableLayouts:combine}=await import('../.cache/table-layout/table-layout.mjs');
const {makeXlsx}=await import('../.cache/table-layout/table-data.mjs');
const {toolDraftSchema}=await import('../.cache/table-layout/tool-draft-schema.mjs');
const area={x:0,y:0,w:1,h:1};
const cell=(text,x,y,w=.12,extra={})=>({id:crypto.randomUUID(),text,x,y,w,h:.02,...extra});
const source=[cell('Kennung',.08,.1),cell('Beschreibung',.32,.1,.2),cell('Betrag',.77,.1),
 cell('001',.08,.16),cell('Fiktives Buch',.32,.16,.2),cell('12,50',.77,.16),
 cell('002',.08,.22),cell('Fiktiver Stift',.32,.22,.18),cell('-2,00',.77,.22)];
const first=analyse(source,area);
assert.equal(first.boundaries.length,2);
assert.deepEqual(first.rows,[['Kennung','Beschreibung','Betrag'],['001','Fiktives Buch','12,50'],['002','Fiktiver Stift','-2,00']]);
assert.deepEqual(first.cells[1][1].rect,{x:.32,y:.16,w:.2,h:.01999999999999999});
const second=analyse(source.map(t=>({...t,x:t.x+.035})),area);
const combined=combine([first,second],1,true);
assert.equal(combined.rows.length,5);assert.deepEqual(combined.pages,[0,0,0,1,1]);
assert.equal(combine([first,{...second,rows:[['Other','Heading','EUR'],...second.rows.slice(1)]}],1,true).rows.length,6,'Only exact repeated headers removed');
assert.throws(()=>combine([first,analyse([cell('A',.1,.1),cell('B',.7,.1),cell('C',.1,.2),cell('D',.7,.2)],area)],1,true),/Spalten/);
const wrapped=[...source,cell('zweite Zeile',.32,.185,.18)];
assert.equal(analyse(wrapped,area).rows.length,4);
const joined=analyse(wrapped,area,{joinWrapped:true});
assert.equal(joined.rows[1][1],'Fiktives Buch\nzweite Zeile');assert.equal(joined.cells[1][1].uncertain,true);
assert.equal(analyse([cell('low',.1,.1,.1,{confidence:45})],area).cells[0][0].uncertain,true);
assert.deepEqual(analyse([cell('outside',1.2,.1),cell('invalid',NaN,.1)],area).rows,[]);
const headings=analyse([cell('Gesamtübersicht',.08,.04,.8),...source],area,{headerRows:2});
assert.deepEqual(headings.merges,[{row:0,column:0,columns:3}]);
const zip=await JSZip.loadAsync(await(await makeXlsx(headings.rows,'Test',{columns:['auto','auto','auto'],headerRows:2,locale:'de',merges:headings.merges})).arrayBuffer());
const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(xml,/<mergeCell ref="A1:C1"/);assert.match(xml,/>001</);assert.match(xml,/<v>12.5<\/v>/);assert.match(xml,/<v>-2<\/v>/);
const edited=headings.rows.map(r=>[...r]);edited[0][1]='Ergänzung';
const changed=await JSZip.loadAsync(await(await makeXlsx(edited,'Test',{merges:headings.merges})).arrayBuffer());
assert(!(await changed.file('xl/worksheets/sheet1.xml').async('string')).includes('<mergeCell '),'Editing a merged blank cannot hide data');
for(const [key,value] of Object.entries({cellSources:first.cells,rowPages:[0,0,0],analysedPages:[0],merges:headings.merges}))
 assert(toolDraftSchema.safeParse({['TablePanel.'+key+':fixture']:value}).success,`Persist ${key}`);
console.log('PASS: automatic gutters, shifted pages, conservative repeated headers, multiline cells, uncertainty, source rectangles, XLSX merges and numeric values, edited merge safety, project restoration.');
