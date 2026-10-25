"""Real form exports and renderer-stall recovery. Fictional fixtures only.

Fault injection is explicitly reported; it is not a claim to reproduce a browser
vendor's internal failure. Run against the actual production application.
"""
import atexit
import json
import os
import re
import subprocess
import time
import traceback
from pathlib import Path
from urllib.request import urlopen

import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.environ.get('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path(os.environ.get('MOINPDF_BROWSER_OUTPUT', '.cache/editor-browser')) / 'verification'
out.mkdir(parents=True, exist_ok=True)
fixture = Path('.cache/editor-browser/adaptive/form.pdf').resolve()
baseline = os.environ.get('MOINPDF_VERIFY_BASELINE') == '1'
repeats = int(os.environ.get('MOINPDF_VERIFY_REPEATS', '5'))
if os.environ.get('MOINPDF_TEST_START_SERVER') == '1':
    log = open(out / 'http.log', 'w')
    server = subprocess.Popen(['python', 'tests/text-browser-server.py'], stdout=log, stderr=subprocess.STDOUT)
    atexit.register(lambda: (server.terminate(), server.wait(timeout=10), log.close()))
    for _ in range(100):
        try:
            if urlopen(origin, timeout=1).status == 200:
                break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Production test server did not start')

INSTRUMENT = r"""(() => {
  const events = window.verificationEvents = [];
  const record = (event, data = {}) => {
    events.push({at: Math.round(performance.now()), event, ...data});
    if (events.length > 300) events.shift();
  };
  let sequence = 0;
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args); this.probeId = ++sequence; this.probeClosed = false;
      record('worker-created', {id: this.probeId, url: String(args[0])});
      this.addEventListener('message', ({data}) => record('worker-reply', {
        id: this.probeId, action: data?.action, callback: data?.callbackId,
        stream: data?.streamId, kind: data?.stream || data?.callback,
      }));
      this.addEventListener('error', e => record('worker-error', {id: this.probeId, message: e.message}));
    }
    postMessage(...args) {
      const data = args[0];
      record('worker-request', {id: this.probeId, action: data?.action,
        callback: data?.callbackId, stream: data?.streamId, kind: data?.stream});
      const checking = document.body?.textContent.includes('Gespeicherte PDF prüfen');
      if (window.holdVerificationWorker && checking && data?.action === 'GetOperatorList' &&
          (window.holdVerificationWorker !== 'once' || !window.heldVerificationOwner || window.heldVerificationOwner === this.probeId)) {
        window.heldVerificationOwner ||= this.probeId;
        (window.verificationHeldWorkers ||= new Set()).add(this.probeId);
        window.heldVerificationMessages ||= [];
        window.heldVerificationMessages.push(() => {
          if (!this.probeClosed) super.postMessage(...args);
        });
        record('worker-request-held', {id: this.probeId, action: data.action});
        return;
      }
      return super.postMessage(...args);
    }
    terminate() {(window.verificationClosedWorkers ||= new Set()).add(this.probeId); this.probeClosed = true; record('worker-terminated', {id: this.probeId}); return super.terminate();}
  };
  const font = Object.getOwnPropertyDescriptor(FontFace.prototype, 'loaded');
  Object.defineProperty(FontFace.prototype, 'loaded', {...font, get() {
    const promise = font.get.call(this);
    if (window.holdVerificationFonts && document.body?.textContent.includes('Gespeicherte PDF prüfen')) {
      window.heldVerificationFonts = (window.heldVerificationFonts || 0) + 1;
      record('font-held', {family: this.family});
      return new Promise(() => {});
    }
    record('font-wait', {family: this.family});
    promise.then(() => record('font-ready', {family: this.family}), () => record('font-error', {family: this.family}));
    return promise;
  }});
  window.releaseVerificationWorker = () => {
    window.holdVerificationWorker = false;
    window.holdVerificationFonts = false;
    (window.heldVerificationMessages || []).splice(0).forEach(release => release());
  };
})();"""


def prepare(page):
    page.goto(origin)
    page.locator('input[type=file]').first.set_input_files(str(fixture))
    page.locator('.chooser-tool').filter(has=page.get_by_text('PDF bearbeiten', exact=True)).click()
    button = page.get_by_role('button', name='Text bearbeiten: Original heading', exact=True)
    expect(button).to_be_visible(timeout=120000)
    button.click()
    page.get_by_label('Text direkt in der PDF bearbeiten', exact=True).fill('Edited heading')


def verify_download(page, name):
    link = page.get_by_role('link', name='PDF herunterladen', exact=True).first
    expect(link.or_(page.locator('.error-box'))).to_be_visible(timeout=180000)
    assert link.is_visible(), page.locator('.error-box').inner_text()
    expect(link).to_have_attribute('href', re.compile(r'^blob:'), timeout=45000)
    with page.expect_download() as download:
        link.click()
    path = out / (name + '.pdf')
    download.value.save_as(path)
    with pymupdf.open(path) as after, pymupdf.open(fixture) as before:
        assert len(after) == 2
        assert 'Edited heading' in after[0].get_text() and 'Original heading' not in after[0].get_text()
        fields = lambda doc: [(w.field_name, w.field_value, tuple(w.rect)) for p in doc for w in p.widgets()]
        assert fields(after) == fields(before) and len(fields(after)) == 3
        a, b = before[1].get_pixmap(), after[1].get_pixmap()
        assert (a.width, a.height, a.samples) == (b.width, b.height, b.samples)
    return page.get_by_role('region', name='Exportprüfung und Vergleich').inner_text()


results = []
with sync_playwright() as api:
    for engine in os.environ.get('MOINPDF_TEST_BROWSERS', 'webkit').split(','):
        browser = getattr(api, engine).launch()
        cases = [f'form-{i + 1:02}' for i in range(repeats)] + (['worker-cancel'] if baseline else ['worker-cancel', 'worker-retry', 'worker-timeout', 'font-retry'])
        for case in cases:
            fault = not case.startswith('form-')
            name = f'{engine}-verification-' + case
            context = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
            context.add_init_script(INSTRUMENT)
            context.tracing.start(screenshots=True, snapshots=True, sources=True)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            result = {'case': name, 'engine': browser.version, 'fault_injection': fault}
            started = time.monotonic()
            print('START: ' + name, flush=True)
            try:
                prepare(page)
                if fault:
                    page.evaluate('mode => {if(mode === "font-retry") window.holdVerificationFonts = true; else window.holdVerificationWorker = mode === "worker-retry" ? "once" : "all";}', case)
                page.get_by_role('button', name='Bearbeitete PDF erstellen', exact=True).click()
                if case == 'worker-cancel':
                    page.wait_for_function('window.heldVerificationMessages?.length > 0', timeout=60000)
                    page.get_by_role('button', name='Abbrechen', exact=True).last.click()
                    idle = page.get_by_role('button', name='Bearbeitete PDF erstellen', exact=True)
                    if baseline:
                        time.sleep(3)
                        assert page.get_by_role('button', name='Abbrechen', exact=True).count(), 'Expected baseline cancellation stall was not reproduced'
                        result['reproduced'] = 'Unanswered GetOperatorList keeps cancellation pending'
                        page.evaluate('window.releaseVerificationWorker()')
                        expect(idle).to_be_enabled(timeout=15000)
                    else:
                        expect(idle).to_be_enabled(timeout=5000)
                        assert not page.get_by_role('link', name='PDF herunterladen', exact=True).count(), 'Cancelled output must never become downloadable'
                        page.evaluate('window.releaseVerificationWorker()')
                        idle.click()
                        result['verification'] = verify_download(page, name)
                elif case == 'worker-timeout':
                    expect(page.locator('.error-box')).to_contain_text('Die PDF-Prüfung hat zu lange gedauert.', timeout=160000)
                    assert not page.get_by_role('link', name='PDF herunterladen', exact=True).count(), 'Unverified output must stay unavailable'
                    result['timeout_seconds'] = round(time.monotonic() - started, 2)
                    page.evaluate('window.releaseVerificationWorker()')
                    page.get_by_role('button', name='Bearbeitete PDF erstellen', exact=True).click()
                    result['verification'] = verify_download(page, name)
                else:
                    result['verification'] = verify_download(page, name)
                    if case == 'font-retry':
                        assert page.evaluate('window.heldVerificationFonts > 0'), 'Font fault must actually be injected'
                    if case == 'worker-retry':
                        assert page.evaluate('window.heldVerificationMessages.length > 0'), 'Worker fault must actually be injected'
                if fault and not baseline:
                    held = page.evaluate('[...(window.verificationHeldWorkers || [])]')
                    closed = page.evaluate('[...(window.verificationClosedWorkers || [])]')
                    assert set(held).issubset(set(closed)), 'Every stalled temporary worker must be terminated'
                assert not errors, errors
                result['status'] = 'passed'
            except Exception as error:
                result.update(status='failed', error=str(error), traceback=traceback.format_exc(), page_errors=errors)
                try:
                    result['page'] = page.locator('body').inner_text(timeout=5000)
                    page.screenshot(path=str(out / (name + '.png')), full_page=True, timeout=10000)
                except Exception:
                    pass
            finally:
                result['seconds'] = round(time.monotonic() - started, 2)
                try:
                    result['events'] = page.evaluate('window.verificationEvents')
                except Exception:
                    pass
                if result['status'] == 'failed':
                    context.tracing.stop(path=str(out / (name + '-trace.zip')))
                else:
                    context.tracing.stop()
                results.append(result)
                (out / 'report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
                context.close()
                print(json.dumps({k: result[k] for k in ('case', 'status', 'seconds', 'reproduced', 'error') if k in result}), flush=True)
            if result['status'] == 'failed':
                break
        browser.close()
expected = len(os.environ.get('MOINPDF_TEST_BROWSERS', 'webkit').split(',')) * (repeats + (1 if baseline else 4))
assert len(results) == expected and len({r['case'] for r in results}) == expected and all(r['status'] == 'passed' for r in results), 'Verification acceptance failed or incomplete'
