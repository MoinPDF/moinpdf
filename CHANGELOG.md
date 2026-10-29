# Änderungen

**Deutsch** · [English](CHANGELOG.en.md) · [← README](README.md)

MoinPDF verwendet semantische Versionsnummern (`MAJOR.MINOR.PATCH`). Die zentrale
Versionsnummer steht in `package.json`; die Oberfläche liest sie daraus. Docker-
Images tragen zusätzlich den Quellcode-Commit, veröffentlichte Container einen festen Digest.

Die Einträge beschreiben den jeweiligen historischen Versionsstand. Aktuelle
Funktionen und Grenzen stehen im [Ausbaustand](docs/AUSBAUSTAND.md).

## Noch nicht veröffentlicht

- Das vorhandene Sammelscan-Werkzeug wird zu „Scanfotos automatisch trennen“: lokale Konturerkennung mit einstellbarer Kontrastschwelle, Schieflagenkorrektur über die gemeinsame Vierpunkt-Transformation, Einzelvorschauen, manuelle Ecken-/Rechteckkorrektur und Drehung. JPG/PNG oder einzelne PDFs im ZIP sowie eine gemeinsame Foto-PDF. Unsichere Erkennung, leere Ergebnisse und Grenzen werden angezeigt; Originale bleiben unverändert. Bestehende Projektausschnitte und der Katalog mit 118 Werkzeugen bleiben erhalten.
- Deutsche und englische Anleitung sowie Regressionen für schwachen Kontrast, Schieflage, Staub, manuelle Korrekturen, Exportinhalte, Abbruch und Browserbedienung ergänzt.

## 0.25.2 – 28. Oktober 2026

- WebKit verarbeitet PDF-Bilddaten ohne den anfälligen Offscreen-Bitmap-Transfer. Das verhindert leere Scanvorschauen und dadurch ausbleibende OCR bei großen Bildern; Originalauflösung und PDF-Inhalte bleiben erhalten.
- Die Browserabnahme prüft zusätzlich einen gezielt gestörten Bitmap-Transfer mit denselben Scan-, OCR-, Export- und Pixelanforderungen. Bestehende Zeitgrenzen und Veröffentlichungssperren bleiben erhalten. Die bereits veröffentlichte Version 0.25.1 wird nicht verändert.

## 0.25.1 – 28. Oktober 2026

- Scan-Komprimierung verarbeitet auch Graustufen-, Flate- und weitere geeignete Bildressourcen mit ihren PDF-Farbdefinitionen. Text, Links, Formularwerte und Seitengeometrie bleiben erhalten; nicht unterstützte Bilder bleiben unangetastet. Reine Strukturverbesserungen werden nicht mehr als Bildverkleinerung beschrieben.
- Wunschgröße verwendet ebenfalls lokale Bildverkleinerung und zeigt Prozentfortschritt, Komprimierungsstufe, Bildzähler und Abbruch. Jede Ausgabe wird gegen die Zielgröße gemessen.
- Breite Desktopansichten behalten einen normal breiten Komprimierungsbereich. Deckende helle Navigationsflächen vermeiden graue Reste der Unschärfe-Ebene.
- Regressionen mit fiktiven Scans prüfen tatsächliche Größenreduktion, Bilddarstellung, Inhaltserhalt, Masken, fehlerhafte Bilder, Zielgrößen und Abbruch; Browserprüfungen decken breite Ansichten und Mobilgrößen ab.

## 0.25.0 – 27. Oktober 2026

- Große Desktopansichten nutzen die Monitorbreite dynamisch (bis 1.760 px statt starrer 1.180 px). Navigation, Suchzeile, Upload, Kategorien und Schnellzugriff erhalten dort besser lesbare Größen. Die Mobil- und Tabletansichten sowie die tatsächliche PDF-Darstellung bleiben unverändert. Browserregressionen prüfen auch 1.600, 1.920 und 2.560 Pixel breite Ansichten.

- Der Light Mode erhält auf dem Desktop einen durchgehend satteren mintgrünen Hintergrund. Auch zwischen den grünen Verläufen bleibt die Grundfläche grün statt blassgrau. Helle Karten, der Dateiauswahl-Button, die mobile Ansicht und der Dark Mode behalten ihre Gestaltung.

## 0.24.0 – 27. Oktober 2026

- Der vollständige Stand mit 118 Werkzeugen erhält eine eigene Version. Die beiden zusätzlichen Werkzeuge sind „Farben & Hintergrund ändern“ und „Große PDFs verarbeiten“. Bestehende 0.23.0-Release-Artefakte bleiben erhalten.

- **Schwärzen mit Texterhalt:** Manuelle Bereiche und Suchtreffer können vollständig erfasste, einfache digitale Textobjekte entfernen und übrigen Text sowie Vektorgrafiken erhalten. Seitengeometrie, Resttext, Links und Bilddarstellung werden vor der Ausgabe geprüft. Dokumentinfos und ungenutzte Ressourcen werden bereinigt. Bei nicht unterstützten Strukturen wird die Ausgabe gesperrt; der bestehende Bildmodus bleibt ausdrücklich wählbar.
- **Große PDFs:** Eigener Arbeitsbereich bis 256 MB und 1.000 Seiten für Drehen, verlustfreies Optimieren und OCR. Dateibasiertes Lesen, Abschnitte mit höchstens 50 Seiten, atomare lokale Zwischenstände und Fortsetzen nach Abbruch. Abschnitte können im Editor bearbeitet und bei gleicher Seitenzahl ersetzt werden. Die Gesamtausgabe wird auf allen Seiten gegen die geprüften Abschnitte geprüft. Der normale Editor bleibt bei 80 MB und 200 aktiven Seiten.
- **Klar Schiff:** Bis zu 30 ausdrücklich gespeicherte lokale Layoutregeln für Absender, Dokumentnummer und Datum. Wiederkehrende Dokumente erhalten Vorschläge; Konflikte und unsichere OCR bleiben sichtbar. Eindeutige Vorschläge lassen sich nach Prüfung gemeinsam bestätigen.

Große Aufträge und Erkennungsregeln bleiben unverschlüsselt im Browser, bis sie gelöscht werden; sie werden nicht in Projektdateien eingebettet. Große PDFs mit Formularen, Signaturen, internen Verweisen, Lesezeichen, Anhängen oder Struktur-Tags werden vorab abgelehnt. Maximal 768 MB gespeicherte Aufträge und 256 MB Gesamtausgabe; Dokumentinfos werden bei der Zusammenführung nicht übernommen. Desktop-Browser empfohlen. Browser ohne lokale Blob-Speicherung (etwa private WebKit-Fenster) werden vor dem Start mit einem Hinweis abgewiesen; Speichertransaktionen haben Zeitgrenzen.


### Weitere Verbesserungen

- Formularprofile behalten alle Angaben bei schnellen aufeinanderfolgenden Eingaben und beim automatischen Ausfüllen mehrerer Felder.
- Lokale Office-Konvertierung: bestätigtes Herunterfahren läuft ohne einen zweiten, konkurrierenden Abbruch aus. Auch eine späte Bestätigung hebt den harten Zeitwächter auf; blockierte Laufzeiten werden weiterhin begrenzt abgebrochen. Strenge Prüfungen auf verbliebene Prozesse bleiben erhalten.
- Farben & Hintergrund ändern: Textfarben ohne Schriftwechsel, Hintergrund hinter vorhandenen Inhalten, Vorlagen, Original-/Ergebnisvorschau und Bildmodus für Helligkeit, Kontrast und Sättigung.
- Formularhelfer: einzelne oder alle unterstützten schreibgeschützten Felder freigeben, vorhandene Werte und andere Feldflags erhalten; keine gleichzeitige Fixierung.
- Zuschneiden: zusätzlicher Text erhaltender Modus mit deutlichem Hinweis auf verbleibende Randinhalte. Abwechselnd zusammenfügen: Duplex-Blöcke in einer PDF, Trennstelle, Rückseitenumkehr und Seitenfolgevorschau.
- Deutsche/englische Oberfläche und Anleitung, gespeicherte Einstellungen und Regressionen mit fiktiven PDFs für native Farben, Formularwerte, gedrehte Ausschnitte und Reihenfolge.

## 0.23.0 – 26. Oktober 2026

- Die native Safari-Prüfung verwendet den Intel-Mac-Pool, nachdem der ARM-Pool wiederholt vor dem Teststart abgebrochen hat. Alle Browser-, Docker- und Dokumentationsprüfungen bleiben Voraussetzung für die Veröffentlichung. Die neue Versionsnummer fasst die seit 0.22.0 hinzugekommenen Werkzeuge zusammen und erhält die bestehenden Release-Artefakte unverändert.
- Kopf- und Fußzeilen bereinigen: wiederkehrende Randtexte und wechselnde Seitenzahlen, prüfbare Einzeltreffer mit Ausnahmen, manuelle Scan-Bereiche und weiße Vorschau. Tatsächliche Inhaltsentfernung mit unabhängiger Text-, Geometrie- und Anmerkungsprüfung, Projektentwürfen sowie deutscher und englischer Anleitung.
- Formularhelfer mit ausdrücklich gespeicherten lokalen Profilen, vorsichtigen Vorschlägen für leere Formularfelder, manueller Zuordnung und transparenten Einträgen auf Scans. Geprüfter PDF-Export, optionale Fixierung, Unicode-Schrift und Projektentwürfe.
- Belege auf A4 sammeln mit Zuschnitt, mehreren Belegen von einer Scan-Seite, Reihenfolge, Beschriftungen, Nummerierung, millimetergenauer Druckbreite und gemeinsamer Vorschau-/Exportanordnung. Lange Belege behalten ihre Breite und werden in gekennzeichneten Teilen fortgesetzt.
- Deutsche und englische Oberfläche und Anleitungen, synthetische PDF-Rundlauf- und Bildprüfungen sowie Browserregressionen für beide Abläufe.


- Klar Schiff unter Stapel: lokale Text-/OCR-Erkennung, konservative Dokumentgruppen, Originalvorschau, bearbeitbare Zuordnungen/Dateinamen/Reihenfolge, Duplikat- und Seitenlückenhinweise, ausdrückliche Prüfung, gespeicherte Arbeitsstände und echte Einzel-PDF-ZIPs oder verlinkte Dokumentenmappen.
- Vorlesesprache unabhängig von der Oberfläche, zusätzlich zu deutschen Stimmen das fest versionierte lokale LJ-Speech-Modell für US-Englisch. Verfügbare Stimmen werden nach Sprache angeboten; fehlende englische Modelle sperren deutsche Stimmen nicht und führen zu keinem stillen Sprachwechsel.
- Deutsche/englische Anleitung, Modellhinweise, Regressionen für Originalseiten und Exporte, echte Spracherzeugung und Browserabnahme ergänzt.

## 0.22.0 – 26. Oktober 2026

- Der Word-Export startet lokal mit zwei klaren Zielen: „Aussehen möglichst erhalten“ und „Text und Tabellen bearbeiten“. Text-only-Ausgabe und ein eingerichteter Dokumentenserver stehen unter „Weitere Optionen“; gespeicherte Einstellungen bleiben nutzbar.
- Präzisere Schriftvergleiche für gedrehte Textstellen, Unicode-Zeichen, Zeichenabstände und horizontal skalierte Texte. Abweichungen beziehen sich auf die tatsächlich verwendete Ersatzschrift.
- Die Vorprüfung bündelt Hinweise je Textstelle mit Seitennummer, Textausschnitt und einem Sprung zur Bearbeitung. Unsichere Scan-Schriften verweisen auf den Vergleich; ungeeignete Höhenanpassungen bei Tabellen, Scans und gedrehten Texten werden nicht angeboten.
- Sichtbare Seiten haben Vorrang vor wartenden Vorschauen außerhalb des Bildschirms. Abgebrochene Bildkodierung blockiert die Warteschlange nicht mehr; temporäre Bildflächen werden auch bei Fehlern freigegeben. Die Vorbereitung der nächsten OCR-Seite pausiert während Eingaben und Interaktionen.
- Der Textcursor bleibt auch beim Schreiben auf horizontal vergrößerten Seiten und bei Bewegungen des mobilen Sichtbereichs erreichbar. Bewusstes Scrollen und Bedienaktionen behalten Vorrang.
- Deutsche und englische Anleitung sowie Regressionen für echte PDF-/DOCX-Ausgaben, Vorschauabbruch, Leerlaufvorbereitung und mobile Cursor-Geometrie aktualisiert. Physische iPhone-, iPad- und Android-Prüfungen bleiben separat offen.

