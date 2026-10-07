# Änderungen

MoinPDF verwendet semantische Versionsnummern (`MAJOR.MINOR.PATCH`). Die zentrale
Versionsnummer steht in `package.json`; die Oberfläche liest sie daraus. Docker-
Images tragen zusätzlich den Quellcode-Commit, Umbrel-Pakete einen festen Digest.

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
  werden dabei nicht übernommen. Die Docker-/Umbrel-Ausgabe nutzt weiterhin die
  vorhandene Konvertierung mit Layout-Rekonstruktion. Weitere native Konverter
  benötigen die vollständige Docker-/Umbrel-Installation.

## 0.1.0 – 2026-10-05

- Erste vollständige Docker- und Umbrel-Ausgabe mit PDF-Werkzeugen,
  integriertem Dokumentendienst und lokaler Übersetzung.
