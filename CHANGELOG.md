# Änderungen

MoinPDF verwendet semantische Versionsnummern (`MAJOR.MINOR.PATCH`). Die zentrale
Versionsnummer steht in `package.json`; die Oberfläche liest sie daraus. Docker-
Images tragen zusätzlich den Quellcode-Commit, Umbrel-Pakete einen festen Digest.

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
  werden dabei nicht übernommen. Die Docker-/Umbrel-Ausgabe nutzt weiterhin die
  vorhandene Konvertierung mit Layout-Rekonstruktion. Weitere native Konverter
  benötigen die vollständige Docker-/Umbrel-Installation.

## 0.1.0 – 2026-10-05

- Erste vollständige Docker- und Umbrel-Ausgabe mit PDF-Werkzeugen,
  integriertem Dokumentendienst und lokaler Übersetzung.
