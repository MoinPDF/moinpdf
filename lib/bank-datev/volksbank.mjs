import { checkStatement, decimal } from './converter.mjs';
import { bankDate, bankMoney, headerIban } from './universal.mjs';

const table = /\bBu[.\s-]*Tag\s+Wert\s+Vorgang\b/i;
const pageNumber = /\bBlatt\s+(\d+)\s+von\s+(\d+)\b/i;
const number = /\bNr\.?\s*(\d+)\s*\/\s*(20\d\d)\b/i;
const marker = /\b(?:Volksbank|Raiffeisenbank|VR[ -]?Bank|Kontokorrent)\b/i;
const amount = '((?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2})\\s*([SH])';
const balance = new RegExp(
  '^(alter|neuer)\\s+Kontostand\\s+vom\\s+(\\d{2}\\.\\d{2}\\.\\d{4})\\s+' + amount + '$',
  'i',
);
const carry = new RegExp('^[ÜU]bertrag\\s+(auf|von)\\s+Blatt\\s+(\\d+)\\s+' + amount + '$', 'i');
const short = '(\\d{1,2}\\.\\d{1,2}\\.?(?:\\d{4})?)';
const postingStart = new RegExp('^' + short + '\\s+' + short + '(?=\\s)');
const posting = new RegExp(postingStart.source + '\\s+(.+?)\\s+' + amount + '$', 'i');

export const isVolksbankStatement = (first) =>
  marker.test(first) &&
  (table.test(first) ||
    (pageNumber.test(first) && /\b(?:alter\s+Kontostand|EUR-Konto)\b/i.test(first)));

const unreadable = (page) =>
  new Error('Eine Buchung auf Seite ' + page + ' ist nicht vollständig lesbar.');
const pageError = (page) =>
  new Error('Seite ' + page + ' fehlt oder steht in der falschen Reihenfolge.');
function shortDate(input, year) {
  return bankDate(input.replace(/^(\d{1,2}\.\d{1,2})$/, '$1.'), year);
}
function nearestValueDate(input, booking) {
  const year = +booking.slice(0, 4);
  return [year, year - 1, year + 1]
    .map((y) => shortDate(input, y))
    .filter(Boolean)
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a) - Date.parse(booking)) -
        Math.abs(Date.parse(b) - Date.parse(booking)),
    )[0];
}

