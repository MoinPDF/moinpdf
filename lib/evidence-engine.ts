import { PDFDocument, PDFName, PDFDict, type PDFFont } from 'pdf-lib';
import JSZip from 'jszip';
import { localFontBytes } from './local-font-bytes';
import type { Worker } from 'tesseract.js';
import { renderPage, sourcePages, abortable, pdfBlob, type Source } from './pdf-engine';
import { readTextTargets } from './editor-model';
import { checkAbort, type ExportFile, type RunContext } from './advanced-types';
import { makeXlsx, csvText } from './table-data';
import { writeBookmarks } from './document-tools';
import type { Invoice } from './invoice-engine';
import {
  groupWords,
  numericValue,
  dateValue,
  extractField,
  fold,
  type EvidenceWord,
  type EvidencePage,
  type EvidenceRef,
  type Finding,
  type FieldRule,
  type PseudonymRule,
  type PseudonymHit,
  type AttachmentTarget,
  type AttachmentReference,
} from './evidence-model';

export async function readEvidence(
  sources: Source[],
  mode: 'auto' | 'ocr',
  ctx: RunContext,
): Promise<EvidencePage[]> {
  const total = sources.reduce((n, s) => n + s.pdf.numPages, 0);
  if (!total || total > 400)
    throw new Error('Bitte insgesamt 1 bis 400 Seiten gleichzeitig prüfen.');
  let worker: Worker | undefined,
    completed = 0;
  const stop = () => void worker?.terminate();
  ctx.signal.addEventListener('abort', stop, { once: true });
  const result: EvidencePage[] = [];
  try {
    for (const source of sources)
      for (const item of sourcePages(source)) {
        checkAbort(ctx.signal);
        ctx.report({
          percent: (completed / total) * 100,
          label: `${source.name} · Seite ${item.index + 1}`,
        });
        let words: EvidenceWord[] = [],
          pageMode: EvidencePage['mode'] = 'text';
        if (mode === 'auto') words = (await readTextTargets(source, item)).targets;
        if (
          mode === 'ocr' ||
          words
            .map((w) => w.text)
            .join('')
            .trim().length < 8
        ) {
          pageMode = 'ocr';
          if (!worker) {
            const { createWorker, PSM } = await import('tesseract.js');
            const creating = createWorker('deu+eng', 1, {
              workerPath: '/vendor/ocr/worker.min.js',
              corePath: '/vendor/ocr',
              langPath: '/vendor/languages',
              workerBlobURL: false,
              logger: (m) => {
                if (m.status === 'recognizing text')
                  ctx.report({
                    percent: ((completed + m.progress) / total) * 100,
                    label: `Texterkennung · ${source.name} · Seite ${item.index + 1}`,
                  });
              },
            });
            creating
              .then((w) => {
                if (ctx.signal.aborted) void w.terminate();
              })
              .catch(() => {});
            worker = await abortable(creating, ctx.signal);
            await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
          }
          const { canvas } = await renderPage(source, item, 2600, ctx.signal);
          try {
            const { data } = await abortable(
              worker.recognize(canvas, {}, { text: true, blocks: true }),
              ctx.signal,
            );
            words = (data.blocks || [])
              .flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
              .filter((w) => w.text.trim())
              .map((w, i) => ({
                id: `ocr-${i}`,
                text: w.text,
                confidence: w.confidence,
                x: Math.max(0, w.bbox.x0 / canvas.width),
                y: Math.max(0, w.bbox.y0 / canvas.height),
                w: (w.bbox.x1 - w.bbox.x0) / canvas.width,
                h: (w.bbox.y1 - w.bbox.y0) / canvas.height,
              }));
          } finally {
            canvas.width = canvas.height = 0;
          }
        }
        result.push(
          groupWords({
            sourceId: source.id,
            name: source.name,
            page: item.index,
            mode: pageMode,
            words,
          }),
        );
        completed++;
      }
    checkAbort(ctx.signal);
    return result;
  } finally {
    ctx.signal.removeEventListener('abort', stop);
    await worker?.terminate();
  }
}

