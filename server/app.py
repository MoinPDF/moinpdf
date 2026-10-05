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
import sys
import tempfile
import threading
import time
import uuid
import zipfile
from urllib.parse import urlsplit
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
MUSTANG = TOOLS / "mustang.jar"
ICC = Path(os.getenv("MOINPDF_ICC", "/usr/share/color/icc/ghostscript/srgb.icc"))
slots = threading.BoundedSemaphore(2)
app = FastAPI(title="MoinPDF Dokumentenserver", docs_url=None, redoc_url=None)

bearer = HTTPBearer(auto_error=False)


def api_key():
    # Standalone deployments keep the existing environment-key interface.
    configured = os.getenv("MOINPDF_API_KEY", "")
    if configured:
        return configured
    filename = os.getenv("MOINPDF_API_KEY_FILE", "")
    if filename:
        try:
            return Path(filename).read_text().strip()
        except OSError:
            return ""
    return ""


def authorize(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    expected = api_key()
    if len(expected) < 32 or expected.startswith("HIER_"):
        raise HTTPException(503, "Der Server braucht einen API-Schlüssel mit mindestens 32 Zeichen.")
    actual = credentials.credentials if credentials else ""
    if not hmac.compare_digest(actual.encode(), expected.encode()):
        raise HTTPException(401, "API-Schlüssel nicht akzeptiert.")


@app.middleware("http")
async def limit_request(request, call_next):
    if request.url.path.startswith('/v1/'):
        expected = api_key()
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


def command(args: list[str], cwd: Path, accepted=(0,), timeout=TIMEOUT, extra_environment=None):
    """No shell; timeout terminates the whole subprocess group, including LibreOffice children."""
    environment = {k: v for k, v in os.environ.items() if k not in {"MOINPDF_API_KEY", "MOINPDF_API_KEY_FILE", "MOINPDF_TRANSLATE_KEY", "MOINPDF_TRANSLATE_URL"}}
    if extra_environment:environment.update(extra_environment)
    environment.update(HOME=str(cwd), TMPDIR=str(cwd), JAVA_TOOL_OPTIONS="-Xmx768m")
    try:
        with (cwd / "stdout.log").open("w+b") as out, (cwd / "stderr.log").open("w+b") as err:
            process = subprocess.Popen(args, cwd=cwd, env=environment, stdout=out, stderr=err, start_new_session=True)
            try:
                code = process.wait(timeout=timeout)
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


def office_binary():
    # Both command names are used by supported LibreOffice installations.
    return shutil.which("libreoffice") or shutil.which("soffice")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/v1/capabilities", dependencies=[Depends(authorize)])
def capabilities():
    return {"apiVersion": 1, "service": "MoinPDF Dokumentenserver", "limits": {"maxBytes": MAX_BYTES},
            "versions": versions(), "translationService": urlsplit(os.getenv('MOINPDF_TRANSLATE_URL','')).hostname,
            "capabilities": {
                "office": bool(office_binary()),
                "pdfWord": importlib.util.find_spec("pdf2docx") is not None,
                "email": bool(office_binary() and importlib.util.find_spec("extract_msg")),
                "powerpoint": importlib.util.find_spec("pptx") is not None,
                "html": importlib.util.find_spec("pymupdf") is not None,
                "orient": bool(shutil.which("tesseract") and importlib.util.find_spec("pymupdf")),
                "formDetect": importlib.util.find_spec("cv2") is not None,
                "documentChecks": importlib.util.find_spec("pymupdf") is not None,
                "dewarp": importlib.util.find_spec("cv2") is not None,
                "translate": bool(os.getenv("MOINPDF_TRANSLATE_URL")),
                "wordMerge": bool(office_binary() and importlib.util.find_spec("openpyxl")),
                "zugferd": bool(MUSTANG.is_file() and shutil.which("java") and shutil.which("gs") and Path(VERAPDF).is_file() and ICC.is_file()),
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
        output = convert_office(source, directory)
        return result(output.read_bytes(), "Office-Dokument.pdf", "application/pdf")


def convert_office(source: Path, directory: Path, timeout=TIMEOUT):
    executable = office_binary()
    if not executable:
        raise HTTPException(503, "LibreOffice ist auf dem Dokumentenserver nicht installiert.")
    profile = directory / "lo-profile" / "user"
    profile.mkdir(parents=True, exist_ok=True)
    # Disable macros and external link updates in this isolated, disposable profile.
    (profile / "registrymodifications.xcu").write_text('''<?xml version="1.0"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Calc/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item></oor:items>''')
    command([executable, f"-env:UserInstallation={(profile.parent).as_uri()}", "--headless", "--nologo", "--nodefault", "--norestore", "--convert-to", "pdf", "--outdir", str(directory), str(source)], directory, timeout=timeout)
    output = source.with_suffix(".pdf")
    if not output.is_file():
        raise HTTPException(422, "LibreOffice hat keine PDF erzeugt. Bitte Dateiformat und Datei prüfen.")
    require_pdf(output)
    return output


def convert_worker(action: str, source: Path, directory: Path):
    try:
        command([sys.executable, str(Path(__file__).with_name("convert_documents.py")), action, str(source), str(directory)], directory, extra_environment={key:os.environ[key] for key in ("MOINPDF_TRANSLATE_URL","MOINPDF_TRANSLATE_KEY") if key in os.environ} if action=="translate" else None)
    except HTTPException as error:
        detail = directory / "conversion-error.json"
        if error.status_code == 422 and detail.is_file():
            raise HTTPException(422, json.loads(detail.read_text())["detail"])
        raise


@app.post("/v1/pdf-to-word", dependencies=[Depends(authorize)])
def pdf_to_word(file: UploadFile = File(...)):
    if importlib.util.find_spec("pdf2docx") is None:
        raise HTTPException(503, "Die Komponente PDF zu Word fehlt auf dem Server.")
    with job() as directory:
        source = upload(file, directory / "input.pdf")
        require_pdf(source)
        convert_worker("word", source, directory)
        output = directory / "output.docx"
        if not output.is_file() or not zipfile.is_zipfile(output):
            raise HTTPException(422, "Es wurde keine gültige Word-Datei erzeugt.")
        return result(output.read_bytes(), "PDF-zu-Word.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@app.post("/v1/email", dependencies=[Depends(authorize)])
def email_to_pdf(file: UploadFile = File(...), include_attachments: bool = Form(True)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".eml", ".msg"}:
        raise HTTPException(422, "Bitte eine EML- oder MSG-Datei auswählen.")
    if not office_binary() or importlib.util.find_spec("extract_msg") is None:
        raise HTTPException(503, "Die E-Mail-Konvertierung ist auf diesem Server noch nicht installiert.")
    with job() as directory:
        source = upload(file, directory / ("message" + suffix))
        convert_worker("email", source, directory)
        output = convert_office(directory / "email.docx", directory)
        if not include_attachments:
            return result(output.read_bytes(), "E-Mail.pdf", "application/pdf")
        files = {"E-Mail.pdf": output.read_bytes()}
        for name in json.loads((directory / "attachments.json").read_text()):
            if Path(name).name != name or name in {".", ".."}:
                raise HTTPException(422, "Ungültiger Anlagenname.")
            files["Anlagen/" + name] = (directory / "attachments" / name).read_bytes()
        return archive(files, "E-Mail-mit-Anlagen.zip")


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


@app.post('/v1/documents/{action}', dependencies=[Depends(authorize)])
def extended_document(action: str, file: UploadFile = File(...), options: str = Form('{}')):
    allowed={'powerpoint','html','orient','form','print','accessibility','redaction','dewarp','translate'}
    if action not in allowed:
        raise HTTPException(404,'Unbekanntes Werkzeug.')
    try:
        settings=json.loads(options)
        if not isinstance(settings,dict) or len(options)>10000:raise ValueError()
    except ValueError:
        raise HTTPException(422,'Ungültige Einstellungen.')
    if action=='orient' and not shutil.which('tesseract'):
        raise HTTPException(503,'Tesseract mit OSD-Sprachmodell fehlt auf dem Server.')
    with job() as directory:
        if action=='html' and Path(file.filename or '').suffix.lower() not in {'.html','.htm'}:
            raise HTTPException(422,'Bitte eine gespeicherte HTML-Webseite auswählen.')
        source=upload(file,directory/('input.html' if action=='html' else 'input.pdf'))
        if action!='html':require_pdf(source)
        (directory/'settings.json').write_text(json.dumps(settings))
        convert_worker(action,source,directory)
        if action in {'print','accessibility','redaction'}:
            return result((directory/'report.json').read_bytes(),{'print':'Druckqualitaet','accessibility':'Barrierefreiheit','redaction':'Schwaerzungspruefung'}[action]+'.json','application/json')
        if action=='powerpoint':
            return result((directory/'output.pptx').read_bytes(),'PDF-Folien.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation')
        if action=='orient':
            return archive({'Ausgerichtet.pdf':(directory/'output.pdf').read_bytes(),'Pruefbericht.json':(directory/'report.json').read_bytes()},'Ausrichtung-mit-Bericht.zip')
        name={'html':'Webseite','form':'Erkannte-Formularfelder','dewarp':'Buchscan-entzerrt','translate':'Original-und-Uebersetzung'}[action]+'.pdf'
        return result((directory/'output.pdf').read_bytes(),name,'application/pdf')


@app.post('/v1/word-merge', dependencies=[Depends(authorize)])
def word_mail_merge(file: UploadFile = File(...), spreadsheet: UploadFile = File(...)):
    if Path(file.filename or '').suffix.lower()!='.docx' or Path(spreadsheet.filename or '').suffix.lower()!='.xlsx':
        raise HTTPException(422,'Bitte eine DOCX-Vorlage und eine XLSX-Datentabelle auswählen.')
    with job() as directory:
        source=upload(file,directory/'template.docx',maximum=20*1024*1024)
        upload(spreadsheet,directory/'data.xlsx',maximum=10*1024*1024)
        convert_worker('word-merge',source,directory)
        documents=sorted((directory/'merged').glob('*.docx'))
        files={};deadline=time.monotonic()+TIMEOUT
        for document in documents:
            if time.monotonic()>=deadline:raise HTTPException(504,"Der Serienbrief-Auftrag hat das Zeitlimit erreicht. Bitte weniger Datensätze verwenden.")
            pdf=convert_office(document,directory/'merged',timeout=max(1,deadline-time.monotonic()))
            files[pdf.name]=pdf.read_bytes()
        files['Protokoll.json']=(directory/'report.json').read_bytes()
        return archive(files,'Word-Serienbriefe.zip')


def mustang_validate(source: Path, directory: Path):
    _,data=command(['java','-jar',str(MUSTANG),'--disable-file-logging','--action','validate','--source',str(source)],directory,accepted=(0,1,255))
    start=data.find(b'<validation ');end=data.rfind(b'</validation>')
    if start<0 or end<0:raise HTTPException(422,'Mustang hat keinen auswertbaren Prüfbericht geliefert.')
    raw=data[start:end+len(b'</validation>')]
    root=SafeET.fromstring(raw)
    summaries=[node for node in root if node.tag.split('}')[-1]=='summary']
    if not summaries:raise HTTPException(422,'Im Prüfbericht fehlt das Gesamtergebnis.')
    valid=all(node.get('status')=='valid' for node in summaries)
    return valid,raw


@app.post('/v1/zugferd/{mode}', dependencies=[Depends(authorize)])
def zugferd(mode: str, file: UploadFile = File(...), invoice: UploadFile | None = File(None), profile: str = Form('E')):
    if mode not in {'create','validate'} or profile not in {'E','B','T','X'}:
        raise HTTPException(422,'Ungültige ZUGFeRD-Aktion oder ungültiges Profil.')
    if not MUSTANG.is_file():raise HTTPException(503,'Mustang fehlt auf dem Dokumentenserver.')
    archive_pdf=None
    if mode=='create':
        if not invoice:raise HTTPException(422,'Bitte die zur sichtbaren Rechnung passende CII-XML auswählen.')
        converted=create_pdfa(file,'3b')
        with zipfile.ZipFile(io.BytesIO(converted.body)) as bundle:
            if not json.loads(bundle.read('Ergebnis.json'))['compliant']:
                raise HTTPException(422,'Die Ausgangs-PDF konnte nicht in eine geprüfte PDF/A-3-Datei umgewandelt werden.')
            archive_pdf=bundle.read('Archiv-PDF-A.pdf')
    with job() as directory:
        source=directory/'input.pdf'
        if mode=='validate':upload(file,source);require_pdf(source)
        else:
            source.write_bytes(archive_pdf)
            xml=upload(invoice,directory/'invoice.xml',maximum=10*1024*1024)
            try:
                root=SafeET.parse(xml,forbid_dtd=True,forbid_entities=True,forbid_external=True).getroot()
                if root.tag.split('}')[-1]!='CrossIndustryInvoice':raise ValueError()
            except Exception:raise HTTPException(422,'Bitte eine gültige CII-Rechnungs-XML ohne externe Entitäten verwenden. UBL wird hier nicht eingebettet.')
            output=directory/'zugferd.pdf'
            command(['java','-jar',str(MUSTANG),'--disable-file-logging','--action','combine','--source',str(source),'--source-xml',str(xml),'--out',str(output),'--format','zf','--version','2','--profile',profile,'--no-additional-attachments'],directory)
            if not output.is_file():raise HTTPException(422,'Mustang hat keine hybride Rechnung erzeugt.')
            source=output
        valid,raw=mustang_validate(source,directory)
        pdfa,vera=pdfa_report(source,'3b',directory)
        compliant=valid and pdfa['compliant']
        summary={'compliant':compliant,'mustangValid':valid,'pdfa3b':pdfa['compliant'],'versions':versions(),'note':'Sichtbare Rechnungsangaben und eingebettete XML müssen inhaltlich übereinstimmen. Diese Übereinstimmung wird nicht automatisch bestätigt.'}
        files={'Ergebnis.json':json.dumps(summary,ensure_ascii=False,indent=2).encode(),'Mustang-Pruefbericht.xml':raw,'veraPDF-Pruefbericht.xml':vera}
        if mode=='create':files['ZUGFeRD-geprueft.pdf' if compliant else 'NICHT-VALIDIERT-Rechnung.pdf']=source.read_bytes()
        return archive(files,'ZUGFeRD-Ergebnis.zip')
