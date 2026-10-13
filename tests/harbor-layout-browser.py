"""Verify the Harbor layout and document retention in the production build."""
import json
import os
import tempfile
from pathlib import Path
import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.getenv('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path('documentation-evidence')
out.mkdir(exist_ok=True)
checks, errors = [], []

def within_viewport(page, name):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), name
    assert page.locator('.app-toolbar').bounding_box()['height'] <= 90, name

with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    context = browser.new_context(viewport={'width':1440, 'height':1000}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(origin)
        expect(page.locator('.harbor-home')).to_be_visible()
        page.evaluate('document.fonts.ready')
        expect(page.locator('.harbor-photo img')).to_have_js_property('complete', True)
        assert page.locator('.harbor-photo img').evaluate('(img) => img.naturalWidth > 1000')
        for theme in ('light', 'dark'):
            if theme == 'dark':
                page.locator('.theme-toggle').click()
                expect(page.locator('html')).to_have_class('dark')
            for width in (320, 390, 600, 768, 1000, 1024, 1440, 1920):
                page.set_viewport_size({'width':width, 'height':1000 if width > 1000 else 844})
                within_viewport(page, f'home {theme} {width}')
                image = page.locator('.harbor-photo').bounding_box()
                upload = page.locator('.harbor-upload').bounding_box()
                search = page.locator('.harbor-search').bounding_box()
                assert image['y'] + image['height'] <= upload['y'], (theme, width, 'photo order')
                assert upload['y'] + upload['height'] < search['y'], (theme, width, 'upload order')
                assert page.locator('.harbor-upload-cta').bounding_box()['height'] >= 44
                assert page.get_by_text('Papierkram. Läuft.', exact=True).count() == 1
                assert page.locator('.harbor-tool-card').count() == 4
                nav = page.locator('.harbor-desktop-nav' if width > 1000 else '.harbor-mobile-nav')
                expect(nav).to_be_visible()
                if width in (390, 768, 1440):
                    page.screenshot(path=str(out/f'harbor-home-{width}-{theme}.png'), full_page=True)
                checks.append(f'{width}px {theme}: image, upload, search, cards, navigation, no overflow')
        page.set_viewport_size({'width':390, 'height':844})
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio', name='English', exact=True).click()
        expect(page.get_by_text('Paperwork. Sorted.', exact=True)).to_be_visible()
        expect(page.get_by_role('heading', name='Quick access', exact=True)).to_be_visible()
        page.locator('.harbor-search input').fill('merge')
        expect(page.locator('.harbor-search-result').first).to_contain_text('Merge')
        page.locator('.harbor-search-clear').click()
        page.locator('.harbor-mobile-nav').get_by_role('button', name='More', exact=True).click()
        expect(page.get_by_role('menuitem', name='Documentation (new tab)', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio', name='Deutsch', exact=True).click()
        pdf = Path(temporary)/'harbor-retention.pdf'
        with pymupdf.open() as document:
            for text in ('Unchanged document one', 'Unchanged document two'):
                document.new_page().insert_text((50, 60), text)
            document.save(pdf)
        page.locator('input[type=file]').first.set_input_files(str(pdf))
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·2 Seiten')
        page.locator('.harbor-mobile-nav').get_by_role('button', name='Start', exact=True).click()
        expect(page.locator('.harbor-home')).to_be_visible()
        expect(page.locator('.harbor-resume')).to_contain_text('1 Datei')
        page.locator('.harbor-resume').click()
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·2 Seiten')
        expect(page.locator('.chooser-file')).to_contain_text('harbor-retention.pdf')
        within_viewport(page, 'retained workspace')
        page.get_by_role('button', name='Projekte', exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        page.keyboard.press('Escape')
        checks.append('Home/workspace navigation, mobile projects and DE/EN keep the original two-page PDF')
        for theme in ('dark', 'light'):
            page.evaluate('(theme) => { localStorage.setItem("moinpdf-theme", theme); }', theme)
            for route in ('dokumentation.html', 'medienbereich.html', 'impressum.html', 'datenschutz.html'):
                info = context.new_page()
                info.goto(origin+'/'+route)
                expect(info.locator('main')).to_be_visible()
                for width in (320, 768, 1440):
                    info.set_viewport_size({'width':width,'height':900})
                    assert info.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (route, theme, width)
                    if width == 320:
                        info.screenshot(path=str(out/f'harbor-{route}-{theme}.png'))
                assert info.evaluate('getComputedStyle(document.body).backgroundColor') == ('rgb(28, 35, 38)' if theme == 'dark' else 'rgb(245, 250, 248)')
                info.close()
                checks.append(f'{route}: {theme}, 320/768/1440px, shared palette')
        assert not errors, errors
    finally:
        (out/'harbor-verification.json').write_text(json.dumps({'checks':checks,'errors':errors}, indent=2))
        page.screenshot(path=str(out/'harbor-final-state.png'), full_page=True)
        browser.close()
print('PASS:', len(checks), 'Harbor layout checks and retained document state')
