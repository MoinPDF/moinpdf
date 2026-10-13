# Änderungen

## 0.13.9 – 13. Oktober 2026

- Hafenlicht-Gestaltung mit kompakten, fein umrandeten Kacheln, grünen Auswahlmarkierungen und dezenten Lichtkanten in Hell und Dunkel.
- Kurzer Lichtimpuls beim Anklicken von Werkzeugen und Kategorien, auch per Touch und Tastatur. Werkzeugaufrufe bleiben unmittelbar; der Effekt blockiert keine Eingaben.
- Abgestimmte Smartphone-, Tablet- und Desktopansichten mit mindestens 44 Pixel hohen Kategorieflächen auf Touchgeräten.
- Reduzierte Bewegung und hoher Kontrast werden berücksichtigt; Scrollgesten räumen Lichteffekte auf.
- Browserprüfung für Maus-, Tastatur- und Touchbedienung, beide Farbmodi, alle Werkzeugaufrufe und Dokumenterhalt erweitert.

## 0.13.8 – 13. Oktober 2026

- Einheitlich umrandete Werkzeugkacheln und Symbole, auch in der Kategorie „Umwandeln“.
- Leere PDF-Arbeitsbereiche verwenden den kompakten Aufbau der Konverter: Werkzeugbeschreibung, drei Arbeitsschritte und Dateiauswahl in einer Karte. Die frühere große Begrüßung entfällt vollständig.
- Dateiauswahl, Drag-and-drop, Beispieldokument und Leerseite bleiben erreichbar; das gewählte Werkzeug bleibt erhalten.
- Fehlerhafte Zeichenfolge im OCR-Verweis der Word-Konvertierung korrigiert.
- Rechnungs-, Schutz- und Dokumentwerkzeuge ohne geladene Datei sicher auf die gemeinsame Dateiauswahl führen; alle 112 leeren Werkzeugansichten werden im Browser geprüft.

## 0.13.7 – 13. Oktober 2026

- Eckige Schnellzugriff-Kacheln mit den Originalsymbolen aus „Alle Werkzeuge“, ohne zusätzliche Dokumentillustrationen.
- Werkzeugaufrufe von der Startseite und aus der Übersicht funktionieren auch ohne bereits geöffnetes PDF.
- Die Werkzeugauswahl bleibt beim anschließenden Dateiöffnen und beim Ablegen einer PDF erhalten; mobile Aufrufe zeigen den Arbeitsbereich direkt von oben.
- Browserprüfung für sämtliche Schnellzugriffe ohne Dokument, identische Symbole und Dateiimport im gewählten Werkzeug ergänzt.

## 0.13.6 – 13. Oktober 2026

- Werkzeug-Kacheln mit feiner Umrandung, dezentem Lichtverlauf und kompakten, leicht plastischen Icons.
- Farbige Dokumentmotive für Zusammenfügen, Komprimieren und PDF zu Word sowie abgestimmte Symbole für Text, OCR und Webseiten.
- Ruhigere Schatten und kleinere Kacheln in beiden Farbmodi; Kategorien und vorhandene Klick-Effekte bleiben erhalten.

## 0.13.5 – 13. Oktober 2026

- Kategorie-Buttons wieder kompakter und mit sichtbarer Umrandung; auf Smartphones passen sie sich der Textbreite an.
- Farbige Auswahl und kurzer Lichtstreif bleiben erhalten.

## 0.13.4 – 13. Oktober 2026

- „Empfohlen“ bezeichnet die ausgewählten Werkzeuge auf der Startseite; „Alle Werkzeuge anzeigen“ führt zur vollständigen Übersicht.
- Kategorie-Buttons mit kurzem Lichtstreif beim Auswählen und sanfter Druckbewegung, abgestimmt auf den Leuchtturm. Die Einstellung für reduzierte Bewegung wird berücksichtigt.
- Auf Smartphones stehen die Kategorien in zwei gleichmäßigen Reihen mit ausreichend großen Touchflächen.

## 0.13.3 – 13. Oktober 2026

- Separaten Button „Alle Werkzeuge“ auf der Startseite entfernt; die Kategoriezeile folgt direkt auf die Suche.
- Ausgewählte Kategorien sind in Hell- und Dunkelansicht türkis hervorgehoben, standardmäßig „Alle“.

## 0.13.2 – 13. Oktober 2026

