import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Language } from '../ui-language';

export async function makeBankStatementDemo(language: Language) {
  const english = language === 'en';
  const title = english ? 'Statement No. 10/2026' : 'Kontoauszug Nr. 10/2026';
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator('MoinPDF');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  const color = rgb(0.1, 0.2, 0.21);
  page.drawText(english ? 'MoinPDF Sample Bank' : 'MoinPDF Musterbank', {
    x: 50,
    y: 770,
    size: 23,
    font: bold,
    color,
  });
  page.drawText(title, { x: 50, y: 728, size: 16, font: bold, color });
  page.drawText(
    english ? 'Period 01.10.2026 to 31.10.2026' : 'Zeitraum 01.10.2026 bis 31.10.2026',
    { x: 50, y: 690, size: 11, font, color },
  );
  page.drawText(english ? 'Account currency EUR' : 'Kontowährung EUR', {
    x: 50,
    y: 666,
    size: 11,
    font,
    color,
  });
  page.drawText(english ? 'Opening balance 1,000.00 EUR' : 'Anfangssaldo 1.000,00 EUR', {
    x: 50,
    y: 615,
    size: 12,
    font: bold,
    color,
  });
  for (const [label, x] of [
    [english ? 'Date' : 'Datum', 50],
    [english ? 'Description' : 'Buchungstext', 142],
    [english ? 'Amount (EUR)' : 'Betrag (EUR)', 462],
  ] as const) {
    page.drawText(label, { x, y: 570, size: 10, font: bold, color });
  }
  page.drawLine({ start: { x: 50, y: 558 }, end: { x: 545, y: 558 }, color, thickness: 0.6 });
  const postings = [
    ['02.10.2026', english ? 'Fictional customer payment' : 'Fiktiver Zahlungseingang', '+500,00'],
    [
      '06.10.2026',
      english ? 'Fictional office supplies' : 'Fiktive Büromaterialbestellung',
      '-85,50',
    ],
    ['14.10.2026', english ? 'Fictional software fee' : 'Fiktive Softwaregebühr', '-24,50'],
    ['30.10.2026', english ? 'Fictional account fee' : 'Fiktive Kontoführungsgebühr', '-5,00'],
  ];
  for (const [index, [date, description, amount]] of postings.entries()) {
    const y = 530 - index * 36;
    const value = english ? amount.replace(',', '.') : amount;
    page.drawText(date, { x: 50, y, size: 11, font, color });
    page.drawText(description, { x: 142, y, size: 11, font, color });
    page.drawText(value, { x: 545 - font.widthOfTextAtSize(value, 11), y, size: 11, font, color });
  }
  page.drawText(english ? 'Closing balance 1,385.00 EUR' : 'Endsaldo 1.385,00 EUR', {
    x: 50,
    y: 370,
    size: 12,
    font: bold,
    color,
  });
  page.drawText(
    english
      ? 'Fictional sample data for trying the DATEV export.'
      : 'Fiktive Beispieldaten zum Ausprobieren des DATEV-Exports.',
    { x: 50, y: 90, size: 10, font, color },
  );
  return new File(
    [new Uint8Array(await doc.save())],
    english ? 'Sample-Bank-Statement.pdf' : 'Beispiel-Kontoauszug.pdf',
    { type: 'application/pdf' },
  );
}