## 0.21.2 – 25. Oktober 2026

- Docker-, Editor-, native Browser- und Dokumentationsprüfungen starten für jeden Commit auf `main`, auch bei reinen Abhängigkeits- oder CI-Änderungen.
- Die Image-Veröffentlichung wartet bis zu 45 Minuten auf noch laufende oder verzögert sichtbare Prüfungen desselben Quellstands. Fehlgeschlagene Prüfungen, ein neuerer Hauptzweig und erfolglose Docker-Wiederholungen bleiben gesperrt.
- Dokumentenserver mit gemeinsam aktualisiertem Pydantic 2.14.1 / pydantic-core 2.50.1 sowie PyMuPDF 2.0; aktualisierte GitHub-Actions für Python und Testartefakte.
- Zusätzliche Regressionen für die Release-Freigabe und aktualisierte deutsche und englische Entwicklungs- und Prüfungsdokumentation. Bereits veröffentlichte Versionen werden weiterhin nicht überschrieben.

## 0.21.1 – 2026-10-25

- Hängende PDF-Exportprüfungen lassen sich abbrechen, auch wenn der PDF-Worker nicht mehr antwortet. Temporäre Prüfsitzungen beenden ihre Worker spätestens nach einer begrenzten Aufräumphase.
- Jeder asynchrone Prüfschritt hat eine Zeitgrenze von 60 Sekunden. Bei Zeitüberschreitung wird die vollständige Prüfung einmal mit einem neuen Worker und Schriftkonturen wiederholt. Bei erneutem Stillstand bleibt der Download gesperrt und die Bearbeitung geöffnet.
- Regressionen für blockierte Worker, blockierte Schriftladung, Abbruch, erneuten Export derselben Bearbeitung und erhaltene Formularfelder. Native Safari-Prüfungen ergänzen die Browser-Engine-Matrix; physische Geräte und Microsoft Word bleiben gesondert ausstehend.
- Auch die gemeinsame Downloadprüfung verwendet beendbare Prüfsitzungen. Ein Zeitlimit hält ungeprüfte Ausgaben gesperrt und bietet eine erneute Prüfung an.

## 0.21.0 – 2026-10-25

- Gemeinsame technische Prüfung von PDF-Ausgaben vor Download und Teilen; Seitenmaße, Suchtext, Links und Formularfelder werden bei vorhandener Seitenzuordnung verglichen. Auffälligkeiten und Prüflücken sind ausdrücklich zu bestätigen.
- Optional passwortverschlüsselte Projektdateien und Gesamtarchive mit AES-256-GCM, authentifizierten Blöcken und PBKDF2-SHA-256. Inhaltsübersicht vor dem Export; bereinigte PDF-Weitergabe als reine Seitenbilder.
- Speicheranzeige, Hinweis bei knapper Speicherquote und ausdrückliche Anfrage dauerhafter Browserspeicherung. Falsche Größenangaben bei Projektimporten korrigiert.
- Installierbare Offline-App mit einzeln wählbaren OCR-Sprachpaketen und optionalen Laufzeiten. Integritätsprüfung der Programmdateien, getrennte Offline-Ablage, Abbruch und Entfernung; kein Cache für Dokumente oder Server-API-Antworten.
- Vorschauen außerhalb des sichtbaren Bereichs geben ihre Bilddaten frei; noch laufende Vorschauen werden sofort abgebrochen, damit sie neu sichtbare Seiten nicht aufhalten. OCR-Worker werden geräteabhängig begrenzt und wartende Aufträge lassen sich abbrechen. Die belegten Grenzen von 80 MB und 200 aktiven Seiten bleiben bestehen.
- Offline-Hintergrundprozesse behalten den lokalen Cache-Zugriff und die erforderlichen Sicherheitsheader; Rückgängig/Wiederholen vermeiden störende Fokuswechsel beim Antippen im Texteditor.
- Aktuelle Programmgrenzen in der Dokumentation werden aus den Anwendungskonstanten erzeugt. Deutsche und englische Anleitungen um Exportprüfung, Projektschutz, Speicher und Offline-Nutzung erweitert.

- Inhaltserhaltende Komprimierung, verlustfreier Modus und synchronisierter Originalvergleich.
- OCR-Zeilenkorrekturen in der PDF-Suchebene, gemischte Seiten und genaue Schräglagenzuordnung.
- Zusätzlicher Word-Export mit Fließtext, echten Rastertabellen, Bildern und Kopf-/Fußzeilen; schmale Tabellen auch im PDF-Editor.
- Wiederherstellung von Zoom, Scrollposition und typgeprüften Spezialwerkzeug-Entwürfen.
- Fortsetzbare lineare/verzweigte Stapel, Einzel- und Teildownloads, gezielte Fehlerwiederholung und begrenzte lokale Ablage.
- Seitenressourcen nach Vorschauen freigeben; zusätzliche echte Ausgabeprüfungen mit fiktiven Dokumenten. Physische Mobilgerätetests sind weiterhin offen.

## 0.20.1 – 2026-10-24

- „PDF zu Word“ bietet im Browser standardmäßig „Seitenlayout mit Bildern“. Originale Seitenformate, Bildpositionen, Spalten und Tabellenlinien bleiben erhalten; Text wird in bearbeitbaren Textfeldern angeordnet. Der einfache Absatzexport und der Dokumentenserver bleiben verfügbar.
- Scan-Seiten werden lokal per OCR erkannt. Erkannte Buchstaben werden aus dem Hintergrund entfernt, bevor bearbeitbarer Text eingesetzt wird. Nicht zuverlässig rekonstruierbare Seiten und gedrehte Textbereiche bleiben sichtbar als Grafik; die Ergebnisansicht nennt diese Einschränkungen. Tabellenlinien sind ein Seitenhintergrund, keine Word-Tabellen.
- Deutsche und englische Werkzeuganleitung aktualisiert; mehrteilige Ergebnishinweise werden einzeln übersetzt.
- Unbenutzten Callback im Word-Werkzeug entfernt, der die strenge Docker-Codeprüfung blockierte.
- Zusätzliche Browsertests laden tatsächliche DOCX-Ausgaben herunter und prüfen Bilder, Text, Seitenformate, Scan-Erkennung und den Wechsel zum Absatzexport auf Desktop und schmalen Touch-Ansichten. Die Veröffentlichung der Images verlangt außerdem erfolgreiche Editor-, Browser- und Dokumentationsprüfungen desselben Quellstands.

## 0.20.0 – 2026-10-24

- Persönlicher Schnellzugriff mit bis zu sechs sortierbaren Favoriten, zuletzt verwendeten Werkzeugen und direktem Zugang zu gespeicherten Arbeitsabläufen.
- Globale Werkzeugsuche mit Strg/Cmd+K, direkte Ergebnis- und Auftragsanzeige sowie passende nächste Schritte nach einer PDF-Ausgabe.
- Ruhigere Bearbeitung mit einklappbaren Zusatzoptionen. Mobil stehen Werkzeuge, Rückgängig, Format und PDF-Ausgabe unten bereit; Einstellungen öffnen sich als Dialog von unten. Der Seemann auf der mobilen Startseite bleibt erhalten.
- Drei verständliche Komprimierungsprofile mit optional gespeicherter Auswahl; klarere Unterscheidung zwischen Browser-Sicherung, Projekt und fertiger PDF.
- Gezielte Sicherheitsupdates für `fast-uri` und `undici`; die Mindestalter-Ausnahmen sind auf die geprüften Korrekturversionen beschränkt.
- Die lokale Office-Konvertierung lässt den bestätigten Worker-Abschluss vor dem harten Abbruch auslaufen; der begrenzte Abbruch für nicht reagierende Worker bleibt bestehen.

Bereits seit 0.19.0 integrierte Verbesserungen am PDF-Editor:

- Undurchsichtige Scan-Ausschnitte bleiben ohne zusätzliche Transparenzmaske. Dadurch behalten unveränderte Texte auch in unabhängigen PDF-Lesern ihre Darstellung. Der Abrechnungs-Browsertest prüft die benachbarten Bereiche pixelgenau.
- Der Scan-Schriftvergleich berücksichtigt alle 14 lokalen Familien und bis zu drei unabhängig übereinstimmende Referenzstellen. Geeignete rechtwinklig gedrehte Ausschnitte werden unterstützt; kurze Zahlen benötigen mindestens zwei passende Referenzen. Gemischte oder mehrdeutige Ausschnitte behalten die sichere Rückfalloption.
- Die Ergebnisansicht trennt Exportprüfung und Schriftähnlichkeit zum Original. Automatische Detailausschnitte zeigen Original und Ergebnis mit gemeinsamem Zoom und synchronem Scrollen; manuelle Formatänderungen machen frühere Ähnlichkeitswerte ungültig.
- Neue Desktop-/Touch-Abnahme mit einer fiktiven Abrechnung ohne manuelle Schrift- oder Größenkorrektur sowie Tests für Abbruch und Speicherfreigabe des Detailvergleichs. Prüfungen auf physischen Geräten bleiben in einer eigenen Checkliste offen.

- Doppelte unsichtbare OCR-Wörter mit stark überlappenden, unterschiedlich großen Rahmen ergeben jetzt eine gemeinsame Auswahl. Dadurch schneidet ein zu enger Suchtextrahmen den Bildausschnitt für den Schriftvergleich nicht mehr ab; die Ersetzung entfernt beide alten Suchtexte. Sichtbarer Text und getrennte Wortvorkommen bleiben erhalten.
- Beim Auswählen geeigneter waagerechter Scan-Texte vergleicht der Editor das ursprüngliche Wort lokal mit 56 Schriftschnitten aus 14 Familien. Bei ausreichend deutlichem Treffer übernimmt er Fett/Kursiv, eine passende Ersatzschrift, Textfarbe, Größe, Seitenabstand und Grundlinie für Vorschau und Export; bloßes Auswählen verändert die PDF weiterhin nicht. Mehrdeutige, gemischt formatierte oder ungeeignete Ausschnitte bleiben manuell korrigierbar. Scan-Schriften sind als Annäherung gekennzeichnet.
- Regressionstests prüfen „September“ → „August“ mit echter OCR in elf Schriftvarianten, den exportierten PDF-Text und seine Position sowie den Abbruch verspäteter Schrifterkennung beim Seiten- oder Auswahlwechsel.

- Getrennte automatische Sicherungen für Tabs und Dokumente, auswählbare Wiederherstellung und gezieltes Verwerfen einzelner Arbeitsstände.
- Automatisch aktualisierte Vorschau für ausdrücklich verknüpfte Textfelder; gemeinsame Übernahme nach Prüfung, ohne Schriftverkleinerung oder verschobene Rahmen.
- Ersatzschriftvergleich auch für markierte Wörter mit verfügbarer Originalschrift; stabile Rangfolge nach Passform, Konturen und Breite.
- Spaltenbreiten mit Ziehgriffen und Tastatur, Zeilen-/Spalteneinfügung und -löschung sowie rechteckiges Verbinden und Teilen geeigneter Vektortabellen. Originalreferenzen, gelöschte Zellinhalte und Rückgängig-Verlauf bleiben nachvollziehbar.
- Kontextaktionen für ausgewählten Text, Bilder und Tabellenzellen.
- Zusätzliche Exportprüfung kleiner unveränderter Textbereiche, unveränderter Textreihenfolge und vorhandener Tags. Auffälligkeiten erscheinen als Prüfhinweise; keine Zusicherung vollständiger PDF/UA-Konformität.

