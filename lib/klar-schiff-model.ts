import { safeName } from './advanced-types';
import { dateCandidates, validDate } from './century-model';
import { fold, type EvidencePage } from './evidence-model';
import { applyKlarRules, type KlarRule } from './klar-schiff-rules';

export type KlarPage = {
  id: string;
  sourceId: string;
  name: string;
  page: number;
  kind: 'invoice' | 'letter' | 'document';
  sender: string;
  date: string;
  reference: string;
  number: number | null;
  total: number | null;
  excerpt: string;
  warnings: string[];
  duplicateOf: string;
  layout?: EvidencePage['words'];
  ruleName?: string;
};
export type KlarDocument = {
  id: string;
  title: string;
  filename: string;
  date: string;
  sender: string;
  pageIds: string[];
  confirmed: boolean;
};
export type KlarPlan = { pages: KlarPage[]; documents: KlarDocument[]; excluded: string[] };
export const emptyKlarPlan = (): KlarPlan => ({ pages: [], documents: [], excluded: [] });
export const klarPageId = (sourceId: string, page: number) => JSON.stringify([sourceId, page]);
export const klarFilename = (item: Pick<KlarDocument, 'date' | 'sender' | 'title'>) =>
  safeName([item.date, item.sender, item.title].filter(Boolean).join('_')).slice(0, 140) + '.pdf';

