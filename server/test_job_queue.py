import io
import tempfile
import threading
import time
import unittest
from pathlib import Path
from server.job_queue import JobQueue, QueueError, context


class QueueTests(unittest.TestCase):
    def test_idempotency_restart_authentication_and_expiry(self):
        with tempfile.TemporaryDirectory() as directory:
            handler = lambda item, root: ((root / 'input-0').read_bytes().upper(), 'application/pdf', {'Content-Disposition': 'attachment; filename="test.pdf"'})
            store = JobQueue(directory, handler, workers=0)
            ticket = 'a' * 64
            result = store.submit(ticket, '/v1/office', {}, [('file', 'test.docx', io.BytesIO(b'input'))])
            self.assertEqual(store.submit(ticket, '/v1/office', {}, [])['id'], result['id'])
            self.assertEqual(len(store.jobs), 1)
            with self.assertRaises(QueueError): store.status(result['id'], 'wrong')
            store.close()
            resumed = JobQueue(directory, handler)
            try:
                limit = time.monotonic() + 5
                while resumed.status(result['id'], ticket)['status'] != 'completed' and time.monotonic() < limit: time.sleep(.01)
                self.assertEqual(resumed.output(result['id'], ticket)[0], b'INPUT')
                self.assertFalse((Path(directory) / result['id'] / 'input-0').exists())
                resumed.jobs[result['id']]['expires'] = 0
                with self.assertRaises(QueueError): resumed.status(result['id'], ticket)
                self.assertFalse((Path(directory) / result['id']).exists())
            finally: resumed.close()

    def test_running_cancel_and_capacity(self):
        with tempfile.TemporaryDirectory() as directory:
            started = threading.Event()
            def handler(item, root):
                started.set()
                context.cancel.wait(3)
                return b'not-delivered', 'text/plain', {}
            store = JobQueue(directory, handler, workers=1, capacity=1)
            try:
                item = store.submit('b' * 64, '/v1/office', {}, [('file', 'test.docx', io.BytesIO(b'input'))])
                self.assertTrue(started.wait(2))
                with self.assertRaises(QueueError) as raised: store.submit('c' * 64, '/v1/office', {}, [])
                self.assertEqual(raised.exception.status, 429)
                store.cancel(item['id'], 'b' * 64)
                store.pending.join()
                self.assertEqual(store.status(item['id'], 'b' * 64)['status'], 'cancelled')
                with self.assertRaises(QueueError): store.output(item['id'], 'b' * 64)
                self.assertFalse((Path(directory) / item['id'] / 'input-0').exists())
            finally: store.close()

    def test_shutdown_keeps_input_for_resume(self):
        with tempfile.TemporaryDirectory() as directory:
            started = threading.Event()
            def handler(item, root):
                started.set(); context.cancel.wait(3)
                raise RuntimeError('interrupted')
            store = JobQueue(directory, handler, workers=1)
            item = store.submit('d' * 64, '/v1/office', {}, [('file', 'test.docx', io.BytesIO(b'input'))])
            self.assertTrue(started.wait(2)); store.close()
            self.assertEqual(store.jobs[item['id']]['status'], 'queued')
            self.assertTrue((Path(directory) / item['id'] / 'input-0').is_file())


if __name__ == '__main__': unittest.main()
