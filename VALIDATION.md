# Prüfungen und belegter Versionsstand

**Deutsch** · [English](VALIDATION.en.md) · [← README](README.md)

Die Versionsnummer steht in [package.json](package.json). Ein erfolgreicher
Prüflauf belegt ausschließlich den dort angezeigten Commit, keine späteren
Änderungen oder beliebigen Dokumente.

## Prüfplan für 0.30.0

- 73 Engine-/DOM-Suiten; neu sind centgenauer Zahlungsabgleich, Rundung und Fehlerfälle beim Rechnungsentwurf, unveränderte Portfolio-Anlagen mit SHA-256 sowie native Ebenenzuordnung mit unabhängiger Pixelprüfung.
- Sechs zusätzliche Servertests prüfen reale KoSIT-Szenarien einschließlich Rundung/Befreiung und absichtlich falscher Angaben, Mustang plus beide PDF/A-Prüfungen, lizenzierte deutsche Handschrift, PDF/X mit unabhängigen Teilprüfungen und OCR/Trennung/Ablage in Eingangsordnern. Die Containerprüfungen laufen ohne Netzwerk; Laufzeit-Telemetrie wird bei ONNX ausdrücklich deaktiviert.
- Neue Produktions-Browserabläufe prüfen Rechnungseingaben und PDF-Ausgabe, Entwertung einer Prüfbestätigung nach Änderungen, bytegenaue Portfolio-Dateien, gespeicherte Ebenen und den Export der Ordnerautomatik in Chromium, Firefox und WebKit. Deutsch auf Desktop, Englisch mit schmaler Touch-Emulation; keine physischen Geräte.
- Im vollständigen Containeraufbau prüfen zusätzliche Browserabläufe echte XRechnung-/ZUGFeRD-Downloads, PDF/X mit Teilprüfbericht sowie korrigierte Handschrift mit bestätigtem Suchtext. Änderungen entwerten vorherige Prüfbestätigungen und Ergebnisse.
- 127 Werkzeugansichten und deutsche/englische Informationsseiten bleiben Teil der Sprach- und Layoutprüfungen. Native Safari-Tests sind ein separater Prüfstand und nicht mit WebKit gleichzusetzen.
- Pull Request und tatsächlicher main-Commit müssen alle Verifikationsworkflows bestehen. Images und Release folgen erst danach. Ein lokaler oder abgebrochener Teiltest ersetzt keine Freigabe.
- Handschrift-Testbilder stammen aus einer Trainingsquelle des Modells: Integrationsnachweis, kein unabhängiger Qualitätsbenchmark. PDF/X bleibt eine technische Teilprüfung ohne vollständiges ISO-Zertifikat. E-Rechnungsvalidierung ist keine steuerliche Einzelfallprüfung.

## Prüfplan für 0.29.0

