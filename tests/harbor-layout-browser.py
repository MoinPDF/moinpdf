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

def framed(locator):
    assert locator.count() > 0
    for el in locator.all():
        style = el.evaluate('''(el) => {
            const style = getComputedStyle(el);
            return [style.borderTopWidth, style.borderTopStyle, style.borderTopColor];
        }''')
        assert style[0] == '1px' and style[1] == 'solid' and style[2] not in ('transparent', 'rgba(0, 0, 0, 0)'), style

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
        pdf = Path(temporary)/'harbor-retention.pdf'
        with pymupdf.open() as document:
            for text in ('Unchanged document one', 'Unchanged document two'):
                document.new_page().insert_text((50, 60), text)
            document.save(pdf)
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
                assert page.locator('.harbor-tool-card').first.evaluate('(el) => getComputedStyle(el).borderRadius') == '0px'
                nav = page.locator('.harbor-desktop-nav' if width > 1000 else '.harbor-mobile-nav')
                expect(nav).to_be_visible()
                if width in (390, 768, 1440):
                    page.screenshot(path=str(out/f'harbor-home-{width}-{theme}.png'), full_page=True)
                checks.append(f'{width}px {theme}: image, upload, search, cards, navigation, no overflow')
                if width in (390, 1440):
                    page.locator('.harbor-categories').get_by_role('button', name='Umwandeln', exact=True).click()
                    framed(page.locator('.harbor-tool-card'))
                    framed(page.locator('.harbor-tool-card > .harbor-tool-icon'))
                    page.locator('.harbor-discovery').screenshot(path=str(out/f'harbor-convert-{width}-{theme}.png'))
                    page.locator('.harbor-categories').get_by_role('button', name='Empfohlen', exact=True).click()
                    page.locator('.harbor-tool-card').nth(1).click()
                    expect(page.locator('.tool-file-entry')).to_be_visible()
                    expect(page.locator('.conversion-steps li')).to_have_count(3)
                    framed(page.locator('.tool-file-card'))
                    expect(page.get_by_role('button', name='Dateien auswählen', exact=True)).to_be_enabled()
                    expect(page.locator('.conversion-submit')).to_be_disabled()
                    within_viewport(page, f'empty tool {width} {theme}')
                    page.screenshot(path=str(out/f'harbor-tool-entry-{width}-{theme}.png'), full_page=True)
                    nav.get_by_role('button', name='Start', exact=True).click()
                    checks.append(f'{width}px {theme}: framed conversion tiles/icons and compact tool entry')
        # Every home tile must actually leave the start page before a PDF exists.
        # This covers the formerly blocked core tools as well as specialized tools.
        icons = {}
        for width in (390, 1440):
            page.set_viewport_size({'width':width, 'height':900})
            nav = page.locator('.harbor-mobile-nav' if width == 390 else '.harbor-desktop-nav')
            categories = page.locator('.harbor-categories button').all_text_contents()
            for category in categories:
                page.locator('.harbor-categories').get_by_role('button', name=category, exact=True).click()
                titles = page.locator('.harbor-tool-card strong').all_text_contents()
                for title in titles:
                    page.locator('.harbor-categories').get_by_role('button', name=category, exact=True).click()
                    card = page.locator('.harbor-tool-card').filter(has=page.get_by_text(title, exact=True))
                    icons[title] = card.locator('svg').inner_html()
                    card.click()
                    expect(page.locator('.harbor-home')).to_have_count(0)
                    expect(page.locator('main h1')).to_have_text(title)
                    expect(page.locator('.empty-stage')).to_have_count(0)
                    nav.get_by_role('button', name='Start', exact=True).click()
                    expect(page.locator('.harbor-home')).to_be_visible()
                checks.append(f'{width}px: all {len(titles)} {category} tiles open their named tool without a PDF')
            page.locator('.harbor-text-button').click()
            expect(page.locator('.chooser-tool')).to_have_count(112)
            framed(page.locator('.chooser-tool.tone-1'))
            framed(page.locator('.chooser-tool.tone-1 > span'))
            for title, icon in icons.items():
                card = page.locator('.chooser-tool').filter(has=page.get_by_text(title, exact=True))
                assert card.locator('svg').inner_html() == icon, title
            # The shared entry path must also work from the full catalogue.
            title = next(iter(icons))
            page.locator('.chooser-tool').filter(has=page.get_by_text(title, exact=True)).click()
            expect(page.locator('main h1')).to_have_text(title)
            page.get_by_role('button', name='Alle Werkzeuge', exact=True).click()
            expect(page.locator('.chooser-tool')).to_have_count(112)
            nav.get_by_role('button', name='Start', exact=True).click()
        checks.append('Home and catalogue use identical SVG symbols; empty-tool back navigation works')
        # Importing after choosing a core tool must keep that tool selected.
        for index, method in ((0, 'drop'), (1, 'picker'), (3, 'picker'), (0, 'demo'), (3, 'blank')):
            imported = browser.new_context(viewport={'width':390, 'height':844}, reduced_motion='reduce')
            test = imported.new_page()
            test.on('pageerror', lambda error: errors.append(str(error)))
            test.goto(origin)
            card = test.locator('.harbor-tool-card').nth(index)
            title = card.locator('strong').inner_text()
            card.click()
            expect(test.locator('main h1')).to_have_text(title)
            if method == 'drop':
                test.evaluate('''({bytes, name}) => {
                    const transfer = new DataTransfer();
                    transfer.items.add(new File([new Uint8Array(bytes)], name, {type:'application/pdf'}));
                    window.dispatchEvent(new DragEvent('drop', {dataTransfer:transfer, bubbles:true, cancelable:true}));
                }''', {'bytes':list(pdf.read_bytes()), 'name':pdf.name})
            elif method == 'picker':
                with test.expect_file_chooser() as chooser:
                    test.get_by_role('button', name='Dateien auswählen', exact=True).click()
                chooser.value.set_files(str(pdf))
            elif method == 'demo':
                test.get_by_role('button', name='Mit Beispieldokument ausprobieren', exact=True).click()
            else:
                test.get_by_role('button', name='Leerseite', exact=True).click()
            expect(test.locator('.file-tab')).to_have_count(1)
            if method in ('drop', 'picker'):
                expect(test.locator('.file-tab').first).to_contain_text(pdf.name)
            expect(test.locator('main h1')).to_have_text(title)
            if index == 3:
                expect(test.get_by_role('tab', name='Dokument', exact=True)).to_have_attribute('aria-selected', 'true')
            test.screenshot(path=str(out/f'harbor-selected-import-{index}-{method}.png'), full_page=True)
            imported.close()
            checks.append(f'{title}: {method} import keeps the chosen tool and document')
        page.set_viewport_size({'width':390, 'height':844})
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio', name='English', exact=True).click()
        expect(page.get_by_text('Paperwork. Sorted.', exact=True)).to_be_visible()
        expect(page.get_by_role('heading', name='Quick access', exact=True)).to_be_visible()
        page.locator('.harbor-search input').fill('merge')
        expect(page.locator('.harbor-search-result').first).to_contain_text('Merge')
        title = page.locator('.harbor-search-result strong').first.inner_text()
        page.locator('.harbor-search-result').first.press('Enter')
        expect(page.locator('main h1')).to_have_text(title)
        page.locator('.harbor-mobile-nav').get_by_role('button', name='Home', exact=True).click()
        expect(page.locator('.harbor-home')).to_be_visible()
        checks.append('English search opens the selected empty tool with the keyboard')
        page.locator('.harbor-mobile-nav').get_by_role('button', name='More', exact=True).click()
        expect(page.get_by_role('menuitem', name='Documentation (new tab)', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio', name='Deutsch', exact=True).click()
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
