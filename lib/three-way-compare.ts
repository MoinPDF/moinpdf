import { compareContent, type ComparisonPage, type ContentAlignment } from './content-compare';
import type { PdfReport } from './pdf-report';

/** Compare both branches to the same base, retaining unresolved blocks in full. */
export async function compareThreeWays(
  base: ComparisonPage[],
  a: ComparisonPage[],
  b: ComparisonPage[],
  names: { base: string; a: string; b: string },
  signal?: AbortSignal,
  progress?: (n: number) => void,
): Promise<PdfReport> {
  let left: ContentAlignment | undefined, right: ContentAlignment | undefined;
  await compareContent(
    base,
    a,
    { before: names.base, after: names.a },
    signal,
    (p) => progress?.(p * 0.5),
    (v) => {
      left = v;
    },
  );
  await compareContent(
    base,
    b,
    { before: names.base, after: names.b },
    signal,
    (p) => progress?.(0.5 + p * 0.5),
    (v) => {
      right = v;
    },
  );
  signal?.throwIfAborted();
  const l = left!,
    r = right!,
    lm = new Map(l.matches.map((m) => [m.before, m])),
    rm = new Map(r.matches.map((m) => [m.before, m]));
  const sections: PdfReport['sections'] = [
    {
      title: 'Dateien',
      details: [
        { label: 'Ausgangsfassung', value: names.base },
        { label: 'Fassung A', value: names.a },
        { label: 'Fassung B', value: names.b },
      ],
    },
  ];
  const counts = { same: 0, shared: 0, onlyA: 0, onlyB: 0, conflict: 0, unclear: 0 };
  for (const original of l.before) {
    const am = lm.get(original.ordinal),
      bm = rm.get(original.ordinal),
      av = am ? l.after[am.after] : undefined,
      bv = bm ? r.after[bm.after] : undefined;
    let state: keyof typeof counts;
    if (!am || !bm || am.ambiguous || bm.ambiguous) state = 'unclear';
    else if (av!.text === original.text && bv!.text === original.text) state = 'same';
    else if (av!.text === bv!.text) state = 'shared';
    else if (av!.text === original.text) state = 'onlyB';
    else if (bv!.text === original.text) state = 'onlyA';
    else state = 'conflict';
    counts[state]++;
    sections.push({
      title: `Basis: Seite ${original.page} · A: ${av?.page ?? '–'} · B: ${bv?.page ?? '–'}`,
      status: {
        same: 'Keine Textänderung',
        shared: 'Gleiche Änderung in A und B',
        onlyA: 'Nur Fassung A geändert',
        onlyB: 'Nur Fassung B geändert',
        conflict: 'Widersprüchliche Textänderungen',
        unclear: 'Entfernung oder Zuordnung unklar',
      }[state],
      details: [
        { label: 'Ausgangsfassung', value: original.text },
        { label: 'Fassung A', value: av?.text ?? '–' },
        { label: 'Fassung B', value: bv?.text ?? '–' },
      ],
      lines: [
        {
          kind: 'note',
          text:
            state === 'unclear'
              ? 'Nicht eindeutig zugeordnete Texte nicht als sichere Löschung oder Übereinstimmung behandeln.'
              : state === 'conflict'
                ? 'Beide Fassungen ändern denselben Ausgangstext unterschiedlich. Am Original prüfen.'
                : 'Textvergleich; Position, Bilder und Formatierung zusätzlich am Original prüfen.',
        },
      ],
    });
  }
  const usedA = new Set(l.matches.map((m) => m.after)),
    usedB = new Set(r.matches.map((m) => m.after));
  const extraA = l.after.filter((v) => !usedA.has(v.ordinal)),
    extraB = r.after.filter((v) => !usedB.has(v.ordinal)),
    sharedB = new Set<number>();
  for (const block of extraA) {
    const matches = extraB.filter((v) => v.text === block.text);
    const shared = matches.length === 1 && extraA.filter((v) => v.text === block.text).length === 1;
    if (shared) sharedB.add(matches[0].ordinal);
    counts.unclear++;
    sections.push({
      title: `A: Seite ${block.page}${shared ? ' · B: ' + matches[0].page : ''}`,
      status: shared
        ? 'Gleicher zusätzlicher oder nicht zugeordneter Text'
        : 'Zusätzlicher oder nicht zugeordneter Text in A',
      lines: [{ kind: 'added', text: block.text }],
    });
  }
  for (const block of extraB)
    if (!sharedB.has(block.ordinal)) {
      counts.unclear++;
      sections.push({
        title: `B: Seite ${block.page}`,
        status: 'Zusätzlicher oder nicht zugeordneter Text in B',
        lines: [{ kind: 'added', text: block.text }],
      });
    }
  for (const [label, pages] of [
    ['Basis', base],
    ['A', a],
    ['B', b],
  ] as const)
    for (const page of pages) {
      if (!page.text.trim()) {
        counts.unclear++;
        sections.push({
          title: `${label}: Seite ${page.number}`,
          status: 'Nicht vollständig prüfbar',
          lines: [{ kind: 'note', text: 'Kein auslesbarer Text. Für Scans zuerst OCR anwenden.' }],
        });
      }
      if (page.layoutNotes?.length)
        sections.push({
          title: `${label}: Seite ${page.number}`,
          status: 'Lesereihenfolge prüfen',
          lines: page.layoutNotes.map((text) => ({ kind: 'note', text })),
        });
    }
  return {
    title: 'Drei Fassungen vergleichen',
    description: `Beide Bearbeitungen werden derselben Ausgangsfassung zugeordnet. Der Bericht verändert keine Datei. Ähnliche und wiederholte Textstellen bleiben prüfpflichtig; keine automatische Zusammenführung. Bilder, Formatierung und Textverschiebungen sind keine Textkonflikte.`,
    stats: [
      { label: 'Ohne Textänderung', value: String(counts.same) },
      { label: 'Gleiche Änderungen', value: String(counts.shared) },
      { label: 'Nur A geändert', value: String(counts.onlyA) },
      { label: 'Nur B geändert', value: String(counts.onlyB) },
      { label: 'Textkonflikte', value: String(counts.conflict) },
      { label: 'Unklare oder zusätzliche Textstellen', value: String(counts.unclear) },
    ],
    sections,
  };
}
