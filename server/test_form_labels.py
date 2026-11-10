"""Fictional native and scanned forms; inspect reopened PDFs and rendered pages."""
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import pymupdf as fitz
from form_labels import assign_labels
from extended_documents import form_detect

class FormLabelTests(unittest.TestCase):
    def test_ambiguity_and_low_confidence_remain_unassigned(self):
        word=(fitz.Rect(20,40,65,52),'Vorname',100)
        self.assertEqual(assign_labels([fitz.Rect(90,37,240,57)],[word])[0]['name'],'Vorname')
        self.assertEqual(assign_labels([fitz.Rect(90,37,240,57)],[(word[0],word[1],30)]),[None])
        self.assertEqual(assign_labels([fitz.Rect(90,37,240,57),fitz.Rect(92,37,242,57)],[word]),[None,None])
        qualified=[(fitz.Rect(20,40,65,52),'Vorname',100),(fitz.Rect(69,40,90,52),'Kind',100)]
        self.assertEqual(assign_labels([fitz.Rect(110,37,240,57)],qualified),[None])

    def test_repeated_person_labels_require_manual_assignment(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp);doc=fitz.open()
            for _ in range(2):
                page=doc.new_page();page.insert_text((30,60),'Vorname:',fontsize=13);page.draw_rect((140,43,350,65))
            doc.save(directory/'input.pdf');doc.close();form_detect(directory/'input.pdf',directory)
            with fitz.open(directory/'output.pdf') as result:
                fields=[w.field_name for page in result for w in page.widgets()]
                self.assertEqual(len(fields),2);self.assertTrue(all(name.startswith('Erkannt_') for name in fields))

    def test_native_scan_rotations_and_existing_values(self):
        for scan in (False,True):
            for rotation in (0,90,180,270):
                with self.subTest(scan=scan,rotation=rotation), tempfile.TemporaryDirectory() as tmp:
                    directory=Path(tmp);doc=fitz.open();page=doc.new_page(width=420,height=540)
                    page.insert_text((30,60),'Vorname:',fontsize=13);page.draw_rect((140,43,350,65))
                    page.insert_text((30,110),'Nachname:',fontsize=13);page.draw_rect((140,93,350,115))
                    page.insert_text((30,160),'Ort:',fontsize=13);page.draw_rect((140,143,350,165))
                    page.insert_text((145,159),'Bremen',fontsize=11)
                    page.insert_text((30,210),'Unklar:',fontsize=13);page.draw_rect((140,193,350,215))
                    if scan:
                        pixels=page.get_pixmap(dpi=200).tobytes('png');doc.close();doc=fitz.open();page=doc.new_page(width=420,height=540);page.insert_image(page.rect,stream=pixels)
                    widget=fitz.Widget();widget.field_name='Bestehend';widget.field_type=fitz.PDF_WIDGET_TYPE_TEXT;widget.rect=fitz.Rect(140,260,350,282);widget.field_value='Unverändert';page.add_widget(widget)
                    page.set_rotation(rotation);before=page.get_pixmap().samples;doc.save(directory/'input.pdf');doc.close()
                    form_detect(directory/'input.pdf',directory)
                    with fitz.open(directory/'output.pdf') as result:
                        output_page=result[0]
                        fields={w.field_name:w for w in output_page.widgets()}
                        self.assertIn('Vorname',fields);self.assertIn('Nachname',fields)
                        self.assertEqual(fields['Bestehend'].field_value,'Unverändert')
                        self.assertNotIn('Ort',fields,'Printed value is not overwritten')
                        self.assertTrue(any(name.startswith('Erkannt_') for name in fields))
                        self.assertEqual(result[0].get_pixmap().samples,before,'Empty field detection preserves original appearance')
                        fields['Vorname'].field_value='Erika';fields['Vorname'].update();saved=result.tobytes()
                    with fitz.open(stream=saved,filetype='pdf') as result:
                        self.assertEqual(next(w for w in result[0].widgets() if w.field_name=='Vorname').field_value,'Erika')

if __name__=='__main__':unittest.main()
