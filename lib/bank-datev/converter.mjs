export const moneyPattern = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2}';
const moneyRegex = new RegExp('^-?' + moneyPattern + '-?$');
export function parseMoney(value) {
  const s = value.trim().replaceAll('−', '-');
  if (!moneyRegex.test(s) || (s.match(/-/g) || []).length > 1)
    throw new Error('Ein Betrag ist nicht eindeutig lesbar.');
  const n =
    Number(s.replaceAll('-', '').replaceAll('.', '').replace(',', '')) * (s.includes('-') ? -1 : 1);
  if (!Number.isSafeInteger(n)) throw new Error('Der Betrag ist zu groß.');
  return n;
}
export function decimal(n) {
  return (n / 100).toFixed(2);
}
export function toCents(value) {
  if (!/^-?\d+\.\d{2}$/.test(value)) throw new Error('Ungültiger Betrag.');
  const n = Number(value.replace('.', ''));
  if (!Number.isSafeInteger(n)) throw new Error('Betrag zu groß.');
  return n;
}
function iso(s) {
  const [d, m, y] = s.split('.').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCDate() !== d || t.getUTCMonth() !== m - 1 || t.getUTCFullYear() !== y)
    throw new Error('Ein Buchungsdatum ist ungültig.');
  return t.toISOString().slice(0, 10);
}
function valueDate(s, b) {
  const y = Number(b.slice(0, 4)),
    a = [y - 1, y, y + 1]
      .map((y) => {
        try {
          return iso(s + y);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  if (!a.length) throw new Error('Wertstellung ist nicht lesbar.');
  a.sort((x, y) => Math.abs(new Date(x) - new Date(b)) - Math.abs(new Date(y) - new Date(b)));
  return a[0];
}
export function checkStatement(s) {
  if (!s.transactions.length) throw new Error('Keine Buchungen erkannt.');
  const opening = toCents(s.opening_balance),
    closing = toCents(s.closing_balance);
  let incoming = 0,
    outgoing = 0,
    last = s.period_start;
  const ids = new Set();
  for (const t of s.transactions) {
    const n = toCents(t.amount);
    if (n === 0) throw new Error('Nullbuchungen sind nicht zulässig.');
    if (t.booking_date < s.period_start || t.booking_date > s.period_end)
      throw new Error(
        'Buchungsdatum ' +
          t.booking_date +
          ' auf Seite ' +
          t.page +
          ' liegt außerhalb des Auszugszeitraums ' +
          s.period_start +
          ' bis ' +
          s.period_end +
          '.',
      );
    if (t.booking_date < last)
      throw new Error(
        'Die Buchungsdaten auf Seite ' + t.page + ' stehen nicht in zeitlicher Reihenfolge.',
      );
    if (ids.has(t.id)) throw new Error('Doppelte Buchungskennung.');
    ids.add(t.id);
    last = t.booking_date;
    n > 0 ? (incoming += n) : (outgoing -= n);
  }
  const calculated = opening + incoming - outgoing;
  if (![incoming, outgoing, calculated].every(Number.isSafeInteger))
    throw new Error('Umsatzsumme ist zu groß.');
  if (calculated !== closing)
    throw new Error(
      'Der Endsaldo weicht um ' +
        decimal(calculated - closing).replace('.', ',') +
        ' EUR ab. Bitte den vollständigen Auszug hochladen.',
    );
  return {
    transactions: s.transactions.length,
    incoming: decimal(incoming),
    outgoing: decimal(outgoing),
    calculated_closing: decimal(calculated),
    difference: '0.00',
  };
}
export function parseStatement(pages, source, digest) {
  const first = pages[0] || '',
    text = pages.join('\f');
  let bank, number, opening, closing, pagePattern, iban;
  if (first.includes('Sparkasse') && first.includes('Bremen')) {
    bank = 'Sparkasse Bremen';
    const head = first.match(/Kontoauszug\s+(\d+)\/(\d{4})/);
    if (!head) throw new Error('Die Auszugsnummer fehlt.');
    number = head[1];
    iban = first.match(/DE\d{2}(?:[ \t]?\d){18}/)?.[0];
    opening = text.match(
      new RegExp(
        'Kontostand am (\\d{2}\\.\\d{2}\\.\\d{4}), Auszug Nr\\. \\d+\\s+(-?' + moneyPattern + ')',
      ),
    );
    closing = text.match(
      new RegExp(
        'Kontostand am (\\d{2}\\.\\d{2}\\.\\d{4}) um \\d{2}:\\d{2} Uhr\\s+(-?' + moneyPattern + ')',
      ),
    );
    pagePattern = /Seite\s+(\d+)\s+von\s+(\d+)/;
  } else if (first.includes('COBADEFF') && first.includes('Angaben zu den Umsätzen')) {
    bank = 'Commerzbank';
    number = first.match(/Auszug-Nr\.\s+(\d+)/)?.[1];
    iban = first.match(/IBAN\s*:\s*(DE\d{2}(?:[ \t]?\d){18})/)?.[1];
    opening = text.match(
      new RegExp('Alter Kontostand vom (\\d{2}\\.\\d{2}\\.\\d{4})\\s+(' + moneyPattern + '-?)'),
    );
    closing = text.match(
      new RegExp('Neuer Kontostand vom (\\d{2}\\.\\d{2}\\.\\d{4})\\s+(' + moneyPattern + '-?)'),
    );
    pagePattern = /Seite-Nr\.\s+(\d+)\/(\d+)/;
  } else throw new Error('Dieses PDF benötigt die allgemeine Erkennung.');
  if (!number || !iban || !opening || !closing)
    throw new Error('Anfangssaldo, Endsaldo oder Bankdaten sind nicht vollständig lesbar.');
  const end = iso(closing[1]),
    start = iso(opening[1]);
  if (start > end)
    throw new Error(
      'Das Enddatum des Auszugs liegt vor seinem Beginn. Bitte die Datumsangaben prüfen.',
    );
  const currency =
    bank === 'Commerzbank'
      ? /Kontowährung\s+EUR\b/.test(first)
      : /Betrag Soll EUR\s+Betrag Haben EUR/.test(first);
  if (!currency)
    throw new Error(
      'Die Kontowährung ist nicht eindeutig EUR. Fremdwährungskonten werden noch nicht unterstützt.',
    );
  const cleanIban = iban.replaceAll(' ', '');
  if (BigInt(cleanIban.slice(4) + '1314' + cleanIban.slice(2, 4)) % 97n !== 1n)
    throw new Error('Die IBAN konnte nicht fehlerfrei gelesen werden.');
  const s = {
    bank,
    source,
    sha256: digest,
    iban: cleanIban,
    statement_number: number,
    period_start: start,
    period_end: end,
    opening_balance: decimal(parseMoney(opening[2])),
    closing_balance: decimal(parseMoney(closing[2])),
    pages: pages.length,
    transactions: [],
    notes: [],
  };
  let active = null,
    booking = '',
    closingSeen = false,
    ignored = 0;
  function finish() {
    if (!active) return;
    const n = parseMoney(active.amount);
    if (n === 0) {
      if (bank === 'Commerzbank' && active.label === 'Rechnungsabschluss') {
        ignored++;
        active = null;
        return;
      }
      throw new Error('Eine unerwartete Nullbuchung benötigt eine Prüfung.');
    }
    let partner = bank === 'Commerzbank' ? active.label : active.details[0] || active.label;
    if (bank === 'Sparkasse Bremen' && active.label.startsWith('Abrechnung '))
      partner = 'Sparkasse Bremen';
    s.transactions.push({
      id: digest.slice(0, 12) + '-' + active.page + '-' + active.line,
      booking_date: active.booking,
      value_date: active.value,
      amount: decimal(n),
      partner,
      description: active.details.join(' '),
      page: active.page,
      line: active.line,
      original: [active.raw, ...active.details].join('\n'),
      counteraccount: '',
      tax_key: '',
    });
    active = null;
  }
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi],
      p = pi + 1,
      head = page.match(pagePattern);
    if (!head || +head[1] !== p || +head[2] !== pages.length)
      throw new Error('Seite ' + p + ' fehlt oder steht in der falschen Reihenfolge.');
    const pageIban =
      bank === 'Commerzbank'
        ? page.match(/IBAN\s*:\s*(DE\d{2}(?:[ \t]?\d){18})/)
        : page.match(/Geschäftsgirokonto[^\n]*?(DE\d{2}(?:[ \t]?\d){18})/);
    if (pageIban && pageIban[1].replaceAll(' ', '') !== s.iban)
      throw new Error('Der Auszug enthält unterschiedliche Bankkonten.');
    const pageNumber =
      bank === 'Commerzbank'
        ? page.match(/Auszug-Nr\.\s+(\d+)/)
        : page.match(/Kontoauszug\s+(\d+)\/\d{4}/);
    if (!pageNumber || +pageNumber[1] !== +number)
      throw new Error('Die Auszugsnummer wechselt innerhalb des PDFs.');
    let inside = false;
    const lines = page.split('\n');
    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li],
        v = raw.trim();
      if (bank === 'Sparkasse Bremen') {
        if (v.startsWith('Datum') && v.includes('Erläuterung') && v.includes('Betrag')) {
          inside = true;
          continue;
        }
        if (v.startsWith('Die Sparkasse Bremen AG') || v.startsWith('Kontostand am')) {
          if (v.includes('um ')) {
            finish();
            closingSeen = true;
          }
          if (v.startsWith('Die ') || closingSeen) inside = false;
          continue;
        }
        if (!inside) continue;
        const m = raw.match(
          new RegExp(
            '^\\s*(\\d{2}\\.\\d{2}\\.\\d{4})\\s+(.+?)\\s{2,}(-?' + moneyPattern + ')\\s*$',
          ),
        );
        if (m) {
          finish();
          const val = m[2].match(/Wert:\s*(\d{2}\.\d{2}\.\d{4})/);
          active = {
            booking: iso(m[1]),
            value: val ? iso(val[1]) : '',
            label: m[2],
            amount: m[3],
            page: p,
            line: li + 1,
            raw,
            details: [],
          };
          continue;
        }
        if (/^\s*\d{2}\.\d{2}\.\d{4}\s/.test(raw))
          throw new Error('Eine Buchung auf Seite ' + p + ' ist nicht vollständig lesbar.');
      } else {
        if (v.startsWith('Angaben zu den Umsätzen') && v.includes('Valuta')) {
          inside = true;
          continue;
        }
        if (v.startsWith('Folgeseite vorhanden')) {
          inside = false;
          continue;
        }
        if (v.startsWith('Neuer Kontostand vom')) {
          finish();
          closingSeen = true;
          inside = false;
          continue;
        }
        if (!inside) continue;
        const d = v.match(/^Buchungsdatum:\s*(\d{2}\.\d{2}\.\d{4})$/);
        if (d) {
          finish();
          booking = iso(d[1]);
          continue;
        }
        const m = raw.match(
          new RegExp('^\\s*(.+?)\\s{2,}(\\d{2}\\.\\d{2}\\.)\\s{2,}(' + moneyPattern + '-?)\\s*$'),
        );
        if (m) {
          finish();
          if (!booking) throw new Error('Das Buchungsdatum vor dem ersten Umsatz fehlt.');
          active = {
            booking,
            value: valueDate(m[2], booking),
            label: m[1].trim(),
            amount: m[3],
            page: p,
            line: li + 1,
            raw,
            details: [],
          };
          continue;
        }
        if (/\s{2,}\d{2}\.\d{2}\.\s{2,}/.test(raw))
          throw new Error('Eine Buchung auf Seite ' + p + ' ist nicht vollständig lesbar.');
      }
      if (v && active) active.details.push(v);
    }
  }
  finish();
  if (!closingSeen) throw new Error('Der Endsaldo wurde nicht im Buchungsteil gefunden.');
  // Some statements include bookings on the opening-balance date itself.
  // Include that date when it actually has bookings; otherwise retain the next-day period start.
  if (start < end && !s.transactions.some((t) => t.booking_date === start))
    s.period_start = new Date(new Date(start).getTime() + 86400000).toISOString().slice(0, 10);
  if (ignored)
    s.notes.push(ignored + ' Rechnungsabschluss mit 0,00 EUR wurde als Information ausgelassen.');
  s.check = checkStatement(s);
  return s;
}

