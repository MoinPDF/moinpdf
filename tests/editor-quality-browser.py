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
out = Path(os.environ.get('MOINPDF_BROWSER_OUTPUT','.cache/editor-browser')); out.mkdir(parents=True, exist_ok=True)
corpus = Path('.cache/editor-corpus')
if os.environ.get('MOINPDF_TEST_START_SERVER') == '1':
    log = open(out / 'quality-http.log', 'w')
    server = subprocess.Popen(['python', 'tests/text-browser-server.py'], stdout=log, stderr=subprocess.STDOUT)
    atexit.register(server.terminate)
    for _ in range(50):
        try:
            with urlopen(origin, timeout=1) as response:
                if response.status == 200: break
        except OSError: time.sleep(.1)
    else: raise RuntimeError('Production test server unavailable')

fixture = out / 'quality-controls.pdf'
with pymupdf.open() as doc:
    for i in range(2):
        page = doc.new_page(width=500, height=700)
        page.insert_text((50, 70), 'ORIGINAL', fontsize=16)
        if i == 0:
            page.insert_text((50, 150), 'Absatz eins', fontsize=14)
            page.insert_text((50, 180), 'Absatz zwei', fontsize=14)
        page.insert_text((50, 640), 'FOOTER ' + str(i + 1), fontsize=12)
    doc.save(fixture)
mixed = out / 'public-mixed.pdf'
with pymupdf.open() as doc:
    for name in ['aws-invoice.pdf', 'c03-29.pdf', 'latex-invoice.pdf']:
        with pymupdf.open(corpus / name) as part: doc.insert_pdf(part)
    doc.save(mixed)
(out / 'public-corpus-attribution.json').write_text(Path('tests/editor-public-corpus.json').read_text())
report = {'results': [], 'limits': ['Public examples and historical scans, not customer documents.', 'Mixed file assembled for testing.', 'Desktop engines and narrow viewports, not physical devices or native Safari.']}

def open_editor(page, path):
    page.goto(origin)
    page.locator('input[type=file]').first.set_input_files(str(path.resolve()))
    page.locator('.chooser-tool').filter(has=page.get_by_text('PDF bearbeiten', exact=True)).click()
    expect(page.locator('.editor-sheet img')).to_be_visible(timeout=120000)

def download(page, name):
    button = page.get_by_role('button', name='Bearbeitete PDF erstellen', exact=True)
    # Scrolling away from a focused edit must stay where the user put it, even
    # if selection/layout callbacks still have a pending caret-reveal frame.
    button.scroll_into_view_if_needed()
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    expect(button).to_be_in_viewport(ratio=.9)
    button.click()
    link = page.get_by_role('link', name='PDF herunterladen', exact=True).first
    expect(link.or_(page.locator('.error-box'))).to_be_visible(timeout=240000)
    assert link.is_visible(), page.locator('.error-box').inner_text()
    review = page.get_by_role('region', name='Exportprüfung und Vergleich')
    expect(review).to_be_visible()
    (out / (name + '-verification.txt')).write_text(review.inner_text())
    with page.expect_download() as pending: link.click()
    path = out / (name + '.pdf'); pending.value.save_as(path)
    return path

