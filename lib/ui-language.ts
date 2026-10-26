export type Language = 'de' | 'en';

export const english: Record<string, string> = {
  'Vorder- und Rückseiten aus zwei Dateien oder zwei Blöcken einer PDF abwechselnd kombinieren.':
    'Alternate fronts and backs from two files or two blocks within one PDF.',
  'Seiten zuschneiden: Randinhalt entfernen oder den sichtbaren Bereich mit Texterhalt ändern.':
    'Crop pages: remove margins or change the visible area while preserving text.',
  'Die Formularfreigabe konnte nicht bestätigt werden.':
    'The form field unlock could not be verified.',
  'Bitte 2 bis 200 Seiten für die Duplex-Sortierung auswählen.':
    'Please select 2 to 200 pages for duplex collation.',
  'Die Trennstelle muss zwischen der ersten und letzten ausgewählten Seite liegen.':
    'The split must fall between the first and last selected pages.',

  'Farben & Hintergrund ändern': 'Change colors & background',
  'Text und Hintergrund umfärben oder Helligkeit, Kontrast und Sättigung ganzer Seiten mit Vorschau anpassen.':
    'Recolor text and background, or adjust page brightness, contrast and saturation with a preview.',
  'Farben anpassen': 'Adjust colors',
  Farbmodus: 'Color mode',
  'Text & Hintergrund – Text erhalten': 'Text & background – preserve text',
  'Gesamte Seite als Bild': 'Whole page as an image',
  Farbvorlagen: 'Color presets',
  Lesefreundlich: 'Easy reading',
  'Schwarz auf Weiß': 'Black on white',
  'Graustufen-Druck': 'Grayscale print',
  Farbeinstellungen: 'Color settings',
  'Textfarbe ändern': 'Change text color',
  'Hintergrund ergänzen': 'Add background',
  Farbvorschau: 'Color preview',
  'Farbvorschau wird erstellt …': 'Preparing color preview …',
  'Farben auf alle Seiten anwenden': 'Apply colors to all pages',
  'Dokumenttext bleibt erhalten. Bilder, Formularfelder und Kommentare werden nicht umgefärbt. Der Hintergrund liegt hinter dem vorhandenen Inhalt.':
    'Document text is preserved. Images, form fields and comments are not recolored. The background sits behind existing content.',
  'Alle Seiten wurden als Bilder ausgegeben. Textsuche, Formularfelder und Links sind im Ergebnis nicht mehr verfügbar.':
    'All pages are output as images. Text search, form fields and links are no longer available in the result.',
  'Deckende Flächen und Scans können den neuen Hintergrund verdecken. Unsichtbarer OCR-Text bleibt unsichtbar.':
    'Opaque fills and scans may cover the new background. Invisible OCR text stays invisible.',
  'Die Vorschau zeigt eine Seite. Die Ausgabe wendet die Einstellungen auf alle Seiten an. Maximal 200 Seiten und 80 MB.':
    'The preview shows one page. The output applies the settings to all pages. Up to 200 pages and 80 MB.',
  'Schreibgeschützte Formularfelder freigeben': 'Unlock read-only form fields',
  'Wähle die Felder, die in der neuen PDF wieder ausfüllbar sein sollen. Vorhandene Werte bleiben erhalten. Andere Feldregeln und Passwortschutz werden dadurch nicht aufgehoben.':
    'Choose which fields should be editable again in the new PDF. Existing values are kept. Other field rules and password protection remain in place.',
  'Freigaben zurücknehmen': 'Reset unlocked fields',
  'Alle angezeigten Felder freigeben': 'Unlock all listed fields',
  'Freigegebene Felder bleiben ausfüllbar. Die Ausgabe wird nicht festgeschrieben.':
    'Unlocked fields remain fillable. The output is not flattened.',
  'Freigegebene Formularfelder können nicht gleichzeitig festgeschrieben werden.':
    'Unlocked form fields cannot be flattened at the same time.',
  'Scan-Aufteilung': 'Scan arrangement',
  'Vorder- und Rückseiten in zwei Dateien': 'Fronts and backs in two files',
  'Vorder- und Rückseiten in einer Datei': 'Fronts and backs in one file',
  'Trennstelle nach ausgewählter Seite': 'Split after selected page',
  'In der Mitte teilen': 'Split in the middle',
  'Zuerst stehen alle Vorderseiten, danach alle Rückseiten. Die Trennstelle zählt die ausgewählten Seiten in ihrer aktuellen Reihenfolge.':
    'All fronts come first, followed by all backs. The split position counts selected pages in their current order.',
  'Neue Seitenreihenfolge': 'New page order',
  'Die Blöcke sind unterschiedlich lang. Übrige Seiten werden am Ende angehängt. Bitte die Zuordnung prüfen.':
    'The blocks have different lengths. Remaining pages are appended at the end. Please check the pairing.',
  'Rückseitenblock rückwärts': 'Reverse the backs block',
  'Für die Duplex-Sortierung nur Seiten einer Datei auswählen.':
    'Select pages from just one file for duplex collation.',
  Zuschnittmodus: 'Crop mode',
  'Randinhalt dauerhaft entfernen': 'Permanently remove margins',
  'Sichtbaren Ausschnitt ändern · Text erhalten': 'Change visible crop · preserve text',
  'Die Ränder werden nur ausgeblendet. Vertrauliche Inhalte außerhalb des Ausschnitts bleiben in der Datei und können wieder sichtbar gemacht werden.':
    'The margins are only hidden. Confidential content outside the crop remains in the file and can be made visible again.',
  'Text und Vektoren bleiben erhalten. Vorhandene visuelle Änderungen zuerst anwenden. Bei Teilausgaben können dokumentweite Funktionen entfallen.':
    'Text and vectors are preserved. Apply existing visual edits first. Partial exports may lose document-wide features.',
  'Text bleibt erhalten. Ausgeblendete Randinhalte bleiben in der PDF und können wieder sichtbar gemacht werden.':
    'Text is preserved. Hidden margins remain in the PDF and can be made visible again.',
  'Text bleibt erhalten. Ausgeblendete Randinhalte bleiben in der PDF. Bei einer Seitenauswahl werden Formularwerte festgeschrieben; dokumentweite Strukturen können entfallen.':
    'Text is preserved. Hidden margins remain in the PDF. Exporting selected pages flattens form values and may lose document-wide structures.',
  'Sichtbaren Ausschnitt ändern …': 'Changing visible crop …',
  'Textfarben anpassen …': 'Adjusting text colors …',
  'Seitenfarben anpassen …': 'Adjusting page colors …',
  'Ungültige Farbeinstellungen.': 'Invalid color settings.',
  'Bitte höchstens 200 Seiten und 80 MB verwenden.': 'Please use no more than 200 pages and 80 MB.',
  'Ungültige Vorschauseite.': 'Invalid preview page.',
  'Ungültige Farbauswahl.': 'Invalid color selection.',
  'Text mit einer Maskierungsfunktion kann nicht sicher umgefärbt werden.':
    'Text used as a clipping mask cannot be recolored safely.',
  'Dieses Textobjekt kann nicht sicher umgefärbt werden.':
    'This text object cannot be recolored safely.',
  'Die Textfarbe konnte nicht geändert werden.': 'The text color could not be changed.',
  'Das Seitenbild konnte nicht erstellt werden.': 'The page image could not be created.',
  'Text erhaltenden Zuschnitt bitte ohne weitere Seitenmarkierungen ausführen.':
    'Please crop with text preservation without additional page markings.',
  'Bitte zwischen 1 und 200 Seiten auswählen.': 'Please select between 1 and 200 pages.',
  'Ungültige Seitenauswahl.': 'Invalid page selection.',
  'Ungültiger Zuschnitt.': 'Invalid crop.',
  'Eine PDF mit auslesbarem Text oder gescannten Seiten.':
    'A PDF containing readable text or scanned pages.',
  'Öffne „Farben & Hintergrund ändern“. Wähle eine Vorlage oder den Modus „Text & Hintergrund – Text erhalten“. Aktiviere Textfarbe und Hintergrund unabhängig und wähle eigene Farben.':
    'Open “Change colors & background”. Choose a preset or “Text & background – preserve text”. Enable text color and background independently and choose custom colors.',
  'Für Helligkeit, Kontrast und Sättigung wähle „Gesamte Seite als Bild“. Dieser Modus erstellt Bildseiten ohne Textsuche, Formularfelder und Links.':
    'For brightness, contrast and saturation, choose “Whole page as an image”. This mode creates image pages without text search, form fields or links.',
  'Vergleiche Original und Farbvoransicht. Wechsle die Vorschauseite und prüfe auch Bilder und Formulare. „Farben auf alle Seiten anwenden“ erstellt eine neue PDF-Kopie.':
    'Compare the original with the color preview. Switch preview pages and also check images and forms. “Apply colors to all pages” creates a new PDF copy.',
  'PDF mit geänderten Farben; Einstellungen werden im Projekt gespeichert.':
    'PDF with adjusted colors; settings are saved in the project.',
  'Bis zu 200 Seiten und 80 MB. Der Textmodus erhält vorhandene Zeichen und Schriften, auch in unterstützten Objektgruppen; unsichtbarer OCR-Text bleibt unsichtbar. Formularfelder, Kommentare und Bilder werden nicht umgefärbt. Deckende Flächen oder Scans können den ergänzten Hintergrund verdecken. Textmasken, signierte PDFs und dynamische XFA werden abgewiesen. Der Bildmodus rastert alle Seiten mit höchstens rund 4 Megapixeln und 2.800 Pixeln Kantenlänge.':
    'Up to 200 pages and 80 MB. Text mode preserves existing glyphs and fonts, including supported object groups; invisible OCR text stays invisible. Form fields, comments and images are not recolored. Opaque fills or scans may cover the added background. Text clipping masks, signed PDFs and dynamic XFA are rejected. Image mode rasterizes all pages at up to about 4 megapixels and 2,800 pixels per side.',
  'Eine PDF, deren sichtbaren Seitenbereich du verkleinern möchtest.':
    'A PDF whose visible page area you want to reduce.',
  'Wähle eine Seite und ziehe den Ausschnitt auf. Passe ihn bei Bedarf über Prozentwerte an.':
    'Choose a page and draw the crop. Adjust it using percentage values if needed.',
  'Wähle den Zuschnittmodus: „Randinhalt dauerhaft entfernen“ erstellt ein neues Seitenbild; „Sichtbaren Ausschnitt ändern · Text erhalten“ setzt nur den sichtbaren Bereich.':
    'Choose a crop mode: “Permanently remove margins” creates a new page image; “Change visible crop · preserve text” changes only the visible area.',
  'Erstelle die PDF und kontrolliere jede bearbeitete Seite. Vorhandene Markierungen müssen vor dem Text erhaltenden Zuschnitt angewendet werden.':
    'Create the PDF and check every edited page. Apply existing markings before cropping with text preservation.',
  'PDF mit entferntem Randinhalt oder geändertem sichtbaren Bereich, abhängig vom Modus.':
    'PDF with removed margins or a changed visible area, depending on the mode.',
  'Der Text erhaltende Modus ist keine Schwärzung: versteckte Randinhalte bleiben in der Datei und können wieder sichtbar gemacht werden. Bei einer vollständigen einzelnen PDF bleiben Formulare erhalten; Teilausgaben schreiben Formularwerte fest und können dokumentweite Strukturen verlieren. Gedrehte Seiten und vorhandene Ausschnitte werden berücksichtigt. Signierte PDFs und dynamische XFA sind im Textmodus nicht unterstützt. Der bisherige Bildmodus entfernt Randinhalte, verliert aber die Textebene.':
    'Text-preserving mode is not redaction: hidden margins remain in the file and can be made visible again. Forms are retained for one complete PDF; partial exports flatten form values and may lose document-wide structures. Rotated pages and existing crops are respected. Signed PDFs and dynamic XFA are unsupported in text mode. The existing image mode removes margins but loses the text layer.',
  'Zwei PDFs mit Vorder- und Rückseiten oder eine PDF mit zwei aufeinanderfolgenden Scan-Blöcken.':
    'Two PDFs with fronts and backs, or one PDF with two consecutive scan blocks.',
  'Wähle unter „Scan-Aufteilung“ zwei Dateien oder eine Datei. Bei zwei Dateien lege Datei A und B fest.':
    'Under “Scan arrangement”, choose two files or one file. For two files, select files A and B.',
  'Bei einer Datei wähle nur deren gewünschte Seiten. Setze die Trennstelle zwischen Vorder- und Rückseiten oder verwende „In der Mitte teilen“.':
    'For one file, select only its intended pages. Set the split between fronts and backs or use “Split in the middle”.',
  'Kehre bei Bedarf den Rückseitenblock um. Prüfe die angezeigte neue Seitenreihenfolge und erstelle die PDF. Bei ungleich langen Blöcken prüfe die zusätzlich angehängten Seiten.':
    'Reverse the backs block if needed. Check the displayed new page order and create the PDF. For unequal blocks, check the extra pages appended at the end.',
  'PDF mit abwechselnden Vorder- und Rückseiten; keine ausgewählte Seite wird ausgelassen.':
    'PDF with alternating fronts and backs; no selected page is omitted.',
  'Die Ein-Datei-Sortierung verarbeitet 2–200 ausgewählte Seiten in ihrer aktuellen Reihenfolge. Die Trennstelle zählt ausgewählte Seiten, nicht ursprüngliche Seitennummern. Zusätzliche Seiten des längeren Blocks werden am Ende angehängt; die Zuordnung bitte am Original kontrollieren.':
    'Single-file collation processes 2–200 selected pages in their current order. The split counts selected pages, not original page numbers. Extra pages from the longer block are appended at the end; check the pairing against the original.',
  'Unter „Schreibgeschützte Formularfelder freigeben“ kannst du einzelne oder alle angezeigten Felder wieder ausfüllbar machen. Vorhandene Werte und andere Feldregeln bleiben erhalten. Freigegebene Felder werden nicht festgeschrieben.':
    'Under “Unlock read-only form fields”, make individual fields or all listed fields fillable again. Existing values and other field rules are preserved. Unlocked fields are not flattened.',

  'Papierkram. Läuft.': 'Paperwork. Sorted.',
  'Darstellung und Sprache': 'Appearance and language',
  'Sprache auswählen': 'Choose language',
  'Hellen Modus einschalten': 'Switch to light mode',
  'Dunklen Modus einschalten': 'Switch to dark mode',
  'PDF oder andere Datei auswählen': 'Choose a PDF or another file',
  'Alles bereit.': 'All set.',
  'Wird geöffnet …': 'Opening …',
  'Hier loslassen.': 'Drop it here.',
  'Datei hier ablegen.': 'Drop your file here.',
  'Eine oder mehrere Dateien': 'One or more files',
  'oder antippen · PDF, Office, Bilder & E-Mails':
    'or tap to choose · PDF, Office, images & emails',
  'Datei geöffnet': 'File opened',
  'Dateien geöffnet': 'Files opened',
  'Dateien öffnen': 'Open files',
  'Kamera-Scanner': 'Camera scanner',
  'Office zu PDF': 'Office to PDF',
  'E-Mails zu PDF': 'Email to PDF',
  'Alle Werkzeuge': 'All tools',
  Dokumentation: 'Documentation',
  Medienbereich: 'Media',
  Impressum: 'Legal notice',
  Datenschutzerklärung: 'Privacy policy',
  'Informationen zu MoinPDF': 'About MoinPDF',
  ' (neuer Tab)': ' (new tab)',
  Datei: 'file',
  Dateien: 'files',
  Seite: 'Page',
  Seiten: 'Pages',
  'Dateien hinzufügen': 'Add files',
  'Arbeitsbereich leeren': 'Clear workspace',
  'Arbeitsbereich leeren?': 'Clear workspace?',
  'Geöffnete Dokumente und Änderungen werden aus dieser Sitzung entfernt. Deine Originaldateien bleiben erhalten.':
    'Open documents and changes will be removed from this session. Your original files are kept.',
  'Geöffnete Dokumente, Änderungen und Ergebnisse werden aus dieser Sitzung entfernt. Deine Originaldateien bleiben erhalten.':
    'Open documents, changes and results will be removed from this session. Your original files are kept.',
  Behalten: 'Keep',
  Leeren: 'Clear',
  'Geöffnete Dateien': 'Open files',
  'Was möchtest du tun?': 'What would you like to do?',
  Werkzeugvorschläge: 'Suggested tools',
  'Zum Beispiel: PDF kleiner machen …': 'For example: make a PDF smaller …',
  'Suche leeren': 'Clear search',
  'Passende Werkzeuge': 'Matching tools',
  'Kein passender Vorschlag': 'No matching tools',
  'Versuche zum Beispiel „Text auslesen“, „zusammenfügen“ oder wähle unten ein Werkzeug.':
    'Try “extract text”, “merge”, or choose a tool below.',
  'In dieser Kategorie gibt es keinen passenden Vorschlag. Wähle „Alle“, um in allen Werkzeugen zu suchen.':
    'No matching tools in this category. Choose “All” to search every tool.',
  Werkzeugkategorien: 'Tool categories',
  Alle: 'All',
  Prüfen: 'Check',
  Umwandeln: 'Convert',
  Bearbeiten: 'Edit',
  Stapel: 'Batch',
  'Prüfen & finden': 'Check & find',
  'Erkennen & konvertieren': 'Recognise & convert',
  'Seiten & Struktur': 'Pages & structure',
  'Bearbeiten & bereinigen': 'Edit & clean up',
  'Stapel & Abläufe': 'Batch & workflows',
  'Dateien hinzufügen.': 'Add files.',
  'Einfach hier loslassen.': 'Just drop them here.',
  Werkzeuge: 'Tools',
  'Werkzeug finden': 'Find a tool',
  'Werkzeuge durchsuchen': 'Search tools',
  'Werkzeug wechseln': 'Change tool',
  'Neues Dokument': 'New document',
  'DEIN ARBEITSBEREICH': 'YOUR WORKSPACE',
  'OHNE DOKUMENTEN-UPLOAD': 'NO DOCUMENT UPLOAD',
  Rückgängig: 'Undo',
  Wiederholen: 'Redo',
  Dokument: 'Document',
  Ergebnis: 'Result',
  EINSTELLUNGEN: 'SETTINGS',
  Vorschau: 'Preview',
  Abbrechen: 'Cancel',
  Schließen: 'Close',
  Zurück: 'Back',
  Weiter: 'Continue',
  Speichern: 'Save',
  Herunterladen: 'Download',
  'Ergebnis herunterladen': 'Download result',
  'Ergebnis weiterbearbeiten': 'Keep editing',
  'Dein Ergebnis ist bereit.': 'Your result is ready.',
  'Fertig.': 'Done.',
  Kopieren: 'Copy',
  'Text kopiert': 'Text copied',
  'Text markieren und manuell kopieren.': 'Select the text and copy it manually.',
  'Alle Dateien. Ein Download.': 'All files. One download.',
  'Noch etwas vor mit diesem Dokument?': 'Anything else to do with this document?',
  'Lokale Verarbeitung': 'Local processing',
  'Keine Dateien geöffnet': 'No files open',
  'Originale bleiben erhalten': 'Original files are kept',
  'Werkzeug wird geladen …': 'Loading tool …',
  'Lokale Projekte': 'Local projects',
  Projekte: 'Projects',
  'Projekt speichern': 'Save project',
  Projektname: 'Project name',
  'Projektdatei importieren': 'Import project file',
  'Projektdatei herunterladen': 'Download project file',
  'Aktuellen Stand speichern': 'Save current state',
  Löschen: 'Delete',
  Öffnen: 'Open',
  Importieren: 'Import',
  'Keine gespeicherten Projekte.': 'No saved projects.',
  'Noch keine gespeicherten Projekte.': 'No saved projects yet.',
  'Lokale PDF-Projekte': 'Local PDF projects',
  'Dateien, Seitenanordnung, Editoränderungen, Formulare, Lesezeichen und Rückgängig-Verlauf später fortsetzen. Gespeichert werden die letzten fünf von dir angelegten Arbeitsstände.':
    'Resume files, page arrangements, edits, forms, bookmarks and undo history later. The last five snapshots you save are retained.',
  'Als neues Projekt': 'As a new project',
  'Projektdatei öffnen': 'Open project file',
  'Arbeitsstand wird verarbeitet …': 'Processing project …',
  'Gesamtes Projektarchiv herunterladen': 'Download complete project archive',
  'Projekt löschen': 'Delete project',
  'Endgültig löschen': 'Delete permanently',
  'Alle gespeicherten Stände von „': 'Delete all saved snapshots of “',
  '“ löschen?': '”?',
  'Neuen Arbeitsstand speichern': 'Save new snapshot',
  'Arbeitsstand gespeichert.': 'Snapshot saved.',
  'Kein passendes Werkzeug gefunden.': 'No matching tool found.',
  'Lokal. Privat. Bei dir.': 'Local. Private. Yours.',
  'Hilfe & Tastenkürzel': 'Help & shortcuts',
  '01 — DOKUMENT ÖFFNEN': '01 — OPEN DOCUMENT',
  'Dateien hierher ziehen.': 'Drop your files here.',
  'Danach kannst du sie bearbeiten.': 'Then start editing.',
  'Dateien auswählen': 'Choose files',
  'Mit Beispieldokument ausprobieren': 'Try a sample document',
  '80 MB / 200 Seiten': '80 MB / 200 pages',
  Drehen: 'Rotate',
  Umkehren: 'Reverse',
  Leerseite: 'Blank page',
  Änderungen: 'Changes',
  'Seiten ziehen, umsortieren, fertig. Die Pfeile funktionieren auch auf dem Handy.':
    'Drag pages to reorder them. You can also use the arrows on your phone.',
  'Diese Seite ist nicht für den Export ausgewählt.': 'This page is not selected for export.',
  Auswählen: 'Select',
  'Erledigt.': 'Done.',
  'Seiten ·': 'pages ·',
  'Erkannter Text': 'Recognised text',
  BEARBEITBAR: 'EDITABLE',
  'Korrekturen gelten für Text und Word. Die PDF enthält das ursprüngliche OCR-Ergebnis. Word übernimmt den Text ohne das Original-Layout.':
    'Corrections apply to text and Word exports. The PDF keeps the original OCR result. Word contains the text without the original layout.',
  'ERGEBNISVORSCHAU ·': 'RESULT PREVIEW ·',
  'Das Ergebnis ist bereit. Eine Vorschau ist für diese Datei nicht verfügbar.':
    'Your result is ready. A preview is not available for this file.',
  'ZIP herunterladen': 'Download ZIP',
  'Bericht herunterladen': 'Download report',
  'PDF herunterladen': 'Download PDF',
  'Begriff eingeben und über alle geöffneten Dateien suchen.':
    'Enter a term to search across all open files.',
  'Scan-Seiten bei Bedarf lokal erkennen lassen.':
    'Run text recognition locally on scanned pages when needed.',
  'Treffer prüfen und als neue PDF sammeln.': 'Review matches and collect them in a new PDF.',
  'Vermutete Leerseiten und doppelte Vorschauen werden angezeigt. Die Auswahl bleibt bei dir.':
    'Possible blank pages and duplicate previews are flagged. You choose what to keep.',
  'Sprachen automatisch ermitteln': 'Detect languages automatically',
  'Pro Scan-Seite; benötigt zusätzlich etwa 600 MB Arbeitsspeicher':
    'Per scanned page; requires about 600 MB of additional memory',
  'Eine mehrsprachige OCR-Probe und ein lokaler statistischer Sprachvergleich wählen bis zu acht Modelle. Kurze, verrauschte oder mehrdeutige Texte werden zur manuellen Auswahl zurückgewiesen.':
    'A multilingual OCR sample and a local statistical language comparison select up to eight models. Short, noisy or ambiguous text requires manual language selection.',
  'Alle Seiten neu erkennen': 'Recognise all pages again',
  'Auch vorhandenen Text': 'Including existing text',
  'Bildseiten werden automatisch erkannt. Bei gemischten Text- und Scanbereichen „Alle Seiten neu erkennen“ aktivieren.':
    'Image-only pages are detected automatically. Enable “Recognise all pages again” for pages that mix text and scans.',
  'Erstellt eine Bild-PDF. Kopierbare Texte, Links und Formularfunktionen gehen verloren. Eine kleinere Datei ist nicht garantiert.':
    'Creates an image-only PDF. Selectable text, links and form functionality are lost. A smaller file is not guaranteed.',
  Sanft: 'Gentle',
  'Beginnen bei': 'Start at',
  Wasserzeichen: 'Watermark',
  'Transparentes Türkis, mittig auf jeder ausgewählten Seite.':
    'Transparent teal, centred on each selected page.',
  'Inhalte werden proportional verkleinert oder vergrößert. Text bleibt kopierbar, soweit er im Original vorhanden ist.':
    'Content is resized proportionally. Existing selectable text remains selectable.',
  'Schwärzungen werden in die Seitenbilder eingerechnet. Die betroffenen Seiten enthalten danach keine ursprüngliche Textebene. Prüfe die Ergebnisvorschau vor dem Download.':
    'Redactions are baked into page images. Affected pages no longer contain the original text layer. Check the result preview before downloading.',
  'Zugeschnittene Seiten werden als neue Seitenbilder exportiert. Inhalte außerhalb des Ausschnitts werden entfernt; die Textebene entfällt.':
    'Cropped pages are exported as new page images. Content outside the crop and the text layer are removed.',
  'Ausschnitt zurücksetzen': 'Reset crop',
  Marker: 'Highlighter',
  'Deine Notiz': 'Your note',
  Schriftgröße: 'Font size',
  'Wichtiges hervorheben.': 'Highlight what matters.',
  'Wird als Bild eingefügt. Keine digitale Zertifikatssignatur.':
    'Inserted as an image. This is not a certificate-based digital signature.',
  'Die Ausgabe enthält neue Seitenbilder. Textebenen, Links und interaktive Formularfelder werden nicht übernommen.':
    'The output contains new page images. Text layers, links and interactive form fields are not retained.',
  'DOKUMENTINFOS DER AKTUELLEN DATEI': 'CURRENT FILE INFORMATION',
  'Inhalte im Dokument, Kommentare, Bilder und eingebettete Objektdaten werden damit nicht anonymisiert.':
    'This does not anonymise document content, comments, images or embedded object data.',
  'Seiten auswählen & sortieren': 'Select & arrange pages',
  'Bereich per Eingabe setzen': 'Set area by coordinates',
  'Bereich hinzufügen': 'Add area',
  'AUF DIESER SEITE ·': 'ON THIS PAGE ·',
  'Deine Unterschrift.': 'Your signature.',
  'Mit Maus oder Finger zeichnen. Danach im Dokument platzieren.':
    'Draw with your mouse or finger, then place it in the document.',
  'Einfach loslassen.': 'Just drop it here.',
  'Dein Dokument. Dein nächster Schritt.': 'Your document. Your next step.',
};

