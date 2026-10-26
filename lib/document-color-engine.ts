import { PDFDocument } from 'pdf-lib';
import {
  filenameStem,
  pdfBlob,
  renderPage,
  sourcePages,
  requireAcroForm,
  type Source,
} from './pdf-engine';
import type { ExportFile, RunContext } from './advanced-types';
import { rejectSignedPdf } from './pdf-signature-guard';
import {
  adjustDocumentPixels,
  validateDocumentColors,
  type DocumentColors,
} from './document-color-model';

export async function exportDocumentColors(
  source: Source,
  options: DocumentColors,
  ctx: RunContext,
  previewPage?: number,
): Promise<ExportFile> {
  ctx.signal.throwIfAborted();
  validateDocumentColors(options);
  if (source.pdf.numPages > 200 || source.size > 80 * 1024 * 1024)
    throw new Error('Bitte höchstens 200 Seiten und 80 MB verwenden.');
  if (
    previewPage !== undefined &&
    (!Number.isInteger(previewPage) || previewPage < 0 || previewPage >= source.pdf.numPages)
  )
    throw new Error('Ungültige Vorschauseite.');
  const pages =
    previewPage === undefined
      ? Array.from({ length: source.pdf.numPages }, (_, i) => i)
      : [previewPage];
  const original = await PDFDocument.load(source.bytes.slice(), { updateMetadata: false });
  rejectSignedPdf(original);
  requireAcroForm(original);
  let doc: PDFDocument;
  if (options.mode === 'native') {
    ctx.report({ percent: 10, label: 'Textfarben anpassen …' });
    doc = options.textEnabled
      ? await PDFDocument.load(
          await (
            await import('./native-pdf')
          ).recolorText(source.bytes, pages, options.text, ctx.signal),
          { updateMetadata: false },
        )
      : original;
    if (options.backgroundEnabled)
      for (const index of pages) {
        ctx.signal.throwIfAborted();
        const page = doc.getPage(index),
          box = page.getMediaBox(),
          channels = [1, 3, 5].map((i) => parseInt(options.background.slice(i, i + 2), 16) / 255);
        page.node.normalize();
        const start = doc.context.register(
          doc.context.flateStream(
            `q\n${channels.join(' ')} rg\n${box.x} ${box.y} ${box.width} ${box.height} re f\nQ\nq\n`,
          ),
        );
        const end = doc.context.register(doc.context.flateStream('\nQ\n'));
        page.node.wrapContentStreams(start, end);
      }
    if (previewPage !== undefined) {
      const single = await PDFDocument.create();
      const [page] = await single.copyPages(doc, [previewPage]);
      single.addPage(page);
      doc = single;
    }
  } else {
    doc = await PDFDocument.create();
    const items = sourcePages(source);
    for (let i = 0; i < pages.length; i++) {
      ctx.signal.throwIfAborted();
      const proxy = await source.pdf.getPage(pages[i] + 1),
        view = proxy.getViewport({ scale: 1 });
      const max = Math.min(
        2800,
        Math.sqrt(4000000 / (view.width * view.height)) * Math.max(view.width, view.height),
      );
      const { canvas } = await renderPage(source, items[pages[i]], max, ctx.signal);
      try {
        const context = canvas.getContext('2d')!,
          pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        adjustDocumentPixels(pixels.data, options);
        context.putImageData(pixels, 0, 0);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b ? resolve(b) : reject(new Error('Das Seitenbild konnte nicht erstellt werden.')),
            'image/png',
          ),
        );
        const image = await doc.embedPng(await blob.arrayBuffer());
        doc
          .addPage([view.width, view.height])
          .drawImage(image, { x: 0, y: 0, width: view.width, height: view.height });
      } finally {
        canvas.width = canvas.height = 0;
      }
      ctx.report({
        percent: Math.round(((i + 1) / pages.length) * 95),
        label: 'Seitenfarben anpassen …',
      });
    }
  }
  const bytes = await doc.save();
  ctx.signal.throwIfAborted();
  return {
    blob: pdfBlob(bytes),
    filename: filenameStem(source.name) + '-farben.pdf',
    kind: 'pdf',
    pages: pages.length,
    note:
      options.mode === 'native'
        ? 'Dokumenttext bleibt erhalten. Bilder, Formularfelder und Kommentare werden nicht umgefärbt. Der Hintergrund liegt hinter dem vorhandenen Inhalt.'
        : 'Alle Seiten wurden als Bilder ausgegeben. Textsuche, Formularfelder und Links sind im Ergebnis nicht mehr verfügbar.',
  };
}
