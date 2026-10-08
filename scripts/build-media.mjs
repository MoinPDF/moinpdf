import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';

const root = new URL('../', import.meta.url);
const {version} = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const catalogue = JSON.parse(await readFile(new URL('media/banner-catalog.json', root), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatSize = bytes => bytes >= 1000000 ? `${(bytes / 1000000).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1000)} kB`;
const zip = new JSZip();
const zipOptions = {date:new Date('2026-10-08T00:00:00Z'),createFolders:false};
const add = (name, data) => zip.file(`MoinPDF-Medienpaket/${name}`, data, zipOptions);
if (catalogue.length !== 6 || new Set(catalogue.map(b => b.file)).size !== 6) throw new Error('Expected six distinct original banners.');
const banners = [];
for (const banner of catalogue) {
  if (!/^moinpdf-[a-z-]+\.jpg$/.test(banner.file) || !banner.title || !banner.alt) throw new Error('Invalid banner metadata.');
  const bytes = await readFile(new URL(`public/media/banners/${banner.file}`, root));
  if (bytes.subarray(0,3).toString('hex') !== 'ffd8ff') throw new Error(`Invalid JPEG: ${banner.file}`);
  if (createHash('sha256').update(bytes).digest('hex') !== banner.sha256) throw new Error(`Original banner changed: ${banner.file}`);
  const {width,height} = banner;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error(`Missing image dimensions: ${banner.file}`);
  banners.push({...banner,width,height,size:formatSize(bytes.length)});
  add(`Banner/${banner.file}`,bytes);
}
const short = 'MoinPDF ist ein deutschsprachiger PDF-Arbeitsplatz mit 100 Werkzeugen zum Bearbeiten, Prüfen und Umwandeln von Dokumenten. Papierkram. Läuft.';
const description = 'MoinPDF bündelt 100 Werkzeuge für die tägliche Arbeit mit PDFs und anderen Dokumenten. Dazu gehören Zusammenführen, Teilen, Texterkennung, Seitenbearbeitung, Formulare und verschiedene Konvertierungen. Viele Werkzeuge verarbeiten Dateien direkt im Browser. Die vollständige Docker- und platform-Installation ergänzt einen eigenen Dokumentenserver und einen lokalen Übersetzungsdienst. Eine integrierte Dokumentation erklärt die einzelnen Werkzeuge, ihre Ergebnisse und ihre Grenzen.';
const usage = `MoinPDF – Hinweise zum Medienpaket\n\nStand: 8. Oktober 2026\n\nDie bereitgestellten Banner und die Wortmarke dürfen für redaktionelle Beiträge und zur Vorstellung oder Bewerbung von MoinPDF verwendet werden, etwa in Fachzeitschriften, auf Websites, in Newslettern und sozialen Medien. Bitte MoinPDF als Quelle nennen und bei Online-Beiträgen nach Möglichkeit auf die vorgestellte MoinPDF-Instanz verlinken.\n\nMotive und Schriftzüge bitte nicht verfälschen oder verzerren. Eine proportionale Skalierung ist möglich. Eine Nutzung als eigene Marke oder für fremde Produkte ist nicht umfasst.\n\nDie sechs Banner werden in ihrer Originalgröße als JPG bereitgestellt. Es erfolgt keine künstliche Vergrößerung. 1536 Pixel Breite entsprechen bei 300 dpi ungefähr 13 cm Druckbreite. Bitte die gewünschte Druckgröße mit der Redaktion abstimmen. Die Wortmarke liegt als skalierbare SVG mit transparentem Hintergrund vor; die Schrift ist in Pfade umgewandelt.\n\nKontakt: Denny Wenke, denny@wenke.email\n\nDie Schriftlizenzen zur Wortmarke sind in Lizenzen-Wortmarke.txt enthalten.\n`;
await mkdir(new URL('public/media/',root),{recursive:true});
const text = `MoinPDF – Kurzbeschreibung\nStand: 8. Oktober 2026\n\nKURZ\n${short}\n\nAUSFÜHRLICHER\n${description}\n\nKONTAKT\nDenny Wenke\ndenny@wenke.email\n`;
await writeFile(new URL('public/media/moinpdf-kurzbeschreibung.txt',root),text);
await writeFile(new URL('public/media/moinpdf-nutzung.txt',root),usage);
const logo = await readFile(new URL('public/branding/moinpdf-logo.svg',root));
add('MoinPDF-Wortmarke.svg',logo);
add('Lizenzen-Wortmarke.txt',await readFile(new URL('public/branding/LICENSES.txt',root)));
add('Kurzbeschreibung.txt',text);
add('Nutzung.txt',usage);
const zipName = `MoinPDF-Medienpaket-${version}.zip`;
const archive = await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6},platform:'UNIX'});
await writeFile(new URL(`public/media/${zipName}`,root),archive);
const downloadIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></svg>';
const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="MoinPDF vorstellen: sechs Banner, die Wortmarke und Kurztexte für Presse, Fachzeitschriften, Websites und Newsletter. Originaldateien einzeln oder im Medienpaket herunterladen.">
  <meta name="theme-color" content="#176c64"><title>Medienbereich · MoinPDF</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/docs/documentation.css?v=${escape(version)}">
  <link rel="stylesheet" href="/media/media.css?v=${escape(version)}">
