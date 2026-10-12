import { PDFArray, PDFDict, PDFDocument, PDFName, PDFObject } from 'pdf-lib';
/** Includes direct dictionaries as well as registered indirect objects. */
export function rejectSignedPdf(doc: PDFDocument) {
  const seen = new Set<PDFObject>();
  let count = 0;
  function visit(value: PDFObject, depth = 0) {
    if (seen.has(value)) return;
    seen.add(value);
    if (depth > 64 || ++count > 200000) throw new Error('Die PDF-Struktur ist zu komplex.');
    if (value instanceof PDFDict) {
      const type = value.get(PDFName.of('Type')),
        ft = value.get(PDFName.of('FT'));
      if (
        type?.toString() === '/Sig' ||
        ft?.toString() === '/Sig' ||
        value.has(PDFName.of('DocMDP'))
      )
        throw new Error(
          'Die PDF enthält bereits eine Signatur. Eine unsignierte Originaldatei verwenden.',
        );
      for (const [, item] of value.entries()) visit(item, depth + 1);
    } else if (value instanceof PDFArray)
      for (let i = 0; i < value.size(); i++) visit(value.get(i), depth + 1);
  }
  for (const [, object] of doc.context.enumerateIndirectObjects()) visit(object);
  visit(doc.catalog);
}
