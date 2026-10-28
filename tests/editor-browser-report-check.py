"""Require every editor acceptance case for each requested browser engine."""
import json
import os
from pathlib import Path


EXPECTED = {
    'report.json': ['desktop', 'mobile', 'scan', 'english'],
    'quality-report.json': [
        'controls', 'controls-small', 'public-mixed', 'latex-invoice',
        'historical-scan', 'column-scan', 'rotated-scan', 'form-guard',
    ],
    'workflow-report.json': [
        'workflow-text', 'workflow-touch', 'workflow-flow', 'workflow-images',
        'workflow-french', 'workflow-ocr-focus', 'workflow-ocr-focus-touch',
    ],
    'adaptive-report.json': [
        'adaptive-flow', 'adaptive-table', 'adaptive-table-touch', 'adaptive-form',
        'adaptive-angle', 'adaptive-nested', 'adaptive-repair', 'adaptive-cff',
        'adaptive-high-scan', 'adaptive-preflight',
        'adaptive-payroll', 'adaptive-payroll-touch',
    ],
}


def verify(folder, engines):
    total = 0
    for filename, suffixes in EXPECTED.items():
        report = json.loads((folder / filename).read_text(encoding='utf8'))
        results = report['results']
        expected = {f'{engine}-{suffix}' for engine in engines for suffix in suffixes}
        if filename=='adaptive-report.json' and 'webkit' in engines:
            expected.add('webkit-adaptive-high-scan-bitmap-loss')
        names = [result['case'] for result in results]
        if len(names) != len(set(names)) or set(names) != expected:
            raise ValueError(f'{filename}: missing, unexpected or duplicate cases: {names}')
        failed = [result['case'] for result in results if result.get('status') != 'passed']
        if failed:
            raise ValueError(f'{filename}: unsuccessful cases: {failed}')
        total += len(results)
    return total


if __name__ == '__main__':
    engines = os.environ.get('MOINPDF_TEST_BROWSERS', 'chromium,firefox,webkit').split(',')
    if not engines or any(engine not in ('chromium', 'firefox', 'webkit') for engine in engines):
        raise ValueError('Select Chromium, Firefox or WebKit')
    folder = Path(os.environ.get('MOINPDF_BROWSER_OUTPUT', '.cache/editor-browser'))
    total = verify(folder, engines)
    print(f'PASS: all {total} required editor browser cases completed successfully.')
