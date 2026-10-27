import { PDFDocument, PDFName, PDFDict, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { readEvidence, embedFont } from './evidence-engine';
import { pdfBlob, renderPage, sourcePages, requireAcroForm, type Source } from './pdf-engine';
import { writeBookmarks } from './document-tools';
import { checkAbort, uniqueNames, type ExportFile, type RunContext } from './advanced-types';
import { suggestKlarPlan, validateKlarPlan, type KlarPlan } from './klar-schiff-model';
import { contentDigest } from './content-digest';
import type { KlarRule } from './klar-schiff-rules';

export async function analyseKlarSchiff(
  sources: Source[],
  ctx: RunContext,
  rules: KlarRule[] = [],
): Promise<KlarPlan> {
  const evidence = await readEvidence(sources, 'auto', {
    ...ctx,
    report: (value) => ctx.report({ ...value, percent: value.percent * 0.8 }),
  });
  const plan = suggestKlarPlan(evidence, ctx.translate, rules);
  const fingerprints = new Map<string, string>();
  for (const [index, page] of plan.pages.entries()) {
    checkAbort(ctx.signal);
    const source = sources.find((item) => item.id === page.sourceId)!;
    const { canvas } = await renderPage(source, sourcePages(source)[page.page], 700, ctx.signal);
    try {
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      const hash =
        `${canvas.width}x${canvas.height}:` +
        (await contentDigest(
          new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength),
          ctx.signal,
        ));
      page.duplicateOf = fingerprints.get(hash) || '';
      if (!page.duplicateOf) fingerprints.set(hash, page.id);
    } finally {
      canvas.width = canvas.height = 0;
    }
    ctx.report({
      percent: 80 + ((index + 1) / plan.pages.length) * 20,
      label: `Seitenvergleich · ${index + 1} / ${plan.pages.length}`,
    });
  }
  checkAbort(ctx.signal);
  return plan;
}

