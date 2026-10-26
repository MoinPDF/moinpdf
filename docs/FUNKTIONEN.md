# Funktionen und Grenzen

Farben & Hintergrund ändern bietet eigene Text-/Hintergrundfarben mit Texterhalt sowie Helligkeit, Kontrast und Sättigung als Bildausgabe. Vorschau, Vorlagen und Projektentwürfe sind enthalten. Der Formularhelfer gibt ausgewählte schreibgeschützte Felder frei und erhält ihre Werte. Zuschneiden kann nur den sichtbaren Bereich ändern; versteckte Inhalte bleiben dabei in der Datei. Abwechselnd zusammenfügen sortiert auch Vorder-/Rückseitenblöcke innerhalb einer PDF mit Trennstelle und Reihenfolgevorschau.

<!-- generated-capabilities:start -->
**Aktuelle Grenzen aus der Implementierung · 0.23.0**

| Funktion | Wert |
| --- | --- |
| Aktive Quelldateien | 80 MiB |
| Aktive Seiten | 200 |
| OCR | 21 Sprachen; bis zu 8 gleichzeitig |

Beim Dokumentationsbuild aus den Anwendungskonstanten erzeugt.
<!-- generated-capabilities:end -->

**Deutsch** · [English](FEATURES.en.md) · [← README](../README.md)

Diese Übersicht erklärt Werkzeuge, Ausgabeformate und technische Grenzen. Das durchsuchbare Handbuch mit Arbeitsschritten erreichst du in der App über **Dokumentation**. Für die vollständige Installation siehe [Docker](../DOCKER.md).

## Schwärzen, große PDFs und Erkennungsregeln

- **Schwärzen mit Texterhalt:** Manuelle Bereiche und Suchtreffer können vollständig erfasste, einfache digitale Textobjekte entfernen und übrigen Text sowie Vektorgrafiken erhalten. Seitengeometrie, Resttext, Links und Bilddarstellung werden vor der Ausgabe geprüft. Dokumentinfos und ungenutzte Ressourcen werden bereinigt. Bei nicht unterstützten Strukturen wird die Ausgabe gesperrt; der bestehende Bildmodus bleibt ausdrücklich wählbar.
- **Große PDFs:** Eigener Arbeitsbereich bis 256 MB und 1.000 Seiten für Drehen, verlustfreies Optimieren und OCR. Dateibasiertes Lesen, Abschnitte mit höchstens 50 Seiten, atomare lokale Zwischenstände und Fortsetzen nach Abbruch. Abschnitte können im Editor bearbeitet und bei gleicher Seitenzahl ersetzt werden. Die Gesamtausgabe wird auf allen Seiten gegen die geprüften Abschnitte geprüft. Der normale Editor bleibt bei 80 MB und 200 aktiven Seiten.
- **Klar Schiff:** Bis zu 30 ausdrücklich gespeicherte lokale Layoutregeln für Absender, Dokumentnummer und Datum. Wiederkehrende Dokumente erhalten Vorschläge; Konflikte und unsichere OCR bleiben sichtbar. Eindeutige Vorschläge lassen sich nach Prüfung gemeinsam bestätigen.

Große Aufträge und Erkennungsregeln bleiben unverschlüsselt im Browser, bis sie gelöscht werden; sie werden nicht in Projektdateien eingebettet. Große PDFs mit Formularen, Signaturen, internen Verweisen, Lesezeichen, Anhängen oder Struktur-Tags werden vorab abgelehnt. Maximal 768 MB gespeicherte Aufträge und 256 MB Gesamtausgabe; Dokumentinfos werden bei der Zusammenführung nicht übernommen. Desktop-Browser empfohlen.


## Neu in 0.21.0

Die gemeinsame PDF-Exportprüfung kontrolliert Lesbarkeit und bekannte Seitenzahlen. Bei vorhandener Seitenzuordnung werden Maße, Links und Formularfelder verglichen; bei Werkzeugen mit Texterhalt auch Originaltext. Bis zu 200 Seiten und 100.000 Zeichen je Seite werden geprüft. Auffälligkeiten erfordern eine Bestätigung, unlesbare Ergebnisse werden nicht zum Download freigegeben. Verschlüsselte PDF-Ausgaben sind als inhaltlich ungeprüft gekennzeichnet. Das ersetzt keinen vollständigen Bildvergleich.

