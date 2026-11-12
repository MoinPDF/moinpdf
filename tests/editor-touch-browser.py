"""Mobile editor regression: real Chromium touch input; DOM gesture events in
Firefox/WebKit. Independent PDF readback. This is not a physical-device test.
"""
import atexit, json, os, re, struct, subprocess, sys, time
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

def fixture_glyph(font, gid):
    # This fixture uses simple TrueType glyphs. Subsets may omit the name/cmap
    # tables and renumber glyphs, so compare the actual embedded glyph programs
    # and advances using glyph IDs independently decoded from the PDF.
    count = struct.unpack_from('>H', font, 4)[0]
    tables = {font[12+16*i:16+16*i].decode(): struct.unpack_from('>II', font, 20+16*i)
              for i in range(count)}
    def table(name):
        offset, size = tables[name]
        return font[offset:offset+size]
    head, loca, glyf, hhea, hmtx = [table(name) for name in ['head', 'loca', 'glyf', 'hhea', 'hmtx']]
    long_offsets = struct.unpack_from('>h', head, 50)[0]
    fmt, step, factor = ('>I', 4, 1) if long_offsets else ('>H', 2, 2)
    start = struct.unpack_from(fmt, loca, gid*step)[0]*factor
    end = struct.unpack_from(fmt, loca, (gid+1)*step)[0]*factor
    metrics = struct.unpack_from('>H', hhea, 34)[0]
    advance = struct.unpack_from('>H', hmtx, min(gid, metrics-1)*4)[0]
    return glyf[start:end].rstrip(b'\x00'), advance, struct.unpack_from('>H', head, 18)[0]

def verify_original_glyphs(before, after):
    original_font = before[0].get_fonts()[0]
    original_bytes = before.extract_font(original_font[0])[3]
    title = before[0].get_texttrace()[0]
    expected = {char[0]: fixture_glyph(original_bytes, char[1]) for char in title['chars']}
    checked = 0
    for span in after[0].get_texttrace():
        if abs(span['size']-14) > .02: continue
        base_name = original_font[3] if span['font'] == title['font'] else span['font']
        ref = next(font[0] for font in after[0].get_fonts() if font[3] == base_name)
        data = after.extract_font(ref)[3]
        for codepoint, gid, origin, bbox in span['chars']:
            assert fixture_glyph(data, gid) == expected[codepoint], (span['font'], chr(codepoint))
            checked += 1
    assert checked == len(title['chars']) == 13

def run(browser, engine):
    context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, accept_downloads=True, reduced_motion='reduce')
    page = context.new_page(); page.set_default_timeout(60000)
    page.goto(origin)
    page.locator('input[type=file]').first.set_input_files(str(fixture.resolve()))
    page.locator('.chooser-tool').filter(has=page.get_by_text('PDF bearbeiten', exact=True)).click()
    target = page.get_by_role('button', name='Text bearbeiten: MoinPDF 12345', exact=True)
    expect(target).to_be_visible(timeout=120000)
    viewport = page.locator('.editor-page-scroll')
    target.evaluate('(e) => e.scrollIntoView({block:"center"})')
    geometry = target.evaluate('''(target) => {
      const t=target.getBoundingClientRect(),
        p=document.querySelector('.editor-sheet').getBoundingClientRect();
      // The first finger lands on editable text, so this catches accidental
      // selection before the second finger joins the gesture.
      const x=t.left+t.width/2+35, y=t.top+t.height/2;
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
    # Wait for the bounded compositor reconciliation, then assert the actual
    # geometry. This does not replace or relax the anchor/scale assertions.
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))')
    after = page.evaluate('''({px,py})=>{const p=document.querySelector('.editor-sheet').getBoundingClientRect(),v=document.querySelector('.editor-page-scroll');return {x:p.left+px*p.width,y:p.top+py*p.height,width:p.width,scale:visualViewport.scale,scrollLeft:v.scrollLeft,scrollTop:v.scrollTop,scrollWidth:v.scrollWidth,clientWidth:v.clientWidth,scrollHeight:v.scrollHeight,clientHeight:v.clientHeight}}''', geometry)
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
        def characters(pdf):
            # Sparse PDF editing deliberately retains unchanged text objects;
            # one visual line can therefore contain several PDF font spans.
            spans=[s for block in pdf[0].get_text('rawdict')['blocks'] if 'lines' in block
                   for line in block['lines'] for s in line['spans']
                   if abs(s['origin'][1]-100)<.2]
            spans.sort(key=lambda s:s['origin'][0])
            return [(c,s) for s in spans for c in s['chars']]
        original, saved = characters(before), characters(after)
        assert ''.join(c['c'] for c,s in saved) == 'MoinPDF 54321', saved
        assert len(original) == len(saved)
        for (a,sa),(b,sb) in zip(original,saved):
            assert sa['color'] == sb['color'], (sa,sb)
            assert abs(sa['size']-sb['size']) < .02, (sa,sb)
            assert all(abs(u-v)<.2 for u,v in zip(a['origin'],b['origin'])), (a,b)
            # pdf-lib adds a numeric resource suffix when embedding a subset.
            # It changes the PDF resource name, not the underlying typeface.
            font_name = lambda name: re.sub(r'-\d+$', '', name.split('+')[-1])
            assert font_name(sa['font']) == font_name(sb['font']), (sa,sb)
        verify_original_glyphs(before, after)
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
