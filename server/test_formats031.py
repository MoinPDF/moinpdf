"""Fictional content and pinned upstream samples; verify bytes with independent readers."""
import io
import json
import os
from pathlib import Path
import shutil
import struct
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import zlib
import pymupdf
from PIL import Image
from fastapi.testclient import TestClient
from server import app as service, format_documents as formats


def rar5_stored(members):
    """Test-only stored members using RARLAB's public RAR5 container specification."""
    def vint(value):
        result = bytearray()
        while value > 127:
            result.append((value & 127) | 128); value >>= 7
        result.append(value)
        return bytes(result)
    def header(body):
        body = vint(len(body)) + body
        return struct.pack('<I', zlib.crc32(body)) + body
    archive = bytearray(b'Rar!\x1a\x07\x01\x00' + header(b'\x01\x00\x00'))
    for name, data in members:
        name = name.encode('utf-8')
        body = b'\x02\x02' + vint(len(data)) + b'\x04' + vint(len(data)) + vint(0o100644) + struct.pack('<I', zlib.crc32(data)) + b'\x00\x01' + vint(len(name)) + name
        archive.extend(header(body)); archive.extend(data)
    archive.extend(header(b'\x05\x00\x00'))
    return bytes(archive)


def fixture_pdf():
    with pymupdf.open() as pdf:
        for label in ['Fictional MoinPDF format test', 'Second page with text 123.45']:
            page = pdf.new_page(width=300, height=400)
            page.insert_text((25, 40), label, fontsize=12)
            page.draw_rect(pymupdf.Rect(25, 80, 75, 130), color=(1, 0, 0), fill=(1, 0, 0))
        return pdf.tobytes()


def drawing():
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as z:
        z.writestr('mimetype', 'application/vnd.oasis.opendocument.graphics')
        z.writestr('META-INF/manifest.xml', '''<?xml version="1.0"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.graphics"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>''')
        z.writestr('content.xml', '''<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:drawing><draw:page draw:name="Page 1"><draw:frame svg:x="2cm" svg:y="2cm" svg:width="14cm" svg:height="3cm"><draw:text-box><text:p>Fictional ODG drawing</text:p></draw:text-box></draw:frame></draw:page></office:drawing></office:body></office:document-content>''')
    return out.getvalue()


