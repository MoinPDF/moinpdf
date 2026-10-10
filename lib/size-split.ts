import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { checkAbort, type ExportFile, type RunContext } from './advanced-types';
import { filenameStem, type Source } from './pdf-engine';

export type SizePart = { first: number; last: number; bytes: Uint8Array };
export async function splitBySize(
  bytes: Uint8Array,
  maximum: number,
  ctx: RunContext,
): Promise<SizePart[]> {
  if (!Number.isSafeInteger(maximum) || maximum < 1024)
    throw new Error('Bitte eine gültige maximale Dateigröße wählen.');
  checkAbort(ctx.signal);
  const input = await PDFDocument.load(bytes),
    count = input.getPageCount(),
    parts: SizePart[] = [];
  const measure = async (first: number, last: number) => {
    checkAbort(ctx.signal);
    const output = await PDFDocument.create();
    for (const page of await output.copyPages(
      input,
      Array.from({ length: last - first + 1 }, (_, i) => first + i),
    ))
      output.addPage(page);
    const data = await output.save();
    checkAbort(ctx.signal);
    return data;
  };
  for (let first = 0; first < count;) {
    ctx.report({
      percent: Math.round((first / count) * 90),
      label: `Dateigröße ab Seite ${first + 1} prüfen …`,
    });
    let best = await measure(first, first),
      last = first;
    if (best.length > maximum)
      throw new Error(
        `Seite ${first + 1} ist einzeln ${(best.length / 1e6).toFixed(2)} MB groß. Bitte das Limit erhöhen oder die PDF zuerst komprimieren.`,
      );
    let low = first + 1,
      high = count - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2),
        data = await measure(first, mid);
      if (data.length <= maximum) {
        last = mid;
        best = data;
        low = mid + 1;
      } else high = mid - 1;
    }
    if (parts.reduce((n, p) => n + p.bytes.length, 0) + best.length > 128 * 1024 * 1024)
      throw new Error(
        'Die Teildateien benötigen zusammen mehr als 128 MB. Bitte ein höheres Größenlimit wählen oder zuerst kleinere Seitenbereiche exportieren.',
      );
    parts.push({ first: first + 1, last: last + 1, bytes: best });
    first = last + 1;
  }
  ctx.report({ percent: 100, label: `${parts.length} passende Teildateien erstellt` });
  return parts;
}
export async function sizeSplitZip(
  source: Pick<Source, 'name'>,
  parts: SizePart[],
  ctx: RunContext,
): Promise<ExportFile> {
  checkAbort(ctx.signal);
  const zip = new JSZip(),
    stem = filenameStem(source.name);
  for (const [index, part] of parts.entries())
    zip.file(
      `${stem}-${String(index + 1).padStart(3, '0')}-Seiten-${part.first}-${part.last}.pdf`,
      part.bytes,
    );
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, () =>
    checkAbort(ctx.signal),
  );
  checkAbort(ctx.signal);
  return {
    blob,
    filename: `${stem}-geteilt.zip`,
    kind: 'zip',
    pages: parts.reduce((n, p) => n + p.last - p.first + 1, 0),
    note: `${parts.length} ${parts.length === 1 ? 'PDF' : 'PDFs'}. Jede Datei liegt innerhalb des gewählten Limits; das ZIP selbst kann größer sein.`,
  };
}