function inspectPage(page: EvidencePage): KlarPage {
  const text = page.lines.map((line) => line.text).join('\n');
  const invoice = text.match(
    /(?:rechnungs(?:nummer|[ -]?nr\.?)|invoice\s*(?:number|no\.?|#)|rechnung\s*(?:nr\.?)?)\s*[:#]?\s*([A-Z0-9][A-Z0-9./_-]{1,49})/i,
  );
  const letter = text.match(
    /(?:aktenzeichen|unser\s+zeichen|reference|ref\.)\s*[:#]\s*([A-Z0-9][A-Z0-9./_-]{1,49})/i,
  );
  const reference = invoice && /\d/.test(invoice[1]) ? invoice[1] : letter?.[1] || '';
  const kind =
    /(?:^|\n)\s*(?:rechnung|invoice|rechnungsnummer|rechnungs[ -]?nr\.?)(?:\s|:|$)/i.test(text)
      ? 'invoice'
      : /sehr geehrt|liebe[rns]?\s|dear\s|mit freundlichen|yours sincerely|betreff\s*:|subject\s*:/i.test(
            text,
          )
        ? 'letter'
        : 'document';
  const explicitSender = text.match(/^(?:absender|from|sender)\s*:\s*(.{3,100})$/im)?.[1];
  // A company name at the top is only a suggestion. Do not mistake arbitrary
  // body text, a recipient address or a continuation header for a sender.
  const heading = page.lines
    .slice(0, 3)
    .find(
      (line) =>
        line.words.some((word) => word.y < 0.2) &&
        /\b(?:GmbH|AG|KG|GbR|OHG|e\.V\.|Ltd\.?|Limited|Inc\.?|LLC)\b/i.test(line.text) &&
        !/^(?:an|to|rechnungsempfänger|bill to)\b/i.test(line.text),
    );
  const sender = (explicitSender || heading?.text || '').trim().slice(0, 100);
  const dates = dateCandidates([page]);
  const labelled = dates.filter((candidate) =>
    /(?:rechnungsdatum|invoice date|^datum\s*:|^date\s*:)/i.test(candidate.ref.text),
  );
  const candidates = labelled.length
    ? labelled
    : dates.filter(
        (candidate) =>
          !/fällig|due|liefer|delivery|leistungs|service|geburt|birth/i.test(candidate.ref.text) &&
          candidate.ref.rects.some((rect) => rect.y < 0.45),
      );
  const uniqueDates = [...new Set(candidates.map((candidate) => candidate.date))];
  const numbering = text.match(/\b(?:seite|page)\s*(\d{1,4})\s*(?:von|of|\/)\s*(\d{1,4})\b/i);
  const number = numbering ? Number(numbering[1]) : null;
  const total = numbering ? Number(numbering[2]) : null;
  const numberingValid =
    number !== null && total !== null && number > 0 && number <= total && total <= 400;
  const warnings: string[] = [];
  if (text.trim().length < 8)
    warnings.push('Kein verlässlicher Text erkannt. Seite im Original prüfen.');
  if (page.words.some((word) => word.confidence !== undefined && word.confidence < 65))
    warnings.push('Unsichere OCR-Zeichen. Angaben am Original prüfen.');
  if (uniqueDates.length > 1)
    warnings.push('Mehrere mögliche Dokumentdaten. Datum bitte auswählen.');
  if (numbering && !numberingValid) warnings.push('Unplausible gedruckte Seitenzählung.');
  return {
    id: klarPageId(page.sourceId, page.page),
    sourceId: page.sourceId,
    name: page.name,
    page: page.page,
    kind,
    sender,
    date: uniqueDates.length === 1 ? uniqueDates[0] : '',
    reference,
    number: numberingValid ? number : null,
    total: numberingValid ? total : null,
    excerpt: text.slice(0, 1600),
    warnings,
    duplicateOf: '',
    layout: page.words.slice(0, 1200).map(({ id, text, x, y, w, h, confidence }) => ({
      id,
      text,
      x,
      y,
      w,
      h,
      ...(confidence === undefined ? {} : { confidence }),
    })),
  };
}

/** Suggestions only: every page is retained and every document needs review. */
export function suggestKlarPlan(
  evidence: EvidencePage[],
  t: (text: string) => string = (text) => text,
  rules: KlarRule[] = [],
): KlarPlan {
  if (!evidence.length || evidence.length > 400) throw new Error('Bitte 1 bis 400 Seiten ordnen.');
  const pages = applyKlarRules(evidence.map(inspectPage), rules);
  if (new Set(pages.map((page) => page.id)).size !== pages.length)
    throw new Error('Eine Quellseite wurde mehrfach eingelesen.');
  const documents: KlarDocument[] = [];
  const assigned = new Map<string, KlarDocument>();
  const identities = new Map<string, KlarDocument>();
  const make = (page: KlarPage) => {
    const title = [
      t(page.kind === 'invoice' ? 'Rechnung' : page.kind === 'letter' ? 'Brief' : 'Dokument'),
      page.reference || (!page.sender ? page.name.replace(/\.[^.]+$/, '').slice(0, 70) : ''),
    ]
      .filter(Boolean)
      .join(' ');
    const item: KlarDocument = {
      id: 'klar-' + documents.length,
      title,
      sender: page.sender,
      date: page.date,
      filename: '',
      pageIds: [],
      confirmed: false,
    };
    item.filename = klarFilename(item);
    documents.push(item);
    return item;
  };
  const add = (page: KlarPage, item: KlarDocument) => {
    item.pageIds.push(page.id);
    assigned.set(page.id, item);
  };
  // First establish identities with both an issuer and a document reference.
  // Dates separate letters or re-issued invoices sharing the same reference.
  for (const page of pages) {
    if (!page.reference || !page.sender || (page.kind === 'letter' && !page.date)) continue;
    const key = JSON.stringify([page.kind, fold(page.sender), fold(page.reference), page.date]);
    let item = identities.get(key);
    if (!item) {
      item = make(page);
      identities.set(key, item);
    }
    add(page, item);
  }
  for (const [index, page] of pages.entries()) {
    if (assigned.has(page.id)) continue;
    const matches = page.reference
      ? documents.filter((item) => {
          const first = pages.find((candidate) => candidate.id === item.pageIds[0])!;
          return (
            first &&
            fold(first.reference) === fold(page.reference) &&
            (!page.sender || !item.sender || fold(page.sender) === fold(item.sender)) &&
            (!page.date || !item.date || page.date === item.date) &&
            (page.kind !== 'letter' || (!!page.date && page.date === item.date))
          );
        })
      : [];
    if (matches.length === 1) {
      add(page, matches[0]);
      if (!page.sender)
        page.warnings.push(
          'Zuordnung über Dokumentnummer; Absender auf dieser Seite nicht erkannt.',
        );
      continue;
    }
    const previous = pages[index - 1];
    const previousItem = previous && assigned.get(previous.id);
    const continues =
      previousItem &&
      previous.sourceId === page.sourceId &&
      previous.page + 1 === page.page &&
      !page.reference &&
      page.number !== 1 &&
      (!page.date || !previousItem.date || page.date === previousItem.date) &&
      (!page.sender || !previousItem.sender || fold(page.sender) === fold(previousItem.sender)) &&
      (page.number !== null && previous.number !== null
        ? page.number === previous.number + 1 && page.total === previous.total
        : page.kind === 'document');
    const item = continues ? previousItem : make(page);
    page.warnings.push(
      matches.length > 1
        ? 'Dokumentnummer ist nicht eindeutig. Zuordnung bitte prüfen.'
        : continues
          ? 'Zuordnung anhand der ursprünglichen Seitenfolge. Bitte prüfen.'
          : 'Dokumentgrenze nicht eindeutig. Zuordnung bitte prüfen.',
    );
    add(page, item);
  }
  // Restore document appearance order after the identity pass. Printed page
  // numbers are used only when all assigned pages carry the same total.
  documents.sort(
    (a, b) =>
      Math.min(...a.pageIds.map((id) => pages.findIndex((p) => p.id === id))) -
      Math.min(...b.pageIds.map((id) => pages.findIndex((p) => p.id === id))),
  );
  for (const item of documents) {
    item.pageIds.sort(
      (a, b) => pages.findIndex((p) => p.id === a) - pages.findIndex((p) => p.id === b),
    );
    const members = item.pageIds.map((id) => pages.find((p) => p.id === id)!);
    if (members.every((p) => p.number !== null) && new Set(members.map((p) => p.total)).size === 1)
      item.pageIds.sort(
        (a, b) => pages.find((p) => p.id === a)!.number! - pages.find((p) => p.id === b)!.number!,
      );
  }
  return { pages, documents, excluded: [] };
}

export function klarWarnings(plan: KlarPlan, document: KlarDocument): string[] {
  const pages = document.pageIds
    .map((id) => plan.pages.find((page) => page.id === id))
    .filter((p): p is KlarPage => !!p);
  const warnings = pages.flatMap((page) => page.warnings);
  if (!document.sender) warnings.push('Absender nicht erkannt. Bei Bedarf ergänzen.');
  if (!document.date) warnings.push('Dokumentdatum nicht erkannt. Bei Bedarf ergänzen.');
  if (pages.some((page) => page.duplicateOf))
    warnings.push('Mögliches Seitenduplikat. Beide Originalseiten vergleichen.');
  const numbered = pages.filter((page) => page.number !== null);
  const totals = new Set(numbered.map((page) => page.total));
  if (totals.size > 1)
    warnings.push('Unterschiedliche gedruckte Gesamtseitenzahlen. Zuordnung prüfen.');
  if (numbered.length && totals.size === 1) {
    const total = numbered[0].total!;
    const present = new Set(numbered.map((page) => page.number));
    const missing = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !present.has(n));
    if (missing.length) warnings.push(`Mögliche Seitenlücke: ${missing.join(', ')}.`);
    if (present.size < numbered.length) warnings.push('Gedruckte Seitennummer kommt mehrfach vor.');
  }
  return [...new Set(warnings)];
}

/** Move/exclude/split keeps a complete, disjoint partition of source pages. */
export function moveKlarPage(
  plan: KlarPlan,
  pageId: string,
  target: string,
  t: (text: string) => string = (text) => text,
): KlarPlan {
  const page = plan.pages.find((p) => p.id === pageId);
  if (!page) throw new Error('Quellseite fehlt.');
  if (target !== 'new' && target !== 'exclude' && !plan.documents.some((d) => d.id === target))
    throw new Error('Zieldokument fehlt.');
  if (plan.documents.find((d) => d.id === target)?.pageIds.includes(pageId)) return plan;
  let documents = plan.documents.map((item) => ({
    ...item,
    pageIds: item.pageIds.filter((id) => id !== pageId),
    confirmed: item.pageIds.includes(pageId) || item.id === target ? false : item.confirmed,
  }));
  if (target === 'new') {
    let index = 0;
    while (documents.some((item) => item.id === `manual-${index}`)) index++;
    const item: KlarDocument = {
      id: `manual-${index}`,
      title: t('Dokument'),
      date: page.date,
      sender: page.sender,
      filename: '',
      pageIds: [pageId],
      confirmed: false,
    };
    item.filename = klarFilename(item);
    documents.push(item);
  } else if (target !== 'exclude') {
    documents = documents.map((item) =>
      item.id === target ? { ...item, pageIds: [...item.pageIds, pageId] } : item,
    );
  }
  return {
    ...plan,
    documents: documents.filter((item) => item.pageIds.length),
    excluded: [
      ...plan.excluded.filter((id) => id !== pageId),
      ...(target === 'exclude' ? [pageId] : []),
    ],
  };
}

export function validateKlarPlan(plan: KlarPlan, expected: { sourceId: string; pages: number }[]) {
  const expectedIds = new Set(
    expected.flatMap((source) =>
      Array.from({ length: source.pages }, (_, i) => klarPageId(source.sourceId, i)),
    ),
  );
  const actual = plan.pages.map((page) => page.id);
  const partition = [...plan.documents.flatMap((item) => item.pageIds), ...plan.excluded];
  if (
    actual.length !== expectedIds.size ||
    new Set(actual).size !== actual.length ||
    plan.pages.some((page) => page.id !== klarPageId(page.sourceId, page.page)) ||
    actual.some((id) => !expectedIds.has(id)) ||
    partition.length !== actual.length ||
    new Set(partition).size !== partition.length ||
    partition.some((id) => !expectedIds.has(id))
  )
    throw new Error(
      'Die Seitenzuordnung ist unvollständig oder enthält doppelte Seiten. Bitte erneut erkennen.',
    );
  if (
    !plan.documents.length ||
    plan.documents.length > 400 ||
    new Set(plan.documents.map((item) => item.id)).size !== plan.documents.length ||
    plan.documents.some(
      (item) =>
        !item.confirmed ||
        !item.pageIds.length ||
        !item.title.trim() ||
        item.title.length > 160 ||
        !item.filename.trim() ||
        item.filename.length > 150 ||
        (item.date && !validDate(item.date)),
    )
  )
    throw new Error(
      'Bitte alle Dokumente mit Titel, Dateiname und gültigem Datum oder ohne Datum prüfen und bestätigen.',
    );
}
