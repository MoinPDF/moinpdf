import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  WidthType,
  HeadingLevel,
} from 'docx';
import { editorParagraphs, type TextTarget } from './editor-model';
import type { EditorTable } from './editor-tables';
import type { Source } from './pdf-engine';
import type { ExportFile } from './advanced-types';
export type StructuredWordPage = {
  width: number;
  height: number;
  text: TextTarget[];
  tables: EditorTable[];
  images: { x: number; y: number; w: number; h: number; data: Uint8Array }[];
};
const key = (t: TextTarget, page: number) => {
  const number = /^\s*(?:(?:Seite|Page)\s*)?(\d+)(?:\s*(?:von|of|\/)\s*\d+)?\s*$/i.exec(t.text);
  return number && Number(number[1]) === page + 1 ? '@page-number' : t.text.trim();
};
function textRuns(target: TextTarget, width: number) {
  const runs = target.runs?.length
    ? target.runs
    : [{ start: 0, end: target.text.length, style: {} }];
  return runs.map(
    (run) =>
      new TextRun({
        text: target.text.slice(run.start, run.end).replace(/[\r\n]+/g, ' '),
        font: (
          run.style.originalFontName ||
          target.fontName ||
          (target.family === 'serif' ? 'Times New Roman' : 'Arial')
        ).replace(/^[A-Z]{6}\+/, ''),
        size: Math.max(
          2,
          Math.round((run.style.fontScale ? run.style.fontScale * width : target.fontSize) * 2),
        ),
        bold: run.style.bold ?? target.bold,
        italics: run.style.italic ?? target.italic,
        color: (run.style.color || target.color || '#222222').slice(1),
      }),
  );
}
export async function packStructuredWord(pages: StructuredWordPage[], signal: AbortSignal) {
  if (!pages.length) throw new Error('Keine Seiten für Word vorhanden.');
  const repeated = new Map<string, number>();
  const pageIndex = new Map(pages.flatMap((p, i) => p.text.map((t) => [t, i] as const)));
  const furnitureKey = (t: TextTarget) => key(t, pageIndex.get(t) || 0);
  for (const page of pages) {
    const keys = new Set(
      page.text
        .filter((t) => t.y < 0.08 || t.y > 0.92)
        .map((t) => `${t.y < 0.08 ? 'h' : 'f'}:${furnitureKey(t)}`),
    );
    for (const k of keys) repeated.set(k, (repeated.get(k) || 0) + 1);
  }
  const isRepeated = (t: TextTarget) =>
    (t.y < 0.08 || t.y > 0.92) &&
    pages.length > 1 &&
    (repeated.get(`${t.y < 0.08 ? 'h' : 'f'}:${furnitureKey(t)}`) || 0) >=
      Math.max(2, Math.ceil(pages.length * 0.7));
  const sectionWidth = pages[0].width,
    sectionHeight = pages[0].height,
    contentWidth = sectionWidth - 72;
  const furniture = (top: boolean) => {
    const seen = new Set<string>();
    return pages
      .flatMap((p) => p.text)
      .filter((t) => {
        if (!isRepeated(t) || !(top ? t.y < 0.08 : t.y > 0.92) || seen.has(furnitureKey(t)))
          return false;
        seen.add(furnitureKey(t));
        return true;
      })
      .map(
        (t) =>
          new Paragraph({
            children:
              furnitureKey(t) === '@page-number'
                ? [new TextRun({ children: [PageNumber.CURRENT] })]
                : textRuns(t, sectionWidth),
          }),
      );
  };
  const children: (Paragraph | Table)[] = [];
  for (const page of pages) {
    signal.throwIfAborted();
    const used = new Set(page.tables.flatMap((t) => t.cells.flatMap((c) => [...c.textIds])));
    const body = page.text.filter((t) => !used.has(t.id) && !isRepeated(t));
    const sizes = body.map((t) => t.fontSize).sort((a, b) => a - b),
      median = sizes[Math.floor(sizes.length / 2)] || 12;
    const blocks: { x: number; y: number; value: Paragraph | Table }[] = editorParagraphs(
      body,
      page.width,
      page.height,
    ).map((t) => ({
      x: t.x,
      y: t.y,
      value: new Paragraph({
        children: textRuns(t, page.width),
        spacing: { after: 120 },
        ...(t.fontSize >= median * 1.35
          ? {
              heading: t.fontSize >= median * 1.8 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            }
          : {}),
      }),
    }));
    for (const table of page.tables) {
      const total = table.columns.at(-1)! - table.columns[0];
      const widths = table.columns
        .slice(0, -1)
        .map((n, i) => Math.round(((table.columns[i + 1] - n) / total) * contentWidth * 20));
      blocks.push({
        x: table.columns[0] / page.width,
        y: table.rows[0] / page.height,
        value: new Table({
          width: { size: Math.round(contentWidth * 20), type: WidthType.DXA },
          columnWidths: widths,
          rows: table.rows.slice(0, -1).map(
            (_, row) =>
              new TableRow({
                tableHeader: row === 0,
                children: table.cells
                  .filter((c) => c.row === row)
                  .sort((a, b) => a.column - b.column)
                  .map(
                    (cell) =>
                      new TableCell({
                        columnSpan: cell.columnSpan,
                        rowSpan: cell.rowSpan,
                        width: {
                          size: widths
                            .slice(cell.column, cell.column + cell.columnSpan)
                            .reduce((a, b) => a + b, 0),
                          type: WidthType.DXA,
                        },
                        children: editorParagraphs(
                          page.text.filter((t) => cell.textIds.includes(t.id)),
                          page.width,
                          page.height,
                        )
                          .map((t) => new Paragraph({ children: textRuns(t, page.width) }))
                          .concat(cell.textIds.length ? [] : [new Paragraph('')]),
                      }),
                  ),
              }),
          ),
        }),
      });
    }
    for (const image of page.images) {
      const width = Math.min(contentWidth, image.w * page.width),
        height = (width / (image.w * page.width)) * image.h * page.height;
      blocks.push({
        x: image.x,
        y: image.y,
        value: new Paragraph({
          children: [
            new ImageRun({
              type: 'png',
              data: image.data,
              transformation: { width: (width * 96) / 72, height: (height * 96) / 72 },
            }),
          ],
        }),
      });
    }
    blocks.sort((a, b) => (Math.abs(a.y - b.y) < 0.005 ? a.x - b.x : a.y - b.y));
    children.push(...blocks.map((b) => b.value));
  }
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(sectionWidth * 20), height: Math.round(sectionHeight * 20) },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        headers: { default: new Header({ children: furniture(true) }) },
        footers: { default: new Footer({ children: furniture(false) }) },
        children: children.length ? children : [new Paragraph('')],
      },
    ],
  });
  signal.throwIfAborted();
  const output = await Packer.toBlob(doc);
  signal.throwIfAborted();
  return output;
}

