import type { Source, PageItem } from './pdf-engine';
import { renderPageRegion } from './pdf-engine';
import type { Mark, Rect } from './studio-engine';
import type { TextTarget } from './editor-model';
import { editorRectsOverlap, editorRemovalRects } from './editor-model';

const normalize = (s: string) => s.normalize('NFKC').replace(/\s/gu, '');
/** Local differences are not diluted by the surrounding white page. Ignore one
 * pixel of raster alignment; retain compact missing punctuation/line segments. */
export function compareEditorDetail(a: ImageData, b: ImageData) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Seitenmaß verändert');
  const { width, height } = a;
  let count = 0,
    left = width,
    top = height,
    right = 0,
    bottom = 0;
  const distance = (from: Uint8ClampedArray, i: number, to: Uint8ClampedArray, j: number) =>
    Math.max(
      Math.abs(from[i] - to[j]),
      Math.abs(from[i + 1] - to[j + 1]),
      Math.abs(from[i + 2] - to[j + 2]),
    );
  const unmatched = (
    from: Uint8ClampedArray,
    to: Uint8ClampedArray,
    x: number,
    y: number,
    i: number,
  ) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (distance(from, i, to, ((y + dy) * width + x + dx) * 4) <= 48) return false;
    return true;
  };
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (distance(a.data, i, b.data, i) <= 48) continue;
      if (!unmatched(a.data, b.data, x, y, i) && !unmatched(b.data, a.data, x, y, i)) continue;
      count++;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  return {
    count,
    rect:
      count >= 8
        ? {
            x: left / width,
            y: top / height,
            w: (right - left) / width,
            h: (bottom - top) / height,
          }
        : undefined,
  };
}
export async function verifyEditorDetails(
  source: Source,
  page: PageItem,
  output: Source,
  outPage: PageItem,
  targets: TextTarget[],
  actual: TextTarget[],
  marks: Mark[],
  width: number,
  height: number,
  signal: AbortSignal,
) {
  const excluded = marks.flatMap((m) => [
    m,
    ...editorRemovalRects(m),
    ...(m.nativeTable
      ? [
          {
            x: m.nativeTable.original.rect.x / width,
            y: m.nativeTable.original.rect.y / height,
            w: m.nativeTable.original.rect.w / width,
            h: m.nativeTable.original.rect.h / height,
          },
        ]
      : []),
  ]);
  const unchanged = targets.filter(
    (t) => !t.invisible && normalize(t.text) && !excluded.some((r) => editorRectsOverlap(r, t)),
  );
  const issues: { message: string; rect?: Rect }[] = [];
  const indexByText = new Map<string, number[]>();
  actual.forEach((t, i) => {
    const key = normalize(t.text);
    indexByText.set(key, [...(indexByText.get(key) || []), i]);
  });
  let previous = -1;
  for (const t of unchanged) {
    const matches = (indexByText.get(normalize(t.text)) || []).filter((i) =>
      editorRectsOverlap(t, actual[i]),
    );
    if (matches.length !== 1) continue; // Splits/ligatures are covered by the text and image checks.
    if (matches[0] < previous) {
      issues.push({
        message:
          'Die Reihenfolge unveränderter Textstellen hat sich geändert. Bitte die Lesereihenfolge prüfen.',
        rect: t,
      });
      break;
    }
    previous = matches[0];
  }
  const candidates = [...unchanged].sort(
    (a, b) => Number(/\d/.test(b.text)) - Number(/\d/.test(a.text)) || a.fontSize - b.fontSize,
  );
  const selected: TextTarget[] = [];
  for (const target of candidates) {
    if (selected.some((t) => editorRectsOverlap(t, target))) continue;
    selected.push(target);
    if (selected.length === 12) break;
  }
  for (const target of selected) {
    signal.throwIfAborted();
    const x = Math.max(0, target.x - 1 / width),
      y = Math.max(0, target.y - 1 / height);
    const rect = {
      x,
      y,
      w: Math.min(1, target.x + target.w + 1 / width) - x,
      h: Math.min(1, target.y + target.h + 1 / height) - y,
    };
    if (excluded.some((r) => editorRectsOverlap(r, rect))) continue;
    let a: Awaited<ReturnType<typeof renderPageRegion>> | undefined, b: typeof a;
    try {
      a = await renderPageRegion(source, page, rect, signal);
      b = await renderPageRegion(output, outPage, rect, signal);
      const difference = compareEditorDetail(
        a.canvas.getContext('2d')!.getImageData(0, 0, a.canvas.width, a.canvas.height),
        b.canvas.getContext('2d')!.getImageData(0, 0, b.canvas.width, b.canvas.height),
      );
      if (difference.rect)
        issues.push({
          message:
            'Die Detailprüfung zeigt eine Abweichung an einer unveränderten Textstelle. Bitte Zeichen und feine Linien vergleichen.',
          rect: {
            x: x + difference.rect.x * rect.w,
            y: y + difference.rect.y * rect.h,
            w: difference.rect.w * rect.w,
            h: difference.rect.h * rect.h,
          },
        });
    } catch {
      signal.throwIfAborted();
      issues.push({
        message: 'Die hochauflösende Detailprüfung konnte nicht vollständig abgeschlossen werden.',
        rect,
      });
    } finally {
      if (a) a.canvas.width = a.canvas.height = 0;
      if (b) b.canvas.width = b.canvas.height = 0;
    }
  }
  return issues;
}

