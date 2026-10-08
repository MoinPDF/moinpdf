"""Exercise the published static manual and its connection to the actual app."""
import json
import io
import zipfile
from pathlib import Path
import tempfile
import time
import urllib.request
import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = 'http://127.0.0.1:8765'
evidence = Path('documentation-evidence')
evidence.mkdir(exist_ok=True)
completed, errors = [], []
for attempt in range(50):
    try:
        urllib.request.urlopen(origin, timeout=1).close()
        break
    except OSError:
        time.sleep(.1)
else:
    raise RuntimeError('Static application did not start')

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')

with sync_playwright() as api, tempfile.TemporaryDirectory() as temp:
    browser = api.chromium.launch()
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    manual = None
    try:
        page.goto(origin)
        footer = page.locator('.moinpdf-legal-footer')
        assert [text.strip().split(' (')[0] for text in footer.locator('nav a').all_text_contents()] == ['Dokumentation', 'Medienbereich', 'Impressum', 'Datenschutzerklärung']
        pdf = Path(temp) / 'dokumentation-test.pdf'
        with pymupdf.open() as document:
            document.new_page().insert_text((50, 60), 'Arbeitsdokument bleibt erhalten.')
            document.save(pdf)
        page.locator('input[type=file]').first.set_input_files(str(pdf))
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·1 Seite')
        with context.expect_page() as popup:
            footer.get_by_role('link', name='Dokumentation (neuer Tab)', exact=True).click()
        manual = popup.value
        manual.on('pageerror', lambda error: errors.append(str(error)))
        manual.wait_for_load_state()
        expect(manual).to_have_title('Dokumentation · MoinPDF')
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·1 Seite')
        completed.append('Footer order, new documentation tab and original PDF retained')
        with context.expect_page() as popup:
            footer.get_by_role('link', name='Medienbereich (neuer Tab)', exact=True).click()
        media = popup.value
        media.wait_for_load_state()
        expect(media).to_have_title('Medienbereich · MoinPDF')
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·1 Seite')
        expect(media.locator('.media-banner')).to_have_count(6)
        for card in media.locator('.media-banner').all():
            image = card.locator('img')
            assert image.get_attribute('alt')
            result = media.request.get(origin + card.locator('a[download]').get_attribute('href'))
            assert result.ok and result.body().startswith(b'\xff\xd8\xff')
        package = media.request.get(origin + media.locator('.media-actions a[download]').get_attribute('href'))
        assert package.ok
        with zipfile.ZipFile(io.BytesIO(package.body())) as archive:
            assert archive.testzip() is None
            assert len([name for name in archive.namelist() if '/Banner/' in name and name.endswith('.jpg')]) == 6
            logo = media.request.get(origin + media.locator('#logo a[download]').get_attribute('href'))
            assert logo.ok and logo.body().startswith(b'\xff\xd8\xff')
            assert archive.read('MoinPDF-Medienpaket/MoinPDF-Logo.jpg') == logo.body()
            for card in media.locator('.media-banner').all():
                href = card.locator('a[download]').get_attribute('href')
                assert archive.read('MoinPDF-Medienpaket/Banner/' + href.split('/')[-1]) == media.request.get(origin + href).body()
        for width in (1440, 390, 320):
            media.set_viewport_size({'width': width, 'height': 900})
            no_overflow(media)
            media.screenshot(path=str(evidence / f'media-{width}.png'), full_page=True)
            page.set_viewport_size({'width': width, 'height': 900})
            no_overflow(page)
        page.set_viewport_size({'width': 1440, 'height': 1000})
        media.close()
        completed.append('Media tab preserves PDF; six original JPEG downloads, matching ZIP and responsive footer')

        expect(manual.locator('.docs-tool')).to_have_count(100)
        expect(manual.locator('.docs-toc > a')).to_have_count(7)
        manual.evaluate('document.fonts.ready')
        no_overflow(manual)
        manual.screenshot(path=str(evidence / 'desktop-introduction.png'))
        search = manual.get_by_role('searchbox')
        search.fill('Rechenprufung')
        expect(manual.locator('.docs-tool:visible')).to_have_count(1)
        expect(manual.locator('#werkzeug-arithmetic-check')).to_be_visible()
        search.fill('keine-erfundene-funktion-abcdef')
        expect(manual.locator('#docs-empty')).to_be_visible()
        manual.get_by_role('button', name='Zurücksetzen', exact=True).click()
        expect(search).to_be_focused()
        categories = manual.get_by_role('group', name='Werkzeugkategorien')
        total = 0
        for name in ('Prüfen', 'Umwandeln', 'Seiten', 'Bearbeiten', 'Stapel'):
            categories.get_by_role('button', name=name, exact=True).click()
            expect(manual.locator('.docs-tool-group:visible')).to_have_count(1)
            total += manual.locator('.docs-tool:visible').count()
        assert total == 100
        categories.get_by_role('button', name='Prüfen', exact=True).click()
        search.fill('CSV')
        assert manual.locator('.docs-tool:visible').count() > 0
        completed.append('All 100 guides, accent-insensitive search, empty state, reset and five category filters')

        manual.goto(origin + '/dokumentation.html#werkzeug-pdf-audio')
        audio = manual.locator('#werkzeug-pdf-audio')
        expect(audio).to_have_attribute('open', '')
        expect(audio.locator('.docs-tool-body')).to_be_visible()
        no_overflow(manual)
        manual.screenshot(path=str(evidence / 'desktop-tool.png'))
        for width in (390, 320):
            manual.set_viewport_size({'width': width, 'height': 844})
            no_overflow(manual)
            manual.screenshot(path=str(evidence / f'mobile-tool-{width}.png'))
            manual.goto(origin + '/dokumentation.html')
            no_overflow(manual)
            if width == 390:
                manual.screenshot(path=str(evidence / 'mobile-introduction.png'))
            # Opening every guide catches long names and content-specific overflow.
            manual.evaluate('document.querySelectorAll(".docs-tool").forEach(d => d.open = true)')
            no_overflow(manual)
            manual.goto(origin + '/dokumentation.html#werkzeug-pdf-audio')
        completed.append('Deep links and all expanded guides at desktop, 390 px and 320 px')

        manual.set_viewport_size({'width': 1440, 'height': 1000})
        search = manual.get_by_role('searchbox')
        search.fill('Rechenprüfung')
        manual.evaluate('window.dispatchEvent(new Event("beforeprint"))')
        expect(manual.locator('.docs-tool[open]:visible')).to_have_count(100)
        manual.pdf(path=str(evidence / 'handbuch-druckprobe.pdf'), print_background=True)
        manual.evaluate('window.dispatchEvent(new Event("afterprint"))')
        expect(search).to_have_value('Rechenprüfung')
        expect(manual.locator('.docs-tool:visible')).to_have_count(1)
        with pymupdf.open(evidence / 'handbuch-druckprobe.pdf') as document:
            text = ''.join(page.get_text() for page in document)
            assert 'PDF als Hörbuch' in text and 'PDFs überlagern' in text
        completed.append('Complete printable manual and restored search state')

        for path in ('/impressum.html', '/datenschutz.html'):
            manual.goto(origin + path)
            expect(manual.locator('main > nav a').first).to_have_text('Dokumentation')
            assert manual.request.get(origin + '/dokumentation.html').ok
        nojs = browser.new_context(java_script_enabled=False, viewport={'width':390,'height':844})
        plain = nojs.new_page()
        plain.goto(origin + '/dokumentation.html')
        plain.locator('#werkzeug-pdf-audio > summary').click()
        expect(plain.locator('#werkzeug-pdf-audio .docs-tool-body')).to_be_visible()
        expect(plain.locator('.docs-search-panel')).not_to_be_visible()
        no_overflow(plain)
        plain.goto(origin + '/medienbereich.html')
        expect(plain.locator('.media-banner')).to_have_count(6)
        expect(plain.locator('.media-actions a[download]')).to_be_visible()
        no_overflow(plain)
        nojs.close()
        assert not errors, errors
        completed.append('Cross-links and native guide controls with JavaScript disabled; no browser exceptions')
        print('PASS: ' + '; '.join(completed), flush=True)
    finally:
        if manual:
            manual.screenshot(path=str(evidence / 'last-state.png'))
        (evidence / 'result.json').write_text(json.dumps({'completed':completed, 'errors':errors}, ensure_ascii=False, indent=2))
        browser.close()
