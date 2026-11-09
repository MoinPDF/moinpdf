"""Real validators, German HTR fixture, Ghostscript and durable watched folders.
All invoice/scan inputs are fictional. HTR fixture is licensed AFL-3.0 (see notice).
"""
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import zipfile
import numpy as np
import pymupdf as fitz
from PIL import Image
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).parent))
import app as service
from handwriting_documents import handwriting,prepare,decode
from invoice_validation import summarize
from pdfx_documents import pdfx,check_pdfx,default_profile
from watch_pipeline import process,validate_workflow
from watch_folders import WatchFolders
FIXTURES=Path(__file__).resolve().parent.parent/'tests'/'fixtures'/'growth030'

class GrowthTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'MOINPDF_API_KEY':'fictional-growth030-test-key-1234567890'});self.env.start();self.client=TestClient(service.app);self.headers={'Authorization':'Bearer '+os.environ['MOINPDF_API_KEY']}
    def tearDown(self):self.client.close();self.env.stop()
    def post(self,path,files,data=None):
        response=self.client.post(path,headers=self.headers,files=files,data=data or {})
        self.assertEqual(response.status_code,200,response.text[:500] if response.status_code!=200 else '')
        return zipfile.ZipFile(io.BytesIO(response.content))
    def validate(self,xml):return self.post('/v1/xrechnung/validate',{'file':('invoice.xml',xml)})
    def test_real_kosit_profiles_rounding_exemption_and_invalid_input(self):
        for profile in ('xrechnung','zugferd'):
            for case in ('standard','rounding','exempt'):
                with self.subTest(profile=profile,case=case):
                    xml=(FIXTURES/(profile+'-'+case+'.xml')).read_bytes();archive=self.validate(xml);report=json.loads(archive.read('Ergebnis.json'))
                    self.assertTrue(report['accepted'],report['messages']);self.assertTrue(report['documentHashVerified']);self.assertEqual(report['xrechnungAccepted'],profile=='xrechnung');self.assertEqual(report['errorCount'],0)
                    with self.assertRaises(ValueError):summarize(archive.read('KoSIT-Pruefbericht.xml'),xml+b' ')
        xml=(FIXTURES/'xrechnung-standard.xml').read_text()
        for bad in [xml.replace('<ram:BuyerReference>TEST-REVIEW</ram:BuyerReference>',''),xml.replace('<ram:DefinedTradeContact>','<ram:DefinedTradeContact>').replace('<ram:PersonName>Erika Muster</ram:PersonName>',''),xml.replace('<ram:GrandTotalAmount>129.70</ram:GrandTotalAmount>','<ram:GrandTotalAmount>129.71</ram:GrandTotalAmount>')]:
            report=json.loads(self.validate(bad.encode()).read('Ergebnis.json'));self.assertFalse(report['xrechnungAccepted']);self.assertGreater(report['errorCount'],0)
        bad=self.client.post('/v1/xrechnung/validate',headers=self.headers,files={'file':('invoice.xml',b'<!DOCTYPE x [<!ENTITY bad SYSTEM "file:///etc/passwd">]><x>&bad;</x>')});self.assertEqual(bad.status_code,422)
    def test_real_hybrid_mustang_verapdf_declared_profile_and_exact_xml(self):
        xml=(FIXTURES/'zugferd-standard.xml').read_bytes();original=(FIXTURES/'invoice.pdf').read_bytes()
        archive=self.post('/v1/zugferd/create',{'file':('invoice.pdf',original),'invoice':('invoice.xml',xml)},{'profile':'T'})
        report=json.loads(archive.read('Ergebnis.json'));self.assertTrue(report['compliant'],report);self.assertTrue(report['mustangValid']);self.assertTrue(report['pdfa3b']);self.assertTrue(report['declaredPdfaValid']);self.assertIn('PDF/A-3',report['declaredPdfaProfile'])
        with fitz.open(stream=archive.read('ZUGFeRD-geprueft.pdf'),filetype='pdf') as result,fitz.open(stream=original,filetype='pdf') as before:
            self.assertEqual(len(result),len(before));self.assertTrue(any(result.embfile_get(n)==xml for n in result.embfile_names()));self.assertIn('129.70',''.join(p.get_text() for p in result))
            for p,q in zip(before,result):
                a=np.frombuffer(p.get_pixmap().samples,np.uint8).astype(np.int16);b=np.frombuffer(q.get_pixmap().samples,np.uint8).astype(np.int16);self.assertEqual(a.shape,b.shape);self.assertLess(float(np.mean(np.abs(a-b))),0.8)
    def test_real_handwriting_blank_transparency_repeat_decode_and_api(self):
        config=json.loads((service.TOOLS/'handwriting'/'config.json').read_text());self.assertIsNone(prepare(Image.new('RGBA',(120,64),(0,0,0,0)),config));self.assertIsNone(prepare(Image.new('RGB',(120,64),'white'),config))
        indices=[1,1,0,1];logits=np.zeros((1,len(indices),len(config['alphabet'])+1),np.float32)
        for n,i in enumerate(indices):logits[0,n,i]=1
        self.assertEqual(decode(logits,config),config['alphabet'][0]*2)
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp);source=directory/'input.pdf';image=Image.open(FIXTURES/'fixture-2.jpg');width,height=image.size;image.close();doc=fitz.open();p=doc.new_page(width=width,height=height);p.insert_image(p.rect,filename=str(FIXTURES/'fixture-2.jpg'));doc.new_page(width=120,height=64);doc.save(source);doc.close()
            settings={'lines':[{'page':0,'rect':{'x':0,'y':0,'w':1,'h':1}},{'page':1,'rect':{'x':0,'y':0,'w':1,'h':1}}]};(directory/'settings.json').write_text(json.dumps(settings));handwriting(source,directory);report=json.loads((directory/'report.json').read_text());self.assertTrue(report['reviewRequired']);self.assertEqual(report['lines'][0]['text'],'Handschrift');self.assertEqual(report['lines'][1]['status'],'blank');self.assertEqual(report['lines'][1]['text'],'')
            response=self.client.post('/v1/documents/handwriting',headers=self.headers,files={'file':('input.pdf',source.read_bytes())},data={'options':json.dumps({'lines':[settings['lines'][0]]})});self.assertEqual(response.status_code,200,response.text[:300]);self.assertEqual(response.json()['lines'][0]['text'],'Handschrift')
            settings['lines'][0]['rect']['x']=-1;(directory/'settings.json').write_text(json.dumps(settings))
            with self.assertRaisesRegex(ValueError,'Zeilenbereich'):handwriting(source,directory)
    def test_real_pdfx_profile_boxes_render_and_rejections(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp);source=directory/'input.pdf';source.write_bytes((FIXTURES/'invoice.pdf').read_bytes());(directory/'settings.json').write_text(json.dumps({'trimInsetMm':3,'allowFontSubstitution':False}));pdfx(source,directory);report=json.loads((directory/'report.json').read_text());self.assertTrue(report['technicalChecksPassed'],report);self.assertFalse(report['isoConformanceVerified'])
            with fitz.open(directory/'output.pdf') as output:self.assertIn('129.70',''.join(p.get_text() for p in output));self.assertEqual(len(output),1);self.assertGreater(len(output[0].get_pixmap().samples),10000)
            from pypdf import PdfReader,PdfWriter
            from pypdf.generic import NameObject,RectangleObject
            writer=PdfWriter(clone_from=PdfReader(directory/'output.pdf'));del writer.root_object['/OutputIntents'];writer.write(directory/'bad-profile.pdf');self.assertFalse(check_pdfx(directory/'bad-profile.pdf',default_profile(),1)['technicalChecksPassed'])
            writer=PdfWriter(clone_from=PdfReader(directory/'output.pdf'));writer.pages[0].trimbox=RectangleObject([-1,-1,1000,1000]);writer.write(directory/'bad-box.pdf');self.assertIn('Nested page boxes',check_pdfx(directory/'bad-box.pdf',default_profile(),1)['checksFailed'])
            (directory/'custom.icc').write_bytes(b'invalid')
            with self.assertRaisesRegex(ValueError,'CMYK'):pdfx(source,directory)
            (directory/'custom.icc').unlink();doc=fitz.open();page=doc.new_page();page.insert_text((40,40),'Not embedded');doc.save(directory/'unembedded.pdf');doc.close()
            with self.assertRaisesRegex(ValueError,'Schriften'):pdfx(directory/'unembedded.pdf',directory)
            archive=self.post('/v1/print-pdfx',{'file':('input.pdf',source.read_bytes())},{'options':'{"trimInsetMm":3}'});self.assertTrue(json.loads(archive.read('Technische-Pruefung.json'))['technicalChecksPassed'])
    def test_real_watch_ocr_conditions_splitting_routing_and_originals(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp);source=directory/'input.pdf';scan=fitz.open();p=scan.new_page(width=500,height=300);p.insert_text((30,70),'RECHNUNG ALPHA',fontsize=24);p.insert_text((30,110),'Invoice number: RE-001',fontsize=20);p.insert_text((30,150),'2026-11-09',fontsize=20);image=p.get_pixmap(matrix=fitz.Matrix(2,2)).tobytes('png');doc=fitz.open();p=doc.new_page(width=500,height=300);p.insert_image(p.rect,stream=image);doc.new_page(width=500,height=300);p=doc.new_page(width=500,height=300);p.insert_text((30,70),'RECHNUNG BETA',fontsize=24);doc.save(source);doc.close();scan.close();original=source.read_bytes()
            flow={'version':2,'name':'Test','steps':[{'kind':'ocr'},{'kind':'removeBlank'},{'kind':'rotate90','condition':{'field':'text','operator':'contains','value':'ALPHA'}},{'kind':'metadata','condition':{'field':'filename','operator':'contains','value':'nomatch'},'otherwise':{'kind':'rotate180'}}],'split':{'mode':'text','text':'RECHNUNG'},'routes':[{'contains':'ALPHA','folder':'Alpha'},{'contains':'BETA','folder':'Beta'}],'filename':'{invoice}-{date}-{part}'}
            (directory/'workflow.json').write_text(json.dumps(flow));process(source,directory);report=json.loads((directory/'report.json').read_text());self.assertEqual(report['pages'],2);self.assertEqual([r['folder'] for r in report['outputs']],['Alpha','Beta']);self.assertEqual(source.read_bytes(),original);self.assertIn('RE-001-2026-11-09-001',report['outputs'][0]['name'])
            with fitz.open(directory/report['outputs'][0]['file']) as out:self.assertIn('ALPHA',out[0].get_text());self.assertEqual(out[0].rotation,270)
            root=directory/'watched';profile=root/'invoices';(profile/'inbox').mkdir(parents=True);(profile/'workflow.json').write_text(json.dumps(flow));(profile/'inbox'/'scan.pdf').write_bytes(original);watch=WatchFolders(root,service.watched_conversion,stable_seconds=0);watch.scan();watch.scan();paths=sorted((profile/'output').rglob('*.pdf'));self.assertEqual(len(paths),2);watch.scan();self.assertEqual(sorted((profile/'output').rglob('*.pdf')),paths);self.assertEqual((profile/'inbox'/'scan.pdf').read_bytes(),original)
            flow['routes'].append({'contains':'ALPHA','folder':'Other'});(directory/'workflow.json').write_text(json.dumps(flow));process(source,directory);self.assertEqual(json.loads((directory/'report.json').read_text())['outputs'][0]['folder'],'Pruefen')
    def test_watch_validation_and_result_path_rejections(self):
        base={'version':2,'name':'Test','steps':[{'kind':'metadata'}]}
        for bad in [{**base,'filename':'../bad'},{**base,'routes':[{'contains':'x','folder':'../bad'}]},{**base,'split':{'mode':'text','text':''}},{**base,'steps':[{'kind':'ocr','condition':{'field':'text','operator':'regex','value':'.*'}}]},{**base,'version':True}]:
            with self.subTest(bad=bad),self.assertRaises(ValueError):validate_workflow(bad)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);profile=root/'test';(profile/'inbox').mkdir(parents=True);(profile/'workflow.json').write_text(json.dumps(base));(profile/'inbox'/'invoice.pdf').write_bytes((FIXTURES/'invoice.pdf').read_bytes());watch=WatchFolders(root,lambda *_:([('../bad','evil.pdf',b'%PDF-bad')],{}),stable_seconds=0);watch.scan();watch.scan();self.assertFalse((root/'bad').exists());reports=[json.loads(p.read_text()) for p in (profile/'status').glob('*.json')];self.assertEqual(reports[0]['status'],'error')

if __name__=='__main__':unittest.main()
