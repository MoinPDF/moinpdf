"""Additional formats. All native children remain in the service worker's process group."""
from __future__ import annotations
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import zipfile

MAX_OUTPUT = 80 * 1024 * 1024


def run(args, directory):
    environment = dict(os.environ)
    environment.update(CALIBRE_CONFIG_DIRECTORY=str(directory / 'calibre-config'),
                       CALIBRE_CACHE_DIRECTORY=str(directory / 'calibre-cache'),
                       CALIBRE_NO_DEFAULT_PROGRAMS='1', QT_QPA_PLATFORM='offscreen')
    try:
        # The caller already owns a disposable process group and its hard timeout.
        subprocess.run(args, cwd=directory, env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except FileNotFoundError:
        raise ValueError('Der benötigte Formatkonverter ist auf diesem Server nicht installiert.') from None
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise ValueError('Das Format konnte nicht konvertiert werden. Datei, DRM-Schutz und Serverkonverter prüfen.') from None


def bounded_output(path):
    if not path.is_file() or not 0 < path.stat().st_size <= MAX_OUTPUT:
        raise ValueError('Der Konverter hat keine gültige Ausgabe bis 80 MB erzeugt.')
    return path


def cbr_to_cbz(source, target):
    import libarchive
    from PIL import Image
    signature = source.read_bytes()[:8]
    if not (signature.startswith(b'Rar!\x1a\x07\x00') or signature == b'Rar!\x1a\x07\x01\x00'):
        raise ValueError('Die CBR-Datei enthält kein RAR-Archiv.')
    entries, names, size, pixels, count = [], set(), 0, 0, 0
    try:
        with libarchive.file_reader(str(source)) as archive:
            for entry in archive:
                count += 1
                name = entry.pathname
                if not isinstance(name, str): raise ValueError('Ungültiger Archivname.')
                path = PurePosixPath(name)
                if count > 1500 or name in names or path.is_absolute() or '..' in path.parts or '\\' in name or '\x00' in name or ':' in name:
                    raise ValueError('Das CBR-Archiv enthält unzulässige oder zu viele Einträge.')
                names.add(name)
                if entry.issym or entry.islnk: raise ValueError('Verknüpfungen im CBR-Archiv werden nicht unterstützt.')
                if entry.isdir: continue
                if not entry.isfile: raise ValueError('Unzulässiger CBR-Eintrag.')
                if entry.size is not None and (entry.size < 0 or entry.size > MAX_OUTPUT - size): raise ValueError('Das entpackte Comicarchiv überschreitet 80 MB.')
                data = bytearray()
                for block in entry.get_blocks():
                    size += len(block)
                    if size > MAX_OUTPUT: raise ValueError('Das entpackte Comicarchiv überschreitet 80 MB.')
                    data.extend(block)
                if path.name.lower() == 'comicinfo.xml' or path.name.startswith('.'): continue
                suffix = path.suffix.lower()
                if suffix not in {'.png', '.jpg', '.jpeg'}: raise ValueError('CBR unterstützt ausschließlich PNG- und JPEG-Seiten.')
                with Image.open(io.BytesIO(data)) as image:
                    pixels += image.width * image.height
                    if image.format not in {'PNG', 'JPEG'} or image.width * image.height > 30000000 or pixels > 200000000:
                        raise ValueError('Das Comicarchiv enthält zu große oder ungültige Bilder.')
                    image.verify()
                entries.append((name, suffix, bytes(data)))
                if len(entries) > 200: raise ValueError('Comicarchive dürfen höchstens 200 Bildseiten enthalten.')
    except ValueError:
        raise
    except Exception:
        raise ValueError('Das CBR-Archiv ist beschädigt, verschlüsselt oder nicht unterstützt.') from None
    if not entries: raise ValueError('Das Comicarchiv enthält keine Bildseiten.')
    entries.sort(key=lambda e: tuple((1, int(p)) if p.isdigit() else (0, p.casefold()) for p in re.split(r'(\d+)', e[0])))
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_STORED) as archive:
        for number, (_, suffix, data) in enumerate(entries, 1): archive.writestr(f'{number:04d}{suffix}', data)


def ebook(source, directory):
    if __package__:
        from . import recovery_documents
    else:
        import recovery_documents
    suffix = source.suffix.lower()
    if suffix == '.cbr':
        safe = directory / 'converted.cbz'
        cbr_to_cbz(source, safe)
    elif suffix in {'.mobi', '.azw3'}:
        # MOBI/KF8 share the Palm database BOOKMOBI signature. Calibre rejects DRM.
        if source.read_bytes()[60:68] != b'BOOKMOBI':
            raise ValueError('Die Datei enthält kein unterstütztes MOBI-/AZW3-E-Book.')
        safe = directory / 'converted.epub'
        run(['ebook-convert', str(source), str(safe)], directory)
        bounded_output(safe)
    else:
        safe = source
    recovery_documents.ebook(safe, directory)


