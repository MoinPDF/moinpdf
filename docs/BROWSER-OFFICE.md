# Lokales Office zu PDF

**Deutsch** · [English](BROWSER-OFFICE.en.md) · [← README](../README.md)

MoinPDF 0.11.0 verwendet `@matbee/libreoffice-converter` 2.7.2 mit LibreOffice/WASM. Word, Excel, PowerPoint, OpenDocument und RTF werden standardmäßig im Browser verarbeitet. Pages, Visio und Publisher bleiben Funktionen des eigenen Dokumentenservers. Ein fehlgeschlagener lokaler Auftrag wird nicht automatisch hochgeladen.

Die Eingabegrenze beträgt 40 MB. Die Laufzeit benötigt HTTPS oder localhost, COOP/COEP, SharedArrayBuffer und DecompressionStream. Sie reserviert 1 GiB gemeinsamen WASM-Speicher; insgesamt ist mehr als 1 GB freier Arbeitsspeicher erforderlich. Auf speicherarmen Mobilgeräten ist dieser Modus nicht verlässlich nutzbar.

Beim ersten Start werden rund 75 MB komprimierte Programmdaten vom selben Ursprung geladen. Gepinnte Prüfsummen sichern Archiv, Einzelteile und entpackte Ressourcen. Ein optionaler Browser-Cache speichert ausschließlich Programmdateien. Dokumente und Ergebnisse werden nicht darin abgelegt. Manifest und JavaScript müssen weiterhin erreichbar sein; dies ist kein vollständiger Offline-Modus. Nach Erfolg, Fehler und Abbruch wird zuerst das Destroy-Protokoll ausgeführt und der Pthread-Pool beendet. Antwortet die Laufzeit nicht, folgt nach höchstens einer Sekunde die harte Terminierung. Der nächste Auftrag startet eine frische Laufzeit.

## Quellen und Komponenten

- [Matbee-Quellstand](https://github.com/matbeedotcom/libreoffice-document-converter/tree/b72a3d584bc28c5111afafcf25def7a24fb5fcb0)
- [LibreOffice-Core](https://github.com/LibreOffice/core/tree/d1c9e0e4e1ddeb24fe8f93e56860b3765043f8b1)
- [Mitgelieferte Hinweise, Quellverweise und Fontquellen](../public/component-notices/browser-office/README.txt)

TGZ-SHA256: `14d670936fe220ee49becbfd40bf233ceabb94981fa9987fccde345449ee2c3a`.

PDF-Exporte verwenden direkt Laden und Speichern; zusätzliche Editor-Seitenabfragen sind nur für Bildexporte erforderlich. Die Seitenzahl der PDF wird anschließend aus der erzeugten Datei gelesen.
`scripts/prepare-office-assets.mjs` erzeugt die Laufzeit bei jedem Produktionsbuild aus diesem verifizierten Archiv. Alle 137 eingebetteten Font-Pfade sind inventarisiert. Die Sammlung enthält verschiedene Lizenzen; MPL-2.0 ist keine pauschale Lizenz aller Fonts und Bibliotheken. Der LibreOffice-Lizenzkatalog enthält auch optionale Komponenten, keine genaue Liste aller statisch eingebundenen Bibliotheken.

Der Browser-Worker wird für die reine Konvertierung angepasst: `noInitialRun=true` verhindert, dass Emscripten neben LibreOfficeKit eine zweite Office-Anwendung auf einem Hintergrundthread startet. Die nur für Editor-Eingabeereignisse benötigten Dummy-Poll-Callbacks werden für die reine Konvertierung nicht registriert, damit der reguläre LibreOfficeKit-Yield-Pfad den XLSX-Import abarbeiten kann; die ausführliche LibreOffice-Debug-Ausgabe respektiert `verbose=false`. Die exakten Änderungen liegen in `MOINPDF-PATCHES.json` neben den unveränderten Originalquellen. Der Build bricht bei abweichendem Quelltext ab und berechnet die Prüfsumme des angepassten Workers neu. Vor den ersten nativen Aufrufen wartet der Adapter auf die Bereitschaft aller vorab gestarteten Pthreads. Grafikimport, Bildskalierung und Formelberechnung werden mit den vorgesehenen LibreOffice-Umgebungsoptionen sequenziell ausgeführt. Diese Optionen werden in `preRun` vor der Initialisierung der nativen Umgebung gesetzt; ein nachträgliches Ändern von `Module.ENV` reicht wegen des Emscripten-Umgebungscaches nicht aus. Der Thread-Pool enthält acht vorab geladene Worker. Synchrone native Thread-Starts dürfen keinen neuen Browser-Worker nachladen, weil dieser erst nach Rückkehr zur JavaScript-Ereignisschleife starten könnte. Der Adapter prüft deshalb bei jedem Start die Bereitschaft und bricht bei erschöpftem Pool ausdrücklich ab. Der Browsertest erfasst diese Starts und den verfügbaren Pool. WASM und eingebettete Ressourcen bleiben unverändert. Grundlage: [Emscripten pthreads – Special considerations](https://emscripten.org/docs/porting/pthreads.html#special-considerations).

## Verifikation

Beim Beenden bestätigt die Laufzeit zuerst die Dokumentbereinigung. Danach beendet ausschließlich der aufrufende Browser-Code den gesamten Worker-Baum; ein konkurrierender Selbstabschluss der Laufzeit ist entfernt. Reagiert die Laufzeit nicht, greift nach einer Sekunde der erzwungene Abbruch. Die Prüfung auf verbliebene native Hintergrundthreads bleibt unverändert.

`tests/browser-office-browser.py` konvertiert im echten Produktions-Chromium sechs Office-/ODF-Fixtures und drei reichere DOCX-/XLSX-/PPTX-Dateien. MuPDF prüft Text, Umlaute, Bilder, Tabellen-/Diagrammzeichnungen, den errechneten Betrag 53,30 und beide Präsentationsseiten. Zusätzlich werden 15-maliger Abbruch mit Wiederanlauf ohne Neuladen, weitere Konvertierungen nach Erfolg, gesperrte Binärdownloads, fehlende Dokument-Uploads und vollständig beendete Office-Worker geprüft. Der aktuelle GitHub-CI-Lauf entscheidet über die Freigabe.

Komplexe Layouts, fehlende Schriften, Makros und externe Datenquellen können abweichen. Makros werden nicht freigeschaltet; der Adapter bietet keine freien Ladeoptionen oder Dokumentpasswörter. Eine allgemeine Originaltreue oder PDF/A-Konformität wird nicht behauptet. Ausgaben vor ihrer Verwendung kontrollieren.
