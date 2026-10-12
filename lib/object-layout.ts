import type { NativeObject, NativeChange } from './native-pdf-core';
export type ObjectAlignment =
  'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical';
export function alignObjects(objects: NativeObject[], alignment: ObjectAlignment): NativeChange[] {
  if (objects.length < (['horizontal', 'vertical'].includes(alignment) ? 3 : 2))
    throw new Error(
      'Zum Ausrichten mindestens zwei, zum Verteilen mindestens drei Objekte wählen.',
    );
  const left = Math.min(...objects.map((o) => o.x)),
    right = Math.max(...objects.map((o) => o.x + o.w)),
    top = Math.min(...objects.map((o) => o.y)),
    bottom = Math.max(...objects.map((o) => o.y + o.h));
  if (alignment === 'horizontal' || alignment === 'vertical') {
    const horizontal = alignment === 'horizontal',
      sorted = [...objects].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    const extent = horizontal ? right - left : bottom - top,
      sizes = sorted.reduce((n, o) => n + (horizontal ? o.w : o.h), 0),
      gap = (extent - sizes) / (objects.length - 1);
    let cursor = horizontal ? left : top;
    return sorted.map((o) => {
      const shift = cursor - (horizontal ? o.x : o.y);
      cursor += (horizontal ? o.w : o.h) + gap;
      return { index: o.index, ...(horizontal ? { dx: shift } : { dy: shift }) };
    });
  }
  return objects.map((o) => ({
    index: o.index,
    dx:
      alignment === 'left'
        ? left - o.x
        : alignment === 'right'
          ? right - o.x - o.w
          : alignment === 'center'
            ? (left + right - o.w) / 2 - o.x
            : 0,
    dy:
      alignment === 'top'
        ? top - o.y
        : alignment === 'bottom'
          ? bottom - o.y - o.h
          : alignment === 'middle'
            ? (top + bottom - o.h) / 2 - o.y
            : 0,
  }));
}
