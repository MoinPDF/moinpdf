# PDF-Arbeitsplatz

Deutschsprachiger PDF-Arbeitsplatz ohne Produktnamen. Die weiße Startseite zeigt ein animiertes Dokument als Uploadfeld in Grün, Türkis und Hellblau sowie dezente Einstiege für Kamera und Office-Dateien. Beim Einlesen mehrerer Dateien animieren ein Scan-Effekt, ein Dateisymbol und ein Fortschrittsbalken den Import; reduzierte Bewegung wird berücksichtigt. Nach dem Import fragt eine eigene Ansicht „Was möchtest du tun?“. Die lokale Suche schlägt passende Werkzeuge auch anhand natürlicher Formulierungen vor; alle 62 Werkzeugansichten sind zusätzlich als beschriftete Symbole erreichbar. Erst die Auswahl öffnet den Arbeitsplatz. „Werkzeug wechseln“ führt ohne Verlust der Dokumente zurück. Auf großen Bildschirmen bleiben Navigation, Kopfzeile und Anwenden-Schaltfläche sichtbar; auf schmalen Bildschirmen liegen die Einstellungen unter dem Dokument. 58 Werkzeuge verarbeiten Dokumente im Browser. Vier zusätzliche Ansichten verwenden auf ausdrücklichen Auftrag einen selbst betriebenen Dokumentenserver; ohne Serververbindung bleiben diese deaktiviert.

## Die bisherigen 44 Werkzeuge

- Check & Seitenfinder: dateiübergreifende Textsuche, lokale Scan-Erkennung, Trefferseiten als neue PDF; Hinweise auf Scan-Seiten, mögliche Leerseiten, optisch gleiche Seiten und unterschiedliche Papierformate
- OCR & Text: Deutsch, Englisch, gemischte Sprachen; korrigierbarer Text neben PDF-Vorschau
- Bilder zu PDF; PDF zu PNG/JPG im ZIP
- Scan-Komprimierung
- Zusammenfügen; einzelne Seiten als PDF im ZIP
- Seiten organisieren: auswählen, sortieren, drehen, duplizieren, entfernen und Leerseiten ergänzen
- Seitennummern
- Seitenformat: DIN A4 oder US Letter, Hoch- und Querformat
- Mehrere Seiten pro Blatt: 2 oder 4 Seiten
- Schwärzen
- Zuschneiden
- Textnotizen und grüne Markierungen
- Gezeichnete Unterschriften
- Wasserzeichen
- Graustufen
- PDF fixieren (Seitenbilder)
- Dokumentinfos entfernen
- Text bearbeiten, Inhalte entfernen und Bilder einfügen
- PDF-Informationen und Textvergleich zweier PDFs
- In Abschnitte teilen, abwechselnd zusammenfügen, Broschüren und Seiten aufteilen
- Weiße Ränder entfernen, Schwarzweiß-Scan und Farben umkehren
- Stempel, Metadaten bearbeiten, Anmerkungen entfernen und PDFs überlagern
- Dateianhänge und eingebettete Bilder extrahieren
- Formulare ausfüllen und erstellen; Lesezeichen bearbeiten
- PDF schützen (AES-256) und mit bekanntem Passwort entsperren
- E-Rechnungen lesen und mit einem Basischeck prüfen; UBL, UBL-Gutschriften und CII aus XML oder eingebetteten PDF-Anhängen

PDFs, Rechnungs-XML, JPGs und PNGs lassen sich überall ins Fenster ziehen. Die Seitenreihenfolge wird per Drag-and-drop oder über Pfeile geändert. Visuelle Bereiche lassen sich direkt aufziehen beziehungsweise platzieren oder über Prozentwerte eingeben. Die letzten 30 Seiten- und Bereichsänderungen können rückgängig gemacht und wiederholt werden (Strg/⌘ + Z und Strg/⌘ + Umschalt + Z). Nach dem Hinzufügen oder Schließen von Dateien beginnt der Verlauf neu.

