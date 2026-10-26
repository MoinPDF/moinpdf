"""Real PDF-to-Word downloads, read back independently as OOXML and PNGs.

Synthetic fixtures only. Desktop engines/touch emulation are not physical
devices or native Microsoft Word. Document POSTs and external requests fail.
"""
import atexit
import json
import os
import subprocess
import sys
import time
import traceback
import zipfile
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
from xml.etree import ElementTree as ET

import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.getenv('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path(os.getenv('MOINPDF_BROWSER_OUTPUT', '.cache/editor-browser')) / 'word-export'
out.mkdir(parents=True, exist_ok=True)
if os.getenv('MOINPDF_TEST_START_SERVER') == '1':
    log = (out / 'http.log').open('w')
    server = subprocess.Popen([sys.executable, 'tests/text-browser-server.py'], stdout=log, stderr=subprocess.STDOUT)

    def stop_server():
        server.terminate()
        server.wait(timeout=10)
        log.close()

    atexit.register(stop_server)
    for _ in range(50):
        if server.poll() is not None:
            raise RuntimeError('Production test server exited')
        try:
            with urlopen(origin, timeout=1) as response:
                if response.status == 200:
                    break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Production test server unavailable')

with pymupdf.open() as picture:
    p = picture.new_page(width=100, height=80)
    p.draw_rect(p.rect, color=None, fill=(.85, .1, .2))
    p.draw_rect((10, 10, 45, 65), color=None, fill=(0, .4, .4))
    image = p.get_pixmap().tobytes('png')

native = out / 'fictional-layout.pdf'
scan = out / 'fictional-scan.pdf'
with pymupdf.open() as document:
    page = document.new_page(width=500, height=700)
    page.insert_text((40, 60), 'MoinPDF Word Test', fontsize=24, fontname='hebo', color=(0, .4, .4))
    page.insert_text((40, 130), 'Left column', fontsize=12)
    page.insert_text((260, 130), 'Right column', fontsize=12)
    page.insert_image((340, 150, 460, 246), stream=image)
    page.draw_rect((40, 300, 460, 360), color=(0, 0, 0))
    page.draw_line((250, 300), (250, 360), color=(0, 0, 0))
    page.insert_text((50, 325), 'Table cell', fontsize=12)
    page.insert_text((265, 325), '123,45 EUR', fontsize=12)
    page = document.new_page(width=500, height=700)
    page.insert_text((50, 70), 'Rotated page', fontsize=18)
    page.insert_image((250, 300, 370, 396), stream=image)
    page.set_rotation(90)
    document.save(native)
with pymupdf.open() as paper, pymupdf.open() as raster:
    page = paper.new_page(width=400, height=250)
    page.insert_text((30, 60), 'Scan sample 2026', fontsize=22)
    page.insert_image((300, 120, 360, 200), stream=image)
    raster.new_page(width=400, height=250).insert_image(page.rect, stream=page.get_pixmap(matrix=pymupdf.Matrix(3, 3)).tobytes('png'))
    raster.save(scan)

NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}


