# Funktionen und Grenzen

[← Zurück zur README](../README.md)

Diese Übersicht erklärt Werkzeuge, Ausgabeformate und technische Grenzen. Das durchsuchbare Handbuch mit Arbeitsschritten erreichst du in der App über **Dokumentation**. Für die vollständige Installation siehe [Docker](../DOCKER.md).

## Browser und Dokumentenserver

Viele Werkzeuge arbeiten lokal im Browser. Die vollständige Docker-Installation ergänzt einen automatisch verbundenen Dokumentenserver. Dessen Aufträge starten erst mit dem jeweiligen Aktionsknopf.

Die reine Browser-Ausgabe bietet für PDF zu Word einen lokalen Textexport ohne Layoutübernahme und für die Wunschgrößen-Komprimierung eine lokale Optimierung ohne Bild-Downsampling. Erweiterte Konvertierungen und Prüfungen benötigen die entsprechenden Serverkomponenten; Details stehen in der [Serverdokumentation](../server/README.md).

## Seiten, Bearbeitung und OCR

- Check & Seitenfinder: dateiübergreifende Textsuche, lokale Scan-Erkennung, Trefferseiten als neue PDF; Hinweise auf Scan-Seiten, mögliche Leerseiten, optisch gleiche Seiten und unterschiedliche Papierformate
- OCR & Text: 21 Sprachen plus Deutsch/Englisch kombiniert; automatische Seiteneinteilung, Textblock, Textspalte, Textzeile oder verstreuter Text; korrigierbarer Text neben PDF-Vorschau
- JPG, PNG, WebP, BMP, mehrseitige TIFF und eigenständige SVG zu PDF (als Bildseiten); PDF zu PNG/JPG/WebP/TIFF/BMP im ZIP
- Scan-Komprimierung
- Zusammenfügen; einzelne Seiten als PDF im ZIP
- Seiten organisieren: auswählen, sortieren, drehen, duplizieren, entfernen und Leerseiten ergänzen
- Seitennummern, dateiübergreifende Bates-Nummerierung mit Kopf-/Fußzeilen und internen Seitenbezeichnungen
- Beliebige Drehwinkel, durchgehende lange Seiten und Posterdruck mit Überlappung
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
- Originalobjekte bearbeiten: Text in vorhandener Schrift, Suchen/Ersetzen pro Seite, Bilder ersetzen, Objekte verschieben/drehen/skalieren/löschen; kein Absatzumbruch und keine Bearbeitung einzelner Unterobjekte in Gruppen
- Linearisierung für schnelle Webansicht; strukturierter JSON-Export mit Textpositionen
- PDF-Informationen und Textvergleich zweier PDFs
- In Abschnitte teilen, abwechselnd zusammenfügen, Broschüren und Seiten aufteilen
- Weiße Ränder entfernen, Schwarzweiß-Scan und Farben umkehren
- Stempel, Metadaten bearbeiten, Anmerkungen entfernen und PDFs überlagern
- Dateianhänge und eingebettete Bilder extrahieren
- Formulare ausfüllen und erstellen; Lesezeichen bearbeiten
- PDF schützen (AES-256) und mit bekanntem Passwort entsperren
- E-Rechnungen lesen und mit einem Basischeck prüfen; UBL, UBL-Gutschriften und CII aus XML oder eingebetteten PDF-Anhängen

PDFs, Rechnungs-XML und unterstützte Bildformate lassen sich überall ins Fenster ziehen. Die Seitenreihenfolge wird per Drag-and-drop oder über Pfeile geändert. Visuelle Bereiche lassen sich direkt aufziehen beziehungsweise platzieren oder über Prozentwerte eingeben. Die letzten 30 Seiten- und Bereichsänderungen können rückgängig gemacht und wiederholt werden (Strg/⌘ + Z und Strg/⌘ + Umschalt + Z). Nach dem Hinzufügen oder Schließen von Dateien beginnt der Verlauf neu.

