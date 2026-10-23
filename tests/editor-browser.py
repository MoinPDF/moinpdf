"""Editor acceptance against the production build; exports independently read by MuPDF.
MOINPDF_TEST_BROWSERS=chromium,firefox,webkit (default all), MOINPDF_TEST_URL required.
All fixture data is synthetic and every off-origin request/document POST is blocked.
"""
import json
import os
import re
import traceback
import atexit
import subprocess
import time
from urllib.request import urlopen
from pathlib import Path
from urllib.parse import urlsplit
import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.environ.get('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path(os.environ.get('MOINPDF_BROWSER_OUTPUT','.cache/editor-browser'));out.mkdir(parents=True, exist_ok=True)
if os.environ.get('MOINPDF_TEST_START_SERVER') == '1':
    server_log=open(out/'http.log','w')
    server=subprocess.Popen(['python','tests/text-browser-server.py'],stdout=server_log,stderr=subprocess.STDOUT)
    atexit.register(server.terminate)
    for attempt in range(50):
        try:
            with urlopen(origin,timeout=1) as response:
                if response.status==200:break
        except OSError:time.sleep(.1)
    else:raise RuntimeError('Local production test server did not start')
report = {'results': [], 'limitations': ['Synthetic documents; not a corpus of customer PDFs.', 'WebKit is not native Safari or a physical iPhone.']}

def fixtures():
    source = out/'source.pdf'
    with pymupdf.open() as d, pymupdf.open() as scan:
        p=d.new_page(width=500,height=700)
        p.draw_rect(p.rect,color=None,fill=(.83,.91,.98))
        p.insert_text((50,100),'ORIGINAL 4815',fontsize=18)
        p.draw_line((40,105),(460,105),color=(.8,.1,.1),width=.4)
        p.insert_text((50,640),'KEEP FOOTER',fontsize=12)
        p.insert_link({'kind':pymupdf.LINK_URI,'from':pymupdf.Rect(350,620,470,650),'uri':'https://example.org/'})
        sp=scan.new_page(width=500,height=700)
        sp.insert_text((50,100),'Rechnung 2026',fontsize=24)
        sp.insert_text((50,200),'Betrag 125,50 EUR',fontsize=24)
        png=sp.get_pixmap(matrix=pymupdf.Matrix(2,2)).tobytes('png')
        sp=d.new_page(width=500,height=700);sp.insert_image(sp.rect,stream=png)
        # This existing OCR layer has the exact same geometry as the scan.
        sp.insert_text((50,100),'Rechnung 2026',fontsize=24,render_mode=3)
        sp.insert_text((50,200),'Betrag 125,50 EUR',fontsize=24,render_mode=3)
        hidden=out/'searchable-scan.pdf'
        with pymupdf.open() as one:
            one.insert_pdf(d,from_page=1,to_page=1);one.save(hidden)
        mixed=d.new_page(width=420,height=500)
        mixed.insert_text((30,50),'NATIVE MIXED',fontsize=18)
        mixed.insert_image(pymupdf.Rect(0,80,420,480),stream=png,keep_proportion=False)
        d.save(source)
    return source, hidden

print('Preparing fixtures',flush=True)
source,scan=fixtures()
print('Fixtures ready',flush=True)

def check_pixels(a,b,page_index):
    # MuPDF caches downsampled images by object identity. A shared source image
    # and copied destination images must both start with an empty render cache.
    pymupdf.TOOLS.store_shrink(100)
    pa=a[page_index].get_pixmap(matrix=pymupdf.Matrix(1,1))
    pymupdf.TOOLS.store_shrink(100)
    pb=b[page_index].get_pixmap(matrix=pymupdf.Matrix(1,1))
    assert (pa.width,pa.height)==(pb.width,pb.height)
    # Independent renderer should see the unchanged page, including invisible OCR.
    assert pa.samples==pb.samples, 'Unchanged page pixels differ'

def run_case(browser, name, width, path, scan_case=False, english=False):
    context=browser.new_context(viewport={'width':width,'height':1000},accept_downloads=True,reduced_motion='reduce',locale='en-GB' if english else 'de-DE')
    page=context.new_page();page.set_default_timeout(45000)
    errors=[];blocked=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def route(r):
        if r.request.method not in ('GET','HEAD') or (urlsplit(r.request.url).netloc!=urlsplit(origin).netloc and not r.request.url.startswith(('blob:','data:'))):
            blocked.append({'method':r.request.method,'url':r.request.url});r.abort()
        else:r.continue_()
    page.route('**/*',route)
    result={'case':name,'viewport':width};reopen=None;rp=None
    try:
        print('START: '+name,flush=True)
        page.goto(origin)
        if english:
            page.locator('.language-trigger').click();page.get_by_role('menuitemradio',name='English',exact=True).click()
        page.locator('input[type=file]').first.set_input_files(str(path.resolve()))
        title='Edit PDF' if english else 'PDF bearbeiten'
        page.locator('.chooser-tool').filter(has=page.get_by_text(title,exact=True)).click()
        target=page.get_by_role('button',name=re.compile(('Edit text: ' if english else 'Text bearbeiten: ')+('Rechnung 2026' if scan_case else 'ORIGINAL 4815')))
        print(name+': waiting for text targets',flush=True)
        expect(target).to_be_visible(timeout=120000)
        zoom=page.get_by_label('PDF page zoom' if english else 'Zoom der PDF-Seite',exact=True)
        holder=page.locator('.editor-page-scroll .canvas-holder')
        initial_page_width=holder.evaluate('(el) => getComputedStyle(el).width')
        before_width=target.bounding_box()['width']
        zoom.select_option('400')
        expect(holder).to_have_css('max-width','2880px')
        assert target.bounding_box()['width']>before_width*3.5, '400% zoom must enlarge the actual PDF page'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'Zoom leaked outside page scroller'
        zoom.select_option('100')
        # React can commit the zoom after select_option returns. Never cache a
        # click offset from the previous 400% page geometry.
        expect(holder).to_have_css('width',initial_page_width)
        box=target.bounding_box()
        target.click(position={'x':box['width']*.55,'y':box['height']*.55})
        print(name+': text selected',flush=True)
        field=page.get_by_label('Edit text directly in the PDF' if english else 'Text direkt in der PDF bearbeiten',exact=True)
        expect(field).to_be_focused()
        caret=field.evaluate('(el) => {const s=getSelection(),r=document.createRange();r.selectNodeContents(el);r.setEnd(s.focusNode,s.focusOffset);return r.toString().length}')
        assert 0<caret<len('Rechnung 2026' if scan_case else 'ORIGINAL 4815'),('First click caret',caret)
        if scan_case:
            page.get_by_text('Scantext prüfen und korrigieren',exact=True).click()
            expect(page.get_by_label('OCR-Korrektur',exact=True)).to_have_value('Rechnung 2026')
            expect(page.locator('.editor-ocr-review img')).to_be_visible()
            page.get_by_role('button',name='Diesen Bereich erneut erkennen',exact=True).click()
            suggestion=page.get_by_label('Erkennungsvorschlag',exact=True)
            expect(suggestion).to_be_visible(timeout=120000)
            assert 'Rechnung' in suggestion.input_value(),suggestion.input_value()
            suggestion.fill('BELEG')
            page.get_by_role('button',name='Korrektur übernehmen',exact=True).click()
            expect(field).to_have_text('BELEG')
            field.press('Control+z');expect(field).to_have_text('Rechnung 2026')
            page.get_by_text('Scantext prüfen und korrigieren',exact=True).click()
        original='Rechnung 2026' if scan_case else 'ORIGINAL 4815'
        replacement='BELEG' if scan_case else 'NEU ÄÖÜ €'
        field.fill(replacement)
        expect(field).to_have_text(replacement)
        field.press('Control+z');expect(field).to_have_text(original)
        field.press('Control+Shift+z');expect(field).to_have_text(replacement)
        field.press('Control+z');expect(field).to_have_text(original)
        field.press('Control+y');expect(field).to_have_text(replacement)
        print(name+': undo/redo passed',flush=True)
        if not scan_case:
            # A real native selection spans only the first word, including on the small viewport.
            field.press('Home')
            for _ in range(3):field.press('Shift+ArrowRight')
            assert field.evaluate('getSelection().toString()')=='NEU'
            field.press('Control+b');field.press('Control+i')
            toolbar=page.get_by_role('toolbar',name='Format text directly' if english else 'Text direkt formatieren')
            toolbar.get_by_label('Text colour' if english else 'Textfarbe',exact=True).fill('#006644')
            expect(field.locator('span').filter(has_text=re.compile('^NEU$'))).to_have_css('font-weight','700')
            expect(field.locator('span').filter(has_text=re.compile('^NEU$'))).to_have_css('font-style','italic')
            # Mixed formatting is explicit; toggling from mixed applies to the entire selection.
            field.press('Control+a')
            expect(toolbar.get_by_role('button',name='Bold' if english else 'Fett',exact=True)).to_have_attribute('aria-pressed','mixed')
            toolbar.get_by_role('button',name='Bold' if english else 'Fett',exact=True).click()
            expect(field).to_be_focused()
            field.press('Control+z')
            # Search is scoped to this text box, replacements retain styles and share undo/redo.
            field.press('Control+h')
            search=page.get_by_role('region',name='Find and replace in text box' if english else 'Suchen und ersetzen im Textfeld')
            expect(search).to_be_visible()
            search.get_by_label('Find text' if english else 'Suchtext',exact=True).fill('NEU')
            search.get_by_label('Replace with' if english else 'Ersetzen durch',exact=True).fill('ALT')
            search.get_by_role('button',name='Next match' if english else 'Nächster Treffer',exact=True).click()
            expect(field).to_be_focused()
            assert field.evaluate('getSelection().toString()')=='NEU'
            search.get_by_role('button',name='Replace all in text box' if english else 'Alle im Textfeld ersetzen',exact=True).click()
            expect(field).to_have_text('ALT ÄÖÜ €')
            search.get_by_role('button',name='Close search' if english else 'Suche schließen',exact=True).click()
            expect(field).to_be_focused()
            field.press('Control+z');expect(field).to_have_text(replacement)
            field.press('Control+Shift+z');expect(field).to_have_text('ALT ÄÖÜ €')
            field.press('Control+z');expect(field).to_have_text(replacement)
            # An explicit layout proposal changes nothing before acceptance.
            page.locator('.editor-layout-help > summary').click()
            size=toolbar.get_by_label('Font size in points' if english else 'Textgröße in Punkt',exact=True)
            old_size=size.input_value()
            page.get_by_role('button',name='Reduce font size slightly' if english else 'Schrift etwas verkleinern',exact=True).click()
            expect(page.get_by_label('Adjustment preview' if english else 'Anpassungsvorschau',exact=True)).to_be_visible()
            assert size.input_value()==old_size
            page.get_by_role('button',name='Discard' if english else 'Verwerfen',exact=True).click()
            page.locator('.editor-layout-help > summary').click()
        if not scan_case:
            # Wait for physical-removal preview rather than white rectangle overlay.
            expect(page.locator('.editor-sheet .editor-erasure')).to_have_count(0,timeout=120000)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'Horizontal viewport overflow'
        page.screenshot(path=str(out/(name+'-edit.png')),full_page=True)
        action='Create edited PDF' if english else 'Bearbeitete PDF erstellen'
        page.get_by_role('button',name=action,exact=True).click()
        print(name+': exporting',flush=True)
        link=page.get_by_role('link',name='Download PDF' if english else 'PDF herunterladen',exact=True).first
        expect(link.or_(page.locator('.error-box'))).to_be_visible(timeout=150000)
        assert link.is_visible(), page.locator('.error-box').inner_text()
        with page.expect_download() as pending:link.click()
        exported=out/(name+'.pdf');pending.value.save_as(exported)
        print(name+': downloaded',flush=True)
        comparison=page.get_by_role('region',name='Export verification and comparison' if english else 'Exportprüfung und Vergleich')
        expect(comparison).to_be_visible()
        expect(comparison.get_by_role('button',name='Side by side' if english else 'Nebeneinander',exact=True)).to_have_attribute('aria-pressed','true')
        with pymupdf.open(exported) as edited,pymupdf.open(path) as before:
            text=edited[0].get_text()
            assert replacement in text,(name,text)
            assert original not in text,(name,text)
            if scan_case:
                assert text.count('BELEG')==1 and text.count('Betrag')==1,text
            else:
                assert 'KEEP FOOTER' in text,text
                spans=[s for b in edited[0].get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans']]
                first=next(s for s in spans if s['text'].strip()=='NEU')
                assert first['flags'] & 16 and first['flags'] & 2,first
                assert first['color']==0x006644,first
                rest=next(s for s in spans if 'ÄÖÜ' in s['text'])
                assert not rest['flags'] & 16 and not rest['flags'] & 2,rest
                assert len(edited[0].get_links())==1,'Link lost'
                assert len(edited)==3
                check_pixels(before,edited,1)
                check_pixels(before,edited,2)
                assert edited[2].get_text().count('NATIVE MIXED')==1
                edited[0].get_pixmap(matrix=pymupdf.Matrix(1.5,1.5)).save(out/(name+'-export.png'))
        # Reopen the actual download in the same application, then inspect targets.
        reopen=browser.new_context(viewport={'width':width,'height':1000})
        rp=reopen.new_page();rp.set_default_timeout(45000);rp.on('pageerror',lambda e:errors.append('Reopen: '+str(e)));rp.route('**/*',route);rp.goto(origin)
        rp.locator('input[type=file]').first.set_input_files(str(exported.resolve()))
        rp.locator('.chooser-tool').filter(has=rp.get_by_text('PDF bearbeiten',exact=True)).click()
        if not scan_case:
            # Font changes split PDF text objects; paragraph mode must recover one selectable line.
            selection_options=rp.locator('.editor-selection-options > summary')
            expect(selection_options).to_be_visible(timeout=120000)
            selection_options.click()
            paragraph_mode=rp.get_by_role('button',name='Absätze',exact=True)
            # The fresh context must finish local page/font analysis before
            # paragraph selection is available, just as on the initial import.
            expect(paragraph_mode).to_be_visible(timeout=120000)
            paragraph_mode.click()
        expect(rp.get_by_role('button',name='Text bearbeiten: '+replacement,exact=True)).to_be_visible(timeout=120000)
        if english:
            assert 'Die Originalschrift' not in page.locator('body').inner_text(), 'Untranslated font substitution warning'
        assert not errors,errors
        assert not blocked,blocked
        result.update(status='passed',page_errors=errors,blocked_requests=blocked)
    except Exception as e:
        result.update(status='failed',error=str(e),traceback=traceback.format_exc(),page_errors=errors,blocked_requests=blocked)
        print(result['traceback'],flush=True)
        try:
            if rp:
                rp.screenshot(path=str(out/(name+'-reopen-failure.png')),full_page=True,timeout=10000)
                (out/(name+'-reopen-failure.txt')).write_text(rp.locator('body').inner_text(timeout=5000))
            page.screenshot(path=str(out/(name+'-failure.png')),full_page=True,timeout=10000)
            (out/(name+'-failure.txt')).write_text(page.locator('body').inner_text(timeout=5000))
        except Exception as capture_error:result['capture_error']=str(capture_error)
    finally:
        if reopen:reopen.close()
        report['results'].append(result);context.close()
        (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(result['status'].upper()+': '+name,flush=True)

with sync_playwright() as api:
    for kind in os.environ.get('MOINPDF_TEST_BROWSERS','chromium,firefox,webkit').split(','):
        print('Launching '+kind,flush=True)
        try:browser=getattr(api,kind).launch()
        except Exception as e:
            report['results'].append({'case':kind,'status':'unavailable','error':str(e)})
            (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));continue
        report[kind]=browser.version
        run_case(browser,kind+'-desktop',1440,source)
        run_case(browser,kind+'-mobile',390,source)
        run_case(browser,kind+'-scan',1440,scan,scan_case=True)
        run_case(browser,kind+'-english',1440,source,english=True)
        browser.close()
raise SystemExit(0 if all(r['status']=='passed' for r in report['results']) else 1)
