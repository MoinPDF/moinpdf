import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';

const root = new URL('../', import.meta.url);
const {version} = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const catalogue = JSON.parse(await readFile(new URL('media/banner-catalog.json', root), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatSize = bytes => bytes >= 1000000 ? `${(bytes / 1000000).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1000)} kB`;
const zip = new JSZip();
const zipOptions = {date:new Date('2026-10-10T00:00:00Z'),createFolders:false};
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
const videoFile = 'moinpdf-drucker-ueber-bord.mp4';
const videoPoster = 'moinpdf-drucker-ueber-bord.jpg';
const video = await readFile(new URL(`public/media/videos/${videoFile}`,root));
if (video.subarray(4,8).toString() !== 'ftyp') throw new Error('Invalid MoinPDF promotional video.');
await readFile(new URL(`public/media/videos/${videoPoster}`,root));
add('Video/MoinPDF-Drucker-ueber-Bord.mp4',video);
const short = 'MoinPDF ist ein deutschsprachiger PDF-Arbeitsplatz zum Bearbeiten, Prüfen und Umwandeln von Dokumenten. Papierkram. Läuft.';
const description = 'MoinPDF bündelt vielseitige Werkzeuge für die tägliche Arbeit mit PDFs und anderen Dokumenten. Dazu gehören Zusammenführen, Teilen, Texterkennung, Seitenbearbeitung, Formulare und verschiedene Konvertierungen. Viele Werkzeuge verarbeiten Dateien direkt im Browser. Eine integrierte Dokumentation erklärt die einzelnen Werkzeuge, ihre Ergebnisse und ihre Grenzen.';
const usage = `MoinPDF – Hinweise zum Medienpaket\n\nStand: 10. Oktober 2026\n\nDie bereitgestellten Banner, der Werbeclip, das Logo und die Wortmarke dürfen für redaktionelle Beiträge und zur Vorstellung oder Bewerbung von MoinPDF verwendet werden, etwa in Fachzeitschriften, auf Websites, in Newslettern und sozialen Medien. Bitte MoinPDF als Quelle nennen und bei Online-Beiträgen nach Möglichkeit auf die vorgestellte MoinPDF-Instanz verlinken.\n\nMotive und Schriftzüge bitte nicht verfälschen oder verzerren. Eine proportionale Skalierung ist möglich. Eine Nutzung als eigene Marke oder für fremde Produkte ist nicht umfasst.\n\nDie sechs Banner werden in ihrer Originalgröße als JPG bereitgestellt. Es erfolgt keine künstliche Vergrößerung. 1536 Pixel Breite entsprechen bei 300 dpi ungefähr 13 cm Druckbreite. Bitte die gewünschte Druckgröße mit der Redaktion abstimmen. Das Logo liegt als JPG in der Originalgröße 1536 × 1536 Pixel mit hellem Hintergrund vor. Die Wortmarke liegt als skalierbare SVG mit transparentem Hintergrund vor; die Schrift ist in Pfade umgewandelt.\n\nDer Werbeclip „Drucker über Bord?“ liegt als MP4 mit Ton vor: 15 Sekunden, 1280 × 720 Pixel, Querformat 16:9. Er ist im Ordner Video enthalten und kann auch einzeln im Medienbereich heruntergeladen werden.\n\nKontakt: MoinPDF, ahoi@moinpdf.de\n\nDie Schriftlizenzen zur Wortmarke sind in Lizenzen-Wortmarke.txt enthalten.\n`;
await mkdir(new URL('public/media/',root),{recursive:true});
const text = `MoinPDF – Kurzbeschreibung\nStand: 10. Oktober 2026\n\nKURZ\n${short}\n\nAUSFÜHRLICHER\n${description}\n\nKONTAKT\nMoinPDF\nahoi@moinpdf.de\n`;
await writeFile(new URL('public/media/moinpdf-kurzbeschreibung.txt',root),text);
await writeFile(new URL('public/media/moinpdf-nutzung.txt',root),usage);
const logo = await readFile(new URL('public/branding/moinpdf-logo.svg',root));
const brandIcon = await readFile(new URL('public/media/moinpdf-logo.jpg',root));
if (createHash('sha256').update(brandIcon).digest('hex') !== 'f61ac50f27b5d857d6094db51bf669d8d96925c17dfbe925fb54bd1ea4522d3a') throw new Error('Original MoinPDF logo changed.');
add('MoinPDF-Logo.jpg',brandIcon);
add('MoinPDF-Wortmarke.svg',logo);
add('Lizenzen-Wortmarke.txt',await readFile(new URL('public/branding/LICENSES.txt',root)));
add('Kurzbeschreibung.txt',text);
add('Nutzung.txt',usage);
const zipName = `MoinPDF-Medienpaket-${version}.zip`;
const archive = await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6},platform:'UNIX'});
await writeFile(new URL(`public/media/${zipName}`,root),archive);
const archiveRevision = createHash('sha256').update(archive).digest('hex').slice(0,12);
const styleRevision = createHash('sha256').update(await readFile(new URL('public/media/media.css',root))).digest('hex').slice(0,12);
const downloadIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></svg>';
const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="MoinPDF vorstellen: Werbeclip, Banner, Logo, Wortmarke und Kurztexte für deinen Beitrag. Video direkt ansehen und Originaldateien einzeln oder im Medienpaket herunterladen.">
  <meta name="theme-color" content="#176c64"><title>Medienbereich · MoinPDF</title>
  <link rel="icon" href="/favicon.png?v=43c33290ac2f" type="image/png" sizes="256x256">
  <link rel="shortcut icon" href="/favicon.ico?v=43c33290ac2f">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=43c33290ac2f" sizes="180x180">
  <link rel="stylesheet" href="/docs/documentation.css?v=${escape(version)}">
  <link rel="stylesheet" href="/media/media.css?v=${escape(version)}-${styleRevision}">
