import io
import json
import os
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from urllib.parse import unquote

import pymupdf as fitz
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from recovery_documents import optimize, ebook, sanitized_epub


def book_bytes(extra=None):
    files={
        'mimetype': 'application/epub+zip',
        'META-INF/container.xml': '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        'book.opf': '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">test</dc:identifier><dc:title>Moin</dc:title><dc:language>de</dc:language></metadata><manifest><item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>',
        'chapter.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Moin</title></head><body><h1>Moin aus dem Norden</h1><p>Ein E-Book mit lesbarem Text.</p><script>alert(1)</script><img src="https://example.invalid/tracker.png"/></body></html>',
    }
    files.update(extra or {})
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w') as archive:
        for name,data in files.items():archive.writestr(name,data)
    return output.getvalue()


class RecoveryTests(unittest.TestCase):
    def test_compression_keeps_text_forms_links(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp);source=directory/'input.pdf'
            pdf=fitz.open();page=pdf.new_page();page.insert_text((40,40),'Text bleibt erhalten')
            # High-resolution RGB scan with substantial savings from subsampling.
            image=Image.effect_noise((1800,1800),80).convert('RGB');data=io.BytesIO();image.save(data,format='PNG')
            page.insert_image(fitz.Rect(40,150,540,650),stream=data.getvalue())
            widget=fitz.Widget();widget.field_name='Name';widget.field_type=fitz.PDF_WIDGET_TYPE_TEXT;widget.field_value='Moin';widget.rect=fitz.Rect(40,60,200,90);page.add_widget(widget)
            page.insert_link({'kind':fitz.LINK_URI,'from':fitz.Rect(40,100,200,130),'uri':'https://example.org'})
            pdf.save(source);pdf.close();original=source.read_bytes()
            (directory/'settings.json').write_text(json.dumps({'targetMB':.1,'optimizeMode':'images'}))
            optimize(source,directory)
            out=directory/'output.pdf';self.assertLess(out.stat().st_size,len(original))
            with fitz.open(out) as checked:
                self.assertIn('Text bleibt erhalten',checked[0].get_text());self.assertEqual(list(checked[0].widgets())[0].field_value,'Moin');self.assertEqual(checked[0].get_links()[0]['uri'],'https://example.org');self.assertEqual(len(checked),1)
            info=json.loads((directory/'result-note.json').read_text());self.assertEqual(info['targetReached'],out.stat().st_size<=.1*1024*1024);self.assertEqual(info['bytes'],out.stat().st_size);self.assertEqual(source.read_bytes(),original)
            (directory/'settings.json').write_text('{"targetMB": 80, "optimizeMode":"lossless"}');optimize(source,directory);self.assertEqual(out.read_bytes(),original)
            for value in [True,'2',float('nan'),0,81]:
                (directory/'settings.json').write_text(json.dumps({'targetMB':value}))
                with self.assertRaises(ValueError):optimize(source,directory)

    def test_ebook_layout_text_and_archive_safety(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp);source=directory/'input.epub';source.write_bytes(book_bytes());ebook(source,directory)
            with fitz.open(directory/'output.pdf') as pdf:
                self.assertIn('Moin aus dem Norden',''.join(page.get_text() for page in pdf));self.assertEqual(round(pdf[0].rect.width),595)
            (directory/'settings.json').write_text('{"paper":"a5","fontSize":16}');ebook(source,directory)
            with fitz.open(directory/'output.pdf') as pdf:self.assertEqual(round(pdf[0].rect.width),420)
            with zipfile.ZipFile(directory/'book.epub') as sanitized:
                text=sanitized.read('chapter.xhtml').decode();self.assertNotIn('tracker.png',text);self.assertNotIn('alert(1)',text)
            for extra in [{'../escape':'bad'},{'META-INF/encryption.xml':'<encryption/>'},{'bad.xml':'<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///etc/passwd">]><x>&leak;</x>'},{'META-INF/container.xml':'<container/>'}]:
                source.write_bytes(book_bytes(extra))
                with self.assertRaises(ValueError):sanitized_epub(source,directory/'rejected.epub')
            source.write_bytes(b'bad zip')
            with self.assertRaises(ValueError):ebook(source,directory)

    def test_api_worker_and_note(self):
        from fastapi.testclient import TestClient
        import app as service
        with patch.dict(os.environ,{'MOINPDF_API_KEY':'synthetic-test-key-for-moinpdf-tests-2026'}):
            client=TestClient(service.app);headers={'Authorization':'Bearer synthetic-test-key-for-moinpdf-tests-2026'}
            pdf=fitz.open();pdf.new_page().insert_text((40,40),'Moin');data=pdf.tobytes();pdf.close()
            response=client.post('/v1/documents/optimize',headers=headers,files={'file':('test.pdf',data,'application/pdf')},data={'options':'{"targetMB":2}'})
            self.assertEqual(response.status_code,200,response.text[:300]);self.assertIn('Zielgröße erreicht',unquote(response.headers['x-moinpdf-note']))
            response=client.post('/v1/documents/ebook',headers=headers,files={'file':('test.epub',book_bytes(),'application/epub+zip')})
            self.assertEqual(response.status_code,200,response.text[:300])
            with fitz.open(stream=response.content,filetype='pdf') as pdf:self.assertIn('Moin',pdf[0].get_text())
            wrong=client.post('/v1/documents/ebook',headers=headers,files={'file':('test.pdf',data,'application/pdf')});self.assertEqual(wrong.status_code,422)
            denied=client.post('/v1/documents/optimize',files={'file':('test.pdf',data,'application/pdf')});self.assertEqual(denied.status_code,401)


if __name__=='__main__':unittest.main()
