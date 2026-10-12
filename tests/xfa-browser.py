"""Production XFA rejection and dataset editing, with independent packet readback."""
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.environ['MOINPDF_TEST_URL']
if os.environ.get('MOINPDF_TEST_NONLOCAL_HTTP') == '1':
    addresses = subprocess.check_output(['hostname', '-I'], text=True).split()
    host = next(value for value in addresses if ipaddress.ip_address(value).version == 4 and not ipaddress.ip_address(value).is_loopback)
    origin = f'http://{host}:8080'
evidence = Path('web-evidence')
evidence.mkdir(exist_ok=True)
completed, errors = [], []

def chooser(page):
    expect(page.get_by_role('heading', name='Was möchtest du tun?', exact=True)).to_be_visible()

def back(page):
    page.get_by_role('button', name=re.compile(r'^(Alle Werkzeuge|Werkzeug wechseln)$')).click()
    chooser(page)

def no_overflow(page, context):
    dimensions = page.evaluate('({width:innerWidth, content:document.documentElement.scrollWidth})')
    assert dimensions['content'] <= dimensions['width'] + 2, f'Horizontal overflow in {context}: {dimensions}'

with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    try:
        # A raw XFA packet must remain blocked before any AcroForm API can strip it.
        xfa_path = Path(temporary) / 'xfa-preservation.pdf'
        xfa_xml = b'<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data><value>XFA-SENTINEL</value></xfa:data></xfa:datasets>'
        with pymupdf.open() as document:
            document.new_page().insert_text((50, 60), 'XFA compatibility placeholder')
            stream = document.get_new_xref()
            document.update_object(stream, '<< >>')
            document.update_stream(stream, xfa_xml)
            form = document.get_new_xref()
            document.update_object(form, f'<< /Fields [] /XFA {stream} 0 R >>')
            document.xref_set_key(document.pdf_catalog(), 'AcroForm', f'{form} 0 R')
            document.save(xfa_path)
        xfa_page = browser.new_page(viewport={'width': 390, 'height': 844}, accept_downloads=True)
        xfa_page.on('pageerror', lambda error: errors.append(str(error)))
        xfa_page.goto(origin)
        xfa_page.locator('input[type="file"]').first.set_input_files(str(xfa_path))
        chooser(xfa_page)
        xfa_page.get_by_role('button', name='Formular ausfüllen', exact=True).click()
        expect(xfa_page.get_by_role('heading', name='XFA-Daten bearbeiten', exact=True)).to_be_visible()
        xfa_page.get_by_role('button', name='XFA-Daten laden', exact=True).click()
        expect(xfa_page.get_by_role('alert')).to_contain_text('getrennten XML-Paketen')
        expect(xfa_page.get_by_role('button', name='XFA-Daten speichern', exact=True)).not_to_be_visible()
        expect(xfa_page.get_by_role('button', name='Formular speichern', exact=True)).to_be_disabled()
        no_overflow(xfa_page, 'XFA rejection on mobile')
        xfa_page.screenshot(path=str(evidence / 'xfa-preservation.png'), full_page=True)
        back(xfa_page)
        xfa_page.get_by_role('button', name='Lesezeichen bearbeiten', exact=True).click()
        expect(xfa_page.get_by_role('button', name='Lesezeichen speichern', exact=True)).to_be_enabled()
        xfa_page.get_by_role('button', name='Lesezeichen speichern', exact=True).click()
        with xfa_page.expect_download() as download:
            xfa_page.get_by_role('link', name='PDF herunterladen', exact=True).click()
        xfa_saved = Path(temporary) / 'xfa-bookmarks.pdf'
        download.value.save_as(xfa_saved)
        with pymupdf.open(xfa_saved) as document:
            kind, reference = document.xref_get_key(document.pdf_catalog(), 'AcroForm/XFA')
            assert kind == 'xref', (kind, reference)
            assert document.xref_stream(int(reference.split()[0])) == xfa_xml
        xfa_page.close()
        completed.append('XFA editor blocked before mutation; bookmark download preserves the original XFA stream (independent PyMuPDF readback)')

        # The supported subset edits only the datasets packet; templates remain byte-identical.
        packet_path = Path(temporary) / 'xfa-data.pdf'
        template = b'<template xmlns="http://www.xfa.org/schema/xfa-template/3.3/"><subform name="record"/></template>'
        datasets = b'<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data><record><name>First</name><name>Second</name></record></xfa:data></xfa:datasets>'
        with pymupdf.open() as document:
            document.new_page().insert_text((50, 60), 'XFA data compatibility placeholder')
            refs = []
            for xml in (template, datasets):
                ref = document.get_new_xref()
                document.update_object(ref, '<< >>')
                document.update_stream(ref, xml)
                refs.append(ref)
            form = document.get_new_xref()
            document.update_object(form, f'<< /Fields [] /XFA [(template) {refs[0]} 0 R (datasets) {refs[1]} 0 R] >>')
            document.xref_set_key(document.pdf_catalog(), 'AcroForm', f'{form} 0 R')
            document.save(packet_path)
        data_page = browser.new_page(viewport={'width': 390, 'height': 844}, accept_downloads=True)
        data_page.on('pageerror', lambda error: errors.append(str(error)))
        data_page.goto(origin)
        data_page.locator('input[type="file"]').first.set_input_files(str(packet_path))
        chooser(data_page)
        data_page.get_by_role('button', name='Formular ausfüllen', exact=True).click()
        data_page.get_by_role('button', name='XFA-Daten laden', exact=True).click()
        expect(data_page.get_by_label('record[1] / name[1]', exact=True)).to_have_value('First')
        value = 'Äpfel < & > " ⚓'
        data_page.get_by_label('record[1] / name[2]', exact=True).fill(value)
        data_page.get_by_role('button', name='XFA-Daten speichern', exact=True).click()
        link = data_page.get_by_role('link', name='PDF herunterladen', exact=True)
        expect(link).to_be_visible()
        with data_page.expect_download() as download:
            link.click()
        changed = Path(temporary) / 'xfa-data-saved.pdf'
        download.value.save_as(changed)
        with pymupdf.open(changed) as document:
            kind, array = document.xref_get_key(document.pdf_catalog(), 'AcroForm/XFA')
            assert kind == 'array', (kind, array)
            packets = {name: document.xref_stream(int(ref)) for name, ref in re.findall(r'\(([^)]+)\)\s*(\d+)\s+0\s+R', array)}
            assert packets['template'] == template
            assert [el.text for el in ET.fromstring(packets['datasets']).iter('name')] == ['First', value]
        data_page.get_by_label('record[1] / name[2]', exact=True).fill('Further change')
        expect(link).not_to_be_visible()
        expect(data_page.get_by_role('button', name='Formular speichern', exact=True)).to_be_disabled()
        no_overflow(data_page, 'XFA data editor on mobile')
        data_page.screenshot(path=str(evidence / 'xfa-data-mobile.png'), full_page=True)
        data_page.close()
        completed.append('Mobile XFA dataset editing: repeated field names, XML escaping, independent packet readback and unchanged template; subsequent edits invalidate the download')
        assert not errors, errors
        print('PASS: ' + '; '.join(completed), flush=True)
    except BaseException:
        for index, context in enumerate(browser.contexts):
            for page_index, page in enumerate(context.pages):
                print('XFA page: '+page.locator('body').inner_text(), flush=True)
                print('XFA inputs: '+json.dumps(page.locator('textarea').evaluate_all('(items) => items.map(el => ({value:el.value,label:el.closest("label")?.innerText}))')), flush=True)
                page.screenshot(path=str(evidence / f'xfa-failure-{index}-{page_index}.png'), full_page=True)
        print('XFA errors: '+repr(errors), flush=True)
        raise
    finally:
        browser.close()
