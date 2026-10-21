/**
 * Validated table topology and edit planning. All geometry is in displayed page points,
 * with the origin at the upper left. This module does not write PDF objects.
 * Path flags must come from native inspection, never from guessed bounds.
 */
export type TableRect = { x: number; y: number; w: number; h: number };
export type TableSegment = { x1: number; y1: number; x2: number; y2: number };
export type TablePath = {
  index: number;
  segments: readonly TableSegment[];
  color: string;
  width: number;
  opacity: number;
  fill: boolean;
  dash: readonly number[];
  lineCap: 'butt' | 'round' | 'square';
  root: boolean;
  clipped: boolean;
  transparent: boolean;
};
export type TableText = {
  id: string;
  rect: TableRect;
  rotation?: number;
  unsupportedReason?: string;
};
export type TableCell = {
  id: string;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  /** Original text identities stay attached to the cell through edits. */
  textIds: readonly string[];
};
export type TableOriginal = Readonly<{
  paths: readonly Readonly<TablePath>[];
  rect: Readonly<TableRect>;
}>;
export type EditorTable = Readonly<{
  id: string;
  pageWidth: number;
  pageHeight: number;
  columns: readonly number[];
  rows: readonly number[];
  cells: readonly Readonly<TableCell>[];
  color: string;
  width: number;
  original: TableOriginal;
  nextCellId: number;
}>;
export type TableGuard = {
  /** Other original/proposed text, image, widget and unsupported path bounds. */
  obstacles?: readonly TableRect[];
  /** Required total cell height, including padding, measured by editor layout. */
  requiredHeights?: Readonly<Record<string, number>>;
};

const TOLERANCE = 0.2;
const EXACT_TOLERANCE = 0.0001;
const MIN_TRACK = 4;
const MAX_ROWS = 100;
const MAX_COLUMNS = 50;
const MAX_CELLS = 2000;
const MAX_SEGMENTS = 4000;
function fail(message: string): never {
  throw new Error(message);
}
function finite(...values: number[]) {
  return values.every(Number.isFinite);
}
function validRect(r: TableRect) {
  return finite(r.x, r.y, r.w, r.h) && r.w > 0 && r.h > 0;
}
function intersects(a: TableRect, b: TableRect, margin = 0) {
  return (
    Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) - margin &&
    Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) - margin
  );
}
function contains(a: TableRect, b: TableRect, margin = 0) {
  return (
    b.x >= a.x + margin &&
    b.y >= a.y + margin &&
    b.x + b.w <= a.x + a.w - margin &&
    b.y + b.h <= a.y + a.h - margin
  );
}
function freezePath(path: TablePath): Readonly<TablePath> {
  return Object.freeze({
    ...path,
    segments: Object.freeze(path.segments.map((s) => Object.freeze({ ...s }))),
    dash: Object.freeze([...path.dash]),
  });
}
function immutable(table: EditorTable): EditorTable {
  const original =
    Object.isFrozen(table.original) &&
    Object.isFrozen(table.original.paths) &&
    Object.isFrozen(table.original.rect) &&
    table.original.paths.every(
      (p) =>
        Object.isFrozen(p) &&
        Object.isFrozen(p.segments) &&
        Object.isFrozen(p.dash) &&
        p.segments.every(Object.isFrozen),
    )
      ? table.original
      : Object.freeze({
          paths: Object.freeze(table.original.paths.map(freezePath)),
          rect: Object.freeze({ ...table.original.rect }),
        });
  return Object.freeze({
    ...table,
    original,
    columns: Object.freeze([...table.columns]),
    rows: Object.freeze([...table.rows]),
    cells: Object.freeze(
      table.cells.map((c) =>
        Object.freeze({
          ...c,
          textIds: Object.freeze([...c.textIds]),
        }),
      ),
    ),
  });
}
function validatePath(path: TablePath) {
  if (
    !Number.isInteger(path.index) ||
    path.index < 0 ||
    path.index > 9999 ||
    !finite(path.width) ||
    path.width <= 0 ||
    path.width > 4 ||
    !/^#[0-9a-f]{6}$/i.test(path.color) ||
    path.opacity !== 1 ||
    path.fill !== false ||
    path.dash.length ||
    path.lineCap !== 'butt' ||
    path.root !== true ||
    path.clipped !== false ||
    path.transparent !== false ||
    !path.segments.length ||
    path.segments.length > MAX_SEGMENTS
  )
    fail('Unsupported original path style or identity.');
  for (const s of path.segments) {
    if (!finite(s.x1, s.y1, s.x2, s.y2)) fail('Non-finite original path coordinates.');
    const dx = Math.abs(s.x2 - s.x1),
      dy = Math.abs(s.y2 - s.y1);
    // Only already-axis-aligned lines qualify. Tolerance is for PDF rounding,
    // not an invitation to straighten an oblique original.
    if (!((dx <= EXACT_TOLERANCE && dy >= MIN_TRACK) || (dy <= EXACT_TOLERANCE && dx >= MIN_TRACK)))
      fail('The original path is not a straight axis-aligned grid segment.');
  }
}
function coordinates(values: number[]) {
  const result: number[] = [];
  for (const value of [...values].sort((a, b) => a - b)) {
    if (!result.length || value - result[result.length - 1] > TOLERANCE) result.push(value);
  }
  for (let i = 1; i < result.length; i++)
    if (result[i] - result[i - 1] < MIN_TRACK) fail('Ambiguous or too narrow grid track.');
  return result;
}
function coordinateIndex(value: number, values: readonly number[]) {
  const found = values
    .map((v, i) => (Math.abs(v - value) <= TOLERANCE ? i : -1))
    .filter((i) => i >= 0);
  if (found.length !== 1) fail('Ambiguous grid coordinate.');
  return found[0];
}
function matrix(height: number, width: number, value = false): boolean[][] {
  return Array.from({ length: height }, () => Array(width).fill(value));
}
function bounds(columns: readonly number[], rows: readonly number[]): TableRect {
  return {
    x: columns[0],
    y: rows[0],
    w: columns[columns.length - 1] - columns[0],
    h: rows[rows.length - 1] - rows[0],
  };
}
export function editorTableCellRect(table: EditorTable, cell: TableCell): TableRect {
  return {
    x: table.columns[cell.column],
    y: table.rows[cell.row],
    w: table.columns[cell.column + cell.columnSpan] - table.columns[cell.column],
    h: table.rows[cell.row + cell.rowSpan] - table.rows[cell.row],
  };
}

