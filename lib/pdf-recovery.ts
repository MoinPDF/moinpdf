import { openSource, pdfBlob, MAX_BYTES, MAX_PAGES, filenameStem, type Source } from './pdf-engine';
import { rewritePdf, optimizePdf, PdfPasswordError } from './pdf-security';
import { PDFDocument } from 'pdf-lib';
import type { ExportFile, RunContext } from './advanced-types';
import { shrinkPdfImages } from './pdf-compression';

export async function repairFile(file: File, ctx: RunContext): Promise<ExportFile> {
  if (!file.size || file.size > MAX_BYTES)
    throw new Error('Bitte eine PDF mit höchstens 80 MB auswählen.');
  ctx.signal.throwIfAborted();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-'))
    throw new Error('Die Datei enthält keinen erkennbaren PDF-Dateikopf.');
  ctx.report({ percent: 10, label: 'PDF-Struktur wiederherstellen …' });
  let repaired: Uint8Array;
  try {
    repaired = await rewritePdf(bytes, ctx.signal);
  } catch (error) {
    ctx.signal.throwIfAborted();
    if (error instanceof PdfPasswordError) throw error;
    // Some WASM builds cannot reconstruct a missing cross-reference table.
    // Independently parse the original objects, then normalize that recovered tree.
    try {
      const recovered = await PDFDocument.load(bytes, {
        throwOnInvalidObject: true,
        updateMetadata: false,
      });
      if (!recovered.getPageCount() || recovered.getPageCount() > MAX_PAGES) throw new Error();
      const rebuilt = await recovered.save({ useObjectStreams: true });
      repaired = await rewritePdf(rebuilt, ctx.signal);
    } catch {
      ctx.signal.throwIfAborted();
      throw error;
    }
  }
  ctx.signal.throwIfAborted();
  const checked = await openSource(
    new File([new Uint8Array(repaired)], file.name, { type: 'application/pdf' }),
  );
  try {
    if (!checked.pdf.numPages || checked.pdf.numPages > MAX_PAGES)
      throw new Error('Die wiederhergestellte PDF muss 1 bis 200 Seiten enthalten.');
    for (let n = 1; n <= checked.pdf.numPages; n++) {
      ctx.signal.throwIfAborted();
      const page = await checked.pdf.getPage(n);
      await page.getOperatorList();
      ctx.report({
        percent: 20 + (80 * n) / checked.pdf.numPages,
        label: `Wiederhergestellte Seite ${n} prüfen …`,
      });
    }
    ctx.signal.throwIfAborted();
    return {
      blob: pdfBlob(repaired),
      filename: filenameStem(file.name) + '-wiederhergestellt.pdf',
      kind: 'pdf',
      pages: checked.pdf.numPages,
      note: `${checked.pdf.numPages} Seiten lassen sich wieder öffnen. Bitte Inhalte und Vollständigkeit visuell prüfen: fehlende Daten werden nicht rekonstruiert. Bestehende digitale Signaturen sind in der neu geschriebenen Kopie nicht mehr gültig.`,
    };
  } finally {
    await checked.pdf.loadingTask.destroy();
  }
}

export async function optimizeBrowser(
  source: Source,
  targetMB: number,
  images: boolean,
  ctx: RunContext,
): Promise<ExportFile> {
  if (!Number.isFinite(targetMB) || targetMB < 0.05 || targetMB > 80)
    throw new Error('Bitte eine Zielgröße zwischen 0,05 und 80 MB wählen.');
  const target = Math.floor(targetMB * 1024 * 1024);
  let best: Uint8Array = source.bytes;
  let resized = false;
  ctx.signal.throwIfAborted();
  if (best.length > target) {
    ctx.report({ percent: 2, label: 'Verlustfrei optimieren …' });
    const lossless = await optimizePdf(source.bytes, undefined, ctx.signal);
    if (lossless.length < best.length) best = lossless;
    const attempts = images ? ['gentle', 'balanced', 'small'] : [];
    for (const [i, quality] of attempts.entries()) {
      if (best.length <= target) break;
      ctx.signal.throwIfAborted();
      const start = 12 + i * 27;
      ctx.report({
        percent: start,
        label: `Komprimierungsstufe ${i + 1} / ${attempts.length} · Bilder vorbereiten …`,
      });
      // Each candidate starts from the original to avoid repeated JPEG losses.
      const candidate = await shrinkPdfImages(source.bytes, quality, ctx.signal, (done, total) =>
        ctx.report({
          percent: start + (22 * done) / total,
          label: `Komprimierungsstufe ${i + 1} / ${attempts.length} · Bild ${done} / ${total}`,
        }),
      );
      if (candidate.bytes.length < best.length) {
        best = candidate.bytes;
        resized = candidate.changed > 0;
      }
      if (candidate.changed) {
        ctx.report({ percent: start + 23, label: 'PDF-Struktur und Dateigröße prüfen …' });
        const optimized = await optimizePdf(candidate.bytes, undefined, ctx.signal);
        if (optimized.length < best.length) {
          best = optimized;
          resized = true;
        }
      }
    }
  }
  ctx.signal.throwIfAborted();
  ctx.report({ percent: 100, label: 'Dateigröße geprüft' });
  const changed = best !== source.bytes;
  return {
    blob: pdfBlob(best),
    filename: filenameStem(source.name) + (changed ? '-optimiert' : '-original') + '.pdf',
    kind: 'pdf',
    pages: source.pdf.numPages,
    note: [
      best.length <= target
        ? 'Zielgröße erreicht.'
        : 'Zielgröße nicht erreicht; die kleinste gefundene Datei wird ausgegeben.',
      changed
        ? `${Math.round((1 - best.length / source.bytes.length) * 100)} % kleiner. Text, Links und Formularfelder bleiben erhalten. Digitale Signaturen werden durch das Neuschreiben ungültig.`
        : 'Das Original ist bereits die kleinste Variante und bleibt unverändert.',
      resized
        ? 'Scanbilder wurden einzeln verkleinert. Bitte die Bildqualität im Ergebnis prüfen.'
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
