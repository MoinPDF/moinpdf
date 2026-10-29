"""End-to-end form profiles and receipt printing, fictional files, real downloads."""
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
out=Path('.cache/editor-browser/everyday');out.mkdir(parents=True,exist_ok=True)
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
form_path=out/'fictional-form.pdf'
with pymupdf.open() as doc:
    page=doc.new_page()
    page.insert_text((40,35),'Fictional form - original retained')
    for i,(label,value) in enumerate([('Vorname',''),('Nachname','Original')]):
        widget=pymupdf.Widget();widget.field_name=label;widget.field_type=pymupdf.PDF_WIDGET_TYPE_TEXT
        widget.rect=pymupdf.Rect(60,180+i*60,350,208+i*60);widget.field_value=value
        page.add_widget(widget)
    doc.save(form_path)
receipt_path=out/'fictional-receipt.pdf'
with pymupdf.open() as doc:
    page=doc.new_page(width=400,height=800)
    page.draw_rect(pymupdf.Rect(0,0,200,800),color=None,fill=(1,0,0))
    page.draw_rect(pymupdf.Rect(200,0,400,800),color=None,fill=(0,.7,0))
    page.insert_text((220,50),'EXCLUDED CONTENT')
    doc.save(receipt_path)
reports=[]
with sync_playwright() as api:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS','chromium').split(','):
        for en in (False,True):
            # Each independent device/language case owns a browser process.
            # A closed WebKit context must not carry focus or graphics state
            # from the desktop case into the touch-emulated case.
            browser=getattr(api,engine).launch()
            try:
                context=browser.new_context(viewport={'width':390 if en else 1440,'height':950},has_touch=en,accept_downloads=True,reduced_motion='reduce')
                context.tracing.start(screenshots=True,snapshots=True,sources=True)
                page=context.new_page();page.set_default_timeout(45000);errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                name=f'{engine}-'+('touch-en' if en else 'desktop-de')
                def t(de,english):return english if en else de
                def button(de,english):return page.get_by_role('button',name=t(de,english),exact=True)
                def label(de,english):return page.get_by_label(t(de,english),exact=True)
                def fill_detail(de,english,value):
                    control=label(de,english)
                    # fill() alone does not check stable geometry or hit targets.
                    # Establish actual user focus before writing, then verify
                    # both the committed value and its retention after blur.
                    control.click();expect(control).to_be_focused()
                    control.fill(value);expect(control).to_have_value(value)
                    control.press('Tab');expect(control).to_have_value(value)
                def choose(de,english):
                    page.locator('.chooser-tool').filter(has=page.get_by_text(t(de,english),exact=True)).click()
                    expect(page.get_by_role('heading',name=t(de,english),exact=True)).to_be_visible()
                def no_overflow():assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'),name
                def download(filename):
                    control=page.locator('.advanced-result a[download][href^="blob:"]').first
                    expect(control).to_be_visible(timeout=120000)
                    with page.expect_download(timeout=120000) as event:control.click()
                    path=out/filename;event.value.save_as(path);return path
                try:
                    page.goto(origin+('?lang=en' if en else '?lang=de'))
                    page.locator('input[type=file]').first.set_input_files(str(form_path.resolve()))
                    expect(page.locator('.chooser-tool')).to_have_count(120)
                    choose('Formularhelfer','Form helper')
                    fill_detail('Profilname','Profile name','Fictional family')
                    fill_detail('Vorname','First name','Jörg')
                    fill_detail('Nachname','Last name','Müller')
                    expect(label('Vorname','First name')).to_have_value('Jörg')
                    expect(label('Nachname','Last name')).to_have_value('Müller')
                    # Autofill can deliver several input events before React commits.
                    # Each update must retain the other fields from the same batch.
                    page.locator('.profile-entries').evaluate('''root => {
                        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                        const rows = root.querySelectorAll('.profile-entry');
                        for (const [index, value] of [[0, 'Jörg Beispiel'], [1, 'Müller Beispiel']]) {
                            const input = rows[index].querySelectorAll('input')[1];
                            setter.call(input, value);
                            input.dispatchEvent(new Event('input', {bubbles: true}));
                        }
                    }''')
                    expect(label('Vorname','First name')).to_have_value('Jörg Beispiel')
                    expect(label('Nachname','Last name')).to_have_value('Müller Beispiel')
                    fill_detail('Vorname','First name','Jörg')
                    fill_detail('Nachname','Last name','Müller')
                    button('Profil speichern','Save profile').click()
                    expect(page.get_by_text(t('Profil auf diesem Gerät gespeichert.','Profile saved on this device.'),exact=True)).to_be_visible()
                    expect(label('Vorname','First name')).to_have_value('Jörg')
                    expect(label('Nachname','Last name')).to_have_value('Müller')
                    button('Formularfelder laden','Load form fields').click()
                    button('Angaben vorschlagen','Suggest details').click()
                    expect(page.locator('.helper-field-list')).to_contain_text('Jörg')
                    expect(page.locator('.helper-field-list')).to_contain_text('Original')
                    label('Angabe zum Platzieren','Detail to place').select_option('entry-1')
                    button('Angabe auf Seite platzieren','Place detail on page').click()
                    button('Bereich hinzufügen','Add area').click()
                    expect(label('Feldinhalt','Field value')).to_have_value('Müller')
                    expect(button('Ausgefüllte PDF erstellen','Create completed PDF')).to_be_disabled()
                    label('Formularwerte dauerhaft festschreiben','Permanently flatten form values').check()
                    label('Ich habe Angaben und Positionen am Original geprüft.','I have checked the details and positions against the original.').check()
                    no_overflow();page.screenshot(path=str(out/f'{name}-form.png'),full_page=True)
                    button('Ausgefüllte PDF erstellen','Create completed PDF').click()
                    expect(page.locator('.advanced-result')).to_be_visible(timeout=120000)
                    with pymupdf.open(download(name+'-form.pdf')) as doc:
                        text=' '.join(p.get_text() for p in doc)
                        assert 'Jörg' in text and 'Müller' in text and 'Original' in text and 'Fictional form' in text,text
                        assert not list(doc[0].widgets() or [])
                    # Workspace remount retains document changes; profile storage is independent.
                    button('Zurück zur Auswahl','Back to selection').click();choose('Formularhelfer','Form helper')
                    expect(page.locator('.helper-field-list')).to_contain_text('Müller')
                    label('Gespeichertes Profil','Saved profile').select_option(label='Fictional family')
                    expect(label('Vorname','First name')).to_have_value('Jörg')
                    button('Profil löschen','Delete profile').click()
                    expect(page.get_by_text(t('Profil gelöscht.','Profile deleted.'),exact=True)).to_be_visible()
                    button('Zurück zur Auswahl','Back to selection').click()
                    # Same context, a separate page avoids carrying the form into the receipt job.
                    page.close();page=context.new_page();page.set_default_timeout(45000)
                    page.on('pageerror',lambda error:errors.append(str(error)))
                    page.goto(origin+('?lang=en' if en else '?lang=de'))
                    # Dismiss optional restoration by selecting new test files.
                    page.locator('input[type=file]').first.set_input_files(str(receipt_path.resolve()))
                    choose('Belege auf A4 sammeln','Collect receipts on A4')
                    button('Belege laden','Load receipts').click()
                    label('Breite (%)','Width (%)').fill('50')
                    label('Beschriftung (optional)','Caption (optional)').fill('Büro')
                    no_overflow()
                    button('A4-Vorschau','A4 preview').click()
                    expect(page.locator('.receipt-placement')).to_have_count(2)
                    expect(page.locator('.receipt-source img')).to_have_count(2,timeout=30000)
                    # The full source must exactly fill its scaled box before cropping.
                    # Global preview height limits would otherwise offset long receipts
                    # on desktop while the exported PDF and mobile layout remain correct.
                    preview_geometry=page.locator('.receipt-source').evaluate_all('''nodes => nodes.map(node => {
                        const box=node.getBoundingClientRect(), image=node.querySelector('img').getBoundingClientRect();
                        return ['x','y','width','height'].map(key => Math.abs(box[key]-image[key]));
                    })''')
                    assert all(delta<1 for box in preview_geometry for delta in box),preview_geometry
                    no_overflow();page.screenshot(path=str(out/f'{name}-receipts.png'),full_page=True)
                    button('Belege als A4-PDF erstellen','Create A4 receipt PDF').click()
                    expect(page.locator('.advanced-result')).to_be_visible(timeout=120000)
                    with pymupdf.open(download(name+'-receipts.pdf')) as doc:
                        assert len(doc)==1
                        assert abs(doc[0].rect.width-595.276)<.1 and abs(doc[0].rect.height-841.89)<.1
                        text=doc[0].get_text();assert 'Büro' in text and 'EXCLUDED' not in text,text
                        pix=doc[0].get_pixmap();color=pix.pixel(60,60)
                        assert color[0]>240 and color[1]<10 and color[2]<10,color
                    button('Belege zuschneiden','Crop receipts').click()
                    label('Druckbreite (mm)','Print width (mm)').fill('190')
                    label('Seitenrand (mm)','Page margin (mm)').fill('25')
                    expect(page.get_by_role('alert')).to_contain_text(t('breiter als der Druckbereich','wider than the printable area'))
                    expect(button('Belege als A4-PDF erstellen','Create A4 receipt PDF')).to_be_disabled()
                    expect(page.locator('.advanced-result')).to_have_count(0)
                    assert not errors,errors
                    reports.append({'case':name,'passed':True,'checks':['profile save/load/delete','conservative suggestions','scan placement','explicit review','real PDF values','draft remount','crop pixels','long receipt layout','A4 size','responsive layout','invalid width']})
                except Exception as error:
                    reports.append({'case':name,'passed':False,'error':str(error),'pageErrors':errors})
                    page.screenshot(path=str(out/f'{name}-failure.png'),full_page=True)
                    context.tracing.stop(path=str(out/f'{name}-trace.zip'))
                    raise
                finally:
                    (out/'report.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False));context.close()
            finally:browser.close()
print('PASS: form profiles, reviewed PDF export, scan entries, receipt crop/preview/export, real A4 pixels, state restoration and desktop/touch-emulated layouts.')
