import type { DocumentTool } from './document-tools';
import type { SpecialTool } from './special-tools';
import { isAdvancedTool, isServerTool, type AdvancedTool, type ServerTool } from './advanced-types';
import { PDFDocument, PDFName, degrees, rgb, type PDFPage } from 'pdf-lib';
import {
  runJob,
  openSource,
  renderPage,
  prepareSources,
  requireAcroForm,
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
  editorRectsOverlap,
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
export type EditorTextStyle = Pick<
  Mark,
  | 'fontScale'
  | 'fontFamily'
  | 'fontChoice'
  | 'originalFontId'
  | 'originalFontName'
  | 'originalFontPage'
  | 'bold'
  | 'italic'
  | 'color'
>;
export type EditorTextRun = { start: number; end: number; style: EditorTextStyle };
export type Mark = Rect & {
  id: string;
  kind: 'redact' | 'highlight' | 'text' | 'signature' | 'erase' | 'image';
  text?: string;
  runs?: EditorTextRun[];
  originalText?: string;
  /** Local font bytes travel with the project; no external font URL is accepted. */
  customFont?: { name: string; data: string; bold: boolean; italic: boolean };
  fontScale?: number;
  image?: string;
  nativeImage?: {
    index: number;
    path?: number[];
    rect: Rect;
    crop?: Rect;
    corners?: [number, number][];
  };

  nativeTable?: import('./editor-tables').EditorTable;

  tableCell?: { tableId: string; cellId: string };
  sourceRect?: Rect;
  sourceRects?: Rect[];
  sourceIsScan?: boolean;
  scanBackground?: 'preserve' | 'solid';
  fontFamily?: FontFamily;
  fontChoice?: EditorFontChoice;
  originalFontId?: string;
  originalFontName?: string;
  originalFontPage?: number;
  originalState?: string;
  /** Editing relationships do not change the appearance until text is redistributed. */
  flow?: { id: string; order: number };
  changeGroup?: string;
  /** Ephemeral export plan; never persisted in an editor project. */
  nativeTextSlice?: { source: Rect; before: string; removed: string; after: string };
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
  textAspect?: number;
};
export type Edits = { marks: Record<string, Mark[]>; crops: Record<string, Rect> };
export type StudioOptions = JobOptions &
  ExtraOptions & {
    editorLanguage?: string;
    editorAllowRaster?: boolean;
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
async function paintErasures(canvas: HTMLCanvasElement, marks: Mark[]) {
  const ctx = canvas.getContext('2d')!;
  for (const mark of marks) {
    for (const r of editorRemovalRects(mark)) {
      if (mark.kind === 'text' && mark.sourceIsScan !== false && mark.scanBackground !== 'solid') {
        (await import('./editor-scan')).eraseEditorScanRegion(canvas, r, 'preserve', mark.fill);
        continue;
      }
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
  await paintErasures(canvas, marks);
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
      const { editorLayoutPlan } = await import('./editor-layout-plan');
      const { prepareEditorRuns } = await import('./editor-rich-layout');
      const { loadEditorCssFont } = await import('./editor-fonts');
      const runs = await prepareEditorRuns(mark, source),
        layout = editorLayoutPlan(mark, w, h, runs);
      for (const { resolution } of runs)
        if (resolution.substituted)
          warnings?.push(
            `Schriftersatz: ${mark.originalFontName || 'Originalschrift'} → ${resolution.font.name}. ${resolution.reason || ''}`,
          );
      if (layout.overflow)
        throw new Error(
          'Ein Textfeld ist zu klein. Vergrößere seine Höhe oder reduziere die Schriftgröße.',
        );
      await Promise.all(
        [...new Set(layout.pieces.map((p) => p.font))].map((font) =>
          loadEditorCssFont(font, source),
        ),
      );
      const { geometry } = layout;
      ctx.translate(geometry.x, geometry.y);
      ctx.rotate((geometry.rotation * Math.PI) / 180);
      ctx.scale(layout.scaleX, 1);
      ctx.fontKerning = 'none';
      ctx.textBaseline = 'alphabetic';
      for (const piece of layout.pieces) {
        ctx.fillStyle = hexColor(piece.color, '#222222');
        ctx.font = `${piece.font.italic ? 'italic ' : ''}${piece.font.bold ? 'bold ' : ''}${piece.size}px "${piece.font.cssFamily}"`;
        let dx = piece.x;
        for (const { segment } of new Intl.Segmenter(undefined, {
          granularity: 'grapheme',
        }).segment(piece.text)) {
          ctx.fillText(segment, dx, piece.y);
          dx += piece.font.measure(segment, piece.size) + [...segment].length * piece.tracking;
        }
      }
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
  editor?: {
    language: string;
    warnings: string[];
    allowRaster?: boolean;
    painted?: Record<string, Mark[]>;
  },
) {
  const doc = await PDFDocument.create();
  const loaded = new Map<string, PDFDocument>();
  let preservedForm: PDFDocument | undefined;
  if (editor) {
    const { rejectSignedPdf } = await import('./pdf-signature-guard');
    for (const source of sources.filter((s) => pages.some((p) => p.sourceId === s.id))) {
      let pdf: PDFDocument;
      try {
        const native = await import('./editor-native');
        pdf = await native.loadEditorPdf(source.bytes, source, signal);
        if (native.editorSourceWasRepaired(source))
          editor.warnings.push(
            'Die PDF-Struktur wurde lokal repariert. Alle Seiten wurden vor der Bearbeitung auf Text, Geometrie und Darstellung geprüft.',
          );
        if (!pdf.catalog) throw new Error('Ungültige PDF-Struktur.');
      } catch {
        check(signal);
        if (!editor.allowRaster)
          throw new Error(
            'Diese PDF kann nicht originalgetreu übernommen werden. Bitte eine gewöhnliche PDF verwenden oder „Seiten als Bild neu aufbauen“ aktivieren.',
          );
        editor.warnings.push(
          'Eine PDF musste aus ihrer sichtbaren Seitenansicht neu aufgebaut werden. Interaktive Inhalte bitte im Ergebnis prüfen.',
        );
        continue;
      }
      rejectSignedPdf(pdf);
      const form = requireAcroForm(pdf);
      if (form.getFields().length) {
        try {
          if (forceRaster)
            throw new Error('Formularseiten können nicht als Bild neu aufgebaut werden.');
          await (
            await import('./editor-native')
          ).requireEditorFormLayout(source, pages, edits, signal);
          preservedForm = pdf;
        } catch (error) {
          check(signal);
          if (!editor.allowRaster) throw error;
          form.flatten();
          editor.warnings.push(
            'Formularfelder wurden in sichtbare Inhalte umgewandelt und sind nicht mehr interaktiv.',
          );
        }
      }
      loaded.set(source.id, pdf);
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
      // Opening or searching a scan prepares the editor, but does not request
      // changes to an otherwise untouched page or its existing search layer.
      if (editor && !marks.length && !crop && !forceRaster && loaded.has(item.sourceId)) {
        await appendPage(doc, loaded, item);
        continue;
      }
      const contentRemoval = marks.some((m) => m.kind === 'erase' || !!m.sourceRect),
        rasterMarks = forceRaster || !!crop || marks.some((m) => m.kind === 'redact');
      const imageEdit = marks.some((m) => m.nativeImage);

      const tableEdit = marks.some((m) => m.nativeTable);

      if (tableEdit && rasterMarks)
        throw new Error(
          'Rastertabellen bitte ohne Seitenbeschnitt oder Bild-Neuaufbau bearbeiten.',
        );
      if (imageEdit && rasterMarks)
        throw new Error(
          'Vorhandene Bilder bitte ohne Seitenbeschnitt oder Raster-Neuaufbau bearbeiten.',
        );
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
      if (analysis && imageEdit) {
        const regions = marks.filter((m) => m.nativeImage).flatMap((m) => [m.nativeImage!.rect, m]);
        if (
          analysis.targets.some((t) => t.invisible && regions.some((r) => editorRectsOverlap(t, r)))
        )
          throw new Error(
            'Dieses Bild besitzt eine vorhandene OCR-Textebene. Bitte den Scan als Text bearbeiten, damit keine veraltete Textebene zurückbleibt.',
          );
        analysis = {
          ...analysis,
          targets: analysis.targets.filter(
            (t) => t.origin !== 'ocr' || !regions.some((r) => editorRectsOverlap(t, r)),
          ),
        };
      }
      if (analysis && marks.some((mark) => editorTextCollision(mark, marks, analysis.targets)))
        throw new Error(
          'Der Text überlappt einen anderen Inhalt. Bitte Text kürzen, Schriftgröße anpassen oder das Textfeld verschieben.',
        );
      let preserved: PDFDocument | undefined;
      let drawMarks = marks;
      const removals = marks.flatMap(editorRemovalRects);
      const nativeTextRemoval =
        analysis &&
        removals.length > 0 &&
        analysis.targets.some((t) => removals.some((r) => editorRectsOverlap(t, r))) &&
        !analysis.targets.some(
          (t) =>
            (t.origin === 'ocr' || t.invisible) && removals.some((r) => editorRectsOverlap(t, r)),
        );
      if (
        editor &&
        analysis &&
        (nativeTextRemoval || imageEdit || tableEdit) &&
        !analysis.replaceTextLayer &&
        (contentRemoval || imageEdit || tableEdit) &&
        !rasterMarks &&
        loaded.has(item.sourceId) &&
        marks.every((m) => m.kind === 'text' || m.kind === 'image')
      ) {
        try {
          const { removeEditorContent } = await import('./editor-native');
          const { sparseEditorMark } = await import('./editor-sparse');

          drawMarks = marks.map((mark) =>
            mark.tableCell ? mark : sparseEditorMark(mark, analysis!.width, source),
          );
          try {
            preserved = await removeEditorContent(
              loaded.get(item.sourceId)!,
              item,
              drawMarks,
              analysis.targets,
              signal,
            );
          } catch (error) {
            check(signal);
            if (!drawMarks.some((m) => m.nativeTextSlice)) throw error;
            drawMarks = marks;
            preserved = await removeEditorContent(
              loaded.get(item.sourceId)!,
              item,
              marks,
              analysis.targets,
              signal,
            );
          }
        } catch {
          check(signal);

          if (tableEdit)
            throw new Error(
              'Das Tabellenraster konnte nicht sicher als Vektor geändert werden. Die Bearbeitung bleibt geöffnet.',
            );
          if (!editor.allowRaster)
            throw new Error(
              'Der Originaltext kann auf dieser Seite nicht sicher einzeln entfernt werden. Bitte eine vollständige Textstelle auswählen oder „Seiten als Bild neu aufbauen“ aktivieren.',
            );
          editor.warnings.push(
            `Seite ${i + 1}: Der Hintergrund wurde als Bild erhalten, weil die Bearbeitung der Originalobjekte nicht vollständig bestätigt werden konnte.`,
          );
        }
      }
      const scanPage =
        analysis && !analysis.targets.some((t) => t.origin === 'pdf' && !t.invisible);
      if (
        editor &&
        analysis &&
        !preserved &&
        !rasterMarks &&
        contentRemoval &&
        loaded.has(item.sourceId) &&
        marks.every((m) => m.kind === 'text')
      ) {
        try {
          preserved = await (
            await import('./editor-native')
          ).patchEditorScan(
            loaded.get(item.sourceId)!,
            source,
            item,
            marks,
            analysis.targets,
            analysis.replaceTextLayer,
            signal,
          );
        } catch (error) {
          check(signal);
          if (!editor.allowRaster && scanPage) throw error;
        }
      }
      if (imageEdit && !preserved)
        throw new Error(
          'Das Bild konnte nicht als Originalobjekt geändert werden. Bitte die Bildänderung zurücknehmen.',
        );

      if (tableEdit && !preserved)
        throw new Error(
          'Das Tabellenraster konnte nicht sicher als Vektor geändert werden. Die Bearbeitung bleibt geöffnet.',
        );
      if (editor && !preserved && !rasterMarks && (contentRemoval || analysis?.replaceTextLayer)) {
        if (!scanPage && !editor.allowRaster)
          throw new Error(
            'Diese Änderung erfordert einen Neuaufbau der Seite als Bild. Dabei können Vektoren, Links und Formularfelder verloren gehen. Bitte „Seiten als Bild neu aufbauen“ aktivieren oder die Änderung verwerfen.',
          );
        editor.warnings.push(
          `Seite ${i + 1}: Als Bild neu aufgebaut. Hintergrund, OCR und unveränderte Bereiche bitte im Ergebnis prüfen.`,
        );
      }
      const appendNative =
        editor &&
        analysis &&
        !contentRemoval &&
        marks.length > 0 &&
        !rasterMarks &&
        !analysis.replaceTextLayer &&
        loaded.has(item.sourceId) &&
        marks.every((m) => m.kind === 'text' || (m.kind === 'image' && !m.nativeImage));
      if ((preserved || appendNative) && analysis) {
        if (editor?.painted) editor.painted[item.id] = drawMarks;
        const outputPage = preserved
          ? (await doc.copyPages(preserved, [0]))[0]
          : await appendPage(doc, loaded, item);
        if (preserved) doc.addPage(outputPage);
        const { drawEditorText, editorPointToPdf } = await import('./editor-text-layer');
        for (const mark of drawMarks.filter((m) => !m.nativeImage)) {
          if (mark.nativeTable) {
            const table = mark.nativeTable,
              { editorTableSegments } = await import('./editor-tables');

            const color = hexColor(table.color, '#000000');

            for (const s of editorTableSegments(table)) {
              const [ax, ay] = editorPointToPdf(outputPage, s.x1, s.y1),
                [bx, by] = editorPointToPdf(outputPage, s.x2, s.y2);

              outputPage.drawLine({
                start: { x: ax, y: ay },

                end: { x: bx, y: by },

                thickness: table.width,

                color: rgb(
                  parseInt(color.slice(1, 3), 16) / 255,

                  parseInt(color.slice(3, 5), 16) / 255,

                  parseInt(color.slice(5, 7), 16) / 255,
                ),
              });
            }
          } else if (mark.kind === 'text' && mark.text)
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
          else if (mark.kind === 'image' && mark.image) {
            const image = await doc.embedPng(mark.image);
            const [x, y] = editorPointToPdf(
              outputPage,
              mark.x * analysis.width,
              (mark.y + mark.h) * analysis.height,
            );
            outputPage.drawImage(image, {
              x,
              y,
              width: mark.w * analysis.width,
              height: mark.h * analysis.height,
              rotate: degrees(outputPage.getRotation().angle),
              opacity: mark.opacity ?? 1,
            });
          }
        }
        if (analysis.ocr) {
          const { addEditorTextLayer } = await import('./editor-text-layer');
          await addEditorTextLayer(
            doc,
            outputPage,
            editorTools!
              .remainingEditorTargets(analysis.targets, removals)
              .filter((t) => t.origin === 'ocr'),
            analysis.width,
            analysis.height,
          );
        }
      } else if (
        rasterMarks ||
        contentRemoval ||
        analysis?.replaceTextLayer ||
        !loaded.has(item.sourceId)
      ) {
        if (preservedForm)
          throw new Error(
            'Diese Formularseite kann nur durch Änderungen an den Originalobjekten bearbeitet werden. Bitte eine Druckkopie verwenden, wenn ein Bild-Neuaufbau nötig ist.',
          );
        const original = loaded.get(item.sourceId),
          scan =
            analysis?.ocr && original
              ? await (
                  await import('./editor-native')
                ).readEditorScanPixels(original, source, item, signal)
              : undefined,
          rendered = scan || (await renderPage(source, item, 2800, signal));
        let canvas = rendered.canvas;
        try {
          if (rasterMarks) await paintMarks(canvas, marks, source, editor?.warnings);
          else await paintErasures(canvas, marks);
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

            next.getContext('2d')!.drawImage(
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
  if (preservedForm)
    return (await import('./editor-native')).preserveEditorForm(preservedForm, doc);
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
  const editorPainted: Record<string, Mark[]> = {};
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
      ? {
          language: options.editorLanguage || 'deu+eng',
          warnings: editorWarnings,
          allowRaster: options.editorAllowRaster,
          painted: editorPainted,
        }
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
  const editorVerification =
    tool === 'edit-text'
      ? await (
          await import('./editor-verification')
        ).verifyEditorExport(
          bytes,
          sources,
          pages,
          edits,
          options.editorLanguage || 'deu+eng',
          signal,
          report,
          editorPainted,
        )
      : undefined;
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
    ...(editorVerification ? { editorVerification } : {}),
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
