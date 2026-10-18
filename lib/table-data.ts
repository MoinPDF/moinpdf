import JSZip from 'jszip';
import type { Rect } from './studio-engine';
import type { TextTarget } from './editor-model';

export function parseDelimited(input: string, delimiter?: string): string[][] {
  input = input.replace(/^\uFEFF/, '');
  if (input.length > 5_000_000) throw new Error('Die Tabelle darf höchstens 5 MB groß sein.');
  if (!delimiter) {
    const head = input.split(/\r?\n/)[0] || '';
    delimiter = [';', '\t', ','].sort((a, b) => head.split(b).length - head.split(a).length)[0];
  }
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
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
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
      closed = false;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
      closed = false;
    } else {
      if (closed && c.trim())
        throw new Error('Ungültige CSV: Zeichen nach einem geschlossenen Textfeld.');
      cell += c;
    }
    if (cell.length > 10000 || row.length > 100 || rows.length > 1000)
      throw new Error('Maximal 1.000 Zeilen, 100 Spalten und 10.000 Zeichen pro Zelle.');
  }
  if (quoted) throw new Error('Ungültige CSV: Ein Anführungszeichen ist nicht geschlossen.');
  row.push(cell);
  if (row.some((v) => v !== '')) rows.push(row);
  if (rows.length > 1000 || rows.some((r) => r.length > 100))
    throw new Error('Maximal 1.000 Zeilen und 100 Spalten.');
  return rows;
}
export const csvText = (rows: string[][]) =>
  '\uFEFF' +
  rows
    .map((row) =>
      row
        .map(
          (value) =>
            '"' + (/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"',
        )
        .join(';'),
    )
    .join('\r\n');
const xml = (text: string) =>
  text
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const col = (index: number) => {
  let out = '';
  for (index++; index; index = Math.floor((index - 1) / 26))
    out = String.fromCharCode(65 + ((index - 1) % 26)) + out;
  return out;
};
export type ColumnType = 'auto' | 'text' | 'number' | 'date';
export type TableExportOptions = {
  columns?: ColumnType[];
  locale?: 'de' | 'en';
  headerRows?: number;
};
// Only explicit, unambiguous values become numbers. Account numbers, leading
// zeroes, long identifiers and formula-like text must survive a round trip.
export function spreadsheetValue(
  input: string,
  type: ColumnType = 'text',
  locale: 'de' | 'en' = 'de',
): { value: number; style: number } | null {
  const text = input.trim();
  if (type === 'text' || !text || /^[=+@]/.test(text)) return null;
  if (type === 'auto' || type === 'date') {
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const local = locale === 'de' ? text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/) : null;
    if (iso || local) {
      const [year, month, day] = iso
        ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
        : [Number(local![3]), Number(local![2]), Number(local![1])];
      const stamp = Date.UTC(year, month - 1, day),
        date = new Date(stamp);
      if (
        year >= 1900 &&
        year <= 9999 &&
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        const serial = (stamp - Date.UTC(1899, 11, 31)) / 86400000;
        return { value: serial + (serial >= 60 ? 1 : 0), style: 1 };
      }
      return null;
    }
    if (type === 'date') return null;
  }
  const percent = /%$/.test(text);
  const currency = /(?:€|EUR)$/.test(text);
  const raw = text.replace(/\s*(?:%|€|EUR)$/, '').trim();
  const pattern =
    locale === 'de'
      ? /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/
      : /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
  if (!pattern.test(raw)) return null;
  const canonical =
    locale === 'de' ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  if (/^-?0\d/.test(canonical) || canonical.replace(/\D/g, '').replace(/^0+/, '').length > 15)
    return null;
  const value = Number(canonical) / (percent ? 100 : 1);
  return Number.isFinite(value) ? { value, style: percent ? 2 : currency ? 3 : 0 } : null;
}

