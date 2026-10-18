import io
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
# Configure the shared application before importing it, regardless of test order.
os.environ.setdefault('MOINPDF_ORIGINS', 'https://moinpdf.test')
from server.app import app, command, job
from server.job_queue import JobQueue


class BackgroundApiTests(unittest.TestCase):
    def test_ticket_isolation_and_real_process_cancellation(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'MOINPDF_API_KEY': 'synthetic-' + 'x' * 40}):
            started = threading.Event()
            marker = Path(directory) / 'must-not-exist'
            def convert(item, root):
                with job() as work:
                    started.set()
                    command([sys.executable, '-c', 'import time,pathlib;time.sleep(3);pathlib.Path(' + repr(str(marker)) + ').write_text("done")'], work)
                return b'output', 'application/pdf', {}
            store = JobQueue(Path(directory) / 'queue', convert)
            before = getattr(app.state, 'job_queue', None)
            app.state.job_queue = store
            client = TestClient(app)
            headers = {'Authorization': 'Bearer ' + os.environ['MOINPDF_API_KEY'], 'X-MoinPDF-Job-Ticket': 'a' * 64}
            try:
                response = client.post('/v1/jobs', headers=headers, data={'operation': '/v1/office'}, files={'file': ('test.docx', b'synthetic')})
                self.assertEqual(response.status_code, 200, response.text)
                jid = response.json()['id']
                self.assertTrue(started.wait(3))
                wrong = {**headers, 'X-MoinPDF-Job-Ticket': 'b' * 64}
                self.assertEqual(client.get(f'/v1/jobs/{jid}', headers=wrong).status_code, 404)
                self.assertEqual(client.get(f'/v1/jobs/{jid}/result', headers=headers).status_code, 409)
                self.assertEqual(client.post(f'/v1/jobs/{jid}/cancel', headers=headers).status_code, 200)
                store.pending.join()
                self.assertEqual(client.get(f'/v1/jobs/{jid}', headers=headers).json()['status'], 'cancelled')
                self.assertFalse(marker.exists())
                response = client.post('/v1/jobs', headers=headers, data={'operation': '/v1/signatures/sign'}, files={'file': ('test.pdf', b'pdf')})
                self.assertEqual(response.status_code, 422)
                self.assertEqual(client.post(f'/v1/jobs/{jid}/delete', headers=headers).status_code, 200)
                self.assertEqual(client.get(f'/v1/jobs/{jid}', headers=headers).status_code, 404)
            finally:
                client.close(); store.close(); app.state.job_queue = before


if __name__ == '__main__': unittest.main()