/**
 * Inspect one connected candidate grid, supplied as complete native paths.
 * Caller must also supply every other page object as text or obstacle; do not
 * discard unrecognized objects before calling this function.
 */
export function recognizeEditorTable(input: {
  id: string;
  pageWidth: number;
  pageHeight: number;
  paths: readonly TablePath[];
  texts?: readonly TableText[];
  obstacles?: readonly TableRect[];
}): EditorTable {
  const { paths, pageWidth, pageHeight } = input;
  if (
    !input.id ||
    input.id.length > 120 ||
    !finite(pageWidth, pageHeight) ||
    pageWidth < 1 ||
    pageHeight < 1 ||
    !paths.length ||
    paths.length > MAX_SEGMENTS
  )
    fail('Invalid table candidate.');
  const indices = new Set<number>();
  const segments: TableSegment[] = [];
  for (const path of paths) {
    validatePath(path);
    if (indices.has(path.index)) fail('Duplicate original path identity.');
    indices.add(path.index);
    if (
      path.color.toLowerCase() !== paths[0].color.toLowerCase() ||
      Math.abs(path.width - paths[0].width) > EXACT_TOLERANCE
    )
      fail('Mixed grid line styles are not supported.');
    segments.push(...path.segments);
  }
  if (segments.length > MAX_SEGMENTS) fail('Too many grid segments.');
  const xs = coordinates(segments.flatMap((s) => [s.x1, s.x2]));
  const ys = coordinates(segments.flatMap((s) => [s.y1, s.y2]));
  const nr = ys.length - 1,
    nc = xs.length - 1;
  if (nr < 2 || nc < 2 || nr > MAX_ROWS || nc > MAX_COLUMNS || nr * nc > MAX_CELLS)
    fail('The candidate must be a bounded grid with at least two rows and two columns.');
  const rect = bounds(xs, ys);
  if (!contains({ x: 0, y: 0, w: pageWidth, h: pageHeight }, rect, paths[0].width / 2))
    fail('The table extends outside the page.');
  const horizontal = matrix(nr + 1, nc),
    vertical = matrix(nr, nc + 1);
  for (const segment of segments) {
    const x1 = coordinateIndex(segment.x1, xs),
      x2 = coordinateIndex(segment.x2, xs);
    const y1 = coordinateIndex(segment.y1, ys),
      y2 = coordinateIndex(segment.y2, ys);
    if (y1 === y2 && x1 !== x2) {
      for (let x = Math.min(x1, x2); x < Math.max(x1, x2); x++) {
        if (horizontal[y1][x]) fail('Duplicate or overlapping horizontal grid lines.');
        horizontal[y1][x] = true;
      }
    } else if (x1 === x2 && y1 !== y2) {
      for (let y = Math.min(y1, y2); y < Math.max(y1, y2); y++) {
        if (vertical[y][x1]) fail('Duplicate or overlapping vertical grid lines.');
        vertical[y][x1] = true;
      }
    } else fail('The path cannot be mapped to an unambiguous grid edge.');
  }
  if (
    horizontal[0].some((v) => !v) ||
    horizontal[nr].some((v) => !v) ||
    vertical.some((r) => !r[0] || !r[nc])
  )
    fail('The table has an incomplete outer border.');

  const visited = matrix(nr, nc),
    cells: TableCell[] = [];
  for (let y = 0; y < nr; y++)
    for (let x = 0; x < nc; x++) {
      if (visited[y][x]) continue;
      const group: [number, number][] = [],
        pending: [number, number][] = [[y, x]];
      visited[y][x] = true;
      while (pending.length) {
        const [row, column] = pending.pop()!;
        group.push([row, column]);
        const neighbors: [number, number, boolean][] = [
          [row - 1, column, horizontal[row][column]],
          [row + 1, column, horizontal[row + 1][column]],
          [row, column - 1, vertical[row][column]],
          [row, column + 1, vertical[row][column + 1]],
        ];
        for (const [r, c, barrier] of neighbors) {
          if (barrier || r < 0 || r >= nr || c < 0 || c >= nc || visited[r][c]) continue;
          visited[r][c] = true;
          pending.push([r, c]);
        }
      }
      const row = Math.min(...group.map(([r]) => r));
      const column = Math.min(...group.map(([, c]) => c));
      const rowEnd = Math.max(...group.map(([r]) => r)) + 1;
      const columnEnd = Math.max(...group.map(([, c]) => c)) + 1;
      if (group.length !== (rowEnd - row) * (columnEnd - column))
        fail('Merged cells must be rectangular.');
      for (let r = row; r < rowEnd; r++)
        for (let c = column; c < columnEnd; c++) {
          if ((r > row && horizontal[r][c]) || (c > column && vertical[r][c]))
            fail('A merged cell contains an incomplete internal divider.');
        }
      cells.push({
        id: `${input.id}:cell:${cells.length}`,
        row,
        column,
        rowSpan: rowEnd - row,
        columnSpan: columnEnd - column,
        textIds: [],
      });
    }
  if (cells.length < 2) fail('A plain rectangular frame is not an editable table.');
  const original = Object.freeze({
    paths: Object.freeze(paths.map(freezePath)),
    rect: Object.freeze({ ...rect }),
  });
  const table: EditorTable = {
    id: input.id,
    pageWidth,
    pageHeight,
    columns: xs,
    rows: ys,
    cells,
    color: paths[0].color.toLowerCase(),
    width: paths[0].width,
    original,
    nextCellId: cells.length,
  };
  const textIds = new Set<string>();
  for (const text of input.texts || []) {
    if (!text.id || textIds.has(text.id) || !validRect(text.rect))
      fail('Invalid or duplicate text geometry.');
    textIds.add(text.id);
    if (!intersects(rect, text.rect, table.width / 2)) continue;
    if (text.unsupportedReason || (text.rotation !== undefined && text.rotation !== 0))
      fail('Unsupported or rotated text intersects the table.');
    const possible = cells.filter((c) =>
      contains(editorTableCellRect(table, c), text.rect, table.width / 2 + TOLERANCE),
    );
    if (possible.length !== 1) fail('Text crosses a cell boundary or table border.');
    possible[0].textIds = [...possible[0].textIds, text.id];
  }
  validateEditorTable(table, { obstacles: input.obstacles });
  return immutable(table);
}

