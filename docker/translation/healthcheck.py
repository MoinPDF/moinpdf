"""A listening process is not enough: all offered language pairs must be ready."""
import json
import os
import urllib.request

required = set(os.environ['LT_LOAD_ONLY'].split(','))
with urllib.request.urlopen('http://127.0.0.1:5000/languages', timeout=4) as response:
    languages = json.load(response)
available = {item['code']: set(item['targets']) for item in languages}
if not all(code in available and required <= available[code] for code in required):
    raise SystemExit('Nicht alle angebotenen Sprachen sind bereit.')