Ergebnisse können als neue Arbeitsdokumente übernommen werden. OCR exportiert durchsuchbare PDF, TXT und DOCX (Text ohne Rekonstruktion des ursprünglichen Layouts). Seitenwerkzeuge übernehmen ausstehende visuelle Änderungen auf den ausgewählten Seiten. Die Arbeitsplätze für Formulare, Lesezeichen, Passwortschutz und E-Rechnungen verwenden die vollständige Quelldatei; Änderungen aus anderen Werkzeugen deshalb zuerst anwenden und als Arbeitsdokument übernehmen.

Über „Projekte“ lassen sich Dateien und Arbeitsstände einschließlich Editorverlauf, Formularen und Lesezeichen lokal wiederherstellen (letzte fünf gespeicherte Stände). Speicherung erfolgt unverschlüsselt im Browserspeicher; beim Projektwechsel wird die aktuelle Sitzung davor gesichert. Zwischenergebnisse eigenständiger Spezialwerkzeuge erst übernehmen. Ein gewählter Stand lässt sich als unverschlüsselte `.moinpdf`-Projektdatei einschließlich Originalen und Verlauf übertragen. Dafür „Projektdatei herunterladen“ beziehungsweise „Projektdatei öffnen“ verwenden. Projektdateien sind keine bereinigten Ergebnis-PDFs. Obergrenzen: 80 MB Quelldateien und 200 Seiten. Umfangreiche OCR kann auf Mobilgeräten langsam sein.

## Stapel, Abläufe und weitere Dateiformate

- Stapelverarbeitung und gespeicherte mehrstufige Arbeitsabläufe mit JSON-Import/-Export, Wenn-/Sonst-Schritten nach Dateiname, vorhandenen Texten oder Seitenzahl und Protokoll der Entscheidungen; Passwörter und Dokumente werden nicht in Abläufen gespeichert.
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
- Weitere Werkzeuge der **vollständigen Installation**: Office zu PDF, PDF/A erzeugen/prüfen, vollständige KoSIT-XRechnung-Validierung und Zertifikatssignaturen. [Servereinrichtung und Grenzen](../server/README.md).

## Prüfen mit Fundstellen

Diese Browserwerkzeuge verbinden Erkennung, Originalvorschau und Export:

| Werkzeug | Umfang und Grenzen |
| --- | --- |
| Zahlenvergleich | Beträge, Daten, Prozentwerte und mögliche IBANs anhand ihrer Zeilenbeschriftung zuordnen. Mehrdeutige Zeilen bleiben ungeklärt. |
| Belegfelder sammeln | Frei definierte Beschriftungen in mehreren Dateien suchen, Werte korrigieren und mit Fundstelle sowie Prüfstatus nach XLSX/CSV exportieren. |
| Rechnung und XML abgleichen | Sichtbare Seiten per OCR lesen und ausgewählte Angaben mit eingebetteter UBL/CII vergleichen. Nicht erkannte Werte bleiben ungeklärt; keine Echtheitsprüfung. |
| Dokumentlücken finden | Gedruckte Zählungen wie „Seite 3 von 7“ prüfen. Unterschiedliche Zählungen innerhalb einer Datei erfordern vorherige Trennung. |
| OCR-Korrekturhilfe | Wörter mit OCR-Sicherheit und Ausschnitt prüfen, korrigierten TXT oder eine neue PDF mit korrigiertem Suchtext exportieren. Die sichtbaren Seiten bleiben Bilder. |
| Pseudonymisierung | Explizit angegebene Begriffe über mehrere Dateien durch konsistente Platzhalter ersetzen. Alle Schreibvarianten angeben, Treffer kontrollieren. Nicht erkannte Angaben bleiben sichtbar. |
| Anlagen verknüpfen | Verweise und Anlagenüberschriften erkennen, Ziele prüfen oder manuell wählen, zusammengeführte PDF mit internen Links erzeugen. Offene Verweise exportieren. |
| Beste Scan-Seiten | Ähnlichkeit, Schärfe, Kontrast und Randinhalt bewerten, Auswahl pro Seite bestätigen, ergänzen und umsortieren. Originalseiten ohne erneute Bildkomprimierung übernehmen. |
| Angebot/Auftrag/Rechnung | Einfache Positionszeilen erkennen, manuell korrigieren und Mengen/Preise/Beträge vergleichen. Einheit, Währung und Preisbasis vorher angleichen. |
| Kommentare als Arbeitsliste | Echte PDF-Anmerkungen mit Autor, Seite und Textauszug lesen, Aufgaben bearbeiten und nach XLSX/CSV/Markdown exportieren. Eingebrannte Kommentare sind nicht auslesbar. |

