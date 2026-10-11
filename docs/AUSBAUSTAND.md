# Ausbau nach dem Funktionsvergleich

Stand: 11. Oktober 2026, Version 0.9.1.

Diese Übersicht beschreibt den tatsächlichen Umfang. Der ursprüngliche Plan mit
22 Bereichen ist noch nicht vollständig abgeschlossen. Nicht unterstützte
Konvertierungen und Prüfstandards werden nicht als verfügbar ausgewiesen.

| Bereich | Umgesetzt | Verbleibende Arbeit |
| --- | --- | --- |
| 1. Nativer Texteditor | Originalobjekte und Absätze; bis zu 32 Formatbereiche mit Schrift, Größe und Farbe; Ligaturen und kombinierende Zeichen; automatische zusätzliche Folgeseiten; echte Vorschau und Überlaufprüfung | Rechts-nach-links-Schrift und beliebige komplexe Leserichtungen; Unterobjekte verschachtelter Gruppen |
| 2. Bilder und Grafiken | Objekte bewegen, drehen, skalieren, ersetzen, löschen und in ihrer Zeichenreihenfolge ändern; direkte Griffpunkte mit Tastaturbedienung | Einzelne Unterobjekte verschachtelter Gruppen |
| 3. Lokales Office zu PDF | LibreOffice auf dem eigenen Dokumentenserver; alternative Browserkerne geprüft | Zuverlässiger, verteilbarer Browserkern für Word, Excel und PowerPoint; konkrete Hindernisse in [BROWSER-OFFICE.md](BROWSER-OFFICE.md) |
| 4. PDF zu Office | Word-Rekonstruktion, Tabellenexport und bearbeitbare PowerPoint-Textfelder mit Stil und Position | Allgemeine originalgetreue Rekonstruktion komplexer Tabellen und Layouts |
| 5. OCR | 21 lokal ausgelieferte Modelle; bis zu acht gemeinsam; automatische Sprachprobe pro Scan-Seite mit bewusster Ablehnung kurzer oder unklarer Texte | Vollständige Spracherkennung bei Handschrift, sehr kurzen Texten und beliebigem Sprachmix wird nicht garantiert |
| 6. Importformate | HEIC/HEIF und PSD im lokalen Worker, WebP, BMP, mehrseitige TIFF, SVG; Pages 4/5, Visio und Publisher über LibreOffice; Integritäts-, Format- und Größenprüfungen | SVG-Import wird als Bildseite übernommen; PSD-Ebenen werden nicht als editierbare PDF-Ebenen importiert |
| 7. Exportformate | WebP, TIFF, BMP, JSON mit Positionen und echter SVG-Vektorexport | SVG-Vektorexport benötigt den Dokumentenserver |
| 8. Arbeitsabläufe | Frei angeordnete Knoten, verschachtelte Ja/Nein-Zweige, mehrere Schrittarten, Import/Export und Entscheidungsprotokoll; Prüfung auf Schleifen und unerreichbare Knoten | Durchgängig im Hintergrund laufende Verarbeitung großer Stapel |
| 9. XFA | Erkennung vor der Formularverarbeitung; verlustbehaftete Formular- und Seitenübernahme wird abgelehnt; Lesezeichenänderungen erhalten XFA-Pakete; verständliche Hinweise | Dynamische XFA-Anzeige, Bearbeitung und verlässlicher Export |
| 10. Ebenen | Namen und Sichtbarkeit bearbeiten; dauerhaftes Reduzieren der sichtbaren Ebenen; Zeichenreihenfolge von Seitenobjekten | Ebeneninhalte erstellen und beliebige Objekte zwischen Ebenen verschieben |
| 11. Nummerierung | Dateiübergreifende Bates-Zählung, mehrere unabhängige Kopf-/Fußzeilenregeln, Seitenbereiche und interne Seitenbezeichnungen; Überlappungsprüfung | Beliebige verschachtelte Abschnittsstrukturen |
| 12. Signaturen | PAdES-T/LT/LTA, strenge Offline-Widerrufsprüfung, eingebettete DSS-Nachweise und Erneuerung von Dokumentzeitstempeln | Betreiber muss Zeitstempeldienst, kontrollierte Erreichbarkeit, Vertrauensanker und Sperrnachweise bereitstellen; qualifizierter Status wird nicht behauptet |
| 13. Seitenwerkzeuge | Freie Winkel, lange Seiten, Posterdruck auf wählbarem Papier mit Rand und Überlappung; abbrechbare Vorschau bei Parameteränderungen | Weitere frei gestaltbare Druckvorlagen |
| 14. Optimierung | QPDF-Linearisierung und Umwandeln vorhandener Schriftkonturen in Vektorpfade | Fehlende Originalschriften ohne passende, lizenzierte Schriftdateien rekonstruieren |
| 15. Vektorerhaltende Schwärzung | PDFium-Grundlage für Text- und Bildbereiche mit Tests; freigegebene Schwärzung baut Seitenbilder vollständig neu auf | Sicherheitsfreigabe einer vektorerhaltenden Schwärzung für beliebige PDF-Strukturen |
| 16. Barrierefreiheit | PDF/UA-Prüfung, neuer Struktureditor und Reparatur vorhandener Tags mit Alternativtexten, Tabellenköpfen, Feldbezeichnungen und Lesereihenfolge; Seiteninhalt bleibt bei Tag-Reparatur erhalten; Ausgabe nach bestandener veraPDF-Prüfung | Beliebige ungetaggte PDFs automatisch originalgetreu strukturieren; menschliche Prüfung bleibt notwendig |
| 17. Druckvorbereitung | Technische Druckprüfung, Seitenanpassung, Randbeschnitt und Posterdruck | Vollständiges Farbmanagement und unabhängig validierter PDF/X-Export |
| 18. Übersetzung | Übersetzte Absätze an Originalpositionen, Erhalt von Hintergrund und Links, Abbruch vor Ausgabe bei Textüberlauf | Beliebige komplexe Layouts, Schrift- und Spracherhaltung |
| 19. Dokumentvergleich | Spaltenbewusste Lesereihenfolge, seitenübergreifende Sätze, Wortänderungen und Verschiebungen; Hinweise auf geänderte Beträge, Verneinungen und Pflichtwörter | Allgemeine fachliche Bedeutungsprüfung; komplexe Tabellen und mehr als zwei Spalten manuell prüfen |
| 20. Lokaler Assistent | CPU-Sprachmodell auf dem eigenen Gerät, geprüfte Modelldatei, Auswahl passender Textstellen, unveränderte Originalzitate, Sperre unbelegter Zahlen, JSON-Export, Abbruch und Entladen | Keine Vollständigkeits- oder Wahrheitsgarantie; Zahlenprüfung ist konservativ und verlangt das Originalformat, Text und Zusammenhang weiterhin an den Originalfundstellen prüfen |
| 21. Große Dateien | PDFium-, Bilddecoder-, Prüfsummen- und Seitenwerkzeug-Worker; Abbruch und Speicherfreigabe | Durchgängiges Streaming und höhere belegte Dateigrenzen; weiterhin 80 MB und 200 Seiten |
| 22. Lokale Projekte | Unveränderliche fünf Arbeitsstände, vollständiges Archiv mit deduplizierten Binärdaten, SHA-256-Prüfungen, atomarer Import und Wiederherstellung | Noch nicht übernommene Ergebnisse sämtlicher Spezialwerkzeuge automatisch mitspeichern |

