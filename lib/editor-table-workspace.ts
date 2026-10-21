import { PDFName } from 'pdf-lib';
import type { Source, PageItem } from './pdf-engine';
import type { Mark, Rect } from './studio-engine';
import type { NativeObject } from './native-pdf';
import { readTextTargets, editorRemovalRects, type TextTarget } from './editor-model';
import { editorTargetMark, joinEditorBlocks } from './editor-blocks';
import { prepareEditorLayout } from './editor-layout-plan';
import { loadEditorPdf, editorSinglePage } from './editor-native';
import { rejectSignedPdf } from './pdf-signature-guard';
import {
  recognizeEditorTable,
  validateEditorTable,
  validateEditorTableOriginal,
  editorTableCellRect,
  setEditorTableRowHeight,
  insertEditorTableRow,
  type EditorTable,
  type TablePath,
  type TableRect,
} from './editor-tables';

export const tableRect = (table: EditorTable): Rect => ({
  x: table.columns[0] / table.pageWidth,
  y: table.rows[0] / table.pageHeight,
  w: (table.columns.at(-1)! - table.columns[0]) / table.pageWidth,
  h: (table.rows.at(-1)! - table.rows[0]) / table.pageHeight,
});
const points = (r: Rect, width: number, height: number) => ({
  x: r.x * width,
  y: r.y * height,
  w: r.w * width,
  h: r.h * height,
});
const normalized = (r: TableRect, width: number, height: number) => ({
  x: r.x / width,
  y: r.y / height,
  w: r.w / width,
  h: r.h / height,
});
const same = (a: Rect, b: Rect) =>
  (['x', 'y', 'w', 'h'] as const).every((key) => Math.abs(a[key] - b[key]) < 0.00003);
export function editorTablePaths(
  objects: NativeObject[],
  width: number,
  height: number,
): TablePath[] {
  return objects
    .filter((o) => o.type === 'path' && o.vector && !o.path?.length)
    .map((o) => ({
      ...o.vector!,
      index: o.index,
      root: true,
      clipped: !!o.clipped,
      transparent: !!o.transparent,
      segments: o.vector!.segments.map((s) => ({
        x1: s.x1 * width,
        y1: s.y1 * height,
        x2: s.x2 * width,
        y2: s.y2 * height,
      })),
    }));
}
const texts = (targets: TextTarget[], width: number, height: number) =>
  targets.map((t) => ({
    id: t.id,
    rect: points(t, width, height),
    rotation: t.rotation,
    unsupportedReason: t.unsupportedReason || (t.origin === 'ocr' || t.invisible ? 'Scan' : ''),
  }));
