"""Exercise all shipped tool views and real downloads on desktop and mobile."""
import json
import os
from pathlib import Path
import re
import ipaddress
import subprocess
import tempfile
import wave
import zipfile

import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.environ.get('MOINPDF_TEST_URL', 'http://localhost:8785')
nonlocal_http = os.environ.get('MOINPDF_TEST_NONLOCAL_HTTP') == '1'
if nonlocal_http:
    addresses = subprocess.check_output(['hostname', '-I'], text=True).split()
    host = next(value for value in addresses
                if ipaddress.ip_address(value).version == 4 and not ipaddress.ip_address(value).is_loopback)
    origin = f'http://{host}:8080'
require_server = os.environ.get('MOINPDF_REQUIRE_SERVER') == '1'
evidence = Path('web-evidence')
evidence.mkdir(exist_ok=True)
completed = []

def chooser(page):
    page.get_by_role('heading', name='Was möchtest du tun?', exact=True).wait_for()
    expect(page.locator('.chooser-tool')).to_have_count(112)

def back(page):
    page.get_by_role('button', name=re.compile(r'^(Alle Werkzeuge|Werkzeug wechseln)$')).click()
    chooser(page)

def no_overflow(page, context):
    dimensions = page.evaluate('({width:innerWidth, content:document.documentElement.scrollWidth})')
    assert dimensions['content'] <= dimensions['width'] + 2, f'Horizontal overflow in {context}: {dimensions}'

def all_views(page, messages, context, empty=False):
    titles = page.locator('.chooser-tool strong').all_text_contents()
    assert len(titles) == len(set(titles)) == 112
    for title in titles:
        page.locator('.chooser-tool').filter(has=page.get_by_text(title, exact=True)).click()
        if empty and page.locator('.upload-entry').is_visible():
            # File-dependent classic tools deliberately return to the file picker.
            expect(page.get_by_role('button', name='PDF oder andere Datei auswählen', exact=True)).to_be_visible()
            assert not messages, f'JavaScript exception in {context} / {title}: {messages}'
            no_overflow(page, context + ' / ' + title)
            page.get_by_role('button', name='Alle Werkzeuge', exact=True).click()
            chooser(page)
            continue
        expect(page.locator('main h1')).to_have_text(title, timeout=30000)
        assert not messages, f'JavaScript exception in {context} / {title}: {messages}'
        no_overflow(page, context + ' / ' + title)
        back(page)
    completed.append(f'{context}: all 112 tool entries checked without losing files')

