"""Acceptance in Apple's installed Safari, using the native safaridriver."""
import base64
import json
import io
import zipfile
import mimetypes
import shutil
import os
from pathlib import Path
import re
import tempfile
import time
import traceback

import pymupdf
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

origin = os.environ['MOINPDF_TEST_URL'].rstrip('/')
out = Path('cross-browser-evidence')
out.mkdir(exist_ok=True)
results = []
driver = None
report = {'nativeSafari': True, 'source': os.environ.get('GITHUB_SHA'),
          'results': results, 'limitations': ['macOS Safari, no physical iPhone/iPad',
          'server-only conversions are outside this browser-local run']}


def xp(value):
    if "'" not in value:
        return "'" + value + "'"
    return 'concat(' + ',"\'",'.join("'" + x + "'" for x in value.split("'")) + ')'


def visible(selector, timeout=40):
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))


def click(element):
    driver.execute_script('arguments[0].scrollIntoView({block:"center",inline:"nearest"})', element)
    element.click()


def button(name, timeout=40):
    # Desktop and mobile actions share accessible names. Selenium's first-match
    # helper can wait forever on the hidden mobile action; select the visible one.
    def ready(_):
        for element in driver.find_elements(By.XPATH, '//button[normalize-space(.)=' + xp(name) + ' or @aria-label=' + xp(name) + ']'):
            if element.is_displayed() and element.is_enabled(): return element
        return False
    return WebDriverWait(driver, timeout).until(ready)


def label(name):
    def locate(_):
        return driver.execute_script('''const name=arguments[0];
          const direct=[...document.querySelectorAll('[aria-label]')].find(e=>e.getAttribute('aria-label')===name);
          if(direct)return direct;
          const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===name);
          if(!l)return null;
          return (l.htmlFor&&document.getElementById(l.htmlFor))||l.querySelector('input,textarea,select');''', name)
    def ready(_):
        found=locate(_)
        return found if found and found.is_displayed() and found.is_enabled() else False
    return WebDriverWait(driver, 40).until(ready)


def fill(element, value):
    element.clear()
    element.send_keys(value)