## Prüfung und Freigabe

Die 24 Engine-Testsuiten lesen erzeugte PDFs unabhängig zurück. Dazu gehören
Text, Glyphen, Bildpixel, Links, Formulare, Schriftgrößen, Seitenreihenfolge,
Projektarchive, echte HEIC-/PSD-Decodierung und tatsächliche OCR mit ausgelieferten
Sprachmodellen. Dichte zweispaltige Seiten werden ohne quadratische Vollvergleiche
sortiert und auf vollständigen Texterhalt geprüft.

Serverprüfungen umfassen reale LibreOffice-Eingaben, SVG/Vektoren, bearbeitbare
Folien, Übersetzungsüberlauf, veraPDF und synthetische CA/TSA/CRL-Nachweise für
Langzeitsignaturen. Ein bestandener synthetischer Test ersetzt keine
Produktionskonfiguration des Zeitstempeldienstes.

Die Freigabe verlangt Typprüfung, Formatprüfung, Linter, Produktionsbuild und
vollständige Docker-CI. Browserprüfungen testen alle Werkzeugansichten auf Desktop
und Smartphone, Downloads, gemischte Absatzformatierung, neue Folgeseiten,
Projekttransfer, acht OCR-Sprachen sowie echte lokale Modellinferenz. Jeder neue
Quellstand erhält einen eigenen Prüflauf. Unfertige oder fehlgeschlagene Prüfungen
werden nicht durch ältere erfolgreiche Läufe ersetzt.

## Komponenten und Lizenzen

PDFium 2.15.1, OCR-Sprachmodelle, Decoder, Modelllaufzeit und statistische
Sprachwahl werden mit ihren Komponentenhinweisen ausgeliefert. Details und
zugehörige Lizenztexte: [Komponentenhinweise](../public/component-notices/README.txt).
Diese Ergänzungen ändern nicht die Lizenz des MoinPDF-Projekts.
