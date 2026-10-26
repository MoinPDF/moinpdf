import type { Rect } from './studio-engine';

export type MarginZone = 'header' | 'footer';
export type MarginSettings = {
  top: number;
  bottom: number;
  headers: boolean;
  footers: boolean;
  pageNumbers: boolean;
};
export type MarginHit = {
  id: string;
  page: number;
  zone: MarginZone;
  text: string;
  rect: Rect;
  selected: boolean;
  manual: boolean;
  group: string;
};
export type MarginText = Rect & { text: string; rotation?: number; unsupportedReason?: string };
export type MarginPage = { page: number; width: number; height: number; targets: MarginText[] };
export const defaultMarginSettings: MarginSettings = {
  top: 12,
  bottom: 12,
  headers: true,
  footers: true,
  pageNumbers: true,
};
export const marginOverlap = (a: Rect, b: Rect) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.00001 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.00001;
export const marginContains = (a: Rect, b: Rect) =>
  b.x >= a.x - 0.00005 &&
  b.y >= a.y - 0.00005 &&
  b.x + b.w <= a.x + a.w + 0.00005 &&
  b.y + b.h <= a.y + a.h + 0.00005;
export function validMarginRect(r: Rect) {
  return (
    !!r &&
    [r.x, r.y, r.w, r.h].every(Number.isFinite) &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.w > 0 &&
    r.h > 0 &&
    r.x + r.w <= 1.000001 &&
    r.y + r.h <= 1.000001
  );
}
export function marginZone(r: Rect): MarginZone {
  if (!validMarginRect(r)) throw new Error('Der markierte Bereich liegt außerhalb der Seite.');
  if (r.y + r.h <= 0.250001) return 'header';
  if (r.y >= 0.749999) return 'footer';
  throw new Error('Bitte nur Bereiche im oberen oder unteren Seitenviertel markieren.');
}
export function validateMarginSettings(options: MarginSettings) {
  if (
    ![options.top, options.bottom].every((n) => Number.isFinite(n) && n >= 3 && n <= 25) ||
    ![options.headers, options.footers, options.pageNumbers].every((v) => typeof v === 'boolean')
  )
    throw new Error('Bitte Suchränder zwischen 3 und 25 Prozent wählen.');
  if (!options.headers && !options.footers)
    throw new Error('Bitte Kopfzeilen oder Fußzeilen zur Erkennung auswählen.');
}
function keyFor(text: string, pageNumbers: boolean, pages: number) {
  const textKey = text.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
  const romanValues: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const roman = [...textKey].reduce(
    (sum, c, i) =>
      sum +
      ((romanValues[c] || 0) < (romanValues[textKey[i + 1]] || 0) ? -1 : 1) * (romanValues[c] || 0),
    0,
  );
  const isPageRoman =
    /^(?=.)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/.test(textKey) &&
    roman > 0 &&
    roman <= pages + 20;
  if (
    pageNumbers &&
    (/^(?:seite|page|s\.|p\.)\s*\d{1,4}(?:\s*(?:von|of|\/|-)\s*\d{1,4})?$/.test(textKey) ||
      /^\d{1,4}\s*\/\s*\d{1,4}$/.test(textKey) ||
      (/^[-–—]?\s*\d{1,4}\s*[-–—]?$/.test(textKey) &&
        Number(textKey.replace(/\D/g, '')) <= pages + 20) ||
      isPageRoman)
  )
    return '#page-number';
  return textKey;
}
function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x),
    y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
