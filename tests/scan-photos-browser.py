"""Local photo detection and actual exports in Chromium/Firefox/WebKit; fictional scans only."""
import atexit
import hashlib
import json
import math
import os
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from urllib.request import urlopen

import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.getenv('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path('.cache/editor-browser/scan-photos'); out.mkdir(parents=True, exist_ok=True)
if os.getenv('MOINPDF_TEST_START_SERVER') == '1':
    log = (out / 'http.log').open('w')
    server = subprocess.Popen([sys.executable, 'tests/text-browser-server.py'], stdout=log, stderr=subprocess.STDOUT)
    def cleanup():
        server.terminate(); server.wait(timeout=10); log.close()
    atexit.register(cleanup)
    for _ in range(50):
        try:
            with urlopen(origin, timeout=1) as response:
                if response.status == 200: break
        except OSError: time.sleep(.1)
    else: raise RuntimeError('Production test server unavailable')

fixture = out / 'fictional-photo-sheet.pdf'
png = out / 'fictional-photo-sheet.png'
with pymupdf.open() as doc:
    page = doc.new_page(width=1000, height=750)
    def photo(cx, cy, w, h, angle, color):
        a = math.radians(angle)
        pts = [pymupdf.Point(cx+x*math.cos(a)-y*math.sin(a), cy+x*math.sin(a)+y*math.cos(a))
               for x,y in [(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]]
        shape = page.new_shape(); shape.draw_polyline(pts+[pts[0]])
        shape.finish(color=None, fill=color, closePath=True); shape.commit()
    photo(250,230,300,180,25,(.2,.42,.56))
    photo(550,400,300,180,25,(.22,.46,.34))
    photo(820,160,150,100,-20,(.93,.93,.93))
    page.get_pixmap().save(png)
    doc.new_page(width=1000, height=750)
    doc.save(fixture)
original_hash = hashlib.sha256(fixture.read_bytes()).hexdigest()
reports = []
with sync_playwright() as api:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS', 'chromium,firefox,webkit').split(','):
        browser = getattr(api,engine).launch(**({'executable_path':os.environ['MOINPDF_TEST_BROWSER_EXECUTABLE']} if os.getenv('MOINPDF_TEST_BROWSER_EXECUTABLE') else {}))
        try:
            for case_index, en in enumerate(lang=='en' for lang in os.getenv('MOINPDF_TEST_LANGUAGES','de,en').split(',')):
                if case_index:
                    # Keep raster-heavy scenarios independent, including browser caches.
                    browser.close()
                    browser = getattr(api,engine).launch(**({'executable_path':os.environ['MOINPDF_TEST_BROWSER_EXECUTABLE']} if os.getenv('MOINPDF_TEST_BROWSER_EXECUTABLE') else {}))
                context = browser.new_context(viewport={'width':390 if en else 1440,'height':950}, has_touch=en, accept_downloads=True, reduced_motion='reduce')
                page = context.new_page(); page.set_default_timeout(60000)
                errors = []; page.on('pageerror',lambda error:errors.append(str(error)))
                name = engine + ('-touch-en' if en else '-desktop-de')
                def t(de,english): return english if en else de
                def button(de,english): return page.get_by_role('button',name=t(de,english),exact=True)
                def label(de,english): return page.get_by_label(t(de,english),exact=True)
                def download(suffix):
                    link=page.locator('.advanced-result a[download][href^="blob:"]').first
                    expect(link).to_be_visible(timeout=45000)
                    with page.expect_download(timeout=120000) as event: link.click()
                    path=out/(name+suffix);event.value.save_as(path);return path
                try:
                    page.goto(origin+('?lang=en' if en else '?lang=de'))
                    # The same tool accepts ordinary imported image scans and multi-page PDFs.
                    page.locator('input[type=file]').first.set_input_files(str((png if en else fixture).resolve()))
                    expect(page.locator('.chooser-tool')).to_have_count(118)
                    page.locator('.chooser-tool').filter(has=page.get_by_text(t('Scanfotos automatisch trennen','Automatically split scanned photos'),exact=True)).click()
                    label('Kontrastschwelle','Contrast threshold').fill('6')
                    button('Alle Seiten erkennen','Detect items on all pages').click()
                    expect(page.locator('.scan-photo-previews button')).to_have_count(3)
                    expect(page.locator('.scan-photo-previews img')).to_have_count(3)
                    expect(page.locator('.scan-photo-panel [role=status]')).to_contain_text(t('Unsichere Konturen','Uncertain outlines'))
                    page.screenshot(path=str(out/(name+'-detected.png')),full_page=True)
                    if en:
                        assert 'PNG images' in label('Ausgabeformat','Output format').locator('option').all_text_contents()
                        assert 'JPG photos' in label('Ausgabeformat','Output format').locator('option').all_text_contents()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), 'no horizontal overflow'
                    if not en:
                        label('Seite','Page').select_option('1')
                        expect(page.locator('.scan-photo-panel [role=status]')).to_contain_text('Keine sichere Erkennung')
                        expect(page.locator('.scan-photo-previews button')).to_have_count(0)
                        # Blank page: explicitly add a manual frame by dragging on the original.
                        paper=page.locator('.scan-photo-panel .advanced-paper');paper.scroll_into_view_if_needed();box=paper.bounding_box()
                        page.mouse.move(box['x']+box['width']*.2,box['y']+box['height']*.2);page.mouse.down()
                        page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5,steps=5);page.mouse.up()
                        expect(page.locator('.scan-photo-previews button')).to_have_count(1)
                        button('Ausschnitt entfernen','Remove crop').click()
                        label('Seite','Page').select_option('0')
                        expect(page.locator('.scan-photo-previews button')).to_have_count(3)
                    review=label('Ich habe die Ausschnitte auf allen markierten Seiten geprüft.','I have checked the crops on all selected pages.')
                    export=button('Ausschnitte herunterladen','Download crops')
                    expect(export).to_be_disabled()
                    # Selection and individual 90-degree rotation visibly change only that thumbnail.
                    select=label('Foto auswählen 1','Select photo 1');select.scroll_into_view_if_needed()
                    if en:
                        b=select.bounding_box();page.touchscreen.tap(b['x']+b['width']/2,b['y']+b['height']/2)
                    else: select.click()
                    image=select.locator('img');old_src=image.get_attribute('src')
                    other_src=page.locator('.scan-photo-previews img').nth(1).get_attribute('src')
                    review.check();button('Foto um 90° drehen','Rotate photo by 90°').click()
                    expect(review).not_to_be_checked();expect(export).to_be_disabled()
                    expect(image).not_to_have_attribute('src',old_src)
                    assert page.locator('.scan-photo-previews img').nth(1).get_attribute('src')==other_src
                    edge=label('Fotoecke 1','Photo corner 1');edge.scroll_into_view_if_needed()
                    left=edge.evaluate('(el)=>el.style.left');edge.focus();edge.press('ArrowRight')
                    assert edge.evaluate('(el)=>el.style.left') != left
                    # Invalid/out-of-bounds crop cannot be confirmed into an export.
                    width=label('Breite (%)','Width (%)');old_width=width.input_value();width.fill('100')
                    review.check();expect(export).to_be_disabled()
                    expect(page.locator('.scan-photo-edit [role=alert]')).to_be_visible()
                    width.fill(old_width);expect(review).not_to_be_checked()
                    # No document upload or external service is needed once the tool is loaded.
                    posts=[];page.on('request',lambda req:posts.append(req.url) if req.method=='POST' else None)
                    def local_only(route):
                        if route.request.method == 'POST' or not route.request.url.startswith(origin+'/'):
                            route.abort()
                        else: route.continue_()
                    context.route('**/*',local_only)
                    for fmt,ext in [('png','.png.zip'),('jpeg','.jpg.zip'),('combined-pdf','.pdf')]:
                        print(name, fmt, flush=True)
                        label('Ausgabeformat','Output format').select_option(fmt)
                        review.check();expect(export).to_be_enabled();export.click()
                        path=download(ext)
                        if fmt=='combined-pdf':
                            with pymupdf.open(path) as pdf:
                                assert len(pdf)==3
                                assert all(not p.get_text().strip() for p in pdf)
                                assert all(p.get_pixmap().width>30 for p in pdf)
                        else:
                            with zipfile.ZipFile(path) as z:
                                assert len(z.namelist())==3
                                for file in z.namelist():
                                    content=z.read(file)
                                    assert content.startswith(b'\x89PNG' if fmt=='png' else b'\xff\xd8\xff')
                                    with pymupdf.open(stream=content,filetype='png' if fmt=='png' else 'jpeg') as img:
                                        pix=img[0].get_pixmap();assert pix.width>30 and pix.height>30
                    context.set_offline(True)
                    label('Ausgabeformat','Output format').select_option('png')
                    export.click();download('-offline.zip')
                    assert not posts, posts
                    page.locator('.scan-photo-previews').scroll_into_view_if_needed()
                    page.screenshot(path=str(out/(name+'.png')),full_page=True)
                    assert not errors,errors
                    reports.append({'case':name,'browser_version':browser.version,'passed':True,'checks':['image/PDF input','three crops with faint warning','empty-page manual fallback' if not en else 'touch selection','isolated rotation','keyboard corners','invalid crop blocked','review reset','PNG/JPG/PDF exports without services','offline PNG export','original unchanged']})
                except Exception as failure:
                    print(repr(failure),flush=True)
                    try:
                        print(page.locator('body').inner_text()[-9000:],flush=True)
                        page.screenshot(path=str(out/(name+'-failure.png')),full_page=True)
                    except Exception:
                        print('Page unavailable for failure diagnostics',flush=True)
                    raise
                finally:
                    context.close()
        finally:
            browser.close()
assert hashlib.sha256(fixture.read_bytes()).hexdigest()==original_hash
(out/('report-'+os.getenv('MOINPDF_TEST_BROWSERS','chromium,firefox,webkit').replace(',','-')+'.json')).write_text(json.dumps(reports,indent=2))
print(json.dumps(reports,indent=2))