/** Validate every imported/proposed model before it can produce a PDF plan. */
export function validateEditorTable(table: EditorTable, guard: TableGuard = {}) {
  const nr = table.rows.length - 1,
    nc = table.columns.length - 1;
  if (
    nr < 2 ||
    nc < 2 ||
    nr > MAX_ROWS ||
    nc > MAX_COLUMNS ||
    nr * nc > MAX_CELLS ||
    !finite(table.pageWidth, table.pageHeight, table.width) ||
    table.width <= 0 ||
    table.width > 4 ||
    !/^#[0-9a-f]{6}$/i.test(table.color) ||
    !Number.isInteger(table.nextCellId) ||
    table.nextCellId < table.cells.length ||
    table.cells.length > MAX_CELLS
  )
    fail('Invalid table model.');
  for (const axis of [table.rows, table.columns]) {
    if (!axis.every(Number.isFinite)) fail('Non-finite table geometry.');
    for (let i = 1; i < axis.length; i++)
      if (axis[i] - axis[i - 1] < MIN_TRACK) fail('Invalid or too narrow table track.');
  }
  const rect = bounds(table.columns, table.rows);
  if (!contains({ x: 0, y: 0, w: table.pageWidth, h: table.pageHeight }, rect, table.width / 2))
    fail('The table extends outside the page.');
  const occupied = matrix(nr, nc),
    ids = new Set<string>(),
    textIds = new Set<string>();
  for (const cell of table.cells) {
    if (
      !cell.id ||
      ids.has(cell.id) ||
      ![cell.row, cell.column, cell.rowSpan, cell.columnSpan].every(Number.isInteger) ||
      cell.row < 0 ||
      cell.column < 0 ||
      cell.rowSpan < 1 ||
      cell.columnSpan < 1 ||
      cell.row + cell.rowSpan > nr ||
      cell.column + cell.columnSpan > nc
    )
      fail('Invalid or duplicate cell.');
    ids.add(cell.id);
    for (const id of cell.textIds) {
      if (!id || textIds.has(id)) fail('The same original text belongs to multiple cells.');
      textIds.add(id);
    }
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++)
      for (let c = cell.column; c < cell.column + cell.columnSpan; c++) {
        if (occupied[r][c]) fail('Table cells overlap.');
        occupied[r][c] = true;
      }
    const required = guard.requiredHeights?.[cell.id];
    if (
      required !== undefined &&
      (!Number.isFinite(required) ||
        required < 0 ||
        required > editorTableCellRect(table, cell).h + EXACT_TOLERANCE)
    )
      fail('The cell content does not fit the proposed row height.');
  }
  if (occupied.some((row) => row.some((v) => !v)))
    fail('Table cells leave an uncovered grid area.');
  for (const obstacle of guard.obstacles || []) {
    if (!validRect(obstacle)) fail('Invalid obstacle geometry.');
    if (intersects(rect, obstacle, table.width / 2 + TOLERANCE))
      fail('The proposed table collides with other page content.');
  }
  if (
    !validRect(table.original.rect) ||
    !table.original.paths.length ||
    table.original.paths.length > MAX_SEGMENTS
  )
    fail('Missing original table provenance.');
  const originalIndices = new Set<number>();
  for (const path of table.original.paths) {
    validatePath(path);
    if (originalIndices.has(path.index)) fail('Duplicate original table path.');
    originalIndices.add(path.index);
  }
}

