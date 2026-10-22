# Ausbau nach dem Funktionsvergleich

**Deutsch** · [English](STATUS.en.md) · [← README](../README.md)

Stand: 21. Oktober 2026. Unveröffentlichte Editor-Fortsetzung auf Basis von Version 0.19.0.

„PDF bearbeiten“ zeigt Seiten direkt an und bereitet vorhandenen Text sowie Scans automatisch vor. OCR läuft seitenweise lokal; Deutsch und Englisch sind vorausgewählt. Gedrehte Zeilen, vorhandene OCR-Ebenen und größere Bildbereiche in gemischten Seiten werden berücksichtigt. Unsichere Wörter sind markiert. Beim Export bleibt erkannter Suchtext außerhalb entfernter Textstellen erhalten; reine OCR-Ergänzungen ändern das Seitenbild nicht. Auf neu aufgebauten Seiten können Vektoren, Links und Formulare entfallen. Die Grenzen von 80 MB und 200 Seiten bleiben bestehen; dynamische XFA-Formulare müssen vorher als gewöhnliche PDF gespeichert werden.

Einzelne Textstellen werden direkt auf der PDF mit Textcursor und Schriftleiste bearbeitet; die Absatzwahl ist optional und bei Tabellen oder Spalten zu prüfen. Die Erkennung übernimmt bei digitalem Text Originalschrift, Punktgröße, Fett/Kursiv, Farbe und Zeichenabstände. Wiederverwendbare eingebettete Schriften bleiben erhalten; fehlende Zeichen führen zu ausdrücklich angezeigtem Schriftersatz. 14 lokale Familien mit 56 Schnitten stehen zur Wahl, einschließlich Liberation, Carlito und Caladea. Textänderungen erhalten unveränderte Vektoren, wenn die gezielte Originalobjekt-Bearbeitung und Rückleseprüfung gelingen. Andernfalls stoppt der Export, bis ein Bildneuaufbau ausdrücklich eingeschaltet wird. Reine Scans dürfen automatisch neu aufgebaut werden; der Export weist darauf hin. Bilder, Tabellenlinien und Links bleiben bei erfolgreicher nativer Textbearbeitung erhalten. Unterstützte statische Type-1/CFF1-Schriften werden lokal in TrueType-Konturen normalisiert; fehlende Zeichen erhalten einzeln Ersatzschriften. Geeigneter geneigter Text behält seine Grundlinie. Gespiegelter, gescherter, vertikaler oder beschnittener Text bleibt eingeschränkt. Überlauf und Überlappungen mit anderen Texten blockieren den Export. Auswahl ohne Änderung zählt nicht als Bearbeitung. Scans liefern keine verlässlich rekonstruierbare Originalschrift; Schrift und Größe bleiben dort geschätzt. Neben Textfeldumbruch ist eine ausdrückliche Vorschau für eine freie Absatzspalte mit bis zu 20 neuen Fortsetzungsseiten verfügbar. Tabellen, Bilder, Formulare und komplexer dokumentweiter Word-Seitenfluss bleiben dabei ausgeschlossen.

Über „Neues Dokument“ direkt links neben „Projekte“ lassen sich leere Dokumente
mit Rich-Text-Formatierung, Bildern und Tabellen verfassen. Entwürfe werden lokal
gespeichert und als bearbeitbare .moindoc-Dateien gesichert. Papierformat,
Seitenränder, Kopf-/Fußzeilen und Seitenzahlen sind einstellbar. Die responsive
Schreibansicht und die tatsächliche PDF-Seitenvorschau sind getrennte Ansichten;
der PDF-Export enthält auswählbaren Text. Der Einstieg gehört nicht zum Werkzeugkatalog.

Werkzeugauswahl und Suche behalten ihren Zustand beim Zurückgehen. Identische
Uploads werden erkannt. Ergebnisdateien lassen sich umbenennen und auf unterstützten
Geräten teilen; Format, Seitenzahl und Größe stehen direkt am Ergebnis.

