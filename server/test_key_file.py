import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from server import app as service


class KeyFileTests(unittest.TestCase):
    def test_file_authentication_and_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'api-key'
            key = 'synthetic-file-key-' + 'x' * 40
            path.write_text(key + '\n')
            with patch.dict(os.environ, {'MOINPDF_API_KEY': '', 'MOINPDF_API_KEY_FILE': str(path)}):
                client = TestClient(service.app)
                self.assertEqual(client.get('/v1/capabilities').status_code, 401)
                self.assertEqual(client.get('/v1/capabilities', headers={'Authorization': 'Bearer wrong'}).status_code, 401)
                self.assertEqual(client.get('/v1/capabilities', headers={'Authorization': 'Bearer ' + key}).status_code, 200)
                path.unlink()
                self.assertEqual(client.get('/v1/capabilities', headers={'Authorization': 'Bearer ' + key}).status_code, 503)

    def test_explicit_environment_key_keeps_precedence(self):
        with patch.dict(os.environ, {'MOINPDF_API_KEY': 'synthetic-' + 40 * 'x', 'MOINPDF_API_KEY_FILE': '/missing'}):
            self.assertEqual(service.api_key(), os.environ['MOINPDF_API_KEY'])
