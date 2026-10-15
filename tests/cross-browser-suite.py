"""Run every selected suite, retaining independent failures and evidence."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

out = Path('cross-browser-evidence')
out.mkdir(exist_ok=True)
suites = ['published-web-smoke.py', 'language-smoke.py',
          'documentation-smoke.py', 'harbor-layout-browser.py',
          'native-editor-browser.py', 'xfa-browser.py', 'browser-office-browser.py']
results = []
for name in suites:
    folder = out / name.removesuffix('.py')
    folder.mkdir(exist_ok=True)
    started = time.monotonic()
    print('START: ' + name, flush=True)
    try:
        with (folder / 'run.log').open('w') as log:
            result = subprocess.run([sys.executable, 'tests/' + name],
                                    stdout=log, stderr=subprocess.STDOUT, timeout=1200)
        code = result.returncode
    except subprocess.TimeoutExpired:
        code = 124
    for evidence in ('web-evidence', 'documentation-evidence'):
        if Path(evidence).exists():
            shutil.move(evidence, folder / evidence)
    results.append({'suite': name, 'exitCode': code,
                    'seconds': round(time.monotonic() - started, 1)})
    (out / 'results.json').write_text(json.dumps(results, indent=2))
    print(('PASS: ' if code == 0 else 'FAIL: ') + name, flush=True)
    if code:
        print((folder / 'run.log').read_text()[-12000:], flush=True)
print(json.dumps(results, indent=2), flush=True)
sys.exit(1 if any(result['exitCode'] for result in results) else 0)
