"""Production browser regression for the glass navigation and bottom search.

Viewport resizing covers compact layouts, not a real phone's native keyboard.
The component suite separately exercises visualViewport keyboard/pan events.
"""
import json
import os
import tempfile
from pathlib import Path

import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.getenv('MOINPDF_TEST_URL', 'http://localhost:8080').rstrip('/')
out = Path('web-evidence')
out.mkdir(exist_ok=True)
checks, errors = [], []


def on_screen(locator):
    expect(locator).to_be_visible()
    assert locator.evaluate('''el => {
        const r = el.getBoundingClientRect(), v = visualViewport;
        const left = v?.offsetLeft || 0, top = v?.offsetTop || 0;
        return r.width > 0 && r.height > 0 && r.left >= left - 1 && r.top >= top - 1
            && r.right <= left + (v?.width || innerWidth) + 1
            && r.bottom <= top + (v?.height || innerHeight) + 1
            && el.contains(document.elementFromPoint(r.x+r.width/2, r.y+r.height/2));
    }'''), 'Control is clipped, off screen or covered'


with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    page = None
    try:
        for language in ('de', 'en'):
            en = language == 'en'
            context = browser.new_context(viewport={'width': 390, 'height': 844},
                                          is_mobile=True, has_touch=True, device_scale_factor=2,
                                          reduced_motion='reduce')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin + '?lang=' + language)
            expect(page.locator('.harbor-home')).to_be_visible()
            nav = page.locator('.harbor-mobile-nav')
            search = nav.get_by_role('button', name='Search' if en else 'Suche', exact=True)
            projects = nav.get_by_role('button', name='Projects' if en else 'Projekte', exact=True)
            sheet = page.locator('.mobile-tool-search')
            field = sheet.get_by_role('combobox')
            for theme in ('light', 'dark'):
                if theme == 'dark':
                    page.locator('.theme-toggle').click()
                    expect(page.locator('html')).to_have_class('dark')
                for width, height in ((320, 568), (390, 844), (600, 844), (768, 320), (1100, 844)):
                    page.set_viewport_size({'width': width, 'height': height})
                    expect(nav.locator('button')).to_have_count(5)
                    expect(page.locator('#moinpdf-project-bar')).to_be_hidden()
                    expect(page.locator('.home-tool-search-row')).to_be_hidden()
                    for button in nav.locator('button').all():
                        on_screen(button)
                        box = button.bounding_box()
                        assert box['width'] >= 44 and box['height'] >= 44
                    search.tap()
                    on_screen(field)
                    on_screen(sheet.locator('.mobile-search-close'))
                    on_screen(sheet.locator('.mobile-search-all'))
                    expect(field).to_be_focused()
                    expect(sheet.get_by_role('option')).to_have_count(7)
                    field.fill('qzxvnomatch987654')
                    expect(sheet.get_by_role('option')).to_have_count(0)
                    expect(sheet.get_by_role('status')).to_contain_text('No matching' if en else 'Kein passendes')
                    sheet.locator('.mobile-search-clear').tap()
                    expect(field).to_have_value('')
                    expect(field).to_be_focused()
                    field.fill('merge' if en else 'zusammenfügen')
                    expect(sheet.locator('[data-tool-id="merge"]')).to_be_visible()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                    if width in (320, 390, 768):
                        page.screenshot(path=str(out / f'search-{language}-{theme}-{width}.png'))
                    page.keyboard.press('Escape')
                    expect(sheet).to_have_count(0)
                    expect(search).to_be_focused()
                    checks.append(f'{language}/{theme}/{width}x{height}: five touch targets, visible search, results, clear, Escape/focus')
            search.tap()
            field.fill('merge' if en else 'zusammenfügen')
            merge_title = sheet.locator('[data-tool-id="merge"] strong').inner_text()
            field.press('Enter')
            expect(sheet).to_have_count(0)
            expect(page.locator('main h1')).to_have_text(merge_title)
            nav.get_by_role('button', name='Home' if en else 'Start', exact=True).tap()
            search.tap()
            sheet.locator('.mobile-search-all').tap()
            expect(page.locator('.chooser-tool')).to_have_count(116)
            pdf = Path(temporary) / 'navigation-retained.pdf'
            with pymupdf.open() as document:
                document.new_page().insert_text((50, 60), 'Navigation retains this PDF')
                document.save(pdf)
            page.locator('input[type=file]').first.set_input_files(str(pdf))
            expect(page.locator('.chooser-file')).to_contain_text(pdf.name)
            search.tap()
            field.fill('split' if en else 'teilen')
            split_title = sheet.locator('[data-tool-id="split"] strong').inner_text()
            sheet.locator('[data-tool-id="split"]').tap()
            expect(sheet).to_have_count(0)
            expect(page.locator('main h1')).to_have_text(split_title)
            nav.get_by_role('button', name='Tools' if en else 'Werkzeuge', exact=True).tap()
            expect(page.locator('.chooser-file')).to_contain_text(pdf.name)
            projects.tap()
            expect(page.get_by_role('dialog')).to_be_visible()
            page.keyboard.press('Escape')
            expect(projects).to_be_focused()
            nav.get_by_role('button', name='Home' if en else 'Start', exact=True).tap()
            search.tap()
            page.set_viewport_size({'width': 1440, 'height': 1000})
            expect(sheet).to_have_count(0)
            expect(nav).to_be_hidden()
            expect(page.locator('.desktop-command-trigger')).to_be_visible()
            page.keyboard.press('Control+k')
            expect(page.locator('.desktop-tool-search input')).to_be_focused()
            page.keyboard.press('Escape')
            expect(page.locator('.project-toggle')).to_be_visible()
            page.locator('.project-toggle').click()
            dialog = page.get_by_role('dialog')
            on_screen(dialog)
            box = dialog.bounding_box()
            assert abs(box['x'] + box['width'] / 2 - 720) <= 2
            page.keyboard.press('Escape')
            page.locator('.harbor-desktop-nav').get_by_role('button', name='Tools' if en else 'Werkzeuge', exact=True).click()
            expect(page.locator('.chooser-tool')).to_have_count(116)
            expect(page.locator('.chooser-file')).to_contain_text(pdf.name)
            checks.append(f'{language}: Enter/tap tool selection, all tools, PDF retention, projects/focus, desktop resize and centered dialog')
            if not en:
                page.locator('.chooser-tool').filter(has=page.get_by_text('PDF bearbeiten', exact=True)).click()
                page.set_viewport_size({'width':390,'height':844})
                expect(page.locator('.editor-sheet > img')).to_be_visible(timeout=120000)
                expect(nav.locator('button')).to_have_count(4)
                page.get_by_role('button',name='Text bearbeiten: Navigation retains this PDF',exact=True).click()
                page.get_by_label('Text direkt in der PDF bearbeiten',exact=True).fill('Edited on mobile')
                nav.get_by_role('button',name='Format',exact=True).click()
                inspector=page.locator('dialog.editor-settings-sheet[open]')
                on_screen(inspector)
                page.keyboard.press('Control+k')
                expect(page.locator('.mobile-tool-search')).to_have_count(0)
                inspector.get_by_label('Sprache gescannter Texte',exact=True).click()
                # The popup must live inside the native dialog's top layer.
                expect(inspector.get_by_role('option',name='Französisch',exact=True)).to_be_visible()
                inspector.get_by_role('option',name='Französisch',exact=True).click()
                inspector.get_by_role('button',name='Zurück zur PDF',exact=True).click()
                expect(page.locator('dialog.editor-settings-sheet[open]')).to_have_count(0)
                expect(nav.get_by_role('button',name='Format',exact=True)).to_be_focused()
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                nav.get_by_role('button',name='Bearbeitete PDF erstellen',exact=True).click()
                expect(page.locator('.result-next-steps')).to_be_visible(timeout=180000)
                page.locator('.results-shortcut').click()
                on_screen(page.locator('.workspace-tray'))
                page.keyboard.press('Escape')
                result_name=page.locator('.export-name-button').inner_text()
                page.locator('.result-next-steps').get_by_role('button',name='Text bearbeiten',exact=True).click()
                expect(page.get_by_role('button',name=result_name+' schließen',exact=True)).to_be_visible(timeout=120000)
                expect(nav.get_by_role('button',name='Rückgängig',exact=True)).to_be_enabled()
                checks.append('390px editor: task navigation, native settings/menu layering, focus return, no overflow, PDF export, next steps and results drawer')
            context.close()
        assert not errors, errors
        (out / 'mobile-navigation.json').write_text(json.dumps({'checks': checks, 'errors': errors}, indent=2))
        print(f'PASS: {len(checks)} production mobile-navigation checks')
    except Exception:
        if page and not page.is_closed():
            page.screenshot(path=str(out / 'mobile-navigation-failure.png'), full_page=True)
        raise
    finally:
        browser.close()
