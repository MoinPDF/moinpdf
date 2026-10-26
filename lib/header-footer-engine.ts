import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber } from 'pdf-lib';
import { readTextTargets } from './editor-model';
import { readPdfText } from './pdf-text';
import { pdfBlob, filenameStem, withPdfDocument, type Source } from './pdf-engine';
import { checkAbort, type RunContext, type ExportFile } from './advanced-types';
import { rejectSignedPdf } from './pdf-signature-guard';
import {
  detectMarginHits,
  marginContains,
  marginOverlap,
  validateMarginHits,
  validateMarginSettings,
  type MarginHit,
  type MarginPage,
  type MarginSettings,
} from './header-footer-model';

const characters = (text: string) =>
  [...text.normalize('NFKC').replace(/\s/gu, '')].sort().join('');
async function guard(source: Source, ctx: RunContext) {
  checkAbort(ctx.signal);
  if (source.pdf.numPages > 200 || source.bytes.byteLength > 80 * 1024 * 1024)
    throw new Error('Bitte eine PDF mit höchstens 200 Seiten und 80 MB verwenden.');
  const document = await PDFDocument.load(source.bytes, { updateMetadata: false });
  rejectSignedPdf(document);
  return document;
}
function annotationBox(
  rect: number[],
  view: { transform: number[]; width: number; height: number },
) {
  const [a, b, c, d, e, f] = view.transform;
  const points = [
    [rect[0], rect[1]],
    [rect[2], rect[1]],
    [rect[0], rect[3]],
    [rect[2], rect[3]],
  ].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
  const x = Math.min(...points.map((p) => p[0])) / view.width,
    y = Math.min(...points.map((p) => p[1])) / view.height;
  return {
    x,
    y,
    w: Math.max(...points.map((p) => p[0])) / view.width - x,
    h: Math.max(...points.map((p) => p[1])) / view.height - y,
  };
}
const annotationKeys = (
  annotations: {
    subtype?: string;
    url?: string;
    unsafeUrl?: string;
    dest?: unknown;
    fieldName?: string;
  }[],
) =>
  annotations
    .map((a) =>
      JSON.stringify([a.subtype, a.url || a.unsafeUrl || '', !!a.dest, a.fieldName || '']),
    )
    .sort()
    .join('\n');