- Direkter Originalvergleich bei unverändertem Zoom; Bearbeitungsmarkierungen sind in der Originalansicht ausgeblendet und nicht bedienbar.
- Typografische Suche findet PDF-Ligaturen, kombinierte Akzente und variierende Leerzeichen mit sicheren Originalpositionen; Teilzeichen werden nicht ersetzt. Exakte Suche bleibt wählbar.
- Automatische lokale Sicherung bündelt schnelle Änderungen, zeigt nur den tatsächlich gesicherten neuesten Stand und stößt ausstehende Schreibvorgänge beim App-Wechsel an. Verwerfen wartet auf laufende Schreibvorgänge; Speicherfehler bleiben sichtbar.
- Seitenfehler brechen die Vorprüfung der übrigen Seiten nicht mehr ab. Fortschritt, ungeprüfter Zustand und Hinweise werden getrennt angezeigt. Tabellennavigation respektiert Tastenkombinationen, Texteingabe und die normale Fokusreihenfolge; Bedienelemente verschieben Textfelder nicht versehentlich.

- Browser-Vorbereitung in Editor- und Docker-CI verwendet offizielle HTTPS-Paketarchive und begrenzte Netzwerkwartezeiten; hängende Ubuntu-Spiegeldownloads verbrauchen nicht mehr die gesamte Testlaufzeit.
- Verspätete Schriftvorbereitung übernimmt den Fokus nicht mehr aus der OCR-Korrektur oder anderen Bedienelementen zurück in den PDF-Text. Regressionstests prüfen Desktop und schmale Touch-Ansichten einschließlich Tastaturbedienung.
- Die Editor-CI verlangt vollständige Ergebnisberichte für alle 31 Fälle je Browser; fehlende, doppelte oder fehlgeschlagene Fälle verhindern einen erfolgreichen Abschluss. Fehlgeschlagene Workflow-Fälle behalten zusätzlich eine Playwright-Ablaufaufzeichnung.
- Bildverarbeitung des Dokumentservers auf Pillow 13.0.0 aktualisiert, um die in 12.3.0 gemeldeten Sicherheitslücken zu schließen.
- Gemeinsame Auswahl von Text, Originalbildern und einfachen Tabellenzellen; logische Textzeilen, verzögerte Vorprüfung und begrenzte Vorbereitung einer Nachbarseite.
- Statische Type-1/CFF1-Originalschriften und TTF-/OTF-Import; Ersatz nur für fehlende Zeichen. Ungültige Schriftmetriken und veraltete Schriftantworten beim Rückgängigmachen werden abgefangen.
- Vorschau für Absatzfortsetzung mit nachfolgenden Absätzen und bis zu 20 neuen leeren Seiten; gemeinsame Rücknahme, erhaltene originale Folgeseiten.
- Echte Vektortabellen mit rechteckig verbundenen Zellen, wiederholten Zeilenhöhenänderungen und eingefügten mehrzeiligen Zeilen; validierte Originalreferenzen im Projektarchiv.
- Instanzbezogene Bearbeitung geeigneter verschachtelter Text- und Bildobjekte sowie erhaltener Grundlinie bei geneigtem Text. Einfache AcroForm-Strukturen bleiben unter den dokumentierten Bedingungen erhalten.
- Begrenzte Textkorrekturen in geeigneten Scanbildern bis 16 Megapixel erhalten die Originalauflösung und Außenpixel; Papierhintergrund und nachweisbare durchgehende Linien werden berücksichtigt.
- Lokale Strukturreparatur mit Vergleich aller Seiten; unveränderte Originaldatei und sichtbarer Reparaturhinweis. Erweiterte Browserfälle sind in der Editor-CI hinterlegt; die Freigabe setzt erfolgreiche Prüfungen voraus.

## 0.19.0 – 20. Oktober 2026

- Geeignete waagerechte Wortänderungen entfernen nur die betroffenen Originalzeichen. Unveränderte Präfixe und bei gleicher Position auch Suffixe bleiben als PDF-Text erhalten. Mehrdeutige Zeichen, Ligaturen, Schriftschnitt- oder Layoutänderungen verwenden weiterhin die geprüfte Textfeldbearbeitung.
- Textfelder lassen sich in frei gewählter Reihenfolge über bestehende Seiten verknüpfen. Eine Vorschau verteilt Text und Formatierung ohne automatische Verkleinerung; Überlauf und Kollisionen verhindern die Übernahme. Weitere Änderungen erfordern eine erneute Textfluss-Vorschau.
- Einfach ausgerichtete Tabellen erhalten einen Zellenmodus mit Tab/Umschalt+Tab. Formatübernahme, Millimetermaße und Hilfslinien für Kanten, Mittelpunkte und Grundlinien ergänzen die Bearbeitung.
- Dokumentweite Änderungsübersicht mit Vorher/Nachher, Sprung zur Seite und gezielter Rücknahme. Zusammenhängende Teilungen und Textflüsse werden gemeinsam zurückgenommen; spätere unabhängige Änderungen bleiben erhalten.
- Vorhandene Einzelbilder im Texteditor verschieben, proportional skalieren, ersetzen und zuschneiden. Zuschnitt entfernt Bildpixel und erhält die Ausrichtung. Scan-Hintergründe, Gruppen und Bilder mit zugehöriger vorhandener OCR-Ebene werden konservativ behandelt; Dekodierung und Zuschnitt sind auf 4 Megapixel begrenzt.
- Lokale OCR-Arbeitskopien mit kleiner Schräglagenkorrektur, Schattenausgleich, Kontrast und vorsichtiger Rauschminderung. Original- und aufbereitete Bereichserkennung sind vergleichbar; auffällige Buchstaben in Zahlen werden zur Prüfung markiert. Keine automatische Zahlenkorrektur und keine zusätzliche Dokumentübertragung.
- Eindeutige ganzseitige Scanbilder bis 4 Megapixel behalten beim Bearbeiten ihr ursprüngliches Pixelraster, sofern eine unabhängige Darstellung übereinstimmt. Komplexere Scanseiten verwenden weiterhin den geprüften Bildneuaufbau.
- Touch-Modus mit größeren Griffen, kompakter erweiterbarer Schriftleiste, Auswahl-Lupe und Anpassung an den sichtbaren Tastaturbereich. Reale Geräte und native virtuelle Tastaturen bleiben gesondert zu prüfen.
- Schriftbildvergleich mit an Schriftgröße angepasster Auflösung bis 3.600 Pixeln und markierbaren Abweichungsbereichen. Erweiterter öffentlicher Korpus enthält einen französischen Scan mit Akzenten; sämtliche Dateien sind fest versioniert, mit Prüfsummen und Lizenzhinweisen versehen und werden nicht mit der Anwendung ausgeliefert.

## 0.18.0 – 20. Oktober 2026

- Unbearbeitete Seiten werden unverändert übernommen, auch wenn sie zuvor für die lokale Suche erkannt wurden. Eng bemessene Textzeilen tolerieren Rundungsdifferenzen rekonstruierter Schriftbreiten; dadurch entstehen keine zusätzlichen Umbrüche durch Tausendstel Punkt.
- Absatzbildung folgt auch abwechselnd ausgelesenen Spalten. Textstellen lassen sich auf einer Seite mit Vorschau verbinden und am Textcursor trennen; ursprüngliche Entfernungsbereiche bleiben getrennt, Formatierungen erhalten.
- Unmittelbare Überlauf- und Kollisionswarnungen auf der Seite, auch für neue Textfelder. Eine ausdrückliche Layoutoption passt die Schriftgröße unter Erhalt relativer Größen an; die automatische Verkleinerung unterschreitet sechs Punkt nicht.
- Dokumentweite Suche mit optionaler lokaler OCR, Seitenvorschau, auswählbaren Treffern, wörtlichen Suchbegriffen und gemeinsamen Rückgängig-Schritten. Platz- und Kollisionsprüfung vor Sammelersetzungen; geänderte Dokumentstände verwerfen veraltete Suchergebnisse.
- Drei lokal gerenderte Ersatzschriftvorschläge zum Vergleich; markierte Textbereiche bleiben der Formatierungsbereich.
- Die wieder geöffnete Exportdatei wird auch innerhalb geänderter Textfelder mit unabhängig gezeichneten Schriftkonturen verglichen. Schrift-, Größen-, Farb- und Positionsabweichungen sowie nicht abgeschlossene Prüfungen erscheinen im Ergebnisbericht; begrenzte Auflösung bleibt eine technische Grenze.
- Öffentlicher Testkorpus mit festgelegten Prüfsummen: zwei Rechnungsbeispiele, historischer Buchscan, mehrspaltige Broschüre, gedrehter Scan und Formular-Schutzfall. Browserprüfungen für die neuen Bedienelemente und reale Scanvorlagen ergänzt. Kein Anspruch auf vollständige Acrobat-Gleichwertigkeit oder beliebige OCR-Genauigkeit.

## 0.17.0 – 20. Oktober 2026

- „PDF bearbeiten“ zeigt gemischte Schriftarten, Größen und Formatierungen ausdrücklich an. Schriftstatus und Formatierungsleiste beziehen sich auf die tatsächliche Auswahl; Fett/Kursiv kehren direkt zum Text zurück.
- Suchen und Ersetzen im ausgewählten Textfeld: einzelne oder alle Treffer, Groß-/Kleinschreibung, ganze Wörter, Markierung der Fundstelle und gemeinsames Rückgängig/Wiederholen. Jede Ersetzung erhält den Stil ihrer Fundstelle; reguläre Ausdrücke werden nicht ausgeführt.
- Tatsächlicher Seitenzoom von 50 bis 400 Prozent mit Rückkehr zur Seitenbreite, höher aufgelöster Vorschau und begrenztem Bildspeicher. Die frühere feste Seitenbreite begrenzte die Vergrößerung auf breiten Bildschirmen. Beim Nachrendern bleibt die bisherige Vorschau samt OCR-Ausschnitt gültig, bis die neue bereitsteht.
- Neue Regressionen für gemischte Auswahl, Suchtreffer, Stilübernahme, große Ersetzungslisten und Zoom. Dokumentweiter Word-Seitenfluss, beliebige Scanqualität und vollständige Acrobat-Gleichwertigkeit werden weiterhin nicht zugesichert.

## 0.16.0 – 20. Oktober 2026

- Direkte Textauswahl mit Cursor an der angeklickten Stelle, Markieren einzelner Wörter sowie Fett, Kursiv, Farbe, Schrift und Größe innerhalb eines Textfelds. Änderungen und Formatierung bleiben im Rückgängig-Verlauf und in Projektdateien erhalten.
- Konservativere Absatzbildung für Tabellen und gemischte Schriftstile. Textfeldvergrößerung, erneuter Zeilenumbruch und Schriftverkleinerung sind ausdrücklich wählbar und haben eine Vorschau.
- Automatische Ersatzschriftwahl berücksichtigt bei geeigneten einzeiligen Texten auch die Textbreite. Original und Bearbeitung lassen sich vergleichen. Eigene statische TrueType-Schriften können lokal geladen und mit dem Projekt gespeichert werden.
- OCR-Korrektur neben dem Originalausschnitt, Navigation zu unsicheren Wörtern und lokale Neuerkennung eines ausgewählten Bereichs mit überprüfbarem Vorschlag.
- Der Export wird erneut geöffnet und auf Textinhalt, Textposition und sichtbare Unterschiede außerhalb der Änderungen geprüft. Erkannte Textverluste stoppen den Export; eingeschränkte oder auffällige Bildprüfungen werden am Ergebnis angezeigt. Original und gespeicherte PDF stehen nebeneinander bereit.
- Deutsche und englische Hilfen ergänzt. Neue Regressionstests sowie erweiterte Browserabläufe für Auswahl, Wortformatierung, OCR-Korrektur und Exportprüfung. Technische Grenzen bleiben ausdrücklich dokumentiert; kein dokumentweiter Word-Seitenfluss und keine garantierte Originalschrift bei Scans.

## 0.15.5 – 20. Oktober 2026

