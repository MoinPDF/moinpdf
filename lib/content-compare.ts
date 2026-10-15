import type { DiffLine, PdfReport } from './pdf-report';

export type ComparisonPage = { number: number; text: string; layoutNotes?: string[] };
type Block = {
  text: string;
  page: number;
  endPage?: number;
  ordinal: number;
  tokens: string[];
  terms: Set<string>;
};
export type ComparisonItem = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  upright: boolean;
};
/** Reconstruct horizontal reading order without mixing left/right columns at the same baseline. */
export function comparisonPage(
  number: number,
  items: ComparisonItem[],
  width: number,
): ComparisonPage {
  if (items.length > 30000) throw new Error('Zu viele Textpositionen auf einer Seite.');
  const nonempty = items.filter((i) => i.text.trim());
  if (nonempty.some((i) => !i.upright || ![i.x, i.y, i.w, i.h].every(Number.isFinite)))
    return {
      number,
      text: nonempty.map((i) => i.text).join('\n'),
      layoutNotes: [
        'Gedrehter oder vertikaler Text: ursprüngliche Textreihenfolge erhalten; Leserichtung manuell prüfen.',
      ],
    };
  type Line = ComparisonItem & { parts: ComparisonItem[] };
  const rows: ComparisonItem[][] = [];
  for (const item of [...nonempty].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.at(-1);
    if (row && Math.abs(item.y - row[0].y) <= Math.max(2, Math.min(item.h, row[0].h) * 0.45))
      row.push(item);
    else rows.push([item]);
  }
  const lines: Line[] = [],
    gaps: { x: number; left: number; right: number }[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let current: ComparisonItem[] = [];
    const finish = () => {
      if (!current.length) return;
      const first = current[0],
        right = Math.max(...current.map((i) => i.x + i.w));
      lines.push({
        ...first,
        w: right - first.x,
        h: Math.max(...current.map((i) => i.h)),
        text: current
          .map((i, n) =>
            n &&
            i.x - (current[n - 1].x + current[n - 1].w) < Math.min(i.h, current[n - 1].h) * 0.12
              ? i.text
              : ' ' + i.text,
          )
          .join('')
          .trim(),
        parts: current,
      });
      current = [];
    };
    for (const item of row) {
      const prev = current.at(-1);
      if (prev && item.x - prev.x - prev.w > Math.max(18, Math.max(item.h, prev.h) * 2.5)) {
        gaps.push({ x: (prev.x + prev.w + item.x) / 2, left: prev.x + prev.w, right: item.x });
        finish();
      }
      current.push(item);
    }
    finish();
  }
  // Count overlapping whitespace intervals in O(n log n), including dense pages.
  const starts = gaps.map((g) => g.left + 2).sort((a, b) => a - b);
  const ends = gaps.map((g) => g.right - 2).sort((a, b) => a - b);
  const boundaryCount = (values: number[], x: number, inclusive: boolean) => {
    let low = 0,
      high = values.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (values[mid] < x || (inclusive && values[mid] === x)) low = mid + 1;
      else high = mid;
    }
    return low;
  };
  const candidate = gaps
    .map((g) => ({
      x: g.x,
      count: boundaryCount(starts, g.x, false) - boundaryCount(ends, g.x, true),
    }))
    .filter((g) => g.x > width * 0.2 && g.x < width * 0.8)
    .sort((a, b) => b.count - a.count)[0];
  const gutter = candidate && candidate.count >= 2 ? candidate.x : null;
  const ordered: Line[] = [];
  if (gutter !== null) {
    let band: Line[] = [];
    const flush = () => {
      ordered.push(...band.filter((l) => l.x < gutter), ...band.filter((l) => l.x >= gutter));
      band = [];
    };
    for (const line of [...lines].sort((a, b) => a.y - b.y || a.x - b.x)) {
      if (line.x < gutter && line.x + line.w > gutter) {
        flush();
        ordered.push(line);
      } else band.push(line);
    }
    flush();
  } else ordered.push(...lines.sort((a, b) => a.y - b.y || a.x - b.x));
  let text = '';
  let previous: Line | undefined;
  for (const line of ordered) {
    const newParagraph =
      previous &&
      (line.y < previous.y ||
        line.y - previous.y > Math.max(line.h, previous.h) * 1.7 ||
        Math.abs(line.x - previous.x) > Math.max(line.h, previous.h) * 1.5);
    text += (text ? (newParagraph ? '\n\n' : '\n') : '') + line.text;
    previous = line;
  }
  return {
    number,
    text,
    layoutNotes: [
      ...(gutter !== null
        ? [
            'Zwei Spalten anhand wiederkehrender Zwischenräume erkannt; Tabellen und komplexe Layouts bitte gegen die Seite prüfen.',
          ]
        : []),
    ],
  };
}
export function criticalChanges(before: string, after: string): string[] {
  const tokens = (s: string, pattern: RegExp) =>
    (s.toLocaleLowerCase('de').match(pattern) || []).join('|');
  const flags: string[] = [];
  if (
    tokens(before, /[-+]?\d+(?:[.,:/-]\d+)*(?:\s*[%€$])?/g) !==
    tokens(after, /[-+]?\d+(?:[.,:/-]\d+)*(?:\s*[%€$])?/g)
  )
    flags.push('Zahlen, Daten oder Beträge geändert.');
  if (
    tokens(before, /\b(?:nicht|kein(?:e|en|em|er|es)?|ohne|not|no|never|without)\b/g) !==
    tokens(after, /\b(?:nicht|kein(?:e|en|em|er|es)?|ohne|not|no|never|without)\b/g)
  )
    flags.push('Verneinung hinzugefügt oder entfernt.');
  if (
    tokens(
      before,
      /\b(?:muss|müssen|darf|dürfen|soll|sollen|verpflichtet|must|shall|may|required)\b/g,
    ) !==
    tokens(
      after,
      /\b(?:muss|müssen|darf|dürfen|soll|sollen|verpflichtet|must|shall|may|required)\b/g,
    )
  )
    flags.push('Wörter zu Pflicht oder Erlaubnis geändert.');
  return flags;
}
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
  // Join only probable continuations on consecutive selected pages. Preserve both page numbers.
  for (let i = 1; i < result.length; i++) {
    const a = result[i - 1],
      b = result[i];
    if (
      b.page === (a.endPage || a.page) + 1 &&
      !/[.!?:;]["'»”)]?$/u.test(a.text) &&
      /^[\p{Ll}]/u.test(b.text)
    ) {
      a.text = a.text.replace(/[-‐]$/u, '') + (/[-‐]$/u.test(a.text) ? '' : ' ') + b.text;
      a.endPage = b.endPage || b.page;
      a.tokens = tokenize(a.text);
      a.terms = new Set(
        a.tokens.filter((t) => /[\p{L}\p{N}]/u.test(t)).map((t) => t.toLocaleLowerCase('de')),
      );
      result.splice(i, 1);
      i--;
    }
  }
  result.forEach((b, i) => {
    b.ordinal = i;
  });
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
  for (const [label, pages] of [
    ['A', beforePages],
    ['B', afterPages],
  ] as const)
    for (const page of pages)
      if (page.layoutNotes?.length)
        sections.push({
          title: `${label}: Seite ${page.number} · Layout`,
          status: 'Lesereihenfolge prüfen',
          lines: page.layoutNotes.map((text) => ({ kind: 'note', text })),
        });
  const pageLabel = (b: Block) => (b.endPage ? `${b.page}–${b.endPage}` : String(b.page));
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
        title: `A: Seite ${pageLabel(b)} · Textblock ${b.ordinal + 1}`,
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
      title: `A: Seite ${pageLabel(b)} · B: Seite ${pageLabel(a)}`,
      status:
        (m.exact ? 'Text gleich' : 'Text geändert') +
        (relocated ? ' · verschoben' : b.page !== a.page ? ' · andere Seite' : ''),
      details: [
        { label: 'Textblöcke', value: `A ${b.ordinal + 1} → B ${a.ordinal + 1}` },
        ...(b.endPage || a.endPage
          ? [
              {
                label: 'Seitenumbruch',
                value:
                  'Wahrscheinliche Satzfortsetzung über aufeinanderfolgende Seiten zusammengeführt; am Original prüfen.',
              },
            ]
          : []),
        ...(!m.exact
          ? criticalChanges(b.text, a.text).map((value) => ({ label: 'Prüfhinweis', value }))
          : []),
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
      ].map((detail) => ({ ...detail, translateValue: true })),
      lines: m.exact ? [{ kind: 'same', text: b.text }] : compareWords(b.text, a.text),
    });
  }
  for (const b of after)
    if (!used.has(b.ordinal)) {
      added++;
      sections.push({
        title: `B: Seite ${pageLabel(b)} · Textblock ${b.ordinal + 1}`,
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
    description: `A: ${names.before}\nB: ${names.after}\nTextblöcke werden auch über andere Seitenpositionen hinweg zugeordnet. Satz- und Wortvergleich mit Hinweisen auf Zahlen, Verneinungen und Pflichtwörter; keine abschließende fachliche Bedeutungsprüfung. Leerzeichen und Zeilenumbrüche werden vereinheitlicht, Großschreibung und Satzzeichen bleiben relevant. Bilder, Formatierung und reine Scanänderungen werden nicht geprüft. Unklare Treffer erscheinen als entfernt/hinzugefügt; gleiche wiederholte Texte sind ausdrücklich gekennzeichnet.`,
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
