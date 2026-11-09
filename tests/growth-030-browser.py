"""Real new-tool journeys in CI browsers, fictional inputs and independently read downloads."""
import atexit,io,json,os,subprocess,sys,time,zipfile
from pathlib import Path
from urllib.request import urlopen
import pymupdf as fitz
from playwright.sync_api import sync_playwright,expect
origin=os.getenv('MOINPDF_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path('.cache/editor-browser/growth030');out.mkdir(parents=True,exist_ok=True)
if os.getenv('MOINPDF_TEST_START_SERVER')=='1':
 log=(out/'http.log').open('w');server=subprocess.Popen([sys.executable,'tests/text-browser-server.py'],stdout=log,stderr=subprocess.STDOUT)
 def cleanup():server.terminate();server.wait(timeout=10);log.close()
 atexit.register(cleanup)
 for _ in range(50):
  try:
   with urlopen(origin,timeout=1) as response:
    if response.status==200:break
  except OSError:time.sleep(.1)
 else:raise RuntimeError('Production server unavailable')
fixtures=Path('tests/fixtures/growth030');draft=json.loads((fixtures/'invoice.json').read_text());catalog=json.loads(Path('public/locales/en.json').read_text());reports=[]
with sync_playwright() as api:
 for engine in os.getenv('MOINPDF_TEST_BROWSERS','chromium').split(','):
  for en in (False,True):
   browser=getattr(api,engine).launch();context=browser.new_context(viewport={'width':390 if en else 1440,'height':950},has_touch=en,accept_downloads=True,reduced_motion='reduce');context.tracing.start(screenshots=True,snapshots=True,sources=True);page=context.new_page();page.set_default_timeout(45000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));case=engine+('-touch-en' if en else '-desktop-de')
   def t(s):return catalog.get(s,s) if en else s
   def button(s):return page.get_by_role('button',name=t(s),exact=True)
   def label(s):return page.get_by_label(t(s),exact=True)
   def choose(s):page.locator('.chooser-tool').filter(has=page.get_by_text(t(s),exact=True)).click();expect(page.get_by_role('heading',name=t(s),exact=True)).to_be_visible()
   def download(name):
    link=page.locator('.advanced-result a[download][href^="blob:"]').first;expect(link).to_be_visible(timeout=120000)
    with page.expect_download(timeout=120000) as event:link.click()
    path=out/(case+'-'+name);event.value.save_as(path);return path
   def overflow():
    if not page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'):
     page.screenshot(path=str(out/(case+'-overflow.png')),full_page=True)
     offenders=page.evaluate('Array.from(document.querySelectorAll("body *")).map(e=>({tag:e.tagName,css:e.className,text:e.textContent?.slice(0,100),right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.width>0 && e.right>innerWidth+2).slice(-20)')
     raise AssertionError(case+' horizontal overflow: '+json.dumps(offenders,ensure_ascii=False))
   try:
    page.goto(origin+('?lang=en' if en else '?lang=de'));button('Alle Werkzeuge').click();expect(page.locator('.chooser-tool')).to_have_count(127)
    choose('E-Rechnung erstellen');expect(button('Angaben aus der geöffneten PDF vorschlagen')).to_be_disabled()
    # Real controlled inputs: verify that date and address values survive later changes.
    for key,title in [('number','Rechnungsnummer'),('date','Rechnungsdatum'),('delivery','Leistungsdatum'),('due','Fällig am'),('reference','Käuferreferenz'),('iban','IBAN')]:label(title).fill(draft[key]);label(title).press('Tab')
    for index,key in enumerate(['seller','buyer']):
     for field,title in [('name','Name / Firma'),('street','Straße und Hausnummer'),('postcode','Postleitzahl'),('city','Ort'),('country','Ländercode'),('email','E-Mail-Adresse')]:label(title).nth(index).fill(draft[key][field])
    for field,title in [('vatId','USt-IdNr.'),('contact','Kontaktperson'),('phone','Telefonnummer')]:label(title).fill(draft['seller'][field])
    label('Bezeichnung').fill('Fictional service');label('Menge').fill('2');label('Netto-Einzelpreis').fill('50.00');expect(label('Leistungsdatum')).to_have_value(draft['delivery']);expect(label('Fällig am')).to_have_value(draft['due']);overflow()
    button('Lokale PDF-Vorschau erstellen').click()
    with fitz.open(download('invoice.pdf')) as pdf:
     text=' '.join(p.get_text() for p in pdf);assert '119.00' in text and 'Fictional service' in text and 'Küstenwerkstatt' in text,text
    review='Ich habe Anschriften, Positionen, Steuerarten und Zahlungsdaten am Original geprüft.';label(review).check()
    if os.getenv('MOINPDF_REQUIRE_SERVER')=='1':
     for profile in ('xrechnung','zugferd'):
      label('Ausgabeformat').select_option(profile);label(review).check();button('E-Rechnung erstellen und unabhängig prüfen').click()
      with zipfile.ZipFile(download(profile+'.zip')) as archive:
       report=json.loads(archive.read('Ergebnis.json'))
       if profile=='xrechnung':
        assert report['xrechnungAccepted'] and report['documentHashVerified'],report
        assert b'119.00' in archive.read('XRechnung.xml')
        with fitz.open(stream=archive.read('Rechnung-Leseansicht.pdf'),filetype='pdf') as result:assert '119.00' in ''.join(p.get_text() for p in result)
       else:
        assert report['compliant'] and report['mustangValid'] and report['pdfa3b'] and report['declaredPdfaValid'],report
        with fitz.open(stream=archive.read('ZUGFeRD-geprueft.pdf'),filetype='pdf') as result:
         assert '119.00' in ''.join(p.get_text() for p in result)
         assert any(b'119.00' in result.embfile_get(n) for n in result.embfile_names())
    label('Netto-Einzelpreis').fill('60.00');expect(label(review)).not_to_be_checked();expect(page.locator('.advanced-result')).to_have_count(0)
    button('Zurück zur Auswahl').click();choose('PDF-Portfolio erstellen');label('Titel des Portfolios').fill('Fictional portfolio');label('Dateien für das Portfolio').set_input_files([str((fixtures/'invoice.pdf').resolve()),str((fixtures/'xrechnung-standard.xml').resolve())]);button('PDF-Portfolio erstellen').click()
    with fitz.open(download('portfolio.pdf')) as pdf:
     assert len(pdf.embfile_names())==2
     for name in ['invoice.pdf','xrechnung-standard.xml']:assert pdf.embfile_get(name)==(fixtures/name).read_bytes()
     assert pdf.xref_get_key(pdf.pdf_catalog(),'Collection')[0]!='null'
    button('Zurück zur Auswahl').click();page.locator('input[type=file]').first.set_input_files(str((fixtures/'invoice.pdf').resolve()));expect(page.locator('.chooser-tool')).to_have_count(127);choose('PDF-Ebenen verwalten')
    panel=page.locator('details').filter(has=page.locator('summary').get_by_text(t('Neue Ebenen und Objektzuordnung'),exact=True));panel.locator('summary').click();button('Objekte und Ebenen laden').click();expect(panel.locator('input[type=checkbox]').first).to_be_visible();panel.locator('input[type=checkbox]').first.check();label('Name der neuen Ebene').fill('CI layer');button('Ebene erstellen / Objekte zuordnen').click()
    with fitz.open(download('layer.pdf')) as pdf:assert any(v['name']=='CI layer' for v in pdf.get_ocgs().values());assert '129.70' in ''.join(p.get_text() for p in pdf)
    button('Zurück zur Auswahl').click();choose('Arbeitsabläufe');label('Vorlage laden').select_option('1');page.locator('summary').get_by_text(t('Eingangsordner: OCR, Trennung und Ablage'),exact=True).click();label('Sammeldateien trennen').select_option('page');label('Dateinamensmuster').fill('{original}-{part}');button('Für Eingangsordner exportieren').click();flow=json.loads(download('workflow.json').read_text());assert flow['version']==2 and flow['split']['mode']=='page';assert flow['steps']
    if en:
     page.set_viewport_size({'width':320,'height':950})
     for title in ['Belege mit Zahlungen abgleichen','E-Rechnung erstellen','PDF-Portfolio erstellen','Personenbezogene Angaben erkennen','Handschrift erkennen','PDF/X-Druckdatei erstellen','PDF-Ebenen verwalten','Arbeitsabläufe']:
      button('Zurück zur Auswahl').click();choose(title);overflow()
    if os.getenv('MOINPDF_REQUIRE_SERVER')=='1':
     button('Zurück zur Auswahl').click();choose('PDF/X-Druckdatei erstellen');label('Beschnitt innerhalb der Seite (mm)').fill('3');expect(button('Druckdatei mit Teilprüfbericht erstellen')).to_be_disabled();label('Ich habe Druckprofil und Endformat mit der Druckerei abgestimmt.').check();button('Druckdatei mit Teilprüfbericht erstellen').click()
     with zipfile.ZipFile(download('pdfx.zip')) as archive:
      report=json.loads(archive.read('Technische-Pruefung.json'));assert report['technicalChecksPassed'] and report['isoConformanceVerified'] is False,report
      with fitz.open(stream=archive.read('Druckdatei-PDFX3.pdf'),filetype='pdf') as result:assert '129.70' in ''.join(p.get_text() for p in result)
     label('Beschnitt innerhalb der Seite (mm)').fill('4');expect(label('Ich habe Druckprofil und Endformat mit der Druckerei abgestimmt.')).not_to_be_checked();expect(page.locator('.advanced-result')).to_have_count(0)
     # A fresh browser context gives handwriting its own original document.
     scan=out/'handwriting.pdf'
     with fitz.open() as doc:
      pix=fitz.Pixmap(fixtures/'fixture-2.jpg');sheet=doc.new_page(width=pix.width,height=pix.height);sheet.insert_image(sheet.rect,filename=str(fixtures/'fixture-2.jpg'));doc.save(scan)
     with browser.new_context(viewport={'width':390 if en else 1440,'height':950},has_touch=en,accept_downloads=True,reduced_motion='reduce') as hc:
      hand=hc.new_page();hand.set_default_timeout(120000);hand.goto(origin+('?lang=en' if en else '?lang=de'));hand.locator('input[type=file]').first.set_input_files(str(scan.resolve()));hand.locator('.chooser-tool[data-tool-id="handwriting-ocr"]').click()
      for name,value in [('Links (%)','0'),('Oben (%)','0'),('Breite (%)','100'),('Höhe (%)','100')]:hand.get_by_label(t(name),exact=True).fill(value)
      hand.get_by_role('button',name=t('Markierte Zeile erkennen'),exact=True).click();recognized=hand.get_by_label(t('Erkannten Text korrigieren'),exact=True);expect(recognized).to_have_value('Handschrift');expect(hand.get_by_role('button',name=t('PDF mit geprüftem Suchtext erstellen'),exact=True)).to_be_disabled();recognized.fill('Geprüfte Handschrift');hand.get_by_label(t('Diese Zeile ist am Original geprüft.'),exact=True).check();hand.get_by_role('button',name=t('PDF mit geprüftem Suchtext erstellen'),exact=True).click();link=hand.locator('.advanced-result a[download][href^="blob:"]').first;expect(link).to_be_visible()
      with hand.expect_download() as event:link.click()
      path=out/(case+'-handwriting.pdf');event.value.save_as(path)
      with fitz.open(path) as result:assert 'Geprüfte Handschrift' in ''.join(p.get_text() for p in result)
      recognized.fill('Noch nicht bestätigt');expect(hand.get_by_label(t('Diese Zeile ist am Original geprüft.'),exact=True)).not_to_be_checked();expect(hand.locator('.advanced-result')).to_have_count(0);hand.screenshot(path=str(out/(case+'-handwriting.png')),full_page=True)
    if en:page.set_viewport_size({'width':320,'height':950})
    overflow();page.screenshot(path=str(out/(case+'.png')),full_page=True);assert not errors,errors;reports.append({'case':case,'invoice':True,'portfolio':True,'layers':True,'watchExport':True,'integratedServer':os.getenv('MOINPDF_REQUIRE_SERVER')=='1','physicalDevice':False})
   finally:
    context.tracing.stop(path=str(out/(case+'-trace.zip')));context.close();browser.close()
(out/'report.json').write_text(json.dumps(reports,indent=2));print('PASS: invoice input and output, explicit review invalidation, exact portfolio attachments, real layers and watched-folder v2 export in '+str(len(reports))+' browser/language cases.')