/** Stable provenance is shared unchanged, never regenerated from edited rows. */
export function setEditorTableRowHeight(
  table: EditorTable,
  row: number,
  height: number,
  guard: TableGuard = {},
): EditorTable {
  validateEditorTable(table);
  if (
    !Number.isInteger(row) ||
    row < 0 ||
    row >= table.rows.length - 1 ||
    !Number.isFinite(height) ||
    height < MIN_TRACK
  )
    fail('Invalid row height.');
  const delta = height - (table.rows[row + 1] - table.rows[row]);
  const next = { ...table, rows: table.rows.map((y, i) => (i > row ? y + delta : y)) };
  validateEditorTable(next, guard);
  return immutable(next);
}

/** Insert an empty unmerged row. A vertical merge may never be split implicitly. */
export function insertEditorTableRow(
  table: EditorTable,
  before: number,
  height: number,
  guard: TableGuard = {},
): EditorTable {
  validateEditorTable(table);
  const nr = table.rows.length - 1,
    nc = table.columns.length - 1;
  if (
    !Number.isInteger(before) ||
    before < 0 ||
    before > nr ||
    !Number.isFinite(height) ||
    height < MIN_TRACK
  )
    fail('Invalid insertion row or height.');
  if (table.cells.some((c) => c.row < before && c.row + c.rowSpan > before))
    fail('Cannot insert through a vertically merged cell.');
  const rows = [
    ...table.rows.slice(0, before + 1),
    ...table.rows.slice(before).map((y) => y + height),
  ];
  let nextCellId = table.nextCellId;
  const inserted = Array.from({ length: nc }, (_, column) => ({
    id: `${table.id}:cell:${nextCellId++}`,
    row: before,
    column,
    rowSpan: 1,
    columnSpan: 1,
    textIds: [],
  }));
  const cells = [
    ...table.cells.map((c) => (c.row >= before ? { ...c, row: c.row + 1 } : c)),
    ...inserted,
  ].sort((a, b) => a.row - b.row || a.column - b.column);
  const next = { ...table, rows, cells, nextCellId };
  validateEditorTable(next, guard);
  return immutable(next);
}

