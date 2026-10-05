"""Optional MoinPDF document service. No document persistence, no shared job directory."""
from __future__ import annotations

import hmac
import importlib.util
import io
import json
import os
import shutil
import signal
import subprocess
import tempfile
import threading
import uuid
import zipfile
from contextlib import contextmanager
from pathlib import Path

from defusedxml import ElementTree as SafeET
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

MAX_BYTES = 80 * 1024 * 1024
TIMEOUT = 180
TOOLS = Path(os.getenv("MOINPDF_TOOLS", "/opt/moinpdf-tools"))
KOSIT = TOOLS / "validator.jar"
SCENARIOS = TOOLS / "xrechnung" / "scenarios.xml"
VERAPDF = str(TOOLS / "verapdf" / "verapdf")
ICC = Path(os.getenv("MOINPDF_ICC", "/usr/share/color/icc/ghostscript/srgb.icc"))
slots = threading.BoundedSemaphore(2)
app = FastAPI(title="MoinPDF Dokumentenserver", docs_url=None, redoc_url=None)

bearer = HTTPBearer(auto_error=False)


def authorize(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    expected = os.getenv("MOINPDF_API_KEY", "")
    if len(expected) < 32 or expected.startswith("HIER_"):
        raise HTTPException(503, "Der Server braucht einen API-Schlüssel mit mindestens 32 Zeichen.")
    actual = credentials.credentials if credentials else ""
    if not hmac.compare_digest(actual.encode(), expected.encode()):
        raise HTTPException(401, "API-Schlüssel nicht akzeptiert.")


@app.middleware("http")
async def limit_request(request, call_next):
    if request.url.path.startswith('/v1/'):
        expected = os.getenv('MOINPDF_API_KEY', '')
        if len(expected) < 32 or expected.startswith('HIER_'):
            return JSONResponse({'detail': 'Der Server braucht einen eigenen API-Schlüssel.'}, status_code=503)
        actual = request.headers.get('authorization', '')
        if not hmac.compare_digest(actual.encode(), ('Bearer ' + expected).encode()):
            return JSONResponse({'detail': 'API-Schlüssel nicht akzeptiert.'}, status_code=401)
    length = request.headers.get("content-length")
    if length and (not length.isdigit() or int(length) > MAX_BYTES + 5 * 1024 * 1024):
        return JSONResponse({"detail": "Dateien dürfen zusammen höchstens 80 MB groß sein."}, status_code=413)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# CORS wraps authentication so preflights and rejected requests receive correct headers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv("MOINPDF_ORIGINS", "").split(",") if x.strip()],
    allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition", "X-MoinPDF-Note"], allow_credentials=False,
)

@contextmanager
def job():
    if not slots.acquire(blocking=False):
        raise HTTPException(503, "Der Server verarbeitet bereits zwei Aufträge. Bitte später erneut versuchen.")
    try:
        with tempfile.TemporaryDirectory(prefix="moinpdf-") as directory:
            yield Path(directory)
    finally:
        slots.release()


def upload(file: UploadFile, target: Path, maximum=MAX_BYTES):
    count = 0
    with target.open("wb") as output:
        while data := file.file.read(1024 * 1024):
            count += len(data)
            if count > maximum:
                raise HTTPException(413, "Die hochgeladene Datei ist zu groß.")
            output.write(data)
    if not count:
        raise HTTPException(422, "Die Datei ist leer.")
    return target


def require_pdf(path: Path):
    with path.open("rb") as stream:
        if b"%PDF-" not in stream.read(1024):
            raise HTTPException(422, "Die Datei ist keine PDF.")


def command(args: list[str], cwd: Path, accepted=(0,)):
    """No shell; timeout terminates the whole subprocess group, including LibreOffice children."""
    environment = {k: v for k, v in os.environ.items() if k not in {"MOINPDF_API_KEY"}}
    environment.update(HOME=str(cwd), TMPDIR=str(cwd), JAVA_TOOL_OPTIONS="-Xmx768m")
    try:
        with (cwd / "stdout.log").open("w+b") as out, (cwd / "stderr.log").open("w+b") as err:
            process = subprocess.Popen(args, cwd=cwd, env=environment, stdout=out, stderr=err, start_new_session=True)
            try:
                code = process.wait(timeout=TIMEOUT)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                raise HTTPException(504, "Das Dokument konnte nicht innerhalb von drei Minuten verarbeitet werden.")
            out.seek(0)
            data = out.read(16 * 1024 * 1024)
            if code not in accepted:
                raise HTTPException(422, "Das Dokument konnte vom eingesetzten Konverter nicht verarbeitet werden.")
            return code, data
    except FileNotFoundError:
        raise HTTPException(503, "Die benötigte Serverkomponente ist nicht installiert.")


def result(data: bytes, name: str, media: str):
    return Response(data, media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}"'})


def archive(files: dict[str, bytes], name: str):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as bundle:
        for path, data in files.items():
            bundle.writestr(path, data)
    return result(output.getvalue(), name, "application/zip")


