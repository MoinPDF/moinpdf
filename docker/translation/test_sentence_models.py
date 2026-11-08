import hashlib
import io
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from sentence_models import ensure_sentence_models


class SentenceModelTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.cache = Path(self.folder.name)
        self.data = b'fictional pinned sentence model'
        self.spec = {'url': 'https://github.com/example/models/releases/download/v1/de.onnx',
                     'fallback_url': 'https://api.github.com/repos/example/models/releases/assets/123',
                     'sha256': hashlib.sha256(self.data).hexdigest(), 'size': len(self.data)}
        self.models = {'de': self.spec}

    def error(self, status):
        return urllib.error.HTTPError(self.spec['url'], status, 'synthetic failure', {}, None)

    def install(self):
        ensure_sentence_models({'de'}, self.cache, self.models)

    def test_gateway_error_uses_pinned_api_asset(self):
        with patch('sentence_models.urllib.request.urlopen', side_effect=[self.error(504), io.BytesIO(self.data)]) as fetch:
            self.install()
        self.assertEqual((self.cache / 'de.onnx').read_bytes(), self.data)
        self.assertEqual(fetch.call_count, 2)
        self.assertEqual(fetch.call_args.args[0].full_url, self.spec['fallback_url'])
        self.assertEqual(fetch.call_args.args[0].get_header('Accept'), 'application/octet-stream')
        self.assertEqual(list(self.cache.glob('*.tmp')), [])

    def test_verified_persistent_cache_needs_no_network(self):
        (self.cache / 'de.onnx').write_bytes(self.data)
        with patch('sentence_models.urllib.request.urlopen', side_effect=AssertionError('Unexpected network')):
            self.install()

    def test_corrupt_cache_is_replaced_only_after_verification(self):
        (self.cache / 'de.onnx').write_bytes(b'old invalid bytes')
        with patch('sentence_models.urllib.request.urlopen', return_value=io.BytesIO(self.data)):
            self.install()
        self.assertEqual((self.cache / 'de.onnx').read_bytes(), self.data)

    def test_corrupt_download_does_not_replace_cache_or_try_another_source(self):
        (self.cache / 'de.onnx').write_bytes(b'old invalid bytes')
        with patch('sentence_models.urllib.request.urlopen', return_value=io.BytesIO(b'bad')) as fetch:
            with self.assertRaisesRegex(ValueError, 'mismatch'):
                self.install()
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual((self.cache / 'de.onnx').read_bytes(), b'old invalid bytes')
        self.assertEqual(list(self.cache.glob('*.tmp')), [])

    def test_bad_fallback_cannot_create_a_model(self):
        with patch('sentence_models.urllib.request.urlopen', side_effect=[self.error(504), io.BytesIO(b'bad')]):
            with self.assertRaisesRegex(ValueError, 'mismatch'):
                self.install()
        self.assertFalse((self.cache / 'de.onnx').exists())

    def test_access_or_missing_asset_error_is_not_retried(self):
        for status in [403, 404]:
            with self.subTest(status=status), patch('sentence_models.urllib.request.urlopen', side_effect=self.error(status)) as fetch:
                with self.assertRaises(urllib.error.HTTPError):
                    self.install()
                self.assertEqual(fetch.call_count, 1)

    def test_failed_fallback_is_not_silently_accepted(self):
        with patch('sentence_models.urllib.request.urlopen', side_effect=self.error(504)) as fetch:
            with self.assertRaises(urllib.error.HTTPError):
                self.install()
        self.assertEqual(fetch.call_count, 2)

    def test_other_languages_remain_managed_by_upstream(self):
        with patch('sentence_models.urllib.request.urlopen', side_effect=AssertionError('Unexpected network')):
            ensure_sentence_models({'ja'}, self.cache, self.models)
        self.assertEqual(list(self.cache.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
