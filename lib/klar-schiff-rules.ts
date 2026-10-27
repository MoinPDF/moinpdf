import { z } from 'zod';
import { fold, groupWords, type EvidenceWord } from './evidence-model';
import { validDate } from './century-model';
import type { Rect } from './studio-engine';
import type { KlarDocument, KlarPage } from './klar-schiff-model';

export const KLAR_RULES_KEY = 'moinpdf.klar-rules.v1';
const box = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().positive().max(1),
    h: z.number().positive().max(1),
  })
  .strict()
  .refine((r) => r.x + r.w <= 1.001 && r.y + r.h <= 1.001);
export const klarRuleSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    sender: z.string().trim().min(3).max(100),
    matchText: z.string().trim().min(5).max(100),
    matchArea: box,
    referenceArea: box,
    dateArea: box,
    kind: z.enum(['invoice', 'letter', 'document']),
  })
  .strict();
export type KlarRule = z.infer<typeof klarRuleSchema>;
export function decodeKlarRules(raw: string | null): KlarRule[] {
  if (!raw) return [];
  if (raw.length > 100000) throw new Error('Die gespeicherten Erkennungsregeln sind ungültig.');
  const rules = z.array(klarRuleSchema).max(30).parse(JSON.parse(raw));
  if (new Set(rules.map((r) => r.id)).size !== rules.length)
    throw new Error('Die gespeicherten Erkennungsregeln sind ungültig.');
  return rules;
}
function wordsIn(page: KlarPage, rect: Rect) {
  return (page.layout || []).filter(
    (w) =>
      w.x + w.w / 2 >= rect.x &&
      w.x + w.w / 2 <= rect.x + rect.w &&
      w.y + w.h / 2 >= rect.y &&
      w.y + w.h / 2 <= rect.y + rect.h,
  );
}
export function klarRegionText(page: KlarPage, rect: Rect) {
  return groupWords({
    sourceId: page.sourceId,
    name: page.name,
    page: page.page,
    mode: 'text',
    words: wordsIn(page, rect),
  })
    .lines.map((l) => l.text)
    .join('\n')
    .trim();
}
function dates(text: string) {
  return [
    ...new Set(
      [...text.matchAll(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})\b/g)]
        .map((m) => {
          const p = m[0].match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
          return p ? `${p[3]}-${p[2].padStart(2, '0')}-${p[1].padStart(2, '0')}` : m[0];
        })
        .filter(validDate),
    ),
  ];
}
export function readKlarRule(page: KlarPage, rule: KlarRule) {
  const match = fold(klarRegionText(page, rule.matchArea)).includes(fold(rule.matchText));
  const raw = klarRegionText(page, rule.referenceArea)
    .replace(
      /^(?:rechnungs(?:nummer|[ -]?nr\.?)|invoice\s*(?:number|no\.?|#)|rechnung|reference|aktenzeichen|belegnummer)\s*[:#]?\s*/i,
      '',
    )
    .replace(/^[^\n:]{1,50}:\s*/, '')
    .trim();
  const refs = [
    ...new Set((raw.match(/[\p{L}\d][\p{L}\d./_-]{1,49}/gu) || []).filter((s) => /\d/.test(s))),
  ];
  const foundDates = dates(klarRegionText(page, rule.dateArea));
  const uncertain = [rule.matchArea, rule.referenceArea, rule.dateArea].some((r) =>
    wordsIn(page, r).some((w) => w.confidence !== undefined && w.confidence < 80),
  );
  return {
    match,
    reference: refs.length === 1 ? refs[0] : '',
    date: foundDates.length === 1 ? foundDates[0] : '',
    uncertain,
  };
}
/** Literal sender plus reviewed coordinates; no arbitrary code/regex and no silent confirmation. */
export function applyKlarRules(pages: KlarPage[], rules: KlarRule[]): KlarPage[] {
  return pages.map((page) => {
    const matches = rules
      .map((rule) => ({ rule, value: readKlarRule(page, rule) }))
      .filter((r) => r.value.match);
    if (!matches.length) return page;
    const p = { ...page, warnings: [...page.warnings] };
    if (matches.length !== 1) {
      p.warnings.push('Mehrere Erkennungsregeln passen. Angaben bitte einzeln prüfen.');
      return p;
    }
    const { rule, value } = matches[0];
    if (value.uncertain || !value.reference || !value.date) {
      p.warnings.push('Erkennungsregel passt, aber Werte sind unklar. Original prüfen.');
      return p;
    }
    // Explicit rule choices may correct heuristics, but disagreement stays visible.
    if (
      (p.reference && fold(p.reference) !== fold(value.reference)) ||
      (p.date && p.date !== value.date) ||
      (p.sender && fold(p.sender) !== fold(rule.sender))
    )
      p.warnings.push('Erkennungsregel weicht vom allgemeinen Vorschlag ab. Angaben prüfen.');
    p.sender = rule.sender;
    p.reference = value.reference;
    p.date = value.date;
    p.kind = rule.kind;
    p.ruleName = rule.name;
    return p;
  });
}
function bounds(words: EvidenceWord[]): Rect {
  const x = Math.max(0, Math.min(...words.map((w) => w.x)) - 0.003),
    y = Math.max(0, Math.min(...words.map((w) => w.y)) - 0.003);
  return {
    x,
    y,
    w: Math.min(1, Math.max(...words.map((w) => w.x + w.w)) + 0.003) - x,
    h: Math.min(1, Math.max(...words.map((w) => w.y + w.h)) + 0.003) - y,
  };
}
function regionFor(page: KlarPage, value: string, fallback: Rect) {
  if (!value || !page.layout?.length) return fallback;
  const lines = groupWords({
    sourceId: page.sourceId,
    name: page.name,
    page: page.page,
    mode: 'text',
    words: page.layout,
  }).lines;
  for (const line of lines) {
    for (let i = 0; i < line.words.length; i++)
      for (let j = i; j < Math.min(line.words.length, i + 12); j++) {
        const words = line.words.slice(i, j + 1),
          text = words.map((w) => w.text).join(' ');
        if (fold(text).includes(fold(value)) || dates(text).includes(value)) return bounds(words);
      }
  }
  return fallback;
}
export function draftKlarRule(page: KlarPage, document: KlarDocument): KlarRule {
  return {
    id: '',
    name: document.sender.slice(0, 80),
    sender: document.sender,
    matchText: document.sender,
    kind: page.kind,
    matchArea: regionFor(page, document.sender, { x: 0, y: 0, w: 1, h: 0.2 }),
    referenceArea: regionFor(page, page.reference, { x: 0, y: 0.15, w: 1, h: 0.15 }),
    dateArea: regionFor(page, document.date, { x: 0, y: 0.2, w: 1, h: 0.2 }),
  };
}
