"""Production browser checks for undo across documents and reload recovery."""
import os
from pathlib import Path
import tempfile
import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.getenv('MOINPDF_TEST_URL', 'http://localhost:8080').rstrip('/')
out = Path('web-evidence'); out.mkdir(exist_ok=True)

with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    source = Path(temporary) / 'workspace.pdf'
    with pymupdf.open() as pdf:
        for text in ['First original page', 'Second original page']:
            pdf.new_page().insert_text((50, 60), text)
        pdf.save(source)
    try:
        for width in [1440, 390]:
            context = browser.new_context(viewport={'width': width, 'height': 950})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            try:
                page.goto(origin)
                page.locator('input[type=file]').first.set_input_files(str(source))
                page.get_by_role('button', name='Seiten organisieren', exact=True).click()
                page.get_by_role('button', name='Seite 2 entfernen', exact=True).click()
                page.get_by_role('button', name='Seiten speichern', exact=True).click()
                page.get_by_role('button', name='Ergebnis weiterbearbeiten', exact=True).click()
                page.get_by_role('button', name='Rückgängig', exact=True).click()
                page.get_by_role('button', name='Rückgängig', exact=True).click()
                expect(page.get_by_role('button', name='Seite 2 entfernen', exact=True)).to_be_visible()
                page.get_by_role('button', name='Wiederholen', exact=True).click()
                page.get_by_role('button', name='Wiederholen', exact=True).click()
                page.wait_for_function('''() => new Promise(resolve => {
                    const request = indexedDB.open('moinpdf.workspace.v1');
                    request.onerror = () => resolve(false);
                    request.onsuccess = () => {
                        const db = request.result;
                        const get = db.transaction('recovery').objectStore('recovery').get('current');
                        get.onsuccess = () => { const value = get.result; db.close(); resolve(value?.state.history.length >= 2 && value?.state.pages.length === 1 && value?.sources.length === 2); };
                    };
                })''')
                page.reload()
                page.get_by_role('button', name='Letzten Arbeitsstand wiederherstellen', exact=True).click()
                page.get_by_role('button', name='Seiten organisieren', exact=True).click()
                page.get_by_role('button', name='Rückgängig', exact=True).click()
                page.get_by_role('button', name='Rückgängig', exact=True).click()
                expect(page.get_by_role('button', name='Seite 2 entfernen', exact=True)).to_be_visible()
                navigation = page.locator('.harbor-mobile-nav' if width == 390 else '.harbor-desktop-nav')
                navigation.get_by_role('button', name='Mehr', exact=True).click()
                page.get_by_role('menuitem', name='Ergebnisse und Aufträge', exact=True).click()
                tray = page.get_by_role('dialog')
                expect(tray.get_by_role('button', name='Herunterladen', exact=True)).to_be_visible()
                with page.expect_download() as download:
                    tray.get_by_role('button', name='Herunterladen', exact=True).click()
                with pymupdf.open(download.value.path()) as pdf:
                    assert len(pdf) == 1
                    assert 'First original page' in pdf[0].get_text()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                assert not errors, errors
                page.screenshot(path=str(out / f'workspace-{width}.png'), full_page=True)
                print(f'PASS: {width}px result adoption undo/redo, persisted source history, reload recovery and result download')
            except Exception:
                page.screenshot(path=str(out / f'workspace-failure-{width}.png'), full_page=True)
                print(page.locator('body').inner_text(), flush=True)
                raise
            finally: context.close()
    finally: browser.close()
