# Prüfungen und belegter Versionsstand

**Deutsch** · [English](VALIDATION.en.md) · [← README](README.md)

Die Versionsnummer steht in [package.json](package.json). Ein erfolgreicher
Prüflauf belegt ausschließlich den dort angezeigten Commit, keine späteren
Änderungen oder beliebigen Dokumente.

## Prüfplan für 0.21.0

- 57 Engine-/DOM-Suiten einschließlich echter PDFs, unabhängiger AES-GCM-Entschlüsselung,
  falscher Passwörter, manipulierten/abgeschnittenen Projektdateien und Abbruch.
- Exportprüfung erkennt verlorenen Text, geänderte Formularfelder und unlesbare PDFs.
  Download, Teilen und Weiterbearbeitung verwenden denselben, an die Ausgabedatei
  gebundenen Status. Eine technische Prüfung ersetzt keine inhaltliche Sichtkontrolle.
- Offline-Tests prüfen vollständige Pakete, Integritätsanforderungen, fehlgeschlagene
  Downloads, Anmeldeseiten, erhaltene Sicherheitsheader und begrenztes Löschen.
- `tests/release-021-browser.py` ergänzt die Chromium-/Firefox-/WebKit-Matrix um
  echte verschlüsselte Projektdateien, falsches Passwort ohne Import, Wiederöffnung,
  bereinigte PDF mit unabhängiger Inhaltskontrolle, Offline-Neustart samt OCR und
  200 Seiten mit Freigabe und erneutem Laden nicht sichtbarer Vorschauen.
- Ein 200-Seiten-Test mit künstlichem Text belegt keine beliebigen 80-MB-Scans.
  Die Grenzen bleiben bei 80 MiB je Eingabedatei und 200 aktiven Seiten.
- Physische iPhones/iPads/Android-Geräte, native Teilen-Dialoge und Microsoft Word
  sind weiterhin offen; die [Gerätecheckliste](docs/quality/editor-device-checklist.md)
  trennt diese Fälle ausdrücklich von Desktop-Engines und Touch-Emulation.
- Maßgeblich ist der erfolgreiche Actions-Lauf des jeweiligen Commits. Neue
  Prüffälle und lokale Vorprüfungen sind kein Ersatz für diesen Release-Nachweis.

## Bedienungsverbesserungen in 0.14.2

- Alle 36 automatisierten Suiten bestanden, einschließlich echter PDF-Ausgaben,
  Dokumenteditor und Projektübertragung mit erhaltenen Upload-Prüfsummen.
- Neue React-DOM-Prüfungen decken Kategorie, Suchbegriff, Scrollposition und Fokus
  beim Zurückgehen, Umbenennen mit Enter/Escape, Duplikatentscheidungen und
  Dateifreigabe mit Erfolg, Abbruch, Fehler sowie fehlender Browserunterstützung ab.
- 40 zusätzliche Suchfälle prüfen deutsche und englische Alltagsformulierungen
  in beiden Sprachkatalogen. Größenvergleiche unterscheiden vollständige PDFs
  von einer Auswahl mit fehlenden oder doppelten Seiten.
- TypeScript-Prüfung und Produktionsbuild für Selbsthosting bestanden;
  die erzeugten englischen Informationsseiten haben keine fehlenden Übersetzungen.
- Die DOM-Prüfungen ersetzen keine visuelle Browser- oder Geräteprüfung.
  Eine solche Prüfung und der native Teilen-Dialog auf echten Geräten konnten
  in dieser Arbeitsumgebung nicht ausgeführt werden.

## Automatisierte Prüfungen

