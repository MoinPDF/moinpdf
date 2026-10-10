import { PDFDocument, PDFName, PDFDict, rgb, type PDFFont } from 'pdf-lib';
import { pdfBlob, filenameStem, abortable, type Source } from './pdf-engine';
import { readDocumentDraft, writeBookmarks, type FormField } from './document-tools';
import { embedFont } from './evidence-engine';
import { drawOnViewport } from './advanced-documents';
import { checkAbort, type ExportFile, type RunContext } from './advanced-types';
import type { EvidenceRef } from './evidence-model';
import {
  validDate,
  arithmeticResult,
  decimalText,
  measurementValue,
  measurementText,
  type ChronologyItem,
  type ArithmeticRow,
  type NumberLocale,
  type Calibration,
  type Measurement,
} from './century-model';

export type FormResponse = {
  sourceId: string;
  name: string;
  fields: {
    name: string;
    kind: FormField['kind'];
    value: string;
    original: string;
    required: boolean;
    ref?: EvidenceRef;
  }[];
  warnings: string[];
};
export const fieldEmpty = (field: FormResponse['fields'][number]) =>
  field.kind === 'checkbox' ? field.value !== 'Ja' : !field.value.trim();
export async function readFormResponses(sources: Source[], ctx: RunContext) {
  if (sources.length > 100)
    throw new Error('Höchstens 100 Formularrückläufe gleichzeitig auswerten.');
  const result: FormResponse[] = [];
  for (const [i, source] of sources.entries()) {
    checkAbort(ctx.signal);
    const draft = await readDocumentDraft(source, ctx.signal);
    const fields = draft.fields.map((f) => {
      const value = Array.isArray(f.value)
          ? f.value.join(' | ')
          : typeof f.value === 'boolean'
            ? f.value
              ? 'Ja'
              : 'Nein'
            : f.value,
        w = f.widgets[0];
      return {
        name: f.name,
        kind: f.kind,
        value,
        original: value,
        required: f.required,
        ref: w
          ? {
              sourceId: source.id,
              name: source.name,
              page: w.page,
              text: `Formularfeld: ${f.name}`,
              mode: 'text' as const,
              rects: [w.rect],
            }
          : undefined,
      };
    });
    result.push({
      sourceId: source.id,
      name: source.name,
      fields,
      warnings: [
        draft.xfa ? 'XFA-Formular: Werte möglicherweise unvollständig. Bitte Original prüfen.' : '',
        !fields.length
          ? 'Keine auslesbaren AcroForm-Felder. Gescannten Formulartext mit „Belegfelder sammeln“ auswerten.'
          : '',
        fields.some((f) => f.kind === 'unsupported')
          ? 'Nicht unterstützte Feldtypen vorhanden.'
          : '',
      ].filter(Boolean),
    });
    if (result.reduce((n, r) => n + r.fields.length, 0) > 15000)
      throw new Error('Höchstens 15.000 Felder pro Stapel.');
    ctx.report({
      percent: ((i + 1) / sources.length) * 100,
      label: `Formular ${i + 1} von ${sources.length}`,
    });
  }
  return result;
}
export function formResponseRows(
  responses: FormResponse[],
  layout: 'matrix' | 'details' = 'matrix',
) {
  const status = (r: FormResponse) =>
    [
      ...r.warnings,
      ...r.fields
        .filter((f) => f.required && fieldEmpty(f))
        .map((f) => `Pflichtfeld fehlt: ${f.name}`),
    ].join(' · ') || 'Keine fehlenden Pflichtwerte erkannt';
  if (layout === 'details')
    return [
      ['Datei', 'Feld', 'Typ', 'Pflichtfeld', 'Original', 'Exportwert', 'Status', 'Seite'],
      ...responses.flatMap((r) =>
        r.fields.length
          ? r.fields.map((f) => [
              r.name,
              f.name,
              f.kind,
              f.required ? 'Ja' : 'Nein',
              f.original,
              f.value,
              f.required && fieldEmpty(f) ? 'Pflichtwert fehlt' : r.warnings.join(' · '),
              f.ref ? String(f.ref.page + 1) : '',
            ])
          : [[r.name, '', '', '', '', '', status(r), '']],
      ),
    ];
  const keys = [
    ...new Set(responses.flatMap((r) => r.fields.map((f) => JSON.stringify([f.name, f.kind])))),
  ];
  if (keys.length > 500)
    throw new Error('Mehr als 500 unterschiedliche Felder. Bitte die Detailansicht exportieren.');
  return [
    [
      'Datei',
      'Prüfhinweise',
      ...keys.map((k) => {
        const [name, kind] = JSON.parse(k);
        return `${name} (${kind})`;
      }),
    ],
    ...responses.map((r) => [
      r.name,
      status(r),
      ...keys.map((k) => r.fields.find((f) => JSON.stringify([f.name, f.kind]) === k)?.value ?? ''),
    ]),
  ];
}
function fit(font: PDFFont, value: string, size: number, width: number) {
  let clean = value.replace(/[\r\n\t]/g, ' ').slice(0, 1000);
  while (clean && font.widthOfTextAtSize(clean, size) > width) clean = clean.slice(0, -1);
  return clean.length < value.length ? clean.slice(0, -1) + '…' : clean;
}
export async function chronologyPdf(
  sources: Source[],
  items: ChronologyItem[],
  ctx: RunContext,
  fontBytes?: Uint8Array,
): Promise<ExportFile> {
  const active = items.filter((i) => i.included);
  if (
    !active.length ||
    active.length > 100 ||
    active.some((i) => !i.confirmed || !i.title.trim() || (i.date && !validDate(i.date)))
  )
    throw new Error(
      'Bitte 1 bis 100 Dokumente mit gültigem Datum oder „ohne Datum“ prüfen und bestätigen.',
    );
  if (new Set(active.map((i) => i.sourceId)).size !== active.length)
    throw new Error('Jedes Dokument darf nur einmal vorkommen.');
  const doc = await PDFDocument.create(),
    font = await embedFont(doc, fontBytes),
    tocCount = Math.ceil(active.length / 24),
    bookmarks = [];
  for (let i = 0; i < tocCount; i++) doc.addPage([595, 842]);
  for (const [i, item] of active.entries()) {
    checkAbort(ctx.signal);
    const source = sources.find((s) => s.id === item.sourceId);
    if (!source) throw new Error('Quelldokument fehlt.');
    const input = await PDFDocument.load(source.bytes, { updateMetadata: false }),
      form = input.getForm();
    if (form.hasXFA())
      throw new Error(
        `${source.name}: XFA zuerst über „PDF fixieren“ in sichtbare Seiten umwandeln.`,
      );
    if (form.getFields().length) {
      form.updateFieldAppearances(await embedFont(input, fontBytes));
      form.flatten({ updateFieldAppearances: false });
    }
    for (const page of input.getPages()) {
      page.node.delete(PDFName.of('AF'));
      const annotations = page.node.Annots();
      if (annotations)
        for (let a = annotations.size() - 1; a >= 0; a--) {
          const object = annotations.lookup(a);
          if (
            object instanceof PDFDict &&
            object.get(PDFName.of('Subtype'))?.toString() === '/FileAttachment'
          )
            annotations.remove(a);
        }
    }
    const start = doc.getPageCount();
    for (const page of await doc.copyPages(input, input.getPageIndices())) doc.addPage(page);
    if (doc.getPageCount() > 500) throw new Error('Das Paket darf höchstens 500 Seiten haben.');
    const title = `${item.date || 'Ohne Datum'} · ${item.title}`,
      page = doc.getPage(Math.floor(i / 24)),
      y = 718 - (i % 24) * 26;
    if (i % 24 === 0) {
      page.drawText('Chronologische Dokumentenmappe', {
        x: 45,
        y: 785,
        size: 21,
        font,
        color: rgb(0.02, 0.45, 0.44),
      });
      page.drawText('Geprüfte Reihenfolge · Datum aus Dokumentinhalt oder eigener Eingabe', {
        x: 45,
        y: 758,
        size: 9,
        font,
      });
    }
    page.drawText(fit(font, title, 10, 455), { x: 45, y, size: 10, font });
    page.drawText(String(start + 1), { x: 520, y, size: 10, font });
    page.node.addAnnot(
      doc.context.register(
        doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [43, y - 5, 553, y + 15],
          Border: [0, 0, 0],
          Dest: [doc.getPage(start).ref, 'Fit'],
        }),
      ),
    );
    bookmarks.push({
      id: item.sourceId,
      title: title.slice(0, 300),
      page: start,
      depth: 0,
      open: true,
      targetChanged: true,
    });
    ctx.report({
      percent: ((i + 1) / active.length) * 100,
      label: `Dokument ${i + 1} von ${active.length}`,
    });
  }
  writeBookmarks(doc, bookmarks);
  return {
    blob: pdfBlob(await doc.save()),
    filename: 'Chronologische-Dokumentenmappe.pdf',
    kind: 'pdf',
    pages: doc.getPageCount(),
    note: 'Die bestätigte Reihenfolge ist übernommen. Formularwerte sind festgeschrieben; ursprüngliche Signaturen, Lesezeichen und Dokumentanhänge werden nicht übernommen.',
  };
}
export const chronologyRows = (items: ChronologyItem[]) => [
  ['Reihenfolge', 'Datei-ID', 'Titel', 'Datum', 'Geprüft'],
  ...items
    .filter((i) => i.included)
    .map((i, n) => [
      String(n + 1),
      i.sourceId,
      i.title,
      i.date || 'Ohne Datum',
      i.confirmed ? 'Ja' : 'Nein',
    ]),
];
export function arithmeticRows(rows: ArithmeticRow[], total: string, locale: NumberLocale) {
  const result = arithmeticResult(rows, total, locale);
  return [
    ['Zeile', 'Original', 'Verwendeter Wert', 'In Summe', 'Seite'],
    ...rows.map((r, i) => [
      String(i + 1),
      r.original,
      r.value,
      r.included ? 'Ja' : 'Nein',
      String(r.ref.page + 1),
    ]),
    ['Summe', '', decimalText(result.sum, locale), '', ''],
    ['Angegebene Summe', '', total, '', ''],
    ['Abweichung', '', decimalText(result.difference, locale), '', ''],
  ];
}
export async function arithmeticPdf(
  source: Source,
  rows: ArithmeticRow[],
  total: string,
  locale: NumberLocale,
  totalRef: EvidenceRef | undefined,
  ctx: RunContext,
  fontBytes?: Uint8Array,
): Promise<ExportFile> {
  const result = arithmeticResult(rows, total, locale),
    doc = await PDFDocument.load(source.bytes, { updateMetadata: false }),
    font = await embedFont(doc, fontBytes);
  for (const item of [
    ...rows.filter((r) => r.included).map((r) => ({ ref: r.ref, total: false })),
    ...(totalRef ? [{ ref: totalRef, total: true }] : []),
  ]) {
    checkAbort(ctx.signal);
    const p = doc.getPage(item.ref.page),
      v = (await source.pdf.getPage(item.ref.page + 1)).getViewport({ scale: 1 });
    for (const rect of item.ref.rects)
      drawOnViewport(
        p,
        v,
        rect.x * v.width,
        rect.y * v.height,
        rect.w * v.width,
        rect.h * v.height,
        (pos) =>
          p.drawRectangle({
            ...pos,
            borderWidth: 1.4,
            borderColor:
              item.total && result.difference !== 0n ? rgb(0.8, 0.1, 0.1) : rgb(0.02, 0.55, 0.45),
          }),
      );
  }
  const report = [
    ['PDF-Rechenprüfung'],
    ['Summe der ausgewählten Werte', decimalText(result.sum, locale)],
    ['Angegebene Summe', decimalText(result.expected, locale)],
    ['Abweichung', decimalText(result.difference, locale)],
    ['Ergebnis', result.difference === 0n ? 'Summen stimmen überein' : 'Summen weichen ab'],
    [''],
    ['Verwendete Werte (Korrekturen ersetzen keine Originalinhalte)'],
    ...rows
      .filter((r) => r.included)
      .map((r, i) => [`${i + 1}. Seite ${r.ref.page + 1}: ${r.original}`, r.value]),
  ];
  for (let i = 0; i < report.length; i += 35) {
    const p = doc.addPage([595, 842]);
    report.slice(i, i + 35).forEach((r, j) =>
      p.drawText(fit(font, r.join(' · '), j === 0 && i === 0 ? 20 : 10, 505), {
        x: 45,
        y: 790 - j * 21,
        size: j === 0 && i === 0 ? 20 : 10,
        font,
      }),
    );
  }
  return {
    blob: pdfBlob(await doc.save({ updateFieldAppearances: false })),
    filename: filenameStem(source.name) + '-Rechenpruefung.pdf',
    kind: 'pdf',
    pages: doc.getPageCount(),
    note: 'Geprüft wird die Summe der ausgewählten, gegebenenfalls korrigierten Werte. Originalseiten sind markiert, das Rechenprotokoll ist angehängt. Vorhandene digitale Signaturen verlieren durch die Änderung ihre Gültigkeit.',
  };
}

