"""Fast production regression for zero-page backup and immediate project reopening."""
import json
import os
import tempfile
from pathlib import Path

import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.getenv('MOINPDF_TEST_URL', 'http://localhost:8080').rstrip('/')
out = Path('web-evidence')
out.mkdir(exist_ok=True)

with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    transitions = []
    page.on('console', lambda message: transitions.append(message.text) if message.text.startswith('PROJECT_STATE ') else None)
    try:
        page.goto(origin)
        page.evaluate('''() => {
            let previous = '';
            new MutationObserver(() => {
                const state = JSON.stringify({
                    dialogs: [...document.querySelectorAll('[role=dialog]')].map(el => ({state:el.dataset.state, text:el.textContent})),
                    nav: document.querySelector('.harbor-project-toggle')?.outerHTML,
                    active: document.activeElement?.outerHTML.slice(0,300)
                });
                if (state !== previous) { previous=state; console.log('PROJECT_STATE '+state); }
            }).observe(document.body,{subtree:true,childList:true,attributes:true});
        }''')
        pdf = Path(temporary) / 'retained.pdf'
        with pymupdf.open() as document:
            document.new_page().insert_text((50, 60), 'Retained project document')
            document.save(pdf)
        page.locator('input[type=file]').first.set_input_files(str(pdf))
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·1 Seite')
        projects = page.locator('.harbor-project-toggle')
        projects.click()
        page.get_by_label('Projektname', exact=True).fill('Project lifecycle')
        page.get_by_role('button', name='Projekt speichern', exact=True).click()
        expect(page.get_by_role('dialog').get_by_role('status').filter(has_text='Alles an Bord – gespeichert.')).to_be_visible()
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Seiten organisieren', exact=True).click()
        page.get_by_role('button', name='Seite 1 entfernen', exact=True).click()
        projects.click()
        page.get_by_role('button', name='Öffnen', exact=True).first.click()
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·1 Seite')
        projects.click()
        expect(page.get_by_role('dialog')).to_be_visible()
        zero = page.locator('.project-version').filter(has_text='0 Seiten')
        expect(zero).to_have_count(1)
        zero.get_by_role('button', name='Öffnen', exact=True).click()
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·0 Seiten')
        page.get_by_role('button', name='Seiten organisieren', exact=True).click()
        page.get_by_role('button', name='Rückgängig', exact=True).click()
        expect(page.get_by_role('button', name='Seite 1 entfernen', exact=True)).to_be_visible()
        print('PASS: immediate mobile project reopen, zero-page backup and restored undo')
    except Exception:
        page.screenshot(path=str(out/'project-switch-failure.png'), full_page=True)
        print('PROJECT_FINAL '+page.locator('body').inner_text(), flush=True)
        raise
    finally:
        (out/'project-switch-transitions.json').write_text(json.dumps(transitions,ensure_ascii=False,indent=2))
        browser.close()
