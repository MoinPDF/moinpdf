import type { DiffLine, PdfReport } from './pdf-report';

export type ComparisonPage = { number: number; text: string };
type Block = { text: string; page: number; ordinal: number; tokens: string[]; terms: Set<string> };
type Match = { before: number; after: number; exact: boolean; ambiguous: boolean; score: number };
const normalize = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim();
const tokenize = (text: string) =>
  text.match(/[\p{L}\p{N}]+(?:[.,'’-][\p{L}\p{N}]+)*|[^\s]/gu) || [];
function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function blocks(pages: ComparisonPage[]): Block[] {
  if (pages.length > 200 || pages.reduce((n, p) => n + p.text.length, 0) > 2_000_000)
    throw new Error(
      'Der Inhaltsvergleich unterstützt bis zu 200 Seiten und zwei Millionen Textzeichen je Datei. Bitte weniger Seiten auswählen.',
    );
  const result: Block[] = [],
    segmenter = new Intl.Segmenter('de', { granularity: 'sentence' });
  for (const page of pages) {
    const paragraphs = page.text
      .split(/\n\s*\n/)
      .map(normalize)
      .filter(Boolean);
    for (const paragraph of paragraphs)
      for (const { segment } of segmenter.segment(paragraph)) {
        // Unpunctuated tables or long OCR runs are still bounded and retained in
        // full. Chunk boundaries may reduce matching quality, never hide content.
        const words = segment.trim().split(/\s+/);
        for (let offset = 0; offset < words.length; offset += 120) {
          const text = words.slice(offset, offset + 120).join(' ');
          if (!text) continue;
          const tokens = tokenize(text);
          result.push({
            text,
            page: page.number,
            ordinal: result.length,
            tokens,
            terms: new Set(
              tokens.filter((t) => /[\p{L}\p{N}]/u.test(t)).map((t) => t.toLocaleLowerCase('de')),
            ),
          });
          if (result.length > 5000)
            throw new Error(
              'Zu viele Textblöcke für einen Inhaltsvergleich. Bitte weniger Seiten auswählen.',
            );
        }
      }
  }
  return result;
}
// Word-level LCS, including punctuation and case. Whitespace/reflow differences
// are deliberately ignored. Keep runs readable in both screen and TXT reports.
export function compareWords(before: string, after: string): DiffLine[] {
  const a = tokenize(before),
    b = tokenize(after);
  if (a.length * b.length > 250000)
    return [
      { kind: 'removed', text: before },
      { kind: 'added', text: after },
    ];
  const stride = b.length + 1,
    dp = new Uint16Array((a.length + 1) * stride);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i * stride + j] =
        a[i] === b[j]
          ? 1 + dp[(i + 1) * stride + j + 1]
          : Math.max(dp[(i + 1) * stride + j], dp[i * stride + j + 1]);
  const output: DiffLine[] = [];
  const append = (kind: DiffLine['kind'], text: string) => {
    if (output.at(-1)?.kind === kind) output[output.length - 1].text += ' ' + text;
    else output.push({ kind, text });
  };
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      append('same', a[i++]);
      j++;
    } else if (
      j < b.length &&
      (i === a.length || dp[i * stride + j + 1] > dp[(i + 1) * stride + j])
    )
      append('added', b[j++]);
    else append('removed', a[i++]);
  }
  return output;
}
function stableOrder(matches: Match[]) {
  // Longest increasing subsequence. Insertions/deletions shift positions but
  // don't make every following block a move. Ties are deterministic.
  const sorted = [...matches].sort((a, b) => a.before - b.before),
    tails: number[] = [],
    previous = new Int32Array(sorted.length).fill(-1);
  for (let i = 0; i < sorted.length; i++) {
    let lo = 0,
      hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[tails[mid]].after < sorted[i].after) lo = mid + 1;
      else hi = mid;
    }
    if (lo) previous[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const stable = new Set<number>();
  for (let i = tails.at(-1) ?? -1; i >= 0; i = previous[i]) stable.add(sorted[i].before);
  return stable;
}
export async function compareContent(
  beforePages: ComparisonPage[],
  afterPages: ComparisonPage[],
  names: { before: string; after: string },
  signal?: AbortSignal,
  progress?: (value: number) => void,
): Promise<PdfReport> {
  check(signal);
  const before = blocks(beforePages),
    after = blocks(afterPages),
    matches: Match[] = [],
    used = new Set<number>(),
    paired = new Set<number>();
  const exact = new Map<string, number[]>(),
    beforeCounts = new Map<string, number>();
  for (const b of before) beforeCounts.set(b.text, (beforeCounts.get(b.text) || 0) + 1);
  for (const b of after) exact.set(b.text, [...(exact.get(b.text) || []), b.ordinal]);
  for (const b of before) {
    const options = exact.get(b.text);
    if (!options?.length) continue;
    const target = options.shift()!;
    matches.push({
      before: b.ordinal,
      after: target,
      exact: true,
      ambiguous: beforeCounts.get(b.text)! > 1 || options.length > 0,
      score: 1,
    });
    used.add(target);
    paired.add(b.ordinal);
  }
  check(signal);
  await tick();
  // Candidate retrieval by shared words avoids a quadratic all-block diff.
  // Very common words cannot anchor a match on their own.
  const index = new Map<string, number[]>();
  for (const b of after)
    if (!used.has(b.ordinal))
      for (const term of b.terms) {
        const entries = index.get(term);
        if (!entries) index.set(term, [b.ordinal]);
        else if (entries.length <= 100) entries.push(b.ordinal);
      }
  const proposals: Match[] = [];
  for (let i = 0; i < before.length; i++) {
    if (i % 32 === 0) {
      check(signal);
      progress?.(i / Math.max(1, before.length));
      await tick();
    }
    const b = before[i];
    if (paired.has(i)) continue;
    const candidates = new Map<number, number>();
    for (const term of b.terms) {
      const entries = index.get(term) || [];
      if (entries.length > 100) continue;
      for (const j of entries) candidates.set(j, (candidates.get(j) || 0) + 1);
    }
    const ranked = [...candidates]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([j]) => {
        let shared = 0;
        for (const term of b.terms) if (after[j].terms.has(term)) shared++;
        const dice = (2 * shared) / (b.terms.size + after[j].terms.size);
        // Repeated words count too: a bag of unique terms must not turn a much
        // longer paragraph into a confident counterpart of a short sentence.
        const lengthRatio =
          Math.min(b.tokens.length, after[j].tokens.length) /
          Math.max(b.tokens.length, after[j].tokens.length);
        return { before: i, after: j, exact: false, ambiguous: false, score: dice * lengthRatio };
      })
      .filter((m) => m.score >= (b.terms.size < 4 ? 0.8 : 0.55))
      .sort((a, b) => b.score - a.score || a.after - b.after);
    if (ranked[0] && (!ranked[1] || ranked[0].score - ranked[1].score >= 0.08))
      proposals.push(ranked[0]);
  }
  // Mutual ambiguity is also rejected: two old paragraphs competing for one
  // new paragraph must remain visible as removed/added, not get a guessed pair.
  const targets = new Map<number, Match[]>();
  for (const m of proposals) targets.set(m.after, [...(targets.get(m.after) || []), m]);
  for (const candidates of targets.values()) {
    candidates.sort((a, b) => b.score - a.score || a.before - b.before);
    if (candidates[1] && candidates[0].score - candidates[1].score < 0.08) continue;
    const m = candidates[0];
    matches.push(m);
    used.add(m.after);
    paired.add(m.before);
  }
  check(signal);
  const stable = stableOrder(matches),
    byBefore = new Map(matches.map((m) => [m.before, m]));
  const sections: PdfReport['sections'] = [];
  let changed = 0,
    same = 0,
    moved = 0,
    added = 0,
    removed = 0,
    unreadable = 0;
  for (const b of before) {
    const m = byBefore.get(b.ordinal);
    if (!m) {
      removed++;
      sections.push({
        title: `A: Seite ${b.page} · Textblock ${b.ordinal + 1}`,
        status: 'Entfernt oder ohne eindeutige Zuordnung',
        lines: [{ kind: 'removed', text: b.text }],
      });
      continue;
    }
    const a = after[m.after],
      relocated = !stable.has(b.ordinal) && !m.ambiguous;
    if (m.exact) same++;
    else changed++;
    if (relocated) moved++;
    sections.push({
      title: `A: Seite ${b.page} · B: Seite ${a.page}`,
      status:
        (m.exact ? 'Text gleich' : 'Text geändert') +
        (relocated ? ' · verschoben' : b.page !== a.page ? ' · andere Seite' : ''),
      details: [
        { label: 'Textblöcke', value: `A ${b.ordinal + 1} → B ${a.ordinal + 1}` },
        ...(m.ambiguous
          ? [
              {
                label: 'Zuordnung',
                value:
                  'Text mehrfach vorhanden; gleiche Vorkommen in Leserichtung zugeordnet. Position prüfen.',
              },
            ]
          : []),
        ...(!m.exact
          ? [
              {
                label: 'Zuordnung',
                value: 'Ähnliche Wörter; fachliche Bedeutung bitte selbst prüfen.',
              },
            ]
          : []),
      ],
      lines: m.exact ? [{ kind: 'same', text: b.text }] : compareWords(b.text, a.text),
    });
  }
  for (const b of after)
    if (!used.has(b.ordinal)) {
      added++;
      sections.push({
        title: `B: Seite ${b.page} · Textblock ${b.ordinal + 1}`,
        status: 'Hinzugefügt oder ohne eindeutige Zuordnung',
        lines: [{ kind: 'added', text: b.text }],
      });
    }
  for (const [label, pages] of [
    ['A', beforePages],
    ['B', afterPages],
  ] as const)
    for (const p of pages)
      if (!p.text.trim()) {
        unreadable++;
        sections.push({
          title: `${label}: Seite ${p.number}`,
          status: 'Nicht vollständig prüfbar',
          lines: [
            {
              kind: 'note',
              text: 'Kein auslesbarer Text. Diese Seite gilt nicht als identisch. Für Scans zuerst OCR anwenden.',
            },
          ],
        });
      }
  progress?.(1);
  return {
    title: 'PDF-Inhaltsvergleich',
    description: `A: ${names.before}\nB: ${names.after}\nTextblöcke werden auch über andere Seitenpositionen hinweg zugeordnet. Satz- und Wortvergleich; keine KI-Bedeutungsprüfung. Leerzeichen und Zeilenumbrüche werden vereinheitlicht, Großschreibung und Satzzeichen bleiben relevant. Bilder, Formatierung und reine Scanänderungen werden nicht geprüft. Unklare Treffer erscheinen als entfernt/hinzugefügt; gleiche wiederholte Texte sind ausdrücklich gekennzeichnet.`,
    stats: [
      { label: 'Textblöcke geändert', value: String(changed) },
      { label: 'Textblöcke gleich', value: String(same) },
      { label: 'Davon verschoben', value: String(moved) },
      { label: 'Hinzugefügt / nicht zugeordnet', value: String(added) },
      { label: 'Entfernt / nicht zugeordnet', value: String(removed) },
      { label: 'Seiten ohne Text', value: String(unreadable) },
    ],
    sections,
  };
}