with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page.set_default_timeout(30000)
    console, errors = [], []
    page.on('console', lambda message: console.append(f'{message.type}: {message.text}'))
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(origin)
        if nonlocal_http:
            assert page.evaluate('isSecureContext') is False
            assert page.evaluate('typeof crypto.randomUUID') == 'undefined'
        logo = page.get_by_role('img', name='MoinPDF. Papierkram. Läuft.', exact=True)
        expect(logo).to_be_visible()
        expect(logo).to_have_js_property('complete', True)
        assert logo.evaluate('(image) => image.naturalWidth > 0')
        no_overflow(page, 'home')
        page.screenshot(path=str(evidence / 'desktop-home.png'), full_page=True)
        for label in ('Impressum', 'Datenschutzerklärung'):
            link = page.get_by_role('link', name=re.compile('^' + label))
            response = page.request.get(origin + link.get_attribute('href'))
            assert response.ok, f'{label} link is broken'
        page.get_by_role('button', name='Alle Werkzeuge', exact=True).click()
        chooser(page)
        all_views(page, errors, 'Desktop without input', empty=True)

        pdf_path = Path(temporary) / 'moinpdf-ui-test.pdf'
        with pymupdf.open() as document:
            for text in ('Moin aus dem Norden. Rechnung vom 07.10.2026.', 'Zweite Seite. Betrag 25,50 Euro.'):
                document.new_page().insert_text((50, 60), text)
            document.set_toc([[1, 'Einleitung', 1], [1, 'Zweites Kapitel', 2]])
            document.save(pdf_path)
        page.locator('input[type="file"]').first.set_input_files(str(pdf_path))
        chooser(page)
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·2 Seiten')
        categories = page.get_by_role('group', name='Werkzeugkategorien')
        total = 0
        for label in ('Prüfen', 'Umwandeln', 'Seiten', 'Bearbeiten', 'Stapel'):
            categories.get_by_role('button', name=label, exact=True).click()
            expect(categories.get_by_role('button', name=label, exact=True)).to_have_attribute('aria-pressed', 'true')
            count = page.locator('.chooser-tool').count()
            assert count > 0, f'Empty category {label}'
            total += count
        assert total == 112
        categories.get_by_role('button', name='Alle', exact=True).click()
        chooser(page)
        search = page.get_by_placeholder('Zum Beispiel: PDF kleiner machen …', exact=True)
        search.fill('PDF vorlesen')
        expect(page.get_by_role('option').first).to_contain_text('PDF als Hörbuch')
        search.fill('')
        page.screenshot(path=str(evidence / 'desktop-tools.png'), full_page=True)
        all_views(page, errors, 'Desktop with PDF')
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·2 Seiten')

        page.get_by_role('button', name='Seiten organisieren', exact=True).click()
        page.get_by_role('tab', name='Dokument', exact=True).click()
        preview = page.get_by_role('img', name='moinpdf-ui-test.pdf, Seite 1', exact=True)
        expect(preview).to_be_visible()
        expect(preview).to_have_js_property('complete', True)
        assert preview.evaluate('(image) => image.naturalWidth > 0')
        page.get_by_role('button', name='Seiten speichern', exact=True).click()
        expect(page.get_by_role('heading', name='Erledigt.', exact=True)).to_be_visible()
        with page.expect_download() as download:
            page.locator('a[download]').first.click()
        saved = Path(temporary) / 'organisiert.pdf'
        download.value.save_as(saved)
        with pymupdf.open(saved) as document:
            assert len(document) == 2
            assert 'Moin aus dem Norden' in document[0].get_text()
            assert 'Zweite Seite' in document[1].get_text()
        completed.append('Real PDF preview and two-page PDF download independently read back')
        back(page)

        page.get_by_role('button', name='PDF-Objekte bearbeiten', exact=True).click()
        page.get_by_role('button', name='Seitenobjekte laden', exact=True).click()
        page.get_by_label('Objekt auswählen', exact=True).select_option(index=1)
        page.get_by_label('Textinhalt', exact=True).fill('Moin mit Originalschrift.')
        page.get_by_role('button', name='Objektänderung exportieren', exact=True).click()
        expect(page.locator('.advanced-result')).to_be_visible()
        with page.expect_download() as download:
            page.locator('.advanced-result a[download]').click()
        saved = Path(temporary) / 'native-objekte.pdf'
        download.value.save_as(saved)
        with pymupdf.open(saved) as document:
            assert 'Moin mit Originalschrift.' in document[0].get_text()
            assert 'Moin aus dem Norden' not in document[0].get_text()
            assert 'Zweite Seite' in document[1].get_text()
        completed.append('Production PDFium worker changes original text; independent PyMuPDF readback')
        back(page)

        page.get_by_role('button', name='PDF-Objekte bearbeiten', exact=True).click()
        page.get_by_label('Bearbeitung', exact=True).select_option('paragraph')
        page.get_by_role('button', name='Textobjekte laden', exact=True).click()
        page.locator('.paragraph-object-list input[type="checkbox"]').first.check()
        page.get_by_role('button', name='Auswahl als Absatz laden', exact=True).click()
        paragraph_text = 'Neuer Absatz mit Umlauten: ÄÖÜ. Dieser längere Text wird automatisch auf mehrere Zeilen verteilt und bleibt auswählbar.'
        page.get_by_label('Neuer Absatztext', exact=True).fill(paragraph_text)
        page.get_by_label('Links (%)', exact=True).fill('10')
        page.get_by_label('Oben (%)', exact=True).fill('10')
        page.get_by_label('Breite (%)', exact=True).fill('50')
        page.get_by_label('Höhe (%)', exact=True).fill('35')
        page.get_by_role('button', name='Absatzvorschau berechnen', exact=True).click()
        expect(page.get_by_role('heading', name=re.compile('Ergebnisvorschau'))).to_be_visible()
        page.get_by_role('button', name='Absatz exportieren', exact=True).click()
        expect(page.locator('.advanced-result')).to_be_visible()
        with page.expect_download() as download:
            page.locator('.advanced-result a[download]').click()
        saved = Path(temporary) / 'absatz.pdf'
        download.value.save_as(saved)
        with pymupdf.open(saved) as document:
            text = document[0].get_text()
            assert ' '.join(paragraph_text.split()) in ' '.join(text.split())
            assert 'Moin aus dem Norden' not in text
            assert 'Zweite Seite' in document[1].get_text()
        page.get_by_label('Höhe (%)', exact=True).fill('1')
        page.get_by_role('button', name='Absatz exportieren', exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text(re.compile('Textüberlauf|kleiner als sein Innenabstand'))
        completed.append('Paragraph selection, embedded Unicode font, real PDFium result preview/export and overflow rejection in production UI')
        page.get_by_label('Höhe (%)', exact=True).fill('35')
        paragraph_input = page.get_by_label('Neuer Absatztext', exact=True)
        paragraph_input.press('Control+Home')
        for _ in range(5):
            paragraph_input.press('Shift+ArrowRight')
        page.get_by_role('button', name='Markierten Text anders formatieren', exact=True).click()
        page.get_by_label('Formatierung 1: Schriftgröße', exact=True).fill('24')
        page.get_by_role('button', name='Absatz exportieren', exact=True).click()
        expect(page.locator('.advanced-result')).to_be_visible()
        with page.expect_download() as download:
            page.locator('.advanced-result a[download]').click()
        saved = Path(temporary) / 'absatz-formatiert.pdf'
        download.value.save_as(saved)
        with pymupdf.open(saved) as document:
            spans = [span for block in document[0].get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for span in line['spans']]
            assert any(abs(span['size']-24)<.1 for span in spans), spans
            assert any(abs(span['size']-12)<.1 for span in spans), spans
        paragraph_input.fill((paragraph_text+' ')*5)
        page.get_by_label('Höhe (%)', exact=True).fill('8')
        page.get_by_role('checkbox', name='Bei Textüberlauf neue Folgeseiten einfügen', exact=True).check()
        page.get_by_role('button', name='Absatz exportieren', exact=True).click()
        expect(page.locator('.advanced-result')).to_be_visible()
        with page.expect_download() as download:
            page.locator('.advanced-result a[download]').click()
        saved = Path(temporary) / 'absatz-folgeseiten.pdf'
        download.value.save_as(saved)
        with pymupdf.open(saved) as document:
            assert len(document)>2
            assert 'Zweite Seite' in document[-1].get_text()
            combined=' '.join(' '.join(p.get_text().split()) for p in document)
            assert combined.count('Neuer Absatz mit Umlauten')==5
        completed.append('Mixed paragraph sizes and additional flowing pages exported through the real UI; later original page preserved')
        back(page)

        page.get_by_role('button', name='Projekte', exact=True).click()
        page.get_by_label('Projektname', exact=True).fill('Browser-Testprojekt')
        page.get_by_role('button', name='Projekt speichern', exact=True).click()
        expect(page.get_by_text('Arbeitsstand gespeichert.', exact=True)).to_be_visible()
        with page.expect_download() as download:
            page.get_by_role('button', name='Projektdatei herunterladen', exact=True).click()
        project_file = Path(temporary) / 'projekt.moinpdf'
        download.value.save_as(project_file)
        assert project_file.read_bytes().startswith(b'MOINPDF-PROJECT\n')
        page.reload(wait_until='networkidle')
        page.get_by_role('button', name='Projekte', exact=True).click()
        page.get_by_role('button', name='Öffnen', exact=True).first.click()
        chooser(page)
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·2 Seiten')
        completed.append('IndexedDB project survives reload and restores the complete PDF session')

        transfer = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        transfer.set_default_timeout(30000)
        transfer.on('pageerror', lambda error: errors.append('Project transfer: ' + str(error)))
        transfer.goto(origin)
        transfer.get_by_role('button', name='Projekte', exact=True).click()
        expect(transfer.get_by_text('Noch keine gespeicherten Projekte.', exact=True)).to_be_visible()
        transfer.get_by_label('MoinPDF-Projektdatei', exact=True).set_input_files(str(project_file))
        chooser(transfer)
        expect(transfer.locator('.chooser-document-count')).to_have_text('1 Datei·2 Seiten')
        transfer.get_by_role('button', name='Seiten organisieren', exact=True).click()
        transfer.get_by_role('button', name='Seiten speichern', exact=True).click()
        expect(transfer.get_by_role('heading', name='Erledigt.', exact=True)).to_be_visible()
        with transfer.expect_download() as download:
            transfer.locator('a[download]').first.click()
        transferred_pdf = Path(temporary) / 'projekt-wiederhergestellt.pdf'
        download.value.save_as(transferred_pdf)
        with pymupdf.open(transferred_pdf) as document:
            assert len(document) == 2
            assert 'Moin aus dem Norden' in document[0].get_text()
            assert 'Zweite Seite' in document[1].get_text()
        back(transfer)
        corrupt_file = Path(temporary) / 'beschaedigt.moinpdf'
        corrupt = bytearray(project_file.read_bytes())
        corrupt[-1] ^= 1
        corrupt_file.write_bytes(corrupt)
        transfer.get_by_role('button', name='Projekte', exact=True).click()
        transfer.get_by_label('MoinPDF-Projektdatei', exact=True).set_input_files(str(corrupt_file))
        expect(transfer.get_by_text('Die Projektdatei ist beschädigt oder unvollständig.', exact=True)).to_be_visible()
        transfer.keyboard.press('Escape')
        expect(transfer.locator('.chooser-document-count')).to_have_text('1 Datei·2 Seiten')
        completed.append('Portable project downloads, imports into a fresh browser context, independently exports identical PDF content; damaged import keeps current session')

        transfer.get_by_role('button', name='OCR & Text', exact=True).click()
        transfer.get_by_role('button', name='Sprachen kombinieren', exact=True).click()
        for language in ('Englisch', 'Französisch', 'Spanisch', 'Italienisch', 'Portugiesisch', 'Niederländisch', 'Polnisch'):
            transfer.get_by_role('checkbox', name=language, exact=True).check()
        expect(transfer.get_by_role('checkbox', name='Tschechisch', exact=True)).to_be_disabled()
        transfer.get_by_role('switch').last.check()
        transfer.get_by_role('button', name='Text erkennen', exact=True).click()
        expect(transfer.get_by_role('heading', name='Erledigt.', exact=True)).to_be_visible(timeout=180000)
        with transfer.expect_download() as download:
            transfer.locator('a[download]').first.click()
        ocr_pdf = Path(temporary) / 'acht-sprachen.pdf'
        download.value.save_as(ocr_pdf)
        with pymupdf.open(ocr_pdf) as document:
            assert len(document) == 2
            assert 'Moin' in document[0].get_text()
            assert 'Zweite' in document[1].get_text()
        completed.append('Eight OCR languages selected in the real UI and used by production workers; searchable PDF independently read back')
        back(transfer)

        scan_path=Path(temporary)/'automatische-sprache.pdf'
        with pymupdf.open() as original:
            sample=original.new_page(width=1500,height=250)
            for row, text in enumerate(('Die Lieferung erfolgt am Freitag.', 'Bitte prüfen Sie die beigefügte Rechnung und bestätigen Sie den vereinbarten Termin.', 'Alle Angaben bleiben im lokalen Dokument und werden nicht verschickt.')):
                sample.insert_text((30,55+row*60),text,fontsize=22)
            scan=sample.get_pixmap(matrix=pymupdf.Matrix(1.5,1.5)).tobytes('png')
            with pymupdf.open() as image_pdf:
                image_pdf.new_page(width=1500,height=250).insert_image(pymupdf.Rect(0,0,1500,250),stream=scan)
                image_pdf.save(scan_path)
        automatic=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
        automatic.on('pageerror',lambda error:errors.append('Automatic OCR: '+str(error)))
        automatic.goto(origin)
        automatic.locator('input[type="file"]').first.set_input_files(str(scan_path))
        automatic.get_by_role('button',name='OCR & Text',exact=True).click()
        automatic.get_by_role('switch',name='Sprachen automatisch ermitteln',exact=True).check()
        automatic.get_by_role('button',name='Text erkennen',exact=True).click()
        expect(automatic.get_by_role('heading',name='Erledigt.',exact=True)).to_be_visible(timeout=240000)
        with automatic.expect_download() as download:
            automatic.locator('a[download]').first.click()
        detected_pdf=Path(temporary)/'sprache-erkannt.pdf'
        download.value.save_as(detected_pdf)
        with pymupdf.open(detected_pdf) as document:
            assert len(document)==1
            assert 'Rechnung' in document[0].get_text() and 'Lieferung' in document[0].get_text()
        automatic.close()
        completed.append('Automatic OCR language selection on an image-only German scan through the real UI, with searchable PDF readback')

        changed_pdf = Path(temporary) / 'neue-fassung.pdf'
        with pymupdf.open() as document:
            for text in ('Neu hinzugefügtes Deckblatt.', 'Moin aus dem Norden. Rechnung vom 07.10.2026.', 'Zweite Seite. Betrag 30,50 Euro.'):
                document.new_page().insert_text((50, 60), text)
            document.save(changed_pdf)
        transfer.locator('input[type="file"]').first.set_input_files(str(changed_pdf))
        chooser(transfer)
        transfer.get_by_role('button', name='PDFs vergleichen', exact=True).click()
        transfer.get_by_role('combobox', name='Vergleichsart', exact=True).click()
        transfer.get_by_role('option', name='Inhalte über Seiten hinweg', exact=True).click()
        transfer.get_by_role('button', name='Text vergleichen', exact=True).click()
        expect(transfer.get_by_role('heading', name='PDF-Inhaltsvergleich', exact=True)).to_be_visible()
        with transfer.expect_download() as download:
            transfer.locator('a[download]').first.click()
        comparison = Path(temporary) / 'vergleich.txt'
        download.value.save_as(comparison)
        comparison_text = comparison.read_text(encoding='utf-8-sig')
        assert 'A: Seite 1 · B: Seite 2' in comparison_text
        assert '30,50' in comparison_text and '25,50' in comparison_text
        transfer.screenshot(path=str(evidence / 'content-comparison.png'), full_page=True)
        completed.append('Content comparison in production UI matches an inserted cover, reports changed amounts and exports complete TXT')
        transfer.close()

        page.get_by_role('button', name='PDF zu E-Book', exact=True).click()
        page.get_by_role('button', name='EPUB erstellen', exact=True).click()
        expect(page.locator('.advanced-result')).to_be_visible()
        with page.expect_download() as download:
            page.locator('.advanced-result a[download]').click()
        saved = Path(temporary) / 'buch.epub'
        download.value.save_as(saved)
        with zipfile.ZipFile(saved) as archive:
            assert archive.read('mimetype') == b'application/epub+zip'
            assert b'urn:uuid:' in archive.read('EPUB/package.opf')
        completed.append('EPUB export on the same browser origin, including local HTTP')
        back(page)

        if require_server:
            page.get_by_role('button', name='Barrierefreiheit prüfen', exact=True).click()
            page.get_by_label('Barrierefreiheit: Aktion', exact=True).select_option('create')
            page.get_by_label('Dokumenttitel', exact=True).fill('Geprüfter Bericht')
            page.get_by_label('Text für Block 1', exact=True).fill('Bericht aus MoinPDF')
            page.get_by_role('button', name='Absatz hinzufügen', exact=True).click()
            page.get_by_label('Text für Block 2', exact=True).fill('Zweiter Absatz mit geprüftem Unicode: ÄÖÜ.')
            page.get_by_role('button', name='Absatz hinzufügen', exact=True).click()
            page.get_by_label('Text für Block 3', exact=True).fill('Dieser Absatz wird nach oben verschoben.')
            page.get_by_role('button', name='Block 3 nach oben', exact=True).click()
            page.get_by_role('button', name='PDF/UA erstellen und prüfen', exact=True).click()
            expect(page.locator('.advanced-result')).to_be_visible(timeout=180000)
            with page.expect_download() as download:
                page.locator('.advanced-result a[download]').first.click()
            saved = Path(temporary) / 'pdfua.zip'
            download.value.save_as(saved)
            with zipfile.ZipFile(saved) as bundle:
                assert json.loads(bundle.read('Ergebnis.json'))['technicalPassed'] is True
                accessible_pdf = bundle.read('PDF-UA-1-technisch-geprueft.pdf')
                with pymupdf.open(stream=accessible_pdf, filetype='pdf') as document:
                    content = ''.join(p.get_text() for p in document)
                    assert content.index('nach oben verschoben') < content.index('Zweiter Absatz')
                    assert document.metadata['title'] == 'Geprüfter Bericht'
                    assert document.xref_get_key(document.pdf_catalog(), 'StructTreeRoot')[0] != 'null'
            # A previous validation/download must never describe edited content.
            page.get_by_label('Dokumenttitel', exact=True).fill('Überarbeiteter Bericht')
            expect(page.locator('.advanced-result')).to_have_count(0)
            page.get_by_label('Text für Block 2', exact=True).fill('Aktualisierter Inhalt für den erneuten Export.')
            page.get_by_role('button', name='PDF/UA erstellen und prüfen', exact=True).click()
            expect(page.locator('.advanced-result')).to_be_visible(timeout=180000)
            with page.expect_download() as download:
                page.locator('.advanced-result a[download]').first.click()
            saved = Path(temporary) / 'pdfua-updated.zip'
            download.value.save_as(saved)
            with zipfile.ZipFile(saved) as bundle:
                assert json.loads(bundle.read('Ergebnis.json'))['technicalPassed'] is True
                with pymupdf.open(stream=bundle.read('PDF-UA-1-technisch-geprueft.pdf'), filetype='pdf') as document:
                    content = ''.join(p.get_text() for p in document)
                    assert 'Aktualisierter Inhalt' in content
                    assert 'nach oben verschoben' not in content
                    assert document.metadata['title'] == 'Überarbeiteter Bericht'
            # A block-only edit must invalidate the result just like a title edit.
            page.get_by_label('Text für Block 2', exact=True).fill('Nochmals geänderter Inhalt.')
            expect(page.locator('.advanced-result')).to_have_count(0)
            page.get_by_label('Barrierefreiheit: Aktion', exact=True).select_option('validate')
            page.get_by_role('button', name='PDF/UA prüfen', exact=True).click()
            expect(page.locator('.advanced-result')).to_be_visible(timeout=180000)
            page.get_by_label('PDF/UA-Prüfprofil', exact=True).select_option('ua2')
            expect(page.locator('.advanced-result')).to_have_count(0)
            page.get_by_role('button', name='PDF/UA prüfen', exact=True).click()
            expect(page.locator('.advanced-result')).to_be_visible(timeout=180000)
            page.get_by_label('Barrierefreiheit: Aktion', exact=True).select_option('basic')
            expect(page.locator('.advanced-result')).to_have_count(0)
            completed.append('Structured reading order, real PDF/UA gate and independent readback; edits, profile changes and mode changes invalidate old downloads')
            back(page)
            page.get_by_role('button', name='PDF als Hörbuch', exact=True).click()
            page.get_by_role('button', name='Vorlesetext vorbereiten', exact=True).click()
            page.get_by_label('Lesereihenfolge und Vorlesetext der ausgewählten Abschnitte geprüft', exact=True).check()
            page.get_by_role('button', name='Hörbuch erstellen', exact=True).click()
            expect(page.locator('audio')).to_be_visible(timeout=180000)
            with page.expect_download() as download:
                page.locator('.century-audio-output a[download]').click()
            saved = Path(temporary) / 'hoerbuch.wav'
            download.value.save_as(saved)
            with wave.open(str(saved), 'rb') as audio:
                assert audio.getnframes() > audio.getframerate()
                assert audio.getnchannels() == 1
            completed.append('Reviewed text to local Piper audiobook through the real UI and proxy')
            back(page)

        page.set_viewport_size({'width': 390, 'height': 844})
        no_overflow(page, 'mobile chooser')
        page.screenshot(path=str(evidence / 'mobile-tools.png'), full_page=True)
        all_views(page, errors, 'Mobile with PDF')
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·2 Seiten')
        page.get_by_role('button', name='Projekte', exact=True).click()
        expect(page.get_by_role('button', name='Projektdatei herunterladen', exact=True)).to_be_visible()
        no_overflow(page, 'mobile project transfer')
        page.screenshot(path=str(evidence / 'mobile-projects.png'), full_page=True)
        page.keyboard.press('Escape')
        page.get_by_role('button', name='OCR & Text', exact=True).click()
        page.get_by_role('button', name='Sprachen kombinieren', exact=True).click()
        no_overflow(page, 'mobile OCR languages')
        back(page)
        page.get_by_role('button', name='PDF-Objekte bearbeiten', exact=True).click()
        page.get_by_label('Bearbeitung', exact=True).select_option('paragraph')
        page.get_by_role('button', name='Textobjekte laden', exact=True).click()
        expect(page.locator('.paragraph-object-list')).to_be_visible()
        no_overflow(page, 'mobile paragraph editor')
        page.screenshot(path=str(evidence / 'mobile-paragraph.png'), full_page=True)
        back(page)
        page.get_by_role('button', name='Barrierefreiheit prüfen', exact=True).click()
        page.get_by_label('Barrierefreiheit: Aktion', exact=True).select_option('create')
        page.get_by_role('button', name='Absatz hinzufügen', exact=True).click()
        no_overflow(page, 'mobile accessibility structure editor')
        page.screenshot(path=str(evidence / 'mobile-accessible-editor.png'), full_page=True)
        back(page)
        # A raw XFA packet must remain blocked before any AcroForm API can strip it.
        xfa_path = Path(temporary) / 'xfa-preservation.pdf'
        xfa_xml = b'<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data><value>XFA-SENTINEL</value></xfa:data></xfa:datasets>'
        with pymupdf.open() as document:
            document.new_page().insert_text((50, 60), 'XFA compatibility placeholder')
            stream = document.get_new_xref()
            document.update_object(stream, '<< >>')
            document.update_stream(stream, xfa_xml)
            form = document.get_new_xref()
            document.update_object(form, f'<< /Fields [] /XFA {stream} 0 R >>')
            document.xref_set_key(document.pdf_catalog(), 'AcroForm', f'{form} 0 R')
            document.save(xfa_path)
        xfa_page = browser.new_page(viewport={'width': 390, 'height': 844}, accept_downloads=True)
        xfa_page.on('pageerror', lambda error: errors.append(str(error)))
        xfa_page.goto(origin)
        xfa_page.locator('input[type="file"]').first.set_input_files(str(xfa_path))
        chooser(xfa_page)
        xfa_page.get_by_role('button', name='Formular ausfüllen', exact=True).click()
        expect(xfa_page.get_by_text('Dieses Dokument verwendet XFA.', exact=False)).to_be_visible()
        expect(xfa_page.get_by_role('button', name='Formular speichern', exact=True)).to_be_disabled()
        no_overflow(xfa_page, 'XFA rejection on mobile')
        xfa_page.screenshot(path=str(evidence / 'xfa-preservation.png'), full_page=True)
        back(xfa_page)
        xfa_page.get_by_role('button', name='Lesezeichen bearbeiten', exact=True).click()
        expect(xfa_page.get_by_role('button', name='Lesezeichen speichern', exact=True)).to_be_enabled()
        xfa_page.get_by_role('button', name='Lesezeichen speichern', exact=True).click()
        with xfa_page.expect_download() as download:
            xfa_page.get_by_role('link', name='PDF herunterladen', exact=True).click()
        xfa_saved = Path(temporary) / 'xfa-bookmarks.pdf'
        download.value.save_as(xfa_saved)
        with pymupdf.open(xfa_saved) as document:
            kind, reference = document.xref_get_key(document.pdf_catalog(), 'AcroForm/XFA')
            assert kind == 'xref', (kind, reference)
            assert document.xref_stream(int(reference.split()[0])) == xfa_xml
        xfa_page.close()
        completed.append('XFA editor blocked before mutation; bookmark download preserves the original XFA stream (independent PyMuPDF readback)')
        assert not errors, errors
        print('PASS: ' + '; '.join(completed), flush=True)
    finally:
        page.screenshot(path=str(evidence / 'last-state.png'), full_page=True)
        details = {'completed': completed, 'errors': errors, 'console': console,
                   'text': page.locator('body').inner_text(), 'url': page.url}
        (evidence / 'browser.json').write_text(json.dumps(details, ensure_ascii=False, indent=2))
        print(json.dumps(details, ensure_ascii=False), flush=True)
        browser.close()
