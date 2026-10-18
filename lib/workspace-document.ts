import { PDFDocument, PDFName, degrees } from 'pdf-lib';
import { openSource, pdfBlob, type Source, type PageItem } from './pdf-engine';
import { countEdits, runStudioJob, type Edits, type StudioOptions } from './studio-engine';
import { saveDocumentDraft, type DocumentSessions } from './document-tools';
import type { RunContext } from './advanced-types';

export function hasWorkspaceChanges(
  sources: Source[],
  pages: PageItem[],
  edits: Edits,
  sessions: DocumentSessions,
) {
  const original = sources.flatMap((s) =>
    Array.from({ length: s.pdf.numPages }, (_, index) => ({ sourceId: s.id, index })),
  );
  return (
    countEdits(edits, pages) > 0 ||
    original.length !== pages.length ||
    pages.some(
      (p, i) =>
        p.sourceId !== original[i]?.sourceId || p.index !== original[i]?.index || p.rotation !== 0,
    ) ||
    Object.values(sessions).some((s) => s.past.length > 0)
  );
}
export class WorkspaceReviewRequired extends Error {}

// Preserve untouched files byte for byte, and keep independent inputs separate
// for comparison/batch tools. A changed workspace becomes one undoable revision.
export async function materializeWorkspace(
  sources: Source[],
  pages: PageItem[],
  edits: Edits,
  sessions: DocumentSessions,
  options: StudioOptions,
  ctx: RunContext,
  allowRebuild = false,
) {
  const opened: Source[] = [],
    mapping = new Map<string, Source>();
  try {
    for (const source of sources) {
      const items = pages.filter((p) => p.sourceId === source.id);
      if (!items.length) continue;
      const pageChanges =
        items.length !== source.pdf.numPages ||
        items.some((p, i) => p.index !== i || p.rotation !== 0) ||
        countEdits(edits, items) > 0;
      const draft = sessions[source.id];
      if (!pageChanges && !draft?.past.length) {
        mapping.set(source.id, source);
        continue;
      }
      ctx.signal.throwIfAborted();
      let input = source;
      if (draft?.past.length) {
        const saved = await saveDocumentDraft(
          source,
          draft.current,
          'bookmarks',
          false,
          ctx.signal,
        );
        input = await openSource(new File([saved.blob], source.name, { type: 'application/pdf' }));
        opened.push(input);
      }
      if (pageChanges) {
        const doc = await PDFDocument.load(input.bytes, { updateMetadata: false });
        const unique = new Set(items.map((p) => p.index)).size === items.length;
        const complete = unique && items.length === doc.getPageCount();
        const visual = countEdits(edits, items) > 0;
        const structural =
          ['AcroForm', 'StructTreeRoot', 'Outlines', 'Names', 'Perms'].some((key) =>
            doc.catalog.has(PDFName.of(key)),
          ) || doc.getPages().some((p) => p.node.Annots()?.size());
        if (structural && (visual || !complete) && !allowRebuild)
          throw new WorkspaceReviewRequired(
            'Dieser Arbeitsstand enthält Formulare, Lesezeichen, Anhänge oder andere PDF-Strukturen. Beim Anwenden der Seitenänderungen können diese entfallen.',
          );
        let blob: Blob;
        if (!visual && unique && (!structural || complete)) {
          const original = doc.getPages();
          for (let i = doc.getPageCount() - 1; i >= 0; i--) doc.removePage(i);
          for (const item of items) {
            const page = original[item.index];
            page.setRotation(degrees((page.getRotation().angle + item.rotation) % 360));
            doc.addPage(page);
          }
          blob = pdfBlob(await doc.save());
        } else {
          const output = await runStudioJob(
            'organize',
            [input],
            items.map((p) => ({ ...p, sourceId: input.id })),
            options,
            edits,
            ctx.report,
            ctx.signal,
          );
          blob = output.blob;
        }
        input = await openSource(new File([blob], source.name, { type: 'application/pdf' }));
        opened.push(input);
      }
      mapping.set(source.id, input);
    }
    ctx.signal.throwIfAborted();
    let nextSources = [...new Set(pages.map((p) => p.sourceId))].map((id) => mapping.get(id)!);
    // Preserve the global order while mapping each file's pages to its revision.
    const counters = new Map<string, number>();
    let nextPages = pages.map((page) => {
      const source = mapping.get(page.sourceId)!;
      if (source.id === page.sourceId) return page;
      const index = counters.get(page.sourceId) || 0;
      counters.set(page.sourceId, index + 1);
      return { ...page, sourceId: source.id, index, rotation: 0 };
    });
    const groups = nextPages.filter((page, i) => page.sourceId !== nextPages[i - 1]?.sourceId);
    if (groups.length > nextSources.length) {
      if (!allowRebuild)
        throw new WorkspaceReviewRequired(
          'Die Seiten verschiedener Dateien sind ineinander angeordnet. Zum Fortsetzen wird daraus eine gemeinsame PDF erstellt.',
        );
      const output = await runStudioJob(
        'organize',
        nextSources,
        nextPages,
        options,
        { marks: {}, crops: {} },
        ctx.report,
        ctx.signal,
      );
      const combined = await openSource(
        new File([output.blob], 'Arbeitsdokument.pdf', { type: 'application/pdf' }),
      );
      opened.push(combined);
      nextSources = [combined];
      nextPages = nextPages.map((p, index) => ({
        ...p,
        sourceId: combined.id,
        index,
        rotation: 0,
      }));
    }
    opened.filter((s) => !nextSources.includes(s)).forEach((s) => void s.pdf.loadingTask.destroy());
    return { sources: nextSources, pages: nextPages };
  } catch (error) {
    opened.forEach((s) => void s.pdf.loadingTask.destroy());
    throw error;
  }
}