Der gesamte Sprachkatalog mit ursprünglich 4.513 Einträgen wurde geprüft. Rund
2.000 Übersetzungen wurden verbessert; fehlende UI-Meldungen und app-eigene
Texte in Berichts- und Dokumentausgaben sind ergänzt. Regressionstests prüfen
Originaldaten, Formularwerte, Rechnungseinbettungen und Sprachabdeckung.

Die Oberfläche enthält 22 vollständig sichtbare Headerbilder, neun Schnellzugriffe,
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

| Bereich                         | Umgesetzt                                                                                                                                                                                                                                                                                                      | Besonderheiten und verbleibende Grenzen                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Nativer Texteditor           | Originalobjekte und Absätze; lokale Schriftbibliothek, Browser-Rechtschreibprüfung, Listen, Hoch-/Tiefstellen und Absatz-Suchen/Ersetzen; bis zu 32 Formatbereiche mit Schrift, Größe und Farbe; Ligaturen und kombinierende Zeichen; automatische zusätzliche Folgeseiten; echte Vorschau und Überlaufprüfung | HarfBuzz mit 14 zusätzlichen Noto-Schriften; Arabisch/Hebräisch und Mischtext; gruppeninterne Originaltexte. Fehlende Schriftdateien und beliebige exotische Schriften bleiben dokumentabhängig |
| 2. Bilder und Grafiken          | Mehrfachauswahl, Ausrichten, Verteilen, Spiegeln, Duplizieren, Vektorgruppen; Objekte bewegen, drehen, skalieren, ersetzen, löschen und in ihrer Zeichenreihenfolge ändern; direkte Griffpunkte mit Tastaturbedienung                                                                                          | Verschachtelte Gruppen bis 16 Ebenen einzeln öffnen; nicht unterstützte Grafiktypen und widersprüchliche geerbte Grafikzustände werden abgewiesen                                               |
| 3. Lokales Office zu PDF        | Gepinnter LibreOffice-WASM-Kern lokal im Browser sowie LibreOffice auf dem eigenen Dokumentenserver                                                                                                                                                                                                            | Speicherarme Mobilgeräte, allgemeine Layouttreue; Umfang in [BROWSER-OFFICE.md](BROWSER-OFFICE.md)                                                                                              |
| 4. PDF zu Office                | Word-Rekonstruktion, Tabellenexport und bearbeitbare PowerPoint-Textfelder mit Stil und Position                                                                                                                                                                                                               | Allgemeine originalgetreue Rekonstruktion komplexer Tabellen und Layouts                                                                                                                        |
| 5. OCR                          | 21 lokal ausgelieferte Modelle; bis zu acht gemeinsam; automatische Sprachprobe pro Scan-Seite mit bewusster Ablehnung kurzer oder unklarer Texte                                                                                                                                                              | Vollständige Spracherkennung bei Handschrift, sehr kurzen Texten und beliebigem Sprachmix wird nicht garantiert                                                                                 |
| 6. Importformate                | HEIC/HEIF und PSD im lokalen Worker, WebP, BMP, mehrseitige TIFF, SVG; Pages 4/5, Visio und Publisher über LibreOffice; Integritäts-, Format- und Größenprüfungen                                                                                                                                              | SVG-Import wird als Bildseite übernommen; PSD-Ebenen werden nicht als editierbare PDF-Ebenen importiert                                                                                         |
| 7. Exportformate                | WebP, TIFF, BMP, JSON mit Positionen und echter SVG-Vektorexport                                                                                                                                                                                                                                               | SVG-Vektorexport benötigt den Dokumentenserver                                                                                                                                                  |
| 8. Arbeitsabläufe               | Frei angeordnete Knoten, verschachtelte Ja/Nein-Zweige, Vorlagen, Drehen, Umkehren, Formular-Festschreiben, verlustfreie Optimierung, Import/Export und Entscheidungsprotokoll; Prüfung auf Schleifen und unerreichbare Knoten                                                                                 | Durchgängig im Hintergrund laufende Verarbeitung großer Stapel                                                                                                                                  |
| 9. XFA                          | Separater Dateneditor für einfache reine XFA-Paketformulare mit Rückleseprüfung; Erkennung vor der Formularverarbeitung; verlustbehaftete Formular- und Seitenübernahme wird abgelehnt; Lesezeichenänderungen erhalten XFA-Pakete; verständliche Hinweise                                                      | Dynamische XFA-Anzeige, Bearbeitung und verlässlicher Export                                                                                                                                    |
| 10. Ebenen                      | Namen und Sichtbarkeit bearbeiten; dauerhaftes Reduzieren der sichtbaren Ebenen; Zeichenreihenfolge von Seitenobjekten                                                                                                                                                                                         | Ebeneninhalte erstellen und beliebige Objekte zwischen Ebenen verschieben                                                                                                                       |
| 11. Nummerierung                | Dateiübergreifende Bates-Zählung, mehrere unabhängige Kopf-/Fußzeilenregeln, Seitenbereiche und interne Seitenbezeichnungen; Überlappungsprüfung                                                                                                                                                               | Beliebige verschachtelte Abschnittsstrukturen                                                                                                                                                   |
| 12. Signaturen                  | Lokale PKCS#12/CMS-Signatur ohne Upload; serverseitig PAdES-T/LT/LTA, strenge Offline-Widerrufsprüfung, eingebettete DSS-Nachweise und Erneuerung von Dokumentzeitstempeln                                                                                                                                     | Betreiber muss Zeitstempeldienst, kontrollierte Erreichbarkeit, Vertrauensanker und Sperrnachweise bereitstellen; qualifizierter Status wird nicht behauptet                                    |
| 13. Seitenwerkzeuge             | Freie Winkel, lange Seiten, Posterdruck auf wählbarem Papier mit Rand und Überlappung; abbrechbare Vorschau bei Parameteränderungen                                                                                                                                                                            | Weitere frei gestaltbare Druckvorlagen                                                                                                                                                          |
| 14. Optimierung                 | Lokale Komprimierung als Standard; QPDF-Linearisierung und Umwandeln vorhandener Schriftkonturen in Vektorpfade                                                                                                                                                                                                | Fehlende Originalschriften ohne passende, lizenzierte Schriftdateien rekonstruieren                                                                                                             |
| 15. Vektorerhaltende Schwärzung | PDFium-Grundlage für Text- und Bildbereiche mit Tests; freigegebene Schwärzung baut Seitenbilder vollständig neu auf                                                                                                                                                                                           | Sicherheitsfreigabe einer vektorerhaltenden Schwärzung für beliebige PDF-Strukturen                                                                                                             |
| 16. Barrierefreiheit            | PDF/UA-Prüfung, neuer Struktureditor und Reparatur vorhandener Tags mit Alternativtexten, Tabellenköpfen, Feldbezeichnungen und Lesereihenfolge; Seiteninhalt bleibt bei Tag-Reparatur erhalten; Ausgabe nach bestandener veraPDF-Prüfung                                                                      | Beliebige ungetaggte PDFs automatisch originalgetreu strukturieren; menschliche Prüfung bleibt notwendig                                                                                        |
| 17. Druckvorbereitung           | Technische Druckprüfung, Seitenanpassung, Randbeschnitt und Posterdruck                                                                                                                                                                                                                                        | Vollständiges Farbmanagement und unabhängig validierter PDF/X-Export                                                                                                                            |
| 18. Übersetzung                 | Übersetzte Absätze an Originalpositionen, Erhalt von Hintergrund und Links, Abbruch vor Ausgabe bei Textüberlauf                                                                                                                                                                                               | Beliebige komplexe Layouts, Schrift- und Spracherhaltung                                                                                                                                        |
| 19. Dokumentvergleich           | Spaltenbewusste Lesereihenfolge, seitenübergreifende Sätze, Wortänderungen und Verschiebungen; Hinweise auf geänderte Beträge, Verneinungen und Pflichtwörter                                                                                                                                                  | Allgemeine fachliche Bedeutungsprüfung; komplexe Tabellen und mehr als zwei Spalten manuell prüfen                                                                                              |
| 20. Lokaler Assistent           | CPU-Sprachmodell auf dem eigenen Gerät, geprüfte Modelldatei, Auswahl passender Textstellen, unveränderte Originalzitate, Sperre unbelegter Zahlen, JSON-Export, Abbruch und Entladen                                                                                                                          | Keine Vollständigkeits- oder Wahrheitsgarantie; Zahlenprüfung ist konservativ und verlangt das Originalformat, Text und Zusammenhang weiterhin an den Originalfundstellen prüfen                |
| 21. Große Dateien               | PDFium-, Bilddecoder-, Prüfsummen- und Seitenwerkzeug-Worker; Abbruch und Speicherfreigabe                                                                                                                                                                                                                     | Durchgängiges Streaming und höhere belegte Dateigrenzen; weiterhin 80 MB und 200 Seiten                                                                                                         |
| 22. Lokale Projekte             | Unveränderliche fünf Arbeitsstände, vollständiges Archiv mit deduplizierten Binärdaten, SHA-256-Prüfungen, atomarer Import und Wiederherstellung                                                                                                                                                               | Noch nicht übernommene Ergebnisse sämtlicher Spezialwerkzeuge automatisch mitspeichern                                                                                                          |

