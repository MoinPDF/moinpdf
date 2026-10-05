import io
import json
import os
import shutil
import tempfile
import unittest
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from fastapi.testclient import TestClient
os.environ.setdefault("MOINPDF_ORIGINS", "https://moinpdf.test")
try:
    from server import app as service
except ImportError:
    import app as service


def pdf_bytes():
    stream = b"BT /F1 14 Tf 40 780 Td (MoinPDF test) Tj ET"
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
               b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
               b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
               b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"]
    output = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output += str(i).encode() + b" 0 obj\n" + obj + b"\nendobj\n"
    start = len(output)
    output += f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        output += f"{offset:010d} 00000 n \n".encode()
    output += f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode()
    return bytes(output)


class ServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key_env = patch.dict(os.environ, {"MOINPDF_API_KEY": "synthetic-test-api-key-" + "x" * 32})
        cls.key_env.start()
        cls.client = TestClient(service.app)
        cls.headers = {"Authorization": "Bearer " + os.environ["MOINPDF_API_KEY"]}
        cls.pdf = pdf_bytes()
        cls.temporary = tempfile.TemporaryDirectory()
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Synthetic MoinPDF Test CA")])
        now = datetime.now(timezone.utc)
        certificate = (x509.CertificateBuilder().subject_name(subject).issuer_name(subject).public_key(key.public_key())
                       .serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(days=1))
                       .not_valid_after(now+timedelta(days=1)).add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
                       .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=True, key_encipherment=False,
                           data_encipherment=False, key_agreement=False, key_cert_sign=True, crl_sign=True,
                           encipher_only=False, decipher_only=False), critical=True).sign(key, hashes.SHA256()))
        cls.p12 = pkcs12.serialize_key_and_certificates(b"test", key, certificate, None, serialization.BestAvailableEncryption(b"synthetic-password"))
        Path(cls.temporary.name, "test.pem").write_bytes(certificate.public_bytes(serialization.Encoding.PEM))

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.temporary.cleanup()
        cls.key_env.stop()

    def post(self, path, files=None, data=None):
        return self.client.post(path, headers=self.headers, files=files or {"file": ("test.pdf", self.pdf, "application/pdf")}, data=data or {})

    def test_auth_and_capabilities(self):
        rejected = self.client.get("/v1/capabilities", headers={"Origin": "https://moinpdf.test"})
        self.assertEqual(rejected.status_code, 401)
        self.assertEqual(rejected.headers["access-control-allow-origin"], "https://moinpdf.test")
        preflight = self.client.options("/v1/office", headers={"Origin": "https://moinpdf.test", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Authorization"})
        self.assertEqual(preflight.status_code, 200)
        response = self.client.get("/v1/capabilities", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["capabilities"]["signatures"])
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        with patch.dict(os.environ, {"MOINPDF_API_KEY": "HIER_EINEN_SCHLUESSEL_EINTRAGEN_123456"}):
            self.assertEqual(self.client.get("/v1/capabilities", headers=self.headers).status_code, 503)

    def test_invalid_inputs(self):
        self.assertEqual(self.post("/v1/office", files={"file": ("bad.exe", b"not office")}).status_code, 422)
        self.assertEqual(self.post("/v1/pdfa/create", data={"profile": "bad"}).status_code, 422)
        self.assertEqual(self.post("/v1/signatures/validate", files={"file": ("bad.pdf", b"not PDF")}).status_code, 422)
        self.assertEqual(self.post("/v1/xrechnung/validate", files={"file": ("bad.xml", b'<!DOCTYPE x [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><x>&xxe;</x>')}).status_code, 422)
        self.assertEqual(self.post("/v1/xrechnung/validate", files={"file": ("bad.xml", b'<!DOCTYPE x><x/>')}).status_code, 422)

    def test_sign_and_validate(self):
        response = self.post("/v1/signatures/sign", files={"file": ("test.pdf", self.pdf), "certificate": ("synthetic.p12", self.p12)}, data={"password": "synthetic-password"})
        self.assertEqual(response.status_code, 200, response.text[:300])
        self.assertIn(b"/ByteRange", response.content)
        with patch.dict(os.environ, {"MOINPDF_TRUST_ROOTS": "/nonexistent-test-trust"}):
            untrusted = self.post("/v1/signatures/validate", files={"file": ("signed.pdf", response.content)}).json()
        status = untrusted["signatures"][0]
        self.assertTrue(status["intact"])
        self.assertTrue(status["cryptographicallyValid"])
        self.assertFalse(status["trustedChain"])
        with patch.dict(os.environ, {"MOINPDF_TRUST_ROOTS": self.temporary.name}):
            trusted = self.post("/v1/signatures/validate", files={"file": ("signed.pdf", response.content)}).json()
        self.assertTrue(trusted["signatures"][0]["trustedChain"])
        self.assertIn("Nicht online", trusted["revocationStatus"])
        tampered = response.content.replace(b"MoinPDF test", b"MoinPDF fake")
        invalid = self.post("/v1/signatures/validate", files={"file": ("tampered.pdf", tampered)})
        self.assertEqual(invalid.status_code, 200)
        self.assertFalse(invalid.json()["signatures"][0]["intact"])

    def test_unsigned_pdf(self):
        response = self.post("/v1/signatures/validate")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["signatures"], [])

    @unittest.skipUnless(service.KOSIT.is_file() and service.SCENARIOS.is_file(), "KoSIT/Regelpaket nicht installiert")
    def test_kosit_real_rules(self):
        fixture = Path(__file__).resolve().parent.parent / "tests/fixtures/invoice-ubl.xml"
        data = fixture.read_bytes()
        response = self.post("/v1/xrechnung/validate", files={"file": ("invoice.xml", data)})
        self.assertEqual(response.status_code, 200, response.text[:300])
        report = zipfile.ZipFile(io.BytesIO(response.content))
        self.assertTrue(json.loads(report.read("Ergebnis.json"))["accepted"])
        # Well-formed XML with required business data missing must fail the official rules.
        import re
        bad = re.sub(rb"<cbc:ID>.*?</cbc:ID>", b"<cbc:ID></cbc:ID>", data, count=1)
        response = self.post("/v1/xrechnung/validate", files={"file": ("invalid.xml", bad)})
        self.assertEqual(response.status_code, 200, response.text[:300])
        report = zipfile.ZipFile(io.BytesIO(response.content))
        self.assertFalse(json.loads(report.read("Ergebnis.json"))["accepted"])
        self.assertIn(b"BR-02", report.read("KoSIT-Pruefbericht.xml"))

    @unittest.skipUnless(Path(service.VERAPDF).is_file() and shutil.which("gs"), "veraPDF/Ghostscript nicht installiert")
    def test_pdfa_real_conversion_and_validation(self):
        for profile in ("1b", "2b", "3b"):
            response = self.post("/v1/pdfa/create", data={"profile": profile})
            self.assertEqual(response.status_code, 200, response.text[:300])
            report = zipfile.ZipFile(io.BytesIO(response.content))
            self.assertTrue(json.loads(report.read("Ergebnis.json"))["compliant"], profile)
            self.assertIn("Archiv-PDF-A.pdf", report.namelist())
        response = self.post("/v1/pdfa/validate", data={"profile": "2b"})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(json.loads(zipfile.ZipFile(io.BytesIO(response.content)).read("Ergebnis.json"))["compliant"])

    @unittest.skipUnless(service.office_binary(), "LibreOffice nicht installiert")
    def test_office_real_conversion(self):
        from pyhanko.pdf_utils.reader import PdfFileReader
        fixtures = Path(__file__).resolve().parent.parent / "tests/fixtures/office"
        for extension in ("docx", "xlsx", "pptx", "odt", "ods", "odp"):
            with self.subTest(extension=extension):
                document = fixtures / f"sample.{extension}"
                response = self.post("/v1/office", files={"file": (document.name, document.read_bytes())})
                self.assertEqual(response.status_code, 200, response.text[:300])
                self.assertEqual(response.headers["content-type"], "application/pdf")
                reader = PdfFileReader(io.BytesIO(response.content))
                self.assertGreater(int(reader.root["/Pages"]["/Count"]), 0)

    def test_office_missing_component(self):
        with patch.object(service, "office_binary", return_value=None):
            capabilities = self.client.get("/v1/capabilities", headers=self.headers).json()
            self.assertFalse(capabilities["capabilities"]["office"])
            response = self.post("/v1/office", files={"file": ("test.docx", b"synthetic")})
            self.assertEqual(response.status_code, 503)
            self.assertIn("LibreOffice", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
