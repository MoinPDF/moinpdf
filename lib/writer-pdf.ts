import type { JSONContent } from '@tiptap/core';
import type {
  Content,
  ContentText,
  Style,
  TDocumentDefinitions,
  TableCell,
} from 'pdfmake/interfaces';
import { validateWriterDocument, writerPageSize, type WriterDocument } from './writer-model';

export const writerFonts = {
  MoinSans: {
    normal: 'DejaVuSans.ttf',
    bold: 'DejaVuSans-Bold.ttf',
    italics: 'DejaVuSans-Oblique.ttf',
    bolditalics: 'DejaVuSans-BoldOblique.ttf',
  },
  MoinSerif: {
    normal: 'DejaVuSerif.ttf',
    bold: 'DejaVuSerif-Bold.ttf',
    italics: 'DejaVuSerif-Italic.ttf',
    bolditalics: 'DejaVuSerif-BoldItalic.ttf',
  },
  MoinMono: {
    normal: 'DejaVuSansMono.ttf',
    bold: 'DejaVuSansMono-Bold.ttf',
    italics: 'DejaVuSansMono-Oblique.ttf',
    bolditalics: 'DejaVuSansMono-BoldOblique.ttf',
  },
};
const mm = (n: number) => (n * 72) / 25.4;
function textStyle(node: JSONContent): Style {
  const style: Style = {};
  for (const mark of node.marks || []) {
    if (mark.type === 'bold') style.bold = true;
    if (mark.type === 'italic') style.italics = true;
    if (mark.type === 'underline')
      style.decoration = [
        ...(Array.isArray(style.decoration) ? style.decoration : []),
        'underline',
      ];
    if (mark.type === 'strike')
      style.decoration = [
        ...(Array.isArray(style.decoration) ? style.decoration : []),
        'lineThrough',
      ];
    if (mark.type === 'textStyle') {
      const a = mark.attrs || {};
      if (a.fontFamily) style.font = a.fontFamily;
      if (a.fontSize) style.fontSize = parseFloat(a.fontSize);
      if (a.color) style.color = a.color;
      if (a.backgroundColor) style.background = a.backgroundColor;
    }
  }
  return style;
}

