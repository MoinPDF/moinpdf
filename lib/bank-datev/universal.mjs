import { decimal, checkStatement } from './converter.mjs';

const dateToken = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\.\\d{1,2}\\.(?:\\d{4}|\\d{2})?)';
const amountToken =
  '(?<![\\d.,/])[-+−]?\\s*(?:\\d{1,3}(?:[.,\u2019\x27]\\d{3})+|\\d+)[.,]\\d{2}(?![\\d.,/])(?:\\s*(?:EUR|€))?(?:\\s*(?:[-+−]|CR\\b|DR\\b|[SH]\\b))?';
const startsDate = new RegExp('^\\s*(' + dateToken + ')(?=\\s|$)');
const openingLabel =
  /^\s*(?:alter\s+(?:kontostand|saldo)|anfangs(?:saldo|bestand)|eröffnungs(?:saldo|bestand)|saldovortrag|vortragssaldo|saldo\s+(?:alt|vortrag|zu\s+beginn)|kontostand\s+(?:alt|zu\s+beginn|am\s+anfang)|opening\s+balance|previous\s+balance|kontostand\s+am.+auszug\s+nr)/i;
const closingLabel =
  /^\s*(?:neuer?\s+(?:kontostand|saldo)|end(?:saldo|bestand)|schluss(?:saldo|bestand)|abschluss(?:saldo|bestand)|saldo\s+(?:neu|am\s+ende)|kontostand\s+(?:neu|am\s+ende)|closing\s+balance|ending\s+balance|kontostand\s+am.+um\s+\d)/i;
const footer =
  /^(?:Seite\s*\d|Seite-Nr\.|Page\s*\d|Fortsetzung|Übertrag|Zwischensaldo|Zwischensumme|Folgeseite|Summe\b|Gesamtsumme\b)/i;