/** Check the retained semantic skeleton and that edited text is still represented
 * in its marked content. This is a preservation check, not PDF/UA certification. */
export async function verifyEditorStructure(
  source: Source,
  page: PageItem,
  output: Source,
  outPage: PageItem,
  marks: Mark[],
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const before = await source.pdf.getPage(page.index + 1),
    after = await output.pdf.getPage(outPage.index + 1);
  const tree = await before.getStructTree();
  if (!tree) return [];
  const changed = await after.getStructTree();
  const shape = (value: unknown, depth = 0): unknown => {
    if (depth > 64) throw new Error('Struktur zu tief');
    if (!value || typeof value !== 'object') return null;
    const node = value as { role?: string; type?: string; alt?: string; children?: unknown[] };
    return [
      node.role || node.type,
      node.alt || '',
      (node.children || []).map((n) => shape(n, depth + 1)),
    ];
  };
  if (!changed || JSON.stringify(shape(tree)) !== JSON.stringify(shape(changed)))
    return [
      'Vorhandene Strukturinformationen haben sich verändert. Bitte Tags und Lesereihenfolge prüfen.',
    ];
  const semanticText = async (pdfPage: typeof before, structure: unknown) => {
    const content = await pdfPage.getTextContent({ includeMarkedContent: true });
    const textById = new Map<string, string[]>(),
      active: (string | undefined)[] = [];
    for (const item of content.items) {
      signal.throwIfAborted();
      if ('str' in item) {
        for (const id of active)
          if (id) {
            const chunks = textById.get(id) || [];
            chunks.push(item.str);
            textById.set(id, chunks);
          }
      } else if (item.type === 'endMarkedContent') active.pop();
      else active.push('id' in item ? item.id : undefined);
    }
    const ordered: string[] = [];
    const walk = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const node = value as { id?: string; type?: string; children?: unknown[] };
      if (node.type === 'content' && node.id)
        ordered.push(normalize((textById.get(node.id) || []).join('')));
      for (const child of node.children || []) walk(child);
    };
    walk(structure); // Depth has already been bounded by shape().
    return ordered.filter(Boolean);
  };
  const oldOrder = await semanticText(before, tree),
    newOrder = await semanticText(after, changed);
  let previous = -1;
  for (const text of oldOrder) {
    const at = newOrder.indexOf(text);
    if (
      at < 0 ||
      newOrder.lastIndexOf(text) !== at ||
      oldOrder.indexOf(text) !== oldOrder.lastIndexOf(text)
    )
      continue;
    if (at < previous)
      return [
        'Die Lesereihenfolge unveränderter Inhalte in den Tags hat sich geändert. Bitte die Struktur prüfen.',
      ];
    previous = at;
  }
  const tagged = newOrder.join('');
  if (
    marks.some(
      (m) =>
        m.kind === 'text' && normalize(m.text || '') && !tagged.includes(normalize(m.text || '')),
    )
  )
    return [
      'Geänderter Text ist nicht vollständig den vorhandenen Tags zugeordnet. Bitte die Lesereihenfolge prüfen.',
    ];
  return [];
}