def controls(page, name):
    open_editor(page, fixture)
    expect(page.get_by_role('button', name='Text bearbeiten: ORIGINAL', exact=True)).to_be_visible(timeout=120000)
    page.get_by_role('button', name='Dokument durchsuchen', exact=True).click()
    search = page.get_by_role('region', name='Dokument durchsuchen und ersetzen')
    search.get_by_label('Suchtext im Dokument', exact=True).fill('ORIGINAL')
    search.get_by_label('Ersatztext im Dokument', exact=True).fill('NEU')
    search.get_by_role('button', name='Alle Seiten durchsuchen', exact=True).click()
    expect(search.locator('.editor-document-hits li')).to_have_count(2, timeout=120000)
    search.locator('.editor-document-hits li').nth(1).get_by_role('button', name='Seite 2', exact=True).click()
    expect(page.get_by_label('Suchtreffer auf der Seite', exact=True)).to_be_visible()
    search.locator('.editor-document-hits li').nth(0).get_by_role('button', name='Seite 1', exact=True).click()
    search.locator('.editor-document-hits li').nth(1).get_by_role('checkbox').check()
    search.get_by_role('button', name=re.compile('Ausgewählte Treffer ersetzen')).click()
    # One global undo restores the whole batch; redo restores it again.
    page.get_by_role('button', name='Rückgängig', exact=True).click()
    page.get_by_role('button', name='Wiederholen', exact=True).click()
    search.get_by_role('button', name='Schließen', exact=True).click()
    page.get_by_role('button', name='Textstellen verbinden', exact=True).click()
    page.get_by_role('button', name='Text bearbeiten: Absatz eins', exact=True).click()
    page.get_by_role('button', name='Text bearbeiten: Absatz zwei', exact=True).click()
    expect(page.get_by_label('Vorschau des verbundenen Textfelds')).to_have_text('Absatz eins\nAbsatz zwei')
    page.get_by_role('button', name='Auswahl verbinden', exact=True).click()
    field = page.get_by_label('Text direkt in der PDF bearbeiten', exact=True)
    expect(field).to_have_text('Absatz eins\nAbsatz zwei')
    field.press('Control+Home')
    for _ in range(12): field.press('ArrowRight')
    page.get_by_role('button', name='Am Textcursor trennen', exact=True).click()
    expect(page.locator('.editor-split-preview pre')).to_have_count(2)
    page.get_by_role('button', name='Teilung übernehmen', exact=True).click()
    expect(page.locator('.editor-object.text')).to_have_count(2)
    page.get_by_role('button', name='Rückgängig', exact=True).click()
    expect(page.locator('.editor-object.text')).to_have_count(1)
    page.get_by_role('button', name='Wiederholen', exact=True).click()
    expect(page.locator('.editor-object.text')).to_have_count(2)
    # The first half is selected by the atomic split operation.
    field = page.get_by_label('Text direkt in der PDF bearbeiten', exact=True)
    field.press('Control+Home')
    for _ in range(6): field.press('Shift+ArrowRight')
    assert field.evaluate('getSelection().toString()') == 'Absatz'
    page.get_by_role('button', name='Passende Ersatzschriften vergleichen', exact=True).click()
    expect(page.locator('.editor-font-alternative-grid article')).to_have_count(3, timeout=90000)
    page.locator('.editor-font-alternative-grid article').first.get_by_role('button', name='Diese Schrift verwenden').click()
    expect(field.locator('span').filter(has_text=re.compile('^Absatz$'))).to_have_count(1)
    # Undo one font command while retaining the split and cross-page replacement.
    page.get_by_role('button', name='Rückgängig', exact=True).click()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2')
    page.screenshot(path=str(out / (name + '-controls.png')), full_page=True)
    exported = download(page, name)
    assert 'Schriftbild weicht' not in (out / (name + '-verification.txt')).read_text(), 'False appearance mismatch in controls export'
    with pymupdf.open(exported) as doc:
        assert 'ORIGINAL' in doc[0].get_text() and 'ORIGINAL' not in doc[1].get_text()
        assert 'NEU' in doc[1].get_text()
        for text in ['Absatz eins', 'Absatz zwei']: assert doc[0].get_text().count(text) == 1
        assert 'FOOTER 1' in doc[0].get_text() and 'FOOTER 2' in doc[1].get_text()
    return {'export': str(exported), 'scope': 'selective whole-document replacement, join/split, atomic undo/redo, font comparison and export'}

