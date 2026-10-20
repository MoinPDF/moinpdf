"""Fetch immutable public test samples; never part of the deployed application."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

manifest = json.loads(Path('tests/editor-public-corpus.json').read_text())
folder = Path('.cache/editor-corpus')
folder.mkdir(parents=True, exist_ok=True)
for fixture in manifest['fixtures']:
    path = folder / fixture['name']
    data = path.read_bytes() if path.exists() else urlopen(fixture['url'], timeout=60).read()
    assert len(data) == fixture['size'], fixture['name'] + ': size differs'
    assert hashlib.sha256(data).hexdigest() == fixture['sha256'], fixture['name'] + ': hash differs'
    path.write_bytes(data)
    print('Verified:', fixture['name'])
(folder / 'ATTRIBUTION.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
