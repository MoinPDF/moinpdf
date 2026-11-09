import { PDFDocument, PDFName, PDFString, PDFHexString, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { localFontBytes } from './local-font-bytes';
import { contentDigest } from './content-digest';
import { pdfBlob } from './pdf-engine';
import type { RunContext, ExportFile } from './advanced-types';
export type PortfolioFile = { name: string; description: string; type: string; bytes: Uint8Array };
export async function createPortfolio(
  files: PortfolioFile[],
  title: string,
  ctx: RunContext,
): Promise<ExportFile> {
  if (
    !files.length ||
    files.length > 100 ||
    files.reduce((n, f) => n + f.bytes.length, 0) > 80 * 1024 * 1024
  )
    throw new Error('Bitte 1 bis 100 Dateien mit insgesamt höchstens 80 MB auswählen.');
  if (!title.trim() || title.length > 200 || files.some((f) => f.description.length > 2000))
    throw new Error('Titel oder Beschreibung ist zu lang oder fehlt.');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await localFontBytes(
      await fetch('/vendor/invoice-font/NotoSans-Regular.ttf', { signal: ctx.signal }),
    ),
    { subset: true },
  );
  const supported = new Set(font.getCharacterSet());
  const clean = (s: string) =>
    Array.from(s.replace(/[\x00-\x1f]/g, ' '))
      .map((c) => (supported.has(c.codePointAt(0)!) ? c : '?'))
      .join('');
  let page = pdf.addPage(),
    y = 780;
  const line = (s: string, size = 10) => {
    let chunk = '';
    for (const c of clean(s)) {
      if (font.widthOfTextAtSize(chunk + c, size) > 490) {
        draw(chunk, size);
        chunk = '';
      }
      chunk += c;
    }
    draw(chunk, size);
  };
  const draw = (s: string, size: number) => {
    if (y < 55) {
      page = pdf.addPage();
      y = 780;
    }
    page.drawText(s, { x: 45, y, font, size, color: rgb(0.05, 0.2, 0.22) });
    y -= size * 1.5;
  };
  line(title, 22);
  y -= 12;
  line(
    ctx.translate?.('Originaldateien und SHA-256-Prüfsummen') ||
      'Originaldateien und SHA-256-Prüfsummen',
  );
  const names = new Set<string>();
  for (const [i, f] of files.entries()) {
    ctx.signal.throwIfAborted();
    let name = f.name.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 180) || `Datei-${i + 1}`;
    while (names.has(name.toLocaleLowerCase())) name = `${i + 1}-${name}`;
    names.add(name.toLocaleLowerCase());
    await pdf.attach(f.bytes, name, {
      mimeType: f.type || 'application/octet-stream',
      description: f.description,
    });
    const digest = await contentDigest(f.bytes, ctx.signal);
    y -= 14;
    line(`${i + 1}. ${name}`, 12);
    if (f.description) line(f.description);
    line(`${f.bytes.length} Bytes`);
    line(digest, 8);
    ctx.report({
      percent: Math.round(((i + 1) / files.length) * 90),
      label: 'Portfolio wird erstellt …',
    });
  }
  const schema = pdf.context.obj({
    File: { Type: 'CollectionField', Subtype: 'F', N: PDFHexString.fromText('Datei'), O: 0 },
    Description: { Type: 'CollectionField', Subtype: 'Desc', N: PDFString.of('Description'), O: 1 },
    Size: { Type: 'CollectionField', Subtype: 'Size', N: PDFString.of('Bytes'), O: 2 },
  });
  pdf.catalog.set(
    PDFName.of('Collection'),
    pdf.context.obj({
      Type: 'Collection',
      View: 'D',
      Schema: schema,
      Sort: { S: 'File', A: true },
    }),
  );
  pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseAttachments'));
  pdf.setTitle(title);
  const bytes = await pdf.save();
  ctx.signal.throwIfAborted();
  if (bytes.length > 85 * 1024 * 1024) throw new Error('Das Portfolio ist zu groß.');
  return {
    blob: pdfBlob(bytes),
    filename: 'PDF-Portfolio.pdf',
    kind: 'pdf',
    pages: pdf.getPageCount(),
    note:
      ctx.translate?.(
        'Die Originaldateien bleiben als einzeln entnehmbare Anlagen erhalten. Ein geeignetes PDF-Programm zeigt das Portfolio.',
      ) ||
      'Die Originaldateien bleiben als einzeln entnehmbare Anlagen erhalten. Ein geeignetes PDF-Programm zeigt das Portfolio.',
  };
}
