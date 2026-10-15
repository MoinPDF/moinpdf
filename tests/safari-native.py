"""Acceptance in Apple's installed Safari, using the native safaridriver."""
import base64
import json
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


def button(name):
    return WebDriverWait(driver, 40).until(EC.element_to_be_clickable(
        (By.XPATH, '//button[normalize-space(.)=' + xp(name) + ' or @aria-label=' + xp(name) + ']')))


def label(name):
    def locate(_):
        return driver.execute_script('''const name=arguments[0];
          const direct=[...document.querySelectorAll('[aria-label]')].find(e=>e.getAttribute('aria-label')===name);
          if(direct)return direct;
          const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===name);
          if(!l)return null;
          return (l.htmlFor&&document.getElementById(l.htmlFor))||l.querySelector('input,textarea,select');''', name)
    return WebDriverWait(driver, 40).until(locate)


def fill(element, value):
    element.clear()
    element.send_keys(value)


def fresh(path=None):
    driver.get(origin)
    visible('.upload-entry')
    driver.execute_script('''window.__qaErrors=[];
      window.addEventListener('error',e=>window.__qaErrors.push(e.message));
      window.addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason)));''')
    if path:
        driver.find_element(By.CSS_SELECTOR, 'input[type=file]').send_keys(str(Path(path).resolve()))
        chooser()


def chooser():
    WebDriverWait(driver, 60).until(lambda _: len(driver.find_elements(By.CSS_SELECTOR, '.chooser-tool')) == 112)


def back():
    click(WebDriverWait(driver, 40).until(EC.element_to_be_clickable((By.XPATH,
        '//button[normalize-space(.)="Alle Werkzeuge" or normalize-space(.)="Werkzeug wechseln" or normalize-space(.)="All tools" or normalize-space(.)="Change tool"]'))))
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
    link = visible(selector, timeout)
    payload = driver.execute_async_script('''const done=arguments[arguments.length-1];
      fetch(arguments[0]).then(r=>r.blob()).then(blob=>{
        const reader=new FileReader(); reader.onload=()=>done({data:reader.result});
        reader.onerror=()=>done({error:String(reader.error)}); reader.readAsDataURL(blob);
      }).catch(e=>done({error:String(e)}));''', link.get_attribute('href'))
    assert 'data' in payload, payload
    data = base64.b64decode(payload['data'].split(',', 1)[1])
    (out / name).write_bytes(data)
    if actual_download:
        folder = Path.home() / 'Downloads'
        before = set(folder.glob('*')) if folder.exists() else set()
        click(link)
        def downloaded(_):
            for f in set(folder.glob('*')) - before:
                if f.is_file() and f.suffix.lower() not in ('.download', '.part'):
                    try:
                        if f.read_bytes() == data:
                            return f.name
                    except OSError:
                        pass
            return False
        saved = WebDriverWait(driver, 30).until(downloaded)
        report.setdefault('nativeDownloads', []).append(saved)
    return data