export function detectMarginHits(pages: MarginPage[], options: MarginSettings): MarginHit[] {
  validateMarginSettings(options);
  if (!pages.length || pages.length > 200)
    throw new Error('Bitte eine PDF mit höchstens 200 Seiten verwenden.');
  const groups: { key: string; zone: MarginZone; rect: Rect; hits: MarginHit[] }[] = [];
  for (const page of pages) {
    for (const zone of ['header', 'footer'] as const) {
      if (!(zone === 'header' ? options.headers : options.footers)) continue;
      const words = page.targets
        .filter(
          (t) =>
            t.text.trim() &&
            validMarginRect(t) &&
            !t.unsupportedReason &&
            Math.abs(t.rotation || 0) < 5 &&
            (zone === 'header' ? t.y + t.h <= options.top / 100 : t.y >= 1 - options.bottom / 100),
        )
        .sort((a, b) => (Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.4 ? a.x - b.x : a.y - b.y));
      const lines: { text: string; rect: Rect }[] = [];
      for (const word of words) {
        const line = lines.findLast(
          (l) =>
            Math.abs(l.rect.y + l.rect.h / 2 - word.y - word.h / 2) <
              Math.max(l.rect.h, word.h) * 0.45 &&
            word.x >= l.rect.x + l.rect.w - 0.003 &&
            word.x - l.rect.x - l.rect.w < Math.max(0.018, word.h * 1.5),
        );
        if (line) {
          line.text += ' ' + word.text;
          line.rect = union(line.rect, word);
        } else
          lines.push({ text: word.text, rect: { x: word.x, y: word.y, w: word.w, h: word.h } });
      }
      for (const line of lines) {
        if (line.text.length > 500 || line.rect.h > 0.08) continue;
        const key = keyFor(line.text, options.pageNumbers, pages.length);
        if (!key) continue;
        const similar = (a: Rect, b: Rect) =>
          Math.abs(a.y + a.h / 2 - b.y - b.h / 2) < 0.012 &&
          Math.min(
            Math.abs(a.x - b.x),
            Math.abs(a.x + a.w - b.x - b.w),
            Math.abs(a.x + a.w / 2 - b.x - b.w / 2),
          ) < 0.035;
        let group = groups.find(
          (g) =>
            g.key === key &&
            g.zone === zone &&
            similar(g.rect, line.rect) &&
            !g.hits.some((h) => h.page === page.page),
        );
        if (!group) {
          group = { key, zone, rect: line.rect, hits: [] };
          groups.push(group);
        }
        // Keep a small visual padding, but never cross the allowed page edge band.
        const dx = 0.7 / page.width,
          dy = 0.7 / page.height,
          x = Math.max(0, line.rect.x - dx),
          y = Math.max(zone === 'header' ? 0 : 0.75, line.rect.y - dy);
        const rect = {
          x,
          y,
          w: Math.min(1, line.rect.x + line.rect.w + dx) - x,
          h: Math.min(zone === 'header' ? 0.25 : 1, line.rect.y + line.rect.h + dy) - y,
        };
        group.hits.push({
          id: `margin-${page.page}-${zone}-${group.hits.length}-${groups.indexOf(group)}`,
          page: page.page,
          zone,
          text: line.text,
          rect,
          selected: true,
          manual: false,
          group: `repeat-${groups.indexOf(group)}`,
        });
      }
    }
  }
  const hits = groups
    .filter((g) => new Set(g.hits.map((h) => h.page)).size >= 2)
    .flatMap((g) => g.hits)
    .sort((a, b) => a.page - b.page || a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  if (hits.length > 2000)
    throw new Error('Zu viele Fundstellen. Bitte die Suchränder verkleinern.');
  return hits;
}
export function validateMarginHits(hits: MarginHit[], pages: number) {
  if (!Array.isArray(hits) || hits.length > 2000 || pages < 1 || pages > 200)
    throw new Error('Bitte höchstens 2.000 Fundstellen auf 200 Seiten verwenden.');
  const ids = new Set<string>();
  for (const hit of hits) {
    if (
      typeof hit.id !== 'string' ||
      !hit.id ||
      ids.has(hit.id) ||
      !Number.isInteger(hit.page) ||
      hit.page < 0 ||
      hit.page >= pages ||
      typeof hit.text !== 'string' ||
      hit.text.length > 500 ||
      typeof hit.selected !== 'boolean' ||
      typeof hit.manual !== 'boolean' ||
      typeof hit.group !== 'string' ||
      marginZone(hit.rect) !== hit.zone
    )
      throw new Error('Die Trefferliste ist ungültig. Bitte erneut erkennen.');
    ids.add(hit.id);
  }
  const selected = hits.filter((h) => h.selected);
  if (!selected.length)
    throw new Error('Bitte mindestens eine Fundstelle zum Entfernen auswählen.');
  if (
    hits.some(
      (h) =>
        !h.selected && selected.some((s) => s.page === h.page && marginOverlap(h.rect, s.rect)),
    )
  )
    throw new Error(
      'Ein ausgewählter Bereich berührt eine ausgeschlossene Fundstelle. Bitte die Auswahl korrigieren.',
    );
  return selected;
}
