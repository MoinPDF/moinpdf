"""Bounded document transformations run inside the isolated conversion worker."""
from __future__ import annotations
import io
import json
import math
import posixpath
import re
import zipfile
from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit

import pymupdf as fitz
from defusedxml import ElementTree as SafeET
from xml.etree import ElementTree as ET
from PIL import Image

from extended_documents import open_pdf, settings


def number(value, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError('Ungültige Zahlenangabe für dieses Werkzeug.')
    return value


def optimize(source, directory):
    options = settings(directory)
    target = int(number(options.get('targetMB', 2), .05, 80) * 1024 * 1024)
    mode = options.get('optimizeMode', 'images')
    if mode not in {'images', 'lossless'}:
        raise ValueError('Unbekannte Komprimierungseinstellung.')
    original = source.read_bytes()
    best = original
    with open_pdf(source) as document:
        original_pages = len(document)
    attempts = [(None, None)]
    if mode == 'images':
        attempts += [(200, 85), (150, 75), (110, 60), (72, 45)]
    selected = 'Original'
    if len(original) > target:
        for dpi, quality in attempts:
            # Every variant starts from the original, avoiding accumulated JPEG loss.
            with open_pdf(source) as document:
                if dpi:
                    document.rewrite_images(dpi_threshold=int(dpi * 1.2), dpi_target=dpi, quality=quality, bitonal=False)
                candidate = document.tobytes(garbage=4, deflate=True, use_objstms=1)
            with fitz.open(stream=candidate, filetype='pdf') as checked:
                if len(checked) != original_pages:
                    raise ValueError('Die Seitenzahl hat sich unerwartet geändert; keine Ausgabe erstellt.')
            if len(candidate) < len(best):
                best = candidate
                selected = f'Bilder: {dpi} dpi, JPEG-Qualität {quality}' if dpi else 'Verlustfrei'
            if len(best) <= target:
                break
    changed = best is not original
    note = ('Zielgröße erreicht. ' if len(best) <= target else 'Zielgröße nicht erreicht; kleinste gefundene Variante. ')
    note += f'{len(best)} Bytes, {round((1-len(best)/len(original))*100)} % kleiner. {selected}. '
    note += 'Text, Links und Formularfelder bleiben erhalten; digitale Signaturen werden ungültig.' if changed else 'Das Original bleibt unverändert.'
    (directory / 'output.pdf').write_bytes(best)
    (directory / 'result-note.json').write_text(json.dumps({'note': note, 'targetReached': len(best) <= target, 'bytes': len(best)}))


def safe_resource(value, member=''):
    value = unquote(value).strip()
    parts = urlsplit(value)
    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(member), parts.path))
    return not (parts.scheme or parts.netloc or value.startswith(('/', '\\')) or '\\' in value or '\x00' in value or resolved == '..' or resolved.startswith('../'))


