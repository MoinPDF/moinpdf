# Safari-/Firefox-Korrektur in MoinPDF 0.13.26

Stand: 16. Oktober 2026.

Die gemeinsame PDF-Textextraktion liest PDF.js-Textströme über `getReader()`.
Damit benötigen OCR, Textbearbeitung, Inhaltsvergleich und Textausgaben keinen
asynchronen Stream-Iterator. Textelemente, Reihenfolge, Schriftinformationen,
Positionen und Dokumentsprache bleiben erhalten. Reine XFA-Dokumente verwenden
weiterhin den dafür vorgesehenen PDF.js-Pfad.

## Nachweis

[Erfolgreicher Browserlauf](https://github.com/MoinPDF/moinpdf/actions/runs/38859475460)
auf Quellstand `d30cee652512b00ffb53d81c37cee7fd9c077de7`.
Die Freigabe enthält denselben Anwendungscode; dieser Bericht ergänzt den Nachweis.

| Prüfung | Apple Safari 26.6.1, macOS 15.7.9 | Firefox 157.0, Linux |
| --- | --- | --- |
| Echte lokale OCR eines Bildscans, unabhängig ausgelesene Ergebnis-PDF | Bestanden | Bestanden |
| DOCX mit Text beider PDF-Seiten | Bestanden | Bestanden |
| Markdown, HTML und EPUB mit Text beider Seiten | Bestanden | Bestanden |
| Erkannte Textstellen und Schriftgeometrie im Editor | Bestanden | Bestanden |
| JSON mit Seiten, Text, Positionen und Schriftreferenzen | Bestanden | Bestanden |
| Textimport in strukturierte Dokumentblöcke | Bestanden | Bestanden |
| Inhaltsvergleich mit unabhängig geprüften geänderten Beträgen | Bestanden | Bestanden |

Safari wurde mit Apples installiertem Browser und `safaridriver` geprüft.
`ReadableStream.prototype[Symbol.asyncIterator]` war dort weiterhin
`undefined`; alle neun Prüfungen waren dennoch erfolgreich. Firefox bestand
alle sechs Prüfgruppen. Die Ausgaben wurden mit PyMuPDF, ZIP/XML und JSON
unabhängig vom Anwendungscode gelesen.

Die Tests verwenden den Browsermodus der Webausgabe, damit der lokale
Word-Export tatsächlich ausgeführt wird. Die Docker-Ausgabe verwendet für Word
ihren integrierten Dokumentenserver; ihre reguläre Freigabe bleibt durch
`docker.yml` und die nachgelagerten Image-/Release-Prüfungen abgesichert.

Zusätzlich bestanden alle 34 bestehenden und ergänzten Engine-Testsuiten,
TypeScript-Prüfung, Lint, Formatprüfung sowie beide Produktionsbuilds.
Der neue Regressionstest prüft echte mehrteilige PDF-Textströme bei entferntem
Stream-Iterator, unveränderte Text-/Schrift-/Positionsdaten, Optionen,
XFA-Weiterleitung, leere Scans und Fehler ohne Teilergebnis.

## Grenzen des Browsernachweises

SafariDriver konnte auch in einem unabhängigen einfachen HTML-Dateifeld keine
nativen Dateien lesen. Deshalb erhielten die Anwendungstests identische
synthetische Dateibytes als reguläres In-Memory-`File` über das Dateifeld.
Die native Dateiauswahl bleibt unbestätigt. Der tatsächliche Safari-Download der
OCR-PDF wurde dagegen im Downloadordner bytegleich nachgewiesen.
Physische iPhones/iPads und serverseitige Konvertierungen gehören nicht zu
diesem gezielten Browserlauf.

## English

Version 0.13.26 replaces PDF text stream async iteration with the standard
reader API across all seven consumers, retaining font data, coordinates,
language and the separate XFA text path. Native Safari 26.6.1 passed all nine
cases despite lacking the stream async iterator; Firefox 157.0 passed all six
groups. Outputs were independently inspected. SafariDriver's native file
input limitation required synthetic in-memory files; the real OCR PDF download
was verified on disk. Docker releases still require the complete existing
installation and image verification pipeline.
