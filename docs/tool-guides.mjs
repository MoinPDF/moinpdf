// The names, descriptions and categories come from the actual tool catalogue.
// Keep these instructions specific to the controls and outputs of each tool.
const guide = (input, steps, output, note) => ({input, steps, output, note});
export const guides = {
  'svg-export': {
    input:'Eine PDF und der integrierte Dokumentenserver.',
    steps:['PDF öffnen und „PDF zu Vektor-SVG“ wählen.','Gewünschtes Dokument auswählen.','SVG-Dateien exportieren und die ZIP-Datei entpacken.'],
    output:'Eine eigenständige SVG je PDF-Seite. Text erscheint als Vektorkontur, vorhandene Fotos bleiben eingebettete Bilder.',
    note:'Höchstens 20 MB pro SVG und 80 MB insgesamt. Schriftkonturen sind nicht als Text bearbeitbar. Komplexe Transparenzen im Zielprogramm prüfen.',
  },
  'font-outlines': {
    input:'Eine PDF und der integrierte Dokumentenserver.',
    steps:['„Schriften in Pfade“ öffnen.','Die passende PDF auswählen.','Schriftkonturen erstellen und das Ergebnis vor der Weitergabe prüfen.'],
    output:'Eine neue PDF mit Text als festen Vektorkonturen.',
    note:'Der Text ist danach nicht auswählbar oder durchsuchbar. Formulare, Tags, Links, Anhänge und digitale Signaturen werden nicht garantiert übernommen.',
  },
  'flatten-layers': {
    input:'Eine PDF mit der gewünschten anfänglichen Ebenensichtbarkeit und der Dokumentenserver.',
    steps:['Unter „PDF-Ebenen“ gewünschte Ebenen ein- oder ausblenden und das Ergebnis übernehmen.','„Ebenen dauerhaft reduzieren“ öffnen.','Die feste Ansicht erzeugen, herunterladen und auf vollständigen Inhalt prüfen.'],
    output:'Eine neue PDF aus den anfänglich sichtbaren Ebenen. Ausgeblendete Ebeneninhalte sind entfernt.',
    note:'Die Ebenen sind danach nicht mehr einzeln schaltbar. Text und Vektoren bleiben soweit vom Konverter unterstützt erhalten; Formulare, Tags, Links, Anhänge und Signaturen werden nicht garantiert übernommen.',
  },
  'local-assistant': {
    input:'Eine oder mehrere PDFs sowie die verlinkte Qwen2.5-0.5B-GGUF-Modelldatei mit etwa 409 MB.',
    steps:['Modelldatei über den angegebenen Link herunterladen und lokal auswählen.','Optional die geprüfte Modelldatei für spätere Sitzungen speichern.','Eine konkrete Frage stellen und „Frage lokal beantworten“ wählen.','Jedes Zitat über die Fundstellenanzeige im Original kontrollieren.'],
    output:'Lokal erzeugte Antwort mit überprüften Originalzitaten und einer JSON-Datei zum Herunterladen.',
    note:'Fragen und Dokumente verlassen das Gerät nicht. Das Modell verwendet ausgewählte Passagen und kann Inhalte falsch auslegen. Zitate werden gegen ausgelesenen Text geprüft, bei OCR zusätzlich das Seitenbild kontrollieren. Fehlende oder erfundene Zitate sperren die Antwort. Zusätzlicher Arbeitsspeicher ist nötig; auf kleinen Geräten kann die Inferenz langsam sein.',
  },

  'native-objects': guide('Eine PDF mit vorhandenen Text-, Bild- oder Grafikobjekten.', [
    'Für Einzelobjekte: Seitenobjekte laden, Objekt wählen und Text in Originalschrift ändern oder Bild/Grafik verschieben, drehen, skalieren und ersetzen.',
    'Für Absätze: oben „Absatz mit automatischem Umbruch“ wählen, Textobjekte laden, gewünschte Objekte ankreuzen und „Auswahl als Absatz laden“ verwenden. Textreihenfolge kontrollieren.',
    'Text, Noto Sans oder eigene statische TrueType-Schrift, Größe, Abstand, Ausrichtung und Farbe einstellen. Für unterschiedliche Formatierungen Text markieren und „Markierten Text anders formatieren“ wählen. Den Textbereich aufziehen oder seine Prozentwerte ändern.',
    'Absatzvorschau berechnen und danach exportieren. Bei Überlauf den Bereich vergrößern oder Folgeseiten einschalten. Bis zu 19 neue Seiten werden direkt nach der bearbeiteten Seite eingefügt. Für weitere Bearbeitung das Ergebnis übernehmen.',
  ], 'PDF mit bearbeiteten Textobjekten, gemischten Absatzformatierungen und bei Bedarf neuen Folgeseiten; übrige Seiten bleiben erhalten.', 'Absätze ersetzen ausgewählte ganze Textobjekte. Bis zu 32 getrennte Formatbereiche mit eigener Größe, Farbe oder statischer TrueType-Schrift. Ligaturen und kombinierende Zeichen werden geformt; fehlende Zeichen, geteilte Konjunkte und Überlauf werden abgewiesen. Verschachtelte Gruppen im Einzelobjektmodus mit „Gruppeninhalt bearbeiten“ öffnen. Die Änderung gilt nur für diese Instanz; Beschnitt und Transparenz bleiben erhalten. Erzeugte Absätze werden beim erneuten Bearbeiten je Seite gemeinsam ausgewählt. Überschneidungen mit ungewählten Objekten in der Vorschau prüfen. Löschen ist keine Sicherheitsbereinigung; Signaturen und vorhandene Barrierefreiheits-Tags erneut prüfen.'),
  'bates': guide('Eine oder mehrere PDFs in der gewünschten Dateireihenfolge.', [
    'Öffne alle Dateien, die fortlaufend gekennzeichnet werden sollen.',
    'Wähle Vorlage, Startnummer, Ziffernstellen, Schriftgröße und Position. Platzhalter: {nummer}, {seite}, {seiten} und {datei}. Prüfe die Textvorschau.',
    'Wende die Nummerierung an und prüfe ihre Position in der Ausgabe, besonders bei unterschiedlich großen Seiten.'
  ], 'Nummerierte PDF oder ZIP mit mehreren PDFs und einer durchgehenden Nummernfolge.', 'Die Nummerierung folgt der Dateireihenfolge. Lateinische Zeichen in Helvetica; Beschriftungen müssen auf die Seite passen. Bestehende Signaturen werden ungültig.'),
  'page-labels': guide('Eine PDF, deren Navigation eigene Seitenbezeichnungen erhalten soll.', [
    'Lege den ersten Abschnitt ab Seite 1 fest.',
    'Füge weitere Abschnitte mit römischer, alphabetischer oder dezimaler Zählweise hinzu. Optional Präfix und Startwert eintragen.',
    'Speichere die Datei und prüfe die Seitennavigation in einem PDF-Programm mit Unterstützung für Seitenbezeichnungen.'
  ], 'PDF mit internen Seitenbezeichnungen.', 'Gedruckte Seitenzahlen ändern sich nicht. Dafür die Nummerierungswerkzeuge verwenden.'),
  'rotate-free': guide('Eine PDF mit Seiten, die um einen beliebigen Winkel gedreht werden sollen.', [
    'Öffne die Datei und wähle den Drehwinkel im Uhrzeigersinn.',
    'Erstelle die gedrehten Seiten. Die Seitengröße passt sich an den gesamten Inhalt an.',
    'Prüfe die Vorschau und lade die neue Datei herunter.'
  ], 'Neu aufgebaute PDF mit erhaltenen Text- und Vektorinhalten.', 'Formulare werden festgeschrieben. Links, Lesezeichen, Anhänge und ursprüngliche Signaturen werden beim Seitenneuaufbau nicht übernommen.'),
  'continuous-page': guide('Eine oder mehrere PDFs, deren Seiten untereinander stehen sollen.', [
    'Öffne die PDFs in der gewünschten Reihenfolge.',
    'Lege die gemeinsame Breite und den Abstand zwischen den Seiten fest.',
    'Erstelle die lange Seite und kontrolliere die Reihenfolge.'
  ], 'PDF mit einer durchgehenden Seite, Text und Vektorgrafiken.', 'Maximale Seitenlänge 5,08 Meter. Formulare werden festgeschrieben; Links, Lesezeichen, Anhänge und Signaturen werden nicht übernommen.'),
  'poster-print': guide('Eine PDF mit großen Vorlagen zum Aufteilen auf Druckbögen.', [
    'Wähle die Anzahl der Spalten und Zeilen.',
    'Stelle die gewünschte Überlappung in Millimetern ein und exportiere die Kacheln.',
    'Drucke die Kacheln in passender Größe und setze sie je Originalseite zeilenweise von links oben zusammen.'
  ], 'PDF mit mehreren Druckkacheln pro Originalseite.', 'Die Kacheln behalten Text und Vektoren. Links, Lesezeichen, Anhänge und Signaturen werden nicht übernommen. Für maßgenaue Ausgabe die Skalierung im Druckdialog prüfen.'),
  'linearize': guide('Eine oder mehrere PDFs für die Veröffentlichung auf einem Webserver.', [
    'Öffne die Dateien.',
    'Starte die Optimierung für die schnelle Webansicht.',
    'Lade die vorbereiteten Dateien herunter und verwende sie auf einem Server mit Unterstützung für Teilabrufe.'
  ], 'Linearisierte PDF oder ZIP mit mehreren optimierten Dateien.', 'Der Webserver und PDF-Leser müssen schrittweises Laden unterstützen. Erneute Bearbeitungen können die Optimierung aufheben und bestehende Signaturen werden ungültig.'),
  'structured-export': guide('Eine oder mehrere PDFs mit auslesbarem Text.', [
    'Öffne die Dokumente. Reine Scans zuerst mit OCR durchsuchbar machen.',
    'Starte den JSON-Export.',
    'Verwende Textobjekte, Seitenzahlen und Positionsangaben in der gewünschten Weiterverarbeitung.'
  ], 'JSON mit Dokumenten, Seiten, Textobjekten, Schriftreferenzen und Positionen.', 'Koordinaten folgen den PDF-Textmatrizen. Der Export erzeugt keine semantische Absatz- oder Tabellenstruktur und führt keine automatische OCR durch.'),
  'form-responses': guide('Mehrere ausgefüllte PDF-Formulare mit interaktiven Feldern.', [
    'Öffne die Rückläufe und lies die Formularwerte aus. Wähle anschließend eine Datei aus, um ihre Felder und Fundstellen zu prüfen.',
    'Kontrolliere besonders leere Pflichtfelder, Checkboxen und Auswahlwerte. Korrigiere den Exportwert bei Bedarf; der ursprüngliche Wert bleibt in der Detailausgabe nachvollziehbar.',
    'Wähle eine Zeile pro Datei für einen Überblick oder eine Zeile pro Feld mit Originalwert für die Einzelprüfung. Erstelle Excel oder CSV.'
  ], 'XLSX oder CSV mit den gesammelten Antworten.', 'Die Korrekturen ändern die exportierte Tabelle, nicht die eingereichten PDFs. Reine Scans und dynamische XFA-Formulare können nicht vollständig als Formularfelder ausgelesen werden.'),
  'chronology': guide('Mehrere PDFs, etwa Briefe, Bescheide oder Projektunterlagen.', [
    'Starte die Suche nach Daten im Inhalt. Bei Scans wird OCR verwendet; bei widersprüchlichem Suchtext kannst du alle sichtbaren Seiten per OCR lesen lassen.',
    'Wähle je Dokument das passende Datum und einen Titel für das Inhaltsverzeichnis. Bestätige auch bewusst fehlende Daten. Ein Zahlungsziel ist nicht automatisch das Dokumentdatum.',
    'Sortiere älteste oder neueste Dokumente zuerst, korrigiere die Reihenfolge mit den Pfeilen und erstelle die chronologische PDF.'
  ], 'Dokumentenmappe mit klickbarem Inhaltsverzeichnis und Lesezeichen; zusätzlich ein Tabellenprotokoll.', 'Exportiert wird die angezeigte Reihenfolge. Formularwerte werden festgeschrieben; ursprüngliche Signaturen, Lesezeichen und Anhänge werden nicht übernommen.'),
  'arithmetic-check': guide('Eine PDF mit einer zu prüfenden Zahlenspalte und einer angegebenen Summe.', [
    'Wähle eine Seite, markiere den Zahlenbereich in der Vorschau und übernimm die erkannten Zahlen. Nutze bei Scans die OCR.',
    'Stelle das deutsche oder englische Zahlenformat ein. Prüfe Dezimalzeichen und Vorzeichen, korrigiere Werte und wähle nur echte Summanden aus. Übernimm die gedruckte Gesamtsumme als Vergleichswert.',
    'Bestätige die Prüfung am Original. Lies Summe und Abweichung ab und exportiere die markierte PDF oder das CSV-Protokoll.'
  ], 'PDF mit Markierungen und Rechenprotokoll oder CSV.', 'Die Gesamtsumme darf nicht zusätzlich als Summand ausgewählt sein. Geprüft wird die Addition der gewählten Werte, nicht die Vollständigkeit einer Rechnung oder ihre steuerliche Behandlung. Bis zu sechs Nachkommastellen werden exakt verarbeitet.'),
  'pdf-sanitize': guide('Eine PDF, deren aktive Inhalte und optionale Zusatzdaten entfernt werden sollen.', [
    'Lasse zunächst die entfernbaren Inhalte auflisten. Prüfe die gefundenen Strukturen und entscheide, welche Zusatzdaten du behalten möchtest.',
    'Lege fest, ob eingebettete Dateien, Kommentare und Dokumentmetadaten ebenfalls entfernt werden sollen. Skripte, riskante Aktionen, dynamische XFA-Inhalte und eingebettete Medien werden grundsätzlich bereinigt.',
    'Starte „PDF bereinigen und nachprüfen“ und kontrolliere die neue PDF, insbesondere vorhandene Formulare.'
  ], 'Neu geschriebene und auf die gewählten Kategorien nachgeprüfte PDF.', 'Kein Virenscan und keine allgemeine Sicherheitsfreigabe. Normale Web- und Seitenlinks bleiben erhalten. Dynamische Formulare können anders aussehen; digitale Signaturen verlieren durch die Änderung ihre Gültigkeit.'),
  'pdf-layers': guide('Eine PDF mit schaltbaren Ebenen.', [
    'Lade die vorhandenen Ebenen und wähle eine Vorschauseite.',
    'Ändere Namen, Reihenfolge in der Ebenenliste und Sichtbarkeit. Prüfe die Vorschau.',
    'Speichere schaltbare Ebenen mit erhaltenem Text und Vektoren oder exportiere die sichtbare Ansicht als Seitenbilder.'
  ], 'PDF mit schaltbaren Ebenen oder festgeschriebene Ansicht.', 'Ausgeblendete Inhalte bleiben bei schaltbaren Ebenen in der Datei. Die Ebenenreihenfolge verändert die Navigation, nicht die Zeichenreihenfolge. Die Ausgabe als Seitenbilder entfernt Suchtext und interaktive Funktionen.'),
  'pdf-measure': guide('Ein Plan oder Scan mit einer bekannten Referenzlänge.', [
    'Wähle eine Seite und setze zwei Punkte an einer bekannten Strecke. Trage die tatsächliche Länge und die Einheit Millimeter, Zentimeter oder Meter ein und übernimm die Referenz.',
    'Wechsle zu Strecke oder Fläche. Für eine Strecke setzt du zwei Punkte, für eine Fläche mindestens drei Eckpunkte. Übernimm die Strecke beziehungsweise schließe die Fläche ab.',
    'Benenne die Messungen, prüfe die Werte und exportiere eine PDF mit Messungen oder eine CSV-Tabelle. Für jede weitere Seite legst du eine eigene Referenz fest.'
  ], 'Beschriftete PDF mit Kalibrierungsprotokoll oder CSV mit Messwerten.', 'Die Genauigkeit hängt von Referenz und Punktplatzierung ab. Verzerrte Scans können abweichende Maße ergeben. Sich selbst kreuzende Flächen werden abgelehnt; eine neue Kalibrierung berechnet vorhandene Messungen dieser Seite neu.'),
  'pdf-audio': guide('Eine PDF mit auslesbarem Text oder gut lesbaren Scans.', [
    'Wähle das Dokument und die Aufteilung nach Dokument, Seiten oder Kapiteln. Bereite den Vorlesetext vor und wähle die gewünschten Abschnitte aus.',
    'Prüfe und bearbeite den Text je Abschnitt. Korrigiere besonders Lesereihenfolge, Spalten, Tabellen und OCR-Fehler; passe bei Bedarf die Abschnittstitel an.',
    'Wähle Thorsten oder Kerstin und ein Sprechtempo zwischen 0,75 und 1,5. Höre eine Stimmprobe an, bestätige die Textprüfung und erstelle das Hörbuch.'
  ], 'WAV-Audio oder ein ZIP mit einzelnen Audioabschnitten und Wiedergabeliste. Der Vorlesetext lässt sich auch als TXT speichern.', 'Die Audioausgabe benötigt den Dokumentenserver; die Texterkennung läuft im Browser. Nur der ausgewählte Vorlesetext wird übertragen. Maximal 20.000 Zeichen und 100 Abschnitte pro Auftrag; längere Texte in mehrere Aufträge aufteilen. Die beiden deutschen Stimmen arbeiten auf dem Server offline.'),
  'number-compare': guide('Zwei Fassungen eines Dokuments.', [
    'Öffne beide Dateien und wähle die zweite Fassung im Werkzeug. Entscheide, ob vorhandener Suchtext genügt oder alle sichtbaren Seiten per OCR gelesen werden sollen.',
    'Starte den Zahlenvergleich. Die Zuordnung nutzt die Beschriftungen der Zeilen und berücksichtigt Beträge, Prozentwerte, Daten und mögliche IBANs.',
    'Öffne die Fundstellen auffälliger und ungeklärter Werte im Original. Exportiere die Ergebnisliste bei Bedarf nach Excel oder CSV.'
  ], 'Vergleich mit Fundstellen, Änderungen und ungeklärten Zuordnungen; Tabellenexport.', 'Ähnlich beschriftete oder mehrfach vorkommende Zeilen können mehrdeutig sein. Ein Vergleich ohne erkannte Abweichung bestätigt keine vollständige Übereinstimmung der Dokumente.'),
  'field-collector': guide('Mehrere PDFs mit wiederkehrenden Angaben, etwa Rechnungsnummer, Datum oder Betrag.', [
    'Definiere ein gewünschtes Feld pro Zeile: Feldname = Suchbegriff | Alternative. Beispiel: Rechnungsnummer = Rechnungsnr. | Rechnungsnummer.',
    'Sammle die Felder aus allen Dateien. Wähle bei mehreren Treffern die passende Angabe und öffne ihre Fundstelle.',
    'Korrigiere Werte, bestätige geprüfte Angaben und exportiere die Sammlung nach Excel oder CSV.'
  ], 'Tabelle mit Datei, gesammelten Werten, Fundstellen und Prüfstatus.', 'Die Suche folgt deinen Felddefinitionen. Fehlende oder ungeprüfte Angaben bleiben im Export erkennbar. Unterschiedliche Beleglayouts können zusätzliche Suchbegriffe und manuelle Korrekturen erfordern.'),
  'invoice-visual-check': guide('Eine hybride Rechnungs-PDF mit eingebetteter UBL- oder CII-Rechnungs-XML.', [
    'Wähle die Rechnungsdatei und gegebenenfalls die passende eingebettete Rechnung.',
    'Starte den Abgleich. MoinPDF liest die sichtbaren Seiten per OCR und vergleicht ausgewählte Angaben mit den strukturierten Rechnungsdaten.',
    'Prüfe geänderte oder ungeklärte Werte am Original. In der Gegenüberstellung steht die erste Angabe für XML und die zweite für die sichtbare Rechnung.'
  ], 'Vergleich ausgewählter Rechnungsangaben mit Fundstellen und Tabellenexport.', 'Nicht erkannte Werte bleiben ungeklärt. Dieser Abgleich prüft weder die Echtheit der Rechnung noch Signaturen oder vollständige Normkonformität. Für die KoSIT-Prüfung gibt es ein eigenes Werkzeug.'),
  'page-gaps': guide('PDFs mit gedruckter Seitenzählung wie „Seite 3 von 7“.', [
    'Öffne die betreffenden Dateien und starte die Suche nach Dokumentlücken. Bei reinen Scans kommt OCR zum Einsatz.',
    'Prüfe Hinweise auf fehlende Nummern, Wiederholungen und Sprünge anhand der angezeigten Fundstellen.',
    'Gleiche Auffälligkeiten mit dem Originaldokument ab und exportiere bei Bedarf die Prüfliste.'
  ], 'Hinweise zur gedruckten Seitenzählung und exportierbare Ergebnistabelle.', 'Jede Datei wird getrennt betrachtet. Enthält eine PDF mehrere Dokumente mit jeweils eigener Nummerierung, trenne sie vorher. Nicht erkannte oder nicht gedruckte Seitenzahlen lassen sich nicht zuverlässig auf Vollständigkeit prüfen.'),
  'ocr-review': guide('Scans oder PDFs, deren erkannter Suchtext kontrolliert werden soll.', [
    'Starte OCR mit Wortprüfung. Stelle ein, unter welcher Erkennungssicherheit Wörter als prüfbedürftig angezeigt werden sollen.',
    'Öffne eine Fundstelle im vergrößerten Originalausschnitt und korrigiere den erkannten Text. Über „Alle Wörter anzeigen“ kontrollierst du auch unauffällige Wörter.',
    'Speichere die PDF mit korrigierter Textebene oder exportiere den korrigierten Text.'
  ], 'TXT oder neue PDF mit korrigiertem Suchtext hinter den Seitenbildern.', 'Die sichtbaren Seitenbilder bleiben unverändert. Sichtbare Schreibfehler werden dadurch nicht korrigiert. Auch vermeintlich sichere OCR-Wörter können falsch sein, insbesondere Namen, Beträge und Kennnummern.'),
  'pseudonymize': guide('Eine oder mehrere PDFs und eine eigene Liste zu ersetzender Angaben.', [
    'Trage pro Zeile Originalbegriff = Platzhalter ein. Gib alle relevanten Schreibvarianten ausdrücklich an; mehrere Varianten können denselben Platzhalter erhalten.',
    'Suche die Treffer in allen Dateien und prüfe die markierten Bereiche sowie die eingesetzten Platzhalter. Nicht passende Treffer kannst du abwählen.',
    'Bestätige die Kontrolle und exportiere die pseudonymisierten PDFs als ZIP. Eine vertrauliche Zuordnung kannst du getrennt speichern.'
  ], 'ZIP mit neuen PDFs aus Seitenbildern und neutralen Dateinamen; optional separate Zuordnung.', 'Es werden ausschließlich die von dir angegebenen und erkannten Begriffe ersetzt. Nicht erkannte oder abgewählte Angaben bleiben sichtbar. Die Zuordnung enthält Originalangaben und gehört nicht in das Paket für Empfänger.'),
  'attachment-links': guide('Ein Hauptdokument mit Anlagenverweisen und die zugehörigen PDF-Anlagen.', [
    'Öffne die Dateien und lasse Anlagenverweise erkennen. Unterstützte Muster sind etwa „Anlage 3“, „Anhang A“ oder „Appendix 2“.',
    'Prüfe die vorgeschlagenen Ziele anhand der Originalseiten. Weise ungeklärten Verweisen die passende Zielseite zu.',
    'Bestätige die Zielzuordnung und erstelle das PDF-Paket mit Anlagenlinks. Prüfe die Links im heruntergeladenen Ergebnis.'
  ], 'Zusammenhängende PDF mit internen Seitenverweisen; Liste ungeklärter Zuordnungen.', 'Gleichlautende Anlagenbezeichnungen sind nicht immer eindeutig. Die automatische Zuordnung ist ein Vorschlag und muss vor dem Export geprüft werden.'),
  'best-scans': guide('Mindestens zwei Scans desselben Dokuments.', [
    'Wähle eine Hauptdatei als Ausgangspunkt für Seitenzahl und Reihenfolge und starte den Scanvergleich.',
    'Vergleiche Referenz und vorgeschlagene Originalseite. Bestätige jede Ausgabeseite; du kannst eine andere Seite wählen, Seiten ergänzen, entfernen und verschieben.',
    'Erstelle die PDF aus den bestätigten Seiten und kontrolliere nochmals Reihenfolge und Vollständigkeit.'
  ], 'PDF aus den ausgewählten Originalseiten ohne erneute Bildkomprimierung.', 'Schärfe, Kontrast und Ähnlichkeit sind nur Auswahlhilfen. Bildrauschen kann scharf wirken, verschiedene Seiten können ähnlich aussehen. Die Hauptdatei kann selbst unvollständig sein.'),
  'document-reconcile': guide('Angebot und Rechnung sowie optional ein Auftrag als getrennte PDFs.', [
    'Wähle oben das Angebot sowie die Dateien für Rechnung und optionalen Auftrag. Lies die Positionen aus.',
    'Prüfe Beschreibungen, Mengen, Einzelpreise und Beträge. Ergänze fehlende Positionen oder korrigiere Vorschläge und Fundstellenseiten.',
    'Bestätige einheitliche Einheiten und Währungen. Vergleiche die geprüften Positionen und exportiere die Auffälligkeiten.'
  ], 'Positionsvergleich mit Mengen-, Preis- und Betragsabweichungen sowie Tabellenexport.', 'Die Erkennung ist auf einfache Positionszeilen ausgelegt. Unterschiedliche Preisbasen, Rabatte, Einheiten, Währungen oder Steuersätze werden nicht automatisch umgerechnet.'),
  'comment-export': guide('PDFs mit echten Kommentaren, Notizen oder Hervorhebungs-Anmerkungen.', [
    'Sammle die Kommentare aus allen geöffneten Dateien. Prüfe Autor, Seite und verfügbaren Textauszug.',
    'Bearbeite die exportierten Aufgabentexte und hake erledigte Punkte ab. Die Fundstellen helfen dir beim Abgleich mit dem Dokument.',
    'Speichere die Arbeitsliste als Excel, CSV oder Markdown-Aufgabenliste.'
  ], 'Bearbeitbare Aufgabenliste mit Dokumentbezug.', 'Die Änderungen betreffen die Arbeitsliste, nicht die Kommentare im Original-PDF. In Seitenbilder eingebrannte Markierungen werden nicht erkannt; Textauszüge benötigen eine auslesbare Textebene.'),
  'pdf-repair': guide('Eine beschädigte PDF, auch wenn die normale Vorschau sie nicht öffnen kann.', [
    'Öffne das Werkzeug über „Alle Werkzeuge“ und wähle die beschädigte Datei direkt im Reparaturfeld aus.',
    'Starte den Reparaturversuch. MoinPDF versucht, lesbare Objekte und eine verwendbare Dateistruktur wiederherzustellen.',
    'Lade das Ergebnis herunter und prüfe jede wichtige Seite auf Vollständigkeit, Darstellungsfehler und fehlende Inhalte.'
  ], 'Neu geschriebene PDF, sofern die vorhandenen Daten reparierbar sind.', 'Fehlende oder zerstörte Inhalte können nicht zurückgeholt werden. Bewahre die beschädigte Originaldatei auf. Vorhandene digitale Signaturen werden durch das Neuschreiben ungültig.'),
  'optimize-pdf': guide('Eine PDF, die unter ein bestimmtes Dateigrößenlimit passen soll.', [
    'Wähle die Datei und trage die gewünschte maximale Größe in MB ein.',
    'Wähle verlustfreie Optimierung oder Bildkomprimierung. Starte die Verarbeitung und lies den Hinweis zur tatsächlich erreichten Dateigröße.',
    'Kontrolliere kleine Schrift und Bilder im Ergebnis. Ist das Ziel nicht erreichbar, teile die Datei mit „Nach Dateigröße teilen“ oder nutze vorsichtig stärkere Scan-Komprimierung.'
  ], 'Optimierte PDF mit Größenangabe; bei unerreichbarem Ziel die kleinste gefundene Variante mit Hinweis.', 'Text, Links und Formulare bleiben erhalten; Bildqualität kann sinken. Die Browser-Ausgabe komprimiert geeignete Bilder ohne Auflösungsreduktion, die vollständige Installation kann sie zusätzlich verkleinern. Eine Zielgröße lässt sich nicht für jede Datei erreichen.'),
  'scan-split': guide('Scans mit mehreren Fotos oder Belegen auf einer Seite.', [
    'Lasse Ausschnitte auf der aktuellen oder allen Seiten erkennen. Passe den freien Abstand zwischen Vorlagen an, wenn Absätze fälschlich getrennt werden.',
    'Prüfe die Rahmen auf jeder markierten Seite. Entferne falsche Vorschläge und ziehe fehlende Ausschnitte selbst auf.',
    'Wähle Format und Auflösung, bestätige die Prüfung und lade die nummerierten Ausschnitte als ZIP herunter.'
  ], 'Einzelne PDF- oder Bilddateien im ZIP, in der Reihenfolge der Rahmen.', 'Am zuverlässigsten funktioniert die Erkennung auf hellem Hintergrund mit getrennten Vorlagen. Schiefe, überlappende oder dunkle Vorlagen benötigen häufig manuelle Rahmen. Sehr große Seiten werden auf maximal 4096 Pixel an der längsten Seite begrenzt.'),
  'pdf-markdown': guide('Eine PDF mit auslesbarem Text; Scans vorher mit OCR bearbeiten.', [
    'Wähle die Quelldatei und trage einen passenden Dokumenttitel sowie die Dokumentsprache ein.',
    'Erstelle die Markdown-Datei. Erkannte Überschriften und Abschnitte pro PDF-Seite strukturieren den Text.',
    'Öffne die Datei in einem Text- oder Markdown-Editor und kontrolliere Lesereihenfolge, Überschriften und Sonderzeichen.'
  ], 'Bearbeitbare Markdown-Datei (.md).', 'Bilder, komplexe Tabellen und das ursprüngliche Seitenlayout werden nicht übernommen. OCR zuerst anwenden und die durchsuchbare PDF als Arbeitsdokument übernehmen.'),
  'pdf-html': guide('Eine PDF mit Text oder gut lesbaren Scan-Seiten.', [
    'Wähle die Datei und lege Titel und Sprache für die Ausgabe fest.',
    'Erstelle die HTML-Datei. MoinPDF setzt den Text mit Überschriften und einer Navigation zwischen den Seitenabschnitten.',
    'Lade die Datei herunter, öffne sie im Browser und prüfe die Lesereihenfolge.'
  ], 'Eigenständige HTML-Datei mit lesbarem Text und Seitennavigation.', 'Dies ist eine Textaufbereitung. Das ursprüngliche Layout, Bilder und komplexe Tabellen werden nicht nachgebildet. Für Scans zunächst OCR nutzen.'),
  'pdf-epub': guide('Eine PDF mit Text, den du auf einem E-Reader lesen möchtest.', [
    'Prüfe, ob die PDF eine auslesbare Textebene enthält. Bei Scans zunächst eine durchsuchbare PDF mit OCR erstellen und übernehmen.',
    'Trage Titel und Sprache ein und starte „EPUB erstellen“.',
    'Öffne die Datei in deiner Lese-App und prüfe Inhaltsverzeichnis, Absatzfolge und Sonderzeichen.'
  ], 'EPUB mit anpassbarer Schrift und Inhaltsverzeichnis.', 'Der Text wird neu angeordnet. Bilder sowie das ursprüngliche Tabellen- und Seitenlayout entfallen. Mehrspaltige Dokumente können eine Nachbearbeitung der Lesereihenfolge erfordern.'),
  'ebook-pdf': guide('Eine ungeschützte EPUB-Datei.', [
    'Wähle die EPUB-Datei direkt im Werkzeug oder über die Dateiauswahl der App.',
    'Stelle A4 oder A5 und eine Grundschriftgröße zwischen 8 und 24 Punkt ein. Starte die Umwandlung.',
    'Prüfe den Seitenumbruch und die Lesbarkeit der erzeugten PDF, insbesondere bei Tabellen oder langen Überschriften.'
  ], 'PDF mit neu umbrochenem Text und eingebetteten Bildern.', 'Bis 40 MB und 200 Ausgabeseiten. Verschlüsselte Inhalte und geschützte Schriftdateien werden nicht unterstützt. Buchvorgaben können die Grundschriftgröße übersteuern; externe Ressourcen, interaktive Inhalte und Links werden nicht übernommen.'),
  'pdf-powerpoint': guide('Eine PDF mit höchstens 100 Seiten.', [
    'Wähle die PDF und starte die PowerPoint-Erstellung.',
    'Jede Seite wird als Bild proportional auf eine Folie im Format 16:9 eingepasst.',
    'Öffne die PPTX-Datei in PowerPoint oder einer kompatiblen Anwendung und ergänze bei Bedarf eigene Präsentationselemente.'
  ], 'PPTX mit einer Folie pro PDF-Seite.', 'Die Seiten sind Bilder. Einzelne Texte, Tabellen und Grafiken werden dadurch nicht zu separat bearbeitbaren PowerPoint-Objekten.'),
  'html-pdf': guide('Ein öffentlicher Website-Link oder eine lokal gespeicherte HTML- oder HTM-Datei.', [
    'Wähle „Website-Link“ und füge die Adresse ein. Ohne Protokoll ergänzt MoinPDF HTTPS. Für eine gespeicherte Webseite wähle „HTML-Datei“.',
    'Für Links kannst du Papierformat, Querformat, Hintergrundfarben und Bildschirm- oder Druckansicht wählen. Starte dann die PDF-Erstellung.',
    'Prüfe die Vorschau. Lade die PDF herunter oder bearbeite sie direkt in MoinPDF weiter.'
  ], 'Eine PDF der Webseite mit Bildern, Schriften und Seitengestaltung; bei HTML-Dateien eine neu gesetzte Text-PDF.', 'Der Web-Konverter ruft öffentliche HTTP-/HTTPS-Seiten ohne deine Anmeldung oder Browser-Cookies ab. Cookie-Banner, geschützte und dynamische Inhalte können abweichen. Private Adressen und ungewöhnliche Ports sind gesperrt. Gespeicherte HTML-Dateien werden weiterhin ohne JavaScript, Bilder und CSS verarbeitet.'),
  'auto-orient': guide('Eine PDF mit verdrehten Textseiten, höchstens 50 Seiten.', [
    'Wähle die Datei und belasse das Mindestvertrauen zunächst bei 15 oder passe es gezielt an.',
    'Starte die Erkennung. Sicher erkannte Seiten werden um 90, 180 oder 270 Grad korrigiert.',
    'Öffne die Ergebnis-PDF und den seitenweisen Bericht. Drehe unsichere Seiten bei Bedarf manuell unter „Seiten organisieren“.'
  ], 'ZIP mit korrigierter PDF und Seitenbericht.', 'Textarme oder unsicher erkannte Seiten bleiben unverändert. Das Werkzeug korrigiert Vierteldrehungen; kleine Schieflagen behandelst du mit „Scans verbessern“.'),
  'book-dewarp': guide('Ein Buchscan mit am Falz gebogenen Textzeilen.', [
    'Wähle, ob der Buchfalz links oder rechts liegt.',
    'Stelle die Kurve als Prozentwert der Seitenhöhe ein. Positive Werte heben den Inhalt am Falz, negative senken ihn.',
    'Erstelle eine Ausgabe, prüfe die Zeilen und passe den Wert bei Bedarf an. Führe anschließend OCR aus, wenn du Suchtext benötigst.'
  ], 'PDF mit korrigierten Seitenbildern.', 'Die Korrektur folgt einer manuell eingestellten Kurve. Komplexe Wölbungen werden nicht automatisch vollständig rekonstruiert; vorhandener Suchtext geht beim Bildexport verloren.'),
  'form-detect': guide('Eine PDF mit leeren Kästchen oder Eingabelinien, bis 50 Seiten.', [
    'Starte die Felderkennung. Rechtecke, Linien und bei Scans passende Konturen werden als Feldvorschläge übernommen.',
    'Übernimm die erzeugte PDF als Arbeitsdokument und öffne „Formular erstellen“.',
    'Kontrolliere Feldtypen, Namen, Größen und Positionen. Entferne Fehlvorschläge und teste das Ausfüllen.'
  ], 'PDF mit vorgeschlagenen interaktiven Textfeldern und Checkboxen.', 'Höchstens 500 neue Felder. Die Erkennung versteht nicht automatisch die fachliche Bedeutung eines Formulars; gedruckte Tabellenlinien können als Eingabefelder missverstanden werden.'),
  'redaction-check': guide('Eine geschwärzte PDF und die vertraulichen Begriffe, nach denen du suchen möchtest.', [
    'Trage zu kontrollierende Namen, Kennnummern oder Textstellen jeweils in eine eigene Zeile ein.',
    'Starte die Prüfung auf auslesbaren Text und mögliche dunkle Vektor-Überdeckungen.',
    'Prüfe Befunde im Bericht und kontrolliere zusätzlich sichtbare Bildinhalte, Anhänge sowie die konkrete Empfängerdatei.'
  ], 'Befundbericht zu den ausgeführten Schwärzungsprüfungen.', 'Ein Bericht ohne Treffer beweist keine sichere Schwärzung. Nicht alle Bildinhalte, alten Revisionen oder Anhänge werden umfassend bewertet. Zum Entfernen nutze „Schwärzen“ oder „Suchen & schwärzen“.'),
  'print-check': guide('Eine PDF, die du für den Druck vorbereiten möchtest.', [
    'Lege die gewünschte Mindestauflösung für Bilder fest, zum Beispiel passend zu den Vorgaben deines Druckdienstleisters.',
    'Starte die Prüfung und lies die Hinweise zu effektiver Bildauflösung, Schrifteinbettung und Seitenboxen.',
    'Prüfe auffällige Seiten in der Vorschau und korrigiere die Quelldatei, bevor du eine neue PDF erzeugst.'
  ], 'Technischer Bericht zur Druckvorbereitung.', 'Farbseparation, Überdruck und konkrete Druckerei-Vorgaben sind nicht Teil dieser Prüfung. Der Bericht ist keine PDF/X-Zertifizierung.'),
  'accessibility-check': guide('Für Prüfungen eine vorhandene PDF; für ein neues Dokument Textblöcke und bei Bedarf eigene Bilder. Der Dokumentenserver muss verfügbar sein.', [
    'Unter „Barrierefreiheit: Aktion“ zwischen Basisprüfung, veraPDF-Prüfung und „Strukturiertes PDF neu erstellen“ wählen.',
    'Bei einer vorhandenen Datei PDF/UA-1 oder PDF/UA-2 als Prüfprofil auswählen. Die ZIP-Datei enthält Ergebnis und vollständigen veraPDF-Bericht.',
    'Für eine neue Datei Titel und Dokumentsprache angeben. PDF-Text als Entwurf anhängen oder eigene Blöcke schreiben. Überschriftenebenen, Absätze und Reihenfolge bearbeiten; Bilder mit passender Beschreibung hinzufügen.',
    'Strukturdatei bei Bedarf speichern oder wieder öffnen. „PDF/UA erstellen und prüfen“ erzeugt eine A4-Neufassung. Die ZIP enthält ein PDF nur bei bestandener technischer PDF/UA-1-Prüfung.',
    'Zusätzlich Vollständigkeit, Lesereihenfolge, Überschriften, Alternativtexte und Kontraste manuell kontrollieren.',
  ], 'Basisbericht oder PDF/UA-Prüfbericht; bei bestandener Erstellungsprüfung zusätzlich ein technisch geprüftes PDF/UA-1-Dokument.', 'Die Neufassung erhält nicht das ursprüngliche Layout. Tabellen, Formulare und Bilder werden beim PDF-Textimport nicht automatisch übernommen. Höchstens 200 Blöcke, 100.000 Zeichen, zehn Bilder und 8 MB Strukturauftrag. Keine automatische Reparatur beliebiger PDF-Tags. Maschinenprüfung allein bestätigt keine vollständige Barrierefreiheit.'),
  'translate-pdf': guide('Eine PDF mit auslesbarem Text; bei Scans zunächst OCR anwenden.', [
    'Wähle die Ausgangssprache oder automatische Erkennung und die gewünschte Zielsprache.',
    'Starte die Übersetzung. Falls die Sprachmodelle beim ersten Serverstart noch vorbereitet werden, warte auf deren Bereitschaft.',
    'Prüfe Original und Übersetzung nebeneinander und kontrolliere Namen, Zahlen sowie Fachbegriffe vor der Verwendung.'
  ], 'PDF mit Originaltext und Übersetzung nebeneinander.', 'Unterstützt werden Deutsch, Englisch, Französisch, Spanisch, Italienisch, Niederländisch und Polnisch. Höchstens 60.000 Zeichen je Auftrag. Die Ausgabe übernimmt nicht das ursprüngliche Seitenlayout; die Übersetzung ist maschinell.'),
  'zugferd-create': guide('Eine sichtbare Rechnungs-PDF und eine inhaltlich passende CII-Rechnungs-XML.', [
    'Wähle die gewünschte Aktion und das Rechnungsprofil. Für die Erstellung lade Rechnungs-PDF und passende XML.',
    'Gleiche die Rechnungsdaten vorab ab und starte die Verarbeitung. MoinPDF verbindet die Dateien und führt die vorgesehenen Prüfungen aus.',
    'Lade das Ergebnis mit Prüfbericht herunter und lies alle Befunde. Verwende eine als fehlgeschlagen markierte Ausgabe nicht als erfolgreich validierte Rechnung.'
  ], 'Hybride Rechnung beziehungsweise Prüfresultat mit Mustang- und veraPDF-Berichten.', 'Das Werkzeug erzeugt nicht automatisch richtige Rechnungsdaten aus einer sichtbaren PDF. XML und Rechnungsbild müssen zusammenpassen; ein Bericht muss vor Weitergabe geprüft werden.'),
  'word-mail-merge': guide('Eine DOCX-Vorlage mit Platzhaltern und eine XLSX-Datei mit Datensätzen.', [
    'Verwende in Word Platzhalter wie {{Name}} oder {{Adresse}}. Benenne die Spalten in der ersten Zeile des ersten Excel-Tabellenblatts genau entsprechend.',
    'Wähle Vorlage und Tabelle. Wandle Excel-Formeln vorher in Werte um und prüfe zunächst einen kleinen Beispieldatensatz.',
    'Erstelle die Serienbriefe und kontrolliere Seitenumbrüche, fehlende Werte und Dateizuordnung im ZIP.'
  ], 'Eine PDF pro Datenzeile, gesammelt in einem ZIP.', 'Bis 50 Datensätze und 50 Spalten. Verknüpfte externe Bilder werden nicht geladen. Für interaktive PDF-Vorlagen statt Word nutze „Serienformulare“.'),
  'split-size': guide('Eine PDF und das maximale Dateigrößenlimit des Empfängers.', [
    'Trage die maximale Größe pro PDF in MB ein. Hier entspricht 1 MB genau 1.000.000 Bytes.',
    'Berechne die Teildateien und prüfe die Tabelle mit Seitenbereichen und tatsächlich gemessenen Größen.',
    'Speichere alle Teildateien als ZIP. Ist schon eine einzelne Seite zu groß, komprimiere die Quelle vorher.'
  ], 'ZIP mit aufeinanderfolgenden PDF-Teilen innerhalb des erreichbaren Limits.', 'Die Reihenfolge bleibt erhalten, Seiten werden nicht als Bilder neu komprimiert. Lesezeichen, Signaturen und interaktive Formularfunktionen werden nicht übernommen.'),
  'pdf-word': guide('Eine PDF mit Text oder gut lesbaren Scan-Seiten.', [
    'Wähle die Datei. Seiten ohne auslesbaren Text werden beim Word-Export automatisch per OCR erkannt.',
    'Starte die Word-Erstellung. In der vollständigen Installation verarbeitet der Dokumentenserver Text, Tabellen und Bilder; die Browser-Ausgabe bietet einen reinen Textexport.',
    'Öffne die DOCX-Datei in Word und kontrolliere insbesondere Tabellen, Schriften, Absätze und Seitenumbrüche.'
  ], 'Bearbeitbare DOCX-Datei.', 'Ein PDF speichert kein vollständiges Word-Layout. Auch die Server-Konvertierung kann Nacharbeit erfordern; die lokale Textausgabe rekonstruiert das Layout nicht.'),
  'email-pdf': guide('Eine gespeicherte EML-Datei oder eine Outlook-MSG-Datei.', [
    'Wähle die E-Mail-Datei. MoinPDF übernimmt Kopfzeilen wie Absender und Betreff sowie den Nachrichteninhalt.',
    'Aktiviere bei Bedarf die zusätzliche Ausgabe der Anlagen als ZIP.',
    'Erstelle und kontrolliere die PDF. Prüfe im ZIP, ob alle benötigten Anlagen enthalten sind.'
  ], 'PDF der Nachricht; optional ZIP mit PDF und unveränderten Anlagen.', 'Externe Bilder werden nicht geladen. Anlagen werden mit ausgegeben, aber nicht automatisch sämtlich in PDF umgewandelt oder auf ihren Inhalt geprüft.'),
  'batch': guide('Mehrere PDFs, auf die derselbe Bearbeitungsschritt angewendet werden soll.', [
    'Öffne die Dateien und wähle den gewünschten Schritt, etwa Stempeln, Nummerieren, Bereinigen oder Schützen.',
    'Lege die Einstellungen für den gesamten Stapel fest und prüfe die aufgelisteten Dokumente.',
    'Verarbeite den Stapel, entpacke die Ergebnisse und kontrolliere mindestens die unterschiedlichen Dokumenttypen.'
  ], 'ZIP mit einer bearbeiteten PDF pro Eingabedatei.', 'Die Dateien bleiben getrennt. Für eine gemeinsame PDF nutze „Zusammenfügen“, für mehrere aufeinanderfolgende Schritte „Arbeitsabläufe“.'),
  'workflows': guide('PDFs und eine wiederkehrende Abfolge von Bearbeitungsschritten.', [
    'Benenne den Ablauf und füge die gewünschten Schritte hinzu, zum Beispiel OCR, Leerseiten entfernen und Nummerieren.',
    'Ordne die Schritte mit den Pfeilen. Passwortschutz muss am Ende stehen. Kontrolliere die jeweiligen Einstellungen und führe den Ablauf aus.',
    'Speichere den Ablauf im Browser oder exportiere ihn als JSON, um ihn später wieder zu laden. Prüfe die PDFs im Ergebnis-ZIP.'
  ], 'ZIP mit verarbeiteten PDFs; optional wiederverwendbare JSON-Ablaufdatei.', 'Bis zu zwölf Schritte sind möglich. Gespeichert werden nur Schritte und Einstellungen, keine Dokumente oder Passwörter. Passwörter müssen bei der Ausführung erneut eingegeben werden; OCR und Leerseitenerkennung erfordern eine Ergebniskontrolle.'),
  'auto-rename': guide('Mehrere PDFs mit erkennbaren Daten, Rechnungsnummern oder Titeln.', [
    'Öffne die Dokumente und lege ein Namensmuster fest, etwa {datum}_{nummer}_{titel}. Lasse daraus Dateinamen vorschlagen.',
    'Prüfe jeden Vorschlag und korrigiere falsche Daten, Nummern oder Titel direkt in der Liste.',
    'Exportiere die Dateien mit den bestätigten Namen und kontrolliere die Zuordnung.'
  ], 'Dateien mit neuen Namen, gesammelt als ZIP.', 'Ausgelesen werden die ersten drei Seiten; für Scans zuerst OCR anwenden. Die Originaldateien auf deinem Gerät werden nicht umbenannt. Ein Dokument kann mehrere relevante Daten oder Kennnummern enthalten.'),
  'smart-split': guide('Eine PDF mit mehreren Einzeldokumenten oder erkennbaren Trennstellen.', [
    'Wähle das Trennkriterium: Text, Lesezeichen, leere Seiten oder QR-/Barcode-Trennblätter.',
    'Starte die Erkennung und kontrolliere die vorgeschlagenen Abschnitte. Passe die Einstellungen an, wenn ein Trennblatt oder Begriff mehrfach vorkommt.',
    'Erstelle die Teildokumente und prüfe Anfang und Ende jedes Abschnitts.'
  ], 'ZIP mit PDF-Abschnitten.', 'Die Erkennung kann Trennstellen übersehen oder zu viele finden. Bei Scans kann vor der Texttrennung OCR nötig sein. Für bereits bekannte Grenzen ist „In Abschnitte teilen“ einfacher.'),
  'table-export': guide('Eine PDF mit Tabellen auf einer oder mehreren Seiten; auslesbarer Text oder gut lesbare Scans.', [
    'Wähle die Vorschauseite, markiere den Tabellenbereich und gib bei Bedarf einen Seitenbereich ein. Bereich und Spaltengrenzen gelten für alle gewählten Seiten.',
    'Gib Spaltengrenzen in Prozent ab dem linken Seitenrand an; 35, 65 ergibt drei Spalten. Teile bei Bedarf neu auf und korrigiere Zeilen und Zellen, besonders Dezimalzeichen, negative Beträge und mehrzeilige Inhalte.',
    'Exportiere die geprüfte Tabelle als Excel oder CSV und kontrolliere sie in deiner Tabellenanwendung.'
  ], 'XLSX oder CSV mit den erkannten und korrigierten Werten.', 'Prüfe Kopfzeilen, Spaltentypen und Zahlenformat (Deutsch oder Englisch). Excel erhält erkennbare Zahlen und Datumswerte als echte Werte; führende Nullen, lange Kennungen und Formeln bleiben Text. Wiederholte Kopfzeilen können entfernt werden. Komplexe Tabellen und mehrzeilige Zellen benötigen weiterhin Kontrolle.'),
  'search-redact': guide('Eine PDF und die Begriffe oder Muster, die entfernt werden sollen.', [
    'Gib Namen und eigene Suchbegriffe jeweils in einer Zeile ein. Aktiviere bei Bedarf die Erkennung von E-Mail-Adressen und möglichen IBANs sowie OCR für Scans.',
    'Lasse Fundstellen ermitteln und prüfe jeden ausgewählten Bereich in der Vorschau. Ergänze abweichende Schreibweisen und kontrolliere nicht erkannte Angaben.',
    'Bestätige die Auswahl, erstelle die geschwärzte Ausgabe und prüfe genau die heruntergeladene Datei.'
  ], 'Neue PDF mit entfernten Trefferbereichen in neu aufgebauten Seitenbildern.', 'Erkennung ist keine Vollständigkeitsgarantie. Die ursprüngliche Textebene und interaktive Funktionen werden bei der Bildausgabe nicht übernommen. Ein dunkles Rechteck aus einem anderen Programm ist nicht automatisch eine sichere Schwärzung.'),
  'visual-compare': guide('Zwei PDF-Fassungen mit vergleichbaren Seiten.', [
    'Wähle die beiden Dateien und starte den visuellen Vergleich.',
    'Vergleiche die farbig hervorgehobenen Unterschiede seitenweise und beachte den angezeigten Anteil veränderter Bildbereiche.',
    'Prüfe Auffälligkeiten im Original, bevor du sie als inhaltliche Änderung einordnest.'
  ], 'Visuelle Gegenüberstellung mit farbigen Differenzen und Ergebnisexport.', 'Verglichen werden gerenderte Seitenbilder. Verschobene Inhalte, unterschiedliche Scanhelligkeit oder andere Auflösung können große Unterschiede erzeugen, obwohl der Text gleich geblieben ist.'),
  'scan-enhance': guide('Eine gescannte PDF mit Schieflage, schwachem Kontrast oder störendem Hintergrund.', [
    'Wähle das Dokument und die gewünschten Korrekturen für Schieflage, Kontrast, Helligkeit und Hintergrund.',
    'Prüfe die Vorschau, besonders kleine Schrift, helle Stempel und handschriftliche Ergänzungen.',
    'Erstelle die verbesserte PDF. Wenn du Suchtext benötigst, wende anschließend OCR auf das Ergebnis an.'
  ], 'PDF mit verbesserten Seitenbildern.', 'Starke Einstellungen können blasse Informationen entfernen. Arbeite von einer erhaltenen Originalkopie aus und kontrolliere verschiedene Seiten, nicht nur die erste.'),
  'cover-toc': guide('Eine bereits zusammengestellte PDF; mehrere Dateien vorher zusammenfügen und das Ergebnis übernehmen.', [
    'Lege Dokumenttitel und Untertitel fest und entscheide, ob zusätzlich ein Deckblatt eingefügt werden soll.',
    'Trage pro Zeile Titel | Originalseite ein, etwa Anhang | 5, oder übernimm vorhandene Lesezeichen. Die zusätzlich eingefügten Seiten werden bei den neuen Seitenzahlen berücksichtigt.',
    'Erstelle die Mappe und teste die Verzeichnislinks im Ergebnis.'
  ], 'PDF mit Deckblatt, klickbarem Inhaltsverzeichnis und Lesezeichen.', 'Das Verzeichnis richtet sich nach den angelegten Einträgen. Die automatische Seitennummernanpassung ersetzt keine Prüfung von Titeln und Dokumentreihenfolge.'),
  'mail-merge': guide('Eine interaktive PDF-Formularvorlage und CSV- oder TSV-Datensätze.', [
    'Öffne die Formularvorlage und lade die Datentabelle.',
    'Ordne die Spalten den PDF-Feldern zu und lege die Benennung der Ausgabedateien fest. Entscheide, ob die ausgefüllten Felder fixiert werden sollen.',
    'Erstelle die Serienformulare und prüfe einige Datensätze einschließlich langer Texte und leerer Werte.'
  ], 'Eine individuelle PDF pro Tabellenzeile im ZIP.', 'Bis 500 Datensätze; CSV/TSV bis 5 MB mit Kopfzeile. Die Vorlage benötigt echte Formularfelder. Bei Scans erst Felder erstellen oder erkennen. Fixierte Felder lassen sich später nicht mehr als Formular ausfüllen.'),
  'qr-barcode': guide('PDF-Seiten mit Codes oder der Inhalt für einen neu zu erstellenden Code.', [
    'Wähle das Auslesen vorhandener Codes oder die Erstellung eines QR-Codes, Code 128 oder EAN-13.',
    'Prüfe erkannte Inhalte beziehungsweise gib die passenden Daten ein. Platziere einen neu erstellten Code auf der gewünschten Seite.',
    'Exportiere die Ausgabe und teste den Code mit einem zweiten Lesegerät oder einer Scan-App.'
  ], 'Ausgelesene Codeinhalte beziehungsweise Codegrafik oder PDF mit platziertem Code.', 'Auflösung, Kontrast und ausreichender Rand entscheiden über die Lesbarkeit. Ein erkannter Weblink wird dadurch nicht auf Vertrauenswürdigkeit geprüft.'),
  'link-editor': guide('Eine PDF mit vorhandenen Links oder Stellen für neue Verweise.', [
    'Wähle die Seite und einen vorhandenen Link oder markiere einen neuen Linkbereich.',
    'Lege ein Webseiten-, E-Mail- oder internes Seitenziel fest. Korrigiere Ziel und Bereich oder entferne nicht mehr benötigte Verweise.',
    'Speichere die PDF und teste die Links im heruntergeladenen Dokument.'
  ], 'PDF mit geänderten Link-Anmerkungen.', 'Sichtbar gedruckte Webadressen sind nicht automatisch aktive PDF-Links. Prüfe interne Seitenziele erneut, wenn du später die Seitenreihenfolge änderst.'),
  'attachment-manager': guide('Eine PDF mit eingebetteten Dateien oder Dateien, die du einbetten möchtest.', [
    'Lade die vorhandenen Anhänge und kontrolliere deren Namen.',
    'Füge Dateien hinzu, benenne Einträge um, ersetze vorhandene Anhänge oder entferne sie aus der Ausgabe.',
    'Speichere die PDF und überprüfe die Anhangsliste in einem geeigneten PDF-Programm.'
  ], 'PDF mit aktualisierten eingebetteten Dateien.', 'Anhänge sind Dateien innerhalb der PDF, keine Bilder auf einer Seite. Das Ersetzen einer Rechnungs-XML kann die Übereinstimmung mit dem Rechnungsbild aufheben; geeignete Rechnungswerkzeuge anschließend gezielt einsetzen.'),
  'camera-scan': guide('Eine Kamera oder vorhandene Fotos von Dokumenten.', [
    'Erlaube den Kamerazugriff und nimm ein Dokument auf oder wähle ein vorhandenes Foto.',
    'Setze die vier Dokumentecken, um die Perspektive zu korrigieren, und passe die Scanbereinigung an.',
    'Füge weitere Seiten hinzu, kontrolliere ihre Reihenfolge und erstelle eine gemeinsame PDF.'
  ], 'PDF aus bis zu 50 gesammelten Fotoseiten.', 'Die Kamera benötigt HTTPS oder einen vom Browser als sicher behandelten lokalen Ursprung sowie deine Berechtigung. Über gewöhnliches HTTP im lokalen Netz kann die Fotoauswahl weiterhin als Alternative dienen. Gute Beleuchtung ohne Schatten verbessert das Ergebnis.'),
  'office-pdf': guide('Word, Excel, PowerPoint oder OpenDocument: DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT/ODS/ODP.', [
    'Wähle die Office-Datei direkt auf der Startseite oder im Werkzeug.',
    'Starte die Umwandlung im gewählten Modus und warte auf das Ergebnis.',
    'Kontrolliere Schriften, Seitenumbrüche, Tabellenbreiten und bei Präsentationen jede Folie.'
  ], 'PDF der Office-Datei.', 'Die Darstellung hängt unter anderem von verfügbaren Schriften und Dokumenteinstellungen ab. Komplexe Office-Layouts können abweichen. Die Eingabedatei bleibt unverändert.'),
  'pdfa': guide('Eine PDF für eine Archivkopie oder eine vorhandene PDF/A-Datei zur Prüfung.', [
    'Wähle, ob du PDF/A erstellen oder eine vorhandene Datei prüfen möchtest.',
    'Stelle bei der Erstellung das angebotene PDF/A-Profil ein und starte die Verarbeitung.',
    'Öffne den Prüfbericht aus dem ZIP und kontrolliere die Ausgabe. Eine erzeugte Datei ist nur bei entsprechendem Prüfergebnis erfolgreich validiert.'
  ], 'ZIP mit PDF beziehungsweise Prüfresultat und Prüfbericht.', 'Interaktive Elemente und Anhänge können in der Archivkopie entfallen. Ein technischer Konformitätsbericht ist kein Nachweis, dass ein gesamter Archivierungsprozess alle organisatorischen Anforderungen erfüllt.'),
  'xrechnung-validate': guide('Eine XRechnungs-XML zur technischen Validierung.', [
    'Wähle die Rechnungsdatei und starte die vollständige Validierung.',
    'Lies Fehler und Warnungen im KoSIT-Prüfbericht; beachte die vom installierten Validator unterstützte Konfiguration.',
    'Korrigiere Fehler in der rechnungserstellenden Anwendung und prüfe die neu ausgegebene XML erneut.'
  ], 'Prüfbericht nach den installierten KoSIT-Regeln.', 'Die Validierung prüft technische Regeln der Rechnung. Sie ersetzt weder den Abgleich mit dem zugrunde liegenden Geschäftsvorfall noch eine Prüfung der Echtheit oder der tatsächlichen Leistung.'),
  'certificate-sign': guide('Eine PDF; zum Signieren zusätzlich ein PKCS#12-Zertifikat (.p12/.pfx) mit Passwort.', [
    'Wähle Signieren oder Signaturen prüfen. Für eine neue Signatur wähle das Zertifikat und gib dessen Passwort ein.',
    'Starte die Verarbeitung. Nur im Servermodus werden PDF, Zertifikat mit privatem Schlüssel und Passwort für diesen Auftrag an den eigenen Dokumentenserver übertragen.',
    'Lade das Ergebnis herunter und prüfe Integrität, Vertrauen und Änderungsbefunde. Bearbeite eine fertig signierte Datei anschließend nicht weiter.'
  ], 'Signierte PDF beziehungsweise Signatur-Prüfbericht.', 'Die Prüfung fragt den aktuellen Sperrstatus nicht ab und bestätigt keine qualifizierte elektronische Signatur. Wähle den Servermodus nur, wenn du dem eigenen Dokumentenserver auch dein Zertifikat anvertrauen möchtest.'),
  'protect': guide('Eine vollständige PDF und ein neues Öffnungspasswort.', [
    'Wähle das Dokument und lege das Passwort sowie die angebotenen Berechtigungen fest.',
    'Erstelle die mit AES-256 geschützte Ausgabe.',
    'Öffne die heruntergeladene Datei erneut und prüfe die Passwortabfrage. Bewahre das Passwort getrennt von der Datei auf.'
  ], 'Passwortgeschützte PDF.', 'Berechtigungen wie Drucken oder Kopieren hängen vom verwendeten PDF-Programm ab. Nach Bearbeitung mit anderen Werkzeugen ist die neue Ausgabe meist ungeschützt; wende Passwortschutz deshalb als letzten Schritt an.'),
  'unlock': guide('Eine geschützte PDF, deren benötigtes Passwort du kennst.', [
    'Öffne die Datei und gib das Passwort in der lokalen Passwortabfrage ein.',
    'Wähle „PDF entsperren“ und speichere eine ungeschützte Kopie.',
    'Kontrolliere beim erneuten Öffnen, dass die Kopie ohne Passwort zugänglich ist.'
  ], 'Ungeschützte PDF-Kopie.', 'Das Werkzeug errät oder knackt keine unbekannten Passwörter. Die ungeschützte Ausgabe benötigt entsprechend sorgfältige Aufbewahrung und Weitergabe.'),
  'invoice-read': guide('UBL- oder CII-Rechnungs-XML, eine UBL-Gutschrift oder eine PDF mit eingebetteter Rechnungs-XML.', [
    'Öffne die XML oder die hybride Rechnungs-PDF und wähle gegebenenfalls die gewünschte eingebettete Rechnung.',
    'Lies Parteien, Positionen und Summen in der übersichtlichen Darstellung.',
    'Speichere eine Lese-PDF, die unveränderte XML oder eine CSV-Ausgabe für die weitere Bearbeitung.'
  ], 'Lesbare Rechnungsdarstellung, Lese-PDF, Original-XML oder CSV.', 'Die Lese-PDF enthält die Original-XML, ist aber keine automatisch zertifizierte PDF/A- oder ZUGFeRD-Datei. Das Anzeigen einer Rechnung ist noch keine vollständige Validierung.'),
  'invoice-check': guide('Eine unterstützte strukturierte E-Rechnung als XML oder PDF-Anhang.', [
    'Öffne die Rechnung und starte den Basischeck.',
    'Prüfe Hinweise zu grundlegenden Angaben, Datumsformaten und Summen.',
    'Exportiere den Bericht. Für eine weitergehende XRechnungs-Prüfung nutze „XRechnung vollständig validieren“.'
  ], 'Basis-Prüfbericht mit ausgewählten Auffälligkeiten.', 'Der Browsercheck umfasst nicht sämtliche Normregeln und sagt nichts über Echtheit oder sachliche Richtigkeit des Geschäftsvorfalls aus.'),
  'fill-form': guide('Eine PDF mit interaktiven Formularfeldern.', [
    'Wähle Felder in der Seitenvorschau oder Feldliste und trage die gewünschten Werte ein.',
    'Kontrolliere Pflichtfelder, Auswahllisten, Checkboxen und die sichtbare Darstellung langer Texte.',
    'Speichere die Datei weiterhin ausfüllbar oder fixiere die eingetragenen Werte für die Ausgabe.'
  ], 'Ausgefüllte PDF mit interaktiven oder festgeschriebenen Formularwerten.', 'Ein Scan ohne echte Felder ist kein ausfüllbares Formular. Für solche Dateien nutze „Formular erstellen“ oder „Formularfelder erkennen“. Bearbeitet wird die vollständige Quelldatei.'),
  'create-form': guide('Eine PDF als Formularvorlage.', [
    'Wähle einen Feldtyp und ziehe den Feldbereich auf der gewünschten Seite auf.',
    'Lege eindeutige Feldnamen, Eigenschaften, Auswahlwerte und gegebenenfalls Pflichtangaben fest. Passe Position und Größe an.',
    'Speichere das Formular und teste es mit „Formular ausfüllen“ sowie im vorgesehenen PDF-Programm.'
  ], 'PDF mit neu angelegten oder bearbeiteten interaktiven Formularfeldern.', 'Feldnamen sind besonders für Serienformulare und Rücklaufauswertungen wichtig. Unterschiedliche PDF-Programme können Formulare verschieden darstellen. Die vollständige Quelldatei wird gespeichert.'),
  'bookmarks': guide('Eine PDF, die eine Kapitelstruktur erhalten soll.', [
    'Lade vorhandene Lesezeichen und ergänze oder ändere ihre Titel.',
    'Ordne jedem Eintrag die richtige Zielseite zu und rücke Unterkapitel passend ein.',
    'Speichere die vollständige Datei und teste die Navigation in einem PDF-Programm.'
  ], 'PDF mit aktualisierter Lesezeichenstruktur.', 'Lesezeichen sind Navigationspunkte im PDF-Programm, kein gedrucktes Inhaltsverzeichnis. Wenn du sichtbare Verzeichnisseiten brauchst, nutze „Deckblatt & Inhaltsverzeichnis“.'),
  'extract-images': guide('Eine PDF mit eingebetteten Bildobjekten.', [
    'Wähle das Dokument und die zu untersuchenden Seiten.',
    'Starte die Bildextraktion.',
    'Entpacke die PNG-Dateien und prüfe, welche Bildbestandteile der PDF tatsächlich enthalten waren.'
  ], 'ZIP mit einzeln extrahierten PNG-Bildern.', 'Grafiken aus Vektorobjekten sind keine eingebetteten Bilder. Manche PDFs zerlegen ein sichtbares Bild in mehrere Objekte. Für komplette Seitenbilder nutze „PDF zu Bildern“.'),
  'inspect': guide('Eine oder mehrere PDFs als gemeinsames Dokumentenpaket.', [
    'Öffne „Check & Seitenfinder“ und prüfe Hinweise auf Scanseiten, mögliche Leerseiten, optisch gleiche Seiten und unterschiedliche Formate.',
    'Suche dateiübergreifend nach Begriffen. Für Scans starte die Texterkennung; mehrere kommagetrennte Begriffe werden als Oder-Suche behandelt, jeweils ab zwei Zeichen.',
    'Prüfe die Trefferseiten, passe die Auswahl an und speichere die Auswahl als PDF.'
  ], 'Dokumentenübersicht und neue PDF aus ausgewählten beziehungsweise gefundenen Seiten.', 'Leerseiten und Duplikate sind Hinweise, keine automatische Löschentscheidung. Der lokale Suchindex macht die Original-PDF nicht dauerhaft durchsuchbar; dafür „OCR & Text“ verwenden. Ausstehende Änderungen zuerst anwenden, wenn sie Grundlage der Prüfung sein sollen.'),
  'ocr': guide('Gescannte PDFs, Bilder oder PDFs mit unzureichendem Suchtext.', [
    'Wähle die Seiten und eine der 21 Erkennungssprachen. Über „Sprachen kombinieren“ sind bis zu acht Sprachen gleichzeitig möglich. Wähle den Seitenaufbau und erzwinge OCR nur, wenn vorhandener Text neu erkannt werden soll.',
    'Optional „Sprachen automatisch ermitteln“ aktivieren. Eine lokale Probe wählt pro Scan-Seite passende Modelle. Kurze, unscharfe oder mehrdeutige Texte erfordern eine manuelle Auswahl; die Probe braucht zusätzlichen Arbeitsspeicher.',
    'Starte die Erkennung und vergleiche den Text mit der Seitenvorschau. Korrigiere insbesondere Zahlen, Namen und Lesereihenfolge.',
    'Speichere eine durchsuchbare PDF, TXT oder DOCX. Übernimm die PDF als Arbeitsdokument, wenn weitere textbasierte Werkzeuge folgen sollen.'
  ], 'PDF mit Suchtext oder Textausgabe als TXT/DOCX.', 'DOCX enthält den erkannten Text ohne Rekonstruktion des ursprünglichen Layouts. Handschrift, Spalten und unscharfe Scans sind besonders fehleranfällig. Große OCR-Aufträge können auf Smartphones länger dauern.'),
  'images': guide('JPG- oder PNG-Dateien, auch gemeinsam mit PDFs.', [
    'Ziehe die Bilder in die App oder wähle sie über die Dateiauswahl.',
    'Kontrolliere in der Seitenübersicht Reihenfolge und Ausrichtung. Wähle nur die Seiten aus, die in die Ausgabe sollen.',
    'Erstelle die PDF und kontrolliere ihre Seiten.'
  ], 'PDF mit proportional auf A4 eingepassten Bildern.', 'Das Bild wird nicht automatisch als Text erkannt. Wenn du danach suchen oder Text kopieren möchtest, führe zusätzlich OCR aus.'),
  'to-images': guide('Eine PDF mit den zu exportierenden Seiten.', [
    'Wähle in der Seitenübersicht die gewünschten Seiten aus.',
    'Stelle JPG oder PNG ein und starte den Export.',
    'Entpacke das ZIP und prüfe Auflösung, Dateinamen und Reihenfolge.'
  ], 'Ein Bild pro ausgewählter Seite im ZIP.', 'Die Bilddateien enthalten die sichtbare Seitendarstellung, keine interaktiven Felder, Links oder kopierbare Textebene. PNG eignet sich häufig für scharfe Schrift, JPG für kompakte Fotodarstellungen.'),
  'compress': guide('Vorwiegend bildbasierte PDFs, beispielsweise eingescannte Briefe.', [
    'Wähle die Seiten und die Komprimierung: „Sanft“ für hohe Bildqualität, „Ausgewogen“ als Mittelweg oder „Möglichst klein“ für stärkere Komprimierung.',
    'Starte die Komprimierung mit reduzierter Auflösung und JPEG-Bildern.',
    'Vergleiche Größe und Lesbarkeit mit dem Original. Probiere bei schlecht lesbarer Kleinschrift eine höhere Qualität.'
  ], 'PDF mit komprimierten Seitenbildern.', 'Die Datei wird nicht in jedem Fall kleiner. Text, Links und Formularfunktionen werden bei der Bildausgabe nicht erhalten. Für strukturwahrende Optimierung zuerst „PDF auf Wunschgröße komprimieren“ ausprobieren.'),
  'merge': guide('Mehrere PDFs und gegebenenfalls JPG-/PNG-Bilder.', [
    'Öffne alle Dateien im selben Arbeitsbereich.',
    'Ordne die Seiten in der gewünschten Reihenfolge an und wähle die benötigten Seiten aus.',
    'Klicke auf „Zusammenfügen“, kontrolliere das Ergebnis und lade die gemeinsame PDF herunter.'
  ], 'Eine PDF aus den ausgewählten Seiten.', 'Dokumentweite Eigenschaften wie Anhänge, ursprüngliche Lesezeichen und Signaturen werden durch eine Seitenzusammenstellung nicht zuverlässig erhalten. Bewahre die Originaldateien auf.'),
  'split': guide('Eine PDF, deren Seiten einzeln gespeichert werden sollen.', [
    'Öffne die Datei und wähle die zu exportierenden Seiten.',
    'Kontrolliere die aktuelle Reihenfolge und starte „Einzelseiten erstellen“.',
    'Lade das ZIP herunter und entpacke die einzelnen PDFs.'
  ], 'Eine eigene PDF pro ausgewählter Seite im ZIP.', 'Für mehrere Seiten pro Teildokument nutze „In Abschnitte teilen“. Für ein Größenlimit verwende „Nach Dateigröße teilen“.'),
  'organize': guide('Eine oder mehrere PDFs im Arbeitsbereich.', [
    'Wechsle in die Seitenübersicht. Verschiebe Seiten per Ziehen oder mit den Pfeilen.',
    'Drehe, dupliziere oder entferne Seiten und ergänze bei Bedarf Leerseiten. Prüfe, welche Seiten für den Export ausgewählt sind.',
    'Speichere die Seiten als neue PDF und kontrolliere Reihenfolge sowie Seitenzahl.'
  ], 'Neu zusammengestellte PDF.', 'Das Abwählen einer Seite schließt sie vom Export aus; deine Quelldatei auf dem Gerät bleibt unverändert. Visuelle Bearbeitungen vor dem nachträglichen Drehen anwenden und das Ergebnis übernehmen.'),
  'numbers': guide('Eine PDF oder eine vorbereitete Seitenzusammenstellung.', [
    'Bringe die Seiten zuerst in die endgültige Reihenfolge und wähle die zu nummerierenden Seiten aus.',
    'Lege die erste Seitennummer fest.',
    'Starte das Nummerieren und prüfe die unteren Seitenränder im Ergebnis.'
  ], 'PDF mit unten mittig ergänzten Seitennummern.', 'Nummeriert wird die aktuelle Reihenfolge der ausgewählten Seiten. Bereits gedruckte Seitennummern werden nicht erkannt oder entfernt; achte auf mögliche Überlagerungen.'),
  'resize': guide('PDF-Seiten mit unterschiedlichen oder unpassenden Papierformaten.', [
    'Wähle die betreffenden Seiten.',
    'Stelle das Zielseitenformat A4 oder US Letter und Hoch- oder Querformat ein.',
    'Erstelle die neue PDF und prüfe Inhalt und Ränder.'
  ], 'PDF mit proportional in das gewählte Format eingepassten Seiten.', 'Die Inhalte bleiben vollständig erhalten, können aber kleiner werden. Für das Entfernen von Außenbereichen nutze „Zuschneiden“.'),
  'nup': guide('Mehrere PDF-Seiten, die gemeinsam auf ein Blatt passen sollen.', [
    'Wähle die Seiten und kontrolliere ihre Reihenfolge.',
    'Stelle zwei oder vier Seiten pro Blatt ein.',
    'Erstelle die Ausgabe und kontrolliere die Lesbarkeit, bevor du sie druckst.'
  ], 'PDF mit mehreren verkleinerten Dokumentseiten auf einem Ausgabeblatt.', 'Kleine Schrift wird entsprechend kleiner. Eine gefaltete Druckbroschüre benötigt eine andere Seitenreihenfolge; dafür gibt es „Broschüre erstellen“.'),
  'edit-text': guide('Eine PDF mit digitalem Text, vorhandener OCR-Ebene, gescannten Seiten oder einer Mischung daraus.', [
    'Öffne „PDF bearbeiten“. Die Seite wird sofort vorbereitet. Vorhandene Texte sind zuerst auswählbar; Scans und größere Bildbereiche werden automatisch lokal erkannt. Kleine Logos lösen bei vorhandenen Texten keine zusätzliche OCR aus.',
    'Klicke einen Absatz an und schreibe direkt auf der PDF. Markieren, Einfügen und Zeilenumbrüche funktionieren im Textfeld. „Einzelne Textstellen“ trennt die Auswahl bei Bedarf. Verschiebe das Feld am Griff und ändere Schrift, Punktgröße, Fett/Kursiv und Farbe in der Leiste. Orange markierte Wörter müssen am Original geprüft werden.',
    'Für andere Dokumentsprachen wähle „Sprache gescannter Texte“. Mit „Text erneut erkennen“ lässt sich auch eine fehlerhafte vorhandene OCR-Ebene neu aufbauen. „Erkennung anhalten“ stoppt die Vorbereitung; vorhandene Texte und manuelle Bearbeitung bleiben verfügbar.',
    'Erstelle die bearbeitete PDF. Auch ohne Textänderung kannst du Scans als durchsuchbare PDF exportieren. Beim Export werden alle ausgewählten Seiten nacheinander vorbereitet; beim Wiederbesuch werden bereits erkannte Seiten wiederverwendet.',
    'Prüfe die Ausgabe und eventuelle Hinweise. Über „Ergebnis übernehmen“ oder durch erneutes Öffnen kannst du weiterbearbeiten. Bei nicht erkannten Bereichen bleiben „Bereich ersetzen“ und „Neuer Text“ verfügbar.'
  ], 'PDF mit ersetzten oder ergänzten Texten und einer kopierbaren Suchtextebene für erkannte, unveränderte Inhalte. Reine OCR-Ergänzungen verändern das Seitenbild nicht.', 'Keine Garantie für jede PDF oder fehlerfreie OCR. Es gelten 80 MB und 200 Seiten pro Datei. Eingebettete Originalschriften werden verwendet, wenn sie wiederverwendbar sind und alle neuen Zeichen enthalten; nötiger Schriftersatz wird angezeigt. 14 lokale Schriftfamilien mit je vier Schnitten stehen bereit. Bei Scans sind Schrift und Größe geschätzt. Absätze umbrechen innerhalb ihres Textfelds; es gibt keinen dokumentweiten Word-Seitenfluss. Bei bestätigter Originalobjekt-Bearbeitung bleiben übrige Texte und Grafiken als Vektoren erhalten. Andernfalls wird der Hintergrund als Bild aufgebaut und dies gemeldet; Links und Formulare können dabei entfallen. Überlauf oder Überlappung mit anderen Texten blockiert den Export. Für komplexe Schriftformung und gemischte Formatbereiche steht „PDF-Objekte bearbeiten“ bereit. Passwortgeschützte PDFs benötigen das richtige Passwort; Handschrift, schlechte Scans und beschädigte Dateien können manuelle Korrekturen erfordern. Digitale Signaturen werden durch Änderungen ungültig.'),
  'erase': guide('Eine PDF mit zu entfernenden Text- oder Bildbereichen.', [
    'Öffne die betreffende Seite und markiere den Bereich genau.',
    'Wähle eine passende Füllfarbe und korrigiere Größe und Position bei Bedarf über die Koordinaten.',
    'Erstelle die bereinigte PDF und kontrolliere, dass angrenzende Inhalte unbeschädigt bleiben.'
  ], 'PDF mit neu aufgebauten betroffenen Seiten ohne den markierten Inhalt.', 'Entfernte Originalinhalte werden nicht rekonstruiert. Auf betroffenen Seiten können die ursprüngliche Textebene, Links und Formularfelder entfallen. Für erkennbar vertrauliche Bereiche ist „Schwärzen“ meist die passendere Darstellung.'),
  'insert-image': guide('Eine PDF und ein Bild oder Logo.', [
    'Wähle das Bild und die gewünschte PDF-Seite.',
    'Platziere das Bild, verschiebe es an die richtige Stelle und skaliere es proportional. Nutze bei Bedarf die Positionsfelder.',
    'Erstelle die PDF mit Bildern und prüfe Größe, Bildqualität und Überlagerungen.'
  ], 'PDF mit eingefügten Bildern.', 'Das Einfügen eines Bildes entfernt darunterliegenden Text nicht. Verwende zum sicheren Entfernen von Inhalten ein dafür vorgesehenes Werkzeug.'),
  'redact': guide('Eine PDF mit vertraulichen Bereichen.', [
    'Ziehe auf jeder betroffenen Seite einen Rahmen über den vollständigen zu entfernenden Bereich.',
    'Prüfe die Markierungen in ausreichender Vergrößerung. Ergänze weitere Stellen, einschließlich Kopf- und Fußzeilen.',
    'Erstelle die geschwärzte PDF und kontrolliere genau diese Ausgabedatei vor der Weitergabe.'
  ], 'PDF mit entfernten vertraulichen Bereichen in neu erzeugten Seitenbildern.', 'Betroffene Seiten verlieren ihre ursprüngliche Textebene und interaktive Funktionen. Die Originaldateien bleiben ungeschwärzt. Für viele wiederkehrende Begriffe kann „Suchen & schwärzen“ helfen; auch dessen Treffer müssen kontrolliert werden.'),
  'crop': guide('Eine PDF, aus deren Seiten nur ein bestimmter Ausschnitt erhalten bleiben soll.', [
    'Wähle die Seite und ziehe den gewünschten Ausschnitt in der Vorschau auf.',
    'Passe den Rahmen bei Bedarf über Prozentwerte an; einen falschen Ausschnitt kannst du zurücksetzen.',
    'Erstelle die zugeschnittene PDF und kontrolliere die Ränder jeder bearbeiteten Seite.'
  ], 'PDF mit neu gerenderten Ausschnitten.', 'Inhalte außerhalb des Ausschnitts werden aus den betroffenen Ausgabeseiten entfernt. Die ursprüngliche Textebene entfällt. Für gleich große Rasterausschnitte gibt es „Seiten aufteilen“ mit anderem Exportverhalten.'),
  'annotate': guide('Eine PDF, die Notizen oder Hervorhebungen erhalten soll.', [
    'Wähle Text oder Marker. Gib für eine Textnotiz den Inhalt ein und stelle die Schriftgröße ein.',
    'Platziere Notizen beziehungsweise ziehe Markierungen auf der Seite auf. Kontrolliere die aufgeführten Änderungen.',
    'Wende die Änderungen an und lade die neue PDF herunter.'
  ], 'PDF mit sichtbaren Notizen oder Markierungen.', 'Eine Hervorhebung ist keine Schwärzung. Reine Notizen und Markierungen erhalten vorhandenen Text, sollen ihn aber nicht vertraulich entfernen.'),
  'sign': guide('Eine PDF, die eine gezeichnete Unterschrift als sichtbares Bild erhalten soll.', [
    'Klicke auf „Unterschrift zeichnen“ und unterschreibe mit Maus oder Finger.',
    'Übernimm die Zeichnung und platziere sie auf der passenden Seite. Prüfe Position und Größe.',
    'Erstelle die PDF mit Unterschrift und kontrolliere die Ausgabe.'
  ], 'PDF mit eingefügtem Unterschriftsbild.', 'Das ist keine kryptografische Zertifikatssignatur. Für Signieren mit einem PKCS#12-Zertifikat verwende „Zertifikatssignaturen“.'),
  'watermark': guide('PDF-Seiten, die einen sichtbaren Hinweis wie „ENTWURF“ erhalten sollen.', [
    'Wähle die betroffenen Seiten und gib den Wasserzeichentext ein.',
    'Starte das Hinzufügen des transparenten Texthinweises.',
    'Prüfe, ob das mittig platzierte Wasserzeichen auf hellen und dunklen Seiten gut lesbar ist.'
  ], 'PDF mit transparentem Wasserzeichentext.', 'Ein Wasserzeichen ist ein sichtbarer Hinweis, kein Kopierschutz. Für einen kompakteren Hinweis mit Datum und wählbarer Position nutze „Stempel hinzufügen“.'),
  'grayscale': guide('Farbige PDF-Seiten.', [
    'Wähle die gewünschten Seiten.',
    'Starte die Umwandlung in Graustufen.',
    'Prüfe farbige Diagramme, Hervorhebungen und Stempel darauf, ob sie in Grau noch unterscheidbar sind.'
  ], 'PDF mit grauen Seitenbildern.', 'Suchtext, Links und interaktive Formularfelder werden nicht übernommen. Falls Suchtext benötigt wird, anschließend OCR ausführen. Für ausschließlich schwarze und weiße Pixel nutze „Schwarzweiß-Scan“.'),
  'flatten': guide('Eine PDF, deren sichtbare Seiten als feste Bilder ausgegeben werden sollen.', [
    'Kontrolliere zunächst, ob alle sichtbaren Formularwerte und Anmerkungen korrekt dargestellt werden.',
    'Wähle die Seiten und starte „PDF fixieren“.',
    'Öffne die Ausgabe und prüfe Schrift, Bilder und ausgefüllte Felder.'
  ], 'PDF mit festen Seitenbildern.', 'Textebenen, Links und interaktive Formularfelder entfallen. Fixieren macht eine Datei nicht grundsätzlich unveränderbar: Bilder lassen sich bearbeiten und Text kann später erneut per OCR erkannt werden.'),
  'metadata': guide('Eine PDF, deren Dokumenteigenschaften entfernt werden sollen.', [
    'Prüfe die angezeigten Dokumentinfos wie Titel, Autor und Ersteller.',
    'Starte das Entfernen von Dokumentinfos.',
    'Kontrolliere die Eigenschaften der neu erzeugten PDF.'
  ], 'PDF ohne die entfernten Titel-, Autor-, Betreff-, Stichwort-, Ersteller-, Datums- und XMP-Dokumentinfos.', 'Sichtbare Namen, Kommentare, Bilder, Anhänge und eingebettete Objektdaten werden dadurch nicht anonymisiert. Prüfe diese bei Bedarf mit den passenden Bearbeitungswerkzeugen.'),
  'compare': guide('Zwei PDF-Fassungen mit auslesbarem Text.', [
    'Öffne beide Dateien und wähle Datei A und Datei B.',
    'Wähle „Seiten an gleicher Position“ oder „Inhalte über Seiten hinweg“. Der Inhaltsmodus ordnet Textblöcke auch nach eingefügten oder verschobenen Seiten zu und zeigt Änderungen auf Wortebene.',
    'Prüfe die betreffenden Stellen im Original. Bei Scans zuerst OCR ausführen und die Ergebnisse öffnen.'
  ], 'Vergleichsbericht mit Änderungen, Fundseiten und vollständigem TXT-Download. Unveränderte Textblöcke lassen sich einblenden.', 'Die Zuordnung nutzt vorhandenen Text, keine KI-Bedeutungsprüfung. Mehrfach vorkommende und uneindeutige Texte bitte prüfen; unsichere Treffer bleiben als entfernt/hinzugefügt sichtbar. Leerzeichen und Zeilenumbrüche werden vereinheitlicht. Pro Datei bis zu 200 Seiten, zwei Millionen Textzeichen und 5.000 Textblöcke. Bilder, Layout und reine Scanänderungen werden nicht geprüft. Für diese Fälle nutze „Visueller PDF-Vergleich“; für Beträge und Kennnummern eignet sich ergänzend „Zahlenvergleich“.'),
  'pdf-info': guide('Eine oder mehrere geöffnete PDFs.', [
    'Wähle Seiten aus den Dateien, zu denen du Informationen benötigst.',
    'Erstelle den Bericht über die vollständigen zugehörigen Originaldateien.',
    'Prüfe Metadaten, Dateigröße, PDF-Version und Seitenformate und speichere den Bericht bei Bedarf als TXT.'
  ], 'Lesbarer Informationsbericht und TXT-Export.', 'Dies ist eine Bestandsaufnahme, keine vollständige technische oder inhaltliche Validierung. Ausstehende Bearbeitungen sind noch nicht Bestandteil der Originaldatei.'),
  'attachments': guide('Eine PDF mit eingebetteten Dateianhängen, etwa Rechnungs-XML.', [
    'Öffne die Datei und wähle mindestens eine Seite der betreffenden Quelle.',
    'Starte die Extraktion der eingebetteten Anhänge.',
    'Entpacke das ZIP und prüfe die enthaltenen Dateinamen und Formate.'
  ], 'ZIP mit den eingebetteten Dateien aus den betreffenden Original-PDFs.', 'Bilder auf einer Seite sind keine Dateianhänge. Die Extraktion validiert keine Rechnungsdaten; dafür nutze die E-Rechnungswerkzeuge.'),
  'split-ranges': guide('Eine PDF mit bekannten Abschnittsgrenzen.', [
    'Wähle eine feste Seitenanzahl je Datei oder eigene Seitenbereiche.',
    'Trage Bereiche zum Beispiel als 1-3; 4-6; 7,9 ein. Semikolons trennen die Ausgabedokumente.',
    'Erstelle die Teildokumente und prüfe Seitenzahl und Inhalt jedes Teils.'
  ], 'Mehrere PDFs im ZIP.', 'Bereiche beziehen sich auf die gewählte Seitenzusammenstellung. Kontrolliere Überschneidungen und ausgelassene Seiten. Für automatisch erkannte Grenzen nutze „Intelligent teilen“.'),
  'interleave': guide('Zwei PDFs, etwa getrennt gescannte Vorder- und Rückseiten.', [
    'Öffne beide Dateien und wähle sie als Datei A und Datei B.',
    'Aktiviere „Datei B rückwärts“, wenn die Rückseiten in umgekehrter Reihenfolge gescannt wurden.',
    'Erstelle und kontrolliere die Ausgabe: A1, B1, A2, B2 und so weiter.'
  ], 'PDF mit abwechselnd eingefügten Seiten beider Quellen.', 'Zusätzliche Seiten einer längeren Datei werden am Ende angehängt. Prüfe insbesondere Anfang und Ende, damit Vorder- und Rückseiten richtig zusammengehören.'),
  'booklet': guide('Eine PDF, die als gefaltete Broschüre gedruckt werden soll.', [
    'Wähle die Seiten in ihrer normalen Lesereihenfolge.',
    'Erstelle die Broschüre. Fehlende Seiten bis zum nächsten Vielfachen von vier werden als Leerseiten ergänzt.',
    'Drucke beidseitig im Querformat, wende an der kurzen Kante und falte mittig. Prüfe vorher mit wenigen Blättern die Druckereinstellungen.'
  ], 'PDF mit für die Faltung angeordneten Druckbögen.', 'Die Ausgabe ist absichtlich nicht in gewöhnlicher Lesereihenfolge. Eine zusätzliche Broschürenanordnung im Druckdialog würde die Seiten erneut umsortieren.'),
  'split-grid': guide('PDF-Seiten, die in gleich große Teilflächen zerlegt werden sollen.', [
    'Wähle die Seiten und die Aufteilung in zwei, vier oder neun Ausschnitte.',
    'Erstelle die Ausschnitte und kontrolliere ihre Reihenfolge: von links nach rechts, dann von oben nach unten.',
    'Prüfe die Ausgabe auf passend liegende Trennkanten.'
  ], 'PDF mit den einzelnen Rasterausschnitten als Seiten.', 'Maximal 200 Ausgabeseiten. Die Ausschnitte werden visuell beschnitten; vertrauliche Inhalte werden dadurch nicht sicher aus der Datei entfernt. Dafür „Schwärzen“ oder das entsprechende Zuschneidewerkzeug verwenden.'),
  'auto-crop': guide('PDF-Seiten mit weitgehend weißen Außenrändern.', [
    'Wähle die zu bearbeitenden Seiten und den Randabstand, der erhalten bleiben soll.',
    'Starte die Erkennung und Entfernung weißer Ränder.',
    'Kontrolliere besonders Seiten mit Randnotizen, Seitenzahlen oder sehr heller Schrift.'
  ], 'PDF mit automatisch zugeschnittenen Seitenrändern.', 'Flecken, Schatten und farbige Hintergründe können die Erkennung begrenzen. Vollständig weiße Seiten behalten ihr Format. Prüfe sensible Inhalte mit einem dafür vorgesehenen Schwärzungswerkzeug.'),
  'bilevel': guide('Scans, die ausschließlich schwarze und weiße Pixel enthalten sollen.', [
    'Wähle die Seiten und stelle den Schwellenwert ein.',
    'Erstelle die Schwarzweiß-Ausgabe. Höhere Werte machen mehr Bildbereiche schwarz.',
    'Kontrolliere feine Linien, blasse Stempel und Handschrift; passe den Wert bei Informationsverlust an.'
  ], 'PDF mit reinen Schwarzweiß-Seitenbildern.', 'Grautöne und Farben gehen verloren. Suchtext, Links und interaktive Felder werden nicht übernommen; bei Bedarf anschließend OCR anwenden.'),
  'invert': guide('PDF-Seiten, deren Farben umgekehrt werden sollen.', [
    'Wähle die gewünschten Seiten.',
    'Starte das Umkehren aller Seitenfarben.',
    'Prüfe Lesbarkeit, Bilder und farbige Kennzeichnungen im Ergebnis.'
  ], 'PDF mit invertierten Seitenbildern, etwa heller Schrift auf dunklem Grund.', 'Die Farbumkehr betrifft sämtliche sichtbaren Inhalte. Kopierbarer Text, Links und interaktive Felder werden bei der Bildausgabe nicht übernommen.'),
  'stamp': guide('PDF-Seiten für einen sichtbaren Statushinweis.', [
    'Gib den Stempeltext und optional ein Datum ein.',
    'Wähle die angebotene Position und die zu bearbeitenden Seiten.',
    'Erstelle die Ausgabe und kontrolliere, dass keine wichtigen Inhalte verdeckt sind.'
  ], 'PDF mit sichtbarem Textstempel.', 'Bestehende Texte bleiben kopierbar. Ein Stempel ist keine digitale Signatur und bestätigt weder Echtheit noch Integrität des Dokuments.'),
  'edit-metadata': guide('Eine PDF, deren Dokumenteigenschaften angepasst werden sollen.', [
    'Trage Titel, Autor, Betreff und Stichwörter in die Felder ein.',
    'Prüfe bewusst leer gelassene Felder; diese Angaben werden in der Ausgabe geleert.',
    'Speichere die Metadaten und kontrolliere die Dokumenteigenschaften der neuen Datei.'
  ], 'PDF mit geänderten Dokumenteigenschaften.', 'Die sichtbaren Inhalte ändern sich dadurch nicht. Ein Autorenfeld ist frei bearbeitbare Metadaten und kein verlässlicher Herkunftsnachweis.'),
  'remove-annotations': guide('Eine PDF mit echten Kommentaren oder Hervorhebungs-Anmerkungen.', [
    'Wähle die zu bereinigenden Seiten.',
    'Entscheide, ob zusätzlich Links entfernt werden sollen, und starte die Bereinigung.',
    'Kontrolliere die Ausgabe auf verbleibende sichtbare Markierungen und benötigte Verweise.'
  ], 'PDF ohne die ausgewählten Anmerkungstypen.', 'In den Seiteninhalt eingebrannte Markierungen bleiben erhalten. Ausgefüllte Formularwerte werden als feste Inhalte übernommen. Sichere benötigte Kommentare vorher mit dem Arbeitslistenexport.'),
  'overlay': guide('Eine Basis-PDF und eine PDF mit einer Vorlagenseite, etwa Briefpapier.', [
    'Wähle Basis und Vorlage sowie die betreffenden Seiten.',
    'Lege fest, ob die Vorlage davor oder dahinter liegen soll, und stelle ihre Deckkraft ein.',
    'Erstelle die Überlagerung und prüfe Ausrichtung sowie Lesbarkeit.'
  ], 'PDF mit der proportional aufgelegten ersten ausgewählten Vorlagenseite auf den ausgewählten Basisseiten.', 'Ein weißer Hintergrund der Basis kann eine dahinterliegende Vorlage verdecken. Eine Überlagerung entfernt vorhandene Inhalte nicht vertraulich.'),
};

