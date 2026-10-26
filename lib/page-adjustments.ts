import { PDFDocument, degrees } from 'pdf-lib';
import {
  appendPage,
  filenameStem,
  pdfBlob,
  prepareSources,
  requireAcroForm,
  type Source,
  type PageItem,
  type JobResult,
  type ProgressUpdate,
} from './pdf-engine';
import type { Edits } from './studio-engine';
import { editorMarkChanged } from './editor-model';
import { rejectSignedPdf } from './pdf-signature-guard';

/** CropBox only: hidden content deliberately remains in the file. */
export async function cropPreservingContent(
  sources: Source[],
  pages: PageItem[],
  edits: Edits,
  report: (p: ProgressUpdate) => void,
  signal: AbortSignal,
): Promise<JobResult> {
  signal.throwIfAborted();
  if (!pages.length || pages.length > 200)
    throw new Error('Bitte zwischen 1 und 200 Seiten auswählen.');
  if (pages.some((p) => (edits.marks[p.id] || []).some(editorMarkChanged)))
    throw new Error('Text erhaltenden Zuschnitt bitte ohne weitere Seitenmarkierungen ausführen.');
  const active = sources.filter((s) => pages.some((p) => p.sourceId === s.id));
  const loaded = new Map<string, PDFDocument>();
  for (const source of active) {
    const doc = await PDFDocument.load(source.bytes.slice(), { updateMetadata: false });
    rejectSignedPdf(doc);
    requireAcroForm(doc);
    loaded.set(source.id, doc);
  }
  const whole =
    active.length === 1 &&
    pages.length === active[0].pdf.numPages &&
    pages.every((p, i) => p.sourceId === active[0].id && p.index === i);
  const doc = whole ? loaded.get(active[0].id)! : await PDFDocument.create();
  const copies = whole ? loaded : await prepareSources(active, pages);
  for (let i = 0; i < pages.length; i++) {
    signal.throwIfAborted();
    const item = pages[i],
      source = active.find((s) => s.id === item.sourceId);
    if (
      !source ||
      !Number.isInteger(item.index) ||
      item.index < 0 ||
      item.index >= source.pdf.numPages
    )
      throw new Error('Ungültige Seitenauswahl.');
    const page = whole ? doc.getPage(i) : await appendPage(doc, copies, item);
    if (whole) page.setRotation(degrees((page.getRotation().angle + item.rotation) % 360));
    const crop = edits.crops[item.id];
    if (crop) {
      if (
        ![crop.x, crop.y, crop.w, crop.h].every(Number.isFinite) ||
        crop.x < 0 ||
        crop.y < 0 ||
        crop.w <= 0 ||
        crop.h <= 0 ||
        crop.x + crop.w > 1.000001 ||
        crop.y + crop.h > 1.000001
      )
        throw new Error('Ungültiger Zuschnitt.');
      const proxy = await source.pdf.getPage(item.index + 1);
      const v = proxy.getViewport({ scale: 1, rotation: (proxy.rotate + item.rotation) % 360 });
      const a = v.convertToPdfPoint(crop.x * v.width, crop.y * v.height),
        b = v.convertToPdfPoint((crop.x + crop.w) * v.width, (crop.y + crop.h) * v.height);
      page.setCropBox(
        Math.min(a[0], b[0]),
        Math.min(a[1], b[1]),
        Math.abs(b[0] - a[0]),
        Math.abs(b[1] - a[1]),
      );
    }
    report({
      percent: Math.round(((i + 1) / pages.length) * 95),
      label: 'Sichtbaren Ausschnitt ändern …',
    });
  }
  const bytes = await doc.save();
  signal.throwIfAborted();
  return {
    blob: pdfBlob(bytes),
    filename: filenameStem(active[0].name) + '-zuschnitt.pdf',
    kind: 'pdf',
    pages: pages.length,
    inputSize: active.reduce((n, s) => n + s.size, 0),
    note: whole
      ? 'Text bleibt erhalten. Ausgeblendete Randinhalte bleiben in der PDF und können wieder sichtbar gemacht werden.'
      : 'Text bleibt erhalten. Ausgeblendete Randinhalte bleiben in der PDF. Bei einer Seitenauswahl werden Formularwerte festgeschrieben; dokumentweite Strukturen können entfallen.',
  };
}