Projektdateien und Gesamtarchive können optional mit einem mindestens zwölf Zeichen langen Passwort verschlüsselt werden. Die Exportübersicht zeigt Originaldateien und frühere Bearbeitungsschritte. Die bereinigte Weitergabe erzeugt eine PDF aus sichtbaren Seitenbildern bis 2800 Pixel; sie enthält keine Originaldateien, Anhänge oder Projektverläufe. Suchtext, Links, interaktive Formulare und Zertifikatssignaturen entfallen. Sichtbare vertrauliche Angaben bleiben sichtbar. Der Browserspeicher bleibt unverschlüsselt.

Unter Projekte stehen Speicherbelegung, Anfrage dauerhafter Speicherung und Offline-Pakete zur Verfügung. Offline benötigt HTTPS oder localhost, einen unterstützten Browser und einen abgeschlossenen Download der App sowie der gewählten Sprachen/Laufzeiten. Der Download prüft die Integrität jeder Programmdatei. App-Updates werden nach dem Schließen aller älteren Tabs aktiv. Serverwerkzeuge brauchen weiter den eigenen Server. Offline-Dateien entfernen löscht keine Projekte oder Ergebnisse.

Noch laufende Vorschauen werden beim Verlassen des sichtbaren Bereichs sofort abgebrochen, damit neu sichtbare Seiten nicht warten müssen. Fertige Vorschaubilder werden nach einer kurzen Speicherfrist freigegeben. Die OCR-Verarbeitung verwendet auf Geräten mit mindestens 8 GB gemeldetem Speicher und acht logischen Kernen höchstens zwei, sonst höchstens einen Hauptworker. Zusätzliche Sprachproben können einen eigenen kurzlebigen Worker nutzen. Die Grenzen für Quelldateien und aktive Seiten werden nicht ohne weitere Belastungsnachweise erhöht.

Physische iPhone-/iPad-/Android-/Windows-Touch-Geräte und echte Microsoft-Word-Rundläufe bleiben gesondert abzunehmen; Browserautomation gilt nicht als Nachweis dafür. Siehe [Gerätecheckliste](quality/editor-device-checklist.md).


## Kopf- und Fußzeilen bereinigen

Wiederkehrende auslesbare Randtexte werden an ähnlichen Positionen auf mindestens zwei Seiten vorgeschlagen. Kopf- und Fußzeilen sind getrennt wählbar; Suchränder reichen von 3–25 %. Wechselnde Seitenzahlen werden optional gruppiert. Einzelne Treffer lassen sich ausschließen und direkt am Original prüfen. Die Bereinigungsvorschau zeigt weiße Löschbereiche. Reine Scans und einzelne Seiten lassen sich durch manuelle Bereiche im oberen oder unteren Seitenviertel bearbeiten, auf der aktuellen oder auf allen Seiten an derselben relativen Position.

Der Export entfernt Inhalte tatsächlich; Bilder und Linien innerhalb der bestätigten Bereiche sowie vollständig erfasste Links werden ebenfalls entfernt. Angeschnittene Textzeilen oder Links, berührte Kommentare/Formularfelder und sich widersprechende Ausnahmen sperren den Export. Übriger auslesbarer Text, Seitenzahl, sichtbare Seitengrößen und verbleibende Anmerkungen werden unabhängig geprüft. Bis zu 200 Seiten, 2.000 Fundstellen und 80 MB. Keine automatische OCR für reine Scans. Signierte PDFs und dynamische XFA werden abgewiesen. Anhänge, Dokumentinfos und Barrierefreiheits-Tags werden nicht gezielt bereinigt; das Werkzeug ersetzt keine vollständige Anonymisierung. Entwürfe bleiben in Projekten, die Prüfbestätigung muss nach Änderungen erneut erfolgen.

## Formularhelfer und Belege auf A4

Der **Formularhelfer** speichert bis zu zehn Profile nach ausdrücklichem Speichern lokal. Eindeutige Feldbezeichnungen liefern Vorschläge für leere Textfelder; vorhandene Werte und unklare Zuordnungen bleiben erhalten. Angaben lassen sich manuell zuordnen oder als transparente Textfelder auf Scans platzieren. Vor dem Export ist die Prüfung am Original zu bestätigen. Optional werden Formularwerte festgeschrieben. Profile bleiben unverschlüsselt im Browserspeicher und werden nicht mit Projektdateien übertragen; Formularentwürfe gehören zum Projekt. Signierte PDFs und dynamische XFA werden abgewiesen. Überlaufende neue Einträge und nicht unterstützte Zeichen sperren den Export.

