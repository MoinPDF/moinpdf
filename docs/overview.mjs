export const chapters = [
  ['schnellstart', '01', 'Schnellstart'],
  ['arbeitsplatz', '02', 'Dein Arbeitsbereich'],
  ['werkzeuge', '03', 'Alle Werkzeuge'],
  ['ablaeufe', '04', 'Typische Arbeitsabläufe'],
  ['verarbeitung', '05', 'Dateien & Verarbeitung'],
  ['grenzen', '06', 'Formate & Grenzen'],
  ['fragen', '07', 'Fragen & Fehlerhilfe'],
];

export const introduction = `
<section class="docs-section" id="schnellstart" aria-labelledby="title-schnellstart">
  <div class="docs-section-heading"><span class="docs-section-number">01</span><div><p class="docs-eyebrow">In wenigen Schritten</p><h2 id="title-schnellstart">Dein erstes Dokument</h2></div></div>
  <p>MoinPDF öffnet deine Dokumente zunächst in einem gemeinsamen Arbeitsbereich. Du entscheidest anschließend, was damit passieren soll. Deine Dateien auf dem Gerät werden dabei nicht überschrieben.</p>
  <ol class="docs-start-steps">
    <li><span class="docs-step-number">1</span><div><h3>Dateien öffnen</h3><p>Ziehe PDFs, Rechnungs-XML, JPGs oder PNGs auf das animierte Dokument oder nutze die Dateiauswahl. Du kannst mehrere Dateien gemeinsam öffnen. Eine Office-Datei, E-Mail, HTML-Datei oder EPUB öffnet direkt den passenden Konverter.</p></div></li>
    <li><span class="docs-step-number">2</span><div><h3>Vorhaben auswählen</h3><p>Unter „Was möchtest du tun?“ beschreibst du dein Ziel, zum Beispiel „PDF kleiner machen“ oder „Text aus Scan“. Wähle einen Suchvorschlag, eine Kategorie oder direkt ein Werkzeug. „Alle Werkzeuge“ öffnet die Übersicht auch ohne Datei.</p></div></li>
    <li><span class="docs-step-number">3</span><div><h3>Prüfen, anwenden, herunterladen</h3><p>Stelle das Werkzeug ein und kontrolliere Vorschau sowie Seitenauswahl. Starte die Verarbeitung über den Aktionsknopf. Lade das Ergebnis herunter oder übernimm eine erzeugte PDF mit „Ergebnis weiterbearbeiten“ für den nächsten Schritt.</p></div></li>
  </ol>
  <aside class="docs-note"><strong>Ergebnis rechtzeitig sichern.</strong><p>Dokumente und Änderungen liegen im Speicher der aktuellen Sitzung. Ein Neuladen oder Schließen der App kann sie verwerfen. Lade wichtige Zwischenstände herunter. Die Dokumentation öffnet aus der App in einem eigenen Tab.</p></aside>
</section>
<section class="docs-section" id="arbeitsplatz" aria-labelledby="title-arbeitsplatz">
  <div class="docs-section-heading"><span class="docs-section-number">02</span><div><p class="docs-eyebrow">Orientierung</p><h2 id="title-arbeitsplatz">Dein Arbeitsbereich</h2></div></div>
  <div class="docs-two-column">
    <article class="docs-mini-card"><h3>Werkzeug wechseln</h3><p>Mit „Werkzeug wechseln“ oder „Alle Werkzeuge“ kommst du zur Auswahl zurück. Geöffnete Dateien bleiben dabei erhalten. Suche und Kategorien helfen dir, zwischen <strong>Prüfen, Umwandeln, Seiten, Bearbeiten und Stapel</strong> zu wechseln.</p></article>
    <article class="docs-mini-card"><h3>Seiten auswählen</h3><p>Viele klassische Werkzeuge verarbeiten nur ausgewählte Seiten in der aktuellen Reihenfolge. Prüfe die Angabe „… von … Seiten ausgewählt“. Abgewählte Seiten fehlen in dieser Ausgabe; die Originaldatei bleibt erhalten.</p></article>
    <article class="docs-mini-card"><h3>Vorschau und Einstellungen</h3><p>In der Seitenübersicht sortierst und drehst du Seiten. Die Dokumentansicht zeigt eine einzelne Seite zum Platzieren von Bereichen und Inhalten. Auf kleineren Bildschirmen stehen Einstellungen teilweise unter der Vorschau; die Werkzeugleiste lässt sich einklappen.</p></article>
    <article class="docs-mini-card"><h3>Vollständige Dokumente</h3><p>Formular-, Lesezeichen- und viele erweiterte Werkzeuge arbeiten mit den vollständigen Quelldateien. Wähle dort das richtige Dokument. Noch nicht angewendete Änderungen aus einem anderen Werkzeug sind nicht automatisch Teil dieser Quelle.</p></article>
  </div>
  <h3>Bearbeitungen sinnvoll verbinden</h3>
  <p>Wende einen Arbeitsschritt zuerst an. Kontrolliere die erzeugte PDF und wähle „Ergebnis weiterbearbeiten“, bevor du das nächste Werkzeug nutzt. Dadurch wird die neue PDF zum Arbeitsdokument. Die bisherige Zusammenstellung und der Rückgängig-Verlauf werden dabei ersetzt; sichere benötigte Zwischenstände vorher.</p>
  <p>Visuelle Bearbeitungen wie Schwärzungen oder Ersatztexte vor einem nachträglichen Drehen anwenden. Passwortschutz und Zertifikatssignatur gehören an das Ende der Bearbeitung.</p>
  <h3>Rückgängig und Tastatur</h3>
  <dl class="docs-shortcuts"><div><dt><kbd>Strg</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd></dt><dd>Letzte Seiten- oder Bereichsänderung zurücknehmen.</dd></div><div><dt><kbd>Strg</kbd> / <kbd>⌘</kbd> + <kbd>Umschalt</kbd> + <kbd>Z</kbd></dt><dd>Zurückgenommene Änderung wiederholen.</dd></div></dl>
  <p>Der Verlauf umfasst bis zu 30 Seiten- und Bereichsänderungen. Beim Hinzufügen oder Schließen von Dateien beginnt er neu. Nicht jede Einstellung eines eigenständigen Werkzeugs gehört zu diesem Verlauf.</p>
</section>`;

