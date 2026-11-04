import { ui, uiLocale } from '../ui-language';

export function bankMessage(message: string) {
  if (!uiLocale().startsWith('en')) return message;
  const row = /^Buchung (\d+): (.*)$/.exec(message);
  if (row) return 'Posting ' + row[1] + ': ' + ui(row[2]);
  const messages: [RegExp, string][] = [
    [
      /^Gegenkonto bei „(.*)“ prüfen\. Es muss sich vom Bankkonto (\d+) unterscheiden\.$/s,
      'Check the offset account for “$1”. Enter a valid number different from bank account $2.',
    ],
    [
      /^Der Endsaldo weicht um ([-\d,]+) EUR ab\..*$/,
      'Closing balance difference: EUR $1. Check the complete statement.',
    ],
    [
      /^Buchungsdatum (\S+) auf Seite (\d+) liegt außerhalb des Auszugszeitraums (\S+) bis (\S+)\.$/,
      'Posting date $1 on page $2 is outside the statement period $3 to $4.',
    ],
    [
      /^Die Buchungsdaten auf Seite (\d+) stehen nicht in zeitlicher Reihenfolge\.$/,
      'The posting dates on page $1 are out of chronological order.',
    ],
    [
      /^Seite (\d+) fehlt oder steht in der falschen Reihenfolge\.$/,
      'Page $1 is missing or out of sequence.',
    ],
    [
      /^Eine Buchung auf Seite (\d+) ist nicht vollständig lesbar\.$/,
      'A posting on page $1 is not fully legible.',
    ],
    [
      /^Der Auszug ist in (\w+)\. Der DATEV-Export unterstützt derzeit EUR-Konten\.$/,
      'The statement currency is $1. DATEV export currently supports EUR accounts.',
    ],
    [
      /^Das Zeichen „(.+)“ ist in DATEV-Windows-1252 nicht darstellbar\.$/,
      'The character “$1” cannot be represented in DATEV Windows-1252.',
    ],
    [
      /^(\d+) Rechnungsabschluss mit 0,00 EUR wurde als Information ausgelassen\.$/,
      '$1 zero-amount settlement was excluded as informational.',
    ],
  ];
  for (const [pattern, replacement] of messages)
    if (pattern.test(message)) return message.replace(pattern, replacement);
  return ui(message);
}
