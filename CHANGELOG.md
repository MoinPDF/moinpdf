# Änderungen

MoinPDF verwendet semantische Versionsnummern (`MAJOR.MINOR.PATCH`). Die zentrale
Versionsnummer steht in `package.json`; die Oberfläche liest sie daraus. Docker-
Images tragen zusätzlich den Quellcode-Commit, platform-Pakete einen festen Digest.

## 0.3.0 – 2026-10-07

- Sieben neue Werkzeuge, insgesamt 83: PDF-Reparatur, Komprimierung auf Wunschgröße,
  Sammelscans trennen, PDF zu Markdown/HTML/EPUB sowie EPUB zu PDF.
- Reparatur akzeptiert Originaldateien ohne vorherige Vorschau. Rekonstruktion der
  Dateistruktur, unabhängiger Parser als Rückfall und Prüfung jeder Ausgabeseite.
  Nicht rekonstruierbare Dateien erhalten einen Fehler; Originale bleiben erhalten.
- Komprimierung misst die echte Dateigröße, behält immer die kleinste Variante und
  meldet unerreichbare Ziele ausdrücklich. Text, Links und Formulare bleiben erhalten.
  Docker/platform kann Bildauflösung reduzieren; die Browser-Ausgabe nutzt QPDF.
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
  werden dabei nicht übernommen. Die Docker-/platform-Ausgabe nutzt weiterhin die
  vorhandene Konvertierung mit Layout-Rekonstruktion. Weitere native Konverter
  benötigen die vollständige Docker-/platform-Installation.

## 0.1.0 – 2026-10-05

- Erste vollständige Docker- und platform-Ausgabe mit PDF-Werkzeugen,
  integriertem Dokumentendienst und lokaler Übersetzung.