- Startseite beginnt direkt mit dem Seemannmotiv; die zusätzliche Überschrift entfällt.
- Schnellzugriff steht als eigene Abschnittsüberschrift mit Trennlinie über den Werkzeugkarten und ist deutlich vom Button „Alle Werkzeuge“ getrennt.

## 0.13.1 – 13. Oktober 2026

- Einheitliches Hafenstudio-Layout mit Seemannmotiv über dem Upload, Suche und Schnellzugriff; der Slogan erscheint nur am Logo.
- Abgestimmte helle und dunkelgraue Oberfläche für Startseite, Werkzeugauswahl, Arbeitsbereiche, Dokumentation, Medien und Rechtstexte.
- Optimierte Smartphone-, Tablet- und Desktopansichten mit erreichbarer Navigation, Touchflächen und sicheren Abständen am unteren Bildschirmrand.
- Navigation zwischen Startseite und Arbeitsbereich erhält geöffnete Dokumente. PDF-Verarbeitung, Konverter und Serverfunktionen bleiben unverändert.

## 0.13.0 – 13. Oktober 2026

- Website-Links direkt als PDF speichern: Bilder, Schriften, CSS und öffentlich ladbare JavaScript-Inhalte; A4/Letter, Hoch-/Querformat, Hintergrundfarben sowie Bildschirm- oder Druckansicht.
- Vorschau, Download und Weiterbearbeitung im bestehenden HTML-Werkzeug; gespeicherte HTML-Dateien bleiben unterstützt. Vollständige deutsche und englische Bedienung und Dokumentation.
- Separater Chromium-Web-Konverter in Docker für amd64 und arm64. Kontrollierte öffentliche Abrufe, Schutz vor privaten Netzwerkzielen und DNS-Rebinding, begrenzte Ressourcen und Beendigung abgebrochener Aufträge.
- Beim Update den vollständigen Docker-Stack aktualisieren: Der neue Dienst `website` und `/api/website/*` gehören zur Installation.

## 0.12.2 — 2026-10-12

- Kompakte Startseiten-Buttons mit Icons, hervorgehobenem „Alle Werkzeuge“ und zusätzlichem Abstand zum Footer in Light- und Darkmode.
- Lokale Office-Konvertierung räumt Dokument und Hintergrundprozesse vor dem Beenden auf, auch bei Abbruch während der Initialisierung; begrenzter harter Abbruch bleibt für blockierte Laufzeiten erhalten.
- Bereitschaft aller vorab gestarteten Office-Threads abwarten; Grafikimport, Skalierung und Formelberechnung vor der Laufzeitinitialisierung auf sequenzielle Ausführung stellen.
- Reine Office-Konvertierungen verwenden die normale LibreOfficeKit-Ereignisschleife ohne zusätzliche Editor-Poll-Callbacks.
- Docker-Veröffentlichungen prüfen den erfolgreichen Testlauf direkt über seine ID. Alle drei Images und die Release-Freigabe verwenden denselben belegten Quellstand und Testlauf.
- Regressionstests für Aufräumen, Abbrechen, erneute Konvertierung und die Freigabe unveränderlicher Images.

## 0.12.1 — 2026-10-12

- LibreTranslate auf 1.9.6, Uvicorn auf 0.54.0 und pycparser auf 3.1 aktualisiert.
- TypeScript 6.0.3 und ESLint 10.12.0 sowie die aktuellen Checkout- und Container-Anmeldeaktionen übernommen.
- Python 3.12 und die zu Node.js ab 22.13 passenden Typdefinitionen bleiben erhalten. Das separate pyHanko-Update wird wegen eines Konflikts mit dem festgelegten Zertifikatsprüfer nicht übernommen.

## 0.12.0 — 2026-10-12

- Absatzeditor mit HarfBuzz und 14 lokalen Noto-Schriften für indische und südostasiatische Schriftsysteme; passende Schriften werden bei Bedarf ergänzt.
- Konjunkte und Ligaturen bleiben bei Zeilenumbruch und Formatierung zusammen. Eine verknüpfte logische Textebene erhält Suche, Kopieren und erneutes Bearbeiten; erzeugte Absätze werden je Seite gemeinsam ausgewählt.
- Einzelne Texte, Bilder und Pfade innerhalb verschachtelter Gruppen bearbeiten, verschieben, drehen, skalieren, umordnen und löschen. Mehrfach verwendete Gruppen und Bildressourcen werden für die ausgewählte Instanz getrennt.
- Gruppen behalten Transformation, Beschnitt und Transparenz. Nicht unterstützte Grafiktypen und widersprüchliche geerbte Grafikzustände werden vor der Ausgabe abgewiesen.
- Neue unabhängige Tests für Schriftformen, Unicode-Ausgabe, Gruppeninstanzen, wiederholte Bearbeitung und reale Browserbedienung; aktualisierte deutsche und englische Anleitung.