**Belege auf A4 sammeln** schneidet einzelne Belege aus Fotos oder PDFs zu, auch mehrere Ausschnitte derselben Scan-Seite. Reihenfolge, Beschriftung, Nummerierung und Druckbreiten von 30–190 mm sind wählbar. Die A4-Vorschau verwendet dieselbe Anordnung wie der Export. Lange Belege werden bei gleicher Breite in gekennzeichnete Teile aufgeteilt; zu breite Belege müssen angepasst werden. Die Ausgabe besteht aus zugeschnittenen Seitenbildern ohne ursprüngliche Textebene, Links, Formulare, Anhänge oder Signaturen. Bis zu 200 Belege, 400 platzierte Teile und 80 MB Ausgabe; Ausschnitte werden mit bis zu rund vier Megapixeln gerendert. Mit 100 % / Tatsächliche Größe drucken. Zuschnitte und Anordnung werden im Projekt gespeichert.

## Browser und Dokumentenserver

Viele Werkzeuge arbeiten lokal im Browser. Die vollständige Docker-Installation ergänzt einen automatisch verbundenen Dokumentenserver. Dessen Aufträge starten erst mit dem jeweiligen Aktionsknopf. Der PDF-Editor bereitet sichtbare Seiten und Scan-Texte automatisch lokal vor.

Die Browser-Ausgabe bietet für PDF zu Word drei lokale Modi: Seitenlayout mit Bildern und Textfeldern, bearbeitbaren Fließtext mit erkannten Tabellen und Bildern sowie reinen Absatztext. Die normale Komprimierung erhält PDF-Inhalte und verkleinert geeignete JPEG-Bilder; die separate Wunschgrößen-Komprimierung bietet lokal eine Struktur-Optimierung. Erweiterte Konvertierungen und Prüfungen benötigen die entsprechenden Serverkomponenten; Details stehen in der [Serverdokumentation](../server/README.md).

## Seiten, Bearbeitung und OCR

- Check & Seitenfinder: dateiübergreifende Textsuche, lokale Scan-Erkennung, Trefferseiten als neue PDF; Hinweise auf Scan-Seiten, mögliche Leerseiten, optisch gleiche Seiten und unterschiedliche Papierformate
- OCR & Text: 21 Sprachen, bis zu acht kombiniert und optionale automatische Sprachprobe; automatische Seiteneinteilung, Textblock, Textspalte, Textzeile oder verstreuter Text; korrigierbare OCR-Zeilen neben der PDF-Vorschau und Übernahme der Korrekturen in die PDF-Suchebene
- JPG, PNG, WebP, BMP, mehrseitige TIFF, HEIC/HEIF, PSD und eigenständige SVG zu PDF (als Bildseiten); PDF zu PNG/JPG/WebP/TIFF/BMP im ZIP
- Komprimierung mit Inhaltserhalt, verlustfreie Optimierung oder ausdrücklich gewählter Bildneuaufbau; Originalvergleich mit gleichem Zoom
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
- PDF bearbeiten mit automatischer Scan-OCR, Inhalte entfernen und Bilder einfügen
- Originalobjekte bearbeiten: Text in vorhandener Schrift, Suchen/Ersetzen pro Seite, Bilder ersetzen, Objekte verschieben/drehen/skalieren/löschen; zusätzlich Absatzmodus mit mehreren Textobjekten, gemischten Formatierungen, Schriftformung, Umbruch auf zusätzliche Seiten, Vorschau und Überlaufprüfung; einzelne Unterobjekte verschachtelter Gruppen öffnen und bearbeiten; wiederverwendete Instanzen bleiben unabhängig
- Linearisierung für schnelle Webansicht; strukturierter JSON-Export mit Textpositionen
- PDF-Informationen und Textvergleich zweier PDFs
- In Abschnitte teilen, abwechselnd zusammenfügen, Broschüren und Seiten aufteilen
- Weiße Ränder entfernen, Schwarzweiß-Scan und Farben umkehren
- Stempel, Metadaten bearbeiten, Anmerkungen entfernen und PDFs überlagern
- Dateianhänge und eingebettete Bilder extrahieren
- Formulare ausfüllen und erstellen; Lesezeichen bearbeiten
- PDF schützen (AES-256) und mit bekanntem Passwort entsperren
- E-Rechnungen lesen und mit einem Basischeck prüfen; UBL, UBL-Gutschriften und CII aus XML oder eingebetteten PDF-Anhängen

