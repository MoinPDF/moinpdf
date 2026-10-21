"""Independently inspect the opt-in public PDF.js paper round-trip with MuPDF."""
from pathlib import Path
import zlib
import struct
import pymupdf

original = Path('.cache/editor-corpus/tracemonkey.pdf')
exported = Path('.cache/editor-preservation/public-paper-edited.pdf')
pymupdf.TOOLS.mupdf_warnings(reset=True)
with pymupdf.open(original) as before, pymupdf.open(exported) as after:
    assert len(before) == len(after) == 14
    text = after[0].get_text()
    assert 'Edited' in text and 'Abstract' not in text
    def span(page, value):
        matches = [s for b in page.get_text('dict')['blocks'] if 'lines' in b
                   for line in b['lines'] for s in line['spans'] if s['text'] == value]
        assert len(matches) == 1, matches
        return matches[0]
    original_span, edited_span = span(before[0], 'Abstract'), span(after[0], 'Edited')
    original_fonts = [f for f in before[0].get_fonts(full=True)
                      if f[3].split('+')[-1] == original_span['font']]
    fonts = [f for f in after[0].get_fonts(full=True)
             if f[3].split('+')[-1] == edited_span['font']]
    assert len(original_fonts) == len(fonts) == 1, (original_fonts, fonts)
    assert original_fonts[0][2] == 'Type1'
    assert edited_span['font'].startswith(original_span['font'] + '-'), edited_span
    assert not any('LiberationSerif' in f[3] for f in after[0].get_fonts(full=True))
    assert after.extract_font(fonts[0][0])[1] == 'ttf'
    original_font = pymupdf.Font(fontbuffer=before.extract_font(original_fonts[0][0])[3])
    # Embedded CID subsets need not contain a standalone Unicode cmap. Use the
    # independently decoded PDF glyph IDs and the actual TrueType advance table.
    font_bytes = after.extract_font(fonts[0][0])[3]
    tables = {font_bytes[12+i*16:16+i*16].decode('ascii'): struct.unpack_from('>II',font_bytes,20+i*16)
              for i in range(struct.unpack_from('>H',font_bytes,4)[0])}
    units = struct.unpack_from('>H',font_bytes,tables['head'][0]+18)[0]
    metrics = struct.unpack_from('>H',font_bytes,tables['hhea'][0]+34)[0]
    assert not pymupdf.TOOLS.mupdf_warnings(reset=True)
    before[0].get_texttrace()
    original_trace_warnings = pymupdf.TOOLS.mupdf_warnings(reset=True)
    traces = [s for s in after[0].get_texttrace() if ''.join(chr(c[0]) for c in s['chars']) == 'Edited']
    assert pymupdf.TOOLS.mupdf_warnings(reset=True) == original_trace_warnings, 'New warnings in edited glyph trace'
    assert len(traces) == 1 and traces[0]['font'] == edited_span['font']
    for code,glyph,*_ in traces[0]['chars']:
        assert original_font.has_glyph(code) and glyph > 0, chr(code)
        advance = struct.unpack_from('>H',font_bytes,tables['hmtx'][0]+4*min(glyph,metrics-1))[0]/units
        assert abs(original_font.glyph_advance(code) - advance) < .001, chr(code)
    assert abs(original_span['size'] - edited_span['size']) < .001
    assert max(abs(a-b) for a,b in zip(original_span['origin'], edited_span['origin'])) < .001
    assert original_span['color'] == edited_span['color']
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
print('PASS: independent text/font inspection, 13 unchanged pages pixel-identical, valid compressed streams, no new glyph-trace warnings and no render/readback warnings')