## 0.11.0 — 2026-10-12

- Office-Dokumente lokal mit gepinntem LibreOffice/WASM konvertieren; Downloads und Cache enthalten ausschließlich Programmdaten. Eigener Dokumentenserver bleibt ausdrücklich wählbar.
- Lokale PKCS#12-Zertifikatssignaturen mit WebCrypto/PKI.js, ohne Upload von PDF, privatem Schlüssel oder Passwort; unabhängige OpenSSL-Verifikation.
- Absatzeditor mit Arabisch/Hebräisch, bidirektionalem Mischtext, acht zusätzlichen Schriften, Browser-Rechtschreibprüfung, Listen, Suchen/Ersetzen und Hoch-/Tiefstellen.
- Mehrfachauswahl mit Ausrichten, Verteilen, Spiegeln, Duplizieren und Vektorgruppen.
- Begrenzter XFA-Dateneditor mit Erhalt der Vorlagen und Rückleseprüfung; aktive und hybride Formulare werden abgewiesen.
- Ablaufvorlagen und zusätzliche Schritte zum Drehen, Umkehren, Festschreiben und verlustfreien Optimieren; lokale Komprimierung als Standard.
- Zusätzliche Engine-, Browser- und Datenschutzprüfungen sowie DE/EN-Dokumentation. Vollständiges XFA, unabhängiges PDF/X, lokale PDF/A-Prüfung und lokaler SVG-Vektorexport bleiben offen.

MoinPDF verwendet semantische Versionsnummern (`MAJOR.MINOR.PATCH`). Die zentrale
Versionsnummer steht in `package.json`; die Oberfläche liest sie daraus. Docker-
Images tragen zusätzlich den Quellcode-Commit, veröffentlichte Container einen festen Digest.

## Unveröffentlicht

- Projektdokumentation und Veröffentlichungsabläufe auf den eigenständigen Docker-Betrieb ausgerichtet.
- Plattformspezifische Installationspakete und Integrationstests in das zuständige externe Paket-Repository ausgelagert.

## 0.10.2 – 2026-10-12

- Sprach- und Leuchtturm-Schalter nochmals verkleinert: 32 Pixel am Desktop,
  30 Pixel auf schmalen Bildschirmen, mit weiterhin ausreichend großen Touch-Flächen.
- Der Leuchtturm wippt beim Umschalten kurz mit einem dezenten Lichtimpuls.
  Jeder Klick startet die Animation neu; reduzierte Bewegung wird berücksichtigt.

## 0.10.1 – 2026-10-12

- Sprach- und Leuchtturm-Schalter kleiner und dezenter gestaltet; auf Touch-Geräten
  bleibt die unsichtbare Berührungsfläche ausreichend groß.
- Englische Texte für sämtliche Werkzeugansichten, Auswahlmenüs, Dialoge,
  Hinweise, Fortschritts- und Fehlermeldungen ergänzt. Übersetzungen werden als
  lokale App-Datei geladen; Dokumentinhalte werden dafür nicht übertragen.
- Englische Dokumentation für alle 112 Werkzeuge, Medienbereich, Impressum und
  Datenschutz ergänzt. Medienpaket mit englischen Begleittexten, Wortmarke und
  Untertiteln für den unveränderten Originalclip.
- Sprachwahl bleibt nach Neuladen erhalten und synchronisiert Informationsseiten
  zwischen Tabs. Geöffnete Dokumente und Bearbeitungen bleiben beim Wechsel erhalten.
- Zusätzliche Browserprüfung kontrolliert englische Werkzeugansichten und Menüs,
  mobile Informationsseiten, Downloads und Sprachwechsel mit geöffnetem Dokument.

## 0.10.0 – 2026-10-12

- Startseite nach dem freigegebenen Konzept mit Mintverlauf, ruhiger Wortmarke,
  schwebendem Dokument und kompakten Bedienelementen gestaltet.
- Dunkelgrauer Darkmode mit gespeichertem Leuchtturm-Schalter: im hellen Modus
  leuchtet der Turm, im dunklen Modus ist er ausgeschaltet. PDF-Inhalte behalten
  ihre eigenen Farben. Auch Dokumentation, Medienbereich und Rechtstexte folgen
  der gewählten Darstellung.