PDFs, Rechnungs-XML und unterstützte Bildformate lassen sich überall ins Fenster ziehen. Die Seitenreihenfolge wird per Drag-and-drop oder über Pfeile geändert. Visuelle Bereiche lassen sich direkt aufziehen beziehungsweise platzieren oder über Prozentwerte eingeben. Bis zu 30 Arbeitsstände einschließlich übernommener Ergebnisse sowie Seiten- und Bereichsänderungen können rückgängig gemacht und wiederholt werden (Strg/⌘ + Z und Strg/⌘ + Umschalt + Z). Nach dem Hinzufügen oder Schließen von Dateien beginnt der Verlauf neu.

Ergebnisse können als neue Arbeitsdokumente übernommen werden. OCR exportiert durchsuchbare PDF, TXT und DOCX (Text ohne Rekonstruktion des ursprünglichen Layouts). Seitenwerkzeuge übernehmen ausstehende visuelle Änderungen auf den ausgewählten Seiten. Beim Wechsel in Spezialwerkzeuge wird der Arbeitsstand übernommen; bei möglichen Strukturverlusten ist eine bewusste Entscheidung nötig. Die Übernahme von Ergebnissen erhält den Rückgängig-Verlauf.

Über „Projekte“ lassen sich Dateien und Arbeitsstände einschließlich Editorverlauf, Formularen und Lesezeichen lokal wiederherstellen (letzte fünf gespeicherte Stände). Speicherung erfolgt unverschlüsselt im Browserspeicher; beim Projektwechsel wird die aktuelle Sitzung davor gesichert. Die letzten zehn Ergebnisse werden bis insgesamt 160 MB lokal abgelegt; der Arbeitsstand wird automatisch zur Wiederherstellung nach dem Neuladen gesichert. Ein gewählter Stand lässt sich als optional passwortverschlüsselte `.moinpdf`-Projektdatei einschließlich Originalen und Verlauf übertragen. Dafür „Projektdatei herunterladen“ beziehungsweise „Projektdatei öffnen“ verwenden. Projektdateien sind keine bereinigten Ergebnis-PDFs. Obergrenzen: 80 MB aktive Quelldateien, 200 aktive Seiten und 240 MB einschließlich Rückgängig-Verlauf. Umfangreiche OCR kann auf Mobilgeräten langsam sein.

## Website-Link zu PDF

Unter „HTML & Webseiten zu PDF“ lässt sich eine öffentliche Website-Adresse einfügen. Ein separater Web-Konverter in der vollständigen Docker-Installation rendert Bilder, Schriften, CSS und öffentlich ladbare JavaScript-Inhalte. Papierformat (A4/Letter), Hoch-/Querformat, Hintergrundfarben und Bildschirm-/Druckansicht sind wählbar. Das Ergebnis lässt sich herunterladen oder direkt weiterbearbeiten.

Der Abruf übernimmt keine Anmeldung oder Cookies aus deinem Browser. Cookie-Banner, Bot-Schutz und geschützte oder stark dynamische Inhalte können abweichen. Private Netzwerkadressen und abweichende Ports sind gesperrt. Gespeicherte HTML-/HTM-Dateien bleiben als vereinfachte Textkonvertierung ohne Bilder, Skripte und CSS verfügbar.

## Klar Schiff

Unter **Stapel** erkennt Klar Schiff Rechnungen und Briefe anhand von Dokumentnummer, Absender, Datum und gedruckter Seitenzählung. Drei Schritte führen vom lokalen Einlesen einschließlich Scan-OCR über die Originalvorschau zum Export. Jede Dokumentzuordnung muss bestätigt werden. Titel, Absender, Datum, Dateiname, Dokument- und Seitenreihenfolge lassen sich korrigieren; einzelne Seiten können einem anderen oder neuen Dokument zugeordnet oder bewusst ausgelassen und wiederhergestellt werden.