const cp1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
function encode(text) {
  return Uint8Array.from(
    Array.from(text, (c) => {
      const n = c.codePointAt(0);
      if (n < 128 || (n >= 160 && n <= 255)) return n;
      const i = cp1252.indexOf(c);
      if (i >= 0) return i + 128;
      throw new Error('Das Zeichen „' + c + '“ ist in DATEV-Windows-1252 nicht darstellbar.');
    }),
  );
}
function csvLine(row, numeric) {
  return (
    row
      .map((v, i) =>
        v === '' ? '' : numeric.has(i) ? String(v) : '"' + String(v).replaceAll('"', '""') + '"',
      )
      .join(';') + '\r\n'
  );
}
function validateSettings(settings) {
  if (!['03', '04'].includes(settings.account_framework))
    throw new Error('Bitte SKR03 oder SKR04 auswählen.');
  if (!/^[1-9]\d{0,7}$/.test(settings.bank_account))
    throw new Error('Bitte ein gültiges Bankkonto eingeben.');
  const length = Number(settings.account_length || Math.max(4, settings.bank_account.length));
  if (
    (settings.account_length && !/^[4-8]$/.test(settings.account_length)) ||
    !Number.isInteger(length) ||
    length < 4 ||
    length > 8 ||
    settings.bank_account.length > length
  )
    throw new Error('Sachkontenlänge und Bankkonto prüfen.');
  if (!/^\d{4,7}$/.test(settings.adviser) || Number(settings.adviser) < 1001)
    throw new Error('Bitte eine gültige Beraternummer eintragen.');
  if (!/^\d{1,5}$/.test(settings.client) || Number(settings.client) < 1)
    throw new Error('Bitte eine gültige Mandantennummer eintragen.');
  return length;
}
export function formatTaxKey(value = '') {
  if (value === '') return '';
  if (typeof value !== 'string' || !/^\d{1,4}$/.test(value))
    throw new Error('BU-/Steuerschlüssel bitte leer lassen oder mit 1 bis 4 Ziffern eingeben.');
  return value.padStart(4, '0');
}
export function exportDatev(s, columns, settings, now = new Date()) {
  checkStatement(s);
  const length = validateSettings(settings);
  if (columns.length !== 125)
    throw new Error('Das DATEV-Spaltenlayout konnte nicht geladen werden.');
  const account = settings.bank_account;
  const header = [
    'EXTF',
    700,
    21,
    'Buchungsstapel',
    13,
    now
      .toISOString()
      .replace(/[-:.TZ]/g, '')
      .slice(0, 17),
    '',
    'RE',
    'MoinPDF',
    '',
    +settings.adviser,
    +settings.client,
    settings.fiscal.replaceAll('-', ''),
    length,
    s.period_start.replaceAll('-', ''),
    s.period_end.replaceAll('-', ''),
    'Bank ' + periodLabel(s),
    '',
    1,
    0,
    0,
    'EUR',
    '',
    '',
    '',
    '',
    settings.account_framework,
    '',
    '',
    '',
    '',
  ];
  let output =
    csvLine(header, new Set([1, 2, 4, 5, 10, 11, 12, 13, 14, 15, 18, 19, 20])) +
    csvLine(columns, new Set());
  for (const t of s.transactions) {
    if (
      !/^[1-9]\d{0,8}$/.test(t.counteraccount) ||
      t.counteraccount.length > length + 1 ||
      t.counteraccount === account
    )
      throw new Error(
        'Gegenkonto bei „' +
          t.partner +
          '“ prüfen. Es muss sich vom Bankkonto ' +
          account +
          ' unterscheiden.',
      );
    const taxKey = formatTaxKey(t.tax_key);
    const n = toCents(t.amount);
    if (Math.abs(n) >= 1e12) throw new Error('Ein Umsatz überschreitet die DATEV-Feldlänge.');
    const row = Array(125).fill('');
    row[0] = decimal(Math.abs(n)).replace('.', ',');
    row[1] = n > 0 ? 'S' : 'H';
    row[2] = 'EUR';
    row[6] = account;
    row[7] = t.counteraccount;
    row[8] = taxKey;
    row[9] = t.booking_date.slice(8, 10) + t.booking_date.slice(5, 7);
    row[10] = 'KA' + s.statement_number + '-' + s.period_start.slice(0, 4);
    row[13] = (t.booking_text ?? t.partner + ' ' + t.description)
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 60);
    row[113] = '0';
    const meta = [
      ['Quelle', s.source + ', Seite ' + t.page],
      ['Buchungs-ID', t.id],
    ];
    if (t.value_date) meta.push(['Wertstellung', t.value_date]);
    const raw = t.original.replace(/\s+/g, ' ').trim();
    for (let i = 0; i < raw.length; i += 210) meta.push(['Originaltext', raw.slice(i, i + 210)]);
    if (meta.length > 20 || meta.some(([k, v]) => v.length > 210))
      throw new Error('Die Zusatzinformationen sind zu lang für DATEV.');
    meta.forEach(([kind, value], i) => {
      row[47 + i * 2] = kind;
      row[48 + i * 2] = value;
    });
    output += csvLine(row, new Set([0, 6, 7, 9, 113]));
  }
  return encode(output);
}
function periodLabel(s) {
  const from = s.period_start.slice(0, 7),
    to = s.period_end.slice(0, 7);
  return from === to ? from : from + '_bis_' + to;
}
export function exportName(s, settings) {
  return (
    'EXTF_' +
    s.bank.replaceAll(' ', '_') +
    '_' +
    periodLabel(s) +
    '_KA' +
    s.statement_number.replaceAll('/', '-') +
    '_K' +
    settings.bank_account +
    '_M' +
    settings.client +
    '.csv'
  );
}

