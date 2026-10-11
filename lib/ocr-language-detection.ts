import { francAll } from 'franc';
const mapping: Record<string, string> = {
  deu: 'deu',
  eng: 'eng',
  fra: 'fra',
  spa: 'spa',
  ita: 'ita',
  por: 'por',
  nld: 'nld',
  pol: 'pol',
  ces: 'ces',
  dan: 'dan',
  swe: 'swe',
  nob: 'nor',
  nno: 'nor',
  fin: 'fin',
  tur: 'tur',
  ukr: 'ukr',
  rus: 'rus',
  arb: 'ara',
  ara: 'ara',
  cmn: 'chi_sim',
  jpn: 'jpn',
  kor: 'kor',
  hin: 'hin',
};
export function detectOcrLanguages(text: string, ocrConfidence: number): string[] {
  if (!Number.isFinite(ocrConfidence) || ocrConfidence < 65)
    throw new Error(
      'Die OCR-Probe ist zu unsicher für eine automatische Sprachwahl. Bitte die Sprachen manuell auswählen.',
    );
  const segments = text
    .split(/\n+/)
    .flatMap((line) => (line.length > 600 ? line.match(/.{1,400}(?:\s|$)/gu) || [line] : [line]))
    .filter((line) => (line.match(/\p{L}/gu) || []).length >= 60);
  if (!segments.length)
    throw new Error(
      'Zu wenig lesbarer Fließtext für eine automatische Sprachwahl. Bitte die Sprachen manuell auswählen.',
    );
  const counts = new Map<string, number>();
  for (const segment of segments) {
    const ranked = francAll(segment, { minLength: 60 }),
      first = ranked[0],
      second = ranked[1];
    const code = first && mapping[first[0]];
    if (!code || (second && first[1] - second[1] < 0.05))
      throw new Error(
        'Mindestens ein Textabschnitt lässt sich keiner unterstützten Sprache eindeutig zuordnen. Bitte die Sprachen manuell auswählen.',
      );
    counts.set(code, (counts.get(code) || 0) + segment.length);
  }
  if (counts.size > 8)
    throw new Error(
      'Mehr als acht Sprachen erkannt. Bitte das Dokument teilen oder Sprachen manuell auswählen.',
    );
  return [...counts].sort((a, b) => b[1] - a[1]).map(([code]) => code);
}