## Prüfung und Freigabe

44 Engine- und Oberflächentestsuiten prüfen Verarbeitung, Navigation und Darstellungseinstellungen. PDF-Ergebnisse werden unabhängig zurückgelesen. Dazu gehören
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

## Nachprüfung des PDF-Editors (20. Oktober 2026)

Ausgangspunkt war Version 0.15.4 (`6a9224d`). Die vorhandene lokale OCR, 14 Schriftfamilien mit 56 Schnitten und Originalschrift-Auswertung wurden weiterverwendet. Die Prüfung fand echte Fehler: Flächenentfernung löschte auch Hintergründe und Tabellenlinien; Textzugaben verloren Links; komplexe Fälle wurden stillschweigend gerastert; erneute OCR konnte sichtbare Originaltypografie ersetzen; die Browser-Texthistorie konkurrierte mit dem Projektverlauf. Diese Pfade wurden korrigiert. Bei komprimierten Bilddaten mit indirekter Längenangabe konnte der Parser ein echtes abschließendes CR/LF-Byte abschneiden; der Editor übernimmt in diesem eindeutig nachweisbaren Fall jetzt die vollständigen Originalbytes. Mehrdeutige Abweichungen werden abgewiesen. Eine zusätzliche Schriftprüfung fand fehlerhaft erkannte Nimbus-Schnitte und einen unzuverlässigen Type-1/CFF-Reexport; letzterer verwendet jetzt ausdrücklich ausgewiesenen Schriftersatz.