Diese Werkzeuge verarbeiten keine Dokumentdaten außerhalb des Browsers. OCR nutzt
mitgelieferte deutsche und englische Sprachdaten und kann bei großen Stapeln länger
dauern. Analyse und Scanvergleich sind auf insgesamt 400 Seiten begrenzt. Die
Pseudonymisierung übernimmt keine Originaltextebene oder Dateianhänge; die vertrauliche
Zuordnung ist nur als separater Export erhältlich. PDFs werden als neue Dateien
ausgegeben. Geänderte PDFs erhalten keine gültige ursprüngliche digitale Signatur.

## Formulare, Chronologie, Messungen und Audio

Werkzeuge für Formulare, Dokumentenmappen, Messungen und Audio:

| Werkzeug | Verhalten und Ausgabe |
| --- | --- |
| Formularrückläufe auswerten | AcroForm-Felder mehrerer Dateien, Checkboxen und Auswahlwerte; Pflichtwertprüfung, Korrekturen mit Originalwert, Excel/CSV als Matrix oder Detailtabelle. XFA und reine Scans werden als unvollständig markiert. |
| Dokumente chronologisch ordnen | Datumsfundstellen per Text/OCR, ausdrückliche Bestätigung, manuelle Reihenfolge, PDF mit anklickbarem Inhaltsverzeichnis und Lesezeichen; Formulare werden festgeschrieben. |
| PDF-Rechenprüfung | Zahlenspalte markieren, Summanden korrigieren/abwählen, deutsches oder englisches Zahlenformat, exakte Dezimalrechnung mit bis zu sechs Nachkommastellen; markierte PDF mit Rechenprotokoll und CSV. |
| PDF-Sicherheitsbereinigung | Aktive Aktionen, Skripte, XFA und Medien entfernen; Anhänge, Kommentare und Metadaten optional. Nicht mehr referenzierte Daten werden verworfen, die Ausgabe anschließend strukturell geprüft. Kein Virenscan. |
| PDF-Ebenen verwalten | Echte optionale PDF-Ebenen mit Vorschau und gegenseitigen Ausschlüssen. Export der gewählten Ansicht als Seitenbilder; ausgeblendete Inhalte und ursprünglicher Suchtext werden nicht übernommen. |
| PDF-Maßband | Referenzstrecke je Seite, Strecken und einfache Polygonflächen; selbst kreuzende Flächen werden abgelehnt. Beschriftete PDF mit Kalibrierungsprotokoll und CSV, einschließlich gedrehter Seiten. |
| PDF als Hörbuch | Lokale OCR, bearbeitbarer Vorlesetext, Abschnitte nach Seiten oder Hauptlesezeichen; Thorsten/Kerstin, Sprechtempo und Stimmprobe. WAV oder Kapitel-ZIP mit Wiedergabeliste. Audioexport benötigt die vollständige Docker-Installation. |

Die Sprachausgabe verwendet fest installierte, mit SHA-256 geprüfte Modelle und
arbeitet während der Verarbeitung ohne Cloud-Dienst. Nur der ausgewählte
Vorlesetext geht an den integrierten Dokumentenserver. Maximal 20.000 Zeichen und
100 Abschnitte pro Auftrag; maximal drei Minuten Laufzeit. Ein abgebrochener
Browserabruf beendet einen bereits gestarteten Serverauftrag nicht sofort.
Die Browser-Ausgabe kann Vorlesetext auch ohne Server als TXT speichern.
Lizenzen und Modellversionen: [Audio-Hinweise](../server/AUDIO-NOTICES.md).

## Konvertieren und erweiterte Prüfungen

