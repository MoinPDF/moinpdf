"""Isolate PDF.js scan decoding without changing application or acceptance tests."""
import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path.cwd()
out = root / '.cache' / 'scan-decoding'
out.mkdir(parents=True, exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(root)))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
origin = f'http://127.0.0.1:{server.server_port}'
probe = r'''async (options) => {
    const pdfjs = await import('/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({url: '/.cache/scan-decoding/high-scan.pdf', ...options});
    const result = {options, pdfjs: pdfjs.version};
    const sample = image => {
        const canvas = document.createElement('canvas');
        canvas.width = 160; canvas.height = 224;
        try {
            const context = canvas.getContext('2d');
            context.fillStyle = '#fff'; context.fillRect(0, 0, 160, 224);
            context.drawImage(image, 0, 0, 160, 224);
            const pixels = context.getImageData(0, 0, 160, 224).data;
            let dark = 0, nonWhite = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                const value = Math.min(pixels[i], pixels[i+1], pixels[i+2]);
                if (value < 180) dark++;
                if (value < 250) nonWhite++;
            }
            return {dark, nonWhite, topLeft: Array.from(pixels.slice(0, 4))};
        } finally { canvas.width = canvas.height = 0; }
    };
    try {
        const doc = await task.promise;
        const page = await doc.getPage(1);
        const render = async side => {
            const viewport = page.getViewport({scale: side / 700});
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
            try {
                await page.render({canvas, viewport, background: 'rgb(255,255,255)'}).promise;
                return {side, ...sample(canvas)};
            } finally { canvas.width = canvas.height = 0; }
        };
        // The editor preview and OCR inspect the same PDF page concurrently.
        result.renders = await Promise.all([render(1400), render(2600)]);
        const ops = await page.getOperatorList();
        result.images = [];
        for (let i = 0; i < ops.fnArray.length; i++) {
            if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
            const id = ops.argsArray[i][0];
            const objects = id.startsWith('g_') ? page.commonObjs : page.objs;
            const image = await new Promise(resolve => objects.get(id, resolve));
            result.images.push(image ? {
                width: image.width, height: image.height,
                bitmapWidth: image.bitmap?.width, bitmapHeight: image.bitmap?.height,
                byteLength: image.data?.byteLength,
                pixels: image.bitmap ? sample(image.bitmap) : null,
            } : null);
        }
        return result;
    } finally { await task.destroy(); }
}'''

report = []
variants = [
    ('default', {}),
    ('raw-pixels', {'isOffscreenCanvasSupported': False}),
    ('bounded-canvas', {'canvasMaxAreaInBytes': 64 * 1024 * 1024}),
]
try:
    with sync_playwright() as api:
        for engine in os.environ.get('MOINPDF_TEST_BROWSERS', 'webkit').split(','):
            for name, options in variants:
                for repeat in range(3):
                    browser = getattr(api, engine).launch()
                    entry = {'browser': engine, 'version': browser.version, 'variant': name, 'repeat': repeat + 1}
                    try:
                        page = browser.new_page(viewport={'width': 390, 'height': 1000}, has_touch=True)
                        page.goto(origin)
                        entry.update(page.evaluate(probe, options))
                        entry['readable'] = all(item['dark'] > 40 for item in entry['renders'])
                    except Exception as error:
                        entry['error'] = str(error)
                        entry['readable'] = False
                    finally:
                        browser.close()
                    report.append(entry)
                    print(json.dumps(entry), flush=True)
                    (out / f'{engine}-report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    assert all(item['readable'] for item in report if item['variant'] == 'raw-pixels'), report
finally:
    server.shutdown()
    server.server_close()