def inspect_docx(path, kind):
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        xml = ET.fromstring(archive.read('word/document.xml'))
        text = ' '.join(node.text or '' for node in xml.findall('.//w:t', NS))
        sections = xml.findall('.//w:sectPr', NS)
        boxes = xml.findall('.//w:txbxContent', NS)
        pictures = xml.findall('.//pic:pic', NS)
        if kind == 'text':
            assert 'MoinPDF Word Test' in text and 'Rotated page' in text
            assert not boxes and not pictures, 'The explicitly selected paragraph export stays text-only'
            return
        if kind == 'structured':
            assert not boxes, 'Flowing text must use paragraphs rather than positioned text boxes'
            assert len(sections) == 1 and pictures, 'Flowing output keeps artwork in one editable section'
            tables = xml.findall('.//w:tbl', NS)
            assert tables, 'The bounded one-row grid must become a real Word table'
            table_text = ' '.join(n.text or '' for n in tables[0].findall('.//w:t', NS))
            assert 'Table cell' in table_text and '123,45 EUR' in table_text
            for value in ('MoinPDF Word Test', 'Left column', 'Right column'):
                assert text.count(value) == 1, (value, text)
            title = next(p for p in xml.findall('.//w:p', NS) if 'MoinPDF Word Test' in ''.join(n.text or '' for n in p.findall('.//w:t', NS)))
            assert title.find('.//w:b', NS) is not None
            assert not xml.findall('.//w:vanish', NS)
            return
        assert boxes and pictures, 'Layout output contains visible editable text and image data'
        assert not xml.findall('.//w:vanish', NS), 'Editable text is visible, not a hidden search layer'
        sizes = [(int(s.find('w:pgSz', NS).get('{%s}w' % NS['w'])), int(s.find('w:pgSz', NS).get('{%s}h' % NS['w']))) for s in sections]
        assert sizes == ([(500*20, 700*20), (700*20, 500*20)] if kind == 'native' else [(400*20, 250*20)])
        expected = ['MoinPDF Word Test', 'Left column', 'Right column', 'Table cell', '123,45 EUR'] if kind == 'native' else ['Scan', 'sample', '2026']
        for value in expected:
            assert value in text, (value, text)
        if kind == 'native':
            assert text.count('MoinPDF Word Test') == 1
            assert 'Rotated page' not in text, 'Unsupported rotation is kept visibly in the artwork'
            title = next(b for b in boxes if 'MoinPDF Word Test' in ''.join(n.text or '' for n in b.findall('.//w:t', NS)))
            assert title.find('.//w:b', NS) is not None
            assert title.find('.//w:sz', NS).get('{%s}val' % NS['w']) == '48'
            assert title.find('.//w:color', NS).get('{%s}val' % NS['w']) == '006666'
            anchors = xml.findall('.//wp:anchor', NS)
            for label, expected_x in [('Left column', 40), ('Right column', 260)]:
                anchor = next(a for a in anchors if label in ''.join(n.text or '' for n in a.findall('.//w:t', NS)))
                pos = anchor.find('wp:positionH/wp:posOffset', NS)
                assert abs(int(pos.text)/12700 - expected_x) < 3, (label, pos.text)
        relations = {n.get('Id'): n.get('Target') for n in ET.fromstring(archive.read('word/_rels/document.xml.rels'))}
        relationship = pictures[0].find('.//a:blip', NS).get('{%s}embed' % NS['r'])
        target = relations[relationship].lstrip('/')
        target = target if target.startswith('word/') else 'word/' + target
        pixmap = pymupdf.Pixmap(archive.read(target))
        # A red pixel inside the original photo verifies image content and placement.
        width, height = (500, 700) if kind == 'native' else (400, 250)
        x, y = (450, 170) if kind == 'native' else (350, 140)
        pixel = pixmap.pixel(round(x/width*pixmap.width), round(y/height*pixmap.height))
        assert pixel[0] > 170 and pixel[1] < 100, pixel
        if kind == 'native':
            # The title must disappear from the background when its Word text is edited.
            points = [pixmap.pixel(round(x/width*pixmap.width), round(y/height*pixmap.height)) for x in range(40, 310, 3) for y in range(35, 65, 3)]
            assert all(min(p[:3]) > 240 for p in points), 'Native text was duplicated in the page image'


