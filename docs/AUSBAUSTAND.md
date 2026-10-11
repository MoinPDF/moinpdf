# Ausbau nach dem Funktionsvergleich

Stand: 11. Oktober 2026, Entwicklungsversion 0.6.0.

Dieser Ausbau ist die erste implementierte Etappe. Eine größere Zahl von
Werkzeugen allein belegt keinen Gesamtsieg im Produktvergleich. Die folgende
Liste trennt nutzbare Erweiterungen von verbleibender Arbeit.

| Bereich | In dieser Etappe umgesetzt | Verbleibende Arbeit |
| --- | --- | --- |
| 1. Nativer Texteditor | Vorhandene Textobjekte in Originalschrift ändern; Suchen/Ersetzen pro Seite; übrigen Text erhalten | Absatzumbruch, Schriftwechsel mit vollständiger Glyphenabdeckung, objektübergreifende Textbearbeitung |
| 2. Bilder und Grafiken | Vorhandene Objekte bewegen, drehen, skalieren und löschen; Bilddaten ersetzen | Unterobjekte verschachtelter Gruppen einzeln bearbeiten, direkte Griffpunkte in der Vorschau |
| 3. Lokales Office zu PDF | Technische und Lizenzprüfung; bestehende Serverkonvertierung bleibt verfügbar | Einen reproduzierbar gebauten, lokal ausgelieferten LibreOffice-WASM-Laufzeitkern integrieren; die JavaScript-Brücke allein genügt nicht |
| 4. PDF zu Office | Bestehende Konvertierungen bleiben erhalten | Bearbeitbare Folien und zuverlässigere Layout-/Tabellenrekonstruktion |
| 5. OCR | 21 lokale Sprachmodelle, Deutsch/Englisch kombiniert, fünf Einstellungen zum Seitenaufbau | Automatische Spracherkennung und beliebige Sprachkombinationen |
| 6. Importformate | WebP, BMP, mehrseitige TIFF und eigenständige SVG zusätzlich zu bisherigen Formaten | HEIC, Pages, Visio, Publisher und PSD; SVG-Import erhält hier ein Seitenbild, keine editierbaren Vektoren |
| 7. Exportformate | WebP, TIFF, BMP sowie JSON mit Text und Positionen | Echter Vektor-SVG-Export |
| 8. Arbeitsabläufe | Wenn-/Sonst-Schritte nach Dateiname, vorhandenen Texten oder Seitenzahl; Speichern/Import/Export; Entscheidungsprotokoll | Freies Knotendiagramm, verschachtelte Verzweigungen und weitere Schrittarten |
| 9. XFA | Bestehende Erkennung und Hinweise | Dynamische XFA-Anzeige, Bearbeitung und verlässlicher Export |
| 10. Ebenen | Namen, Ebenenliste und anfängliche Sichtbarkeit speichern; Ebenen bleiben schaltbar, Text und Vektoren erhalten | Ebeneninhalte erstellen/verschieben, Ebenen dauerhaft entfernen und Zeichenreihenfolge bearbeiten |
| 11. Nummerierung | Dateiübergreifende Bates-Zählung, Vorlagen für Kopf-/Fußzeilen, interne Seitenbezeichnungen | Mehrere gleichzeitig unterschiedliche Kopf-/Fußzeilen und komplexe Abschnittsregeln |
| 12. Signaturen | Bestehende Zertifikatssignaturen | Vertrauenswürdige Zeitstempel, Widerrufsprüfung und vollständige Langzeitvalidierung |
| 13. Seitenwerkzeuge | Beliebige Winkel, lange Seite, Posterdruck mit Überlappung | Vorschau direkt bei Parameteränderung und weitere Druckvorlagen |
| 14. Optimierung | QPDF-Linearisierung für schnelle Webansicht | Vollständiges Einbetten fehlender Schriften und Umwandlung von Schrift in Pfade |
| 15. Vektorerhaltende Schwärzung | PDFium-Grundlage mit Tests für Textbereiche und Bilddaten | Zusätzliche Sicherheitsfälle und Integration in das Schwärzwerkzeug; vorhandene sichere Raster-Schwärzung bleibt der freigegebene Weg |
| 16. Barrierefreiheit | Bestehende Prüfungen | Struktureditor, Lesereihenfolge, Alternativtexte und validierter PDF/UA-Export |
| 17. Druckvorbereitung | Bestehende Prüfung und neuer Posterdruck | Farbmanagement, Beschnitt, Schriftenkorrekturen und validierter PDF/X-Export |
| 18. Übersetzung | Bestehende Übersetzung | Originaltreue Platzierung übersetzter Absätze und Umgang mit Textüberlauf |
| 19. Dokumentvergleich | Bestehender Pixel-/Text-/Zahlenvergleich | Robuste inhaltliche Zuordnung verschobener Absätze und Seiten |
| 20. Lokaler Assistent | Bestehende Suche und neuer strukturierter Export als Grundlage | Lokales Sprachmodell, quellengebundene Antworten und überprüfbare Zitate |
| 21. Große Dateien | Neuer PDFium-Worker kann abgebrochen werden; Arbeitsspeicher wird nach Aufträgen freigegeben | Durchgängige Worker-Verarbeitung, Streaming und belegbare höhere Dateigrenzen; aktuell weiterhin 80 MB/200 Seiten |
| 22. Lokale Projekte | IndexedDB-Projekte mit fünf Arbeitsständen; Dateien, Seiten, Editor, Formulare, Lesezeichen und Rückgängig-Verlauf wiederherstellen | Projektdatei für Übertragung zwischen Browsern; Einstellungen aller Spezialwerkzeuge separat speichern |

## Prüfung

18 Engine-Testsuiten. Neue Prüfungen lesen bearbeitete PDFs unabhängig mit
PDF.js, kontrollieren Seitenkoordinaten bei allen rechtwinkligen Drehungen und
CropBox-Offsets, erhaltene Texte, entfernte Originaltexte, geänderte Bildpixel,
echte QPDF-Linearisierung, TIFF/BMP-Pixel und lokale Projektversionen. Alle 21 ausgelieferten Sprachmodelle werden offline initialisiert; Französisch wird mit einem tatsächlichen Erkennungsauftrag geprüft.
Typprüfung, Linter, Formatprüfung und beide Produktionsbuilds gehören zur
Freigabe. Eine interaktive Browserprüfung ist in dieser Arbeitsumgebung nicht
verfügbar; sie bleibt vor einer uneingeschränkten Oberflächenfreigabe offen.

## Komponenten und Lizenzen

PDFium wird über `@embedpdf/pdfium@2.15.1` eingesetzt. Der Wrapper steht unter
MIT, der PDFium-Kern unter Apache-2.0 mit weiteren Drittanbieterhinweisen.
Die mitgelieferten `LICENSE`- und `LICENSE.pdfium`-Dateien werden vollständig
unter `/vendor/licenses/` ausgeliefert. TIFF verwendet UTIF; Sprachdateien
stammen aus den gepinnten Tesseract-Datenpaketen. Diese Ergänzungen ändern
nicht die Lizenz des MoinPDF-Projekts.
