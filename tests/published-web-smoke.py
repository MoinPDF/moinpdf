"""Exercise the shipped web UI with a synthetic PDF and retain failure evidence."""
import json
import os
from pathlib import Path
import tempfile

import pymupdf
from playwright.sync_api import expect, sync_playwright

evidence = Path('web-evidence')
evidence.mkdir(exist_ok=True)
with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    messages = []
    page.on('console', lambda message: messages.append(f'{message.type}: {message.text}'))
    page.on('pageerror', lambda error: messages.append(f'pageerror: {error}'))
    try:
        page.goto(os.environ.get('MOINPDF_TEST_URL', 'http://localhost:8785'))
        page.locator('img[src="/branding/moinpdf-logo.svg"]').wait_for(timeout=30000)
        pdf_path = Path(temporary) / 'platform-test.pdf'
        with pymupdf.open() as document:
            document.new_page().insert_text((50, 60), 'MoinPDF on platform - synthetic test')
            document.save(pdf_path)
        page.locator('input[type="file"]').first.set_input_files(str(pdf_path))
        page.get_by_role('heading', name='Was möchtest du tun?', exact=True).wait_for(timeout=30000)
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·1 Seite')
        page.get_by_role('button', name='Seiten organisieren', exact=True).click()
        page.get_by_role('tab', name='Dokument', exact=True).click()
        preview = page.get_by_role('img', name='platform-test.pdf, Seite 1', exact=True)
        preview.wait_for(timeout=30000)
        expect(preview).to_have_js_property('complete', True)
        assert preview.evaluate('(image) => image.naturalWidth > 0')
        print('PASS: shipped web image imports and renders a PDF in the document workspace.')
    finally:
        page.screenshot(path=str(evidence / 'workspace.png'), full_page=True)
        details = {
            'console': messages,
            'text': page.locator('body').inner_text(),
            'images': page.locator('img').evaluate_all('(images) => images.map(image => ({alt: image.alt, complete: image.complete, width: image.naturalWidth}))'),
            'tabs': page.get_by_role('tab').evaluate_all('(tabs) => tabs.map(tab => ({text: tab.textContent, selected: tab.getAttribute("aria-selected")}))'),
        }
        (evidence / 'browser.json').write_text(json.dumps(details, ensure_ascii=False, indent=2))
        print(json.dumps(details, ensure_ascii=False))
        browser.close()
