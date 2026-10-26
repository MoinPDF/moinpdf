"""Production workers, 1,000-page final output and >80 MiB input; fictional fixtures."""
import atexit, json, os, subprocess, sys, time, traceback
from pathlib import Path
from urllib.request import urlopen
import pymupdf
from playwright.sync_api import sync_playwright, expect
origin=os.getenv('MOINPDF_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path('.cache/editor-browser/optimizations');out.mkdir(parents=True,exist_ok=True)
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
    else:raise RuntimeError('Production server unavailable')
large=out/'fictional-1000.pdf'
with pymupdf.open() as d:
    for i in range(1000):
        p=d.new_page(width=320,height=450);p.insert_text((20,50),f'FICTIONAL PAGE {i+1}',fontsize=14)
    d.save(large)
wide=out/'fictional-81mb.pdf'
with pymupdf.open() as d:
    p=d.new_page();p.insert_text((30,50),'FICTIONAL BIG INPUT')
    x=d.get_new_xref();d.update_object(x,'<<>>');d.update_stream(x,b'X'*(81*1024*1024),compress=False);d.save(wide,garbage=0,deflate=False)
assert wide.stat().st_size>80*1024*1024
secret=out/'fictional-secret.pdf'
with pymupdf.open() as d:
    p=d.new_page(width=600,height=800);p.insert_text((45,90),'FICTIONAL SECRET 880055',fontsize=14);p.insert_text((45,380),'KEEP searchable text',fontsize=16);p.draw_rect(pymupdf.Rect(45,450,140,520),color=None,fill=(.1,.7,.3));p.insert_link({'kind':pymupdf.LINK_URI,'from':pymupdf.Rect(45,600,180,620),'uri':'https://example.test/keep'});d.save(secret)
reports=[]
with sync_playwright() as pw:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS','chromium').split(','):
        browser=getattr(pw,engine).launch()
        for en in (False,True):
            context=browser.new_context(viewport={'width':390 if en else 1440,'height':950},has_touch=en,accept_downloads=True,reduced_motion='reduce')
            page=context.new_page();page.set_default_timeout(45000)
            name=f'{engine}-'+('touch-en' if en else 'desktop-de');report={'case':name};errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
            def t(a,b):return b if en else a
            def choose(title):
                page.locator('.chooser-tool').filter(has=page.get_by_text(title,exact=True)).click()
                expect(page.get_by_role('heading',name=title,exact=True)).to_be_visible()
            def download(filename):
                link=page.locator('.advanced-result a[download][href^="blob:"]').first
                expect(link).to_be_visible(timeout=120000)
                with page.expect_download() as event:link.click()
                path=out/filename;event.value.save_as(path);return path
            try:
                page.goto(origin+('?lang=en' if en else '?lang=de'))
                page.locator('input[type=file]').first.set_input_files(str(secret.resolve()))
                choose(t('Suchen & schwärzen','Search & redact'))
                page.get_by_label(t('Namen oder Suchbegriffe','Names or search terms'),exact=True).fill('FICTIONAL SECRET')
                page.get_by_label(t('Schwärzungsmodus','Redaction mode'),exact=True).select_option('preserve')
                page.get_by_role('button',name=t('Fundstellen suchen','Find matches'),exact=True).click()
                reviewed=page.get_by_label(t('Ich habe die ausgewählten Bereiche in der Vorschau kontrolliert.','I checked the selected areas in the preview.'),exact=True)
                expect(reviewed).to_be_visible(timeout=120000);reviewed.check()
                page.get_by_role('button',name=t('Ausgewählte Fundstellen schwärzen','Redact selected matches'),exact=True).click()
                result=download(name+'-redacted.pdf')
                with pymupdf.open(result) as d:
                    assert 'SECRET' not in d[0].get_text();assert 'KEEP searchable' in d[0].get_text();assert d[0].get_links()[0]['uri']=='https://example.test/keep'
                    assert all(b'FICTIONAL SECRET' not in (d.xref_stream(i) or b'') for i in range(1,d.xref_length()) if d.xref_is_stream(i))
                page.get_by_role('button',name=t('Zurück zur Auswahl','Back to selection'),exact=True).click()
                choose(t('Große PDFs verarbeiten','Process large PDFs'))
                page.get_by_label(t('Große PDF auswählen','Choose large PDF'),exact=True).set_input_files(str((wide if en else large).resolve()))
                page.get_by_label(t('Aktion','Action'),exact=True).select_option('rotate90')
                started=time.monotonic();page.get_by_role('button',name=t('Lokal sichern und starten','Save locally and start'),exact=True).click()
                complete=page.get_by_role('button',name=t('Gesamtausgabe prüfen und erstellen','Verify and create full export'),exact=True)
                expect(complete).to_be_enabled(timeout=900000)
                # Tool remount reads real IndexedDB checkpoints; final output follows a resumed session.
                page.get_by_role('button',name=t('Zurück zur Auswahl','Back to selection'),exact=True).click()
                choose(t('Große PDFs verarbeiten','Process large PDFs'))
                saved=page.get_by_label(t('Gespeicherter Auftrag','Saved job'),exact=True);expect(saved).to_be_visible();saved.select_option(index=1)
                complete.click();result=download(name+'-large.pdf')
                with pymupdf.open(result) as d:
                    assert len(d)==(1 if en else 1000)
                    for i,p in enumerate(d):assert p.rotation==90 and (('FICTIONAL BIG INPUT' if en else f'FICTIONAL PAGE {i+1}') in p.get_text())
                report['pages']=1 if en else 1000;report['input_bytes']=(wide if en else large).stat().st_size;report['seconds']=round(time.monotonic()-started,2)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2')
                page.screenshot(path=str(out/(name+'.png')),full_page=False)
                assert not errors,errors;report['status']='passed'
            except Exception:
                report.update(status='failed',error=traceback.format_exc(),page_errors=errors)
                try:page.screenshot(path=str(out/(name+'-failed.png')),full_page=False,timeout=10000)
                except Exception:pass
            finally:context.close()
            reports.append(report);(out/'report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(report),flush=True)
        browser.close()
assert all(r['status']=='passed' for r in reports)
