# Browser-Office: Freigabeprüfung vom 11. Oktober 2026

Der lokale Office-Konverter ist noch nicht freigegeben. MoinPDF bietet weiter
LibreOffice auf dem eigenen Dokumentenserver. Die Tests der beiden folgenden
Browser-Kerne erklären die verbleibenden Hindernisse.

## ZetaOffice / ZetaJS

Die JavaScript-Brücke allein enthält kein Office. Der untersuchte offizielle
CDN-Kern meldet ZetaOffice 24.2, Build
`efaf0670b4d055f838a2849becb10f08aa06a257` (13. Mai 2025).
Die vier benötigten Dateien ergeben dekomprimiert 262.261.407 Byte (250,11 MiB).
Zusammen mit MoinPDF übersteigt das die Grenze der gehosteten Ausgabe von 256 MiB.
Der vorliegende Kern reserviert außerdem 1 GiB gemeinsam genutzten Browser-Speicher
und benötigt COOP/COEP. Ein eigener Docker-Auslieferungsweg könnte die Größenhürde
lösen, benötigt aber weiterhin ein überprüftes, dauerhaft verfügbares Paket samt
vollständigen Komponentenhinweisen und zugehörigen Quellständen. Die derzeitigen
CDN-Adressen enthalten `zetaoffice_latest`, keine unveränderliche Versionsadresse.

Primärquellen:
- https://github.com/allotropia/zetajs
- https://github.com/LibreOffice/core/tree/efaf0670b4d055f838a2849becb10f08aa06a257/static

## Kleinerer DOCX-Kern: @oxidocs/wasm 0.8.0

WASM: 37.311.644 Byte. Untersuchte npm-Quellrevision:
`86ba842a54dd2218a38993be6e01c59f4ccfee3b` (abweichend vom Git-Tag v0.8.0).
Der tatsächliche Aufruf `docx_to_pdf` wurde mit selbst erzeugten DOCX-Dateien
getestet. Ein einfacher zweitseitiger Text mit Umlauten wurde korrekt exportiert.
Eine reichere Datei mit Bild, Tabelle und mehreren Schriften zeigte dagegen:

- Das eingebettete RGB-PNG erschien als schwarzer Bereich mit Pixelrauschen.
- Tabellenrahmen und Tabelleninhalt waren gegeneinander verschoben.
- Griechische Zeichen in der Cambria/Caladea-Ersetzung erschienen als Kästchen;
  Alpha wurde im exportierten Text sogar als Omega zurückgelesen.

Die Befunde wurden durch unabhängiges Rendering und Textlesen mit MuPDF und
Poppler kontrolliert. Damit scheidet diese Version für die Freigabe aus. Sie wurde
nicht als MoinPDF-Abhängigkeit aufgenommen. Ein funktionierender einfacher
Texttest reicht für einen verlässlichen Office-Konverter nicht aus.

Vor einer späteren Freigabe erneut prüfen: Text und Glyphen, Absätze und Umbruch,
Tabellenrahmen/Zellen, Bilder/Farben, Kopf-/Fußzeilen, Seitenumbrüche, Abbruch,
Größenlimits, Datenschutz sowie passende Quell- und Lizenzhinweise. XLSX und PPTX
sind durch diesen DOCX-Aufruf nicht abgedeckt.


Quellstand der kleineren Alternative:
https://github.com/Ryujiyasu/oxi/tree/86ba842a54dd2218a38993be6e01c59f4ccfee3b

Die synthetische Datei lässt sich mit `tests/research/docx-fixture.py` erneut
anlegen. `tests/research/office-wasm-probe.mjs` verwendet ausschließlich einen
explizit angegebenen, separat entpackten Runtime-Ordner. Der Test bindet den
verworfenen Kern nicht in MoinPDF ein. Ergebnis mit mindestens einem unabhängigen
PDF-Renderer und Textleser gegen die Fixture prüfen, insbesondere die drei
farbigen geometrischen Formen, Tabellenrahmen und die Zeile mit Cambria.