</head>
<body class="media-page">
  <a class="docs-skip" href="#inhalt">Zum Inhalt</a>
  <header class="docs-header"><a class="docs-brand" href="/" aria-label="MoinPDF Startseite"><img src="/branding/moinpdf-logo.svg" alt="MoinPDF. Papierkram. Läuft." width="680" height="225"></a><a class="docs-back" href="/"><span aria-hidden="true">←</span> Zur App</a></header>
  <main class="media-main" id="inhalt">
    <section class="media-hero" aria-labelledby="media-title">
      <div><p class="docs-eyebrow">Für Presse, Redaktion &amp; alle, die MoinPDF teilen</p><h1 id="media-title">Medienbereich</h1><p class="docs-lead">MoinPDF vorstellen? Hier findest du Banner, die Wortmarke und Kurztexte für deinen Beitrag. Einzeln herunterladen oder alles zusammen mitnehmen.</p><div class="media-actions"><a class="docs-primary" href="/media/${escape(zipName)}" download>${downloadIcon} Medienpaket herunterladen</a><span class="media-file-meta">ZIP · ${formatSize(archive.length)}</span></div><p class="media-package-detail">6 Originalbanner, SVG-Wortmarke, Kurzbeschreibung und Nutzungshinweise.</p></div>
      <aside class="media-hero-note"><span class="media-note-number">Moin.</span><p>Gute Werkzeuge.<br>Ein bisschen Küste.<br>Weniger Papierkram.</p><a href="#banner">Zu den Motiven <span aria-hidden="true">↓</span></a></aside>
    </section>
    <nav class="media-section-nav" aria-label="Im Medienbereich"><a href="#banner">Banner <span>06</span></a><a href="#wortmarke">Wortmarke</a><a href="#kurzbeschreibung">Kurzbeschreibung</a><a href="#nutzung">Nutzung &amp; Kontakt</a></nav>
    <section class="media-section" id="banner" aria-labelledby="banner-title">
      <div class="media-heading"><div><p class="docs-eyebrow">Sechs Motive. Ein MoinPDF.</p><h2 id="banner-title">Banner zum Mitnehmen</h2></div><p>JPG in Originalgröße.<br>Vorschau anklicken, um das Motiv groß zu öffnen.</p></div>
      <div class="media-gallery">${banners.map((b,i)=>`<article class="media-banner"><a class="media-preview" href="/media/banners/${escape(b.file)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(b.title)} in Originalgröße öffnen (neuer Tab)"><img src="/media/banners/${escape(b.file)}" width="${b.width}" height="${b.height}" alt="${escape(b.alt)}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async"><span class="media-preview-hint" aria-hidden="true">Original ansehen ↗</span></a><div class="media-banner-body"><div class="media-banner-title"><span class="media-index">${String(i+1).padStart(2,'0')}</span><div><h3>${escape(b.title)}</h3><p>${escape(b.caption)}</p></div></div><div class="media-banner-bottom"><span class="media-file-meta">JPG · ${b.width} × ${b.height} px · ${b.size}</span><a class="media-download" href="/media/banners/${escape(b.file)}" download aria-label="${escape(b.title)} als JPG herunterladen">${downloadIcon} JPG laden</a></div></div></article>`).join('\n')}
      </div>
      <p class="media-print-note"><strong>Für Print:</strong> Alle Banner sind 1536 Pixel breit. Das entspricht bei 300 dpi etwa 13 cm Druckbreite. Für größere Anzeigen oder besondere Formate sprich uns bitte an.</p>
    </section>
    <section class="media-section media-brand-section" id="wortmarke" aria-labelledby="logo-title"><div><p class="docs-eyebrow">Die Wortmarke der App</p><h2 id="logo-title">MoinPDF. Papierkram. Läuft.</h2><p>Als skalierbare Vektordatei mit transparentem Hintergrund. Die Schrift ist in Pfade umgewandelt – du brauchst keine zusätzlichen Schriftarten.</p><a class="media-download" href="/branding/moinpdf-logo.svg" download="MoinPDF-Wortmarke.svg">${downloadIcon} Wortmarke als SVG laden</a><span class="media-file-meta media-logo-size">${formatSize(logo.length)}</span></div><div class="media-logo-preview"><img src="/branding/moinpdf-logo.svg" width="680" height="225" alt="MoinPDF-Wortmarke mit dem Zusatz Papierkram. Läuft." loading="lazy"></div></section>
    <section class="media-section" id="kurzbeschreibung" aria-labelledby="text-title"><div class="media-heading"><div><p class="docs-eyebrow">Für deinen Beitrag</p><h2 id="text-title">MoinPDF in wenigen Worten</h2></div><a class="media-download" href="/media/moinpdf-kurzbeschreibung.txt" download>${downloadIcon} Texte herunterladen</a></div><div class="media-copy"><div><h3>Kurz &amp; knapp</h3><p>${escape(short)}</p></div><div><h3>Etwas ausführlicher</h3><p>${escape(description)}</p></div></div><p class="media-text-note">Mehr zur Verwendung und zu den einzelnen Werkzeugen findest du in der <a href="/dokumentation.html">Dokumentation</a>.</p></section>
    <section class="media-section media-usage" id="nutzung" aria-labelledby="usage-title"><div><p class="docs-eyebrow">Gut zu wissen</p><h2 id="usage-title">Verwenden &amp; weitergeben</h2><p>Du darfst die Materialien für redaktionelle Beiträge und zur Vorstellung oder Bewerbung von MoinPDF verwenden – in Fachzeitschriften, auf Websites, in Newslettern und sozialen Medien.</p><p>Bitte nenne MoinPDF als Quelle und verlinke bei Online-Beiträgen nach Möglichkeit auf die vorgestellte MoinPDF-Instanz. Motive und Schriftzüge bitte unverfälscht und ohne Verzerrung verwenden. Die Nutzung als eigene Marke oder für fremde Produkte ist nicht umfasst.</p><a href="/media/moinpdf-nutzung.txt" download>Nutzungshinweise herunterladen</a></div><aside class="media-contact"><p class="docs-eyebrow">Presse &amp; Kontakt</p><h3>Du hast etwas vor?</h3><p>Für Rückfragen, besondere Formate oder einen Beitrag über MoinPDF:</p><a href="mailto:denny@wenke.email">denny@wenke.email <span aria-hidden="true">↗</span></a><span>Denny Wenke</span></aside></section>
  </main>
  <footer class="docs-footer"><nav aria-label="Informationen zu MoinPDF"><a href="/dokumentation.html">Dokumentation</a><a href="/medienbereich.html" aria-current="page">Medienbereich</a><a href="/impressum.html">Impressum</a><a href="/datenschutz.html">Datenschutzerklärung</a></nav><div class="docs-footer-brand"><img src="/branding/moinpdf-sailor.webp" width="16" height="16" alt=""><span>MoinPDF v${escape(version)}</span></div></footer>
</body>
</html>
`;
await writeFile(new URL('public/medienbereich.html',root),html);
console.log(`Media area built: ${banners.length} unchanged original banners and ${formatSize(archive.length)} media package (v${version}).`);