Alle Werkzeuge stehen direkt unter dem Suchfeld, nach ihrer Aufgabe gegliedert. Es gibt keine vorgeschaltete Schnellwahl oder Kategoriekacheln. Auf schmalen Ansichten brechen lange Werkzeugnamen innerhalb ihrer Kacheln um. Über „Alle Werkzeuge“ ist die Übersicht auch ohne geöffnetes PDF erreichbar.

| Werkzeug | Ausführung | Umfang |
|---|---|---|
| Nach Dateigröße teilen | Browser | Tatsächlich gemessene Bytes je PDF, vollständige Seitenreihenfolge, ZIP; zu große Einzelseiten werden gemeldet |
| PDF zu Word | Server | Bearbeitbare DOCX aus Text, Tabellen und Bildern mit pdf2docx; Scans benötigen OCR |
| PDF zu PowerPoint | Server | Eine gerenderte PDF-Seite je Folie; Seitenbilder statt editierbarer Einzelobjekte |
| E-Mails zu PDF | Server | EML/MSG, Unicode-Kopfzeilen und Nachricht; unveränderte Anlagen mit eindeutigen Namen im ZIP |
| HTML & Webseiten zu PDF | Server | Gespeicherte HTML-Dateien mit Überschriften und Tabellen; keine Skripte oder externen Ressourcen |
| Seiten automatisch ausrichten | Server | Tesseract OSD, 90/180/270 Grad, Mindestvertrauen und seitenweiser Bericht |
| Buchscans entzerren | Server | Einstellbare quadratische Spaltenkorrektur links/rechts, neue Seitenbilder |
| Formularfelder erkennen | Server | Leere Rechtecke, Linien und Scan-Konturen; erzeugte Felder anschließend bearbeiten |
| Schwärzungen prüfen | Server | Textsuche, Metadaten, verdächtige dunkle Vektor-Überdeckungen; keine Sicherheitsfreigabe |
| Druckqualität prüfen | Server | Bildauflösung, Font-Einbettung, Seitenboxen; keine PDF/X-Zertifizierung |
| Barrierefreiheit prüfen | Server | Technische Basisprüfung, kein PDF/UA-Konformitätsnachweis |
| PDF übersetzen | Server + eigener LibreTranslate-Dienst | Auslesbarer Text und Übersetzung nebeneinander; bis 60.000 Zeichen |
| ZUGFeRD-Assistent | Server | PDF/A-3 und passende CII-XML verbinden; Mustang und veraPDF-Berichte, negative Befunde klar benannt |
| Word-Serienbriefe | Server | DOCX mit {{Spaltenname}} und XLSX; bis 50 Datensätze, einzelne PDFs im ZIP |

Die erweiterten Konverter sind Teil der vollständigen Docker-Installation. Die vollständige Docker-Installation richtet den benötigten LibreTranslate-Dienst automatisch ein; bei separatem Serverbetrieb muss er selbst angebunden werden. HTML-Import ist kein Live-URL-Browser. Buchkorrektur und Prüfungen sind bewusst mit ihren konkreten Grenzen beschrieben.

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

---

[Zur README](../README.md) · [Installation](../DOCKER.md) · [Entwicklung](ENTWICKLUNG.md)


## Ergänzungen in 0.7.0

- **OCR und Scan-Suche:** Bis zu vier der 21 lokal ausgelieferten Sprachen kombinieren.
  Keine automatische Spracherkennung; mehr Sprachen benötigen mehr Arbeitsspeicher.
- **PDFs vergleichen:** Neben dem seitenweisen Vergleich gibt es „Inhalte über
  Seiten hinweg“. Der Bericht zeigt Wortänderungen, Fundseiten und verschobene
  Textblöcke. Doppelte oder uneindeutige Zuordnungen sind gekennzeichnet; Bilder
  und Formatierung bleiben Aufgabe des visuellen Vergleichs. Der TXT-Export
  enthält alle Einträge, auch die in der Oberfläche ausgeblendeten.
- **Projektdateien:** Ein Arbeitsstand mit Rückgängig-Verlauf, Quellen und
  Rechnungs-XML, bis zu 80 MB Dokumentdaten und 20 MB Bearbeitungsdaten. Vorhandene
  PDFs werden beim Import tatsächlich geöffnet und Seitenverweise geprüft.