Visuell gleiche Vorschauseiten werden als mögliche Duplikate markiert, niemals automatisch entfernt. Hinweise auf Seitenlücken beziehen sich ausschließlich auf gedruckte Seitenzählungen. Unklare Dokumentgrenzen bleiben Prüfhinweise; eine allgemeine semantische Klassifizierung oder Vollständigkeitsgarantie ist damit nicht verbunden. Ausgabe: benannte Einzel-PDFs mit Zuordnungsübersicht im ZIP oder Gesamt-PDF mit verlinktem Inhaltsverzeichnis und Lesezeichen. Originalseiten bleiben erhalten, Scans bleiben Bildseiten. Formularwerte werden festgeschrieben; ursprüngliche Signaturen, Lesezeichen und Anhänge werden nicht übernommen. Zuordnungen bleiben beim Werkzeugwechsel und in Projektdateien erhalten.

## Stapel, Abläufe und weitere Dateiformate

- Stapelverarbeitung und gespeicherte mehrstufige Arbeitsabläufe mit JSON-Import/-Export, Wenn-/Sonst-Schritten nach Dateiname, vorhandenen Texten oder Seitenzahl und Protokoll der Entscheidungen; Passwörter und Dokumente werden nicht in Abläufen gespeichert.
- Automatische Dateinamenvorschläge aus Datum, Rechnungsnummer und Titel, mit bearbeitbarer Vorschau.
- Trennen nach Text, Lesezeichen, leeren Seiten oder QR-/Barcode-Trennblättern, mit Abschnittsvorschau.
- Tabellenbereiche zu Excel/CSV, OCR für Scans, manuelle Spaltengrenzen und bearbeitbare Zellen. Mehrseitige Tabellen können wiederholte Kopfzeilen entfernen. Spaltentypen sowie deutsches/englisches Zahlenformat sind wählbar. XLSX speichert erkennbare Zahlen und Daten typisiert, Kennungen und Formeln als Text; CSV schützt vor Formelausführung.
- Suche nach eigenen Begriffen/Namen, E-Mails und möglichen IBANs; bestätigte Fundstellen werden durch vollständigen Neuaufbau der Seitenbilder entfernt. Erkennung ist keine Vollständigkeitsgarantie.
- Pixelbasierter PDF-Vergleich mit farbigen Unterschieden und prozentualem Anteil je Seite.
- Scanverbesserung mit automatischer Schieflagenkorrektur, Kontrast, Helligkeit und Hintergrundbereinigung.
- Deckblatt, klickbares Inhaltsverzeichnis und Lesezeichen mit angepassten Seitenzahlen.
- Serienformulare aus CSV/TSV mit Feldzuordnung, benannten Einzelausgaben im ZIP und optionaler Fixierung.
- QR, Code 128 und EAN-13 erzeugen und platzieren; verbreitete QR-/Barcodeformate auslesen.
- Interne und externe PDF-Links hinzufügen, ändern und entfernen; Vorschau und Koordinaten unterstützen gedrehte Seiten.
- Anhänge hinzufügen, ersetzen, umbenennen und entfernen; QPDF bereinigt nicht mehr referenzierte eingebettete Dateistreams.
- Kamera-/Fotoscanner mit Vierpunkt-Perspektivkorrektur, Scanbereinigung und bis zu 50 gesammelten Seiten.
- Weitere Werkzeuge der **vollständigen Installation**: serverseitiges Office zu PDF, PDF/A erzeugen/prüfen, vollständige KoSIT-XRechnung-Validierung und serverseitige Zertifikatssignaturen. [Servereinrichtung und Grenzen](../server/README.md). Standard-Office-Formate und einfache Zertifikatssignaturen bieten auch lokale Browsermodi; siehe [Ausbaustand](AUSBAUSTAND.md).

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
| PDF als Hörbuch | Lokale OCR, bearbeitbarer Vorlesetext, Abschnitte nach Seiten oder Hauptlesezeichen; Thorsten/Kerstin für Deutsch und LJ für US-Englisch, unabhängige Vorlesesprache, Sprechtempo und Stimmprobe. WAV oder Kapitel-ZIP mit Wiedergabeliste. Audioexport benötigt die vollständige Docker-Installation. |