| Prüfung                         | Ergebnis und Umfang                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Textinhalt und echte Entfernung | Ersetzen, Ergänzen und Löschen in nativen PDF-Objekten; Export mit PDF.js und unabhängig mit MuPDF erneut gelesen. Alter Text fehlt, neuer Text ist selektierbar.                                                                                                                                                                 |
| Seitenerhalt                    | Farbiges Hintergrundbild, überlappende Tabellenlinie, Vektorfußzeile, Links, unterschiedliche Seitengrößen, Drehung und CropBox geprüft. Unveränderte Testseiten im Pixelvergleich identisch.                                                                                                                                     |
| Schriften                       | 56 lokale Schnitte, Umlaute, ß, Eurozeichen, Original-TrueType einschließlich Untergruppen, Fett/Kursiv, Farbe, Zeichenabstand, Ersatzschriften, Überlauf und Kollisionen geprüft.                                                                                                                                                |
| OCR                             | Lokale echte OCR auf erzeugten Scan-PDFs, gemischte Seiten und Dokumente, vorhandene unsichtbare OCR-Ebene, Korrektur fehlerhafter Suchtexte, gedrehte Scans, Abbruch und Wiederholung geprüft. Keine doppelte Suchtextebene in diesen Fällen.                                                                                    |
| Fehlerfälle                     | Mehrdeutige/angeschnittene Textobjekte, schräger Text, Signatur-/Formularstrukturen, defekte Parser-Eingaben und fehlgeschlagene OCR werden abgefangen. Explizite Bildrekonstruktion gesondert geprüft.                                                                                                                           |
| Browser                         | Chromium 140, Firefox 141 und Playwright-WebKit 26: je Desktop, 390-Pixel-Ansicht, vorhandene OCR-Scanebene und englische Oberfläche; Tippen, Undo/Redo, Download und Wiederöffnen. [Erster vollständiger CI-Lauf](https://github.com/MoinPDF/moinpdf/actions/runs/39401636121). Folgeänderungen lösen denselben Lauf erneut aus. |
| Projektprüfung                  | 45 vorhandene Testgruppen einzeln erfolgreich ausgeführt; Typprüfung, ESLint, Formatprüfung und Produktionsbuild erfolgreich.                                                                                                                                                                                                     |
| Datenschutz                     | In den Browserabläufen waren Fremd-Domains und Dokument-POSTs gesperrt; kein entsprechender Aufruf trat auf. OCR, Dokumentinhalt und Ersatzschriften bleiben lokal.                                                                                                                                                               |

Zusätzlich wurde eine unabhängig erstellte 14-seitige, zweispaltige Veröffentlichung aus dem offiziellen PDF.js-Testbestand bearbeitet: [tracemonkey.pdf](https://github.com/mozilla/pdf.js/blob/0d5f92deedb16d3e8b85fc2c6dcf753f572cedd2/test/pdfs/tracemonkey.pdf), SHA-256 `3662ff519e485810520552bf301d8c3b2b917fd2f83303f4965d7abed367e113`. Die Überschrift „Abstract“ wurde ersetzt; alle 13 anderen Seiten behielten Text, Positionen und unabhängig gerenderte Pixel. Die bearbeitete Schrift wurde als lokale Serifenschrift mit Fettschnitt eingebettet. Die fremde PDF wird nicht im Projekt mitverteilt.

Nicht nachgewiesen sind eine beliebige Sammlung produktiver Kundendokumente, schlechte Kameraaufnahmen, Handschrift, beliebige verschachtelte Grafikgruppen sowie die vollständige Editorbedienung auf echtem Safari, iPhone oder Android-Geräten. WebKit und schmale Desktop-Ansichten ersetzen keine Geräteprüfung. Die synthetischen Signaturtests sind keine Prüfung aller realen signierten oder verschlüsselten Dokumenttypen.

Technische Grenzen bleiben: kein dokumentweiter Word-Seitenfluss; Auswahl und Formatierung pro Textstelle/Absatz; Originalschrift nur bei sicher wiederverwendbaren Glyphen; OCR-Schrift und -Größe sind Schätzungen. Auf Scans werden Bildpixel lokal ersetzt, komplexe Bildhintergründe lassen sich dabei nicht garantiert rekonstruieren. Explizit als Bild aufgebaute Seiten können Vektoren, Links und interaktive Felder verlieren. Handschrift und OCR-Erkennungsfehler benötigen manuelle Kontrolle. Nicht sicher trennbare Textobjekte werden nicht stillschweigend verändert. Eine universelle oder hundertprozentige Bearbeitungszuverlässigkeit wird nicht zugesichert.

Reproduktion: `node tests/editor-preservation-smoke.mjs`; optional mit `MOINPDF_EDITOR_CORPUS=/pfad/tracemonkey.pdf`. Für die Browserabnahme nach `pnpm build:selfhost`: `MOINPDF_TEST_START_SERVER=1 python tests/editor-browser.py` (Playwright-Browser und Systembibliotheken erforderlich). Test-PDFs, Downloads und Bildschirmaufnahmen entstehen ausschließlich unter `.cache/`.

## Erweiterung des PDF-Editors 0.16.0

Markierte Wörter können innerhalb einer Textstelle unterschiedlich formatiert werden. Die Auswahl wird beim Formatieren erhalten; Einfügen und Ersetzen übernehmen den Stil der betroffenen Stelle. Ohne Markierung gilt eine Formatänderung für das ganze Textfeld. Eigene statische TrueType-Schriften werden lokal geprüft und mit dem Projekt gespeichert, ohne ihre Bytes in jedem Rückgängig-Schritt zu duplizieren. Eine Schriftdatei enthält einen Schriftschnitt; ein anderer Fett-/Kursivschnitt benötigt eine entsprechende Datei oder eine mitgelieferte Familie.

Layoutvorschläge verändern andere Textfelder nicht. Tabellen und Spalten besitzen in einer PDF häufig keine semantische Struktur; die Absatzbildung bleibt deshalb konservativ. OCR-Korrekturen lassen sich am Originalausschnitt prüfen und gezielt neu erkennen. Die neue Erkennung ersetzt Text erst nach Übernahme.

Der Export öffnet die erzeugte PDF erneut. Textmenge und Position geänderter Texte werden geprüft; Leerraum und Unicode-Kompatibilitätsformen werden normalisiert. Der Bildvergleich arbeitet außerhalb der bearbeiteten Rechtecke mit 900 Pixeln Vorschauauflösung und einer Toleranz für Rasterunterschiede. Er kann kleine Änderungen übersehen und überprüft das Schriftbild innerhalb der geänderten Stellen nicht. Beschnittene oder zusätzlich als Bild bearbeitete Seiten werden als eingeschränkt geprüft gekennzeichnet. Original und Export bleiben zum eigenen Vergleich verfügbar.

Prüfstand: 46 lokale Testsammlungen, Produktionsbuild, Typprüfung und Lint; zusätzliche Prüfungen für Wortformatierung, Unicode, Projekt-/Schriftrundlauf, fehlenden oder doppelten Exporttext. Browserergebnisse werden in der zugehörigen Editor-CI als Artefakte gespeichert. Keine Zusage für beliebige Kunden-PDFs, Handschrift oder reale mobile Geräte. Umfangreiche Schriffformung, variable/CFF-Eigenschriften und dokumentweiter Word-Umbruch bleiben technische Grenzen.

## Bedienungspräzision 0.17.0

Gemischte Formatierung wird ausdrücklich angezeigt; Schriftstatus und Formatierungsleiste folgen der ausgewählten Textspanne. Ohne Textmarkierung bleibt das ganze Textfeld der Formatierungsbereich. Die integrierte Suche (Strg/⌘+F oder +H im Textfeld) bearbeitet bewusst nur dieses Feld. Ersetzungen behalten den Stil der jeweiligen Fundstelle und bilden einen gemeinsamen Rückgängig-Schritt. Suchbegriffe werden wörtlich interpretiert; Textfelder bleiben auf 20.000 Zeichen begrenzt.

Der Editor vergrößert die tatsächliche Seite bis 400 Prozent. Bedienelemente bleiben in normaler Größe; die Seite besitzt einen eigenen Scrollbereich. Vorschauen sind auf 3.200 Pixel längste Seite und die bestehenden Rendergrenzen begrenzt. Das ist eine Bildschirmvorschau, keine Aussage über die Exportauflösung. Vollständige Acrobat-Gleichwertigkeit und der Rang als bestes Internetwerkzeug sind nicht nachgewiesen. Für eine solche Bewertung fehlen unter anderem ein unabhängiger Vergleichskorpus und reale Geräteprüfungen.

## Textblöcke, Dokumentprüfung und öffentlicher Korpus 0.18.0

Textblöcke lassen sich explizit verbinden (2 bis 50 waagerechte Felder derselben Seite) und am Cursor trennen. Die Vorschau zeigt die Leserichtung. Unterschiedliche eigene Schriftdateien und Scan-Hintergründe werden nicht stillschweigend vereinheitlicht. Die alte Textentfernung bleibt auf die einzelnen Quellrechtecke begrenzt. Eine Gruppierung allein verändert den PDF-Inhalt nicht. Eine Teilung ist eine ausdrückliche Layoutänderung und behält die Originalentfernung nur im ersten Teil.

Unveränderte Seiten werden beim Export direkt übernommen. Das Öffnen, Durchsuchen oder erneute Erkennen eines Scans fügt allein keine neue Textebene hinzu und ersetzt keine bestehende. Erst eine tatsächliche Seitenbearbeitung übernimmt die benötigte OCR-Ebene.

„Dokument durchsuchen“ durchsucht alle geladenen Seiten und Änderungen. Nicht durchsuchte Seiten werden ausgewiesen. Lokale OCR ist zuschaltbar; die Suche ist auf fünf Millionen Zeichen und 5.000 Treffer begrenzt, einzelne Felder auf 20.000 Zeichen. Vor einer Sammelersetzung werden Schrift, Überlauf und Überschneidungen geprüft. Wenn ein Treffer nicht passt, wird die gesamte Ersetzung zurückgehalten. Suchtreffer verfallen nach inhaltlichen Dokumentänderungen. Ein gemeinsamer Rückgängig-Schritt umfasst die ganze Ersetzung.

Die Schriftbildprüfung arbeitet innerhalb bearbeiteter Textfelder mit 1.600 Pixeln längster Seite. Sie zeichnet die vorgesehenen Schriftkonturen direkt auf Canvas und vergleicht sie mit dem PDF.js-Bild der gespeicherten Datei. Ein Pixel Positionsspielraum begrenzt Rasterabweichungen. Verglichen wird die Farbdeckung je RGB-Kanal; unterschiedlich geglättete Ränder zählen dadurch nicht wie vollständig fehlende Textpixel. Mehr als zwölf Prozent fehlende oder zusätzliche Farbdeckung führen zu einem Prüfhinweis; sehr kleine/kontrastarme Schrift oder eine fehlgeschlagene Hintergrundtrennung werden als nicht vollständig geprüft ausgewiesen. Das ist keine mathematische Gleichheitsgarantie. Die bisherige Prüfung unveränderter Bereiche arbeitet weiterhin mit 900 Pixeln. OCR-Erkennungsfehler werden dadurch nicht automatisch inhaltlich erkannt.

Regressionen in `tests/editor-rich-smoke.mjs` prüfen interleavte Spalten, Tabellen, Formatierungen beim Verbinden/Trennen, Unicode-Grenzen, Suche und veraltete Treffer sowie gezielt fehlerhafte Schriftart, Schriftgröße, Farbe und Position. `tests/editor-quality-browser.py` ergänzt Desktop- und 390-Pixel-Abläufe für Chromium, Firefox und WebKit. Die CI speichert tatsächliche Ergebnisse, exportierte Dateien, Berichte und Bildschirmaufnahmen als `editor-*`-Artefakte.

Der externe Korpus wird ausschließlich für Tests geladen: `python tests/editor-download-corpus.py`. Quellen, unveränderliche Revisionen, SHA-256, Lizenz und bekannte Einschränkungen stehen in `tests/editor-public-corpus.json`. Die AWS-Rechnung enthält bereits Fehler in ihrer Textzuordnung; die Prüfung unterscheidet diese vom bearbeiteten Inhalt. Die gemischte Datei wird für den Test aus öffentlichen Vorlagen zusammengestellt. Ein kleines AcroForm prüft die ausdrückliche Ablehnung vor verlustreichem Abflachen, nicht die Bearbeitung beliebiger amtlicher Formulare. Der Korpus wird nicht mit der Anwendung ausgeliefert und führt keine externe Dokumentenübertragung ein.

Nicht geprüft bleiben reale iPhone-/Android-Geräte, die vollständige Editorbedienung in nativem Safari und eine breite Sammlung produktiver Kundenunterlagen. Der Browserkorpus ersetzt diese Prüfungen nicht. Kameraaufnahmen, Handschrift, komplexe Schriffformung, beliebige Signaturen und Formulare bleiben weitere Grenzen.

## 0.19.0 – 20. Oktober 2026

- Geeignete waagerechte Wortänderungen entfernen nur die betroffenen Originalzeichen. Unveränderte Präfixe und bei gleicher Position auch Suffixe bleiben als PDF-Text erhalten. Mehrdeutige Zeichen, Ligaturen, Schriftschnitt- oder Layoutänderungen verwenden weiterhin die geprüfte Textfeldbearbeitung.
- Textfelder lassen sich in frei gewählter Reihenfolge über bestehende Seiten verknüpfen. Eine Vorschau verteilt Text und Formatierung ohne automatische Verkleinerung; Überlauf und Kollisionen verhindern die Übernahme. Weitere Änderungen erfordern eine erneute Textfluss-Vorschau.
- Einfach ausgerichtete Tabellen erhalten einen Zellenmodus mit Tab/Umschalt+Tab. Formatübernahme, Millimetermaße und Hilfslinien für Kanten, Mittelpunkte und Grundlinien ergänzen die Bearbeitung.
- Dokumentweite Änderungsübersicht mit Vorher/Nachher, Sprung zur Seite und gezielter Rücknahme. Zusammenhängende Teilungen und Textflüsse werden gemeinsam zurückgenommen; spätere unabhängige Änderungen bleiben erhalten.
- Vorhandene Einzelbilder im Texteditor verschieben, proportional skalieren, ersetzen und zuschneiden. Zuschnitt entfernt Bildpixel und erhält die Ausrichtung. Scan-Hintergründe, Gruppen und Bilder mit zugehöriger vorhandener OCR-Ebene werden konservativ behandelt; Dekodierung und Zuschnitt sind auf 4 Megapixel begrenzt.
- Lokale OCR-Arbeitskopien mit kleiner Schräglagenkorrektur, Schattenausgleich, Kontrast und vorsichtiger Rauschminderung. Original- und aufbereitete Bereichserkennung sind vergleichbar; auffällige Buchstaben in Zahlen werden zur Prüfung markiert. Keine automatische Zahlenkorrektur und keine zusätzliche Dokumentübertragung.
- Eindeutige ganzseitige Scanbilder bis 4 Megapixel behalten beim Bearbeiten ihr ursprüngliches Pixelraster. Eine unabhängige PDF.js-Darstellung muss die dekodierten Bilddaten bestätigen; Anmerkungen, Ebenen, zusätzliche Objekte oder abweichende Bildgeometrie verhindern diesen Pfad. Komplexere Scanseiten verwenden weiterhin den Bildneuaufbau.
- Touch-Modus mit größeren Griffen, kompakter erweiterbarer Schriftleiste, Auswahl-Lupe und Anpassung an den sichtbaren Tastaturbereich. Reale Geräte und native virtuelle Tastaturen bleiben gesondert zu prüfen.
- Schriftbildvergleich mit an Schriftgröße angepasster Auflösung bis 3.600 Pixeln bei höchstens etwa 4 Megapixeln und markierbaren Abweichungsbereichen. Erweiterter öffentlicher Korpus enthält einen französischen Scan mit Akzenten; sämtliche Dateien sind fest versioniert, mit Prüfsummen und Lizenzhinweisen versehen und werden nicht mit der Anwendung ausgeliefert.

Die Zeichenreihenfolge in PDF-Objekten kann sich beim Ersetzen ändern. Eine geometrisch sortierte Textextraktion wird geprüft; die semantische Lesereihenfolge und die vollständige Übernahme vorhandener Barrierefreiheits-Tags sind damit nicht nachgewiesen.

## Unveröffentlichte Editor-Fortsetzung – 22. Oktober 2026

Die Änderungen und Grenzen stehen im unveröffentlichten [Änderungsprotokoll](../CHANGELOG.md) und in der aktualisierten Bedienungsanleitung. Die 48 lokalen Testgruppen wurden bei der Fortsetzung erneut erfolgreich ausgeführt. Die Editor-CI umfasst jetzt je 29 Fälle in Chromium, Firefox und WebKit, einschließlich 390-Pixel-Ansichten, unabhängiger Exportprüfung und echter Entfernung alter Tabellenlinien in der Vorschau. Zwei zusätzliche Fälle verzögern die echte Schriftvorbereitung und prüfen, dass der Fokus auf der OCR-Bedienung bleibt; dieser Fokusfehler wurde unter WebKit vor der Korrektur reproduziert. Fehlende, doppelte oder fehlgeschlagene Browserfälle werden ausdrücklich abgewiesen; fehlgeschlagene Workflow-Fälle erhalten eine Ablaufaufzeichnung. Maßgeblich sind die Ergebnisse und Artefakte des jeweiligen Quellstands in der [Editor-CI](https://github.com/MoinPDF/moinpdf/actions/workflows/editor.yml). Der freigegebene Testzweig ist öffentlich; Hauptversion, Website, Container und Releases werden durch diese Prüfungen nicht veröffentlicht. Historische Prüfstände in den vorstehenden Abschnitten bleiben als solche erhalten.