function anniversary(start, year) {
  const month = Number(start.slice(5, 7)),
    day = Number(start.slice(8));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, last))).toISOString().slice(0, 10);
}
export function exportFiles(s, columns, settings, now = new Date()) {
  checkStatement(s);
  validateSettings(settings);
  const first = s.transactions[0].booking_date;
  const start = settings.fiscal || first.slice(0, 4) + '-01-01';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !Number.isFinite(Date.parse(start)) ||
    new Date(start).toISOString().slice(0, 10) !== start ||
    start > first ||
    anniversary(start, Number(start.slice(0, 4)) + 1) <= first
  )
    throw new Error('Wirtschaftsjahresbeginn für die erste Buchung prüfen.');
  const batches = new Map();
  for (const t of s.transactions) {
    const year = Number(t.booking_date.slice(0, 4));
    const fiscal = anniversary(start, t.booking_date < anniversary(start, year) ? year - 1 : year);
    if (!batches.has(fiscal)) batches.set(fiscal, []);
    batches.get(fiscal).push(t);
  }
  let balance = toCents(s.opening_balance);
  return [...batches].map(([fiscal, transactions]) => {
    const opening = balance;
    balance += transactions.reduce((sum, t) => sum + toCents(t.amount), 0);
    const next = anniversary(start, Number(fiscal.slice(0, 4)) + 1);
    const last = new Date(Date.parse(next) - 86400000).toISOString().slice(0, 10);
    const batch = {
      ...s,
      period_start: s.period_start > fiscal ? s.period_start : fiscal,
      period_end: s.period_end < last ? s.period_end : last,
      opening_balance: decimal(opening),
      closing_balance: decimal(balance),
      transactions,
    };
    return {
      name: exportName(batch, settings),
      bytes: exportDatev(batch, columns, { ...settings, fiscal }, now),
    };
  });
}
