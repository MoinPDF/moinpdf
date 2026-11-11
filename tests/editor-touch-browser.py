"""Mobile editor regression: real Chromium touch input; DOM gesture events in
Firefox/WebKit. Independent PDF readback. This is not a physical-device test.
"""
import atexit, json, os, subprocess, sys, time
from pathlib import Path
from urllib.request import urlopen
import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.environ.get('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path('.cache/editor-browser'); out.mkdir(parents=True, exist_ok=True)
fixture = out / 'touch-original.pdf'
doc = pymupdf.open()
p = doc.new_page(width=400, height=560)
p.insert_font(fontname='MoinFixture', fontfile='public/vendor/editor-fonts/LiberationSans-Regular.ttf')
p.insert_text((40, 100), 'MoinPDF 12345', fontname='MoinFixture', fontsize=14, color=(0.2, 0.4, 0.6))
p.insert_text((40, 160), 'Unchanged paragraph.', fontname='MoinFixture', fontsize=12)
p = doc.new_page(width=400, height=560)
p.insert_text((40, 100), 'UNCHANGED SECOND PAGE', fontsize=12)
doc.save(fixture); doc.close()
if os.environ.get('MOINPDF_TEST_START_SERVER') == '1':
    log = open(out / 'touch-http.log', 'w')
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

def run(browser, engine):
    context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, accept_downloads=True, reduced_motion='reduce')
    page = context.new_page(); page.set_default_timeout(60000)
    page.goto(origin)
    page.locator('input[type=file]').first.set_input_files(str(fixture.resolve()))
    page.locator('.chooser-tool').filter(has=page.get_by_text('PDF bearbeiten', exact=True)).click()
    target = page.get_by_role('button', name='Text bearbeiten: MoinPDF 12345', exact=True)
    expect(target).to_be_visible(timeout=120000)
    viewport = page.locator('.editor-page-scroll')
    viewport.evaluate('(e) => e.scrollIntoView({block:"center"})')
    geometry = page.evaluate('''() => {
      const v=document.querySelector('.editor-page-scroll').getBoundingClientRect(),
        p=document.querySelector('.editor-sheet').getBoundingClientRect();
      const x=v.left+v.width/2, y=Math.max(v.top,100)+Math.min(100,v.height/3);
      return {x,y,px:(x-p.left)/p.width,py:(y-p.top)/p.height,width:p.width,scale:visualViewport.scale};
    }''')
    x, y = geometry['x'], geometry['y']
    cdp = context.new_cdp_session(page) if engine == 'chromium' else None
    def touches(kind, coords):
        if cdp:
            cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': a, 'y': b, 'id': i+1} for i, (a,b) in enumerate(coords)]})
        else:
            page.evaluate('''({kind,coords})=>{
              const e=new Event(kind.toLowerCase(),{bubbles:true,cancelable:true});
              Object.defineProperty(e,'touches',{value:coords.map(([clientX,clientY],i)=>({identifier:i+1,clientX,clientY}))});
              document.querySelector('.editor-sheet').dispatchEvent(e);
            }''', {'kind':kind,'coords':coords})
    touches('touchStart', [(x-35,y)])
    expect(page.get_by_label('Text direkt in der PDF bearbeiten', exact=True)).to_have_count(0)
    touches('touchStart', [(x-35,y),(x+35,y)])
    for distance in [40,45,50,55,60,65,70]:
        touches('touchMove', [(x-distance,y),(x+distance,y)])
        page.wait_for_timeout(20)
    touches('touchEnd', [])
    expect(page.get_by_label('Zoom der PDF-Seite', exact=True)).to_have_value('200')
    after = page.evaluate('''({px,py})=>{const p=document.querySelector('.editor-sheet').getBoundingClientRect();return {x:p.left+px*p.width,y:p.top+py*p.height,width:p.width,scale:visualViewport.scale}}''', geometry)
    assert abs(after['width']/geometry['width']-2) < .02, (geometry,after)
    assert abs(after['x']-x)<3 and abs(after['y']-y)<3, (geometry,after)
    assert abs(after['scale']-geometry['scale'])<.01, 'Browser chrome must not zoom with the document'
    expect(page.get_by_label('Text direkt in der PDF bearbeiten', exact=True)).to_have_count(0)
    assert viewport.get_attribute('data-editor-gesturing') is None
    target.scroll_into_view_if_needed()
    if cdp:
        box = target.bounding_box(); page.touchscreen.tap(box['x']+box['width']/2, box['y']+box['height']/2)
    else: target.click()
    field = page.get_by_label('Text direkt in der PDF bearbeiten', exact=True)
    expect(field).to_have_text('MoinPDF 12345')
    field.fill('MoinPDF 54321')
    expect(field).to_have_text('MoinPDF 54321')
    page.get_by_role('button', name='Bearbeitete PDF erstellen', exact=True).click()
    link = page.get_by_role('link', name='PDF herunterladen', exact=True).first
    expect(link).to_be_visible(timeout=240000)
    with page.expect_download() as download: link.click()
    result = out / f'touch-{engine}.pdf'; download.value.save_as(result)
    with pymupdf.open(fixture) as before, pymupdf.open(result) as after:
        def span(pdf, text):
            return next(s for block in pdf[0].get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for s in line['spans'] if text in s['text'])
        a, b = span(before, 'MoinPDF'), span(after, 'MoinPDF')
        assert b['text'] == 'MoinPDF 54321', b
        assert a['color'] == b['color'], (a,b)
        assert abs(a['size']-b['size']) < .02, (a,b)
        assert all(abs(u-v)<.2 for u,v in zip(a['origin'],b['origin'])), (a,b)
        assert a['font'].split('+')[-1] == b['font'].split('+')[-1], (a,b)
        assert '12345' not in after[0].get_text()
        assert 'Unchanged paragraph.' in after[0].get_text()
        assert before[1].get_pixmap().samples == after[1].get_pixmap().samples
    page.screenshot(path=str(out / f'touch-{engine}.png'))
    context.close()
    return {'engine':engine,'touch_input':'CDP touch input' if cdp else 'DOM gesture simulation','zoom':200,'anchor':'preserved','export':'text, original font, size, color, baseline and untouched second page checked'}

report=[]
with sync_playwright() as api:
    for engine in os.environ.get('MOINPDF_TEST_BROWSERS','chromium,firefox,webkit').split(','):
        browser=getattr(api,engine).launch()
        try: report.append(run(browser,engine))
        finally: browser.close()
(out / 'touch-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('PASS: '+json.dumps(report),flush=True)
