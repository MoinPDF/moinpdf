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
with sync_playwright() as api:
    browser = api.chromium.launch()
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
    results, failures = [], []
    try:
        for mode in ('explicit-parent', 'self-close', 'parent-only'):
            for cycle in range(200):
                started = time.monotonic()
                page.evaluate('mode => runCycle(mode)', mode)
                while True:
                    targets = [t for t in session.send('Target.getTargets')['targetInfos']
                               if t['type'] == 'worker' and origin in t['url']]
                    if not targets:
                        break
                    if time.monotonic() - started > 10:
                        failures.append({'mode': mode, 'cycle': cycle, 'targets': targets})
                        print('FAIL: ' + json.dumps(failures[-1]), flush=True)
                        # Preserve the failure, then isolate the next control group.
                        page.goto(origin)
                        break
                    page.wait_for_timeout(10)
                results.append({'mode': mode, 'cycle': cycle, 'seconds': time.monotonic() - started})
                if (cycle + 1) % 50 == 0:
                    print(f'{mode}: {cycle + 1} cycles; failures={len(failures)}', flush=True)
                if failures and failures[-1]['mode'] == mode:
                    break
    finally:
        (evidence / 'nested-worker-control.json').write_text(json.dumps({
            'browser': browser.version, 'results': results, 'failures': failures}, indent=2))
        browser.close()
    assert not failures, failures
    print('PASS: 600 independent nested-worker shutdown cycles.', flush=True)