export function coverage(pages: EvidencePage[], t: (text: string) => string = (text) => text) {
  const empty = pages.filter((p) => !p.words.length);
  return t(
    `${pages.length} Seiten ausgewertet; ${pages.filter((p) => p.mode === 'ocr').length} per OCR.${empty.length ? t(` Auf ${empty.length} Seiten wurde kein Text erkannt. Diese Seiten sind nicht inhaltlich geprüft.`) : ''}`,
  );
}
export const refLabel = (ref?: EvidenceRef, t: (text: string) => string = (text) => text) =>
  ref ? t(`${ref.name} · Seite ${ref.page + 1}`) : '';
export const findingRows = (findings: Finding[], t: (text: string) => string = (text) => text) => [
  [
    'Status',
    'Prüfpunkt',
    'Erste Angabe',
    'Zweite Angabe',
    'Hinweis',
    'Erste Datei / Seite',
    'Erste Fundstelle',
    'Zweite Datei / Seite',
    'Zweite Fundstelle',
  ].map(t),
  ...findings.map((f) => [
    t(
      {
        changed: 'Abweichung',
        missing: 'Nicht gefunden',
        review: 'Prüfen',
        match: 'Übereinstimmung',
      }[f.status],
    ),
    f.titleIsData ? f.title : t(f.title),
    f.oldValue || '',
    f.newValue || '',
    t(f.detail),
    refLabel(f.before, t),
    f.before?.text || '',
    refLabel(f.after, t),
    f.after?.text || '',
  ]),
];
export async function exportRows(
  rows: string[][],
  name: string,
  format: 'xlsx' | 'csv' = 'xlsx',
  sheetName = 'Tabelle',
): Promise<ExportFile> {
  if (rows.length > 20000)
    throw new Error('Der Export ist auf 20.000 Zeilen begrenzt. Bitte kleinere Stapel verwenden.');
  return {
    blob:
      format === 'xlsx'
        ? await makeXlsx(rows, sheetName)
        : new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }),
    filename: name + '.' + format,
    kind: 'data',
    pages: 0,
  };
}

