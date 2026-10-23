import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const folder='.cache/editor-tables';await mkdir(folder,{recursive:true});
await writeFile(folder+'/editor-tables.mjs',ts.transpileModule(await readFile('lib/editor-tables.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {
  changeEditorTableModel, recognizeEditorTable, editorTableCellRect, setEditorTableRowHeight,
  insertEditorTableRow, editorTableSegments, validateEditorTable,
  validateEditorTableOriginal,
}=await import('../.cache/editor-tables/editor-tables.mjs');

let cases = 0;
function test(name, run) {
  run();
  cases++;
  console.log(`PASS ${name}`);
}
const segment = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
function path(index, segments, patch = {}) {
  return { index, segments, color: '#234567', width: 0.7, opacity: 1, fill: false,
    dash: [], lineCap: 'butt', root: true, clipped: false, transparent: false, ...patch };
}
function grid({ columns = [20, 100, 180, 260], rows = [30, 60, 90, 120], absent = [] } = {}) {
  const result = [];
  const missing = new Set(absent);
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < columns.length - 1; c++)
    if (!missing.has(`h:${r}:${c}`))
      result.push(path(result.length, [segment(columns[c], rows[r], columns[c + 1], rows[r])]));
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < columns.length; c++)
    if (!missing.has(`v:${r}:${c}`))
      result.push(path(result.length, [segment(columns[c], rows[r], columns[c], rows[r + 1])]));
  return result;
}
const inspect = (paths = grid(), patch = {}) => recognizeEditorTable({
  id: 'table', pageWidth: 400, pageHeight: 500, paths, ...patch,
});
const headers = grid({ absent: ['v:0:1', 'v:0:2'] });
const prototype = inspect(headers, { texts: [
  { id: 'heading', rect: { x: 25, y: 35, w: 225, h: 14 } },
  { id: 'line-1', rect: { x: 25, y: 65, w: 65, h: 8 } },
  { id: 'line-2', rect: { x: 25, y: 76, w: 65, h: 8 } },
] });