Die Sprachausgabe verwendet fest installierte, mit SHA-256 geprüfte Modelle und
arbeitet während der Verarbeitung ohne Cloud-Dienst. Nur der ausgewählte
Vorlesetext geht an den integrierten Dokumentenserver. Maximal 20.000 Zeichen und
100 Abschnitte pro Auftrag; maximal drei Minuten Laufzeit. Ein abgebrochener
Browserabruf beendet einen bereits gestarteten Serverauftrag nicht sofort.
Die Browser-Ausgabe kann Vorlesetext auch ohne Server als TXT speichern.
Lizenzen und Modellversionen: [Audio-Hinweise](../server/AUDIO-NOTICES.de.md).

## Konvertieren und erweiterte Prüfungen

Schnellzugriffe, Suche und „Alle Werkzeuge“ führen zu den nach Aufgabe gegliederten Werkzeugen. Auf schmalen Ansichten brechen lange Werkzeugnamen innerhalb ihrer Kacheln um. Die Übersicht ist auch ohne geöffnetes PDF erreichbar.

| Werkzeug | Ausführung | Umfang |
|---|---|---|
| Nach Dateigröße teilen | Browser | Tatsächlich gemessene Bytes je PDF, vollständige Seitenreihenfolge, ZIP; zu große Einzelseiten werden gemeldet |
| PDF zu Word | Browser / Server | Lokal: Seitenlayout mit Bildern und Textfeldern, Fließtext mit erkannten Rastertabellen und Bildern oder reine Textabsätze. Der Server rekonstruiert digitale Seiten mit pdf2docx und wandelt Seiten ohne auslesbaren Text per OCR in bearbeitbare Absätze um. |
| PDF zu PowerPoint | Server | Standardmäßig eine gerenderte PDF-Seite je Folie; optional bearbeitbarer Text mit Stil und Position. Komplexe Layouts können abweichen. |
| E-Mails zu PDF | Server | EML/MSG, Unicode-Kopfzeilen und Nachricht; unveränderte Anlagen mit eindeutigen Namen im ZIP |
| HTML & Webseiten zu PDF | Server | Gespeicherte HTML-Dateien mit Überschriften und Tabellen ohne Skripte/externe Ressourcen; öffentliche Website-Links über den oben beschriebenen separaten Chromium-Dienst |
| Seiten automatisch ausrichten | Server | Tesseract OSD, 90/180/270 Grad, Mindestvertrauen und seitenweiser Bericht |
| Buchscans entzerren | Server | Einstellbare quadratische Spaltenkorrektur links/rechts, neue Seitenbilder |
| Formularfelder erkennen | Server | Leere Rechtecke, Linien und Scan-Konturen; erzeugte Felder anschließend bearbeiten |
| Schwärzungen prüfen | Server | Textsuche, Metadaten, verdächtige dunkle Vektor-Überdeckungen; keine Sicherheitsfreigabe |
| Druckqualität prüfen | Server | Bildauflösung, Font-Einbettung, Seitenboxen; keine PDF/X-Zertifizierung |
| Barrierefreiheit prüfen | Server | Basisprüfung, veraPDF für PDF/UA-1/-2; Struktureditor für neue PDF/UA-1-Dokumente mit geprüfter Ausgabe; manuelle Inhaltsprüfung zusätzlich nötig |
| PDF übersetzen | Server + eigener LibreTranslate-Dienst | Auslesbarer Text und Übersetzung nebeneinander oder an Originalpositionen mit Überlaufprüfung; bis 60.000 Zeichen |
| ZUGFeRD-Assistent | Server | PDF/A-3 und passende CII-XML verbinden; Mustang und veraPDF-Berichte, negative Befunde klar benannt |
| Word-Serienbriefe | Server | DOCX mit {{Spaltenname}} und XLSX; bis 50 Datensätze, einzelne PDFs im ZIP |

Die erweiterten Konverter sind Teil der vollständigen Docker-Installation. Die vollständige Docker-Installation richtet den benötigten LibreTranslate-Dienst automatisch ein; bei separatem Serverbetrieb muss er selbst angebunden werden. Der Import gespeicherter HTML-Dateien ist kein Live-URL-Browser. Buchkorrektur und Prüfungen sind bewusst mit ihren konkreten Grenzen beschrieben.

## Verhalten und Grenzen

