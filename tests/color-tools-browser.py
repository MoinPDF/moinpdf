"""End-to-end colors and read-only field unlocking, fictional files, real downloads."""
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
out=Path('.cache/editor-browser/color-tools');out.mkdir(parents=True,exist_ok=True)
if os.getenv('MOINPDF_TEST_START_SERVER')=='1':
    log=(out/'http.log').open('w')
    server=subprocess.Popen([sys.executable,'tests/text-browser-server.py'],stdout=log,stderr=subprocess.STDOUT)
    def cleanup():
        server.terminate();server.wait(timeout=10);log.close()
    atexit.register(cleanup)
    for _ in range(50):
        try:
            with urlopen(origin,timeout=1) as response:
                if response.status==200:break
        except OSError:time.sleep(.1)
    else:raise RuntimeError('Production test server unavailable')
fixture=out/'fictional-colors.pdf'
with pymupdf.open() as doc:
    p=doc.new_page(width=300,height=400)
    p.insert_text((30,60),'FICTIONAL COLOR TEXT',fontsize=16)
    p.draw_rect(pymupdf.Rect(100,200,150,250),fill=(1,0,0),color=None)
    for i,name in enumerate(['Unlock me','Keep locked']):
        w=pymupdf.Widget();w.field_name=name;w.field_type=pymupdf.PDF_WIDGET_TYPE_TEXT
        w.rect=pymupdf.Rect(20,300+i*35,180,325+i*35);w.field_value='Saved '+str(i);w.field_flags=1
        p.add_widget(w)
    doc.save(fixture)
reports=[]
with sync_playwright() as api:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS','chromium').split(','):
        browser=getattr(api,engine).launch()
        try:
            for en in (False,True):
                context=browser.new_context(viewport={'width':390 if en else 1440,'height':950},has_touch=en,accept_downloads=True,reduced_motion='reduce')
                page=context.new_page();page.set_default_timeout(60000);errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                name=engine+('-touch-en' if en else '-desktop-de')
                def t(de,english):return english if en else de
                def button(de,english):return page.get_by_role('button',name=t(de,english),exact=True)
                def label(de,english):return page.get_by_label(t(de,english),exact=True)
                def choose(de,english):page.locator('.chooser-tool').filter(has=page.get_by_text(t(de,english),exact=True)).click()
                def download(suffix):
                    link=page.locator('.advanced-result a[download][href^="blob:"]').first
                    expect(link).to_be_visible(timeout=120000)
                    with page.expect_download(timeout=120000) as event:link.click()
                    path=out/(name+suffix+'.pdf');event.value.save_as(path);return path
                try:
                    page.goto(origin+('?lang=en' if en else '?lang=de'))
                    page.locator('input[type=file]').first.set_input_files(str(fixture.resolve()))
                    expect(page.locator('.chooser-tool')).to_have_count(120)
                    choose('Farben & Hintergrund ändern','Change colors & background')
                    # PagePreview intentionally renders only near the viewport.
                    for preview in page.locator('.document-color-preview section').all():
                        preview.scroll_into_view_if_needed()
                        expect(preview.locator('img')).to_be_visible(timeout=120000)
                    label('Textfarbe','Text colour').fill('#0000ff')
                    label('Hintergrundfarbe','Background color').fill('#ffff00')
                    expect(button('Farben auf alle Seiten anwenden','Apply colors to all pages')).to_be_enabled(timeout=120000)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2')
                    page.screenshot(path=str(out/(name+'-colors.png')),full_page=True)
                    button('Farben auf alle Seiten anwenden','Apply colors to all pages').click()
                    with pymupdf.open(download('-colors')) as doc:
                        spans=[s for b in doc[0].get_text('dict')['blocks'] if 'lines' in b for line in b['lines'] for s in line['spans']]
                        assert any('FICTIONAL' in s['text'] and s['color']==255 for s in spans),spans
                        assert doc[0].get_pixmap().pixel(280,20)==(255,255,0)
                        widgets={w.field_name:w for w in doc[0].widgets()}
                        assert widgets['Unlock me'].field_value=='Saved 0' and widgets['Unlock me'].field_flags&1
                    # Changing settings removes the stale export and persists on remount.
                    button('Graustufen-Druck','Grayscale print').click()
                    expect(page.locator('.advanced-result')).to_have_count(0)
                    expect(label('Sättigung','Saturation')).to_have_value('0')
                    button('Zurück zur Auswahl','Back to selection').click()
                    choose('Farben & Hintergrund ändern','Change colors & background')
                    expect(label('Sättigung','Saturation')).to_have_value('0')
                    button('Zurück zur Auswahl','Back to selection').click()
                    choose('Formularhelfer','Form helper')
                    button('Formularfelder laden','Load form fields').click()
                    page.get_by_text(t('Schreibgeschützte Formularfelder freigeben','Unlock read-only form fields'),exact=True).click()
                    label('Unlock me','Unlock me').check()
                    expect(label('Keep locked','Keep locked')).not_to_be_checked()
                    expect(label('Formularwerte dauerhaft festschreiben','Permanently flatten form values')).to_have_count(0)
                    label('Ich habe Angaben und Positionen am Original geprüft.','I have checked the details and positions against the original.').check()
                    button('Ausgefüllte PDF erstellen','Create completed PDF').click()
                    with pymupdf.open(download('-unlocked')) as doc:
                        widgets={w.field_name:w for w in doc[0].widgets()}
                        assert widgets['Unlock me'].field_value=='Saved 0' and not widgets['Unlock me'].field_flags&1
                        assert widgets['Keep locked'].field_value=='Saved 1' and widgets['Keep locked'].field_flags&1
                    assert not errors,errors
                    reports.append({'case':name,'passed':True})
                except Exception as error:
                    print('FAILED',name,'page errors:',errors,'visible tool:',page.locator('.advanced-workbench').inner_text() if page.locator('.advanced-workbench').count() else page.locator('main').inner_text())
                    reports.append({'case':name,'passed':False,'error':str(error),'pageErrors':errors})
                    page.screenshot(path=str(out/(name+'-failure.png')),full_page=True)
                    raise
                finally:
                    (out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));context.close()
        finally:browser.close()
print('PASS: real color and selective form-unlock downloads, previews, drafts, DE/EN and touch layout.')
