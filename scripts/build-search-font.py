"""Rebuild the outline-free font used only for invisible PDF search text.

Requires fonttools. No source font or third-party glyph outlines are used.
Unique glyph IDs preserve Unicode mappings even though all outlines are empty.
"""
from pathlib import Path
import unicodedata
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

root = Path(__file__).resolve().parents[1]
points = [n for n in range(0x20, 0x10000) if unicodedata.category(chr(n)) not in ('Cc', 'Cs', 'Cn')]
# Common supplementary symbols, emoji and historic alphabetic characters.
extra = [n for n in [*range(0x1F000, 0x20000), *range(0x10000, 0x1F000)] if unicodedata.category(chr(n)) not in ('Cc', 'Cs', 'Cn')]
points += extra[:65533 - len(points)]
names = ['.notdef'] + [f'u{point:X}' for point in points]
font = FontBuilder(1000, isTTF=True)
font.setupGlyphOrder(names)
font.setupCharacterMap(dict(zip(points, names[1:])))
pen = TTGlyphPen(None)
pen.moveTo((0, 0))
pen.lineTo((1, 0))
pen.closePath()
# A zero-area contour keeps the required glyf table present after subsetting.
glyph = pen.glyph()
font.setupGlyf({name: glyph for name in names})
font.setupHorizontalMetrics({name: (600, 0) for name in names})
font.setupHorizontalHeader(ascent=850, descent=-150)
font.setupNameTable({'familyName':'MoinPDF Search', 'styleName':'Regular', 'uniqueFontIdentifier':'MoinPDFSearch-Regular-1', 'fullName':'MoinPDF Search Regular', 'psName':'MoinPDFSearch-Regular', 'version':'Version 1.0'})
font.setupOS2(sTypoAscender=850, sTypoDescender=-150, usWinAscent=850, usWinDescent=150)
font.setupPost(keepGlyphNames=False)
font.setupMaxp()
font.font['head'].created = font.font['head'].modified = 3875126400
font.save(root / 'public/vendor/editor-fonts/MoinPDFSearch-Regular.ttf')
print(f'Built outline-free search font: {len(points)} Unicode mappings.')
