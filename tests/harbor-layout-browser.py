"""Verify the Harbor layout and document retention in the production build."""
import json
import os
import re
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

def home_geometry(page, width):
    # CDP box queries and DOM style reads can describe different frames after
    # a viewport resize. Measure all related geometry in one browser task and
    # retain that exact sample for the assertions below.
    sample = page.wait_for_function('''width => {
        if (innerWidth !== width) return false;
        const welcome = document.querySelector('.harbor-welcome');
        const style = getComputedStyle(welcome);
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        const image = rect('.harbor-photo');
        const available = welcome.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const expected = width > 1000 ? Math.min(640, available) : available;
        if (Math.abs(image.width - expected) > 1) return false;
        return {image, available, upload: rect('.harbor-upload'), search: rect('.harbor-search'),
            documentWidth: document.documentElement.clientWidth};
    }''', arg=width)
    try:
        return sample.json_value()
    finally:
        sample.dispose()

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
        page.locator('.mosaic-all-tools').click()
        tool_titles = page.locator('.chooser-tool').evaluate_all('(cards) => Object.fromEntries(cards.map(card => [card.dataset.toolId, card.querySelector("strong").textContent]))')
        page.locator('.harbor-desktop-nav').get_by_role('button', name='Start', exact=True).click()
        pdf = Path(temporary)/'harbor-retention.pdf'
        with pymupdf.open() as document:
            for text in ('Unchanged document one', 'Unchanged document two'):
                document.new_page().insert_text((50, 60), text)
            document.save(pdf)
        for theme in ('light', 'dark'):
            if theme == 'dark':
                page.locator('.theme-toggle').click()
                expect(page.locator('html')).to_have_class('dark')
            for width in (320, 390, 600, 768, 1000, 1024, 1100, 1101, 1440, 1920):
                page.set_viewport_size({'width':width, 'height':1000 if width > 1000 else 844})
                geometry = home_geometry(page, width)
                within_viewport(page, f'home {theme} {width}')
                image, upload, search = (geometry[key] for key in ('image', 'upload', 'search'))
                assert image['y'] + image['height'] <= upload['y'], (theme, width, 'photo order')
                assert upload['y'] + upload['height'] < search['y'], (theme, width, 'upload order')
                assert page.locator('.harbor-upload-cta').bounding_box()['height'] >= 44
                assert page.get_by_text('Papierkram. Läuft.', exact=True).count() == 1
                assert page.locator('.tool-mosaic-card').count() == 6
                assert page.locator('.tool-mosaic-card').first.evaluate('(el) => parseFloat(getComputedStyle(el).borderRadius)') >= 16
                assert abs(image['width'] / image['height'] - 16 / 9) < 0.02
                if width > 1000:
                    assert image['width'] <= 640.5
                    assert abs(image['x'] + image['width']/2 - geometry['documentWidth']/2) <= 1
                else:
                    available = geometry['available']
                    assert abs(image['width'] - available) <= 1, (theme, width, image, available)
                assert page.locator('.harbor-photo img').evaluate('(img) => getComputedStyle(img).objectFit') == 'contain'
                nav = page.locator('.harbor-desktop-nav:visible, .harbor-mobile-nav:visible')
                expect(nav).to_have_count(1)
                expect(nav.get_by_role('button', name='Start', exact=True)).to_be_visible()
                expect(nav.get_by_role('button', name='Werkzeuge', exact=True)).to_be_visible()
                if width in (390, 768, 1440):
                    page.screenshot(path=str(out/f'harbor-home-{width}-{theme}.png'), full_page=True)
                checks.append(f'{width}px {theme}: image, upload, search, cards, navigation, no overflow')
                if width in (390, 1440):
                    page.locator('.harbor-categories').get_by_role('button', name='Umwandeln', exact=True).click()
                    framed(page.locator('.tool-mosaic-card'))
                    expect(page.locator('.tool-mosaic-art').first).to_be_visible()
                    page.locator('.harbor-discovery').screenshot(path=str(out/f'harbor-convert-{width}-{theme}.png'))
                    page.locator('.harbor-categories').get_by_role('button', name='Schnellzugriff', exact=True).click()
                    page.locator('.tool-mosaic-card[data-tool-id=organize]').click()
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
        home_tools = set()
        for width in (390, 1440):
            page.set_viewport_size({'width':width, 'height':900})
            nav = page.locator('.harbor-mobile-nav' if width == 390 else '.harbor-desktop-nav')
            categories = page.locator('.harbor-categories button').all_text_contents()
            for category in categories:
                page.locator('.harbor-categories').get_by_role('button', name=category, exact=True).click()
                tool_ids = page.locator('.tool-mosaic-card').evaluate_all('(cards) => cards.map(card => card.dataset.toolId)')
                for tool_id in tool_ids:
                    title = tool_titles[tool_id]
                    page.locator('.harbor-categories').get_by_role('button', name=category, exact=True).click()
                    card = page.locator(f'.tool-mosaic-card[data-tool-id="{tool_id}"]')
                    expect(card.locator('.tool-mosaic-art svg')).to_be_visible()
                    home_tools.add(tool_id)
                    card.click()
                    expect(page.locator('.harbor-home')).to_have_count(0)
                    expect(page.locator('main h1')).to_have_text(title)
                    expect(page.locator('.empty-stage')).to_have_count(0)
                    nav.get_by_role('button', name='Start', exact=True).click()
                    expect(page.locator('.harbor-home')).to_be_visible()
                checks.append(f'{width}px: all {len(tool_ids)} {category} tiles open their named tool without a PDF')
            page.locator('.mosaic-all-tools').click()
            expect(page.locator('.chooser-tool')).to_have_count(112)
            framed(page.locator('.chooser-tool.tone-1'))
            framed(page.locator('.chooser-tool.tone-1 > span'))
            for tool_id in home_tools:
                card = page.locator(f'.chooser-tool[data-tool-id="{tool_id}"]')
                expect(card.locator('strong')).to_have_text(tool_titles[tool_id])
                expect(card.locator('svg')).to_be_visible()
            # Every catalogue tool must also open without an existing document.
            # Invoice, security and document editors previously assumed sources[0].
            titles = page.locator('.chooser-tool strong').all_text_contents()
            for title in titles:
                page.locator('.chooser-tool').filter(has=page.get_by_text(title, exact=True)).click()
                expect(page.locator('main h1')).to_have_text(title)
                assert not errors, (title, errors)
                expect(page.locator('.empty-stage')).to_have_count(0)
                within_viewport(page, f'catalogue empty tool {width} / {title}')
                page.get_by_role('button', name='Zurück zur Auswahl', exact=True).click()
                expect(page.locator('.chooser-tool')).to_have_count(112)
            checks.append(f'{width}px: all 112 catalogue tools open without a document or JavaScript errors')
            nav.get_by_role('button', name='Start', exact=True).click()
        checks.append('Home and catalogue resolve the same tool identities with visible icons; empty-tool back navigation works')
        # Importing after choosing a core tool must keep that tool selected.
        for tool_id, method, language in (('merge', 'drop', 'de'), ('organize', 'picker', 'de'), ('sign', 'picker', 'de'), ('merge', 'demo', 'de'), ('merge', 'demo', 'en'), ('sign', 'blank', 'de')):
            imported = browser.new_context(viewport={'width':390, 'height':844}, reduced_motion='reduce')
            if method == 'demo':
                imported.add_init_script('''
                    window.sampleText = [];
                    const original = CanvasRenderingContext2D.prototype.fillText;
                    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
                        window.sampleText.push({text, fits: x + this.measureText(text).width < this.canvas.width - 50 && y < this.canvas.height - 50});
                        return original.call(this, text, x, y, ...rest);
                    };
                ''')
            test = imported.new_page()
            test.on('pageerror', lambda error: errors.append(str(error)))
            test.goto(origin + ('?lang=en' if language == 'en' else ''))
            if language == 'en':
                expect(test.get_by_text('Paperwork. Sorted.', exact=True)).to_be_visible()
            card = test.locator(f'.tool-mosaic-card[data-tool-id="{tool_id}"]')
            title = 'Merge PDFs' if language == 'en' else tool_titles[tool_id]
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
                test.get_by_role('button', name='Try a sample document' if language == 'en' else 'Mit Beispieldokument ausprobieren', exact=True).click()
            else:
                test.get_by_role('button', name='Leerseite', exact=True).click()
            expect(test.locator('.file-tab')).to_have_count(1)
            if method in ('drop', 'picker'):
                expect(test.locator('.file-tab').first).to_contain_text(pdf.name)
            if method == 'demo':
                filename = 'Sample-Scan.pdf' if language == 'en' else 'Beispiel-Scan.pdf'
                expect(test.locator('.file-tab').first).to_contain_text(filename)
                drawn = test.evaluate('window.sampleText')
                texts = [entry['text'] for entry in drawn]
                for text in (('Sample invoice', 'Project overview') if language == 'en' else ('Musterrechnung', 'Projektübersicht')):
                    assert text in texts, (language, texts)
                assert all(entry['fits'] for entry in drawn), (language, drawn)
                if language == 'en':
                    assert not any(re.search(r'Musterrechnung|Projektübersicht|Beispieldokument', text) for text in texts), texts
            expect(test.locator('main h1')).to_have_text(title)
            if tool_id == 'sign':
                expect(test.get_by_role('tab', name='Vorschau', exact=True)).to_have_attribute('aria-selected', 'true')
            test.screenshot(path=str(out/f'harbor-selected-import-{tool_id}-{method}-{language}.png'), full_page=True)
            if method == 'demo' and language == 'en':
                test.locator('.language-trigger').click()
                test.get_by_role('menuitemradio', name='Deutsch', exact=True).click()
                expect(test.locator('main h1')).to_have_text(tool_titles[tool_id])
                expect(test.locator('.file-tab').first).to_contain_text('Sample-Scan.pdf')
                assert test.evaluate('window.sampleText') == drawn, 'Changing UI language must keep the open sample unchanged'
                test.locator('.file-tab button').click()
                expect(test.locator('.file-tab')).to_have_count(0)
                test.evaluate('window.sampleText = []')
                test.get_by_role('button', name='Mit Beispieldokument ausprobieren', exact=True).click()
                expect(test.locator('.file-tab').first).to_contain_text('Beispiel-Scan.pdf')
                texts = test.evaluate('window.sampleText.map(entry => entry.text)')
                assert 'Musterrechnung' in texts and 'Projektübersicht' in texts, texts
                assert 'Sample invoice' not in texts, texts
                checks.append('Changing language retains the open sample; the next sample uses the new language')
            imported.close()
            checks.append(f'{title}: {method} import in {language} keeps the chosen tool and document')
        page.set_viewport_size({'width':390, 'height':844})
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio', name='English', exact=True).click()
        expect(page.get_by_text('Paperwork. Sorted.', exact=True)).to_be_visible()
        # Home now preserves the category selected by the earlier tool checks.
        page.locator('.harbor-categories').get_by_role('button', name='Quick access', exact=True).click()
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
        page.get_by_role('button', name=re.compile(r'^Projekte – ')).click()
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