class FormatTests(unittest.TestCase):
    def setUp(self):
        self.key = 'fictional-format-test-key-' + 'x' * 32
        self.env = patch.dict(os.environ, {'MOINPDF_API_KEY': self.key})
        self.env.start(); self.addCleanup(self.env.stop)
        self.client = TestClient(service.app)
        self.headers = {'Authorization': 'Bearer ' + self.key}

    def post(self, path, name, data, options=None):
        return self.client.post(path, headers=self.headers, files={'file': (name, data)}, data={'options': json.dumps(options or {})})

    def test_required_release_converters(self):
        if os.getenv('MOINPDF_REQUIRE_FORMAT_CONVERTERS') == '1':
            self.assertTrue(service.office_binary())
            self.assertTrue(shutil.which('ebook-convert'))
            import libarchive  # noqa: F401

    @unittest.skipUnless(service.office_binary(), 'LibreOffice unavailable locally')
    def test_real_legacy_and_drawing_inputs(self):
        corpus = Path('.cache/office-fixtures')
        fixtures = [('WP6.wpd', (corpus / 'WP6.wpd').read_bytes(), 'Foo'),
                    ('testWORKS.wps', (corpus / 'testWORKS.wps').read_bytes(), 'Microsoft Works'),
                    ('fictional.odg', drawing(), 'Fictional ODG')]
        for name, data, expected in fixtures:
            with self.subTest(name=name):
                response = self.post('/v1/office', name, data)
                self.assertEqual(response.status_code, 200, response.text[:300] if response.status_code != 200 else '')
                with pymupdf.open(stream=response.content, filetype='pdf') as pdf:
                    self.assertIn(expected, ''.join(p.get_text() for p in pdf))
                    self.assertGreater(sum(v < 245 for v in pdf[0].get_pixmap().samples), 100)

    @unittest.skipUnless(service.office_binary(), 'LibreOffice unavailable locally')
    def test_real_office_exports_and_reimport(self):
        for fmt in ['rtf', 'odt', 'odp']:
            with self.subTest(format=fmt):
                response = self.post('/v1/formats/' + fmt, 'fictional.pdf', fixture_pdf())
                self.assertEqual(response.status_code, 200, response.text[:400] if response.status_code != 200 else '')
                if fmt == 'rtf': self.assertTrue(response.content.startswith(b'{\\rtf'))
                else:
                    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                        self.assertIn(b'opendocument', z.read('mimetype'))
                        self.assertIn('content.xml', z.namelist())
                restored = self.post('/v1/office', 'restored.' + fmt, response.content)
                self.assertEqual(restored.status_code, 200, restored.text[:300] if restored.status_code != 200 else '')
                with pymupdf.open(stream=restored.content, filetype='pdf') as pdf:
                    self.assertEqual(len(pdf), 2)
                    if fmt != 'odp': self.assertIn('Fictional', ''.join(p.get_text() for p in pdf))
                    self.assertGreater(sum(v < 245 for v in pdf[0].get_pixmap().samples), 100)

    @unittest.skipUnless(shutil.which('ebook-convert'), 'Calibre unavailable locally; required in Docker CI')
    def test_real_kindle_import_export(self):
        response = self.post('/v1/formats/azw3', 'fictional.pdf', fixture_pdf(), {'title': 'Fictional book', 'language': 'en'})
        self.assertEqual(response.status_code, 200, response.text[:300] if response.status_code != 200 else '')
        self.assertEqual(response.content[60:68], b'BOOKMOBI')
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            azw3 = folder / 'book.azw3'; azw3.write_bytes(response.content)
            mobi = folder / 'book.mobi'; formats.run(['ebook-convert', str(azw3), str(mobi)], folder)
            for path in [azw3, mobi]:
                result = self.post('/v1/documents/ebook', path.name, path.read_bytes(), {'paper': 'a5', 'fontSize': 14})
                self.assertEqual(result.status_code, 200, result.text[:300] if result.status_code != 200 else '')
                with pymupdf.open(stream=result.content, filetype='pdf') as pdf:
                    self.assertIn('Fictional MoinPDF', ''.join(p.get_text() for p in pdf))
                    self.assertEqual(round(pdf[0].rect.width), 420)
                    self.assertIn('Second page', ''.join(p.get_text() for p in pdf))
                    for page in pdf:
                        self.assertGreater(sum(v < 245 for v in page.get_pixmap().samples), 100, f'Blank Kindle page {page.number + 1}')

    def test_real_cbr_streams_and_adversarial_members(self):
        images = []
        for color in ['#ff0000', '#0000ff']:
            out = io.BytesIO(); Image.new('RGB', (50, 70), color).save(out, format='PNG'); images.append(out.getvalue())
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp); cbr = folder / 'book.cbr'; cbz = folder / 'book.cbz'
            cbr.write_bytes(rar5_stored([('page10.png', images[0]), ('page2.png', images[1])]))
            formats.cbr_to_cbz(cbr, cbz)
            with zipfile.ZipFile(cbz) as z:
                self.assertEqual(z.read('0001.png'), images[1]); self.assertEqual(z.read('0002.png'), images[0])
            response = self.post('/v1/documents/ebook', 'book.cbr', cbr.read_bytes())
            self.assertEqual(response.status_code, 200, response.text[:300] if response.status_code != 200 else '')
            with pymupdf.open(stream=response.content, filetype='pdf') as pdf: self.assertEqual(len(pdf), 2)
            for members in [[('../escape.png', images[0])], [('/absolute.png', images[0])], [('same.png', images[0]), ('same.png', images[1])], [('evil.js', b'alert(1)')], [('fake.png', b'not image')]]:
                cbr.write_bytes(rar5_stored(members))
                with self.assertRaises(ValueError): formats.cbr_to_cbz(cbr, cbz)
            cbr.write_bytes(b'not RAR')
            with self.assertRaises(ValueError): formats.cbr_to_cbz(cbr, cbz)

    def test_optional_cbr_creation_contract(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp); source = folder / 'input.pdf'; source.write_bytes(fixture_pdf()); (folder / 'settings.json').write_text('{"dpi":100,"imageFormat":"png"}')
            commands = []
            def fake_run(args, directory):
                commands.append(args)
                (directory / 'output.cbr').write_bytes(rar5_stored([(name, (directory / name).read_bytes()) for name in args[6:]]))
            with patch.object(formats.shutil, 'which', return_value='/operator/rar'), patch.object(formats, 'run', side_effect=fake_run):
                formats.cbr_export(source, folder)
            self.assertEqual(commands[0][:5], ['/operator/rar', 'a', '-idq', '-ep', '-m0'])
            formats.cbr_to_cbz(folder / 'output.cbr', folder / 'checked.cbz')
            with zipfile.ZipFile(folder / 'checked.cbz') as z: self.assertEqual(len(z.namelist()), 2)
        with patch.object(service.shutil, 'which', return_value=None):
            response = self.post('/v1/formats/cbr', 'fictional.pdf', fixture_pdf())
            self.assertEqual(response.status_code, 503)

    def test_corrupt_inputs_auth_and_options(self):
        self.assertEqual(self.client.post('/v1/formats/odt').status_code, 401)
        self.assertEqual(self.post('/v1/formats/exe', 'test.pdf', fixture_pdf()).status_code, 404)
        for fmt in ['wpd', 'wps', 'odg', 'rtf']:
            self.assertEqual(self.post('/v1/office', 'bad.' + fmt, b'not a document').status_code, 422)
        for fmt in ['mobi', 'azw3', 'cbr']:
            self.assertEqual(self.post('/v1/documents/ebook', 'bad.' + fmt, b'not a document').status_code, 422)
        response = self.client.post('/v1/formats/odt', headers=self.headers, files={'file': ('test.pdf', fixture_pdf())}, data={'options': '[]'})
        self.assertEqual(response.status_code, 422)


if __name__ == '__main__': unittest.main()
