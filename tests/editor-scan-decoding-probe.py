"""A/B diagnosis around the unchanged production high-scan acceptance case."""
import json
import os
import runpy
import sys
from pathlib import Path
from playwright.sync_api import Browser

profile = os.environ.get('MOINPDF_SCAN_PROBE_PROFILE', 'default')
assert profile in ('default', 'raw-pixels', 'bounded-canvas')
out = Path(os.environ['MOINPDF_BROWSER_OUTPUT'])
out.mkdir(parents=True, exist_ok=True)
messages = []
original = Browser.new_context
script = r'''(() => {
    const profile = PROFILE;
    const send = Worker.prototype.postMessage;
    const observed = new WeakSet();
    Worker.prototype.postMessage = function(message, ...rest) {
        if (message?.action === 'GetDocRequest' && message.data?.evaluatorOptions) {
            const options = message.data.evaluatorOptions;
            if (profile === 'raw-pixels') options.isOffscreenCanvasSupported = false;
            if (profile === 'bounded-canvas') options.canvasMaxAreaInBytes = 64 * 1024 * 1024;
            console.info('scan-decoding-options', JSON.stringify({profile,
                offscreen: options.isOffscreenCanvasSupported,
                limit: options.canvasMaxAreaInBytes}));
            if (!observed.has(this)) {
                observed.add(this);
                this.addEventListener('message', event => {
                    const payload = event.data?.data;
                    if (event.data?.action !== 'obj' || !Array.isArray(payload) || payload[2] !== 'Image') return;
                    const image = payload[3];
                    if (!image || image.width < 2000) return;
                    console.info('scan-decoding-image', JSON.stringify({width: image.width, height: image.height,
                        bitmapWidth: image.bitmap?.width, bitmapHeight: image.bitmap?.height,
                        bytes: image.data?.byteLength}));
                });
            }
        }
        return Reflect.apply(send, this, [message, ...rest]);
    };
})();'''.replace('PROFILE', json.dumps(profile))

def new_context(self, *args, **kwargs):
    context = original(self, *args, **kwargs)
    context.add_init_script(script)
    context.on('page', lambda page: page.on('console', lambda message: messages.append(message.text)
               if message.text.startswith('scan-decoding-') else None))
    return context

Browser.new_context = new_context
status = 0
try:
    sys.path.insert(0, str(Path('tests').resolve()))
    runpy.run_path('tests/editor-adaptive-browser.py', run_name='__main__')
except SystemExit as error:
    status = int(error.code or 0)
finally:
    Browser.new_context = original
    (out / 'decoder-messages.json').write_text(json.dumps(messages, indent=2), encoding='utf8')
    print('\n'.join(messages), flush=True)
if not any(message.startswith('scan-decoding-options') for message in messages):
    raise RuntimeError('The production PDF worker was not observed; diagnosis is inconclusive.')
raise SystemExit(status)
