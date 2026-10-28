"""Real scan/target downloads, visible progress and wide-screen layout; fictional input."""
import atexit,json,os,subprocess,sys,time
from pathlib import Path
from urllib.request import urlopen
import pymupdf
from playwright.sync_api import sync_playwright,expect
origin=os.getenv('MOINPDF_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path('.cache/editor-browser/scan-compression');out.mkdir(parents=True,exist_ok=True)
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
    else:raise RuntimeError('Production test server unavailable')
fixture=out/'fictional-scans.pdf'
width,height=1600,2200
samples=bytearray(width*height);seed=42
for y in range(height):
    for x in range(width):
        seed=(seed*1664525+1013904223)&0xffffffff
        samples[y*width+x]=30 if 100<x<1450 and y%80<14 else (210+(seed>>26))&255
pix=pymupdf.Pixmap(pymupdf.csGRAY,width,height,bytes(samples),False)
with pymupdf.open() as doc:
    for n in range(3):
        p=doc.new_page();p.insert_image(p.rect,stream=pix.tobytes('png'))
        p.insert_text((40,50),f'FICTIONAL OCR {n+1}',fontsize=14,render_mode=3)
        p.insert_link({'kind':pymupdf.LINK_URI,'from':pymupdf.Rect(40,100,160,120),'uri':'https://example.com/fictional'})
    doc.save(fixture)
reports=[]
with sync_playwright() as api:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS','chromium').split(','):
        browser=getattr(api,engine).launch()
        try:
            for en in (False,True):
                context=browser.new_context(viewport={'width':390 if en else 2560,'height':1000},has_touch=en,accept_downloads=True,reduced_motion='reduce')
                context.add_init_script('localStorage.setItem("moinpdf-theme","light")')
                page=context.new_page();page.set_default_timeout(60000);errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                name=engine+('-touch-en' if en else '-desktop-de')
                def t(de,english):return english if en else de
                def upload(tool):
                    page.goto(origin+('?lang=en' if en else '?lang=de'))
                    page.locator('input[type=file]').first.set_input_files(str(fixture.resolve()))
                    page.locator(f'.chooser-tool[data-tool-id="{tool}"]').click()
                def download(suffix,advanced=True):
                    link=page.locator(('.advanced-result ' if advanced else '')+'a[download][href^="blob:"]').first
                    expect(link).to_be_visible(timeout=180000)
                    with page.expect_download(timeout=120000) as event:link.click()
                    path=out/(name+suffix+'.pdf');event.value.save_as(path)
                    with pymupdf.open(path) as doc:
                        assert len(doc)==3
                        for i,p in enumerate(doc):
                            assert f'FICTIONAL OCR {i+1}' in p.get_text()
                            assert any(l.get('uri')=='https://example.com/fictional' for l in p.get_links())
                    assert path.stat().st_size<fixture.stat().st_size*.8
                    return path
                try:
                    upload('optimize-pdf')
                    for width_case in ((390,600) if en else (1280,1600,1920,2560)):
                        page.set_viewport_size({'width':width_case,'height':1000})
                        expect(page.locator('.conversion-card')).to_be_visible()
                        page.wait_for_function('''w=>{
                            if(innerWidth!==w)return false;
                            const r=document.querySelector('.conversion-card').getBoundingClientRect();
                            return r.width>=(w>1000?790:Math.min(w-30,560)) && r.left>=0 && r.right<=w+1;
                        }''',arg=width_case)
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                    page.set_viewport_size({'width':390 if en else 2560,'height':1000})
                    if not en:
                        style=page.locator('.app-toolbar').evaluate('(el)=>({blur:getComputedStyle(el).backdropFilter,color:getComputedStyle(el).backgroundColor})')
                        assert style['blur']=='none' and style['color'].startswith('rgb('),style
                    page.screenshot(path=str(out/(name+'-target-layout.png')),full_page=True)
                    page.get_by_label(t('Gewünschte maximale Größe (MB)','Desired maximum size (MB)'),exact=True).fill('0.7')
                    page.get_by_role('button',name=t('PDF optimieren','Optimize PDF'),exact=True).click()
                    meter=page.get_by_role('progressbar',name=t('Fortschritt der Komprimierung','Compression progress'))
                    expect(meter).to_be_visible(timeout=30000)
                    expect(meter).to_be_in_viewport()
                    expect(page.locator('.conversion-progress')).to_contain_text('%')
                    page.screenshot(path=str(out/(name+'-target-progress.png')))
                    page.locator('.conversion-progress').get_by_role('button',name=t('Abbrechen','Cancel'),exact=True).click()
                    expect(page.locator('.conversion-progress')).to_have_count(0,timeout=30000)
                    expect(page.get_by_role('button',name=t('PDF optimieren','Optimize PDF'),exact=True)).to_be_enabled()
                    page.get_by_role('button',name=t('PDF optimieren','Optimize PDF'),exact=True).click()
                    target=download('-target')
                    expect(page.locator('.advanced-result')).to_contain_text(t('Zielgröße erreicht.','Target size reached.'))
                    assert target.stat().st_size<=.7*1024*1024
                    page.get_by_role('button',name=t('Zurück zur Auswahl','Back to selection'),exact=True).click()
                    page.locator('.chooser-tool[data-tool-id=compress]').click()
                    page.get_by_role('button',name=t('Kleine Datei Zum Teilen','Small file For sharing')).click()
                    page.locator('.settings-panel').get_by_role('button',name=t('Komprimieren','Compress'),exact=True).click()
                    download('-scan',advanced=False)
                    page.screenshot(path=str(out/(name+'-scan-result.png')),full_page=True)
                    assert not errors,errors
                    reports.append({'case':name,'status':'passed','scope':'Scan/target downloads, actual reduction and preserved text/links, cancellation/retry, progress, wide/mobile layout'})
                except Exception:
                    page.screenshot(path=str(out/(name+'-failure.png')),full_page=True)
                    print('FAILED',name,'errors',errors,'page',page.locator('body').inner_text()[-10000:])
                    raise
                finally:context.close()
        finally:browser.close()
(out/'report.json').write_text(json.dumps({'results':reports,'limits':['Touch emulation only; no physical-device or native Safari coverage in this test.']},indent=2))
print('PASS: scan compression, target status/cancellation, retained PDF content and wide/mobile layouts')
