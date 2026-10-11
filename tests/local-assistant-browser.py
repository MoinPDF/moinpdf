"""Run the actual production CPU model and worker in Chromium; no inference mocks."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import urllib.parse
import urllib.request

import pymupdf
from playwright.sync_api import expect, sync_playwright

MODEL = 'qwen2.5-0.5b-instruct-q4_0.gguf'
DIGEST = '7671c0c304e6ce5a7fc577bcb12aba01e2c155cc2efd29b2213c95b18edaf6ed'
URL = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/' + MODEL
origin = os.environ['MOINPDF_TEST_URL']
evidence = Path('web-evidence')
evidence.mkdir(exist_ok=True)
model = Path('.cache') / MODEL
model.parent.mkdir(exist_ok=True)
if not model.exists():
    urllib.request.urlretrieve(URL, model)
assert model.stat().st_size == 428730208
with model.open('rb') as stream:
    assert hashlib.file_digest(stream, 'sha256').hexdigest() == DIGEST

with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page.set_default_timeout(180000)
    errors, external, requests = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def route(request_route):
        url = request_route.request.url
        if urllib.parse.urlsplit(url).netloc != urllib.parse.urlsplit(origin).netloc and not url.startswith(('blob:', 'data:')):
            external.append(url)
            request_route.abort()
        else:
            requests.append(url)
            request_route.continue_()
    page.route('**/*', route)
    try:
        document_path = Path(temporary) / 'Projektplan.pdf'
        with pymupdf.open() as document:
            document.new_page().insert_text((50,60),'Die Projektnummer ist 7429. Die Abgabe erfolgt am 12. November 2026.')
            document.save(document_path)
        page.goto(origin)
        page.locator('input[type="file"]').first.set_input_files(str(document_path))
        page.get_by_role('button',name='Lokaler PDF-Assistent',exact=True).click()
        page.get_by_label('Lokale Modelldatei',exact=True).set_input_files(str(model))
        expect(page.get_by_text('Modelldatei geprüft. Die Inferenz beginnt mit deiner Frage.',exact=True)).to_be_visible(timeout=180000)
        page.get_by_label('Frage zu den geöffneten Dokumenten',exact=True).fill('Welche Projektnummer steht im Dokument? Antworte mit der Nummer.')
        page.get_by_role('button',name='Frage lokal beantworten',exact=True).click()
        result = page.get_by_role('region',name='Antwort des lokalen Assistenten',exact=True)
        expect(result).to_be_visible(timeout=360000)
        expect(result).to_contain_text('7429')
        assert 1 <= result.locator('blockquote').count() <= 3
        assert '7429' in ' '.join(result.locator('blockquote').all_inner_texts())
        with page.expect_download() as download:
            page.locator('.advanced-result a[download]').click()
        saved = Path(temporary) / 'antwort.json'
        download.value.save_as(saved)
        answer = json.loads(saved.read_text())
        assert not answer['abstain'] and answer['citations'][0]['page'] == 0
        assert '7429' in answer['answer']
        assert any('/vendor/llm/wllama.wasm' in url for url in requests)
        assert not external, external
        assert not errors, errors
        page.screenshot(path=str(evidence/'local-assistant-real-inference.png'),full_page=True)
        (evidence/'local-assistant-real-inference.json').write_text(json.dumps({'modelSha256':DIGEST,'networkRequestsOutsideApp':external,'answer':answer},ensure_ascii=False,indent=2))
        # A second real request exercises cancellation and worker disposal.
        page.get_by_label('Frage zu den geöffneten Dokumenten',exact=True).fill('Fasse alle Angaben im Dokument zusammen.')
        page.get_by_role('button',name='Frage lokal beantworten',exact=True).click()
        page.get_by_role('button',name='Abbrechen',exact=True).click()
        expect(page.get_by_role('button',name='Frage lokal beantworten',exact=True)).to_be_enabled()
        expect(result).not_to_be_visible()
        page.get_by_role('button',name='Modell entladen und gespeicherte Kopie löschen',exact=True).click()
        expect(page.get_by_text('Modelldatei und Laufzeit entladen.',exact=True)).to_be_visible()
        print('PASS: real Qwen CPU inference, verified quote/JSON provenance, app-only network, cancellation and unload in production Chromium.')
    except BaseException:
        page.screenshot(path=str(evidence/'local-assistant-failure.png'),full_page=True)
        (evidence/'local-assistant-failure.txt').write_text(page.locator('body').inner_text()+'\n'+repr(errors)+'\n'+repr(external))
        raise
    finally:
        browser.close()
