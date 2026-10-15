# Isolierte LibreOffice-WASM-Probe

**Deutsch** · [English](README.en.md) · [← Entwicklung](../../../docs/ENTWICKLUNG.md)

Diese isolierte Forschungsprobe ist kein Bestandteil des Produktionsbuilds und
belegt keine Freigabe für Paketierung, Browser, Mobilgeräte oder zuverlässigen harten
Abbruch. Die inzwischen integrierte Produktionslaufzeit ist unter
[Browser-Office](../../../docs/BROWSER-OFFICE.md) beschrieben.

In einem neuen, leeren Probeordner ausführen; REPO durch den absoluten Pfad des
MoinPDF-Checkouts ersetzen. Python benötigt python-docx, openpyxl, python-pptx,
Pillow und für die unabhängige Ausgabeprüfung PyMuPDF bzw. Poppler.

```bash
curl -L --fail -o matbee-2.7.2.tgz https://registry.npmjs.org/@matbee/libreoffice-converter/-/libreoffice-converter-2.7.2.tgz
printf '%s  %s\n' '14d670936fe220ee49becbfd40bf233ceabb94981fa9987fccde345449ee2c3a' 'matbee-2.7.2.tgz' | sha256sum --check
tar -xzf matbee-2.7.2.tgz
npm install --ignore-scripts --no-save --package-lock=false --omit=optional zod@4.1.13
python REPO/tests/research/docx-fixture.py fixtures
python REPO/tests/research/matbee/generate-rich-fixtures.py
node REPO/tests/research/matbee/probe.mjs REPO/tests/fixtures/office
```

Die Ergebnisse unter `results/` mit unabhängigen Lesern prüfen: Text und Glyphen,
PNG-Farben, Tabellenrahmen, Zeilen-/Seitenumbrüche, Kopf-/Fußzeilen, XLSX-Summe und
Diagramm sowie beide PPTX-Folien. Ein gültiger PDF-Header allein reicht nicht.
Der Watchdog beendet die CLI-Probe nach 180 Sekunden; das ist kein Nachweis eines
funktionierenden Browserabbruchs.

Geprüfter Umfang und Grenzen: [Browser-Office](../../../docs/BROWSER-OFFICE.md).
