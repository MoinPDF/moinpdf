"""Exercise new document and result flows against the real production container.

The share API is an explicit test double; native operating-system share sheets
still require a real-device check. PDF downloads are independently read back.
"""
import ipaddress
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.getenv('MOINPDF_TEST_URL', 'http://localhost:8080').rstrip('/')
if os.getenv('MOINPDF_TEST_NONLOCAL_HTTP') == '1':
    host = next(value for value in subprocess.check_output(['hostname', '-I'], text=True).split()
                if ipaddress.ip_address(value).version == 4 and not ipaddress.ip_address(value).is_loopback)
    origin = f'http://{host}:8080'
out = Path('web-evidence')
out.mkdir(exist_ok=True)
checks, errors = [], []


def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')


def back(page):
    page.get_by_role('button', name=re.compile(r'^(Alle Werkzeuge|Werkzeug wechseln)$')).click()


with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    page = None
    try:
        for language, width in [('de', 1440), ('en', 390)]:
            en = language == 'en'
            context = browser.new_context(viewport={'width': width, 'height': 950}, reduced_motion='reduce')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin + '?lang=' + language)
            expect(page.locator('html')).to_have_attribute('lang', language)
            if os.getenv('MOINPDF_TEST_NONLOCAL_HTTP') == '1':
                assert page.evaluate('isSecureContext') is False
                assert page.evaluate('typeof crypto.randomUUID') == 'undefined'
            create = page.get_by_role('button', name='New document' if en else 'Neues Dokument', exact=True)
            expect(create).to_be_visible()
            if en:
                assert page.locator('.app-toolbar').bounding_box()['height'] <= 90
                for size in (320, 390):
                    page.set_viewport_size({'width': size, 'height': 950})
                    no_overflow(page)
            create.click()
            editor = page.get_by_role('textbox', name='Document content' if en else 'Dokumentinhalt', exact=True)
            title = page.get_by_label('Document title' if en else 'Dokumenttitel', exact=True)
            expect(editor).to_be_visible()
            title.fill('Umbrel release check')
            editor.fill('A new document created over local HTTP. Umlauts: ÄÖÜ.')
            page.get_by_role('button', name='Save draft' if en else 'Entwurf speichern', exact=True).click()
            expect(page.locator('.writer-save-state')).to_have_attribute('data-state', 'saved')
            no_overflow(page)
            page.screenshot(path=str(out / f'writer-{language}-{width}.png'), full_page=True)
            with page.expect_download() as download:
                page.get_by_role('button', name='Download as PDF' if en else 'Als PDF herunterladen', exact=True).click()
            target = Path(temporary) / f'writer-{language}.pdf'
            download.value.save_as(target)
            with pymupdf.open(target) as pdf:
                assert len(pdf) == 1 and 'created over local HTTP' in pdf[0].get_text()
                assert 'ÄÖÜ' in pdf[0].get_text()
            result = page.locator('.writer-export')
            expect(result).to_be_visible()
            link = result.locator('a[download]')
            before = link.get_attribute('href')
            result.locator('.export-name-button').click()
            filename = result.get_by_role('textbox')
            filename.fill('Discard this')
            filename.press('Escape')
            expect(link).to_have_attribute('download', 'Umbrel release check.pdf')
            result.locator('.export-name-button').click()
            filename.fill('Umbrel:Prüfung')
            filename.press('Enter')
            expect(link).to_have_attribute('download', 'Umbrel-Prüfung.pdf')
            assert link.get_attribute('href') == before, 'Rename replaced the generated PDF'
            with page.expect_download() as renamed:
                page.get_by_role('button', name='Download as PDF' if en else 'Als PDF herunterladen', exact=True).click()
            assert renamed.value.suggested_filename == 'Umbrel-Prüfung.pdf'
            # Any content edit invalidates the previous export and its renamed file.
            editor.fill('Updated output after an edit.')
            expect(result).to_have_count(0)
            page.get_by_role('button', name='Drafts' if en else 'Entwürfe', exact=True).click()
            with page.expect_download() as draft:
                page.get_by_role('button', name='Download draft' if en else 'Entwurf herunterladen', exact=True).click()
            draft_path = Path(temporary) / f'writer-{language}.moindoc'
            draft.value.save_as(draft_path)
            saved = json.loads(draft_path.read_text())
            assert saved['kind'] == 'moinpdf-document'
            page.get_by_role('button', name='Blank document' if en else 'Leeres Dokument', exact=True).click()
            expect(editor).to_have_text('')
            page.get_by_label('Open document draft' if en else 'Dokumententwurf öffnen', exact=True).set_input_files(str(draft_path))
            expect(editor).to_contain_text('Updated output after an edit.')
            expect(page.locator('.writer-save-state')).to_have_attribute('data-state', 'saved')
            page.reload()
            page.get_by_role('button', name='New document' if en else 'Neues Dokument', exact=True).click()
            page.get_by_role('button', name='Drafts' if en else 'Entwürfe', exact=True).click()
            page.locator('.writer-draft-open').filter(has=page.get_by_text('Umbrel release check', exact=True)).first.click()
            expect(editor).to_contain_text('Updated output after an edit.')
            with page.expect_download() as updated:
                page.get_by_role('button', name='Download as PDF' if en else 'Als PDF herunterladen', exact=True).click()
            updated.value.save_as(target)
            with pymupdf.open(target) as pdf:
                assert 'Updated output after an edit.' in pdf[0].get_text()
                assert 'created over local HTTP' not in pdf[0].get_text()
            assert not errors, errors
            checks.append(f'{language}/{width}px: HTTP create/import, PDF readback, rename/cancel, export invalidation, draft file and reload')
            context.close()

        context = browser.new_context(viewport={'width': 1440, 'height': 950}, reduced_motion='reduce')
        # This records actual files and click activation, without opening an OS UI.
        context.add_init_script('''
            window.sharedFiles = [];
            Object.defineProperty(navigator, 'canShare', {value: data => data.files?.every(f => f instanceof File)});
            Object.defineProperty(navigator, 'share', {value: async data => {
                const activation = navigator.userActivation.isActive;
                for (const file of data.files) window.sharedFiles.push({name:file.name, type:file.type,
                    size:file.size, activation, bytes:Array.from(new Uint8Array(await file.arrayBuffer()))});
                throw new DOMException('Cancelled by test', 'AbortError');
            }});
        ''')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(origin)
        data = []
        for text in ('Original PDF for duplicate checks.', 'Different contents with the same name.'):
            with pymupdf.open() as pdf:
                pdf.new_page().insert_text((50, 60), text)
                data.append(pdf.tobytes())
        file = lambda name, contents: {'name': name, 'mimeType': 'application/pdf', 'buffer': contents}
        upload = page.locator('input[type=file]').first
        upload.set_input_files([file('original.pdf', data[0]), file('copy.pdf', data[0]), file('original.pdf', data[1])])
        expect(page.get_by_role('dialog')).to_be_visible()
        page.get_by_role('button', name='Überspringen', exact=True).click()
        expect(page.locator('.chooser-file')).to_have_count(2)
        expect(page.locator('.chooser-document-count')).to_contain_text('2 Dateien')
        upload.set_input_files([file('copy-one.pdf', data[0]), file('copy-two.pdf', data[0])])
        page.get_by_label('Für weitere doppelte Dateien in diesem Upload merken', exact=True).check()
        page.get_by_role('button', name='Trotzdem hinzufügen', exact=True).click()
        expect(page.locator('.chooser-file')).to_have_count(4)
        expect(page.get_by_role('dialog')).to_have_count(0)
        checks.append('Content duplicates across filenames, same-name different contents and remembered batch choice')

        categories = page.get_by_role('group', name='Werkzeugkategorien')
        categories.get_by_role('button', name='Seiten', exact=True).click()
        search = page.get_by_placeholder('Zum Beispiel: PDF kleiner machen …', exact=True)
        search.fill('Seite rausnehmen')
        expect(page.get_by_role('option').first).to_contain_text('Seiten')
        card = page.locator('.chooser-tool[data-tool-id=organize]')
        card.scroll_into_view_if_needed()
        scroll = page.evaluate('scrollY')
        card.press('Enter')
        page.get_by_role('button', name='Seiten speichern', exact=True).click()
        expect(page.get_by_role('heading', name='Erledigt.', exact=True)).to_be_visible()
        result = page.locator('.export-actions').filter(has=page.locator('a[download]')).first
        result.locator('.export-name-button').click()
        result.get_by_role('textbox').fill('Gemeinsames Ergebnis')
        result.get_by_role('textbox').press('Enter')
        page.get_by_role('button', name='Ergebnis teilen', exact=True).click()
        page.wait_for_function('window.sharedFiles.length === 1')
        shared = page.evaluate('window.sharedFiles[0]')
        assert shared['name'] == 'Gemeinsames Ergebnis.pdf' and shared['type'] == 'application/pdf'
        assert shared['activation'] is True
        with pymupdf.open(stream=bytes(shared['bytes']), filetype='pdf') as pdf:
            assert len(pdf) == 4 and 'Original PDF' in pdf[0].get_text()
        expect(page.get_by_role('button', name='Ergebnis teilen', exact=True)).to_be_enabled()
        assert not page.get_by_text('Teilen ist gerade nicht möglich.', exact=False).count()
        back(page)
        expect(categories.get_by_role('button', name='Seiten', exact=True)).to_have_attribute('aria-pressed', 'true')
        expect(search).to_have_value('Seite rausnehmen')
        page.wait_for_function('(top) => Math.abs(scrollY - top) <= 2', arg=scroll)
        assert page.evaluate('document.activeElement.dataset.toolId') == 'organize'
        checks.append('Catalogue category/query/scroll/focus restoration; shared PDF bytes, renamed filename, click activation and cancellation')

        page.locator('.harbor-desktop-nav').get_by_role('button', name='Start', exact=True).click()
        page.locator('.harbor-categories').get_by_role('button', name='Seiten', exact=True).click()
        home_card = page.locator('.tool-mosaic-card[data-tool-id=organize]')
        home_card.press('Enter')
        back(page)
        expect(page.locator('.harbor-home')).to_be_visible()
        expect(page.locator('.harbor-categories').get_by_role('button', name='Seiten', exact=True)).to_have_attribute('aria-pressed', 'true')
        checks.append('Home-origin tool navigation returns to the original home category')
        assert not errors, errors
        page.screenshot(path=str(out / 'release-usability.png'), full_page=True)
        print('PASS:', '; '.join(checks))
    except Exception:
        if page and not page.is_closed():
            page.screenshot(path=str(out / 'release-usability-failure.png'), full_page=True)
        raise
    finally:
        (out / 'release-usability.json').write_text(json.dumps({'checks': checks, 'errors': errors}, indent=2))
        browser.close()
