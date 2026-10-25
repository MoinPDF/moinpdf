import { PDFDocument } from 'pdf-lib';
import { openSource, renderPage, pdfBlob, type Source } from './pdf-engine';
import { materializeWorkspace } from './workspace-document';
import type { ProjectSource, ProjectState } from './local-projects';
import type { ProgressUpdate } from './pdf-engine';

/** Deliberately flattened handoff: only the current visible pages are retained.
 * This is not the editable project export and makes no OCR/UA/signature claim. */
export async function projectHandoff(
  originals: ProjectSource[],
  state: ProjectState,
  signal: AbortSignal,
  report: (progress: ProgressUpdate) => void,
) {
  if (!state.pages.length) throw new Error('Das Projekt enthält keine aktiven Seiten.');
  const owned = new Set<Source>();
  try {
    const activeIds = new Set(state.pages.map((p) => p.sourceId));
    const sources: Source[] = [];
    for (const original of originals.filter((s) => activeIds.has(s.id))) {
      signal.throwIfAborted();
      const opened = await openSource(
        new File([new Uint8Array(original.bytes)], original.name.replace(/\.[^.]+$/, '') + '.pdf', {
          type: 'application/pdf',
        }),
      );
      const source = { ...opened, id: original.id };
      owned.add(source);
      sources.push(source);
    }
    const prepared = await materializeWorkspace(
      sources,
      state.pages,
      state.edits,
      state.documentSessions,
      state.options,
      { signal, report },
      true,
    );
    prepared.sources.forEach((s) => owned.add(s));
    const output = await PDFDocument.create();
    for (const [index, item] of prepared.pages.entries()) {
      signal.throwIfAborted();
      const source = prepared.sources.find((s) => s.id === item.sourceId)!;
      const page = await source.pdf.getPage(item.index + 1);
      const view = page.getViewport({ scale: 1, rotation: (page.rotate + item.rotation) % 360 });
      const { canvas } = await renderPage(source, item, 2800, signal);
      try {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b ? resolve(b) : reject(new Error('Die Seite konnte nicht gespeichert werden.')),
            'image/jpeg',
            0.95,
          ),
        );
        const image = await output.embedJpg(await blob.arrayBuffer());
        output
          .addPage([view.width, view.height])
          .drawImage(image, { x: 0, y: 0, width: view.width, height: view.height });
      } finally {
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
      report({
        percent: ((index + 1) / prepared.pages.length) * 100,
        label: `${index + 1} / ${prepared.pages.length}`,
      });
    }
    signal.throwIfAborted();
    return pdfBlob(await output.save());
  } finally {
    await Promise.allSettled([...owned].map((s) => s.pdf.loadingTask.destroy()));
  }
}
