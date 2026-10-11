import os
from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
import pymupdf
from server import app as service

class ImportFormatTests(unittest.TestCase):
    def test_real_pages_visio_and_publisher_inputs(self):
        fixtures = Path('.cache/office-fixtures')
        names = ['fdo59355-1.pub', 'fdo57117-1.vsd', 'Visio2013drawing.vsdx', 'Pages_4.pages', 'Pages_5.pages']
        with patch.dict(os.environ, {'MOINPDF_API_KEY': 'synthetic-'+40*'x'}), TestClient(service.app) as client:
            for name in names:
                with self.subTest(name=name):
                    self.assertTrue((fixtures/name).is_file(), 'Run tests/fetch-office-fixtures.py before offline tests')
                    response = client.post('/v1/office', headers={'Authorization':'Bearer '+os.environ['MOINPDF_API_KEY']}, files={'file':(name,(fixtures/name).read_bytes())})
                    self.assertEqual(response.status_code,200,response.text[:250] if response.status_code!=200 else '')
                    with pymupdf.open(stream=response.content,filetype='pdf') as pdf:
                        self.assertGreater(len(pdf),0)
                        self.assertTrue(any(p.get_text().strip() or p.get_drawings() or p.get_images() for p in pdf), 'Conversion must contain actual text, vectors or images')
                        pixels=pdf[0].get_pixmap(matrix=pymupdf.Matrix(.5,.5),alpha=False).samples
                        self.assertGreater(sum(v<245 for v in pixels),30,'The converted page must not be blank')
            response=client.post('/v1/office',headers={'Authorization':'Bearer '+os.environ['MOINPDF_API_KEY']},files={'file':('corrupt.pages',b'not a Pages document')})
            self.assertEqual(response.status_code,422)
