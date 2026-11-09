"""Opt-in local input folders. Originals stay in inbox; receipts make restarts idempotent."""
from __future__ import annotations
import fcntl
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import stat
import tempfile
import threading
import time
import uuid

if __package__:
    from .watch_pipeline import validate_workflow
else:
    from watch_pipeline import validate_workflow

MAX_BYTES = 80 * 1024 * 1024
logger = logging.getLogger('moinpdf.watch')


def read_regular(path, limit):
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode) or not 0 < before.st_size <= limit:
            raise ValueError('Die Datei ist leer, zu groß oder keine reguläre Datei.')
        data = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
        if len(data) > limit or (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise ValueError('Die Datei wird noch geschrieben.')
        return data


def directory(path):
    if path.is_symlink() or not path.is_dir():
        raise ValueError('Eingangsordner müssen echte Verzeichnisse sein.')
    return path


def atomic_write(path, data):
    directory(path.parent)
    temporary = path.with_name('.' + uuid.uuid4().hex + '.part')
    try:
        with temporary.open('xb') as stream:
            os.chmod(temporary, 0o600)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class WatchFolders:
    def __init__(self, root, processor, stable_seconds=5):
        self.root = directory(Path(root))
        self.processor = processor
        self.stable_seconds = stable_seconds
        self.observed = {}
        self.completed = {}
        self.stop = threading.Event()
        self.thread = None
        self.lock = None

    def start(self):
        self.lock = os.open(self.root / '.watch.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            os.close(self.lock)
            self.lock = None
            raise ValueError('Dieser Eingangsordner wird bereits überwacht.') from None
        self.thread = threading.Thread(target=self._run, name='moinpdf-input-folders', daemon=True)
        self.thread.start()
        return self

    def close(self):
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=5)

    def _run(self):
        try:
            while not self.stop.is_set():
                try:
                    self.scan()
                except Exception:
                    logger.warning('Eingangsordner konnten nicht geprüft werden; Verzeichnis und Rechte prüfen.')
                self.stop.wait(2)
        finally:
            os.close(self.lock)
            self.lock = None

    def scan(self):
        now = time.monotonic()
        seen = set()
        for profile in sorted(directory(self.root).iterdir()):
            if self.stop.is_set():
                break
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', profile.name) or profile.is_symlink() or not profile.is_dir():
                continue
            try:
                configuration = read_regular(profile / 'workflow.json', 100000)
                workflow = validate_workflow(json.loads(configuration))
                configuration = json.dumps(workflow, sort_keys=True).encode()
                inbox = directory(profile / 'inbox')
                output, status_folder = profile / 'output', profile / 'status'
                for folder in (output, status_folder):
                    folder.mkdir(exist_ok=True, mode=0o700)
                    directory(folder)
                (profile / 'configuration-error.json').unlink(missing_ok=True)
            except Exception:
                try:
                    atomic_write(profile / 'configuration-error.json', json.dumps({'status': 'error', 'detail': 'Ablauf oder Verzeichnis ungültig. workflow.json, unterstützte Schritte, inbox und Dateirechte prüfen.'}).encode())
                except OSError:
                    logger.warning('Fehlerbericht nicht schreibbar; Profilrechte prüfen. Andere Profile werden weiterverarbeitet.')
                continue
            for source in sorted(inbox.iterdir()):
                if self.stop.is_set():
                    break
                if source.suffix.lower() != '.pdf' or source.is_symlink():
                    continue
                try:
                    info = source.stat()
                except OSError:
                    continue
                if not stat.S_ISREG(info.st_mode):
                    continue
                seen.add(source)
                snapshot = (info.st_size, info.st_mtime_ns, info.st_ino)
                old = self.observed.get(source)
                if old is None or old[0] != snapshot:
                    self.observed[source] = (snapshot, now)
                    continue
                if now - old[1] < self.stable_seconds:
                    continue
                cached = self.completed.get(source)
                if cached and cached[:2] == (snapshot, configuration) and cached[2].is_file():
                    continue
                # Oversized files receive one persistent error receipt, without reading them.
                read_error = None
                try:
                    data = read_regular(source, MAX_BYTES) if 0 < info.st_size <= MAX_BYTES else None
                except ValueError:
                    # A producer changed the file after the stability check. Start over.
                    self.observed.pop(source, None)
                    continue
                except OSError:
                    data = None
                    read_error = 'Die Eingabedatei konnte nicht gelesen werden. Dateirechte prüfen.'
                digest = hashlib.sha256(configuration + source.name.encode() + (data if data is not None else repr(snapshot).encode())).hexdigest()
                stem = re.sub(r'[^\w.-]', '_', source.stem)[:80] or 'Dokument'
                name = f'{stem}-{digest[:16]}'
                receipt = status_folder / (name + '.json')
                if receipt.exists() or receipt.is_symlink():
                    self.completed[source] = (snapshot, configuration, receipt)
                    continue
                report = {'id': digest, 'source': source.name, 'workflow': workflow['name'], 'time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
                try:
                    if data is None:
                        raise ValueError(read_error or 'PDF-Dateien müssen zwischen 1 Byte und 80 MB groß sein.')
                    with tempfile.TemporaryDirectory(prefix='moinpdf-watch-') as temporary:
                        workspace = Path(temporary)
                        copied = workspace / 'input.pdf'
                        copied.write_bytes(data)
                        (workspace / 'workflow.json').write_bytes(configuration)
                        (workspace / 'source-name.txt').write_text(source.name)
                        pdf, details = self.processor(copied, workspace, self.stop)
                        items=[('',name+'.pdf',pdf)] if isinstance(pdf,bytes) else pdf
                        if not isinstance(items,list) or not 1<=len(items)<=200:raise ValueError('Ungültige Ergebnisdateien.')
                        total=0;prepared=[];written=[]
                        for i,item in enumerate(items,1):
                            if not isinstance(item,(list,tuple)) or len(item)!=3:raise ValueError('Ungültige Ergebnisdatei.')
                            folder,filename,data=item
                            if not isinstance(folder,str) or folder and not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',folder) or not isinstance(filename,str) or filename!=Path(filename).name or '..' in filename or not filename.lower().endswith('.pdf') or not isinstance(data,bytes) or not data.startswith(b'%PDF-') or not 0<len(data)<=MAX_BYTES:raise ValueError('Ungültiger Ergebnispfad oder PDF-Inhalt.')
                            total+=len(data)
                            if total>MAX_BYTES:raise ValueError('Die Gesamtausgabe überschreitet 80 MB.')
                            parent=output/folder if folder else output
                            parent.mkdir(exist_ok=True,mode=0o700);directory(parent)
                            target=parent/(f'{Path(filename).stem}-{digest[:16]}-{i:03d}.pdf' if folder else filename)
                            if target.exists() or target.is_symlink():raise ValueError('Die Ergebnisdatei existiert bereits.')
                            prepared.append((target,data))
                        try:
                            for target,data in prepared:atomic_write(target,data);written.append(target)
                        except Exception:
                            for target in written:target.unlink(missing_ok=True)
                            raise
                        report.update(**details)
                        report.update(status='done',result=[str(p.relative_to(output)) for p in written] if not isinstance(pdf,bytes) else name+'.pdf')
                except Exception as error:
                    if self.stop.is_set():
                        return
                    # Only controlled worker errors are reported, never a traceback or secrets.
                    detail = str(error) if isinstance(error, ValueError) else 'Verarbeitung fehlgeschlagen. PDF, Ablauf und Serverausstattung prüfen.'
                    report.update(status='error', detail=detail[:500])
                try:
                    atomic_write(receipt, json.dumps(report, ensure_ascii=False, indent=2).encode())
                except OSError:
                    logger.warning('Auftragsbericht nicht schreibbar; Profil pausiert bis zum nächsten Durchlauf. Andere Profile werden weiterverarbeitet.')
                    break
                self.completed[source] = (snapshot, configuration, receipt)
        self.observed = {path: value for path, value in self.observed.items() if path in seen}
        self.completed = {path: value for path, value in self.completed.items() if path in seen}
