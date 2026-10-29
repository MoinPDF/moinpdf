"""Fictional PDF cleanup in DE desktop and EN touch emulation; real downloads."""
import atexit
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen
import pymupdf
from playwright.sync_api import sync_playwright, expect
origin=os.getenv('MOINPDF_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path('.cache/editor-browser/header-footer');out.mkdir(parents=True,exist_ok=True)
if os.getenv('MOINPDF_TEST_START_SERVER')=='1':
    log=(out/'http.log').open('w');server=subprocess.Popen([sys.executable,'tests/text-browser-server.py'],stdout=log,stderr=subprocess.STDOUT)
    def cleanup():
        server.terminate();server.wait(timeout=10);log.close()
    atexit.register(cleanup)
    for _ in range(50):
        try:
            with urlopen(origin,timeout=1) as response:
                if response.status==200:break
        except OSError:time.sleep(.1)
    else:raise RuntimeError('Production server unavailable')
fixture=out/'fictional-headers.pdf'
with pymupdf.open() as doc:
    for i in range(4):
        page=doc.new_page(width=600,height=800)
        page.insert_text((45,40),'example.test/article',fontsize=12)
        page.insert_text((245,775),f'Seite {i+1} von 4',fontsize=10)
        page.insert_text((45,380),f'KEEP BODY {i+1} - 1234 Euro',fontsize=15)
        page.draw_rect(pymupdf.Rect(45,450,145,520),color=None,fill=(.2,.8,.4))
    doc.save(fixture)
scan=out/'fictional-scan.pdf'
with pymupdf.open() as source:
    p=source.new_page(width=400,height=600)
    p.draw_rect(pymupdf.Rect(30,20,180,50),color=None,fill=(0,0,1))
    p.draw_rect(pymupdf.Rect(30,240,180,320),color=None,fill=(1,0,0))
    pix=p.get_pixmap()
    with pymupdf.open() as doc:
        doc.new_page(width=400,height=600).insert_image(p.rect,stream=pix.tobytes('png'));doc.save(scan)
reports=[]
with sync_playwright() as api:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS','chromium').split(','):
        browser=getattr(api,engine).launch()
        try:
            for en in (False,True):
                context=browser.new_context(viewport={'width':390 if en else 1440,'height':950},has_touch=en,reduced_motion='reduce',accept_downloads=True)
                page=context.new_page();page.set_default_timeout(45000);errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                name=f'{engine}-'+('touch-en' if en else 'desktop-de')
                def t(de,english):return english if en else de
                def button(de,english):return page.get_by_role('button',name=t(de,english),exact=True)
                def label(de,english):return page.get_by_label(t(de,english),exact=True)
                def open_tool(path):
                    page.goto(origin+('?lang=en' if en else '?lang=de'))
                    page.locator('input[type=file]').first.set_input_files(str(path.resolve()))
                    expect(page.locator('.chooser-tool')).to_have_count(120)
                    page.locator('.chooser-tool').filter(has=page.get_by_text(t('Kopf- und Fußzeilen bereinigen','Clean up headers and footers'),exact=True)).click()
                    expect(page.get_by_role('heading',name=t('Kopf- und Fußzeilen bereinigen','Clean up headers and footers'),exact=True)).to_be_visible()
                def no_overflow():assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'),name
                def download(filename):
                    control=page.locator('.advanced-result a[download][href^="blob:"]').first
                    expect(control).to_be_visible(timeout=120000)
                    with page.expect_download(timeout=120000) as event:control.click()
                    path=out/filename;event.value.save_as(path);return path
                try:
                    open_tool(fixture)
                    button('Kopf- und Fußzeilen erkennen','Find headers and footers').click()
                    expect(page.locator('.margin-hit')).to_have_count(8,timeout=120000)
                    first_header=page.locator('.margin-hit').filter(has_text=t('Seite 1 · Kopfzeile','Page 1 · Header'))
                    first_header.get_by_role('checkbox').uncheck()
                    button('Bereinigungsvorschau','Cleanup preview').click()
                    expect(page.locator('.margin-white-area')).to_have_count(1)
                    expect(page.locator('.advanced-paper img')).to_have_count(1)
                    no_overflow();page.screenshot(path=str(out/f'{name}-preview.png'),full_page=True)
                    expect(button('Bereinigte PDF erstellen','Create cleaned PDF')).to_be_disabled()
                    label('Ich habe alle ausgewählten Fundstellen und Ausnahmen am Original geprüft.','I have checked all selected matches and exceptions against the original.').check()
                    button('Bereinigte PDF erstellen','Create cleaned PDF').click()
                    with pymupdf.open(download(name+'-cleaned.pdf')) as doc:
                        assert len(doc)==4
                        for i,p in enumerate(doc):
                            text=p.get_text();assert 'KEEP BODY' in text,text
                            assert 'Seite' not in text,text
                            assert ('example.test/article' in text)==(i==0),text
                            assert p.rect.width==600 and p.rect.height==800
                            color=p.get_pixmap().pixel(60,480);assert color[1]>190 and color[0]<70,color
                    # An edit invalidates both the previous result and its review confirmation.
                    first_header.get_by_role('checkbox').check()
                    expect(page.locator('.advanced-result')).to_have_count(0)
                    expect(button('Bereinigte PDF erstellen','Create cleaned PDF')).to_be_disabled()
                    button('Zurück zur Auswahl','Back to selection').click()
                    page.locator('.chooser-tool').filter(has=page.get_by_text(t('Kopf- und Fußzeilen bereinigen','Clean up headers and footers'),exact=True)).click()
                    expect(page.locator('.margin-hit')).to_have_count(8)
                    expect(button('Bereinigte PDF erstellen','Create cleaned PDF')).to_be_disabled()
                    page.close();page=context.new_page();page.set_default_timeout(45000);page.on('pageerror',lambda error:errors.append(str(error)))
                    open_tool(scan)
                    button('Kopf- und Fußzeilen erkennen','Find headers and footers').click()
                    expect(page.get_by_text(t('Keine wiederkehrenden Randtexte gefunden. Du kannst Bereiche manuell markieren.','No recurring margin text found. You can mark areas manually.'),exact=True)).to_be_visible(timeout=120000)
                    button('Bereich manuell markieren','Mark area manually').click()
                    for de,enlabel,value in [('Links (%)','Left (%)','5'),('Oben (%)','Top (%)','2'),('Breite (%)','Width (%)','45'),('Höhe (%)','Height (%)','8')]:label(de,enlabel).fill(value)
                    button('Randbereich hinzufügen','Add margin area').click()
                    expect(page.locator('.margin-hit')).to_have_count(1)
                    button('Bereinigungsvorschau','Cleanup preview').click()
                    no_overflow();page.screenshot(path=str(out/f'{name}-scan.png'),full_page=True)
                    label('Ich habe alle ausgewählten Fundstellen und Ausnahmen am Original geprüft.','I have checked all selected matches and exceptions against the original.').check()
                    button('Bereinigte PDF erstellen','Create cleaned PDF').click()
                    with pymupdf.open(download(name+'-scan.pdf')) as doc:
                        pix=doc[0].get_pixmap();assert pix.pixel(60,30)==(255,255,255);assert pix.pixel(60,270)==(255,0,0)
                    assert not errors,errors
                    reports.append({'case':name,'passed':True,'checks':['recurring text','varying page numbers','per-match exception','review required','real PDF text preservation/removal','page geometry','body pixels','draft restoration','result invalidation','image-only scan cleanup','responsive layout']})
                except Exception as error:
                    reports.append({'case':name,'passed':False,'error':str(error),'pageErrors':errors});page.screenshot(path=str(out/f'{name}-failure.png'),full_page=True);raise
                finally:
                    (out/'report.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False));context.close()
        finally:browser.close()
print('PASS: header/footer detection, exclusions, reviewed native deletion, body text/pixels, manual scans, drafts and desktop/touch-emulated layouts.')
