import { renderPage, uid, type Source } from '../pdf-engine';
import { readPdfText } from '../pdf-text';
import { createEditorRecognizer, imageCoverage, readableEditorText } from '../editor-analysis';
import { isVolksbankStatement, recoverVolksbankOcrSigns } from './volksbank.mjs';
import { exportFiles, parseStatement } from './converter.mjs';
import {
  bankMoney,
  draftToStatement,
  extractDraft,
  positionedLines,
  statementHeader,
  statementPeriod,
} from './universal.mjs';
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
};
export type Settings = typeof emptySettings;
export interface Entry {
  draft: Draft;
  settings: Settings;
}
export type Entries = Record<string, Entry>;
export type ExportFile = { name: string; bytes: Uint8Array<ArrayBuffer> };

type Lines = ReturnType<typeof positionedLines>;
const unreadable = (page: number) =>
  new Error(
    'Seite ' +
      page +
      ' des Kontoauszugs ist nicht lesbar. Bitte die Original-PDF oder einen schärferen Scan öffnen.',
  );

function pageEvidence(lines: Lines) {
  const postings = lines.filter(
    (l) =>
      /^\s*(?:\d{1,2}\.\d{1,2}\.?|\d{4}-\d{2}-\d{2})/.test(l.text) &&
      /\d[.,]\d{2}(?:\s*[SH+-])?\s*$/i.test(l.text),
  ).length;
  const balances = lines.filter(
    (l) => /saldo|kontostand|bestand|balance|Übertrag/i.test(l.text) && /[.,]\d{2}/.test(l.text),
  ).length;
  const letters =
    lines
      .filter((l) => readableEditorText(l.text))
      .map((l) => l.text)
      .join(' ')
      .match(/[\p{L}]{2,}/gu)?.length || 0;
  return { postings, balances, letters };
}
async function scanPage(
  source: Source,
  index: number,
  nativeLines: Lines,
  recognizer: ReturnType<typeof createEditorRecognizer>,
  signal: AbortSignal,
  side: number,
): Promise<Lines> {
  const native = pageEvidence(nativeLines);
  const rendered = await renderPage(source, { index, rotation: 0 }, side, signal);
  const { canvas, scale } = rendered;
  try {
    const result = await recognizer.recognize(canvas, 'deu+eng', () => {});
    const items = (result.blocks || []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.flatMap((line) =>
          line.words.map((word) => ({
            str: word.text,
            transform: [1, 0, 0, 1, word.bbox.x0 / scale, (canvas.height - line.bbox.y1) / scale],
            width: (word.bbox.x1 - word.bbox.x0) / scale,
          })),
        ),
      ),
    );
    const recognized = recoverVolksbankOcrSigns(positionedLines(items)),
      ocr = pageEvidence(recognized);
    if (ocr.letters < 3 && !native.postings && !native.balances) return [];
    // Use one layout. Combining both text layers could double-post a transaction.
    if (
      ocr.letters >= 3 &&
      (ocr.postings > native.postings ||
        (ocr.postings === native.postings &&
          (ocr.balances > native.balances ||
            (ocr.balances === native.balances && ocr.letters > native.letters * 1.25))))
    )
      return recognized;
    return nativeLines;
  } catch {
    signal.throwIfAborted();
    return [];
  } finally {
    canvas.width = canvas.height = 0;
  }
}
export async function readStatement(source: Source, signal: AbortSignal): Promise<Entry> {
  if (source.size > 25 * 1024 * 1024 || source.pdf.numPages > 250)
    throw new Error('Höchstens 25 MB und 250 Seiten je Auszug.');
  const native: Lines[] = [],
    scanned: number[] = [];
  for (let i = 0; i < source.pdf.numPages; i++) {
    signal.throwIfAborted();
    const page = await source.pdf.getPage(i + 1);
    let lines: Lines = [];
    try {
      lines = positionedLines((await readPdfText(page)).items);
    } catch {
      signal.throwIfAborted();
    }
    native.push(lines);
    if (page.isPureXfa) continue;
    let needsOcr = pageEvidence(lines).letters < 4;
    if (!needsOcr) {
      try {
        const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        needsOcr =
          imageCoverage(await page.getOperatorList(), OPS, page.getViewport({ scale: 1 })) >= 0.12;
      } catch {
        signal.throwIfAborted();
        needsOcr = true;
      }
    }
    if (needsOcr) scanned.push(i);
  }
  async function readLayout(dense: boolean, requireVolksbank = false) {
    const layouts = native.slice();
    const recognizer = createEditorRecognizer(signal, dense ? '6' : undefined);
    try {
      for (const index of scanned) {
        signal.throwIfAborted();
        try {
          layouts[index] = await scanPage(
            source,
            index,
            native[index],
            recognizer,
            signal,
            dense ? 3200 : 2850,
          );
        } catch {
          signal.throwIfAborted();
          throw unreadable(index + 1);
        }
      }
    } finally {
      await recognizer.dispose().catch(() => {});
    }
    signal.throwIfAborted();
    const empty = layouts.findIndex((lines) => !lines.length);
    if (empty >= 0) throw unreadable(empty + 1);
    const pages = layouts.map((lines) => lines.map((line) => line.text).join('\n'));
    if (requireVolksbank && !isVolksbankStatement(pages[0])) throw unreadable(1);
    if (isVolksbankStatement(pages[0])) knownVolksbank = true;
    return parsePages(source, pages, layouts);
  }
  let knownVolksbank = false,
    first: Entry | undefined,
    problem: unknown;
  try {
    first = await readLayout(false);
  } catch (error) {
    signal.throwIfAborted();
    problem = error;
  }
  if (scanned.length && (!first || balanceDifference(first.draft) !== 0)) {
    // Retry the original pixels as a uniform table only when the first reading cannot reconcile.
    try {
      const second = await readLayout(true, knownVolksbank);
      if (!first || balanceDifference(second.draft) === 0) return second;
    } catch (error) {
      signal.throwIfAborted();
      problem = error;
    }
  }
  if (first) return first;
  throw problem;
}
function parsePages(source: Source, pages: string[], layouts: Lines[]): Entry {
  const digest = source.originalDigest || source.id;
  let draft: Draft;
  try {
    const parsed = parseStatement(pages, source.name, digest);
    const period = statementPeriod(statementHeader(pages[0]));
    draft = {
      ...parsed,
      period_start: period?.start ?? parsed.period_start,
      period_end: period?.end ?? parsed.period_end,
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
    if (isVolksbankStatement(pages[0])) throw error;
    draft = extractDraft(pages, source.name, digest, {
      layouts,
      reason: (error as Error).message,
      scan: pages.every((page) => !page.trim()),
    }) as Draft;
    if (!draft.rows.length)
      throw new Error(
        'Keine lesbaren Buchungen gefunden. Bitte die Original-PDF der Bank oder einen schärferen Scan öffnen.',
      );
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