Ergebnisse können als neue Arbeitsdokumente übernommen werden. OCR exportiert durchsuchbare PDF, TXT und DOCX (Text ohne Rekonstruktion des ursprünglichen Layouts). Seitenwerkzeuge übernehmen ausstehende visuelle Änderungen auf den ausgewählten Seiten. Die Arbeitsplätze für Formulare, Lesezeichen, Passwortschutz und E-Rechnungen verwenden die vollständige Quelldatei; Änderungen aus anderen Werkzeugen deshalb zuerst anwenden und als Arbeitsdokument übernehmen.

Dateien bleiben im Speicher der aktuellen Sitzung. Ergebnisse vor dem Schließen herunterladen. Obergrenzen: 80 MB Quelldateien und 200 Seiten. Umfangreiche OCR kann auf Mobilgeräten langsam sein.

## 18 neue Werkzeugansichten

- Stapelverarbeitung und gespeicherte mehrstufige Arbeitsabläufe mit JSON-Import/-Export; Passwörter und Dokumente werden nicht in Abläufen gespeichert.
- Automatische Dateinamenvorschläge aus Datum, Rechnungsnummer und Titel, mit bearbeitbarer Vorschau.
- Trennen nach Text, Lesezeichen, leeren Seiten oder QR-/Barcode-Trennblättern, mit Abschnittsvorschau.
- Tabellenbereiche zu Excel/CSV, OCR für Scans, manuelle Spaltengrenzen und bearbeitbare Zellen. XLSX speichert Werte als Text; CSV schützt vor Formelausführung.
- Suche nach eigenen Begriffen/Namen, E-Mails und möglichen IBANs; bestätigte Fundstellen werden durch vollständigen Neuaufbau der Seitenbilder entfernt. Erkennung ist keine Vollständigkeitsgarantie.
- Pixelbasierter PDF-Vergleich mit farbigen Unterschieden und prozentualem Anteil je Seite.
- Scanverbesserung mit automatischer Schieflagenkorrektur, Kontrast, Helligkeit und Hintergrundbereinigung.
- Deckblatt, klickbares Inhaltsverzeichnis und Lesezeichen mit angepassten Seitenzahlen.
- Serienformulare aus CSV/TSV mit Feldzuordnung, benannten Einzelausgaben im ZIP und optionaler Fixierung.
- QR, Code 128 und EAN-13 erzeugen und platzieren; verbreitete QR-/Barcodeformate auslesen.
- Interne und externe PDF-Links hinzufügen, ändern und entfernen; Vorschau und Koordinaten unterstützen gedrehte Seiten.
- Anhänge hinzufügen, ersetzen, umbenennen und entfernen; QPDF bereinigt nicht mehr referenzierte eingebettete Dateistreams.
- Kamera-/Fotoscanner mit Vierpunkt-Perspektivkorrektur, Scanbereinigung und bis zu 50 gesammelten Seiten.
- Vier **optionale Serverwerkzeuge**: Office zu PDF, PDF/A erzeugen/prüfen, vollständige KoSIT-XRechnung-Validierung und Zertifikatssignaturen. [Servereinrichtung und Grenzen](server/README.md).

## Sicherungsstand

Der private GitHub-Branch `checkpoint-44-tools` enthält den vor diesen Erweiterungen gesicherten Stand. `main` enthält die Erweiterungen. Die Sites-Quellhistorie wird zusätzlich vom Hosting geführt.

## Entwicklung und Prüfung

Node.js 22.13 oder neuer und pnpm verwenden. Nach `pnpm install` einmal `node scripts/prepare-pdf-assets.mjs` ausführen. Das Skript kopiert PDF-Worker, Schriftressourcen, OCR-Worker und Sprachdaten aus den gesperrten npm-Abhängigkeiten nach `public/vendor`. Der Build wiederholt diesen Schritt. Im verwalteten Sites-Umfeld die vorgesehenen Setup-, Vorschau- und Build-Hilfen benutzen.

