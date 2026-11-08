"""Prime verified MiniSBD models before LibreTranslate's long retry loop."""
import hashlib
import json
import os
import tempfile
import urllib.error
import urllib.request
from pathlib import Path


def download(name, spec):
    urls = [spec['url'], spec['fallback_url']]
    for index, url in enumerate(urls):
        request = urllib.request.Request(url, headers={
            'User-Agent': 'MoinPDF-build/1', 'Accept': 'application/octet-stream',
        })
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read(spec['size'] + 1)
        except (urllib.error.URLError, TimeoutError) as error:
            transient = not isinstance(error, urllib.error.HTTPError) or error.code in {
                408, 429, 500, 502, 503, 504,
            }
            if not transient or index == len(urls) - 1:
                raise
            print(f'Temporary MiniSBD download failure for {name}; trying its pinned upstream asset.', flush=True)
            continue
        if len(data) != spec['size'] or hashlib.sha256(data).hexdigest() != spec['sha256']:
            raise ValueError(f'SHA-256 or size mismatch: MiniSBD {name}')
        return data
    raise RuntimeError(f'No download source: MiniSBD {name}')


def ensure_sentence_models(languages, cache, models=None):
    if models is None:
        models = json.loads(Path(__file__).with_name('sentence-models.lock.json').read_text())['models']
    cache = Path(cache)
    for name in sorted(set(languages) & set(models)):
        spec = models[name]
        target = cache / (name + '.onnx')
        if target.is_file() and target.stat().st_size == spec['size']:
            if hashlib.sha256(target.read_bytes()).hexdigest() == spec['sha256']:
                continue
        data = download(name, spec)
        cache.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=cache, prefix=name + '-', suffix='.tmp', delete=False) as output:
                temporary = Path(output.name)
                output.write(data)
            os.replace(temporary, target)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        print(f'Verified MiniSBD model ready: {name}', flush=True)
