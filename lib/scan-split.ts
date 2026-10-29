import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { renderPage, sourcePages, filenameStem, type Source } from './pdf-engine';
import { perspectiveCanvas } from './image-perspective';
import { detectScanPhotos, photoCorners, validPhoto, type ScanPhoto } from './scan-photo-detection';
import type { ExportFile, RunContext } from './advanced-types';
export type ScanRegions = Record<number, ScanPhoto[]>;
export type ScanFormat = 'pdf' | 'combined-pdf' | 'png' | 'jpeg';

/** Preview and export share exactly the same four-point crop and rotation. */
export function cropScanPhoto(canvas: HTMLCanvasElement, region: ScanPhoto, maxSide = 4096) {
  if (!validPhoto(region))
    throw new Error(
      'Die Fotoecken müssen innerhalb der Seite liegen und dürfen sich nicht kreuzen.',
    );
  const cropped = perspectiveCanvas(canvas, photoCorners(region), maxSide, 1);
  if (!region.rotation) return cropped;
  try {
    const rotated = document.createElement('canvas');
    rotated.width = region.rotation % 180 ? cropped.height : cropped.width;
    rotated.height = region.rotation % 180 ? cropped.width : cropped.height;
    const g = rotated.getContext('2d')!;
    g.translate(rotated.width / 2, rotated.height / 2);
    g.rotate((region.rotation * Math.PI) / 180);
    g.drawImage(cropped, -cropped.width / 2, -cropped.height / 2);
    return rotated;
  } finally {
    cropped.width = cropped.height = 0;
  }
}

export async function proposeScanRegions(
  source: Source,
  page: number,
  sensitivity: number,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const { canvas } = await renderPage(source, sourcePages(source)[page], 1000, signal);
  try {
    // Yield so a pending cancellation is observed before the bounded pixel pass.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    signal.throwIfAborted();
    const result = detectScanPhotos(
      canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
      sensitivity,
    );
    signal.throwIfAborted();
    return result;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export async function exportScanRegions(
  source: Source,
  regions: ScanRegions,
  format: ScanFormat,
  dpi: number,
  ctx: RunContext,
): Promise<ExportFile> {
  ctx.signal.throwIfAborted();
  const entries = Object.entries(regions)
    .map(([page, rects]) => [Number(page), rects] as const)
    .filter(([, rects]) => rects.length)
    .sort((a, b) => a[0] - b[0]);
  const count = entries.reduce((n, [, r]) => n + r.length, 0);
  if (
    !count ||
    count > 200 ||
    entries.some(
      ([p, rects]) =>
        !Number.isInteger(p) ||
        p < 0 ||
        p >= source.pdf.numPages ||
        rects.some((r) => !validPhoto(r)),
    )
  )
    throw new Error('Bitte 1 bis 200 gültige Ausschnitte innerhalb der Seiten markieren.');
  if (!['pdf', 'combined-pdf', 'png', 'jpeg'].includes(format) || ![150, 300].includes(dpi))
    throw new Error('Ungültiges Ausgabeformat.');
  const zip = new JSZip(),
    combined = format === 'combined-pdf' ? await PDFDocument.create() : null;
  let done = 0,
    totalBytes = 0;
  const checkSize = (bytes: number) => {
    totalBytes += bytes;
    if (totalBytes > 160 * 1024 * 1024)
      throw new Error(
        'Die Ausschnitte überschreiten 160 MB. Bitte weniger Seiten oder 150 dpi wählen.',
      );
  };
  for (const [index, rects] of entries) {
    ctx.signal.throwIfAborted();
    const page = await source.pdf.getPage(index + 1),
      viewport = page.getViewport({ scale: 1 });
    const { canvas, width } = await renderPage(
      source,
      sourcePages(source)[index],
      Math.min(4096, (Math.max(viewport.width, viewport.height) * dpi) / 72),
      ctx.signal,
    );
    try {
      for (const [part, r] of rects.entries()) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        ctx.signal.throwIfAborted();
        const cropped = cropScanPhoto(canvas, r);
        try {
          const image = await new Promise<Blob>((resolve, reject) =>
            cropped.toBlob(
              (b) =>
                b ? resolve(b) : reject(new Error('Ausschnitt konnte nicht erstellt werden.')),
              format === 'jpeg' ? 'image/jpeg' : 'image/png',
              0.92,
            ),
          );
          ctx.signal.throwIfAborted();
          let bytes = new Uint8Array(await image.arrayBuffer());
          checkSize(bytes.length);
          if (format === 'pdf' || combined) {
            const pdf = combined ?? (await PDFDocument.create()),
              embedded = await pdf.embedPng(bytes);
            const w = (cropped.width * width) / canvas.width,
              h = (cropped.height * width) / canvas.width;
            pdf.addPage([w, h]).drawImage(embedded, { x: 0, y: 0, width: w, height: h });
            if (!combined) bytes = new Uint8Array(await pdf.save());
          }
          if (!combined)
            zip.file(
              `${filenameStem(source.name)}-${String(index + 1).padStart(3, '0')}-${String(part + 1).padStart(2, '0')}.${format === 'jpeg' ? 'jpg' : format}`,
              bytes,
            );
        } finally {
          cropped.width = cropped.height = 0;
        }
        ctx.report({
          percent: (++done / count) * 95,
          label: `Ausschnitt ${done} von ${count} erstellen …`,
        });
      }
    } finally {
      canvas.width = canvas.height = 0;
    }
  }
  const bytes = combined
    ? await combined.save()
    : await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }, () =>
        ctx.signal.throwIfAborted(),
      );
  ctx.signal.throwIfAborted();
  if (bytes.length > 160 * 1024 * 1024)
    throw new Error(
      'Die Ausschnitte überschreiten 160 MB. Bitte weniger Seiten oder 150 dpi wählen.',
    );
  return {
    blob: new Blob([new Uint8Array(bytes)], {
      type: combined ? 'application/pdf' : 'application/zip',
    }),
    filename: filenameStem(source.name) + (combined ? '-Fotos.pdf' : '-Fotos.zip'),
    kind: combined ? 'pdf' : 'zip',
    pages: count,
    note: (ctx.translate ?? ((text) => text))(
      'Nur markierte Fotos werden ausgegeben, in Seiten- und Rahmenreihenfolge. Die Ausgabe enthält Bildkopien ohne ursprüngliche Textebene, Links, Formulare oder Signaturen. Die Originaldatei bleibt unverändert.',
    ),
  };
}
