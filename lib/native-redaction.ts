import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFArray,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
  rgb,
} from 'pdf-lib';
import { checkAbort, type ExportFile, type RunContext } from './advanced-types';
import {
  pdfBlob,
  filenameStem,
  renderPage,
  sourcePages,
  withPdfDocument,
  type Source,
} from './pdf-engine';
import type { Rect } from './studio-engine';
import { inspectObjects, removeRegions } from './native-pdf';
import { rejectSignedPdf } from './pdf-signature-guard';
import { readTextTargets } from './editor-model';
import { readPdfText } from './pdf-text';
import { compareEditorPixels } from './editor-verification';
import { rewriteRedactedPdf } from './pdf-security';

export type RedactionRegion = { page: number; rect: Rect };
const unsupported = () =>
  new Error(
    'Diese PDF ist für die texterhaltende Schwärzung nicht eindeutig geeignet. Bitte den Bildmodus verwenden.',
  );
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const contains = (a: Rect, b: Rect) =>
  b.x >= a.x - 0.0001 &&
  b.y >= a.y - 0.0001 &&
  b.x + b.w <= a.x + a.w + 0.0001 &&
  b.y + b.h <= a.y + a.h + 0.0001;
const norm = (s: string) => s.normalize('NFKC').replace(/\s/gu, '');
const textSet = (texts: string[]) => [...norm(texts.join(''))].sort().join('');
function validRegion(r: RedactionRegion, count: number) {
  return (
    Number.isInteger(r.page) &&
    r.page >= 0 &&
    r.page < count &&
    Object.values(r.rect).every(Number.isFinite) &&
    r.rect.x >= 0 &&
    r.rect.y >= 0 &&
    r.rect.w > 0 &&
    r.rect.h > 0 &&
    r.rect.x + r.rect.w <= 1.00001 &&
    r.rect.y + r.rect.h <= 1.00001
  );
}
function cleanAuxiliary(document: PDFDocument) {
  document.context.trailerInfo.Info = undefined;
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    const dict =
      object instanceof PDFRawStream ? object.dict : object instanceof PDFDict ? object : undefined;
    if (!dict) continue;
    for (const key of ['Metadata', 'PieceInfo', 'LastModified', 'AF', 'EF', 'EmbeddedFiles'])
      dict.delete(PDFName.of(key));
  }
  document.catalog.delete(PDFName.of('Names'));
}
function guard(document: PDFDocument) {
  rejectSignedPdf(document);
  for (const key of [
    'AcroForm',
    'StructTreeRoot',
    'OCProperties',
    'Outlines',
    'OpenAction',
    'AA',
    'Collection',
  ])
    if (document.catalog.has(PDFName.of(key))) throw unsupported();
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    const dict =
      object instanceof PDFRawStream ? object.dict : object instanceof PDFDict ? object : undefined;
    if (!dict) continue;
    if (
      ['ActualText', 'Alt', 'XFA', 'JS', 'JavaScript', 'AA', 'OpenAction', 'OC'].some((key) =>
        dict.has(PDFName.of(key)),
      )
    )
      throw unsupported();
    if (
      dict.get(PDFName.of('Type'))?.toString() === '/Filespec' ||
      dict.get(PDFName.of('Subtype'))?.toString() === '/FileAttachment'
    )
      throw unsupported();
  }
  // Reject marked content, including inline ActualText dictionaries. Only page
  // content streams are decoded here: font programs and image data are not operators.
  for (const page of document.getPages()) {
    const contents = page.node.Contents();
    const streams =
      contents instanceof PDFArray
        ? contents.asArray().map((ref) => document.context.lookup(ref))
        : contents
          ? [contents]
          : [];
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) throw unsupported();
      const data = decodePDFRawStream(stream).decode();
      if (data.length > 8 * 1024 * 1024) throw unsupported();
      const text = new TextDecoder('latin1').decode(data);
      if (/(?:^|\s)(?:BDC|BMC|DP|MP)(?=\s|$)|\/ActualText\b/.test(text)) throw unsupported();
    }
  }
}
function annotationBox(
  rect: number[],
  view: { transform: number[]; width: number; height: number },
): Rect {
  const [xx, yx, xy, yy, tx, ty] = view.transform;
  const [x1, y1, x2, y2] = rect;
  const [a, b, c, d] = [
    xx * x1 + xy * y1 + tx,
    yx * x1 + yy * y1 + ty,
    xx * x2 + xy * y2 + tx,
    yx * x2 + yy * y2 + ty,
  ];
  return {
    x: Math.min(a, c) / view.width,
    y: Math.min(b, d) / view.height,
    w: Math.abs(c - a) / view.width,
    h: Math.abs(d - b) / view.height,
  };
}
type ExpectedPage = {
  width: number;
  height: number;
  rotate: number;
  targets: { text: string; x: number; y: number; w: number; h: number }[];
  links: string[];
};
/** Fail-closed native mode for complete flat digital-text objects only. */
export async function redactPreservingContent(
  source: Source,
  regions: RedactionRegion[],
  ctx: RunContext,
): Promise<ExportFile> {
  checkAbort(ctx.signal);
  if (
    !regions.length ||
    regions.length > 2000 ||
    source.pdf.numPages > 200 ||
    source.bytes.length > 80 * 1024 * 1024 ||
    regions.some((r) => !validRegion(r, source.pdf.numPages))
  )
    throw new Error('Ungültige Bereiche oder PDF-Grenzen für die Schwärzung.');
  const document = await PDFDocument.load(source.bytes, { updateMetadata: false });
  guard(document);
  const expected: ExpectedPage[] = [];
  for (let index = 0; index < source.pdf.numPages; index++) {
    checkAbort(ctx.signal);
    const page = await source.pdf.getPage(index + 1),
      view = page.getViewport({ scale: 1 }),
      rects = regions.filter((r) => r.page === index).map((r) => r.rect),
      data = await readTextTargets(source, { index, rotation: 0 });
    const raw = await readPdfText(page);
    if (
      textSet(raw.items.map((t) => ('str' in t ? t.str : ''))) !==
      textSet(data.targets.map((t) => t.text))
    )
      throw unsupported();
    if (
      data.targets.some(
        (t) => rects.some((r) => overlap(r, t)) && !rects.some((r) => contains(r, t)),
      )
    )
      throw new Error(
        'Bitte den Schwärzungsbereich vollständig um die Textzeile legen oder den Bildmodus wählen.',
      );
    if (rects.length) {
      const objects = await inspectObjects(source.bytes, index, ctx.signal);
      if (objects.some((o) => o.type === 'group' || o.shaped)) throw unsupported();
      for (const rect of rects) {
        const hit = objects.filter((o) => overlap(rect, o));
        if (
          !hit.length ||
          hit.some(
            (o) =>
              o.type !== 'text' ||
              o.clipped ||
              o.transparent ||
              o.textMode !== 0 ||
              !contains(rect, o),
          )
        )
          throw unsupported();
      }
    }
    const annotations = await page.getAnnotations();
    if (annotations.some((a) => a.subtype !== 'Link' || !a.url || a.dest || !a.rect))
      throw unsupported();
    const links: string[] = [];
    const annots = document.getPage(index).node.Annots();
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i],
        box = annotationBox(a.rect, view);
      if (rects.some((r) => overlap(r, box))) {
        if (!rects.some((r) => contains(r, box))) throw unsupported();
        // PDF.js annotation order is not assumed to match the underlying array.
        if (annots)
          for (let j = annots.size() - 1; j >= 0; j--) {
            const dict = annots.lookup(j, PDFDict),
              rect = dict.lookup(PDFName.of('Rect'));
            if (
              rect instanceof PDFArray &&
              rect.size() === 4 &&
              a.rect.every(
                (n: number, k: number) =>
                  Math.abs(rect.lookup(k, PDFNumber).asNumber() - n) < 0.0001,
              )
            )
              annots.remove(j);
          }
      } else links.push(JSON.stringify([a.url, ...a.rect]));
    }
    expected.push({
      width: view.width,
      height: view.height,
      rotate: page.rotate,
      targets: data.targets
        .filter((t) => !rects.some((r) => overlap(r, t)))
        .map((t) => ({ text: t.text, x: t.x, y: t.y, w: t.w, h: t.h })),
      links: links.sort(),
    });
    page.cleanup();
    ctx.report({
      percent: (25 * (index + 1)) / source.pdf.numPages,
      label: 'Schwärzungsbereiche und Seitenstruktur prüfen …',
    });
  }
  cleanAuxiliary(document);
  const removed = await removeRegions(
    await document.save({ updateFieldAppearances: false }),
    regions.map((r) => ({ ...r, textOnly: true })),
    ctx.signal,
  );
  const output = await PDFDocument.load(removed, { updateMetadata: false });
  for (const { page: index, rect } of regions) {
    const page = await source.pdf.getPage(index + 1),
      view = page.getViewport({ scale: 1 });
    const a = view.convertToPdfPoint(rect.x * view.width, rect.y * view.height),
      b = view.convertToPdfPoint((rect.x + rect.w) * view.width, (rect.y + rect.h) * view.height);
    output.getPage(index).drawRectangle({
      x: Math.min(a[0], b[0]),
      y: Math.min(a[1], b[1]),
      width: Math.abs(a[0] - b[0]),
      height: Math.abs(a[1] - b[1]),
      color: rgb(0, 0, 0),
    });
  }
  cleanAuxiliary(output);
  const bytes = await rewriteRedactedPdf(
    await output.save({ updateFieldAppearances: false }),
    ctx.signal,
  );
  if (bytes.length > 80 * 1024 * 1024) throw new Error('Die geschwärzte PDF überschreitet 80 MB.');
  await withPdfDocument(bytes, ctx.signal, async (pdf, signal, step) => {
    if (pdf.numPages !== expected.length)
      throw new Error('Die Schwärzung konnte nicht vollständig geprüft werden.');
    const result: Source = {
      ...source,
      id: source.id + '-redacted',
      bytes,
      pdf,
      size: bytes.length,
    };
    for (let i = 0; i < pdf.numPages; i++) {
      checkAbort(signal);
      const page = await step('redaction-page', pdf.getPage(i + 1)),
        view = page.getViewport({ scale: 1 }),
        before = expected[i],
        rects = regions.filter((r) => r.page === i).map((r) => r.rect),
        data = await step('redaction-targets', readTextTargets(result, { index: i, rotation: 0 }));
      const remaining = await step('redaction-text', readPdfText(page));
      if (
        textSet(remaining.items.map((t) => ('str' in t ? t.str : ''))) !==
          textSet(before.targets.map((t) => t.text)) ||
        data.targets.some((t) => rects.some((r) => overlap(r, t))) ||
        data.targets.length !== before.targets.length ||
        data.targets.some(
          (t, j) =>
            norm(t.text) !== norm(before.targets[j].text) ||
            ['x', 'y', 'w', 'h'].some(
              (k) => Math.abs(t[k as keyof Rect] - before.targets[j][k as keyof Rect]) > 0.002,
            ),
        ) ||
        Math.abs(view.width - before.width) > 0.1 ||
        Math.abs(view.height - before.height) > 0.1 ||
        page.rotate !== before.rotate
      )
        throw new Error(
          'Textentfernung oder Inhaltserhalt konnten nicht bestätigt werden. Es wird keine PDF ausgegeben.',
        );
      const annotations = await step('redaction-links', page.getAnnotations());
      const links = annotations.map((a) => JSON.stringify([a.url, ...a.rect])).sort();
      if (JSON.stringify(links) !== JSON.stringify(before.links))
        throw new Error('Links der geschwärzten PDF konnten nicht bestätigt werden.');
      const original = await step(
        'redaction-original-pixels',
        renderPage(source, sourcePages(source)[i], 1800, signal),
      );
      let after: Awaited<ReturnType<typeof renderPage>> | undefined;
      try {
        after = await step(
          'redaction-output-pixels',
          renderPage(result, sourcePages(result)[i], 1800, signal),
        );
        const a = original.canvas,
          b = after.canvas;
        if (
          a.width !== b.width ||
          a.height !== b.height ||
          compareEditorPixels(
            a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data,
            b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data,
            a.width,
            a.height,
            rects,
          ) > 0.0002
        )
          throw new Error(
            'Unveränderte Seitenbereiche konnten im Bildvergleich nicht bestätigt werden.',
          );
        const pixels = b.getContext('2d')!;
        for (const r of rects) {
          const x = Math.ceil(r.x * b.width) + 1,
            y = Math.ceil(r.y * b.height) + 1,
            w = Math.floor(r.w * b.width) - 3,
            h = Math.floor(r.h * b.height) - 3;
          if (w < 1 || h < 1) throw unsupported();
          const sample = pixels.getImageData(x, y, w, h).data;
          for (let j = 0; j < sample.length; j += 4)
            if (sample[j] > 8 || sample[j + 1] > 8 || sample[j + 2] > 8 || sample[j + 3] !== 255)
              throw new Error('Die schwarze Abdeckung konnte nicht bestätigt werden.');
        }
      } finally {
        original.canvas.width = original.canvas.height = 0;
        if (after) after.canvas.width = after.canvas.height = 0;
      }
      page.cleanup();
      ctx.report({
        percent: 45 + (55 * (i + 1)) / pdf.numPages,
        label: 'Geschwärzte PDF unabhängig prüfen …',
      });
    }
  });
  checkAbort(ctx.signal);
  return {
    blob: pdfBlob(bytes),
    filename: filenameStem(source.name) + '-geschwaerzt.pdf',
    kind: 'pdf',
    pages: source.pdf.numPages,
    note: 'Ausgewählte Textobjekte wurden entfernt. Übriger Text, Links und Seitenansichten wurden geprüft; Dokumentinfos und nicht verwendete Ressourcen wurden bereinigt.',
  };
}
