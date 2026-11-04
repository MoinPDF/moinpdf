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
    context.route('**/api/datev/status', lambda route: route.fulfill(json={'enabled': True}))

    def suggestions(route):
        requests.append(route.request.post_data_json)
        route.fulfill(json={'suggestions': [{'id': 1, 'account': '56781', 'reason': 'Fiktive Zuordnung'}]})

    context.route('**/api/datev/suggest', suggestions)
    try:
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / 'Fiktiver-Auszug.pdf'
            with pymupdf.open() as doc:
                lines = ['Testbank Kontoauszug 7', 'Kontowaehrung EUR', 'Anfangssaldo 100,00',
                         'Datum Text Betrag', '04.05.2026 Fiktive Gutschrift +10,00',
                         '05.05.2026 Fiktiver Einkauf -5,50', 'Endsaldo 104,50']
                doc.new_page().insert_text((50, 55), '\n'.join(lines))
                doc.save(pdf)
            page.goto(origin)
            page.locator('input[type=file]').first.set_input_files(str(pdf))
            page.locator('.chooser-tool').filter(has_text='Kontoauszug zu DATEV').click()
            form = page.locator('.bank-datev')
            account = form.get_by_label('Konto (Bankkonto)', exact=True)
            default = form.get_by_label('Gegenkonto für leere Zeilen (optional)', exact=True)
            expect(account).to_have_value('')
            expect(default).to_have_value('')
            expect(form.locator('.bank-row')).to_have_count(2)
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
            assert len(columns) == len(positive) == len(negative) == 125
            assert positive[0:2] == ['10,00', 'S'] and positive[6:9] == ['24680', '53124', '0009']
            assert negative[0:2] == ['5,50', 'H'] and negative[6:9] == ['24680', '58765', '']
            assert not requests
            form.get_by_text('KI-Kontierung · optional', exact=True).click()
            form.get_by_label('Privater KI-Zugangscode').fill('fictional-operator-code')
            form.get_by_role('button', name='Angezeigte Daten an OpenAI senden').click()
            expect(form.get_by_text('Kontierungsvorschläge prüfen')).to_be_visible()
            assert requests == [{'framework': '03', 'accounts': [], 'rows': [
                {'id': 1, 'direction': 'debit', 'text': 'Fiktiver Einkauf'}]}]
            expect(rows.nth(1).get_by_label('Gegenkonto', exact=True)).to_have_value('')
            form.get_by_role('button', name='Vorschläge in die bearbeitbaren Zeilen übernehmen').click()
            expect(rows.nth(1).get_by_label('Gegenkonto', exact=True)).to_have_value('56781')
            expect(rows.nth(0).get_by_label('Gegenkonto', exact=True)).to_have_value('53124')
            expect(confirm).not_to_be_checked()
            form.get_by_label('Endsaldo (€)', exact=True).fill('104,49')
            confirm.check()
            download.click()
            expect(form.get_by_role('alert')).to_contain_text('0,01')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    finally:
        context.close()
