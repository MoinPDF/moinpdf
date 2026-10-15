"""Production browser acceptance for local shaping and nested instance editing."""
import json
import ipaddress
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.parse
import pymupdf
from browser_runtime import launch_browser
from playwright.sync_api import expect, sync_playwright

origin = os.environ['MOINPDF_TEST_URL']
if os.environ.get('MOINPDF_TEST_NONLOCAL_HTTP') == '1':
    addresses = subprocess.check_output(['hostname', '-I'], text=True).split()
    host = next(value for value in addresses
                if ipaddress.ip_address(value).version == 4 and not ipaddress.ip_address(value).is_loopback)
    origin = f'http://{host}:8080'
evidence = Path('web-evidence')
evidence.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as temporary, sync_playwright() as api:
    folder = Path(temporary)
    source_path = folder / 'paragraph.pdf'
    with pymupdf.open() as source:
        source.new_page(width=600, height=400).insert_text((60, 70), 'ORIGINAL PARAGRAPH', fontsize=20)
        source.save(source_path)
    nested_path = folder / 'nested.pdf'
    with pymupdf.open() as leaf, pymupdf.open() as middle, pymupdf.open() as document:
        leaf.new_page(width=200, height=100).insert_text((20, 40), 'ORIGINAL', fontsize=20)
        middle.new_page(width=220, height=120).show_pdf_page(pymupdf.Rect(10, 10, 210, 110), leaf, 0)
        page = document.new_page(width=600, height=300)
        page.show_pdf_page(pymupdf.Rect(10, 10, 230, 130), middle, 0)
        page.show_pdf_page(pymupdf.Rect(310, 10, 530, 130), middle, 0)
        document.save(nested_path)
    browser = launch_browser(api)
    page = browser.new_page(viewport={'width':1440,'height':1000}, accept_downloads=True)
    page.set_default_timeout(120000)
    errors, external, uploads, requested, console_errors = [], [], [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    def route(r):
        url = r.request.url
        requested.append(url)
        if r.request.method == 'POST' or '/api/documents/' in url:
            uploads.append(url)
            r.abort()
        elif urllib.parse.urlsplit(url).netloc != urllib.parse.urlsplit(origin).netloc and not url.startswith(('blob:', 'data:')):
            external.append(url)
            r.abort()
        else:
            r.continue_()
    page.route('**/*', route)
    def open_tool(path):
        page.goto(origin)
        page.locator('input[type=file]').first.set_input_files(str(path))
        expect(page.get_by_role('heading', name='Was möchtest du tun?', exact=True)).to_be_visible()
        page.get_by_role('button', name='PDF-Objekte bearbeiten', exact=True).click()
    def download(name):
        link=page.get_by_role('link', name='Herunterladen', exact=True)
        expect(link.or_(page.get_by_role('alert'))).to_be_visible(timeout=125000)
        assert link.is_visible(), page.get_by_role('alert').inner_text()
        with page.expect_download() as pending:
            link.click()
        target=folder/name
        pending.value.save_as(target)
        return target
    try:
        open_tool(source_path)
        page.get_by_label('Bearbeitung', exact=True).select_option('paragraph')
        page.get_by_role('button', name='Textobjekte laden', exact=True).click()
        original=page.get_by_role('checkbox', name=re.compile('ORIGINAL PARAGRAPH'))
        expect(original.or_(page.get_by_role('alert'))).to_be_visible(timeout=125000)
        assert original.is_visible(), page.get_by_role('alert').inner_text()
        original.check()
        page.get_by_role('button', name='Auswahl als Absatz laden', exact=True).click()
        text='MoinPDF किताब क्षत्रिय कर्म'
        page.get_by_label('Neuer Absatztext', exact=True).fill(text)
        page.get_by_label('Absatzschriftgröße (pt)', exact=True).fill('18')
        page.get_by_role('button', name='Absatz exportieren', exact=True).click()
        shaped=download('shaped.pdf')
        with pymupdf.open(shaped) as document:
            actual=document[0].get_text()
            assert actual.strip() == text, actual
            document[0].get_pixmap(matrix=pymupdf.Matrix(2,2)).save(evidence/'native-shaping-output.png')
        assert any('harfbuzz-' in url and '.wasm' in url for url in requested), 'Real HarfBuzz WASM was not loaded'
        assert any('NotoSansDevanagari-Regular.ttf' in url for url in requested), 'Automatic local font fallback was not loaded'
        page.screenshot(path=str(evidence/'native-shaping-browser.png'), full_page=True)
        # Reopen the result and replace it: both the logical text and visible glyphs must disappear.
        open_tool(shaped)
        page.get_by_label('Bearbeitung', exact=True).select_option('paragraph')
        page.get_by_role('button', name='Textobjekte laden', exact=True).click()
        page.get_by_role('checkbox', name=re.compile('MoinPDF')).check()
        page.get_by_role('button', name='Auswahl als Absatz laden', exact=True).click()
        expect(page.get_by_label('Neuer Absatztext', exact=True)).to_have_value(text)
        page.get_by_label('Neuer Absatztext', exact=True).fill('ERNEUT BEARBEITET')
        page.get_by_role('button', name='Absatz exportieren', exact=True).click()
        repeated=download('repeated.pdf')
        with pymupdf.open(repeated) as document:
            actual=document[0].get_text()
            assert actual.strip() == 'ERNEUT BEARBEITET', actual
        open_tool(nested_path)
        page.get_by_role('button', name='Seitenobjekte laden', exact=True).click()
        for _ in range(10):
            chooser=page.get_by_label('Objekt auswählen', exact=True)
            expect(chooser).to_be_visible(timeout=125000)
            options=chooser.locator('option').evaluate_all('(nodes)=>nodes.map(n=>({value:n.value,text:n.textContent}))')
            text_option=next((o for o in options if 'ORIGINAL' in o['text']), None)
            if text_option:
                chooser.select_option(text_option['value'])
                break
            group=next(o for o in options if 'gruppe' in o['text'].lower())
            chooser.select_option(group['value'])
            open_group=page.get_by_role('button', name='Gruppeninhalt bearbeiten', exact=True)
            open_group.click()
            expect(open_group).to_have_count(0, timeout=125000)
        else:
            raise AssertionError('Nested text was not reachable')
        page.get_by_label('Textinhalt', exact=True).fill('EDITED')
        page.get_by_role('button', name='Objektänderung exportieren', exact=True).click()
        edited=download('nested-edited.pdf')
        with pymupdf.open(edited) as document:
            actual=document[0].get_text()
            assert actual.count('EDITED')==1 and actual.count('ORIGINAL')==1, actual
            document[0].get_pixmap(matrix=pymupdf.Matrix(2,2)).save(evidence/'native-nested-output.png')
        page.screenshot(path=str(evidence/'native-nested-browser.png'), full_page=True)
        assert not errors, errors
        assert not external, external
        assert not uploads, uploads
        print('PASS: production HarfBuzz/WASM, local font fallback, paragraph readback/replacement and isolated nested editing without uploads.')
    except Exception:
        page.screenshot(path=str(evidence/'native-editor-failure.png'), full_page=True)
        print(page.locator('body').inner_text())
        print('Console errors:', console_errors)
        print('Requests:', requested)
        raise
    finally:
        (evidence/'native-editor-browser.json').write_text(json.dumps({'errors':errors,'external':external,'uploads':uploads,'console_errors':console_errors},ensure_ascii=False,indent=2))
        browser.close()