- `pnpm test`: alle neun Browser-Testsuiten
- `pnpm test:advanced`: zusätzliche Dateiformate, Suchschwärzung, echte Anhangsbereinigung, Linkkoordinaten, Workflows, Codes und Kameraperspektive
- `pnpm test:pdf`: Reihenfolge, Drehungen, Seitenexport, ZIP, Nummerierung, Wasserzeichen und Eingabeprüfung
- `pnpm test:studio`: echte PDF.js-Exporte und Textextraktion, Schwärzungs-Pixel, Zuschneidegrenzen, Textnotizen, N-up, Papierformate, Leerseiten, Graustufen, Fixieren, Metadaten und Abbruch. Normalisierte Drehungen werden pixelweise mit der Originalvorschau verglichen. Nutzt die optionale Node-Canvas-Abhängigkeit von PDF.js.
- `pnpm test:check`: Textindex, Scan- und Leerseitenhinweise, Vorschau-Duplikate, gemischte Papierformate, Suche mit mehreren Begriffen, PDF aus Fundstellen und Abbruch
- `pnpm test:tools`: alle 62 Werkzeugnamen, 56 natürliche Suchanfragen, Konvertierungsrichtung, Teilbegriffe und unbekannte Vorhaben
- `pnpm test:editor`: Text entfernen/ersetzen, Bildplatzierung, Schriftvarianten, gedrehte und zugeschnittene Seiten
- `pnpm test:extra`: zusätzliche Seitenwerkzeuge, Scanfilter, Anhänge, Metadaten und PDF-Vergleich
- `pnpm test:documents`: Formularwerte und Felder, Lesezeichen, Bilderextraktion und Erhalt bestehender Dokumentfunktionen
- `pnpm test:security`: AES-256 mit unabhängigem PDF.js-Leser, falsche und Unicode-Passwörter, Berechtigungen, Formulare/Anhänge sowie UBL/CII, XML-Fehler, Summen, Exporte und unveränderte Rechnungs-XML
- `pnpm exec tsc --noEmit` und Produktionsbuild

Browserprüfung: Mehrfachimport, neue Werkzeugauswahl, natürliche Suchanfrage mit Enter-Auswahl, Aufruf per Symbol, Rückkehr bei erhaltenen Dokumenten und mobiler Auswahlseite ohne horizontales Scrollen; drei Trefferseiten aus zwei Dateien einschließlich einer per OCR erkannten Scan-Seite, Treffer-PDF mit drei Seiten, Duplikate abwählen und Rückgängig, Rückkehr zur reinen Uploadfläche; Schwärzen, Ergebnisübernahme, Rückgängig/Wiederholen, Zeichnen und Einfügen einer Testunterschrift, OCR mit ausstehenden Änderungen und PDF/Text-Vergleich; Smartphone-Breite von 390 CSS-Pixeln mit einklappender Werkzeugleiste und Duplizieren. Export-PDFs werden zusätzlich direkt in der App geöffnet. Die automatisierte Browserumgebung beschränkt Blob-Downloads; die heruntergeladenen Dateien werden deshalb über die Engine-Tests statt über den Browser-Downloadkanal geprüft.

## Verhalten und Grenzen

- Check und Seitenfinder prüfen importierte Seiten. Für ausstehende visuelle Änderungen zuerst das Ergebnis anwenden und weiterbearbeiten. Die Scan-Erkennung im Seitenfinder erstellt nur einen lokalen Suchindex; für eine dauerhaft durchsuchbare PDF das OCR-Werkzeug verwenden. Kommagetrennte Suchbegriffe werden als Oder-Suche behandelt, jeweils ab zwei Zeichen.
- Leerseiten- und Duplikaterkennung sind Hinweise anhand von Text, Seitenbild und Seitengröße. Kleine Unterschiede können in der Vorschau fehlen. Abwählen entfernt Seiten nur aus der Exportauswahl und kann rückgängig gemacht werden.

