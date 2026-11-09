import { marked, type Token } from 'marked';
import type { JSONContent } from '@tiptap/core';
import { emptyWriterDocument, validateWriterDocument, type WriterSettings } from './writer-model';

export type TextImportFormat = 'markdown' | 'txt' | 'csv' | 'xml';
export type TextImportOptions = {
  delimiter: 'auto' | ',' | ';' | '\t' | '|';
  header: boolean;
  xmlLayout: 'tree' | 'table';
  paper: WriterSettings['paper'];
  landscape: boolean;
};
export const textImportDefaults: TextImportOptions = {
  delimiter: 'auto',
  header: true,
  xmlLayout: 'tree',
  paper: 'A4',
  landscape: false,
};
const text = (value: string, marks?: JSONContent['marks']): JSONContent[] =>
  value ? [{ type: 'text', text: value, ...(marks?.length ? { marks } : {}) }] : [];
const paragraph = (value: string): JSONContent => ({ type: 'paragraph', content: text(value) });

export function parseCsv(input: string, delimiter: string): string[][] {
  if (![',', ';', '\t', '|'].includes(delimiter)) throw new Error('Ungültiges CSV-Trennzeichen.');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const push = () => {
    row.push(cell);
    cell = '';
    closed = false;
    if (row.length > 12) throw new Error('Bitte höchstens 12 Spalten verwenden.');
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === delimiter) push();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      push();
      rows.push(row);
      row = [];
      if (rows.length > 2000) throw new Error('Bitte höchstens 2.000 Tabellenzeilen verwenden.');
    } else if (c === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error('Ungültige CSV-Anführungszeichen.');
      cell += c;
    }
  }
  if (quoted) throw new Error('Eine CSV-Zelle hat kein schließendes Anführungszeichen.');
  if (cell || row.length || closed) {
    push();
    rows.push(row);
  }
  if (!rows.length) throw new Error('Die Tabelle enthält keine Daten.');
  if (rows.length > 2000) throw new Error('Bitte höchstens 2.000 Tabellenzeilen verwenden.');
  const width = Math.max(...rows.map((r) => r.length));
  if (rows.some((r) => r.length !== width))
    throw new Error(
      'Die CSV-Zeilen haben unterschiedlich viele Spalten. Bitte das Trennzeichen prüfen.',
    );
  return rows;
}
export function detectDelimiter(input: string): string {
  const candidates = [',', ';', '\t', '|']
    .flatMap((d) => {
      try {
        const rows = parseCsv(input, d);
        return [{ d, width: rows[0].length }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.width - a.width);
  if (!candidates.length)
    throw new Error(
      'Die CSV konnte nicht gelesen werden. Bitte Trennzeichen und Anführungszeichen prüfen.',
    );
  return candidates[0].d;
}
function tables(rows: string[][], header: boolean): JSONContent[] {
  const heading = header ? rows[0] : undefined,
    data = header ? rows.slice(1) : rows;
  const result: JSONContent[] = [];
  for (let offset = 0; offset < Math.max(1, data.length); offset += 99) {
    const chunk = [...(heading ? [heading] : []), ...data.slice(offset, offset + 99)];
    result.push({
      type: 'table',
      content: chunk.map((row, i) => ({
        type: 'tableRow',
        content: row.map((cell) => ({
          type: heading && i === 0 ? 'tableHeader' : 'tableCell',
          content: [paragraph(cell)],
        })),
      })),
    });
  }
  return result;
}
function markdownBlocks(tokens: Token[], depth = 0): JSONContent[] {
  if (depth > 16) throw new Error('Das Markdown ist zu stark verschachtelt.');
  function inline(items: Token[], marks: JSONContent['marks'] = []): JSONContent[] {
    return items.flatMap((token): JSONContent[] => {
      switch (token.type) {
        case 'strong':
        case 'em':
        case 'del':
          return inline(token.tokens || [], [
            ...marks,
            { type: token.type === 'strong' ? 'bold' : token.type === 'em' ? 'italic' : 'strike' },
          ]);
        case 'codespan':
          return text(token.text, [
            ...marks,
            { type: 'textStyle', attrs: { fontFamily: 'MoinMono' } },
          ]);
        case 'br':
          return [{ type: 'hardBreak' }];
        case 'link':
          return [...inline(token.tokens || [], marks), ...text(` (${token.href})`, marks)];
        case 'image':
          return text(`[${token.text || token.href}]`, marks);
        default:
          return 'tokens' in token && Array.isArray(token.tokens)
            ? inline(token.tokens || [], marks)
            : text('text' in token ? String(token.text) : token.raw, marks);
      }
    });
  }
  return tokens.flatMap((token): JSONContent[] => {
    switch (token.type) {
      case 'space':
        return [];
      case 'heading':
        return [
          {
            type: 'heading',
            attrs: { level: Math.min(3, token.depth) },
            content: inline(token.tokens || []),
          },
        ];
      case 'paragraph':
      case 'text':
        return [
          {
            type: 'paragraph',
            content: token.tokens ? inline(token.tokens || []) : text(token.text),
          },
        ];
      case 'blockquote':
        return [{ type: 'blockquote', content: markdownBlocks(token.tokens || [], depth + 1) }];
      case 'list':
        return [
          {
            type: token.ordered ? 'orderedList' : 'bulletList',
            attrs: { start: token.start || 1 },
            content: token.items.map(
              (item: { tokens: Token[]; task: boolean; checked?: boolean }) => ({
                type: 'listItem',
                content: [
                  ...(item.task ? [paragraph(item.checked ? '[x]' : '[ ]')] : []),
                  ...markdownBlocks(item.tokens, depth + 1),
                ],
              }),
            ),
          },
        ];
      case 'code':
        return token.text.split('\n').map((line: string) => ({
          type: 'paragraph',
          content: text(line || ' ', [
            { type: 'textStyle', attrs: { fontFamily: 'MoinMono', fontSize: '9pt' } },
          ]),
        }));
      case 'hr':
        return [{ type: 'horizontalRule' }];
      case 'table': {
        if (token.header.length > 12 || token.rows.length > 2000)
          throw new Error('Die Markdown-Tabelle ist zu groß.');
        return tables(
          [
            token.header.map((c: { text: string }) => c.text),
            ...token.rows.map((r: { text: string }[]) => r.map((c) => c.text)),
          ],
          true,
        );
      }
      default:
        return [paragraph(token.raw)];
    }
  });
}
export function xmlRows(input: string, layout: 'tree' | 'table'): string[][] {
  if (/<!DOCTYPE|<!ENTITY/i.test(input))
    throw new Error('XML mit DTD oder Entitäten wird nicht unterstützt.');
  const doc = new DOMParser().parseFromString(input, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || !doc.documentElement)
    throw new Error('Die XML-Datei ist nicht wohlgeformt.');
  const rows: string[][] = [];
  let count = 0;
  function walk(el: Element, path: string, depth: number) {
    if (depth > 24 || ++count > 4000)
      throw new Error('Die XML-Datei ist zu groß oder zu stark verschachtelt.');
    for (const a of Array.from(el.attributes)) rows.push([`${path}/@${a.name}`, a.value]);
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 1) walk(n as Element, `${path}/${(n as Element).tagName}`, depth + 1);
      else if ((n.nodeType === 3 || n.nodeType === 4) && n.nodeValue?.trim())
        rows.push([path, n.nodeValue.trim()]);
    }
  }
  walk(doc.documentElement, doc.documentElement.tagName, 0);
  if (!rows.length) throw new Error('Die XML-Datei enthält keine Werte.');
  if (layout === 'tree') return rows;
  const children = Array.from(doc.documentElement.children);
  if (!children.length || children.some((e) => e.tagName !== children[0].tagName))
    throw new Error(
      'Für eine XML-Tabelle müssen die direkten Unterelemente gleichartige Datensätze sein.',
    );
  const keys: string[] = [];
  const records = children.map((record) => {
    const map = new Map<string, string>();
    for (const a of Array.from(record.attributes)) map.set('@' + a.name, a.value);
    if (Array.from(record.childNodes).some((n) => n.nodeType === 3 && n.nodeValue?.trim()))
      throw new Error('Gemischte XML-Inhalte bitte als Baum ausgeben.');
    for (const field of Array.from(record.children)) {
      if (field.children.length || field.attributes.length || map.has(field.tagName))
        throw new Error('Verschachtelte oder wiederholte XML-Felder bitte als Baum ausgeben.');
      map.set(field.tagName, field.textContent || '');
    }
    for (const key of map.keys()) if (!keys.includes(key)) keys.push(key);
    return map;
  });
  if (!keys.length || keys.length > 12 || records.length > 2000)
    throw new Error('Bitte höchstens 12 Spalten und 2.000 Datensätze verwenden.');
  return [keys, ...records.map((r) => keys.map((k) => r.get(k) || ''))];
}
export function textImportDocument(
  input: string,
  format: TextImportFormat,
  title: string,
  options: TextImportOptions,
) {
  input = input.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
  if (!input.trim() || input.length > 300000 || /\x00/.test(input))
    throw new Error('Bitte eine Textdatei mit 1 bis 300.000 Zeichen verwenden.');
  const doc = emptyWriterDocument(title.replace(/\.[^.]+$/, ''));
  doc.settings = {
    ...doc.settings,
    paper: options.paper,
    landscape: options.landscape,
    pageNumbers: true,
  };
  let content: JSONContent[];
  if (format === 'markdown') content = markdownBlocks(marked.lexer(input, { gfm: true }));
  else if (format === 'txt') content = input.split('\n').map(paragraph);
  else if (format === 'csv')
    content = tables(
      parseCsv(input, options.delimiter === 'auto' ? detectDelimiter(input) : options.delimiter),
      options.header,
    );
  else if (format === 'xml') {
    const rows = xmlRows(input, options.xmlLayout);
    content =
      options.xmlLayout === 'table'
        ? tables(rows, true)
        : rows.flatMap(([path, value]) => [
            { type: 'paragraph', content: text(path, [{ type: 'bold' }]) },
            paragraph(value),
          ]);
  } else throw new Error('Unbekanntes Textformat.');
  doc.content = { type: 'doc', content };
  return validateWriterDocument(doc);
}