export function compareInvoiceEvidence(invoice: Invoice, pages: EvidencePage[]): Finding[] {
  const fields: { label: string; aliases: string[]; kind: FieldRule['kind']; expected: string }[] =
    [
      {
        label: 'Rechnungsnummer',
        aliases: ['Rechnungsnummer', 'Rechnung Nr.', 'Rechnungs-Nr.', 'Invoice no'],
        kind: 'text',
        expected: invoice.number,
      },
      {
        label: 'Rechnungsdatum',
        aliases: ['Rechnungsdatum', 'Datum', 'Invoice date'],
        kind: 'date',
        expected: invoice.date,
      },
      {
        label: 'Nettobetrag',
        aliases: ['Nettobetrag', 'Netto', 'Summe netto', 'Net total'],
        kind: 'number',
        expected: invoice.totals.net,
      },
      {
        label: 'Bruttobetrag',
        aliases: ['Bruttobetrag', 'Brutto', 'Gesamtbetrag', 'Rechnungsbetrag', 'Grand total'],
        kind: 'number',
        expected: invoice.totals.gross,
      },
      {
        label: 'Zahlbetrag',
        aliases: ['Zahlbetrag', 'Zu zahlen', 'Fälliger Betrag', 'Amount due'],
        kind: 'number',
        expected: invoice.totals.due,
      },
      {
        label: 'Verkäufer',
        aliases: ['Verkäufer', 'Lieferant', 'Rechnungssteller', 'Von'],
        kind: 'text',
        expected: invoice.seller.name,
      },
      {
        label: 'Käufer',
        aliases: ['Käufer', 'Rechnungsempfänger', 'Kunde', 'An'],
        kind: 'text',
        expected: invoice.buyer.name,
      },
      ...invoice.payment
        .filter((p) => p.iban)
        .map((p, i) => ({
          label: `IBAN ${i + 1}`,
          aliases: ['IBAN'],
          kind: 'iban' as const,
          expected: p.iban,
        })),
    ];
  return fields.map((field, index) => {
    const normalize = (value: string) =>
      field.kind === 'iban'
        ? value.replace(/\s/g, '').toUpperCase()
        : field.kind === 'number'
          ? numericValue(value)
          : field.kind === 'date'
            ? dateValue(value)
            : fold(value);
    // XML decimal notation always uses a dot, including e.g. 123.000.
    const expected =
      field.kind === 'number'
        ? field.expected
            .replace(/^(\+)?0+(?=\d)/, '')
            .replace(/(\.\d*?)0+$/, '$1')
            .replace(/\.$/, '')
        : normalize(field.expected);
    let candidates = extractField(pages, { id: String(index), ...field });
    if (field.kind === 'text' && field.expected && candidates.length === 0)
      candidates = pages.flatMap((p) =>
        p.lines
          .filter((l) => fold(l.text) === fold(field.expected))
          .map((ref) => ({ value: ref.text, ref, uncertain: true })),
      );
    const match = candidates.find((c) => normalize(c.value) === expected);
    const ambiguous = new Set(candidates.map((c) => normalize(c.value))).size > 1;
    const status: Finding['status'] = !field.expected
      ? 'review'
      : match && !ambiguous
        ? 'match'
        : candidates.length && !ambiguous
          ? 'changed'
          : 'review';
    return {
      id: `xml-${index}`,
      title: field.label,
      status,
      oldValue: field.expected,
      newValue: match?.value || candidates.map((c) => c.value).join(' | '),
      after: match?.ref || candidates[0]?.ref,
      detail: !field.expected
        ? 'Keine entsprechende Angabe in der XML.'
        : ambiguous
          ? 'Mehrere sichtbare Kandidaten: Zuordnung prüfen.'
          : match
            ? 'XML-Wert in der sichtbaren OCR-Ausgabe gefunden.'
            : 'Sichtbare Angabe ' +
              (candidates.length
                ? 'weicht ab; OCR und Zuordnung kontrollieren.'
                : 'nicht eindeutig erkannt. Die XML-Angabe ist damit nicht bestätigt.'),
    };
  });
}

export const ocrReason = (
  word: EvidenceWord,
  threshold: number,
  t: (text: string) => string = (text) => text,
) =>
  [
    (word.confidence ?? 100) < threshold
      ? `OCR-Sicherheit ${Math.round(word.confidence || 0)} %`
      : '',
    /\d[OolI]|[OolI]\d/.test(word.text) ? 'Mögliche Zeichenverwechslung' : '',
    /\d[,.]\d/.test(word.text) ? 'Zahlenwert kontrollieren' : '',
  ]
    .filter(Boolean)
    .map(t)
    .join(' · ');
