# Ausbau nach dem Funktionsvergleich

Stand: 15. Oktober 2026, Version 0.13.25.

Der gesamte Sprachkatalog mit ursprünglich 4.513 Einträgen wurde geprüft. Rund
2.000 Übersetzungen wurden verbessert; fehlende UI-Meldungen und app-eigene
Texte in Berichts- und Dokumentausgaben sind ergänzt. Regressionstests prüfen
Originaldaten, Formularwerte, Rechnungseinbettungen und Sprachabdeckung.

Die Oberfläche enthält 22 vollständig sichtbare Headerbilder, sechs Schnellzugriffe,
eine Dokumentübersicht und eine mobile Aktionsleiste im gemeinsamen PDF-Arbeitsbereich.
Am Desktop ist das Headerbild auf 640 Pixel begrenzt; mobil bleibt es unverändert.
Werkzeugkacheln und Symbole bleiben ruhig. Der Projekt-Button ist dezent weiß-grün.
Auch Projektstände ohne Seiten bieten Rückgängig und Wiederholen.
Die Werkzeugseitenleiste ist zunächst eingeklappt. Header und Upload behalten ihre
bisherige Gestaltung und die vorhandenen Farben; die Komprimierung bietet die
Stufen Sanft, Ausgewogen und Möglichst klein. Die Bedienungsanleitung ist in Deutsch
und Englisch verfügbar. Die Beispiel-PDF wird passend zur App-Sprache auf Deutsch
oder Englisch erzeugt. Nachweise für einzelne technische Funktionen stehen bei
den zugehörigen Prüfläufen; die Versionsangabe ersetzt keine Funktionsprüfung.

Diese Übersicht beschreibt den tatsächlichen Umfang. Der ursprüngliche Plan mit
22 Bereichen ist noch nicht vollständig abgeschlossen. Nicht unterstützte
Konvertierungen und Prüfstandards werden nicht als verfügbar ausgewiesen.

