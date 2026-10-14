/** Pure helpers shared by the interface and its interaction checks. */
export function fileDragInfo(data: Pick<DataTransfer, 'items' | 'files' | 'types'> | null) {
  const items = Array.from(data?.items ?? []).filter((item) => item.kind === 'file');
  const count = items.length || data?.files.length || 0;
  return {
    isFiles: count > 0 || Array.from(data?.types ?? []).includes('Files'),
    // Some browsers protect both lists until drop. Never present a guessed count.
    count: count || null,
  };
}

export function fileDropLabel(count: number | null, language: 'de' | 'en') {
  if (!count || !Number.isInteger(count) || count < 1)
    return language === 'de' ? 'Dateien hier ablegen' : 'Drop files here';
  return language === 'de'
    ? `${count} ${count === 1 ? 'Datei' : 'Dateien'} hier ablegen`
    : `Drop ${count} ${count === 1 ? 'file' : 'files'} here`;
}

export type PagePosition = { id: string; left: number; top: number; width: number; height: number };

/** Resolve a pointer against stable layout slots, independent of animated transforms. */
export function pageDropDestination(slots: PagePosition[], movingId: string, x: number, y: number) {
  const from = slots.findIndex((slot) => slot.id === movingId);
  if (from < 0 || slots.length < 2) return -1;
  let closest = 0,
    distance = Infinity;
  slots.forEach((slot, index) => {
    const dx = Math.max(slot.left - x, 0, x - slot.left - slot.width);
    const dy = Math.max(slot.top - y, 0, y - slot.top - slot.height);
    const next = dx * dx + dy * dy;
    if (next < distance) {
      distance = next;
      closest = index;
    }
  });
  const target = slots[closest];
  const after =
    y > target.top + target.height || (y >= target.top && x >= target.left + target.width / 2);
  const gap = closest + (after ? 1 : 0);
  return Math.max(0, Math.min(slots.length - 1, gap > from ? gap - 1 : gap));
}

export function reorderPageItems<T extends { id: string }>(
  pages: T[],
  id: string,
  to: number,
): T[] {
  const from = pages.findIndex((page) => page.id === id);
  if (from < 0 || from === to || !Number.isInteger(to) || to < 0 || to >= pages.length)
    return pages;
  const next = pages.slice();
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** A toast may undo only the action it describes, once, and never while locked. */
export function createUndoFeedbackGate() {
  let revision = 0;
  return {
    invalidate: () => ++revision,
    consume(token: number, locked: boolean) {
      if (locked || token !== revision) return false;
      revision++;
      return true;
    },
  };
}

const searchStopWords = new Set([
  'ich',
  'mochte',
  'bitte',
  'meine',
  'mein',
  'eine',
  'einen',
  'ein',
  'und',
  'zu',
  'in',
  'i',
  'want',
  'please',
  'my',
  'the',
  'and',
  'to',
  'a',
  'an',
]);
const fold = (text: string) =>
  text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replaceAll('ß', 'ss');

/** Keep original Unicode offsets and return text, never HTML or a user-created regexp. */
export function highlightedSearchParts(text: string, query: string) {
  const terms = [...new Set(fold(query.slice(0, 300)).split(/[^\p{L}\p{N}]+/u))]
    .filter((term) => term.length > 1 && !searchStopWords.has(term))
    .slice(0, 20);
  if (!terms.length) return [{ text, match: false }];
  let normalized = '',
    offset = 0;
  const starts: number[] = [],
    ends: number[] = [];
  for (const character of text) {
    const folded = fold(character),
      end = offset + character.length;
    for (const unit of folded) {
      normalized += unit;
      for (let i = 0; i < unit.length; i++) {
        starts.push(offset);
        ends.push(end);
      }
    }
    if (!folded && ends.length) ends[ends.length - 1] = end;
    offset = end;
  }
  const ranges: [number, number][] = [];
  for (const term of terms) {
    for (let at = normalized.indexOf(term); at !== -1; at = normalized.indexOf(term, at + 1))
      ranges.push([starts[at], ends[at + term.length - 1]]);
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const parts: { text: string; match: boolean }[] = [];
  offset = 0;
  for (const [start, end] of merged) {
    if (start > offset) parts.push({ text: text.slice(offset, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    offset = end;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), match: false });
  return parts.length ? parts : [{ text, match: false }];
}
