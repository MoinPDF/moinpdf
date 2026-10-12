"""Exercise the published static manual and its connection to the actual app."""
import json
import os
import io
import zipfile
from pathlib import Path
import tempfile
import time
import urllib.request
import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.environ.get('MOINPDF_DOCUMENTATION_URL', 'http://127.0.0.1:8765').rstrip('/')
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
    # The GitHub Ubuntu runner includes Chrome with H.264/AAC support for the MP4.
    browser = api.chromium.launch(channel='chrome')
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
        video = media.locator('video')
        expect(video).to_have_count(1)
        assert video.evaluate('(element) => element.canPlayType(\'video/mp4; codecs="avc1.64001f, mp4a.40.2"\')'), 'Test browser must support the supplied H.264/AAC video'
        # The public page intentionally uses preload=none. Opt in for this check.
        video.evaluate('(element) => { element.preload = "metadata"; element.load(); }')
        media.wait_for_function('document.querySelector("video").readyState >= 1 || document.querySelector("video").error')
        assert video.evaluate('(element) => element.error === null'), video.evaluate('(element) => element.error?.message')
        assert video.evaluate('(element) => Math.abs(element.duration - 15) < 0.2 && element.videoWidth === 1280 && element.videoHeight === 720')
        clip = media.request.get(origin + media.locator('.media-video a[download]').last.get_attribute('href'))
        assert clip.ok and clip.body()[4:8] == b'ftyp'
        for card in media.locator('.media-banner').all():
            image = card.locator('img')
            assert image.get_attribute('alt')
            result = media.request.get(origin + card.locator('a[download]').get_attribute('href'))
            assert result.ok and result.body().startswith(b'\xff\xd8\xff')
        package = media.request.get(origin + media.locator('.media-actions a[download]').get_attribute('href'))
        assert package.ok
        with zipfile.ZipFile(io.BytesIO(package.body())) as archive:
            assert archive.testzip() is None
            assert archive.read('MoinPDF-Medienpaket/Video/MoinPDF-Drucker-ueber-Bord.mp4') == clip.body()
            assert len([name for name in archive.namelist() if '/Banner/' in name and name.endswith('.jpg')]) == 6
            logo = media.request.get(origin + media.locator('#logo a[download]').get_attribute('href'))
            assert logo.ok and logo.body().startswith(b'\xff\xd8\xff')
            assert archive.read('MoinPDF-Medienpaket/MoinPDF-Logo.jpg') == logo.body()
            for card in media.locator('.media-banner').all():
                href = card.locator('a[download]').get_attribute('href')
                assert archive.read('MoinPDF-Medienpaket/Banner/' + href.split('/')[-1]) == media.request.get(origin + href).body()
        for width in (1920, 1440, 768, 390, 320):
            media.set_viewport_size({'width': width, 'height': 900})
            no_overflow(media)
            if width >= 768:
                hero = media.locator('.media-hero').bounding_box()
                content = media.locator('.media-hero > div').bounding_box()
                assert content['width'] >= min(800, hero['width']) - 1
            media.screenshot(path=str(evidence / f'media-{width}.png'), full_page=True)
            page.set_viewport_size({'width': width, 'height': 900})
            no_overflow(page)
        page.set_viewport_size({'width': 1440, 'height': 1000})
        media.close()
        completed.append('Media tab preserves PDF; six original JPEG downloads, matching ZIP and responsive footer')

        expect(manual.locator('.docs-tool')).to_have_count(112)
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
        assert total == 112
        categories.get_by_role('button', name='Prüfen', exact=True).click()
        search.fill('CSV')
        assert manual.locator('.docs-tool:visible').count() > 0
        completed.append('All 112 guides, accent-insensitive search, empty state, reset and five category filters')

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
        expect(manual.locator('.docs-tool[open]:visible')).to_have_count(112)
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
            for width in (1440, 390, 320):
                manual.set_viewport_size({'width': width, 'height': 1000 if width == 1440 else 844})
                no_overflow(manual)
                card = manual.locator('.legal-card')
                expect(card).to_be_visible()
                assert card.evaluate('(element) => getComputedStyle(element).color') == 'rgb(33, 62, 54)'
                expect(manual.locator('a[href="mailto:post@moinpdf.de"]').first).to_be_visible()
                if path == '/datenschutz.html':
                    address = manual.locator('address')
                    contact = manual.locator('address + p')
                    assert contact.bounding_box()['y'] - address.bounding_box()['y'] - address.bounding_box()['height'] >= 24
                manual.screenshot(path=str(evidence / f'{Path(path).stem}-{width}.png'), full_page=True)
        completed.append('Legal pages at 1440, 390 and 320 px: no overflow, green text, contacts and address spacing')
        page.get_by_role('button', name='Dunklen Modus einschalten', exact=True).click()
        for path, target in (('/dokumentation.html', 'body'), ('/medienbereich.html', 'body'), ('/impressum.html', '.legal-card'), ('/datenschutz.html', '.legal-card')):
            manual.goto(origin + path)
            expect(manual.locator('html')).to_have_class(__import__('re').compile(r'\bdark\b'))
            assert manual.locator(target).evaluate('(element) => getComputedStyle(element).color') == 'rgb(220, 232, 230)'
            assert manual.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--muted").trim()') == '#acbfba'
            no_overflow(manual)
            manual.screenshot(path=str(evidence / f'{Path(path).stem}-dark.png'))
            manual.emulate_media(media='print')
            assert manual.locator(target).evaluate('(element) => getComputedStyle(element).color') == 'rgb(33, 62, 54)'
            assert manual.locator('body').evaluate('(element) => getComputedStyle(element).backgroundColor') == 'rgb(255, 255, 255)'
            manual.emulate_media(media='screen')
        page.get_by_role('button', name='Hellen Modus einschalten', exact=True).click()
        expect(manual.locator('html')).not_to_have_class(__import__('re').compile(r'\bdark\b'))
        completed.append('Dark documentation/media/legal pages, cross-tab theme changes, readable print appearance')
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
