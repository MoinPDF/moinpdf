"""0.21 production acceptance: actual downloads, offline restart and bounded previews.

Fictional documents only. Desktop engines and touch emulation are not physical
mobile devices, native Safari or native Microsoft Word.
"""
import atexit
import json
import os
import re
import subprocess
import sys
import time
import traceback
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen

import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.getenv('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path(os.getenv('MOINPDF_BROWSER_OUTPUT', '.cache/editor-browser')) / 'release-021'
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

source, scan, large = (out / n for n in ('fictional-source.pdf', 'fictional-scan.pdf', 'fictional-200-pages.pdf'))
with pymupdf.open() as pdf:
    p = pdf.new_page(width=400, height=500)
    p.insert_text((30, 50), 'Fictional project 2026', fontsize=20)
    p.draw_rect((30, 80, 180, 130), color=None, fill=(.8, .1, .1))
    p.insert_link({'kind': pymupdf.LINK_URI, 'from': pymupdf.Rect(30, 30, 270, 55), 'uri': 'https://example.org/'})
    widget = pymupdf.Widget()
    widget.field_name, widget.field_type, widget.field_value = 'fictional', pymupdf.PDF_WIDGET_TYPE_TEXT, 'Visible form value'
    widget.rect = pymupdf.Rect(30, 150, 250, 175)
    p.add_widget(widget)
    p = pdf.new_page(width=400, height=500)
    p.insert_text((30, 50), 'Second fictional page', fontsize=20)
    pdf.embfile_add('fictional-secret.txt', b'Attachment must not enter flattened handoff')
    pdf.save(source)
with pymupdf.open() as paper, pymupdf.open() as pdf:
    p = paper.new_page(width=500, height=250)
    p.insert_text((30, 80), 'Rechnung 12345', fontsize=28)
    image = p.get_pixmap(matrix=pymupdf.Matrix(2, 2)).tobytes('png')
    pdf.new_page(width=500, height=250).insert_image(p.rect, stream=image)
    pdf.save(scan)
with pymupdf.open() as pdf:
    for index in range(200):
        p = pdf.new_page(width=400, height=500)
        p.insert_text((30, 50), f'Fictional page {index + 1}', fontsize=20)
    pdf.save(large)


def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'Horizontal overflow'


def open_project(page, en=False):
    page.get_by_role('button', name=re.compile(r'^Projects' if en else r'^Projekte')).click()
    return page.get_by_role('dialog', name='Local PDF projects' if en else 'Lokale PDF-Projekte', exact=True)


def choose(page, name):
    page.locator('.chooser-tool').filter(has=page.get_by_text(name, exact=True)).click()
    expect(page.get_by_role('heading', name=name, exact=True)).to_be_visible()


def export_dialog(page, projects, en=False):
    projects.get_by_role('button', name='Download project file' if en else 'Projektdatei herunterladen', exact=True).click()
    dialog = page.get_by_role('dialog', name='Export project' if en else 'Projekt exportieren', exact=True)
    expect(dialog).to_be_visible()
    return dialog


def download_file(page, control, filename):
    with page.expect_download(timeout=120000) as event:
        control.click()
    destination = out / filename
    event.value.save_as(destination)
    assert destination.stat().st_size > 0
    return destination


def project_case(browser, engine, en):
    context = browser.new_context(viewport={'width': 390 if en else 1440, 'height': 950}, has_touch=en, accept_downloads=True, reduced_motion='reduce')
    page = context.new_page()
    page.set_default_timeout(45000)
    errors, forbidden = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    context.on('request', lambda r: forbidden.append(r.url) if r.method not in ('GET', 'HEAD') or urlsplit(r.url).netloc not in ('', urlsplit(origin).netloc) and not r.url.startswith(('blob:', 'data:')) else None)
    result = {'case': f'{engine}-project-{"touch-en" if en else "desktop-de"}'}
    try:
        page.goto(origin + ('?lang=en' if en else '?lang=de'))
        page.locator('input[type=file]').first.set_input_files(str(source.resolve()))
        choose(page, 'Organize pages' if en else 'Seiten organisieren')
        page.get_by_role('button', name='Rotate page 1' if en else 'Seite 1 drehen', exact=True).click()
        projects = open_project(page, en)
        projects.get_by_label('Project name' if en else 'Projektname', exact=True).fill('Fictional encrypted project')
        projects.get_by_role('button', name='Save project' if en else 'Projekt speichern', exact=True).click()
        expect(projects.get_by_role('heading', name='Fictional encrypted project')).to_be_visible()
        dialog = export_dialog(page, projects, en)
        expect(dialog).to_contain_text('earlier edit steps' if en else 'frühere Bearbeitungsschritte')
        dialog.get_by_text('Review included source files' if en else 'Enthaltene Originaldateien ansehen', exact=True).click()
        expect(dialog).to_contain_text(source.name)
        dialog.get_by_label('Encrypt project file with a password' if en else 'Projektdatei mit Passwort verschlüsseln', exact=True).check()
        password = 'Fictional-021-password'
        dialog.get_by_label('Password (at least 12 characters)' if en else 'Passwort (mindestens 12 Zeichen)', exact=True).fill(password)
        button = dialog.get_by_role('button', name='Download file' if en else 'Datei herunterladen', exact=True)
        expect(button).to_be_disabled()
        dialog.get_by_label('Repeat password' if en else 'Passwort wiederholen', exact=True).fill(password)
        no_overflow(page)
        protected = download_file(page, button, f'{engine}-{en}-protected.moinpdf')
        assert protected.read_bytes().startswith(b'MOINPDF-ENCRYPTED\n')
        assert b'fictional-source.pdf' not in protected.read_bytes()
        expect(dialog).to_have_count(0)
        projects.get_by_label('MoinPDF project file' if en else 'MoinPDF-Projektdatei', exact=True).set_input_files(str(protected.resolve()))
        unlock = page.get_by_role('dialog', name='Unlock project file' if en else 'Projektdatei entsperren', exact=True)
        unlock.get_by_label('Password' if en else 'Passwort', exact=True).fill('Fictional-wrong-password')
        unlock.get_by_role('button', name='Unlock and open' if en else 'Entsperren und öffnen', exact=True).click()
        expect(unlock.get_by_role('alert')).to_contain_text('password' if en else 'Passwort')
        # Radix correctly hides the underlying projects dialog while the password dialog is modal.
        expect(page.get_by_role('heading', name='Fictional encrypted project', include_hidden=True)).to_have_count(1)
        unlock.get_by_label('Password' if en else 'Passwort', exact=True).fill(password)
        unlock.get_by_role('button', name='Unlock and open' if en else 'Entsperren und öffnen', exact=True).click()
        expect(unlock).to_have_count(0)
        expect(page.get_by_role('button', name='Rotate page 1' if en else 'Seite 1 drehen', exact=True)).to_be_visible()
        projects = open_project(page, en)
        dialog = export_dialog(page, projects, en)
        dialog.get_by_label('Output' if en else 'Ausgabe', exact=True).select_option('handoff')
        expect(dialog).to_contain_text('Searchable text' if en else 'Suchtext')
        clean = download_file(page, dialog.get_by_role('button', name='Download file' if en else 'Datei herunterladen', exact=True), f'{engine}-{en}-handoff.pdf')
        with pymupdf.open(clean) as pdf:
            assert len(pdf) == 2 and pdf.embfile_count() == 0
            assert (round(pdf[0].rect.width), round(pdf[0].rect.height)) == (500, 400), 'Visible rotation was lost'
            for p in pdf:
                assert not p.get_text().strip() and not p.get_links() and not list(p.widgets() or [])
                assert p.get_images() and len(set(p.get_pixmap().samples)) > 8
        page.screenshot(path=str(out / f'{engine}-{en}-projects.png'), full_page=True)
        assert not errors, errors
        assert not forbidden, forbidden
        result['status'] = 'passed'
    except Exception:
        result.update(status='failed', error=traceback.format_exc())
        page.screenshot(path=str(out / f'{engine}-{en}-projects-failed.png'), full_page=True)
    finally:
        context.close()
    return result


def offline_case(browser, engine):
    context = browser.new_context(viewport={'width': 1280, 'height': 950}, accept_downloads=True, reduced_motion='reduce')
    page = context.new_page()
    page.set_default_timeout(45000)
    result = {'case': f'{engine}-offline-ocr-and-200-pages'}
    try:
        page.goto(origin)
        projects = open_project(page)
        offline = projects.get_by_role('region', name='Offline-Nutzung', exact=True)
        offline.get_by_text('Offline-Pakete verwalten', exact=True).click()
        offline.get_by_role('button', name='Auswahl herunterladen / aktualisieren', exact=True).click()
        expect(offline).to_contain_text('Offline-Dateien geprüft und gespeichert.', timeout=240000)
        assert page.evaluate('crossOriginIsolated'), 'Online isolation headers missing'
        context.set_offline(True)
        page.close()
        page = context.new_page()
        page.set_default_timeout(45000)
        page.goto(origin)
        expect(page.get_by_role('button', name='Offline-Status und Pakete öffnen')).to_be_visible()
        assert page.evaluate('crossOriginIsolated'), 'Offline shell lost isolation headers'
        page.locator('input[type=file]').first.set_input_files(str(scan.resolve()))
        choose(page, 'OCR & Text')
        page.get_by_role('button', name='Text erkennen', exact=True).click()
        link = page.locator('.export-actions a[download]')
        expect(link).to_have_attribute('href', re.compile(r'^blob:'), timeout=180000)
        path = download_file(page, link, f'{engine}-offline-ocr.pdf')
        with pymupdf.open(path) as pdf:
            assert 'Rechnung 12345' in pdf[0].get_text(), pdf[0].get_text()
        projects = open_project(page)
        projects.get_by_label('Projektname', exact=True).fill('Fictional offline project')
        projects.get_by_role('button', name='Projekt speichern', exact=True).click()
        expect(projects.get_by_role('heading', name='Fictional offline project')).to_be_visible()
        projects.get_by_text('Offline-Pakete verwalten', exact=True).click()
        projects.get_by_role('button', name='Offline-Dateien entfernen', exact=True).click()
        expect(projects).to_contain_text('Offline-Dateien entfernt. Projekte und Ergebnisse bleiben gespeichert.')
        expect(projects.get_by_role('heading', name='Fictional offline project')).to_be_visible()
        assert page.evaluate("async () => !(await caches.keys()).some(n=>n.startsWith('moinpdf-offline-'))")
        context.set_offline(False)
        page.goto(origin)
        started = time.monotonic()
        page.locator('input[type=file]').first.set_input_files(str(large.resolve()))
        choose(page, 'Seiten organisieren')
        expect(page.locator('.page-preview img').first).to_be_visible()
        result['200_pages_open_seconds'] = round(time.monotonic() - started, 2)
        first = page.get_by_role('button', name='Seite 1 in Einzelansicht öffnen', exact=True)
        last = page.get_by_role('button', name='Seite 200 in Einzelansicht öffnen', exact=True)
        last.scroll_into_view_if_needed()
        expect(last.locator('img')).to_be_visible()
        expect(first.locator('img')).to_have_count(0, timeout=20000)
        result['retained_preview_images'] = page.locator('.page-preview img').count()
        assert result['retained_preview_images'] < 80, result
        first.scroll_into_view_if_needed()
        expect(first.locator('img')).to_be_visible()
        no_overflow(page)
        page.screenshot(path=str(out / f'{engine}-bounded-previews.png'), full_page=True)
        result['status'] = 'passed'
    except Exception:
        result.update(status='failed', error=traceback.format_exc())
        page.screenshot(path=str(out / f'{engine}-offline-failed.png'), full_page=True)
    finally:
        context.close()
    return result


def gate_case(browser, engine):
    context = browser.new_context(viewport={'width': 1280, 'height': 950}, accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(45000)
    result = {'case': f'{engine}-export-gates'}
    try:
        page.goto(origin)
        page.locator('input[type=file]').first.set_input_files(str(source.resolve()))
        choose(page, 'PDF fixieren')
        page.get_by_role('button', name='PDF fixieren', exact=True).last.click()
        review = page.get_by_label('Änderungen und Prüflücken geprüft', exact=True)
        expect(review).to_be_visible(timeout=120000)
        for link in page.locator('a[download]').all():
            assert not link.get_attribute('href'), 'Alternate download bypasses verification'
        expect(page.get_by_role('button', name='Ergebnis weiterbearbeiten', exact=True)).to_be_disabled()
        review.check()
        links = page.locator('a[download]')
        for link in links.all():
            expect(link).to_have_attribute('href', re.compile('^blob:'))
        output = download_file(page, links.first, f'{engine}-reviewed.pdf')
        with pymupdf.open(output) as pdf:
            assert len(pdf) == 2
        result['status'] = 'passed'
    except Exception:
        result.update(status='failed', error=traceback.format_exc())
        page.screenshot(path=str(out / f'{engine}-gate-failed.png'), full_page=True)
    finally:
        context.close()
    return result


report = {'results': [], 'limitations': ['This matrix covers desktop engines and touch emulation. Native Safari uses the separate macOS text workflow; physical devices and native Microsoft Word remain pending.']}
with sync_playwright() as api:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS', 'chromium,firefox,webkit').split(','):
        assert engine in ('chromium', 'firefox', 'webkit')
        browser = getattr(api, engine).launch()
        try:
            for run, args in [(project_case, (False,)), (project_case, (True,)), (offline_case, ()), (gate_case, ())]:
                result = run(browser, engine, *args)
                report['results'].append(result)
                (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
                print(result, flush=True)
        finally:
            browser.close()
assert all(r['status'] == 'passed' for r in report['results']), report