function obstacles(
  table: EditorTable,
  objects: NativeObject[],
  targets: TextTarget[],
  marks: Mark[],
) {
  const ids = new Set(table.cells.flatMap((c) => c.textIds)),
    paths = new Set(table.original.paths.map((p) => p.index));
  return [
    ...objects
      .filter(
        (o) =>
          !['text', 'group'].includes(o.type) &&
          !(o.type === 'path' && !o.path?.length && paths.has(o.index)),
      )
      .map((o) => {
        const r = points(o, table.pageWidth, table.pageHeight);
        return { ...r, x: r.x - 0.5, y: r.y - 0.5, w: r.w + 1, h: r.h + 1 };
      }),
    ...targets
      .filter((t) => !ids.has(t.id))
      .map((t) => points(t, table.pageWidth, table.pageHeight)),
    ...marks
      .filter(
        (m) =>
          m.nativeTable?.id !== table.id &&
          m.tableCell?.tableId !== table.id &&
          !editorRemovalRects(m).some((r) => targets.some((t) => ids.has(t.id) && same(r, t))),
      )
      .map((m) => points(m, table.pageWidth, table.pageHeight)),
  ];
}
async function context(source: Source, page: PageItem, signal: AbortSignal) {
  signal.throwIfAborted();
  const original = await loadEditorPdf(source.bytes, source, signal);
  rejectSignedPdf(original);
  const pdfPage = await source.pdf.getPage(page.index + 1);
  if (
    original.catalog.has(PDFName.of('AcroForm')) ||
    pdfPage.userUnit !== 1 ||
    (await pdfPage.getAnnotations()).length
  )
    throw new Error(
      'Rastertabellen sind auf Seiten mit Formularen, Anmerkungen oder besonderen Seiteneinheiten nicht verfügbar.',
    );
  const text = await readTextTargets(source, page),
    bytes = await (await editorSinglePage(original, page)).save();
  const objects = await (await import('./native-pdf')).inspectObjectTree(bytes, 0, signal);
  if (objects.some((o) => o.clipped || o.type === 'other'))
    throw new Error('Das Tabellenraster kann auf dieser Seite nicht sicher verändert werden.');
  return { ...text, objects, paths: editorTablePaths(objects, text.width, text.height) };
}
export async function readEditorTables(
  source: Source,
  page: PageItem,
  marks: Mark[],
  signal: AbortSignal,
) {
  const state = await context(source, page, signal),
    pending = [...state.paths],
    groups: TablePath[][] = [];
  const bounds = (p: TablePath) => {
    const xs = p.segments.flatMap((s) => [s.x1, s.x2]),
      ys = p.segments.flatMap((s) => [s.y1, s.y2]);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  };
  const touching = (a: TableRect, b: TableRect) =>
    a.x <= b.x + b.w + 0.2 &&
    b.x <= a.x + a.w + 0.2 &&
    a.y <= b.y + b.h + 0.2 &&
    b.y <= a.y + a.h + 0.2;
  while (pending.length) {
    const group = [pending.shift()!];
    for (let i = 0; i < group.length; i++)
      for (let j = pending.length - 1; j >= 0; j--)
        if (touching(bounds(group[i]), bounds(pending[j]))) group.push(...pending.splice(j, 1));
    groups.push(group);
  }
  const result: EditorTable[] = [];
  for (const paths of groups)
    try {
      const table = recognizeEditorTable({
        id: `grid-${page.index}-${paths
          .map((p) => p.index)
          .sort((a, b) => a - b)
          .join('-')
          .slice(0, 90)}`,
        pageWidth: state.width,
        pageHeight: state.height,
        paths,
        texts: texts(state.targets, state.width, state.height),
      });
      validateEditorTable(table, {
        obstacles: obstacles(table, state.objects, state.targets, marks),
      });
      result.push(table);
    } catch {
      signal.throwIfAborted();
    }
  return result;
}

export async function changeEditorTable(
  source: Source,
  page: PageItem,
  marks: Mark[],
  table: EditorTable,
  operation: { kind: 'height' | 'insert'; row: number; height: number },
  signal: AbortSignal,
) {
  const state = await context(source, page, signal);
  validateEditorTableOriginal(table, state.paths);
  const guarded = obstacles(table, state.objects, state.targets, marks),
    next =
      operation.kind === 'height'
        ? setEditorTableRowHeight(table, operation.row, operation.height, { obstacles: guarded })
        : insertEditorTableRow(table, operation.row, operation.height, { obstacles: guarded });
  const removed = new Set<string>(
      marks
        .filter((m) => m.nativeTable?.id === table.id || m.tableCell?.tableId === table.id)
        .map((m) => m.id),
    ),
    cellMarks: Mark[] = [];
  const requiredHeights: Record<string, number> = {};
  for (const cell of next.cells) {
    const oldCell = table.cells.find((c) => c.id === cell.id),
      oldRect = oldCell && editorTableCellRect(table, oldCell),
      rect = editorTableCellRect(next, cell);
    let mark = marks.find(
      (m) => m.tableCell?.tableId === table.id && m.tableCell.cellId === cell.id,
    );
    if (!mark) {
      const fragments: Mark[] = [],
        seen = new Set<string>();
      for (const id of cell.textIds) {
        const target = state.targets.find((t) => t.id === id);
        if (!target) throw new Error('Der ursprüngliche Zellentext wurde nicht wiedergefunden.');
        const matching = marks.filter(
          (m) => m.kind === 'text' && editorRemovalRects(m).some((r) => same(r, target)),
        );
        if (matching.length > 1)
          throw new Error('Mehrere Änderungen betreffen dieselbe Tabellenzelle.');
        const fragment =
          matching[0] ||
          editorTargetMark(target, page.index, state.width, `${table.id}:${target.id}`);
        if (matching[0]) removed.add(matching[0].id);
        if (!seen.has(fragment.id)) {
          fragments.push(fragment);
          seen.add(fragment.id);
        }
      }
      mark =
        fragments.length > 1
          ? joinEditorBlocks(fragments, state.width, state.height, cell.id)
          : fragments.length
            ? { ...fragments[0], id: cell.id }
            : {
                id: cell.id,
                kind: 'text',
                ...normalized(rect, state.width, state.height),
                text: '',
                fontScale: 11 / state.width,
                fontChoice: 'dejavu-sans',
                fontFamily: 'sans',
                color: '#222222',
              };
    }
    const left = oldRect ? Math.max(2, mark.x * state.width - oldRect.x) : 3,
      top = oldRect ? Math.max(2, mark.y * state.height - oldRect.y) : 3;
    const positioned: Mark = {
      ...mark,
      id: cell.id,
      x: (rect.x + left) / state.width,
      y: (rect.y + top) / state.height,
      w: (rect.w - left - 3) / state.width,
      h: (rect.h - top - 3) / state.height,
      originalState: undefined,
      nativeTextSlice: undefined,
      flow: undefined,
      changeGroup: table.id,
      tableCell: { tableId: table.id, cellId: cell.id },
    };
    if (positioned.w <= 0 || positioned.h <= 0) throw new Error('Die Tabellenzeile ist zu klein.');
    const layout = await prepareEditorLayout(positioned, state.width, state.height, source);
    if (layout.overflow) throw new Error('Der Zellentext passt nicht in die gewählte Zeilenhöhe.');
    requiredHeights[cell.id] = top + layout.requiredHeight + 3;
    cellMarks.push(positioned);
  }
  validateEditorTable(next, { obstacles: guarded, requiredHeights });
  signal.throwIfAborted();
  return {
    remove: [...removed],
    add: [
      {
        id: `${table.id}:grid`,
        kind: 'image',
        ...tableRect(next),
        nativeTable: next,
        changeGroup: table.id,
      } as Mark,
      ...cellMarks,
    ],
  };
}

