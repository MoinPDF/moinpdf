"""Production browser journeys, synthetic inputs and independently inspected downloads."""
import atexit
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import zipfile
from urllib.request import urlopen
import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.getenv('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path('.cache/editor-browser/formats031'); out.mkdir(parents=True, exist_ok=True)
if os.getenv('MOINPDF_TEST_START_SERVER') == '1':
    log = (out / 'http.log').open('w')
    server = subprocess.Popen([sys.executable, 'tests/text-browser-server.py'], stdout=log, stderr=subprocess.STDOUT)
    def cleanup():
        server.terminate(); server.wait(timeout=10); log.close()
    atexit.register(cleanup)
    for _ in range(50):
        try:
            with urlopen(origin, timeout=1) as response:
                if response.status == 200: break
        except OSError: time.sleep(.1)
    else: raise RuntimeError('Production server unavailable')

fixture = out / 'fictional.pdf'
with pymupdf.open() as pdf:
    page = pdf.new_page(width=300, height=400)
    page.insert_text((25, 40), 'Fictional format test 031')
    page.draw_rect(pymupdf.Rect(25, 80, 80, 130), color=(1, 0, 0), fill=(1, 0, 0))
    pdf.new_page(width=300, height=400)
    pdf.xref_set_key(pdf.pdf_catalog(), 'OpenAction', '<< /S /JavaScript /JS (globalThis.MOINPDF_EXECUTED=true;) >>')
    pdf.save(fixture)
inputs = {'markdown': ('sample.md', '# Fictional Markdown\n\n**Bold** and *italic*.\n\n| Name | Value |\n|---|---|\n| Sample | 123 |'),
          'txt': ('sample.txt', 'Fictional plain text\nSecond line'),
          'csv': ('sample.csv', 'Name;Value\n"Fictional; record";123.45'),
          'xml': ('sample.xml', '<rows><row id="1"><name>Fictional XML</name></row></rows>')}
for name, value in inputs.values(): (out / name).write_text(value)
catalog = json.loads(Path('public/locales/en.json').read_text()); reports = []
with sync_playwright() as api:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS', 'chromium').split(','):
        for en in (False, True):
            browser = getattr(api, engine).launch()
            context = browser.new_context(viewport={'width': 390 if en else 1440, 'height': 950}, has_touch=en, reduced_motion='reduce', accept_downloads=True)
            page = context.new_page(); page.set_default_timeout(45000)
            errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
            case = engine + ('-touch-en' if en else '-desktop-de')
            def t(value): return catalog.get(value, value) if en else value
            def button(value): return page.get_by_role('button', name=t(value), exact=True)
            def label(value): return page.get_by_label(t(value), exact=True)
            def choose(value):
                page.locator('.chooser-tool').filter(has=page.get_by_text(t(value), exact=True)).click()
                expect(page.get_by_role('heading', name=t(value), exact=True)).to_be_visible()
            def back(): button('Zurück zur Auswahl').click()
            def download(name):
                link = page.locator('.advanced-result a[download][href^="blob:"]').first
                expect(link).to_be_visible(timeout=120000)
                with page.expect_download(timeout=120000) as event: link.click()
                path = out / (case + '-' + name); event.value.save_as(path); return path
            def overflow(): assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), case
            try:
                page.goto(origin + ('?lang=en' if en else '?lang=de'))
                button('Alle Werkzeuge').click(); choose('Text & Daten zu PDF')
                for fmt, (name, _) in inputs.items():
                    label('Text- oder Datendatei').set_input_files(str((out / name).resolve()))
                    expect(label('Eingabeformat')).to_have_value(fmt)
                    button('PDF erstellen').click()
                    with pymupdf.open(download(fmt + '.pdf')) as pdf: assert 'Fictional' in ''.join(p.get_text() for p in pdf)
                    overflow()
                back(); page.locator('input[type=file]').first.set_input_files(str(fixture.resolve()))
                expect(page.locator('.chooser-tool')).to_have_count(133)
                choose('PDF & JSON umwandeln'); button('PDF-Struktur exportieren').click()
                exported = download('pdf.json'); assert json.loads(exported.read_text())['qpdf'][0]['jsonversion'] == 2
                label('Richtung').select_option('import'); label('PDF-JSON-Datei').set_input_files(str(exported.resolve()))
                button('PDF wiederherstellen').click()
                with pymupdf.open(download('restored.pdf')) as pdf:
                    assert len(pdf) == 2 and 'Fictional format' in pdf[0].get_text()
                overflow(); back(); choose('Scannereffekt'); label('Auflösung').select_option('72'); button('Scannereffekt anwenden').click()
                with pymupdf.open(download('scan.pdf')) as pdf:
                    assert len(pdf) == 2 and not ''.join(p.get_text() for p in pdf).strip()
                    assert sum(v < 245 for v in pdf[0].get_pixmap().samples) > 100
                overflow(); back(); choose('PDF zu Comicarchiv'); label('Auflösung').select_option('72'); label('Bildformat').select_option('png'); button('Comicarchiv erstellen').click()
                with zipfile.ZipFile(download('comic.cbz')) as z:
                    assert z.namelist() == ['0001.png', '0002.png']
                    assert z.read('0001.png').startswith(b'\x89PNG')
                label('Comicformat').select_option('cbr'); expect(page.get_by_text(t('CBR benötigt einen eigenen Dokumentenserver mit separat installiertem und passend lizenziertem RAR-Konverter. CBZ wird lokal im Browser erstellt.'))).to_be_visible()
                overflow(); back(); choose('PDF-JavaScript anzeigen'); button('JavaScript anzeigen').click()
                report = json.loads(download('scripts.json').read_text()); assert 'MOINPDF_EXECUTED' in report['scripts'][0]['code']
                assert page.evaluate('globalThis.MOINPDF_EXECUTED') is None
                back(); choose('PDF für KI vorbereiten'); button('LlamaIndex-JSON erstellen').click()
                data = json.loads(download('ai.json').read_text()); assert len(data) == 2 and data[0]['metadata']['page_number'] == 1 and data[1]['text'] == ''
                overflow(); back(); choose('PDF-Text zu JSON & XML'); label('Ausgabeformat').select_option('xml'); button('XML exportieren').click()
                assert '<documents schema="moinpdf-document/1">' in download('structure.xml').read_text()
                # Format selections remain available even when this static test host has no document server.
                for tool, fmt in [('PDF zu Word', 'odt'), ('PDF zu PowerPoint', 'odp')]:
                    back(); choose(tool); label('Ausgabeformat').select_option(fmt); overflow()
                assert not errors, errors
                reports.append({'browser': engine, 'language': 'en' if en else 'de', 'touch_emulation': en, 'status': 'passed'})
                page.screenshot(path=str(out / (case + '.png')), full_page=True)
            except Exception:
                page.screenshot(path=str(out / (case + '-failed.png')), full_page=True)
                raise
            finally:
                context.close(); browser.close()
(out / 'report.json').write_text(json.dumps(reports, indent=2))
print('PASS: formats 0.31 journeys', reports)
