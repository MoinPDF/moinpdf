"""Exercise real PDF extraction, manual CSV download and an explicitly simulated AI service."""
import csv
import tempfile
from pathlib import Path

import pymupdf
from playwright.sync_api import expect


def verify_bank_datev(browser, origin):
    context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    context.add_init_script("Object.defineProperty(Crypto.prototype, 'randomUUID', {value: undefined})")
    page = context.new_page()
    requests = []
    context.route('**/api/datev/status', lambda route: route.fulfill(json={'enabled': False, 'personal': True}))

    def suggestions(route):
        body = route.request.post_data_json
        assert body['key'] == 'sk-fictional-browser-key'
        requests.append(body['batch'])
        route.fulfill(json={'suggestions': [{'id': 1, 'account': '56781', 'reason': 'Fiktive Zuordnung'}]})

    context.route('**/api/datev/personal', suggestions)
    try:
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / 'Fiktiver-Auszug.pdf'
            with pymupdf.open() as doc:
                lines = ['Testbank Kontoauszug Nr. 7', 'Zeitraum 01.05.2026 bis 31.05.2026',
                         'Kontowaehrung EUR', 'IBAN DE89 3704 0044 0532 0130 00', 'Anfangssaldo 100,00',
                         'Datum Text Betrag', '04.05.2026 Fiktive Gutschrift +10,00',
                         '05.05.2026 Fiktiver Einkauf -5,50', 'Endsaldo 104,50']
                original_page = doc.new_page()
                original_page.insert_text((50, 55), '\n'.join(lines), fontsize=15, lineheight=1.5)
                doc.save(pdf)
                scan = Path(directory) / 'Fiktiver-Scan.pdf'
                bitmap = original_page.get_pixmap(matrix=pymupdf.Matrix(2, 2)).tobytes('png')
                with pymupdf.open() as scanned:
                    scanned.new_page().insert_image(original_page.rect, stream=bitmap)
                    scanned.save(scan)
                mixed = Path(directory) / 'Fiktiver-Mischscan.pdf'
                with pymupdf.open() as doc_mixed:
                    mixed_page = doc_mixed.new_page()
                    mixed_page.insert_image(original_page.rect, stream=bitmap)
                    mixed_page.insert_text((25, 790), 'Kopie mit digitaler Kennzeichnung. ' * 3 + '99,99', fontsize=6)
                    doc_mixed.save(mixed)
                bad = Path(directory) / 'Fiktiv-unlesbar.pdf'
                with pymupdf.open() as empty:
                    empty.new_page()
                    empty.save(bad)
            page.goto(origin)
            page.locator('input[type=file]').first.set_input_files(str(pdf))
            page.locator('.chooser-tool').filter(has_text='Kontoauszug zu DATEV').click()
            form = page.locator('.bank-datev')
            account = form.get_by_label('Konto (Bankkonto)', exact=True)
            default = form.get_by_label('Gegenkonto für leere Zeilen (optional)', exact=True)
            expect(account).to_have_value('')
            expect(default).to_have_value('')
            expect(form.locator('.bank-row')).to_have_count(2)
            postings = form.locator('.bank-postings')
            expect(postings.locator(':scope > summary')).to_contain_text('Buchungen prüfen (2)')
            expect(postings.locator('.bank-row').first).to_be_hidden()
            postings.locator(':scope > summary').press('Enter')
            expect(postings.locator('.bank-row').first).to_be_visible()
            assert not form.get_by_text('Weitere Exportangaben', exact=True).count()
            assert not form.get_by_label('Zeitraum von', exact=True).count()
            assert not form.get_by_label('Endsaldo (€)', exact=True).count()
            facts = form.locator('.bank-reading details')
            facts.locator('summary').click()
            expect(facts).to_contain_text('DE89370400440532013000')
            expect(facts).to_contain_text('104,50')
            assert not facts.locator('input, select, textarea').count()
            form.get_by_label('Kontenrahmen', exact=True).select_option('04')
            account.fill('24680')
            default.fill('58765')
            form.get_by_label('Beraternummer', exact=True).fill('39821')
            form.get_by_label('Mandantennummer', exact=True).fill('643')
            rows = form.locator('.bank-row')
            rows.nth(0).get_by_label('Gegenkonto', exact=True).fill('53124')
            rows.nth(0).get_by_label('BU-Schlüssel (optional)', exact=True).fill('9')
            form.get_by_label('Kontenrahmen', exact=True).select_option('03')
            expect(account).to_have_value('24680')
            expect(rows.nth(0).get_by_label('Gegenkonto', exact=True)).to_have_value('53124')
            form.get_by_role('button', name='Buchung ergänzen').click()
            expect(rows).to_have_count(3)
            form.get_by_role('button', name='Buchung entfernen 3').click()
            expect(rows).to_have_count(2)
            confirm = form.get_by_role('checkbox')
            download = form.get_by_role('button', name='DATEV-Datei herunterladen')
            expect(download).to_be_disabled()
            confirm.check()
            with page.expect_download() as received:
                download.click()
            with open(received.value.path(), encoding='cp1252', newline='') as handle:
                header, columns, positive, negative = list(csv.reader(handle, delimiter=';'))
            assert header[10:14] == ['39821', '643', '20260101', '5'] and header[26] == '03'
            assert header[14:16] == ['20260501', '20260531']
            assert columns[10] == 'Belegfeld 1' and positive[10] == negative[10] == ''
            assert len(columns) == len(positive) == len(negative) == 125
            assert positive[0:2] == ['10,00', 'S'] and positive[6:9] == ['24680', '53124', '0009']
            assert negative[0:2] == ['5,50', 'H'] and negative[6:9] == ['24680', '58765', '']
            assert not requests
            form.get_by_text('KI-Kontierung · optional', exact=True).click()
            key = form.get_by_label('Eigener OpenAI-API-Schlüssel', exact=True)
            expect(key).to_have_attribute('type', 'password')
            key.fill('sk-fictional-browser-key')
            form.get_by_text('Auf diesem Gerät verschlüsselt merken', exact=True).click()
            form.get_by_label('Gerätepasswort für den Schlüssel').fill('a fictional device password')
            form.get_by_role('button', name='Mit Gerätepasswort speichern').click()
            expect(form.get_by_text('Gespeicherter Schlüssel', exact=True)).to_be_visible()
            assert page.evaluate("!JSON.stringify(localStorage).includes('sk-fictional') && !JSON.stringify(localStorage).includes('a fictional device password')")
            assert not requests
            form.get_by_role('button', name='Schlüssel aus Sitzung entfernen').click()
            expect(key).to_have_value('')
            form.get_by_label('Gerätepasswort für den Schlüssel').fill('wrong password')
            form.get_by_role('button', name='Schlüssel entsperren').click()
            expect(form.get_by_text('Entsperren fehlgeschlagen.', exact=False)).to_be_visible()
            form.get_by_label('Gerätepasswort für den Schlüssel').fill('a fictional device password')
            form.get_by_role('button', name='Schlüssel entsperren').click()
            expect(key).to_have_value('sk-fictional-browser-key')
            form.get_by_role('button', name='Angezeigte Daten an OpenAI senden').click()
            expect(form.get_by_text('Kontierungsvorschläge prüfen')).to_be_visible()
            assert requests == [{'framework': '03', 'accounts': [], 'rows': [
                {'id': 1, 'direction': 'debit', 'text': 'Fiktiver Einkauf'}]}]
            expect(rows.nth(1).get_by_label('Gegenkonto', exact=True)).to_have_value('')
            form.get_by_role('button', name='Vorschläge in die bearbeitbaren Zeilen übernehmen').click()
            expect(rows.nth(1).get_by_label('Gegenkonto', exact=True)).to_have_value('56781')
            expect(rows.nth(0).get_by_label('Gegenkonto', exact=True)).to_have_value('53124')
            expect(confirm).not_to_be_checked()
            rows.nth(1).get_by_label('Betrag (€)', exact=True).fill('-5,51')
            confirm.check()
            expect(download).to_be_disabled()
            expect(form.get_by_text('Saldendifferenz').locator('..')).to_contain_text('0,01')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            for next_pdf in [scan, mixed, bad]:
                page.reload()
                page.locator('input[type=file]').first.set_input_files(str(next_pdf))
                page.locator('.chooser-tool').filter(has_text='Kontoauszug zu DATEV').click()
                if next_pdf == bad:
                    expect(form.get_by_role('alert')).to_contain_text('nicht lesbar', timeout=90000)
                    expect(form.get_by_role('button', name='DATEV-Datei herunterladen')).to_have_count(0)
                else:
                    expect(form.locator('.bank-row')).to_have_count(2, timeout=90000)
                    expect(form.locator('.bank-row').first).to_be_hidden()
                    form.locator('.bank-reading summary').click()
                    expect(form.locator('.bank-reading dl')).to_contain_text('104,50')
                    if next_pdf == scan:
                        form.get_by_text('KI-Kontierung · optional', exact=True).click()
                        expect(key).to_have_value('')
                        form.get_by_role('button', name='Gespeicherten Schlüssel löschen').click()
                        expect(form.get_by_text('Gespeicherter Schlüssel', exact=True)).to_have_count(0)
            assert len(requests) == 1
    finally:
        context.close()