def office_export(source, directory, fmt):
    if __package__:
        from . import convert_documents, extended_documents
    else:
        import convert_documents, extended_documents
    if fmt == 'odp':
        extended_documents.powerpoint(source, directory)
        intermediate, export_filter = directory / 'output.pptx', 'odp:impress8'
    else:
        convert_documents.word(source, directory)
        intermediate = directory / 'output.docx'
        export_filter = 'rtf:Rich Text Format' if fmt == 'rtf' else 'odt:writer8'
    executable = shutil.which('libreoffice') or shutil.which('soffice')
    if not executable: raise ValueError('LibreOffice ist auf dem Dokumentenserver nicht installiert.')
    profile = directory / 'format-profile' / 'user'; profile.mkdir(parents=True)
    (profile / 'registrymodifications.xcu').write_text('''<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>''')
    run([executable, f'-env:UserInstallation={profile.parent.as_uri()}', '--headless', '--nologo', '--nodefault', '--norestore', '--convert-to', export_filter, '--outdir', str(directory), str(intermediate)], directory)
    output = bounded_output(directory / ('output.' + fmt))
    if fmt == 'rtf':
        if not output.read_bytes().startswith(b'{\\rtf'): raise ValueError('Ungültige RTF-Ausgabe.')
    else:
        expected = 'application/vnd.oasis.opendocument.' + ('presentation' if fmt == 'odp' else 'text')
        with zipfile.ZipFile(output) as archive:
            if archive.read('mimetype').decode().strip() != expected or 'content.xml' not in archive.namelist():
                raise ValueError('Ungültige OpenDocument-Ausgabe.')


def azw3_export(source, directory):
    import pymupdf
    from html import escape
    parts, characters = [], 0
    with pymupdf.open(source) as pdf:
        for page in pdf:
            value = page.get_text(sort=True)
            characters += len(value)
            if characters > 2000000: raise ValueError('Der E-Book-Export überschreitet zwei Millionen Zeichen.')
            if not value.strip(): raise ValueError('Mindestens eine Seite enthält keinen auslesbaren Text. Bitte vor dem AZW3-Export OCR ausführen.')
            parts.append('<section><h2>' + str(page.number + 1) + '</h2>' + ''.join('<p>' + escape(p) + '</p>' for p in value.splitlines()) + '</section>')
    settings = json.loads((directory / 'settings.json').read_text())
    title = str(settings.get('title') or 'Dokument')[:200]
    language = settings.get('language', 'de')
    if language not in {'de', 'en', 'fr', 'es', 'it', 'nl', 'pl'}: raise ValueError('Ungültige E-Book-Sprache.')
    html = directory / 'book.html'
    html.write_text('<!doctype html><html lang="' + language + '"><head><meta charset="utf-8"><title>' + escape(title) + '</title></head><body><h1>' + escape(title) + '</h1>' + ''.join(parts) + '</body></html>')
    output = directory / 'output.azw3'
    run(['ebook-convert', str(html), str(output), '--input-encoding', 'utf-8', '--title', title, '--language', language], directory)
    bounded_output(output)
    if output.read_bytes()[60:68] != b'BOOKMOBI': raise ValueError('Ungültige AZW3-Ausgabe.')


def cbr_export(source, directory):
    import pymupdf
    executable = shutil.which('rar')
    if not executable: raise ValueError('CBR-Erstellung benötigt einen separat installierten und passend lizenzierten RAR-Konverter.')
    options = json.loads((directory / 'settings.json').read_text())
    dpi = options.get('dpi', 150); fmt = options.get('imageFormat', 'jpg')
    if dpi not in {72, 100, 150, 200, 300} or fmt not in {'png', 'jpg'}: raise ValueError('Ungültige Comic-Einstellungen.')
    images, size = [], 0
    with pymupdf.open(source) as pdf:
        for i, page in enumerate(pdf):
            if page.rect.width * page.rect.height * (dpi / 72) ** 2 > 16000000: raise ValueError('Eine Seite überschreitet 16 Megapixel. Bitte eine niedrigere Auflösung wählen.')
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(dpi / 72, dpi / 72), alpha=False)
            path = directory / f'{i+1:04d}.{fmt}'; pixmap.save(path)
            size += path.stat().st_size
            if size > MAX_OUTPUT: raise ValueError('Das Comicarchiv überschreitet 80 MB. Bitte die Auflösung verringern.')
            images.append(path.name)
    output = directory / 'output.cbr'
    run([executable, 'a', '-idq', '-ep', '-m0', str(output), *images], directory)
    bounded_output(output)
    if not output.read_bytes().startswith(b'Rar!\x1a\x07'): raise ValueError('Ungültige RAR-Ausgabe.')
    checked = directory / 'verified.cbz'
    cbr_to_cbz(output, checked)
    with zipfile.ZipFile(checked) as archive:
        if len(archive.namelist()) != len(images) or any(archive.read(name) != (directory / name).read_bytes() for name in images):
            raise ValueError('Ungültige RAR-Ausgabe.')
    checked.unlink()


def export_format(source, directory):
    import pymupdf
    with pymupdf.open(source) as pdf:
        if pdf.needs_pass or not 0 < len(pdf) <= 200:
            raise ValueError('Bitte eine unverschlüsselte PDF mit höchstens 200 Seiten verwenden.')
    options = json.loads((directory / 'settings.json').read_text())
    fmt = options.get('format')
    if fmt in {'rtf', 'odt', 'odp'}: office_export(source, directory, fmt)
    elif fmt == 'azw3': azw3_export(source, directory)
    elif fmt == 'cbr': cbr_export(source, directory)
    else: raise ValueError('Unbekanntes Ausgabeformat.')