- PDF bearbeiten: direkt in Absätzen schreiben, lokale Schriftwahl mit 14 Familien und 56 Schnitten; Originalschrift, Größe, Fett/Kursiv und Farbe aus digitalen Texten übernehmen. Eingebettete Teil-Schriften können neue Zeichen nicht enthalten; Schriftersatz wird angezeigt. Scan-Schriften sind geschätzt. Bei bestätigter Originalobjekt-Bearbeitung bleiben unveränderte Vektoren erhalten, ansonsten gibt es einen gekennzeichneten Bild-Fallback. Überlauf und Überlappungen mit anderen Texten blockieren den Export.

- Check und Seitenfinder prüfen importierte Seiten. Für ausstehende visuelle Änderungen zuerst das Ergebnis anwenden und weiterbearbeiten. Die Scan-Erkennung im Seitenfinder erstellt nur einen lokalen Suchindex; für eine dauerhaft durchsuchbare PDF das OCR-Werkzeug verwenden. Kommagetrennte Suchbegriffe werden als Oder-Suche behandelt, jeweils ab zwei Zeichen.
- Leerseiten- und Duplikaterkennung sind Hinweise anhand von Text, Seitenbild und Seitengröße. Kleine Unterschiede können in der Vorschau fehlen. Abwählen entfernt Seiten nur aus der Exportauswahl und kann rückgängig gemacht werden.

- Schwärzungen werden zuletzt in die gerenderten Pixel der betroffenen Seiten eingerechnet. Die neue Seite enthält ausschließlich dieses geänderte Bild; ursprüngliche Seitenobjekte und Textebenen werden nicht übernommen. Andere Seiten bleiben unverändert. Ergebnis vor der Weitergabe prüfen.
- Zugeschnittene Seiten werden aus dem ausgeschnittenen Pixelbereich neu erzeugt. Inhalte außerhalb dieses Bereichs werden entfernt. Schwärzen, Zuschneiden, Graustufen und Fixieren begrenzen die längste Rasterseite auf 2800 Pixel; die maximale Skalierung beträgt 4,2.
- Textnotizen, Markierungen und Unterschriften erhalten vorhandenen Text, sofern auf derselben Seite kein Rasterwerkzeug angewendet wird. Unterschriften sind eingefügte Bilder, keine Zertifikatssignaturen. Textnotizen unterstützen lateinische Schrift einschließlich Umlauten. Vor dem Drehen visuelle Änderungen anwenden und das Ergebnis weiterbearbeiten.
- Entfernen der Dokumentinfos löscht das Info-Wörterbuch sowie Dokument- und Seiten-XMP. Sichtbare Inhalte, Kommentare, Bilder und eingebettete Objektdaten werden damit nicht anonymisiert.
- „OCR & Text“ berücksichtigt vorhandenen lesbaren Text und erkennt Scanbereiche auch auf gemischten Seiten automatisch. „Alle Seiten neu erkennen“ dient dazu, vorhandene OCR-Ergebnisse zu ersetzen; sichtbarer Originaltext bleibt erhalten und ist in der OCR-Korrektur gesperrt. Korrigierte Zeilen stehen für TXT, DOCX und die Zwischenablage bereit. Vor dem PDF-Download oder der Weiterbearbeitung „Korrekturen übernehmen“ wählen, damit auch die PDF-Suchebene aktualisiert wird. Das sichtbare Seitenbild bleibt unverändert; sichtbare Textänderungen gehören in „PDF bearbeiten“.
- „Scans komprimieren“ verwendet standardmäßig „Inhalte erhalten, Bilder verkleinern“: Text, Vektoren, Links und Formularfelder bleiben erhalten, geeignete RGB-JPEGs werden einzeln verkleinert. „Verlustfrei optimieren“ verändert keine Bildpixel. Nur „Seiten als Bilder neu aufbauen“ entfernt kopierbaren Text, Links und Formularfunktionen. Bei Formularen, Lesezeichen oder Tags eine vollständige einzelne PDF verwenden; signierte PDFs werden abgewiesen. Eine kleinere Datei ist in keinem Modus garantiert.
- Exporte erzeugen neue Dateien. Seitenbasierte Exporte können Formularfelder fixieren und dokumentweite Funktionen wie Lesezeichen verlieren. Die Werkzeuge für Formulare und Lesezeichen erhalten die jeweils anderen Dokumentfunktionen; PDF schützen/entsperren erhält Seiten, Formulare, Lesezeichen und Anhänge. Vorhandene digitale Signaturen können durch Änderungen ungültig werden.
- Geschützte PDFs werden nach Passwortabfrage lokal entschlüsselt. Öffnungsschutz verwendet AES-256; Druck-, Kopier- und Bearbeitungsregeln hängen zusätzlich vom PDF-Programm ab. Passwörter werden nicht dauerhaft gespeichert.
- E-Rechnungen: höchstens 5 MB je XML und 2.000 Positionen. Der Basischeck prüft grundlegende Angaben, Datums-/Zahlenformate und ausgewählte Summen, aber keine vollständige XSD-, EN-16931-, KoSIT-, Peppol- oder PDF/A-Konformität. Nicht berechenbare Positionen werden als Hinweis ausgewiesen. Zahlungsbedingungen bleiben auch ohne separate Bankangaben sichtbar. Lese-PDF und Prüfbericht enthalten die unveränderte XML als Anhang; sie sind keine zertifizierten ZUGFeRD- oder PDF/A-Dateien.
- Ressourcen und OCR-Sprachdaten kommen vom gleichen Ursprung. Hosting-Zugriffe und die Hosting-Anmeldung sind unabhängig von der lokalen Dokumentverarbeitung.
- Optionale WebMCP-Werkzeuge registrieren sich nur, wenn `document.modelContext` verfügbar ist. Im HTTP-Vorschau-Browser fehlt diese Schnittstelle; die UI funktioniert unabhängig davon.

