import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, degrees } from 'pdf-lib';
import { renderPage, type PageItem, type Source } from './pdf-engine';
import type { Mark } from './studio-engine';
import { editorRemovalRects, type TextTarget } from './editor-model';
import { remainingEditorTargets } from './editor-analysis';
import { readPdfText } from './pdf-text';

/** pdf-lib may trim a real trailing CR/LF byte from compressed streams when
 * their /Length is an indirect reference parsed later. Restore only the exact,
 * unambiguous source bytes; never re-encode images or guess missing data. */
export async function loadEditorPdf(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes.slice(), { updateMetadata: false });
  const endstream = [101, 110, 100, 115, 116, 114, 101, 97, 109];
  for (const [ref, stream] of document.context.enumerateIndirectObjects()) {
    if (!(stream instanceof PDFRawStream)) continue;
    const length = stream.dict.lookupMaybe(PDFName.of('Length'), PDFNumber)?.asNumber();
    const contents = stream.getContents();
    if (length === undefined || length === contents.length) continue;
    let recovered: Uint8Array | undefined;
    const missing = length - contents.length;
    if (
      stream.dict.get(PDFName.of('Length')) instanceof PDFRef &&
      contents.length >= 16 &&
      (missing === 1 || missing === 2)
    ) {
      for (let at = bytes.indexOf(contents[0]); at >= 0; at = bytes.indexOf(contents[0], at + 1)) {
        if (at + length >= bytes.length || !contents.every((value, i) => bytes[at + i] === value))
          continue;
        const suffix = bytes.subarray(at + contents.length, at + length);
        if (!suffix.every((value) => value === 10 || value === 13)) continue;
        let end = at + length;
        while (end < at + length + 8 && [9, 10, 13, 32].includes(bytes[end])) end++;
        if (!endstream.every((value, i) => bytes[end + i] === value)) continue;
        const candidate = bytes.slice(at, at + length);
        if (recovered && !candidate.every((value, i) => value === recovered![i])) {
          recovered = undefined;
          break;
        }
        recovered = candidate;
      }
    }
    if (!recovered)
      throw new Error(
        'Ein PDF-Datenstrom konnte nicht verlustfrei gelesen werden. Bitte die Datei erneut als PDF speichern.',
      );
    document.context.assign(ref, PDFRawStream.of(stream.dict, recovered));
  }
  return document;
}

/** Remove old text with PDFium, then independently verify the surviving text.
 * The caller can rebuild from visible pixels if this document is unsupported. */
export async function removeEditorContent(
  original: PDFDocument,
  item: PageItem,
  marks: Mark[],
  targets: TextTarget[],
  signal: AbortSignal,
) {
  const single = await PDFDocument.create();
  const [page] = await single.copyPages(original, [item.index]);
  page.setRotation(degrees((page.getRotation().angle + item.rotation) % 360));
  single.addPage(page);
  const removals = marks.flatMap((mark) =>
    editorRemovalRects(mark).map((rect) => ({
      page: 0,
      rect,
      color: mark.fill || '#ffffff',
      textOnly: mark.kind === 'text',
    })),
  );
  const { removeRegions } = await import('./native-pdf');
  const cleaned = await removeRegions(await single.save(), removals, signal);
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: cleaned.slice(),
    disableFontFace: true,
    standardFontDataUrl: '/vendor/pdf/standard_fonts/',
    cMapUrl: '/vendor/pdf/cmaps/',
    cMapPacked: true,
  });
  const cancel = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const proxy = await task.promise;
    const content = await readPdfText(await proxy.getPage(1));
    const actual = content.items
      .filter((p) => 'str' in p)
      .map((p) => ('str' in p ? p.str : ''))
      .join('');
    const expected = remainingEditorTargets(
      targets,
      removals.map((r) => r.rect),
    )
      .map((t) => t.text)
      .join('');
    const normalized = (text: string) => text.normalize('NFKC').replace(/\s/gu, '');
    if (normalized(actual) !== normalized(expected))
      throw new Error('Die verbleibenden Textinhalte konnten nicht vollständig bestätigt werden.');
  } finally {
    signal.removeEventListener('abort', cancel);
    await task.destroy();
  }
  return PDFDocument.load(cleaned, { updateMetadata: false });
}

/** The editor background uses the same physical removal as export. It is keyed
 * by removal rectangles, not replacement text, so typing does not rerun PDFium. */
export async function renderEditorBackground(
  source: Source,
  item: PageItem,
  marks: Mark[],
  targets: TextTarget[],
  signal: AbortSignal,
  previewSide = 1400,
) {
  const original = await loadEditorPdf(source.bytes);
  const cleaned = await removeEditorContent(original, item, marks, targets, signal);
  signal.throwIfAborted();
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: await cleaned.save(),
    standardFontDataUrl: '/vendor/pdf/standard_fonts/',
    cMapUrl: '/vendor/pdf/cmaps/',
    cMapPacked: true,
    wasmUrl: '/vendor/pdf/wasm/',
  });
  const cancel = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const pdf = await task.promise;
    signal.throwIfAborted();
    return await renderPage({ ...source, pdf }, { index: 0, rotation: 0 }, previewSide, signal);
  } finally {
    signal.removeEventListener('abort', cancel);
    await task.destroy();
  }
}
