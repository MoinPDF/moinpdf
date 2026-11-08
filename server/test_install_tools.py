"""Pinned build downloads keep their integrity checks when upstream times out."""
import hashlib
import io
import unittest
import urllib.error
from unittest.mock import patch

from install_tools import download_verified


class ToolDownloadTests(unittest.TestCase):
    def setUp(self):
        self.data = b"fictional verified tool archive"
        self.spec = {
            "url": "https://github.com/example/tool/releases/download/v1/tool.jar",
            "fallback_url": "https://api.github.com/repos/example/tool/releases/assets/123",
            "sha256": hashlib.sha256(self.data).hexdigest(),
        }

    def http_error(self, status):
        return urllib.error.HTTPError(self.spec["url"], status, "synthetic failure", {}, None)

    def test_primary_success_never_requests_fallback(self):
        with patch("install_tools.urllib.request.urlopen", return_value=io.BytesIO(self.data)) as fetch:
            self.assertEqual(download_verified("tool", self.spec), self.data)
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual(fetch.call_args.args[0].full_url, self.spec["url"])

    def test_gateway_timeout_uses_the_exact_pinned_asset(self):
        with patch("install_tools.urllib.request.urlopen", side_effect=[self.http_error(504), io.BytesIO(self.data)]) as fetch:
            self.assertEqual(download_verified("tool", self.spec), self.data)
        self.assertEqual(fetch.call_count, 2)
        request = fetch.call_args.args[0]
        self.assertEqual(request.full_url, self.spec["fallback_url"])
        self.assertEqual(request.get_header("Accept"), "application/octet-stream")

    def test_network_failure_can_use_verified_fallback(self):
        with patch("install_tools.urllib.request.urlopen", side_effect=[urllib.error.URLError("timeout"), io.BytesIO(self.data)]):
            self.assertEqual(download_verified("tool", self.spec), self.data)

    def test_missing_or_forbidden_release_does_not_use_fallback(self):
        for status in [403, 404]:
            with self.subTest(status=status), patch("install_tools.urllib.request.urlopen", side_effect=self.http_error(status)) as fetch:
                with self.assertRaises(urllib.error.HTTPError):
                    download_verified("tool", self.spec)
                self.assertEqual(fetch.call_count, 1)

    def test_corrupt_primary_is_rejected_without_fallback(self):
        with patch("install_tools.urllib.request.urlopen", return_value=io.BytesIO(b"corrupt")) as fetch:
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                download_verified("tool", self.spec)
        self.assertEqual(fetch.call_count, 1)

    def test_corrupt_fallback_is_rejected(self):
        with patch("install_tools.urllib.request.urlopen", side_effect=[self.http_error(504), io.BytesIO(b"corrupt")]):
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                download_verified("tool", self.spec)

    def test_failed_fallback_stays_a_build_failure(self):
        with patch("install_tools.urllib.request.urlopen", side_effect=self.http_error(504)) as fetch:
            with self.assertRaises(urllib.error.HTTPError):
                download_verified("tool", self.spec)
        self.assertEqual(fetch.call_count, 2)

    def test_without_fallback_the_original_failure_is_preserved(self):
        self.spec.pop("fallback_url")
        with patch("install_tools.urllib.request.urlopen", side_effect=self.http_error(504)) as fetch:
            with self.assertRaises(urllib.error.HTTPError):
                download_verified("tool", self.spec)
        self.assertEqual(fetch.call_count, 1)


if __name__ == "__main__":
    unittest.main()
