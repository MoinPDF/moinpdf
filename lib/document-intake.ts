import { fold, pageRef, type EvidencePage, type EvidenceRef } from './evidence-model';
import type { ExportFile } from './advanced-types';

export type ChecklistRule = { id: string; title: string; keywords: string; month: string };
export type ChecklistFinding = {
  rule: ChecklistRule;
  candidates: EvidenceRef[];
  unreadable: number;
};
const monthNames = [
  ['januar', 'january'],
  ['februar', 'february'],
  ['märz', 'maerz', 'march'],
  ['april'],
  ['mai', 'may'],
  ['juni', 'june'],
  ['juli', 'july'],
  ['august'],
  ['september'],
  ['oktober', 'october'],
  ['november'],
  ['dezember', 'december'],
];
export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const date = new Date(value + 'T12:00:00Z');
  return (
    year >= 1900 &&
    year <= 2199 &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
const isoDate = (y: string, m: string | number, d: string) =>
  `${y}-${String(m).padStart(2, '0')}-${d.padStart(2, '0')}`;
export function printedDates(text: string): { date: string; at: number; end: number }[] {
  const found: { date: string; at: number; end: number }[] = [];
  const add = (m: RegExpMatchArray, date: string) => {
    const at = m.index!;
    if (validCalendarDate(date) && !found.some((v) => at < v.end && at + m[0].length > v.at))
      found.push({ date, at, end: at + m[0].length });
  };
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(m, isoDate(m[1], m[2], m[3]));
  for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g))
    add(m, isoDate(m[3], m[2], m[1]));
  const names = monthNames.flat().join('|');
  const month = (name: string) =>
    monthNames.findIndex((list) => list.includes(name.toLocaleLowerCase('de'))) + 1;
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})\\.?\\s+(${names})\\s+(\\d{4})\\b`, 'gi')))
    add(m, isoDate(m[3], month(m[2]), m[1]));
  for (const m of text.matchAll(new RegExp(`\\b(${names})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi')))
    add(m, isoDate(m[3], month(m[1]), m[2]));
  return found.sort((a, b) => a.at - b.at);
}
function includesMonth(text: string, value: string) {
  if (!value) return true;
  const [year, month] = value.split('-');
  if (printedDates(text).some((v) => v.date.startsWith(value))) return true;
  const names = monthNames[Number(month) - 1].join('|');
  return new RegExp(
    `\\b(?:${names})\\s+${year}\\b|\\b0?${Number(month)}[./-]${year}\\b|\\b${year}-${month}\\b`,
    'i',
  ).test(text);
}
export function checkDocuments(pages: EvidencePage[], rules: ChecklistRule[]): ChecklistFinding[] {
  if (!rules.length || rules.length > 60 || pages.length > 200)
    throw new Error('Bitte 1 bis 60 Prüfpunkte und höchstens 200 Seiten verwenden.');
  return rules.map((rule) => {
    const terms = rule.keywords.split(',').map(fold).filter(Boolean);
    if (
      !rule.title.trim() ||
      rule.title.length > 200 ||
      !terms.length ||
      terms.length > 12 ||
      terms.some((t) => t.length < 2 || t.length > 100) ||
      (rule.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(rule.month))
    )
      throw new Error(
        'Jeder Prüfpunkt benötigt einen Titel und Suchwörter mit mindestens zwei Zeichen. Monat: JJJJ-MM oder leer.',
      );
    const candidates = pages
      .filter((page) => {
        const text = page.lines.map((line) => line.text).join('\n');
        return (
          text.trim() &&
          terms.every((term) => fold(text).includes(term)) &&
          includesMonth(text, rule.month)
        );
      })
      .map(pageRef);
    return { rule, candidates, unreadable: pages.filter((p) => !p.words.length).length };
  });
}
export type DocumentEvent = {
  id: string;
  date: string;
  time: string;
  minutes: number;
  title: string;
  ref: EvidenceRef;
  confirmed: boolean;
};
export function collectDocumentEvents(pages: EvidencePage[]): DocumentEvent[] {
  if (pages.length > 200) throw new Error('Bitte höchstens 200 Seiten auswerten.');
  const events: DocumentEvent[] = [];
  for (const page of pages)
    for (const [lineIndex, line] of page.lines.entries()) {
      const dates = printedDates(line.text);
      for (const [index, entry] of dates.entries()) {
        // Time belongs to the following segment of this date, never to another date.
        const following = line.text.slice(entry.end, dates[index + 1]?.at);
        const time = following.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*Uhr)?\b/);
        events.push({
          id: `${page.sourceId}:${page.page}:${lineIndex}:${entry.at}`,
          date: entry.date,
          time: time ? `${time[1].padStart(2, '0')}:${time[2]}` : '',
          minutes: 60,
          title: line.text.slice(0, 160),
          ref: {
            sourceId: line.sourceId,
            name: line.name,
            page: line.page,
            text: line.text,
            rects: line.rects.map(({ x, y, w, h }) => ({ x, y, w, h })),
            mode: line.mode,
          },
          confirmed: false,
        });
        if (events.length > 300)
          throw new Error('Mehr als 300 Datumsfundstellen. Bitte weniger Seiten verwenden.');
      }
    }
  return events;
}
function calendarText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
/** RFC 5545: fold at 75 octets, without breaking UTF-8 characters. */
export function calendarLine(line: string) {
  const encoder = new TextEncoder();
  let result = '',
    length = 0;
  for (const c of line) {
    const bytes = encoder.encode(c).length;
    if (length + bytes > 75) {
      result += '\r\n ';
      length = 1;
    }
    result += c;
    length += bytes;
  }
  return result;
}
export async function exportDocumentEvents(
  events: DocumentEvent[],
  now = new Date(),
): Promise<ExportFile> {
  const selected = events.filter((e) => e.confirmed);
  if (!selected.length || selected.length > 300)
    throw new Error('Bitte 1 bis 300 Termine ausdrücklich bestätigen.');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MoinPDF//Local document dates//DE',
    'CALSCALE:GREGORIAN',
  ];
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const ids = new Set<string>();
  for (const event of selected) {
    if (
      !validCalendarDate(event.date) ||
      !event.title.trim() ||
      event.title.length > 300 ||
      (event.time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time)) ||
      !Number.isInteger(event.minutes) ||
      event.minutes < 1 ||
      event.minutes > 1440 ||
      ids.has(event.id)
    )
      throw new Error('Bitte Titel, gültiges Datum, Uhrzeit und Dauer jedes Termins prüfen.');
    ids.add(event.id);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(event.id));
    const uid = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@moinpdf.local`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${calendarText(event.title)}`,
      `DESCRIPTION:${calendarText(`${event.ref.name} · ${event.ref.page + 1}\n${event.ref.text}`)}`,
    );
    if (event.time)
      lines.push(
        `DTSTART:${event.date.replace(/-/g, '')}T${event.time.replace(':', '')}00`,
        `DURATION:PT${event.minutes}M`,
      );
    else {
      const end = new Date(event.date + 'T12:00:00Z');
      end.setUTCDate(end.getUTCDate() + 1);
      lines.push(
        `DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`,
      );
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return {
    blob: new Blob([lines.map(calendarLine).join('\r\n') + '\r\n'], {
      type: 'text/calendar;charset=utf-8',
    }),
    filename: 'MoinPDF.ics',
    kind: 'data',
    pages: selected.length,
  };
}
