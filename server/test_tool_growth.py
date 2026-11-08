"""Generated fictional input files; real MuPDF conversions and durable folder processing."""
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import pymupdf as fitz
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from recovery_documents import ebook
from watch_pipeline import process, validate_workflow
from watch_folders import WatchFolders


def package(files):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return data.getvalue()


def picture(color):
    data = io.BytesIO()
    Image.new('RGB', (120, 60), color).save(data, format='PNG')
    return data.getvalue()


def xps(open_xps=False):
    ns = 'http://schemas.openxps.org/oxps/v1.0' if open_xps else 'http://schemas.microsoft.com/xps/2005/06'
    return package({
        '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="fdseq" ContentType="application/vnd.ms-package.xps-fixeddocumentsequence+xml"/><Default Extension="fdoc" ContentType="application/vnd.ms-package.xps-fixeddocument+xml"/><Default Extension="fpage" ContentType="application/vnd.ms-package.xps-fixedpage+xml"/></Types>',
        '_rels/.rels': f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="{ns}/fixedrepresentation" Target="/FixedDocumentSequence.fdseq"/></Relationships>',
        'FixedDocumentSequence.fdseq': f'<FixedDocumentSequence xmlns="{ns}"><DocumentReference Source="/Documents/1/FixedDocument.fdoc"/></FixedDocumentSequence>',
        'Documents/1/FixedDocument.fdoc': f'<FixedDocument xmlns="{ns}"><PageContent Source="Pages/1.fpage" Width="240" Height="120"/></FixedDocument>',
        'Documents/1/Pages/1.fpage': f'<FixedPage xmlns="{ns}" Width="240" Height="120" xml:lang="de-DE"><Path Fill="#FFFF0000" Data="M 0,0 L 240,0 240,120 0,120 Z"/></FixedPage>',
    })


def fictional_pdf():
    with fitz.open() as pdf:
        pdf.set_metadata({'title': 'Synthetic internal title'})
        for title in ['FIRST', 'SECOND']:
            page = pdf.new_page()
            page.insert_text((40, 40), title)
        page = pdf[0]
        page.add_text_annot((80, 80), 'Synthetic comment')
        widget = fitz.Widget()
        widget.field_name = 'Name'
        widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
        widget.field_value = 'Moin'
        widget.rect = fitz.Rect(40, 100, 220, 130)
        page.add_widget(widget)
        return pdf.tobytes()


