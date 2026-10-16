export type DownloadResult = {
  blob: Blob;
  filename: string;
  kind?: string;
  pages?: number;
  inputSize?: number;
};

// Omitting or repeating pages changes the document itself and must not be
// advertised as a compression saving against the full original file.
export function completePdfSelection(
  sources: { id: string; kind: string; pdf: { numPages: number } }[],
  pages: { sourceId: string; index: number }[],
) {
  return (
    pages.length > 0 &&
    [...new Set(pages.map((page) => page.sourceId))].every((id) => {
      const source = sources.find((item) => item.id === id);
      const selected = pages.filter((page) => page.sourceId === id);
      return (
        source?.kind === 'pdf' &&
        selected.length === source.pdf.numPages &&
        new Set(selected.map((page) => page.index)).size === source.pdf.numPages &&
        selected.every(
          (page) =>
            Number.isInteger(page.index) && page.index >= 0 && page.index < source.pdf.numPages,
        )
      );
    })
  );
}

export function filenameParts(filename: string) {
  const match = /^(.*?)(\.[a-z0-9]{1,12})$/i.exec(filename);
  return match ? { stem: match[1], extension: match[2] } : { stem: filename, extension: '' };
}

// The extension belongs to the generated format; editing a name never converts it.
export function renameDownload(draft: string, original: string) {
  const { extension } = filenameParts(original);
  let stem = draft
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*\u202a-\u202e\u2066-\u2069]/g, '-')
    .trim();
  if (extension && stem.toLowerCase().endsWith(extension.toLowerCase()))
    stem = stem.slice(0, -extension.length);
  stem = stem
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, 160)
    .trim();
  if (!stem) return original;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = '_' + stem;
  return stem + extension;
}

export function resultSummary(result: DownloadResult, language: 'de' | 'en', compareSize = false) {
  const locale = language === 'en' ? 'en-GB' : 'de-DE';
  const number = (value: number, digits = 1) =>
    value.toLocaleString(locale, { maximumFractionDigits: digits });
  const size = (bytes: number) =>
    bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${number(bytes / 1024)} KB`
        : `${number(bytes / 1024 / 1024)} MB`;
  const extension = filenameParts(result.filename).extension.slice(1).toUpperCase();
  const parts = [
    extension || (result.kind === 'pdf' ? 'PDF' : language === 'en' ? 'File' : 'Datei'),
  ];
  if (result.kind === 'pdf' && Number.isInteger(result.pages) && result.pages! > 0)
    parts.push(
      `${number(result.pages!, 0)} ${language === 'en' ? (result.pages === 1 ? 'page' : 'pages') : result.pages === 1 ? 'Seite' : 'Seiten'}`,
    );
  if (compareSize && result.inputSize && result.inputSize > 0) {
    parts.push(`${size(result.inputSize)} → ${size(result.blob.size)}`);
    const reduction = (1 - result.blob.size / result.inputSize) * 100;
    if (reduction > 0) {
      const value =
        reduction < 0.1
          ? '< 0,1'.replace(',', language === 'en' ? '.' : ',')
          : number(Math.min(99.9, reduction));
      parts.push(`${value} % ${language === 'en' ? 'smaller' : 'kleiner'}`);
    } else parts.push(language === 'en' ? 'No size reduction' : 'Keine Verkleinerung');
  } else parts.push(size(result.blob.size));
  return parts.join(' · ');
}

const mimeTypes: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};
export function resultShareFile(result: DownloadResult, filename = result.filename) {
  return new File([result.blob], filename, {
    type:
      result.blob.type ||
      mimeTypes[filenameParts(filename).extension.slice(1).toLowerCase()] ||
      'application/octet-stream',
  });
}
export function canShareResult(file: File, nav: Pick<Navigator, 'share' | 'canShare'> | undefined) {
  try {
    return (
      !!nav &&
      typeof nav.share === 'function' &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}
