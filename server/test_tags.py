import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
import pymupdf as fitz
sys.path.insert(0,str(Path(__file__).parent))
from tag_documents import inspect_tags,repair_tags
from tag_fixture import tagged_fixture

class TagRepairTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.directory=Path(self.temp.name);self.source=self.directory/'input.pdf'
        tagged_fixture(self.source);inspect_tags(self.source,self.directory)
        self.structure=json.loads((self.directory/'report.json').read_text())

    def tearDown(self):self.temp.cleanup()

    def repair(self,changes,**kwargs):
        request={'digest':self.structure['digest'],'changes':changes,**kwargs}
        (self.directory/'settings.json').write_text(json.dumps(request));repair_tags(self.source,self.directory)

    def corrections(self):
        return [{'id':node['id'],**({'alt':'Blue rectangle showing a sample figure.'} if node['role']=='Figure' else {'scope':'Column'} if node['role']=='TH' else {'fieldLabel':'Your name'})} for node in self.structure['nodes'] if node['role'] in {'Figure','TH','Form'}]

    def test_repairs_preserve_pixels_streams_text_and_form(self):
        self.repair(self.corrections())
        with fitz.open(self.source) as before,fitz.open(self.directory/'output.pdf') as after:
            self.assertEqual(before[0].get_pixmap().samples,after[0].get_pixmap().samples)
            self.assertEqual(before[0].get_text(),after[0].get_text())
            self.assertEqual([before.xref_stream(x) for x in before[0].get_contents()],[after.xref_stream(x) for x in after[0].get_contents()])
            page=after[0];widget=list(page.widgets())[0];self.assertEqual(widget.field_label,'Your name')
            widget.field_value='Editable';widget.update()
            self.assertEqual(list(page.widgets())[0].field_value,'Editable')
        verapdf=os.getenv('MOINPDF_VERAPDF','/opt/moinpdf-tools/verapdf/verapdf')
        if Path(verapdf).is_file():
            result=subprocess.run([verapdf,'--format','xml','--flavour','ua1',str(self.directory/'output.pdf')],capture_output=True,timeout=90)
            self.assertIn(b'isCompliant="true"',result.stdout,result.stdout.decode()[-3000:])

    def test_unknown_node_digest_and_bad_permutation_rejected(self):
        with self.assertRaisesRegex(ValueError,'unbekannten'):self.repair([{'id':'n9000','alt':'Fake'}])
        with self.assertRaisesRegex(ValueError,'gehört nicht'):self.repair([],digest='0'*64)
        parent=next(n for n in self.structure['nodes'] if len(n['children'])>1)
        with self.assertRaisesRegex(ValueError,'genau einmal'):self.repair([{'id':parent['id'],'order':[parent['children'][0]]*len(parent['children'])}])
        with self.assertRaisesRegex(ValueError,'Zellenspanne'):self.repair([{'id':next(n['id'] for n in self.structure['nodes'] if n['role']=='TH'),'rowSpan':0}])
        self.assertFalse((self.directory/'output.pdf').exists())

    def test_child_order_is_persisted_without_changing_page(self):
        node=next(n for n in self.structure['nodes'] if n['role']=='Document');order=list(reversed(node['children']))
        self.repair([{'id':node['id'],'order':order}])
        inspect_tags(self.directory/'output.pdf',self.directory)
        updated=json.loads((self.directory/'report.json').read_text())
        parent=next(n for n in updated['nodes'] if n['role']=='Document')
        self.assertEqual(next(n for n in updated['nodes'] if n['id']==parent['children'][0])['role'],'Form')

    def test_untagged_input_is_not_falsely_labelled(self):
        with fitz.open() as pdf:
            pdf.new_page();pdf.save(self.directory/'untagged.pdf')
        with self.assertRaisesRegex(ValueError,'keinen vorhandenen Strukturbaum'):inspect_tags(self.directory/'untagged.pdf',self.directory)

if __name__=='__main__':unittest.main()
