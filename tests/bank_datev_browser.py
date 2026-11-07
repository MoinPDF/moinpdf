"""Exercise real PDF extraction, manual CSV download and an explicitly simulated AI service."""
import csv
import tempfile
from pathlib import Path

import pymupdf
from playwright.sync_api import expect


def verify_protected_uploads(browser, origin, pdf, locked):
    # Mirror the hosted first visit: the document sets COEP, static JS does
    # not, and a service worker cannot supply missing headers yet.
    context = browser.new_context(service_workers='block')
    def isolated_page(route):
        response = route.fetch()
        headers = {**response.headers, 'cross-origin-opener-policy': 'same-origin',
                   'cross-origin-embedder-policy': 'require-corp'}
        route.fulfill(response=response, headers=headers)

    context.route(origin + '/', isolated_page)
    page = context.new_page()
    upload = page.locator('input[type=file]').first
    bank = page.locator('.chooser-tool[data-tool-id=bank-datev]')
    worker_path = '**/workers/pdf-security.js'
    try:
        page.goto(origin)
        assert page.evaluate('crossOriginIsolated')
        page.route(worker_path, lambda route: route.abort())
        upload.set_input_files(str(pdf))
        expect(page.get_by_text('MoinPDF konnte die geschützte PDF im Browser nicht öffnen.', exact=False)).to_be_visible()
        expect(page.get_by_role('button', name='PDF reparieren')).to_have_count(0)
        page.unroute(worker_path)
        page.reload()
        upload.set_input_files(str(pdf))
        bank.click()
        expect(page.locator('.bank-row')).to_have_count(2)
        expect(page.get_by_label('PDF-Passwort')).to_have_count(0)

        page.reload()
        page.locator('.mosaic-all-tools').click()
        bank.click()
        upload.set_input_files(str(locked))
        dialog = page.get_by_role('dialog')
        dialog.get_by_label('PDF-Passwort', exact=True).fill('incorrect')
        dialog.get_by_role('button', name='PDF öffnen').click()
        expect(dialog.get_by_role('alert')).to_contain_text('Passwort war nicht korrekt')
        dialog.get_by_label('PDF-Passwort', exact=True).fill('fictional-reader')
        dialog.get_by_role('button', name='PDF öffnen').click()
        expect(page.locator('.bank-row')).to_have_count(2)
    finally:
        context.close()