- Sprachmenü mit Flaggen für Deutsch und Englisch. Startseite, Slogan,
  Werkzeugkatalog und zentrale Navigation sind übersetzt; detaillierte
  Spezialwerkzeugtexte und Dokumentationsinhalte bleiben vorerst deutsch.
- Alle 112 Werkzeugtitel, Beschreibungen und Aktionen im Katalog auf Englisch
  verfügbar; Suche unterstützt deutsche und englische Werkzeugbegriffe.
- Ruhigere Werkzeugkarten, dezente Kategorieakzente, feststehende Suchleiste,
  mobile Abstände und zurückhaltende Ergebnisanimationen. Reduzierte Bewegung
  wird berücksichtigt. Darstellungswechsel erhalten geöffnete Dokumente.

## 0.9.3 – 2026-10-11

- Beim Schließen einer Datei werden ihre Textnotizen, Bilder und Beschnittdaten
  aus dem aktuellen Arbeitsstand entfernt. Speichern und Projekt-Download
  bereinigen auch verwaiste Bearbeitungsdaten älterer Arbeitsstände; gültige
  Rückgängig-Schritte bleiben erhalten.
- Projekte ohne verbleibende Seiten lassen sich sichern und wieder öffnen.
  Der Wechsel zu anderen Projekten bleibt möglich, ohne den Rückgängig-Verlauf
  zu verlieren.
- Die Projektauswahl erhält einen eigenen Platz oberhalb des Arbeitsbereichs
  und überlagert keine mobilen Formularfelder mehr.
- Abhängigkeitsupdates aus der geprüften Zusammenführung veröffentlicht;
  OCR-Sprachzahl und PDF.js-Versionsangaben in der Dokumentation berichtigt.
- Barcode-Generatoren gezielt geladen, wirkungslose dynamische Imports entfernt
  und getrennte, überprüfte Größenbudgets für den Browser-Build eingeführt.
- Neue Regressionstests prüfen entfernte Projektinhalte, leere Seitenlisten,
  Projektwechsel und die mobile Projektauswahl.
- Die reguläre Typprüfung erfasst auch Hintergrundprozesse; Seitenwerkzeuge
  verwenden darin ausdrücklich die tatsächlich verfügbaren PDF-Daten.

## 0.9.2 – 2026-10-11

- Sicherheitsaktualisierung von Vite und transitiven Abhängigkeiten.
  Der Upload-Parser python-multipart wurde auf 0.0.32 aktualisiert; auch der
  vollständige Python-Lockfile wird vor dem Docker-Build auf bekannte Lücken geprüft. Die
  Abhängigkeitsprüfung meldet für den freigegebenen Lockfile keine bekannten
  Schwachstellen; die Docker-Prüfung kontrolliert dies vor jeder Freigabe erneut.
- Alle 37 ESLint-Warnungen behoben, einschließlich vollständiger Abhängigkeiten
  der Seitenvorschau und typisierter eingebetteter Bilddaten. Neue Warnungen
  lassen die Prüfung fehlschlagen.
- Spezialwerkzeuge werden erst beim Öffnen geladen. Der Haupt-JavaScript-Baustein
  wird dadurch deutlich kleiner; Werkzeugwechsel zeigen einen zugänglichen
  Ladezustand.
- Datenschutzhinweise für den lokalen Dokument-Assistenten, den bewusst
  geöffneten externen Modelldownload und den optionalen Modellspeicher ergänzt.
- Prüfübersicht auf 24 Engine-Suiten, 60 Servertests und 112 Werkzeuge aktualisiert;
  Ausbaugrenzen anhand aktueller Office-, XFA- und PDF/X-Prüfungen präzisiert.
- Versionen werden nach erfolgreichen Docker-Tests und veröffentlichten Images
  automatisch erstellt. Quellstand, Version, beide Architekturen und aktuelle
  Hauptversion müssen zusammenpassen; vorhandene Releases werden nicht ersetzt.

## 0.9.1 – 2026-10-11

- XFA-Erkennung erfolgt vor jedem Zugriff auf die gewöhnliche Formular-API.
  Dadurch werden XFA-Pakete nicht mehr unbemerkt entfernt.
- Formularbearbeitung, Seitenübernahme, freie Drehung, lange Seiten, Posterdruck
  und chronologische Pakete lehnen nicht unterstützte XFA-Inhalte vor der Ausgabe ab.
