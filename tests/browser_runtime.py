"""Select the real Playwright engine without changing acceptance assertions."""
import json
import os
from pathlib import Path


def launch_browser(api):
    name = os.environ.get('MOINPDF_BROWSER', 'chromium')
    if name not in ('chromium', 'firefox', 'webkit'):
        raise ValueError('Unsupported MOINPDF_BROWSER: ' + name)
    browser = getattr(api, name).launch()
    details = {'engine': name, 'version': browser.version,
               'source': os.environ.get('GITHUB_SHA'),
               'nativeSafari': False}
    folder = Path('cross-browser-evidence')
    folder.mkdir(exist_ok=True)
    (folder / 'browser-version.json').write_text(json.dumps(details, indent=2))
    print('BROWSER: ' + json.dumps(details), flush=True)
    return browser