export async function exportKlarSchiff(
  sources: Source[],
  plan: KlarPlan,
  format: 'zip' | 'pdf',
  ctx: RunContext,
  fontBytes?: Uint8Array,
): Promise<ExportFile> {
  const t = ctx.translate ?? ((text: string) => text);
  validateKlarPlan(
    plan,
    sources.map((source) => ({ sourceId: source.id, pages: source.pdf.numPages })),
  );
  checkAbort(ctx.signal);
  const inputs = new Map<string, PDFDocument>();
  const names = uniqueNames(
    plan.documents.map((item) => item.filename.replace(/\.pdf$/i, '') + '.pdf'),
  );
  const output = await PDFDocument.create();
  const font = format === 'pdf' ? await embedFont(output, fontBytes) : undefined;
  const tocCount = format === 'pdf' ? Math.ceil(plan.documents.length / 24) : 0;
  for (let i = 0; i < tocCount; i++) output.addPage([595, 842]);
  const zip = new JSZip();
  const bookmarks: Parameters<typeof writeBookmarks>[1] = [];
  const manifest: {
    filename: string;
    title: string;
    date: string;
    sender: string;
    pages: { file: string; page: number }[];
  }[] = [];
  let processed = 0;
  const selectedCount = plan.documents.reduce((sum, item) => sum + item.pageIds.length, 0);
  for (const [index, item] of plan.documents.entries()) {
    checkAbort(ctx.signal);
    const document = format === 'pdf' ? output : await PDFDocument.create();
    const start = document.getPageCount();
    const refs: { file: string; page: number }[] = [];
    for (const id of item.pageIds) {
      checkAbort(ctx.signal);
      const page = plan.pages.find((candidate) => candidate.id === id)!;
      let input = inputs.get(page.sourceId);
      if (!input) {
        const source = sources.find((candidate) => candidate.id === page.sourceId)!;
        input = await PDFDocument.load(source.bytes, { updateMetadata: false });
        const form = requireAcroForm(input);
        if (form.getFields().length) {
          form.updateFieldAppearances(await embedFont(input, fontBytes));
          form.flatten({ updateFieldAppearances: false });
        }
        for (const original of input.getPages()) {
          original.node.delete(PDFName.of('AF'));
          const annotations = original.node.Annots();
          if (annotations)
            for (let i = annotations.size() - 1; i >= 0; i--) {
              const annotation = annotations.lookup(i);
              if (
                annotation instanceof PDFDict &&
                annotation.get(PDFName.of('Subtype'))?.toString() === '/FileAttachment'
              )
                annotations.remove(i);
            }
        }
        inputs.set(page.sourceId, input);
      }
      const [copied] = await document.copyPages(input, [page.page]);
      document.addPage(copied);
      refs.push({ file: page.name, page: page.page + 1 });
      ctx.report({
        percent: (++processed / selectedCount) * 95,
        label: `Dokument ${index + 1} von ${plan.documents.length}`,
      });
    }
    manifest.push({
      filename: names[index],
      title: item.title,
      date: item.date,
      sender: item.sender,
      pages: refs,
    });
    if (format === 'zip') {
      const bytes = await document.save();
      checkAbort(ctx.signal);
      const checked = await PDFDocument.load(bytes);
      if (checked.getPageCount() !== item.pageIds.length)
        throw new Error('Die exportierte Seitenzahl stimmt nicht.');
      zip.file(names[index], bytes);
    } else {
      const toc = output.getPage(Math.floor(index / 24));
      const y = 718 - (index % 24) * 26;
      if (index % 24 === 0) {
        toc.drawText(t('Klar Schiff · Dokumentenmappe'), {
          x: 45,
          y: 785,
          size: 21,
          font,
          color: rgb(0.02, 0.45, 0.44),
        });
        toc.drawText(t('Geprüfte Dokumente · Anklicken, um zur ersten Seite zu springen'), {
          x: 45,
          y: 758,
          size: 9,
          font,
        });
      }
      const title = [item.date, item.sender, item.title]
        .filter(Boolean)
        .join(' · ')
        .replace(/[\r\n\t]/g, ' ');
      let fitted = title;
      while (fitted && font!.widthOfTextAtSize(fitted + (fitted === title ? '' : '…'), 10) > 455)
        fitted = Array.from(fitted).slice(0, -1).join('');
      toc.drawText(fitted + (fitted === title ? '' : '…'), { x: 45, y, size: 10, font });
      toc.drawText(String(start + 1), { x: 520, y, size: 10, font });
      toc.node.addAnnot(
        output.context.register(
          output.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [43, y - 5, 553, y + 15],
            Border: [0, 0, 0],
            Dest: [output.getPage(start).ref, 'Fit'],
          }),
        ),
      );
      bookmarks.push({
        id: item.id,
        title: title.slice(0, 300),
        page: start,
        depth: 0,
        open: true,
        targetChanged: true,
      });
    }
  }
  checkAbort(ctx.signal);
  const note =
    'Geprüfte Dokumentzuordnung und Reihenfolge übernommen. Formularwerte sind festgeschrieben; ursprüngliche Signaturen, Lesezeichen und Dokumentanhänge werden nicht übernommen.';
  if (format === 'zip') {
    // Reserve a non-PDF name; user filenames are always PDFs and cannot replace it.
    zip.file(
      'Klar-Schiff.json',
      JSON.stringify(
        {
          documents: manifest,
          excluded: plan.excluded.map((id) => {
            const page = plan.pages.find((item) => item.id === id)!;
            return { file: page.name, page: page.page + 1 };
          }),
        },
        null,
        2,
      ),
    );
    const blob = await zip.generateAsync({ type: 'blob' }, () => checkAbort(ctx.signal));
    return {
      blob,
      filename: t('Klar-Schiff-Dokumente.zip'),
      kind: 'zip',
      pages: selectedCount,
      note,
    };
  }
  writeBookmarks(output, bookmarks);
  const bytes = await output.save();
  checkAbort(ctx.signal);
  const checked = await PDFDocument.load(bytes);
  if (checked.getPageCount() !== selectedCount + tocCount)
    throw new Error('Die exportierte Seitenzahl stimmt nicht.');
  return {
    blob: pdfBlob(bytes),
    filename: t('Klar-Schiff-Dokumentenmappe.pdf'),
    kind: 'pdf',
    pages: output.getPageCount(),
    note,
  };
}