export function ocrText(
  pages: EvidencePage[],
  corrections: Record<string, string>,
  t: (text: string) => string = (text) => text,
) {
  return pages
    .map(
      (p) =>
        `--- ${p.name}, ${t(`Seite ${p.page + 1}`)} ---\n` +
        p.lines
          .map((l) =>
            l.words.map((w) => corrections[`${p.sourceId}:${p.page}:${w.id}`] ?? w.text).join(' '),
          )
          .join('\n'),
    )
    .join('\n\n');
}
export async function embedFont(pdf: PDFDocument, fontBytes?: Uint8Array): Promise<PDFFont> {
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  pdf.registerFontkit(fontkit);
  const bytes =
    fontBytes ||
    (await fetch('/vendor/invoice-font/NotoSans-Regular.ttf').then((r) => {
      if (!r.ok) throw new Error('Die lokale PDF-Schrift konnte nicht geladen werden.');
      return localFontBytes(r);
    }));
  if (!bytes) throw new Error('Die lokale PDF-Schrift konnte nicht geladen werden.');
  return pdf.embedFont(bytes, { subset: true });
}
export async function correctedOcr(
  source: Source,
  pages: EvidencePage[],
  corrections: Record<string, string>,
  ctx: RunContext,
  fontBytes?: Uint8Array,
): Promise<ExportFile> {
  if (
    pages.length !== source.pdf.numPages ||
    pages.some((p) => p.sourceId !== source.id || p.mode !== 'ocr')
  )
    throw new Error('Bitte zuerst alle Seiten per OCR lesen.');
  const pdf = await PDFDocument.create(),
    font = await embedFont(pdf, fontBytes),
    supported = new Set(font.getCharacterSet());
  for (const [index, item] of sourcePages(source).entries()) {
    checkAbort(ctx.signal);
    const { canvas, width, height } = await renderPage(source, item, 2600, ctx.signal);
    try {
      const image = await pdf.embedPng(canvas.toDataURL('image/png')),
        page = pdf.addPage([width, height]);
      page.drawImage(image, { x: 0, y: 0, width, height });
      for (const word of pages[index].words) {
        const value = (corrections[`${source.id}:${index}:${word.id}`] ?? word.text).replace(
          /[\r\n\t]/g,
          ' ',
        );
        if (!value) continue;
        if (Array.from(value).some((c) => !supported.has(c.codePointAt(0)!)))
          throw new Error(
            'Ein korrigiertes Zeichen wird von der PDF-Schrift nicht unterstützt. Bitte stattdessen den Textexport verwenden.',
          );
        const size = Math.max(
          0.3,
          Math.min(
            word.h * height,
            font.widthOfTextAtSize(value, 1) > 0
              ? (word.w * width) / font.widthOfTextAtSize(value, 1)
              : 12,
          ),
        );
        page.drawText(value, {
          x: word.x * width,
          y: height - (word.y + word.h * 0.86) * height,
          size,
          font,
          opacity: 0,
        });
      }
    } finally {
      canvas.width = canvas.height = 0;
    }
    ctx.report({
      percent: ((index + 1) / pages.length) * 100,
      label: `Korrigierte Textebene · Seite ${index + 1}`,
    });
  }
  return {
    blob: pdfBlob(await pdf.save()),
    filename: 'OCR-korrigiert.pdf',
    kind: 'pdf',
    pages: pages.length,
    note: 'Die sichtbaren Seiten bleiben als Bilder erhalten. Korrekturen betreffen die durchsuchbare Textebene; ursprüngliche Links, Formulare und Anhänge werden nicht übernommen.',
  };
}