export function writerPdfDefinition(
  input: WriterDocument,
  language: 'de' | 'en' = 'de',
): TDocumentDefinitions {
  const doc = validateWriterDocument(input),
    s = doc.settings;
  const [width, height] = writerPageSize(s);
  const bodyWidth = mm(width - s.left - s.right),
    bodyHeight = mm(height - s.top - s.bottom);
  function blocks(nodes: JSONContent[], availableWidth: number, inTable = false): Content[] {
    const output: Content[] = [];
    for (const node of nodes) {
      const children = node.content || [];
      switch (node.type) {
        case 'paragraph':
        case 'heading': {
          const heading = node.type === 'heading',
            level = node.attrs?.level || 1;
          const runs: ContentText[] = children.map((n) => ({
            text: n.type === 'hardBreak' ? '\n' : n.text || '',
            ...textStyle(n),
          }));
          output.push({
            text: runs.length ? runs : ' ',
            fontSize: heading ? [24, 18, 14][level - 1] : 11,
            ...(heading ? { bold: true, headlineLevel: level } : {}),
            alignment: node.attrs?.textAlign || 'left',
            lineHeight: node.attrs?.lineHeight || 1.4,
            margin: [0, heading ? 8 : 0, 0, heading ? 8 : 6],
          });
          break;
        }
        case 'bulletList':
        case 'orderedList': {
          const items = children.map((n) => ({
            stack: blocks(n.content || [], availableWidth - 18, inTable),
          }));
          output.push(
            node.type === 'orderedList'
              ? { ol: items, start: node.attrs?.start || 1, margin: [0, 0, 0, 6] }
              : { ul: items, margin: [0, 0, 0, 6] },
          );
          break;
        }
        case 'blockquote':
          output.push({
            stack: blocks(children, availableWidth - 18, inTable),
            margin: [18, 4, 0, 8],
            color: '#465b63',
            italics: true,
          });
          break;
        case 'horizontalRule':
          output.push({
            canvas: [
              {
                type: 'line',
                x1: 0,
                y1: 0,
                x2: availableWidth,
                y2: 0,
                lineWidth: 0.8,
                lineColor: '#17a76e',
              },
            ],
            margin: [0, 8, 0, 10],
          });
          break;
        case 'pageBreak':
          if (inTable) throw new Error('Seitenumbrüche bitte außerhalb von Tabellen einfügen.');
          output.push({ text: '', pageBreak: 'after' });
          break;
        case 'image':
          output.push({
            image: node.attrs!.src,
            fit: [(availableWidth * node.attrs!.widthPercent) / 100, Math.max(60, bodyHeight - 24)],
            margin: [0, 4, 0, 10],
          });
          break;
        case 'table': {
          const rows: TableCell[][] = [];
          children.forEach((row, y) => {
            rows[y] ||= [];
            let x = 0;
            for (const cell of row.content || []) {
              while (rows[y][x] !== undefined) x++;
              const colspan = cell.attrs?.colspan || 1,
                rowspan = cell.attrs?.rowspan || 1;
              rows[y][x] = {
                stack: [],
                colSpan: colspan,
                rowSpan: rowspan,
                ...(cell.type === 'tableHeader' ? { bold: true, fillColor: '#ecf5ef' } : {}),
              };
              for (let yy = y; yy < y + rowspan; yy++) {
                rows[yy] ||= [];
                for (let xx = x; xx < x + colspan; xx++)
                  if (yy !== y || xx !== x) rows[yy][xx] = {};
              }
              x += colspan;
            }
          });
          const columns = rows[0].length;
          children.forEach((row, y) => {
            let x = 0;
            for (const cell of row.content || []) {
              while (!('stack' in rows[y][x])) x++;
              const span = cell.attrs?.colspan || 1;
              (rows[y][x] as { stack: Content[] }).stack = blocks(
                cell.content || [],
                Math.max(12, (availableWidth / columns) * span - 16),
                true,
              );
              x += span;
            }
          });
          output.push({
            table: {
              headerRows: children[0]?.content?.every((c) => c.type === 'tableHeader') ? 1 : 0,
              widths: Array(columns).fill('*'),
              body: rows,
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#b8c8c6',
              vLineColor: () => '#b8c8c6',
              paddingLeft: () => 6,
              paddingRight: () => 6,
              paddingTop: () => 5,
              paddingBottom: () => 2,
            },
            margin: [0, 4, 0, 12],
          });
          break;
        }
        default:
          throw new Error('Dieser Dokumentinhalt wird nicht unterstützt.');
      }
    }
    return output;
  }
  return {
    info: { title: doc.title || 'Dokument', creator: 'MoinPDF', producer: 'MoinPDF' },
    pageSize: { width: mm(width), height: mm(height) },
    pageMargins: [mm(s.left), mm(s.top), mm(s.right), mm(s.bottom)],
    defaultStyle: { font: 'MoinSans', fontSize: 11, color: '#17252b', lineHeight: 1.4 },
    content: blocks(doc.content.content!, bodyWidth),
    ...(s.header
      ? {
          header: {
            text: s.header,
            font: 'MoinSans',
            fontSize: 9,
            color: '#5c6d73',
            margin: [mm(s.left), mm(Math.max(3, s.top / 2 - 3)), mm(s.right), 0],
          } as Content,
        }
      : {}),
    ...(s.footer || s.pageNumbers
      ? {
          footer: (current: number, count: number): Content => ({
            columns: [
              { text: s.footer, width: '*' },
              ...(s.pageNumbers
                ? [
                    {
                      text:
                        language === 'de'
                          ? `Seite ${current} von ${count}`
                          : `Page ${current} of ${count}`,
                      width: 'auto',
                      alignment: 'right' as const,
                    },
                  ]
                : []),
            ],
            font: 'MoinSans',
            fontSize: 9,
            color: '#5c6d73',
            margin: [mm(s.left), mm(3), mm(s.right), 0],
          }),
        }
      : {}),
    // Keep a heading with the next paragraph when the current page is full.
    pageBreakBefore: (node, container) =>
      Boolean(node.headlineLevel && container.getFollowingNodesOnPage().length === 0),
  };
}

