"""First-run model downloads must not make the rest of the server unusable."""
import io
import json
import os
import unittest
from unittest.mock import patch

from server.app import translation_status


class TranslationReadinessTests(unittest.TestCase):
    def test_unconfigured_translation(self):
        with patch.dict(os.environ, {"MOINPDF_TRANSLATE_URL": ""}):
            self.assertEqual(translation_status(), "disabled")

    def test_download_then_full_language_set(self):
        codes = ["de", "en", "fr", "es", "it", "nl", "pl"]
        partial = [{"code": "en", "targets": ["en", "de"]}]
        full = [{"code": code, "targets": codes} for code in codes]
        with patch.dict(os.environ, {"MOINPDF_TRANSLATE_URL": "http://translation:5000"}):
            with patch("server.app.urlopen", side_effect=OSError("not started")):
                self.assertEqual(translation_status(), "starting")
            for payload, expected in [(partial, "starting"), (full, "ready")]:
                with patch("server.app.urlopen", return_value=io.BytesIO(json.dumps(payload).encode())):
                    self.assertEqual(translation_status(), expected)

    def test_invalid_service_response(self):
        with patch.dict(os.environ, {"MOINPDF_TRANSLATE_URL": "http://translation:5000"}):
            with patch("server.app.urlopen", return_value=io.BytesIO(b"not JSON")):
                self.assertEqual(translation_status(), "starting")