test('recognizes a complete 3-by-3 grid and bounds', () => {
  const table = inspect();
  assert.equal(table.cells.length, 9);
  assert.deepEqual(table.columns, [20, 100, 180, 260]);
  assert.deepEqual(table.original.rect, { x: 20, y: 30, w: 240, h: 90 });
});
test('recognizes rectangular merged heading and multi-line cells', () => {
  assert.equal(prototype.cells.length, 7);
  assert.equal(prototype.cells[0].columnSpan, 3);
  assert.deepEqual(prototype.cells[0].textIds, ['heading']);
  assert.deepEqual(prototype.cells.find((c) => c.row === 1 && c.column === 0).textIds,
    ['line-1', 'line-2']);
});
test('supports polyline paths without losing original path identity', () => {
  const paths = grid();
  const table = inspect([path(93, paths.map((p) => p.segments[0]))]);
  assert.equal(table.original.paths.length, 1);
  assert.equal(table.original.paths[0].index, 93);
  assert.equal(editorTableSegments(table).length, 8);
});
test('retains deeply immutable original paths across repeated row operations', () => {
  let table = setEditorTableRowHeight(prototype, 0, 45);
  table = insertEditorTableRow(table, 2, 22);
  table = setEditorTableRowHeight(table, 1, 48);
  table = insertEditorTableRow(table, 0, 16);
  assert.equal(table.original, prototype.original);
  assert.deepEqual(table.original.paths, headers);
  assert(Object.isFrozen(table.original.paths[0].segments[0]));
  assert.throws(() => { table.original.paths[0].segments[0].x1 = 77; }, TypeError);
  assert.equal(prototype.rows[1], 60);
  assert.equal(table.cells.filter((c) => c.textIds.includes('heading')).length, 1);
  const heading = table.cells.find((c) => c.textIds.includes('heading'));
  assert.equal(heading.row, 1);
  assert.equal(editorTableCellRect(table, heading).h, 45);
  assert.equal(new Set(table.cells.map((c) => c.id)).size, table.cells.length);
});
test('table segments round-trip both merged topology and changed heights', () => {
  const updated = insertEditorTableRow(setEditorTableRowHeight(prototype, 0, 45), 2, 22);
  const segments = editorTableSegments(updated);
  const roundtrip = inspect(segments.map((s, i) => path(i, [s])));
  const topology = (table) => table.cells.map(({ row, column, rowSpan, columnSpan }) =>
    [row, column, rowSpan, columnSpan]);
  assert.deepEqual(roundtrip.rows, updated.rows);
  assert.deepEqual(topology(roundtrip), topology(updated));
  assert(!segments.some((s) => s.x1 === 100 && s.x2 === 100 && s.y1 === 30));
});
test('new rows are empty, preserve old text exactly once, and accept start/end insertion', () => {
  const initial = prototype.cells.flatMap((c) => c.textIds).sort();
  let table = insertEditorTableRow(prototype, 0, 15);
  table = insertEditorTableRow(table, table.rows.length - 1, 15);
  assert.deepEqual(table.cells.flatMap((c) => c.textIds).sort(), initial);
  assert(table.cells.filter((c) => c.row === 0).every((c) => c.textIds.length === 0));
  assert.equal(table.rows.at(-1), 150);
});
test('accepts repeated height edits and archive round-trip with native revalidation', () => {
  const restored = JSON.parse(JSON.stringify(setEditorTableRowHeight(prototype, 1, 42)));
  validateEditorTable(restored);
  validateEditorTableOriginal(restored, headers);
  const next = setEditorTableRowHeight(restored, 1, 37);
  assert.deepEqual(next.original, restored.original);
  assert(Object.isFrozen(next.original.paths[0].segments[0]));
  assert.equal(next.rows[2] - next.rows[1], 37);
});
test('rejects row insertion through a vertical merge', () => {
  const table = inspect(grid({ absent: ['h:1:0'] }));
  assert.equal(table.cells[0].rowSpan, 2);
  assert.throws(() => insertEditorTableRow(table, 1, 20), /vertically merged/);
  assert.doesNotThrow(() => insertEditorTableRow(table, 2, 20));
});
test('merged-cell height validation uses the whole row span', () => {
  const table = inspect(grid({ absent: ['h:1:0'] }));
  const id = table.cells[0].id;
  const grown = setEditorTableRowHeight(table, 0, 45, { requiredHeights: { [id]: 70 } });
  assert.equal(editorTableCellRect(grown, grown.cells[0]).h, 75);
  assert.throws(() => setEditorTableRowHeight(table, 0, 15,
    { requiredHeights: { [id]: 50 } }), /does not fit/);
});
test('rejects nonrectangular merges and stray internal dividers', () => {
  assert.throws(() => inspect(grid({ absent: ['v:0:1', 'h:1:0'] })), /rectangular/);
  assert.throws(() => inspect(grid({ absent: ['v:0:1', 'h:1:0', 'v:1:1'] })), /internal divider/);
});
test('rejects partial borders and duplicate overlapping edges', () => {
  assert.throws(() => inspect(grid().slice(1)), /incomplete outer border/);
  assert.throws(() => inspect([...grid(), path(500, [segment(20, 30, 100, 30)])]), /overlapping/);
  const gap = grid();
  gap[0] = path(0, [segment(20, 30, 98, 30)]);
  assert.throws(() => inspect(gap), /narrow|incomplete/);
});
test('rejects all unsupported native path styles without changing input', () => {
  for (const patch of [{ width: 5 }, { width: 0 }, { opacity: 0.9 }, { fill: true },
    { dash: [2, 2] }, { lineCap: 'round' }, { root: false }, { clipped: true },
    { transparent: true }, { color: 'red' }, { clipped: undefined }, { fill: undefined }]) {
    const candidate = grid();
    candidate[0] = { ...candidate[0], ...patch };
    const before = JSON.stringify(candidate);
    assert.throws(() => inspect(candidate), /Unsupported/);
    assert.equal(JSON.stringify(candidate), before);
  }
});
test('rejects mixed stroke styles, diagonal paths, non-finite coordinates and duplicate IDs', () => {
  const differentlyColored = grid();
  differentlyColored[0] = { ...differentlyColored[0], color: '#f00000' };
  assert.throws(() => inspect(differentlyColored), /Mixed/);
  assert.throws(() => inspect([...grid(), path(501, [segment(40, 40, 80, 80)])]), /axis-aligned/);
  assert.throws(() => inspect([...grid(), path(501, [segment(NaN, 40, 80, 40)])]), /Non-finite/);
  assert.throws(() => inspect([...grid(), path(0, [segment(20, 130, 260, 130)])]), /Duplicate/);
});
test('rejects crossing or unsupported table text and duplicate text IDs', () => {
  const crossing = { id: 'crossing', rect: { x: 90, y: 65, w: 30, h: 10 } };
  assert.throws(() => inspect(grid(), { texts: [crossing] }), /crosses/);
  const inside = { id: 'inside', rect: { x: 25, y: 35, w: 40, h: 10 } };
  assert.throws(() => inspect(grid(), { texts: [{ ...inside, rotation: 90 }] }), /rotated/);
  assert.throws(() => inspect(grid(), { texts: [{ ...inside, rotation: NaN }] }), /rotated/);
  assert.throws(() => inspect(grid(), { texts: [{ ...inside, unsupportedReason: 'clip' }] }), /Unsupported/);
  assert.throws(() => inspect(grid(), { texts: [inside, inside] }), /duplicate text/);
});
test('rejects touching cell borders and accepts separate outside content', () => {
  assert.throws(() => inspect(grid(), { texts: [
    { id: 'border', rect: { x: 20.1, y: 35, w: 40, h: 10 } },
  ] }), /border/);
  assert.doesNotThrow(() => inspect(grid(), { texts: [
    { id: 'footer', rect: { x: 30, y: 400, w: 200, h: 10 } },
  ] }));
});
test('rejects obstacles, page overflow and row heights too small for layout', () => {
  const footer = { x: 20, y: 160, w: 240, h: 20 };
  assert.throws(() => inspect(grid(), { obstacles: [{ x: 50, y: 50, w: 5, h: 5 }] }), /collides/);
  assert.throws(() => setEditorTableRowHeight(prototype, 0, 80, { obstacles: [footer] }), /collides/);
  assert.throws(() => setEditorTableRowHeight(prototype, 0, 450), /outside/);
  assert.throws(() => setEditorTableRowHeight(prototype, 1, 12,
    { requiredHeights: { [prototype.cells[1].id]: 25 } }), /does not fit/);
  assert.throws(() => insertEditorTableRow(prototype, 1, 2), /Invalid/);
});
test('rejects excessive grids and narrow tracks', () => {
  assert.throws(() => inspect(grid({ columns: [20, 22, 180], rows: [30, 60, 90] })), /axis-aligned|narrow/);
  assert.throws(() => inspect(grid({ rows: Array.from({ length: 102 }, (_, i) => 30 + i * 4) })), /bounded grid/);
});
test('native revalidation rejects changed, missing, reordered or duplicate original references', () => {
  const moved = structuredClone(headers);
  moved[0].segments[0].x1 += 0.1;
  assert.throws(() => validateEditorTableOriginal(prototype, moved), /no longer matches/);
  assert.throws(() => validateEditorTableOriginal(prototype, headers.slice(1)), /no longer exists/);
  const colored = structuredClone(headers);
  colored[0].color = '#eeeeee';
  assert.throws(() => validateEditorTableOriginal(prototype, colored), /no longer matches/);
  assert.throws(() => validateEditorTableOriginal(prototype, [...headers, headers[0]]), /Ambiguous/);
});
test('imported model validation rejects overlapping cells and duplicate text ownership', () => {
  const bad = JSON.parse(JSON.stringify(prototype));
  bad.cells[1].row = 0;
  assert.throws(() => validateEditorTable(bad), /overlap/);
  const duplicatedText = JSON.parse(JSON.stringify(prototype));
  duplicatedText.cells[2].textIds.push('heading');
  assert.throws(() => validateEditorTable(duplicatedText), /multiple cells/);
});
test('native revalidation rejects manufactured provenance and moved table origins', () => {
  const badBounds = JSON.parse(JSON.stringify(prototype));
  badBounds.original.rect.h += 5;
  assert.throws(() => validateEditorTableOriginal(badBounds, headers), /provenance/);
  const badColumns = JSON.parse(JSON.stringify(prototype));
  badColumns.columns[0] += 10;
  assert.throws(() => validateEditorTableOriginal(badColumns, headers), /provenance/);
  const notAGrid = JSON.parse(JSON.stringify(prototype));
  notAGrid.original.paths = [notAGrid.original.paths[0]];
  assert.throws(() => validateEditorTableOriginal(notAGrid, headers), /bounded grid/);
});
test('mutators reject invalid indices, nonfinite sizes and invalid requirement values', () => {
  for (const row of [-1, 3, 1.5, NaN])
    assert.throws(() => setEditorTableRowHeight(prototype, row, 20), /Invalid/);
  for (const size of [NaN, Infinity, -1, 3.99])
    assert.throws(() => insertEditorTableRow(prototype, 1, size), /Invalid/);
  assert.throws(() => setEditorTableRowHeight(prototype, 0, 45,
    { requiredHeights: { [prototype.cells[0].id]: NaN } }), /does not fit/);
});