- Reine Lesezeichenänderungen erhalten vorhandene XFA-Pakete unverändert.
  Formularauswertungen weisen auf nicht unterstützte XFA-Felder hin.
- Regressionstests prüfen direkte und indirekte Formularwörterbücher,
  Stream- und Paketlisten sowie den Erhalt der Originaldaten. Der Browsertest
  kontrolliert die gesperrte Bearbeitung und liest den Download unabhängig zurück.

## 0.9.0 – 2026-10-11

- Unveränderliche Projektarchive mit allen fünf gespeicherten Ständen,
  deduplizierten Originaldateien und Integritätsprüfung beim Import.
- Gemischte Absatzformatierung, Ligaturen, kombinierende Zeichen und Textfluss
  auf bis zu 19 zusätzliche Seiten; Objektgriffe und Zeichenreihenfolge.
- Acht OCR-Sprachen gleichzeitig sowie optionale lokale Sprachprobe je Scan-Seite.
- Lokaler PDF-Assistent mit geprüfter Modelldatei, Quellenzitaten, JSON-Export,
  Abbruch und Speicherfreigabe.
- HEIC/HEIF- und PSD-Import im Browser; Pages-, Visio- und Publisher-Konvertierung
  mit Prüfung ungültiger Dateicontainer.
- Workflow-Knotendiagramm mit verschachtelten Entscheidungen; zusätzliche
  Seitenoperationen und nachvollziehbares Ablaufprotokoll.
- Mehrere Bates-/Kopf-/Fußzeilenregeln, Papierformate, druckfertige Posterblätter
  und abbrechbare Ergebnisvorschau.
- SVG-Vektorexport, Schriftkonturen, dauerhaft reduzierte Ebenen, bearbeitbarer
  PowerPoint-Text und Übersetzung an Originalpositionen mit Überlaufprüfung.
- Reparatur bestehender PDF-Tags ohne Änderung des Seiteninhalts und Ausgabe
  nur nach bestandener veraPDF-Prüfung.
- Strenge Offline-Signaturprüfung, konfigurierbare PAdES-T/LT/LTA-Signaturen und
  Erneuerung von Dokumentzeitstempeln. Zugangsdaten bleiben vom Konverter getrennt.
- Spaltenbewusster Dokumentvergleich, seitenübergreifende Sätze und besondere
  Hinweise auf geänderte Zahlen, Verneinungen und Pflichtwörter.
- 24 Engine-Testsuiten, erweiterte Server- und Browserprüfungen. Offene Grenzen
  des ursprünglichen Ausbauplans stehen in [docs/AUSBAUSTAND.md](docs/AUSBAUSTAND.md).

## 0.8.1 – 2026-10-11

- Ergebnisse im Barrierefreiheitswerkzeug werden nach Änderungen an Inhalt,
  Titel, Sprache, Prüfprofil oder Aktion verworfen. Ein Download wird erst nach
  erneuter Verarbeitung angeboten und gehört dadurch zum aktuellen Entwurf.
- Browserprüfung für bearbeitete PDF/UA-Inhalte, erneuten Export und den Wechsel
  von Prüfprofil und Aktion ergänzt. Neue PDF-Inhalte und Metadaten werden
  unabhängig zurückgelesen.

## 0.8.0 – 2026-10-11

- Absatzeditor mit Mehrfachauswahl vorhandener Textobjekte, automatischem Umbruch,
  eingebetteter Noto Sans oder eigener statischer TTF, Größe, Farbe, Ausrichtung,
  Abständen und tatsächlicher PDF-Vorschau. Überlauf und fehlende Glyphen werden
  vor der Ausgabe gemeldet; übrige Seitenobjekte bleiben erhalten.
- PDF/UA-1- und PDF/UA-2-Prüfung mit dem vorhandenen gepinnten veraPDF-Validator.
- Struktureditor für neue A4-Dokumente: Überschriften, Absätze, Lesereihenfolge,
  Bilder mit Alternativtext, Titel/Sprache und speicherbare JSON-Strukturdateien.
  LibreOffice erzeugt PDF/UA-1; nur eine bestandene Maschinenprüfung erlaubt die
  PDF-Ausgabe. Manuelle Prüfung und Abgleich mit dem Original bleiben nötig.