export function parseVolksbank(pages, source, digest) {
  const first = pages[0],
    header = first.split(table)[0];
  const meta = header.match(number),
    total = Number(header.match(pageNumber)?.[2]);
  if (!meta || !total || total > pages.length)
    throw pageError(total > pages.length ? pages.length + 1 : 1);
  const currency = header.match(/\b([A-Z]{3})\s*[-–]\s*Konto\b/i)?.[1]?.toUpperCase();
  if (currency !== 'EUR')
    throw new Error(
      'Die Kontowährung ist nicht eindeutig EUR. Fremdwährungskonten werden noch nicht unterstützt.',
    );
  const iban = headerIban(header);
  const transactions = [];
  let opening, closing, running, expectedCarry, active;
  for (const [index, page] of pages.entries()) {
    const n = index + 1;
    const parts = page.split(table);
    if (n > total) {
      // Terms and fee annexes are commonly printed after the numbered statement.
      if (parts.length > 1 || page.split('\n').some((line) => postingStart.test(line.trim())))
        throw pageError(n);
      continue;
    }
    const head = parts[0],
      sheet = head.match(pageNumber),
      id = head.match(number);
    if (parts.length !== 2 || +sheet?.[1] !== n || +sheet?.[2] !== total) throw pageError(n);
    if (id?.[1] !== meta[1] || id?.[2] !== meta[2])
      throw new Error('Die Auszugsnummer wechselt innerhalb des PDFs.');
    const sheetIban = headerIban(head);
    if (sheetIban && iban && sheetIban !== iban)
      throw new Error('Der Auszug enthält unterschiedliche Bankkonten.');
    const lines = page.split('\n');
    let inside = false,
      sawStart = false,
      ended = false;
    active = null;
    for (const [li, raw] of lines.entries()) {
      const line = raw.trim();
      if (table.test(line)) {
        inside = true;
        continue;
      }
      if (!inside || !line || /^[\s─━═_=–—-]+$/u.test(line)) continue;
      const saldo = line.match(balance);
      if (saldo) {
        const date = bankDate(saldo[2]),
          cents = bankMoney(saldo[3] + saldo[4]).cents;
        if (!date) throw unreadable(n);
        if (saldo[1].toLowerCase() === 'alter') {
          if (n !== 1 || sawStart) throw unreadable(n);
          opening = { date, cents };
          running = cents;
          sawStart = true;
        } else {
          if (n !== total || !sawStart) throw unreadable(n);
          closing = { date, cents };
          ended = true;
          break;
        }
        continue;
      }
      const transfer = line.match(carry);
      if (transfer) {
        const next = transfer[1].toLowerCase() === 'auf';
        const cents = bankMoney(transfer[3] + transfer[4]).cents;
        if (
          +transfer[2] !== n + (next ? 1 : -1) ||
          cents !== running ||
          (next ? !sawStart || n === total : sawStart || cents !== expectedCarry)
        )
          throw pageError(n);
        if (next) {
          expectedCarry = cents;
          ended = true;
          break;
        }
        sawStart = true;
        continue;
      }
      const m = line.match(posting);
      if (m) {
        if (!sawStart) throw unreadable(n);
        const cents = bankMoney(m[4] + m[5]).cents;
        active = {
          id: digest.slice(0, 12) + '-' + n + '-' + (li + 1),
          booking_date: m[1],
          value_date: m[2],
          amount: decimal(cents),
          partner: m[3].trim(),
          description: m[3].trim(),
          page: n,
          line: li + 1,
          original: raw,
          counteraccount: '',
          tax_key: '',
        };
        transactions.push(active);
        running += cents;
      } else if (
        postingStart.test(line) ||
        /^(?:alter|neuer)\s+Kontostand\b|^[ÜU]bertrag\s+(?:auf|von)\s+Blatt/i.test(line)
      ) {
        throw unreadable(n);
      } else if (active) {
        active.description += ' ' + line;
        active.original += '\n' + raw;
      }
    }
    if (!ended) throw unreadable(n);
  }
  if (!opening || !closing)
    throw new Error('Anfangssaldo, Endsaldo oder Bankdaten sind nicht vollständig lesbar.');
  const years = [...new Set([+opening.date.slice(0, 4), +closing.date.slice(0, 4)])];
  for (const row of transactions) {
    const candidates = [...new Set(years.map((y) => shortDate(row.booking_date, y)))].filter(
      (d) => d && d >= opening.date && d <= closing.date,
    );
    if (candidates.length !== 1) throw unreadable(row.page);
    row.booking_date = candidates[0];
    row.value_date = nearestValueDate(row.value_date, row.booking_date);
    if (!row.value_date) throw unreadable(row.page);
  }
  const statement = {
    bank: 'Volksbank / Raiffeisenbank',
    source,
    sha256: digest,
    iban,
    statement_number: meta[1],
    period_start: opening.date,
    period_end: closing.date,
    opening_balance: decimal(opening.cents),
    closing_balance: decimal(closing.cents),
    pages: pages.length,
    transactions,
    notes: [],
  };
  statement.check = checkStatement(statement);
  return statement;
}

// Some dot-matrix fonts make OCR read a printed S as 5. The distinct debit and
// credit columns provide independent evidence. Never replace a digit in an amount.
export function normalizeVolksbankOcr(lines) {
  if (!lines.some((line) => table.test(line.text))) return lines;
  const debit = [],
    credit = [];
  for (const line of lines) {
    const match = line.text.trim().match(posting);
    if (!match) continue;
    const x = line.spans.at(-1)?.x;
    if (Number.isFinite(x)) (match[5].toUpperCase() === 'S' ? debit : credit).push(x);
  }
  return lines.map((line) => {
    const prefix = line.text.match(postingStart)?.[0];
    if (!prefix) return line;
    // Repair only the fixed transaction-type label immediately following the two dates.
    // Payees, references and free-form descriptions must retain their original reading.
    const label = line.text
      .slice(prefix.length)
      .replace(/^(\s*)[UÜ]berweisungs[gq]utschr(?=\.|ift\b)/i, '$1Überweisungsgutschr')
      .replace(/^(\s*)Echtzeit[ulü]berweisung\b/i, '$1Echtzeitüberweisung');
    let text = prefix + label;
    if (/\d,\d{2}\s+5\s*$/.test(text) && debit.length && credit.length) {
      const x = line.spans.at(-1)?.x;
      if (
        debit.some((left) => Math.abs(left - x) < 4) &&
        credit.every((right) => Math.abs(right - x) > 15)
      )
        text = text.replace(/5(\s*)$/, 'S$1');
    }
    return text === line.text ? line : { ...line, text };
  });
}