def public_edit(page, name, path, anchor, replacement, scan=False):
    open_editor(page, path)
    target = page.get_by_role('button', name=re.compile(r'^(?:Text bearbeiten: |Tabellenzelle \d+, \d+: )' + anchor)).first
    expect(target).to_be_visible(timeout=180000)
    old_text = re.sub(r'^(?:Text bearbeiten: |Tabellenzelle \d+, \d+: )','',target.get_attribute('aria-label'))
    target.click()
    field = page.get_by_label('Text direkt in der PDF bearbeiten', exact=True)
    expect(field).to_be_visible()
    field.fill(replacement)
    # Wait for font preparation and validation before checking OCR layout.
    expect(page.get_by_role('button', name='Passende Ersatzschriften vergleichen', exact=True)).to_be_enabled()
    if scan:
        helper = page.locator('.editor-layout-help')
        helper.locator('summary').click()
        # Use a known conservative 6-point setting if the inferred font needs
        # extra room. This is an explicit user action, not a hidden correction.
        size = page.get_by_role('toolbar', name='Text direkt formatieren').get_by_label('Textgröße in Punkt', exact=True)
        size.fill('6'); size.press('Tab')
    exported = download(page, name)
    if not scan:
        assert 'Schriftbild weicht' not in (out / (name + '-verification.txt')).read_text(), 'False appearance mismatch in native export'
    with pymupdf.open(path) as before, pymupdf.open(exported) as after:
        assert len(before) == len(after)
        text = after[0].get_text()
        assert text.count(replacement) == 1, text
        if not scan: assert old_text not in text, (old_text, text)
        for i in range(1, len(before)):
            pymupdf.TOOLS.store_shrink(100); a = before[i].get_pixmap()
            pymupdf.TOOLS.store_shrink(100); b = after[i].get_pixmap()
            assert (a.width, a.height, a.samples) == (b.width, b.height, b.samples), i
            assert before[i].get_text() == after[i].get_text(), i
        after[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(out / (name + '-export.png'))
        if scan:
            # All visible edited characters must have just one searchable span.
            # MuPDF search is case-insensitive and also finds 'editing' in the
            # brochure. Count exact Unicode tokens, not substring rectangles.
            assert sum(w[4] == replacement for w in after[0].get_text('words')) == 1
    open_editor(page, exported)
    expect(page.get_by_role('button', name=re.compile(r'^(?:Text bearbeiten: |Tabellenzelle \d+, \d+: )'+re.escape(replacement)+r'$'))).to_be_visible(timeout=180000)
    return {'export': str(exported), 'original_target': old_text, 'scope': 'local edit, export, independent readback and reopen'}

def form_guard(page, name):
    open_editor(page, corpus / 'acroform.pdf')
    page.get_by_role('button', name='Neuer Text', exact=True).click()
    page.get_by_label('Text direkt in der PDF bearbeiten', exact=True).fill('FORM')
    with pymupdf.open(corpus / 'acroform.pdf') as original:
        widget=next(original[0].widgets()).rect
    for label,value in [('Objekt links',widget.x0*25.4/72),('Objekt oben',widget.y0*25.4/72)]:
        field=page.get_by_label(label,exact=True);field.fill(str(value));field.press('Tab')
    page.get_by_role('button', name='Bearbeitete PDF erstellen', exact=True).click()
    expect(page.locator('.error-box')).to_contain_text('Formular', timeout=120000)
    assert page.get_by_role('link', name='PDF herunterladen', exact=True).count() == 0
    return {'scope': 'explicit widget-collision refusal, no unapproved flattening'}

def execute(browser, name, width, callback):
    selected=os.environ.get('MOINPDF_BROWSER_CASES','').split(',')
    if selected!=[''] and name not in selected:return
    context = browser.new_context(viewport={'width': width, 'height': 1000}, accept_downloads=True, reduced_motion='reduce')
    page = context.new_page(); page.set_default_timeout(45000)
    # Keep bounded pixel evidence for failed appearance checks without adding
    # test hooks or telemetry to the application itself.
    page.add_init_script("""(() => {
      const read=CanvasRenderingContext2D.prototype.getImageData;
      window.__editorTestImages=[];
      CanvasRenderingContext2D.prototype.getImageData=function(...args){
        const result=read.apply(this,args),c=this.canvas;
        if(args[0]===0&&args[1]===0&&Math.max(c.width,c.height)===1600&&args[2]===c.width&&args[3]===c.height){
          try{window.__editorTestImages.push(c.toDataURL());if(window.__editorTestImages.length>6)window.__editorTestImages.shift();}catch{}
        }
        return result;
      };
    })();""")
    errors = []; blocked = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    def route(r):
        if r.request.method not in ('GET', 'HEAD') or (urlsplit(r.request.url).netloc != urlsplit(origin).netloc and not r.request.url.startswith(('blob:', 'data:'))):
            blocked.append(r.request.url); r.abort()
        else: r.continue_()
    page.route('**/*', route)
    result = {'case': name, 'viewport': width}
    print('START:', name, flush=True)
    try:
        details = callback(page, name)
        assert not errors, errors
        assert not blocked, blocked
        result.update(status='passed', **details)
    except Exception as e:
        result.update(status='failed', error=str(e), traceback=traceback.format_exc(), page_errors=errors, blocked_requests=blocked)
        print(result['traceback'], flush=True)
        try:
            for index, image in enumerate(page.evaluate('window.__editorTestImages || []')):
                (out / (name + '-ink-' + str(index) + '.png')).write_bytes(base64.b64decode(image.split(',')[1]))
            page.screenshot(path=str(out / (name + '-failure.png')), full_page=True, timeout=10000)
            (out / (name + '-failure.txt')).write_text(page.locator('body').inner_text(timeout=5000))
        except Exception: pass
    finally:
        report['results'].append(result)
        (out / 'quality-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        context.close()
        print(result['status'].upper() + ': ' + name, flush=True)

with sync_playwright() as api:
    for engine in os.environ.get('MOINPDF_TEST_BROWSERS', 'chromium,firefox,webkit').split(','):
        browser = getattr(api, engine).launch()
        report[engine] = browser.version
        execute(browser, engine + '-controls', 1440, controls)
        execute(browser, engine + '-controls-small', 390, controls)
        execute(browser, engine + '-public-mixed', 1440, lambda p,n: public_edit(p,n,mixed,'INVOICE','EDITED'))
        execute(browser, engine + '-latex-invoice', 1440, lambda p,n: public_edit(p,n,corpus/'latex-invoice.pdf','Consulting Services','Reviewed Services'))
        execute(browser, engine + '-historical-scan', 1440, lambda p,n: public_edit(p,n,corpus/'c03-29.pdf',r'Watson','EDIT',True))
        execute(browser, engine + '-column-scan', 1440, lambda p,n: public_edit(p,n,corpus/'ccitt.pdf',r'LinnSequencer','EDIT',True))
        execute(browser, engine + '-rotated-scan', 1440, lambda p,n: public_edit(p,n,corpus/'rotated_skew.pdf',r'LinnSequencer','EDIT',True))
        execute(browser, engine + '-form-guard', 1440, form_guard)
        browser.close()
raise SystemExit(0 if all(r['status'] == 'passed' for r in report['results']) else 1)
