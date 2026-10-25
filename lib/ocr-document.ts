import { PDFDocument } from 'pdf-lib';
import { analyzeEditorPage, createEditorRecognizer } from './editor-analysis';
import { addEditorTextLayer } from './editor-text-layer';
import {
  appendPage,
  prepareSources,
  filenameStem,
  pdfBlob,
  type Source,
  type PageItem,
  type JobOptions,
  type JobResult,
  type ProgressUpdate,
} from './pdf-engine';
import type { TextTarget } from './editor-model';

export type OcrLine = { text: string; editable: boolean; targets: TextTarget[] };
export type OcrResultPage = { width: number; height: number; lines: OcrLine[] };
export function ocrLines(targets: TextTarget[]): OcrLine[] {
  const lines: OcrLine[] = [];
  for (const target of targets) {
    const editable = target.origin === 'ocr' || !!target.invisible;
    const previous = lines.at(-1),
      last = previous?.targets.at(-1);
    if (
      previous &&
      last &&
      previous.editable === editable &&
      !target.rotation &&
      !last.rotation &&
      Math.abs(target.y - last.y) < Math.max(target.h, last.h) * 0.4 &&
      target.x >= last.x &&
      target.x - (last.x + last.w) < Math.max(target.h, last.h) * 2
    ) {
      previous.targets.push(target);
      previous.text += ' ' + target.text;
    } else lines.push({ text: target.text.replace(/[\r\n]+/g, ' '), editable, targets: [target] });
  }
  return lines;
}
export function ocrResultText(pages: OcrResultPage[]) {
  return pages
    .map((p, i) => `— Seite ${i + 1} —\n\n${p.lines.map((l) => l.text).join('\n')}`)
    .join('\n\n');
}

export async function stripOcrSearchLayers(
  bytes: Uint8Array,
  indices: number[],
  signal: AbortSignal,
) {
  const { inspectObjectTree, editObjects } = await import('./native-pdf');
  let result = bytes;
  for (const page of indices) {
    signal.throwIfAborted();
    const objects = await inspectObjectTree(result, page, signal);
    const groups = new Map<string, { path: number[]; indices: number[] }>();
    for (const object of objects) {
      if (object.type !== 'text' || object.textMode !== 3 || object.shaped) continue;
      const path = object.path || [],
        key = path.join(':');
      const group = groups.get(key) || { path, indices: [] };
      group.indices.push(object.index);
      groups.set(key, group);
    }
    // Removing descendants before siblings prevents index shifts in the traversal paths.
    const ordered = [...groups.values()].sort((a, b) => {
      for (let i = 0; i < Math.min(a.path.length, b.path.length); i++)
        if (a.path[i] !== b.path[i]) return b.path[i] - a.path[i];
      return b.path.length - a.path.length;
    });
    for (const group of ordered)
      result = await editObjects(
        result,
        page,
        group.indices.map((index) => ({ index, remove: true })),
        signal,
        group.path,
      );
  }
  return result;
}

export async function writeOcrCorrections(base: Blob, pages: OcrResultPage[], signal: AbortSignal) {
  signal.throwIfAborted();
  const doc = await PDFDocument.load(await base.arrayBuffer(), { updateMetadata: false });
  if (doc.getPageCount() !== pages.length)
    throw new Error('Der OCR-Arbeitsstand passt nicht zur PDF.');
  for (const [index, data] of pages.entries()) {
    signal.throwIfAborted();
    const targets: TextTarget[] = [];
    for (const line of data.lines) {
      if (!line.editable || !line.text.trim()) continue;
      const original = line.targets.map((t) => t.text).join(' ');
      if (line.text === original) targets.push(...line.targets);
      else {
        const x = Math.min(...line.targets.map((t) => t.x)),
          y = Math.min(...line.targets.map((t) => t.y));
        targets.push({
          ...line.targets[0],
          x,
          y,
          w: Math.max(...line.targets.map((t) => t.x + t.w)) - x,
          h: Math.max(...line.targets.map((t) => t.y + t.h)) - y,
          text: line.text,
          invisible: true,
        });
      }
    }
    await addEditorTextLayer(doc, doc.getPage(index), targets, data.width, data.height);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  return pdfBlob(await doc.save({ updateFieldAppearances: false }));
}

export async function runDocumentOcr(
  sources: Source[],
  items: PageItem[],
  options: JobOptions,
  report: (p: ProgressUpdate) => void,
  signal: AbortSignal,
): Promise<JobResult> {
  const source = sources.find((s) => s.id === items[0]?.sourceId);
  if (!source || !items.length) throw new Error('Bitte zuerst eine PDF auswählen.');
  const whole =
    items.length === source.pdf.numPages &&
    items.every((p, i) => p.sourceId === source.id && p.index === i && p.rotation % 360 === 0);
  let baseBytes = source.bytes;
  if (!whole) {
    const combined = await PDFDocument.create(),
      loaded = await prepareSources(sources, items);
    for (const item of items) {
      signal.throwIfAborted();
      await appendPage(combined, loaded, item);
    }
    baseBytes = new Uint8Array(await combined.save());
  }
  const recognizer = createEditorRecognizer(signal, options.ocrLayout);
  const data: OcrResultPage[] = [],
    hidden: number[] = [];
  try {
    for (const [index, item] of items.entries()) {
      signal.throwIfAborted();
      const current = sources.find((s) => s.id === item.sourceId)!;
      const analysis = await analyzeEditorPage(current, item, {
        signal,
        language: options.language,
        autoLanguage: options.autoLanguage,
        forceOcr: options.forceOcr,
        recognizer,
        cache: false,
        report: (p) =>
          report({
            percent: ((index + p.percent / 100) / items.length) * 85,
            label: `Seite ${index + 1}/${items.length} · ${p.label}`,
          }),
      });
      const original = await (await import('./editor-model')).readTextTargets(current, item);
      if (original.targets.some((t) => t.invisible)) hidden.push(index);
      data.push({
        width: analysis.width,
        height: analysis.height,
        lines: ocrLines(analysis.targets),
      });
      // PDF.js can release decoded images after each sequential page; the text cache stays bounded.
      (await current.pdf.getPage(item.index + 1)).cleanup();
    }
  } finally {
    await recognizer.dispose();
  }
  if (hidden.length) baseBytes = await stripOcrSearchLayers(baseBytes, hidden, signal);
  const base = pdfBlob(baseBytes);
  report({ percent: 90, label: 'Suchtext wird in die PDF geschrieben …' });
  const blob = await writeOcrCorrections(base, data, signal);
  report({ percent: 100, label: 'Durchsuchbare PDF ist fertig' });
  return {
    blob,
    filename: `${filenameStem(source.name)}-durchsuchbar.pdf`,
    kind: 'pdf',
    pages: items.length,
    inputSize: sources.reduce((n, s) => n + s.size, 0),
    text: ocrResultText(data),
    ocrData: data,
    ocrBase: base,
    note: 'Scanbereiche werden auch auf gemischten Seiten erkannt. Korrigierte OCR-Zeilen werden mit „Korrekturen übernehmen“ in die PDF-Suchebene geschrieben. Sichtbarer Originaltext bleibt erhalten.',
  };
}