| Bereich | Umgesetzt | Verbleibende Arbeit |
| --- | --- | --- |
| 1. Nativer Texteditor | Originalobjekte und Absätze; lokale Schriftbibliothek, Browser-Rechtschreibprüfung, Listen, Hoch-/Tiefstellen und Absatz-Suchen/Ersetzen; bis zu 32 Formatbereiche mit Schrift, Größe und Farbe; Ligaturen und kombinierende Zeichen; automatische zusätzliche Folgeseiten; echte Vorschau und Überlaufprüfung | HarfBuzz mit 14 zusätzlichen Noto-Schriften; Arabisch/Hebräisch und Mischtext; gruppeninterne Originaltexte. Fehlende Schriftdateien und beliebige exotische Schriften bleiben dokumentabhängig |
| 2. Bilder und Grafiken | Mehrfachauswahl, Ausrichten, Verteilen, Spiegeln, Duplizieren, Vektorgruppen; Objekte bewegen, drehen, skalieren, ersetzen, löschen und in ihrer Zeichenreihenfolge ändern; direkte Griffpunkte mit Tastaturbedienung | Verschachtelte Gruppen bis 16 Ebenen einzeln öffnen; nicht unterstützte Grafiktypen und widersprüchliche geerbte Grafikzustände werden abgewiesen |
| 3. Lokales Office zu PDF | Gepinnter LibreOffice-WASM-Kern lokal im Browser sowie LibreOffice auf dem eigenen Dokumentenserver | Speicherarme Mobilgeräte, allgemeine Layouttreue; Umfang in [BROWSER-OFFICE.md](BROWSER-OFFICE.md) |
| 4. PDF zu Office | Word-Rekonstruktion, Tabellenexport und bearbeitbare PowerPoint-Textfelder mit Stil und Position | Allgemeine originalgetreue Rekonstruktion komplexer Tabellen und Layouts |
| 5. OCR | 21 lokal ausgelieferte Modelle; bis zu acht gemeinsam; automatische Sprachprobe pro Scan-Seite mit bewusster Ablehnung kurzer oder unklarer Texte | Vollständige Spracherkennung bei Handschrift, sehr kurzen Texten und beliebigem Sprachmix wird nicht garantiert |
| 6. Importformate | HEIC/HEIF und PSD im lokalen Worker, WebP, BMP, mehrseitige TIFF, SVG; Pages 4/5, Visio und Publisher über LibreOffice; Integritäts-, Format- und Größenprüfungen | SVG-Import wird als Bildseite übernommen; PSD-Ebenen werden nicht als editierbare PDF-Ebenen importiert |
| 7. Exportformate | WebP, TIFF, BMP, JSON mit Positionen und echter SVG-Vektorexport | SVG-Vektorexport benötigt den Dokumentenserver |
| 8. Arbeitsabläufe | Frei angeordnete Knoten, verschachtelte Ja/Nein-Zweige, Vorlagen, Drehen, Umkehren, Formular-Festschreiben, verlustfreie Optimierung, Import/Export und Entscheidungsprotokoll; Prüfung auf Schleifen und unerreichbare Knoten | Durchgängig im Hintergrund laufende Verarbeitung großer Stapel |
| 9. XFA | Separater Dateneditor für einfache reine XFA-Paketformulare mit Rückleseprüfung; Erkennung vor der Formularverarbeitung; verlustbehaftete Formular- und Seitenübernahme wird abgelehnt; Lesezeichenänderungen erhalten XFA-Pakete; verständliche Hinweise | Dynamische XFA-Anzeige, Bearbeitung und verlässlicher Export |
| 10. Ebenen | Namen und Sichtbarkeit bearbeiten; dauerhaftes Reduzieren der sichtbaren Ebenen; Zeichenreihenfolge von Seitenobjekten | Ebeneninhalte erstellen und beliebige Objekte zwischen Ebenen verschieben |
| 11. Nummerierung | Dateiübergreifende Bates-Zählung, mehrere unabhängige Kopf-/Fußzeilenregeln, Seitenbereiche und interne Seitenbezeichnungen; Überlappungsprüfung | Beliebige verschachtelte Abschnittsstrukturen |
| 12. Signaturen | Lokale PKCS#12/CMS-Signatur ohne Upload; serverseitig PAdES-T/LT/LTA, strenge Offline-Widerrufsprüfung, eingebettete DSS-Nachweise und Erneuerung von Dokumentzeitstempeln | Betreiber muss Zeitstempeldienst, kontrollierte Erreichbarkeit, Vertrauensanker und Sperrnachweise bereitstellen; qualifizierter Status wird nicht behauptet |
| 13. Seitenwerkzeuge | Freie Winkel, lange Seiten, Posterdruck auf wählbarem Papier mit Rand und Überlappung; abbrechbare Vorschau bei Parameteränderungen | Weitere frei gestaltbare Druckvorlagen |
| 14. Optimierung | Lokale Komprimierung als Standard; QPDF-Linearisierung und Umwandeln vorhandener Schriftkonturen in Vektorpfade | Fehlende Originalschriften ohne passende, lizenzierte Schriftdateien rekonstruieren |
| 15. Vektorerhaltende Schwärzung | PDFium-Grundlage für Text- und Bildbereiche mit Tests; freigegebene Schwärzung baut Seitenbilder vollständig neu auf | Sicherheitsfreigabe einer vektorerhaltenden Schwärzung für beliebige PDF-Strukturen |
| 16. Barrierefreiheit | PDF/UA-Prüfung, neuer Struktureditor und Reparatur vorhandener Tags mit Alternativtexten, Tabellenköpfen, Feldbezeichnungen und Lesereihenfolge; Seiteninhalt bleibt bei Tag-Reparatur erhalten; Ausgabe nach bestandener veraPDF-Prüfung | Beliebige ungetaggte PDFs automatisch originalgetreu strukturieren; menschliche Prüfung bleibt notwendig |
| 17. Druckvorbereitung | Technische Druckprüfung, Seitenanpassung, Randbeschnitt und Posterdruck | Vollständiges Farbmanagement und unabhängig validierter PDF/X-Export |
| 18. Übersetzung | Übersetzte Absätze an Originalpositionen, Erhalt von Hintergrund und Links, Abbruch vor Ausgabe bei Textüberlauf | Beliebige komplexe Layouts, Schrift- und Spracherhaltung |
| 19. Dokumentvergleich | Spaltenbewusste Lesereihenfolge, seitenübergreifende Sätze, Wortänderungen und Verschiebungen; Hinweise auf geänderte Beträge, Verneinungen und Pflichtwörter | Allgemeine fachliche Bedeutungsprüfung; komplexe Tabellen und mehr als zwei Spalten manuell prüfen |
| 20. Lokaler Assistent | CPU-Sprachmodell auf dem eigenen Gerät, geprüfte Modelldatei, Auswahl passender Textstellen, unveränderte Originalzitate, Sperre unbelegter Zahlen, JSON-Export, Abbruch und Entladen | Keine Vollständigkeits- oder Wahrheitsgarantie; Zahlenprüfung ist konservativ und verlangt das Originalformat, Text und Zusammenhang weiterhin an den Originalfundstellen prüfen |
| 21. Große Dateien | PDFium-, Bilddecoder-, Prüfsummen- und Seitenwerkzeug-Worker; Abbruch und Speicherfreigabe | Durchgängiges Streaming und höhere belegte Dateigrenzen; weiterhin 80 MB und 200 Seiten |
| 22. Lokale Projekte | Unveränderliche fünf Arbeitsstände, vollständiges Archiv mit deduplizierten Binärdaten, SHA-256-Prüfungen, atomarer Import und Wiederherstellung | Noch nicht übernommene Ergebnisse sämtlicher Spezialwerkzeuge automatisch mitspeichern |

