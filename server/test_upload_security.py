"""Regression tests for the upload parser used by the document service."""
import io
import unittest

from python_multipart import MultipartParser, parse_form
from python_multipart.exceptions import MultipartParseError


class UploadSecurityTests(unittest.TestCase):
    def test_regular_multipart_keeps_binary_document_bytes(self):
        data = bytearray()
        parser = MultipartParser(b"moinpdf-test", {
            "on_part_data": lambda value, start, end: data.extend(value[start:end]),
        })
        payload = b"%PDF-synthetic\x00\xff\nbytes"
        body = (b'--moinpdf-test\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\n'
                b'Content-Type: application/pdf\r\n\r\n' + payload + b'\r\n--moinpdf-test--\r\n')
        for index in range(0, len(body), 7):
            parser.write(body[index:index + 7])
        parser.finalize()
        self.assertEqual(bytes(data), payload)

    def test_oversized_part_headers_are_rejected(self):
        attacks = [b"X-Test: " + b"x" * 20000 + b"\r\n", b"X-Test: x\r\n" * 100]
        for headers in attacks:
            with self.subTest(size=len(headers)):
                parser = MultipartParser(b"moinpdf-test")
                with self.assertRaises(MultipartParseError):
                    parser.write(b"--moinpdf-test\r\n" + headers + b"\r\ndata")

    def test_semicolon_cannot_smuggle_a_second_role(self):
        fields = []
        parse_form({"Content-Type": "application/x-www-form-urlencoded"},
                   io.BytesIO(b"role=user&x=;role=admin"), fields.append, None)
        self.assertEqual([(field.field_name, field.value) for field in fields],
                         [(b"role", b"user"), (b"x", b";role=admin")])

    def test_negative_content_length_is_rejected_before_reading(self):
        body = io.BytesIO(b"role=user")
        with self.assertRaises(ValueError):
            parse_form({"Content-Type": "application/x-www-form-urlencoded", "Content-Length": "-1"},
                       body, lambda _: None, None)
        self.assertEqual(body.tell(), 0)


if __name__ == "__main__":
    unittest.main()