export async function createStructuredWordFile(
  source: Source,
  signal: AbortSignal,
  options: { report?: (message: string) => void } = {},
): Promise<ExportFile> {
  const { readWordLayoutPage, createEditorRecognizer } = await import('./word-layout-source');
  const { readEditorTables } = await import('./editor-table-workspace');
  const { inspectObjectTree } = await import('./native-pdf');
  const recognizer = createEditorRecognizer(signal),
    pages: StructuredWordPage[] = [];
  let imageBytes = 0,
    tableCount = 0,
    fallbackPages = 0;
  try {
    for (let index = 0; index < source.pdf.numPages; index++) {
      signal.throwIfAborted();
      options.report?.(`Seite ${index + 1}/${source.pdf.numPages} als Word-Struktur aufbereiten …`);
      const layout = await readWordLayoutPage(source, index, signal, { recognizer, ...options });
      const item = { id: `word-${index}`, sourceId: source.id, index, rotation: 0, selected: true };
      let tables: EditorTable[] = [];
      try {
        tables = await readEditorTables(source, item, [], signal);
      } catch {
        signal.throwIfAborted();
      }
      tables = tables.filter((table) =>
        table.cells.every((cell) =>
          cell.textIds.every((id) => layout.text.some((t) => t.id === id)),
        ),
      );
      tableCount += tables.length;
      const page: StructuredWordPage = {
        width: layout.width,
        height: layout.height,
        text: layout.text,
        tables,
        images: [],
      };
      let boxes: { x: number; y: number; w: number; h: number }[];
      if (layout.imageOnly) {
        boxes = [{ x: 0, y: 0, w: 1, h: 1 }];
        fallbackPages++;
      } else {
        try {
          const grid = new Set(tables.flatMap((t) => t.original.paths.map((p) => p.index)));
          boxes = [
            ...(await inspectObjectTree(source.bytes, index, signal))
              .filter(
                (o) =>
                  o.type !== 'text' &&
                  o.type !== 'group' &&
                  !(o.type === 'path' && !o.path?.length && grid.has(o.index)),
              )
              .map((o) => ({ x: o.x - 0.001, y: o.y - 0.001, w: o.w + 0.002, h: o.h + 0.002 })),
            ...(layout.preservedRects || []),
          ];
          if (boxes.length > 1000) {
            boxes = [{ x: 0, y: 0, w: 1, h: 1 }];
            fallbackPages++;
          } else {
            // Adjacent vector strokes form one chart/image rather than hundreds of pictures.
            for (let a = 0; a < boxes.length; a++)
              for (let b = a + 1; b < boxes.length; b++) {
                const x = boxes[a],
                  y = boxes[b];
                if (
                  x.x <= y.x + y.w + 0.003 &&
                  y.x <= x.x + x.w + 0.003 &&
                  x.y <= y.y + y.h + 0.003 &&
                  y.y <= x.y + x.h + 0.003
                ) {
                  const left = Math.min(x.x, y.x),
                    top = Math.min(x.y, y.y);
                  boxes[a] = {
                    x: left,
                    y: top,
                    w: Math.max(x.x + x.w, y.x + y.w) - left,
                    h: Math.max(x.y + x.h, y.y + y.h) - top,
                  };
                  boxes.splice(b, 1);
                  a = -1;
                  break;
                }
              }
          }
        } catch {
          signal.throwIfAborted();
          boxes = [{ x: 0, y: 0, w: 1, h: 1 }];
          fallbackPages++;
        }
      }
      if (boxes.length) {
        const bitmap = await createImageBitmap(
          new Blob([new Uint8Array(layout.background)], { type: 'image/png' }),
        );
        try {
          for (const box of boxes) {
            signal.throwIfAborted();
            const x = Math.max(0, box.x),
              y = Math.max(0, box.y),
              w = Math.min(1, box.x + box.w) - x,
              h = Math.min(1, box.y + box.h) - y;
            if (!(w > 0 && h > 0)) continue;
            const canvas = document.createElement('canvas');
            try {
              canvas.width = Math.max(1, Math.ceil(w * bitmap.width));
              canvas.height = Math.max(1, Math.ceil(h * bitmap.height));
              canvas
                .getContext('2d')!
                .drawImage(
                  bitmap,
                  x * bitmap.width,
                  y * bitmap.height,
                  w * bitmap.width,
                  h * bitmap.height,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
              const blob = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(
                  (b) =>
                    b
                      ? resolve(b)
                      : reject(new Error('Das Word-Bild konnte nicht vorbereitet werden.')),
                  'image/png',
                ),
              );
              const data = new Uint8Array(await blob.arrayBuffer());
              imageBytes += data.length;
              if (imageBytes > 32 * 1024 * 1024)
                throw new Error(
                  'Die Word-Bilder sind zu groß. Bitte die PDF in kleinere Teile aufteilen.',
                );
              page.images.push({ x, y, w, h, data });
            } finally {
              canvas.width = canvas.height = 0;
            }
          }
        } finally {
          bitmap.close();
        }
      }
      pages.push(page);
      (await source.pdf.getPage(index + 1)).cleanup();
    }
    return {
      blob: await packStructuredWord(pages, signal),
      filename: source.name.replace(/\.pdf$/i, '') + '-bearbeitbar.docx',
      kind: 'data',
      pages: source.pdf.numPages,
      note: `Bearbeitbarer Fließtext, ${tableCount} erkannte Word-Tabellen und Bilder. Wiederkehrende Kopf- und Fußzeilen werden separat übernommen. Das Layout darf sich beim Weiterbearbeiten ändern.${fallbackPages ? ` ${fallbackPages} Seiten enthalten nicht vollständig rekonstruierbare Grafikbereiche.` : ''} Nicht erkannte Tabellen bleiben Text; Reihenfolge und Schriften bitte prüfen.`,
    };
  } finally {
    await recognizer.dispose();
  }
}
