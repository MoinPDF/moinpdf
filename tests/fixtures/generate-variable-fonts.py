"""CC0 synthetic variable fonts; run manually with fontTools to regenerate fixtures."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.designspaceLib import DesignSpaceDocument, AxisDescriptor, SourceDescriptor
from fontTools.varLib import build

ROOT = Path(__file__).parent

def master(weight, cff=False):
    advance = 600 if weight == 400 else 750
    fb = FontBuilder(1000, isTTF=not cff)
    fb.setupGlyphOrder(['.notdef', 'space', 'A'])
    fb.setupCharacterMap({32: 'space', 65: 'A'})
    glyphs = {}
    for name in ['.notdef', 'space', 'A']:
        pen = T2CharStringPen(advance, None) if cff else TTGlyphPen(None)
        if name == 'A':
            pen.moveTo((50, 0)); pen.lineTo((advance // 2, 700))
            if cff: pen.curveTo((advance - 180, 700), (advance - 100, 200), (advance - 50, 0))
            else: pen.lineTo((advance - 50, 0))
            pen.lineTo((advance - 150, 0)); pen.lineTo((advance // 2, 460))
            pen.lineTo((150, 0)); pen.closePath()
        glyphs[name] = pen.getCharString() if cff else pen.glyph()
    if cff:
        fb.setupCFF('MoinVariableSynthetic', {'FullName':'Moin Variable Synthetic','FamilyName':'Moin Variable Synthetic','Weight':'Regular'}, glyphs, {})
    else: fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({g: (advance if g != 'space' else 300, 50 if g == 'A' else 0) for g in glyphs})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({'familyName':'Moin Variable Synthetic','styleName':'Regular','uniqueFontIdentifier':f'MoinSynthetic{weight}', 'fullName':'Moin Variable Synthetic', 'psName':'MoinVariableSynthetic'})
    fb.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=800,usWinDescent=200,usWeightClass=weight)
    fb.setupPost()
    fb.setupMaxp()
    fb.font['head'].created = fb.font['head'].modified = 3786912000
    return fb.font

for cff, extension in [(False, 'ttf'), (True, 'otf')]:
    doc = DesignSpaceDocument()
    axis = AxisDescriptor(); axis.name='Weight'; axis.tag='wght'; axis.minimum=400; axis.default=400; axis.maximum=700; doc.addAxis(axis)
    for weight in (400,700):
        src=SourceDescriptor(); src.name=f'master{weight}'; src.location={'Weight':weight}; src.font=master(weight,cff)
        src.copyInfo = src.copyLib = src.copyFeatures = weight == 400
        doc.addSource(src)
    font, _, _ = build(doc)
    font.recalcTimestamp = False
    font.save(ROOT/f'editor-variable.{extension}')