export function joinTablePages(pages: string[][][], headerRows = 1, removeRepeatedHeaders = true) {
  const rows: string[][] = [];
  let header: string[][] | undefined;
  const same = (a: string[], b: string[]) =>
    a.length === b.length &&
    a.every((v, i) => v.trim().replace(/\s+/g, ' ') === b[i].trim().replace(/\s+/g, ' '));
  for (const page of pages) {
    if (!page.length) continue;
    if (!header) {
      header = page.slice(0, headerRows);
      rows.push(...page);
    } else {
      const repeated =
        removeRepeatedHeaders &&
        headerRows > 0 &&
        header.length === headerRows &&
        page.length >= headerRows &&
        header.every((r, i) => same(r, page[i]));
      rows.push(...page.slice(repeated ? headerRows : 0));
    }
  }
  if (rows.length > 10000 || rows.some((r) => r.length > 100))
    throw new Error('Maximal 10.000 Zeilen und 100 Spalten.');
  return rows;
}

export async function makeXlsx(
  rows: string[][],
  sheetName = 'Tabelle',
  options: TableExportOptions = {},
) {
  const zip = new JSZip(),
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  zip.file(
    'xl/workbook.xml',
    `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<worksheet xmlns="${ns}"><sheetData>${rows
      .map(
        (row, y) =>
          `<row r="${y + 1}">${row
            .map((value, x) => {
              let type = options.columns?.[x] || 'text';
              const header = rows
                .slice(0, options.headerRows ?? 0)
                .map((r) => r[x] || '')
                .join(' ');
              if (
                y < (options.headerRows ?? 0) ||
                (type === 'auto' &&
                  /\b(?:id|iban|bic|konto|kontonummer|plz|postcode|zip|telefon|phone|artikelnummer|nummer|nr)\b/i.test(
                    header,
                  ))
              )
                type = 'text';
              const parsed = spreadsheetValue(value, type, options.locale);
              return parsed
                ? `<c r="${col(x)}${y + 1}" s="${parsed.style}"><v>${parsed.value}</v></c>`
                : `<c r="${col(x)}${y + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
            })
            .join('')}</row>`,
      )
      .join('')}</sheetData></worksheet>`,
  );
  // Explicit styles keep numeric/date semantics in Excel and LibreOffice.
  zip.file(
    'xl/styles.xml',
    `<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;€&quot;"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4">${[0, 14, 10, 164].map((id) => `<xf numFmtId="${id}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  );
  zip.file(
    '[Content_Types].xml',
    (await zip.file('[Content_Types].xml')!.async('string')).replace(
      '</Types>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ),
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    (await zip.file('xl/_rels/workbook.xml.rels')!.async('string')).replace(
      '</Relationships>',
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
  );
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
}
// Coordinates are normalized to the displayed page, including its rotation.
export function tableFromTargets(targets: TextTarget[], area: Rect, boundaries: number[]) {
  const edges = [
    area.x,
    ...new Set(boundaries.filter((x) => x > area.x && x < area.x + area.w).sort((a, b) => a - b)),
    area.x + area.w,
  ];
  const candidates = targets
    .filter(
      (t) =>
        t.x + t.w / 2 >= area.x &&
        t.x + t.w / 2 <= area.x + area.w &&
        t.y + t.h / 2 >= area.y &&
        t.y + t.h / 2 <= area.y + area.h,
    )
    .sort((a, b) => a.y + a.h / 2 - b.y - b.h / 2 || a.x - b.x);
  const lines: { center: number; height: number; items: TextTarget[] }[] = [];
  for (const t of candidates) {
    const center = t.y + t.h / 2;
    let line = lines.find(
      (l) => Math.abs(l.center - center) < Math.max(0.003, Math.min(l.height, t.h) * 0.45),
    );
    if (!line) {
      line = { center, height: t.h, items: [] };
      lines.push(line);
    }
    line.items.push(t);
  }
  return lines.map((line) => {
    const row = Array.from({ length: edges.length - 1 }, () => [] as TextTarget[]);
    for (const t of line.items) {
      let at = edges.findIndex((e, i) => i > 0 && t.x + t.w / 2 < e) - 1;
      if (at < 0) at = row.length - 1;
      row[at].push(t);
    }
    return row.map((cell) =>
      cell
        .sort((a, b) => a.x - b.x)
        .map((t) => t.text)
        .join(' '),
    );
  });
}