- 21 Engine-Testsuiten, sechs zusätzliche Serverprüfungen und Browserabläufe für
  Absatzvorschau, Überlauf und die geprüfte PDF/UA-Erstellung. Weiterhin 108 Werkzeuge.

## 0.7.0 – 2026-10-11

- Übertragbare `.moinpdf`-Projektdateien für den aktuellen oder einen gespeicherten
  Arbeitsstand, einschließlich Originaldateien, Rechnungs-XML, Seiten, Editor,
  Formularen, Lesezeichen und Rückgängig-Verlauf. Import als eigenes Projekt;
  vorhandene Sitzung wird vor dem Wechsel lokal gesichert.
- Größen-, Integritäts-, Daten- und Seitenverweisprüfung beim Import. Die
  Projektdatei ist unverschlüsselt und enthält auch Originale und frühere
  Bearbeitungen; zum Weitergeben fertiger Dokumente die Ergebnis-PDF verwenden.
- OCR und Scan-Suche kombinieren bis zu vier der 21 mitgelieferten Sprachen.
  Prüfung durch tatsächliche Erkennung eines viersprachigen Scans.
- Neuer Inhaltsmodus in „PDFs vergleichen“: Textblöcke über Seitengrenzen hinweg
  zuordnen, eingefügte Seiten berücksichtigen und Wortänderungen sowie
  Verschiebungen ausweisen. Unklare und wiederholte Zuordnungen bleiben sichtbar.
- Vergleichsberichte blenden unveränderten Text auf Wunsch ein und zeigen große
  Berichte schrittweise; der TXT-Download enthält weiterhin alle Einträge.
- 20 Engine-Testsuiten sowie zusätzliche Browserabläufe für Projekttransfer,
  vier OCR-Sprachen und den Inhaltsvergleich. Weiterhin 108 Werkzeuge.

## 0.6.0 – 2026-10-11

- Acht neue Browserwerkzeuge: Originalobjekte bearbeiten, Bates-Nummerierung,
  Seitenbezeichnungen, freie Drehwinkel, lange Seiten, Posterdruck, schnelle
  Webansicht und strukturierter JSON-Export. Insgesamt 108 Werkzeuge.
- PDFium verarbeitet Originaltexte, Bilder und Grafiken in einem abbrechbaren
  lokalen Worker. Textbearbeitung erhält verfügbare Originalschriften und
  meldet fehlende Zeichen. Einzelne Textobjekte, noch kein Absatzeditor.
- 21 lokal bereitgestellte OCR-Sprachen und wählbarer Seitenaufbau.
- WebP/BMP/TIFF/SVG-Import, mehrseitige TIFFs; WebP/TIFF/BMP-Export.
- PDF-Ebenen umbenennen und ihre Navigation/Sichtbarkeit speichern, ohne Text
  und Vektorgrafiken in Seitenbilder umzuwandeln.
- Wenn-/Sonst-Schritte in Arbeitsabläufen mit nachvollziehbarem ZIP-Protokoll.
- Lokale PDF-Projekte mit fünf gespeicherten Arbeitsständen, Wiederherstellung
  und Rückgängig-Verlauf. Projektdaten liegen unverschlüsselt im Browserspeicher.
- Unabhängige Prüfungen mit PDF.js und PDFium, tatsächliche QPDF-Linearisierung,
  Bildcodec- und IndexedDB-Prüfungen. 18 Engine-Testsuiten.
- Umfang und noch offene Teile des größeren Ausbaus in
  [docs/AUSBAUSTAND.md](docs/AUSBAUSTAND.md) festgehalten.

## 0.5.11 – 2026-10-10

- Eigenständige Entwicklungs- und Build-Konfiguration für die Docker-Ausgabe.
- Quellcode einheitlich formatiert; ESLint und Formatprüfung in der Integration.
- Container-Veröffentlichung an den erfolgreichen vollständigen Prüflauf gekoppelt.
- Mobile Prüfungen für Impressum und Datenschutz ergänzt.
- Dokumentation, Rückmeldewege, Lizenzstatus und Wartungshinweise aktualisiert.
- Veralteten Cookie-Hinweis und den nicht öffentlich erreichbaren Supportlink korrigiert.

## 0.5.10 – 2026-10-10

- Web- und Docker-Ausgabe auf denselben aktuellen Stand gebracht.
- Kontakt über ahoi@moinpdf.de, Datenschutzanfragen über post@moinpdf.de; persönliche Angaben auf die erforderlichen Anbieter- und Verantwortlichenangaben beschränkt.
- Kontakt- und Anbietertexte vereinheitlicht und die Kontaktkarte im Medienbereich bereinigt.
- Kompaktes Layout von Impressum und Datenschutz mit grüner Schrift und einer Leerzeile zwischen Anschrift und E-Mail.

