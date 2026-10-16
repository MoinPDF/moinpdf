"""Bounded functional Firefox checks while the complete view sweep runs."""
import json
import zipfile
import os
from pathlib import Path
import re
import tempfile
import time
import traceback

import pymupdf
from playwright.sync_api import sync_playwright, expect

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
    browser=api.firefox.launch(headless=True)
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

    def ocr(page):
        fresh(page,scan);tool(page,'OCR & Text')
        page.get_by_role('button',name='Text erkennen',exact=True).click()
        with pymupdf.open(output(page,'ocr.pdf')) as pdf:
            assert 'Rechnung 12345' in pdf[0].get_text(),pdf[0].get_text()

    def exports(page):
        for title,action,ext in [('PDF zu Word','Word-Datei erstellen','docx'),('PDF zu Markdown','Markdown erstellen','md'),('PDF zu HTML','HTML erstellen','html'),('PDF zu E-Book','EPUB erstellen','epub')]:
            fresh(page);tool(page,title);page.get_by_role('button',name=action,exact=True).click()
            path=output(page,'firefox.'+ext)
            if ext in ('docx','epub'):
                with zipfile.ZipFile(path) as archive:
                    text='\n'.join(archive.read(n).decode() for n in archive.namelist() if n=='word/document.xml' or n.endswith('.xhtml'))
            else:text=path.read_text(encoding='utf-8-sig')
            assert 'FIREFOX ORIGINAL 123' in text and 'ZWEITE SEITE BLEIBT ERHALTEN' in text,text

    def editor(page):
        fresh(page);tool(page,'Text bearbeiten')
        target=page.locator('.editor-text-target').first
        expect(target).to_have_attribute('aria-label',re.compile('FIREFOX ORIGINAL 123'))
        target.click();expect(page.get_by_label('Textinhalt',exact=True)).to_have_value(re.compile('FIREFOX ORIGINAL 123'))

    def structured(page):
        fresh(page);tool(page,'PDF zu strukturiertem JSON');page.get_by_role('button',name='JSON exportieren',exact=True).click()
        data=json.loads(output(page,'firefox-structure.json').read_text())
        pages=data['documents'][0]['pages'];assert len(pages)==2
        assert 'FIREFOX ORIGINAL 123' in ' '.join(i['text'] for i in pages[0]['items'])
        assert 'ZWEITE SEITE BLEIBT ERHALTEN' in ' '.join(i['text'] for i in pages[1]['items'])
        assert all(len(i['transform'])==6 and i['font'] for p in pages for i in p['items'])

    def accessible(page):
        fresh(page);tool(page,'Barrierefreiheit prüfen')
        page.get_by_label('Barrierefreiheit: Aktion',exact=True).select_option('create')
        page.get_by_role('button',name='Text der ausgewählten PDF anhängen',exact=True).click()
        expect(page.get_by_label('Text für Block 2',exact=True)).to_have_value(re.compile('FIREFOX ORIGINAL 123'))
        expect(page.get_by_label('Text für Block 3',exact=True)).to_have_value(re.compile('ZWEITE SEITE BLEIBT ERHALTEN'))

    def comparison(page):
        fresh(page)
        other=folder/'firefox-changed.pdf'
        with pymupdf.open() as pdf:
            for text in ('FIREFOX ORIGINAL 123. Rechnung 30,50 Euro.','ZWEITE SEITE BLEIBT ERHALTEN.'):
                pdf.new_page().insert_text((50,70),text,fontsize=18)
            pdf.save(other)
        page.locator('input[type=file]').first.set_input_files(str(other))
        expect(page.locator('.chooser-document-count')).to_contain_text('4 Seiten')
        tool(page,'PDFs vergleichen')
        page.get_by_role('combobox',name='Vergleichsart',exact=True).click()
        page.get_by_role('option',name='Inhalte über Seiten hinweg',exact=True).click()
        page.get_by_role('button',name='Text vergleichen',exact=True).click()
        text=output(page,'firefox-comparison.txt').read_text(encoding='utf-8-sig')
        assert '25,50' in text and '30,50' in text,text

    for name,fn in [('Real OCR creates searchable PDF',ocr),('DOCX, Markdown, HTML and EPUB preserve both pages',exports),('Editor detects text with styles',editor),('Structured text export',structured),('Accessible text draft',accessible),('Content comparison',comparison)]:
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
            (out/'firefox-text-report.json').write_text(json.dumps(report,indent=2))
            try:page.screenshot(path=str(out/(re.sub(r'[^a-z0-9]+','-',name.lower())+'.png')),timeout=10000)
            except Exception:pass
            print(result['status'].upper()+': '+name,flush=True)
            context.close()
    browser.close()
print(json.dumps(report,indent=2),flush=True)
raise SystemExit(1 if any(r['status']!='passed' for r in report['results']) else 0)