- 72 Engine-/DOM-Suiten prüfen unter anderem PDF-Bearbeitung, OCR, Komprimierung, Konvertierung, Wiederherstellung, Projekte, DATEV-Export und die Logoanimation einschließlich Ton, Abbruch und reduzierter Bewegung.
- Die Drucklayout-Prüfungen lesen echte Ausgaben für 2/4/6/8/9/16 Seiten pro Blatt im Hoch- und Querformat. Lesezeichen-Tests prüfen CSV-/JSON-Rundläufe, Seitengrenzen, Hierarchie und sichere Tabellenwerte.
- 73 Dokumentenserver-Tests umfassen acht neue Prüfungen für FB2/CBZ/XPS/OXPS sowie Eingangsordner: reale Konvertierungen, Archiv-/XML-Abweisung, Originalerhalt, Neustarts, Wiederholungen, Abbruch, Signaturfelder und isolierte Dateizugriffsfehler.
- Alle 121 Werkzeugansichten und verfügbaren Auswahlmenüs werden auf englische Texte geprüft. Sprachwechsel und Neuladen müssen Originaldokumente und Einstellungen erhalten. Die deutschen und englischen Informationsseiten werden einschließlich Suche, Druck und Downloads geprüft; schmale Ansichten reichen bis 320 Pixel.
- Die Browsermatrix prüft echte Ausgaben in Chromium, Firefox und WebKit. Native Safari-Prüfungen laufen auf `macos-15-intel`; dieser Prüfstand ist von WebKit und physischen iPhones/iPads getrennt. Ein Betriebssystem-Dateidialog gilt nicht als geprüft, wenn SafariDriver nur den dokumentierten In-Memory-Dateipfad unterstützt.
- Die vollständige Docker-Prüfung umfasst Dokumentenserver, Übersetzung in sieben Sprachen, lokale Sprachausgabe und KI, Netzwerkschutz, Zugriffsschutz, echte Konvertierungen und den Erhalt von Modellen und Zugangsdaten beim Neustart.
- Eine Freigabe erfordert erfolgreiche Prüfungen des Pull Requests und des tatsächlichen `main`-Commits. Erst danach werden die vier Images für amd64/arm64 und der Release mit festen Image-Digests veröffentlicht. Der Store übernimmt genau diese freigegebenen Image-Referenzen.
- Physische Endgeräte, native Teilen-Dialoge und die konkrete Installation beim Betreiber sind durch die automatisierte Prüfung nicht abgedeckt. Frühere Nachweise gelten nur für ihre angegebenen Commits; die Links zum jeweiligen Release und seinen Actions-Läufen liefern den aktuellen Ausführungsnachweis.

## Prüfplan für 0.24.0

- 66 Engine-/DOM-Suiten einschließlich Klar Schiff, Formularprofilen, A4-Belegen und Kopf-/Fußzeilenbereinigung. Die neuen Browserabläufe prüfen tatsächliche PDF-Downloads in Chromium, Firefox und WebKit auf Desktop und mit schmaler Touch-Emulation.
- Native Safari-Prüfung auf `macos-15-intel` mit unverändertem Testumfang; physische Geräte und iOS sind davon getrennt zu prüfen.
- Freigabe erst nach erfolgreichen PR-Prüfungen und den erneuten Prüfungen des tatsächlichen `main`-Commits. Die vollständige Veröffentlichung umfasst zusätzlich vier Docker-Images mit amd64/arm64 und den Release samt unveränderlichen Image-Referenzen. Fehlende Runner oder übersprungene Prüfungen gelten nicht als erfolgreich.

## Ergänzte Prüfungen: Schwärzung, große PDFs und Regeln

- `native-redaction-smoke.mjs`: echte Textentfernung, vollständig erfasste Links, übrige Vektoren und Texte, vier Rotationen mit CropBox, bereinigte Metadaten und dekodierte Ausgabestreams; Abweisung unklarer Strukturen und Abbruch.
- `large-document-smoke.mjs`: 101 Seiten über drei Abschnitte, Original- und Ausgabeprüfung, Abbruch/Fortsetzen, Sperren zwischen Tabs, atomare Ablehnung bei voller Ablage, beschädigte Abschnitte und vollständiges Löschen. Die Node-Canvas-Testumgebung ist kein Browser.
- `optimizations-browser.py`: echte Produktions-Worker und Downloads, 1.000 Seiten im Desktop-Ablauf sowie eine 81-MiB-Eingabe mit schmaler Touch-Emulation. Dauerhafte, isolierte Browserprofile prüfen die dateibasierte Ablage; ein separater privater WebKit-Fall prüft die klare Speicherablehnung und weiterhin bedienbare Oberfläche. Jede Seite wird unabhängig mit PyMuPDF gelesen; keine physischen Geräte oder native Safari-Abdeckung dieser neuen Abläufe.
- Klar-Schiff-Prüfungen: wiederverwendete Layoutregel, neue Dokumentnummer, konkurrierende Regeln, unsichere OCR, Schema und sichtbare Speicherung in DE/EN. Regeln bestätigen niemals Dokumente automatisch.

