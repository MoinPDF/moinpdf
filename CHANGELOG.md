# Änderungen

MoinPDF verwendet semantische Versionsnummern (`MAJOR.MINOR.PATCH`). Die zentrale
Versionsnummer steht in `package.json`; die Oberfläche liest sie daraus. Docker-
Images tragen zusätzlich den Quellcode-Commit, veröffentlichte Container einen festen Digest.

## Unveröffentlicht

- Projektdokumentation und Veröffentlichungsabläufe auf den eigenständigen Docker-Betrieb ausgerichtet.
- Plattformspezifische Installationspakete und Integrationstests in das zuständige externe Paket-Repository ausgelagert.

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
