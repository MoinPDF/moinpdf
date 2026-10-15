import JSZip from 'jszip';
import { uuid, type Source } from './pdf-engine';
import type { ExportFile, RunContext } from './advanced-types';

export type ReadingFormat = 'markdown' | 'html' | 'epub';
type TextLine = { text: string; size: number };
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '');
export const escapeMarkup = (s: string) =>
  clean(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const escapeMarkdown = (s: string) =>
  clean(s)
    .replace(/([\\`*_{}[\]()#+.!|>~-])/g, '\\$1')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const baseName = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .slice(0, 100) || 'Dokument';

async function textPages(source: Source, ctx: RunContext) {
  const pages: TextLine[][] = [];
  let characters = 0;
  for (let n = 1; n <= source.pdf.numPages; n++) {
    ctx.signal.throwIfAborted();
    const page = await source.pdf.getPage(n),
      content = await page.getTextContent();
    const lines: TextLine[] = [];
    let text = '',
      size = 0,
      lastY: number | undefined;
    const flush = () => {
      if (text.trim()) lines.push({ text: clean(text.trim()), size });
      text = '';
      size = 0;
    };
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform?.[5],
        fontSize = Math.hypot(item.transform?.[2] || 0, item.transform?.[3] || item.height || 12);
      if (
        y !== undefined &&
        lastY !== undefined &&
        Math.abs(y - lastY) > Math.max(3, fontSize * 0.45)
      )
        flush();
      text += item.str + (item.hasEOL ? '' : ' ');
      size = Math.max(size, fontSize);
      lastY = y;
      if (item.hasEOL) flush();
      characters += item.str.length;
      if (characters > 2000000)
        throw new Error('Bitte für den Textexport höchstens zwei Millionen Zeichen verwenden.');
    }
    flush();
    pages.push(lines);
    ctx.report({ percent: (n / source.pdf.numPages) * 85, label: `Text auslesen · Seite ${n}` });
  }
  if (!pages.some((page) => page.some((line) => line.text.trim())))
    throw new Error(
      'Kein auslesbarer Text gefunden. Bitte zuerst „OCR & Text“ ausführen und das Ergebnis übernehmen.',
    );
  return pages;
}

export async function exportReading(
  source: Source,
  format: ReadingFormat,
  title: string,
  language: string,
  ctx: RunContext,
): Promise<ExportFile> {
  const t = ctx.translate ?? ((text: string) => text);
  if (!['markdown', 'html', 'epub'].includes(format)) throw new Error('Unbekanntes Ausgabeformat.');
  title = clean(title.trim()).slice(0, 200) || baseName(source.name);
  if (!['de', 'en', 'fr', 'es', 'it', 'nl', 'pl'].includes(language)) language = 'de';
  const pages = await textPages(source, ctx),
    sizes = pages
      .flat()
      .filter((l) => l.text.length > 30)
      .map((l) => l.size)
      .sort((a, b) => a - b);
  const normal = sizes[Math.floor(sizes.length / 2)] || 12;
  const tag = (l: TextLine) =>
    l.text.length < 160 && l.size > normal * 1.55
      ? 'h2'
      : l.text.length < 180 && l.size > normal * 1.22
        ? 'h3'
        : 'p';
  const blank = t(
    'Auf dieser Seite wurde kein Text gefunden. Bilder und Scans werden nicht übernommen.',
  );
  const missing = pages.filter((p) => !p.length).length;
  const note = `Textausgabe mit erkannten Überschriften und Seitenabschnitten. Bilder, Tabellenlayout und Fußnotenstruktur werden nicht übernommen.${missing ? ` ${missing} Seite(n) ohne auslesbaren Text sind gekennzeichnet; bei Bedarf zuerst OCR ausführen.` : ''}`;
  let blob: Blob;
  if (format === 'markdown') {
    const chunks = pages.map(
      (lines, i) =>
        `## ${escapeMarkdown(t(`Seite ${i + 1}`))}\n\n${lines.length ? lines.map((line) => (tag(line) === 'h2' ? '### ' : tag(line) === 'h3' ? '#### ' : '') + escapeMarkdown(line.text)).join('\n\n') : blank}`,
    );
    blob = new Blob([`# ${escapeMarkdown(title)}\n\n${chunks.join('\n\n---\n\n')}\n`], {
      type: 'text/markdown;charset=utf-8',
    });
  } else {
    const body = (lines: TextLine[]) =>
      lines.length
        ? lines.map((line) => `<${tag(line)}>${escapeMarkup(line.text)}</${tag(line)}>`).join('\n')
        : `<p>${escapeMarkup(blank)}</p>`;
    const style =
      'body{font-family:system-ui,sans-serif;line-height:1.65;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#222;background:#fff}p{white-space:pre-wrap;overflow-wrap:anywhere}section{margin:3rem 0}h1,h2,h3{line-height:1.3}nav a{margin-right:1rem}';
    if (format === 'html') {
      const html = `<!doctype html>\n<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeMarkup(title)}</title><style>${style}</style></head><body><h1>${escapeMarkup(title)}</h1><nav aria-label="${escapeMarkup(t('Seiten'))}">${pages.map((_, i) => `<a href="#seite-${i + 1}">${escapeMarkup(t(`Seite ${i + 1}`))}</a>`).join(' ')}</nav>${pages.map((lines, i) => `<section id="seite-${i + 1}"><h2>${escapeMarkup(t(`Seite ${i + 1}`))}</h2>${body(lines)}</section>`).join('\n')}</body></html>`;
      blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    } else {
      const zip = new JSZip(),
        xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      // EPUB requires mimetype to be the first entry, uncompressed and without a BOM.
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
      zip.file(
        'META-INF/container.xml',
        xml +
          '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
      );
      const xhtml = (heading: string, content: string) =>
        xml +
        `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${language}" xml:lang="${language}"><head><title>${escapeMarkup(heading)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${content}</body></html>`;
      zip.file('EPUB/style.css', style);
      pages.forEach((lines, i) =>
        zip.file(
          `EPUB/page-${i + 1}.xhtml`,
          xhtml(
            `${title} · ${t(`Seite ${i + 1}`)}`,
            `<h1>${escapeMarkup(t(`Seite ${i + 1}`))}</h1>${body(lines)}`,
          ),
        ),
      );
      zip.file(
        'EPUB/nav.xhtml',
        xhtml(
          title,
          `<nav epub:type="toc" id="toc"><h1>${escapeMarkup(title)}</h1><ol>${pages.map((_, i) => `<li><a href="page-${i + 1}.xhtml">${escapeMarkup(t(`Seite ${i + 1}`))}</a></li>`).join('')}</ol></nav>`,
        ),
      );
      zip.file(
        'EPUB/package.opf',
        xml +
          `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${uuid()}</dc:identifier><dc:title>${escapeMarkup(title)}</dc:title><dc:language>${language}</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${pages.map((_, i) => `<item id="p${i + 1}" href="page-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${pages.map((_, i) => `<itemref idref="p${i + 1}"/>`).join('')}</spine></package>`,
      );
      const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }, () =>
        ctx.signal.throwIfAborted(),
      );
      blob = new Blob([new Uint8Array(bytes)], { type: 'application/epub+zip' });
    }
  }
  ctx.signal.throwIfAborted();
  ctx.report({ percent: 100, label: 'Ausgabe erstellt' });
  return {
    blob,
    filename: `${baseName(source.name)}.${format === 'markdown' ? 'md' : format}`,
    kind: 'data',
    pages: pages.length,
    note,
  };
}