<script src="/appearance-init.js"></script><link rel="stylesheet" href="/appearance.css">
</head>
<body class="media-page">
  <a class="docs-skip" href="#inhalt">Zum Inhalt</a>
  <header class="docs-header"><a class="docs-brand" href="/" aria-label="MoinPDF Startseite"><img src="/branding/moinpdf-logo.svg" alt="MoinPDF. Papierkram. Läuft." width="680" height="225"></a><a class="docs-back" href="/"><span aria-hidden="true">←</span> Zur App</a></header>
  <main class="media-main" id="inhalt">
    <section class="media-hero" aria-labelledby="media-title">
      <div><p class="docs-eyebrow">Für alle, die MoinPDF teilen</p><h1 id="media-title">Medienbereich</h1><p class="docs-lead">MoinPDF vorstellen? Hier findest du unseren Werbeclip, Banner, das Logo, die Wortmarke und Kurztexte für deinen Beitrag. Einzeln herunterladen oder alles zusammen mitnehmen.</p><div class="media-actions"><a class="docs-primary" href="/media/${escape(zipName)}?v=${archiveRevision}" download>${downloadIcon} Medienpaket herunterladen</a><span class="media-file-meta">ZIP · ${formatSize(archive.length)}</span></div><p class="media-package-detail">Werbeclip, 6 Originalbanner, Logo, SVG-Wortmarke, Kurzbeschreibung und Nutzungshinweise.</p></div>
    </section>
    <nav class="media-section-nav" aria-label="Im Medienbereich"><a href="#werbeclip">Werbeclip <span>15 s</span></a><a href="#banner">Banner <span>06</span></a><a href="#logo">Logo &amp; Wortmarke</a><a href="#kurzbeschreibung">Kurzbeschreibung</a><a href="#nutzung">Nutzung &amp; Kontakt</a></nav>
    <section class="media-section" id="werbeclip" aria-labelledby="video-title">
      <div class="media-heading"><div><p class="docs-eyebrow">Papierkram. In Bewegung.</p><h2 id="video-title">Drucker über Bord?</h2></div><p>Unser Werbeclip zum Anschauen und Teilen.</p></div>
      <div class="media-video">
        <video controls playsinline preload="none" width="1280" height="720" poster="/media/videos/${videoPoster}" aria-label="MoinPDF-Werbeclip: Drucker über Bord?" aria-describedby="video-description"><source src="/media/videos/${videoFile}" type="video/mp4">Dein Browser kann dieses Video nicht abspielen. <a href="/media/videos/${videoFile}" download="MoinPDF-Drucker-ueber-Bord.mp4">Werbeclip als MP4 herunterladen</a>.</video>
        <div class="media-video-details"><div><p id="video-description">Der Drucker macht jetzt Meer. Den Papierkram macht MoinPDF.</p><p class="media-file-meta">MP4 mit Ton · 15 Sekunden · 1280 × 720 px · 16:9 · ${formatSize(video.length)}</p></div><a class="media-download" href="/media/videos/${videoFile}" download="MoinPDF-Drucker-ueber-Bord.mp4">${downloadIcon} Video herunterladen</a></div>
      </div>
    </section>
    <section class="media-section" id="banner" aria-labelledby="banner-title">
      <div class="media-heading"><div><p class="docs-eyebrow">Papierkram. In Szene gesetzt.</p><h2 id="banner-title">Banner zum Mitnehmen</h2></div><p>JPG in Originalgröße.<br>Vorschau anklicken, um das Motiv groß zu öffnen.</p></div>
      <div class="media-gallery">${banners.map((b,i)=>`<article class="media-banner"><a class="media-preview" href="/media/banners/${escape(b.file)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(b.title)} in Originalgröße öffnen (neuer Tab)"><img src="/media/banners/${escape(b.file)}" width="${b.width}" height="${b.height}" alt="${escape(b.alt)}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async"><span class="media-preview-hint" aria-hidden="true">Original ansehen ↗</span></a><div class="media-banner-body"><div class="media-banner-title"><span class="media-index">${String(i+1).padStart(2,'0')}</span><div><h3>${escape(b.title)}</h3><p>${escape(b.caption)}</p></div></div><div class="media-banner-bottom"><span class="media-file-meta">JPG · ${b.width} × ${b.height} px · ${b.size}</span><a class="media-download" href="/media/banners/${escape(b.file)}" download aria-label="${escape(b.title)} als JPG herunterladen">${downloadIcon} JPG laden</a></div></div></article>`).join('\n')}
      </div>
      <p class="media-print-note"><strong>Für Print:</strong> Alle Banner sind 1536 Pixel breit. Das entspricht bei 300 dpi etwa 13 cm Druckbreite. Für größere Anzeigen oder besondere Formate sprich uns bitte an.</p>
    </section>
    <section class="media-section media-brand-section" id="logo" aria-labelledby="logo-title"><div><p class="docs-eyebrow">Das App-Symbol</p><h2 id="logo-title">Das MoinPDF-Logo</h2><p>Unser Logo als Originaldatei mit hellem Hintergrund. Für deinen Beitrag, ein App-Verzeichnis oder die Vorstellung von MoinPDF.</p><a class="media-download" href="/media/moinpdf-logo.jpg" download="MoinPDF-Logo.jpg">${downloadIcon} Logo als JPG laden</a><p class="media-file-meta">JPG · 1536 × 1536 px · ${formatSize(brandIcon.length)}</p></div><a class="media-icon-preview" href="/media/moinpdf-logo.jpg" target="_blank" rel="noopener noreferrer" aria-label="MoinPDF-Logo in Originalgröße öffnen (neuer Tab)"><img src="/media/moinpdf-logo.jpg" width="1536" height="1536" alt="MoinPDF-Logo: türkisgrünes Dokument mit grüner Falte und weißem geschwungenem M auf hellem Hintergrund." loading="lazy" decoding="async"></a></section>
    <section class="media-section media-brand-section" id="wortmarke" aria-labelledby="wordmark-title"><div><p class="docs-eyebrow">Die Wortmarke der App</p><h2 id="wordmark-title">MoinPDF. Papierkram. Läuft.</h2><p>Als skalierbare Vektordatei mit transparentem Hintergrund. Die Schrift ist in Pfade umgewandelt – du brauchst keine zusätzlichen Schriftarten.</p><a class="media-download" href="/branding/moinpdf-logo.svg" download="MoinPDF-Wortmarke.svg">${downloadIcon} Wortmarke als SVG laden</a><span class="media-file-meta media-logo-size">${formatSize(logo.length)}</span></div><div class="media-logo-preview"><img src="/branding/moinpdf-logo.svg" width="680" height="225" alt="MoinPDF-Wortmarke mit dem Zusatz Papierkram. Läuft." loading="lazy"></div></section>
    <section class="media-section" id="kurzbeschreibung" aria-labelledby="text-title"><div class="media-heading"><div><p class="docs-eyebrow">Für deinen Beitrag</p><h2 id="text-title">MoinPDF in wenigen Worten</h2></div><a class="media-download" href="/media/moinpdf-kurzbeschreibung.txt" download>${downloadIcon} Texte herunterladen</a></div><div class="media-copy"><div><h3>Kurz &amp; knapp</h3><p>${escape(short)}</p></div><div><h3>Etwas ausführlicher</h3><p>${escape(description)}</p></div></div><p class="media-text-note">Mehr zur Verwendung und zu den einzelnen Werkzeugen findest du in der <a href="/dokumentation.html">Dokumentation</a>.</p></section>
    <section class="media-section media-usage" id="nutzung" aria-labelledby="usage-title"><div><p class="docs-eyebrow">Gut zu wissen</p><h2 id="usage-title">Verwenden &amp; weitergeben</h2><p>Du darfst die Materialien für redaktionelle Beiträge und zur Vorstellung oder Bewerbung von MoinPDF verwenden – in Fachzeitschriften, auf Websites, in Newslettern und sozialen Medien.</p><p>Bitte nenne MoinPDF als Quelle und verlinke bei Online-Beiträgen nach Möglichkeit auf die vorgestellte MoinPDF-Instanz. Motive und Schriftzüge bitte unverfälscht und ohne Verzerrung verwenden. Die Nutzung als eigene Marke oder für fremde Produkte ist nicht umfasst.</p><a href="/media/moinpdf-nutzung.txt" download>Nutzungshinweise herunterladen</a></div><aside class="media-contact"><p class="docs-eyebrow">Presse &amp; Kontakt</p><h3>Du hast etwas vor?</h3><p>Für Rückfragen, besondere Formate oder einen Beitrag über MoinPDF:</p><a href="mailto:ahoi@moinpdf.de">ahoi@moinpdf.de <span aria-hidden="true">↗</span></a></aside></section>
  </main>
  <footer class="docs-footer"><nav aria-label="Informationen zu MoinPDF"><a href="/dokumentation.html">Dokumentation</a><a href="/medienbereich.html" aria-current="page">Medienbereich</a><a href="/impressum.html">Impressum</a><a href="/datenschutz.html">Datenschutzerklärung</a></nav><div class="docs-footer-brand"><img src="/branding/moinpdf-sailor.webp" width="16" height="16" alt=""><span>MoinPDF v${escape(version)}</span></div></footer>
</body>
</html>
`;
await writeFile(new URL('public/medienbereich.html',root),html);
console.log(`Media area built: 15-second video, ${banners.length} unchanged original banners and ${formatSize(archive.length)} media package (v${version}).`);
