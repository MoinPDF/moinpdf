"""Independently inspect the opt-in public PDF.js paper round-trip with MuPDF."""
from pathlib import Path
import zlib
import pymupdf

original = Path('.cache/editor-corpus/tracemonkey.pdf')
exported = Path('.cache/editor-preservation/public-paper-edited.pdf')
pymupdf.TOOLS.mupdf_warnings(reset=True)
with pymupdf.open(original) as before, pymupdf.open(exported) as after:
    assert len(before) == len(after) == 14
    text = after[0].get_text()
    assert 'Edited' in text and 'Abstract' not in text
    fonts = [f for f in after[0].get_fonts(full=True) if 'LiberationSerif' in f[3]]
    assert len(fonts) == 1 and 'Bold' in fonts[0][3], fonts
    assert after.extract_font(fonts[0][0])[1] == 'ttf'
    for index in range(1, len(before)):
        pymupdf.TOOLS.store_shrink(100)
        a = before[index].get_pixmap()
        pymupdf.TOOLS.store_shrink(100)
        b = after[index].get_pixmap()
        assert (a.width, a.height, a.samples) == (b.width, b.height, b.samples), index + 1
        assert before[index].get_text() == after[index].get_text(), index + 1
    for xref in range(1, after.xref_length()):
        if after.xref_is_stream(xref) and after.xref_get_key(xref, 'Filter')[1] == '/FlateDecode':
            zlib.decompress(after.xref_stream_raw(xref))
    after[0].get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(exported.with_suffix('.png'))
warnings = pymupdf.TOOLS.mupdf_warnings()
assert not warnings, warnings
print('PASS: independent text/font inspection, 13 unchanged pages pixel-identical, valid compressed streams, no reader warnings')
