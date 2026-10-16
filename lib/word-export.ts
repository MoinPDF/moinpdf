import { readPdfText } from './pdf-text';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { Source } from './pdf-engine';
import type { ExportFile } from './advanced-types';

// Browser-only editions can still create a real DOCX without an external service.
export async function createTextWordFile(source: Source, signal: AbortSignal): Promise<ExportFile> {
  const sections = [];
  let hasText = false;
  for (let index = 1; index <= source.pdf.numPages; index++) {
    signal.throwIfAborted();
    const page = await source.pdf.getPage(index);
    const content = await readPdfText(page);
    const lines: string[] = [];
    let line = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str + (item.hasEOL ? '' : ' ');
      if (item.hasEOL) {
        lines.push(line.trimEnd());
        line = '';
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
    if (lines.some((value) => value.trim())) hasText = true;
    sections.push({
      children: lines.length
        ? lines.map((text) => new Paragraph({ children: [new TextRun(text)] }))
        : [new Paragraph('')],
    });
  }
  signal.throwIfAborted();
  if (!hasText)
    throw new Error(
      'Diese PDF enthält nur Bilder. Bitte zuerst „OCR & Text“ verwenden, um den Text zu erkennen.',
    );
  const blob = await Packer.toBlob(new Document({ sections }));
  signal.throwIfAborted();
  return {
    blob,
    filename: source.name.replace(/\.pdf$/i, '') + '.docx',
    kind: 'data',
    pages: source.pdf.numPages,
    note: 'Bearbeitbarer Text. Bilder und das ursprüngliche Seitenlayout werden in dieser Ausgabe nicht übernommen.',
  };
}
