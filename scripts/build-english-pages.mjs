import { readFile, writeFile, mkdir } from 'node:fs/promises';
const catalog = JSON.parse(await readFile(new URL('../public/locales/en.json', import.meta.url), 'utf8'));
const root = new URL('../public/', import.meta.url);
const routes = {
  '/dokumentation.html': '/en/documentation.html',
  '/medienbereich.html': '/en/media.html',
  '/impressum.html': '/en/legal.html',
  '/datenschutz.html': '/en/privacy.html',
};
const decode = (value) => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|shy);/gi, (all, entity) => {
  if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
  if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '\u00ad' }[entity.toLowerCase()] ?? all;
});
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const unresolved = new Set();
const text = (raw) => {
  const source = decode(raw).replace(/\s+/g, ' ').trim();
  if (!source) return raw;
  let translated = catalog[source];
  if (translated === undefined) {
    if (/\p{L}/u.test(source) && !/^MoinPDF(?:\s+v[\d.]+)?$/.test(source) && !/^[\d,.× ·]+(?:MB|KB|px|s)$/.test(source)) unresolved.add(source);
    return raw;
  }
  return (raw.match(/^\s*/)?.[0] ?? '') + escape(translated) + (raw.match(/\s*$/)?.[0] ?? '');
};
await mkdir(new URL('en/', root), { recursive: true });
for (const [source, destination] of Object.entries(routes)) {
  let html = await readFile(new URL(source.slice(1), root), 'utf8');
  const scripts = [];
  html = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (raw) => { scripts.push(raw); return `<!-- preserved-${scripts.length - 1} -->`; });
  html = html.replace(/>([^<>]+)</g, (_, raw) => '>' + text(raw) + '<');
  html = html.replace(/\b(alt|title|placeholder|aria-label)="([^"]*)"/g, (_, key, value) => key + '="' + text(value) + '"');
  html = html.replace(/(<meta name="description" content=")([^"]*)/g, (_, prefix, value) => prefix + text(value));
  html = html.replace(/<html lang="de">/, '<html lang="en">');
  html = html.replace(/href="(\/[^"#?]*)([^" ]*)"/g, (all, path, suffix) => routes[path] ? `href="${routes[path]}${suffix}"` : path === '/' ? 'href="/?lang=en"' : all);
  html = html.replace(/<!-- preserved-(\d+) -->/g, (_, index) => scripts[Number(index)]);
  // Keep the wordmark as an original vector and render the translated tagline as live text.
  html = html.replace(/(<a class="(?:docs-brand|legal-brand)"[^>]*>)<img[^>]*src="\/branding\/moinpdf-logo\.svg[^>]*>/g, '$1<span class="information-wordmark"><img class="logo-light" src="/branding/moinpdf-wordmark.svg" width="680" height="170" alt="MoinPDF"><img class="logo-dark" src="/branding/moinpdf-wordmark-dark.svg" width="680" height="170" alt="MoinPDF"><span>Paperwork. Sorted.</span></span>');
  html = html.replace(/(<video\b[^>]*>)/g, '$1<track kind="subtitles" srclang="en" label="English" src="/media/videos/moinpdf-en.vtt" default>');
  await writeFile(new URL(destination.slice(1), root), html);
}
await mkdir(new URL('../.cache/i18n/', import.meta.url), { recursive: true });
await writeFile(new URL('../.cache/i18n/static-missing.json', import.meta.url), JSON.stringify([...unresolved], null, 2));
console.log(`English information pages built; ${unresolved.size} text segments to review.`);

// English media copy and a deterministic downloadable package use the same original assets.
const { default: JSZip } = await import('jszip');
const { createHash } = await import('node:crypto');
const { version } = JSON.parse(await readFile(new URL('../package.json', root), 'utf8'));
const englishShort = 'MoinPDF is a workspace for editing, checking and converting PDFs and other documents, available in German and English. Paperwork. Sorted.';
const englishDescription = 'MoinPDF brings together tools for everyday work with PDFs and other documents, including merging, splitting, text recognition, page editing, forms and format conversion. Many tools process files directly in your browser. The built-in documentation explains each tool, its results and its limitations.';
const description = `MoinPDF – Description\nUpdated: 12 October 2026\n\nSHORT\n${englishShort}\n\nDETAILED\n${englishDescription}\n\nCONTACT\nMoinPDF\nahoi@moinpdf.de\n`;
const usage = `MoinPDF – Media kit usage\n\nUpdated: 12 October 2026\n\nYou may use the supplied banners, promotional video, logo and wordmark in editorial articles and to introduce or promote MoinPDF, including in magazines, on websites, in newsletters and on social media. Please credit MoinPDF and, where possible, link to the MoinPDF instance featured in your online article.\n\nPlease do not misrepresent or distort the artwork or lettering. Proportional resizing is permitted. Use as your own brand or for unrelated products is not included.\n\nThe six original banners are supplied as JPG files at their original size, without artificial upscaling. A width of 1536 pixels corresponds to approximately 13 cm at 300 dpi. Please agree the intended print size with your editor. The original logo is a 1536 × 1536 pixel JPG on a light background. The wordmark is a scalable SVG with a transparent background and outlined lettering, so no additional fonts are required.\n\nThe promotional video “Printer overboard?” is an MP4 with sound: 15 seconds, 1280 × 720 pixels, landscape 16:9. The original video and banners retain their German artwork. English subtitles are supplied with the video and displayed in the English media area.\n\nContact: MoinPDF, ahoi@moinpdf.de\n\nFont licences are included in Wordmark-Licences.txt.\n`;
await mkdir(new URL('en/media/', root), { recursive: true });
await writeFile(new URL('en/media/moinpdf-description.txt', root), description);
await writeFile(new URL('en/media/moinpdf-usage.txt', root), usage);
const wordmark = await readFile(new URL('branding/moinpdf-logo-en.svg', root), 'utf8');
await writeFile(new URL('en/media/moinpdf-wordmark.svg', root), wordmark);
const original = await JSZip.loadAsync(await readFile(new URL(`media/MoinPDF-Medienpaket-${version}.zip`, root)));
const zip = new JSZip();
const names = {'Kurzbeschreibung.txt':'Description.txt','Nutzung.txt':'Usage.txt','MoinPDF-Wortmarke.svg':'MoinPDF-Wordmark.svg','Lizenzen-Wortmarke.txt':'Wordmark-Licences.txt'};
for (const [name, entry] of Object.entries(original.files)) {
  if (entry.dir) continue;
  const relative = name.replace('MoinPDF-Medienpaket/', '');
  const data = relative === 'Kurzbeschreibung.txt' ? description : relative === 'Nutzung.txt' ? usage : relative === 'MoinPDF-Wortmarke.svg' ? wordmark : await entry.async('nodebuffer');
  zip.file('MoinPDF-MediaKit/' + (names[relative] ?? relative.replace('Video/MoinPDF-Drucker-ueber-Bord.mp4','Video/MoinPDF-Printer-Overboard.mp4')), data, {date:new Date('2026-10-12T00:00:00Z'),createFolders:false});
}
zip.file('MoinPDF-MediaKit/Video/MoinPDF-Printer-Overboard.en.vtt', await readFile(new URL('media/videos/moinpdf-en.vtt', root)), {date:new Date('2026-10-12T00:00:00Z'),createFolders:false});
const bytes = await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6},platform:'UNIX'});
const zipName = `MoinPDF-MediaKit-${version}.zip`;
await writeFile(new URL(`en/media/${zipName}`, root), bytes);
let media = await readFile(new URL('en/media.html', root), 'utf8');
media = media.replace(/\/media\/MoinPDF-Medienpaket-[^" ]+/g, `/en/media/${zipName}?v=${createHash('sha256').update(bytes).digest('hex').slice(0,12)}`)
  .replaceAll('/media/moinpdf-kurzbeschreibung.txt', '/en/media/moinpdf-description.txt')
  .replaceAll('/media/moinpdf-nutzung.txt', '/en/media/moinpdf-usage.txt')
  .replaceAll('/branding/moinpdf-logo.svg', '/en/media/moinpdf-wordmark.svg')
  .replaceAll('MoinPDF-Wortmarke.svg', 'MoinPDF-Wordmark.svg');
await writeFile(new URL('en/media.html', root), media);
