import { readPdfText } from './pdf-text';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { Source } from './pdf-engine';
import type { ExportFile } from './advanced-types';

export async function createLayoutWordFile(
  source: Source,
  signal: AbortSignal,
  options: { report?: (message: string) => void } = {},
): Promise<ExportFile> {
  signal.throwIfAborted();
  if (!source.pdf.numPages || source.pdf.numPages > 200)
    throw new Error('Bitte eine PDF mit höchstens 200 Seiten verwenden.');
  const { wordLayoutSection, packWordLayout } = await import('./word-layout');
  const { readWordLayoutPage, createEditorRecognizer } = await import('./word-layout-source');
  const recognizer = createEditorRecognizer(signal);
  const sections = [];
  let bytes = 0,
    ocrPages = 0,
    imagePages = 0,
    preservedText = 0,
    textCount = 0;
  try {
    for (let index = 0; index < source.pdf.numPages; index++) {
      signal.throwIfAborted();
      options.report?.(`Seite ${index + 1} von ${source.pdf.numPages} für Word vorbereiten …`);
      const page = await readWordLayoutPage(source, index, signal, { ...options, recognizer });
      bytes += page.background.byteLength;
      textCount += page.text.length;
      if (bytes > 64 * 1024 * 1024 || textCount > 100000)
        throw new Error(
          'Die Word-Ausgabe wird zu groß. Bitte die PDF zuerst in kleinere Teile aufteilen.',
        );
      if (page.ocr) ocrPages++;
      if (page.imageOnly) imagePages++;
      else preservedText += page.preservedText;
      sections.push(wordLayoutSection(page));
    }
    return {
      blob: await packWordLayout(sections, signal),
      filename: source.name.replace(/\.pdf$/i, '') + '.docx',
      kind: 'data',
      pages: source.pdf.numPages,
      note: [
        'Seitenformat, Bilder und Grafiken übernommen. Text bleibt in positionierten Textfeldern bearbeitbar. Grafiken und Tabellenlinien bilden den Seitenhintergrund; Tabellen werden nicht zu Word-Tabellen.',
        'Bitte Schriften und Textpositionen in Word kontrollieren. Nicht installierte Schriften können ersetzt werden.',
        ocrPages
          ? `${ocrPages} Seiten per OCR für Word aufbereitet. Erkannte Texte und Bildbereiche bitte kontrollieren.`
          : '',
        imagePages
          ? `${imagePages} Seiten wurden zur Erhaltung der Darstellung als Bild übernommen; ihr Text ist nicht bearbeitbar.`
          : '',
        preservedText
          ? `${preservedText} gedrehte oder überlappende Textbereiche bleiben als Grafik erhalten und sind nicht bearbeitbar.`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  } finally {
    await recognizer.dispose();
  }
}

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
    note: [
      'Bearbeitbarer Text. Bilder und das ursprüngliche Seitenlayout werden in dieser Ausgabe nicht übernommen.',
      ocrPages === 1
        ? 'Eine Seite per OCR geprüft; erkannte Texte bitte kontrollieren.'
        : ocrPages > 1
          ? `${ocrPages} Seiten per OCR geprüft; erkannte Texte bitte kontrollieren.`
          : '',
      emptyPages === 1
        ? 'Eine Seite ohne erkannten Text.'
        : emptyPages > 1
          ? `${emptyPages} Seiten ohne erkannten Text.`
          : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