export type LayerChoice = { id: string; name: string; visible: boolean };
export async function readLayers(source: Source): Promise<LayerChoice[]> {
  const config = await source.pdf.getOptionalContentConfig({ intent: 'display' });
  return Array.from(config).map(([id, group]) => ({
    id,
    name: group.name || id,
    visible: group.visible,
  }));
}
export async function layerConfig(
  source: Source,
  layers: LayerChoice[],
  toggle?: { id: string; visible: boolean },
) {
  const config = await source.pdf.getOptionalContentConfig({ intent: 'display' });
  for (const l of layers.filter((l) => !l.visible)) config.setVisibility(l.id, false);
  for (const l of layers.filter((l) => l.visible)) config.setVisibility(l.id, true);
  if (toggle) config.setVisibility(toggle.id, toggle.visible);
  return config;
}
export async function renderLayerPage(
  source: Source,
  page: number,
  layers: LayerChoice[],
  maxSide: number,
  signal: AbortSignal,
) {
  checkAbort(signal);
  const p = await source.pdf.getPage(page + 1),
    base = p.getViewport({ scale: 1 }),
    v = p.getViewport({ scale: Math.min(4.2, maxSide / Math.max(base.width, base.height)) }),
    canvas = document.createElement('canvas');
  canvas.width = Math.ceil(v.width);
  canvas.height = Math.ceil(v.height);
  const config = await layerConfig(source, layers),
    task = p.render({
      canvas,
      viewport: v,
      optionalContentConfigPromise: Promise.resolve(config),
      background: 'rgb(255,255,255)',
    }),
    cancel = () => task.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await abortable(task.promise, signal);
    return { canvas, width: base.width, height: base.height };
  } catch (e) {
    canvas.width = canvas.height = 0;
    throw e;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}
