"""Sign through the production UI/ESM worker; independently verify the download."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.environ['MOINPDF_TEST_URL']
evidence = Path('web-evidence')
evidence.mkdir(exist_ok=True)


def openssl(*arguments):
    return subprocess.run(['openssl', *map(str, arguments)], check=True, capture_output=True)


def verify_signature(pdf, directory):
    match = re.search(rb'/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]', pdf)
    assert match, 'Downloaded PDF must contain a signature ByteRange'
    start, first, second, length = map(int, match.groups())
    assert start == 0 and second + length == len(pdf)
    signed = pdf[:first] + pdf[second:]
    cms = bytes.fromhex(pdf[first + 1:second - 1].decode('ascii'))
    (directory / 'data.bin').write_bytes(signed)
    (directory / 'cms.der').write_bytes(cms)
    # The fictional certificate is self-signed: check CMS integrity, not trust.
    openssl('cms', '-verify', '-binary', '-inform', 'DER', '-in', directory / 'cms.der',
            '-content', directory / 'data.bin', '-noverify', '-out', directory / 'verified.bin')
    assert (directory / 'verified.bin').read_bytes() == signed
    changed = bytearray(signed)
    changed[100] ^= 1
    (directory / 'data.bin').write_bytes(changed)
    rejected = subprocess.run(['openssl', 'cms', '-verify', '-binary', '-inform', 'DER',
                               '-in', str(directory / 'cms.der'), '-content', str(directory / 'data.bin'),
                               '-noverify', '-out', str(directory / 'tampered.bin')], capture_output=True)
    assert rejected.returncode != 0, 'Modified signed content must fail independent verification'


with tempfile.TemporaryDirectory() as temporary, sync_playwright() as api:
    directory = Path(temporary)
    key, cert, identity = [directory / name for name in ['key.pem', 'certificate.pem', 'identity.p12']]
    openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
            '-days', '2', '-subj', '/CN=MoinPDF fictional browser test', '-addext', 'keyUsage=digitalSignature')
    openssl('pkcs12', '-export', '-inkey', key, '-in', cert, '-out', identity,
            '-passout', 'pass:synthetic-test-only')
    source = directory / 'original.pdf'
    with pymupdf.open() as document:
        page = document.new_page()
        page.insert_text((40, 60), 'MoinPDF fictional signature browser fixture')
        field = pymupdf.Widget()
        field.field_name, field.field_type, field.field_value = 'preserved', pymupdf.PDF_WIDGET_TYPE_TEXT, 'KEEP'
        field.rect = pymupdf.Rect(40, 90, 220, 120)
        page.add_widget(field)
        document.save(source)
    snapshot = source.read_bytes()
    browser = api.chromium.launch()
    completed = []
    try:
        for width, height in [(1280, 900), (390, 844)]:
            context = browser.new_context(viewport={'width': width, 'height': height}, accept_downloads=True)
            page = context.new_page()
            errors, uploads = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('request', lambda request: uploads.append(request.url) if request.method in ['POST', 'PUT', 'PATCH'] else None)
            page.goto(origin)
            page.locator('input[type="file"]').first.set_input_files(str(source))
            expect(page.get_by_role('heading', name='Was möchtest du tun?', exact=True)).to_be_visible(timeout=30000)
            page.get_by_role('button', name='Zertifikatssignaturen', exact=True).click()
            page.get_by_label('Aktion', exact=True).select_option('sign')
            expect(page.get_by_label('Verarbeitung', exact=True)).to_have_count(0)
            certificate_input = page.get_by_label('Zertifikat (.p12 oder .pfx)', exact=True)
            password_input = page.get_by_label('Zertifikatspasswort', exact=True)
            certificate_input.set_input_files(str(identity))
            password_input.fill('wrong-password')
            page.get_by_role('button', name='Signieren', exact=True).click()
            expect(page.get_by_role('alert')).to_contain_text('Passwort', ignore_case=True, timeout=30000)
            expect(password_input).to_have_value('')
            certificate_input.set_input_files(str(identity))
            password_input.fill('synthetic-test-only')
            page.get_by_role('button', name='Signieren', exact=True).click()
            download_link = page.get_by_role('link', name='PDF herunterladen', exact=True)
            expect(download_link).to_be_visible(timeout=30000)
            with page.expect_download() as download:
                download_link.click()
            destination = directory / f'signed-{width}.pdf'
            download.value.save_as(destination)
            verify_signature(destination.read_bytes(), directory)
            with pymupdf.open(destination) as document:
                assert document.page_count == 1
                assert 'MoinPDF fictional signature' in document[0].get_text()
                assert next(widget for widget in document[0].widgets() if widget.field_name == 'preserved').field_value == 'KEEP'
            expect(password_input).to_have_value('')
            assert source.read_bytes() == snapshot
            assert not errors, errors
            assert not uploads, f'Local signing must not upload PDF, certificate or password: {uploads}'
            completed.append({'viewport': [width, height], 'signature': 'OpenSSL verified', 'tampering': 'rejected', 'uploads': len(uploads)})
            context.close()
    finally:
        browser.close()
    (evidence / 'local-signature.json').write_text(json.dumps(completed, indent=2))
    print('PASS: production UI and ESM signature worker, desktop/mobile Chromium, wrong-password rejection, secret clearing, preserved form/text, no uploads, independent CMS verification and tamper rejection.')
