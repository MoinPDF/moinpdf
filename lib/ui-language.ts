export type Language = 'de' | 'en';

export const english: Record<string, string> = {
  'Unterlagen-Checkliste': 'Document checklist',
  'Erwartete Unterlagen mit Suchwörtern und Monat prüfen. Fundstellen bestätigen und fehlende oder unklare Zuordnungen dokumentieren.':
    'Check expected documents by keywords and month. Confirm evidence and document missing or uncertain matches.',
  'Unterlagen prüfen': 'Check documents',
  'Termine aus PDFs übernehmen': 'Collect dates from PDFs',
  'Gedruckte Datumsangaben mit Fundstelle sammeln, korrigieren und bestätigte Termine als Kalenderdatei speichern.':
    'Collect printed dates with evidence, correct them and save confirmed events as a calendar file.',
  'Datumsangaben suchen': 'Find dates',
  Qualitätshinweise: 'Quality hints',
  'Scan-Qualität prüfen': 'Check scan quality',
  'Bildanalyse auf mögliche Unschärfe, schwachen Kontrast, Schatten und Randinhalte. Hinweise sind keine Vollständigkeitsprüfung. Fotos, Vollflächen und kleine Schrift am Original beurteilen; bis zu 200 Seiten.':
    'Image analysis for possible blur, low contrast, shadows and content near edges. Hints do not establish completeness. Review photos, solid areas and small text in the original; up to 200 pages.',
  'Keine Auffälligkeit in der Bildanalyse; Lesbarkeit dennoch am Original prüfen.':
    'No issue detected by image analysis; still check readability in the original.',
  'Verarbeitet die ausgewählten Seiten der gewählten Dateien in ihrer aktuellen Reihenfolge.':
    'Processes the selected pages of the chosen files in their current order.',
  'Drei Fassungen vergleichen': 'Compare three versions',
  'Fassung A': 'Version A',
  'Fassung B': 'Version B',
  Ausgangsfassung: 'Base version',
  'Fassung A ist die erste Bearbeitung, Fassung B die zweite Bearbeitung derselben Ausgangsfassung. Alle drei Dateien müssen verschieden sein.':
    'Version A is the first edit and version B the second edit of the same base version. All three files must be different.',
  'Bitte höchstens 200 Seiten auswerten.': 'Please analyze no more than 200 pages.',
  'Bitte drei verschiedene Dateien auswählen.': 'Please select three different files.',
  'Bitte auch in der dritten Datei Seiten auswählen.':
    'Please select pages in the third file as well.',
  'Bitte höchstens 200 Seiten je Fassung auswählen.':
    'Please select no more than 200 pages per version.',
  Vorhanden: 'Present',
  'Fehlt laut Prüfung': 'Missing after review',
  'Erwartete Unterlagen festlegen, Fundstellen prüfen und fehlende oder unklare Zuordnungen dokumentieren.':
    'Define expected documents, review evidence and document missing or uncertain matches.',
  'Jahr für Monatsvorlage': 'Year for monthly template',
  Kontoauszug: 'Bank statement',
  'Vorlage: zwölf Kontoauszüge': 'Template: twelve bank statements',
  'Alle kommagetrennten Suchwörter müssen auf derselben Seite vorkommen. Der Monat ist optional. Dateinamen allein gelten nicht als Nachweis.':
    'All comma-separated keywords must occur on the same page. The month is optional. File names alone are not evidence.',
  Suchwörter: 'Keywords',
  'Monat (optional)': 'Month (optional)',
  Prüfpunkt: 'Checklist item',
  'Prüfpunkt entfernen': 'Remove checklist item',
  'Prüfpunkt hinzufügen': 'Add checklist item',
  'mögliche Fundstellen': 'possible matches',
  'Fundstelle zuordnen': 'Assign evidence',
  'Keine Zuordnung / fehlt': 'No assignment / missing',
  'Diesen Prüfpunkt am Original geprüft': 'Reviewed this item against the original',
  'Bis zu 60 Prüfpunkte und 200 Seiten. Textarme Seiten werden lokal per OCR gelesen. Ein nicht gefundener Treffer beweist nicht, dass eine Unterlage fehlt. Unlesbare Seiten und mehrdeutige Treffer manuell prüfen.':
    'Up to 60 checklist items and 200 pages. Pages with little text are read using local OCR. No match does not prove that a document is missing. Review unreadable pages and ambiguous matches manually.',
  'Checkliste als CSV herunterladen': 'Download checklist as CSV',
  'Gedruckte Datumsangaben mit Fundstelle sammeln. Nur ausdrücklich bestätigte Termine werden als Kalenderdatei ausgegeben.':
    'Collect printed dates with evidence. Only explicitly confirmed events are exported as a calendar file.',
  Datumsfundstellen: 'date matches',
  Termin: 'Event',
  Termintitel: 'Event title',
  'Uhrzeit (leer = ganztägig)': 'Time (empty = all day)',
  'Dauer in Minuten': 'Duration in minutes',
  'Termin geprüft und für den Export bestätigt': 'Event reviewed and confirmed for export',
  'Termin entfernen': 'Remove event',
  'Manuell erfasster Termin': 'Manually entered event',
  'Termin manuell ergänzen': 'Add event manually',
  'Bis zu 200 Seiten und 300 Fundstellen. Erkannt werden vollständige Datumsangaben mit Jahr (1900–2199), keine relativen oder rechtlich berechneten Fristen. Mehrdeutige Schrägstrich-Daten manuell erfassen. Uhrzeiten gelten in der lokalen Zeitzone deines Kalenders; die vorgeschlagene Dauer ist 60 Minuten. Es wird nichts automatisch in einen Kalender eingetragen.':
    'Up to 200 pages and 300 matches. Detects complete dates with a year (1900–2199), not relative or legally calculated deadlines. Enter ambiguous slash-separated dates manually. Times use your calendar’s local time zone; the proposed duration is 60 minutes. Nothing is added to a calendar automatically.',
  'Bestätigte Termine als ICS herunterladen': 'Download confirmed events as ICS',
  'Wiederkehrende Logos austauschen': 'Replace recurring logos',
  'Pixelgleiche Bildobjekte im Dokument finden. Fundstellen auswählen und gemeinsam durch ein neues Bild ersetzen. Text und übrige Seiten bleiben als PDF-Objekte erhalten.':
    'Find image objects with identical pixels in the document. Select occurrences and replace them together with a new image. Text and other page content remain PDF objects.',
  'Wiederkehrende Bilder suchen': 'Find recurring images',
  'Bildobjekte gefunden': 'image objects found',
  'komplexe oder zu große Bildobjekte ausgelassen': 'complex or oversized image objects skipped',
  Bildgruppe: 'Image group',
  'Alle Fundstellen dieser Bildgruppe auswählen': 'Select all occurrences of this image group',
  'Fundstellen und Ersatzbild geprüft': 'Occurrences and replacement image reviewed',
  'Ausgewählte Bildobjekte ersetzt. Bildflächen und Drehungen bleiben erhalten. Bitte das Ergebnis visuell prüfen; das Original bleibt unverändert.':
    'Selected image objects replaced. Image bounds and rotations are preserved. Please inspect the result visually; the original remains unchanged.',
  'Ausgewählte Logos ersetzen': 'Replace selected logos',
  'Bis zu 50 Seiten, 80 MB Eingang, 100 Ersetzungen und 160 MB Ausgabe. Analyse bis 1.000 Bildobjekte und insgesamt 48 Megapixel; Ersatzbild bis 4 Megapixel und 20 MB. Erfasst werden pixelgleiche Rasterbilder, keine Vektorlogos oder Logos innerhalb eines Seitenscans. Beschnittene und komplex transparente Objekte werden ausgelassen. Ein abweichendes Seitenverhältnis des Ersatzbildes wird in die vorhandene Fläche eingepasst und kann verzerren. Signierte PDFs und XFA werden abgewiesen.':
    'Up to 50 pages, 80 MB input, 100 replacements and 160 MB output. Analysis is limited to 1,000 image objects and 48 megapixels in total; replacement images to 4 megapixels and 20 MB. Matches raster images with identical pixels, not vector logos or logos within a page scan. Clipped and complex transparent objects are skipped. A different replacement aspect ratio is fitted into the existing bounds and may distort the image. Signed PDFs and XFA are rejected.',
  'Bitte 1 bis 60 Prüfpunkte und höchstens 200 Seiten verwenden.':
    'Please use 1 to 60 checklist items and no more than 200 pages.',
  'Jeder Prüfpunkt benötigt einen Titel und Suchwörter mit mindestens zwei Zeichen. Monat: JJJJ-MM oder leer.':
    'Each checklist item needs a title and keywords with at least two characters. Month: YYYY-MM or empty.',
  'Mehr als 300 Datumsfundstellen. Bitte weniger Seiten verwenden.':
    'More than 300 date matches. Please use fewer pages.',
  'Bitte 1 bis 300 Termine ausdrücklich bestätigen.': 'Please explicitly confirm 1 to 300 events.',
  'Bitte Titel, gültiges Datum, Uhrzeit und Dauer jedes Termins prüfen.':
    'Please check the title, valid date, time and duration of each event.',
  'Bitte eine PDF bis 80 MB verwenden.': 'Please use a PDF up to 80 MB.',
  'Bitte höchstens 50 Seiten für den Bildaustausch verwenden.':
    'Please use no more than 50 pages for image replacement.',
  'Dynamische XFA-Formulare werden hier nicht unterstützt.':
    'Dynamic XFA forms are not supported here.',
  'Mehr als 1.000 Bildobjekte. Bitte weniger Seiten verwenden.':
    'More than 1,000 image objects. Please use fewer pages.',
  'Die Bildanalyse überschreitet 48 Megapixel. Bitte weniger Seiten verwenden.':
    'Image analysis exceeds 48 megapixels. Please use fewer pages.',
  'Bitte 1 bis 100 eindeutige Vorkommen einer Bildgruppe auswählen.':
    'Please select 1 to 100 distinct occurrences of one image group.',
  'Ungültige Bildfundstelle.': 'Invalid image occurrence.',
  'Die Bildfundstelle hat sich geändert. Bilder erneut suchen.':
    'The image occurrence has changed. Search for images again.',
  'Die Ausgabe überschreitet 160 MB. Bitte ein kleineres Ersatzbild verwenden.':
    'The output exceeds 160 MB. Please use a smaller replacement image.',
  'Die Seitenzahl hat sich unerwartet geändert.': 'The page count changed unexpectedly.',
  'Möglicherweise unscharf': 'Possibly blurred',
  'Ungleichmäßige Helligkeit / Schatten': 'Uneven brightness / shadows',
  'Inhalt nahe dem Seitenrand': 'Content near the page edge',
  'Keine Textänderung': 'No text change',
  'Gleiche Änderung in A und B': 'Same change in A and B',
  'Nur Fassung A geändert': 'Only version A changed',
  'Nur Fassung B geändert': 'Only version B changed',
  'Widersprüchliche Textänderungen': 'Conflicting text changes',
  'Entfernung oder Zuordnung unklar': 'Deletion or alignment unclear',
  'Nicht eindeutig zugeordnete Texte nicht als sichere Löschung oder Übereinstimmung behandeln.':
    'Do not treat uncertain text alignment as a confirmed deletion or agreement.',
  'Beide Fassungen ändern denselben Ausgangstext unterschiedlich. Am Original prüfen.':
    'Both versions change the same base text differently. Check against the original.',
  'Textvergleich; Position, Bilder und Formatierung zusätzlich am Original prüfen.':
    'Text comparison; also check positions, images and formatting against the original.',
  'Gleicher zusätzlicher oder nicht zugeordneter Text': 'Identical additional or unaligned text',
  'Zusätzlicher oder nicht zugeordneter Text in A': 'Additional or unaligned text in A',
  'Zusätzlicher oder nicht zugeordneter Text in B': 'Additional or unaligned text in B',
  'Kein auslesbarer Text. Für Scans zuerst OCR anwenden.':
    'No readable text. Apply OCR to scans first.',
  'Ohne Textänderung': 'No text change',
  'Gleiche Änderungen': 'Identical changes',
  'Nur A geändert': 'Only A changed',
  'Nur B geändert': 'Only B changed',
  'Unklare oder zusätzliche Textstellen': 'Uncertain or additional text passages',
  Textkonflikte: 'Text conflicts',
  'Basis: Seite {0} · A: {1} · B: {2}': 'Base: page {0} · A: {1} · B: {2}',
  'Basis: Seite {0}': 'Base: page {0}',
  'A: Seite {0} · B: {1}': 'A: page {0} · B: {1}',
  'A: Seite {0}': 'A: page {0}',
  'B: Seite {0}': 'B: page {0}',
  'Basis: {0}': 'Base: {0}',
  'Beide Bearbeitungen werden derselben Ausgangsfassung zugeordnet. Der Bericht verändert keine Datei. Ähnliche und wiederholte Textstellen bleiben prüfpflichtig; keine automatische Zusammenführung. Bilder, Formatierung und Textverschiebungen sind keine Textkonflikte.':
    'Both edits are aligned to the same base version. The report changes no files. Similar and repeated text passages require review; no automatic merging. Images, formatting and moved text are not text conflicts.',
  'Stand: 29. Oktober 2026': 'Updated: 29 October 2026',

  'PNG-Bilder': 'PNG images',
  'JPG-Fotos': 'JPG photos',
  Ausgabeformat: 'Output format',
  'Scanfotos automatisch trennen': 'Automatically split scanned photos',
  'Mehrere Fotos lokal erkennen, einzeln ausrichten und zuschneiden. Die Originaldatei bleibt unverändert.':
    'Detect multiple photos locally, straighten and crop each one. The original file stays unchanged.',
  'Mehrere Fotos auf einer Scan-Seite erkennen, ausrichten und zuschneiden. Als JPG, PNG oder gemeinsame PDF speichern.':
    'Detect, straighten and crop multiple photos on a scan page. Save as JPG, PNG or a combined PDF.',
  Kontrastschwelle: 'Contrast threshold',
  'Die Kontrastschwelle muss zwischen 6 und 60 liegen.':
    'The contrast threshold must be between 6 and 60.',
  'Kleinere Werte helfen bei blassen Fotos; größere Werte unterdrücken Staub und Schatten. Fotos mit Abstand auf einen möglichst gleichmäßigen Hintergrund legen.':
    'Lower values help with faint photos; higher values suppress dust and shadows. Leave gaps between photos on a background that is as uniform as possible.',
  'Vorhandene Ausschnitte bei erneuter Erkennung ersetzen':
    'Replace existing crops when detecting again',
  'Mehr als 32 mögliche Fotos. Weitere Fotos manuell ergänzen oder die Seite aufteilen.':
    'More than 32 possible photos. Add further photos manually or divide the page.',
  'Keine sichere Erkennung. Kontrastschwelle senken oder einen eigenen Rahmen aufziehen.':
    'No reliable detection. Lower the contrast threshold or draw your own frame.',
  'Unsichere Konturen: Helle, angeschnittene oder verbundene Fotos bitte besonders sorgfältig prüfen.':
    'Uncertain outlines: please check faint, clipped or connected photos especially carefully.',
  'Vorschläge erkannt. Bitte jedes Foto und seine Ränder am Original prüfen.':
    'Suggestions found. Please check every photo and its edges against the original.',
  'Erkennung starten oder einen eigenen Rahmen aufziehen.':
    'Start detection or draw your own frame.',
  Fotoecke: 'Photo corner',
  Fotovorschau: 'Photo preview',
  'Foto auswählen': 'Select photo',
  Foto: 'Photo',
  'Fotoecken prüfen': 'Check photo corners',
  'Zugeschnittenes Foto': 'Cropped photo',
  'Die vier Ecken ziehen oder mit Pfeiltasten verschieben. Prozentwerte ermöglichen einen rechteckigen Zuschnitt. Drehung und Vorschau gelten nur für dieses Foto.':
    'Drag the four corners or move them with arrow keys. Percentage values provide a rectangular crop. Rotation and preview apply only to this photo.',
  'Die Fotoecken müssen innerhalb der Seite liegen und dürfen sich nicht kreuzen.':
    'Photo corners must stay inside the page and must not cross.',
  'Foto um 90° drehen': 'Rotate photo by 90°',
  'Alle Fotos in einer PDF': 'All photos in one PDF',
  'JPG und PNG werden als ZIP gespeichert. Bis zu 50 Seiten automatisch erkennen, 200 Fotos und 160 MB ausgeben. Die gerenderte Scan-Seite ist auf 4096 Pixel Kantenlänge und 16 Megapixel begrenzt; die tatsächliche Auflösung kann geringer sein. Weiße Fotoränder, starke Schatten und überlappende Fotos benötigen oft manuelle Korrekturen.':
    'JPG and PNG are saved as a ZIP. Automatically detect up to 50 pages; export up to 200 photos and 160 MB. The rendered scan page is limited to 4096 pixels per side and 16 megapixels; actual resolution may be lower. White photo borders, strong shadows and overlapping photos often need manual corrections.',
  'Nur markierte Fotos werden ausgegeben, in Seiten- und Rahmenreihenfolge. Die Ausgabe enthält Bildkopien ohne ursprüngliche Textebene, Links, Formulare oder Signaturen. Die Originaldatei bleibt unverändert.':
    'Only marked photos are exported, in page and frame order. Output contains image copies without the original text layer, links, forms or signatures. The original file remains unchanged.',
  'Scans als PDF oder Bilddatei mit mehreren getrennt liegenden Fotos.':
    'PDF or image scans containing several separately placed photos.',
  'Wähle „Diese Seite erkennen“ oder „Alle Seiten erkennen“. Senke die Kontrastschwelle bei blassen Fotos; erhöhe sie bei Staub oder Schatten. Erneute Erkennung ersetzt bestehende Ausschnitte nur nach ausdrücklicher Auswahl.':
    'Choose “Detect items on this page” or “Detect items on all pages”. Lower the contrast threshold for faint photos; raise it for dust or shadows. Detecting again only replaces existing crops after explicit selection.',
  'Prüfe die nummerierten Konturen und Fotovorschauen auf jeder Seite. Wähle ein Foto, verschiebe seine vier Ecken mit Maus, Touch oder Pfeiltasten, drehe es in 90°-Schritten oder ändere den rechteckigen Zuschnitt über Prozentwerte. Fehlende Fotos als Rahmen aufziehen; falsche Vorschläge entfernen.':
    'Check the numbered outlines and photo previews on every page. Select a photo, move its four corners with mouse, touch or arrow keys, rotate it in 90° steps or change its rectangular crop using percentages. Draw frames for missing photos; remove incorrect suggestions.',
  'Bestätige die Prüfung aller Ausschnitte. Wähle JPG/PNG im ZIP, einzelne Bild-PDFs im ZIP oder alle Fotos in einer PDF und lade das Ergebnis herunter.':
    'Confirm that you reviewed all crops. Choose JPG/PNG in a ZIP, individual image PDFs in a ZIP or all photos in one PDF, then download the result.',
  'Gerade ausgerichtete Bildkopien der Fotos; nur markierte Seiten und Ausschnitte in Seiten- und Rahmenreihenfolge.':
    'Straightened image copies of the photos; only marked pages and crops, in page and frame order.',
  'Vollständig lokal, ohne KI oder Dokumentenserver. Die Erkennung nutzt Hintergrundfarbe, Zwischenräume und Konturen. Schräge Fotos und unterschiedliche Größen werden unterstützt. Schwache Konturen werden als unsicher markiert; bei fehlenden Vorschlägen manuell markieren. Überlappungen, weiße Fotoränder und ungleichmäßiger Hintergrund sind nicht zuverlässig automatisch trennbar. Bis zu 32 Vorschläge pro Seite, 50 Seiten je Erkennung, 200 Fotos und 160 MB Ausgabe. Analyse bis 1000 Pixel Kantenlänge; Export mit 150/300 dpi, maximal 4096 Pixel Kantenlänge und 16 Megapixel pro gerenderter Scan-Seite (höchstens 4,2-fache PDF-Punktauflösung). Originale bleiben unverändert; Ausgaben enthalten keine ursprüngliche Textebene, Links, Formulare oder Signaturen. Einstellungen und Ausschnitte bleiben im Projekt; die Prüfbestätigung muss neu erfolgen.':
    'Entirely local, without AI or a document server. Detection uses background colour, gaps and contours. Supports skewed photos and different sizes. Weak outlines are marked uncertain; add manual frames when no suggestions appear. Overlaps, white photo borders and uneven backgrounds cannot be separated reliably automatically. Up to 32 suggestions per page, 50 pages per detection, 200 photos and 160 MB of output. Analysis up to 1000 pixels per side; export at 150/300 dpi, up to 4096 pixels per side and 16 megapixels per rendered scan page (at most 4.2 times PDF point resolution). Originals stay unchanged; output has no original text layer, links, forms or signatures. Settings and crops stay in the project; review must be confirmed again.',

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
  'Wähle die Felder, die in der neuen PDF wieder ausfüllbar sein sollen. Vorhandene Werte und andere Feldregeln bleiben erhalten.':
    'Choose which fields should be editable again in the new PDF. Existing values and other field rules are preserved.',
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