// Local expansion: keep the established guide text and describe the additional mode explicitly.
guides['office-pdf'].steps.unshift('Standardmäßig lokal im Browser konvertieren. Den eigenen Dokumentenserver bei Bedarf ausdrücklich auswählen.');
guides['office-pdf'].note = 'Lokal: Word, Excel, PowerPoint, OpenDocument und RTF bis 40 MB. Etwa 75 MB Programmdaten werden beim ersten Start geladen; benötigt HTTPS, isolierten Browser-Speicher und mehr als 1 GB freien Arbeitsspeicher. Nur Programmdaten werden zwischengespeichert. Schriften, Umbrüche, Bilder und Formeln nach dem Export kontrollieren. Pages, Visio und Publisher benötigen den Dokumentenserver.';
guides['certificate-sign'].steps.unshift('Für eine einfache Zertifikatssignatur „Mit Zertifikat signieren“ und „Lokal im Browser“ auswählen.');
guides['certificate-sign'].note += ' Im lokalen Modus bleiben Zertifikat und Passwort auf deinem Gerät. Unterstützt werden moderne PKCS#12-Dateien mit PBES2/AES und einem RSA-Schlüssel ab 2048 Bit. Bereits signierte PDFs und XFA werden abgewiesen. Die lokale CMS-Signatur enthält keinen Zeitstempel und bestätigt weder Vertrauenskette noch qualifizierten Status.';
guides['fill-form'].note += ' Für einfache reine XFA-Formulare steht ein separater Dateneditor bereit. Er erhält die Vorlagenpakete und prüft gespeicherte Werte durch Rücklesen. Dynamische Berechnungen, Skripte und hybride Formulare werden abgewiesen; die Darstellung in einer XFA-fähigen Anwendung kontrollieren.';

guides['native-objects'].steps.push('Unter „Mehrere Objekte“ ausrichten, verteilen, spiegeln, duplizieren oder aufeinanderfolgende Objekte gruppieren. Im Absatzmodus stehen lokale Schriften, Schreibrichtung, Browser-Rechtschreibprüfung, Listen und Suchen/Ersetzen bereit. Formatbereiche erlauben Hoch- und Tiefstellen.');

guides['native-objects'].steps.push('Für indische und südostasiatische Schriften „Passende Schriften automatisch ergänzen“ eingeschaltet lassen oder eine passende statische TTF wählen. Gruppen im Einzelobjektmodus öffnen, das Unterobjekt ändern und mit „Eine Ebene zurück“ zurückkehren.');