- „PDF bearbeiten“ entfernt ersetzte Originaltexte gezielt aus der PDF. Hintergründe, Tabellenlinien, Bilder und Links bleiben auf zuverlässig bearbeitbaren Textseiten erhalten; die Vorschau nutzt dieselbe Entfernung wie der Export.
- Keine stillschweigende Bildumwandlung komplexer Textseiten mehr: Nicht sicher entfernbarer Text stoppt den Export. Ein ausdrücklich gewählter Bildneuaufbau bleibt mit Hinweis möglich; reine Scans werden weiterhin lokal vorbereitet.
- Einzelne Textstellen sind die Standardauswahl. Absatzzeilen, einheitliches Rückgängig/Wiederholen beim Tippen und OCR-Korrekturen ohne doppelte Textebenen verbessert. Schräger, gespiegelter und vertikaler Text wird verständlich abgefangen.
- Nimbus-Schriftfamilien und -schnitte genauer erkannt; Überlauf anhand tatsächlicher Unterlängen geprüft. Nicht zuverlässig erneut einbettbare Type-1/CFF-Schriften erhalten einen sichtbaren lokalen Schriftersatz. Wiederverwendbare TrueType-Originalschriften bleiben erhalten.
- Geschützte Signatur- und Formularstrukturen werden vor dem Export geprüft. Deutsche und englische Meldungen sowie Handbuchtexte ergänzt.
- Dauerhafte Export- und Erhaltungstests sowie Chromium-, Firefox- und WebKit-Abläufe für Desktop, 390-Pixel-Ansicht, OCR-Scan und englische Oberfläche ergänzt. Prüfstand und verbleibende Grenzen stehen im [Ausbaustand](docs/AUSBAUSTAND.md#nachprüfung-des-pdf-editors-20-oktober-2026).

## 0.15.4 – 18. Oktober 2026

- Werkzeugsuche für Screenreader berichtigt: Öffnungszustand, Ergebnisliste und Tastaturbedienung bleiben konsistent.
- Schieberegler, JSON-/CSV-Importfelder und Dokumentvorschauen korrekt benannt; Vorschauen sind mit der Tastatur erreichbar und Text-/Markierungsoptionen den richtigen Registerkarten zugeordnet.
- Kontraste für Hilfetexte, Handbuch-Kapitelnummern, Erfolgsmeldungen und inaktive Bearbeitungsregister im hellen Design verbessert.
- Linux-Startskripte behalten auch nach einem Windows-Checkout ihre erforderlichen Zeilenenden; mitgelieferte Drittherstellerhinweise bleiben bytegleich.
- Dauerhafte Browserprüfungen für Barrierefreiheit in Deutsch und Englisch ergänzt. Änderungen an der Oberfläche lösen auch die Firefox- und Safari-Prüfungen aus; der Office-Abbruchtest unterstützt Windows ohne die Linux-Prüfung verbliebener Betriebssystem-Threads abzuschwächen.

## 0.15.3 – 18. Oktober 2026

- Kompatible Bibliotheksupdates für Oberfläche, Word-Export, Schriftverarbeitung, HEIF-/PSD-Import und Build-Werkzeuge übernommen.
- BeautifulSoup und FontTools des Dokumentenservers sowie die GitHub-Actions für Python-Einrichtung und Prüfartefakte aktualisiert.
- Automatische Versionsvorschläge für Node und seine Typdefinitionen auf die bestehende Laufzeitstrategie begrenzt. Pydantic und Pydantic Core werden für künftige Updates gemeinsam vorgeschlagen.
- Deutsche und englische Hilfe sowie Docker-Dokumentation auf automatische lokale Sicherungen und die persistente Auftragsablage abgestimmt; veraltete Testangaben berichtigt.
- Aktuelle Webfunktionen mit der Docker-Ausgabe abgeglichen: automatische lokale Scan-OCR im PDF-Editor, direktes Bearbeiten von Absätzen, 14 Schriftfamilien, Originalschrifterkennung und sichtbar ausgewiesener Schriftersatz.
- Lokale Hintergrundprozesse einschließlich ihrer WASM-Dateien zuverlässig gebündelt und anhand der erzeugten Ausgaben geprüft.
- Schnellzugriff um PDF bearbeiten, Office zu PDF und Seitennummern ergänzt; Ergebnisse unter „Mehr“ sowie die aktuellen Schrift- und Ausrichtungskorrekturen übernommen.

## 0.15.2 – 18. Oktober 2026

- Versionslinks bleiben auch beim Darüberfahren und nach dem Antippen ohne Unterstreichung. Der sichtbare Tastaturfokus bleibt erhalten.

## 0.15.1 – 18. Oktober 2026

- Die Versionsanzeige in App, Handbuch und Medienbereich öffnet die Release-Notes der angezeigten Version auf GitHub in einem neuen Tab.
- Englische Hinweise für OCR-/Word-Ergebnisse, Projektgrenzen, Originalobjekt-Bearbeitung und Hintergrundaufträge ergänzt. Fehlermeldungen und Datums-/Größenangaben in der Ergebnisablage folgen der App-Sprache.
- Handbuch auf den gemeinsamen Arbeitsplatz, den erweiterten Rückgängig-Verlauf und das Fortsetzen von Hintergrundaufträgen abgestimmt; deutsche und englische Anleitungen gemeinsam aktualisiert.
- Gelöschte Ergebnisse bleiben auch dann aus der Ablage entfernt, wenn ein vorheriger lokaler Speichervorgang erst danach fertig wird. Neue Ergebnisse werden nicht durch ältere Speichervorgänge ausgeblendet.

## 0.15.0 – 18. Oktober 2026

- Tabellen über mehrere PDF-Seiten sammeln; wiederholte Kopfzeilen entfernen, Spaltentypen wählen und echte Zahlen, Prozent-, Währungs- und Datumszellen nach Excel exportieren. Kennungen und Formeln bleiben Text. Große Tabellen werden in der Korrekturansicht paginiert.
- PDF zu Word erkennt reine Scan-Seiten automatisch. Die Docker-Ausgabe kombiniert native Layoutrekonstruktion mit bearbeitbaren OCR-Absätzen; die Browser-Ausgabe bietet einen Text-Export mit OCR. Erkennungen müssen kontrolliert werden.
- Aktuelle Bearbeitungen beim Werkzeugwechsel übernehmen; unveränderte Dokumente bleiben bytegleich. Strukturverändernde Übergänge benötigen eine bewusste Übernahme. Der Rückgängig-Verlauf umfasst Originale, übernommene Ergebnisse und Formularentwürfe und bleibt in Projektdateien erhalten.
- Automatische lokale Wiederherstellung sowie eine lokale Ablage der letzten zehn Ergebnisse (höchstens 160 MB). Arbeitsplatz, Verlauf und Projektdateien behalten klare Speichergrenzen.
- Unterstützte Docker-Konvertierungen laufen in einer persistenten Warteschlange: zwei aktive, höchstens 16 offene Aufträge, bis zu 15 Minuten Verarbeitung und 24 Stunden Abrufzeit. Browser und Server dürfen neu starten; Abbrechen beendet Konverterprozesse. Signaturen und private Schlüssel sind ausgeschlossen.

## Unveröffentlicht

- Repository-Dokumentation auf Deutsch und Englisch mit direktem Sprachwechsel,
  neu gestalteter README und zweisprachigen Issue-Vorlagen.

- Projektdokumentation und Veröffentlichungsabläufe auf den eigenständigen Docker-Betrieb ausgerichtet.
- Plattformspezifische Installationspakete und Integrationstests in das zuständige externe Paket-Repository ausgelagert.

## 0.14.5 – 16. Oktober 2026

- Nach lokaler Office-Konvertierung oder Abbruch beendet der Browser den gesamten
  Worker-Verbund über den Hauptworker. Das vorherige einzelne Beenden der
  untergeordneten Threads konnte in Chromium native Threads hängen lassen.
- Die Dokumentbereinigung, die begrenzte Wartezeit bei Abbruch und die lokale
  PDF-Prüfung bleiben erhalten. Wiederholte Konvertierungen werden zusätzlich
  auf tatsächlich verbliebene Betriebssystem-Threads geprüft.
- Eine eigenständige Reproduktion trennt das Browserproblem von LibreOffice;
  Office-Tests prüfen weiterhin echte PDF-Inhalte, Bilder, Tabellen, Offline-Cache
  und wiederholtes Abbrechen mit anschließendem Neustart.

## 0.14.4 – 16. Oktober 2026

- Mobile Glasleiste mit Start, Werkzeugen, Suche, Projekten und Mehr. Die Lupe
  öffnet die lokale Werkzeugsuche mit direkten Treffern, Tastaturbedienung und
  einer an den sichtbaren Bildschirm angepassten Höhe.
- Suchdialog bleibt vollständig im Bildschirm: eigene Positionierung am unteren
  Rand ohne die Verschiebung eines zentrierten Dialogs. Projekte sind mobil unten,
  am Desktop weiterhin oben; „Alle Werkzeuge“ steht dort auch neben der Suche.
- Browser- und Server-Typprüfung getrennt; Lizenz-Quellkopien und Build-Ausgaben
  werden nicht als Anwendungscode geprüft. Der Web-Build prüft beide Laufzeiten,
  der Docker-Build zusätzlich die vollständige Anwendung und Build-Konfiguration.
- Ein schneller erneuter Klick auf „Projekte“ während der Schließanimation
  lässt die Projektliste geöffnet; automatische Sicherungen und Wiederherstellung
  bleiben erreichbar, auch nach dem Entfernen der letzten Seite.
- Produktionstests prüfen mobile Suchfeldposition, Touch-Ziele, Treffer, Leeren,
  Tastaturfokus, Projektzugriff und Dokumenterhalt sowie den Desktop-Wechsel.

## 0.14.3 – 16. Oktober 2026

- Docker-Update von 0.13.26 mit lokalem Dokumenteditor: formatierter Text, Bilder,
  Tabellen, Seitenvorschau, PDF-Export und übertragbare .moindoc-Entwürfe.
- Enthält die Bedienverbesserungen aus 0.14.2: erhaltene Werkzeugauswahl, umbenennbare
  Ergebnisdateien, Größenangaben, Duplikaterkennung, Alltagssuche und Dateifreigabe.
- Dokumenteditor und Entwurfsimport funktionieren auch über lokale HTTP-Adressen,
  wie sie bei Umbrel verwendet werden. Zufällige Kennungen benötigen kein HTTPS.
- Entwurfsspeicherung und Ergebnisfreigabe mit vollständigen React-Abhängigkeiten.
- PDF-Ergebnisse bleiben nach dem Export und beim Wechsel aus der Seitenvorschau
  erhalten; nur echte Dokumentänderungen verwerfen die bisherige Ausgabe.
- Entwurfsaktionen bleiben auf kleinen Bildschirmen für Screenreader benannt.
- Ein Wechsel zwischen leeren und gespeicherten Entwürfen greift nicht mehr auf
  einen bereits geschlossenen Editor zu; Inhalt und getrennte Undo-Verläufe bleiben erhalten.
- Beim Zurückgehen erhält die zuvor benutzte Werkzeugschaltfläche auch dann den
  Tastaturfokus zurück, wenn dasselbe Werkzeug zusätzlich als Suchvorschlag erscheint.
- Docker-Release mit allen vier bestehenden Diensten und neuen Produktionstests
  für Dokumenteditor, Entwürfe, Dateinamen, Duplikate und Werkzeugnavigation.

## 0.14.2 – 16. Oktober 2026

- Zurück zum Schnellzugriff oder zur Werkzeugübersicht behält Kategorie, Suche,
  Scrollposition und Tastaturfokus innerhalb der Sitzung bei.
- Dateinamen lassen sich direkt am Ergebnis bearbeiten; die echte Dateiendung bleibt
  erhalten. Vorschau und Seitenposition werden beim Umbenennen nicht neu geladen.
- Einheitliche Ergebnisangaben zu Format, Seitenzahl und Größe sowie Größenvergleich
  bei Komprimierung und Optimierung.
- Identische Uploads werden anhand ihres Inhalts erkannt, auch innerhalb einer
  Dateiauswahl. Überspringen oder trotzdem hinzufügen, optional für den restlichen Upload.
- Alltagssuche in Deutsch und Englisch um weitere Formulierungen ergänzt.
- Fertige Ergebnisse können auf unterstützten Geräten über den nativen Teilen-Dialog
  weitergegeben werden. Die Datei trägt dabei den bearbeiteten Namen.
- Neue DOM- und Funktionstests für Bedienung, Abbruchfälle und Projektübertragung.

## 0.14.1 – 16. Oktober 2026

- Mobil bleiben „Neues Dokument“ und „Projekte“ als kleine, runde Symbolbuttons
  nebeneinander in der vorhandenen Kopfzeile. Die zusätzliche zweite Zeile entfällt.
- Die Reihenfolge bleibt „Neues Dokument“ links von „Projekte“; beide Buttons
  behalten ihre zugänglichen Beschriftungen in Deutsch und Englisch.

## 0.14.0 – 16. Oktober 2026

- „Neues Dokument“ links neben „Projekte“ öffnet einen eigenen Dokumenteditor,
  ohne Eintrag in der Werkzeugauswahl und ohne vorherigen Upload.
- Textformatierung, drei Schriftfamilien, Überschriften, Listen, Bilder, Tabellen,
  Seitenumbrüche, Papierformate, Seitenränder sowie Kopf-/Fußzeilen und Seitenzahlen.
- Lokale automatische Entwurfsspeicherung, Entwurfsverwaltung und bearbeitbare
  .moindoc-Dateien zum Sichern, Öffnen und Übertragen auf andere Geräte.
- Lokaler PDF-Download mit auswählbarem Text und eigener Seitenvorschau für
  automatische Umbrüche. Mobile Schreibansicht, Hell-/Dunkelmodus und Deutsch/Englisch.
- Regressionstests prüfen Editorbefehle, sichere Zwischenablage, Entwürfe und
  tatsächliche PDF-Ausgaben einschließlich mehrseitiger Inhalte.

## 0.13.27 – 16. Oktober 2026

- Der zusätzliche Seemann-Bildbanner entfällt nach dem Öffnen von Dokumenten.
  Der Bereitschaftshinweis steht mit einem dezenten grünen Häkchen direkt in
  der Dateiübersicht: am Desktop neben den Dateiinformationen, mobil darunter.
- Einzahl, Mehrzahl und englische Übersetzung bleiben erhalten. Das Headerbild
  auf der Startseite bleibt unverändert.

## 0.13.26 – 16. Oktober 2026

- Safari-Kompatibilität der PDF-Textextraktion korrigiert. OCR, Textbearbeitung,
  Inhaltsvergleich, Word-, Markdown-, HTML-, EPUB- und JSON-Export sowie der
  Textimport für strukturierte PDFs lesen Textströme ohne asynchrone Stream-Iteration.
- Schriftinformationen, Textpositionen, Sprache und XFA-Formulartexte bleiben
  erhalten. Regressionstests prüfen mehrteilige Textströme, leere Scans und Fehler.

## 0.13.25 – 15. Oktober 2026

- Alle 4.513 vorhandenen Spracheinträge fachlich und sprachlich geprüft; rund
  2.000 Übersetzungen verbessert und aktuelle Meldungen ergänzt. Werkzeugtexte,
  Hilfe, Dokumentation und Informationsseiten verwenden denselben Katalog.
- Fehlende Übersetzungen in Dialogen, Bildschirmleser-Beschriftungen, OCR-Hinweisen,
  Arbeitsabläufen und Berichten ergänzt. Zahlenformate folgen der App-Sprache.
- App-eigene Überschriften und Hinweise in PDF-, CSV-, Excel-, Markdown-, HTML-
  und EPUB-Ausgaben lokalisiert, einschließlich Rechnungsleseansicht und
  Begleittexten der serverseitigen PDF-Übersetzung.
- Eigene Dateinamen, Formularwerte, Zitate, Rechnungs-XML und bearbeitete
  Dokumenttexte bleiben unverändert. Sprachtests prüfen diese Trennung anhand
  echter Ausgaben; ein Katalogtest erkennt neue fehlende UI-Meldungen.

## 0.13.24 – 15. Oktober 2026

- Die Beispiel-PDF folgt beim Öffnen der gewählten App-Sprache. Rechnung und
  Projektübersicht sind vollständig auf Deutsch oder Englisch verfügbar,
  einschließlich Datum, Beträgen und Dateiname.
- Sprachwechsel gelten für neu erzeugte Beispiele; bereits geöffnete Dokumente
  bleiben erhalten. Beide Sprachfassungen bleiben bildbasierte Scans zum
  Ausprobieren der Texterkennung und Seitenwerkzeuge.

## 0.13.23 – 14. Oktober 2026

- Die lokale Office-Laufzeit bereitet acht Hintergrundthreads vor und prüft
  deren Bereitschaft bei jedem nativen Thread-Start. Ein erschöpfter Pool
  führt zu einer ausdrücklichen Fehlermeldung statt zum Nachladen eines
  Workers während eines synchronen nativen Aufrufs.
- Der Browsertest prüft jetzt 15 Abbruch-/Neustartzyklen mit echten Excel- und
  Word-Dateien, vollständig aus dem lokalen Cache und ohne Dokumentenupload.

## 0.13.22 – 14. Oktober 2026

- Lange Dateinamen verbreitern die Dokumentübersicht auf schmalen Smartphones
  nicht mehr. Die Dateikarte bleibt innerhalb des Bildschirms; der vollständige
  Name bleibt über die Beschriftung erreichbar.
- Responsive Browserprüfungen warten auf die tatsächlich angepasste Bildbreite
  und prüfen die aktuellen Projektbeschriftungen samt Speicherstatus.

## 0.13.21 – 14. Oktober 2026

- Nach dem Entfernen der letzten Seite bleiben Rückgängig und Wiederholen auch
  im Dateieinstieg erreichbar, einschließlich wiederhergestellter Projektstände.
- GitHub und Docker übernehmen den aktuellen Webstand mit weiß-grünem
  Projekt-Button, ruhigen Werkzeugkacheln und kleinerem Desktop-Headerbild.
- Browserprüfungen berücksichtigen die sechs Schnellzugriffe, die aktuelle
  Navigation und die unveränderte mobile Bilddarstellung. Die Docker-spezifische
  Website-Konvertierung bleibt vollständig enthalten.

## 0.13.20 – 14. Oktober 2026

- Das Seemannbild auf der Startseite wird am Desktop auf maximal 640 Pixel Breite
  begrenzt und zentriert. Das vollständige 16:9-Motiv bleibt sichtbar;
  die Darstellung auf mobilen Geräten bleibt unverändert.

## 0.13.19 – 14. Oktober 2026

- Werkzeugkacheln bleiben beim Darüberfahren, Anklicken und Tastaturfokus ruhig.
  Anheben, Verkleinern beim Drücken und kurze Symbolanimationen wurden entfernt.

## 0.13.18 – 14. Oktober 2026

- Dezenter Lichtreflex folgt dem Mauszeiger innerhalb von Werkzeugkacheln.
- Der weiß-grüne Projekt-Button zeigt gespeicherte und ungespeicherte Änderungen
  an. Erfolgreiches Speichern bestätigt „Alles an Bord – gespeichert.“
- Beim Dateiziehen zeigen Ablageflächen die Dateianzahl, sofern der Browser sie
  freigibt, und erhalten einen sanften grünen Rahmen.
- PDF-Seiten zeigen beim Umsortieren eine animierte Vorschau und eine klare
  Einfügemarkierung. Pfeiltasten am Griff und die mobilen Pfeilbuttons bleiben bedienbar.
- Seitenaktionen bieten direkt eine Rückgängig-Meldung; alte Hinweise können
  keine nachfolgenden Änderungen zurücknehmen.
- Suchbegriffe werden in Werkzeugnamen und Beschreibungen dezent markiert,
  einschließlich deutscher Umlaute. Alle Ergänzungen unterstützen Deutsch und Englisch.
- Reduzierte Bewegung und hoher Kontrast werden berücksichtigt.
- Projektarchive und Dokumentprüfung werden bei Bedarf nachgeladen; auch der
  Selbsthosting-Build hält die bestehende Größenbegrenzung je JavaScript-Datei ein.

## 0.13.17 – 14. Oktober 2026

- Die aktive Kategorie in den Schnellansichten hebt sich durch eine kräftigere
  Füllung und doppelte Kontur in ihrer jeweiligen Kategoriefarbe deutlicher ab.
  Die Abstimmung berücksichtigt Hell- und Dunkelmodus sowie hohen Kontrast.
- Der Projekt-Button erhält eine dezente türkise Fläche, eine sichtbare Umrandung
  und ein größeres Ordnersymbol, auch auf Smartphones. Tastaturfokus und geöffneter
  Projektdialog werden klar angezeigt.

## 0.13.16 – 14. Oktober 2026

- Werkzeugkacheln heben sich am Desktop beim Darüberfahren dezent an. Symbole
  reagieren kurz auf Interaktion; Zusammenfügen und OCR erhalten passende Details.
- Die mobile Navigation bekommt beim Scrollen über darunterliegenden Inhalt
  eine dezente Schattenkante.
- Erfolgreich geöffnete beziehungsweise angenommene Dateien erhalten kurz ein
  Häkchen am Dateinamen. Verarbeitungsabschlüsse zeigen einen Übergang zum Häkchen
  und heben den verfügbaren Download einmal hervor.
- Reduzierte Bewegung, Tastaturfokus und hoher Kontrast werden berücksichtigt.
  Kategorien wechseln weiterhin sofort; Anordnung und bestehende Farben bleiben erhalten.

## 0.13.15 – 14. Oktober 2026

- Kategorie-Buttons halten ihre Beschriftungen vollständig zusammen. Auf schmalen
  Displays stehen weniger Buttons nebeneinander; bei größerer Schrift wechselt
  der gesamte Button in die nächste Zeile.
- Das Kachelmosaik bleibt auf die Schnellansichten der Startseite begrenzt.
  „Alle Werkzeuge“ verwendet wieder die vollständige Werkzeugübersicht aus 0.13.13.
- Nicht mehr benötigte Mosaik-Stile für den vollständigen Katalog entfernt.
  Grüner Uploadbereich, Auswahlfarben und Sicherung von 0.13.13 bleiben erhalten.

## 0.13.14 – 14. Oktober 2026

- Werkzeugauswahl und Startseite als responsives Kachelmosaik mit großen Hauptkacheln,
  Werkzeugpaaren, illustrierten Symbolen und dezenten Kategorie-Farben gestaltet.
- Kategorie-Buttons auf Smartphones in zwei Reihen und in der Desktop-Werkzeugauswahl
  als Seitenleiste angeordnet. Deutsche und englische Beschriftungen bleiben verfügbar.
- Leuchtend grüner Upload-Button sowie bestehende Farben und Lichteffekte für
  Auswahl, Hover und Fokus erhalten. Das Hafenbild bleibt vollständig sichtbar.
- Wiederherstellungspunkt für 0.13.13 vor der Gestaltung gesichert:
  Git-Tag `backup-0.13.13-before-mosaic-20261014`, gespeicherte Site-Version 119.

## 0.13.13 – 14. Oktober 2026

- Vollständige Seemannbilder im 16:9-Format, ohne Beschnitt; Größe und Gestaltung des Uploadbereichs bleiben erhalten.
- Sechs Schnellzugriffe mit Kurzbeschreibungen, Kategorien mit Symbolen und vollständige Werkzeuglisten je Kategorie.
- Dokumentübersicht mit Dateinamen, Seitenzahl und Größe; kompakterer Arbeitsbereich mit zunächst geschlossener Werkzeugseitenleiste.
- Mobile Aktionsleiste mit Zurück, Verarbeitung, Abbruch und Download. Navigation und Inhalt erhalten den erforderlichen Abstand.
- Bestehende Farben, Farbverläufe und Kategoriezuordnungen unverändert übernommen.
- Deutsche und englische Bedienungsdokumentation an die aktuelle Oberfläche angepasst.

## 0.13.12 – 14. Oktober 2026

- Zehn weitere Seemannmotive in den vorhandenen Header aufgenommen; insgesamt 22 Bilder mit unverändertem Bildausschnitt und Wechselverhalten.
- Qualitätsstufe „Sanft“ in der vorhandenen Komprimierungsauswahl ergänzt, einschließlich höherer Bildauflösung und JPEG-Qualität. „Ausgewogen“ bleibt die Voreinstellung.
- Deutsche und englische Komprimierungsanleitung sowie zusätzliche englische Übersetzungen ergänzt.
- Aufbau, Kategorien, Werkzeugkacheln, Farben und mobile Bedienung entsprechen weiterhin dem wiederhergestellten Morgenstand 0.13.11.

## 0.13.11 – 13. Oktober 2026

- Zwölf Seemannmotive im Header, einschließlich des bisherigen Bildes ohne doppelten Eintrag.
- Zufälliges Motiv beim Öffnen und ein anderes Zufallsmotiv per Klick, Touch oder Tastatur. Der Wechsel erfolgt ohne Animation; das nächste Bild wird vorab geladen.
- Optimierte WebP-Dateien, passende Bildausschnitte und deutsche sowie englische Bildbeschreibungen.

## 0.13.10 – 13. Oktober 2026

- Kategorie-Buttons mit dezenterer Auswahlfarbe, ruhigerer Schrift und weichem Schlagschatten in Hell und Dunkel, einheitlich auf Startseite und Werkzeugübersicht.
- Dicke Kategorie-Unterstreichung, zusätzliche Trennlinie unter den Kategorien und senkrechte Lichtkante im Upload-Button entfernt.

## 0.13.9 – 13. Oktober 2026

- Hafenlicht-Gestaltung mit kompakten, fein umrandeten Kacheln, grünen Auswahlmarkierungen und dezenten Lichtkanten in Hell und Dunkel.
- Kurzer Lichtimpuls beim Anklicken von Werkzeugen und Kategorien, auch per Touch und Tastatur. Werkzeugaufrufe bleiben unmittelbar; der Effekt blockiert keine Eingaben.
- Abgestimmte Smartphone-, Tablet- und Desktopansichten mit mindestens 44 Pixel hohen Kategorieflächen auf Touchgeräten.
- Reduzierte Bewegung und hoher Kontrast werden berücksichtigt; Scrollgesten räumen Lichteffekte auf.
- Browserprüfung für Maus-, Tastatur- und Touchbedienung, beide Farbmodi, alle Werkzeugaufrufe und Dokumenterhalt erweitert.

## 0.13.8 – 13. Oktober 2026

- Einheitlich umrandete Werkzeugkacheln und Symbole, auch in der Kategorie „Umwandeln“.
- Leere PDF-Arbeitsbereiche verwenden den kompakten Aufbau der Konverter: Werkzeugbeschreibung, drei Arbeitsschritte und Dateiauswahl in einer Karte. Die frühere große Begrüßung entfällt vollständig.
- Dateiauswahl, Drag-and-drop, Beispieldokument und Leerseite bleiben erreichbar; das gewählte Werkzeug bleibt erhalten.
- Fehlerhafte Zeichenfolge im OCR-Verweis der Word-Konvertierung korrigiert.
- Rechnungs-, Schutz- und Dokumentwerkzeuge ohne geladene Datei sicher auf die gemeinsame Dateiauswahl führen; alle 112 leeren Werkzeugansichten werden im Browser geprüft.

## 0.13.7 – 13. Oktober 2026

- Eckige Schnellzugriff-Kacheln mit den Originalsymbolen aus „Alle Werkzeuge“, ohne zusätzliche Dokumentillustrationen.
- Werkzeugaufrufe von der Startseite und aus der Übersicht funktionieren auch ohne bereits geöffnetes PDF.
- Die Werkzeugauswahl bleibt beim anschließenden Dateiöffnen und beim Ablegen einer PDF erhalten; mobile Aufrufe zeigen den Arbeitsbereich direkt von oben.
- Browserprüfung für sämtliche Schnellzugriffe ohne Dokument, identische Symbole und Dateiimport im gewählten Werkzeug ergänzt.

## 0.13.6 – 13. Oktober 2026

- Werkzeug-Kacheln mit feiner Umrandung, dezentem Lichtverlauf und kompakten, leicht plastischen Icons.
- Farbige Dokumentmotive für Zusammenfügen, Komprimieren und PDF zu Word sowie abgestimmte Symbole für Text, OCR und Webseiten.
- Ruhigere Schatten und kleinere Kacheln in beiden Farbmodi; Kategorien und vorhandene Klick-Effekte bleiben erhalten.

## 0.13.5 – 13. Oktober 2026

- Kategorie-Buttons wieder kompakter und mit sichtbarer Umrandung; auf Smartphones passen sie sich der Textbreite an.
- Farbige Auswahl und kurzer Lichtstreif bleiben erhalten.

## 0.13.4 – 13. Oktober 2026

- „Empfohlen“ bezeichnet die ausgewählten Werkzeuge auf der Startseite; „Alle Werkzeuge anzeigen“ führt zur vollständigen Übersicht.
- Kategorie-Buttons mit kurzem Lichtstreif beim Auswählen und sanfter Druckbewegung, abgestimmt auf den Leuchtturm. Die Einstellung für reduzierte Bewegung wird berücksichtigt.
- Auf Smartphones stehen die Kategorien in zwei gleichmäßigen Reihen mit ausreichend großen Touchflächen.

## 0.13.3 – 13. Oktober 2026

- Separaten Button „Alle Werkzeuge“ auf der Startseite entfernt; die Kategoriezeile folgt direkt auf die Suche.
- Ausgewählte Kategorien sind in Hell- und Dunkelansicht türkis hervorgehoben, standardmäßig „Alle“.

## 0.13.2 – 13. Oktober 2026

- Startseite beginnt direkt mit dem Seemannmotiv; die zusätzliche Überschrift entfällt.
- Schnellzugriff steht als eigene Abschnittsüberschrift mit Trennlinie über den Werkzeugkarten und ist deutlich vom Button „Alle Werkzeuge“ getrennt.

## 0.13.1 – 13. Oktober 2026

- Einheitliches Hafenstudio-Layout mit Seemannmotiv über dem Upload, Suche und Schnellzugriff; der Slogan erscheint nur am Logo.
- Abgestimmte helle und dunkelgraue Oberfläche für Startseite, Werkzeugauswahl, Arbeitsbereiche, Dokumentation, Medien und Rechtstexte.
- Optimierte Smartphone-, Tablet- und Desktopansichten mit erreichbarer Navigation, Touchflächen und sicheren Abständen am unteren Bildschirmrand.
- Navigation zwischen Startseite und Arbeitsbereich erhält geöffnete Dokumente. PDF-Verarbeitung, Konverter und Serverfunktionen bleiben unverändert.

## 0.13.0 – 13. Oktober 2026

- Website-Links direkt als PDF speichern: Bilder, Schriften, CSS und öffentlich ladbare JavaScript-Inhalte; A4/Letter, Hoch-/Querformat, Hintergrundfarben sowie Bildschirm- oder Druckansicht.
- Vorschau, Download und Weiterbearbeitung im bestehenden HTML-Werkzeug; gespeicherte HTML-Dateien bleiben unterstützt. Vollständige deutsche und englische Bedienung und Dokumentation.
- Separater Chromium-Web-Konverter in Docker für amd64 und arm64. Kontrollierte öffentliche Abrufe, Schutz vor privaten Netzwerkzielen und DNS-Rebinding, begrenzte Ressourcen und Beendigung abgebrochener Aufträge.
- Beim Update den vollständigen Docker-Stack aktualisieren: Der neue Dienst `website` und `/api/website/*` gehören zur Installation.

## 0.12.2 — 2026-10-12

- Kompakte Startseiten-Buttons mit Icons, hervorgehobenem „Alle Werkzeuge“ und zusätzlichem Abstand zum Footer in Light- und Darkmode.
- Lokale Office-Konvertierung räumt Dokument und Hintergrundprozesse vor dem Beenden auf, auch bei Abbruch während der Initialisierung; begrenzter harter Abbruch bleibt für blockierte Laufzeiten erhalten.
- Bereitschaft aller vorab gestarteten Office-Threads abwarten; Grafikimport, Skalierung und Formelberechnung vor der Laufzeitinitialisierung auf sequenzielle Ausführung stellen.
- Reine Office-Konvertierungen verwenden die normale LibreOfficeKit-Ereignisschleife ohne zusätzliche Editor-Poll-Callbacks.
- Docker-Veröffentlichungen prüfen den erfolgreichen Testlauf direkt über seine ID. Alle drei Images und die Release-Freigabe verwenden denselben belegten Quellstand und Testlauf.
- Regressionstests für Aufräumen, Abbrechen, erneute Konvertierung und die Freigabe unveränderlicher Images.

## 0.12.1 — 2026-10-12

- LibreTranslate auf 1.9.6, Uvicorn auf 0.54.0 und pycparser auf 3.1 aktualisiert.
- TypeScript 6.0.3 und ESLint 10.12.0 sowie die aktuellen Checkout- und Container-Anmeldeaktionen übernommen.
- Python 3.12 und die zu Node.js ab 22.13 passenden Typdefinitionen bleiben erhalten. Das separate pyHanko-Update wird wegen eines Konflikts mit dem festgelegten Zertifikatsprüfer nicht übernommen.

## 0.12.0 — 2026-10-12

- Absatzeditor mit HarfBuzz und 14 lokalen Noto-Schriften für indische und südostasiatische Schriftsysteme; passende Schriften werden bei Bedarf ergänzt.
- Konjunkte und Ligaturen bleiben bei Zeilenumbruch und Formatierung zusammen. Eine verknüpfte logische Textebene erhält Suche, Kopieren und erneutes Bearbeiten; erzeugte Absätze werden je Seite gemeinsam ausgewählt.
- Einzelne Texte, Bilder und Pfade innerhalb verschachtelter Gruppen bearbeiten, verschieben, drehen, skalieren, umordnen und löschen. Mehrfach verwendete Gruppen und Bildressourcen werden für die ausgewählte Instanz getrennt.
- Gruppen behalten Transformation, Beschnitt und Transparenz. Nicht unterstützte Grafiktypen und widersprüchliche geerbte Grafikzustände werden vor der Ausgabe abgewiesen.
- Neue unabhängige Tests für Schriftformen, Unicode-Ausgabe, Gruppeninstanzen, wiederholte Bearbeitung und reale Browserbedienung; aktualisierte deutsche und englische Anleitung.

## 0.11.0 — 2026-10-12

- Office-Dokumente lokal mit gepinntem LibreOffice/WASM konvertieren; Downloads und Cache enthalten ausschließlich Programmdaten. Eigener Dokumentenserver bleibt ausdrücklich wählbar.
- Lokale PKCS#12-Zertifikatssignaturen mit WebCrypto/PKI.js, ohne Upload von PDF, privatem Schlüssel oder Passwort; unabhängige OpenSSL-Verifikation.
- Absatzeditor mit Arabisch/Hebräisch, bidirektionalem Mischtext, acht zusätzlichen Schriften, Browser-Rechtschreibprüfung, Listen, Suchen/Ersetzen und Hoch-/Tiefstellen.
- Mehrfachauswahl mit Ausrichten, Verteilen, Spiegeln, Duplizieren und Vektorgruppen.
- Begrenzter XFA-Dateneditor mit Erhalt der Vorlagen und Rückleseprüfung; aktive und hybride Formulare werden abgewiesen.
- Ablaufvorlagen und zusätzliche Schritte zum Drehen, Umkehren, Festschreiben und verlustfreien Optimieren; lokale Komprimierung als Standard.
- Zusätzliche Engine-, Browser- und Datenschutzprüfungen sowie DE/EN-Dokumentation. Vollständiges XFA, unabhängiges PDF/X, lokale PDF/A-Prüfung und lokaler SVG-Vektorexport bleiben offen.

## 0.10.2 – 2026-10-12

- Sprach- und Leuchtturm-Schalter nochmals verkleinert: 32 Pixel am Desktop,
  30 Pixel auf schmalen Bildschirmen, mit weiterhin ausreichend großen Touch-Flächen.
- Der Leuchtturm wippt beim Umschalten kurz mit einem dezenten Lichtimpuls.
  Jeder Klick startet die Animation neu; reduzierte Bewegung wird berücksichtigt.

## 0.10.1 – 2026-10-12

- Sprach- und Leuchtturm-Schalter kleiner und dezenter gestaltet; auf Touch-Geräten
  bleibt die unsichtbare Berührungsfläche ausreichend groß.
- Englische Texte für sämtliche Werkzeugansichten, Auswahlmenüs, Dialoge,
  Hinweise, Fortschritts- und Fehlermeldungen ergänzt. Übersetzungen werden als
  lokale App-Datei geladen; Dokumentinhalte werden dafür nicht übertragen.
- Englische Dokumentation für alle 112 Werkzeuge, Medienbereich, Impressum und
  Datenschutz ergänzt. Medienpaket mit englischen Begleittexten, Wortmarke und
  Untertiteln für den unveränderten Originalclip.
- Sprachwahl bleibt nach Neuladen erhalten und synchronisiert Informationsseiten
  zwischen Tabs. Geöffnete Dokumente und Bearbeitungen bleiben beim Wechsel erhalten.
- Zusätzliche Browserprüfung kontrolliert englische Werkzeugansichten und Menüs,
  mobile Informationsseiten, Downloads und Sprachwechsel mit geöffnetem Dokument.

## 0.10.0 – 2026-10-12

- Startseite nach dem freigegebenen Konzept mit Mintverlauf, ruhiger Wortmarke,
  schwebendem Dokument und kompakten Bedienelementen gestaltet.
- Dunkelgrauer Darkmode mit gespeichertem Leuchtturm-Schalter: im hellen Modus
  leuchtet der Turm, im dunklen Modus ist er ausgeschaltet. PDF-Inhalte behalten
  ihre eigenen Farben. Auch Dokumentation, Medienbereich und Rechtstexte folgen
  der gewählten Darstellung.
- Sprachmenü mit Flaggen für Deutsch und Englisch. Startseite, Slogan,
  Werkzeugkatalog und zentrale Navigation sind übersetzt; detaillierte
  Spezialwerkzeugtexte und Dokumentationsinhalte bleiben vorerst deutsch.
- Alle 112 Werkzeugtitel, Beschreibungen und Aktionen im Katalog auf Englisch
  verfügbar; Suche unterstützt deutsche und englische Werkzeugbegriffe.
- Ruhigere Werkzeugkarten, dezente Kategorieakzente, feststehende Suchleiste,
  mobile Abstände und zurückhaltende Ergebnisanimationen. Reduzierte Bewegung
  wird berücksichtigt. Darstellungswechsel erhalten geöffnete Dokumente.

## 0.9.3 – 2026-10-11

- Beim Schließen einer Datei werden ihre Textnotizen, Bilder und Beschnittdaten
  aus dem aktuellen Arbeitsstand entfernt. Speichern und Projekt-Download
  bereinigen auch verwaiste Bearbeitungsdaten älterer Arbeitsstände; gültige
  Rückgängig-Schritte bleiben erhalten.
- Projekte ohne verbleibende Seiten lassen sich sichern und wieder öffnen.
  Der Wechsel zu anderen Projekten bleibt möglich, ohne den Rückgängig-Verlauf
  zu verlieren.
- Die Projektauswahl erhält einen eigenen Platz oberhalb des Arbeitsbereichs
  und überlagert keine mobilen Formularfelder mehr.
- Abhängigkeitsupdates aus der geprüften Zusammenführung veröffentlicht;
  OCR-Sprachzahl und PDF.js-Versionsangaben in der Dokumentation berichtigt.
- Barcode-Generatoren gezielt geladen, wirkungslose dynamische Imports entfernt
  und getrennte, überprüfte Größenbudgets für den Browser-Build eingeführt.
- Neue Regressionstests prüfen entfernte Projektinhalte, leere Seitenlisten,
  Projektwechsel und die mobile Projektauswahl.
- Die reguläre Typprüfung erfasst auch Hintergrundprozesse; Seitenwerkzeuge
  verwenden darin ausdrücklich die tatsächlich verfügbaren PDF-Daten.

## 0.9.2 – 2026-10-11

- Sicherheitsaktualisierung von Vite und transitiven Abhängigkeiten.
  Der Upload-Parser python-multipart wurde auf 0.0.32 aktualisiert; auch der
  vollständige Python-Lockfile wird vor dem Docker-Build auf bekannte Lücken geprüft. Die
  Abhängigkeitsprüfung meldet für den freigegebenen Lockfile keine bekannten
  Schwachstellen; die Docker-Prüfung kontrolliert dies vor jeder Freigabe erneut.
- Alle 37 ESLint-Warnungen behoben, einschließlich vollständiger Abhängigkeiten
  der Seitenvorschau und typisierter eingebetteter Bilddaten. Neue Warnungen
  lassen die Prüfung fehlschlagen.
- Spezialwerkzeuge werden erst beim Öffnen geladen. Der Haupt-JavaScript-Baustein
  wird dadurch deutlich kleiner; Werkzeugwechsel zeigen einen zugänglichen
  Ladezustand.
- Datenschutzhinweise für den lokalen Dokument-Assistenten, den bewusst
  geöffneten externen Modelldownload und den optionalen Modellspeicher ergänzt.
- Prüfübersicht auf 24 Engine-Suiten, 60 Servertests und 112 Werkzeuge aktualisiert;
  Ausbaugrenzen anhand aktueller Office-, XFA- und PDF/X-Prüfungen präzisiert.
- Versionen werden nach erfolgreichen Docker-Tests und veröffentlichten Images
  automatisch erstellt. Quellstand, Version, beide Architekturen und aktuelle
  Hauptversion müssen zusammenpassen; vorhandene Releases werden nicht ersetzt.

## 0.9.1 – 2026-10-11

- XFA-Erkennung erfolgt vor jedem Zugriff auf die gewöhnliche Formular-API.
  Dadurch werden XFA-Pakete nicht mehr unbemerkt entfernt.
- Formularbearbeitung, Seitenübernahme, freie Drehung, lange Seiten, Posterdruck
  und chronologische Pakete lehnen nicht unterstützte XFA-Inhalte vor der Ausgabe ab.
- Reine Lesezeichenänderungen erhalten vorhandene XFA-Pakete unverändert.
  Formularauswertungen weisen auf nicht unterstützte XFA-Felder hin.
- Regressionstests prüfen direkte und indirekte Formularwörterbücher,
  Stream- und Paketlisten sowie den Erhalt der Originaldaten. Der Browsertest
  kontrolliert die gesperrte Bearbeitung und liest den Download unabhängig zurück.

## 0.9.0 – 2026-10-11

- Unveränderliche Projektarchive mit allen fünf gespeicherten Ständen,
  deduplizierten Originaldateien und Integritätsprüfung beim Import.
- Gemischte Absatzformatierung, Ligaturen, kombinierende Zeichen und Textfluss
  auf bis zu 19 zusätzliche Seiten; Objektgriffe und Zeichenreihenfolge.
- Acht OCR-Sprachen gleichzeitig sowie optionale lokale Sprachprobe je Scan-Seite.
- Lokaler PDF-Assistent mit geprüfter Modelldatei, Quellenzitaten, JSON-Export,
  Abbruch und Speicherfreigabe.
- HEIC/HEIF- und PSD-Import im Browser; Pages-, Visio- und Publisher-Konvertierung
  mit Prüfung ungültiger Dateicontainer.
- Workflow-Knotendiagramm mit verschachtelten Entscheidungen; zusätzliche
  Seitenoperationen und nachvollziehbares Ablaufprotokoll.
- Mehrere Bates-/Kopf-/Fußzeilenregeln, Papierformate, druckfertige Posterblätter
  und abbrechbare Ergebnisvorschau.
- SVG-Vektorexport, Schriftkonturen, dauerhaft reduzierte Ebenen, bearbeitbarer
  PowerPoint-Text und Übersetzung an Originalpositionen mit Überlaufprüfung.
- Reparatur bestehender PDF-Tags ohne Änderung des Seiteninhalts und Ausgabe
  nur nach bestandener veraPDF-Prüfung.
- Strenge Offline-Signaturprüfung, konfigurierbare PAdES-T/LT/LTA-Signaturen und
  Erneuerung von Dokumentzeitstempeln. Zugangsdaten bleiben vom Konverter getrennt.
- Spaltenbewusster Dokumentvergleich, seitenübergreifende Sätze und besondere
  Hinweise auf geänderte Zahlen, Verneinungen und Pflichtwörter.
- 24 Engine-Testsuiten, erweiterte Server- und Browserprüfungen. Offene Grenzen
  des ursprünglichen Ausbauplans stehen in [docs/AUSBAUSTAND.md](docs/AUSBAUSTAND.md).

## 0.8.1 – 2026-10-11

- Ergebnisse im Barrierefreiheitswerkzeug werden nach Änderungen an Inhalt,
  Titel, Sprache, Prüfprofil oder Aktion verworfen. Ein Download wird erst nach
  erneuter Verarbeitung angeboten und gehört dadurch zum aktuellen Entwurf.
- Browserprüfung für bearbeitete PDF/UA-Inhalte, erneuten Export und den Wechsel
  von Prüfprofil und Aktion ergänzt. Neue PDF-Inhalte und Metadaten werden
  unabhängig zurückgelesen.

## 0.8.0 – 2026-10-11

- Absatzeditor mit Mehrfachauswahl vorhandener Textobjekte, automatischem Umbruch,
  eingebetteter Noto Sans oder eigener statischer TTF, Größe, Farbe, Ausrichtung,
  Abständen und tatsächlicher PDF-Vorschau. Überlauf und fehlende Glyphen werden
  vor der Ausgabe gemeldet; übrige Seitenobjekte bleiben erhalten.
- PDF/UA-1- und PDF/UA-2-Prüfung mit dem vorhandenen gepinnten veraPDF-Validator.
- Struktureditor für neue A4-Dokumente: Überschriften, Absätze, Lesereihenfolge,
  Bilder mit Alternativtext, Titel/Sprache und speicherbare JSON-Strukturdateien.
  LibreOffice erzeugt PDF/UA-1; nur eine bestandene Maschinenprüfung erlaubt die
  PDF-Ausgabe. Manuelle Prüfung und Abgleich mit dem Original bleiben nötig.
- 21 Engine-Testsuiten, sechs zusätzliche Serverprüfungen und Browserabläufe für
  Absatzvorschau, Überlauf und die geprüfte PDF/UA-Erstellung. Weiterhin 108 Werkzeuge.

## 0.7.0 – 2026-10-11

- Übertragbare `.moinpdf`-Projektdateien für den aktuellen oder einen gespeicherten
  Arbeitsstand, einschließlich Originaldateien, Rechnungs-XML, Seiten, Editor,
  Formularen, Lesezeichen und Rückgängig-Verlauf. Import als eigenes Projekt;
  vorhandene Sitzung wird vor dem Wechsel lokal gesichert.
- Größen-, Integritäts-, Daten- und Seitenverweisprüfung beim Import. Die
  Projektdatei ist unverschlüsselt und enthält auch Originale und frühere
  Bearbeitungen; zum Weitergeben fertiger Dokumente die Ergebnis-PDF verwenden.
- OCR und Scan-Suche kombinieren bis zu vier der 21 mitgelieferten Sprachen.
  Prüfung durch tatsächliche Erkennung eines viersprachigen Scans.
- Neuer Inhaltsmodus in „PDFs vergleichen“: Textblöcke über Seitengrenzen hinweg
  zuordnen, eingefügte Seiten berücksichtigen und Wortänderungen sowie
  Verschiebungen ausweisen. Unklare und wiederholte Zuordnungen bleiben sichtbar.
- Vergleichsberichte blenden unveränderten Text auf Wunsch ein und zeigen große
  Berichte schrittweise; der TXT-Download enthält weiterhin alle Einträge.
- 20 Engine-Testsuiten sowie zusätzliche Browserabläufe für Projekttransfer,
  vier OCR-Sprachen und den Inhaltsvergleich. Weiterhin 108 Werkzeuge.

## 0.6.0 – 2026-10-11

- Acht neue Browserwerkzeuge: Originalobjekte bearbeiten, Bates-Nummerierung,
  Seitenbezeichnungen, freie Drehwinkel, lange Seiten, Posterdruck, schnelle
  Webansicht und strukturierter JSON-Export. Insgesamt 108 Werkzeuge.
- PDFium verarbeitet Originaltexte, Bilder und Grafiken in einem abbrechbaren
  lokalen Worker. Textbearbeitung erhält verfügbare Originalschriften und
  meldet fehlende Zeichen. Einzelne Textobjekte, noch kein Absatzeditor.
- 21 lokal bereitgestellte OCR-Sprachen und wählbarer Seitenaufbau.
- WebP/BMP/TIFF/SVG-Import, mehrseitige TIFFs; WebP/TIFF/BMP-Export.
- PDF-Ebenen umbenennen und ihre Navigation/Sichtbarkeit speichern, ohne Text
  und Vektorgrafiken in Seitenbilder umzuwandeln.
- Wenn-/Sonst-Schritte in Arbeitsabläufen mit nachvollziehbarem ZIP-Protokoll.
- Lokale PDF-Projekte mit fünf gespeicherten Arbeitsständen, Wiederherstellung
  und Rückgängig-Verlauf. Projektdaten liegen unverschlüsselt im Browserspeicher.
- Unabhängige Prüfungen mit PDF.js und PDFium, tatsächliche QPDF-Linearisierung,
  Bildcodec- und IndexedDB-Prüfungen. 18 Engine-Testsuiten.
- Umfang und noch offene Teile des größeren Ausbaus in
  [docs/AUSBAUSTAND.md](docs/AUSBAUSTAND.md) festgehalten.

## 0.5.11 – 2026-10-10

- Eigenständige Entwicklungs- und Build-Konfiguration für die Docker-Ausgabe.
- Quellcode einheitlich formatiert; ESLint und Formatprüfung in der Integration.
- Container-Veröffentlichung an den erfolgreichen vollständigen Prüflauf gekoppelt.
- Mobile Prüfungen für Impressum und Datenschutz ergänzt.
- Dokumentation, Rückmeldewege, Lizenzstatus und Wartungshinweise aktualisiert.
- Veralteten Cookie-Hinweis und den nicht öffentlich erreichbaren Supportlink korrigiert.

## 0.5.10 – 2026-10-10

- Web- und Docker-Ausgabe auf denselben aktuellen Stand gebracht.
- Kontakt über ahoi@moinpdf.de, Datenschutzanfragen über post@moinpdf.de; persönliche Angaben auf die erforderlichen Anbieter- und Verantwortlichenangaben beschränkt.
- Kontakt- und Anbietertexte vereinheitlicht und die Kontaktkarte im Medienbereich bereinigt.
- Kompaktes Layout von Impressum und Datenschutz mit grüner Schrift und einer Leerzeile zwischen Anschrift und E-Mail.

## 0.5.9 – 2026-10-10

- Werbeclip „Drucker über Bord?“ mit Vorschau, Download und Medienpaket auch in der Docker-Ausgabe.
- Medienbereich mit einspaltigem Einstieg ohne abgesetzten „Moin.“-Block auf großen Bildschirmen.
- Offizielles Favicon und jüngste Dokumentationstexte im aktualisierten Docker-Release.
- HTML-Seiten und Favicons werden nach Updates erneut validiert; ausgelieferte Medien werden in den Installationstests geprüft.

## 0.4.0 – 2026-10-07

- Zehn neue Werkzeuge, insgesamt 93: Zahlenvergleich, Belegfelder sammeln,
  Rechnung/XML-Abgleich, Dokumentlücken, OCR-Korrekturhilfe, Pseudonymisierung,
  automatische Anlagenlinks, beste Scan-Seiten, Positionsabgleich und Kommentarlisten.
- Gemeinsame Originalvorschau mit markierten Fundstellen und vergrößertem Ausschnitt.
  Tabellenexporte kennzeichnen ungeprüfte, fehlende und mehrdeutige Angaben.
- Zahlen und Positionen werden anhand ihrer Beschriftungen zugeordnet. Verschobene
  Seiten sind möglich, doppelte oder unklare Beschriftungen bleiben Prüffälle.
- Rechnung/XML-Abgleich liest sichtbare Seiten per lokaler OCR; eine abweichende
  versteckte Textebene wird dafür nicht als sichtbarer Rechnungsinhalt verwendet.
- OCR-Korrekturen erzeugen Suchtext hinter neuen Seitenbildern. Pseudonymisierte
  Ausgaben enthalten nur bearbeitete Seitenbilder und neutrale Dateinamen; alte
  Textebenen, Formulare, Metadaten und Anhänge werden nicht übernommen.
- Anlagenziele und Scan-Seiten lassen sich vor dem Export kontrollieren und ändern.
  Positionsvorschläge können ergänzt, korrigiert und erst danach verglichen werden.
- Alle zehn Werkzeuge arbeiten im Browser mit lokal bereitgestellten Ressourcen.
  Keine zusätzlichen Serverdienste, externen KI-Aufrufe oder API-Konten erforderlich.
- Neue Tests prüfen tatsächliche OCR, sichtbare Pseudonymisierung, unabhängiges
  Lesen der erzeugten PDFs, interne Linkziele und sichere Tabellen-/Kommentarimporte.
  Die Erkennung bleibt eine kontrollierbare Hilfe und ist keine Vollständigkeits-
  oder Echtheitsbestätigung.

## 0.3.0 – 2026-10-07

- Sieben neue Werkzeuge, insgesamt 83: PDF-Reparatur, Komprimierung auf Wunschgröße,
  Sammelscans trennen, PDF zu Markdown/HTML/EPUB sowie EPUB zu PDF.
- Reparatur akzeptiert Originaldateien ohne vorherige Vorschau. Rekonstruktion der
  Dateistruktur, unabhängiger Parser als Rückfall und Prüfung jeder Ausgabeseite.
  Nicht rekonstruierbare Dateien erhalten einen Fehler; Originale bleiben erhalten.
- Komprimierung misst die echte Dateigröße, behält immer die kleinste Variante und
  meldet unerreichbare Ziele ausdrücklich. Text, Links und Formulare bleiben erhalten.
  Docker kann Bildauflösung reduzieren; die Browser-Ausgabe nutzt QPDF.
- Sammelscans: automatische Vorschläge anhand heller Zwischenräume, manuelle Rahmen,
  Vorschau und Prüfung aller Ausschnitte vor dem ZIP mit einzelnen Bild-PDFs/PNG/JPG.
- Markdown/HTML/EPUB als Textausgaben mit Seitenstruktur, gekennzeichneten Scanseiten
  und EPUB-Inhaltsverzeichnis. Bilder und das Original-Layout werden nicht übernommen.
- EPUB-Import im Dokumentenserver mit A4/A5, Schriftgröße, Größen-/Seitenlimits und
  gesperrten aktiven/externalen Inhalten. Direkter EPUB-Upload öffnet den Konverter.
- Regressionstests für Reparatur, Formulare, Zielgrößen, tatsächliche Ausschnitte,
  sichere Exporte, EPUB-Rundlauf und die geschützten Server-Endpunkte.

## 0.2.8 – 2026-10-07

- Kategorieauswahl unter der Werkzeugsuche wiederhergestellt: Alle, Prüfen,
  Umwandeln, Seiten, Bearbeiten und Stapel. „Alle“ zeigt standardmäßig alle Werkzeuge.
- Kategorien filtern die Übersicht und Suchvorschläge; die Anzahl passt sich an.
  Die Schaltflächen umbrechen auf kleinen Bildschirmen und sind per Tastatur bedienbar.

## 0.2.7 – 2026-10-07

- Seemann-Logo auf 16 Pixel verkleinert. Logo und Versionsnummer bilden eine
  gemeinsam zentrierte Zeile und sind auch vertikal mittig zueinander ausgerichtet.

## 0.2.6 – 2026-10-07

- Seemann-Logo im Footer weiter auf 24 Pixel verkleinert und den Footer kompakter
  gehalten. Logo und Versionsnummer bleiben gemeinsam mittig ausgerichtet.

## 0.2.5 – 2026-10-07

- Seemann-Logo im Footer von 48 auf 32 Pixel verkleinert und gemeinsam mit
  der Versionsnummer mittig unter den rechtlichen Links ausgerichtet.

## 0.2.4 – 2026-10-07

- Kleines Seemann-Emblem aus den Bannern neben der Version im Footer ergänzt.
  Der Seemann schaut aus einem Kreis; Logo und Versionsnummer stehen gemeinsam
  links unten, auf schmalen Bildschirmen unter den rechtlichen Links.

## 0.2.3 – 2026-10-07

- Dezenten Hintergrundverlauf in hellem Petrol und sanftem Grün ergänzt.
  Der Verlauf zieht sich durch Startseite, Werkzeugübersicht und Arbeitsbereiche
  bis zum Footer und passt sich der Bildschirmgröße an.

## 0.2.2 – 2026-10-07

- Den MoinPDF-Schriftzug im Startseiten-Header durch die Buchstabenformen des
  freigegebenen Logos ersetzt: „Moin“ in Dunkelpetrol, „PDF“ in Grün. Als skalierbare
  Vektorgrafik; Claim, Unterstreichung und übrige Oberfläche bleiben unverändert.

## 0.2.1 – 2026-10-06

- Zusätzlichen Browserwerkzeuge-Hinweis samt Schildsymbol unter der Werkzeugliste entfernt.
- Alle Werkzeuge direkt unter dem Suchfeld sichtbar; keine vorgeschaltete Schnellwahl
  oder Kategoriekacheln mehr. Suche und bestehende Werkzeuge bleiben verfügbar.
- Lange Werkzeugnamen umbrechen innerhalb der Kacheln, auch auf schmalen Smartphones.

## 0.2.0 – 2026-10-06

- Footer auf kleinen Bildschirmen zentriert, umbrechende Links und eigene Versionszeile.
- Animiertes Uploadfeld an schmale Smartphone-Ansichten angepasst.
- Word, Excel, PowerPoint, Bilder und Text direkt nach dem PDF-Import auswählbar.
- Alle Werkzeuge nach Aufgabe einsortiert; keine separate Serverkategorie mehr.
- Konvertierungen ohne Serveradresse, API-Schlüssel oder zusätzliche Freigabe-Checkbox.
  Die Verarbeitung startet ausschließlich mit dem jeweiligen Aktionsknopf.
- Office-, E-Mail- und HTML-Dateien direkt über das zentrale Uploadfeld öffnen.
- Einfache Ergebnisansicht mit passend beschriftetem Download.
- E-Mails standardmäßig direkt als PDF; Anlagen optional als ZIP.
- Verbindungsprüfungen und Verarbeitungsanfragen mit Zeitbegrenzung.
- Browser-Ausgabe: PDF-Text direkt als echte DOCX exportieren; Layout und Bilder
  werden dabei nicht übernommen. Die Docker-Ausgabe nutzt weiterhin die
  vorhandene Konvertierung mit Layout-Rekonstruktion. Weitere native Konverter
  benötigen die vollständige Docker-Installation.

## 0.1.0 – 2026-10-05

- Erste vollständige Docker-Ausgabe mit PDF-Werkzeugen,
  integriertem Dokumentendienst und lokaler Übersetzung.