## Prüfung und Freigabe

33 Engine- und Oberflächentestsuiten prüfen Verarbeitung, Navigation und Darstellungseinstellungen. PDF-Ergebnisse werden unabhängig zurückgelesen. Dazu gehören
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

## Nachprüfung von XFA und Druckstandards (11. Oktober 2026)

Die am 11. Oktober untersuchte PDF.js-Version 6.3.289 kann reine dynamische XFA-Formulare
anzeigen und einfache Eingaben über `annotationStorage` in Datensatzpakete
zurückschreiben. Das ist keine vollständige XFA-Laufzeit: XFA als einzelner
Stream wird beim Speichern ausdrücklich nicht unterstützt; Mischformulare,
JavaScript, Berechnungen und dynamische Aktionen sind nicht vollständig
abgedeckt. Version 0.11.0 ergänzt diesen begrenzten Dateneditor mit Ablehnung nicht unterstützter Formulare und unabhängiger Rückleseprüfung.
Die vorhandenen Schutzsperren bleiben aktiv, damit keine XFA-Daten verloren gehen.

MoinPDF verwendet inzwischen PDF.js 6.4.299. Die XFA-Schutzsperren wurden mit
dieser Version erneut geprüft; eine vollständige XFA-Bearbeitung ist weiterhin
nicht freigegeben. Die folgende Quellanalyse bezieht sich auf den damals
untersuchten Versionsstand:
[Dokumenterkennung](https://github.com/mozilla/pdf.js/blob/v6.3.289/src/core/document.js),
[Speicherung](https://github.com/mozilla/pdf.js/blob/v6.3.289/src/core/worker.js),
[Eingabeschicht](https://github.com/mozilla/pdf.js/blob/v6.3.289/src/display/xfa_layer.js).

Ein CMYK-Profil allein belegt keine PDF/X-Konformität. veraPDF unterstützt
[PDF/A und PDF/UA](https://docs.verapdf.org/validation/), kein vollständiges
PDF/X-Prüfprofil. Auch der untersuchte freie Validator
[pdf0](https://github.com/mgilbir/pdf0/blob/main/docs/validators.md) beschreibt
seine PDF/X-Prüfung als begrenzt. Eine Freigabe als validiertes PDF/X braucht
weiterhin einen vollständigen unabhängigen Validator. Das unverändert
weitergebbare [ICC-Profil CGATS21_CRPC6](https://registry.color.org/profile-registry/CGATS21_CRPC6)
wäre für die zugehörige Druckbedingung nutzbar, ersetzt aber weder Farbmanagement
noch Konformitätsprüfung. Daher wurde kein ungesicherter PDF/X-Export ergänzt.

Der Absatzeditor speichert logischen Text zusätzlich als PDF-ActualText. Leser ohne ActualText-Unterstützung können bei ungewöhnlich gemischten Schreibrichtungen eine abweichende Kopierreihenfolge bestimmen, etwa in einem von rechts nach links angeordneten Absatz mit überwiegend lateinischem Text. Darstellung und erneutes Bearbeiten nutzen den vollständigen gespeicherten Absatz.

## Website-Link zu PDF

Öffentliche HTTP-/HTTPS-Webseiten können im Werkzeug „HTML & Webseiten zu PDF“ direkt per Link geladen werden. Der separate Docker-Web-Konverter übernimmt Bilder, CSS, Schriften und öffentlich ladbare JavaScript-Inhalte. A4/Letter, Hoch-/Querformat, Hintergründe und Bildschirm-/Druckansicht sind wählbar. Private Netzwerkziele sind gesperrt; Login, Bot-Schutz und dynamische Inhalte können die Darstellung einschränken. Gespeicherte HTML-Dateien bleiben als vereinfachte Textkonvertierung verfügbar.