export async function pseudonymizedZip(
  sources: Source[],
  rules: PseudonymRule[],
  hits: PseudonymHit[],
  ctx: RunContext,
): Promise<ExportFile> {
  if (!hits.some((h) => h.selected))
    throw new Error('Bitte mindestens einen geprüften Treffer auswählen.');
  const zip = new JSZip(),
    total = sources.reduce((n, s) => n + s.pdf.numPages, 0);
  let done = 0;
  for (const [index, source] of sources.entries()) {
    const pdf = await PDFDocument.create();
    for (const item of sourcePages(source)) {
      checkAbort(ctx.signal);
      const { canvas, width, height } = await renderPage(source, item, 2600, ctx.signal);
      try {
        const c = canvas.getContext('2d')!;
        for (const hit of hits.filter(
          (h) => h.selected && h.ref.sourceId === source.id && h.ref.page === item.index,
        )) {
          const rects = hit.ref.rects;
          if (!rects.length) continue;
          // Wipe complete recognized words (including antialiasing), never merely cover PDF text objects.
          c.fillStyle = '#fff';
          for (const r of rects)
            c.fillRect(
              Math.floor(r.x * canvas.width) - 3,
              Math.floor(r.y * canvas.height) - 3,
              Math.ceil(r.w * canvas.width) + 6,
              Math.ceil(r.h * canvas.height) + 6,
            );
        }
        for (const hit of hits.filter(
          (h) => h.selected && h.ref.sourceId === source.id && h.ref.page === item.index,
        )) {
          const rects = hit.ref.rects;
          if (!rects.length) continue;
          const x = Math.min(...rects.map((r) => r.x)) * canvas.width,
            y = Math.min(...rects.map((r) => r.y)) * canvas.height;
          const w = Math.max(...rects.map((r) => r.x + r.w)) * canvas.width - x,
            h = Math.max(...rects.map((r) => r.h)) * canvas.height;
          const text = rules[hit.rule]?.replacement;
          if (!text)
            throw new Error('Die Zuordnung hat sich geändert. Bitte die Treffer neu suchen.');
          c.font = `${Math.max(5, h * 0.92)}px sans-serif`;
          c.fillStyle = '#111';
          c.textBaseline = 'top';
          c.fillText(text, x, y, w);
        }
        const image = await pdf.embedPng(canvas.toDataURL('image/png'));
        pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
      } finally {
        canvas.width = canvas.height = 0;
      }
      ctx.report({
        percent: (++done / total) * 100,
        label: `Platzhalter einsetzen · Datei ${index + 1}, Seite ${item.index + 1}`,
      });
    }
    zip.file(
      ctx.translate?.(`Dokument-${String(index + 1).padStart(3, '0')}.pdf`) ??
        `Dokument-${String(index + 1).padStart(3, '0')}.pdf`,
      await pdf.save(),
    );
  }
  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    filename: 'Pseudonymisierte-Dokumente.zip',
    kind: 'zip',
    pages: total,
    note: 'Neue Seitenbilder mit neutralen Dateinamen, ohne Originaltexte, Metadaten und Anhänge. Nicht erkannte oder abgewählte Angaben bleiben sichtbar. Alle Ausgaben vor Weitergabe kontrollieren.',
  };
}

export async function linkAttachments(
  sources: Source[],
  targets: AttachmentTarget[],
  refs: AttachmentReference[],
  ctx: RunContext,
): Promise<ExportFile> {
  const chosen = refs.filter((r) => r.target);
  if (!chosen.length) throw new Error('Bitte mindestens einen Anlagenverweis zuordnen.');
  const pdf = await PDFDocument.create(),
    offsets = new Map<string, number>();
  for (const source of sources) {
    checkAbort(ctx.signal);
    offsets.set(source.id, pdf.getPageCount());
    const original = await PDFDocument.load(source.bytes);
    for (const p of await pdf.copyPages(original, original.getPageIndices())) {
      // Copied cross-document destinations no longer refer to the original page tree.
      const annotations = p.node.Annots();
      if (annotations)
        p.node.set(
          PDFName.of('Annots'),
          pdf.context.obj(
            annotations.asArray().filter((ref) => {
              const a = pdf.context.lookup(ref);
              return !(
                a instanceof PDFDict &&
                a.get(PDFName.of('Subtype'))?.toString() === '/Link' &&
                (a.has(PDFName.of('Dest')) ||
                  a.lookupMaybe(PDFName.of('A'), PDFDict)?.get(PDFName.of('S'))?.toString() ===
                    '/GoTo')
              );
            }),
          ),
        );
      pdf.addPage(p);
    }
  }
  for (const [i, ref] of chosen.entries()) {
    checkAbort(ctx.signal);
    const target = targets.find((t) => t.id === ref.target),
      source = sources.find((s) => s.id === ref.ref.sourceId);
    if (!target || !source) throw new Error('Ungültige Zielseite. Bitte neu zuordnen.');
    const from = offsets.get(source.id)! + ref.ref.page,
      to = offsets.get(target.ref.sourceId)! + target.ref.page;
    if (!Number.isInteger(to) || to < 0 || to >= pdf.getPageCount())
      throw new Error('Die Zielseite existiert nicht mehr.');
    const p = pdf.getPage(from),
      v = (await source.pdf.getPage(ref.ref.page + 1)).getViewport({ scale: 1 }),
      annotations = p.node.Annots() || pdf.context.obj([]);
    for (const r of ref.ref.rects) {
      const a = v.convertToPdfPoint(r.x * v.width, r.y * v.height),
        b = v.convertToPdfPoint((r.x + r.w) * v.width, (r.y + r.h) * v.height);
      annotations.push(
        pdf.context.register(
          pdf.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [
              Math.min(a[0], b[0]),
              Math.min(a[1], b[1]),
              Math.max(a[0], b[0]),
              Math.max(a[1], b[1]),
            ],
            Border: [0, 0, 0],
            P: p.ref,
            Dest: [pdf.getPage(to).ref, 'Fit'],
          }),
        ),
      );
    }
    p.node.set(PDFName.of('Annots'), annotations);
    ctx.report({ percent: ((i + 1) / chosen.length) * 100, label: `Anlagenverweis ${i + 1}` });
  }
  const usedTargets = targets.filter((t) => chosen.some((r) => r.target === t.id));
  writeBookmarks(
    pdf,
    usedTargets.map((t) => ({
      id: t.id,
      title: t.label + ' · ' + t.ref.name,
      page: offsets.get(t.ref.sourceId)! + t.ref.page,
      depth: 0,
      open: true,
      targetChanged: true,
    })),
  );
  return {
    blob: pdfBlob(await pdf.save()),
    filename: 'Dokumentenpaket-mit-Anlagenlinks.pdf',
    kind: 'pdf',
    pages: pdf.getPageCount(),
    note: `${chosen.length} Verweise eingefügt, ${refs.length - chosen.length} offen. Dateien in Upload-Reihenfolge zusammengeführt. Bestehende interne Links und Lesezeichen wurden durch die neue Anlagenstruktur ersetzt.`,
  };
}

