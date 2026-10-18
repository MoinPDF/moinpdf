import type { DocumentTool } from './document-tools';
import type { SpecialTool } from './special-tools';
import { isAdvancedTool, isServerTool, type AdvancedTool, type ServerTool } from './advanced-types';
import { PDFDocument, PDFName, degrees, rgb, type PDFPage } from 'pdf-lib';
import {
  runJob,
  openSource,
  renderPage,
  prepareSources,
  appendPage,
  filenameStem,
  pdfBlob,
  type Source,
  type PageItem,
  type ToolId,
  type JobOptions,
  type JobResult,
  type ProgressUpdate,
} from './pdf-engine';
import {
  extraDefaults,
  isExtraTool,
  sourceOnlyTools,
  rasterTools,
  type ExtraTool,
  type ExtraOptions,
} from './extra-options';
import { rasterTransform, runSourceTool, runExtraPdfTool } from './extra-tools';
import {
  hexColor,
  editorRemovalRects,
  editorMarkChanged,
  editorTextCollision,
  type FontFamily,
} from './editor-model';
import type { EditorFontChoice } from './editor-font-catalog';

export type StudioTool =
  | ToolId
  | ExtraTool
  | DocumentTool
  | SpecialTool
  | AdvancedTool
  | ServerTool
  | 'redact'
  | 'crop'
  | 'annotate'
  | 'sign'
  | 'metadata'
  | 'grayscale'
  | 'resize'
  | 'flatten'
  | 'nup'
  | 'edit-text'
  | 'erase'
  | 'insert-image';
export type Rect = { x: number; y: number; w: number; h: number };
export type Mark = Rect & {
  id: string;
  kind: 'redact' | 'highlight' | 'text' | 'signature' | 'erase' | 'image';
  text?: string;
  fontScale?: number;
  image?: string;
  sourceRect?: Rect;
  sourceRects?: Rect[];
  fontFamily?: FontFamily;
  fontChoice?: EditorFontChoice;
  originalFontId?: string;
  originalFontName?: string;
  originalFontPage?: number;
  originalState?: string;
  baselineScale?: number;
  insetScale?: number;
  lineHeight?: number;
  tracking?: number;
  textScaleX?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  fill?: string;
  opacity?: number;
  textRotation?: number;
};
export type Edits = { marks: Record<string, Mark[]>; crops: Record<string, Rect> };
export type StudioOptions = JobOptions &
  ExtraOptions & {
    editorLanguage?: string;
    pageSize: 'a4' | 'letter';
    orientation: 'portrait' | 'landscape';
    perSheet: '2' | '4';
  };