def set_files(element, path):
    path=Path(path)
    if report.get('fileInputMode') == 'in-memory File, native driver I/O unavailable':
        driver.execute_script('''const bytes=Uint8Array.from(atob(arguments[1]),c=>c.charCodeAt(0));
          const transfer=new DataTransfer();
          transfer.items.add(new File([bytes],arguments[2],{type:arguments[3]}));
          arguments[0].files=transfer.files;
          arguments[0].dispatchEvent(new Event('change',{bubbles:true}));''',
          element,base64.b64encode(path.read_bytes()).decode(),path.name,
          mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
    else:
        target=Path(report['nativeInputDirectory'])/path.name
        target.parent.mkdir(parents=True,exist_ok=True)
        if path.resolve()!=target.resolve(): shutil.copyfile(path,target)
        element.send_keys(str(target.resolve()))


def probe_file_access():
    payload=b'MOINPDF SAFARI NATIVE FILE PROBE 12345'
    Path('dist/selfhost/qa-native-file-input.html').write_text('<!doctype html><title>Native file probe</title><input type="file">')
    probes=[]
    for folder in [Path.cwd()/'cross-browser-evidence'/'native-input',Path.home()/'Downloads'/'moinpdf-native-input',Path('/tmp')/'moinpdf-native-input']:
        folder.mkdir(parents=True,exist_ok=True)
        path=folder/'native-probe.txt';path.write_bytes(payload)
        driver.get(origin+'/qa-native-file-input.html')
        driver.find_element(By.CSS_SELECTOR,'input').send_keys(str(path.resolve()))
        result=driver.execute_async_script('''const done=arguments[arguments.length-1];
          const file=document.querySelector('input').files[0];
          if(!file){done({error:'SafariDriver returned without selecting a file',name:'NoNativeFile'});return;}
          file.arrayBuffer().then(b=>done({text:new TextDecoder().decode(b),bytes:b.byteLength}))
            .catch(e=>done({error:e.message,name:e.name}));''')
        result['directory']=str(folder);probes.append(result)
        print('NATIVE FILE PROBE: '+json.dumps(result),flush=True)
        if result.get('text')==payload.decode():
            report['nativeInputDirectory']=str(folder)
            report['fileInputMode']='native WebDriver file input'
            break
    else:
        report['fileInputMode']='in-memory File, native driver I/O unavailable'
        report['limitations'].append('SafariDriver cannot read native files even in an independent plain HTML input. App processing uses identical synthetic bytes via a standard in-memory File and change event; native OS file selection is unverified.')
    report['nativeFileProbe']=probes


def fresh(path=None):
    driver.get(origin)
    visible('.upload-entry')
    if driver.find_element(By.TAG_NAME, 'html').get_attribute('lang') == 'en':
        click(visible('.language-trigger'))
        click(WebDriverWait(driver, 30).until(EC.element_to_be_clickable((By.XPATH, '//*[@role="menuitemradio" and normalize-space(.)="Deutsch"]'))))
        WebDriverWait(driver, 30).until(lambda _: driver.find_element(By.TAG_NAME, 'html').get_attribute('lang') == 'de')
    driver.execute_script('''window.__qaErrors=[]; window.__qaToasts=[]; window.__qaUploads=[];
      new MutationObserver(()=>document.querySelectorAll('[data-sonner-toast]').forEach(e=>{
        const value={type:e.getAttribute('data-type'),text:e.textContent};
        if(value.text&&!window.__qaToasts.some(v=>v.type===value.type&&v.text===value.text))window.__qaToasts.push(value);
      })).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});
      document.addEventListener('change',e=>{if(e.target.type==='file')
        window.__qaUploads.push(...[...e.target.files].map(f=>({name:f.name,type:f.type,size:f.size})))},true);
      const originalConsoleError=console.error;
      console.error=(...args)=>{window.__qaErrors.push(args.map(String).join(' '));originalConsoleError(...args)};

      window.addEventListener('error',e=>window.__qaErrors.push(e.message));
      window.addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason)));''')
    if path:
        set_files(driver.find_element(By.CSS_SELECTOR, 'input[type=file]'), path)
        chooser()


def chooser():
    def ready(_):
        toasts=driver.execute_script('return (window.__qaToasts||[]).filter(t=>t.type==="error")')
        if toasts: raise AssertionError('Upload errors: '+json.dumps(toasts,ensure_ascii=False))
        return len(driver.find_elements(By.CSS_SELECTOR, '.chooser-tool')) == 115
    WebDriverWait(driver, 45).until(ready)


def back():
    click(WebDriverWait(driver, 40).until(EC.element_to_be_clickable((By.XPATH,
        '//button[normalize-space(.)="Zurück zur Auswahl" or normalize-space(.)="Werkzeug wechseln" or normalize-space(.)="Back to selection" or normalize-space(.)="Change tool"]'))))
    chooser()


def tool(title):
    el = WebDriverWait(driver, 40).until(EC.element_to_be_clickable((By.XPATH,
        '//*[contains(concat(" ",normalize-space(@class)," ")," chooser-tool ")][.//strong[normalize-space(.)=' + xp(title) + ']]')))
    click(el)
    WebDriverWait(driver, 40).until(lambda _: visible('main h1').text == title)


def overflow():
    v = driver.execute_script('return {viewport:innerWidth,content:document.documentElement.scrollWidth}')
    assert v['content'] <= v['viewport'] + 2, v


def no_errors():
    errors = driver.execute_script('return window.__qaErrors||[]')
    assert not errors, errors


def output_bytes(selector, name, actual_download=False, timeout=120):
    def ready(_):
        errors=driver.execute_script('return (window.__qaToasts||[]).filter(t=>t.type==="error")')
        if errors: raise AssertionError('Processing errors: '+json.dumps(errors,ensure_ascii=False))
        links=driver.find_elements(By.CSS_SELECTOR,selector)
        for link in links:
            # ResultActions renders before its effect creates the blob URL.
            # A visible but disabled anchor is not a completed export yet.
            href=link.get_attribute('href')
            if (link.is_displayed() and link.is_enabled()
                    and link.get_attribute('aria-disabled') != 'true'
                    and href and href.startswith(('blob:', 'data:'))):
                return link,href
        return False
    link,href = WebDriverWait(driver, timeout).until(ready)
    payload = driver.execute_async_script('''const done=arguments[arguments.length-1];
      fetch(arguments[0]).then(r=>{
        if(!r.ok)throw new Error('Export read failed: HTTP '+r.status);
        return r.blob();
      }).then(blob=>{
        const reader=new FileReader(); reader.onload=()=>done({data:reader.result});
        reader.onerror=()=>done({error:String(reader.error)}); reader.readAsDataURL(blob);
      }).catch(e=>done({error:String(e)}));''', href)
    assert 'data' in payload, payload
    data = base64.b64decode(payload['data'].split(',', 1)[1])
    (out / name).write_bytes(data)
    if actual_download:
        folder = Path.home() / 'Downloads'
        before = {f: (f.stat().st_mtime_ns, f.stat().st_size) for f in folder.glob('*') if f.is_file()} if folder.exists() else {}
        click(link)
        def downloaded(_):
            for f in folder.glob('*'):
                if f.is_file() and f.suffix.lower() not in ('.download', '.part'):
                    try:
                        current = (f.stat().st_mtime_ns, f.stat().st_size)
                        if current != before.get(f) and f.read_bytes() == data:
                            return f.name
                    except OSError:
                        pass
            return False
        saved = WebDriverWait(driver, 30).until(downloaded)
        report.setdefault('nativeDownloads', []).append(saved)
    return data


def check(name, fn):
    selected=os.environ.get('MOINPDF_SAFARI_CASES','')
    if selected and not any(part.lower() in name.lower() for part in selected.split(',')):
        return
    start = time.monotonic()
    item = {'name': name}
    try:
        fn()
        no_errors()
        item['status'] = 'passed'
    except Exception as error:
        item.update(status='failed', error=str(error), traceback=traceback.format_exc())
        try:
            item['diagnostics']=driver.execute_script('return {errors:window.__qaErrors,toasts:window.__qaToasts,uploads:window.__qaUploads,language:document.documentElement.lang,resources:performance.getEntriesByType("resource").map(r=>({name:r.name,duration:r.duration,transferSize:r.transferSize}))}')
        except Exception:
            pass
        print(item['traceback'], flush=True)
    finally:
        item['seconds'] = round(time.monotonic() - start, 1)
        results.append(item)
        try:
            driver.save_screenshot(str(out / (re.sub(r'[^a-z0-9]+', '-', name.lower()) + '.png')))
            (out / (re.sub(r'[^a-z0-9]+', '-', name.lower()) + '.txt')).write_text(driver.find_element(By.TAG_NAME, 'body').text)
        except Exception:
            pass
        (out / 'safari-text-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(item['status'].upper() + ': ' + name, flush=True)


def choice(name, option):
    click(WebDriverWait(driver, 40).until(EC.element_to_be_clickable((By.XPATH, '//*[@role="combobox" and @aria-label='+xp(name)+']'))))
    click(WebDriverWait(driver, 40).until(EC.element_to_be_clickable((By.XPATH, '//*[@role="option" and normalize-space(.)='+xp(option)+']'))))


try:
    driver = webdriver.Safari(options=webdriver.SafariOptions())
    driver.set_window_size(1440, 1100)
    driver.set_script_timeout(120)
    driver.set_page_load_timeout(120)
    report['capabilities'] = driver.capabilities
    probe_file_access()
    report['streamAsyncIterator'] = driver.execute_script('return typeof ReadableStream.prototype[Symbol.asyncIterator]')
    with tempfile.TemporaryDirectory() as temporary:
        folder = Path(temporary)
        source = folder / 'safari-original.pdf'
        with pymupdf.open() as pdf:
            for text in ('SAFARI ORIGINAL 123. Rechnung 25,50 Euro.', 'ZWEITE SEITE BLEIBT ERHALTEN.'):
                pdf.new_page().insert_text((50, 70), text, fontsize=18)
            pdf.save(source)

        def ocr():
            scan = folder / 'safari-scan.pdf'
            with pymupdf.open() as text_pdf, pymupdf.open() as scan_pdf:
                text_pdf.new_page(width=900,height=200).insert_text((30,80),'MoinPDF Safari Rechnung 12345',fontsize=32)
                data=text_pdf[0].get_pixmap(matrix=pymupdf.Matrix(2,2)).tobytes('png')
                scan_pdf.new_page(width=900,height=200).insert_image(pymupdf.Rect(0,0,900,200),stream=data)
                scan_pdf.save(scan)
            fresh(scan);tool('OCR & Text');click(button('Text erkennen'))
            data=output_bytes('a[download]','safari-ocr.pdf',actual_download=True,timeout=240)
            with pymupdf.open(stream=data,filetype='pdf') as pdf:
                assert 'Rechnung 12345' in pdf[0].get_text(),pdf[0].get_text()
        check('Real OCR, native download and independent PDF readback',ocr)

        def word():
            fresh(source);tool('PDF zu Word');click(button('Word-Datei erstellen'))
            data=output_bytes('a[download]','safari.docx')
            with zipfile.ZipFile(io.BytesIO(data)) as docx:
                text=docx.read('word/document.xml').decode()
            assert 'SAFARI ORIGINAL 123' in text and 'ZWEITE SEITE BLEIBT ERHALTEN' in text
        check('Text from both PDF pages exported to actual DOCX',word)

        def reading(title,action,extension):
            fresh(source);tool(title);click(button(action))
            data=output_bytes('a[download]','safari.'+extension)
            if extension=='epub':
                with zipfile.ZipFile(io.BytesIO(data)) as epub:
                    assert epub.read('mimetype')==b'application/epub+zip'
                    text='\n'.join(epub.read(n).decode() for n in epub.namelist() if n.endswith('.xhtml'))
            else:text=data.decode('utf-8-sig')
            assert 'SAFARI ORIGINAL 123' in text and 'ZWEITE SEITE BLEIBT ERHALTEN' in text,text
        for title,action,extension in [('PDF zu Markdown','Markdown erstellen','md'),('PDF zu HTML','HTML erstellen','html'),('PDF zu E-Book','EPUB erstellen','epub')]:
            check('Reading export '+extension,lambda t=title,a=action,e=extension:reading(t,a,e))

        def editor():
            fresh(source);tool('PDF bearbeiten')
            target=visible('.editor-text-target')
            assert 'SAFARI ORIGINAL 123' in target.get_attribute('aria-label')
            rect=target.rect;assert rect['width']>100 and rect['height']>5,rect
            click(target)
            assert 'SAFARI ORIGINAL 123' in label('Textinhalt').get_attribute('value')
        check('Editor finds text and preserves font-based target geometry',editor)

        def structured():
            fresh(source);tool('PDF zu strukturiertem JSON');click(button('JSON exportieren'))
            data=json.loads(output_bytes('a[download]','safari-structure.json'))
            pages=data['documents'][0]['pages'];assert len(pages)==2
            assert 'SAFARI ORIGINAL 123' in ' '.join(i['text'] for i in pages[0]['items'])
            assert 'ZWEITE SEITE BLEIBT ERHALTEN' in ' '.join(i['text'] for i in pages[1]['items'])
            assert all(len(i['transform'])==6 and i['font'] for p in pages for i in p['items'])
        check('Structured JSON retains pages, text, coordinates and font references',structured)

        def accessible():
            fresh(source);tool('Barrierefreiheit prüfen')
            Select(label('Barrierefreiheit: Aktion')).select_by_value('create')
            click(button('Text der ausgewählten PDF anhängen'))
            WebDriverWait(driver,40).until(lambda _:len(driver.find_elements(By.CSS_SELECTOR,'.accessible-block'))==3)
            assert 'SAFARI ORIGINAL 123' in label('Text für Block 2').get_attribute('value')
            assert 'ZWEITE SEITE BLEIBT ERHALTEN' in label('Text für Block 3').get_attribute('value')
        check('Accessible document draft imports both PDF pages',accessible)

        def verified_form(cancel=False):
            # Distinct source names also give distinct native download names,
            # avoiding Safari's same-name replacement prompt between cases.
            form=folder / ('safari-form-cancel-input.pdf' if cancel else 'safari-form-input.pdf')
            shutil.copyfile(Path('.cache/editor-browser/adaptive/form.pdf'),form)
            fresh(form)
            if cancel:
                driver.execute_script("""const NativeWorker=Worker;
                  window.Worker=class extends NativeWorker {
                    postMessage(...args) {
                      if(window.holdVerification && args[0]?.action==='GetOperatorList' && document.body.textContent.includes('Gespeicherte PDF prüfen')) {
                        window.verificationHeld=true; return;
                      }
                      return super.postMessage(...args);
                    }
                  };""")
            tool('PDF bearbeiten')
            click(button('Text bearbeiten: Original heading'))
            fill(label('Text direkt in der PDF bearbeiten'),'Edited heading')
            if cancel: driver.execute_script('window.holdVerification=true')
            click(button('Bearbeitete PDF erstellen'))
            if cancel:
                WebDriverWait(driver,60).until(lambda _:driver.execute_script('return window.verificationHeld===true'))
                click(button('Abbrechen'))
                button('Bearbeitete PDF erstellen', timeout=5)
                assert not driver.find_elements(By.CSS_SELECTOR,'a[download][href^="blob:"]'), 'Cancelled PDF must not be published'
                driver.execute_script('window.holdVerification=false')
                click(button('Bearbeitete PDF erstellen'))
            data=output_bytes('a[download]', 'safari-form-cancel.pdf' if cancel else 'safari-form.pdf', actual_download=True)
            with pymupdf.open(stream=data,filetype='pdf') as after, pymupdf.open(form) as before:
                assert len(after)==2
                assert 'Edited heading' in after[0].get_text() and 'Original heading' not in after[0].get_text()
                fields=lambda pdf:[(w.field_name,w.field_value,tuple(w.rect)) for p in pdf for w in p.widgets()]
                assert fields(after)==fields(before) and len(fields(after))==3
                a,b=before[1].get_pixmap(),after[1].get_pixmap()
                assert (a.width,a.height,a.samples)==(b.width,b.height,b.samples)
        check('Native Safari form edit, actual download and independent preservation',verified_form)
        check('Native Safari injected worker stall cancels and the same edit exports',lambda:verified_form(True))

        def comparison():
            fresh(source)
            other=folder/'safari-changed.pdf'
            with pymupdf.open() as pdf:
                for text in ('SAFARI ORIGINAL 123. Rechnung 30,50 Euro.','ZWEITE SEITE BLEIBT ERHALTEN.'):
                    pdf.new_page().insert_text((50,70),text,fontsize=18)
                pdf.save(other)
            set_files(driver.find_element(By.CSS_SELECTOR,'input[type=file]'),other)
            WebDriverWait(driver,40).until(lambda _:'4 Seiten' in visible('.chooser-document-count').text)
            tool('PDFs vergleichen');choice('Vergleichsart','Inhalte über Seiten hinweg')
            click(button('Text vergleichen'))
            text=output_bytes('a[download]','safari-comparison.txt').decode('utf-8-sig')
            assert '25,50' in text and '30,50' in text,text
        check('Content comparison reports independently verified changed amounts',comparison)
except Exception as error:
    report['setupError']=str(error);report['setupTraceback']=traceback.format_exc()
    print(report['setupTraceback'],flush=True)
finally:
    (out/'safari-text-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    if driver:driver.quit()
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
raise SystemExit(1 if report.get('setupError') or len(results)!=11 or any(r['status']!='passed' for r in results) else 0)