def versions():
    path = TOOLS / "versions.json"
    return json.loads(path.read_text()) if path.exists() else {"tools": "nicht vollständig installiert"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/v1/capabilities", dependencies=[Depends(authorize)])
def capabilities():
    return {"apiVersion": 1, "service": "MoinPDF Dokumentenserver", "limits": {"maxBytes": MAX_BYTES},
            "versions": versions(), "capabilities": {
                "office": bool(shutil.which("libreoffice")),
                "pdfa": bool(shutil.which("gs") and Path(VERAPDF).is_file() and ICC.is_file()),
                "xrechnung": bool(shutil.which("java") and KOSIT.is_file() and SCENARIOS.is_file()),
                "signatures": importlib.util.find_spec("pyhanko") is not None}}


@app.post("/v1/office", dependencies=[Depends(authorize)])
def office(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp"}:
        raise HTTPException(422, "Bitte eine unterstützte Office-Datei auswählen.")
    with job() as directory:
        source = upload(file, directory / ("input" + suffix))
        profile = directory / "lo-profile" / "user"
        profile.mkdir(parents=True)
        # Disable macros and external link updates in this isolated, disposable profile.
        (profile / "registrymodifications.xcu").write_text('''<?xml version="1.0"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Calc/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item></oor:items>''')
        command(["libreoffice", f"-env:UserInstallation={(profile.parent).as_uri()}", "--headless", "--nologo", "--nodefault", "--norestore", "--convert-to", "pdf", "--outdir", str(directory), str(source)], directory)
        output = directory / "input.pdf"
        if not output.is_file():
            raise HTTPException(422, "LibreOffice hat keine PDF erzeugt. Bitte Dateiformat und Datei prüfen.")
        require_pdf(output)
        return result(output.read_bytes(), "Office-Dokument.pdf", "application/pdf")


def pdfa_report(source: Path, profile: str, directory: Path):
    if profile not in {"1b", "2b", "3b"}:
        raise HTTPException(422, "Unterstützte Profile: 1b, 2b und 3b.")
    _, data = command([VERAPDF, "--format", "xml", "--flavour", profile, str(source)], directory, accepted=(0, 1))
    try:
        root = SafeET.fromstring(data)
        reports = [node for node in root.iter() if node.tag.split("}")[-1] == "validationReport"]
        if not reports:
            raise ValueError("missing report")
        compliant = all(node.get("isCompliant") == "true" for node in reports)
    except Exception:
        raise HTTPException(422, "veraPDF hat keinen auswertbaren Prüfbericht geliefert.")
    return {"profile": profile, "compliant": compliant, "engine": "veraPDF", "versions": versions()}, data


@app.post("/v1/pdfa/validate", dependencies=[Depends(authorize)])
def validate_pdfa(file: UploadFile = File(...), profile: str = Form("2b")):
    with job() as directory:
        source = upload(file, directory / "input.pdf")
        require_pdf(source)
        report, raw = pdfa_report(source, profile, directory)
        return archive({"Ergebnis.json": json.dumps(report, ensure_ascii=False, indent=2).encode(), "veraPDF-Bericht.xml": raw}, "PDF-A-Pruefbericht.zip")


@app.post("/v1/pdfa/create", dependencies=[Depends(authorize)])
def create_pdfa(file: UploadFile = File(...), profile: str = Form("2b")):
    if profile not in {"1b", "2b", "3b"}:
        raise HTTPException(422, "Unterstützte Profile: 1b, 2b und 3b.")
    with job() as directory:
        source = upload(file, directory / "input.pdf")
        require_pdf(source)
        if not ICC.is_file():
            raise HTTPException(503, "Das sRGB-Farbprofil fehlt auf dem Server.")
        shutil.copyfile(ICC, directory / "srgb.icc")
        definition = directory / "pdfa.ps"
        definition.write_text('''%!
[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark
[{icc_PDFA} << /N 3 >> /PUT pdfmark
[{icc_PDFA} (srgb.icc) (r) file /PUT pdfmark
[/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark
[{OutputIntent_PDFA} << /Type /OutputIntent /S /GTS_PDFA1 /DestOutputProfile {icc_PDFA} /OutputConditionIdentifier (sRGB) >> /PUT pdfmark
[{Catalog} << /OutputIntents [ {OutputIntent_PDFA} ] >> /PUT pdfmark
''')
        output = directory / "archive.pdf"
        command(["gs", "-dSAFER", "--permit-file-read=srgb.icc", "-dBATCH", "-dNOPAUSE", "-sDEVICE=pdfwrite", f"-dPDFA={profile[0]}", "-dPDFACompatibilityPolicy=1", "-sColorConversionStrategy=RGB", "-sProcessColorModel=DeviceRGB", f"-sOutputFile={output}", str(definition), str(source)], directory)
        report, raw = pdfa_report(output, profile, directory)
        # Failed validation never gets the PDF/A filename or a success claim.
        name = "Archiv-PDF-A.pdf" if report["compliant"] else "NICHT-PDF-A-konform.pdf"
        return archive({name: output.read_bytes(), "Ergebnis.json": json.dumps(report, indent=2).encode(), "veraPDF-Bericht.xml": raw}, "PDF-A-Ergebnis.zip")


@app.post("/v1/xrechnung/validate", dependencies=[Depends(authorize)])
def validate_invoice(file: UploadFile = File(...)):
    with job() as directory:
        source = upload(file, directory / "invoice.xml", maximum=10 * 1024 * 1024)
        try:
            SafeET.parse(source, forbid_dtd=True, forbid_entities=True, forbid_external=True)
        except Exception:
            raise HTTPException(422, "Keine gültige XML-Datei. Externe Entitäten und DTDs werden nicht akzeptiert.")
        if not KOSIT.is_file() or not SCENARIOS.is_file():
            raise HTTPException(503, "KoSIT-Validator oder XRechnung-Konfiguration fehlt.")
        code, _ = command(["java", "-jar", str(KOSIT), "-s", str(SCENARIOS), "-r", str(SCENARIOS.parent), "-o", str(directory), str(source)], directory, accepted=(0, 1))
        reports = [p for p in directory.glob("*.xml") if p != source]
        if len(reports) != 1:
            raise HTTPException(422, "KoSIT hat keinen eindeutigen Prüfbericht erzeugt.")
        raw = reports[0].read_bytes()
        try:
            SafeET.fromstring(raw)
        except Exception:
            raise HTTPException(422, "KoSIT hat keinen auswertbaren XML-Bericht geliefert.")
        report = {"accepted": code == 0, "engine": "KoSIT", "versions": versions(), "checks": "XSD und Schematron der installierten XRechnung-Konfiguration"}
        return archive({"Ergebnis.json": json.dumps(report, ensure_ascii=False, indent=2).encode(), "KoSIT-Pruefbericht.xml": raw}, "XRechnung-Pruefbericht.zip")


@app.post("/v1/signatures/sign", dependencies=[Depends(authorize)])
def sign_pdf(file: UploadFile = File(...), certificate: UploadFile = File(...), password: str = Form("")):
    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    from pyhanko.sign import signers
    with job() as directory:
        source = upload(file, directory / "input.pdf")
        require_pdf(source)
        key = upload(certificate, directory / "certificate.p12", maximum=2 * 1024 * 1024)
        try:
            signer = signers.SimpleSigner.load_pkcs12(str(key), passphrase=password.encode())
            if signer is None:
                raise ValueError("key unavailable")
            with source.open("rb") as stream:
                writer = IncrementalPdfFileWriter(stream)
                metadata = signers.PdfSignatureMetadata(field_name="MoinPDF_" + uuid.uuid4().hex[:12])
                signed = signers.PdfSigner(metadata, signer=signer).sign_pdf(writer).getvalue()
            return result(signed, "Zertifikat-signiert.pdf", "application/pdf")
        except Exception:
            raise HTTPException(422, "Signieren fehlgeschlagen. Zertifikat, Passwort und PDF-Berechtigungen prüfen.")


@app.post("/v1/signatures/validate", dependencies=[Depends(authorize)])
def validate_signatures(file: UploadFile = File(...)):
    from pyhanko.pdf_utils.reader import PdfFileReader
    from pyhanko.sign.validation import validate_pdf_signature
    from pyhanko.keys import load_certs_from_pemder
    from pyhanko_certvalidator import ValidationContext
    trust_path = Path(os.getenv("MOINPDF_TRUST_ROOTS", "/trust"))
    roots = list(load_certs_from_pemder([str(p) for p in trust_path.glob("*.pem")])) if trust_path.is_dir() else []
    with job() as directory:
        source = upload(file, directory / "input.pdf")
        require_pdf(source)
        reports = []
        try:
            with source.open("rb") as stream:
                reader = PdfFileReader(stream)
                for signature in reader.embedded_regular_signatures:
                    vc = ValidationContext(trust_roots=roots, allow_fetching=False, revocation_mode="soft-fail")
                    status = validate_pdf_signature(signature, signer_validation_context=vc)
                    reports.append({"field": signature.field_name, "signer": status.signing_cert.subject.human_friendly,
                                    "intact": status.intact, "cryptographicallyValid": status.valid,
                                    "trustedChain": status.trusted, "revoked": status.revoked,
                                    "coverage": status.coverage.name if status.coverage else None,
                                    "documentChangesAllowed": status.docmdp_ok,
                                    "modificationLevel": status.modification_level.name if status.modification_level else None,
                                    "summary": status.summary()})
        except Exception:
            raise HTTPException(422, "Die Signaturen konnten nicht ausgewertet werden. Bitte eine unbeschädigte, unverschlüsselte PDF verwenden.")
        report = {"engine": "pyHanko", "signatures": reports, "trustRootsConfigured": len(roots),
                  "revocationStatus": "Nicht online geprüft. Keine OCSP-/Sperrlistenabfrage.",
                  "qualifiedSignatureStatus": "Nicht geprüft", "note": "Eine intakte Signatur allein bestätigt weder Zertifikatsvertrauen noch den aktuellen Sperrstatus."}
        return result(json.dumps(report, ensure_ascii=False, indent=2).encode(), "Signaturpruefung.json", "application/json")
