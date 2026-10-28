"""Adaptive editor acceptance on the production build. Synthetic fixtures only.
Run editor-adaptive-fixtures.mjs first. No external requests or document uploads.
"""
import atexit,json,os,re,subprocess,sys,time,traceback
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
import pymupdf
from playwright.sync_api import sync_playwright,expect
from importlib import import_module
controls_ui = import_module('editor-ui-controls')
origin=os.environ.get('MOINPDF_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('MOINPDF_BROWSER_OUTPUT','.cache/editor-browser'));out.mkdir(parents=True,exist_ok=True);fixtures=Path('.cache/editor-browser/adaptive')
if os.environ.get('MOINPDF_TEST_START_SERVER') == '1':
    server_log=open(out/'adaptive-http.log','w')
    server=subprocess.Popen([sys.executable,'tests/text-browser-server.py'],stdout=server_log,stderr=subprocess.STDOUT)
    def stop_server():
        server.terminate()
        server.wait(timeout=10)
        server_log.close()
    atexit.register(stop_server)
    for _ in range(50):
        if server.poll() is not None:raise RuntimeError('Production test server exited before readiness')
        try:
            with urlopen(origin,timeout=1) as response:
                if response.status == 200:break
        except OSError:time.sleep(.1)
    else:raise RuntimeError('Production test server unavailable')
report={'results':[],'limits':['Desktop engines and touch emulation, not physical devices or native Safari.']}
def panel(page,title):
    if page.locator('.editor-advanced-workflows').get_by_text(title).count(): controls_ui.settings(page, advanced=True)
    options=page.locator('.editor-canvas-options')
    if options.get_by_text(title, exact=True).count() and options.get_attribute('open') is None: options.locator(':scope > summary').click()
    # Only the direct summary identifies this panel; never select an ancestor.
    box=page.locator('details').filter(has=page.locator(':scope > summary',has_text=title))
    if box.get_attribute('open') is None:box.locator(':scope > summary').click()
    return box

def open_editor(page,name):
    page.goto(origin);page.locator('input[type=file]').first.set_input_files(str((fixtures/(name+'.pdf')).resolve()))
    page.locator('.chooser-tool').filter(has=page.get_by_text('PDF bearbeiten',exact=True)).click()
    expect(page.locator('.editor-sheet > img')).to_be_visible(timeout=120000)

def pick(page,text,first=False):
    controls_ui.canvas(page)
    target=page.get_by_role('button',name=re.compile(r'^(?:Text bearbeiten: |Tabellenzelle \d+, \d+: )'+re.escape(text)+r'$'))
    if first:target=target.first
    expect(target).to_be_visible(timeout=120000);target.click()
    field=page.get_by_label('Text direkt in der PDF bearbeiten',exact=True);expect(field).to_be_visible();return field

def geometry(page,label,value):
    controls_ui.geometry(page,label,value)

def save(page,name):
    controls_ui.canvas(page)
    page.get_by_role('button',name='Bearbeitete PDF erstellen',exact=True).click()
    link=page.get_by_role('link',name='PDF herunterladen',exact=True).first
    expect(link.or_(page.locator('.error-box'))).to_be_visible(timeout=240000)
    assert link.is_visible(),page.locator('.error-box').inner_text()
    (out/(name+'-verification.txt')).write_text(page.get_by_role('region',name='Exportprüfung und Vergleich').inner_text(),encoding='utf8')
    with page.expect_download() as task:link.click()
    path=out/(name+'.pdf');task.value.save_as(path);return path

def same_page(a,ai,b,bi):
    pymupdf.TOOLS.store_shrink(100);x=a[ai].get_pixmap();pymupdf.TOOLS.store_shrink(100);y=b[bi].get_pixmap();assert (x.width,x.height,x.samples)==(y.width,y.height,y.samples),'Untouched page pixels changed'

def auto_flow(page,name):
    open_editor(page,'flow');field=pick(page,'First paragraph.')
    text=' '.join(f'token{i:03}' for i in range(360));field.fill(text);geometry(page,'Objektbreite',240*25.4/72)
    flow=panel(page,'Absatz über Seiten fortsetzen');flow.get_by_role('button',name='Absatzfluss vorschauen',exact=True).click()
    expect(flow.locator('.editor-flow-preview')).to_be_visible(timeout=120000)
    assert re.search(r'Neue Fortsetzungsseiten:\s*[1-9]',flow.inner_text()),flow.inner_text()
    flow.get_by_role('button',name='Absatzfluss übernehmen',exact=True).click()
    expect(page.get_by_role('button',name='Rückgängig',exact=True)).to_be_enabled(timeout=120000)
    controls_ui.canvas(page)
    page.get_by_role('button',name='Rückgängig',exact=True).click();expect(page.locator('.editor-object.text .editor-text-content')).to_have_attribute('aria-label',text)
    page.get_by_role('button',name='Wiederholen',exact=True).click()
    file=save(page,name)
    with pymupdf.open(file) as after,pymupdf.open(fixtures/'flow.pdf') as before:
        assert len(after)>2;content=' '.join(p.get_text(sort=True) for p in after)
        for token in text.split():assert content.count(token)==1,token
        for s in ['Following paragraph stays complete.','FOOTER','SIDE','UNCHANGED ORIGINAL NEXT PAGE']:assert content.count(s)==1,s
        same_page(before,1,after,len(after)-1)
    return {'scope':'360 tokens once, preserved following paragraph/footer/sidebar, new pages, atomic undo/redo, untouched original next page'}

def table_rows(page,name):
    open_editor(page,'table');grid=panel(page,'Tabelle bearbeiten');grid.get_by_role('button',name='Tabellenraster prüfen',exact=True).click();expect(grid.get_by_label('Tabelle',exact=True)).to_be_visible(timeout=120000)
    def apply(row,height,button):
        grid.get_by_label('Tabellenzeile',exact=True).fill(str(row));grid.get_by_label('Zeilenhöhe in Punkt',exact=True).fill(str(height));grid.get_by_role('button',name=button,exact=True).click();expect(grid.locator('.editor-table-proposal')).to_be_visible(timeout=120000);grid.get_by_role('button',name='Tabellenänderung übernehmen',exact=True).click();expect(grid.locator('.editor-table-proposal')).to_have_count(0)
    apply(2,60,'Zeilenhöhe vorschauen');apply(2,55,'Zeilenhöhe vorschauen');apply(2,45,'Zeile darunter vorschauen')
    expect(grid.get_by_label('Tabelle',exact=True).locator('option')).to_contain_text('4 × 2')
    controls_ui.canvas(page)
    page.get_by_role('button',name='Rückgängig',exact=True).click();expect(grid.get_by_label('Tabelle',exact=True).locator('option')).to_contain_text('3 × 2');page.get_by_role('button',name='Wiederholen',exact=True).click();expect(grid.get_by_label('Tabelle',exact=True).locator('option')).to_contain_text('4 × 2')
    field=page.get_by_label('Text direkt in der PDF bearbeiten',exact=True);expect(field).to_have_text('MERGED HEADING')
    for text in ['A1','B1','']:
        field.press('Tab');expect(field).to_have_text(text)
    field.fill('New line\nSecond line');field.press('Tab');expect(field).to_have_text('');field.press('Shift+Tab');expect(field).to_have_text('New line\nSecond line')
    # Inspect the asynchronously cleaned background itself, not just the new
    # SVG rules above it. The old row rules must actually disappear on screen.
    page.wait_for_function("""() => {
        const image=document.querySelector('.editor-sheet > img');
        if (!image?.complete || !image.naturalWidth) return false;
        const canvas=document.createElement('canvas');
        canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const context=canvas.getContext('2d');context.drawImage(image,0,0);
        return [140,180].every(y => {
            const pixels=context.getImageData(Math.floor(250/400*canvas.width)-1,Math.floor(y/500*canvas.height)-1,3,3).data;
            return [...pixels].every((value,index) => index%4===3 || value>=250);
        });
    }""",timeout=120000)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2');page.screenshot(path=str(out/(name+'-page.png')),full_page=True)
    controls_ui.settings(page)
    objects=page.locator('.editor-object-list')
    objects.locator(':scope > summary').click()
    expect(objects.get_by_role('button',name=re.compile('Leere Tabellenzelle'))).to_have_count(1)
    objects.get_by_role('button',name=re.compile('Geändertes Tabellenraster')).click()
    expect(page.locator('.editor-selection-label')).to_have_text('Geändertes Tabellenraster')
    expect(page.get_by_label('Bilddeckkraft',exact=True)).to_have_count(0)
    page.get_by_role('button',name='Tabellenänderung verwerfen',exact=True).click()
    expect(objects).to_have_count(0)
    expect(page.get_by_label('Geändertes Tabellenraster',exact=True)).to_have_count(0)
    controls_ui.canvas(page)
    page.get_by_role('button',name='Rückgängig',exact=True).click()
    expect(page.get_by_label('Geändertes Tabellenraster',exact=True)).to_have_count(1)
    controls_ui.settings(page)
    if objects.get_attribute('open') is None: objects.locator(':scope > summary').click()
    expect(objects.get_by_role('button',name=re.compile('New line Second line'))).to_have_count(1)
    file=save(page,name)
    with pymupdf.open(file) as after,pymupdf.open(fixtures/'table.pdf') as before:
        content=after[0].get_text()
        for text in ['MERGED HEADING','A1','B1','A2','B2','New line','Second line','TABLE FOOTER']:assert content.count(text)==1,(text,content)
        assert not after[0].get_images();lines=[item for path in after[0].get_drawings() for item in path['items'] if item[0]=='l'];ys=[item[1].y for item in lines if abs(item[1].y-item[2].y)<.01]
        assert any(abs(y-155)<.05 for y in ys) and any(abs(y-200)<.05 for y in ys) and not any(abs(y-140)<.05 for y in ys),ys
        same_page(before,1,after,1)
    return {'scope':'merged header, repeated row height, inserted multiline row, Tab/Shift+Tab, atomic undo/redo and actual vector export'}

def forms(page,name):
    open_editor(page,'form');pick(page,'Original heading').fill('Edited heading');file=save(page,name)
    with pymupdf.open(file) as after,pymupdf.open(fixtures/'form.pdf') as before:
        assert 'Edited heading'in after[0].get_text() and 'Original heading'not in after[0].get_text()
        a=[(w.field_name,w.field_value,tuple(w.rect)) for p in after for w in p.widgets()];b=[(w.field_name,w.field_value,tuple(w.rect)) for p in before for w in p.widgets()];assert a==b and len(a)==3,(a,b);same_page(before,1,after,1)
    return {'scope':'shared text field on two pages, preserved values/widgets/checked checkbox and unchanged page pixels'}

def angle(page,name):
    open_editor(page,'angle');pick(page,'SLOPED').fill('SLIM');file=save(page,name)
    with pymupdf.open(file) as after,pymupdf.open(fixtures/'angle.pdf') as before:
        def line(d,text):return next(l for b in d[0].get_text('dict')['blocks'] if 'lines'in b for l in b['lines'] if any(text in s['text']for s in l['spans']))
        a=line(before,'SLOPED');b=line(after,'SLIM');assert all(abs(x-y)<.001 for x,y in zip(a['dir'],b['dir']));assert all(abs(x-y)<.05 for x,y in zip(a['spans'][0]['origin'],b['spans'][0]['origin']));assert 'SLOPED'not in after[0].get_text();assert 'KEEP FOOTER'in after[0].get_text();assert not after[0].get_images()
    return {'scope':'20-degree original baseline/direction preserved, CropBox and native replacement'}

def nested(page,name):
    open_editor(page,'nested');pick(page,'NESTED ORIGINAL',True).fill('NESTED EDIT');page.get_by_role('toolbar',name='Text direkt formatieren',exact=True).get_by_role('button',name='Fertig',exact=True).click()
    image=page.get_by_role('button',name=re.compile('^Vorhandenes Bild auswählen '));expect(image).to_have_count(2,timeout=120000);image.first.click();page.get_by_role('button',name='Bildinhalt zum Zuschneiden anzeigen',exact=True).click();expect(page.get_by_alt_text('Bildinhalt vor dem Zuschneiden',exact=True)).to_be_visible(timeout=90000);page.get_by_label('Bildzuschnitt w',exact=True).fill('50');page.get_by_role('button',name='Bildzuschnitt übernehmen',exact=True).click()
    file=save(page,name)
    with pymupdf.open(file) as after,pymupdf.open(fixtures/'nested.pdf') as before:
        content=after[0].get_text();assert content.count('NESTED ORIGINAL')==1 and content.count('NESTED EDIT')==1 and content.count('NESTED FOOTER')==2
        widths=sorted(i[2]for i in after[0].get_images(full=True));assert 30 in widths and 60 in widths,widths
        pymupdf.TOOLS.store_shrink(100);a=before[0].get_pixmap(clip=pymupdf.Rect(430,0,850,500));pymupdf.TOOLS.store_shrink(100);b=after[0].get_pixmap(clip=pymupdf.Rect(430,0,850,500))
        # MuPDF's compositing of the regenerated Form rounds some edge samples
        # by one 8-bit level on Windows. Verify content/geometry independently.
        deltas=[abs(x-y) for x,y in zip(a.samples,b.samples)];assert max(deltas)<=1 and sum(v!=0 for v in deltas)<3000
        def right_spans(d):return [(s['text'],s['origin'],s['font'],s['size'])for block in d[0].get_text('dict')['blocks'] if 'lines'in block for line in block['lines']for s in line['spans']if s['origin'][0]>=430]
        assert right_spans(before)==right_spans(after)
        original_font=before.extract_font(before[0].get_fonts()[0][0])[3];assert any(after.extract_font(f[0])[3]==original_font for f in after[0].get_fonts())
        original_image=before[0].get_images(full=True)[0];right=next(i for i in after[0].get_images(full=True)if i[2]==60);assert pymupdf.Pixmap(before,original_image[0]).samples==pymupdf.Pixmap(after,right[0]).samples
        assert len(after[0].get_image_info())==2
    return {'scope':'instance-specific nested Form text removal/image crop, unchanged repeated instance text/geometry/font/image bytes, at most one-level render rounding'}

def repair(page,name):
    open_editor(page,'repair');pick(page,'Repair page 0').fill('Fixed page');file=save(page,name)
    assert 'repariert'in (out/(name+'-verification.txt')).read_text(encoding='utf8') or 'repariert'in page.locator('body').inner_text()
    with pymupdf.open(file) as after,pymupdf.open(fixtures/'repair.pdf') as before:
        assert len(after)==3 and 'Fixed page'in after[0].get_text() and 'Repair page 0'not in after[0].get_text();same_page(before,1,after,1);same_page(before,2,after,2)
    return {'scope':'damaged stream length repaired locally, visible notice, edited/reopened export, both other pages pixel identical'}

def cff(page,name):
    open_editor(page,'cff');field=pick(page,'A AΩ');field.fill('A Ω');expect(page.get_by_text(re.compile(r'^Originalschrift wird verwendet:')).first).to_be_visible(timeout=90000)
    file=save(page,name)
    with pymupdf.open(file) as d:assert d[0].get_text().strip()=='A Ω';assert not d[0].get_images()
    return {'scope':'original static CFF outline reuse and independently readable vector export'}

def high_scan(page,name):
    open_editor(page,'high-scan')
    # Check decoded pixels before waiting for OCR. A visible <img> can still
    # contain an incorrectly blank WebKit canvas after a large scan render.
    page.wait_for_function('''() => {
        const image=document.querySelector('.editor-sheet > img');
        if (!image?.complete || !image.naturalWidth) return false;
        const canvas=document.createElement('canvas');canvas.width=160;canvas.height=224;
        const context=canvas.getContext('2d');context.drawImage(image,0,0,160,224);
        const pixels=context.getImageData(0,0,160,224).data;
        let ink=0;for(let i=0;i<pixels.length;i+=4)if(Math.min(pixels[i],pixels[i+1],pixels[i+2])<180)ink++;
        canvas.width=canvas.height=0;return ink>40;
    }''',timeout=120000)
    target=page.get_by_role('button',name=re.compile(r'^Text bearbeiten: Rechnung')).first;expect(target).to_be_visible(timeout=180000)
    r=target.bounding_box();sheet=page.locator('.editor-sheet').bounding_box();box=[(r['x']-sheet['x'])/sheet['width'],(r['y']-sheet['y'])/sheet['height'],r['width']/sheet['width'],r['height']/sheet['height']];target.click();page.get_by_label('Text direkt in der PDF bearbeiten',exact=True).fill('BELEG');page.get_by_role('toolbar',name='Text direkt formatieren').get_by_label('Textgröße in Punkt',exact=True).fill('12');file=save(page,name)
    with pymupdf.open(file) as after,pymupdf.open(fixtures/'high-scan.pdf') as before:
        assert after[0].get_text().count('BELEG')==1
        a=pymupdf.Pixmap(before,before[0].get_images(full=True)[0][0]);b=pymupdf.Pixmap(after,after[0].get_images(full=True)[0][0]);assert (a.width,a.height,b.width,b.height)==(2500,3500,2500,3500)
        l,t,w,h=box;x0=max(0,int(l*2500)-3);x1=min(2500,int((l+w)*2500)+4);y0=max(0,int(t*3500)-3);y1=min(3500,int((t+h)*3500)+4);aa=a.samples;bb=b.samples;assert a.n==b.n
        for y in range(3500):
            start=y*2500*a.n;end=start+2500*a.n
            if y<y0 or y>=y1:assert aa[start:end]==bb[start:end],y
            else:assert aa[start:start+x0*a.n]==bb[start:start+x0*a.n] and aa[start+x1*a.n:end]==bb[start+x1*a.n:end],y
    return {'scope':'8.75-megapixel scan, retained original image dimensions, exact pixels outside bounded correction and searchable replacement'}

def high_scan_bitmap_loss(page,name):
    # Reproduce the observed all-white scan with one probe pixel in the worker
    # bitmap, without changing the PDF, renderer, UI, OCR or acceptance checks.
    # The application must avoid this broken native transfer path on WebKit.
    page.add_init_script('''(() => {
        const NativeWorker=window.Worker;
        window.pdfBitmapFaultWorkers=0;
        window.Worker=class extends NativeWorker {
            constructor(url,options) {
                const target=new URL(url,location.href).href;
                if(target.endsWith('/vendor/pdf/pdf.worker.min.mjs')) {
                    window.pdfBitmapFaultWorkers++;
                    const source=`
                        const transfer=OffscreenCanvas.prototype.transferToImageBitmap;
                        OffscreenCanvas.prototype.transferToImageBitmap=function() {
                            if(this.width===2500 && this.height===3500) {
                                const blank=new OffscreenCanvas(this.width,this.height);
                                blank.getContext('2d').fillRect(0,0,1,1);
                                return transfer.call(blank);
                            }
                            return transfer.call(this);
                        };
                        await import(${JSON.stringify(target)});
                    `;
                    url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
                }
                super(url,options);
            }
        };
    })()''')
    result=high_scan(page,name)
    assert page.evaluate('window.pdfBitmapFaultWorkers')>=1,'PDF worker fault injection was not installed'
    return result

def preflight(page,name):
    open_editor(page,'flow');field=pick(page,'First paragraph.');field.fill('A longer replacement needs several lines in this narrow frame.');geometry(page,'Objektbreite',160*25.4/72);geometry(page,'Objekthöhe',3)
    check=panel(page,'Änderungen vorprüfen');fix=check.get_by_role('button',name='Höhe sicher anpassen',exact=True);expect(fix).to_be_visible(timeout=90000);expect(check.locator('.editor-preflight-location')).to_have_count(1);expect(check.get_by_role('button',name='Anzeigen',exact=True)).to_have_count(1);expect(check).to_contain_text('A longer replacement');fix.click();expect(fix).to_have_count(0,timeout=90000);check.get_by_role('button',name='Originaltextentfernung testen',exact=True).click();expect(check).to_contain_text('Originaltext lässt sich physisch entfernen',timeout=120000)
    saved=save(page,name)
    with pymupdf.open(saved) as d:assert 'First paragraph.'not in d[0].get_text() and 'A longer replacement'in d[0].get_text()
    return {'scope':'delayed preflight, explicit safe height adjustment and physical original-text removal check'}

def payroll(page,name):
    open_editor(page,'payroll-scan')
    selection=panel(page,'Auswahl anpassen')
    selection.get_by_role('button',name='Einzelne Textstellen',exact=True).click()
    # No manual font, point-size or geometry adjustment is permitted here.
    pick(page,'September').fill('August')
    page.get_by_role('toolbar',name='Text direkt formatieren',exact=True).get_by_role('button',name='Fertig',exact=True).click()
    pick(page,'12').fill('18')
    file=save(page,name)
    review=page.get_by_role('region',name='Originaltreue vergleichen',exact=True)
    expect(review).to_contain_text('ein Scan bleibt eine Annäherung')
    expect(review.locator('.editor-detail-grid img')).to_have_count(2,timeout=120000)
    review.get_by_label('Gemeinsamer Zoom',exact=True).select_option('400')
    expect(review.locator('.editor-detail-grid img').first).to_have_attribute('data-zoom','400')
    review.get_by_label('Änderung auswählen',exact=True).select_option('1')
    expect(review.locator('.editor-detail-grid img')).to_have_count(2,timeout=120000)
    expect(review.locator('.editor-detail-grid img').last).to_have_attribute('data-zoom','400')
    assert 'Originalschrift verwendet' not in review.inner_text()
    panes=review.locator('.editor-detail-scroll');assert panes.count()==2
    assert panes.first.get_attribute('tabindex')=='0'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
    page.screenshot(path=str(out/(name+'-comparison.png')),full_page=True)
    with pymupdf.open(file) as after,pymupdf.open(fixtures/'payroll-scan.pdf') as before:
        spans=[s for b in after[0].get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans']]
        for text,baseline in [('August',85),('18',110)]:
            matches=[s for s in spans if s['text'].strip()==text];assert len(matches)==1,(text,matches)
            s=matches[0];assert abs(s['size']-14)<1,(text,s['size'])
            assert abs(s['origin'][0]-300)<1 and abs(s['origin'][1]-baseline)<1,(text,s['origin'])
        assert 'September' not in after[0].get_text()
        same_page(before,1,after,1)
        # Independent MuPDF render checks labels, amounts and footer outside edits.
        for rect in [(0,0,280,700),(280,145,500,700),(280,0,500,60)]:
            a=before[0].get_pixmap(clip=pymupdf.Rect(rect));b=after[0].get_pixmap(clip=pymupdf.Rect(rect))
            assert (a.width,a.height,a.samples)==(b.width,b.height,b.samples),rect
    return {'scope':'fictional payroll, automatic month and short-number typography, original scale/baseline, two synchronized detail crops, persistent zoom, local download and unchanged attachment/neighbor regions'}

def execute(browser,name,width,callback):
    selected=os.environ.get('MOINPDF_BROWSER_CASES','').split(',')
    if selected!=[''] and name not in selected:return
    context=browser.new_context(viewport={'width':width,'height':1000},has_touch=width<600,accept_downloads=True,reduced_motion='reduce')
    context.tracing.start(screenshots=True,snapshots=True,sources=True)
    page=context.new_page();page.set_default_timeout(45000);errors=[];blocked=[];diagnostics=[]
    page.on('console',lambda message:diagnostics.append({'event':'console','type':message.type,'text':message.text}))
    page.on('requestfailed',lambda request:diagnostics.append({'event':'requestfailed','url':request.url,'failure':request.failure}))
    page.on('worker',lambda worker:(diagnostics.append({'event':'worker-created','url':worker.url}),worker.on('close',lambda *_:diagnostics.append({'event':'worker-closed','url':worker.url}))))
    page.on('pageerror',lambda e:errors.append(str(e)))
    def route(r):
        if r.request.method not in ('GET','HEAD') or (urlsplit(r.request.url).netloc!=urlsplit(origin).netloc and not r.request.url.startswith(('blob:','data:'))):blocked.append(r.request.url);r.abort()
        else:r.continue_()
    page.route('**/*',route);result={'case':name,'viewport':width};print('START: '+name,flush=True)
    try:result.update(**callback(page,name));assert not errors,errors;assert not blocked,blocked;result['status']='passed'
    except Exception as e:
        result.update(status='failed',error=str(e),traceback=traceback.format_exc(),page_errors=errors,blocked_requests=blocked,diagnostics=diagnostics);print(result['traceback'],flush=True)
        try:page.screenshot(path=str(out/(name+'-failure.png')),full_page=True,timeout=10000);(out/(name+'-failure.txt')).write_text(page.locator('body').inner_text(timeout=5000),encoding='utf8')
        except Exception:pass
    finally:
        if result.get('status')=='failed':context.tracing.stop(path=str(out/(name+'-trace.zip')))
        else:context.tracing.stop()
        report['results'].append(result);(out/'adaptive-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');context.close();print(result['status'].upper()+': '+name,flush=True)
with sync_playwright() as api:
    for engine in os.environ.get('MOINPDF_TEST_BROWSERS','chromium,firefox,webkit').split(','):
        cases=[('flow',1440,auto_flow),('table',1440,table_rows),('table-touch',390,table_rows),('form',1440,forms),('angle',390,angle),('nested',1440,nested),('repair',1440,repair),('cff',1440,cff),('high-scan',390,high_scan),('preflight',1440,preflight),('payroll',1440,payroll),('payroll-touch',390,payroll)]
        if engine=='webkit':cases.append(('high-scan-bitmap-loss',390,high_scan_bitmap_loss))
        selected=os.environ.get('MOINPDF_ADAPTIVE_CASES','').split(',')
        for suffix,width,callback in cases:
            if selected!=[''] and suffix not in selected:continue
            # Independent acceptance cases must not inherit accumulated native
            # canvas/GPU allocations from previous browser contexts. Within-case
            # editing, undo, export and retained-content assertions still share
            # their original context and remain unchanged.
            browser=getattr(api,engine).launch();report[engine]=browser.version
            try:execute(browser,engine+'-adaptive-'+suffix,width,callback)
            finally:browser.close()
raise SystemExit(0 if report['results'] and all(r['status']=='passed'for r in report['results'])else 1)
