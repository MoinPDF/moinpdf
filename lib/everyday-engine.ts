import { PDFDocument, PDFTextField, rgb } from 'pdf-lib';
import { localFontBytes } from './local-font-bytes';
import { pdfBlob, filenameStem, renderPageRegion, type Source } from './pdf-engine';
import { readDocumentDraft, saveDocumentDraft, type DocumentDraft } from './document-tools';
import { rejectSignedPdf } from './pdf-signature-guard';
import { checkAbort, type RunContext, type ExportFile } from './advanced-types';
import { layoutReceipts, type ReceiptItem, type ReceiptOptions } from './everyday-model';

async function helperFont(signal: AbortSignal) {
  const response = await fetch('/vendor/invoice-font/NotoSans-Regular.ttf', { signal });
  if (!response.ok) throw new Error('Die Formularschrift konnte nicht geladen werden.');
  return new Uint8Array(await localFontBytes(response));
}

export async function readHelperForm(source: Source, ctx: RunContext) {
  rejectSignedPdf(await PDFDocument.load(source.bytes, { updateMetadata: false }));
  const draft = await readDocumentDraft(source, ctx.signal);
  if (draft.xfa)
    throw new Error('Bitte dynamische XFA-Formulare zuerst als normale PDF speichern.');
  return draft;
}
export async function exportHelperForm(
  source: Source,
  draft: DocumentDraft,
  reviewed: boolean,
  flatten: boolean,
  ctx: RunContext,
): Promise<ExportFile> {
  if (!reviewed) throw new Error('Bitte die Angaben und ihre Positionen am Original prüfen.');
  checkAbort(ctx.signal);
  rejectSignedPdf(await PDFDocument.load(source.bytes, { updateMetadata: false }));
  if (draft.xfa || draft.signed) throw new Error('Bitte eine unsignierte PDF ohne XFA verwenden.');
  const unlocked = draft.fields
    .filter(
      (f) => f.existing && f.readOnly && f.unlockReadOnly && !f.deleted && f.kind !== 'unsupported',
    )
    .map((f) => f.name);
  if (flatten && unlocked.length)
    throw new Error(
      'Freigegebene Formularfelder können nicht gleichzeitig festgeschrieben werden.',
    );
  const fontBytes = await helperFont(ctx.signal);
  // Validate all changed fields against the embedded font before writing anything.
  const probe = await PDFDocument.create();
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  probe.registerFontkit(fontkit);
  const font = await probe.embedFont(fontBytes, { subset: true });
  const characters = new Set(font.getCharacterSet());
  for (const field of draft.fields.filter(
    (f) => !f.deleted && f.kind === 'text' && (!f.readOnly || f.unlockReadOnly),
  )) {
    const value = String(field.value || '');
    if (field.existing && value === field.initialValue) continue;
    if (value.length > 500 || (field.maxLength && value.length > field.maxLength))
      throw new Error('Ein Eintrag ist zu lang für das Formularfeld.');
    if ([...value].some((c) => c !== '\n' && c !== '\r' && !characters.has(c.codePointAt(0)!)))
      throw new Error('Ein Eintrag enthält Zeichen, die die Formularschrift nicht unterstützt.');
    if (!field.multiline && /[\r\n]/.test(value))
      throw new Error('Bitte für einzeilige Felder nur eine Textzeile verwenden.');
    for (const widget of field.widgets) {
      const page = await source.pdf.getPage(widget.page + 1),
        view = page.getViewport({ scale: 1 });
      if (
        !field.existing &&
        (font.widthOfTextAtSize(value, field.fontSize) > widget.rect.w * view.width - 4 ||
          field.fontSize * 1.5 > widget.rect.h * view.height)
      )
        throw new Error(
          'Eine Angabe passt nicht in den markierten Bereich. Bereich vergrößern oder Schrift verkleinern.',
        );
    }
  }
  ctx.report({ percent: 50, label: 'Formular wird ausgefüllt …' });
  const result = await saveDocumentDraft(source, draft, 'fill-form', flatten, ctx.signal, {
    plainFields: true,
    fontBytes,
    unlockReadOnly: unlocked,
  });
  // Independent round-trip of the form values before optional flattening.
  if (!flatten) {
    const verify = await PDFDocument.load(await result.blob.arrayBuffer());
    const original = await PDFDocument.load(source.bytes, { updateMetadata: false });
    for (const field of original
      .getForm()
      .getFields()
      .filter(
        (f) =>
          unlocked.length &&
          !draft.fields.some((item) => item.name === f.getName() && item.deleted),
      )) {
      const actual = verify.getForm().getField(field.getName());
      const expected = field.acroField.getFlags() & (unlocked.includes(field.getName()) ? ~1 : -1);
      if (actual.acroField.getFlags() !== expected)
        throw new Error('Die Formularfreigabe konnte nicht bestätigt werden.');
    }
    for (const field of draft.fields.filter(
      (f) => !f.deleted && f.kind === 'text' && (!f.readOnly || f.unlockReadOnly),
    )) {
      const output = verify.getForm().getField(field.name);
      if (
        !(output instanceof PDFTextField) ||
        (output.getText() || '') !== String(field.value || '')
      )
        throw new Error('Die gespeicherten Formularwerte konnten nicht bestätigt werden.');
    }
  }
  checkAbort(ctx.signal);
  return { ...result, kind: 'pdf', filename: `${filenameStem(source.name)}-Formularhelfer.pdf` };
}
export async function receiptItems(sources: Source[], ctx: RunContext): Promise<ReceiptItem[]> {
  const items: ReceiptItem[] = [];
  for (const source of sources)
    for (let page = 0; page < source.pdf.numPages; page++) {
      checkAbort(ctx.signal);
      const proxy = await source.pdf.getPage(page + 1),
        view = proxy.getViewport({ scale: 1 });
      if (proxy.isPureXfa)
        throw new Error('Bitte dynamische XFA-Formulare zuerst als normale PDF speichern.');
      items.push({
        id: `${source.id}:${page}`,
        sourceId: source.id,
        page,
        rotation: 0,
        rect: { x: 0, y: 0, w: 1, h: 1 },
        pageWidth: view.width,
        pageHeight: view.height,
        widthMm: 80,
        label: '',
      });
      if (items.length > 200) throw new Error('Bitte 1 bis 200 Belege auswählen.');
    }
  return items;
}
function wrapCaption(text: string, width: number, measure: (text: string) => number) {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    if (measure(line + char) > width && line) {
      lines.push(line);
      line = '';
    }
    line += char;
  }
  if (line) lines.push(line);
  if (lines.length > 2)
    throw new Error('Die Belegbeschriftung ist zu lang. Bitte kürzen oder den Beleg verbreitern.');
  return lines;
}
export async function exportReceipts(
  sources: Source[],
  items: ReceiptItem[],
  options: ReceiptOptions,
  ctx: RunContext,
): Promise<ExportFile> {
  const layout = layoutReceipts(items, options),
    out = await PDFDocument.create(),
    mm = 72 / 25.4;
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  out.registerFontkit(fontkit);
  const font = await out.embedFont(await helperFont(ctx.signal), { subset: true });
  const chars = new Set(font.getCharacterSet());
  const captions = layout.placements.map((p) => {
    if ([...p.caption].some((c) => !chars.has(c.codePointAt(0)!)))
      throw new Error('Eine Beschriftung enthält Zeichen, die die Schrift nicht unterstützt.');
    return wrapCaption(p.caption, p.width * mm, (t) => font.widthOfTextAtSize(t, 8));
  });
  for (let i = 0; i < layout.sheets; i++) out.addPage([210 * mm, 297 * mm]);
  let imageBytes = 0;
  for (const [index, place] of layout.placements.entries()) {
    checkAbort(ctx.signal);
    const item = items.find((i) => i.id === place.itemId)!,
      source = sources.find((s) => s.id === item.sourceId);
    if (!source || item.page >= source.pdf.numPages)
      throw new Error('Eine Belegseite ist nicht mehr verfügbar.');
    const view = (await source.pdf.getPage(item.page + 1)).getViewport({
      scale: 1,
      rotation: ((await source.pdf.getPage(item.page + 1)).rotate + item.rotation) % 360,
    });
    if (
      Math.abs(view.width - item.pageWidth) > 0.1 ||
      Math.abs(view.height - item.pageHeight) > 0.1
    )
      throw new Error('Die Belegabmessungen haben sich geändert. Bitte die Belege neu laden.');
    const { canvas } = await renderPageRegion(
      source,
      { index: item.page, rotation: item.rotation },
      place.rect,
      ctx.signal,
    );
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(new Error('Der Belegausschnitt konnte nicht gespeichert werden.')),
          'image/png',
        ),
      );
      imageBytes += blob.size;
      if (imageBytes > 80 * 1024 * 1024)
        throw new Error('Die Ausgabe überschreitet 80 MB. Bitte weniger Belege zusammenstellen.');
      const image = await out.embedPng(await blob.arrayBuffer()),
        page = out.getPage(place.sheet);
      page.drawImage(image, {
        x: place.x * mm,
        y: (297 - place.y - place.height) * mm,
        width: place.width * mm,
        height: place.height * mm,
      });
      captions[index].forEach((line, i) =>
        page.drawText(line, {
          x: place.x * mm,
          y: (297 - place.y - place.height - 3.5 - i * 3.5) * mm,
          size: 8,
          font,
          color: rgb(0.15, 0.15, 0.15),
        }),
      );
    } finally {
      canvas.width = canvas.height = 0;
    }
    ctx.report({
      percent: ((index + 1) / layout.placements.length) * 100,
      label: 'Belege werden auf A4 angeordnet …',
    });
  }
  checkAbort(ctx.signal);
  const bytes = await out.save();
  if (bytes.length > 80 * 1024 * 1024)
    throw new Error('Die Ausgabe überschreitet 80 MB. Bitte weniger Belege zusammenstellen.');
  checkAbort(ctx.signal);
  return {
    blob: pdfBlob(bytes),
    kind: 'pdf',
    pages: layout.sheets,
    filename: 'MoinPDF-Belege-A4.pdf',
    note: 'Belege als zugeschnittene Seitenbilder. Zum maßgenauen Drucken 100 % / Tatsächliche Größe wählen.',
  };
}
