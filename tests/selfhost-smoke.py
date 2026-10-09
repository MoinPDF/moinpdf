"""Run inside the documents service: exercise the real HTTP proxy and translator."""
import json
import io
import os
import re
import wave
from pathlib import Path

import pymupdf
import requests

base = os.getenv('MOINPDF_TEST_URL', 'http://app:8080')
session = requests.Session()
session.trust_env = False
if os.getenv('MOINPDF_TEST_COOKIES'):
    for cookie in json.loads(Path(os.environ['MOINPDF_TEST_COOKIES']).read_text()):
        session.cookies.set(cookie['name'], cookie['value'], domain='localhost.local' if cookie['domain'] == 'localhost' else cookie['domain'], path=cookie['path'])
if os.getenv('MOINPDF_TEST_PASSWORD'):
    session.auth = (os.getenv('MOINPDF_TEST_USERNAME', 'moinpdf'), os.environ['MOINPDF_TEST_PASSWORD'])
home = session.get(base + '/', timeout=10)
home.raise_for_status()
assert 'id="root"' in home.text and '/assets/' in home.text
repo = Path(os.getenv('MOINPDF_TEST_REPO', '/repo'))
version = json.loads((repo / 'package.json').read_text())['version']
media = session.get(base + '/medienbereich.html', timeout=10)
media.raise_for_status()
assert f'MoinPDF v{version}' in media.text, 'Docker media page is older than the release'
assert 'media-hero-note' not in media.text
assert 'no-cache' in media.headers.get('cache-control', '')
video_path = re.search(r'<source src="([^\"]+)" type="video/mp4"', media.text).group(1)
for path in ('/favicon.png', '/favicon.ico', '/apple-touch-icon.png', video_path):
    asset = session.get(base + path, timeout=30)
    asset.raise_for_status()
    assert asset.content == (repo / 'public' / path.lstrip('/')).read_bytes(), path
    if not path.endswith('.mp4'):
        assert 'no-cache' in asset.headers.get('cache-control', ''), path
assert '/favicon.png?v=' in home.text and '/favicon.png?v=' in media.text
video_range = session.get(base + video_path, headers={'Range': 'bytes=0-31'}, timeout=10)
assert video_range.status_code == 206 and len(video_range.content) == 32
assert video_range.content[4:8] == b'ftyp'
assert video_range.headers['content-type'].startswith('video/mp4')
for path in ['/vendor/pdf/pdf.worker.min.mjs', '/vendor/ocr/worker.min.js',
             '/vendor/languages/deu.traineddata.gz', '/vendor/languages/eng.traineddata.gz',
             '/vendor/qpdf/qpdf.wasm', '/vendor/invoice-font/NotoSans-Regular.ttf']:
    response = session.get(base + path, timeout=30)
    response.raise_for_status()
    assert len(response.content) > 1000, path

api = base + '/api/documents'
assert session.get(api + '/v1/capabilities', timeout=10).status_code == 403
assert session.options(api + '/v1/office', headers={'Origin': 'https://foreign.example',
    'Access-Control-Request-Headers': 'X-MoinPDF-Client'}, timeout=10).status_code == 403
session.headers['X-MoinPDF-Client'] = 'web'
capabilities = session.get(api + '/v1/capabilities', timeout=10)
capabilities.raise_for_status()
features = capabilities.json()['capabilities']
assert features and all(features.values()), features
assert session.get(api + '/v1/capabilities', headers={'Sec-Fetch-Site': 'cross-site'}, timeout=10).status_code == 403
# A supplied credential never replaces the internal proxy credential.
assert session.get(api + '/v1/capabilities', headers={'Authorization': 'Bearer invalid'}, timeout=10).status_code == 200
assert session.get(base + '/v1/capabilities', timeout=10).status_code == 404

pdf = pymupdf.open()
page = pdf.new_page()
page.insert_text((50, 60), 'Guten Morgen. Das ist ein Test. Vielen Dank.', fontsize=14)
content = pdf.tobytes()
pdf.close()
result = session.post(api + '/v1/documents/translate',
    files={'file': ('test.pdf', content, 'application/pdf')},
    data={'options': json.dumps({'language': 'de', 'target': 'en'})}, timeout=200)
result.raise_for_status()
with pymupdf.open(stream=result.content, filetype='pdf') as document:
    text = ''.join(page.get_text() for page in document)
    assert 'Guten Morgen' in text, text
    assert 'good morning' in text.lower() and 'thank' in text.lower(), text

office = Path(os.getenv('MOINPDF_TEST_REPO', '/repo')) / 'tests/fixtures/office/sample.docx'
with office.open('rb') as source:
    result = session.post(api + '/v1/office', files={'file': ('sample.docx', source)}, timeout=200)
result.raise_for_status()
assert result.content.startswith(b'%PDF-'), result.content[:80]
assert 'content-disposition' in result.headers
assert result.headers['cache-control'] == 'no-store'

audio = session.post(api + '/v1/audio', data={'request': json.dumps({
    'voice': 'thorsten', 'speed': 1, 'sections': [{'title': 'Stimmprobe', 'text': 'Moin! Die lokale Sprachausgabe funktioniert.'}]
})}, timeout=200)
audio.raise_for_status()
assert audio.headers['content-type'].startswith('audio/wav')
assert audio.headers['cache-control'] == 'no-store'
with wave.open(io.BytesIO(audio.content), 'rb') as wav:
    assert wav.getframerate() == 22050 and wav.getnchannels() == 1
    assert wav.getnframes() > 22050
print('PASS: app, local assets, all server capabilities, request isolation, real German/English PDF translation, Office conversion and local speech through the authenticated HTTP proxy.')
