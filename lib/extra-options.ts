export const extraToolIds = [
  'extract-images',
  'compare',
  'pdf-info',
  'attachments',
  'split-ranges',
  'interleave',
  'booklet',
  'split-grid',
  'auto-crop',
  'bilevel',
  'invert',
  'stamp',
  'edit-metadata',
  'remove-annotations',
  'overlay',
] as const;
export type ExtraTool = (typeof extraToolIds)[number];
export const sourceOnlyTools: readonly string[] = [
  'extract-images',
  'compare',
  'pdf-info',
  'attachments',
];
export const rasterTools: readonly string[] = ['auto-crop', 'bilevel', 'invert'];
export const isExtraTool = (id: string): id is ExtraTool =>
  (extraToolIds as readonly string[]).includes(id);
export type ExtraOptions = {
  firstSource: string;
  secondSource: string;
  reverseSecond: boolean;
  interleaveMode?: 'two' | 'single';
  duplexSplit?: number;
  compareMode?: 'pages' | 'content';
  splitMode: 'every' | 'ranges';
  splitEvery: number;
  splitRanges: string;
  tileLayout: '2x1' | '1x2' | '2x2' | '3x3';
  cropPadding: number;
  threshold: number;
  stampText: string;
  stampDate: string;
  stampPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  stampColor: 'teal' | 'green' | 'red';
  metaTitle: string;
  metaAuthor: string;
  metaSubject: string;
  metaKeywords: string;
  removeLinks: boolean;
  overlayOpacity: number;
  overlayLayer: 'front' | 'back';
};
export const extraDefaults: ExtraOptions = {
  firstSource: '',
  secondSource: '',
  reverseSecond: false,
  interleaveMode: 'two',
  duplexSplit: 0,
  compareMode: 'pages',
  splitMode: 'every',
  splitEvery: 2,
  splitRanges: '',
  tileLayout: '2x1',
  cropPadding: 3,
  threshold: 180,
  stampText: 'GEPRÜFT',
  stampDate: '',
  stampPosition: 'top-right',
  stampColor: 'teal',
  metaTitle: '',
  metaAuthor: '',
  metaSubject: '',
  metaKeywords: '',
  removeLinks: false,
  overlayOpacity: 40,
  overlayLayer: 'front',
};
export function resolvePair<T extends { id: string }>(
  sources: T[],
  options: ExtraOptions,
): [T | undefined, T | undefined] {
  const first = sources.find((s) => s.id === options.firstSource) || sources[0];
  const second =
    sources.find((s) => s.id === options.secondSource && s.id !== first?.id) ||
    sources.find((s) => s.id !== first?.id);
  return [first, second];
}

/** Indices into the selected pages, never the original file's unselected pages. */
export function duplexOrder(count: number, split = 0, reverse = false) {
  if (!Number.isInteger(count) || count < 2 || count > 200)
    throw new Error('Bitte 2 bis 200 Seiten für die Duplex-Sortierung auswählen.');
  const boundary = split === 0 ? Math.ceil(count / 2) : split;
  if (!Number.isInteger(boundary) || boundary < 1 || boundary >= count)
    throw new Error(
      'Die Trennstelle muss zwischen der ersten und letzten ausgewählten Seite liegen.',
    );
  const fronts = Array.from({ length: boundary }, (_, i) => i);
  const backs = Array.from({ length: count - boundary }, (_, i) => boundary + i);
  if (reverse) backs.reverse();
  const order: number[] = [];
  for (let i = 0; i < Math.max(fronts.length, backs.length); i++) {
    if (i < fronts.length) order.push(fronts[i]);
    if (i < backs.length) order.push(backs[i]);
  }
  return { order, boundary, unequal: fronts.length !== backs.length };
}