## 0.5.9 – 2026-10-10

- Werbeclip „Drucker über Bord?“ mit Vorschau, Download und Medienpaket auch in der Docker-Ausgabe.
- Medienbereich mit einspaltigem Einstieg ohne abgesetzten „Moin.“-Block auf großen Bildschirmen.
- Offizielles Favicon und jüngste Dokumentationstexte im aktualisierten Docker-Release.
- HTML-Seiten und Favicons werden nach Updates erneut validiert; ausgelieferte Medien werden in den Installationstests geprüft.

## 0.4.0 – 2026-10-07

- Zehn neue Werkzeuge, insgesamt 93: Zahlenvergleich, Belegfelder sammeln,
  Rechnung/XML-Abgleich, Dokumentlücken, OCR-Korrekturhilfe, Pseudonymisierung,
  automatische Anlagenlinks, beste Scan-Seiten, Positionsabgleich und Kommentarlisten.
- Gemeinsame Originalvorschau mit markierten Fundstellen und vergrößertem Ausschnitt.
  Tabellenexporte kennzeichnen ungeprüfte, fehlende und mehrdeutige Angaben.
- Zahlen und Positionen werden anhand ihrer Beschriftungen zugeordnet. Verschobene
  Seiten sind möglich, doppelte oder unklare Beschriftungen bleiben Prüffälle.
- Rechnung/XML-Abgleich liest sichtbare Seiten per lokaler OCR; eine abweichende
  versteckte Textebene wird dafür nicht als sichtbarer Rechnungsinhalt verwendet.
- OCR-Korrekturen erzeugen Suchtext hinter neuen Seitenbildern. Pseudonymisierte
  Ausgaben enthalten nur bearbeitete Seitenbilder und neutrale Dateinamen; alte
  Textebenen, Formulare, Metadaten und Anhänge werden nicht übernommen.
- Anlagenziele und Scan-Seiten lassen sich vor dem Export kontrollieren und ändern.
  Positionsvorschläge können ergänzt, korrigiert und erst danach verglichen werden.
- Alle zehn Werkzeuge arbeiten im Browser mit lokal bereitgestellten Ressourcen.
  Keine zusätzlichen Serverdienste, externen KI-Aufrufe oder API-Konten erforderlich.
- Neue Tests prüfen tatsächliche OCR, sichtbare Pseudonymisierung, unabhängiges
  Lesen der erzeugten PDFs, interne Linkziele und sichere Tabellen-/Kommentarimporte.
  Die Erkennung bleibt eine kontrollierbare Hilfe und ist keine Vollständigkeits-
  oder Echtheitsbestätigung.

## 0.3.0 – 2026-10-07

- Sieben neue Werkzeuge, insgesamt 83: PDF-Reparatur, Komprimierung auf Wunschgröße,
  Sammelscans trennen, PDF zu Markdown/HTML/EPUB sowie EPUB zu PDF.
- Reparatur akzeptiert Originaldateien ohne vorherige Vorschau. Rekonstruktion der
  Dateistruktur, unabhängiger Parser als Rückfall und Prüfung jeder Ausgabeseite.
  Nicht rekonstruierbare Dateien erhalten einen Fehler; Originale bleiben erhalten.
- Komprimierung misst die echte Dateigröße, behält immer die kleinste Variante und
  meldet unerreichbare Ziele ausdrücklich. Text, Links und Formulare bleiben erhalten.
  Docker kann Bildauflösung reduzieren; die Browser-Ausgabe nutzt QPDF.
- Sammelscans: automatische Vorschläge anhand heller Zwischenräume, manuelle Rahmen,
  Vorschau und Prüfung aller Ausschnitte vor dem ZIP mit einzelnen Bild-PDFs/PNG/JPG.
- Markdown/HTML/EPUB als Textausgaben mit Seitenstruktur, gekennzeichneten Scanseiten
  und EPUB-Inhaltsverzeichnis. Bilder und das Original-Layout werden nicht übernommen.
- EPUB-Import im Dokumentenserver mit A4/A5, Schriftgröße, Größen-/Seitenlimits und
  gesperrten aktiven/externalen Inhalten. Direkter EPUB-Upload öffnet den Konverter.
