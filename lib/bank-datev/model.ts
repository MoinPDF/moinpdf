import { uid, type Source } from '../pdf-engine';
import { exportFiles, parseStatement } from './converter.mjs';
import { bankMoney, draftToStatement, extractDraft, positionedLines } from './universal.mjs';
import columns from './datev-columns.json';

export interface Row {
  id: string;
  booking_date: string;
  value_date: string;
  amount: string;
  direction: string;
  text: string;
  page: number;
  line: number;
  original: string;
  counteraccount: string;
  tax_key: string;
  notes: string[];
}

export interface Draft {
  rows: Row[];
  source: string;
  sha256: string;
  bank: string;
  iban: string;
  currency: string;
  detected_currency: string;
  statement_number: string;
  period_start: string;
  period_end: string;
  opening_balance: string;
  closing_balance: string;
  pages: number;
  source_pages: string[];
  warnings: string[];
  confirmed: boolean;
}

export const emptySettings = {
  account_framework: '03',
  bank_account: '',
  counteraccount: '',
  adviser: '',
  client: '',
  account_length: '',
  fiscal: '',
};
export type Settings = typeof emptySettings;
export interface Entry {
  draft: Draft;
  settings: Settings;
}
export type Entries = Record<string, Entry>;
export type ExportFile = { name: string; bytes: Uint8Array<ArrayBuffer> };

export async function readStatement(source: Source, signal: AbortSignal): Promise<Entry> {
  if (source.size > 25 * 1024 * 1024 || source.pdf.numPages > 250)
    throw new Error('Höchstens 25 MB und 250 Seiten je Auszug.');
  const pages: string[] = [],
    layouts = [];
  for (let i = 1; i <= source.pdf.numPages; i++) {
    signal.throwIfAborted();
    const page = await source.pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = positionedLines(content.items);
    layouts.push(lines);
    pages.push(lines.map((line: { text: string }) => line.text).join('\n'));
  }
  signal.throwIfAborted();
  const digest = source.originalDigest || source.id;
  let draft: Draft;
  try {
    const parsed = parseStatement(pages, source.name, digest);
    draft = {
      ...parsed,
      detected_currency: 'EUR',
      currency: 'EUR',
      source_pages: pages,
      warnings: parsed.notes,
      confirmed: false,
      rows: parsed.transactions.map(
        (row: {
          id: string;
          booking_date: string;
          value_date: string;
          amount: string;
          partner: string;
          description: string;
          page: number;
          line: number;
          original: string;
        }) => ({
          ...row,
          amount: row.amount.replace('-', '').replace('.', ','),
          direction: row.amount.startsWith('-') ? 'debit' : 'credit',
          text: (row.description.startsWith(row.partner)
            ? row.description
            : [row.partner, row.description].join(' ')
          ).trim(),
          counteraccount: '',
          tax_key: '',
          notes: [],
        }),
      ),
    };
  } catch (error) {
    draft = extractDraft(pages, source.name, digest, {
      layouts,
      reason: (error as Error).message,
      scan: pages.every((page) => !page.trim()),
    }) as Draft;
  }
  return { draft, settings: { ...emptySettings } };
}

export function signedAmount(row: Row) {
  return (row.direction === 'debit' ? '-' : row.direction === 'credit' ? '+' : '') + row.amount;
}

export function updateAmount(input: string) {
  const value = input.trim().replace('−', '-');
  return {
    amount: value.replace(/^[-+]/, ''),
    direction: value.startsWith('-') ? 'debit' : value.startsWith('+') ? 'credit' : '',
  };
}

export function balanceDifference(draft: Draft): number | null {
  try {
    let balance = bankMoney(draft.opening_balance).cents;
    for (const row of draft.rows) {
      if (!['debit', 'credit'].includes(row.direction)) return null;
      const cents = bankMoney(row.amount).cents;
      if (cents <= 0) return null;
      balance += row.direction === 'debit' ? -cents : cents;
      if (!Number.isSafeInteger(balance)) return null;
    }
    return (balance - bankMoney(draft.closing_balance).cents) / 100;
  } catch {
    return null;
  }
}

export function exportEntries(entries: Entry[]): ExportFile[] {
  const seen = new Set<string>();
  return entries.flatMap(({ draft, settings }) => {
    if (draft.iban) {
      const identity = [
        draft.iban.replace(/\s/g, '').toUpperCase(),
        draft.statement_number,
        draft.period_start,
        draft.period_end,
      ].join('|');
      if (seen.has(identity)) throw new Error('Derselbe Kontoauszug ist mehrfach enthalten.');
      seen.add(identity);
    }
    if (seen.has(draft.sha256)) throw new Error('Derselbe Kontoauszug ist mehrfach enthalten.');
    seen.add(draft.sha256);
    const statement = draftToStatement({
      ...draft,
      rows: draft.rows.map((row) => ({
        ...row,
        counteraccount: row.counteraccount || settings.counteraccount,
      })),
    });
    statement.bank = draft.bank;
    return exportFiles(statement, columns, settings) as ExportFile[];
  });
}

export function blankRow(): Row {
  return {
    id: uid(),
    booking_date: '',
    value_date: '',
    amount: '',
    direction: '',
    text: '',
    page: 1,
    line: 0,
    original: 'Manuell erfasst.',
    counteraccount: '',
    tax_key: '',
    notes: [],
  };
}
