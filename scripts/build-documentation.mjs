import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {tools, groups} from '../lib/tool-catalog.ts';
import {serverToolIds} from '../lib/advanced-types.ts';
import {guides} from '../docs/tool-guides.mjs';
import {chapters, introduction, furtherReading} from '../docs/overview.mjs';

const root = new URL('../', import.meta.url);
const {version} = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groupIds = ['pruefen', 'umwandeln', 'seiten', 'bearbeiten', 'stapel'];
const filterNames = ['Prüfen', 'Umwandeln', 'Seiten', 'Bearbeiten', 'Stapel'];
const descriptions = [
  'Informationen finden, Dokumente vergleichen und Auffälligkeiten am Original nachvollziehen.',
  'Text erkennen, Formate umwandeln und Dokumente für Lesen, Hören oder Weiterbearbeiten vorbereiten.',
  'Seiten zusammenstellen, sinnvoll aufteilen und umfangreiche Unterlagen zugänglich strukturieren.',
  'Inhalte gezielt verändern, Formulare gestalten und vertrauliche Angaben kontrolliert entfernen.',
  'Mehrere Dokumente gemeinsam auswerten und wiederkehrende Schritte vorbereitet ausführen.',
];

const known = new Set(tools.map(t => t.id));
if (new Set(Object.keys(guides)).size !== tools.length || Object.keys(guides).some(id => !known.has(id))) throw new Error('Documentation and catalogue do not match.');
for (const tool of tools) {
  const guide = guides[tool.id];
  if (!guide || !guide.input || guide.steps?.length < 3 || !guide.output || !guide.note) throw new Error(`Incomplete documentation: ${tool.id}`);
}

const mode = id => ['pdf-word','optimize-pdf'].includes(id) ? ['Browser / Server','mixed'] : serverToolIds.includes(id) ? ['Dokumentenserver','server'] : ['Browser','browser'];
const toolHtml = tool => {
  const guide = guides[tool.id], [label, kind] = mode(tool.id);
  const icon = renderToStaticMarkup(createElement(tool.icon, {size:22, strokeWidth:1.6, 'aria-hidden':true}));
  return `<details class="docs-tool" id="werkzeug-${tool.id}" data-tool="${tool.id}">
    <summary><span class="docs-tool-icon">${icon}</span><span class="docs-tool-heading"><span class="docs-tool-name">${escape(tool.title)}</span><span class="docs-tool-description">${escape(tool.description)}</span></span><span class="docs-tool-meta"><span class="docs-badge docs-badge-${kind}">${label}</span><span class="docs-chevron" aria-hidden="true"></span></span></summary>
    <div class="docs-tool-body"><div class="docs-tool-input"><h4>Das brauchst du</h4><p>${escape(guide.input)}</p></div><h4>So gehst du vor</h4><ol>${guide.steps.map(s => `<li>${escape(s)}</li>`).join('')}</ol><div class="docs-output"><h4>Dein Ergebnis</h4><p>${escape(guide.output)}</p></div><div class="docs-tool-note"><h4>Darauf solltest du achten</h4><p>${escape(guide.note)}</p></div><a class="docs-permalink" href="#werkzeug-${tool.id}">Direktlink zu dieser Anleitung <span aria-hidden="true">↗</span></a></div>
  </details>`;
};

const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Das MoinPDF-Handbuch: Einstieg, Arbeitsabläufe und ausführliche Anleitungen zu allen ${tools.length} PDF-Werkzeugen. Mit Suche, Ergebnissen und wichtigen Grenzen.">
  <meta name="theme-color" content="#176c64"><title>Dokumentation · MoinPDF</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/docs/documentation.css?v=${escape(version)}">
  <script src="/docs/documentation.js?v=${escape(version)}" defer></script>
