# Browserprüfung MoinPDF 0.13.25

Prüfdatum: 15. Oktober 2026 (UTC).

**Firefox hat die geprüften Abläufe bestanden. In echtem Safari bleibt ein reproduzierbarer Fehler bei der PDF-Textextraktion offen; dadurch scheitert auch OCR in der Standardeinstellung.**

Geprüft wurde ein unveränderter lokaler Produktionsbuild des Anwendungsstands 0.13.25. Ausgangspunkt war `e88dfb20948aebcfd5289c0d951e6053bcf2f370`; gegenüber Release `daa2dd3250d39e1bf9dd012e0ff76f22eaffc7ea` enthält dieser Stand nur Dokumentationsänderungen. Die QA-Commits ergänzen Tests und Workflows. Es wurde kein Produktfix veröffentlicht und kein Pull Request angelegt.

| Umgebung | Ergebnis |
| --- | --- |
| Firefox 157.0, Playwright, Ubuntu 24.04 | Alle sieben Prüfbereiche bestanden, Dokumentation im gezielten Nachlauf. |
| WebKit 27.2, Playwright, Ubuntu 24.04 | Sechs allgemeine Prüfbereiche bestanden; normale Office-Konvertierungen bestanden. Gesonderte Cache-/Abbruchtests siehe unten. Diese Umgebung ist kein natives Safari. |
| Safari 26.6.1, macOS 15.7.9, Apple safaridriver | Sieben von acht ausgewählten Abläufen bestanden, einschließlich des Projekt-Nachtests. OCR/Textextraktion fehlgeschlagen. |

Die Firefox-/WebKit-Prüfbereiche umfassten 112 Werkzeugansichten ohne Datei und mit PDF auf Desktop sowie mit PDF bei Mobilbreite, PDF-Vorschau und echte Downloads mit unabhängigem PyMuPDF-Rücklesen, PDFium-Objekt- und Absatzbearbeitung, Projekte und portable Projektdateien, OCR mit acht Sprachen und automatischer Sprachwahl, Inhaltsvergleich, EPUB, DE/EN-Oberfläche, Layout, XFA-Erhaltung, Office und Dokumentation. Die 112 Werkzeugansichten sind eine Prüfung der Ansichten und des Dokumenterhalts, keine vollständige Funktionsprüfung jedes Werkzeugs.

In Firefox bestanden außerdem die neun Office-Eingabefälle und 15 Abbruch-/Neustartzyklen mit gesperrtem erneutem Download der Office-Programmdaten. Ein unabhängiger kurzer Firefox-Nachlauf bestätigte PDF-Download, direkte Textbearbeitung, Projektwiederherstellung, OCR und DOCX-Konvertierung nochmals.

In echtem Safari bestanden:
- Theme- und Sprachwiederherstellung nach Neuladen.
- Alle 112 Werkzeugansichten mit Erhalt der eingegebenen PDF.
- PDF-Vorschau, tatsächlich auf dem macOS-Dateisystem gespeicherter Download und unabhängiges Rücklesen.
- PDFium-Textänderung mit Erhalt der zweiten Originalseite.
- Projekt speichern, neu laden und unveränderte PDF-Inhalte wiederherstellen.
- Lokale DOCX-zu-PDF-Konvertierung über LibreOffice WASM.
- Deutsches und englisches Handbuch mit jeweils 112 Anleitungen.

**Offener Safari-Fehler:** `ReadableStream.prototype[Symbol.asyncIterator]` ist in der geprüften Safari-Umgebung `undefined`. Bereits eine unabhängige Schleife über einen einfachen ReadableStream scheitert. Der direkte Aufruf von PDF.js `getTextContent()` liefert denselben Fehler wie MoinPDF: `undefined is not a function (near '...e of t...')`. Der Stack zeigt auf `getTextContent` im ausgelieferten PDF.js-Bundle. OCR scheitert beim vorherigen Lesen einer eventuell vorhandenen Textebene, bevor die OCR-Engine geladen wird.

