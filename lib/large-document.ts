import type { PDFPageProxy } from 'pdfjs-dist';
import { contentDigest, contentDigestBlob } from './content-digest';
import { withPdfDocument, openSource, pdfBlob, filenameStem, type Source } from './pdf-engine';
import { readPdfText } from './pdf-text';
import { applyWorkflowAction } from './advanced-pipeline';
import type { ExportFile, RunContext } from './advanced-types';
import {
  largeOriginal,
  largeChunkBlob,
  loadLargeJob,
  saveLargeJob,
  withLargeLease,
  type LargeJob,
  type LargeMode,
  type LargePageSummary,
} from './large-document-store';

export const LARGE_MAX_BYTES = 256 * 1024 * 1024;
export const LARGE_MAX_PAGES = 1000;
type LargeRequest = {
  operation: 'inspect' | 'extract' | 'assemble';
  files: Blob[];
  first?: number;
  last?: number;
};
export async function largePdfJob(
  request: LargeRequest,
  signal: AbortSignal,
): Promise<{ bytes?: Uint8Array; json?: unknown }> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker('/workers/large-document.js');
    let done = false;
    const finish = (error?: Error, result?: { bytes?: Uint8Array; json?: unknown }) => {
      if (done) return;
      done = true;
      worker.terminate();
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      error ? reject(error) : resolve(result!);
    };
    const abort = () => finish(new DOMException('Abgebrochen', 'AbortError'));
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            'Die Verarbeitung der großen PDF dauerte zu lange. Der letzte Abschnitt bleibt gespeichert.',
          ),
        ),
      180000,
    );
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () =>
      finish(new Error('Der lokale PDF-Prozessor konnte nicht gestartet werden.'));
    worker.onmessage = ({ data }) =>
      data.error
        ? finish(
            new Error(
              data.error === 'size'
                ? 'Abschnitt zu groß.'
                : 'Die große PDF konnte nicht sicher verarbeitet werden.',
            ),
          )
        : finish(undefined, data);
    worker.postMessage(request);
  });
}
const disallowed = new Set([
  '/AcroForm',
  '/XFA',
  '/StructTreeRoot',
  '/Outlines',
  '/Dests',
  '/Dest',
  '/Names',
  '/AF',
  '/EF',
  '/OCProperties',
  '/OpenAction',
  '/AA',
  '/JS',
  '/Collection',
  '/PieceInfo',
  '/Perms',
  '/ByteRange',
]);
export function checkLargeStructure(input: unknown): number {
  const data = input as {
    encrypt?: { encrypted?: boolean };
    acroform?: { hasacroform?: boolean };
    pages?: unknown[];
    qpdf?: unknown[];
  };
  if (
    !data ||
    data.encrypt?.encrypted ||
    data.acroform?.hasacroform ||
    !Array.isArray(data.pages) ||
    !data.qpdf ||
    data.pages.length < 1 ||
    data.pages.length > LARGE_MAX_PAGES
  )
    throw new Error('Bitte eine unverschlüsselte PDF mit höchstens 1.000 Seiten verwenden.');
  let visited = 0;
  const visit = (v: unknown, depth = 0) => {
    if (++visited > 300000 || depth > 80)
      throw new Error('Die Struktur dieser großen PDF ist zu komplex.');
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach((x) => visit(x, depth + 1));
      return;
    }
    const dict = v as Record<string, unknown>;
    if (
      Object.keys(dict).some((k) => disallowed.has(k)) ||
      dict['/Type'] === '/Sig' ||
      dict['/FT'] === '/Sig' ||
      (dict['/Type'] === '/Annot' && dict['/Subtype'] !== '/Link') ||
      ('/S' in dict && dict['/S'] !== '/URI')
    )
      throw new Error(
        'Große PDFs mit Formularen, Signaturen, internen Verweisen, Lesezeichen, Anhängen oder Struktur-Tags werden noch nicht unterstützt.',
      );
    Object.values(dict).forEach((x) => visit(x, depth + 1));
  };
  visit(data.qpdf);
  return data.pages.length;
}
async function summary(
  page: PDFPageProxy,
  signal: AbortSignal,
  rotation = 0,
): Promise<LargePageSummary> {
  signal.throwIfAborted();
  const view = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 }),
    text = await readPdfText(page),
    annotations = await page.getAnnotations();
  const strings = text.items.map((t) => ('str' in t ? t.str : ''));
  if (strings.reduce((n, s) => n + s.length, 0) > 100000)
    throw new Error('Eine Seite enthält zu viel Text für die vollständige Ausgabeprüfung.');
  const scale = Math.min(1, 640 / Math.max(view.width, view.height)),
    small = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(small.width);
  canvas.height = Math.ceil(small.height);
  const task = page.render({ canvas, viewport: small });
  const abort = () => task.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try {
    await task.promise;
    signal.throwIfAborted();
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    return {
      width: view.width,
      height: view.height,
      rotation: view.rotation,
      text: strings.join('').normalize('NFKC').replace(/\s/gu, ''),
      links: JSON.stringify(
        annotations
          .map((a) => [a.subtype, a.url || '', a.rect])
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ),
      pixels: await contentDigest(new Uint8Array(pixels.buffer), signal),
    };
  } finally {
    signal.removeEventListener('abort', abort);
    canvas.width = canvas.height = 0;
    page.cleanup();
  }
}
function sameSummary(a: LargePageSummary, b: LargePageSummary, ocr = false) {
  return (
    Math.abs(a.width - b.width) < 0.1 &&
    Math.abs(a.height - b.height) < 0.1 &&
    a.rotation === b.rotation &&
    a.links === b.links &&
    a.pixels === b.pixels &&
    (ocr ? b.text.includes(a.text) : a.text === b.text)
  );
}
async function identity(digest: string, mode: LargeMode) {
  return contentDigest(new TextEncoder().encode(JSON.stringify({ version: 1, digest, mode })));
}
export async function createLargeJob(
  file: File,
  mode: LargeMode,
  ctx: RunContext,
): Promise<LargeJob> {
  if (
    !file.size ||
    file.size > LARGE_MAX_BYTES ||
    !['rotate90', 'rotate180', 'optimizeLossless', 'ocr'].includes(mode)
  )
    throw new Error('Bitte eine PDF mit höchstens 256 MB verwenden.');
  ctx.report({ percent: 0, label: 'Große PDF prüfen und lokal sichern …' });
  const pages = checkLargeStructure(
    (await largePdfJob({ operation: 'inspect', files: [file] }, ctx.signal)).json,
  );
  const digest = await contentDigestBlob(file, ctx.signal),
    id = await identity(digest, mode);
  const job: LargeJob = {
    version: 1,
    id,
    digest,
    name: file.name,
    size: file.size,
    pages,
    mode,
    chunks: [],
    updated: Date.now(),
  };
  return withLargeLease(id, async (token) => {
    const previous = await loadLargeJob(id);
    if (previous) return previous;
    ctx.signal.throwIfAborted();
    await saveLargeJob(job, token, undefined, undefined, file);
    return job;
  });
}
export function validateLargeJob(job: LargeJob) {
  if (
    !job ||
    job.version !== 1 ||
    typeof job.id !== 'string' ||
    typeof job.digest !== 'string' ||
    typeof job.name !== 'string' ||
    !Number.isInteger(job.pages) ||
    job.pages < 1 ||
    job.pages > LARGE_MAX_PAGES ||
    !Number.isInteger(job.size) ||
    job.size < 1 ||
    job.size > LARGE_MAX_BYTES ||
    !Array.isArray(job.chunks) ||
    job.chunks.length > 1000 ||
    !['rotate90', 'rotate180', 'optimizeLossless', 'ocr'].includes(job.mode)
  )
    throw new Error('Der gespeicherte Auftrag ist ungültig.');
  let first = 1;
  for (const chunk of job.chunks) {
    if (
      !chunk ||
      chunk.first !== first ||
      !Number.isInteger(chunk.last) ||
      chunk.last < first ||
      chunk.last > job.pages ||
      chunk.last - first >= 50 ||
      !Number.isInteger(chunk.size) ||
      chunk.size < 1 ||
      chunk.size > 80 * 1024 * 1024 ||
      typeof chunk.digest !== 'string' ||
      !Array.isArray(chunk.summaries) ||
      chunk.summaries.length !== chunk.last - first + 1 ||
      chunk.summaries.some(
        (s) =>
          !s ||
          !Number.isFinite(s.width) ||
          s.width <= 0 ||
          !Number.isFinite(s.height) ||
          s.height <= 0 ||
          ![0, 90, 180, 270].includes(s.rotation) ||
          typeof s.text !== 'string' ||
          s.text.length > 100000 ||
          typeof s.links !== 'string' ||
          typeof s.pixels !== 'string',
      )
    )
      throw new Error('Die gespeicherten Abschnitte sind unvollständig.');
    first = chunk.last + 1;
  }
}
export async function continueLargeJob(
  id: string,
  ctx: RunContext,
  onChange: (job: LargeJob) => void,
): Promise<LargeJob> {
  return withLargeLease(id, async (token) => {
    const job = await loadLargeJob(id),
      file = await largeOriginal(id);
    if (!job || !file) throw new Error('Die gespeicherte Originaldatei fehlt.');
    validateLargeJob(job);
    if (
      (await contentDigestBlob(file, ctx.signal)) !== job.digest ||
      (await identity(job.digest, job.mode)) !== id
    )
      throw new Error('Die gespeicherte Originaldatei stimmt nicht mit dem Auftrag überein.');
    await withPdfDocument(file, ctx.signal, async (pdf, signal, step) => {
      if (pdf.numPages !== job.pages)
        throw new Error('Die Seitenzahl der Originaldatei hat sich geändert.');
      let first = (job.chunks.at(-1)?.last || 0) + 1;
      while (first <= job.pages) {
        signal.throwIfAborted();
        let last = Math.min(job.pages, first + 49),
          bytes: Uint8Array | undefined;
        while (!bytes) {
          try {
            bytes = (
              await largePdfJob({ operation: 'extract', files: [file], first, last }, signal)
            ).bytes!;
          } catch (error) {
            if ((error as Error).message === 'Abschnitt zu groß.' && last > first)
              last = first + Math.floor((last - first) / 2);
            else throw error;
          }
        }
        let source: Source | undefined;
        try {
          source = await step(
            'large-chunk-open',
            openSource(
              new File([new Uint8Array(bytes)], 'Abschnitt.pdf', { type: 'application/pdf' }),
            ),
          );
          // First verify extraction, before any transformation can conceal a missing page.
          const originals: LargePageSummary[] = [];
          for (let i = first; i <= last; i++) {
            const orig = await step('large-source-page', pdf.getPage(i)),
              part = await step('large-extracted-page', source.pdf.getPage(i - first + 1));
            const a = await step('large-source-summary', summary(orig, signal)),
              b = await step('large-extracted-summary', summary(part, signal));
            if (!sameSummary(a, b))
              throw new Error('Der gelesene Abschnitt stimmt nicht mit dem Original überein.');
            originals.push(
              job.mode.startsWith('rotate')
                ? await step(
                    'large-rotated-summary',
                    summary(await pdf.getPage(i), signal, job.mode === 'rotate90' ? 90 : 180),
                  )
                : a,
            );
          }
          const result = await applyWorkflowAction(source, { kind: job.mode }, '', {
            ...ctx,
            signal,
            report: (p) =>
              ctx.report({
                percent: 85 * ((first - 1 + ((last - first + 1) * p.percent) / 100) / job.pages),
                label: `Abschnitt ${first}–${last} · ${p.label}`,
              }),
          });
          if (result.length > 80 * 1024 * 1024)
            throw new Error('Der bearbeitete Abschnitt überschreitet 80 MB.');
          const summaries = await withPdfDocument(result, signal, async (out, s, substep) => {
            if (out.numPages !== last - first + 1)
              throw new Error('Die Seitenzahl des bearbeiteten Abschnitts stimmt nicht.');
            const summaries: LargePageSummary[] = [];
            for (let i = 0; i < out.numPages; i++) {
              const v = await substep(
                'large-processed-summary',
                summary(await out.getPage(i + 1), s),
              );
              if (!sameSummary(originals[i], v, job.mode === 'ocr'))
                throw new Error(
                  'Der Inhaltserhalt im bearbeiteten Abschnitt konnte nicht bestätigt werden.',
                );
              summaries.push(v);
            }
            return summaries;
          });
          const blob = pdfBlob(result),
            digest = await contentDigestBlob(blob, signal),
            next = {
              ...job,
              chunks: [...job.chunks, { first, last, size: blob.size, digest, summaries }],
              updated: Date.now(),
            };
          signal.throwIfAborted();
          await saveLargeJob(next, token, blob, job.chunks.length);
          job.chunks = next.chunks;
          job.updated = next.updated;
          onChange({ ...job });
          first = last + 1;
        } finally {
          if (source) await source.pdf.loadingTask.destroy();
          bytes = undefined;
        }
      }
    });
    return job;
  });
}
export async function assembleLargeJob(id: string, ctx: RunContext): Promise<ExportFile> {
  return withLargeLease(id, async () => {
    const job = await loadLargeJob(id);
    if (!job) throw new Error('Der gespeicherte Auftrag fehlt.');
    validateLargeJob(job);
    if (job.chunks.at(-1)?.last !== job.pages)
      throw new Error('Bitte zuerst alle Abschnitte verarbeiten.');
    const files: Blob[] = [];
    for (let i = 0; i < job.chunks.length; i++) {
      const blob = await largeChunkBlob(id, i);
      if (
        !blob ||
        blob.size !== job.chunks[i].size ||
        (await contentDigestBlob(blob, ctx.signal)) !== job.chunks[i].digest
      )
        throw new Error('Ein gespeicherter Abschnitt fehlt oder ist beschädigt.');
      files.push(blob);
    }
    if (files.reduce((n, f) => n + f.size, 0) > LARGE_MAX_BYTES)
      throw new Error(
        'Die Gesamtausgabe überschreitet 256 MB. Bitte die geprüften Abschnitte einzeln herunterladen.',
      );
    ctx.report({ percent: 85, label: 'Geprüfte Abschnitte zusammensetzen …' });
    const { bytes } = await largePdfJob({ operation: 'assemble', files }, ctx.signal),
      blob = pdfBlob(bytes!);
    const expected = job.chunks.flatMap((c) => c.summaries);
    await withPdfDocument(blob, ctx.signal, async (pdf, signal, step) => {
      if (pdf.numPages !== job.pages)
        throw new Error('Die Seitenzahl der Gesamtausgabe stimmt nicht.');
      for (let i = 0; i < pdf.numPages; i++) {
        const actual = await step('large-final-page', summary(await pdf.getPage(i + 1), signal));
        if (!sameSummary(expected[i], actual))
          throw new Error('Die Gesamtausgabe stimmt nicht mit den geprüften Abschnitten überein.');
        ctx.report({
          percent: 85 + (15 * (i + 1)) / pdf.numPages,
          label: `Gesamtausgabe prüfen · Seite ${i + 1} / ${pdf.numPages}`,
        });
      }
    });
    ctx.signal.throwIfAborted();
    return {
      blob,
      filename: filenameStem(job.name) + '-bearbeitet.pdf',
      kind: 'pdf',
      pages: job.pages,
      exportAudit: {
        version: 1,
        status: 'checked',
        pages: job.pages,
        checkedPages: job.pages,
        issues: [],
        compared: true,
      },
      note: 'Alle Seiten wurden mit den geprüften Abschnitten verglichen: Text, Maße, externe Links und gerenderte Vorschauen. Dokumentinfos werden nicht übernommen. Die Aufträge bleiben bis zum Löschen lokal gespeichert.',
    };
  });
}
export async function replaceLargeChunk(
  id: string,
  index: number,
  file: File,
  ctx: RunContext,
): Promise<LargeJob> {
  return withLargeLease(id, async (token) => {
    const job = await loadLargeJob(id);
    if (!job) throw new Error('Der Abschnitt fehlt.');
    validateLargeJob(job);
    if (!job.chunks[index]) throw new Error('Der Abschnitt fehlt.');
    if (file.size > 64 * 1024 * 1024)
      throw new Error('Ein Ersatzabschnitt darf höchstens 64 MB groß sein.');
    const pages = checkLargeStructure(
        (await largePdfJob({ operation: 'inspect', files: [file] }, ctx.signal)).json,
      ),
      chunk = job.chunks[index];
    if (pages !== chunk.last - chunk.first + 1)
      throw new Error('Der Ersatzabschnitt muss dieselbe Seitenzahl haben.');
    const summaries = await withPdfDocument(file, ctx.signal, async (pdf, signal, step) => {
      const values: LargePageSummary[] = [];
      for (let i = 0; i < pdf.numPages; i++)
        values.push(await step('replacement-page', summary(await pdf.getPage(i + 1), signal)));
      return values;
    });
    const digest = await contentDigestBlob(file, ctx.signal),
      next = {
        ...job,
        chunks: job.chunks.map((c, i) =>
          i === index ? { ...c, size: file.size, digest, summaries, replaced: true } : c,
        ),
      };
    ctx.signal.throwIfAborted();
    await saveLargeJob(next, token, file, index);
    return next;
  });
}

export async function exportLargeChunk(
  id: string,
  index: number,
  ctx: RunContext,
): Promise<ExportFile> {
  return withLargeLease(id, async () => {
    const job = await loadLargeJob(id);
    if (!job) throw new Error('Der Abschnitt fehlt.');
    validateLargeJob(job);
    const chunk = job.chunks[index],
      blob = await largeChunkBlob(id, index);
    if (
      !chunk ||
      !blob ||
      blob.size !== chunk.size ||
      (await contentDigestBlob(blob, ctx.signal)) !== chunk.digest
    )
      throw new Error('Ein gespeicherter Abschnitt fehlt oder ist beschädigt.');
    return {
      blob,
      filename: `${filenameStem(job.name)}-${chunk.first}-${chunk.last}.pdf`,
      kind: 'pdf',
      pages: chunk.last - chunk.first + 1,
      exportAudit: {
        version: 1,
        status: 'checked',
        pages: chunk.summaries.length,
        checkedPages: chunk.summaries.length,
        issues: [],
        compared: true,
      },
      note: 'Geprüfter Abschnitt. Nach dem Bearbeiten die gespeicherte PDF als Ersatzabschnitt importieren. Die Seitenzahl muss gleich bleiben.',
    };
  });
}