def run_case(browser, engine, name, language, width, kind):
    context = browser.new_context(viewport={'width': width, 'height': 950}, accept_downloads=True, reduced_motion='reduce', has_touch=width < 500)
    page = context.new_page()
    page.set_default_timeout(45000)
    errors, blocked = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def route(request):
        url = request.request.url
        if request.request.method not in ('GET', 'HEAD') or (urlsplit(url).netloc != urlsplit(origin).netloc and not url.startswith(('blob:', 'data:'))):
            blocked.append(url)
            request.abort()
        else:
            request.continue_()

    page.route('**/*', route)
    result = {'case': f'{engine}-{name}', 'viewport': width}
    try:
        page.goto(origin + '?lang=' + language)
        en = language == 'en'
        expect(page.locator('html')).to_have_attribute('lang', language)
        page.locator('input[type=file]').first.set_input_files(str((scan if kind == 'scan' else native).resolve()))
        title = 'PDF to Word' if en else 'PDF zu Word'
        page.locator('.chooser-tool').filter(has=page.get_by_text(title, exact=True)).click()
        expect(page.get_by_role('heading', name=title, exact=True)).to_be_visible()
        layout = page.get_by_role('radio', name='Preserve appearance as closely as possible' if language == 'en' else 'Aussehen möglichst erhalten', exact=True)
        structured = page.get_by_role('radio', name='Edit text and tables' if language == 'en' else 'Text und Tabellen bearbeiten', exact=True)
        expect(layout).to_be_checked()
        expect(structured).to_be_visible()
        details = page.locator('.word-export-options details')
        expect(details).not_to_have_attribute('open', '')
        if kind == 'structured':
            structured.check()
        elif kind == 'text':
            details.locator('summary').click()
            page.get_by_label('Text as paragraphs only' if language == 'en' else 'Nur Text als Absätze', exact=True).check()
        page.get_by_role('button', name='Create Word file' if en else 'Word-Datei erstellen', exact=True).click()
        link = page.get_by_role('link', name='Download Word' if en else 'Word herunterladen', exact=True)
        expect(link).to_be_visible(timeout=180000)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'Horizontal overflow'
        if kind == 'native':
            expect(page.locator('.advanced-result')).to_contain_text('not editable' if en else 'nicht bearbeitbar')
        if en:
            assert 'Seitenformat' not in page.locator('.advanced-result').inner_text(), 'Result notes were not translated'
        with page.expect_download(timeout=30000) as download:
            link.click()
        assert download.value.suggested_filename.endswith('.docx')
        destination = out / f'{engine}-{name}.docx'
        download.value.save_as(destination)
        inspect_docx(destination, kind)
        page.screenshot(path=str(out / f'{engine}-{name}.png'), full_page=True)
        assert not errors, errors
        assert not blocked, blocked
        # Switching output invalidates the previous result instead of downloading stale bytes.
        if kind == 'text':
            layout.check()
        else:
            if not details.evaluate('(node) => node.open'):
                details.locator('summary').click()
            page.get_by_label('Text as paragraphs only' if en else 'Nur Text als Absätze', exact=True).check()
        expect(link).to_have_count(0)
        result['status'] = 'passed'
    except Exception:
        result.update(status='failed', error=traceback.format_exc())
        page.screenshot(path=str(out / f'{engine}-{name}-failed.png'), full_page=True)
    finally:
        context.close()
    return result


engines = os.getenv('MOINPDF_TEST_BROWSERS', 'chromium,firefox,webkit').split(',')
assert engines and all(e in ('chromium', 'firefox', 'webkit') for e in engines)
cases = [('layout-desktop', 'de', 1440, 'native'), ('layout-touch', 'en', 390, 'native'), ('scan', 'de', 1280, 'scan'), ('paragraphs', 'en', 1280, 'text'), ('flowing-desktop', 'de', 1440, 'structured'), ('flowing-touch', 'en', 390, 'structured')]
report = {'results': [], 'limitations': ['Browser engines and touch emulation; no physical-device or native Word check.']}
with sync_playwright() as api:
    for engine in engines:
        browser = getattr(api, engine).launch()
        try:
            for args in cases:
                result = run_case(browser, engine, *args)
                report['results'].append(result)
                (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
                print(result, flush=True)
        finally:
            browser.close()
assert len(report['results']) == len(engines)*len(cases)
assert all(r['status'] == 'passed' for r in report['results']), report
print(f"PASS: {len(report['results'])} real Word download cases with independent layout, image, text and scan checks.")
