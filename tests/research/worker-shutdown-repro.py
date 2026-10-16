"""Browser-only control for the Office owner/eight-child shutdown sequence.

No MoinPDF code or LibreOffice runtime is used. A failure here establishes a
browser/test-infrastructure problem independently of document conversion.
"""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

origin = 'https://worker-lifecycle.test'
evidence = Path('web-evidence')
evidence.mkdir(exist_ok=True)
child = """
onmessage = ({data}) => {
  postMessage('ready');
  if (data.block) Atomics.wait(new Int32Array(data.memory), 0, 0);
};
"""
owner = """
let children = [], mode;
onmessage = ({data}) => {
  if (data.type === 'init') {
    mode = data.mode;
    const memory = new SharedArrayBuffer(16 * 1024 * 1024);
    let ready = 0;
    for (let i = 0; i < 8; i++) {
      const worker = new Worker('/child.js');
      children.push(worker);
      worker.onmessage = () => { if (++ready === 8) postMessage('result'); };
      worker.postMessage({memory, block: i < 4});
    }
  } else if (data.type === 'destroy') {
    if (mode !== 'parent-only') children.forEach(worker => worker.terminate());
    postMessage('destroyed');
    if (mode === 'self-close') close();
    else setTimeout(() => close(), 100);
  }
};
"""
html = """<!doctype html><title>Nested worker shutdown control</title><script>
window.runCycle = mode => new Promise((resolve, reject) => {
  const worker = new Worker('/owner.js');
  const timer = setTimeout(() => { worker.terminate(); reject(new Error('Control timed out')); }, 10000);
  worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); };
  worker.onmessage = ({data}) => {
    if (data === 'result') worker.postMessage({type: 'destroy'});
    if (data === 'destroyed') {
      if (mode !== 'self-close') worker.terminate();
      clearTimeout(timer);
      resolve();
    }
  };
  worker.postMessage({type: 'init', mode});
});
</script>"""
def native_threads(session):
    threads = []
    for process in session.send('SystemInfo.getProcessInfo')['processInfo']:
        pid = int(process['id'])
        for name in Path(f'/proc/{pid}/task').glob('*/comm'):
            try:
                threads.append({'pid': pid, 'type': process['type'], 'tid': int(name.parent.name), 'name': name.read_text().strip()})
            except (OSError, ValueError):
                pass
    return threads


def probe(session, page, targets):
    responses, sessions = [], []
    def received(event):
        message = json.loads(event['message'])
        if message.get('id') in (901, 902):
            responses.append({'session': event['sessionId'], 'message': message})
    session.on('Target.receivedMessageFromTarget', received)
    before = native_threads(session)
    try:
        for target in targets:
            try:
                sid = session.send('Target.attachToTarget', {'targetId': target['targetId'], 'flatten': False})['sessionId']
                sessions.append(sid)
                for ident, method, params in ((901, 'Runtime.getHeapUsage', {}), (902, 'Runtime.evaluate', {'expression': '1+1', 'returnByValue': True, 'timeout': 1000})):
                    session.send('Target.sendMessageToTarget', {'sessionId': sid, 'message': json.dumps({'id': ident, 'method': method, 'params': params})})
            except Exception as error:
                responses.append({'target': target['targetId'], 'error': str(error)})
        page.wait_for_timeout(2000)
    finally:
        for sid in sessions:
            try:
                session.send('Target.detachFromTarget', {'sessionId': sid})
            except Exception:
                pass
        session.remove_listener('Target.receivedMessageFromTarget', received)
    return {'responses': responses, 'threadsBeforeProbe': before, 'threadsAfterProbe': native_threads(session)}


with sync_playwright() as api:
    results, failures, baselines = [], [], []
    for mode in ('explicit-parent', 'self-close', 'parent-only'):
        # A fresh browser prevents one surviving target from contaminating another mode.
        browser = api.chromium.launch()
        version = browser.version
        session = browser.new_browser_cdp_session()
        page = browser.new_page()
        def route(request):
            path = request.request.url.removeprefix(origin)
            body = owner if path == '/owner.js' else child if path == '/child.js' else html
            request.fulfill(body=body, headers={
                'Content-Type': 'text/html' if path == '/' else 'application/javascript',
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
            })
        page.route(origin + '/**', route)
        page.goto(origin)
        assert page.evaluate('crossOriginIsolated')
        baselines.append({'mode': mode, 'threads': native_threads(session)})
        try:
            for cycle in range(200):
                started = time.monotonic()
                page.evaluate('mode => runCycle(mode)', mode)
                while True:
                    targets = [t for t in session.send('Target.getTargets')['targetInfos']
                               if t['type'] == 'worker' and origin in t['url']]
                    if not targets:
                        break
                    if time.monotonic() - started > 10:
                        failure = {'mode': mode, 'cycle': cycle, 'targets': targets, 'diagnosis': probe(session, page, targets)}
                        failures.append(failure)
                        print('FAIL: ' + json.dumps(failure), flush=True)
                        break
                    page.wait_for_timeout(10)
                results.append({'mode': mode, 'cycle': cycle, 'seconds': time.monotonic() - started})
                if (cycle + 1) % 50 == 0:
                    print(f'{mode}: {cycle + 1} cycles; failures={len(failures)}', flush=True)
                if failures and failures[-1]['mode'] == mode:
                    break
        finally:
            browser.close()
            (evidence / 'nested-worker-control.json').write_text(json.dumps({
                'browser': version, 'results': results, 'failures': failures, 'baselines': baselines}, indent=2))
    assert not failures, failures
    print('PASS: 600 independent nested-worker shutdown cycles.', flush=True)
