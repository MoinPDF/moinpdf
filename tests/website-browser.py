"""Exercise the URL flow, file fallback, translations, results and responsive layout."""
import json
import os
from email.parser import BytesParser
from email.policy import default
from pathlib import Path

import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.getenv('MOINPDF_TEST_URL', 'http://127.0.0.1:8765')
out = Path('web-evidence')
out.mkdir(exist_ok=True)
with pymupdf.open() as pdf:
    pdf.new_page().insert_text((50, 80), 'Website-PDF: synthetic browser test')
    pdf_bytes = pdf.tobytes()
requests = []
errors = []


def api(route):
    request = route.request
    assert request.headers.get('x-moinpdf-client') == 'web'
    assert 'authorization' not in request.headers
    if request.url.endswith('/capabilities'):
        route.fulfill(json={'apiVersion': 1, 'service': 'synthetic', 'capabilities': {'website': True, 'html': True}})
        return
    message = BytesParser(policy=default).parsebytes(
        ('Content-Type: ' + request.headers['content-type'] + '\r\n\r\n').encode() + request.post_data_buffer)
    fields = {part.get_param('name', header='content-disposition'): part.get_payload(decode=True)
              for part in message.iter_parts()}
    requests.append((request.url, fields))
    if fields.get('url') == b'https://blocked.example/':
        route.fulfill(status=422, json={'detail': 'Nur öffentlich erreichbare Webseiten sind erlaubt.'})
    else:
        route.fulfill(body=pdf_bytes, headers={'content-type': 'application/pdf',
                      'content-disposition': 'attachment; filename="Webseite-example.org.pdf"'})


with sync_playwright() as driver:
    browser = driver.chromium.launch(executable_path=os.getenv('MOINPDF_CHROMIUM') or None)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    context.route('**/api/website/**', api)
    context.route('**/api/documents/**', api)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(origin)
    page.get_by_role('button', name='Alle Werkzeuge', exact=True).click()
    page.locator('.chooser-tool').filter(has=page.get_by_text('HTML & Webseiten zu PDF', exact=True)).click()
    expect(page.get_by_label('Eingabe', exact=True)).to_have_value('url')
    expect(page.get_by_role('button', name='PDF erstellen', exact=True)).to_be_disabled()
    page.get_by_label('Website-Adresse', exact=True).fill('example.org/article?q=1')
    page.get_by_text('Weitere Optionen', exact=True).click()
    page.get_by_label('Papierformat', exact=True).select_option('Letter')
    page.get_by_label('Querformat', exact=True).check()
    page.get_by_label('Hintergrundfarben und Hintergrundbilder übernehmen', exact=True).uncheck()
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(out / 'website-light-desktop.png'), full_page=True)
    page.get_by_role('button', name='PDF erstellen', exact=True).click()
    expect(page.get_by_role('heading', name='Fertig.', exact=True)).to_be_visible()
    assert requests[-1][0].endswith('/api/website/v1/website')
    assert requests[-1][1]['url'] == b'https://example.org/article?q=1'
    assert json.loads(requests[-1][1]['options']) == {'paper': 'Letter', 'landscape': True, 'background': False, 'media': 'screen'}
    expect(page.locator('.advanced-result img').first).to_be_visible()
    with page.expect_download() as saved:
        page.get_by_role('link', name='PDF herunterladen', exact=True).click()
    with pymupdf.open(saved.value.path()) as pdf:
        assert 'Website-PDF' in pdf[0].get_text()
    page.get_by_label('Eingabe', exact=True).select_option('file')
    expect(page.get_by_label('Website-Adresse', exact=True)).to_have_count(0)
    expect(page.get_by_text('JavaScript, Bilder, externe Schriftdateien und CSS', exact=False)).to_be_visible()
    page.locator('input[type=file]').last.set_input_files({'name': 'local.html', 'mimeType': 'text/html', 'buffer': b'<h1>Saved HTML</h1>'})
    page.get_by_role('button', name='PDF erstellen', exact=True).click()
    expect(page.get_by_role('heading', name='Fertig.', exact=True)).to_be_visible()
    assert requests[-1][0].endswith('/api/documents/v1/documents/html')
    page.get_by_label('Eingabe', exact=True).select_option('url')
    page.locator('.language-trigger').click()
    page.get_by_role('menuitemradio', name='English', exact=True).click()
    expect(page.get_by_label('Website address', exact=True)).to_be_visible()
    expect(page.get_by_label('Input', exact=True)).to_have_value('url')
    page.get_by_label('Website address', exact=True).fill('file:///etc/passwd')
    page.get_by_role('button', name='Create PDF', exact=True).click()
    expect(page.get_by_role('alert')).to_have_text('Enter a valid public website address without credentials.')
    page.get_by_label('Website address', exact=True).fill('https://blocked.example/')
    page.get_by_role('button', name='Create PDF', exact=True).click()
    expect(page.get_by_role('alert')).to_have_text('Only publicly accessible web pages are allowed.')
    page.get_by_label('Website address', exact=True).fill('https://example.org/')
    page.locator('.theme-toggle').click()
    page.set_viewport_size({'width': 320, 'height': 900})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile horizontal overflow'
    page.screenshot(path=str(out / 'website-dark-mobile-en.png'), full_page=True)
    assert 'Website-Adresse' not in page.locator('main').inner_text()
    assert 'Mit dem Start' not in page.locator('main').inner_text()
    assert not errors, errors
    browser.close()
print('PASS: URL form, options, preview, PDF download, HTML-file fallback, DE/EN validation and 320 px dark layout.')
