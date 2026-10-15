# Prüfungen und belegter Versionsstand

**Deutsch** · [English](VALIDATION.en.md) · [← README](README.md)

Die Versionsnummer steht in [package.json](package.json). Ein erfolgreicher
Prüflauf belegt ausschließlich den dort angezeigten Commit, keine späteren
Änderungen oder beliebigen Dokumente.

## Automatisierte Prüfungen

| Bereich | Umfang |
| --- | --- |
| Quellcode | TypeScript, ESLint ohne Warnungen, einheitliche Formatierung und Abhängigkeitsprüfung |
| Browser-Engines | 33 Suiten mit echten PDFs, unabhängigen Lesern, Text-, Pixel-, Formular-, Link- und Verschlüsselungsprüfungen |
| Dokumentenserver | 60 Tests: native Konverter, Authentifizierung, Größen- und Zeitgrenzen, Übersetzung, Bereinigung, Audio, Barrierefreiheit und Langzeitsignaturen und Upload-Parser |
| Integration | Echte Office-Konvertierung, Deutsch/Englisch-Übersetzung, lokale Sprachausgabe, Neustart und erhaltene Modelle |
| Oberfläche | Alle Werkzeugansichten auf Desktop und Mobilgerät, PDF-/EPUB-/Audio-Downloads |
| Dokumentation und Medien | Suche, Kategorien, Druck, Downloads, Video, keine horizontalen Überläufe und erhaltene Arbeitsdateien |
| Rechtsseiten | 1440, 390 und 320 Pixel, grüne Schrift, Kontaktlinks und Abstand zwischen Anschrift und E-Mail |
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
- Browserprüfungen laufen unter Chromium. Andere Browser und konkrete
  Smartphones können abweichendes Verhalten zeigen.
- Die eigene Serverinstallation und ihre öffentliche Domain müssen
  separat mit künstlichen Testdokumenten geprüft werden.
- Große oder ungewöhnliche Dokumente können Konvertergrenzen erreichen.
  Ergebnisse am Original kontrollieren.
- Die vollständige Docker-Installation enthält den Dokumentenserver. Serveradresse und
  API-Schlüssel werden nicht manuell im Browser eingetragen.
- Ein statischer Web-Build allein stellt keinen laufenden Dokumentenserver
  bereit; `/api/documents/*` benötigt die zugehörige Serverinstallation.