function validDate(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 &&
    y <= 2099 &&
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d
    ? t.toISOString().slice(0, 10)
    : '';
}
export function bankDate(value, year = '') {
  const v = String(value).trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?$/);
  if (!m) return '';
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : +m[3]) : +year;
  return y ? validDate(y, +m[2], +m[1]) : '';
}
export function bankMoney(value) {
  let v = String(value).trim().replaceAll('−', '-').replace(/EUR|€/gi, '').replace(/\s/g, '');
  let negative = false,
    positive = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (/(?:DR|S)$/i.test(v)) {
    negative = true;
    v = v.replace(/(?:DR|S)$/i, '');
  }
  if (/(?:CR|H)$/i.test(v)) {
    positive = true;
    v = v.replace(/(?:CR|H)$/i, '');
  }
  if (v.startsWith('-')) {
    negative = true;
    v = v.slice(1);
  }
  if (v.endsWith('-')) {
    negative = true;
    v = v.slice(0, -1);
  }
  if (v.startsWith('+')) {
    positive = true;
    v = v.slice(1);
  }
  if (v.endsWith('+')) {
    positive = true;
    v = v.slice(0, -1);
  }
  if (negative && positive) throw new Error('Widersprüchliche Vorzeichen.');
  let normalized;
  if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(v) || /^\d+,\d{2}$/.test(v))
    normalized = v.replaceAll('.', '').replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(v) || /^\d+\.\d{2}$/.test(v))
    normalized = v.replaceAll(',', '');
  else if (/^\d{1,3}(?:['’]\d{3})+[.,]\d{2}$/.test(v))
    normalized = v.replace(/['’]/g, '').replace(',', '.');
  else throw new Error('Betrag bitte mit zwei Nachkommastellen eingeben.');
  const cents = Number(normalized.replace('.', ''));
  if (!Number.isSafeInteger(cents)) throw new Error('Der Betrag ist zu groß.');
  return {
    cents: negative ? -cents : cents,
    direction: negative ? 'debit' : positive ? 'credit' : '',
  };
}
function displayMoney(cents) {
  return decimal(cents).replace('.', ',');
}
function locatedX(row, index) {
  const span = row?.spans?.find((s) => index >= s.start && index < s.end);
  return span
    ? span.x + (span.width * (index - span.start)) / Math.max(1, span.end - span.start)
    : null;
}
export function positionedLines(items) {
  const groups = [];
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const y = item.transform[5];
    let g = groups.find((g) => Math.abs(g.y - y) < 3.6);
    if (!g) {
      g = { y, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups
    .sort((a, b) => b.y - a.y)
    .map((g) => {
      let text = '',
        end = null;
      const spans = [];
      for (const item of g.items.sort((a, b) => a.transform[4] - b.transform[4])) {
        const x = item.transform[4];
        if (end !== null) {
          const gap = x - end;
          text += gap > 10 ? '   ' : gap > 1.3 ? ' ' : '';
        }
        const start = text.length;
        text += item.str.replaceAll('\u00a0', ' ').replaceAll('−', '-');
        spans.push({ start, end: text.length, x, width: item.width });
        end = x + item.width;
      }
      return { text, spans };
    });
}
function columnLabels(text, row) {
  const result = {};
  for (const [name, pattern] of [
    ['debit', /\b(Soll|Belastung(?:en)?|Debit|Ausgaben|Abgänge)\b/gi],
    ['credit', /\b(Haben|Gutschriften|Credit|Einnahmen|Zugänge)\b/gi],
    ['amount', /\b(Betrag|Umsatz|Amount)\b/gi],
    ['balance', /\b(Saldo|Balance)\b/gi],
  ]) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length === 1) {
      const x = locatedX(row, matches[0].index + matches[0][0].length - 1);
      if (x !== null) result[name] = x;
    }
  }
  return result;
}
function moneyMatches(line) {
  return [...line.matchAll(new RegExp(amountToken, 'gi'))].map((m) => {
    const before = line.slice(0, m.index),
      after = line.slice(m.index + m[0].length),
      close = after.match(/^\s*\)/);
    if (/\(\s*$/.test(before) && close) {
      const start = before.lastIndexOf('(');
      return Object.assign([line.slice(start, m.index + m[0].length + close[0].length)], {
        index: start,
      });
    }
    return m;
  });
}
function balanceValue(line) {
  const matches = moneyMatches(line);
  if (!matches.length) return null;
  try {
    const amount = bankMoney(matches.at(-1)[0]);
    return {
      value: displayMoney(amount.cents),
      date: bankDate(line.match(new RegExp(dateToken))?.[0] || ''),
    };
  } catch {
    return null;
  }
}
function balanceAt(lines, index) {
  const value = balanceValue(lines[index]);
  if (value) return value;
  const following = (lines[index + 1] || '').trim();
  if (!new RegExp('^(?:EUR\\s*)?' + amountToken + '$', 'i').test(following)) return null;
  return balanceValue(lines[index] + ' ' + following);
}
// Read only the statement header so account references in individual transfers
// cannot become the holder's IBAN or statement number.
export function statementHeader(page) {
  const lines = (page || '').split('\n').slice(0, 80);
  const end = lines.findIndex(
    (line) =>
      /^(?:Datum|Buchungstag|Buchungsdatum|Booking date|Date)\b.+(?:Betrag|Umsatz|Valuta|Amount|Soll|Haben|Debit|Credit)\b/i.test(
        line.trim(),
      ) ||
      (startsDate.test(line) &&
        !/\s(?:bis|to|[–—-])\s/i.test(line) &&
        moneyMatches(line).some((m) => m.index >= line.match(startsDate)[0].length)),
  );
  return (end < 0 ? lines : lines.slice(0, end)).join('\n');
}
export function statementPeriod(header) {
  const dates = '(' + dateToken + ')';
  const range = new RegExp(
    dates + '\\s*(?:bis(?:\\s+(?:zum|einschließlich))?|to|[-–—])\\s*' + dates + '(?!\\d)',
    'i',
  );
  for (const line of header.split('\n')) {
    if (
      !/^(?:\s*(?:Auszugszeitraum|Abrechnungszeitraum|Berichtszeitraum|Buchungszeitraum|Zeitraum|Periode|Kontoauszug|Konto-Auszug|Auszug|Statement|Period|vom|von|für die Zeit|\d))/i.test(
        line,
      )
    )
      continue;
    const m = range.exec(line);
    if (!m) continue;
    let start = bankDate(m[1]),
      end = bankDate(m[2]);
    if (!start && end) {
      const year = Number(end.slice(0, 4));
      start = bankDate(m[1], year);
      if (start > end) start = bankDate(m[1], year - 1);
    } else if (start && !end) {
      const year = Number(start.slice(0, 4));
      end = bankDate(m[2], year);
      if (end < start) end = bankDate(m[2], year + 1);
    }
    if (start && end && start <= end) return { start, end };
  }
  return null;
}
export function headerIban(header) {
  for (const line of header.split('\n')) {
    const start =
      /(?:\bIBAN\s*[:.]?\s*|\b(?:Geschäftsgirokonto|Girokonto|Kontonummer)\s*:?\s*)([A-Z]{2}\s*\d{2}[A-Z0-9 \t-]*)/i.exec(
        line,
      );
    if (!start) continue;
    const compact = start[1].toUpperCase().replace(/[ \t-]/g, '');
    // Validate the complete domestic IBAN length. For other countries end on
    // a token boundary, e.g. before a following BIC label on the same line.
    if (compact.startsWith('DE')) {
      const iban = compact.slice(0, 22);
      if (validIban(iban) && /^DE\d{20}$/.test(iban)) return iban;
    } else {
      const iban = start[1]
        .split(/\s+(?:BIC|SWIFT|Währung|Currency)\b/i)[0]
        .trim()
        .toUpperCase()
        .replace(/[ \t-]/g, '');
      if (validIban(iban)) return iban;
    }
  }
  return '';
}
/** @param {string[]} pages
 * @param {string} source
 * @param {string} digest
 * @param {{layouts?: ReturnType<typeof positionedLines>[], reason?: string, scan?: boolean}} options
 */
export function extractDraft(
  pages,
  source,
  digest,
  { layouts = [], reason = '', scan = false } = {},
) {
  const prefix = statementHeader(pages[0]);
  const period = statementPeriod(prefix);
  const years = [
    ...new Set(
      [
        ...(pages[0] || '')
          .split('\n')
          .slice(0, 25)
          .join('\n')
          .matchAll(/\b(?:20\d{2})\b/g),
      ].map((m) => m[0]),
    ),
  ];
  const year = years.length === 1 ? years[0] : '';
  const currencyMatch = prefix.match(
    /(?:Konto[- ]?w(?:ä|ae)hrung|Account currency|Currency|W(?:ä|ae)hrung)\s*:?\s*([A-Z]{3})\b/i,
  );
  const detectedCurrency = currencyMatch?.[1].toUpperCase() || '';
  const amountHeader =
    (pages[0] || '')
      .split('\n')
      .find(
        (line) =>
          /\b(?:Datum|Valuta|Buchungsdatum|Booking|Date)\b/i.test(line) &&
          /\b(?:Betrag|Amount|Soll|Haben|Credit|Debit)\b/i.test(line),
      ) || '';
  const eur = /\bEUR(?:O)?\b|€/i.test(prefix + '\n' + amountHeader);
  const d = {
    source,
    sha256: digest,
    pages: pages.length,
    source_pages: pages,
    reason,
    scan,
    bank: 'Kontoauszug',
    iban: '',
    statement_number: '',
    period_start: '',
    period_end: '',
    opening_balance: '',
    closing_balance: '',
    currency: detectedCurrency || (eur ? 'EUR' : ''),
    detected_currency: detectedCurrency,
    rows: [],
    warnings: [],
    confirmed: false,
    manual_sequence: 0,
  };
  d.iban = headerIban(prefix);
  const number = prefix.match(
    /\b(?:Konto[- ]?auszug|Auszugsnummer|Auszug|Statement)(?:[ -]*(?:Nr\.?|Nummer|No\.?))?\s*[:#]?\s*(\d{1,8}(?:[-/]\d{1,6})?)(?![\w.,/-])/i,
  );
  if (number && number[1].length <= 12) d.statement_number = number[1];
  function postingDate(value) {
    const date = bankDate(value);
    if (date || !period) return date || bankDate(value, year);
    const candidates = [...new Set([period.start.slice(0, 4), period.end.slice(0, 4)])]
      .map((y) => bankDate(value, y))
      .filter((d) => d && d >= period.start && d <= period.end);
    return candidates.length === 1 ? candidates[0] : '';
  }
  let opening = null,
    closing = null,
    datedBalances = [],
    active = null,
    sectionDate = '',
    columns = {};
  function finish() {
    if (!active) return;
    active.text = [active.text, ...active.continuations].filter(Boolean).join(' ');
    active.original = [active.original, ...active.continuations].join('\n');
    delete active.continuations;
    d.rows.push(active);
    active = null;
  }
  for (let p = 0; p < pages.length; p++) {
    const lines = pages[p].split('\n');
    let pageFooter = false;
    for (let l = 0; l < lines.length; l++) {
      const raw = lines[l],
        line = raw.trim(),
        layout = layouts[p]?.[l];
      if (!line) continue;
      if (openingLabel.test(line)) {
        finish();
        opening = opening || balanceAt(lines, l);
        continue;
      }
      if (closingLabel.test(line)) {
        finish();
        closing = balanceAt(lines, l) || closing;
        pageFooter = true;
        continue;
      }
      if (/^(?:Kontostand|Saldo|Balance)\s+(?:am|per|zum|vom|as (?:at|of))\s/i.test(line)) {
        finish();
        const balance = balanceAt(lines, l);
        if (balance?.date) datedBalances.push(balance);
        continue;
      }
      const labelColumns = columnLabels(raw, layout);
      if (
        (/\b(Datum|Buchungstag|Buchungsdatum|Booking|Date|Valuta)\b/i.test(line) &&
          /\b(Betrag|Umsatz|Soll|Haben|Amount|Debit|Credit)\b/i.test(line)) ||
        (labelColumns.debit !== undefined && labelColumns.credit !== undefined)
      ) {
        columns = labelColumns;
        pageFooter = false;
        continue;
      }
      if (footer.test(line)) {
        if (/^Seite|^Page|^Folgeseite/i.test(line)) pageFooter = true;
        continue;
      }
      const section = line.match(
        new RegExp(
          '^(?:Buchungsdatum|Buchungstag|Booking date)\\s*:?\\s*(' + dateToken + ')$',
          'i',
        ),
      );
      if (section) {
        finish();
        sectionDate = postingDate(section[1]);
        pageFooter = false;
        continue;
      }
      const first = raw.match(startsDate),
        amounts = moneyMatches(raw);
      let offset = first ? first[0].length : 0;
      const second = first ? raw.slice(offset).match(startsDate) : null;
      if (second) offset += second[0].length;
      const transactionLike = !!first || (!pageFooter && !!sectionDate && amounts.length > 0);
      if (transactionLike && amounts.length) {
        finish();
        pageFooter = false;
        let candidates = amounts.filter((m) => m.index >= offset),
          notes = [];
        if (!candidates.length) continue;
        if (
          candidates.length > 1 &&
          columns.balance !== undefined &&
          columns.amount !== undefined
        ) {
          const ranked = candidates
            .map((m) => ({ m, x: locatedX(layout, m.index + m[0].trimEnd().length - 1) }))
            .filter((v) => v.x !== null);
          const chosen = ranked.filter(
            (v) => Math.abs(v.x - columns.amount) < Math.abs(v.x - columns.balance),
          );
          if (chosen.length === 1) candidates = [chosen[0].m];
        }
        if (candidates.length > 1) notes.push('Mehrere Beträge in der Zeile: Umsatzbetrag prüfen.');
        const amount = candidates[0];
        let parsed;
        try {
          parsed = bankMoney(amount[0]);
        } catch {
          parsed = { cents: null, direction: '' };
          notes.push('Betrag oder Vorzeichen uneindeutig. Bitte am Original prüfen.');
        }
        let direction = parsed.direction;
        if (!direction && columns.debit !== undefined && columns.credit !== undefined) {
          const x = locatedX(layout, amount.index + amount[0].trimEnd().length - 1);
          if (
            x !== null &&
            Math.abs(columns.debit - columns.credit) > 25 &&
            Math.abs(Math.abs(x - columns.debit) - Math.abs(x - columns.credit)) > 15
          )
            direction =
              Math.abs(x - columns.debit) < Math.abs(x - columns.credit) ? 'debit' : 'credit';
        }
        if (!direction) notes.push('Einzahlung oder Auszahlung auswählen.');
        let booking = first ? postingDate(first[1]) : sectionDate,
          value = second ? bankDate(second[1], booking.slice(0, 4) || year) : '';
        if (second && !/\d{4}/.test(second[1]) && booking && value) {
          const choices = [+booking.slice(0, 4) - 1, +booking.slice(0, 4), +booking.slice(0, 4) + 1]
            .map((y) => bankDate(second[1], y))
            .filter(Boolean);
          choices.sort(
            (a, b) =>
              Math.abs(new Date(a) - new Date(booking)) - Math.abs(new Date(b) - new Date(booking)),
          );
          value = choices[0] || value;
        }
        if (!booking) notes.push('Buchungsdatum mit Jahr ergänzen.');
        active = {
          id: digest.slice(0, 12) + '-general-' + (p + 1) + '-' + (l + 1),
          booking_date: booking,
          value_date: value,
          amount: parsed.cents === null ? '' : displayMoney(Math.abs(parsed.cents)),
          direction,
          text: raw.slice(offset, amount.index).trim(),
          page: p + 1,
          line: l + 1,
          original: raw,
          counteraccount: '',
          tax_key: '',
          notes,
          continuations: [],
        };
        continue;
      }
      if (first && !amounts.length && line.replace(first[0].trim(), '').trim().length > 3) {
        finish();
        active = {
          id: digest.slice(0, 12) + '-general-' + (p + 1) + '-' + (l + 1),
          booking_date: postingDate(first[1]),
          value_date: second ? bankDate(second[1], year) : '',
          amount: '',
          direction: '',
          text: raw.slice(offset).trim(),
          page: p + 1,
          line: l + 1,
          original: raw,
          counteraccount: '',
          tax_key: '',
          notes: ['Betrag und Richtung ergänzen.'],
          continuations: [],
        };
        continue;
      }
      if (
        active &&
        !pageFooter &&
        !/^(?:IBAN|BIC|Kontoauszug|Auszug[- ]?Nr|Statement|Kontowährung|Kundennummer)\b/i.test(
          line,
        ) &&
        active.continuations.join(' ').length < 2500
      )
        active.continuations.push(line);
    }
    // Page headers are not part of the previous page's transaction description.
    finish();
  }
  // Ordinary statements sometimes label both ends simply "Saldo am …".
  // Two separately dated values are needed to distinguish opening and closing.
  datedBalances.sort((a, b) => a.date.localeCompare(b.date));
  const earliest = datedBalances[0],
    latest = datedBalances.at(-1);
  if (earliest && latest && earliest.date !== latest.date) {
    opening ||= earliest;
    closing ||= latest;
  } else if (earliest) {
    if (closing?.date && earliest.date < closing.date) opening ||= earliest;
    else if (opening?.date && earliest.date > opening.date) closing ||= earliest;
  }
  const dated = d.rows
    .map((r) => r.booking_date)
    .filter(Boolean)
    .sort();
  d.period_start = period?.start || opening?.date || dated[0] || '';
  d.period_end = period?.end || closing?.date || dated.at(-1) || '';
  d.opening_balance = opening?.value || '';
  d.closing_balance = closing?.value || '';
  if (!d.opening_balance || !d.closing_balance)
    d.warnings.push(
      'Für den Saldenabgleich fehlen lesbare Anfangs- oder Endsalden. Bitte den vollständigen Kontoauszug öffnen.',
    );
  if (!d.period_start || !d.period_end)
    d.warnings.push('Der Auszugszeitraum ist im PDF nicht erkennbar.');
  if (!d.currency) d.warnings.push('Die Kontowährung ist im PDF nicht eindeutig erkennbar.');
  else if (d.currency !== 'EUR')
    d.warnings.push(
      'Der Auszug ist in ' + d.currency + '. Der DATEV-Export unterstützt derzeit EUR-Konten.',
    );
  if (!d.rows.length)
    d.warnings.push(
      scan
        ? 'Auch die lokale Texterkennung konnte keine Buchungen lesen. Bitte einen gut lesbaren Kontoauszug öffnen.'
        : 'Keine eindeutigen Buchungszeilen gefunden. Buchungen anhand des PDFs ergänzen.',
    );
  if (reason && !/allgemeine Erkennung|Layout/i.test(reason)) d.warnings.push(reason);
  return d;
}
function validIban(value) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) return false;
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const c of rearranged) {
    const v = /\d/.test(c) ? c : String(c.charCodeAt(0) - 55);
    for (const n of v) remainder = (remainder * 10 + Number(n)) % 97;
  }
  return remainder === 1;
}
export function draftToStatement(d) {
  if (d.detected_currency && d.detected_currency !== 'EUR')
    throw new Error(
      'Der Auszug ist in ' +
        d.detected_currency +
        '. Der DATEV-Export unterstützt derzeit EUR-Konten.',
    );
  if (d.currency !== 'EUR')
    throw new Error('Die Kontowährung ist im PDF nicht eindeutig erkennbar.');
  if (!bankDate(d.period_start) || !bankDate(d.period_end) || d.period_start > d.period_end)
    throw new Error('Der Auszugszeitraum ist im PDF nicht erkennbar.');
  const iban = validIban(d.iban) ? d.iban : '';
  let opening, closing;
  try {
    opening = bankMoney(d.opening_balance).cents;
    closing = bankMoney(d.closing_balance).cents;
  } catch {
    throw new Error(
      'Für den Saldenabgleich fehlen lesbare Anfangs- oder Endsalden. Bitte den vollständigen Kontoauszug öffnen.',
    );
  }

  const transactions = d.rows
    .map((r, index) => {
      const prefix = 'Buchung ' + (index + 1) + ': ';
      if (!bankDate(r.booking_date)) throw new Error(prefix + 'Buchungsdatum ergänzen.');
      if (r.value_date && !bankDate(r.value_date)) throw new Error(prefix + 'Wertstellung prüfen.');
      if (!['debit', 'credit'].includes(r.direction))
        throw new Error(prefix + 'Einzahlung oder Auszahlung auswählen.');
      let amount;
      try {
        amount = bankMoney(r.amount).cents;
      } catch {
        throw new Error(prefix + 'Betrag prüfen.');
      }
      if (amount === 0)
        throw new Error(
          prefix + 'Nullbetrag ist keine Buchung. Bitte die Zeile prüfen oder entfernen.',
        );
      if (amount < 0 && r.direction === 'credit')
        throw new Error(prefix + 'Minuszeichen und Einzahlung widersprechen sich.');
      const description = r.text.trim();
      if (!description) throw new Error(prefix + 'Buchungstext ergänzen.');
      return {
        id: r.id,
        booking_date: r.booking_date,
        value_date: r.value_date,
        amount: decimal(Math.abs(amount) * (r.direction === 'debit' ? -1 : 1)),
        partner: description,
        booking_text: description,
        page: r.page,
        line: r.line,
        original: r.original,
        counteraccount: r.counteraccount,
        tax_key: r.tax_key ?? '',
      };
    })
    .sort(
      (a, b) => a.booking_date.localeCompare(b.booking_date) || a.page - b.page || a.line - b.line,
    );
  const s = {
    bank: 'Kontoauszug',
    source: d.source,
    sha256: d.sha256,
    iban,
    statement_number: d.statement_number,
    period_start: d.period_start,
    period_end: d.period_end,
    opening_balance: decimal(opening),
    closing_balance: decimal(closing),
    pages: d.pages,
    transactions,
    notes: ['Bankunabhängig eingelesen; Quelldaten manuell bestätigt.'],
  };
  s.check = checkStatement(s);
  if (!d.confirmed)
    throw new Error(
      'Bitte bestätigen, dass alle Buchungen vollständig mit dem Originalauszug abgeglichen wurden.',
    );
  return s;
}
