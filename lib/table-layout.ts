import type { TextTarget } from './editor-model';
import type { Rect } from './studio-engine';

export type TableCellSource = { rect?: Rect; uncertain: boolean };
export type TableMerge = { row: number; column: number; columns: number };
export type TableLayout = {
  rows: string[][];
  cells: TableCellSource[][];
  boundaries: number[];
  merges: TableMerge[];
};
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0.01;
};
const union = (items: Rect[]): Rect | undefined => {
  if (!items.length) return undefined;
  const x = Math.min(...items.map((t) => t.x)),
    y = Math.min(...items.map((t) => t.y));
  return {
    x,
    y,
    w: Math.max(...items.map((t) => t.x + t.w)) - x,
    h: Math.max(...items.map((t) => t.y + t.h)) - y,
  };
};

/** Infer recurring whitespace gutters. Never invent text or split a PDF text item. */
export function analyseTableLayout(
  targets: TextTarget[],
  area: Rect,
  options: { boundaries?: number[]; headerRows?: number; joinWrapped?: boolean } = {},
): TableLayout {
  const items = targets
    .flatMap((t) => (t.fragments?.length ? t.fragments : [t]))
    .filter(
      (t) =>
        t.text.trim() &&
        [t.x, t.y, t.w, t.h].every(Number.isFinite) &&
        t.w > 0 &&
        t.h > 0 &&
        t.x + t.w / 2 >= area.x &&
        t.x + t.w / 2 <= area.x + area.w &&
        t.y + t.h / 2 >= area.y &&
        t.y + t.h / 2 <= area.y + area.h,
    )
    .sort((a, b) => a.y + a.h / 2 - b.y - b.h / 2 || a.x - b.x);
  if (items.length > 100000)
    throw new Error('Zu viele Textstellen im Tabellenbereich. Bitte den Bereich verkleinern.');
  const lines: TextTarget[][] = [];
  for (const item of items) {
    const last = lines.at(-1);
    if (
      last &&
      Math.abs(last[0].y + last[0].h / 2 - item.y - item.h / 2) <
        Math.max(0.003, Math.min(last[0].h, item.h) * 0.45)
    )
      last.push(item);
    else lines.push([item]);
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x);
  const height = median(items.map((t) => t.h));
  const gaps: { left: number; right: number; line: number }[] = [];
  const sampled = lines.filter((_, i) => i % Math.max(1, Math.ceil(lines.length / 120)) === 0);
  sampled.forEach((line, index) =>
    line.forEach((item, i) => {
      const next = line[i + 1];
      if (next && next.x - item.x - item.w > Math.max(area.w * 0.018, height))
        gaps.push({ left: item.x + item.w + 0.003, right: next.x - 0.003, line: index });
    }),
  );
  const inferred: number[] = [];
  if (!options.boundaries) {
    const minimum = Math.max(2, Math.ceil(sampled.filter((l) => l.length > 1).length * 0.4));
    const candidates = gaps
      .filter((_, i) => i % Math.max(1, Math.ceil(gaps.length / 500)) === 0)
      .map((g) => {
        const middle = (g.left + g.right) / 2;
        const support = gaps.filter((other) => other.left <= middle && other.right >= middle);
        const count = new Set(support.map((v) => v.line)).size;
        return {
          x:
            (Math.max(...support.map((v) => v.left)) + Math.min(...support.map((v) => v.right))) /
            2,
          count,
          support,
        };
      })
      .sort((a, b) => b.count - a.count || a.x - b.x);
    const used = new Set<number>();
    for (const c of candidates) {
      if (
        c.count < minimum ||
        c.support.some((g) => used.has(gaps.indexOf(g))) ||
        inferred.some((x) => Math.abs(x - c.x) < area.w * 0.035)
      )
        continue;
      inferred.push(c.x);
      for (const g of c.support) used.add(gaps.indexOf(g));
    }
  }
  const boundaries = [...new Set(options.boundaries || inferred)]
    .filter((x) => Number.isFinite(x) && x > area.x && x < area.x + area.w)
    .sort((a, b) => a - b);
  if (boundaries.length > 99) throw new Error('Maximal 100 Tabellenspalten.');
  const edges = [area.x, ...boundaries, area.x + area.w],
    rows: string[][] = [],
    cells: TableCellSource[][] = [],
    merges: TableMerge[] = [];
  const headers = options.headerRows ?? 1;
  let previousBottom = 0;
  for (const [lineIndex, line] of lines.entries()) {
    const columns: TextTarget[][] = Array.from({ length: edges.length - 1 }, () => []);
    const spanning = new Map<TextTarget, number[]>();
    for (const item of line) {
      const overlaps = columns.map((_, i) =>
        Math.max(0, Math.min(item.x + item.w, edges[i + 1]) - Math.max(item.x, edges[i])),
      );
      const crossed = overlaps
        .map((overlap, i) => (overlap > Math.min(item.w * 0.2, 0.012) ? i : -1))
        .filter((i) => i >= 0);
      const owner =
        crossed.length > 1 ? crossed[0] : Math.max(0, overlaps.indexOf(Math.max(...overlaps)));
      columns[owner].push(item);
      if (crossed.length > 1) spanning.set(item, crossed);
    }
    const values = columns.map((group) => group.map((t) => t.text).join(' '));
    const info = columns.map((group) => ({
      rect: union(group),
      uncertain:
        (!options.boundaries && !boundaries.length) ||
        group.some(
          (t) =>
            spanning.has(t) ||
            (t.confidence !== undefined && t.confidence < 85) ||
            !!t.unsupportedReason ||
            !!t.rotation,
        ),
    }));
    const top = Math.min(...line.map((t) => t.y)),
      bottom = Math.max(...line.map((t) => t.y + t.h));
    const occupied = values.map((v, i) => (v.trim() ? i : -1)).filter((i) => i >= 0);
    const previous = rows.at(-1);
    // Only an explicit option joins close continuation lines without an identifier.
    const wrapped =
      options.joinWrapped &&
      lineIndex >= headers &&
      previous &&
      rows.length > headers &&
      occupied.length === 1 &&
      occupied[0] > 0 &&
      previous[0] &&
      previous[occupied[0]] &&
      top - previousBottom >= -0.002 &&
      top - previousBottom < height * 0.8;
    if (wrapped) {
      const at = occupied[0],
        old = cells.at(-1)![at];
      previous[at] += '\n' + values[at];
      old.rect = union([old.rect, info[at].rect].filter((r): r is Rect => !!r));
      old.uncertain = true;
    } else {
      const row = rows.length;
      rows.push(values);
      cells.push(info);
      for (const span of spanning.values()) {
        if (lineIndex < headers && span.slice(1).every((c) => !values[c]))
          merges.push({ row, column: span[0], columns: span.length });
        else info[span[0]].uncertain = true;
      }
    }
    previousBottom = bottom;
  }
  if (rows.length > 10000) throw new Error('Maximal 10.000 Tabellenzeilen.');
  return { rows, cells, boundaries, merges };
}