Die Quellcodeprüfung zeigt dieselbe API auch in weiteren textbasierten Werkzeugen, etwa PDF zu Word und Leseexport. Deren Betroffenheit ist eine Ableitung aus dem gemeinsamen Codepfad, kein separat ausgeführter Funktionstest. Nächster Produktarbeitsschritt ist eine Safari-kompatible Stream-/Textextraktion mit anschließendem gezieltem Nachtest. Ein entsprechender Produktfix ist in diesem Prüfauftrag nicht umgesetzt worden.

Passende Meldungen im PDF.js-Projekt: [#21924](https://github.com/mozilla/pdf.js/issues/21924) und [#20973](https://github.com/mozilla/pdf.js/issues/20973).

Weitere Einordnung:
- Der erste Firefox-Dokumentationstest blockierte bei automatisierten Größenänderungen zwischen Tabs. Mit expliziter Aktivierung des jeweiligen Tabs besteht derselbe Inhaltstest vollständig. Dafür war keine Anwendungsänderung erforderlich.
- Der erste native Safari-Projekttest bediente das Eingabefeld vor dessen Freigabe. Nach Warten auf ein sichtbares, aktiviertes Feld besteht die Projektwiederherstellung.
- Im privaten Playwright-WebKit-Kontext scheiterte der Office-Neustart, wenn weitere Programmdownloads künstlich gesperrt wurden. Mit dauerhaftem Browserprofil bestanden drei Abbruch-/Neustartzyklen ohne erneute Programmdownloads. Im privaten Kontext bestanden drei Zyklen mit normal verfügbarem Asset-Zugriff. Ein kleiner Cache-Storage-Probetest funktioniert in beiden Profilen; daraus folgt keine Garantie für den vollständigen großen Office-Cache im privaten Profil.

Testgrenzen:
- SafariDriver konnte native Dateien in drei Verzeichnissen selbst auf einer unabhängigen HTML-Dateiauswahl nicht lesen (`NotReadableError`). Die Safari-Verarbeitungstests verwendeten deshalb dieselben synthetischen Testdateien als standardkonforme, im Browser erzeugte File-Objekte. Die native Betriebssystem-Dateiauswahl bleibt manuell zu verifizieren. Der native Safari-Download wurde tatsächlich geprüft.
- Keine Tests auf physischen iPhones oder iPads.
- Firefox/WebKit-Druck-CSS und Wiederherstellung der Handbuchsuche wurden geprüft; der native Druckdialog und dessen PDF-Ausgabe wurden nicht automatisiert.
- Browserprüfungen am lokalen Produktionsbuild mit korrekten Isolationsheadern; kein Zugriff auf die persönliche Umbrel-Installation. Ausschließlich serverseitige Konvertierungen waren nicht Teil dieses Durchlaufs.

Nachweise:
- [Vollständige Firefox-/WebKit-Prüfbereiche und erster Safari-Lauf](https://github.com/MoinPDF/moinpdf/actions/runs/38816581029)
- [Echtes Safari: Dokumentabläufe, native Dateiproben und Download](https://github.com/MoinPDF/moinpdf/actions/runs/38818716480)
- [Safari: Projekt-Nachtest und isolierter Nachweis des Textextraktionsfehlers](https://github.com/MoinPDF/moinpdf/actions/runs/38819874770)
- [WebKit: Office mit dauerhaftem Profil und privatem Profil](https://github.com/MoinPDF/moinpdf/actions/runs/38819120003)
- [Firefox: fünf gezielte Dokumentabläufe bestanden](https://github.com/MoinPDF/moinpdf/actions/runs/38820622565)
- [Firefox: Dokumentation und Medien bestanden](https://github.com/MoinPDF/moinpdf/actions/runs/38821419450)

Die ursprünglichen Sammelläufe bleiben wegen der dokumentierten Zwischenbefunde rot. Die Nachläufe ersetzen die jeweils genannten fehlgeschlagenen Prüfungen, nicht den bestätigten Safari-Produktfehler. Screenshots, JSON-Ergebnisse und erzeugte synthetische PDFs liegen in den jeweiligen Workflow-Artefakten (Aufbewahrung: 30 Tage).