def verify_bank_demo(browser, origin):
    for language in ('de', 'en'):
        context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        try:
            page = context.new_page()
            page.goto(origin)
            english = language == 'en'
            if english:
                page.locator('.language-trigger').click()
                page.get_by_role('menuitemradio', name='English', exact=True).click()
            page.locator('.mosaic-all-tools').click()
            page.locator('.chooser-tool[data-tool-id=bank-datev]').click()
            page.get_by_role('button', name='Try a sample bank statement' if english else
                             'Mit Beispielkontoauszug ausprobieren', exact=True).click()
            form = page.locator('.bank-datev')
            expect(form.locator('.arrival-file-name')).to_have_text(
                'Sample-Bank-Statement.pdf' if english else 'Beispiel-Kontoauszug.pdf')
            expect(form.locator('.bank-row')).to_have_count(4)
            expect(form.locator('.bank-row').first).to_be_hidden()
            for de, en, value in [
                ('Konto (Bankkonto)', 'Account (bank account)', '24680'),
                ('Gegenkonto für leere Zeilen (optional)', 'Offset account for empty entries (optional)', '54321'),
                ('Beraternummer', 'Advisor number', '39821'),
                ('Mandantennummer', 'Client number', '643'),
            ]:
                form.get_by_label(en if english else de, exact=True).fill(value)
            form.get_by_role('checkbox').check()
            with page.expect_download() as received:
                form.get_by_role('button', name='Download DATEV file' if english else
                                 'DATEV-Datei herunterladen', exact=True).click()
            with open(received.value.path(), encoding='cp1252', newline='') as handle:
                header, columns, *rows = csv.reader(handle, delimiter=';')
            assert header[10:12] == ['39821', '643'] and header[14:16] == ['20261001', '20261031']
            assert columns[10] == 'Belegfeld 1' and len(columns) == 125
            assert [(row[0], row[1], row[9]) for row in rows] == [
                ('500,00', 'S', '0210'), ('85,50', 'H', '0610'),
                ('24,50', 'H', '1410'), ('5,00', 'H', '3010')]
            assert all(len(row) == 125 and not row[10] and row[6:8] == ['24680', '54321'] for row in rows)
            # Correctable posting errors must identify and open the actual row,
            # even when it is hidden by search and the list is collapsed.
            postings = form.locator('.bank-postings')
            postings.locator('summary').first.click()
            amount = form.locator('.bank-row').first.get_by_label('Amount (€)' if english else 'Betrag (€)', exact=True)
            amount.fill('-bad')
            form.get_by_label('Search postings' if english else 'Buchungen durchsuchen').fill('no matching posting')
            postings.locator('summary').first.click()
            review = form.locator('.bank-review')
            expect(review).to_contain_text('Amount is missing' if english else 'Betrag fehlt')
            review.get_by_role('button', name='Posting 1' if english else 'Buchung 1', exact=True).click()
            expect(amount).to_be_focused()
            expect(form.get_by_label('Search postings' if english else 'Buchungen durchsuchen')).to_have_value('')
            form.get_by_role('checkbox').check()
            expect(form.get_by_role('button', name='Download DATEV file' if english else 'DATEV-Datei herunterladen', exact=True)).to_be_disabled()
            amount.fill('+500,00')
            expect(review).to_have_count(0)
            form.get_by_role('checkbox').check()
            expect(form.get_by_role('button', name='Download DATEV file' if english else 'DATEV-Datei herunterladen', exact=True)).to_be_enabled()

            # Only the explicitly mocked service is called. No real credentials
            # or bank details leave this browser test.
            context.route('**/api/datev/status', lambda route: route.fulfill(json={'enabled': False, 'personal': True}))
            replies = [
                {'error': {'code': 'openai_credit_exhausted'}, 'retryAfterSeconds': 0},
                {'error': {'code': 'openai_rate_limit'}, 'retryAfterSeconds': 2},
                {},
            ]
            calls = []
            def limit_response(route):
                calls.append(route.request.post_data_json)
                route.fulfill(status=429, json=replies[len(calls) - 1])
            context.route('**/api/datev/personal', limit_response)
            form.get_by_text('AI posting suggestions · optional' if english else 'KI-Kontierung · optional', exact=True).click()
            form.get_by_label('Personal OpenAI API key' if english else 'Eigener OpenAI-API-Schlüssel', exact=True).fill('sk-fictional-browser-key')
            send = form.get_by_role('button', name='Send displayed data to OpenAI' if english else 'Angezeigte Daten an OpenAI senden', exact=True)
            send.click()
            expect(form.get_by_role('alert')).to_contain_text('credit balance is exhausted' if english else 'API-Guthaben ist aufgebraucht')
            expect(send).to_be_enabled()
            send.click()
            expect(form.get_by_role('alert')).to_contain_text('temporarily limiting' if english else 'vorübergehend')
            expect(send).to_be_disabled()
            expect(send).to_be_enabled(timeout=6000)
            assert len(calls) == 2, 'The app must not automatically resend customer data.'
            send.click()
            expect(form.get_by_role('alert')).to_contain_text('does not report a specific reason' if english else 'keinen genauen Grund')
            assert len(calls) == 3
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            print(f'PASS: {language} sample bank statement opens and exports four balanced DATEV postings.', flush=True)
        finally:
            context.close()


def verify_bank_datev(browser, origin):
    verify_bank_demo(browser, origin)
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
                missing_balance = Path(directory) / 'Fiktiv-ohne-Endsaldo.pdf'
                with pymupdf.open() as incomplete:
                    incomplete.new_page().insert_text((50, 55), '\n'.join(lines[:-1]), fontsize=15, lineheight=1.5)
                    incomplete.save(missing_balance)
                restricted = Path(directory) / 'Fiktiv-Berechtigungsschutz.pdf'
                locked = Path(directory) / 'Fiktiv-Passwortschutz.pdf'
                for target, password in [(restricted, ''), (locked, 'fictional-reader')]:
                    doc.save(target, encryption=pymupdf.PDF_ENCRYPT_AES_128,
                             user_pw=password, owner_pw='fictional-owner', permissions=-1036)
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
            verify_protected_uploads(browser, origin, restricted, locked)
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
            for next_pdf in [scan, mixed, bad, missing_balance]:
                page.reload()
                page.locator('input[type=file]').first.set_input_files(str(next_pdf))
                page.locator('.chooser-tool').filter(has_text='Kontoauszug zu DATEV').click()
                if next_pdf == bad:
                    expect(form.get_by_role('alert')).to_contain_text('nicht lesbar', timeout=90000)
                    expect(form.get_by_role('button', name='DATEV-Datei herunterladen')).to_have_count(0)
                elif next_pdf == missing_balance:
                    expect(form.locator('.bank-row')).to_have_count(2)
                    expect(form.locator('.bank-review')).to_contain_text('Endsaldo fehlt oder ist nicht lesbar.')
                    expect(form.locator('.bank-review')).not_to_contain_text('Anfangssaldo fehlt')
                    form.get_by_role('checkbox').check()
                    expect(form.get_by_role('button', name='DATEV-Datei herunterladen')).to_be_disabled()
                    assert not form.get_by_label('Endsaldo (€)', exact=True).count()
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
