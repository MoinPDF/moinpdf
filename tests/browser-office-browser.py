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
    launch_options = {}
    if os.environ.get('MOINPDF_BROWSER_CHANNEL'):
        launch_options['channel'] = os.environ['MOINPDF_BROWSER_CHANNEL']
    browser = api.chromium.launch(**launch_options)
    print('Browser: ' + browser.version + '; channel=' + str(launch_options), flush=True)
    browser_session = browser.new_browser_cdp_session()
    page = browser.new_page(viewport={'width':1440,'height':1000}, accept_downloads=True)
    page.set_default_timeout(180000)
    errors, uploads, external, results, console = [], [], [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    lifecycle, target_events = [], []
    page.on('worker', lambda worker: (
        lifecycle.append({'event': 'created', 'time': time.monotonic(), 'url': worker.url}),
        worker.on('close', lambda *_args, url=worker.url: lifecycle.append({'event': 'closed', 'time': time.monotonic(), 'url': url}))
    ))
    browser_session.on('Target.targetCreated', lambda event: target_events.append({'event': 'created', 'time': time.monotonic(), **event}))
    browser_session.on('Target.targetDestroyed', lambda event: target_events.append({'event': 'destroyed', 'time': time.monotonic(), **event}))
    browser_session.send('Target.setDiscoverTargets', {'discover': True})
    def log(message):
        console.append(message.type+': '+message.text[:1500])
        del console[:-100]
    page.on('console', log)
    page.add_init_script('window.__officeVerbose = ' + json.dumps(os.environ.get('MOINPDF_OFFICE_VERBOSE') == '1'))
    page.add_init_script('''(() => {
      const NativeWorker = window.Worker;
      window.__officeProgress = [];
      window.__officeLifecycle = [];
      let sequence = 0;
      const identities = new WeakMap();
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          super(url, options);
          if (String(url).includes('/vendor/office/browser.worker.global.js')) {
            const workerId = ++sequence;
            identities.set(this, workerId);
            window.__officeLifecycle.push({event: 'constructed', workerId, time: performance.now()});
            this.addEventListener('message', ({data}) => {
              window.__officeProgress.push({time: performance.now(), workerId, type: data.type, id: data.id, progress: data.progress});
              if (['loaded', 'ready', 'result', 'error'].includes(data.type))
                window.__officeLifecycle.push({event: 'received', workerId, time: performance.now(), type: data.type, id: data.id});
            });
          }
        }
        terminate() {
          const workerId = identities.get(this);
          if (workerId) window.__officeLifecycle.push({event: 'terminate-called', workerId, time: performance.now()});
          const result = super.terminate();
          if (workerId) window.__officeLifecycle.push({event: 'terminate-returned', workerId, time: performance.now()});
          return result;
        }
        postMessage(data, ...args) {
          const workerId = identities.get(this);
          if (workerId) window.__officeLifecycle.push({event: 'sent', workerId, time: performance.now(), type: data?.type, id: data?.id});
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
        snapshots, sessions, states = [], [], []
        def received(event):
            message = json.loads(event['message'])
            if message.get('id') == 4:
                states.append({'session': event['sessionId'], 'state': message.get('result'), 'error': message.get('error')})
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
            page.wait_for_timeout(1000)
            for session in sessions:
                browser_session.send('Target.sendMessageToTarget', {'sessionId': session, 'message': json.dumps({'id': 4, 'method': 'Runtime.evaluate', 'params': {'expression': "JSON.stringify({pthread: self.ENVIRONMENT_IS_PTHREAD, initializedJS: self.initializedJS, aborted: self.ABORT, onmessage: String(self.onmessage), unused: self.PThread?.unusedWorkers?.map(w => ({id: w.workerID, loaded: w.loaded, ptr: w.pthread_ptr})), running: self.PThread?.runningWorkers?.map(w => ({id: w.workerID, loaded: w.loaded, ptr: w.pthread_ptr}))})", 'returnByValue': True}})})
            page.wait_for_timeout(2000)
            print('Office thread states: ' + json.dumps(states), flush=True)
            print('Office thread stacks: ' + json.dumps(snapshots), flush=True)
        finally:
            for session in sessions:
                browser_session.send('Target.sendMessageToTarget', {'sessionId': session, 'message': json.dumps({'id': 3, 'method': 'Debugger.resume'})})
                browser_session.send('Target.detachFromTarget', {'sessionId': session})
            browser_session.remove_listener('Target.receivedMessageFromTarget', received)
    def office_targets():
        return [t for t in browser_session.send('Target.getTargets')['targetInfos']
                if t['type'] == 'worker' and '/vendor/office/' in t['url']]

    def diagnose_survivors(targets):
        """Inspect the failed state without changing the ten-second release assertion."""
        responses, sessions = [], []
        def received(event):
            message = json.loads(event['message'])
            if message.get('id') in (901, 902):
                responses.append({'time': time.monotonic(), 'session': event['sessionId'], 'message': message})
        browser_session.on('Target.receivedMessageFromTarget', received)
        details = {'initialTargets': targets, 'pageLifecycle': page.evaluate('window.__officeLifecycle'),
                   'playwrightLifecycle': lifecycle, 'targetEvents': list(target_events),
                   'browserVersion': browser.version, 'channel': launch_options}
        try:
            details['processesBefore'] = browser_session.send('SystemInfo.getProcessInfo')
            for target in targets:
                try:
                    session = browser_session.send('Target.attachToTarget', {'targetId': target['targetId'], 'flatten': False})['sessionId']
                    sessions.append(session)
                    for ident, method, params in (
                        (901, 'Runtime.getHeapUsage', {}),
                        (902, 'Runtime.evaluate', {'expression': "JSON.stringify({url:location.href, pool:typeof PThread==='undefined'?null:{running:PThread.runningWorkers.length,unused:PThread.unusedWorkers.length}, now:performance.now()})", 'returnByValue': True, 'timeout': 1000}),
                    ):
                        browser_session.send('Target.sendMessageToTarget', {'sessionId': session, 'message': json.dumps({'id': ident, 'method': method, 'params': params})})
                except Exception as error:
                    responses.append({'target': target['targetId'], 'error': str(error)})
            page.wait_for_timeout(2000)
            details['responses'] = responses
            details['processesAfter'] = browser_session.send('SystemInfo.getProcessInfo')
            details['afterProbe'] = office_targets()
        finally:
            for session in sessions:
                try:
                    browser_session.send('Target.detachFromTarget', {'sessionId': session})
                except Exception:
                    pass
            browser_session.remove_listener('Target.receivedMessageFromTarget', received)
        page.wait_for_timeout(1000)
        details['afterProbeDetach'] = office_targets()
        (evidence / 'office-worker-survivors.json').write_text(json.dumps(details, indent=2))
        print('Office shutdown diagnosis: ' + json.dumps(details), flush=True)

    def wait_office_closed():
        started = time.monotonic()
        deadline = started + 10
        while True:
            workers = office_targets()
            if not workers:
                return []
            if time.monotonic() >= deadline:
                diagnose_survivors(workers)
                raise AssertionError('Office workers survived cleanup: ' + repr(workers))
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
        assert pool and all(p['workers'] == 8 and p['readyWorkers'] == p['workers'] for p in pool), pool
        starts = [e['progress'] for e in page.evaluate('window.__officeProgress') if (e.get('progress') or {}).get('phase') == 'thread-start']
        assert starts and all(p['ready'] and p['runningWorkers'] + p['unusedWorkers'] == 7 for p in starts), starts
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
        for cycle in range(int(os.environ.get('MOINPDF_OFFICE_CYCLES', '15'))):
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
        (evidence/'browser-office.json').write_text(json.dumps({'results':results,'uploads':uploads,'external':external,'errors':errors,'browserVersion':browser.version,'pageLifecycle':page.evaluate('window.__officeLifecycle'),'playwrightLifecycle':lifecycle,'targetEvents':target_events}, ensure_ascii=False, indent=2))
        print('PASS: real browser Office conversion, cached binary assets, repeated abort/restart, no surviving Office workers and no document uploads.', flush=True)
    except BaseException:
        print(page.locator('body').inner_text()[:8000], flush=True)
        print('Browser errors: '+repr(errors), flush=True)
        print('Office progress: '+json.dumps(page.evaluate('window.__officeProgress')), flush=True)
        print('Completed conversions: '+json.dumps(results,ensure_ascii=False), flush=True)
        print('Recent console: '+json.dumps(console), flush=True)
        (evidence/'browser-office-failure.json').write_text(json.dumps({'results':results,'progress':page.evaluate('window.__officeProgress'),'console':console,'errors':errors,'browserVersion':browser.version,'pageLifecycle':page.evaluate('window.__officeLifecycle'),'playwrightLifecycle':lifecycle,'targetEvents':target_events}, ensure_ascii=False, indent=2))
        page.screenshot(path=str(evidence/'browser-office-failure.png'), full_page=True)
        raise
    finally:
        browser.close()
