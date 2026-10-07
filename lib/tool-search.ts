import {tools,type WorkspaceTool} from './tool-catalog';

// Local intent matching. No document contents or search text leave the browser.
const aliases:Record<WorkspaceTool,string[]>={
 'number-compare':['Zahlenvergleich','geänderte Beträge finden','IBAN Änderungen vergleichen','Datumsangaben vergleichen','Zahlen zwischen Versionen'],
 'field-collector':['Belegfelder sammeln','viele Rechnungen nach Excel','Felder aus mehreren PDFs','Rechnungsnummern sammeln'],
 'invoice-visual-check':['Rechnung und XML abgleichen','sichtbare Rechnung vergleichen','XML weicht von PDF ab','ZUGFeRD Sichtprüfung'],
 'page-gaps':['Dokumentlücken finden','fehlende Seiten finden','Seite von Vollständigkeit','Seitenzählung prüfen'],
 'ocr-review':['OCR Korrekturhilfe','OCR Fehler korrigieren','unsichere Wörter prüfen','Texterkennung kontrollieren'],
 'pseudonymize':['Mehrere Dateien pseudonymisieren','Namen durch Platzhalter ersetzen','Person A Firma B','Pseudonyme'],
 'attachment-links':['Anlagen automatisch verknüpfen','Anlagenverweise verlinken','siehe Anlage','fehlende Anlagenverweise'],
 'best-scans':['Beste Scan Seiten kombinieren','beste Seiten aus mehreren Scans','Scanqualität auswählen'],
 'document-reconcile':['Angebot Auftrag Rechnung abgleichen','Positionen abgleichen','Mengen und Preise vergleichen'],
 'comment-export':['Kommentare als Arbeitsliste exportieren','Kommentare exportieren','Markierungen als Aufgaben','Anmerkungen sammeln'],
 'pdf-repair':['PDF reparieren','beschädigte PDF','defekte Datei','PDF öffnet nicht','kaputte PDF wiederherstellen','recover repair'],
 'optimize-pdf':['auf Wunschgröße komprimieren','Zielgröße','PDF auf 2 MB verkleinern','PDF auf 5 MB komprimieren','verlustfrei optimieren','Text behalten','Bilder verkleinern'],
 'scan-split':['Sammelscans trennen','Fotos auf einem Scan trennen','mehrere Belege auf einer Seite','Fotos automatisch zuschneiden','Scan in einzelne Bilder teilen'],
 'pdf-markdown':['PDF zu Markdown','PDF als MD','Markdown exportieren'],
 'pdf-html':['PDF zu HTML','PDF als Webseite','PDF Text zu HTML'],
 'pdf-epub':['PDF zu E-Book','PDF zu EPUB','PDF als eBook','EPUB exportieren'],
 'ebook-pdf':['E-Book zu PDF','EPUB zu PDF','eBook in PDF umwandeln'],
 'pdf-powerpoint':['PDF zu PowerPoint', 'PDF zu PPTX', 'PDF als Folien'],
 'html-pdf':['HTML zu PDF', 'Webseite zu PDF', 'Internetseite speichern'],
 'auto-orient':['Seiten automatisch ausrichten', 'auf dem Kopf', '180 Grad', 'automatisch drehen'],
 'book-dewarp':['Buchscans entzerren', 'Buchfalz', 'gebogene Textzeilen', 'Dewarp'],
 'form-detect':['Formularfelder erkennen', 'automatische Formularerkennung', 'Felder automatisch anlegen'],
 'redaction-check':['Schwärzungen prüfen', 'versteckten Text prüfen', 'Schwärzung kontrollieren'],
 'print-check':['Druckqualität prüfen', 'Druckvorstufe', 'Preflight', 'Bildauflösung dpi'],
 'accessibility-check':['Barrierefreiheit prüfen', 'PDF UA', 'Screenreader', 'Accessibility'],
 'translate-pdf':['PDF übersetzen', 'Übersetzung nebeneinander', 'Translate', 'Dokument übersetzen'],
 'zugferd-create':['ZUGFeRD erstellen', 'Factur X erstellen', 'ZUGFeRD validieren', 'hybride Rechnung erzeugen'],
 'word-mail-merge':['Word Serienbrief', 'Excel Serienbrief', 'Word Vorlage mit Excel füllen'],
 'split-size':['Nach Dateigröße teilen','PDF in 5 MB aufteilen','Upload Limit','maximale Dateigröße','nach MB trennen'],
 'pdf-word':['PDF zu Word','PDF in Word umwandeln','PDF zu DOCX','Layout in Word','bearbeitbare Word Datei'],
 'email-pdf':['E-Mails zu PDF','EML zu PDF','MSG zu PDF','Outlook Nachricht','Mail mit Anlagen'],
 batch:['Stapelverarbeitung','Batch','viele PDFs auf einmal','mehrere Dateien stempeln','Stapel schützen'],
 workflows:['Arbeitsabläufe','Workflow','Automatisierung','mehrere Schritte','Ablauf speichern','OCR Leerseiten nummerieren'],
 'auto-rename':['Automatisch umbenennen','Dateinamen','Rechnungsnummer als Dateiname','PDF benennen'],
 'smart-split':['Intelligent teilen','nach Text teilen','an Lesezeichen trennen','leere Trennseiten','QR Trennblatt'],
 'table-export':['Tabelle zu Excel','Tabellen extrahieren','XLSX','PDF zu CSV','Spalten erkennen'],
 'search-redact':['Suchen und schwärzen','Namen automatisch schwärzen','IBAN schwärzen','Email Adressen entfernen'],
 'visual-compare':['Visueller PDF Vergleich','Bilder vergleichen','Scans vergleichen','Stempel Unterschiede'],
 'scan-enhance':['Scans verbessern','Schieflage','gerade richten','deskew','Scan Hintergrund','Kontrast verbessern'],
 'cover-toc':['Deckblatt und Inhaltsverzeichnis','klickbares Inhaltsverzeichnis','Deckblatt erstellen'],
 'mail-merge':['Serienformulare','Serienbrief','CSV in Formular','Formular mit Tabelle füllen'],
 'qr-barcode':['QR Codes','Barcodes','Strichcode','Code128','EAN13','QR lesen','QR erzeugen'],
 'link-editor':['Links bearbeiten','Link hinzufügen','Hyperlink','Seitenverweis','Weblink ändern'],
 'attachment-manager':['Anhänge verwalten','Anhang hinzufügen','eingebettete Datei ersetzen','Anhang entfernen'],
 'camera-scan':['Kamera Scanner','Foto scannen','Handy Scan','Perspektive korrigieren'],
 'office-pdf':['Office zu PDF','Word zu PDF','Excel zu PDF','PowerPoint zu PDF','DOCX zu PDF','PPTX zu PDF'],
 pdfa:['PDF A','PDF/A erstellen und prüfen','Archiv PDF','veraPDF','Langzeitarchivierung'],
 'xrechnung-validate':['XRechnung vollständig validieren','KoSIT','Schematron','XSD Rechnungsprüfung'],
 'certificate-sign':['Zertifikatssignaturen','digital signieren','Signatur prüfen','PKCS12','PAdES','Zertifikat'],
 protect:['PDF schützen','Passwort setzen','Passwort hinzufügen','mit Passwort sperren','verschlüsseln','AES 256','Kopierschutz','Drucken verbieten','Berechtigungen ändern'],
 unlock:['PDF entsperren','Passwort entfernen','Passwort löschen','Schutz aufheben','decrypt','verschlüsselte PDF öffnen'],
 'invoice-read':['E-Rechnung lesen','XRechnung öffnen','ZUGFeRD anzeigen','Factur-X ansehen','Rechnungs XML lesen','XML zu PDF','Rechnungspositionen CSV','E-Rechnung in PDF umwandeln'],
 'invoice-check':['E-Rechnung prüfen','XRechnung prüfen','ZUGFeRD prüfen','Rechnungssummen prüfen','Rechnung validieren','Rechnungsprüfung','Rechnungsfehler','Basischeck E-Rechnung'],
 'fill-form':['Formular ausfüllen','Felder ausfüllen','Checkbox ankreuzen','PDF ausfüllen','Formularwerte ändern'],
 'create-form':['Formular erstellen','ausfüllbar machen','Formularfelder hinzufügen','Eingabefeld erstellen','Checkbox erstellen','Dropdown erstellen','interaktives Formular'],
 bookmarks:['Lesezeichen bearbeiten','Lesezeichen hinzufügen','Kapitelstruktur','Inhaltsverzeichnis','Bookmarks','Kapitel verknüpfen'],
 'extract-images':['Bilder extrahieren','Fotos herauslösen','eingebettete Bilder speichern','Grafiken extrahieren','Bild aus PDF holen'],
 'edit-text':['Text bearbeiten','Schrift ändern','Text ersetzen','Wörter korrigieren','Text löschen','PDF editieren','PDF bearbeiten','Text formatieren','Schriftgröße ändern','Textblock verschieben','Tippfehler korrigieren','Acrobat'],
 erase:['Inhalte entfernen','wegradieren','radieren','Bild entfernen','Bereich löschen','Schrift entfernen','weißen Bereich','ausradieren'],
 'insert-image':['Bild einfügen','Logo einfügen','Bild platzieren','Grafik einsetzen','Foto auf Seite','Bild verschieben'],
 inspect:['prüfen','check','suchen','finden','durchsuchen','Fundstellen sammeln','doppelte Seiten finden','Duplikate erkennen','leere Seiten finden','Scans finden','Leerseiten erkennen'],
 ocr:['ocr','Text auslesen','Text erkennen','Text kopieren','Text extrahieren','Scan lesen','gescanntes Dokument','Texterkennung','durchsuchbar machen','durchsuchbare PDF','txt'],
 images:['Bilder zu PDF','Bild in PDF','Foto in PDF','Fotos zusammenfügen','JPG zu PDF','PNG zu PDF','JPEG in PDF'],
 'to-images':['PDF zu Bildern','PDF in Bild','PDF zu JPG','PDF zu PNG','als Bild speichern','als Foto speichern','Bilder exportieren','Bilddateien erzeugen'],
 compress:['komprimieren','verkleinern','kleiner machen','Dateigröße reduzieren','weniger MB','Speicher sparen','Email Anhang kleiner','zu groß'],
 merge:['zusammenfügen','zusammenführen','verbinden','kombinieren','vereinen','PDF zusammenlegen','ein Dokument machen','aneinanderhängen','merge'],
 split:['teilen','aufteilen','trennen','zerlegen','split','einzelne Seiten speichern','Einzelseiten exportieren','jede Seite einzeln'],
 organize:['sortieren','umordnen','Reihenfolge ändern','Seiten verschieben','drehen','rotieren','Seiten löschen','Seite entfernen','Seiten entfernen','Seite duplizieren','Leerseite einfügen','Seiten auswählen'],
 numbers:['Seitennummern','nummerieren','Seitenzahlen hinzufügen','fortlaufende Nummer','Paginierung'],
 resize:['Seitenformat','Format ändern','Papiergröße','A4','Letter','Hochformat','Querformat','einheitliches Format'],
 nup:['mehrere Seiten pro Blatt','zwei Seiten auf ein Blatt','vier Seiten auf ein Blatt','2 auf 1','4 auf 1','Druckbogen','Papier sparen'],
 redact:['schwärzen','zensieren','unkenntlich machen','Text verbergen','Daten abdecken','vertrauliche Inhalte entfernen','Namen schwärzen','anonymisieren'],
 crop:['zuschneiden','beschneiden','Ränder entfernen','Rand abschneiden','Ausschnitt','ausschneiden','croppen'],
 annotate:['Notiz','Text hinzufügen','Text schreiben','beschriften','markieren','hervorheben','Textmarker','kommentieren','Anmerkung'],
 sign:['unterschreiben','Unterschrift','signieren','Signatur einfügen','unterzeichnen'],
 watermark:['Wasserzeichen','Entwurf','Kopie kennzeichnen','Texthinweis auf allen Seiten'],
 grayscale:['Graustufen','schwarzweiß','schwarz weiss','schwarz weiß','ohne Farbe','Farbe entfernen'],
 flatten:['fixieren','feste Seitenbilder','Seiten als Bilder fixieren','Textebene entfernen','Text nicht kopierbar','flatten'],
 metadata:['Metadaten','Dokumentinfos','Autor entfernen','Titel entfernen','Ersteller löschen','Eigenschaften löschen','XMP entfernen'],
 compare:['vergleichen','Unterschiede finden','Textvergleich','zwei Versionen','Änderungen vergleichen','Vertragsvergleich'],
 'pdf-info':['Informationen anzeigen','PDF Version','Seitengröße auslesen','Eigenschaften ansehen','Dokumentbericht'],
 attachments:['Anhänge extrahieren','Dateianhänge','eingebettete Dateien','Rechnungs XML','ZUGFeRD XML','Anlagen entnehmen'],
 'split-ranges':['in Abschnitte teilen','alle 2 Seiten trennen','nach Seitenanzahl teilen','Seitenbereiche aufteilen','Teildokumente','in Pakete teilen'],
 interleave:['abwechselnd zusammenfügen','Vorderseiten und Rückseiten','Duplex Scan','abwechselnd mischen','ineinander sortieren'],
 booklet:['Broschüre erstellen','Broschürendruck','Heft drucken','Faltblatt','booklet','Druckbogen für Broschüre'],
 'split-grid':['Seiten aufteilen','Doppelseiten trennen','Doppelseite halbieren','Seite in Kacheln teilen','Seitenraster'],
 'auto-crop':['Weiße Ränder entfernen','Ränder automatisch abschneiden','Scan automatisch zuschneiden','weißen Rand entfernen','automatisch beschneiden'],
 bilevel:['Schwarzweiß Scan','Schwellenwert','Scan Kontrast','reines Schwarz Weiß','Graustufen in Schwarzweiß'],
 invert:['Farben umkehren','invertieren','Negativ','weiße Schrift schwarzer Hintergrund'],
 stamp:['Stempel hinzufügen','Eingangsstempel','geprüft stempeln','Datumsstempel','Stempel mit Datum'],
 'edit-metadata':['Metadaten bearbeiten','Titel ändern','Autor ändern','Betreff festlegen','Stichwörter setzen','Dokumenteigenschaften bearbeiten'],
 'remove-annotations':['Anmerkungen entfernen','Kommentare löschen','Markierungen entfernen','PDF Links entfernen','Annotationen löschen'],
 overlay:['PDFs überlagern','Briefpapier hinterlegen','Briefkopf auflegen','Vorlage über PDF legen','PDF Overlay','Deckkraft'],

};
export const normalizeToolQuery=(text:string)=>text.toLocaleLowerCase('de-DE').replace(/ß/g,'ss').replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const stop=new Set('ich mochte will kann kannst bitte mein meine meinen meiner meines mir den die das ein eine einen einem einer der des dem und oder mit von vom zum zur in aus als fur auf an im am es etwas gern gerne machen werden soll setzen festlegen erstellen speichern hinzufugen entfernen loschen andern bearbeiten pdf pdfs dokument dokumente datei dateien'.split(' '));
const tokens=(text:string)=>normalizeToolQuery(text).split(' ').filter(w=>w&&!stop.has(w));
function near(a:string,b:string){
 if(a===b)return 1;
 if(a.length>=2&&b.startsWith(a))return .9;
 if(a.length>=5&&b.length>=5&&a.slice(0,5)===b.slice(0,5))return .75;
 if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return 0;
 let prior=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prior[j]+1,prior[j-1]+(a[i-1]===b[j-1]?0:1));prior=row;}
 return prior[b.length]<=1?.65:0;
}
export function suggestTools(query:string){
 const normalized=normalizeToolQuery(query),words=tokens(query);if(!normalized)return [];if(!words.length)return tools.filter(tool=>aliases[tool.id].some(p=>normalizeToolQuery(p)===normalized)).map(tool=>({...tool,score:100}));
 const ranked=tools.map(tool=>{
  const title=tokens(tool.title),phrases=aliases[tool.id];
  let score=0;
  for(const phrase of [tool.title,...phrases]){
   const parts=tokens(phrase);if(!parts.length)continue;
   const hits=words.map(word=>Math.max(0,...parts.map(part=>near(word,part))));
   const matched=hits.filter(n=>n>0).length;
   if(!matched)continue;
   const coverage=hits.reduce((n,v)=>n+v,0)/words.length;
   let value=coverage*60+matched*9;
   const whole=normalizeToolQuery(phrase);
   if(normalized===whole)value+=80;
   else if(normalized.includes(whole)&&whole.length>3)value+=38;
   if(parts.every(p=>words.some(w=>near(w,p)>=.75)))value+=Math.min(30,parts.length*8);
   if(title.some(p=>words.some(w=>near(w,p)>=.9)))value+=8;
   score=Math.max(score,value);
  }
  // Direction is material when converting: "PDF zu JPG" is not "JPG zu PDF".
  if(/(?:jpg|png|jpeg|bild|bilder|foto|fotos) (?:zu|in|als) (?:eine )?pdf/.test(normalized)&&tool.id==='images')score+=100;
  if(/pdf (?:zu|in|als) (?:ein |eine |einem )?(?:jpg|png|jpeg|bild|bilder|foto)/.test(normalized)&&tool.id==='to-images')score+=100;
  if(/pdf (?:zu|in|als) (?:eine )?(?:word|docx)/.test(normalized)&&tool.id==='pdf-word')score+=100;
  if(/pdf (?:zu|in|als) (?:eine )?(?:powerpoint|pptx|folien)/.test(normalized)&&tool.id==='pdf-powerpoint')score+=100;
  if(/(?:word|docx|excel|xlsx|powerpoint|pptx) (?:zu|in|als) (?:eine )?pdf/.test(normalized)&&tool.id==='office-pdf')score+=100;
  if(/pdf (?:zu|in|als) (?:eine? )?(?:html|webseite)/.test(normalized)&&tool.id==='pdf-html')score+=100;
  if(/(?:html|webseite) (?:zu|in|als) (?:eine? )?pdf/.test(normalized)&&tool.id==='html-pdf')score+=100;
  if(/pdf (?:zu|in|als) (?:eine? )?(?:e book|ebook|epub)/.test(normalized)&&tool.id==='pdf-epub')score+=100;
  if(/(?:e book|ebook|epub) (?:zu|in|als) (?:eine? )?pdf/.test(normalized)&&tool.id==='ebook-pdf')score+=100;
  return {...tool,score};
 }).filter(t=>t.score>=27).sort((a,b)=>b.score-a.score);
 return ranked.filter(tool=>tool.score>=Math.max(27,(ranked[0]?.score||0)*.62));
}