class SpecialFormatsTests(unittest.TestCase):
    def test_real_formats_and_api(self):
        from fastapi.testclient import TestClient
        import app as service
        files = {
            'fb2': b'<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><genre>prose</genre><book-title>Moin</book-title><lang>de</lang></title-info></description><body><section><title><p>Moin FictionBook</p></title><p>Fictional example text.</p></section></body></FictionBook>',
            'cbz': package({'page10.png': picture('blue'), 'page2.png': picture('red')}),
            'xps': xps(), 'oxps': xps(True),
        }
        with patch.dict(os.environ, {'MOINPDF_API_KEY': 'synthetic-growth-api-key-for-testing-2026'}):
            client = TestClient(service.app)
            for suffix, data in files.items():
                with self.subTest(format=suffix):
                    response = client.post('/v1/documents/ebook', headers={'Authorization': 'Bearer synthetic-growth-api-key-for-testing-2026'}, files={'file': ('input.' + suffix, data)}, data={'options': '{"paper":"a5","fontSize":14}'})
                    self.assertEqual(response.status_code, 200, response.text[:300])
                    with fitz.open(stream=response.content, filetype='pdf') as pdf:
                        if suffix == 'fb2':
                            self.assertIn('FictionBook', ''.join(page.get_text() for page in pdf))
                            self.assertEqual(round(pdf[0].rect.width), 420)
                        else:
                            pixel = pdf[0].get_pixmap().pixel(20, 20)
                            self.assertGreater(pixel[0], 245)
                            self.assertLess(pixel[2], 10)
                            if suffix == 'cbz':
                                self.assertEqual(len(pdf), 2)
                                self.assertGreater(pdf[1].get_pixmap().pixel(20, 20)[2], 245)
                            else:
                                self.assertEqual(round(pdf[0].rect.width), 180)

    def test_archive_and_xml_rejections(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            for suffix, data in [
                ('cbz', package({'../escape.png': picture('red')})),
                ('cbz', package({'page1.svg': '<svg/>'})),
                ('cbz', package({'page.png': b'broken'})),
                ('xps', package({'wrong': 'content'})),
                ('fb2', b'<!DOCTYPE a [<!ENTITY leak SYSTEM "file:///etc/passwd">]><FictionBook>&leak;</FictionBook>'),
            ]:
                source = folder / ('input.' + suffix)
                source.write_bytes(data)
                with self.subTest(format=suffix), self.assertRaises(ValueError):
                    ebook(source, folder)


class FolderTests(unittest.TestCase):
    def test_pipeline_preserves_text_forms_and_original(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            original = fictional_pdf()
            source = folder / 'input.pdf'
            source.write_bytes(original)
            workflow = {'version': 1, 'name': 'Synthetic cleanup', 'steps': [{'kind': kind} for kind in ['reverse', 'rotate90', 'metadata', 'remove-annotations', 'optimizeLossless']]}
            (folder / 'workflow.json').write_text(json.dumps(workflow))
            process(source, folder)
            with fitz.open(folder / 'output.pdf') as pdf:
                self.assertIn('SECOND', pdf[0].get_text())
                self.assertIn('FIRST', pdf[1].get_text())
                self.assertEqual(pdf[1].rotation, 90)
                self.assertEqual(pdf.metadata['title'], '')
                self.assertEqual(list(pdf[1].annots() or []), [])
                self.assertEqual(list(pdf[1].widgets())[0].field_value, 'Moin')
            self.assertEqual(source.read_bytes(), original)
            workflow['steps'] = [{'kind': 'flattenForms'}]
            (folder / 'workflow.json').write_text(json.dumps(workflow))
            process(source, folder)
            with fitz.open(folder / 'output.pdf') as pdf:
                self.assertFalse(list(pdf[0].widgets() or []))
                self.assertIn('Moin', pdf[0].get_text())

    def test_stability_restart_retries_error_receipts_and_symlinks(self):
        calls = []
        def processor(source, folder, cancel):
            calls.append(source.read_bytes())
            process(source, folder)
            return (folder / 'output.pdf').read_bytes(), json.loads((folder / 'report.json').read_text())
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            profile = root / 'cleanup'
            inbox = profile / 'inbox'
            inbox.mkdir(parents=True)
            workflow = {'version': 1, 'name': 'Cleanup', 'steps': [{'kind': 'metadata'}]}
            (profile / 'workflow.json').write_text(json.dumps(workflow))
            source = inbox / 'original.pdf'
            source.write_bytes(fictional_pdf())
            (inbox / 'outside.pdf').symlink_to('/etc/passwd')
            watch = WatchFolders(root, processor, stable_seconds=5)
            with patch('watch_folders.time.monotonic', return_value=10): watch.scan()
            with patch('watch_folders.time.monotonic', return_value=12): watch.scan()
            self.assertEqual(calls, [])
            with patch('watch_folders.time.monotonic', return_value=16): watch.scan()
            self.assertEqual(len(calls), 1)
            self.assertEqual(source.read_bytes(), calls[0])
            self.assertEqual(len(list((profile / 'output').glob('*.pdf'))), 1)
            restarted = WatchFolders(root, processor, stable_seconds=0)
            restarted.scan(); restarted.scan()
            self.assertEqual(len(calls), 1)
            receipt = next((profile / 'status').glob('*.json'))
            self.assertEqual(json.loads(receipt.read_text())['status'], 'done')
            receipt.unlink()
            restarted.scan()
            self.assertEqual(len(calls), 2)
            (inbox / 'bad.pdf').write_bytes(b'%PDF-invalid')
            restarted.scan(); restarted.scan(); restarted.scan()
            self.assertEqual(len(calls), 3)
            reports = [json.loads(file.read_text()) for file in (profile / 'status').glob('*.json')]
            self.assertEqual(sorted(item['status'] for item in reports), ['done', 'error'])
            workflow['steps'] = [{'kind': 'rotate180'}]
            (profile / 'workflow.json').write_text(json.dumps(workflow))
            restarted.scan()
            self.assertEqual(len(calls), 5)
            (profile / 'workflow.json').write_text('{"version":1}')
            restarted.scan()
            self.assertTrue((profile / 'configuration-error.json').is_file())

    def test_unsupported_steps_and_single_watcher(self):
        for step in [{'kind': 'ocr'}, {'kind': 'metadata', 'condition': {}}, {'kind': 'rotate90', 'number': 2}]:
            with self.assertRaises(ValueError): validate_workflow({'version': 1, 'name': 'Bad', 'steps': [step]})
        with tempfile.TemporaryDirectory() as temp:
            watcher = WatchFolders(temp, lambda *_: None).start()
            try:
                with self.assertRaises(ValueError): WatchFolders(temp, lambda *_: None).start()
            finally:
                watcher.close()
            next_watcher = WatchFolders(temp, lambda *_: None).start()
            next_watcher.close()


if __name__ == '__main__': unittest.main()