let fontLoad: Promise<Record<string, string>> | undefined;
async function loadFonts() {
  if (!fontLoad)
    fontLoad = (async () => {
      const result: Record<string, string> = {};
      await Promise.all(
        Object.values(writerFonts)
          .flatMap((f) => Object.values(f))
          .map(async (name) => {
            const response = await fetch('/vendor/editor-fonts/' + name);
            if (!response.ok)
              throw new Error(
                'Die Schriftarten konnten nicht geladen werden. Bitte erneut versuchen.',
              );
            const bytes = new Uint8Array(await response.arrayBuffer());
            let binary = '';
            for (let i = 0; i < bytes.length; i += 8192)
              binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            result[name] = btoa(binary);
          }),
      );
      return result;
    })().catch((error) => {
      fontLoad = undefined;
      throw error;
    });
  return fontLoad;
}
export async function createWriterPdf(document: WriterDocument, language: 'de' | 'en' = 'de') {
  const definition = writerPdfDefinition(document, language);
  const [module, vfs] = await Promise.all([import('pdfmake/build/pdfmake.js'), loadFonts()]);
  const pdfmake = module.default;
  // Never silently replace unsupported user characters with empty boxes.
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  const checkedFonts = new Map<string, ReturnType<typeof fontkit.create>>();
  function checkText(
    text: string,
    family: keyof typeof writerFonts,
    bold: boolean,
    italic: boolean,
  ) {
    const name =
      writerFonts[family][bold ? (italic ? 'bolditalics' : 'bold') : italic ? 'italics' : 'normal'];
    let font = checkedFonts.get(name);
    if (!font) {
      font = fontkit.create(Uint8Array.from(atob(vfs[name]), (c) => c.charCodeAt(0)));
      checkedFonts.set(name, font);
    }
    const missing = [
      ...new Set(
        [...text].filter(
          (c) =>
            !/\s/u.test(c) &&
            ![0x200c, 0x200d, 0xfe0e, 0xfe0f].includes(c.codePointAt(0)!) &&
            !font!.hasGlyphForCodePoint(c.codePointAt(0)!),
        ),
      ),
    ];
    if (missing.length)
      throw new Error(
        language === 'de'
          ? `Die gewählte Schrift unterstützt diese Zeichen nicht: ${missing.slice(0, 8).join(' ')}. Bitte die Schrift ändern.`
          : `The selected font does not support these characters: ${missing.slice(0, 8).join(' ')}. Please change the font.`,
      );
  }
  function checkNode(node: JSONContent, bold = false, italic = false) {
    const style = textStyle(node);
    if (node.text)
      checkText(
        node.text,
        (style.font || 'MoinSans') as keyof typeof writerFonts,
        Boolean(style.bold || bold),
        Boolean(style.italics || italic),
      );
    for (const child of node.content || [])
      checkNode(
        child,
        bold || node.type === 'heading' || node.type === 'tableHeader',
        italic || node.type === 'blockquote',
      );
  }
  const checked = validateWriterDocument(document);
  checkNode(checked.content);
  checkText(checked.settings.header + checked.settings.footer, 'MoinSans', false, false);
  pdfmake.addVirtualFileSystem(vfs);
  pdfmake.addFonts(writerFonts);
  return pdfmake.createPdf(definition).getBlob();
}
