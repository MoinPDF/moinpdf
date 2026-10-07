import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
await mkdir('.sites-runtime',{recursive:true});
for(const name of ['tool-catalog','tool-search']){
 const source=await readFile(`lib/${name}.ts`,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("'./tool-catalog'","'./tool-catalog-test.mjs'");
 await writeFile(`.sites-runtime/${name}-test.mjs`,code);
}
const {tools}=await import('../.sites-runtime/tool-catalog-test.mjs');
const {suggestTools}=await import('../.sites-runtime/tool-search-test.mjs');
for(const tool of tools)assert.equal(suggestTools(tool.title)[0]?.id,tool.id,tool.title);
const cases=[
 ['Zahlenvergleich','number-compare'],['viele Rechnungen nach Excel','field-collector'],['XML weicht von PDF ab','invoice-visual-check'],['fehlende Seiten finden','page-gaps'],['OCR Fehler korrigieren','ocr-review'],['Namen durch Platzhalter ersetzen','pseudonymize'],['Anlagenverweise verlinken','attachment-links'],['beste Seiten aus mehreren Scans','best-scans'],['Positionen abgleichen','document-reconcile'],['Kommentare exportieren','comment-export'],
 ['PDF reparieren','pdf-repair'],['PDF auf 2 MB verkleinern','optimize-pdf'],['Sammelscans trennen','scan-split'],['PDF zu Markdown','pdf-markdown'],['PDF zu HTML','pdf-html'],['HTML zu PDF','html-pdf'],['PDF zu EPUB','pdf-epub'],['EPUB zu PDF','ebook-pdf'],
 ['PDF in 5 MB aufteilen','split-size'],['Word zu PDF','office-pdf'],['PDF zu PowerPoint','pdf-powerpoint'],['PowerPoint zu PDF','office-pdf'],['EML zu PDF','email-pdf'],['HTML zu PDF','html-pdf'],['Seiten automatisch ausrichten','auto-orient'],['Buchfalz','book-dewarp'],['Formularfelder erkennen','form-detect'],['Schwärzungen prüfen','redaction-check'],['Druckqualität prüfen','print-check'],['Barrierefreiheit prüfen','accessibility-check'],['PDF übersetzen','translate-pdf'],['ZUGFeRD erstellen','zugferd-create'],['Word Serienbrief','word-mail-merge'],
 ['Passwort setzen','protect'],['Passwort entfernen','unlock'],['XRechnung öffnen','invoice-read'],['Rechnungssummen prüfen','invoice-check'],['ZUGFeRD anzeigen','invoice-read'],['XML zu PDF','invoice-read'],
 ['PDF ausfüllbar machen','create-form'],['Formular ausfüllen','fill-form'],['Kapitelstruktur','bookmarks'],['Bilder extrahieren','extract-images'],['Fotos herauslösen','extract-images'],
 ['Text ersetzen','edit-text'],['Schrift ändern','edit-text'],['PDF bearbeiten','edit-text'],['Bereich löschen','erase'],['Bild einfügen','insert-image'],['Logo einfügen','insert-image'],
 ['Ich möchte zwei Versionen vergleichen','compare'],['Rechnungs XML extrahieren','attachments'],['Dokumentbericht','pdf-info'],['in Pakete teilen','split-ranges'],['Vorderseiten und Rückseiten','interleave'],['Heft drucken','booklet'],['Doppelseite halbieren','split-grid'],['Ränder automatisch abschneiden','auto-crop'],['Schwellenwert','bilevel'],['Farben invertieren','invert'],['Eingangsstempel','stamp'],['Autor ändern','edit-metadata'],['Kommentare löschen','remove-annotations'],['Briefpapier hinterlegen','overlay'],
 ['Ich möchte meine PDF kleiner machen','compress'],['Text aus einem Scan lesen','ocr'],['PDF in Word umwandeln','pdf-word'],['PDF zu JPG','to-images'],['JPG zu PDF','images'],['Bilder in PDF','images'],['Ich will mehrere PDFs verbinden','merge'],['zusammenfugen','merge'],['zusammenfüge','merge'],['Jede Seite einzeln speichern','split'],['Seiten entfernen','organize'],['Seite drehen','organize'],['Seitennummern einfügen','numbers'],['Papiergröße A4','resize'],['zwei Seiten auf ein Blatt','nup'],['Namen schwärzen','redact'],['Rand abschneiden','crop'],['Text hervorheben','annotate'],['unterschreiben','sign'],['Wasserzeichen Entwurf','watermark'],['schwarz weiss','grayscale'],['Text nicht kopierbar','flatten'],['Autor entfernen','metadata'],['Doppelte Seiten finden','inspect'],['kompri','compress'],
];
for(const [query,id] of cases)assert.equal(suggestTools(query)[0]?.id,id,query);
for(const query of ['',' ','ich möchte eine PDF','Mondrakete starten'])assert.equal(suggestTools(query).length,0,query);
assert.deepEqual(suggestTools('Text aus einem Scan lesen').map(t=>t.id),['ocr']);
console.log(`PASS: all ${tools.length} tool titles, ${cases.length} natural-language queries, conversion direction, prefixes, umlaut alternatives and unsupported requests.`);