export async function layersPdf(
  source: Source,
  layers: LayerChoice[],
  ctx: RunContext,
): Promise<ExportFile> {
  if (!layers.length) throw new Error('Dieses PDF enthält keine schaltbaren Ebenen.');
  const doc = await PDFDocument.create();
  for (let i = 0; i < source.pdf.numPages; i++) {
    checkAbort(ctx.signal);
    const { canvas, width, height } = await renderLayerPage(source, i, layers, 2400, ctx.signal);
    try {
      const image = await doc.embedPng(canvas.toDataURL('image/png')),
        p = doc.addPage([width, height]);
      p.drawImage(image, { x: 0, y: 0, width, height });
    } finally {
      canvas.width = canvas.height = 0;
    }
    ctx.report({
      percent: ((i + 1) / source.pdf.numPages) * 100,
      label: `Gewählte Ebenen · Seite ${i + 1}`,
    });
  }
  return {
    blob: pdfBlob(await doc.save()),
    filename: filenameStem(source.name) + '-Ebenenansicht.pdf',
    kind: 'pdf',
    pages: doc.getPageCount(),
    note: 'Die gewählte Ansicht ist als Seitenbilder festgeschrieben. Ausgeblendete Ebenen, Suchtext, Links, Formulare und Anhänge sind nicht in der neuen PDF enthalten.',
  };
}
export async function measurementRows(
  source: Source,
  items: Measurement[],
  calibrations: Record<number, Calibration>,
) {
  const rows = [
    ['Bezeichnung', 'Seite', 'Art', 'Messwert', 'Einheit', 'Referenzlänge', 'Referenzeinheit'],
  ];
  for (const item of items) {
    const c = calibrations[item.page];
    if (!c) throw new Error(`Seite ${item.page + 1}: Referenzlänge fehlt.`);
    const v = (await source.pdf.getPage(item.page + 1)).getViewport({ scale: 1 }),
      value = measurementValue(item, c, v.width, v.height);
    rows.push([
      item.label,
      String(item.page + 1),
      item.kind === 'area' ? 'Fläche' : 'Strecke',
      String(value).replace('.', ','),
      item.kind === 'area' ? 'm²' : 'm',
      String(c.length),
      c.unit,
    ]);
  }
  return rows;
}
export async function measurementsPdf(
  source: Source,
  items: Measurement[],
  calibrations: Record<number, Calibration>,
  ctx: RunContext,
  fontBytes?: Uint8Array,
): Promise<ExportFile> {
  if (!items.length || items.length > 500) throw new Error('Bitte 1 bis 500 Messungen anlegen.');
  const doc = await PDFDocument.load(source.bytes, { updateMetadata: false }),
    font = await embedFont(doc, fontBytes);
  for (const item of items) {
    checkAbort(ctx.signal);
    const c = calibrations[item.page];
    if (!c) throw new Error(`Seite ${item.page + 1}: Referenzlänge fehlt.`);
    const page = doc.getPage(item.page),
      v = (await source.pdf.getPage(item.page + 1)).getViewport({ scale: 1 }),
      value = measurementValue(item, c, v.width, v.height),
      pts = item.points.map((p) => v.convertToPdfPoint(p.x * v.width, p.y * v.height)),
      color = rgb(0.02, 0.48, 0.45);
    for (let i = 0; i < (item.kind === 'area' ? pts.length : 1); i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      page.drawLine({
        start: { x: a[0], y: a[1] },
        end: { x: b[0], y: b[1] },
        thickness: 1.5,
        color,
      });
    }
    const label = fit(
        font,
        `${item.label}: ${measurementText(value, item.kind)}`,
        10,
        Math.min(300, v.width - 16),
      ),
      labelWidth = font.widthOfTextAtSize(label, 10) + 8;
    const x = Math.min(Math.max(4, item.points[0].x * v.width), v.width - labelWidth - 4),
      y = Math.min(Math.max(4, item.points[0].y * v.height - 18), v.height - 22);
    drawOnViewport(page, v, x, y, labelWidth, 17, (pos) => {
      page.drawRectangle({ ...pos, color: rgb(1, 1, 1), opacity: 0.9 });
      page.drawText(label, { x: pos.x, y: pos.y, font, size: 10, color, rotate: pos.rotate });
    });
  }
  const report = await measurementRows(source, items, calibrations);
  for (let i = 1; i < report.length; i += 30) {
    const p = doc.addPage([595, 842]);
    p.drawText('Messprotokoll', { x: 45, y: 785, size: 22, font });
    p.drawText('Maßstab je Seite kalibriert. Verzerrte Scans können abweichende Maße ergeben.', {
      x: 45,
      y: 758,
      size: 9,
      font,
    });
    report
      .slice(i, i + 30)
      .forEach((r, j) =>
        p.drawText(
          fit(font, `${r[0]} · S. ${r[1]} · ${r[3]} ${r[4]} · Referenz ${r[5]} ${r[6]}`, 10, 505),
          { x: 45, y: 724 - j * 21, size: 10, font },
        ),
      );
  }
  return {
    blob: pdfBlob(await doc.save({ updateFieldAppearances: false })),
    filename: filenameStem(source.name) + '-Messungen.pdf',
    kind: 'pdf',
    pages: doc.getPageCount(),
    note: 'Messungen und Kalibrierungen sind im Protokoll dokumentiert. Die Genauigkeit hängt von Referenzlänge und unverzerrter Darstellung ab. Digitale Signaturen verlieren durch Änderungen ihre Gültigkeit.',
  };
}
