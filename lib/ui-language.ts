export type Language = 'de' | 'en';

export const english: Record<string, string> = {
  'Zeilen an Inhalt anpassen': 'Fit rows to content',
  'Zu kleine Zeilen werden in der Vorschau vergrößert. Schriftgrößen und Spaltenbreiten bleiben erhalten; benachbarte Inhalte dürfen nicht überdeckt werden.':
    'The preview expands rows that are too small. Font sizes and column widths are preserved; neighbouring content must not be covered.',
  'Auf der Seite vergleichen': 'Compare on the page',
  'Schriftvorschau schließen': 'Close font preview',
  'Schriftvorschau – noch nicht übernommen': 'Font preview – not yet applied',
  Textaktionen: 'Text actions',
  'Scan: Schrift angenähert': 'Scan: approximate font',
  'Ersatzschrift · bitte prüfen': 'Substitute font · please check',
  'Die PDF enthält keinen eindeutigen Schriftnamen. Bitte das Schriftbild am Original prüfen.':
    'The PDF does not provide an unambiguous font name. Compare the appearance with the original.',
  'Einfache Zertifikatssignatur': 'Basic certificate signature',
  'Vorhandene Textfelder erhalten passende Vorschläge. Bei Scans können leere Felder und ihre Beschriftungen erkannt werden. Angaben lassen sich auch selbst platzieren; bestehende Einträge bleiben erhalten.':
    'Existing text fields receive matching suggestions. Empty fields and labels can be detected in scans. You can also place values yourself; existing entries are preserved.',
  'Erkannte Felder und Beschriftungen bitte am Original prüfen. Danach passende Angaben vorschlagen lassen.':
    'Check detected fields and labels against the original, then request matching value suggestions.',

  'Die Office-Umwandlung ist hier nicht verfügbar. Bitte MoinPDF direkt in einem aktuellen Browser öffnen.':
    'Office conversion is unavailable here. Please open MoinPDF directly in an up-to-date browser.',
  'CBR ist nur mit eingerichtetem RAR-Konverter verfügbar. Alternativ CBZ auswählen.':
    'CBR requires a configured RAR converter. Alternatively, choose CBZ.',
  'AZW3 übernimmt auslesbaren Text. Jede Seite muss Text enthalten; Bilder und Seitenlayout werden nicht übernommen.':
    'AZW3 uses extractable text. Every page must contain text; images and page layout are not included.',
  'Eine moderne deutsche Handschriftzeile markieren. Historische Schrift, vollständige Seiten und mehrere Zeilen in einem Bereich werden nicht unterstützt.':
    'Select one line of modern German handwriting. Historical scripts, whole pages and multiple lines in a single region are not supported.',
  'PDF-Seiten als Comicarchiv mit JPEG- oder PNG-Bildern exportieren.':
    'Export PDF pages as a comic archive with JPEG or PNG images.',
  'Auslesbaren Text als EPUB oder AZW3 für Kindle exportieren.':
    'Export extractable text as EPUB or AZW3 for Kindle.',
  'PDF-Seiten als PPTX oder ODP mit Folienbildern oder bearbeitbaren Textobjekten exportieren.':
    'Export PDF pages as PPTX or ODP with slide images or editable text objects.',
  'Eine bearbeitbare DOCX-, RTF- oder ODT-Datei erstellen.':
    'Create an editable DOCX, RTF or ODT file.',
  'Office-Dateien als PDF speichern, einschließlich WordPerfect, Microsoft Works und ODG.':
    'Save Office files as PDF, including WordPerfect, Microsoft Works and ODG.',
  'Spalten automatisch erkennen': 'Detect columns automatically',
  'Nahe Fortsetzungszeilen zu einer Zelle verbinden':
    'Join nearby continuation lines into one cell',
  'Spalten werden je Seite aus wiederkehrenden Abständen erkannt. Bei abweichender Spaltenzahl manuelle Grenzen verwenden, zum Beispiel 35, 65. Markierte Zellen und verbundene Überschriften am Original prüfen.':
    'Columns are detected from recurring gaps on each page. If column counts differ, use manual boundaries such as 35, 65. Check highlighted cells and merged headings against the original.',
  'Eine Zelle auswählen, um ihre Fundstelle zu sehen. Gelb markierte Werte benötigen besondere Kontrolle.':
    'Select a cell to see its source location. Check values highlighted in yellow carefully.',
  'Fundstelle prüfen': 'Check source location',
  Zellfundstelle: 'Cell source',
  'Zu viele Textstellen im Tabellenbereich. Bitte den Bereich verkleinern.':
    'Too many text items in the table area. Please select a smaller area.',
  'Die erkannten Spalten unterscheiden sich zwischen den Seiten. Bitte Spaltengrenzen manuell festlegen oder Seiten einzeln übernehmen.':
    'Detected column counts differ between pages. Set column boundaries manually or extract pages individually.',
  'Maximal 100 Tabellenspalten.': 'Up to 100 table columns.',
  'Maximal 10.000 Tabellenzeilen.': 'Up to 10,000 table rows.',
  'Felder und Beschriftungen erkennen': 'Detect fields and labels',
  'Formularfelder und Beschriftungen werden erkannt …': 'Detecting form fields and labels …',
  'Die Formularerkennung hat eine unerwartete Seitenzahl geliefert.':
    'Form detection returned an unexpected number of pages.',
  'Layout und bearbeitbare Inhalte bitte an der Ausgabe prüfen.':
    'Please check the layout and editable content in the output.',
  'Beim ersten Öffnen werden zusätzliche Programmdaten geladen. Höchstens 40 MB pro Office-Datei.':
    'Additional program data is downloaded on first use. Up to 40 MB per Office file.',
  'Text, Tabellen und Bilder werden übernommen; komplexe Layouts können abweichen.':
    'Text, tables and images are included; complex layouts may differ.',

  'Seiten ohne auslesbaren Text sind mit leerem Text enthalten. Bei Bedarf zuerst OCR ausführen.':
    'Pages without extractable text are included with empty text. Run OCR first if needed.',
  'AZW3 wird auf dem eigenen Dokumentenserver mit Calibre erstellt. Die PDF wird erst beim Start dorthin übertragen.':
    'AZW3 is created on your own document server using Calibre. The PDF is only transferred when you start.',
  'Office-Dateien als PDF speichern; WordPerfect, Microsoft Works und ODG über den eigenen Server.':
    'Save Office files as PDF; convert WordPerfect, Microsoft Works and ODG using your own server.',
  'Eine bearbeitbare DOCX-Datei erstellen; RTF und ODT über den eigenen Server exportieren.':
    'Create an editable DOCX file; export RTF and ODT using your own server.',
  'PDF-Seiten als PPTX-Folienbilder oder bearbeitbare Textobjekte exportieren; ODP über den eigenen Server.':
    'Export PDF pages as PPTX slide images or editable text objects; export ODP using your own server.',
  'Auslesbaren Text als EPUB oder über den eigenen Server als AZW3 für Kindle exportieren.':
    'Export extractable text as EPUB or as AZW3 for Kindle using your own server.',
  'Text, Seiten und Fundstellen als JSON oder XML zur Weiterverarbeitung exportieren.':
    'Export text, pages and source locations as JSON or XML for further processing.',
  'PDF-Text zu JSON & XML': 'PDF text to JSON & XML',
  'Text- oder Datendatei': 'Text or data file',
  Eingabeformat: 'Input format',
  Zeichenkodierung: 'Character encoding',
  'CSV-Trennzeichen': 'CSV delimiter',
  'Erste Zeile als Tabellenkopf': 'First row as table header',
  'XML-Darstellung': 'XML presentation',
  'Pfade und Werte': 'Paths and values',
  'Datensätze als Tabelle': 'Records as a table',
  Tabulator: 'Tab',
  Richtung: 'Direction',
  'PDF zu JSON': 'PDF to JSON',
  'JSON zu PDF': 'JSON to PDF',
  'PDF-JSON-Datei': 'PDF JSON file',
  'PDF-Struktur exportieren': 'Export PDF structure',
  'PDF wiederherstellen': 'Rebuild PDF',
  Comicformat: 'Comic format',
  'CBR (RAR, optional)': 'CBR (RAR, optional)',
  'Comicarchiv erstellen': 'Create comic archive',
  Bildrauschen: 'Image noise',
  'Leichte Drehung (Grad)': 'Slight rotation (degrees)',
  'Unschärfe (Pixel)': 'Blur (pixels)',
  'Scannereffekt anwenden': 'Apply scanner effect',
  'JavaScript anzeigen': 'View JavaScript',
  'LlamaIndex-JSON erstellen': 'Create LlamaIndex JSON',
  'E-Book-Format': 'E-book format',
  'XML exportieren': 'Export XML',
  'Lokal im Browser. Bis 300.000 Zeichen, Tabellen mit höchstens 12 Spalten und 2.000 Zeilen. Markdown unterstützt Überschriften, Listen, Tabellen und Code; Bilder erscheinen als Alternativtext, HTML als Text. Externe Inhalte werden nicht geladen.':
    'Locally in the browser. Up to 300,000 characters, tables with up to 12 columns and 2,000 rows. Markdown supports headings, lists, tables and code; images appear as alternative text and HTML as text. External content is not loaded.',
  'Vollständige PDF-Objektstruktur im QPDF-JSON-Format 2, einschließlich eingebetteter Stream-Daten. Unterstützt die Rückumwandlung dieses Formats; beliebige JSON-Dateien und Bento-/CPDF-JSON werden nicht unterstützt.':
    'Complete PDF object structure in QPDF JSON format 2, including inline stream data. Supports rebuilding PDFs from this format; arbitrary JSON and Bento/CPDF JSON are not supported.',
  'Bis 80 MB und 200 PDF-Seiten. Enthält möglicherweise aktive Inhalte. Eine Rückumwandlung bewahrt keine gültigen digitalen Signaturen und ist keine Bereinigung.':
    'Up to 80 MB and 200 PDF pages. May contain active content. Rebuilding does not preserve valid digital signatures and does not sanitize the document.',
  'Eine Bilddatei pro Seite in natürlicher Lesereihenfolge. Bis 200 Seiten, 80 MB Bilddaten und 16 Megapixel je Seite. Textsuche und interaktive Elemente werden nicht übernommen.':
    'One image per page in natural reading order. Up to 200 pages, 80 MB of image data and 16 megapixels per page. Searchable text and interactive elements are not retained.',
  'CBR benötigt einen eigenen Dokumentenserver mit separat installiertem und passend lizenziertem RAR-Konverter. CBZ wird lokal im Browser erstellt.':
    'CBR requires your own document server with a separately installed and appropriately licensed RAR converter. CBZ is created locally in the browser.',
  'Erzeugt eine Bild-PDF im Scannerstil. Die Vorschau zeigt die fertige Ausgabe. Textsuche, Links, Formulare, Anhänge und digitale Signaturen werden nicht übernommen.':
    'Creates an image PDF with a scanner effect. The preview shows the finished output. Searchable text, links, forms, attachments and digital signatures are not retained.',
  'Zeigt JavaScript-Aktionen aus der PDF-Objektstruktur als Text. Skripte werden nicht ausgeführt. Dies ist keine Prüfung der Sicherheit des Dokuments.':
    'Shows JavaScript actions from the PDF object structure as text. Scripts are not executed. This does not assess document safety.',
  'Keine JavaScript-Einträge in der untersuchten PDF-Objektstruktur gefunden.':
    'No JavaScript entries found in the inspected PDF object structure.',
  'Dieser Skripteintrag konnte nicht dekodiert werden.': 'This script entry could not be decoded.',
  'Exportiert ein LlamaIndex-Dokument je PDF-Seite mit Text, Dateiname und Seitenangaben. Keine KI-Abfrage und kein Upload. Bilder und Tabellenlayout werden nicht übernommen; Scans vorher mit OCR bearbeiten.':
    'Exports one LlamaIndex document per PDF page with text, file name and page metadata. No AI request and no upload. Images and table layout are not included; run OCR on scans first.',
  'PDF aus vollständiger Objektstruktur wiederhergestellt. Aktive Inhalte können enthalten sein; bestehende digitale Signaturen werden nicht wiederhergestellt.':
    'PDF rebuilt from its complete object structure. Active content may be present; existing digital signatures are not restored.',
  'LlamaIndex-Dokumente mit einem Texteintrag pro PDF-Seite. Bilder, Tabellenlayout und eingebettete Dateien sind nicht enthalten.':
    'LlamaIndex documents with one text entry per PDF page. Images, table layout and embedded files are not included.',
  'Neue Bild-PDF: Textsuche, Links, Formulare, Anhänge und digitale Signaturen werden nicht übernommen.':
    'New image PDF: searchable text, links, forms, attachments and digital signatures are not retained.',
  'Die Konvertierung erfolgt auf dem eigenen Dokumentenserver. Layout und bearbeitbare Inhalte bitte an der Ausgabe prüfen.':
    'Conversion runs on your own document server. Check layout and editable content in the output.',
  'Office, Pages, Visio, Publisher, WordPerfect, Works oder Draw':
    'Office, Pages, Visio, Publisher, WordPerfect, Works or Draw',
  'EPUB, FB2, MOBI, AZW3, CBZ, CBR, XPS oder OXPS': 'EPUB, FB2, MOBI, AZW3, CBZ, CBR, XPS or OXPS',
  'EPUB, FB2, MOBI und AZW3 werden neu gesetzt. Comicarchive, XPS und OXPS behalten ihr Seitenformat. Höchstens 40 MB und 200 Seiten; Comicarchive mit PNG- oder JPEG-Bildern. Kein DRM.':
    'EPUB, FB2, MOBI and AZW3 are reflowed. Comic archives, XPS and OXPS retain their page format. Up to 40 MB and 200 pages; comic archives with PNG or JPEG images. No DRM.',
  'Bitte eine Textdatei mit höchstens 2 MB auswählen.': 'Select a text file up to 2 MB.',
  'Die Zeichenkodierung passt nicht zur Datei. Bitte eine andere Kodierung wählen.':
    'The character encoding does not match the file. Select another encoding.',
  'Bitte eine Textdatei mit 1 bis 300.000 Zeichen verwenden.':
    'Use a text file containing 1 to 300,000 characters.',
  'Bitte höchstens 12 Spalten und 2.000 Datensätze verwenden.':
    'Use up to 12 columns and 2,000 records.',
  'Bitte höchstens 12 Spalten verwenden.': 'Use up to 12 columns.',
  'Bitte höchstens 2.000 Tabellenzeilen verwenden.': 'Use up to 2,000 table rows.',
  'Das Markdown ist zu stark verschachtelt.': 'The Markdown is nested too deeply.',
  'Die CSV konnte nicht gelesen werden. Bitte Trennzeichen und Anführungszeichen prüfen.':
    'The CSV could not be read. Check delimiters and quotation marks.',
  'Die CSV-Zeilen haben unterschiedlich viele Spalten. Bitte das Trennzeichen prüfen.':
    'The CSV rows have different column counts. Check the delimiter.',
  'Die Markdown-Tabelle ist zu groß.': 'The Markdown table is too large.',
  'Die Tabelle enthält keine Daten.': 'The table contains no data.',
  'Die XML-Datei enthält keine Werte.': 'The XML file contains no values.',
  'Die XML-Datei ist nicht wohlgeformt.': 'The XML file is not well formed.',
  'Die XML-Datei ist zu groß oder zu stark verschachtelt.':
    'The XML file is too large or nested too deeply.',
  'Eine CSV-Zelle hat kein schließendes Anführungszeichen.':
    'A CSV cell is missing its closing quotation mark.',
  'Für eine XML-Tabelle müssen die direkten Unterelemente gleichartige Datensätze sein.':
    'An XML table requires direct child elements containing records of the same type.',
  'Gemischte XML-Inhalte bitte als Baum ausgeben.': 'Export mixed XML content as paths and values.',
  'Unbekanntes Textformat.': 'Unknown text format.',
  'Ungültige CSV-Anführungszeichen.': 'Invalid CSV quotation marks.',
  'Ungültiges CSV-Trennzeichen.': 'Invalid CSV delimiter.',
  'Verschachtelte oder wiederholte XML-Felder bitte als Baum ausgeben.':
    'Export nested or repeated XML fields as paths and values.',
  'XML mit DTD oder Entitäten wird nicht unterstützt.':
    'XML with a DTD or entities is not supported.',
  'Bitte eine JSON-Datei mit höchstens 80 MB verwenden.': 'Use a JSON file up to 80 MB.',
  'Bitte einen vollständigen QPDF-JSON-Export auswählen.': 'Select a complete QPDF JSON export.',
  'Das Comicarchiv überschreitet 80 MB. Bitte die Auflösung verringern.':
    'The comic archive exceeds 80 MB. Reduce the resolution.',
  'Der JSON-Export enthält keine vollständigen eingebetteten Stream-Daten.':
    'The JSON export does not contain complete inline stream data.',
  'Die Ausgabe überschreitet 80 MB. Bitte die Auflösung verringern.':
    'The output exceeds 80 MB. Reduce the resolution.',
  'Die JSON-Ausgabe überschreitet 80 MB.': 'The JSON output exceeds 80 MB.',
  'Die JSON-Datei ist nicht gültig.': 'The JSON file is invalid.',
  'Die PDF-JSON-Struktur ist zu groß oder zu tief verschachtelt.':
    'The PDF JSON structure is too large or nested too deeply.',
  'Die PDF-Struktur ist zu umfangreich für die Skriptprüfung.':
    'The PDF structure is too large for script inspection.',
  'Die eingebetteten Skripte überschreiten die Anzeigegrenze.':
    'The embedded scripts exceed the display limit.',
  'Die wiederhergestellte PDF überschreitet 80 MB oder 200 Seiten.':
    'The rebuilt PDF exceeds 80 MB or 200 pages.',
  'Eine Seite überschreitet 16 Megapixel. Bitte eine niedrigere Auflösung wählen.':
    'A page exceeds 16 megapixels. Select a lower resolution.',
  'Externe Stream-Dateien sind nicht erlaubt. Bitte einen JSON-Export mit eingebetteten Daten verwenden.':
    'External stream files are not allowed. Use a JSON export with inline data.',
  'Ungültige Bildauflösung.': 'Invalid image resolution.',
  'Ungültige Einstellungen für den Scannereffekt.': 'Invalid scanner effect settings.',
  'Ungültiger QPDF-JSON-Export (Version 2 erforderlich).':
    'Invalid QPDF JSON export (version 2 required).',
  'Ungültiges Bildformat.': 'Invalid image format.',
  'Der Server unterstützt den AZW3-Export noch nicht. Bitte den Dokumentenserver aktualisieren.':
    'This server does not support AZW3 export yet. Update the document server.',
  'CBR unterstützt ausschließlich PNG- und JPEG-Seiten.': 'CBR only supports PNG and JPEG pages.',
  'CBR-Erstellung benötigt einen separat installierten und passend lizenzierten RAR-Konverter.':
    'Creating CBR requires a separately installed and appropriately licensed RAR converter.',
  'Comicarchive dürfen höchstens 200 Bildseiten enthalten.':
    'Comic archives must not contain more than 200 image pages.',
  'Das CBR-Archiv enthält unzulässige oder zu viele Einträge.':
    'The CBR archive contains invalid or too many entries.',
  'Das CBR-Archiv ist beschädigt, verschlüsselt oder nicht unterstützt.':
    'The CBR archive is damaged, encrypted or unsupported.',
  'Das Comicarchiv enthält keine Bildseiten.': 'The comic archive contains no image pages.',
  'Das Comicarchiv enthält zu große oder ungültige Bilder.':
    'The comic archive contains oversized or invalid images.',
  'Das Format konnte nicht konvertiert werden. Datei, DRM-Schutz und Serverkonverter prüfen.':
    'The format could not be converted. Check the file, DRM protection and server converter.',
  'Das entpackte Comicarchiv überschreitet 80 MB.': 'The expanded comic archive exceeds 80 MB.',
  'Der E-Book-Export überschreitet zwei Millionen Zeichen.':
    'The e-book export exceeds two million characters.',
  'Der Konverter hat keine gültige Ausgabe bis 80 MB erzeugt.':
    'The converter did not produce valid output up to 80 MB.',
  'Der benötigte Formatkonverter ist auf diesem Server nicht installiert.':
    'The required format converter is not installed on this server.',
  'Die CBR-Datei enthält kein RAR-Archiv.': 'The CBR file does not contain a RAR archive.',
  'Die Datei enthält kein unterstütztes MOBI-/AZW3-E-Book.':
    'The file does not contain a supported MOBI/AZW3 e-book.',
  'Mindestens eine Seite enthält keinen auslesbaren Text. Bitte vor dem AZW3-Export OCR ausführen.':
    'At least one page contains no readable text. Run OCR before exporting AZW3.',
  'Ungültige AZW3-Ausgabe.': 'Invalid AZW3 output.',
  'Ungültige Comic-Einstellungen.': 'Invalid comic settings.',
  'Ungültige E-Book-Sprache.': 'Invalid e-book language.',
  'Ungültige OpenDocument-Ausgabe.': 'Invalid OpenDocument output.',
  'Ungültige RAR-Ausgabe.': 'Invalid RAR output.',
  'Ungültige RTF-Ausgabe.': 'Invalid RTF output.',
  'Ungültiger Archivname.': 'Invalid archive name.',
  'Unzulässiger CBR-Eintrag.': 'Invalid CBR entry.',
  'Verknüpfungen im CBR-Archiv werden nicht unterstützt.':
    'Links in CBR archives are not supported.',
  'Die Datei enthält kein gültiges WordPerfect-Dokument.':
    'The file does not contain a valid WordPerfect document.',
  'Die Datei enthält kein unterstütztes Microsoft-Works-Dokument.':
    'The file does not contain a supported Microsoft Works document.',
  'Die Datei enthält kein gültiges RTF-Dokument.':
    'The file does not contain a valid RTF document.',
  'Die Datei enthält kein gültiges OpenDocument-Zeichnungsdokument.':
    'The file does not contain a valid OpenDocument drawing.',
  'Ungültige Ausgabeoptionen.': 'Invalid output options.',
  'Markdown-, TXT-, CSV- oder XML-Datei bis 2 MB und 300.000 Zeichen.':
    'A Markdown, TXT, CSV or XML file up to 2 MB and 300,000 characters.',
  'Datei und Eingabeformat wählen; bei Bedarf die Zeichenkodierung ändern.':
    'Choose a file and input format; change the character encoding if necessary.',
  'Papierformat, Ausrichtung und bei CSV Trennzeichen und Tabellenkopf festlegen. XML kann Pfade und Werte oder einfache gleichartige Datensätze zeigen.':
    'Set paper size, orientation and CSV delimiter and header. XML can show paths and values or simple uniform records.',
  'PDF erstellen und Seitenumbrüche sowie alle Spalten in der Ergebnisvorschau prüfen.':
    'Create the PDF and check page breaks and all columns in the result preview.',
  'Neue PDF mit eingebetteten Schriften, Text und Tabellen.':
    'New PDF with embedded fonts, text and tables.',
  'Bis 12 Spalten und 2.000 Tabellenzeilen. Markdown-Bilder werden als Alternativtext ausgegeben; HTML wird nicht ausgeführt. XML mit DTD oder Entitäten wird abgelehnt. Rechnungs-XML kann weiterhin im Rechnungsarbeitsplatz geöffnet werden.':
    'Up to 12 columns and 2,000 table rows. Markdown images are represented by alternative text; HTML is not executed. XML with DTDs or entities is rejected. Invoice XML can still be opened in the invoice workspace.',
  'PDF oder vollständiger QPDF-JSON-Export der Version 2.':
    'A PDF or complete QPDF JSON version 2 export.',
  'Richtung PDF zu JSON oder JSON zu PDF wählen.': 'Choose PDF to JSON or JSON to PDF.',
  'PDF öffnen beziehungsweise JSON-Datei auswählen.': 'Open the PDF or select the JSON file.',
  'Exportieren beziehungsweise PDF wiederherstellen und das Ergebnis prüfen.':
    'Export or rebuild the PDF and inspect the result.',
  'Vollständige PDF-Objektstruktur mit eingebetteten Stream-Daten oder daraus wiederhergestellte PDF.':
    'Complete PDF object structure with inline stream data, or a PDF rebuilt from it.',
  'Bis 80 MB und 200 Seiten. Beliebige JSON-Dateien, Bento-/CPDF-JSON und externe Stream-Dateien sind nicht unterstützt. Aktive Inhalte bleiben möglicherweise erhalten; digitale Signaturen werden ungültig.':
    'Up to 80 MB and 200 pages. Arbitrary JSON, Bento/CPDF JSON and external stream files are unsupported. Active content may be retained; digital signatures become invalid.',
  'Eine PDF mit höchstens 200 Seiten.': 'A PDF with up to 200 pages.',
  'Auflösung, Bildrauschen, Drehung, Unschärfe und Graustufen einstellen.':
    'Set resolution, image noise, rotation, blur and grayscale.',
  'Scannereffekt anwenden und die fertigen Seiten in der Vorschau prüfen.':
    'Apply the scanner effect and inspect the finished pages in the preview.',
  'Bei Bedarf Einstellungen ändern; anschließend PDF herunterladen oder übernehmen.':
    'Adjust settings if needed, then download or adopt the PDF.',
  'Neue Bild-PDF im Scannerstil.': 'New image PDF with a scanner effect.',
  'Textsuche, Links, Formulare, Anlagen und digitale Signaturen entfallen. Drehung wird ohne abgeschnittene Seitenecken eingepasst. Höchstens 16 Megapixel je Seite und 80 MB Bilddaten.':
    'Searchable text, links, forms, attachments and digital signatures are removed. Rotated sheets are fitted without cutting off corners. Up to 16 megapixels per page and 80 MB of image data.',
  'Eine PDF; für CBR zusätzlich ein eigener Server mit RAR-Konverter.':
    'A PDF; CBR additionally requires your own server with a RAR converter.',
  'CBZ oder optional CBR auswählen.': 'Choose CBZ or optional CBR.',
  'Bildformat und Auflösung festlegen. CBR benötigt eine verfügbare Serverkomponente.':
    'Set image format and resolution. CBR requires an available server component.',
  'Comicarchiv erstellen und im gewünschten Comicreader prüfen.':
    'Create the comic archive and inspect it in a comic reader.',
  'CBZ- oder CBR-Datei mit einer nummerierten Bilddatei pro Seite.':
    'CBZ or CBR file with one numbered image per page.',
  'CBZ läuft lokal. RAR wird nicht mitgeliefert; Betreiber müssen ein kompatibles, passend lizenziertes Programm installieren. Bis 200 Seiten und 80 MB Bilddaten.':
    'CBZ runs locally. RAR is not bundled; operators must install a compatible, appropriately licensed program. Up to 200 pages and 80 MB of image data.',
  'PDF mit auslesbarem Text; Scans vorher mit OCR bearbeiten.':
    'PDF with readable text; run OCR on scans first.',
  'PDF auswählen und LlamaIndex-JSON erstellen.': 'Select a PDF and create LlamaIndex JSON.',
  'Seitenmetadaten und Hinweise auf Seiten ohne Text prüfen.':
    'Check page metadata and notices about pages without text.',
  'JSON in einer eigenen Verarbeitung mit LlamaIndex Document.from_dict einlesen.':
    'Import JSON into your own processing with LlamaIndex Document.from_dict.',
  'JSON-Liste mit einem LlamaIndex-Dokument pro PDF-Seite.':
    'JSON list containing one LlamaIndex document per PDF page.',
  'Keine KI-Abfrage, kein Upload und kein API-Schlüssel. Bis zwei Millionen Zeichen; Bilder und Tabellenlayout entfallen. Seiten ohne Text bleiben als leere Einträge erhalten.':
    'No AI request, upload or API key. Up to two million characters; images and table layout are omitted. Pages without text remain as empty entries.',
  'Eine PDF, auch mit eingebetteten Skriptaktionen.':
    'A PDF, including PDFs with embedded script actions.',
  'PDF auswählen und JavaScript anzeigen.': 'Select a PDF and view JavaScript.',
  'Fundstellen aufklappen und Skripte als Text lesen. Nicht dekodierbare Einträge werden gekennzeichnet.':
    'Expand locations and read scripts as text. Undecodable entries are marked.',
  'Bei Bedarf den Bericht als JSON herunterladen.': 'Download the JSON report if needed.',
  'Skripttexte mit Fundstelle in der PDF-Objektstruktur.':
    'Script text with its location in the PDF object structure.',
  'Keine Skriptausführung und keine Sicherheitsfreigabe. Bis 500 Einträge, eine Million Zeichen je Skript und acht Millionen insgesamt. Eingebettete andere Dokumente werden nicht rekursiv untersucht.':
    'No script execution or security clearance. Up to 500 entries, one million characters per script and eight million in total. Other embedded documents are not recursively inspected.',
  'WordPerfect (WPD), Microsoft Works (WPS) und OpenDocument Draw (ODG) über den eigenen Dokumentenserver importieren. WPS bezeichnet Microsoft Works, nicht WPS Office.':
    'Import WordPerfect (WPD), Microsoft Works (WPS) and OpenDocument Draw (ODG) through your own document server. WPS means Microsoft Works, not WPS Office.',
  'Zusätzlich werden ungeschützte MOBI- und AZW3-Dateien sowie CBR-Comicarchive unterstützt. Calibre und libarchive sind im Dokumentenserver enthalten.':
    'Unprotected MOBI and AZW3 files and CBR comic archives are also supported. Calibre and libarchive are included in the document server.',
  'Als Ausgabeformat zusätzlich RTF oder ODT wählen. Diese Formate benötigen den eigenen Dokumentenserver und werden aus der rekonstruierten Word-Datei erzeugt.':
    'You can also choose RTF or ODT output. These formats require your own document server and are produced from the reconstructed Word file.',
  'Als Ausgabeformat zusätzlich ODP wählen. Der gewählte Bild- oder Bearbeitungsmodus wird übernommen; die Konvertierung benötigt LibreOffice auf dem eigenen Server.':
    'You can also choose ODP output. The selected image or editable mode is retained; conversion requires LibreOffice on your own server.',
  'EPUB wird lokal erstellt. AZW3 benötigt den eigenen Dokumentenserver; jede Seite muss Text enthalten. Bilder und ursprüngliches Layout werden bei dieser Textausgabe nicht übernommen.':
    'EPUB is created locally. AZW3 requires your own document server; every page must contain text. Images and original layout are not retained in this text export.',
  'JSON oder XML als Ausgabeformat wählen. XML verwendet das Schema moinpdf-document/1 mit Dokumenten, Seiten und Textpositionen; ursprüngliche XML-Daten werden nicht rekonstruiert.':
    'Choose JSON or XML output. XML uses the moinpdf-document/1 schema with documents, pages and text positions; original XML data is not reconstructed.',
  'Text & Daten zu PDF': 'Text & data to PDF',
  'Markdown, TXT, CSV und XML lokal mit Seitenformat, Tabellen und Zeichensatz in PDF umwandeln.':
    'Convert Markdown, TXT, CSV and XML locally to PDF with page, table and character encoding options.',
  'PDF erstellen': 'Create PDF',
  'PDF & JSON umwandeln': 'Convert PDF & JSON',
  'Vollständige PDF-Objektstruktur mit eingebetteten Daten exportieren und aus QPDF-JSON wiederherstellen.':
    'Export the complete PDF object structure with inline data and rebuild PDFs from QPDF JSON.',
  'PDF und JSON umwandeln': 'Convert PDF and JSON',
  Scannereffekt: 'Scanner effect',
  'Eine Bild-PDF mit einstellbarem Rauschen, leichter Drehung, Unschärfe und Graustufen erstellen.':
    'Create an image PDF with adjustable noise, slight rotation, blur and grayscale.',
  'PDF zu Comicarchiv': 'PDF to comic archive',
  'PDF-Seiten als CBZ mit JPEG- oder PNG-Bildern exportieren; CBR mit optionalem Serverkonverter.':
    'Export PDF pages as CBZ with JPEG or PNG images; CBR requires an optional server converter.',
  'PDF für KI vorbereiten': 'Prepare PDF for AI',
  'Text und Seitenmetadaten lokal als LlamaIndex-Dokumente exportieren. Keine KI-API erforderlich.':
    'Export text and page metadata locally as LlamaIndex documents. No AI API required.',
  'PDF-JavaScript anzeigen': 'View PDF JavaScript',
  'Eingebettete JavaScript-Aktionen als Text ansehen und exportieren, ohne Skripte auszuführen.':
    'Inspect and export embedded JavaScript actions as text without executing scripts.',
  'Belege mit Zahlungen abgleichen': 'Match receipts to payments',
  'Buchungen und Belege prüfen, Teilzahlungen zuordnen und fehlende Belege oder Überzahlungen erkennen.':
    'Review transactions and receipts, allocate partial payments and find missing receipts or overpayments.',
  'E-Rechnung erstellen': 'Create e-invoice',
  'Rechnungsdaten erfassen und als XRechnung oder ZUGFeRD mit unabhängiger Prüfung ausgeben.':
    'Enter invoice data and create XRechnung or ZUGFeRD with independent validation.',
  'PDF-Portfolio erstellen': 'Create PDF portfolio',
  'PDFs, Tabellen, E-Mails und Bilder als unveränderte Einzeldateien in einem Portfolio sammeln.':
    'Collect PDFs, spreadsheets, emails and images as unchanged individual files in a portfolio.',
  'Personenbezogene Angaben erkennen': 'Find personal data',
  'Lokale Erkennungsvorschläge prüfen und gleiche Angaben dokumentübergreifend durch Platzhalter ersetzen.':
    'Review local detection suggestions and replace matching data with consistent placeholders across documents.',
  'Handschrift erkennen': 'Recognize handwriting',
  'Moderne deutsche Handschrift zeilenweise erkennen, am Original korrigieren und als Suchtext ausgeben.':
    'Recognize modern German handwriting line by line, correct against the original and export searchable text.',
  'PDF/X-Druckdatei erstellen': 'Create PDF/X print file',
  'CMYK-Profil und Endformat festlegen; PDF/X-3 mit unabhängigem technischen Teilprüfbericht erzeugen.':
    'Set a CMYK profile and trim size; create PDF/X-3 with an independent technical partial-check report.',
  'Kontoauszug zu DATEV': 'Bank statement to DATEV',
  'PDF-Kontoauszüge einlesen, Buchungen und Salden prüfen und mit eigenen Konten als DATEV-Buchungsstapel exportieren.':
    'Read PDF bank statements, review entries and balances, and export a DATEV posting batch with your own accounts.',
  'Kontoauszug prüfen': 'Review bank statement',
  'Große PDFs verarbeiten': 'Process large PDFs',
  'Bis 1.000 Seiten in lokal gespeicherten Abschnitten bearbeiten, unterbrechen und fortsetzen. Alle Seiten vor der Gesamtausgabe prüfen.':
    'Process up to 1,000 pages in locally saved sections, pause and resume. Verify every page before exporting the complete file.',
  'Große PDF vorbereiten': 'Prepare large PDF',
  'Kopf- und Fußzeilen bereinigen': 'Clean up headers and footers',
  'Wiederkehrende Randtexte und Seitenzahlen erkennen, Fundstellen prüfen und ausgewählte Kopf- oder Fußbereiche entfernen.':
    'Find recurring margin text and page numbers, review matches and remove selected header or footer areas.',
  'Randbereiche bereinigen': 'Clean up margins',
  Formularhelfer: 'Form helper',
  'Wiederkehrende Angaben in lokalen Profilen speichern, Formularfelder zuordnen und Einträge auf Scans platzieren.':
    'Save recurring details in local profiles, match form fields and place entries on scans.',
  'Formular vorbereiten': 'Prepare form',
  'Belege auf A4 sammeln': 'Collect receipts on A4',
  'Kassenbons und Quittungen zuschneiden, beschriften und in lesbarer Größe auf A4-Blättern anordnen.':
    'Crop and label receipts, then arrange them at a readable size on A4 sheets.',
  'Belege zusammenstellen': 'Arrange receipts',
  'Klar Schiff': 'Clear Deck',
  'Dokumentenstapel automatisch erkennen, sortieren und aufteilen. Zuordnungen prüfen und als einzelne PDFs oder geordnete Mappe mitnehmen.':
    'Recognise, organise and split document piles. Review assignments and download individual PDFs or an organised bundle.',
  'Stapel erkennen': 'Recognise documents',
  'Lokaler PDF-Assistent': 'Local PDF assistant',
  'Fragen mit einem lokalen Sprachmodell beantworten und Originalzitate direkt auf den PDF-Seiten überprüfen.':
    'Answer questions with a local language model and check quotations directly on the original PDF pages.',
  'Lokal beantworten': 'Answer locally',
  'PDF-Objekte bearbeiten': 'Edit PDF objects',
  'Originaltexte ändern, Absätze mit Schriftwahl neu umbrechen sowie Bilder und Grafiken bearbeiten.':
    'Edit original text, reflow paragraphs with your chosen font, and edit images and graphics.',
  'Objekte bearbeiten': 'Edit objects',
  'Bates-Nummerierung': 'Bates numbering',
  'Mehrere PDFs fortlaufend mit Aktennummern, Dateinamen und Kopf- oder Fußzeilen kennzeichnen.':
    'Apply continuous numbering across multiple PDFs with case numbers, filenames and headers or footers.',
  'Nummerierung anwenden': 'Apply numbering',
  Seitenbezeichnungen: 'Page labels',
  'Römische, alphabetische oder eigene Seitenbezeichnungen für die PDF-Navigation festlegen.':
    'Set Roman, alphabetic or custom page labels for document navigation.',
  'Bezeichnungen speichern': 'Save labels',
  'Frei drehen': 'Rotate freely',
  'Seiten um beliebige Winkel drehen und die Seitengröße automatisch anpassen.':
    'Rotate pages by any angle and automatically adjust the page size.',
  'Seiten drehen': 'Rotate pages',
  'Lange PDF-Seite': 'Continuous PDF page',
  'Mehrere Seiten als durchgehende Seite zum Scrollen verbinden. Text und Vektorgrafiken erhalten.':
    'Combine multiple pages into one continuous page for scrolling. Preserve text and vector graphics.',
  'Lange Seite erstellen': 'Create continuous page',
  Posterdruck: 'Poster printing',
  'Große Seiten auf mehrere Druckkacheln verteilen, mit einstellbarer Überlappung.':
    'Split large pages across multiple print tiles with adjustable overlap.',
  'Poster aufteilen': 'Split poster',
  'Schnelle Webansicht': 'Fast web view',
  'PDFs so vorbereiten, dass die erste Seite vor der vollständigen Datei geladen werden kann.':
    'Prepare PDFs so the first page can load before the whole file.',
  'Webansicht optimieren': 'Optimise web view',
  'PDF zu Vektor-SVG': 'PDF to vector SVG',
  'Jede PDF-Seite als eigenständige SVG-Datei exportieren. Vektorgrafiken und Schriftkonturen bleiben scharf.':
    'Export each PDF page as a standalone SVG file. Vector graphics and glyph outlines remain sharp.',
  'SVG-Dateien exportieren': 'Export SVG files',
  'Schriften in Pfade': 'Fonts to outlines',
  'Schriftzeichen als feste Vektorkonturen exportieren, unabhängig von installierten Schriften.':
    'Export characters as fixed vector outlines, independent of installed fonts.',
  'Schriftkonturen erstellen': 'Create outlines',
  'Ebenen dauerhaft reduzieren': 'Flatten layers',
  'Die anfänglich sichtbaren Ebenen als feste PDF-Ansicht speichern und ausgeblendete Ebenen entfernen.':
    'Save the initially visible layers as a fixed PDF view and remove hidden layers.',
  'Ebenen reduzieren': 'Flatten layers',
  'PDF zu strukturiertem JSON': 'PDF to structured JSON',
  'Text, Seiten und Fundstellen als strukturierte Daten zur Weiterverarbeitung exportieren.':
    'Export text, pages and source locations as structured data for further processing.',
  'JSON exportieren': 'Export JSON',
  'Formularrückläufe auswerten': 'Collect form responses',
  'Ausgefüllte PDF-Formulare gemeinsam auslesen, Pflichtwerte prüfen und korrigierte Antworten als Excel oder CSV exportieren.':
    'Read completed PDF forms together, check required values and export corrected responses to Excel or CSV.',
  'Formularwerte auslesen': 'Read form values',
  'Dokumente chronologisch ordnen': 'Document chronology',
  'Datumsangaben im Inhalt finden, Reihenfolge prüfen und eine Dokumentenmappe mit anklickbarem Inhaltsverzeichnis erstellen.':
    'Find dates in document content, check the order and create a document bundle with a clickable table of contents.',
  'Daten suchen': 'Find dates',
  'PDF-Rechenprüfung': 'Check calculations',
  'Zahlenbereiche auswählen, Summanden korrigieren und die Summe mit einer angegebenen Gesamtsumme vergleichen.':
    'Select number ranges, correct the values to add and compare their sum with a stated total.',
  'Zahlen übernehmen': 'Collect numbers',
  'PDF-Sicherheitsbereinigung': 'Sanitize PDF',
  'Skripte und riskante Aktionen entfernen. Anhänge, Kommentare und Dokumentmetadaten auf Wunsch ebenfalls bereinigen.':
    'Remove scripts and risky actions. Optionally remove attachments, comments and document metadata too.',
  'Inhalte prüfen': 'Review content',
  'PDF-Ebenen verwalten': 'Manage PDF layers',
  'PDF-Ebenen umbenennen, ihre Reihenfolge und Sichtbarkeit speichern oder die Ansicht als Seitenbilder festschreiben.':
    'Rename PDF layers, save their order and visibility, or flatten the view into page images.',
  'Ebenen laden': 'Load layers',
  'PDF-Maßband': 'PDF measuring tool',
  'Seiten anhand einer bekannten Strecke kalibrieren. Entfernungen und Flächen messen und als markierte PDF oder CSV speichern.':
    'Calibrate pages using a known distance. Measure distances and areas and save them as an annotated PDF or CSV.',
  'Messpunkte setzen': 'Set measurement points',
  'PDF als Hörbuch': 'PDF to audio',
  'Text und OCR-Ergebnisse prüfen. Mit lokalen deutschen oder englischen Stimmen als WAV oder nach Seiten und Kapiteln als Audio-ZIP ausgeben.':
    'Review text and OCR results. Export audio with local German or English voices as WAV or as an audio ZIP organised by pages and chapters.',
  'Vorlesetext vorbereiten': 'Prepare narration text',
  Zahlenvergleich: 'Compare numbers',
  'Geänderte Beträge, Prozentwerte, Daten und IBANs zwischen zwei Fassungen mit Fundstellen anzeigen.':
    'Show changes to amounts, percentages, dates and IBANs between two versions, with source locations.',
  'Zahlen vergleichen': 'Compare numbers',
  'Belegfelder sammeln': 'Collect document fields',
  'Eigene Felder aus mehreren PDFs auslesen, Werte am Original prüfen und gemeinsam nach Excel oder CSV exportieren.':
    'Extract custom fields from multiple PDFs, check values against the original and export them together to Excel or CSV.',
  'Rechnung und XML abgleichen': 'Compare invoice and XML',
  'Sichtbare Rechnungsangaben per OCR mit eingebetteter UBL- oder CII-XML vergleichen. Unklare Werte mit Fundstelle prüfen.':
    'Use OCR to compare visible invoice details with embedded UBL or CII XML. Check uncertain values at their source locations.',
  'Rechnung abgleichen': 'Compare invoice',
  'Dokumentlücken finden': 'Find missing pages',
  'Gedruckte Seitenzählungen wie „Seite 3 von 7“ auf Lücken, Wiederholungen und Sprünge prüfen.':
    'Check printed page numbering, such as “Page 3 of 7”, for gaps, repeats and jumps.',
  'Dokumentlücken suchen': 'Find gaps',
  'OCR-Korrekturhilfe': 'Review OCR',
  'Unsichere Wörter und Zahlen am vergrößerten Originalausschnitt prüfen. Korrigierten Suchtext als PDF oder TXT speichern.':
    'Review uncertain words and numbers in enlarged crops of the original. Save corrected searchable text as PDF or TXT.',
  'OCR prüfen': 'Review OCR',
  'Mehrere Dateien pseudonymisieren': 'Pseudonymize files',
  'Angegebene Namen und andere Begriffe durch einheitliche Platzhalter ersetzen. Treffer prüfen und neue Seitenbilder exportieren.':
    'Replace specified names and other terms with consistent placeholders. Review matches and export new page images.',
  'Platzhalter einsetzen': 'Apply placeholders',
  'Anlagen automatisch verknüpfen': 'Link attachments',
  'Anlagenverweise erkennen, Zielseiten zuordnen und ein PDF-Paket mit anklickbaren Verweisen erstellen.':
    'Detect attachment references, assign target pages and create a PDF bundle with clickable references.',
  'Anlagen verknüpfen': 'Link attachments',
  'Beste Scan-Seiten kombinieren': 'Combine best scans',
  'Ähnliche Seiten aus mehreren Scans vergleichen. Qualitätsvorschläge kontrollieren und Originalseiten neu zusammenstellen.':
    'Compare similar pages from several scans. Review quality suggestions and reassemble the original pages.',
  'Scan-Seiten auswählen': 'Select scan pages',
  'Angebot, Auftrag und Rechnung abgleichen': 'Reconcile business documents',
  'Positionsvorschläge prüfen und Mengen, Einzelpreise und Beträge zwischen zusammengehörigen Dokumenten vergleichen.':
    'Review suggested line items and compare quantities, unit prices and amounts between related documents.',
  'Positionen abgleichen': 'Compare line items',
  'Kommentare als Arbeitsliste exportieren': 'Export comments as tasks',
  'PDF-Kommentare und Markierungen mit Autor, Textauszug und Seite sammeln. Aufgaben bearbeiten und als Excel, CSV oder Markdown speichern.':
    'Collect PDF comments and highlights with author, text excerpt and page. Edit tasks and save them as Excel, CSV or Markdown.',
  'Kommentare sammeln': 'Collect comments',
  'PDF reparieren': 'Repair PDF',
  'Die Struktur beschädigter PDFs wiederherstellen. Direkter Upload auch ohne funktionierende Vorschau.':
    'Restore the structure of damaged PDFs. Upload directly even when a preview is unavailable.',
  'PDF auf Wunschgröße komprimieren': 'Compress to target size',
  'Verlustfrei optimieren oder Bilder verkleinern. Text und Formulare erhalten und die Zielgröße nachmessen.':
    'Optimise losslessly or reduce image sizes. Preserve text and forms and check the output against the target size.',
  'PDF optimieren': 'Optimise PDF',
  'Ausschnitte erstellen': 'Create crops',
  'PDF zu Markdown': 'PDF to Markdown',
  'Auslesbaren Text mit Überschriften und Seitenabschnitten als bearbeitbare Markdown-Datei ausgeben.':
    'Export extractable text with headings and page sections as an editable Markdown file.',
  'Markdown erstellen': 'Create Markdown',
  'PDF zu HTML': 'PDF to HTML',
  'Auslesbaren Text als eigenständige, lesbare HTML-Datei mit Seitennavigation speichern.':
    'Save extractable text as a standalone, readable HTML file with page navigation.',
  'HTML erstellen': 'Create HTML',
  'PDF zu E-Book': 'PDF to e-book',
  'Auslesbaren Text als EPUB mit anpassbarer Schrift und Inhaltsverzeichnis exportieren.':
    'Export extractable text as an EPUB with an adjustable font and a table of contents.',
  'EPUB erstellen': 'Create EPUB',
  'E-Books & Spezialformate zu PDF': 'E-books & special formats to PDF',
  'EPUB, FB2, MOBI, AZW3, Comicarchive (CBZ/CBR), XPS und OXPS in PDF umwandeln. E-Books mit wählbarer Schriftgröße und Seitenformat.':
    'Convert EPUB, FB2, MOBI, AZW3, comic archives (CBZ/CBR), XPS and OXPS to PDF. Choose font size and page format for e-books.',
  'PDF zu PowerPoint': 'PDF to PowerPoint',
  'PDF-Seiten als Folienbilder oder mit einzeln bearbeitbaren Textobjekten auf PowerPoint-Folien übernehmen.':
    'Transfer PDF pages to PowerPoint slides as slide images or individually editable text objects.',
  'PowerPoint-Datei erstellen': 'Create PowerPoint file',
  'HTML & Webseiten zu PDF': 'HTML & web pages to PDF',
  'Website-Link einfügen und mit Bildern und Seitengestaltung als PDF speichern. Auch gespeicherte HTML-Dateien umwandeln.':
    'Paste a website link and save it as PDF with images and page styling. Also convert saved HTML files.',
  'Seiten automatisch ausrichten': 'Auto-orient pages',
  'Verdrehte Textseiten erkennen und um 90, 180 oder 270 Grad korrigieren. Unsichere Seiten im Bericht kennzeichnen.':
    'Detect rotated text pages and correct them by 90, 180 or 270 degrees. Flag uncertain pages in the report.',
  'Seiten ausrichten': 'Orient pages',
  'Buchscans entzerren': 'Dewarp book scans',
  'Gebogene Textzeilen am Buchfalz mit einstellbarer Kurvenkorrektur glätten. Neue Seitenbilder erzeugen.':
    'Straighten curved text lines near the book gutter with adjustable curve correction. Create new page images.',
  'Buchscan entzerren': 'Dewarp scan',
  'Formularfelder erkennen': 'Detect form fields',
  'Leere Kästchen und Eingabelinien erkennen und als ausfüllbare Felder anlegen. Vorschläge anschließend prüfen.':
    'Detect empty boxes and input lines and create fillable fields. Review the suggestions afterwards.',
  'Schwärzungen prüfen': 'Check redactions',
  'Nach weiterhin auslesbaren Begriffen und möglichen dunklen Überdeckungen suchen. Mit Befundbericht.':
    'Look for terms that can still be extracted and possible dark overlays. Includes a findings report.',
  'Druckqualität prüfen': 'Check print quality',
  'Bildauflösung, eingebettete Schriften und Seitenboxen prüfen. Hinweise für die Druckvorbereitung sammeln.':
    'Check image resolution, embedded fonts and page boxes. Collect notes for print preparation.',
  'Barrierefreiheit prüfen': 'Check accessibility',
  'PDF/UA prüfen und neue strukturierte PDFs mit Überschriften, Lesereihenfolge und Bildbeschreibungen erstellen.':
    'Check PDF/UA and create new structured PDFs with headings, reading order and image descriptions.',
  'PDF übersetzen': 'Translate PDF',
  'Auslesbaren Text in eine andere Sprache übersetzen. Original und Übersetzung nebeneinander exportieren.':
    'Translate extractable text into another language. Export the original and translation side by side.',
  'ZUGFeRD-Assistent': 'ZUGFeRD assistant',
  'Rechnungs-PDF und passende CII-XML zu einer hybriden Rechnung verbinden. Mit Mustang und veraPDF prüfen.':
    'Combine an invoice PDF with matching CII XML into a hybrid invoice. Validate with Mustang and veraPDF.',
  'Rechnung verarbeiten': 'Process invoice',
  'Word-Serienbriefe': 'Word mail merge',
  'DOCX-Vorlagen mit Excel-Datensätzen füllen. Für jede Zeile eine eigene PDF erstellen und im ZIP sammeln.':
    'Fill DOCX templates with Excel records. Create a separate PDF for each row and collect them in a ZIP.',
  'Serienbriefe erstellen': 'Create merged documents',
  'Nach Dateigröße teilen': 'Split by file size',
  'Eine PDF in aufeinanderfolgende Teile innerhalb eines MB-Limits aufteilen. Jede Ausgabedatei wird nachgemessen.':
    'Split a PDF into consecutive parts within an MB limit. Check the size of every output file.',
  'Teildateien berechnen': 'Calculate split files',
  'PDF zu Word': 'PDF to Word',
  'Eine bearbeitbare Word-Datei aus deiner PDF erstellen.':
    'Create an editable Word file from your PDF.',
  'Word-Datei erstellen': 'Create Word file',
  'EML- und Outlook-MSG-Dateien mit Absender, Betreff und Nachricht als PDF speichern. Anlagen optional im ZIP beilegen.':
    'Save EML and Outlook MSG files as PDFs with the sender, subject and message. Optionally include attachments in a ZIP.',
  Stapelverarbeitung: 'Batch processing',
  'Viele PDFs einzeln stempeln, nummerieren, schützen oder bereinigen. Ein ZIP mit allen Ergebnissen.':
    'Stamp, number, protect or clean multiple PDFs individually. Get all results in one ZIP.',
  'Stapel verarbeiten': 'Process batch',
  Arbeitsabläufe: 'Workflows',
  'Mehrere Schritte verbinden: zum Beispiel OCR, Leerseiten entfernen und nummerieren. Abläufe speichern und wiederverwenden.':
    'Combine steps such as OCR, blank page removal and numbering. Save and reuse workflows.',
  'Arbeitsablauf ausführen': 'Run workflow',
  'Automatisch umbenennen': 'Rename automatically',
  'Dateinamen aus Datum, Rechnungsnummer und Titel vorschlagen. Vorschläge prüfen und bearbeiten.':
    'Suggest filenames from dates, invoice numbers and titles. Review and edit the suggestions.',
  'Namen vorschlagen': 'Suggest names',
  'Intelligent teilen': 'Smart split',
  'PDFs anhand von Text, Lesezeichen, leeren Seiten oder QR-/Barcode-Trennblättern aufteilen.':
    'Split PDFs based on text, bookmarks, blank pages or QR/barcode separator sheets.',
  'Trennstellen suchen': 'Find split points',
  'Tabelle zu Excel': 'Table to Excel',
  'Tabellenbereiche mit Text oder OCR auslesen. Spalten und Werte korrigieren und als Excel oder CSV speichern.':
    'Extract table areas using text or OCR. Correct columns and values and save them as Excel or CSV.',
  'Tabelle erkennen': 'Detect table',
  'Suchen & schwärzen': 'Search & redact',
  'Suchbegriffe, Namen, E-Mail-Adressen und mögliche IBANs finden. Bereiche prüfen und dauerhaft aus der Ausgabe entfernen.':
    'Find search terms, names, email addresses and possible IBANs. Review areas and permanently remove them from the output.',
  'Fundstellen suchen': 'Find matches',
  'Visueller PDF-Vergleich': 'Visual PDF comparison',
  'Unterschiede in Scans, Bildern, Stempeln und Text farbig auf den Seiten sichtbar machen.':
    'Use colour to highlight differences in scans, images, stamps and text on the pages.',
  'Visuell vergleichen': 'Compare visually',
  'Scans verbessern': 'Enhance scans',
  'Schieflagen korrigieren, Kontrast anheben und helle Hintergründe bereinigen. Mit Vorschau.':
    'Correct skew, increase contrast and clean up light backgrounds, with a preview.',
  'Deckblatt & Inhaltsverzeichnis': 'Cover & table of contents',
  'Ein Deckblatt und ein klickbares Verzeichnis mit automatisch angepassten Seitenzahlen ergänzen.':
    'Add a cover page and a clickable table of contents with automatically adjusted page numbers.',
  'Verzeichnis erstellen': 'Create table of contents',
  Serienformulare: 'Form mail merge',
  'PDF-Formularfelder mit CSV- oder TSV-Datensätzen füllen. Ein individuelles PDF pro Zeile.':
    'Fill PDF form fields with CSV or TSV records. Create an individual PDF for each row.',
  'Serienformulare erstellen': 'Create forms',
  'QR- & Barcodes': 'QR & barcodes',
  'Codes aus PDF-Seiten auslesen. QR, Code 128 oder EAN-13 erstellen und in PDFs platzieren.':
    'Read codes from PDF pages. Create QR, Code 128 or EAN-13 codes and place them in PDFs.',
  'Codes bearbeiten': 'Edit codes',
  'Links bearbeiten': 'Edit links',
  'Verweise auf Webseiten, E-Mails und PDF-Seiten hinzufügen, ändern und entfernen.':
    'Add, edit and remove links to websites, email addresses and PDF pages.',
  'Links speichern': 'Save links',
  'Anhänge verwalten': 'Manage attachments',
  'Eingebettete Dateien hinzufügen, umbenennen, ersetzen und aus der Ausgabe entfernen.':
    'Add, rename, replace and remove embedded files from the output.',
  'Anhänge speichern': 'Save attachments',
  'Fotos aufnehmen, Dokumente perspektivisch entzerren und mehrere Seiten als PDF sammeln.':
    'Take photos, correct document perspective and combine multiple pages into a PDF.',
  'Scan erstellen': 'Create scan',
  'Word, Excel, PowerPoint und OpenDocument als PDF speichern.':
    'Save Word, Excel, PowerPoint and OpenDocument files as PDF.',
  'PDF/A erstellen & prüfen': 'Create & check PDF/A',
  'Eine Archivkopie deiner PDF erstellen oder eine vorhandene PDF/A prüfen.':
    'Create an archival copy of your PDF or check an existing PDF/A.',
  'PDF/A verarbeiten': 'Process PDF/A',
  'XRechnung vollständig validieren': 'Validate XRechnung',
  'Eine XRechnung nach den KoSIT-Regeln prüfen und den Prüfbericht herunterladen.':
    'Check an XRechnung against KoSIT rules and download the validation report.',
  'XRechnung validieren': 'Validate XRechnung',
  Zertifikatssignaturen: 'Certificate signatures',
  'PDFs mit einem PKCS#12-Zertifikat signieren und Signaturen prüfen.':
    'Sign PDFs with a PKCS#12 certificate and verify signatures.',
  'Signatur verarbeiten': 'Process signature',
  'PDF schützen': 'Protect PDF',
  'PDFs mit AES-256 verschlüsseln. Öffnungspasswort und Berechtigungen festlegen.':
    'Encrypt PDFs with AES-256. Set an opening password and permissions.',
  'PDF entsperren': 'Unlock PDF',
  'Mit bekanntem Passwort geöffnete PDFs als ungeschützte Kopie speichern.':
    'Save PDFs opened with a known password as unprotected copies.',
  'E-Rechnung lesen': 'Read e-invoice',
  'UBL- und CII-Rechnungen aus XML oder PDF-Anhängen anzeigen. Als Lese-PDF, XML oder CSV speichern.':
    'Display UBL and CII invoices from XML or PDF attachments. Save them as a readable PDF, XML or CSV.',
  'E-Rechnung prüfen': 'Check e-invoice',
  'Grundlegende Angaben, Datumsformate und Summen prüfen. Basischeck mit exportierbarem Bericht.':
    'Check basic details, date formats and totals. A basic check with an exportable report.',
  'Formular ausfüllen': 'Fill form',
  'Interaktive PDF-Felder ausfüllen. Als ausfüllbare oder fixierte PDF speichern.':
    'Fill in interactive PDF fields. Save as a fillable or flattened PDF.',
  'Formular speichern': 'Save form',
  'Formular erstellen': 'Create form',
  'Textfelder, Checkboxen und Auswahllisten direkt auf deiner PDF platzieren.':
    'Place text fields, checkboxes and dropdown lists directly on your PDF.',
  'Lesezeichen bearbeiten': 'Edit bookmarks',
  'Kapitel strukturieren, einrücken und mit den passenden Seiten verknüpfen.':
    'Structure chapters, indent them and link them to the appropriate pages.',
  'Lesezeichen speichern': 'Save bookmarks',
  'Bilder extrahieren': 'Extract images',
  'Eingebettete Bilder aus ausgewählten Seiten einzeln als PNG im ZIP speichern.':
    'Save embedded images from selected pages as individual PNG files in a ZIP.',
  'Check & Seitenfinder': 'Check & page finder',
  'Dein gesamtes Dokumentenpaket prüfen, gemeinsam durchsuchen und passende Seiten in einer PDF sammeln.':
    'Check your entire document bundle, search across all files and collect matching pages in a single PDF.',
  'Auswahl als PDF speichern': 'Save selection as PDF',
  'OCR & Text': 'OCR & text',
  'Scans auslesen. Text korrigieren und als Word, TXT oder durchsuchbare PDF exportieren.':
    'Extract text from scans. Correct the text and export it as Word, TXT or a searchable PDF.',
  'Text erkennen': 'Recognise text',
  'Bilder zu PDF': 'Images to PDF',
  'JPG und PNG proportional auf A4 in ein PDF-Dokument übernehmen.':
    'Fit JPG and PNG images proportionally onto A4 pages in a single PDF document.',
  'PDF zu Bildern': 'PDF to images',
  'Jede ausgewählte Seite als JPG oder PNG exportieren. Gemeinsam als ZIP.':
    'Export each selected page as JPG or PNG, together in a ZIP.',
  'Bilder exportieren': 'Export images',
  'Scans komprimieren': 'Compress scans',
  'PDF-Inhalte erhalten und Bilder verkleinern oder verlustfrei optimieren.':
    'Preserve PDF content and reduce images, or optimize losslessly.',
  Komprimieren: 'Compress',
  Zusammenfügen: 'Merge PDFs',
  'Aus mehreren Dateien ein Dokument machen. PDFs und Bilder lassen sich mischen.':
    'Merge multiple files into one document. PDFs and images can be mixed.',
  'PDF teilen': 'Split PDF',
  'Jede ausgewählte Seite als eigene PDF exportieren. Alle Dateien im ZIP.':
    'Export each selected page as a separate PDF. All files in one ZIP.',
  'Einzelseiten erstellen': 'Create individual pages',
  'Seiten organisieren': 'Organize pages',
  'Sortieren, drehen, duplizieren und entfernen. Auch Leerseiten kannst du einfügen.':
    'Reorder, rotate, duplicate and remove pages. You can also insert blank pages.',
  'Seiten speichern': 'Save pages',
  Seitennummern: 'Page numbers',
  'Ausgewählte Seiten in ihrer aktuellen Reihenfolge unten mittig nummerieren.':
    'Number selected pages in their current order at the bottom centre.',
  Nummerieren: 'Add numbers',
  Seitenformat: 'Page format',
  'Seiten proportional auf ein einheitliches Format einpassen. Inhalte bleiben vollständig erhalten.':
    'Fit pages proportionally to a uniform format. Preserve all content.',
  'Format anpassen': 'Adjust format',
  'Mehrere Seiten pro Blatt': 'Multiple pages per sheet',
  '2, 4, 6, 8, 9 oder 16 Seiten auf einem Druckbogen anordnen. Ränder, Abstände und Rahmen einstellen.':
    'Arrange 2, 4, 6, 8, 9 or 16 pages on a print sheet. Adjust margins, spacing and borders.',
  'Seiten anordnen': 'Arrange pages',
  'PDF bearbeiten': 'Edit PDF',
  'PDF-Texte direkt ändern und Scans automatisch erkennen. Text ersetzen, ergänzen, verschieben und formatieren.':
    'Edit PDF text and automatically recognise scans. Replace, add, move and format text.',
  'Bearbeitete PDF erstellen': 'Create edited PDF',
  'Inhalte entfernen': 'Remove content',
  'Text oder Bildbereiche aus der Ausgabe entfernen. Mit wählbarer Füllfarbe und genauer Bereichsauswahl.':
    'Remove text or image areas from the output, with a choice of fill colour and precise area selection.',
  'Bereinigte PDF erstellen': 'Create cleaned PDF',
  'Bild einfügen': 'Insert image',
  'Bilder und Logos in bestehende Seiten einfügen, verschieben und proportional skalieren.':
    'Insert images and logos into existing pages, move them and resize them proportionally.',
  'PDF mit Bildern erstellen': 'Create PDF with images',
  Schwärzen: 'Redact',
  'Vertrauliche Bereiche markieren und aus den exportierten Seitenbildern entfernen.':
    'Mark confidential areas and remove them from the exported page images.',
  'Geschwärzte PDF erstellen': 'Create redacted PDF',
  Zuschneiden: 'Crop',
  'Text & Markierungen': 'Text & annotations',
  'Textnotizen platzieren und wichtige Stellen hervorheben.':
    'Add text notes and highlight important passages.',
  'Änderungen anwenden': 'Apply changes',
  Unterschrift: 'Signature',
  'Mit Maus oder Finger unterschreiben und die Unterschrift im Dokument platzieren.':
    'Draw your signature with a mouse or finger and place it in the document.',
  'Unterschrift einfügen': 'Insert signature',
  'Einen transparenten Texthinweis mittig auf den Seiten ergänzen.':
    'Add a transparent text note centred on the pages.',
  'Wasserzeichen hinzufügen': 'Add watermark',
  Graustufen: 'Grayscale',
  'Farbige Seiten in eine neue PDF mit grauen Seitenbildern umwandeln.':
    'Convert colour pages into a new PDF with greyscale page images.',
  'In Graustufen umwandeln': 'Convert to greyscale',
  'PDF fixieren': 'Flatten PDF',
  'Seiten als feste Bilder speichern. Sichtbare Inhalte bleiben erhalten.':
    'Save pages as fixed images. Visible content is preserved.',
  'Dokumentinfos entfernen': 'Remove document info',
  'Titel, Autor, Betreff, Stichwörter, Ersteller, Datumsfelder und XMP-Dokumentinfos entfernen.':
    'Remove title, author, subject, keywords, creator, date fields and XMP document information.',
  'PDFs vergleichen': 'Compare PDFs',
  'Texte seitenweise oder über Seiten hinweg vergleichen. Verschobene Textblöcke und geänderte Wörter erkennen.':
    'Compare text page by page or across pages. Detect moved text blocks and changed words.',
  'Text vergleichen': 'Compare text',
  'PDF-Informationen': 'PDF information',
  'Metadaten, PDF-Version, Dateigröße und die Formate aller Seiten als Bericht ansehen.':
    'View a report of metadata, PDF version, file size and the formats of all pages.',
  'Bericht erstellen': 'Create report',
  'Anhänge extrahieren': 'Extract attachments',
  'Eingebettete Dateianhänge aus PDFs als ZIP speichern, zum Beispiel Rechnungs-XML.':
    'Save embedded file attachments from PDFs as a ZIP, such as invoice XML.',
  'In Abschnitte teilen': 'Split into sections',
  'Nach einer festen Seitenanzahl oder eigenen Bereichen mehrere Teildokumente erstellen.':
    'Create multiple documents using a fixed page count or custom page ranges.',
  'Teildokumente erstellen': 'Create sections',
  'Abwechselnd zusammenfügen': 'Interleave PDFs',
  'Broschüre erstellen': 'Create booklet',
  'Seiten als Druckbögen für eine gefaltete Broschüre anordnen. Leerseiten werden ergänzt.':
    'Arrange pages as print sheets for a folded booklet. Blank pages are added.',
  'Seiten aufteilen': 'Divide pages',
  'Jede Seite in zwei, vier oder neun gleichgroße Ausschnitte zerlegen.':
    'Split each page into two, four or nine equally sized crops.',
  'Weiße Ränder entfernen': 'Remove white margins',
  'Weiße Außenränder automatisch erkennen und mit einem einstellbaren Abstand abschneiden.':
    'Automatically detect white outer margins and trim them with adjustable spacing.',
  'Ränder entfernen': 'Remove margins',
  'Schwarzweiß-Scan': 'Black & white scan',
  'Scans mit einstellbarem Schwellenwert in reines Schwarz und Weiß umwandeln.':
    'Convert scans to pure black and white with an adjustable threshold.',
  'Schwarzweiß erstellen': 'Convert to black and white',
  'Farben umkehren': 'Invert colors',
  'Alle Seitenfarben invertieren, zum Beispiel helle Schrift auf dunklem Hintergrund.':
    'Invert all page colours, for example to show light text on a dark background.',
  'Stempel hinzufügen': 'Add stamp',
  'Einen klar lesbaren Stempel mit eigenem Text, optionalem Datum und gewählter Position setzen.':
    'Add a clearly legible stamp with custom text, an optional date and a chosen position.',
  'Metadaten bearbeiten': 'Edit metadata',
  'Titel, Autor, Betreff und Stichwörter der Ausgabe festlegen.':
    'Set the title, author, subject and keywords for the output.',
  'Metadaten speichern': 'Save metadata',
  'Anmerkungen entfernen': 'Remove annotations',
  'PDF-Kommentare, Markierungen und optional Links aus den ausgewählten Seiten entfernen.':
    'Remove PDF comments, highlights and optionally links from selected pages.',
  'PDFs überlagern': 'Overlay PDFs',
  'Eine Vorlagenseite mit einstellbarer Deckkraft vor oder hinter die Seiten einer zweiten PDF legen.':
    'Place a template page with adjustable opacity in front of or behind the pages of a second PDF.',
  'Überlagerung erstellen': 'Create overlay',
  'Schematische Reihenfolge auf dem Druckbogen. Das Ergebnis enthält die ausgewählten Seiten.':
    'Schematic order on the print sheet. The result contains the selected pages.',
  'Import fehlgeschlagen.': 'Import failed.',
  'Export fehlgeschlagen.': 'Export failed.',
  'JSON herunterladen': 'Download JSON',
  'Ungültige Anzahl Seiten pro Blatt.': 'Invalid number of pages per sheet.',
  'Seitenrand und Abstand müssen zwischen 0 und 72 Punkten liegen.':
    'Page margin and spacing must be between 0 and 72 points.',
  Drucklayout: 'Print layout',
  'Seitenrand (pt)': 'Page margin (pt)',
  'Abstand (pt)': 'Spacing (pt)',
  'Rahmen um jede Seite': 'Border around each page',
  'Lesezeichen importieren / exportieren': 'Import / export bookmarks',
  'CSV: title, page, level. Seiten und Ebenen beginnen bei 1. Importierte Ziele zeigen auf die ganze Seite; vorhandene Lesezeichen bleiben bis zur Übernahme erhalten.':
    'CSV: title, page, level. Pages and levels start at 1. Imported targets show the whole page; existing bookmarks remain until you apply the import.',
  Lesezeichendatei: 'Bookmark file',
  'Lesezeichen vorbereitet': 'bookmarks prepared',
  'Vorschau zeigt die ersten 20 Einträge.': 'Preview shows the first 20 entries.',
  'Lesezeichen ergänzen': 'Append bookmarks',
  'Vorhandene Lesezeichen ersetzen': 'Replace existing bookmarks',
  'Bitte eine CSV- oder JSON-Datei mit höchstens 2 MB auswählen.':
    'Select a CSV or JSON file up to 2 MB.',
  'Ungültige Lesezeichendatei. Titel, Zielseiten und Ebenen prüfen.':
    'Invalid bookmark file. Check titles, target pages and levels.',
  'Die Lesezeichendatei darf höchstens 2 MB groß sein.': 'The bookmark file must not exceed 2 MB.',
  'Der Lesezeichenexport benötigt gültige interne Zielseiten. Externe Ziele zuerst zuordnen.':
    'Bookmark export requires valid internal target pages. Assign external targets to pages first.',
  'Für Eingangsordner exportieren': 'Export for watched folders',
  'workflow.json im Profilordner des Dokumentenservers speichern. PDFs in dessen inbox ablegen.':
    'Save workflow.json in a profile folder on the document server. Place PDFs in its inbox.',
  'Die Ordnerautomatik benötigt einen selbst betriebenen Dokumentenserver mit eingerichtetem Eingangsordner. Sie unterstützt Drehen, Umkehren, Formulare festschreiben, verlustfreies Optimieren sowie das Entfernen von Dokumentinfos und Kommentaren. Originale bleiben erhalten.':
    'Watched folders require a self-hosted document server with a configured input folder. They support rotation, reversing pages, flattening forms, lossless optimization and removal of document information and comments. Originals are retained.',
  'Eingangsordner unterstützen nur Drehen, Umkehren, Formulare festschreiben, verlustfreies Optimieren sowie das Entfernen von Dokumentinfos und Kommentaren. Bedingungen sind noch nicht verfügbar.':
    'Watched folders only support rotation, reversing pages, flattening forms, lossless optimization and removal of document information and comments. Conditions are not yet available.',
  'EPUB, FB2, CBZ, XPS oder OXPS': 'EPUB, FB2, CBZ, XPS or OXPS',
  'EPUB und FB2 werden neu gesetzt. CBZ, XPS und OXPS behalten ihr Seitenformat. Höchstens 40 MB und 200 Seiten; CBZ mit PNG- oder JPEG-Bildern. Kein DRM.':
    'EPUB and FB2 are reflowed. CBZ, XPS and OXPS keep their page format. Up to 40 MB and 200 pages; CBZ with PNG or JPEG images. No DRM.',
  'Bitte EPUB, FB2, CBZ, XPS oder OXPS auswählen.': 'Select an EPUB, FB2, CBZ, XPS or OXPS file.',
  'Die Datei ist beschädigt oder konnte nicht als PDF umgewandelt werden.':
    'The file is damaged or could not be converted to PDF.',
  'Die Datei ergibt mehr als 200 Seiten oder enthält keine lesbaren Seiten.':
    'The file produces more than 200 pages or contains no readable pages.',
  'Verschlüsselte oder DRM-geschützte Dateien werden nicht unterstützt.':
    'Encrypted or DRM-protected files are not supported.',
  'Die Eingabedatei darf höchstens 40 MB groß sein.': 'The input file must not exceed 40 MB.',
  'CBZ unterstützt ausschließlich PNG- und JPEG-Seiten.': 'CBZ only supports PNG and JPEG pages.',
  'CBZ-Dateien dürfen höchstens 200 Bildseiten enthalten.':
    'CBZ files must not contain more than 200 image pages.',
  'Die CBZ-Datei enthält keine PNG- oder JPEG-Seiten.':
    'The CBZ file contains no PNG or JPEG pages.',
  'Externe Ressourcen in XPS-Dateien werden nicht unterstützt.':
    'External resources in XPS files are not supported.',
  'Die XPS-Paketbeschreibung fehlt.': 'The XPS package description is missing.',
  'Die Datei ist kein FictionBook-E-Book.': 'The file is not a FictionBook e-book.',
  'Das Archiv überschreitet 80 MB entpackten Inhalt oder 1500 Einträge.':
    'The archive exceeds 80 MB of expanded content or 1,500 entries.',
  'Das Archiv enthält doppelte Dateinamen.': 'The archive contains duplicate file names.',
  'Das Archiv enthält unzulässige oder verschlüsselte Einträge.':
    'The archive contains invalid or encrypted entries.',
  'Das Archiv enthält zu große Bilder (30 Megapixel je Bild, 200 Megapixel insgesamt).':
    'The archive contains oversized images (30 megapixels per image, 200 megapixels in total).',
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
  'Mit Beispielkontoauszug ausprobieren': 'Try a sample bank statement',
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