def sanitized_epub(source, target):
    """No extraction to disk; enforce expansion limits and remove active/external content."""
    if source.stat().st_size > 40 * 1024 * 1024:
        raise ValueError('EPUB-Dateien dürfen höchstens 40 MB groß sein.')
    try:
        with zipfile.ZipFile(source) as incoming, zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as output:
            entries = incoming.infolist()
            if len(entries) > 1500 or sum(e.file_size for e in entries) > 80 * 1024 * 1024:
                raise ValueError('Das entpackte E-Book ist zu groß (höchstens 80 MB und 1500 Einträge).')
            names = [e.filename for e in entries]
            if len(set(names)) != len(names):
                raise ValueError('Das E-Book enthält doppelte Dateinamen.')
            for e in entries:
                path = PurePosixPath(e.filename)
                if path.is_absolute() or '..' in path.parts or '\\' in e.filename or '\x00' in e.filename or e.flag_bits & 1:
                    raise ValueError('Das E-Book enthält unzulässige oder verschlüsselte Einträge.')
            if incoming.read('mimetype').strip() != b'application/epub+zip':
                raise ValueError('Die Datei ist kein gültiges EPUB.')
            if 'META-INF/encryption.xml' in names:
                raise ValueError('EPUBs mit verschlüsselten Inhalten oder geschützten Schriftdateien werden nicht unterstützt.')
            container = SafeET.fromstring(incoming.read('META-INF/container.xml'))
            roots = [n.get('full-path', '') for n in container.iter() if n.tag.split('}')[-1] == 'rootfile']
            if not roots or any(root not in names for root in roots):
                raise ValueError('Die EPUB-Buchbeschreibung fehlt.')
            for entry in entries:
                if entry.is_dir():
                    continue
                data = incoming.read(entry)
                suffix = PurePosixPath(entry.filename).suffix.lower()
                if suffix in {'.js', '.mjs'}:
                    continue
                if suffix in {'.xhtml', '.html', '.htm', '.opf', '.svg', '.ncx', '.xml'}:
                    if len(data) > 8 * 1024 * 1024:
                        raise ValueError('Ein E-Book-Textabschnitt ist zu groß.')
                    root = SafeET.fromstring(data)
                    for parent in root.iter():
                        for child in list(parent):
                            if child.tag.split('}')[-1].lower() in {'script', 'iframe', 'object', 'embed', 'audio', 'video', 'base'}:
                                parent.remove(child)
                        for key, value in list(parent.attrib.items()):
                            local = key.split('}')[-1].lower()
                            if local.startswith('on') or local == 'srcset' or local in {'src', 'href', 'poster', 'data', 'base'} and not safe_resource(value, entry.filename):
                                del parent.attrib[key]
                            if local == 'style':
                                parent.attrib[key] = re.sub(r'url\s*\([^)]*\)', 'none', value, flags=re.I)
                        if parent.tag.split('}')[-1].lower() == 'style' and parent.text:
                            parent.text = re.sub(r'@import[^;]*;|url\s*\([^)]*\)', '', parent.text, flags=re.I)
                    data = ET.tostring(root, encoding='utf-8', xml_declaration=True)
                elif suffix == '.css':
                    data = re.sub(r'@import[^;]*;|url\s*\([^)]*\)', '', data.decode('utf-8', errors='replace'), flags=re.I).encode()
                elif suffix in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}:
                    with Image.open(io.BytesIO(data)) as image:
                        if image.width * image.height > 30000000:
                            raise ValueError('Ein eingebettetes Bild überschreitet 30 Megapixel.')
                output.writestr(entry.filename, data, compress_type=zipfile.ZIP_STORED if entry.filename == 'mimetype' else zipfile.ZIP_DEFLATED)
    except ValueError:
        raise
    except Exception as error:
        raise ValueError('Die EPUB-Datei ist beschädigt oder enthält nicht unterstützte Inhalte.') from error


def ebook(source, directory):
    options = settings(directory)
    font_size = number(options.get('fontSize', 12), 8, 24)
    paper = options.get('paper', 'a4')
    if paper not in {'a4', 'a5'}:
        raise ValueError('Bitte A4 oder A5 als Seitenformat auswählen.')
    safe = directory / 'book.epub'
    sanitized_epub(source, safe)
    try:
        with fitz.open(safe) as book:
            if book.needs_pass or not book.is_reflowable:
                raise ValueError('Bitte ein ungeschütztes EPUB-E-Book auswählen.')
            width, height = (595, 842) if paper == 'a4' else (420, 595)
            book.layout(width=width, height=height, fontsize=font_size)
            if not 0 < len(book) <= 200:
                raise ValueError('Das E-Book ergibt mehr als 200 Seiten oder enthält keine lesbaren Seiten.')
            data = book.convert_to_pdf()
            with fitz.open(stream=data, filetype='pdf') as pdf:
                pdf.set_metadata({key: value for key, value in book.metadata.items() if key in {'title', 'author', 'subject', 'keywords'} and value})
                pdf.save(directory / 'output.pdf', garbage=4, deflate=True)
    except ValueError:
        raise
    except Exception as error:
        raise ValueError('Das E-Book konnte nicht als PDF gesetzt werden.') from error