/** Revalidate imported provenance and exact original cell ownership before any
 * native index becomes a deletion instruction. */
export async function removeEditorTablePaths(
  bytes: Uint8Array,
  marks: Mark[],
  targets: TextTarget[],
  signal: AbortSignal,
) {
  const tables = marks.filter((m) => m.nativeTable);
  if (!tables.length) return bytes;
  const { inspectObjectTree, editObjects } = await import('./native-pdf'),
    objects = await inspectObjectTree(bytes, 0, signal),
    indices = new Set<number>();
  for (const marker of tables) {
    const table = marker.nativeTable!,
      paths = editorTablePaths(objects, table.pageWidth, table.pageHeight);
    validateEditorTableOriginal(table, paths);
    if (!same(marker, tableRect(table)))
      throw new Error('Die Tabellenposition stimmt nicht mit dem Raster überein.');
    const original = recognizeEditorTable({
      id: table.id,
      pageWidth: table.pageWidth,
      pageHeight: table.pageHeight,
      paths: table.original.paths,
      texts: texts(targets, table.pageWidth, table.pageHeight),
    });
    for (const cell of table.cells) {
      const old = original.cells.find((c) => c.id === cell.id),
        expected = old?.textIds || [];
      if (JSON.stringify([...cell.textIds].sort()) !== JSON.stringify([...expected].sort()))
        throw new Error(
          'Die ursprünglichen Zellinhalte stimmen nicht mit dem Tabellenraster überein.',
        );
      const candidates = marks.filter(
        (m) => m.tableCell?.tableId === table.id && m.tableCell.cellId === cell.id,
      );
      if (candidates.length !== 1)
        throw new Error('Eine Tabellenzelle fehlt oder ist doppelt vorhanden.');
      const mark = candidates[0],
        rect = normalized(editorTableCellRect(table, cell), table.pageWidth, table.pageHeight),
        removals = editorRemovalRects(mark);
      if (
        mark.kind !== 'text' ||
        mark.x < rect.x ||
        mark.y < rect.y ||
        mark.x + mark.w > rect.x + rect.w + 0.00001 ||
        mark.y + mark.h > rect.y + rect.h + 0.00001 ||
        removals.length !== expected.length ||
        expected.some(
          (id) =>
            !removals.some((r) =>
              same(
                r,
                targets.find((t) => t.id === id)!,
              ),
            ),
        )
      )
        throw new Error('Die Zellgeometrie oder die ursprünglichen Textbereiche wurden verändert.');
    }
    if (original.cells.some((c) => !table.cells.some((n) => n.id === c.id)))
      throw new Error('Eine ursprüngliche Tabellenzelle fehlt.');
    validateEditorTable(table, { obstacles: obstacles(table, objects, targets, marks) });
    for (const path of table.original.paths) {
      if (indices.has(path.index)) throw new Error('Mehrere Tabellen beanspruchen dieselbe Linie.');
      indices.add(path.index);
    }
  }
  return editObjects(
    bytes,
    0,
    [...indices].map((index) => ({ index, remove: true })),
    signal,
  );
}