def check(name, fn):
    start = time.monotonic()
    item = {'name': name}
    try:
        fn()
        no_errors()
        item['status'] = 'passed'
    except Exception as error:
        item.update(status='failed', error=str(error), traceback=traceback.format_exc())
        print(item['traceback'], flush=True)
    finally:
        item['seconds'] = round(time.monotonic() - start, 1)
        results.append(item)
        try:
            driver.save_screenshot(str(out / (re.sub(r'[^a-z0-9]+', '-', name.lower()) + '.png')))
            (out / (re.sub(r'[^a-z0-9]+', '-', name.lower()) + '.txt')).write_text(driver.find_element(By.TAG_NAME, 'body').text)
        except Exception:
            pass
        (out / 'safari-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(item['status'].upper() + ': ' + name, flush=True)


try:
    options = webdriver.SafariOptions()
    driver = webdriver.Safari(options=options)
    driver.set_window_size(1440, 1100)
    driver.set_script_timeout(120)
    driver.set_page_load_timeout(120)
    report['capabilities'] = driver.capabilities
    with tempfile.TemporaryDirectory() as temporary:
        folder = Path(temporary)
        source = folder / 'safari-original.pdf'
        with pymupdf.open() as pdf:
            for text in ('SAFARI ORIGINAL 123. Rechnung 25,50 Euro.', 'ZWEITE SEITE BLEIBT ERHALTEN.'):
                pdf.new_page().insert_text((50, 70), text, fontsize=18)
            pdf.save(source)

        def presentation():
            fresh()
            report['userAgent'] = driver.execute_script('return navigator.userAgent')
            report['viewport'] = driver.execute_script('return {width:innerWidth,height:innerHeight}')
            assert 'Safari' in report['userAgent'] and 'Chrome/' not in report['userAgent']
            click(button('Dunklen Modus einschalten'))
            driver.refresh()
            WebDriverWait(driver, 30).until(lambda _: 'dark' in driver.find_element(By.TAG_NAME, 'html').get_attribute('class').split())
            click(visible('.language-trigger'))
            click(WebDriverWait(driver, 30).until(EC.element_to_be_clickable((By.XPATH, '//*[@role="menuitemradio" and normalize-space(.)="English"]'))))
            WebDriverWait(driver, 30).until(lambda _: driver.find_element(By.TAG_NAME, 'html').get_attribute('lang') == 'en')
            driver.refresh()
            assert driver.find_element(By.TAG_NAME, 'html').get_attribute('lang') == 'en'
            visible('.upload-entry')
            overflow()
            click(button('Switch to light mode'))
            click(visible('.language-trigger'))
            click(WebDriverWait(driver, 30).until(EC.element_to_be_clickable((By.XPATH, '//*[@role="menuitemradio" and normalize-space(.)="Deutsch"]'))))
            WebDriverWait(driver, 30).until(lambda _: driver.find_element(By.TAG_NAME, 'html').get_attribute('lang') == 'de')
        check('Theme and language persist after reload', presentation)

        def all_tools():
            fresh(source)
            titles = [e.text for e in driver.find_elements(By.CSS_SELECTOR, '.chooser-tool strong')]
            assert len(titles) == len(set(titles)) == 112
            for title in titles:
                tool(title)
                overflow()
                no_errors()
                back()
            assert '2 Seiten' in visible('.chooser-document-count').text
            report['toolViews'] = len(titles)
        check('All 112 tool views retain the original PDF', all_tools)

        def roundtrip():
            fresh(source)
            tool('Seiten organisieren')
            click(driver.find_element(By.XPATH, '//*[@role="tab" and normalize-space(.)="Vorschau"]'))
            WebDriverWait(driver, 60).until(lambda _: driver.execute_script('return [...document.images].some(i=>i.alt==="safari-original.pdf, Seite 1"&&i.complete&&i.naturalWidth>0)'))
            click(button('Seiten speichern'))
            data = output_bytes('a[download]', 'safari-roundtrip.pdf', actual_download=True)
            with pymupdf.open(stream=data, filetype='pdf') as pdf:
                assert len(pdf) == 2
                assert 'SAFARI ORIGINAL 123' in pdf[0].get_text()
                assert 'ZWEITE SEITE BLEIBT ERHALTEN' in pdf[1].get_text()
        check('PDF upload preview native download and independent readback', roundtrip)

        def edit_text():
            fresh(source)
            tool('PDF-Objekte bearbeiten')
            click(button('Seitenobjekte laden'))
            Select(label('Objekt auswählen')).select_by_index(1)
            fill(label('Textinhalt'), 'SAFARI TEXT GEANDERT 456.')
            click(button('Objektänderung exportieren'))
            data = output_bytes('.advanced-result a[download]', 'safari-native-edit.pdf')
            with pymupdf.open(stream=data, filetype='pdf') as pdf:
                assert 'SAFARI TEXT GEANDERT 456' in pdf[0].get_text()
                assert 'SAFARI ORIGINAL 123' not in pdf[0].get_text()
                assert 'ZWEITE SEITE BLEIBT ERHALTEN' in pdf[1].get_text()
        check('Actual PDFium text edit preserves the other page', edit_text)

        def projects():
            fresh(source)
            click(visible('.project-toggle'))
            fill(label('Projektname'), 'Safari Pruefung')
            click(button('Projekt speichern'))
            WebDriverWait(driver, 60).until(lambda _: 'Alles an Bord – gespeichert.' in driver.find_element(By.TAG_NAME, 'body').text)
            click(button('Projektdatei herunterladen'))
            driver.refresh()
            click(visible('.project-toggle'))
            click(button('Öffnen'))
            chooser()
            assert '2 Seiten' in visible('.chooser-document-count').text
            tool('Seiten organisieren')
            click(button('Seiten speichern'))
            data = output_bytes('a[download]', 'safari-restored-project.pdf')
            with pymupdf.open(stream=data, filetype='pdf') as pdf:
                assert len(pdf) == 2 and 'SAFARI ORIGINAL 123' in pdf[0].get_text()
        check('IndexedDB project survives reload and restores PDF bytes', projects)

        def ocr():
            scan_path = folder / 'safari-scan.pdf'
            with pymupdf.open() as text_pdf, pymupdf.open() as scan_pdf:
                text_pdf.new_page(width=900, height=200).insert_text((30, 80), 'MoinPDF Safari Rechnung 12345', fontsize=32)
                image = text_pdf[0].get_pixmap(matrix=pymupdf.Matrix(2, 2)).tobytes('png')
                scan_pdf.new_page(width=900, height=200).insert_image(pymupdf.Rect(0, 0, 900, 200), stream=image)
                scan_pdf.save(scan_path)
            fresh(scan_path)
            tool('OCR & Text')
            click(button('Text erkennen'))
            data = output_bytes('a[download]', 'safari-ocr.pdf', timeout=240)
            with pymupdf.open(stream=data, filetype='pdf') as pdf:
                assert 'Rechnung 12345' in pdf[0].get_text(), pdf[0].get_text()
        check('Real local OCR creates searchable scan PDF', ocr)

        def office():
            fresh()
            assert driver.execute_script('return crossOriginIsolated'), 'Missing cross-origin isolation'
            driver.find_element(By.CSS_SELECTOR, 'input[type=file]').send_keys(str(Path('tests/fixtures/office/sample.docx').resolve()))
            WebDriverWait(driver, 60).until(lambda _: visible('main h1').text == 'Office zu PDF')
            click(button('PDF erstellen'))
            data = output_bytes('a[download]', 'safari-office.pdf', timeout=240)
            with pymupdf.open(stream=data, filetype='pdf') as pdf:
                assert len(pdf) >= 1 and len(''.join(p.get_text() for p in pdf).strip()) > 10
        check('Actual browser-local DOCX conversion with LibreOffice WASM', office)

        def documentation():
            for route in ('/dokumentation.html', '/en/documentation.html'):
                driver.get(origin + route)
                WebDriverWait(driver, 30).until(lambda _: len(driver.find_elements(By.CSS_SELECTOR, '.docs-tool')) == 112)
                driver.execute_script('document.querySelectorAll(".docs-tool").forEach(d=>d.open=true)')
                overflow()
                assert len(driver.find_elements(By.CSS_SELECTOR, '.docs-tool[open]')) == 112
            report['manualGuides'] = 224
        check('German and English manuals display all guides', documentation)
except Exception as error:
    report['setupError'] = str(error)
    report['setupTraceback'] = traceback.format_exc()
    print(report['setupTraceback'], flush=True)
finally:
    (out / 'safari-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    if driver:
        driver.quit()
print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
raise SystemExit(1 if report.get('setupError') or any(r['status'] != 'passed' for r in results) else 0)