## Historische Ergänzungen in 0.7.0

Diese Einträge beschreiben den damaligen Versionsstand. Aktuell unterstützt OCR bis zu acht Sprachen und eine optionale Sprachprobe, wie oben beschrieben.

- **PDFs vergleichen:** Neben dem seitenweisen Vergleich gibt es „Inhalte über
  Seiten hinweg“. Der Bericht zeigt Wortänderungen, Fundseiten und verschobene
  Textblöcke. Doppelte oder uneindeutige Zuordnungen sind gekennzeichnet; Bilder
  und Formatierung bleiben Aufgabe des visuellen Vergleichs. Der TXT-Export
  enthält alle Einträge, auch die in der Oberfläche ausgeblendeten.
- **Projektdateien:** Ein Arbeitsstand mit Rückgängig-Verlauf, Quellen und
  Rechnungs-XML, bis zu 80 MB Dokumentdaten und 20 MB Bearbeitungsdaten. Vorhandene
  PDFs werden beim Import tatsächlich geöffnet und Seitenverweise geprüft.

## Historische Ergänzungen in 0.8.0

- Absatzeditor im Werkzeug „PDF-Objekte bearbeiten“: mehrere Textobjekte ersetzen,
  automatische Zeilenumbrüche, Noto Sans oder eigene statische TTF, Größe, Farbe,
  Ausrichtung, Innen- und Zeilenabstand; echte Ergebnisvorschau. Fehlende Glyphen,
  Textüberlauf und überstehende Schriftkonturen verhindern den Export.
- Absätze unterstützen gemischte Formatierungen, Folgeseiten und komplexe Schriftformung mit HarfBuzz;
  Texte innerhalb von Objektgruppen bleiben vom Absatzmodus ausgenommen. Übrige Objekte bleiben
  erhalten. Vorhandene Signaturen und Struktur-Tags nach Textänderungen prüfen.
- „Barrierefreiheit prüfen“ bietet zusätzlich echte veraPDF-Profile für PDF/UA-1
  und PDF/UA-2. Neue Dokumente können aus Überschriften, Absätzen und Bildern mit
  Alternativtext aufgebaut werden. Die Reihenfolge ist editierbar; Strukturdateien
  lassen sich lokal speichern und importieren.
- Der Dokumentenserver erzeugt die strukturierte A4-Neufassung mit LibreOffice
  und validiert sie anschließend mit veraPDF. Bei fehlgeschlagener Prüfung gibt
  es ausschließlich Berichte, keine PDF-Ausgabe. Maschinenprüfung ersetzt nicht
  die Prüfung von Sinn, Vollständigkeit, Lesereihenfolge und Kontrast.
- PDF-Textimport ist ein Entwurf und übernimmt weder Originalseitenlayout noch
  Tabellen, Bilder, Formulare oder Signaturen. Diese Funktion ist keine
  nachträgliche automatische Reparatur beliebiger existierender PDF-Tags.

---

[Zur README](../README.md) · [Installation](../DOCKER.md) · [Entwicklung](ENTWICKLUNG.md)