</head>
<body>
  <a class="docs-skip" href="#inhalt">Zum Inhalt</a>
  <header class="docs-header"><a class="docs-brand" href="/" aria-label="MoinPDF Startseite"><img src="/branding/moinpdf-logo.svg?v=${escape(version)}" alt="MoinPDF. Papierkram. Läuft." width="680" height="225"></a><a class="docs-back" href="/"><span aria-hidden="true">←</span> Zur App</a></header>
  <div class="docs-layout">
    <aside class="docs-sidebar"><nav class="docs-toc" aria-label="Inhaltsverzeichnis"><p class="docs-eyebrow">Das MoinPDF-Handbuch</p>${chapters.map(([id,n,title])=>`<a href="#${id}"><span>${n}</span>${title}</a>`).join('')}<div class="docs-toc-bottom"><span>Stand: 7. Oktober 2026</span><span>MoinPDF v${escape(version)}</span><button class="docs-print docs-enhanced" type="button">Drucken / PDF</button></div></nav></aside>
    <main id="inhalt">
      <section class="docs-hero" aria-labelledby="docs-title"><p class="docs-eyebrow">Nachschlagen. Ausprobieren. Weiterkommen.</p><h1 id="docs-title">Dokumentation</h1><p class="docs-lead">Vom ersten Dokument bis zum fertigen Ergebnis. Hier findest du verständliche Anleitungen für MoinPDF und alle ${tools.length} Werkzeuge – mit Arbeitsschritten, Ergebnissen und den Hinweisen, die im Alltag zählen.</p><div class="docs-hero-links"><a class="docs-primary" href="#schnellstart">Mit MoinPDF starten <span aria-hidden="true">↗</span></a><a href="#werkzeuge">Ein Werkzeug nachschlagen <span aria-hidden="true">↓</span></a></div><div class="docs-hero-meta"><span>${tools.length} Werkzeuganleitungen</span><span>Schritt für Schritt</span><span>Direkt zur passenden Hilfe</span></div></section>
      ${introduction}
      <section class="docs-section docs-catalogue" id="werkzeuge" aria-labelledby="title-werkzeuge">
        <div class="docs-section-heading"><span class="docs-section-number">03</span><div><p class="docs-eyebrow">Zum Nachschlagen</p><h2 id="title-werkzeuge">Alle ${tools.length} Werkzeuge erklärt</h2></div></div>
        <p>Klappe eine Anleitung auf. Du erfährst, welche Eingaben du brauchst, wie du vorgehst und was du als Ergebnis erhältst. Die Namen entsprechen der Werkzeugauswahl in der App.</p>
        <div class="docs-search-panel docs-enhanced"><label for="docs-search">Welches Werkzeug suchst du?</label><div class="docs-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="docs-search" type="search" autocomplete="off" placeholder="Werkzeug, Aufgabe oder Dateiformat suchen …" aria-controls="docs-tool-groups"><button id="docs-reset" type="button" hidden>Zurücksetzen</button></div><div class="docs-filters" role="group" aria-label="Werkzeugkategorien"><button type="button" data-group="all" aria-pressed="true">Alle</button>${filterNames.map((name,i)=>`<button type="button" data-group="${i}" aria-pressed="false">${name}</button>`).join('')}</div><p id="docs-search-status" role="status" aria-live="polite">${tools.length} von ${tools.length} Anleitungen</p></div>
        <noscript><p>Alle Anleitungen sind auch ohne JavaScript verfügbar. Klappe ein Werkzeug auf oder verwende die Seitensuche deines Browsers.</p></noscript>
        <p id="docs-empty" class="docs-note" hidden>Keine passende Anleitung gefunden. Versuche einen allgemeineren Begriff wie „Scan“, „Word“ oder „Formular“, oder setze die Suche zurück.</p>
        <div id="docs-tool-groups">${groups.map((name,i)=>`<section class="docs-tool-group" id="gruppe-${groupIds[i]}" data-group="${i}" aria-labelledby="group-title-${i}"><div class="docs-group-title"><h3 id="group-title-${i}">${escape(name)}</h3><span class="docs-group-count">${tools.filter(t=>t.group===i).length} Werkzeuge</span></div><p>${descriptions[i]}</p>${tools.filter(t=>t.group===i).map(toolHtml).join('\n')}</section>`).join('\n')}</div>
      </section>
      ${furtherReading}
      <a class="docs-to-top" href="#docs-title">Zurück nach oben <span aria-hidden="true">↑</span></a>
    </main>
  </div>
  <footer class="docs-footer"><nav aria-label="Informationen zu MoinPDF"><a href="/dokumentation.html" aria-current="page">Dokumentation</a><a href="/medienbereich.html">Medienbereich</a><a href="/impressum.html">Impressum</a><a href="/datenschutz.html">Datenschutzerklärung</a></nav><div class="docs-footer-brand"><img src="/branding/moinpdf-sailor.webp?v=${escape(version)}" width="16" height="16" alt=""><span>MoinPDF v${escape(version)}</span></div></footer>
</body>
</html>
`;

// Broken recipe links and duplicate anchors must never enter a published manual.
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate documentation anchor.');
for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) if (!ids.includes(id)) throw new Error(`Unknown documentation target: ${id}`);
await mkdir(new URL('public/docs/', root), {recursive:true});
await writeFile(new URL('public/dokumentation.html', root), html);
console.log(`Documentation built: ${tools.length} complete guides, ${groups.length} categories, ${chapters.length} chapters (${fileURLToPath(new URL('public/dokumentation.html',root))}).`);
