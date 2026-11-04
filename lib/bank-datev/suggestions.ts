import type { Row } from './model';

export type Suggestion = { id: number; account: string | null; reason: string };
export function previewText(input: string) {
  return input
    .replace(
      /\b(?:EREF|MREF|CRED|SVWZ-REF|KREF|ABWA|DEBT|MANDATSREFERENZ|KUNDENREFERENZ|END-TO-END-REFERENZ)\s*[:+]\s*\S+/gi,
      '[…]',
    )
    .replace(/\b(?:IBAN\s*:?\s*)?DE[ -]?\d{2}(?:[ -]?\d){18}\b/gi, '[…]')
    .replace(/\b(?:IBAN\s*:?\s*)?[A-Z]{2}\s*\d{2}(?:[ -]?[A-Z0-9]){10,30}\b/gi, '[…]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[…]')
    .replace(/\b\d{5,}\b/g, '[…]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}
export function eligibleRows(rows: Row[]) {
  return rows.filter(
    (row) => !row.counteraccount && ['debit', 'credit'].includes(row.direction) && row.text.trim(),
  );
}
export function parseAccounts(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 200) throw Error('Höchstens 200 Gegenkonten eingeben.');
  const seen = new Set<string>();
  return lines.map((line) => {
    const match = /^([1-9]\d{0,8})\s+(.{1,80})$/.exec(line);
    if (!match || seen.has(match[1]))
      throw Error('Je Zeile eine eindeutige Kontonummer und Bezeichnung eingeben.');
    seen.add(match[1]);
    return { number: match[1], label: match[2] };
  });
}