export type CommentRow = {
  id: string;
  ref: EvidenceRef;
  author: string;
  subject: string;
  comment: string;
  quote: string;
  type: string;
  date: string;
  replyTo: string;
  done: boolean;
};
export async function readComments(sources: Source[], ctx: RunContext): Promise<CommentRow[]> {
  const result: CommentRow[] = [];
  let done = 0;
  const total = sources.reduce((n, s) => n + s.pdf.numPages, 0);
  for (const source of sources)
    for (const item of sourcePages(source)) {
      checkAbort(ctx.signal);
      const page = await source.pdf.getPage(item.index + 1),
        viewport = page.getViewport({ scale: 1 }),
        annotations = await page.getAnnotations({ intent: 'display' });
      const { targets } = await readTextTargets(source, item);
      for (const a of annotations) {
        if (['Link', 'Widget', 'Popup'].includes(a.subtype)) continue;
        const comment = a.contentsObj?.str || a.contents || a.richText?.str || '';
        if (
          !comment &&
          ![
            'Highlight',
            'Underline',
            'Squiggly',
            'StrikeOut',
            'Text',
            'FreeText',
            'Ink',
            'Stamp',
            'Caret',
            'Square',
            'Circle',
          ].includes(a.subtype)
        )
          continue;
        const coords = a.rect;
        if (!Array.isArray(coords) || coords.length !== 4) continue;
        const x = viewport.convertToViewportPoint(coords[0], coords[1]),
          y = viewport.convertToViewportPoint(coords[2], coords[3]);
        const rect = {
          x: Math.min(x[0], y[0]) / viewport.width,
          y: Math.min(x[1], y[1]) / viewport.height,
          w: Math.abs(x[0] - y[0]) / viewport.width,
          h: Math.abs(x[1] - y[1]) / viewport.height,
        };
        const quote = targets
          .filter(
            (t) =>
              t.x + t.w / 2 >= rect.x &&
              t.x + t.w / 2 <= rect.x + rect.w &&
              t.y + t.h / 2 >= rect.y &&
              t.y + t.h / 2 <= rect.y + rect.h,
          )
          .map((t) => t.text)
          .join(' ');
        result.push({
          id: `comment-${result.length}`,
          ref: {
            sourceId: source.id,
            name: source.name,
            page: item.index,
            text: comment,
            rects: [rect],
            mode: 'text',
          },
          author: a.titleObj?.str || a.title || '',
          subject: a.subject || '',
          comment,
          quote,
          type: a.subtype || 'Anmerkung',
          date: a.modificationDate || a.creationDate || '',
          replyTo: a.inReplyTo || '',
          done: false,
        });
      }
      ctx.report({
        percent: (++done / total) * 100,
        label: `Kommentare · ${source.name} · Seite ${item.index + 1}`,
      });
    }
  return result;
}
export const commentRows = (rows: CommentRow[], t: (text: string) => string = (text) => text) => [
  [
    'Erledigt',
    'Datei',
    'Seite',
    'Autor',
    'Typ',
    'Betreff',
    'Kommentar / Aufgabe',
    'Markierter Text',
    'PDF-Datum',
    'Antwort auf',
  ].map(t),
  ...rows.map((r) => [
    t(r.done ? 'ja' : 'nein'),
    r.ref.name,
    String(r.ref.page + 1),
    r.author,
    r.type,
    r.subject,
    r.comment,
    r.quote,
    r.date,
    r.replyTo,
  ]),
];
export function commentMarkdown(
  rows: CommentRow[],
  t: (text: string) => string = (text) => text,
): ExportFile {
  const plain = (s: string) => s.replace(/[\\`*_{}[\]<>#|!]/g, '\\$&').replace(/\r?\n/g, ' ');
  return {
    blob: new Blob(
      [
        '# ' +
          plain(t('Aufgaben aus PDF-Kommentaren')) +
          '\n\n' +
          rows
            .map(
              (r) =>
                `- [${r.done ? 'x' : ' '}] ${plain(r.comment || r.quote || r.type)} — ${plain(r.ref.name)}, ${plain(t(`Seite ${r.ref.page + 1}`))}${r.author ? ' (' + plain(r.author) + ')' : ''}${r.quote ? '\n  > ' + plain(r.quote) : ''}`,
            )
            .join('\n\n'),
      ],
      { type: 'text/markdown;charset=utf-8' },
    ),
    filename: t('PDF-Kommentare.md'),
    kind: 'data',
    pages: 0,
  };
}

export type ScanCandidate = {
  key: string;
  sourceId: string;
  name: string;
  page: number;
  score: number;
  sharpness: number;
  contrast: number;
  edgeInk: number;
  signature: number[];
  ink: number;
};
export type ScanChoice = {
  id: string;
  reference: string;
  selected: string;
  confidence: number;
  confirmed: boolean;
};
export function scanMetrics(data: Uint8ClampedArray, width: number, height: number) {
  const gray = new Float32Array(width * height),
    hist = new Uint32Array(256),
    signature = Array<number>(256).fill(0),
    counts = Array<number>(256).fill(0);
  let ink = 0,
    edges = 0,
    edgeCount = 0,
    sharpness = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        j = i * 4,
        v = Math.round(0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]);
      gray[i] = v;
      hist[v]++;
      const cell =
        Math.min(15, Math.floor((y / height) * 16)) * 16 +
        Math.min(15, Math.floor((x / width) * 16));
      signature[cell] += 255 - v;
      counts[cell]++;
      if (v < 200) ink++;
      if (x < width * 0.012 || x > width * 0.988 || y < height * 0.012 || y > height * 0.988) {
        edgeCount++;
        if (v < 180) edges++;
      }
    }
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      sharpness += Math.abs(
        gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i],
      );
    }
  const percentile = (fraction: number) => {
    let n = 0;
    for (let i = 0; i < 256; i++) {
      n += hist[i];
      if (n >= width * height * fraction) return i;
    }
    return 255;
  };
  const contrast = (percentile(0.98) - percentile(0.02)) / 255,
    edgeInk = edges / Math.max(1, edgeCount);
  sharpness /= Math.max(1, (width - 2) * (height - 2));
  ink /= width * height;
  const score =
    ink < 0.002 ? 0 : Math.max(0, Math.min(100, sharpness * 3 + contrast * 35 - edgeInk * 40));
  return {
    signature: signature.map((v, i) => v / Math.max(1, counts[i]) / 255),
    score,
    sharpness,
    contrast,
    edgeInk,
    ink,
  };
}
export function scanSimilarity(a: ScanCandidate, b: ScanCandidate) {
  if (a.ink < 0.002 || b.ink < 0.002) return 0;
  let dot = 0,
    x = 0,
    y = 0;
  for (let i = 0; i < a.signature.length; i++) {
    dot += a.signature[i] * b.signature[i];
    x += a.signature[i] ** 2;
    y += b.signature[i] ** 2;
  }
  return dot / Math.max(0.00001, Math.sqrt(x * y));
}
export async function inspectScans(sources: Source[], ctx: RunContext): Promise<ScanCandidate[]> {
  const result: ScanCandidate[] = [];
  const total = sources.reduce((n, s) => n + s.pdf.numPages, 0);
  if (total > 400) throw new Error('Bitte maximal 400 Seiten vergleichen.');
  for (const source of sources)
    for (const item of sourcePages(source)) {
      checkAbort(ctx.signal);
      const { canvas } = await renderPage(source, item, 1000, ctx.signal);
      try {
        const c = canvas.getContext('2d')!;
        result.push({
          key: `${source.id}:${item.index}`,
          sourceId: source.id,
          name: source.name,
          page: item.index,
          ...scanMetrics(
            c.getImageData(0, 0, canvas.width, canvas.height).data,
            canvas.width,
            canvas.height,
          ),
        });
      } finally {
        canvas.width = canvas.height = 0;
      }
      ctx.report({
        percent: (result.length / total) * 100,
        label: `Scanqualität · ${source.name} · Seite ${item.index + 1}`,
      });
    }
  return result;
}
export function suggestScans(candidates: ScanCandidate[], referenceId: string): ScanChoice[] {
  const reference = candidates.filter((c) => c.sourceId === referenceId),
    used = new Set<string>();
  return reference.map((base, index) => {
    const alternatives = candidates
      .filter((c) => c.sourceId !== referenceId && !used.has(c.key))
      .map((c) => ({ c, match: scanSimilarity(base, c) }))
      .filter((c) => c.match >= 0.88)
      .sort((a, b) => b.match - a.match);
    const best = alternatives
      .filter((x) => x.c.score > base.score)
      .sort((a, b) => b.c.score - a.c.score)[0];
    if (best) used.add(best.c.key);
    return {
      id: `choice-${index}`,
      reference: base.key,
      selected: best?.c.key || base.key,
      confidence: best?.match || 0,
      confirmed: false,
    };
  });
}
export async function saveBestScans(
  sources: Source[],
  candidates: ScanCandidate[],
  choices: ScanChoice[],
  ctx: RunContext,
): Promise<ExportFile> {
  if (!choices.length || choices.some((c) => !c.confirmed))
    throw new Error('Bitte jede ausgewählte Seite in der Vorschau bestätigen.');
  const result = await PDFDocument.create(),
    docs = new Map<string, PDFDocument>();
  for (const [index, choice] of choices.entries()) {
    checkAbort(ctx.signal);
    const candidate = candidates.find((c) => c.key === choice.selected),
      source = sources.find((s) => s.id === candidate?.sourceId);
    if (!candidate || !source) throw new Error('Bitte eine gültige Seite auswählen.');
    if (!docs.has(source.id)) docs.set(source.id, await PDFDocument.load(source.bytes));
    const [page] = await result.copyPages(docs.get(source.id)!, [candidate.page]);
    result.addPage(page);
    ctx.report({
      percent: ((index + 1) / choices.length) * 100,
      label: `Ausgewählte Seite ${index + 1}`,
    });
  }
  return {
    blob: pdfBlob(await result.save()),
    filename: 'Beste-Scan-Seiten.pdf',
    kind: 'pdf',
    pages: choices.length,
    note: 'Ausgewählte Originalseiten in der bestätigten Reihenfolge. Die Bewertung beruht auf Schärfe, Kontrast und Randinhalt; sie garantiert keine Vollständigkeit.',
  };
}