export function translate(text: string, language: Language, fallback?: string) {
  return language === 'en' ? (fallback ?? englishMessage(text)) : text;
}

// Extended copy is loaded once on demand, so German startup does not download
// thousands of English tool messages. No content is sent to a translation API.
let currentLanguage: Language = 'de';
let catalogRequest: Promise<void> | undefined;
let patterns: { pattern: RegExp; target: string; slots: string[]; weight: number }[] = [];
const translated = new Map<string, string>();

export function setUiLanguage(language: Language) {
  currentLanguage = language;
}

export function uiLocale() {
  return currentLanguage === 'en' ? 'en-GB' : 'de-DE';
}

export function installEnglishCatalog(catalog: Record<string, string>) {
  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value === 'string' && key !== '__proto__') english[key] = value;
  }
  patterns = Object.entries(english)
    .filter(
      ([key]) =>
        /\{\d+\}/.test(key) &&
        key.replace(/\{\d+\}/g, '').replace(/[^A-Za-zÄÖÜäöüß]/g, '').length >= 3,
    )
    .map(([key, target]) => {
      const slots: string[] = [];
      const source = key
        .split(/(\{\d+\})/)
        .map((part) => {
          if (/^\{\d+\}$/.test(part)) {
            slots.push(part);
            return '([\\s\\S]*?)';
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('');
      return {
        pattern: new RegExp('^' + source + '$'),
        target,
        slots,
        weight: key.replace(/\{\d+\}/g, '').length,
      };
    })
    .sort((a, b) => b.weight - a.weight);
  translated.clear();
}

export function loadEnglishCatalog(version: string): Promise<void> {
  catalogRequest ??= fetch(`/locales/en.json?v=${encodeURIComponent(version)}`)
    .then(async (response) => {
      if (!response.ok)
        throw new Error('English language files could not be loaded. Please try again.');
      const catalog: unknown = await response.json();
      if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog))
        throw new Error('Invalid English language file.');
      installEnglishCatalog(catalog as Record<string, string>);
    })
    .catch((error: unknown) => {
      catalogRequest = undefined;
      throw error;
    });
  return catalogRequest;
}

function englishMessage(text: string): string {
  const key = text.replace(/\s+/g, ' ').trim();
  const before = text.match(/^\s*/)?.[0] ?? '';
  const after = text.match(/\s*$/)?.[0] ?? '';
  let result = english[text] ?? english[key];
  if (result !== undefined) return before + result.trim() + after;
  if (translated.has(text)) return translated.get(text)!;
  for (const entry of patterns) {
    const match = entry.pattern.exec(key);
    if (!match) continue;
    const values = new Map(entry.slots.map((slot, index) => [slot, match[index + 1]]));
    result = entry.target.replace(/\{\d+\}/g, (slot) => values.get(slot) ?? slot);
    if (translated.size > 5000) translated.clear();
    translated.set(text, before + result + after);
    return before + result + after;
  }
  // Joined reports and third-party error wrappers can contain several authored
  // messages. Translate each line without rewriting document text or filenames.
  if (text.includes('\n')) return text.split('\n').map(englishMessage).join('\n');
  return text;
}

/** Translate only application-authored copy at its rendering boundary. */
export function ui(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const value = String(text);
  return currentLanguage === 'en' ? englishMessage(value) : value;
}
