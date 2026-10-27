"""Real document organisation and downloads; fictional inputs, desktop/touch emulation."""
import atexit
import io
import json
import os
import re
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from urllib.request import urlopen

import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.getenv('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path('.cache/editor-browser/klar-schiff')
out.mkdir(parents=True, exist_ok=True)
if os.getenv('MOINPDF_TEST_START_SERVER') == '1':
    log = (out / 'http.log').open('w')
    server = subprocess.Popen([sys.executable, 'tests/text-browser-server.py'], stdout=log, stderr=subprocess.STDOUT)
    def cleanup():
        server.terminate()
        server.wait(timeout=10)
        log.close()
    atexit.register(cleanup)
    for _ in range(50):
        try:
            with urlopen(origin, timeout=1) as response:
                if response.status == 200:
                    break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Production test server unavailable')

source = out / 'fictional-scrambled.pdf'
with pymupdf.open() as document:
    for sender, number, total in [('Nordlicht GmbH', 2, 2), ('Suedwind GmbH', 1, 1), ('Nordlicht GmbH', 1, 2), ('Nordlicht GmbH', 1, 2)]:
        page = document.new_page(width=595, height=842)
        for index, text in enumerate([sender, 'Rechnung N-100', 'Rechnungsdatum: 26.10.2026', 'Fictional services only', f'Seite {number} von {total}']):
            page.insert_text((45, 55 + index * 35), text, fontsize=16)
    document.save(source)
duplicate_source = out / 'fictional-duplicate.pdf'
with pymupdf.open(source) as document:
    with pymupdf.open() as duplicate:
        duplicate.insert_pdf(document, from_page=3, to_page=3)
        duplicate.save(duplicate_source)
    document.delete_page(3)
    source_bytes = document.tobytes()
source.write_bytes(source_bytes)

reports = []
with sync_playwright() as playwright:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS', 'chromium').split(','):
        browser = getattr(playwright, engine).launch()
        try:
            for en in (False, True):
                context = browser.new_context(viewport={'width':390 if en else 1440,'height':950}, has_touch=en, accept_downloads=True, reduced_motion='reduce')
                page = context.new_page()
                page.set_default_timeout(45000)
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                name = f'{engine}-{"touch-en" if en else "desktop-de"}'
                def t(de, english): return english if en else de
                def no_overflow():
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), name
                def choose(title):
                    page.locator('.chooser-tool').filter(has=page.get_by_text(title, exact=True)).click()
                    expect(page.get_by_role('heading', name=title, exact=True)).to_be_visible()
                def download(control, filename):
                    with page.expect_download(timeout=120000) as event:
                        control.click()
                    path = out / filename
                    event.value.save_as(path)
                    return path
                try:
                    page.goto(origin + ('?lang=en' if en else '?lang=de'))
                    page.locator('input[type=file]').first.set_input_files([str(source.resolve()), str(duplicate_source.resolve())])
                    shortcut = page.get_by_role('button', name=t('Mit Klar Schiff automatisch ordnen', 'Organise automatically with Clear Deck'), exact=True)
                    expect(shortcut).to_be_visible()
                    no_overflow()
                    shortcut.click()
                    expect(page.get_by_role('heading', name=t('Klar Schiff', 'Clear Deck'), exact=True)).to_be_visible()
                    page.get_by_role('button', name=t('Stapel erkennen', 'Recognise documents'), exact=True).click()
                    expect(page.locator('.klar-document')).to_have_count(2, timeout=120000)
                    expect(page.locator('.klar-summary')).to_contain_text(t('2 Dokumente vorgeschlagen','2 documents suggested'))
                    expect(page.get_by_role('button', name=t('Weiter zum Export','Continue to export'))).to_be_disabled()
                    original_document = page.locator('.klar-pages select').first.input_value()
                    page.locator('.klar-pages select').nth(2).select_option('new')
                    expect(page.locator('.klar-document')).to_have_count(3)
                    expect(page.locator('.klar-preview > p')).to_contain_text(t('Seite 1','Page 1'))
                    page.locator('.klar-pages select').first.select_option(original_document)
                    expect(page.locator('.klar-document')).to_have_count(2)
                    no_overflow()
                    page.screenshot(path=str(out / f'{name}-review.png'), full_page=True)
                    expect(page.locator('.klar-pages li')).to_have_count(3)
                    page.locator('.klar-pages select').nth(1).select_option('exclude')
                    expect(page.locator('.klar-pages li')).to_have_count(2)
                    expect(page.locator('.klar-excluded')).to_contain_text(t('Ausgelassene Seiten: 1','Excluded pages: 1'))
                    checked = t('Zuordnung, Reihenfolge und Angaben dieses Dokuments geprüft','I have reviewed this document’s assignments, order and details')
                    page.get_by_label(checked, exact=True).check()
                    page.get_by_role('button', name=t('Nächstes ungeprüftes Dokument','Next unreviewed document')).click()
                    page.get_by_label(checked, exact=True).check()
                    page.get_by_role('button',name=t('Erkennungsregel aus diesem Dokument erstellen','Create a recognition rule from this document'),exact=True).click()
                    no_overflow()
                    page.screenshot(path=str(out / f'{name}-rule.png'), full_page=False)
                    page.get_by_label(t('Geltungsbereich und erkannte Werte dieser Regel geprüft',"I have reviewed this rule's scope and extracted values"),exact=True).check()
                    page.get_by_role('button',name=t('Erkennungsregel speichern','Save recognition rule'),exact=True).click()
                    expect(page.get_by_text(t('Lokale Erkennungsregeln','Local recognition rules')+' (1/30)',exact=True)).to_be_visible()
                    # Tool remount preserves all review decisions and exclusions.
                    page.get_by_role('button',name=t('Zurück zur Auswahl','Back to selection'),exact=True).click()
                    choose(t('Klar Schiff','Clear Deck'))
                    expect(page.locator('.klar-summary')).to_contain_text(t('2 von 2 geprüft','2 of 2 reviewed'))
                    page.get_by_role('button',name=t('Weiter zum Export','Continue to export')).click()
                    expect(page.locator('.klar-export')).to_contain_text(t('1 bewusst ausgelassene','1 deliberately excluded'))
                    page.get_by_role('button',name=t('Geordnete Unterlagen erstellen','Create organised documents')).click()
                    expect(page.locator('.advanced-result')).to_be_visible(timeout=120000)
                    result = download(page.locator('.advanced-result a[download][href^="blob:"]').first, name+'-documents.zip')
                    with zipfile.ZipFile(result) as archive:
                        pdfs = [entry for entry in archive.namelist() if entry.endswith('.pdf')]
                        assert len(pdfs) == 2
                        assert len(json.loads(archive.read('Klar-Schiff.json'))['excluded']) == 1
                        texts = []
                        for entry in pdfs:
                            with pymupdf.open(stream=archive.read(entry), filetype='pdf') as document:
                                texts.append(' '.join(p.get_text() for p in document))
                        assert 'Seite 1 von 2' in texts[0] and 'Seite 2 von 2' in texts[0]
                        assert texts[0].count('Seite 1 von 2') == 1
                        assert 'Suedwind GmbH' in texts[1]
                    page.get_by_label(t('Ausgabe','Output'), exact=True).select_option('pdf')
                    expect(page.locator('.advanced-result')).to_have_count(0)
                    page.get_by_role('button',name=t('Geordnete Unterlagen erstellen','Create organised documents')).click()
                    expect(page.locator('.advanced-result')).to_be_visible(timeout=120000)
                    control = page.locator('.advanced-result a[download][href^="blob:"]').first
                    expect(control).to_be_visible(timeout=120000)
                    result = download(control,name+'-bundle.pdf')
                    with pymupdf.open(result) as document:
                        assert len(document) == 4
                        links = document[0].get_links()
                        assert len(links) == 2
                        # PyMuPDF 1.26 reports /Fit destinations as one-based
                        # strings; newer readers expose zero-based integers.
                        assert [int(link['page']) - 1 if isinstance(link['page'], str) else link['page'] for link in links] == [1,3]
                        references = []
                        for link in links:
                            kind, destination = document.xref_get_key(link['xref'], 'Dest')
                            assert kind == 'array'
                            match = re.fullmatch(r'\[\s*(\d+)\s+0\s+R\s*/Fit\s*\]', destination)
                            assert match, destination
                            references.append(int(match.group(1)))
                        assert references == [document.page_xref(1), document.page_xref(3)]
                        assert [entry[2] for entry in document.get_toc()] == [2,4]
                    no_overflow()
                    page.screenshot(path=str(out / f'{name}-export.png'), full_page=True)
                    # The narration language is independent of interface language.
                    page.get_by_role('button',name=t('Zurück zur Auswahl','Back to selection'),exact=True).click()
                    choose(t('PDF als Hörbuch','PDF to audio'))
                    page.get_by_label(t('Vorlesesprache','Narration language'),exact=True).select_option('en')
                    expect(page.get_by_label(t('Stimme','Voice'),exact=True)).to_have_value('ljspeech')
                    page.get_by_role('button',name=t('Vorlesetext vorbereiten','Prepare narration text'),exact=True).click()
                    narration = page.get_by_role('textbox', name=t('Vorlesetext','Narration text'), exact=True)
                    expect(narration).to_be_visible(timeout=30000)
                    assert 'Nordlicht' in narration.input_value()
                    page.get_by_label(t('Vorlesesprache','Narration language'),exact=True).select_option('de')
                    expect(page.get_by_label(t('Stimme','Voice'),exact=True)).to_have_value('thorsten')
                    no_overflow()
                    assert not errors, errors
                    reports.append({'case':name,'passed':True,'checks':['review required','duplicate exclusion','tool remount','ZIP page content','PDF destinations','responsive layout','independent voice language']})
                except Exception as error:
                    reports.append({'case':name,'passed':False,'error':str(error),'pageErrors':errors})
                    page.screenshot(path=str(out / f'{name}-failure.png'),full_page=True)
                    raise
                finally:
                    (out / 'report.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False))
                    context.close()
        finally:
            browser.close()
print('PASS: Clear Deck review, exclusions, persistent assignments, actual ZIP/PDF downloads, source readback, TOC links, desktop/touch layouts and independent audio languages.')
