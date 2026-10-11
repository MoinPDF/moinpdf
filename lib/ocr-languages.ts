export const ocrLanguages: [string, string][] = [
  ['deu', 'Deutsch'],
  ['deu+eng', 'Deutsch & Englisch'],
  ['eng', 'Englisch'],
  ['fra', 'Französisch'],
  ['spa', 'Spanisch'],
  ['ita', 'Italienisch'],
  ['por', 'Portugiesisch'],
  ['nld', 'Niederländisch'],
  ['pol', 'Polnisch'],
  ['ces', 'Tschechisch'],
  ['dan', 'Dänisch'],
  ['swe', 'Schwedisch'],
  ['nor', 'Norwegisch'],
  ['fin', 'Finnisch'],
  ['tur', 'Türkisch'],
  ['ukr', 'Ukrainisch'],
  ['rus', 'Russisch'],
  ['ara', 'Arabisch'],
  ['chi_sim', 'Chinesisch (vereinfacht)'],
  ['jpn', 'Japanisch'],
  ['kor', 'Koreanisch'],
  ['hin', 'Hindi'],
];
export const ocrLayouts: [string, string][] = [
  ['3', 'Automatische Seiteneinteilung'],
  ['6', 'Ein Textblock'],
  ['4', 'Eine Textspalte'],
  ['11', 'Verstreuter Text'],
  ['7', 'Eine Textzeile'],
];
export const individualOcrLanguages = ocrLanguages.filter(([code]) => !code.includes('+'));
export const MAX_OCR_LANGUAGES = 4;
export function parseOcrLanguages(value: string): string[] {
  const codes = typeof value === 'string' ? value.split('+') : [];
  if (
    !codes.length ||
    codes.length > MAX_OCR_LANGUAGES ||
    new Set(codes).size !== codes.length ||
    codes.some((code) => !individualOcrLanguages.some(([allowed]) => code === allowed))
  )
    throw new Error('Bitte eine bis vier der verfügbaren OCR-Sprachen auswählen.');
  return codes;
}
