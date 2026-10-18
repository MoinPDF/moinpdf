import { readPdfText } from './pdf-text';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { Source } from './pdf-engine';
import type { ExportFile } from './advanced-types';

// Browser-only editions can still create a real DOCX without an external service.
export async function createTextWordFile(
  source: Source,
  signal: AbortSignal,
  options: {
    report?: (message: string) => void;
    recognizePage?: (index: number) => Promise<string[]>;
  } = {},
): Promise<ExportFile> {
  const sections = [];
  let hasText = false;
  let ocrPages = 0,
    emptyPages = 0;
  let recognized:
    Promise<Awaited<ReturnType<(typeof import('./evidence-engine'))['readEvidence']>>> | undefined;
  for (let index = 1; index <= source.pdf.numPages; index++) {
    signal.throwIfAborted();
    options.report?.(`Seite ${index} von ${source.pdf.numPages} für Word vorbereiten …`);
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
    if (!lines.some((value) => value.trim())) {
      ocrPages++;
      options.report?.(`Texterkennung · Seite ${index} von ${source.pdf.numPages}`);
      if (options.recognizePage) lines.push(...(await options.recognizePage(index - 1)));
      else {
        recognized ??= import('./evidence-engine').then(({ readEvidence }) =>
          readEvidence([source], 'auto', { signal, report: (p) => options.report?.(p.label) }),
        );
        lines.push(
          ...(await recognized).find((p) => p.page === index - 1)!.lines.map((l) => l.text),
        );
      }
      signal.throwIfAborted();
    }
    if (!lines.some((value) => value.trim())) emptyPages++;
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
      'Auch per OCR wurde kein Text erkannt. Bitte die Scanqualität und Sprache prüfen.',
    );
  const blob = await Packer.toBlob(new Document({ sections }));
  signal.throwIfAborted();
  return {
    blob,
    filename: source.name.replace(/\.pdf$/i, '') + '.docx',
    kind: 'data',
    pages: source.pdf.numPages,
    note: `Bearbeitbarer Text. Bilder und das ursprüngliche Seitenlayout werden in dieser Ausgabe nicht übernommen.${ocrPages ? ` ${ocrPages} Seiten per OCR geprüft; erkannte Texte bitte kontrollieren.` : ''}${emptyPages ? ` ${emptyPages} Seiten ohne erkannten Text.` : ''}`,
  };
}
