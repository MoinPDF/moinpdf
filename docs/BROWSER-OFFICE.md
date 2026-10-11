# Browser-Office: Freigabeprüfung vom 11. Oktober 2026

Der lokale Office-Konverter ist noch nicht freigegeben. MoinPDF bietet weiter
LibreOffice auf dem eigenen Dokumentenserver. Die folgenden Prüfungen erklären den Stand. Ein neuer Matbee-Kern hat die
CLI-Konvertierungen inzwischen bestanden; seine Browser- und Verteilungsfreigabe
ist noch offen.

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

## Ergänzende Quellprüfung: ONLYOFFICE und neuere Oxi-Revision

Am 11. Oktober wurde zusätzlich eine Browserintegration von ONLYOFFICE geprüft.
Der eigenständige CryptPad-Konverter `onlyoffice-x2t-wasm` hat mit
`v9.3.2+3` zwar ein versioniertes Paket. Er ersetzt aber nicht den Layoutkern:
Die untersuchte Browserintegration lässt das jeweilige Editor-SDK zunächst
den Druckinhalt erzeugen und übergibt diesen anschließend an `bin2pdf`.
Der kleine x2t-Download allein genügt deshalb nicht für Office zu PDF.

Die Dateiauswahl des Wrappers `@agentbridges-ai/onlyoffice-browser` wurde am
Quellstand `d15d12b6945be4d8b0f3aa1806120e740d2950ee` anhand der veröffentlichten
Dateigrößen ausgewertet: ungefähr 268 MiB für die Standardauswahl der drei
Editoren, beziehungsweise 241 MiB nach zusätzlichem Weglassen komprimierter
Duplikate. Benötigte Schriften und MoinPDF kommen hinzu. Auch die Auswahl nur
für Word benötigt ungefähr 148 MiB. Das passt nicht zusätzlich in die bestehende
gehostete Ausgabe. Der Wrapper und SDKJS weisen außerdem AGPL-Bedingungen aus;
die Bedingungen aller beteiligten Komponenten müssen vor einer Einbindung
berücksichtigt werden. Diese Quellprüfung ist kein bestandener Konvertierungstest.

Für Oxi existiert im Repository eine neuere Revision `v0.8.2`. Das veröffentlichte
npm-Paket `@oxidocs/wasm` ist zum Prüfzeitpunkt weiterhin die bereits untersuchte
Version 0.8.0. Die neuere Quellrevision wurde nicht ausgeführt. Ihre Existenz belegt
weder eine Behebung der beobachteten Darstellungsfehler noch eine geprüfte
XLSX-/PPTX-Ausgabe. Kein zusätzlicher Office-Kern wurde eingebaut.

Quellen der ergänzenden Prüfung:
- [Versionierter x2t-Konverter](https://github.com/cryptpad/onlyoffice-x2t-wasm/releases/tag/v9.3.2%2B3)
- [Dateiauswahl des Browser-Wrappers](https://github.com/agentbridges-ai/onlyoffice-browser/blob/d15d12b6945be4d8b0f3aa1806120e740d2950ee/scripts/build-onlyoffice-runtime-assets.mjs)
- [Zugehöriger Dateibaum mit Größen](https://api.github.com/repos/agentbridges-ai/onlyoffice-browser/git/trees/d15d12b6945be4d8b0f3aa1806120e740d2950ee?recursive=1)
- [Oxi-WASM-Adapter v0.8.2](https://github.com/Ryujiyasu/oxi/blob/v0.8.2/crates/oxidocs-wasm/src/lib.rs)
- [Metadaten des veröffentlichten npm-Pakets](https://registry.npmjs.org/@oxidocs%2fwasm/latest)

Ein weiterzuverfolgender Weg ist ein separat ausgelieferter, reproduzierbarer
LibreOffice-WASM-Kern. Er benötigt eine eigenständige Prüfung von Verteilung,
Komponentenhinweisen, Mobilgeräten, Speicherbedarf, Abbruch und Ausgabequalität
aller drei Office-Formate. Bis dahin bleibt die vorhandene Serverkonvertierung
der freigegebene Office-Weg.

## Neuer, funktionierender Kandidat: Matbee 2.7.2

Die erneute Suche ergab `@matbee/libreoffice-converter@2.7.2` (Quellrevision
`b72a3d584bc28c5111afafcf25def7a24fb5fcb0`). Das tatsächlich ausgelieferte
LibreOffice-WASM bestand neun lokale Node-Konvertierungen: die sechs vorhandenen
Office-/ODF-Fixtures sowie reichere DOCX-, XLSX- und PPTX-Dateien. Tabellen, Bilder,
Formelbetrag, Diagramm, Kopf-/Fußzeilen und griechische/kyrillische Zeichen wurden
mit MuPDF und Poppler gegengeprüft. Japanische Zeichen benötigen zusätzliche
Schriften. Dies ist eine bestandene CLI-Probe, keine Browserfreigabe.

Die Kernressourcen lassen sich auf 77.553.637 Byte (73,96 MiB) komprimiert
ausliefern. Damit ist die zuvor festgestellte reine Dateigrößenhürde nicht generell
unlösbar. Der Kern reserviert allerdings 1 GiB gemeinsamen WASM-Speicher; der
Node-Prozess erreichte nach den Proben rund 1,36 GB. Der Browser braucht HTTPS,
COOP/COEP und SharedArrayBuffer. Die tatsächliche Gesamtausgabe und Mobilgeräte
müssen eigenständig geprüft werden.

Der npm-Lieferumfang enthält keine vollständige Lizenz-/Hinweissammlung für den
identifizierten LibreOffice-Core und die 137 mitgelieferten Fontdateien. Vor einer
Verteilung müssen passende Quellen und Hinweise ergänzt werden. Ein generelles
Verteilungsverbot oder eine kostenpflichtige Matbee-Lizenz wurde nicht festgestellt.
Außerdem wartet die vorhandene `destroy()`-Methode zunächst auf eine Workerantwort;
ein hängender Konverter braucht einen eigenen harten Abbruch mit zuverlässiger
Speicherfreigabe. Diese konkreten Integrationsarbeiten bleiben offen. Die Engine
wurde nicht als ungeprüfte App-Abhängigkeit aufgenommen.

Primärquellen:
- [Matbee-Paket und API](https://github.com/matbeedotcom/libreoffice-document-converter/blob/b72a3d584bc28c5111afafcf25def7a24fb5fcb0/README.md)
- [Browser-Worker und Abbruch](https://github.com/matbeedotcom/libreoffice-document-converter/blob/b72a3d584bc28c5111afafcf25def7a24fb5fcb0/src/browser.ts)
- [Identifizierter LibreOffice-Core](https://github.com/LibreOffice/core/commit/d1c9e0e4e1ddeb24fe8f93e56860b3765043f8b1)
- [Zugehöriger Komponenten-/Lizenzkatalog](https://github.com/LibreOffice/core/blob/d1c9e0e4e1ddeb24fe8f93e56860b3765043f8b1/readlicense_oo/license/license.xml)
- [MPL 2.0](https://www.mozilla.org/en-US/MPL/2.0/)

Die Proben sind mit den vorhandenen Office-Fixtures und den Skripten unter
`tests/research/matbee/` wiederholbar. Die dortige Anleitung hält Paketversion,
Integrität und Abnahmegrenzen fest.