export async function findMarginHits(source: Source, options: MarginSettings, ctx: RunContext) {
  validateMarginSettings(options);
  await guard(source, ctx);
  const pages: MarginPage[] = [];
  let textless = 0;
  for (let page = 0; page < source.pdf.numPages; page++) {
    checkAbort(ctx.signal);
    const proxy = await source.pdf.getPage(page + 1);
    if (proxy.isPureXfa)
      throw new Error('Bitte dynamische XFA-Formulare zuerst als normale PDF speichern.');
    const data = await readTextTargets(source, { index: page, rotation: 0 });
    if (!data.targets.length) textless++;
    pages.push({ page, ...data });
    ctx.report({
      percent: ((page + 1) / source.pdf.numPages) * 100,
      label: 'Wiederkehrende Kopf- und Fußzeilen werden gesucht …',
    });
  }
  checkAbort(ctx.signal);
  return { hits: detectMarginHits(pages, options), textless };
}
export async function exportMarginCleanup(
  source: Source,
  hits: MarginHit[],
  reviewed: boolean,
  ctx: RunContext,
): Promise<ExportFile> {
  if (!reviewed) throw new Error('Bitte die Fundstellen und Ausnahmen zuerst am Original prüfen.');
  const selected = validateMarginHits(hits, source.pdf.numPages);
  const document = await guard(source, ctx);
  const expected: string[] = [],
    expectedAnnotations: string[] = [],
    dimensions: { width: number; height: number }[] = [];
  let removedLinks = 0;
  for (let index = 0; index < source.pdf.numPages; index++) {
    checkAbort(ctx.signal);
    const page = await source.pdf.getPage(index + 1),
      view = page.getViewport({ scale: 1 }),
      content = await readPdfText(page);
    if (page.isPureXfa)
      throw new Error('Bitte dynamische XFA-Formulare zuerst als normale PDF speichern.');
    dimensions.push({ width: view.width, height: view.height });
    const raw = content.items.map((t) => ('str' in t ? t.str : '')).join('');
    const regions = selected.filter((h) => h.page === index).map((h) => h.rect);
    const annotations = await page.getAnnotations();
    const remaining = annotations.filter(
      (a) =>
        !(
          a.subtype === 'Link' &&
          a.rect &&
          regions.some((r) => marginContains(r, annotationBox(a.rect, view)))
        ),
    );
    expectedAnnotations.push(annotationKeys(remaining));
    if (
      remaining.some(
        (a) => a.rect && regions.some((r) => marginOverlap(r, annotationBox(a.rect, view))),
      )
    )
      throw new Error(
        'Ein Löschbereich schneidet einen Link an oder berührt einen Kommentar oder ein Formularfeld. Bitte den Bereich anpassen.',
      );
    const annots = document.getPage(index).node.Annots();
    if (annots)
      for (let at = annots.size() - 1; at >= 0; at--) {
        const annotation = annots.lookup(at, PDFDict),
          box = annotation.lookupMaybe(PDFName.of('Rect'), PDFArray);
        if (
          annotation.get(PDFName.of('Subtype'))?.toString() !== '/Link' ||
          !box ||
          box.size() !== 4
        )
          continue;
        const rect = Array.from({ length: 4 }, (_, i) => box.lookup(i, PDFNumber).asNumber());
        if (regions.some((r) => marginContains(r, annotationBox(rect, view)))) {
          annots.remove(at);
          removedLinks++;
        }
      }
    if (!regions.length) {
      expected.push(characters(raw));
      continue;
    }
    const { targets } = await readTextTargets(source, { index, rotation: 0 });
    if (characters(raw) !== characters(targets.map((t) => t.text).join('')))
      throw new Error(
        'Die Textpositionen sind nicht eindeutig. Diese PDF kann nicht zuverlässig bereinigt werden.',
      );
    if (
      targets.some(
        (t) =>
          regions.some((r) => marginOverlap(r, t)) && !regions.some((r) => marginContains(r, t)),
      )
    )
      throw new Error(
        'Ein Löschbereich schneidet eine Textzeile an. Bitte den Bereich vollständig um die Zeile legen.',
      );
    expected.push(
      characters(
        targets
          .filter((t) => !regions.some((r) => marginOverlap(r, t)))
          .map((t) => t.text)
          .join(''),
      ),
    );
    ctx.report({
      percent: ((index + 1) / source.pdf.numPages) * 30,
      label: 'Die ausgewählten Löschbereiche werden geprüft …',
    });
  }
  checkAbort(ctx.signal);
  const { removeRegions } = await import('./native-pdf');
  ctx.report({ percent: 40, label: 'Bestätigte Kopf- und Fußzeilen werden entfernt …' });
  const bytes = await removeRegions(
    removedLinks ? await document.save({ updateFieldAppearances: false }) : source.bytes,
    selected.map((h) => ({ page: h.page, rect: h.rect, color: '#ffffff' })),
    ctx.signal,
  );
  checkAbort(ctx.signal);
  if (bytes.byteLength > 80 * 1024 * 1024)
    throw new Error('Die bereinigte PDF überschreitet 80 MB. Bitte weniger Seiten verwenden.');
  await withPdfDocument(
    bytes,
    ctx.signal,
    async (pdf, signal, step) => {
      if (pdf.numPages !== source.pdf.numPages)
        throw new Error('Die Seitenzahl der Ausgabe stimmt nicht mit dem Original überein.');
      for (let index = 0; index < pdf.numPages; index++) {
        checkAbort(signal);
        const page = await step('margin-output-page', pdf.getPage(index + 1)),
          view = page.getViewport({ scale: 1 }),
          text = await step('margin-output-text', readPdfText(page));
        const actual = characters(text.items.map((t) => ('str' in t ? t.str : '')).join(''));
        if (actual !== expected[index])
          throw new Error(
            'Die Entfernung oder der Erhalt des übrigen Textes konnte nicht bestätigt werden. Es wird keine PDF ausgegeben.',
          );
        if (
          annotationKeys(await step('margin-output-annotations', page.getAnnotations())) !==
          expectedAnnotations[index]
        )
          throw new Error(
            'Die übrigen Links, Kommentare oder Formularfelder konnten nicht bestätigt werden. Es wird keine PDF ausgegeben.',
          );
        if (
          Math.abs(view.width - dimensions[index].width) > 0.1 ||
          Math.abs(view.height - dimensions[index].height) > 0.1
        )
          throw new Error('Die Seitengröße der Ausgabe stimmt nicht mit dem Original überein.');
        page.cleanup();
        ctx.report({
          percent: 60 + ((index + 1) / pdf.numPages) * 40,
          label: 'Die bereinigte PDF wird unabhängig überprüft …',
        });
      }
    },
    { disableFontFace: true },
  );
  checkAbort(ctx.signal);
  return {
    blob: pdfBlob(bytes),
    kind: 'pdf',
    pages: source.pdf.numPages,
    filename: filenameStem(source.name) + '-ohne-Kopf-Fusszeilen.pdf',
    note: 'Bestätigte Seitenbereiche wurden entfernt und weiß gefüllt. Übriger auslesbarer Text und Seitengrößen wurden geprüft. Anhänge und Dokumentinfos werden nicht bereinigt.',
  };
}
