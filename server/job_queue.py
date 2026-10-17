"""Bounded, restartable conversion queue. No credentials or signing jobs are stored."""
from __future__ import annotations
import hashlib
import hmac
import json
import os
from pathlib import Path
import queue
import re
import shutil
import threading
import time

context = threading.local()
TERMINAL = {'completed', 'failed', 'cancelled'}


class QueueError(Exception):
    def __init__(self, status, detail):
        self.status, self.detail = status, detail
        super().__init__(detail)


class JobQueue:
    def __init__(self, root, handler, workers=2, ttl=86400, capacity=16, max_bytes=1024**3):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.handler, self.ttl, self.capacity, self.max_bytes = handler, ttl, capacity, max_bytes
        self.lock = threading.RLock()
        self.jobs, self.events = {}, {}
        self.pending = queue.Queue()
        self.stopping = threading.Event()
        for path in sorted(self.root.glob('*/job.json')):
            try:
                item = json.loads(path.read_text())
                if item['expires'] <= time.time():
                    shutil.rmtree(path.parent)
                    continue
                if item['status'] not in TERMINAL:
                    item['status'] = 'queued'
                    self._save(item)
                self.jobs[item['id']] = item
                self.events[item['id']] = threading.Event()
                if item['status'] == 'queued': self.pending.put(item['id'])
            except (OSError, ValueError, KeyError):
                shutil.rmtree(path.parent, ignore_errors=True)
        # Incomplete uploads never receive an acknowledgement and can be retried.
        for path in self.root.iterdir():
            if path.is_dir() and not (path / 'job.json').exists(): shutil.rmtree(path, ignore_errors=True)
        self.threads = [threading.Thread(target=self._work, daemon=True) for _ in range(workers)]
        for thread in self.threads: thread.start()

    def _save(self, item):
        path = self.root / item['id'] / 'job.json'
        temporary = path.with_suffix('.tmp')
        with temporary.open('w') as stream:
            json.dump(item, stream)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)

    def _clean(self):
        for jid, item in list(self.jobs.items()):
            if item['expires'] <= time.time() and item['status'] in TERMINAL:
                shutil.rmtree(self.root / jid, ignore_errors=True)
                del self.jobs[jid]
                self.events.pop(jid, None)

    def _usage(self):
        return sum(p.stat().st_size for p in self.root.rglob('*') if p.is_file())

    def submit(self, ticket, operation, fields, uploads):
        if not re.fullmatch(r'[a-f0-9]{64}', ticket): raise QueueError(422, 'Ungültiges Auftragsticket.')
        digest = hashlib.sha256(ticket.encode()).hexdigest()
        jid = ticket[:32]
        with self.lock:
            self._clean()
            if jid in self.jobs: return self.status(jid, ticket)
            if sum(i['status'] not in TERMINAL for i in self.jobs.values()) >= self.capacity:
                raise QueueError(429, 'Die Warteschlange ist voll. Bitte später erneut versuchen.')
            usage, size = self._usage(), 0
            directory = self.root / jid
            directory.mkdir(mode=0o700)
            try:
                files = {}
                for index, (key, name, stream) in enumerate(uploads):
                    target = directory / f'input-{index}'
                    with target.open('wb') as output:
                        while data := stream.read(1024 * 1024):
                            size += len(data)
                            if size > 80 * 1024**2: raise QueueError(413, 'Dateien dürfen zusammen höchstens 80 MB groß sein.')
                            if usage + size + 160 * 1024**2 > self.max_bytes: raise QueueError(507, 'Der Auftragsspeicher ist voll. Bitte fertige Aufträge löschen.')
                            output.write(data)
                        output.flush()
                        os.fsync(output.fileno())
                    files[key] = {'path': target.name, 'name': str(name or 'Datei')[:250]}
                now = time.time()
                item = {'id': jid, 'ticket_hash': digest, 'operation': operation, 'fields': fields, 'files': files, 'created': now, 'expires': now + self.ttl, 'status': 'queued'}
                self._save(item)
                self.jobs[jid] = item
                self.events[jid] = threading.Event()
                self.pending.put(jid)
                return self.status(jid, ticket)
            except BaseException:
                shutil.rmtree(directory, ignore_errors=True)
                raise

    def _find(self, jid, ticket):
        item = self.jobs.get(jid)
        if not item or not hmac.compare_digest(item['ticket_hash'], hashlib.sha256(ticket.encode()).hexdigest()):
            raise QueueError(404, 'Auftrag nicht gefunden oder abgelaufen.')
        return item

    def status(self, jid, ticket):
        with self.lock:
            self._clean()
            item = self._find(jid, ticket)
            return {key: item[key] for key in ['id', 'operation', 'created', 'expires', 'status', 'error', 'filename'] if key in item}

    def cancel(self, jid, ticket, delete=False):
        with self.lock:
            item = self._find(jid, ticket)
            self.events[jid].set()
            if delete: item['delete_requested'] = True
            if item['status'] != 'running':
                if delete:
                    shutil.rmtree(self.root / jid, ignore_errors=True)
                    del self.jobs[jid]
                    self.events.pop(jid, None)
                    return {'status': 'deleted'}
                if item['status'] not in TERMINAL:
                    item['status'] = 'cancelled'
                    self._save(item)
                    self._remove_inputs(item)
            return self.status(jid, ticket)

    def output(self, jid, ticket):
        with self.lock:
            self._clean()
            item = self._find(jid, ticket)
            if item['status'] != 'completed': raise QueueError(409, 'Der Auftrag ist noch nicht fertig.')
            return (self.root / jid / 'output').read_bytes(), item['media'], item['headers']

    def _remove_inputs(self, item):
        for value in item['files'].values(): (self.root / item['id'] / value['path']).unlink(missing_ok=True)

    def _work(self):
        while not self.stopping.is_set():
            try: jid = self.pending.get(timeout=1)
            except queue.Empty:
                with self.lock: self._clean()
                continue
            try:
                with self.lock:
                    item = self.jobs.get(jid)
                    if not item or item['status'] != 'queued': continue
                    event = self.events[jid]
                    item['status'] = 'running'
                    self._save(item)
                context.cancel = event
                context.deadline = time.monotonic() + 900
                data, media, headers = self.handler(item, self.root / jid)
                if len(data) > 160 * 1024**2: raise QueueError(413, 'Das Ergebnis überschreitet 160 MB.')
                with self.lock:
                    if self.stopping.is_set(): item['status'] = 'queued'
                    elif event.is_set(): item['status'] = 'cancelled'
                    else:
                        if self._usage() + len(data) > self.max_bytes: raise QueueError(507, 'Der Auftragsspeicher ist voll. Bitte fertige Ergebnisse löschen.')
                        target = self.root / jid / 'output'
                        with target.open('wb') as stream:
                            stream.write(data)
                            stream.flush()
                            os.fsync(stream.fileno())
                        item.update(status='completed', media=media, headers=headers)
                    self._save(item)
                    if item['status'] != 'queued': self._remove_inputs(item)
            except Exception as error:
                with self.lock:
                    item['status'] = 'queued' if self.stopping.is_set() else 'cancelled' if self.events[jid].is_set() else 'failed'
                    item['error'] = getattr(error, 'detail', 'Die Verarbeitung ist fehlgeschlagen. Bitte die Datei und Einstellungen prüfen.')
                    self._save(item)
                    if item['status'] != 'queued': self._remove_inputs(item)
            finally:
                with self.lock:
                    if item and item.get('delete_requested'):
                        shutil.rmtree(self.root / jid, ignore_errors=True)
                        self.jobs.pop(jid, None)
                        self.events.pop(jid, None)
                context.__dict__.clear()
                self.pending.task_done()

    def close(self):
        self.stopping.set()
        for event in self.events.values(): event.set()
        for thread in self.threads: thread.join(timeout=2)