## Bisheriger Prüfplan für 0.22.0

- Neue 0.22-Prüfungen: zwei Word-Ziele mit erweiterten Optionen, Unicode-Zeichenabstände, gedrehte Ersatzschrift-Metriken, gebündelte Vorprüfhinweise, abbrechbare Bildkodierung, sichtbare Vorschaupriorität, OCR-Pause bei Eingaben und horizontale Cursorführung samt simuliertem mobilem Sichtbereich.
- 60 Engine-/DOM-Suiten einschließlich echter PDFs, unabhängiger AES-GCM-Entschlüsselung,
  falscher Passwörter, manipulierten/abgeschnittenen Projektdateien und Abbruch.
- Vorschau-Regressionen prüfen den sofortigen Abbruch unsichtbarer Arbeit, das
  Freigeben der Warteschlange sowie begrenzte Bildablage und erneutes Laden.
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
  Die Grenzen bleiben bei 80 MiB aktiven Quelldateien insgesamt und 200 aktiven Seiten.
- Physische iPhones/iPads/Android-Geräte, native Teilen-Dialoge und Microsoft Word
  sind weiterhin offen; die [Gerätecheckliste](docs/quality/editor-device-checklist.md)
  trennt diese Fälle ausdrücklich von Desktop-Engines und Touch-Emulation.
- Maßgeblich ist der erfolgreiche Actions-Lauf des jeweiligen Commits. Neue
  Prüffälle und lokale Vorprüfungen sind kein Ersatz für diesen Release-Nachweis.

## Nachprüfung des WebKit-Hängers

Der [unveränderte Ausgangsstand](https://github.com/MoinPDF/moinpdf/actions/runs/40216810705)
bestand 25 aufeinanderfolgende Formular-Exporte. Ein gezielt zurückgehaltener
`GetOperatorList`-Auftrag belegte dagegen, dass „Abbrechen“ auf eine Worker-Antwort
wartete. Das belegt die Abbruchschwachstelle, nicht den internen Auslöser des
ursprünglichen einmaligen WebKit-Hängers.

`tests/pdf-session-smoke.mjs` prüft elf Lebenszyklus- und Exportprüfungsfälle mit kontrollierter Uhr.
`tests/editor-verification-browser.py` ergänzt je Engine fünf echte Formular-Exporte
und vier ausdrücklich injizierte Fehlerfälle: Abbruch, automatische Wiederholung,
zweimalige Zeitüberschreitung und blockierte Schriftladung. Heruntergeladene PDFs
werden unabhängig auf Text, drei Formularfelder und unveränderte Seitenpixel geprüft.
Native macOS-Safari-Prüfungen kontrollieren zusätzlich echten Download sowie Abbruch
und erneuten Export. Maßgeblich bleibt der erfolgreiche Lauf des jeweiligen Commits.


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
| PDF-Engines und DOM | 73 Suiten mit echten PDFs, unabhängigen Lesern, Text-, Pixel-, Formular-, Link- und Verschlüsselungsprüfungen |
| Dokumentenserver | Tests für native Konverter, Authentifizierung, Größen- und Zeitgrenzen, Übersetzung, Bereinigung, Audio, Barrierefreiheit, Langzeitsignaturen und Upload-Parser |
| Integration | Echte Office-Konvertierung, Deutsch/Englisch-Übersetzung, lokale Sprachausgabe, Neustart und erhaltene Modelle |
| Oberfläche | Alle Werkzeugansichten auf Desktop und schmalen Touch-Ansichten, PDF-/EPUB-/Audio-Downloads |
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
  PDF-Text- und OCR-Prüfungen laufen unter Firefox sowie nativem Safari auf
  macOS-CI. Die separate Editor-Matrix nutzt WebKit; diese belegt keinen
  nativen Safari- oder iOS-Test.
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
