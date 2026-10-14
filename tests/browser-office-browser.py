"""Production Chromium acceptance: actual LibreOffice/WASM and independently read PDFs."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.parse
import pymupdf
from playwright.sync_api import expect, sync_playwright
root = Path(__file__).resolve().parents[1]
origin = os.environ['MOINPDF_TEST_URL']
evidence = root / 'web-evidence'
evidence.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as temp, sync_playwright() as api:
    folder = Path(temp)
    subprocess.run([sys.executable, str(root/'tests/research/docx-fixture.py'), str(folder/'fixtures')], check=True)
    subprocess.run([sys.executable, str(root/'tests/research/matbee/generate-rich-fixtures.py')], cwd=folder, check=True)
    browser = api.chromium.launch()
    browser_session = browser.new_browser_cdp_session()
    page = browser.new_page(viewport={'width':1440,'height':1000}, accept_downloads=True)
    page.set_default_timeout(180000)
    errors, uploads, external, results, console = [], [], [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def log(message):
        console.append(message.type+': '+message.text[:1500])
        del console[:-100]
    page.on('console', log)
    page.add_init_script('window.__officeVerbose = ' + json.dumps(os.environ.get('MOINPDF_OFFICE_VERBOSE') == '1'))
    page.add_init_script('''(() => {
      const NativeWorker = window.Worker;
      window.__officeProgress = [];
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          super(url, options);
          if (String(url).includes('/vendor/office/browser.worker.global.js')) {
            this.addEventListener('message', ({data}) => {
              window.__officeProgress.push({time: performance.now(), type: data.type, progress: data.progress});
            });
          }
        }
        postMessage(data, ...args) {
          if (data?.type === 'init' && data.sofficeJs) data = {...data, verbose: window.__officeVerbose};
          return super.postMessage(data, ...args);
        }
      };
    })();''')
    cached_only = False
    def route(r):
        url = r.request.url
        if r.request.method == 'POST': uploads.append(url)
        if '/api/documents/' in url or (cached_only and '/vendor/office/chunks/' in url): r.abort()
        elif urllib.parse.urlsplit(url).netloc != urllib.parse.urlsplit(origin).netloc and not url.startswith(('blob:','data:')):
            external.append(url)
            r.abort()
        else: r.continue_()
    page.route('**/*', route)
    def snapshot_office_threads():
        snapshots, sessions = [], []
        def received(event):
            message = json.loads(event['message'])
            if message.get('method') == 'Debugger.paused':
                snapshots.append({'session': event['sessionId'], 'frames': [{'function': f['functionName'], 'url': f['url'], 'location': f['location']} for f in message['params']['callFrames'][:24]]})
        browser_session.on('Target.receivedMessageFromTarget', received)
        try:
            targets = [t for t in browser_session.send('Target.getTargets')['targetInfos'] if t['type']=='worker' and '/vendor/office/' in t['url']]
            print('Office thread targets: ' + json.dumps(targets), flush=True)
            for target in targets:
                session = browser_session.send('Target.attachToTarget', {'targetId': target['targetId'], 'flatten': False})['sessionId']
                sessions.append(session)
                for ident, method in enumerate(['Debugger.enable', 'Debugger.pause'], 1):
                    browser_session.send('Target.sendMessageToTarget', {'sessionId': session, 'message': json.dumps({'id': ident, 'method': method})})
            page.wait_for_timeout(3000)
            print('Office thread stacks: ' + json.dumps(snapshots), flush=True)
        finally:
            for session in sessions:
                browser_session.send('Target.sendMessageToTarget', {'sessionId': session, 'message': json.dumps({'id': 3, 'method': 'Debugger.resume'})})
                browser_session.send('Target.detachFromTarget', {'sessionId': session})
            browser_session.remove_listener('Target.receivedMessageFromTarget', received)
    def wait_office_closed():
        deadline = time.monotonic() + 10
        while True:
            workers = [t['url'] for t in browser_session.send('Target.getTargets')['targetInfos'] if t['type']=='worker' and '/vendor/office/' in t['url']]
            if not workers: return workers
            assert time.monotonic() < deadline, 'Office workers survived cleanup: ' + repr(workers)
            page.wait_for_timeout(100)
    def choose(path, reload=True):
        if reload: page.goto(origin)
        else: page.evaluate('window.__officeProgress = []')
        assert page.evaluate('crossOriginIsolated'), 'Office requires COOP/COEP'
        page.locator('input[type="file"]').first.set_input_files(str(path))
        expect(page.get_by_role('heading', name='Office zu PDF', exact=True)).to_be_visible()
    def convert(path, suffix='', reload=True):
        started = time.monotonic()
        choose(path, reload)
        page.get_by_role('button', name='PDF erstellen', exact=True).click()
        link = page.get_by_role('link', name='PDF herunterladen', exact=True)
        try:
            expect(link.or_(page.get_by_role('alert'))).to_be_visible(timeout=30000)
        except AssertionError:
            snapshot_office_threads()
            raise
        assert link.is_visible(), page.get_by_role('alert').inner_text()
        pool = [e['progress'] for e in page.evaluate('window.__officeProgress') if (e.get('progress') or {}).get('phase') == 'thread-pool']
        assert pool and all(p['workers'] >= 4 and p['readyWorkers'] == p['workers'] for p in pool), pool
        with page.expect_download() as dl: link.click()
        target = folder / (path.name + suffix + '.pdf')
        dl.value.save_as(target)
        with pymupdf.open(target) as pdf:
            text = '\n'.join(p.get_text() for p in pdf)
            assert len(pdf) >= 1 and len(text.strip()) > 3, path.name
            images = sum(len(p.get_images()) for p in pdf)
            if path.name.startswith('rich.'):
                assert 'MoinPDF' in text and 'Äpfel' in text, text
                assert images > 0, 'Embedded image missing: ' + path.name
                if path.suffix == '.xlsx':
                    assert '53.30' in text or '53,30' in text, text
                    assert any(p.get_drawings() for p in pdf), 'Chart/lines missing'
                if path.suffix == '.pptx':
                    assert len(pdf) == 2 and 'ENDE DER PRÜFDATEI' in text, text
            pdf[0].get_pixmap().save(str(evidence / (path.name+suffix+'.png')))
            workers = wait_office_closed()
            results.append({'file':path.name+suffix,'pages':len(pdf),'images':images,'text':text,'seconds':round(time.monotonic()-started,2),'progress':page.evaluate('window.__officeProgress'),'remainingOfficeWorkers':workers})
        print('PASS: Office '+path.name+suffix+' in '+str(results[-1]['seconds'])+'s', flush=True)
    try:
        for name in ['rich.xlsx','rich.pptx','rich.docx']:
            convert(folder/'fixtures'/name)
        for name in ['sample.docx','sample.xlsx','sample.pptx','sample.odt','sample.ods','sample.odp']:
            convert(root/'tests/fixtures/office'/name)
        for cycle in range(15):
            choose(folder/'fixtures/rich.docx', reload=(cycle == 0))
            page.get_by_role('button', name='PDF erstellen', exact=True).click()
            # Cancel the actual running WASM worker, after asset preparation.
            page.wait_for_function("window.__officeProgress.some(e => e.progress?.phase === 'compile')")
            page.get_by_role('button', name='Abbrechen', exact=True).click()
            expect(page.get_by_role('button', name='PDF erstellen', exact=True)).to_be_enabled()
            expect(page.get_by_role('link', name='PDF herunterladen', exact=True)).not_to_be_visible()
            wait_office_closed()
            cached_only = True
            convert(folder/'fixtures/rich.xlsx', '-cached-after-abort-' + str(cycle), reload=False)
            convert(folder/'fixtures/rich.docx', '-cached-after-success-' + str(cycle), reload=False)
        assert not uploads, uploads
        assert not external, external
        assert not errors, errors
        (evidence/'browser-office.json').write_text(json.dumps({'results':results,'uploads':uploads,'external':external,'errors':errors}, ensure_ascii=False, indent=2))
        print('PASS: real browser Office conversion, cached binary assets, repeated abort/restart, no surviving Office workers and no document uploads.', flush=True)
    except BaseException:
        print(page.locator('body').inner_text()[:8000], flush=True)
        print('Browser errors: '+repr(errors), flush=True)
        print('Office progress: '+json.dumps(page.evaluate('window.__officeProgress')), flush=True)
        print('Completed conversions: '+json.dumps(results,ensure_ascii=False), flush=True)
        print('Recent console: '+json.dumps(console), flush=True)
        (evidence/'browser-office-failure.json').write_text(json.dumps({'results':results,'progress':page.evaluate('window.__officeProgress'),'console':console,'errors':errors}, ensure_ascii=False, indent=2))
        page.screenshot(path=str(evidence/'browser-office-failure.png'), full_page=True)
        raise
    finally:
        browser.close()
