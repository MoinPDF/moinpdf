# Isolated LibreOffice WASM probe

[Deutsch](README.md) · **English** · [← Development](../../../docs/DEVELOPMENT.en.md)

This isolated research probe is not part of the production build and does not establish readiness for packaging, browsers, mobile devices or reliable forced cancellation. For the subsequently integrated production runtime, see [Browser Office](../../../docs/BROWSER-OFFICE.en.md).

Run in a new, empty probe directory; replace REPO with the absolute path to your MoinPDF checkout. Python requires python-docx, openpyxl, python-pptx, Pillow and, for independent output checks, PyMuPDF or Poppler.

```bash
curl -L --fail -o matbee-2.7.2.tgz https://registry.npmjs.org/@matbee/libreoffice-converter/-/libreoffice-converter-2.7.2.tgz
printf '%s  %s\n' '14d670936fe220ee49becbfd40bf233ceabb94981fa9987fccde345449ee2c3a' 'matbee-2.7.2.tgz' | sha256sum --check
tar -xzf matbee-2.7.2.tgz
npm install --ignore-scripts --no-save --package-lock=false --omit=optional zod@4.1.13
python REPO/tests/research/docx-fixture.py fixtures
python REPO/tests/research/matbee/generate-rich-fixtures.py
node REPO/tests/research/matbee/probe.mjs REPO/tests/fixtures/office
```

Check outputs in `results/` with independent readers: text and glyphs, PNG colours, table borders, line/page breaks, headers/footers, the XLSX sum and chart, and both PPTX slides. A valid PDF header alone is insufficient. The watchdog terminates the CLI probe after 180 seconds; that does not prove browser cancellation works.

Verified scope and limitations: [Browser Office](../../../docs/BROWSER-OFFICE.en.md).
