import {tools,type WorkspaceTool} from './tool-catalog';

// Local intent matching. No document contents or search text leave the browser.
const aliases:Record<WorkspaceTool,string[]>={
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
 ocr:['ocr','Text auslesen','Text erkennen','Text kopieren','Text extrahieren','Scan lesen','gescanntes Dokument','Texterkennung','durchsuchbar machen','durchsuchbare PDF','in Word umwandeln','Word Datei','docx','txt'],
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
  return {...tool,score};
 }).filter(t=>t.score>=27).sort((a,b)=>b.score-a.score);
 return ranked.filter(tool=>tool.score>=Math.max(27,(ranked[0]?.score||0)*.62));
}