/** New vector lines, coalesced without recreating a merged cell's hidden edge. */
export function editorTableSegments(table: EditorTable): TableSegment[] {
  validateEditorTable(table);
  const nr = table.rows.length - 1,
    nc = table.columns.length - 1;
  const horizontal = matrix(nr + 1, nc),
    vertical = matrix(nr, nc + 1);
  for (const cell of table.cells) {
    for (let c = cell.column; c < cell.column + cell.columnSpan; c++) {
      horizontal[cell.row][c] = true;
      horizontal[cell.row + cell.rowSpan][c] = true;
    }
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      vertical[r][cell.column] = true;
      vertical[r][cell.column + cell.columnSpan] = true;
    }
  }
  const segments: TableSegment[] = [];
  for (let y = 0; y <= nr; y++)
    for (let x = 0; x < nc;) {
      if (!horizontal[y][x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < nc && horizontal[y][x]) x++;
      segments.push({
        x1: table.columns[start],
        x2: table.columns[x],
        y1: table.rows[y],
        y2: table.rows[y],
      });
    }
  for (let x = 0; x <= nc; x++)
    for (let y = 0; y < nr;) {
      if (!vertical[y][x]) {
        y++;
        continue;
      }
      const start = y;
      while (y < nr && vertical[y][x]) y++;
      segments.push({
        x1: table.columns[x],
        x2: table.columns[x],
        y1: table.rows[start],
        y2: table.rows[y],
      });
    }
  return segments;
}

/** Exact native revalidation before removing original path indices. */
export function validateEditorTableOriginal(table: EditorTable, actual: readonly TablePath[]) {
  validateEditorTable(table);
  // Imported archives may manufacture otherwise well-typed provenance. Confirm
  // that the claimed originals actually describe a supported grid before any
  // of their indices can become deletion instructions.
  const original = recognizeEditorTable({
    id: 'original-check',
    pageWidth: table.pageWidth,
    pageHeight: table.pageHeight,
    paths: table.original.paths,
  });
  if (
    (['x', 'y', 'w', 'h'] as const).some(
      (key) => Math.abs(original.original.rect[key] - table.original.rect[key]) > EXACT_TOLERANCE,
    ) ||
    original.columns.length !== table.columns.length ||
    original.columns.some((x, i) => Math.abs(x - table.columns[i]) > EXACT_TOLERANCE) ||
    Math.abs(original.rows[0] - table.rows[0]) > EXACT_TOLERANCE
  )
    fail('Original table provenance disagrees with its claimed bounds or columns.');
  const seen = new Set<number>();
  for (const path of actual) {
    if (seen.has(path.index)) fail('Ambiguous current native object identity.');
    seen.add(path.index);
  }
  for (const original of table.original.paths) {
    const path = actual.find((p) => p.index === original.index);
    if (!path) fail('An original table path no longer exists.');
    validatePath(path);
    if (
      path.color.toLowerCase() !== original.color.toLowerCase() ||
      Math.abs(path.width - original.width) > EXACT_TOLERANCE ||
      path.segments.length !== original.segments.length ||
      path.segments.some((s, i) =>
        (['x1', 'y1', 'x2', 'y2'] as const).some(
          (key) => Math.abs(s[key] - original.segments[i][key]) > EXACT_TOLERANCE,
        ),
      )
    )
      fail('Original table path geometry or style no longer matches.');
  }
}
