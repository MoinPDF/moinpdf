import type { FontFamily } from './editor-model';

export const editorFontCatalog = [
  {
    id: 'liberation-sans',
    name: 'Liberation Sans',
    family: 'sans',
    file: 'LiberationSans',
    equivalent: 'Arial / Helvetica',
  },
  {
    id: 'liberation-serif',
    name: 'Liberation Serif',
    family: 'serif',
    file: 'LiberationSerif',
    equivalent: 'Times New Roman',
  },
  {
    id: 'liberation-mono',
    name: 'Liberation Mono',
    family: 'mono',
    file: 'LiberationMono',
    equivalent: 'Courier New',
  },
  { id: 'carlito', name: 'Carlito', family: 'sans', file: 'Carlito', equivalent: 'Calibri' },
  { id: 'caladea', name: 'Caladea', family: 'serif', file: 'Caladea', equivalent: 'Cambria' },
  { id: 'dejavu-sans', name: 'DejaVu Sans', family: 'sans', file: 'DejaVuSans', equivalent: '' },
  {
    id: 'dejavu-serif',
    name: 'DejaVu Serif',
    family: 'serif',
    file: 'DejaVuSerif',
    equivalent: '',
  },
  {
    id: 'dejavu-mono',
    name: 'DejaVu Sans Mono',
    family: 'mono',
    file: 'DejaVuSansMono',
    equivalent: '',
  },
  { id: 'noto-sans', name: 'Noto Sans', family: 'sans', file: 'NotoSans', equivalent: '' },
  { id: 'noto-serif', name: 'Noto Serif', family: 'serif', file: 'NotoSerif', equivalent: '' },
  { id: 'rubik', name: 'Rubik', family: 'sans', file: 'Rubik', equivalent: '' },
  {
    id: 'liberation-sans-narrow',
    name: 'Liberation Sans Narrow',
    family: 'sans',
    file: 'LiberationSansNarrow',
    equivalent: 'Arial Narrow',
  },
  {
    id: 'dejavu-sans-condensed',
    name: 'DejaVu Sans Condensed',
    family: 'sans',
    file: 'DejaVuSansCondensed',
    equivalent: '',
  },
  {
    id: 'dejavu-serif-condensed',
    name: 'DejaVu Serif Condensed',
    family: 'serif',
    file: 'DejaVuSerifCondensed',
    equivalent: '',
  },
] as const;
export type EditorFontChoice = 'auto' | (typeof editorFontCatalog)[number]['id'];
export function fontFile(id: EditorFontChoice, bold = false, italic = false) {
  const entry = editorFontCatalog.find((font) => font.id === id) || editorFontCatalog[0];
  const dejavu = entry.file.startsWith('DejaVu');
  const oblique = dejavu && entry.family !== 'serif' ? 'Oblique' : 'Italic';
  const style = bold
    ? 'Bold' + (italic ? oblique : '')
    : italic
      ? oblique
      : dejavu
        ? ''
        : 'Regular';
  return {
    ...entry,
    path: '/vendor/editor-fonts/' + entry.file + (style ? '-' + style : '') + '.ttf',
  };
}
export function matchingEditorFont(name = '', family: FontFamily = 'sans'): EditorFontChoice {
  const value = name
    .replace(/^[A-Z]{6}\+/, '')
    .replace(/[\s_-]/g, '')
    .toLowerCase();
  if (/calibri|carlito/.test(value)) return 'carlito';
  if (/cambria|caladea/.test(value)) return 'caladea';
  if (/^notosans(?:regular|bold|italic|$)/.test(value)) return 'noto-sans';
  if (/^notoserif(?:regular|bold|italic|$)/.test(value)) return 'noto-serif';
  if (/^rubik/.test(value)) return 'rubik';
  if (/arialnarrow|liberationsansnarrow/.test(value)) return 'liberation-sans-narrow';
  if (/dejavusanscondensed/.test(value)) return 'dejavu-sans-condensed';
  if (/dejavuserifcondensed/.test(value)) return 'dejavu-serif-condensed';
  if (/dejavusansmono/.test(value)) return 'dejavu-mono';
  if (/dejavuserif/.test(value)) return 'dejavu-serif';
  if (/dejavusans/.test(value)) return 'dejavu-sans';
  if (/courier|liberationmono|nimbusmono/.test(value)) return 'liberation-mono';
  if (/times|liberationserif|nimbusroman/.test(value)) return 'liberation-serif';
  if (/arial|helvetica|liberationsans|nimbussans/.test(value)) return 'liberation-sans';
  return family === 'serif'
    ? 'liberation-serif'
    : family === 'mono'
      ? 'liberation-mono'
      : 'liberation-sans';
}
export const readableFontName = (name: string) =>
  name.replace(/^[A-Z]{6}\+/, '').replace(/-\d+$/, '');
