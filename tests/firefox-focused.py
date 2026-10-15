"""Bounded functional Firefox checks while the complete view sweep runs."""
import json
import os
from pathlib import Path
import re
import tempfile
import time
import traceback

import pymupdf
from playwright.sync_api import sync_playwright, expect
from browser_runtime import launch_browser

origin=os.environ['MOINPDF_TEST_URL']
out=Path('cross-browser-evidence');out.mkdir(exist_ok=True)
report={'browser':'firefox','results':[],'reducedMotion':True}

with sync_playwright() as api,tempfile.TemporaryDirectory() as temporary:
    folder=Path(temporary)
    source=folder/'firefox-original.pdf'
    with pymupdf.open() as pdf:
        for text in ('FIREFOX ORIGINAL 123. Rechnung 25,50 Euro.','ZWEITE SEITE BLEIBT ERHALTEN.'):
            pdf.new_page().insert_text((50,70),text,fontsize=18)
        pdf.save(source)
    scan=folder/'firefox-scan.pdf'
    with pymupdf.open() as text_pdf,pymupdf.open() as scan_pdf:
        text_pdf.new_page(width=900,height=200).insert_text((30,80),'MoinPDF Firefox Rechnung 12345',fontsize=32)
        data=text_pdf[0].get_pixmap(matrix=pymupdf.Matrix(2,2)).tobytes('png')
        scan_pdf.new_page(width=900,height=200).insert_image(pymupdf.Rect(0,0,900,200),stream=data)
        scan_pdf.save(scan)
    browser=launch_browser(api)
    report['version']=browser.version

    def fresh(page,path=source):
        page.goto(origin)
        page.locator('input[type=file]').first.set_input_files(str(path))
        expect(page.locator('.chooser-tool')).to_have_count(112)

    def tool(page,name):
        page.locator('.chooser-tool').filter(has=page.get_by_text(name,exact=True)).click()
        expect(page.locator('main h1')).to_have_text(name)

    def output(page,name,selector='a[download]',timeout=120000):
        link=page.locator(selector).first
        expect(link).to_be_visible(timeout=timeout)
        with page.expect_download(timeout=30000) as download:link.click()
        path=out/name;download.value.save_as(path)
        return path

    def roundtrip(page):
        fresh(page);tool(page,'Seiten organisieren')
        page.get_by_role('tab',name='Vorschau',exact=True).click()
        expect(page.locator('img[alt="firefox-original.pdf, Seite 1"]')).to_have_js_property('complete',True)
        page.get_by_role('button',name='Seiten speichern',exact=True).click()
        with pymupdf.open(output(page,'roundtrip.pdf')) as pdf:
            assert len(pdf)==2 and 'FIREFOX ORIGINAL 123' in pdf[0].get_text()
            assert 'ZWEITE SEITE BLEIBT ERHALTEN' in pdf[1].get_text()

    def edit(page):
        fresh(page);tool(page,'PDF-Objekte bearbeiten')
        page.get_by_role('button',name='Seitenobjekte laden',exact=True).click()
        page.get_by_label('Objekt auswählen',exact=True).select_option(index=1)
        page.get_by_label('Textinhalt',exact=True).fill('FIREFOX TEXT GEANDERT 456.')
        page.get_by_role('button',name='Objektänderung exportieren',exact=True).click()
        with pymupdf.open(output(page,'text-edit.pdf','.advanced-result a[download]')) as pdf:
            assert 'FIREFOX TEXT GEANDERT 456' in pdf[0].get_text()
            assert 'FIREFOX ORIGINAL 123' not in pdf[0].get_text()
            assert 'ZWEITE SEITE BLEIBT ERHALTEN' in pdf[1].get_text()

    def projects(page):
        fresh(page);page.locator('.project-toggle').click()
        page.get_by_label('Projektname',exact=True).fill('Firefox Pruefung')
        page.get_by_role('button',name='Projekt speichern',exact=True).click()
        expect(page.get_by_text('Alles an Bord – gespeichert.',exact=True).first).to_be_visible()
        page.reload();page.locator('.project-toggle').click()
        page.get_by_role('button',name='Öffnen',exact=True).click()
        expect(page.locator('.chooser-tool')).to_have_count(112)
        tool(page,'Seiten organisieren');page.get_by_role('button',name='Seiten speichern',exact=True).click()
        with pymupdf.open(output(page,'restored-project.pdf')) as pdf:
            assert len(pdf)==2 and 'FIREFOX ORIGINAL 123' in pdf[0].get_text()

    def ocr(page):
        fresh(page,scan);tool(page,'OCR & Text')
        page.get_by_role('button',name='Text erkennen',exact=True).click()
        with pymupdf.open(output(page,'ocr.pdf')) as pdf:
            assert 'Rechnung 12345' in pdf[0].get_text(),pdf[0].get_text()

    def office(page):
        page.goto(origin)
        assert page.evaluate('crossOriginIsolated')
        page.locator('input[type=file]').first.set_input_files('tests/fixtures/office/sample.docx')
        expect(page.locator('main h1')).to_have_text('Office zu PDF')
        page.get_by_role('button',name='PDF erstellen',exact=True).click()
        with pymupdf.open(output(page,'office.pdf',timeout=180000)) as pdf:
            assert len(pdf)>=1 and len(''.join(p.get_text() for p in pdf).strip())>10

    for name,fn in [('PDF preview, actual download and independent readback',roundtrip),
                    ('PDFium text edit preserves second page',edit),
                    ('IndexedDB project survives reload and restores bytes',projects),
                    ('Real OCR creates searchable PDF',ocr),
                    ('Local LibreOffice DOCX conversion',office)]:
        print('START: '+name,flush=True);start=time.monotonic()
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,reduced_motion='reduce')
        page=context.new_page();page.set_default_timeout(20000)
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        result={'name':name}
        try:
            fn(page);assert not errors,errors
            result['status']='passed'
        except Exception as error:
            result.update(status='failed',error=str(error),traceback=traceback.format_exc())
            print(result['traceback'],flush=True)
        finally:
            result.update(seconds=round(time.monotonic()-start,1),pageErrors=errors)
            report['results'].append(result)
            (out/'firefox-focused.json').write_text(json.dumps(report,indent=2))
            try:page.screenshot(path=str(out/(re.sub(r'[^a-z0-9]+','-',name.lower())+'.png')),timeout=10000)
            except Exception:pass
            print(result['status'].upper()+': '+name,flush=True)
            context.close()
    browser.close()
print(json.dumps(report,indent=2),flush=True)
raise SystemExit(1 if any(r['status']!='passed' for r in report['results']) else 0)