export function combineTableLayouts(
  layouts: TableLayout[],
  headerRows: number,
  removeHeaders: boolean,
) {
  const populated = layouts.filter((l) => l.rows.length),
    first = populated[0];
  const rows: string[][] = [],
    cells: TableCellSource[][] = [],
    pages: number[] = [],
    merges: TableMerge[] = [];
  if (!first) return { rows, cells, pages, merges };
  const count = first.rows[0].length;
  if (populated.some((l) => l.rows[0].length !== count))
    throw new Error(
      'Die erkannten Spalten unterscheiden sich zwischen den Seiten. Bitte Spaltengrenzen manuell festlegen oder Seiten einzeln übernehmen.',
    );
  layouts.forEach((layout, page) => {
    const repeated =
      rows.length > 0 &&
      removeHeaders &&
      headerRows > 0 &&
      layout.rows.length >= headerRows &&
      first.rows.length >= headerRows &&
      first.rows
        .slice(0, headerRows)
        .every((r, y) =>
          r.every(
            (v, x) =>
              v.trim().replace(/\s+/g, ' ') === layout.rows[y][x].trim().replace(/\s+/g, ' '),
          ),
        );
    const skip = repeated ? headerRows : 0,
      offset = rows.length;
    rows.push(...layout.rows.slice(skip));
    cells.push(...layout.cells.slice(skip));
    pages.push(...layout.rows.slice(skip).map(() => page));
    merges.push(
      ...layout.merges
        .filter((m) => m.row >= skip)
        .map((m) => ({ ...m, row: offset + m.row - skip })),
    );
  });
  if (rows.length > 10000) throw new Error('Maximal 10.000 Tabellenzeilen.');
  return { rows, cells, pages, merges };
}
