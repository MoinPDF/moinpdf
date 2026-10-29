"""Fictional inputs, real exports and independent PDF/calendar inspection in three browser engines."""
import atexit, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path
from urllib.request import urlopen
import pymupdf
from icalendar import Calendar
from playwright.sync_api import sync_playwright, expect
origin=os.getenv('MOINPDF_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path('.cache/editor-browser/productivity');out.mkdir(parents=True,exist_ok=True)
if os.getenv('MOINPDF_TEST_START_SERVER')=='1':
    log=(out/'http.log').open('w');server=subprocess.Popen([sys.executable,'tests/text-browser-server.py'],stdout=log,stderr=subprocess.STDOUT)
    def cleanup():
        server.terminate();server.wait(timeout=10);log.close()
    atexit.register(cleanup)
    for _ in range(50):
        try:
            with urlopen(origin,timeout=1) as r:
                if r.status==200:break
        except OSError:time.sleep(.1)
    else:raise RuntimeError('Production server unavailable')
# Includes a clear letter, two identical logos, one blank page and a partial dark scan edge.
fixture=out/'fictional-documents.pdf'
with pymupdf.open() as d:
    p=d.new_page(width=400,height=500)
    p.insert_text((40,60),'Kontoauszug Bank Januar 2026',fontsize=16)
    p.insert_text((40,100),'Besprechung am 31.12.2026 um 14:30 Uhr.',fontsize=14)
    p.insert_text((40,135),'Abgabe am 5. Januar 2027.',fontsize=14)
    p=d.new_page(width=400,height=500);p.draw_rect(pymupdf.Rect(0,30,16,400),color=None,fill=(.1,.1,.1));p.insert_text((40,60),'Fictional edge fixture',fontsize=16)
    d.save(fixture)
compare=[]
for value in [100,200,300]:
    path=out/f'fictional-version-{value}.pdf'
    with pymupdf.open() as d:
        p=d.new_page();p.insert_text((40,60),f'Der Preis fuer die Lieferung betraegt {value} Euro.',fontsize=16);p.insert_text((40,100),'Die Lieferung erfolgt am Montag.',fontsize=16);d.save(path)
    compare.append(path)
replacement=out/'fictional-blue.png'
with pymupdf.open() as d:
    p=d.new_page(width=20,height=20);p.draw_rect(p.rect,fill=(0,0,1),color=None);p.get_pixmap().save(replacement)
logo_fixture=Path('.cache/productivity/logos-original.pdf');assert logo_fixture.exists(),'Run productivity-smoke first'
originals={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [fixture,logo_fixture,*compare]}
# Parse the engine's hostile-text fixture with a separate RFC 5545 implementation.
cal=Calendar.from_ical(Path('.cache/productivity/calendar.ics').read_bytes());events=cal.walk('VEVENT');assert len(events)==1
assert events[0].decoded('dtstart').isoformat()=='2026-12-31'
assert events[0].decoded('dtend').isoformat()=='2027-01-01'
assert '\nBEGIN:VEVENT' in str(events[0]['summary'])
reports=[]
with sync_playwright() as api:
    for engine in os.getenv('MOINPDF_TEST_BROWSERS','chromium,firefox,webkit').split(','):
        opts={'executable_path':os.environ['MOINPDF_TEST_BROWSER_EXECUTABLE']} if os.getenv('MOINPDF_TEST_BROWSER_EXECUTABLE') else {}
        browser=getattr(api,engine).launch(**opts)
        try:
            for lang in os.getenv('MOINPDF_TEST_LANGUAGES','de,en').split(','):
                en=lang=='en';name=engine+'-'+lang
                context=browser.new_context(viewport={'width':390 if en else 1440,'height':950},has_touch=en,accept_downloads=True,reduced_motion='reduce')
                page=context.new_page();page.set_default_timeout(60000);errors=[];posts=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.on('request',lambda r:posts.append(r.url) if r.method=='POST' else None)
                def local(route):
                    if route.request.method=='POST' or not route.request.url.startswith((origin+'/', 'blob:'+origin+'/')):route.abort()
                    else:route.continue_()
                context.route('**/*',local)
                def t(de,eng):return eng if en else de
                def btn(de,eng):return page.get_by_role('button',name=t(de,eng),exact=True)
                def label(de,eng):return page.get_by_label(t(de,eng),exact=True)
                def open_tool(de,eng,files):
                    page.goto(origin+'?lang='+lang)
                    page.locator('input[type=file]').first.set_input_files([str(p.resolve()) for p in files])
                    expect(page.locator('.chooser-tool')).to_have_count(120)
                    page.locator('.chooser-tool').filter(has=page.get_by_text(t(de,eng),exact=True)).click()
                def download(suffix,advanced=True):
                    link=page.locator(('.advanced-result ' if advanced else '')+'a[download][href^="blob:"]').first
                    expect(link).to_be_visible(timeout=120000)
                    with page.expect_download() as pending:link.click()
                    path=out/(name+suffix);pending.value.save_as(path);return path
                def restore_current_project(title):
                    page.locator('.project-toggle:visible, .harbor-project-toggle:visible').first.click()
                    dialog=page.get_by_role('dialog',name=t('Lokale PDF-Projekte','Local PDF projects'),exact=True)
                    dialog.get_by_label(t('Projektname','Project name'),exact=True).fill(title)
                    save=dialog.get_by_role('button',name=re.compile(t('^(Projekt speichern|Neuen Arbeitsstand speichern)$','^(Save project|Save new snapshot)$')))
                    save.click();expect(save).to_be_enabled(timeout=30000)
                    expect(dialog.get_by_role('status').filter(has_text=t('Alles an Bord – gespeichert.','All aboard – saved.'))).to_be_visible(timeout=30000)
                    section=dialog.locator('.project-list section').filter(has=page.get_by_role('heading',name=re.compile(re.escape(title))))
                    section.get_by_role('button',name=t('Öffnen','Open'),exact=True).first.click()
                    expect(dialog).to_have_count(0)
                try:
                    print(name,'checklist',flush=True)
                    open_tool('Unterlagen-Checkliste','Document checklist',[fixture])
                    label('Bezeichnung','Label').fill('Bank January')
                    label('Suchwörter','Keywords').fill('Kontoauszug, Bank')
                    label('Monat (optional)','Month (optional)').fill('2026-01')
                    btn('Unterlagen prüfen','Check documents').click()
                    card=page.locator('article.intake-rule').first
                    expect(card).to_contain_text(t('Unklar','Unclear'))
                    export=btn('Checkliste als CSV herunterladen','Download checklist as CSV');expect(export).to_be_disabled()
                    card.get_by_role('button',name='fictional-documents.pdf · '+t('Seite','Page')+' 1',exact=True).click()
                    card.get_by_role('checkbox').check();expect(card).to_contain_text(t('Vorhanden','Present'))
                    export.click();csv=download('-checklist.csv').read_text(encoding='utf-8-sig');assert 'Bank January' in csv and 'fictional-documents.pdf' in csv and t('Vorhanden','Present') in csv
                    restore_current_project('Fictional checklist review')
                    expect(export).to_be_disabled();expect(card.get_by_role('checkbox')).not_to_be_checked();expect(page.locator('.advanced-result')).to_have_count(0)
                    label('Suchwörter','Keywords').fill('Missing term');expect(page.locator('.advanced-result')).to_have_count(0)
                    print(name,'dates',flush=True)
                    open_tool('Termine aus PDFs übernehmen','Collect dates from PDFs',[fixture])
                    btn('Datumsangaben suchen','Find dates').click();expect(page.locator('article.intake-rule')).to_have_count(2)
                    export=btn('Bestätigte Termine als ICS herunterladen','Download confirmed events as ICS');expect(export).to_be_disabled()
                    cards=page.locator('article.intake-rule');cards.nth(0).get_by_label(t('Termintitel','Event title'),exact=True).fill('Reviewed meeting')
                    cards.nth(0).get_by_role('checkbox').check();export.click();ics=download('-events.ics');events=Calendar.from_ical(ics.read_bytes()).walk('VEVENT');assert len(events)==1 and str(events[0]['summary'])=='Reviewed meeting';assert events[0].decoded('dtstart').isoformat()=='2026-12-31T14:30:00';assert events[0].decoded('duration').total_seconds()==3600
                    cards.nth(0).get_by_label(t('Datum','Date'),exact=True).fill('2027-01-02');expect(export).to_be_disabled();expect(page.locator('.advanced-result')).to_have_count(0)
                    cards.nth(1).get_by_role('checkbox').check();export.click();events=Calendar.from_ical(download('-all-day.ics').read_bytes()).walk('VEVENT');assert len(events)==1 and events[0].decoded('dtstart').isoformat()=='2027-01-05' and events[0].decoded('dtend').isoformat()=='2027-01-06'
                    restore_current_project('Fictional date review')
                    expect(export).to_be_disabled();expect(cards.nth(1).get_by_role('checkbox')).not_to_be_checked();expect(page.locator('.advanced-result')).to_have_count(0)
                    page.screenshot(path=str(out/(name+'-dates.png')),full_page=True)
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'intake overflow'
                    print(name,'three versions',flush=True)
                    open_tool('PDFs vergleichen','Compare PDFs',compare)
                    page.get_by_role('combobox',name=t('Vergleichsart','Type of comparison'),exact=True).click();page.get_by_role('option',name=t('Drei Fassungen vergleichen','Compare three versions'),exact=True).click()
                    btn('Text vergleichen','Compare text').click();report=download('-comparison.txt',False).read_text(encoding='utf-8-sig')
                    assert t('Widersprüchliche Textänderungen','Conflicting text changes') in report,report
                    assert all(str(v)+' Euro' in report for v in [100,200,300]);assert t('Keine Textänderung','No text change') in report
                    print(name,'scan quality',flush=True)
                    open_tool('Check & Seitenfinder','Check & page finder',[fixture])
                    btn('Scan-Qualität prüfen','Check scan quality').click()
                    expect(page.locator('.check-page-row').filter(has_text=t('Inhalt nahe dem Seitenrand','Content near the page edge'))).to_have_count(1)
                    expect(page.locator('.scan-quality-region').first).to_be_visible();page.screenshot(path=str(out/(name+'-quality.png')),full_page=True)
                    print(name,'recurring logos',flush=True)
                    open_tool('PDF-Objekte bearbeiten','Edit PDF objects',[logo_fixture])
                    label('Bearbeitung','Editing').select_option('repeated')
                    btn('Wiederkehrende Bilder suchen','Find recurring images').click()
                    expect(page.locator('.repeated-images-panel [role=status]')).to_contain_text('3',timeout=60000)
                    export=btn('Ausgewählte Logos ersetzen','Replace selected logos');expect(export).to_be_disabled()
                    label('Fundstelle 1 · Seite 1','match 1 · Page 1').check()
                    label('Fundstelle 2 · Seite 2','match 2 · Page 2').check()
                    label('Ersatzbild (PNG, JPG, WebP)','Replacement image (PNG, JPG, WebP)').set_input_files(str(replacement.resolve()))
                    label('Fundstellen und Ersatzbild geprüft','Occurrences and replacement image reviewed').check();export.click();output=download('-logos.pdf')
                    with pymupdf.open(output) as d, pymupdf.open(logo_fixture) as original:
                        assert len(d)==3
                        for i in range(3):
                            assert d[i].get_text()==original[i].get_text();assert d[i].rotation==original[i].rotation
                        assert d[2].get_pixmap().samples==original[2].get_pixmap().samples,'unselected page pixels'
                        for i in [0,1]:
                            pix=d[i].get_pixmap();data=pix.samples;blue=sum(data[k+2]>220 and data[k]<40 for k in range(0,len(data),pix.n));assert blue>1200,(i,blue)
                        assert [w.field_value for w in d[0].widgets()]==[w.field_value for w in original[0].widgets()]
                        assert [l.get('uri') for l in d[0].get_links()]==[l.get('uri') for l in original[0].get_links()]==['https://example.invalid/fictional']
                    label('Fundstelle 1 · Seite 1','match 1 · Page 1').uncheck();expect(export).to_be_disabled();expect(page.locator('.advanced-result')).to_have_count(0)
                    page.screenshot(path=str(out/(name+'-logos.png')),full_page=True)
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'logo panel overflow'
                    assert not errors,errors;assert not posts,posts
                    reports.append({'browser':engine,'language':lang,'touchEmulation':en,'checks':['checklist CSV and confirmation','dates ICS independently parsed','restoring identical IDs clears review and result','three-way conflict report','scan-quality region','selected logos only; text, forms, links, geometry preserved','no document upload']})
                except Exception:
                    page.screenshot(path=str(out/(name+'-failure.png')),full_page=True)
                    (out/(name+'-failure.txt')).write_text(page.locator('body').inner_text())
                    raise
                finally:context.close()
        finally:browser.close()
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==digest for p,digest in originals.items())
(out/'report.json').write_text(json.dumps(reports,indent=2))
print('PASS:',len(reports),'productivity browser scenarios; desktop and touch emulation, not physical devices.')
