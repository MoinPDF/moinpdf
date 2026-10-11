"""Fetch tiny upstream regression fixtures with Git blob integrity checks, before offline tests."""
import hashlib
from pathlib import Path
import urllib.request

COMMIT = '31277556d122f217825b1e25477db9ffda976ab1'
FIXTURES = [
    ('draw/libmspub/pass/fdo59355-1.pub', '607a07ae2d362e4a1f6e779dfff88726fe74f910'),
    ('draw/libvisio/pass/fdo57117-1.vsd', '3d7387766755c6304f04d1d2ebd576a099c221f0'),
    ('draw/libvisio/pass/Visio2013drawing.vsdx', 'bc6fa2cb7b0be9295736eb893b18c534ab9c73ad'),
    ('writer/libetonyek/pass/Pages_4.pages', '43c9213922bd26f9242ae93ed6a5aabcc85df11f'),
    ('writer/libetonyek/pass/Pages_5.pages', 'cd4438a34b451518a8547a8670fc96154255ace8'),
]
directory = Path('.cache/office-fixtures')
directory.mkdir(parents=True, exist_ok=True)
for relative, digest in FIXTURES:
    target = directory / Path(relative).name
    if not target.exists():
        url = f'https://raw.githubusercontent.com/LibreOffice/core/{COMMIT}/writerperfect/qa/unit/data/{relative}'
        with urllib.request.urlopen(url, timeout=40) as response:
            data = response.read(2*1024*1024)
        target.write_bytes(data)
    data = target.read_bytes()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest() == digest, target.name
    print('Verified Office fixture:', target.name)
