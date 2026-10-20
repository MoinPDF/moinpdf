"""Browser acceptance for editor quality controls and pinned public PDFs.
Physical devices and native Safari are not represented by this test.
"""
import atexit
import base64
import json
import os
import re
import subprocess
import time
import traceback
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.environ.get('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path('.cache/editor-browser'); out.mkdir(parents=True, exist_ok=True)
corpus = Path('.cache/editor-corpus')
if os.environ.get('MOINPDF_TEST_START_SERVER') == '1':
    log = open(out / 'workflow-http.log', 'w')
    server = subprocess.Popen(['python', 'tests/text-browser-server.py'], stdout=log, stderr=subprocess.STDOUT)
    atexit.register(server.terminate)
    for _ in range(50):
        try:
            with urlopen(origin, timeout=1) as response:
                if response.status == 200: break
        except OSError: time.sleep(.1)
    else: raise RuntimeError('Production test server unavailable')

fixture=out/'workflow-controls.pdf'
font=Path('public/vendor/editor-fonts/DejaVuSans.ttf')
bold=Path('public/vendor/editor-fonts/DejaVuSans-Bold.ttf')
with pymupdf.open() as doc:
    p=doc.new_page(width=500,height=700)
    p.insert_font(fontname='Body',fontfile=str(font));p.insert_font(fontname='Strong',fontfile=str(bold))
    p.insert_text((50,70),'Alpha beta gamma delta epsilon',fontname='Body',fontsize=12)
    p.insert_text((50,120),'FORMAT SOURCE',fontname='Strong',fontsize=11,color=(0,.4,.2))
    p.insert_text((50,200),'FLOW BEGIN',fontname='Body',fontsize=12)
    for r in range(3):
        for c in range(3):p.insert_text((50+c*130,360+r*32),f'R{r+1}C{c+1}',fontname='Body',fontsize=11)
        p.draw_line((45,367+r*32),(445,367+r*32),width=.6,color=(.3,.3,.3))
    with pymupdf.open() as logo:
        lp=logo.new_page(width=60,height=40)
        lp.draw_rect(pymupdf.Rect(0,0,30,40),color=None,fill=(.9,0,0));lp.draw_rect(pymupdf.Rect(30,0,60,40),color=None,fill=(0,0,.9))
        p.insert_image(pymupdf.Rect(350,150,410,190),stream=lp.get_pixmap().tobytes('png'))
    p.insert_text((50,640),'KEEP PAGE ONE',fontname='Body',fontsize=12)
    p=doc.new_page(width=600,height=500);p.insert_font(fontname='Body',fontfile=str(font));p.insert_text((50,100),'FLOW END',fontname='Body',fontsize=12);p.insert_text((50,450),'KEEP PAGE TWO',fontname='Body',fontsize=12)
    doc.save(fixture)
report={'results':[],'limits':['Public and synthetic documents, no private customer documents.','Touch emulation and narrow viewports, not physical touch devices or native Safari.']}

def open_editor(page,path=fixture):
    page.goto(origin)
    page.locator('input[type=file]').first.set_input_files(str(path.resolve()))
    page.locator('.chooser-tool').filter(has=page.get_by_text('PDF bearbeiten',exact=True)).click()
    expect(page.locator('.editor-sheet > img')).to_be_visible(timeout=120000)

def pick(page,text):
    page.get_by_role('button',name='Text bearbeiten: '+text,exact=True).click()
    field=page.get_by_label('Text direkt in der PDF bearbeiten',exact=True)
    expect(field).to_be_visible();return field

def geometry(page,label,value):
    field=page.get_by_label(label,exact=True);field.fill(str(value));field.press('Tab')

def export(page,name):
    page.get_by_role('button',name='Bearbeitete PDF erstellen',exact=True).click()
    link=page.get_by_role('link',name='PDF herunterladen',exact=True).first
    expect(link.or_(page.locator('.error-box'))).to_be_visible(timeout=240000)
    assert link.is_visible(),page.locator('.error-box').inner_text()
    review=page.get_by_role('region',name='Exportprüfung und Vergleich')
    (out/(name+'-verification.txt')).write_text(review.inner_text())
    with page.expect_download() as task:link.click()
    file=out/(name+'.pdf');task.value.save_as(file)
    return file

def text_table(page,name):
    open_editor(page)
    pick(page,'Alpha beta gamma delta epsilon').fill('Alpha beta delta delta epsilon')
    page.get_by_role('button',name='Fertig',exact=True).click()
    pick(page,'FORMAT SOURCE')
    page.get_by_role('button',name='Format aufnehmen',exact=True).click()
    page.get_by_role('button',name='Fertig',exact=True).click()
    page.get_by_role('button',name='Tabellenzellen',exact=True).click()
    page.get_by_role('button',name='Tabellenzelle 1, 1: R1C1',exact=True).click()
    field=page.get_by_label('Text direkt in der PDF bearbeiten',exact=True);field.fill('EDIT')
    field.press('Tab');expect(field).to_have_text('R1C2');field.fill('OTHER')
    page.get_by_role('button',name='Format übertragen',exact=True).click()
    expect(page.get_by_role('toolbar',name='Text direkt formatieren').get_by_role('button',name='Fett',exact=True)).to_have_attribute('aria-pressed','true')
    field.press('Shift+Tab');expect(field).to_have_text('EDIT')
    changes=page.locator('.editor-workflow-section').filter(has=page.locator('summary').filter(has_text='Änderungen im Dokument'))
    changes.locator('summary').click()
    entry=changes.locator('.editor-change-entry').filter(has_text='Nachher: EDIT')
    entry.get_by_role('button',name='Diese Änderung zurücknehmen',exact=True).click()
    expect(page.get_by_role('button',name='Tabellenzelle 1, 1: R1C1',exact=True)).to_be_visible()
    page.get_by_role('button',name='Rückgängig',exact=True).click()
    expect(changes.locator('.editor-change-entry').filter(has_text='Nachher: EDIT')).to_have_count(1)
    page.get_by_role('button',name='Wiederholen',exact=True).click()
    assert page.get_by_label('Maßeinheit',exact=True).count()==0 or page.get_by_label('Maßeinheit',exact=True).input_value()=='mm'
    page.get_by_label('Touch-Modus',exact=True).check()
    page.get_by_role('button',name='Tabellenzelle 1, 1: R1C1',exact=True).click()
    expect(page.locator('.editor-move-handle')).to_have_css('min-width','44px')
    page.get_by_role('button',name='Mehr Textoptionen',exact=True).click()
    expect(page.get_by_label('Eigene Schriftdatei',exact=True)).to_be_visible()
    page.get_by_role('button',name='Weniger Textoptionen',exact=True).click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
    page.screenshot(path=str(out/(name+'-page.png')),full_page=True)
    saved=export(page,name)
    assert 'Schriftbild weicht' not in (out/(name+'-verification.txt')).read_text()
    assert 'Textfelder mit erhaltenen Originalzeichen' in (out/(name+'-verification.txt')).read_text()
    with pymupdf.open(saved) as after,pymupdf.open(fixture) as before:
        text=after[0].get_text(sort=True);assert 'gamma' not in text and 'Alpha beta' in text and 'delta delta epsilon' in text
        assert 'R1C1' in text and 'OTHER' in text and 'R1C2' not in text
        spans=[s for b in after[0].get_text('dict')['blocks'] if 'lines'in b for l in b['lines'] for s in l['spans'] if 'OTHER'in s['text']]
        assert len(spans)==1 and 'Bold'in spans[0]['font'] and spans[0]['color']!=0,spans
        pymupdf.TOOLS.store_shrink(100);a=before[1].get_pixmap();pymupdf.TOOLS.store_shrink(100);b=after[1].get_pixmap();assert a.samples==b.samples
    return {'scope':'word preservation, table Tab navigation, format painter, independent revert, undo/redo, touch controls, reopened text/fonts and untouched page pixels'}

def flow(page,name):
    open_editor(page)
    text='Linked text keeps formatting and crosses into the next frame. '*9
    pick(page,'FLOW BEGIN').fill(text)
    geometry(page,'Objektbreite',100);geometry(page,'Objekthöhe',35)
    page.get_by_role('button',name='Nächste Seite',exact=True).click()
    pick(page,'FLOW END')
    geometry(page,'Objektbreite',100);geometry(page,'Objekthöhe',50)
    panel=page.locator('.editor-workflow-section').filter(has=page.locator('summary').filter(has_text='Textfelder verknüpfen'))
    panel.locator('summary').click()
    expect(panel.locator('.editor-flow-fields input[type=checkbox]')).to_have_count(2)
    for box in panel.locator('.editor-flow-fields input[type=checkbox]').all():box.check()
    panel.get_by_role('button',name='Textfluss vorschauen',exact=True).click()
    expect(panel.locator('.editor-flow-preview')).to_be_visible(timeout=90000)
    assert 'Linked text' in panel.locator('.editor-flow-preview p').nth(1).inner_text()
    panel.get_by_role('button',name='Textfluss übernehmen',exact=True).click()
    page.get_by_role('button',name='Rückgängig',exact=True).click()
    page.get_by_role('button',name='Wiederholen',exact=True).click()
    saved=export(page,name)
    with pymupdf.open(saved) as doc:
        assert len(doc)==2 and tuple(doc[0].rect)[2:] == (500,700) and tuple(doc[1].rect)[2:]==(600,500)
        combined=' '.join(p.get_text(sort=True) for p in doc)
        assert combined.count('Linked text')==9,combined
        assert 'FLOW BEGIN' not in combined and combined.count('FLOW END')==1
        assert 'Linked text'in doc[1].get_text()
        assert 'KEEP PAGE ONE'in combined and 'KEEP PAGE TWO'in combined
    return {'scope':'previewed multi-page text flow, different page sizes, atomic undo/redo and independent export'}

def images(page,name):
    open_editor(page)
    page.get_by_role('button',name='Bilder und Logos',exact=True).click()
    target=page.get_by_role('button',name=re.compile('^Vorhandenes Bild auswählen '));expect(target).to_have_count(1,timeout=120000);target.click()
    geometry(page,'Objekt links',90)
    page.get_by_role('button',name='Bildinhalt zum Zuschneiden anzeigen',exact=True).click()
    expect(page.get_by_alt_text('Bildinhalt vor dem Zuschneiden',exact=True)).to_be_visible(timeout=90000)
    page.get_by_label('Bildzuschnitt w',exact=True).fill('50')
    page.get_by_role('button',name='Bildzuschnitt übernehmen',exact=True).click()
    saved=export(page,name)
    with pymupdf.open(saved) as doc,pymupdf.open(fixture) as before:
        assert doc[0].get_text()==before[0].get_text()
        image=doc[0].get_images(full=True)[0];pix=pymupdf.Pixmap(doc,image[0]);assert pix.width==30
        data=pix.samples;assert all(data[i]>=220 and data[i+2]<5 for i in range(0,len(data),pix.n))
        boxes=doc[0].get_image_rects(image[0]);assert abs(boxes[0].x0-90*72/25.4)<.05
        pymupdf.TOOLS.store_shrink(100);a=before[1].get_pixmap();pymupdf.TOOLS.store_shrink(100);b=doc[1].get_pixmap();assert a.samples==b.samples
    return {'scope':'native image selection, millimetre move, destructive pixel crop, unchanged text and other page'}

def french(page,name):
    open_editor(page,corpus/'francais.pdf')
    page.get_by_label('Sprache gescannter Texte',exact=True).click()
    page.get_by_role('option',name='Französisch',exact=True).click()
    target=page.get_by_role('button',name=re.compile('^Text bearbeiten: Portez')).first;expect(target).to_be_visible(timeout=180000);target.click()
    page.get_by_text('Scantext prüfen und korrigieren',exact=True).click()
    page.get_by_role('button',name='Diesen Bereich erneut erkennen',exact=True).click()
    expect(page.locator('.editor-ocr-variants > div')).to_have_count(2,timeout=180000)
    page.get_by_label('OCR-Korrektur',exact=True).fill('Été')
    page.get_by_role('toolbar',name='Text direkt formatieren').get_by_label('Textgröße in Punkt',exact=True).fill('6')
    saved=export(page,name)
    with pymupdf.open(saved) as doc:assert doc[0].get_text().count('Été')==1
    return {'scope':'pinned public French scan, local model, original/processed OCR variants, accent correction and independent Unicode export'}

def execute(browser,name,width,callback):
    context=browser.new_context(viewport={'width':width,'height':1000},accept_downloads=True,reduced_motion='reduce',has_touch=width<600)
    page=context.new_page();page.set_default_timeout(45000);errors=[];blocked=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def route(r):
        if r.request.method not in ('GET','HEAD') or (urlsplit(r.request.url).netloc!=urlsplit(origin).netloc and not r.request.url.startswith(('blob:','data:'))):blocked.append(r.request.url);r.abort()
        else:r.continue_()
    page.route('**/*',route);result={'case':name,'viewport':width};print('START: '+name,flush=True)
    try:
        details=callback(page,name);assert not errors,errors;assert not blocked,blocked;result.update(status='passed',**details)
    except Exception as e:
        result.update(status='failed',error=str(e),traceback=traceback.format_exc(),page_errors=errors,blocked_requests=blocked);print(result['traceback'],flush=True)
        try:page.screenshot(path=str(out/(name+'-failure.png')),full_page=True,timeout=10000);(out/(name+'-failure.txt')).write_text(page.locator('body').inner_text(timeout=5000))
        except Exception:pass
    finally:
        report['results'].append(result);(out/'workflow-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));context.close();print(result['status'].upper()+': '+name,flush=True)

with sync_playwright() as api:
    for engine in os.environ.get('MOINPDF_TEST_BROWSERS','chromium,firefox,webkit').split(','):
        browser=getattr(api,engine).launch();report[engine]=browser.version
        execute(browser,engine+'-workflow-text',1440,text_table)
        execute(browser,engine+'-workflow-touch',390,text_table)
        execute(browser,engine+'-workflow-flow',1440,flow)
        execute(browser,engine+'-workflow-images',1440,images)
        execute(browser,engine+'-workflow-french',1440,french)
        browser.close()
raise SystemExit(0 if all(r['status']=='passed'for r in report['results'])else 1)