export const emptyEdits = (): Edits => ({ marks: {}, crops: {} });
export const visualTools = [
  'redact',
  'crop',
  'annotate',
  'sign',
  'edit-text',
  'erase',
  'insert-image',
];
const baseTools = [
  'ocr',
  'merge',
  'split',
  'organize',
  'images',
  'to-images',
  'compress',
  'watermark',
  'numbers',
];
const check = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
};
export function normalizedRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const x = Math.max(0, Math.min(1, Math.min(a.x, b.x))),
    y = Math.max(0, Math.min(1, Math.min(a.y, b.y)));
  return {
    x,
    y,
    w: Math.max(0, Math.min(1 - x, Math.abs(a.x - b.x))),
    h: Math.max(0, Math.min(1 - y, Math.abs(a.y - b.y))),
  };
}
export function countEdits(edits: Edits, pages: PageItem[]) {
  return pages.reduce(
    (n, p) =>
      n + (edits.marks[p.id]?.filter(editorMarkChanged).length || 0) + (edits.crops[p.id] ? 1 : 0),
    0,
  );
}
export function paperSize(options: StudioOptions): [number, number] {
  const size: [number, number] = options.pageSize === 'letter' ? [612, 792] : [595.28, 841.89];
  return options.orientation === 'landscape' ? [size[1], size[0]] : size;
}
// Embed just the visible crop box and normalize PDF rotation to match the preview.
export async function normalizedPage(dest: PDFDocument, source: PDFPage, addedRotation = 0) {
  const box = source.getCropBox(),
    angle = (((source.getRotation().angle + addedRotation) % 360) + 360) % 360;
  const w = box.width,
    h = box.height;
  const size: [number, number] = angle % 180 ? [h, w] : [w, h];
  const page = dest.addPage(size);
  if (!source.node.Contents()) return page;
  const embed = await dest.embedPage(source, {
    left: box.x,
    bottom: box.y,
    right: box.x + w,
    top: box.y + h,
  });
  const position =
    angle === 90
      ? { x: 0, y: w }
      : angle === 180
        ? { x: w, y: h }
        : angle === 270
          ? { x: h, y: 0 }
          : { x: 0, y: 0 };
  page.drawPage(embed, { ...position, width: w, height: h, rotate: degrees(-angle) });
  return page;
}
function paintErasures(canvas: HTMLCanvasElement, marks: Mark[]) {
  const ctx = canvas.getContext('2d')!;
  for (const mark of marks) {
    for (const r of editorRemovalRects(mark)) {
      ctx.fillStyle = hexColor(mark.fill, '#ffffff');
      const x = Math.floor(r.x * canvas.width),
        y = Math.floor(r.y * canvas.height);
      ctx.fillRect(
        x,
        y,
        Math.ceil((r.x + r.w) * canvas.width) - x,
        Math.ceil((r.y + r.h) * canvas.height) - y,
      );
    }
  }
}
async function paintMarks(
  canvas: HTMLCanvasElement,
  marks: Mark[],
  source?: Source,
  warnings?: string[],
) {
  const ctx = canvas.getContext('2d')!,
    w = canvas.width,
    h = canvas.height;
  paintErasures(canvas, marks);
  const ordered = [
    ...marks.filter((m) => m.kind !== 'redact'),
    ...marks.filter((m) => m.kind === 'redact'),
  ];
  for (const mark of ordered) {
    ctx.save();
    const x = mark.x * w,
      y = mark.y * h,
      mw = mark.w * w,
      mh = mark.h * h;
    if (mark.kind === 'redact') {
      ctx.fillStyle = '#000';
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(mw) + 1, Math.ceil(mh) + 1);
    }
    if (mark.kind === 'highlight') {
      ctx.fillStyle = 'rgba(189,226,131,0.3)';
      ctx.fillRect(x, y, mw, mh);
    }
    if (mark.kind === 'text') {
      const { layoutEditorText } = await import('./editor-text-layer');
      const { resolveEditorFont, loadEditorCssFont } = await import('./editor-fonts');
      const resolution = await resolveEditorFont(mark, source);
      await loadEditorCssFont(resolution.font, source);
      if (resolution.substituted)
        warnings?.push(
          `Schriftersatz: ${mark.originalFontName || 'Originalschrift'} → ${resolution.font.name}. ${resolution.reason || ''}`,
        );
      const layout = layoutEditorText(mark, w, h, resolution.font.measure, resolution.font.descent);
      if (layout.overflow)
        throw new Error(
          'Ein Textfeld ist zu klein. Vergrößere seine Höhe oder reduziere die Schriftgröße.',
        );
      const { geometry, size } = layout;
      ctx.translate(geometry.x, geometry.y);
      ctx.rotate((geometry.rotation * Math.PI) / 180);
      ctx.scale(layout.scaleX, 1);
      ctx.fillStyle = hexColor(mark.color, '#222222');
      ctx.font = `${mark.italic ? 'italic ' : ''}${mark.bold ? 'bold ' : ''}${size}px "${resolution.font.cssFamily}"`;
      ctx.fontKerning = 'none';
      ctx.textBaseline = 'alphabetic';
      layout.lines.forEach((line, i) => {
        const tw = layout.measured(line);
        let dx =
          layout.inset +
          (mark.align === 'center'
            ? (layout.available - tw) / 2
            : mark.align === 'right'
              ? layout.available - tw
              : 0);
        for (const character of line) {
          ctx.fillText(character, dx, layout.baseline + i * layout.lineHeight);
          dx += resolution.font.measure(character, size) + layout.tracking;
        }
      });
    }
    if ((mark.kind === 'signature' || mark.kind === 'image') && mark.image) {
      const image = new Image();
      image.src = mark.image;
      await image.decode();
      ctx.globalAlpha = mark.opacity ?? 1;
      ctx.drawImage(image, x, y, mw, mh);
    }
    ctx.restore();
  }
}
async function paintVectorMarks(
  doc: PDFDocument,
  page: PDFPage,
  marks: Mark[],
  source?: Source,
  warnings?: string[],
) {
  const { width: w, height: h } = page.getSize();
  for (const mark of marks) {
    const x = mark.x * w,
      y = h - (mark.y + mark.h) * h,
      width = mark.w * w,
      height = mark.h * h;
    if (mark.kind === 'highlight')
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: rgb(189 / 255, 226 / 255, 131 / 255),
        opacity: 0.3,
      });
    if ((mark.kind === 'signature' || mark.kind === 'image') && mark.image) {
      const image = await doc.embedPng(mark.image);
      page.drawImage(image, { x, y, width, height, opacity: mark.opacity ?? 1 });
    }
    if (mark.kind === 'text' && mark.text) {
      const { drawEditorText } = await import('./editor-text-layer');
      await drawEditorText(doc, page, mark, w, h, source, (resolution) => {
        if (resolution.substituted)
          warnings?.push(
            `Schriftersatz: ${mark.originalFontName || 'Originalschrift'} → ${resolution.font.name}. ${resolution.reason || ''}`,
          );
      });
    }
  }
}
export async function applyPageEdits(
  sources: Source[],
  pages: PageItem[],
  edits: Edits,
  report: (p: ProgressUpdate) => void,
  signal: AbortSignal,
  forceRaster = false,
  grayscale = false,
  transform?: (
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ) => { canvas: HTMLCanvasElement; width: number; height: number },
  editor?: { language: string; warnings: string[] },
) {
  const doc = await PDFDocument.create();
  const loaded = new Map<string, PDFDocument>();
  if (editor) {
    // PDFs rendered successfully by PDF.js can still be unsupported by pdf-lib
    // (e.g. dynamic XFA). Rebuild their visible pages without losing the job.
    for (const source of sources.filter((s) => pages.some((p) => p.sourceId === s.id))) {
      try {
        for (const [id, pdf] of await prepareSources(
          [source],
          pages.filter((p) => p.sourceId === source.id),
        ))
          loaded.set(id, pdf);
      } catch {
        check(signal);
        editor.warnings.push(
          'Eine PDF musste aus ihrer sichtbaren Seitenansicht neu aufgebaut werden. Interaktive Inhalte bitte im Ergebnis prüfen.',
        );
      }
    }
  } else {
    for (const [id, pdf] of await prepareSources(sources, pages)) loaded.set(id, pdf);
  }
  const editorTools = editor ? await import('./editor-analysis') : undefined;
  let recognizer = editorTools?.createEditorRecognizer(signal);
  try {
    for (let i = 0; i < pages.length; i++) {
      check(signal);
      const item = pages[i],
        marks = (edits.marks[item.id] || []).filter(editorMarkChanged),
        crop = edits.crops[item.id];
      report({
        percent: (i / pages.length) * 90,
        label: `Seite ${i + 1} von ${pages.length} vorbereiten …`,
      });
      const source = sources.find((s) => s.id === item.sourceId)!;
      const contentRemoval = marks.some((m) => m.kind === 'erase' || !!m.sourceRect),
        rasterMarks = forceRaster || !!crop || marks.some((m) => m.kind === 'redact');
      let analysis: import('./editor-analysis').EditorPageText | undefined;
      if (editor && editorTools && !rasterMarks) {
        try {
          analysis = await editorTools.analyzeEditorPage(source, item, {
            signal,
            language: editor.language,
            recognizer,
            report: (p) =>
              report({
                percent: ((i + (p.percent / 100) * 0.7) / pages.length) * 90,
                label: `Seite ${i + 1} / ${pages.length} · ${p.label}`,
              }),
          });
          if (analysis.uncertain)
            editor.warnings.push(
              `Seite ${i + 1}: ${analysis.uncertain} Wörter unsicher erkannt. Bitte am Original prüfen.`,
            );
        } catch {
          check(signal);
          await recognizer?.dispose();
          recognizer = editorTools.createEditorRecognizer(signal);
          const { readTextTargets } = await import('./editor-model');
          try {
            analysis = {
              ...(await readTextTargets(source, item)),
              ocr: false,
              replaceTextLayer: false,
              uncertain: 0,
            };
          } catch {
            check(signal);
          }
          editor.warnings.push(
            `Seite ${i + 1}: Automatische Texterkennung nicht abgeschlossen. Vorhandene Inhalte und manuelle Änderungen wurden übernommen.`,
          );
        }
      }
      if (analysis && marks.some((mark) => editorTextCollision(mark, marks, analysis.targets)))
        throw new Error(
          'Der Text überlappt einen anderen Inhalt. Bitte Text kürzen, Schriftgröße anpassen oder das Textfeld verschieben.',
        );
      let preserved: PDFDocument | undefined;
      if (
        editor &&
        analysis &&
        !analysis.ocr &&
        !analysis.replaceTextLayer &&
        contentRemoval &&
        !rasterMarks &&
        loaded.has(item.sourceId) &&
        marks.every((m) => m.kind === 'text' || m.kind === 'erase')
      ) {
        try {
          const { removeEditorContent } = await import('./editor-native');
          preserved = await removeEditorContent(
            loaded.get(item.sourceId)!,
            item,
            marks,
            analysis.targets,
            signal,
          );
        } catch {
          check(signal);
          editor.warnings.push(
            `Seite ${i + 1}: Der Hintergrund wurde als Bild erhalten, weil die Bearbeitung der Originalobjekte nicht vollständig bestätigt werden konnte.`,
          );
        }
      }
      if (preserved && analysis) {
        const [outputPage] = await doc.copyPages(preserved, [0]);
        doc.addPage(outputPage);
        const { drawEditorText } = await import('./editor-text-layer');
        for (const mark of marks.filter((m) => m.kind === 'text' && m.text))
          await drawEditorText(
            doc,
            outputPage,
            mark,
            analysis.width,
            analysis.height,
            source,
            (resolution) => {
              if (resolution.substituted)
                editor?.warnings.push(
                  `Schriftersatz: ${mark.originalFontName || 'Originalschrift'} → ${resolution.font.name}. ${resolution.reason || ''}`,
                );
            },
          );
      } else if (
        rasterMarks ||
        contentRemoval ||
        analysis?.replaceTextLayer ||
        !loaded.has(item.sourceId)
      ) {
        const rendered = await renderPage(source, item, 2800, signal);
        let canvas = rendered.canvas;
        try {
          if (rasterMarks) await paintMarks(canvas, marks, source, editor?.warnings);
          else paintErasures(canvas, marks);
          let width = rendered.width,
            height = rendered.height;
          if (crop) {
            const rect = normalizedRect(
              { x: crop.x, y: crop.y },
              { x: crop.x + crop.w, y: crop.y + crop.h },
            );
            if (rect.w < 0.01 || rect.h < 0.01)
              throw new Error('Der Zuschneidebereich ist zu klein.');
            const next = document.createElement('canvas');
            next.width = Math.max(1, Math.round(canvas.width * rect.w));
            next.height = Math.max(1, Math.round(canvas.height * rect.h));
            next
              .getContext('2d')!
              .drawImage(
                canvas,
                canvas.width * rect.x,
                canvas.height * rect.y,
                canvas.width * rect.w,
                canvas.height * rect.h,
                0,
                0,
                next.width,
                next.height,
              );
            canvas.width = canvas.height = 0;
            canvas = next;
            width *= rect.w;
            height *= rect.h;
          }
          if (grayscale) {
            const ctx = canvas.getContext('2d')!,
              data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let j = 0; j < data.data.length; j += 4) {
              const gray = Math.round(
                0.2126 * data.data[j] + 0.7152 * data.data[j + 1] + 0.0722 * data.data[j + 2],
              );
              data.data[j] = data.data[j + 1] = data.data[j + 2] = gray;
            }
            ctx.putImageData(data, 0, 0);
          }
          if (transform) {
            const next = transform(canvas, width, height);
            if (next.canvas !== canvas) canvas.width = canvas.height = 0;
            canvas = next.canvas;
            width = next.width;
            height = next.height;
          }
          // Embed only the already modified pixels. No original objects or text layer are copied.
          const image = await doc.embedPng(canvas.toDataURL('image/png'));
          const outputPage = doc.addPage([width, height]);
          outputPage.drawImage(image, { x: 0, y: 0, width, height });
          if (!rasterMarks) {
            if (analysis && editorTools) {
              const removals = marks
                .filter((m) => m.kind === 'erase' || m.sourceRect)
                .flatMap(editorRemovalRects);
              const { addEditorTextLayer } = await import('./editor-text-layer');
              await addEditorTextLayer(
                doc,
                outputPage,
                editorTools.remainingEditorTargets(analysis.targets, removals),
                width,
                height,
              );
            }
            await paintVectorMarks(doc, outputPage, marks, source, editor?.warnings);
          }
        } finally {
          canvas.width = canvas.height = 0;
        }
      } else if (marks.length) {
        const page = await normalizedPage(
          doc,
          loaded.get(item.sourceId)!.getPage(item.index),
          item.rotation,
        );
        await paintVectorMarks(doc, page, marks, source, editor?.warnings);
        if (analysis?.ocr) {
          const { addEditorTextLayer } = await import('./editor-text-layer');
          await addEditorTextLayer(
            doc,
            page,
            analysis.targets.filter((t) => t.origin === 'ocr'),
            analysis.width,
            analysis.height,
          );
        }
      } else {
        const page = await appendPage(doc, loaded, item);
        if (analysis?.ocr) {
          const { addEditorTextLayer } = await import('./editor-text-layer');
          await addEditorTextLayer(
            doc,
            page,
            analysis.targets.filter((t) => t.origin === 'ocr'),
            analysis.width,
            analysis.height,
          );
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    await recognizer?.dispose();
  }
  check(signal);
  return doc;
}
export function removeDocumentMetadata(doc: PDFDocument) {
  delete doc.context.trailerInfo.Info;
  doc.catalog.delete(PDFName.of('Metadata'));
  // Page metadata streams are not needed for display and may repeat source information.
  for (const page of doc.getPages()) page.node.delete(PDFName.of('Metadata'));
}
export async function runStudioJob(
  tool: StudioTool,
  sources: Source[],
  pages: PageItem[],
  options: StudioOptions,
  edits: Edits,
  report: (p: ProgressUpdate) => void,
  signal: AbortSignal,
): Promise<JobResult> {
  if (isAdvancedTool(tool) || isServerTool(tool))
    throw new Error('Bitte dieses Werkzeug in seiner eigenen Arbeitsansicht öffnen.');
  if (
    [
      'fill-form',
      'create-form',
      'bookmarks',
      'protect',
      'unlock',
      'invoice-read',
      'invoice-check',
    ].includes(tool)
  )
    throw new Error('Bitte dieses Werkzeug im Dokumenteditor öffnen.');
  if (!pages.length) throw new Error('Bitte wähle mindestens eine Seite aus.');
  check(signal);
  const hasEdits = countEdits(edits, pages) > 0;
  if (isExtraTool(tool)) {
    const config = { ...extraDefaults, ...options };
    if (sourceOnlyTools.includes(tool)) {
      if (tool === 'compare' && hasEdits)
        throw new Error(
          'Bitte die visuellen Änderungen zuerst anwenden und das Ergebnis erneut zum Vergleich öffnen.',
        );
      return runSourceTool(tool, sources, pages, config, report, signal);
    }
    const raster = rasterTools.includes(tool);
    const prepared = await applyPageEdits(
      sources,
      pages,
      edits,
      report,
      signal,
      raster,
      false,
      raster ? rasterTransform(tool, config) : undefined,
    );
    return runExtraPdfTool(tool, prepared, sources, pages, config, normalizedPage, report, signal);
  }
  if (baseTools.includes(tool) && !hasEdits)
    return runJob(tool as ToolId, sources, pages, options, report, signal);
  const editorWarnings: string[] = [];
  let doc = await applyPageEdits(
    sources,
    pages,
    edits,
    report,
    signal,
    tool === 'flatten' || tool === 'grayscale',
    tool === 'grayscale',
    undefined,
    tool === 'edit-text'
      ? { language: options.editorLanguage || 'deu+eng', warnings: editorWarnings }
      : undefined,
  );
  if (baseTools.includes(tool)) {
    const file = new File([new Uint8Array(await doc.save())], 'Bearbeitet.pdf', {
      type: 'application/pdf',
    });
    const prepared = await openSource(file);
    try {
      const refs = pages.map((p, i) => ({ ...p, sourceId: prepared.id, index: i, rotation: 0 }));
      return await runJob(tool as ToolId, [prepared], refs, options, report, signal);
    } finally {
      await prepared.pdf.loadingTask.destroy();
    }
  }
  if (tool === 'resize' || tool === 'nup') {
    // Resolve pending image, font and page objects before embedding across documents.
    await doc.flush();
    const normalized = await PDFDocument.create();
    for (const page of doc.getPages()) await normalizedPage(normalized, page);
    await normalized.flush();
    const output = await PDFDocument.create(),
      size = paperSize(options),
      per = tool === 'nup' ? Number(options.perSheet) : 1;
    const columns = per === 4 ? 2 : 1,
      rows = per === 1 ? 1 : 2,
      margin = 20,
      gap = per > 1 ? 12 : 0;
    const cellW = (size[0] - margin * 2 - gap * (columns - 1)) / columns,
      cellH = (size[1] - margin * 2 - gap * (rows - 1)) / rows;
    let sheet: PDFPage | undefined;
    for (let i = 0; i < normalized.getPageCount(); i++) {
      check(signal);
      if (i % per === 0) sheet = output.addPage(size);
      const page = normalized.getPage(i),
        slot = i % per;
      if (!page.node.Contents()) continue;
      const embedded = await output.embedPage(page),
        scale = Math.min(cellW / page.getWidth(), cellH / page.getHeight());
      const w = page.getWidth() * scale,
        h = page.getHeight() * scale,
        col = slot % columns,
        row = Math.floor(slot / columns);
      sheet!.drawPage(embedded, {
        x: margin + col * (cellW + gap) + (cellW - w) / 2,
        y: size[1] - margin - row * (cellH + gap) - cellH + (cellH - h) / 2,
        width: w,
        height: h,
      });
    }
    doc = output;
  }
  if (
    tool === 'metadata' ||
    tool === 'redact' ||
    tool === 'crop' ||
    tool === 'edit-text' ||
    tool === 'erase' ||
    pages.some((p) => edits.marks[p.id]?.some((m) => m.kind === 'erase' || m.sourceRect))
  )
    removeDocumentMetadata(doc);
  const bytes = await doc.save();
  check(signal);
  const suffix: Record<string, string> = {
    'edit-text': 'Text-bearbeitet',
    erase: 'bereinigt',
    'insert-image': 'mit-Bild',
    redact: 'geschwaerzt',
    crop: 'zugeschnitten',
    annotate: 'Notizen',
    sign: 'unterschrieben',
    metadata: 'ohne-Dokumentinfos',
    grayscale: 'Graustufen',
    resize: 'Seitenformat',
    flatten: 'fixiert',
    nup: 'Seiten-pro-Blatt',
  };
  report({ percent: 100, label: 'Fertig' });
  return {
    blob: pdfBlob(bytes),
    filename: `${sources.length === 1 ? filenameStem(sources[0].name) : 'Dokumente'}-${suffix[tool]}.pdf`,
    kind: 'pdf',
    pages: doc.getPageCount(),
    inputSize: sources.reduce((n, s) => n + s.size, 0),
    ...(editorWarnings.length ? { note: [...new Set(editorWarnings)].join('\n') } : {}),
  };
}
export async function makeBlankFile(landscape = false, language: 'de' | 'en' = 'de') {
  const doc = await PDFDocument.create();
  doc.addPage(landscape ? [841.89, 595.28] : [595.28, 841.89]);
  return new File(
    [new Uint8Array(await doc.save())],
    language === 'en' ? 'Blank-page.pdf' : 'Leerseite.pdf',
    { type: 'application/pdf' },
  );
}
