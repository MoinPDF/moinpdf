import type { Bookmark } from './document-tools';
import { parseDelimited } from './table-data';

type Entry = { title: string; page: number; level: number; open?: boolean };
const invalid = () => new Error('Ungültige Lesezeichendatei. Titel, Zielseiten und Ebenen prüfen.');

export function importBookmarks(text: string, format: 'csv' | 'json', pages: number): Bookmark[] {
  if (text.length > 2_000_000)
    throw new Error('Die Lesezeichendatei darf höchstens 2 MB groß sein.');
  let entries: unknown;
  if (format === 'json') {
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch {
      throw invalid();
    }
    entries = Array.isArray(parsed) ? parsed : parsed?.version === 1 ? parsed.bookmarks : null;
  } else {
    const normalized = text.replace(/^\uFEFF/, '');
    const end = normalized.search(/[\r\n]/);
    if (end < 0) throw invalid();
    const headerText = normalized.slice(0, end);
    const delimiter = headerText.includes(';') ? ';' : headerText.includes('\t') ? '\t' : ',';
    const header = parseDelimited(headerText, delimiter)[0]?.map((v) => v.trim().toLowerCase());
    if (
      !header ||
      !['title', 'page', 'level'].every((v) => header.includes(v)) ||
      new Set(header).size !== header.length
    )
      throw invalid();
    const rows = parseDelimited(normalized.slice(end).replace(/^[\r\n]+/, ''), delimiter);
    entries = rows.map((row) => {
      if (row.length !== header.length) throw invalid();
      const cell = (key: string) => (header.includes(key) ? row[header.indexOf(key)] : '');
      const escaped = cell('escaped');
      if (escaped && !['true', 'false'].includes(escaped)) throw invalid();
      let title = cell('title');
      if (escaped === 'true' && title.startsWith("'")) title = title.slice(1);
      const open = cell('open');
      if (open && !['true', 'false'].includes(open)) throw invalid();
      if (!/^\d+$/.test(cell('page')) || !/^\d+$/.test(cell('level'))) throw invalid();
      return {
        title,
        page: Number(cell('page')),
        level: Number(cell('level')),
        open: open !== 'false',
      };
    });
  }
  if (
    !Number.isInteger(pages) ||
    pages < 1 ||
    !Array.isArray(entries) ||
    !entries.length ||
    entries.length > 1000
  )
    throw invalid();
  let previousLevel = 0;
  return entries.map((value: unknown, index) => {
    if (!value || typeof value !== 'object') throw invalid();
    const entry = value as Entry;
    if (
      typeof entry.title !== 'string' ||
      !entry.title.trim() ||
      entry.title.length > 300 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(entry.title) ||
      !Number.isInteger(entry.page) ||
      entry.page < 1 ||
      entry.page > pages ||
      !Number.isInteger(entry.level) ||
      entry.level < 1 ||
      entry.level > 31 ||
      entry.level > previousLevel + 1 ||
      (entry.open !== undefined && typeof entry.open !== 'boolean')
    )
      throw invalid();
    previousLevel = entry.level;
    return {
      id: `import-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, '0')).join('')}-${index}`,
      title: entry.title,
      page: entry.page - 1,
      depth: entry.level - 1,
      open: entry.open ?? true,
      targetChanged: true,
    };
  });
}

export function exportBookmarks(bookmarks: Bookmark[], format: 'csv' | 'json') {
  if (!bookmarks.length || bookmarks.some((b) => b.page === null))
    throw new Error(
      'Der Lesezeichenexport benötigt gültige interne Zielseiten. Externe Ziele zuerst zuordnen.',
    );
  const entries = bookmarks.map((b) => ({
    title: b.title,
    page: b.page! + 1,
    level: b.depth + 1,
    open: b.open,
  }));
  if (format === 'json') return JSON.stringify({ version: 1, bookmarks: entries }, null, 2);
  const rows = [
    ['title', 'page', 'level', 'open', 'escaped'],
    ...entries.map((entry) => {
      const escaped = /^[\s]*[=+@-]/.test(entry.title);
      return [
        escaped ? "'" + entry.title : entry.title,
        String(entry.page),
        String(entry.level),
        String(entry.open),
        String(escaped),
      ];
    }),
  ];
  return (
    '\uFEFF' +
    rows
      .map((row) => row.map((value) => '"' + value.replace(/"/g, '""') + '"').join(';'))
      .join('\r\n')
  );
}