- Schwärzungen werden zuletzt in die gerenderten Pixel der betroffenen Seiten eingerechnet. Die neue Seite enthält ausschließlich dieses geänderte Bild; ursprüngliche Seitenobjekte und Textebenen werden nicht übernommen. Andere Seiten bleiben unverändert. Ergebnis vor der Weitergabe prüfen.
- Zugeschnittene Seiten werden aus dem ausgeschnittenen Pixelbereich neu erzeugt. Inhalte außerhalb dieses Bereichs werden entfernt. Schwärzen, Zuschneiden, Graustufen und Fixieren begrenzen die längste Rasterseite auf 2800 Pixel; die maximale Skalierung beträgt 4,2.
- Textnotizen, Markierungen und Unterschriften erhalten vorhandenen Text, sofern auf derselben Seite kein Rasterwerkzeug angewendet wird. Unterschriften sind eingefügte Bilder, keine Zertifikatssignaturen. Textnotizen unterstützen lateinische Schrift einschließlich Umlauten. Vor dem Drehen visuelle Änderungen anwenden und das Ergebnis weiterbearbeiten.
- Entfernen der Dokumentinfos löscht das Info-Wörterbuch sowie Dokument- und Seiten-XMP. Sichtbare Inhalte, Kommentare, Bilder und eingebettete Objektdaten werden damit nicht anonymisiert.
- OCR übernimmt vorhandenen Text ab 20 Nicht-Leerzeichen. Für gemischte Text- und Scanbereiche „Alle Seiten neu erkennen“ aktivieren. Korrekturen im Textfeld betreffen TXT, DOCX und Zwischenablage; die OCR-PDF enthält das ursprüngliche Erkennungsergebnis.
- Scan-Komprimierung erzeugt Bildseiten und entfernt dabei kopierbaren Text, Links und Formularfunktionen. Eine kleinere Datei ist nicht garantiert.
- Exporte erzeugen neue Dateien. Seitenbasierte Exporte können Formularfelder fixieren und dokumentweite Funktionen wie Lesezeichen verlieren. Die Werkzeuge für Formulare und Lesezeichen erhalten die jeweils anderen Dokumentfunktionen; PDF schützen/entsperren erhält Seiten, Formulare, Lesezeichen und Anhänge. Vorhandene digitale Signaturen können durch Änderungen ungültig werden.
- Geschützte PDFs werden nach Passwortabfrage lokal entschlüsselt. Öffnungsschutz verwendet AES-256; Druck-, Kopier- und Bearbeitungsregeln hängen zusätzlich vom PDF-Programm ab. Passwörter werden nicht dauerhaft gespeichert.
- E-Rechnungen: höchstens 5 MB je XML und 2.000 Positionen. Der Basischeck prüft grundlegende Angaben, Datums-/Zahlenformate und ausgewählte Summen, aber keine vollständige XSD-, EN-16931-, KoSIT-, Peppol- oder PDF/A-Konformität. Nicht berechenbare Positionen werden als Hinweis ausgewiesen. Zahlungsbedingungen bleiben auch ohne separate Bankangaben sichtbar. Lese-PDF und Prüfbericht enthalten die unveränderte XML als Anhang; sie sind keine zertifizierten ZUGFeRD- oder PDF/A-Dateien.
- Ressourcen und OCR-Sprachdaten kommen vom gleichen Ursprung. Hosting-Zugriffe und die Hosting-Anmeldung sind unabhängig von der lokalen Dokumentverarbeitung.
- Optionale WebMCP-Werkzeuge registrieren sich nur, wenn `document.modelContext` verfügbar ist. Im HTTP-Vorschau-Browser fehlt diese Schnittstelle; die UI funktioniert unabhängig davon.

## Bibliotheken

PDF.js, Tesseract.js und deutsche/englische Sprachdaten (Apache-2.0), pdf-lib, JSZip und docx (MIT), Manrope und Space Grotesk (SIL Open Font License). Lizenztexte werden aus den Paketen unter `public/vendor/licenses` mitgeliefert. qpdf/WASM für Verschlüsselung, fontkit und Noto Sans für die E-Rechnungs-Leseansicht werden ebenfalls lokal ausgeliefert; zugehörige Lizenztexte liegen unter `public/vendor`. Für Codes kommen bwip-js und ZXing hinzu; ihre Lizenztexte werden ebenfalls mitgeliefert. Die Browserfunktionen verwenden lokal ausgelieferte Ressourcen.