export const furtherReading = `
<section class="docs-section" id="ablaeufe" aria-labelledby="title-ablaeufe">
  <div class="docs-section-heading"><span class="docs-section-number">04</span><div><p class="docs-eyebrow">Werkzeuge kombinieren</p><h2 id="title-ablaeufe">Typische Arbeitsabläufe</h2></div></div>
  <div class="docs-recipes">
    <article><h3>Einen Scan durchsuchbar machen</h3><ol><li>Bei Bedarf mit <a href="#werkzeug-auto-orient">Seiten automatisch ausrichten</a> oder <a href="#werkzeug-scan-enhance">Scans verbessern</a> vorbereiten.</li><li>Das Ergebnis übernehmen und mit <a href="#werkzeug-ocr">OCR &amp; Text</a> erkennen.</li><li>Namen und Beträge prüfen, eine durchsuchbare PDF speichern. Für einzelne unsichere Wörter hilft die <a href="#werkzeug-ocr-review">OCR-Korrekturhilfe</a>.</li></ol></article>
    <article><h3>Eine PDF für ein Upload-Limit vorbereiten</h3><ol><li>Zuerst <a href="#werkzeug-optimize-pdf">PDF auf Wunschgröße komprimieren</a> ausprobieren.</li><li>Erreichte Größe und Lesbarkeit prüfen. Bei reinen Scans kann <a href="#werkzeug-compress">Scans komprimieren</a> stärker verkleinern.</li><li>Wenn eine Datei nicht klein genug wird, mit <a href="#werkzeug-split-size">Nach Dateigröße teilen</a> passende Teile erstellen.</li></ol></article>
    <article><h3>Vertrauliche Unterlagen weitergeben</h3><ol><li>Bereiche mit <a href="#werkzeug-redact">Schwärzen</a> markieren oder wiederkehrende Begriffe mit <a href="#werkzeug-search-redact">Suchen &amp; schwärzen</a> finden.</li><li>Treffer und Ergebnis kontrollieren. Anhänge und Metadaten bei Bedarf gezielt mit <a href="#werkzeug-pdf-sanitize">PDF-Sicherheitsbereinigung</a> entfernen.</li><li>Nur die geprüfte Ausgabedatei weitergeben. Eine <a href="#werkzeug-pseudonymize">Pseudonymisierungs-Zuordnung</a> getrennt aufbewahren.</li></ol></article>
    <article><h3>Eine E-Rechnung nachvollziehen</h3><ol><li>Mit <a href="#werkzeug-invoice-read">E-Rechnung lesen</a> strukturierte Daten ansehen.</li><li>Den <a href="#werkzeug-invoice-check">Basischeck</a> und bei XRechnungen die <a href="#werkzeug-xrechnung-validate">vollständige Validierung</a> ausführen.</li><li>Bei einer hybriden PDF zusätzlich <a href="#werkzeug-invoice-visual-check">Rechnung und XML abgleichen</a>. Technische Befunde getrennt von der sachlichen Rechnungsprüfung bewerten.</li></ol></article>
    <article><h3>Eine geordnete Dokumentenmappe erstellen</h3><ol><li>Dateien öffnen und mit <a href="#werkzeug-chronology">Dokumente chronologisch ordnen</a> Datum und Reihenfolge bestätigen.</li><li>Alternativ zuerst <a href="#werkzeug-merge">Zusammenfügen</a>, das Ergebnis übernehmen und mit <a href="#werkzeug-cover-toc">Deckblatt &amp; Inhaltsverzeichnis</a> strukturieren.</li><li>Bei Anlagenverweisen <a href="#werkzeug-attachment-links">Anlagen automatisch verknüpfen</a> nutzen und die Linkziele in der fertigen Mappe testen.</li></ol></article>
    <article><h3>Ein Dokument unterwegs anhören</h3><ol><li>Die PDF mit <a href="#werkzeug-pdf-audio">PDF als Hörbuch</a> öffnen und den Vorlesetext vorbereiten.</li><li>Lesereihenfolge und OCR prüfen; überflüssige Kopfzeilen entfernen und sinnvolle Abschnitte wählen.</li><li>Stimme und Tempo einstellen, eine Probe anhören und WAV oder Kapitel-ZIP herunterladen. Lange Texte auf mehrere Aufträge verteilen.</li></ol></article>
  </div>
</section>
<section class="docs-section" id="verarbeitung" aria-labelledby="title-verarbeitung">
  <div class="docs-section-heading"><span class="docs-section-number">05</span><div><p class="docs-eyebrow">Gut zu wissen</p><h2 id="title-verarbeitung">Wo deine Dateien verarbeitet werden</h2></div></div>
  <p>Die Kennzeichnung jeder Werkzeuganleitung zeigt, welche Verarbeitung vorgesehen ist. Die Verfügbarkeit servergestützter Funktionen hängt davon ab, welche MoinPDF-Ausgabe du verwendest.</p>
  <dl class="docs-definitions">
    <div><dt><span class="docs-badge">Browser</span></dt><dd>Diese Werkzeuge verarbeiten Dokumentinhalte auf deinem Gerät. Dazu gehören auch die lokale OCR, viele Prüfwerkzeuge und die Seitengestaltung. Beim bloßen Öffnen eines Dokuments erfolgt kein Upload an den Dokumentenserver.</dd></div>
    <div><dt><span class="docs-badge docs-badge-server">Dokumentenserver</span></dt><dd>In der vollständigen MoinPDF-Installation ist der Dienst integriert. Mit dem Aktionsknopf überträgst du die ausgewählte Eingabe an den Server dieser Installation. Die Oberfläche benötigt dafür keine manuelle Serveradresse oder einen API-Schlüssel.</dd></div>
    <div><dt><span class="docs-badge docs-badge-mixed">Browser / Server</span></dt><dd>„PDF zu Word“ und „PDF auf Wunschgröße komprimieren“ bieten in der Browser-Ausgabe einen eingeschränkteren lokalen Weg. Die vollständige Installation ergänzt Layoutkonvertierung beziehungsweise Bildverkleinerung. Die jeweilige Anleitung beschreibt den Unterschied.</dd></div>
  </dl>
  <p>Die reine Browser-Ausgabe kann Werkzeuge anzeigen, deren Verarbeitung einen verfügbaren Dokumentenserver voraussetzt. Beim Hörbuch lässt sich der Vorlesetext auch ohne Audioerzeugung als TXT speichern. Ist eine Funktion nicht verfügbar, beachte den Hinweis im Werkzeug.</p>
  <h3>Sitzung, Einstellungen und temporäre Aufträge</h3>
  <p>Dokumente und Bearbeitungen bleiben im Arbeitsspeicher der Sitzung. Gespeicherte Arbeitsabläufe enthalten nur Schritte und Einstellungen im Browser, keine Dokumente oder Passwörter. Programmdaten und Sprachpakete können im Browser zwischengespeichert werden.</p>
  <p>Der Dokumentenserver verwendet temporäre Auftragsdateien und entfernt diese nach Ende der Verarbeitung. Ein abgebrochener Abruf stoppt einen bereits gestarteten Serverprozess nicht zwingend sofort; ein Audioauftrag endet spätestens nach seinem dreiminütigen Zeitlimit. Unter „Zertifikatssignaturen“ werden zum Signieren auch Zertifikat, privater Schlüssel und Passwort übertragen.</p>
  <h3>Übersetzung und Sprachausgabe</h3>
  <p>Bei der ersten vollständigen Installation werden die Übersetzungsmodelle für die angebotenen Sprachen geladen; dafür ist Internetzugang nötig. Danach verarbeitet die Übersetzung Texte auf dem eigenen Server. Die zwei deutschen Piper-Stimmen sind installiert und erzeugen Audio dort ohne Cloud-Dienst. OCR verwendet mitgelieferte deutsche und englische Sprachdaten auf deinem Gerät.</p>
  <p>Angaben zum Betrieb dieser Website und zum Datenschutz findest du in der <a href="/datenschutz.html">Datenschutzerklärung</a>. Bei einer selbst betriebenen Installation sind außerdem die Angaben ihres Betreibers maßgeblich.</p>
</section>
<section class="docs-section" id="grenzen" aria-labelledby="title-grenzen">
  <div class="docs-section-heading"><span class="docs-section-number">06</span><div><p class="docs-eyebrow">Planbar arbeiten</p><h2 id="title-grenzen">Formate, Grenzen und Ergebnisqualität</h2></div></div>
  <div class="docs-table-wrap" tabindex="0" role="region" aria-label="Dateiformate und Eingabegrenzen"><table><thead><tr><th scope="col">Bereich</th><th scope="col">Unterstützung / Grenze</th></tr></thead><tbody>
    <tr><th scope="row">Gemeinsamer PDF-Arbeitsbereich</th><td>PDF, JPG und PNG; maximal 80 MB Quelldateien und 200 Seiten insgesamt. Rechnungs-XML öffnet den Rechnungsarbeitsplatz.</td></tr>
    <tr><th scope="row">Office-Konvertierung</th><td>DOC, DOCX, XLS, XLSX, PPT, PPTX, ODT, ODS und ODP; Dokumentenserver erforderlich.</td></tr>
    <tr><th scope="row">Weitere Eingabeformate</th><td>EML/MSG für E-Mails, HTML/HTM für gespeicherte Webseiten und ungeschützte EPUB-Dateien für E-Books.</td></tr>
    <tr><th scope="row">E-Book zu PDF</th><td>Bis 40 MB und 200 Ausgabeseiten. Keine verschlüsselten EPUB-Inhalte.</td></tr>
    <tr><th scope="row">PDF zu PowerPoint</th><td>Bis 100 Seiten; eine Seite als Bild je Folie.</td></tr>
    <tr><th scope="row">Ausrichtung / Felderkennung</th><td>Jeweils bis 50 Seiten; Felderkennung mit höchstens 500 neuen Feldern.</td></tr>
    <tr><th scope="row">Hörbuch</th><td>Bis 20.000 Zeichen und 100 Abschnitte pro Auftrag; zwei deutsche Stimmen.</td></tr>
    <tr><th scope="row">Übersetzung</th><td>Bis 60.000 Zeichen pro Auftrag; sieben angebotene Sprachen.</td></tr>
    <tr><th scope="row">Word-Serienbriefe</th><td>Bis 50 Datensätze und 50 Spalten im ersten XLSX-Tabellenblatt.</td></tr>
    <tr><th scope="row">Kamera-Scanner</th><td>Bis 50 gesammelte Seiten. Kamerazugriff benötigt einen sicheren Browserkontext und deine Freigabe.</td></tr>
  </tbody></table></div>
  <p>Einzelne Werkzeuge haben zusätzliche Grenzen und zeigen passende Fehlermeldungen. Die tatsächlich gut verarbeitbare Größe hängt auch von Gerät, freiem Arbeitsspeicher, Seitenauflösung und Dateiaufbau ab. Bei großen Scans kleinere Stapel bilden.</p>
  <div class="docs-two-column">
    <article class="docs-mini-card"><h3>Text oder Seitenbild?</h3><p>Schwärzen, manche Inhaltsänderungen, Scanfilter, Fixieren und Ebenenexport bauen Seiten ganz oder teilweise als Bilder neu auf. Das kann Suchtext, Links und Formularfunktionen entfernen. Die Werkzeuganleitung beschreibt die Folgen; bei Bedarf anschließend OCR anwenden.</p></article>
    <article class="docs-mini-card"><h3>Erkennung braucht Kontrolle</h3><p>OCR, Tabellen-, Datums-, Lücken- und Ähnlichkeitserkennung liefern Vorschläge. Kontrolliere Fundstellen im Original, besonders bei Beträgen, Namen, Fristen und vertraulichen Angaben. Ein leeres Ergebnis ist kein Vollständigkeitsnachweis.</p></article>
    <article class="docs-mini-card"><h3>Signaturen und Passwortschutz</h3><p>Änderungen an einer signierten PDF können ihre digitale Signatur ungültig machen. Ergebnisse anderer Werkzeuge sind in der Regel ungeschützt, auch wenn die Quelle ein Passwort hatte. Schutz und Signatur deshalb erst nach Abschluss aller Bearbeitungen setzen.</p></article>
    <article class="docs-mini-card"><h3>Originale aufbewahren</h3><p>Ergebnisse sind neue Dateien. Manche Seitenwerkzeuge übernehmen keine dokumentweiten Anhänge, Lesezeichen oder interaktiven Funktionen. Bewahre das Original und benötigte Zwischenstände auf, statt sie durch eine Ausgabe mit anderem Zweck zu ersetzen.</p></article>
  </div>
</section>
<section class="docs-section" id="fragen" aria-labelledby="title-fragen">
  <div class="docs-section-heading"><span class="docs-section-number">07</span><div><p class="docs-eyebrow">Wenn etwas hakt</p><h2 id="title-fragen">Fragen &amp; Fehlerhilfe</h2></div></div>
  <div class="docs-faq">
    <details><summary>Die Verarbeitungsschaltfläche ist ausgegraut. Was fehlt?</summary><div><p>Prüfe Datei- und Seitenauswahl, erforderliche Eingaben und laufende Vorschauen. Einige Werkzeuge brauchen zwei Dateien. Bei kontrollbedürftigen Ausgaben musst du erst Treffer, Datumsangaben oder Vorlesetext ausdrücklich bestätigen. Serverfunktionen benötigen außerdem einen bereiten Dokumentenserver.</p></div></details>
    <details><summary>Meine Änderungen fehlen im nächsten Werkzeug.</summary><div><p>Wende den ersten Arbeitsschritt an und wähle „Ergebnis weiterbearbeiten“. Viele eigenständige Werkzeuge lesen die vollständige Quelle und nicht die noch ungespeicherten Änderungen eines anderen Arbeitsplatzes. Achte bei mehreren Dateien auf die ausgewählte Quelle.</p></div></details>
    <details><summary>Die Suche findet im Scan keine Wörter.</summary><div><p>Ein Scan ist zunächst ein Bild. Starte die Texterkennung im Seitenfinder oder erstelle mit „OCR &amp; Text“ eine durchsuchbare PDF. Für weitere Werkzeuge das Ergebnis übernehmen. Bei verdrehten oder unscharfen Seiten zunächst Ausrichtung und Scanqualität verbessern.</p></div></details>
    <details><summary>Die komprimierte Datei ist noch zu groß.</summary><div><p>Manche PDFs sind bereits gut komprimiert. Prüfe den Hinweis zur tatsächlich erreichten Größe. Bildkomprimierung kann helfen, kostet aber Qualität. „Nach Dateigröße teilen“ ist eine Alternative; eine einzelne zu große Seite muss vorher verkleinert werden.</p></div></details>
    <details><summary>Ein Formular lässt sich nicht ausfüllen.</summary><div><p>Möglicherweise enthält es nur gedruckte Linien oder ein Seitenbild. Lege mit „Formular erstellen“ echte Felder an oder lasse Feldvorschläge erkennen. Dynamische XFA-Formulare werden nicht vollständig unterstützt. Teste die fertige Datei auch in dem PDF-Programm, das später verwendet wird.</p></div></details>
    <details><summary>Der Dokumentenserver oder die Übersetzung ist nicht bereit.</summary><div><p>In der reinen Browser-Ausgabe stehen nicht alle Serverfunktionen zur Verfügung. Wenn du MoinPDF selbst betreibst, prüfe, ob alle Dienste gestartet sind. Beim ersten Start kann das Laden der Übersetzungsmodelle mehrere Minuten dauern. Andere Browserwerkzeuge kannst du währenddessen verwenden. Versuche die betroffene Funktion danach erneut.</p></div></details>
    <details><summary>Die Verarbeitung dauert lange oder wurde abgebrochen.</summary><div><p>Große Scans, OCR und Audio benötigen Rechenzeit. Lass die App geöffnet, teile lange Dokumente in kleinere Aufträge und kontrolliere die Fortschrittsanzeige. Nach einem Verbindungsfehler kannst du mit einer kleineren Eingabe erneut starten. Über einen vorgeschalteten Tunnel können zusätzliche Zeitlimits gelten. Neuladen erst, wenn benötigte Ergebnisse gesichert sind.</p></div></details>
    <details><summary>Die Kamera öffnet sich nicht.</summary><div><p>Prüfe die Kameraberechtigung des Browsers und verwende HTTPS. Gewöhnliches HTTP über eine lokale IP-Adresse reicht für Kamerazugriff häufig nicht. Alternativ kannst du ein bereits aufgenommenes Foto auswählen und im Kamera-Scanner entzerren.</p></div></details>
    <details><summary>Nach dem Export kann ich Text nicht mehr markieren.</summary><div><p>Das verwendete Werkzeug hat wahrscheinlich Seitenbilder erzeugt. Das ist beispielsweise bei Fixieren, Schwärzen und Scanfiltern vorgesehen. Erzeuge mit OCR bei Bedarf eine neue Textebene. Nach dem Schwärzen die Ausgabe erneut kontrollieren, bevor du sie weitergibst.</p></div></details>
    <details><summary>Die PDF-Vorschau kann meine Datei nicht öffnen.</summary><div><p>Prüfe Größe, Seitenzahl und ein eventuell benötigtes Passwort. Für beschädigte Dateien öffne „PDF reparieren“ über die Werkzeugübersicht und wähle die Datei dort direkt aus. Ein Reparaturversuch kann fehlende Inhalte nicht wiederherstellen.</p></div></details>
    <details><summary>Wo finde ich die heruntergeladene Datei?</summary><div><p>MoinPDF verwendet die Downloadfunktion deines Browsers. Prüfe dessen Downloadliste oder den Downloadordner deines Geräts. ZIP-Dateien musst du zunächst entpacken. Wenn ein Ergebnis nur in der Vorschau sichtbar ist, wurde es noch nicht unbedingt gespeichert.</p></div></details>
    <details><summary>Wie melde ich ein Problem nachvollziehbar?</summary><div><p>Notiere Werkzeugname, MoinPDF-Version, Browser, Dateityp, ungefähre Größe und den genauen Fehlertext. Ein kleines künstliches Beispieldokument hilft bei der Eingrenzung. Schreib uns an <a href="mailto:ahoi@moinpdf.de">ahoi@moinpdf.de</a>. Weitere Kontaktinformationen findest du im <a href="/impressum.html">Impressum</a>. Sende keine vertraulichen Originaldateien oder Zugangsdaten mit.</p></div></details>
  </div>
</section>`;
