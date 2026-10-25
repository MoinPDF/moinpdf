import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  LineRuleType,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  SectionType,
  PageOrientation,
  type ISectionOptions,
  type ParagraphChild,
} from 'docx';
import { ShapeRun } from 'docx/shapes';
import type { TextTarget } from './editor-model';
import { editorFontCatalog, matchingEditorFont } from './editor-font-catalog';

export type WordLayoutPage = {
  width: number;
  height: number;
  text: TextTarget[];
  background: Uint8Array;
  ocr: boolean;
  imageOnly: boolean;
  preservedText: number;
  preservedRects?: { x: number; y: number; w: number; h: number }[];
};
const twips = (pt: number) => Math.round(pt * 20);
const emu = (pt: number) => Math.round(pt * 12700);
const pixels = (pt: number) => (pt * 4) / 3;
const clean = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function wordFont(target: TextTarget) {
  const name = target.fontName?.replace(/^[A-Z]{6}\+/, '');
  // Use Office's metric-compatible families for the standard PDF fonts.
  if (name && /^(?:Arial|Helvetica|NimbusSans)/i.test(name)) return 'Arial';
  if (name && /^(?:Times|NimbusRoman)/i.test(name)) return 'Times New Roman';
  if (name && /^(?:Courier|NimbusMono)/i.test(name)) return 'Courier New';
  const matched = name && matchingEditorFont(name);
  const entry = editorFontCatalog.find((font) => font.id === matched);
  return (
    entry?.name ||
    name?.replace(
      /[-,](?:BoldItalic|BoldOblique|Bold|Italic|Oblique|Regular|Roman|Book|Medium)$/i,
      '',
    ) ||
    (target.family === 'serif'
      ? 'Times New Roman'
      : target.family === 'mono'
        ? 'Courier New'
        : 'Arial')
  );
}

function floating(x: number, y: number, background = false) {
  return {
    horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: emu(x) },
    verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: emu(y) },
    allowOverlap: true,
    lockAnchor: true,
    layoutInCell: false,
    behindDocument: background,
    wrap: { type: TextWrappingType.NONE },
  };
}

function textBox(target: TextTarget, page: WordLayoutPage, index: number) {
  const angle = ((target.rotation || 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  const boundsW = target.w * page.width,
    boundsH = target.h * page.height;
  const aspect = target.textAspect || boundsW / boundsH;
  const height = Math.min(boundsW / (c * aspect + s), boundsH / (s * aspect + c));
  const width = height * aspect;
  const centerX = (target.x + target.w / 2) * page.width;
  const centerY = (target.y + target.h / 2) * page.height;
  const pad =
    target.origin === 'ocr' || target.invisible ? 0 : Math.max(0.8, target.fontSize * 0.08);
  const children: TextRun[] = [];
  const font = wordFont(target);
  const runs = target.runs?.length
    ? target.runs
    : [{ start: 0, end: target.text.length, style: {} }];
  for (const run of runs) {
    children.push(
      new TextRun({
        text: clean(target.text.slice(run.start, run.end)),
        font,
        size: Math.max(2, Math.round(target.fontSize * 2)),
        bold: run.style?.bold ?? target.bold,
        italics: run.style?.italic ?? target.italic,
        color: (run.style?.color || target.color || '#000000').replace('#', ''),
        characterSpacing: twips((target.tracking || 0) * target.fontSize),
        scale: Math.min(600, Math.max(10, Math.round((target.textScaleX || 1) * 100))),
      }),
    );
  }
  return new ShapeRun({
    type: 'rectangle',
    fill: 'none',
    line: 'none',
    transformation: {
      width: pixels(Math.max(1, width)),
      height: pixels(Math.max(height, target.fontSize * 1.5)),
      rotation: ((target.rotation || 0) + 360) % 360,
    },
    floating: floating(centerX - width / 2, centerY - height / 2),
    textOptions: {
      verticalAlignment: 'top',
      wrap: false,
      margins: { left: pad, right: 0, top: 0, bottom: 0 },
    },
    altText: { name: `Text ${index + 1}`, title: '', description: '' },
    children: [
      new Paragraph({
        spacing: {
          before: 0,
          after: 0,
          line: twips(target.fontSize * 1.15),
          lineRule: LineRuleType.EXACT,
        },
        contextualSpacing: false,
        children,
      }),
    ],
  });
}

/** Each PDF page gets one section. Drawings do not consume body flow, so Word
 * cannot push a landscape page or dense positioned text onto an extra page. */
export function wordLayoutSection(page: WordLayoutPage): ISectionOptions {
  if (![page.width, page.height].every((n) => Number.isFinite(n) && n >= 10 && n <= 1584))
    throw new Error(
      'Dieses Seitenformat ist für Word zu groß. Bitte die PDF-Seiten zuerst verkleinern.',
    );
  const children: ParagraphChild[] = [
    new ImageRun({
      type: 'png',
      data: page.background,
      transformation: { width: pixels(page.width), height: pixels(page.height) },
      floating: floating(0, 0, true),
      altText: {
        name: 'PDF graphics',
        title: '',
        description: 'Images, lines and graphics from the PDF page',
      },
    }),
  ];
  for (const [index, target] of page.text.entries()) {
    if (
      ![target.x, target.y, target.w, target.h, target.fontSize].every(Number.isFinite) ||
      target.w <= 0 ||
      target.h <= 0 ||
      target.fontSize <= 0
    )
      throw new Error('Eine Textposition konnte nicht zuverlässig für Word übernommen werden.');
    children.push(textBox(target, page, index));
  }
  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        // docx swaps dimensions for landscape; supply the portrait dimensions.
        size: {
          width: twips(Math.min(page.width, page.height)),
          height: twips(Math.max(page.width, page.height)),
          orientation:
            page.width > page.height ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
        },
        margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0, gutter: 0 },
      },
    },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0, line: 1, lineRule: LineRuleType.EXACT },
        children,
      }),
    ],
  };
}

export async function packWordLayout(sections: ISectionOptions[], signal: AbortSignal) {
  signal.throwIfAborted();
  const blob = await Packer.toBlob(
    new Document({
      creator: 'MoinPDF',
      sections,
      styles: {
        default: {
          document: {
            run: { font: 'Arial', size: 22 },
            paragraph: { spacing: { before: 0, after: 0 } },
          },
        },
      },
    }),
  );
  signal.throwIfAborted();
  return blob;
}