| Bereich | Umfang |
| --- | --- |
| Quellcode | TypeScript, ESLint ohne Warnungen, einheitliche Formatierung und Abhängigkeitsprüfung |
| PDF-Engines und DOM | 57 Suiten mit echten PDFs, unabhängigen Lesern, Text-, Pixel-, Formular-, Link- und Verschlüsselungsprüfungen |
| Dokumentenserver | 65 Tests: native Konverter, Authentifizierung, Größen- und Zeitgrenzen, Übersetzung, Bereinigung, Audio, Barrierefreiheit, Langzeitsignaturen und Upload-Parser |
| Integration | Echte Office-Konvertierung, Deutsch/Englisch-Übersetzung, lokale Sprachausgabe, Neustart und erhaltene Modelle |
| Oberfläche | Alle Werkzeugansichten auf Desktop und Mobilgerät, PDF-/EPUB-/Audio-Downloads |
| Dokumentation und Medien | Suche, Kategorien, Druck, Downloads, Video, keine horizontalen Überläufe und erhaltene Arbeitsdateien |
| Rechtsseiten | 1440, 390 und 320 Pixel, gemeinsame Farbpalette, Kontaktlinks und Abstand zwischen Anschrift und E-Mail |
| Container | Plattform-Indizes für amd64 und arm64 sowie feste Digests |

[Aktuelle Prüfläufe](https://github.com/MoinPDF/moinpdf/actions) und ihre
Artefakte sind für Personen mit Repository-Zugriff einsehbar. Die Ausführung
beschreibt [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md).

## Belegter Ausgangsstand

Version **0.9.1**, Commit `b488a9ce0358ce54fb3030e1b66bc8d20b3b04e4`,
bestand den [Docker-Lauf vom 11. Oktober 2026](https://github.com/MoinPDF/moinpdf/actions/runs/38149865248):
24 Browser-Engine-Suiten, 56 Servertests, alle 112 Werkzeugansichten,
Konvertierung, Übersetzung, Neustart, Zugriffsschutz und echte lokale
Modellinferenz. Neue Versionen erhalten eigene Prüfläufe; dieser Nachweis gilt
nicht automatisch für spätere Änderungen an `main`.

## Grenzen und Prüfung beim Betreiber

- ARM-Images werden gebaut und ihre Plattform-Indizes geprüft. Ein nativer
  ARM-Lauf ist damit nicht nachgewiesen.
- Die vollständigen Oberflächenprüfungen laufen unter Chromium. Ergänzende
  PDF-Text- und OCR-Prüfungen laufen unter Firefox und WebKit. Ein WebKit-Lauf
  belegt keinen nativen Safari- oder iOS-Test.
  Konkrete Smartphones und native Teilen-Dialoge benötigen eigene Gerätetests.
- Die eigene Serverinstallation und ihre öffentliche Domain müssen
  separat mit künstlichen Testdokumenten geprüft werden.
- Große oder ungewöhnliche Dokumente können Konvertergrenzen erreichen.
  Ergebnisse am Original kontrollieren.
- Die vollständige Docker-Installation enthält den Dokumentenserver. Serveradresse und
  API-Schlüssel werden nicht manuell im Browser eingetragen.
- Ein statischer Web-Build allein stellt keinen laufenden Dokumentenserver
  bereit; `/api/documents/*` benötigt die zugehörige Serverinstallation.

## Release-Prüfung 0.14.3

- GitHub-Basis 0.13.26 vollständig erhalten, einschließlich Webseiten-Konverter,
  Netzwerkisolation, vier Container-Images und zweisprachiger Repository-Dokumentation.
- 36 Engine-/DOM-Suites, TypeScript, ESLint ohne Warnungen, Formatprüfung,
  Release-Gates und Produktionsbuild lokal erfolgreich.
- Dokumenteditor und Entwurfsimport verwenden HTTP-taugliche Zufallskennungen.
  Regressionstest entfernt ausdrücklich `crypto.randomUUID`.
- Export und Vorschau sperren den Editor ohne eine künstliche Inhaltsänderung;
  erzeugte PDFs und ihre Dateinamen bleiben bis zur nächsten echten Änderung erhalten.
- `tests/release-usability-browser.py` ergänzt die Docker-CI um lokale HTTP-Nutzung,
  echte PDF-Downloads, Entwurfsimport und Wiederherstellung, Umbenennen, Duplikate
  und Navigation. Dateifreigabe wird mit einer gekennzeichneten API-Testattrappe
  geprüft; ein nativer Teilen-Dialog benötigt weiterhin ein echtes Endgerät.
- Maßgeblich für Container und Browser sind die erfolgreichen Actions-Läufe des
  jeweiligen Release-Commits. Lokale Vorprüfungen ersetzen diese Freigabe nicht.