console.log(`PASS ${cases} standalone table algorithm checks.`);

test('column insertion, resize, row/column deletion, merge and split preserve explicit ownership', () => {
 let t=inspect(grid(),{texts:[{id:'a',rect:{x:25,y:35,w:30,h:10}},{id:'b',rect:{x:105,y:35,w:30,h:10}}]});
 const original=t.original;
 t=changeEditorTableModel(t,{kind:'width',column:1,width:90});
 assert.equal(t.columns[2]-t.columns[1],90);validateEditorTableOriginal(t,original.paths);
 t=changeEditorTableModel(t,{kind:'insert-column',column:3,width:30});assert.equal(t.columns.length,5);
 t=changeEditorTableModel(t,{kind:'merge',row:0,column:0,rowEnd:0,columnEnd:1});
 assert.deepEqual(t.cells[0].textIds,['a','b']);assert.equal(t.cells[0].columnSpan,2);
 t=changeEditorTableModel(t,{kind:'split',cellId:t.cells[0].id});assert.deepEqual(t.cells[0].textIds,['a','b']);
 t=changeEditorTableModel(t,{kind:'delete-row',row:0});assert.deepEqual(t.removedTextIds,['a','b']);
 t=changeEditorTableModel(t,{kind:'delete-column',column:0});assert.equal(t.columns.length,4);
 assert.equal(t.original,original);validateEditorTable(t);validateEditorTableOriginal(t,original.paths);
 assert.throws(()=>changeEditorTableModel(t,{kind:'merge',row:0,column:0,rowEnd:100,columnEnd:1}));
 assert.throws(()=>changeEditorTableModel(t,{kind:'width',column:0,width:400}),/outside/);
 const forged=structuredClone(t);forged.cells[0].textIds=['a'];assert.throws(()=>validateEditorTable(forged),/Duplicate removed/);
});
