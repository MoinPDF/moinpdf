import type { Rect } from './studio-engine';

/** All coordinates refer to the displayed (rotated) page, top left = 0/0. */
export type EvidenceWord = Rect & { id: string; text: string; confidence?: number };
export type EvidenceRef = {
  sourceId: string;
  name: string;
  page: number;
  text: string;
  rects: Rect[];
  mode: 'text' | 'ocr';
};
export type EvidenceLine = EvidenceRef & { words: EvidenceWord[] };
export type EvidencePage = {
  sourceId: string;
  name: string;
  page: number;
  mode: 'text' | 'ocr';
  words: EvidenceWord[];
  lines: EvidenceLine[];
};
export type Finding = {
  id: string;
  title: string;
  titleIsData?: boolean;
  status: 'changed' | 'missing' | 'review' | 'match';
  detail: string;
  before?: EvidenceRef;
  after?: EvidenceRef;
  oldValue?: string;
  newValue?: string;
};
export const fold = (s: string) =>
  s.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim();
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const pageRef = (p: EvidencePage): EvidenceRef => ({
  sourceId: p.sourceId,
  name: p.name,
  page: p.page,
  text: p.lines.map((l) => l.text).join('\n'),
  rects: [],
  mode: p.mode,
});
export function groupWords(page: Omit<EvidencePage, 'lines'>): EvidencePage {
  const groups: { center: number; height: number; words: EvidenceWord[] }[] = [];
  for (const w of [...page.words].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x)) {
    const center = w.y + w.h / 2;
    let group = groups.find(
      (g) => Math.abs(g.center - center) < Math.max(0.002, Math.min(g.height, w.h) * 0.45),
    );
    if (!group) {
      group = { center, height: w.h, words: [] };
      groups.push(group);
    }
    group.words.push(w);
  }
  return {
    ...page,
    lines: groups.map((g) => {
      const words = g.words.sort((a, b) => a.x - b.x);
      return {
        sourceId: page.sourceId,
        name: page.name,
        page: page.page,
        mode: page.mode,
        text: words.map((w) => w.text).join(' '),
        rects: words,
        words,
      };
    }),
  };
}
export function numericValue(raw: string): string {
  let s = raw.replace(/[\s\u00a0€$£%]/g, '').replace(/(?:EUR|USD|GBP)$/i, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(s)) return fold(raw);
  let [whole, fraction = ''] = s.replace(/^\+/, '').split('.');
  const minus = whole.startsWith('-');
  whole = whole.replace(/^-/, '').replace(/^0+(?=\d)/, '');
  fraction = fraction.replace(/0+$/, '');
  return (
    (minus && (whole !== '0' || fraction) ? '-' : '') + whole + (fraction ? '.' + fraction : '')
  );
}
export function dateValue(raw: string) {
  const m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : raw;
}
export type NumberToken = {
  raw: string;
  value: string;
  kind: 'date' | 'iban' | 'number' | 'percent';
  start: number;
  end: number;
};
export function numberTokens(text: string): NumberToken[] {
  const result: NumberToken[] = [];
  const patterns: [NumberToken['kind'], RegExp][] = [
    ['iban', /\b[A-Z]{2}\s?\d{2}(?:\s?[A-Z0-9]){11,30}\b/g],
    ['date', /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})\b/g],
    ['percent', /[+-]?\d+(?:[.,]\d+)?\s?%/g],
    [
      'number',
      /(?<![\p{L}\d])[+-]?(?:\d{1,3}(?:[.\u00a0]\d{3})+|\d+)(?:[.,]\d+)?(?:\s?(?:€|EUR|USD|GBP|\$|£))?(?![\p{L}\d])/gu,
    ],
  ];
  for (const [kind, pattern] of patterns)
    for (const m of text.matchAll(pattern)) {
      const start = m.index!,
        end = start + m[0].length;
      if (result.some((r) => start < r.end && end > r.start)) continue;
      const raw = m[0],
        currency = raw.match(/€|EUR|USD|GBP|\$|£/i)?.[0];
      result.push({
        raw,
        kind,
        start,
        end,
        value:
          kind === 'iban'
            ? raw.replace(/\s/g, '')
            : kind === 'date'
              ? dateValue(raw)
              : numericValue(raw) +
                (currency
                  ? '|' + ({ '€': 'EUR', $: 'USD', '£': 'GBP' }[currency] || currency.toUpperCase())
                  : ''),
      });
    }
  return result.sort((a, b) => a.start - b.start);
}
export function similarity(a: string, b: string) {
  const words = (s: string) => new Set(fold(s).match(/[\p{L}]{2,}/gu) || []),
    x = words(a),
    y = words(b);
  if (!x.size || !y.size) return 0;
  return [...x].filter((w) => y.has(w)).length / new Set([...x, ...y]).size;
}
function numberLines(pages: EvidencePage[]) {
  return pages.flatMap((p) =>
    p.lines.flatMap((line, index) => {
      if (/^\s*(?:Seite|Page)\s+\d+\s*(?:(?:von|of|\/)\s*\d+)?\s*$/i.test(line.text)) return [];
      const tokens = numberTokens(line.text);
      if (!tokens.length) return [];
      let context = line.text;
      for (const t of [...tokens].reverse())
        context = context.slice(0, t.start) + ' # ' + context.slice(t.end);
      if (!/[\p{L}]{2}/u.test(context) && index > 0)
        context = p.lines[index - 1].text + ' ' + context;
      return [
        {
          line,
          tokens,
          context: fold(context)
            .replace(/[#:;,.]/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
        },
      ];
    }),
  );
}
export function compareNumbers(before: EvidencePage[], after: EvidencePage[]): Finding[] {
  const a = numberLines(before),
    b = numberLines(after),
    used = new Set<number>(),
    out: Finding[] = [];
  for (const old of a) {
    const candidates = b
      .map((entry, index) => ({
        entry,
        index,
        score:
          old.context && old.context === entry.context ? 1 : similarity(old.context, entry.context),
      }))
      .filter((c) => !used.has(c.index) && c.score >= 0.55)
      .sort((x, y) => y.score - x.score);
    const best = candidates[0];
    if (!best) {
      out.push({
        id: `n-${out.length}`,
        title: 'Nur in erster Fassung zugeordnet',
        status: 'review',
        detail:
          'Keine eindeutige entsprechende Zeile gefunden. Die Angabe kann verschoben oder umbenannt worden sein.',
        before: old.line,
        oldValue: old.tokens.map((t) => t.raw).join(' · '),
      });
      continue;
    }
    if (candidates[1] && best.score - candidates[1].score < 0.08) {
      out.push({
        id: `n-${out.length}`,
        title: 'Mehrdeutige Zuordnung',
        status: 'review',
        detail:
          'Mehrere ähnliche Zeilen in der zweiten Fassung. Bitte anhand der Fundstellen zuordnen.',
        before: old.line,
        after: best.entry.line,
        oldValue: old.tokens.map((t) => t.raw).join(' · '),
        newValue: best.entry.tokens.map((t) => t.raw).join(' · '),
      });
      continue;
    }
    used.add(best.index);
    if (
      old.tokens.map((t) => t.kind + ':' + t.value).join('|') !==
      best.entry.tokens.map((t) => t.kind + ':' + t.value).join('|')
    )
      out.push({
        id: `n-${out.length}`,
        title: old.context || 'Zahlenangabe',
        titleIsData: !!old.context,
        status: 'changed',
        detail:
          best.score === 1
            ? 'Gleiche Zeilenbeschriftung, andere Werte.'
            : 'Ähnliche Zeilenbeschriftung – Zuordnung bitte prüfen.',
        before: old.line,
        after: best.entry.line,
        oldValue: old.tokens.map((t) => t.raw).join(' · '),
        newValue: best.entry.tokens.map((t) => t.raw).join(' · '),
      });
  }
  for (const [i, row] of b.entries())
    if (!used.has(i))
      out.push({
        id: `n-${out.length}`,
        title: 'Nur in zweiter Fassung zugeordnet',
        status: 'review',
        detail: 'Neu oder in der ersten Fassung nicht eindeutig zugeordnet.',
        after: row.line,
        newValue: row.tokens.map((t) => t.raw).join(' · '),
      });
  return out;
}

export type FieldRule = {
  id: string;
  label: string;
  aliases: string[];
  kind: 'text' | 'number' | 'date' | 'iban';
};
export const defaultFieldRules =
  'Rechnungsnummer = Rechnungsnummer | Rechnung Nr. | Rechnungs-Nr. | Invoice no\nDatum = Rechnungsdatum | Datum | Invoice date\nNetto = Nettobetrag | Netto | Zwischensumme\nBrutto = Rechnungsbetrag | Gesamtbetrag | Brutto\nIBAN = IBAN';
export function parseFieldRules(input: string): FieldRule[] {
  const rows = input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!rows.length || rows.length > 30)
    throw new Error(
      'Bitte 1 bis 30 Felder angeben: Feldname = Suchbegriff | weiterer Suchbegriff.',
    );
  const names = new Set<string>();
  return rows.map((row, i) => {
    const at = row.indexOf('='),
      label = (at < 0 ? row : row.slice(0, at)).trim(),
      aliases = (at < 0 ? row : row.slice(at + 1))
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
    if (!label || !aliases.length || row.length > 500 || names.has(fold(label)))
      throw new Error(
        'Jedes Feld braucht einen eindeutigen Namen und mindestens einen Suchbegriff.',
      );
    names.add(fold(label));
    return {
      id: `field-${i}`,
      label,
      aliases,
      kind: /iban/i.test(label)
        ? 'iban'
        : /datum|date|fällig/i.test(label)
          ? 'date'
          : /netto|brutto|betrag|summe|steuer|preis|menge|amount|total|\b(?:net|gross|tax|price|quantity|sum)\b/i.test(
                label,
              )
            ? 'number'
            : 'text',
    };
  });
}
export type FieldCandidate = { value: string; ref: EvidenceRef; uncertain: boolean };
export function extractField(pages: EvidencePage[], rule: FieldRule): FieldCandidate[] {
  const out: FieldCandidate[] = [];
  for (const page of pages)
    for (const [index, line] of page.lines.entries()) {
      let match: { end: number } | undefined;
      for (const alias of [...rule.aliases].sort((a, b) => b.length - a.length)) {
        const m = new RegExp(
          '(?<![\\p{L}\\d])' + escaped(alias).replace(/\s+/g, '\\s+') + '(?![\\p{L}\\d])',
          'iu',
        ).exec(line.text);
        if (m) {
          match = { end: m.index + m[0].length };
          break;
        }
      }
      if (!match) continue;
      let value = line.text
          .slice(match.end)
          .replace(/^[\s:;=#.–-]+/, '')
          .trim(),
        ref: EvidenceRef = line,
        uncertain = false;
      if (!value && page.lines[index + 1]) {
        ref = page.lines[index + 1];
        value = ref.text;
        uncertain = true;
      }
      if (rule.kind !== 'text') {
        const tokens = numberTokens(value).filter(
          (t) => t.kind === rule.kind || (rule.kind === 'number' && t.kind === 'percent'),
        );
        if (!tokens.length) continue;
        for (const t of tokens)
          out.push({
            value: t.raw,
            ref,
            uncertain: uncertain || tokens.length !== 1 || ref.mode === 'ocr',
          });
      } else if (value)
        out.push({ value: value.slice(0, 500), ref, uncertain: uncertain || ref.mode === 'ocr' });
    }
  return out;
}
export function findPageGaps(pages: EvidencePage[]): Finding[] {
  const out: Finding[] = [];
  for (const sourceId of new Set(pages.map((p) => p.sourceId))) {
    const own = pages.filter((p) => p.sourceId === sourceId);
    const numbered = own.flatMap((p) =>
      p.lines.flatMap((line) => {
        const m = line.text.match(/\b(?:Seite|Page)\s+(\d{1,4})\s*(?:von|of|\/)\s*(\d{1,4})\b/i);
        return m ? [{ n: Number(m[1]), total: Number(m[2]), ref: line }] : [];
      }),
    );
    if (!numbered.length) {
      out.push({
        id: `gap-${out.length}`,
        title: 'Keine auswertbare Seitenzählung',
        status: 'review',
        detail:
          'Es wurden keine Angaben wie „Seite 3 von 7“ gefunden. Daraus lässt sich keine Vollständigkeit ableiten.',
        before: pageRef(own[0]),
      });
      continue;
    }
    const totals = new Set(numbered.map((n) => n.total));
    if (totals.size !== 1 || numbered.some((n) => n.total > 1000 || n.n < 1 || n.n > n.total)) {
      out.push({
        id: `gap-${out.length}`,
        title: 'Mehrere oder widersprüchliche Seitenzählungen',
        status: 'review',
        detail:
          'Die Datei kann mehrere Dokumente enthalten. Diese zuerst trennen und einzeln prüfen.',
        before: numbered[0].ref,
      });
      continue;
    }
    const total = numbered[0].total,
      seen = new Set(numbered.map((n) => n.n)),
      missing = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !seen.has(n));
    if (missing.length)
      out.push({
        id: `gap-${out.length}`,
        title: `Nicht gefundene Seitennummern: ${missing.join(', ')}`,
        status: 'missing',
        detail: `Die gedruckte Zählung nennt ${total} Seiten. Unleserliche oder anders nummerierte Seiten können diese Meldung verursachen.`,
        before: numbered[0].ref,
      });
    for (const n of seen) {
      const copies = numbered.filter((row) => row.n === n);
      if (new Set(copies.map((c) => c.ref.page)).size > 1)
        out.push({
          id: `gap-${out.length}`,
          title: `Seitennummer ${n} mehrfach gefunden`,
          status: 'review',
          detail: 'Kann eine doppelte Seite oder eine neue Dokumentzählung sein.',
          before: copies[0].ref,
          after: copies.find((c) => c.ref.page !== copies[0].ref.page)!.ref,
        });
    }
    if (numbered.some((row, i) => i > 0 && row.n < numbered[i - 1].n))
      out.push({
        id: `gap-${out.length}`,
        title: 'Seitenzählung springt zurück',
        status: 'review',
        detail: 'Seitenreihenfolge oder mehrere Dokumente prüfen.',
        before: numbered[0].ref,
      });
    if (!missing.length)
      out.push({
        id: `gap-${out.length}`,
        title: 'Alle genannten Seitennummern gefunden',
        status: 'match',
        detail: `1 bis ${total} sind vorhanden. Die inhaltliche Vollständigkeit wird dadurch nicht bestätigt.`,
        before: numbered[0].ref,
      });
  }
  return out;
}

export type PseudonymRule = { term: string; replacement: string };
export type PseudonymHit = { id: string; rule: number; ref: EvidenceRef; selected: boolean };
export function parsePseudonyms(input: string): PseudonymRule[] {
  const rows = input
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    seen = new Set<string>();
  if (!rows.length || rows.length > 100)
    throw new Error('Bitte 1 bis 100 Zuordnungen angeben: Original = Platzhalter.');
  return rows.map((row) => {
    const at = row.indexOf('='),
      term = row.slice(0, at).trim(),
      replacement = row.slice(at + 1).trim();
    if (
      at < 1 ||
      !replacement ||
      term.length < 2 ||
      term.length > 150 ||
      replacement.length > 100 ||
      seen.has(fold(term))
    )
      throw new Error(
        'Jede Zuordnung braucht einen eindeutigen Originalbegriff (2–150 Zeichen) und einen Platzhalter (maximal 100 Zeichen).',
      );
    seen.add(fold(term));
    return { term, replacement };
  });
}
export function findPseudonyms(pages: EvidencePage[], rules: PseudonymRule[]): PseudonymHit[] {
  const out: PseudonymHit[] = [];
  for (const p of pages)
    for (const line of p.lines) {
      const ranges: { start: number; end: number }[] = [];
      for (const { rule, index } of rules
        .map((rule, index) => ({ rule, index }))
        .sort((a, b) => b.rule.term.length - a.rule.term.length)) {
        const re = new RegExp(
          '(?<![\\p{L}\\d])' + escaped(rule.term).replace(/\s+/g, '\\s+') + '(?![\\p{L}\\d])',
          'giu',
        );
        for (const m of line.text.matchAll(re)) {
          const start = m.index!,
            end = start + m[0].length;
          if (ranges.some((r) => start < r.end && end > r.start)) continue;
          let offset = 0;
          const words = line.words.filter((w) => {
            const left = offset;
            offset += w.text.length + 1;
            return left < end && left + w.text.length > start;
          });
          if (!words.length) continue;
          ranges.push({ start, end });
          out.push({
            id: `pseudo-${out.length}`,
            rule: index,
            ref: { ...line, text: m[0], rects: words },
            selected: true,
          });
        }
      }
    }
  return out;
}

export type AttachmentTarget = { id: string; label: string; ref: EvidenceRef };
export type AttachmentReference = {
  id: string;
  label: string;
  ref: EvidenceRef;
  candidates: string[];
  target: string;
};
export function attachmentPlan(pages: EvidencePage[]): {
  targets: AttachmentTarget[];
  references: AttachmentReference[];
} {
  const targets: AttachmentTarget[] = [],
    references: AttachmentReference[] = [];
  const pattern = /\b(?:Anlage|Anhang|Appendix)\s+([0-9]{1,3}[a-z]?|[A-Z])\b/gi;
  const label = (text: string) =>
    fold(text)
      .replace(/^anhang|^appendix/, 'anlage')
      .replace(/\s+/g, ' ');
  for (const page of pages) {
    const filename =
      page.page === 0 ? page.name.replace(/[_-]/g, ' ').match(pattern)?.[0] : undefined;
    if (filename)
      targets.push({ id: `target-${targets.length}`, label: label(filename), ref: pageRef(page) });
    for (const line of page.lines)
      for (const m of line.text.matchAll(pattern)) {
        const key = label(m[0]),
          isHeading =
            m.index === 0 &&
            line.rects[0]?.y < 0.3 &&
            line.text.length < 100 &&
            !/\b(?:siehe|beigefügt|beachten|vgl)\b/i.test(line.text);
        if (isHeading) {
          if (
            !targets.some(
              (t) =>
                t.label === key && t.ref.sourceId === page.sourceId && t.ref.page === page.page,
            )
          )
            targets.push({ id: `target-${targets.length}`, label: key, ref: line });
        } else
          references.push({
            id: `reference-${references.length}`,
            label: key,
            ref: line,
            candidates: [],
            target: '',
          });
      }
  }
  for (const r of references) {
    r.candidates = targets.filter((t) => t.label === r.label).map((t) => t.id);
    r.target = r.candidates.length === 1 ? r.candidates[0] : '';
  }
  return { targets, references };
}

export type Position = {
  id: string;
  label: string;
  quantity: string;
  price: string;
  total: string;
  ref: EvidenceRef;
};
export function extractPositions(pages: EvidencePage[]): Position[] {
  const out: Position[] = [];
  for (const page of pages)
    for (const line of page.lines) {
      // Deliberately conservative: a position ID, description and at least three numbers.
      const m = line.text.match(/^\s*(\d{1,4}(?:\.\d{1,3})?)\.?\s+(.+)$/);
      if (!m) continue;
      const tokens = numberTokens(m[2]).filter((t) => t.kind === 'number');
      if (tokens.length < 3) continue;
      const label = m[2].slice(0, tokens[0].start).trim();
      if (!/[\p{L}]{2}/u.test(label)) continue;
      out.push({
        id: m[1],
        label,
        quantity: tokens[0].raw,
        price: tokens[tokens.length - 2].raw,
        total: tokens[tokens.length - 1].raw,
        ref: line,
      });
    }
  return out;
}
export function reconcilePositions(
  a: Position[],
  b: Position[],
  aName: string,
  bName: string,
): Finding[] {
  const out: Finding[] = [],
    used = new Set<number>();
  for (const old of a) {
    const candidates = b
      .map((row, index) => ({
        row,
        index,
        score: fold(old.label) === fold(row.label) ? 1 : similarity(old.label, row.label),
      }))
      .filter((c) => !used.has(c.index) && c.score >= 0.6)
      .sort((x, y) => y.score - x.score);
    const match = candidates[0];
    if (!match) {
      out.push({
        id: `position-${out.length}`,
        title: old.label,
        titleIsData: true,
        status: 'review',
        detail: `Keine eindeutige Position in ${bName} zugeordnet.`,
        before: old.ref,
      });
      continue;
    }
    if (candidates[1] && match.score - candidates[1].score < 0.1) {
      out.push({
        id: `position-${out.length}`,
        title: old.label,
        titleIsData: true,
        status: 'review',
        detail: 'Mehrere ähnlich benannte Positionen. Beschreibungen in den Tabellen präzisieren.',
        before: old.ref,
        after: match.row.ref,
      });
      continue;
    }
    used.add(match.index);
    const changed = (['quantity', 'price', 'total'] as const).filter(
      (key) => numericValue(old[key]) !== numericValue(match.row[key]),
    );
    out.push({
      id: `position-${out.length}`,
      title: old.label,
      titleIsData: true,
      status: changed.length ? 'changed' : 'match',
      detail: `${aName} → ${bName}: ${changed.length ? changed.map((k) => ({ quantity: 'Menge', price: 'Einzelpreis', total: 'Positionsbetrag' })[k]).join(', ') + ' abweichend.' : 'Menge, Einzelpreis und Positionsbetrag stimmen überein.'}`,
      before: old.ref,
      after: match.row.ref,
      oldValue: `${old.quantity} × ${old.price} = ${old.total}`,
      newValue: `${match.row.quantity} × ${match.row.price} = ${match.row.total}`,
    });
  }
  for (const [i, row] of b.entries())
    if (!used.has(i))
      out.push({
        id: `position-${out.length}`,
        title: row.label,
        titleIsData: true,
        status: 'review',
        detail: `Nur in ${bName} eindeutig erfasst.`,
        after: row.ref,
      });
  return out;
}