- Regressionstests für Reparatur, Formulare, Zielgrößen, tatsächliche Ausschnitte,
  sichere Exporte, EPUB-Rundlauf und die geschützten Server-Endpunkte.

## 0.2.8 – 2026-10-07

- Kategorieauswahl unter der Werkzeugsuche wiederhergestellt: Alle, Prüfen,
  Umwandeln, Seiten, Bearbeiten und Stapel. „Alle“ zeigt standardmäßig alle Werkzeuge.
- Kategorien filtern die Übersicht und Suchvorschläge; die Anzahl passt sich an.
  Die Schaltflächen umbrechen auf kleinen Bildschirmen und sind per Tastatur bedienbar.

## 0.2.7 – 2026-10-07

- Seemann-Logo auf 16 Pixel verkleinert. Logo und Versionsnummer bilden eine
  gemeinsam zentrierte Zeile und sind auch vertikal mittig zueinander ausgerichtet.

## 0.2.6 – 2026-10-07

- Seemann-Logo im Footer weiter auf 24 Pixel verkleinert und den Footer kompakter
  gehalten. Logo und Versionsnummer bleiben gemeinsam mittig ausgerichtet.

## 0.2.5 – 2026-10-07

- Seemann-Logo im Footer von 48 auf 32 Pixel verkleinert und gemeinsam mit
  der Versionsnummer mittig unter den rechtlichen Links ausgerichtet.

## 0.2.4 – 2026-10-07

- Kleines Seemann-Emblem aus den Bannern neben der Version im Footer ergänzt.
  Der Seemann schaut aus einem Kreis; Logo und Versionsnummer stehen gemeinsam
  links unten, auf schmalen Bildschirmen unter den rechtlichen Links.

## 0.2.3 – 2026-10-07

- Dezenten Hintergrundverlauf in hellem Petrol und sanftem Grün ergänzt.
  Der Verlauf zieht sich durch Startseite, Werkzeugübersicht und Arbeitsbereiche
  bis zum Footer und passt sich der Bildschirmgröße an.

## 0.2.2 – 2026-10-07

- Den MoinPDF-Schriftzug im Startseiten-Header durch die Buchstabenformen des
  freigegebenen Logos ersetzt: „Moin“ in Dunkelpetrol, „PDF“ in Grün. Als skalierbare
  Vektorgrafik; Claim, Unterstreichung und übrige Oberfläche bleiben unverändert.

## 0.2.1 – 2026-10-06

- Zusätzlichen Browserwerkzeuge-Hinweis samt Schildsymbol unter der Werkzeugliste entfernt.
- Alle Werkzeuge direkt unter dem Suchfeld sichtbar; keine vorgeschaltete Schnellwahl
  oder Kategoriekacheln mehr. Suche und bestehende Werkzeuge bleiben verfügbar.
- Lange Werkzeugnamen umbrechen innerhalb der Kacheln, auch auf schmalen Smartphones.

## 0.2.0 – 2026-10-06

- Footer auf kleinen Bildschirmen zentriert, umbrechende Links und eigene Versionszeile.
- Animiertes Uploadfeld an schmale Smartphone-Ansichten angepasst.
- Word, Excel, PowerPoint, Bilder und Text direkt nach dem PDF-Import auswählbar.
- Alle Werkzeuge nach Aufgabe einsortiert; keine separate Serverkategorie mehr.
- Konvertierungen ohne Serveradresse, API-Schlüssel oder zusätzliche Freigabe-Checkbox.
  Die Verarbeitung startet ausschließlich mit dem jeweiligen Aktionsknopf.
- Office-, E-Mail- und HTML-Dateien direkt über das zentrale Uploadfeld öffnen.
- Einfache Ergebnisansicht mit passend beschriftetem Download.
- E-Mails standardmäßig direkt als PDF; Anlagen optional als ZIP.
- Verbindungsprüfungen und Verarbeitungsanfragen mit Zeitbegrenzung.
- Browser-Ausgabe: PDF-Text direkt als echte DOCX exportieren; Layout und Bilder
  werden dabei nicht übernommen. Die Docker-Ausgabe nutzt weiterhin die
  vorhandene Konvertierung mit Layout-Rekonstruktion. Weitere native Konverter
  benötigen die vollständige Docker-Installation.

## 0.1.0 – 2026-10-05

- Erste vollständige Docker-Ausgabe mit PDF-Werkzeugen,
  integriertem Dokumentendienst und lokaler Übersetzung.
