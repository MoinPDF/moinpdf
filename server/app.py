"""MoinPDF document service with isolated conversion workspaces and bounded background jobs."""
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
from urllib.parse import urlsplit, quote
from urllib.request import urlopen
from contextlib import contextmanager, asynccontextmanager, ExitStack
from pathlib import Path

from defusedxml import ElementTree as SafeET
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
if __package__:
    from .job_queue import JobQueue, QueueError, context as queue_context
    from .audio_documents import voices_available, validate_request as validate_audio, MAX_CHARACTERS, MAX_SECTIONS
else:
    from job_queue import JobQueue, QueueError, context as queue_context
    from audio_documents import voices_available, validate_request as validate_audio, MAX_CHARACTERS, MAX_SECTIONS

MAX_BYTES = 80 * 1024 * 1024
TIMEOUT = 180
TOOLS = Path(os.getenv("MOINPDF_TOOLS", "/opt/moinpdf-tools"))
KOSIT = TOOLS / "validator.jar"
SCENARIOS = TOOLS / "xrechnung" / "scenarios.xml"
VERAPDF = str(TOOLS / "verapdf" / "verapdf")
MUSTANG = TOOLS / "mustang.jar"
ICC = Path(os.getenv("MOINPDF_ICC", "/usr/share/color/icc/ghostscript/srgb.icc"))
slots = threading.BoundedSemaphore(2)
@asynccontextmanager
async def lifespan(_app):
    store = background_queue()
    try: yield
    finally: store.close()

app = FastAPI(title="MoinPDF Dokumentenserver", docs_url=None, redoc_url=None, lifespan=lifespan)

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
    allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type", "X-MoinPDF-Job-Ticket"],
    expose_headers=["Content-Disposition", "X-MoinPDF-Note"], allow_credentials=False,
)

@contextmanager
def job():
    if getattr(queue_context, 'cancel', None) is not None:
        while not slots.acquire(timeout=0.2):
            if queue_context.cancel.is_set(): raise HTTPException(499, 'Auftrag abgebrochen.')
            if time.monotonic() >= queue_context.deadline: raise HTTPException(504, 'Der Auftrag hat das Zeitlimit erreicht.')
    elif not slots.acquire(blocking=False):
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
    environment = {k: v for k, v in os.environ.items() if k not in {"MOINPDF_API_KEY", "MOINPDF_API_KEY_FILE", "MOINPDF_TRANSLATE_KEY", "MOINPDF_TRANSLATE_URL", "MOINPDF_TSA_BEARER"}}
    if extra_environment:environment.update(extra_environment)
    environment.update(HOME=str(cwd), TMPDIR=str(cwd), JAVA_TOOL_OPTIONS="-Xmx768m")
    try:
        with (cwd / "stdout.log").open("w+b") as out, (cwd / "stderr.log").open("w+b") as err:
            process = subprocess.Popen(args, cwd=cwd, env=environment, stdout=out, stderr=err, start_new_session=True)
            cancel = getattr(queue_context, 'cancel', None)
            deadline = min(time.monotonic() + (900 if cancel is not None and timeout == TIMEOUT else timeout), getattr(queue_context, 'deadline', float('inf')))
            try:
                while True:
                    if cancel is not None and cancel.is_set(): raise HTTPException(499, 'Auftrag abgebrochen.')
                    if time.monotonic() >= deadline: raise HTTPException(504, 'Das Dokument hat das Zeitlimit für die Verarbeitung erreicht.')
                    try:
                        code = process.wait(timeout=0.2)
                        break
                    except subprocess.TimeoutExpired:
                        pass
            except BaseException:
                try: os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError: pass
                process.wait()
                raise
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
    translation = translation_status()
    voices = voices_available()
    signature_advanced = os.getenv("MOINPDF_TSA_URL", "").startswith("https://") and any(Path(os.getenv("MOINPDF_TRUST_ROOTS", "/trust")).glob("*.pem"))
    return {"apiVersion": 1, "service": "MoinPDF Dokumentenserver", "limits": {"maxBytes": MAX_BYTES, "audioCharacters": MAX_CHARACTERS, "audioSections": MAX_SECTIONS}, "audioVoices": voices, "signatureLevels": {"basic": True, "timestamp": signature_advanced, "lt": signature_advanced, "lta": signature_advanced},
            "jobQueue": {"operations": sorted(QUEUED_OPERATIONS), "retentionSeconds": 86400, "timeoutSeconds": 900}, "versions": versions(), "translationService": urlsplit(os.getenv('MOINPDF_TRANSLATE_URL','')).hostname,
            "translationStatus": translation,
            "capabilities": {
                "speech": len(voices) == 2,
                "office": bool(office_binary()),
                "pdfWord": importlib.util.find_spec("pdf2docx") is not None,
                "email": bool(office_binary() and importlib.util.find_spec("extract_msg")),
                "svg": importlib.util.find_spec("pymupdf") is not None,
                "vectorRewrite": bool(shutil.which("gs") and importlib.util.find_spec("pymupdf")),
                "powerpoint": importlib.util.find_spec("pptx") is not None,
                "html": importlib.util.find_spec("pymupdf") is not None,
                "optimize": importlib.util.find_spec("pymupdf") is not None,
                "ebook": importlib.util.find_spec("pymupdf") is not None,
                "orient": bool(shutil.which("tesseract") and importlib.util.find_spec("pymupdf")),
                "formDetect": importlib.util.find_spec("cv2") is not None,
                "documentChecks": importlib.util.find_spec("pymupdf") is not None,
                "pdfuaValidate": bool(Path(VERAPDF).is_file() and shutil.which("java")),
                "pdfuaRepair": bool(Path(VERAPDF).is_file() and shutil.which("java") and importlib.util.find_spec("pyhanko")),
                "pdfuaCreate": bool(Path(VERAPDF).is_file() and shutil.which("java") and office_binary()),
                "dewarp": importlib.util.find_spec("cv2") is not None,
                "translate": translation == "ready",
                "wordMerge": bool(office_binary() and importlib.util.find_spec("openpyxl")),
                "zugferd": bool(MUSTANG.is_file() and shutil.which("java") and shutil.which("gs") and Path(VERAPDF).is_file() and ICC.is_file()),
                "pdfa": bool(shutil.which("gs") and Path(VERAPDF).is_file() and ICC.is_file()),
                "xrechnung": bool(shutil.which("java") and KOSIT.is_file() and SCENARIOS.is_file()),
                "signatures": importlib.util.find_spec("pyhanko") is not None}}


@app.post('/v1/audio', dependencies=[Depends(authorize)])
def audio_export(request: str = Form(...)):
    if len(request) > 200000:
        raise HTTPException(413, 'Der Hörbuchauftrag ist zu groß.')
    try:
        settings = validate_audio(json.loads(request))
    except (ValueError, TypeError, KeyError):
        raise HTTPException(422, 'Bitte Stimme, Tempo und 1 bis 100 nicht leere Abschnitte mit insgesamt höchstens 20.000 Zeichen prüfen.')
    if len(voices_available()) != 2:
        raise HTTPException(503, 'Die beiden lokalen Stimmen sind noch nicht installiert.')
    with job() as directory:
        (directory / 'request.json').write_text(json.dumps(settings, ensure_ascii=False))
        code, _ = command([sys.executable, str(Path(__file__).with_name('audio_documents.py')), str(directory)], directory, accepted=(0, 2))
        if code == 2:
            raise HTTPException(422, 'Die Sprachausgabe konnte den Auftrag nicht vollständig verarbeiten. Bitte kürzere Abschnitte auswählen.')
        if (directory / 'output.wav').is_file():
            return result((directory / 'output.wav').read_bytes(), 'Hoerbuch.wav', 'audio/wav')
        if (directory / 'output.zip').is_file():
            return result((directory / 'output.zip').read_bytes(), 'Hoerbuch-Kapitel.zip', 'application/zip')
        raise HTTPException(422, 'Es wurde keine vollständige Audioausgabe erzeugt.')


def translation_status():
    base = os.getenv("MOINPDF_TRANSLATE_URL", "").rstrip("/")
    if not base:
        return "disabled"
    # Normal converters remain usable during the first model download. Probe
    # readiness instead of claiming translation works just because a URL exists.
    try:
        with urlopen(base + "/languages", timeout=2) as response:
            languages = json.load(response)
        available = {item["code"]: set(item["targets"]) for item in languages}
        required = set(os.getenv("MOINPDF_TRANSLATE_LANGUAGES", "de,en,fr,es,it,nl,pl").split(","))
        return "ready" if all(code in available and required <= available[code] for code in required) else "starting"
    except (OSError, ValueError, KeyError, TypeError):
        return "starting"


@app.post("/v1/office", dependencies=[Depends(authorize)])
def office(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".pages", ".vsd", ".vsdx", ".pub"}:
        raise HTTPException(422, "Bitte eine unterstützte Office-Datei auswählen.")
    with job() as directory:
        source = upload(file, directory / ("input" + suffix))
        require_office_container(source)
        output = convert_office(source, directory)
        return result(output.read_bytes(), "Office-Dokument.pdf", "application/pdf")


def require_office_container(source: Path):
    """Prevent LibreOffice's plain-text fallback from accepting corrupt new formats."""
    suffix = source.suffix.lower()
    if suffix in {'.pub', '.vsd'}:
        with source.open('rb') as stream:
            if stream.read(8) != bytes.fromhex('d0cf11e0a1b11ae1'):
                raise HTTPException(422, 'Die Datei enthält kein gültiges Publisher-/Visio-Dokument.')
    elif suffix in {'.pages', '.vsdx'}:
        try:
            with zipfile.ZipFile(source) as bundle:
                entries = bundle.infolist()
                if len(entries) > 10000 or sum(item.file_size for item in entries) > 512 * 1024 * 1024:
                    raise HTTPException(422, 'Das entpackte Office-Dokument ist zu groß.')
                names = {item.filename for item in entries}
                valid = bool(names & {'index.xml', 'index.xml.gz', 'Index/Document.iwa'}) if suffix == '.pages' else {'[Content_Types].xml', 'visio/document.xml'} <= names
                if not valid or any(item.flag_bits & 1 for item in entries):
                    raise ValueError('missing document structure or encrypted archive')
        except (OSError, ValueError, zipfile.BadZipFile):
            raise HTTPException(422, 'Die Datei enthält kein gültiges Pages-/Visio-Dokument.')


def convert_office(source: Path, directory: Path, timeout=TIMEOUT, pdfua=False):
    executable = office_binary()
    if not executable:
        raise HTTPException(503, "LibreOffice ist auf dem Dokumentenserver nicht installiert.")
    profile = directory / "lo-profile" / "user"
    profile.mkdir(parents=True, exist_ok=True)
    # Disable macros and external link updates in this isolated, disposable profile.
    (profile / "registrymodifications.xcu").write_text('''<?xml version="1.0"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Calc/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item></oor:items>''')
    export_filter = 'pdf:writer_pdf_Export:' + json.dumps({
        'PDFUACompliance': {'type': 'boolean', 'value': 'true'},
        'UseTaggedPDF': {'type': 'boolean', 'value': 'true'},
        'DisplayPDFDocumentTitle': {'type': 'boolean', 'value': 'true'},
        'SelectPdfVersion': {'type': 'long', 'value': '17'},
        'ExportBookmarks': {'type': 'boolean', 'value': 'true'},
    }) if pdfua else 'pdf'
    command([executable, f"-env:UserInstallation={(profile.parent).as_uri()}", "--headless", "--nologo", "--nodefault", "--norestore", "--convert-to", export_filter, "--outdir", str(directory), str(source)], directory, timeout=timeout)
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
        response = result(output.read_bytes(), "PDF-zu-Word.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        note = directory / 'word-note.txt'
        if note.is_file(): response.headers['X-MoinPDF-Note'] = quote(note.read_text(encoding='utf-8'))
        return response


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


def pdfua_report(source: Path, profile: str, directory: Path):
    if profile not in {'ua1', 'ua2'}:
        raise HTTPException(422, 'Unterstützte Profile: PDF/UA-1 und PDF/UA-2.')
    code, raw = command([VERAPDF, '--format', 'xml', '--flavour', profile, str(source)], directory, accepted=(0, 1))
    try:
        root = SafeET.fromstring(raw, forbid_dtd=True, forbid_entities=True, forbid_external=True)
        reports = [n for n in root.iter() if n.tag.split('}')[-1] == 'validationReport']
        batches = [n for n in root.iter() if n.tag.split('}')[-1] == 'batchSummary']
        if len(reports) != 1 or len(batches) != 1 or batches[0].get('totalJobs') != '1':
            raise ValueError()
        if 'PDF/UA-' + profile[-1] not in reports[0].get('profileName', ''):
            raise ValueError()
        if any(int(batches[0].get(key, '0')) for key in ('failedToParse', 'encrypted', 'outOfMemory', 'veraExceptions')):
            raise ValueError()
        if any(int(n.get('failedJobs', '0')) for n in batches[0] if n.tag.split('}')[-1] == 'validationReports'):
            raise ValueError()
        passed = code == 0 and reports[0].get('isCompliant') == 'true'
    except Exception:
        raise HTTPException(422, 'Keine vollständige PDF/UA-Prüfung verfügbar. Es wird keine geprüfte PDF ausgegeben.')
    summary = {'profile': profile, 'technicalPassed': passed, 'humanChecksRequired': True, 'engine': 'veraPDF', 'versions': versions(),
               'note': 'Geprüft werden die maschinell prüfbaren PDF/UA-Regeln. Lesereihenfolge, passende Überschriften, richtige Alternativtexte, Vollständigkeit und Kontraste müssen zusätzlich von einem Menschen geprüft werden.'}
    return summary, raw


def pdfua_files(summary, raw):
    return {'Ergebnis.json': json.dumps(summary, ensure_ascii=False, indent=2).encode(), 'veraPDF-Bericht.xml': raw,
            'Manuell-pruefen.txt': (summary['note'] + '\n\nBei neu erstellten Dokumenten außerdem mit der Ausgangsdatei abgleichen. Das Layout wurde neu gesetzt; nur die im Struktureditor enthaltenen Blöcke wurden übernommen.').encode()}


@app.post('/v1/pdfua/validate', dependencies=[Depends(authorize)])
def validate_pdfua(file: UploadFile = File(...), profile: str = Form('ua1')):
    with job() as directory:
        source = upload(file, directory / 'input.pdf')
        require_pdf(source)
        summary, raw = pdfua_report(source, profile, directory)
        response = archive(pdfua_files(summary, raw), 'PDF-UA-Pruefbericht.zip')
        response.headers['X-MoinPDF-Note'] = quote(('Technische PDF/UA-Prüfung bestanden. ' if summary['technicalPassed'] else 'Technische PDF/UA-Prüfung nicht bestanden. ') + summary['note'])
        return response


@app.post('/v1/pdfua/create', dependencies=[Depends(authorize)])
def create_pdfua(request: UploadFile = File(...)):
    with job() as directory:
        upload(request, directory / 'request.json', maximum=8 * 1024 * 1024)
        code, _ = command([sys.executable, str(Path(__file__).with_name('accessible_documents.py')), str(directory)], directory, accepted=(0, 2))
        if code == 2:
            raise HTTPException(422, 'Strukturauftrag ungültig. Titel, Sprache, Überschriftenfolge, Bildbeschreibungen und Größen prüfen.')
        output = convert_office(directory / 'structured.docx', directory, pdfua=True)
        import pymupdf
        with pymupdf.open(output) as generated:
            if not 0 < len(generated) <= 200 or output.stat().st_size > MAX_BYTES:
                raise HTTPException(422, 'Das erzeugte Dokument überschreitet 200 Seiten oder 80 MB.')
        summary, raw = pdfua_report(output, 'ua1', directory)
        files = pdfua_files(summary, raw)
        if summary['technicalPassed']:
            files['PDF-UA-1-technisch-geprueft.pdf'] = output.read_bytes()
        response = archive(files, 'PDF-UA-Ergebnis.zip' if summary['technicalPassed'] else 'PDF-UA-Pruefung-fehlgeschlagen.zip')
        response.headers['X-MoinPDF-Note'] = quote(('Technische PDF/UA-1-Prüfung bestanden. PDF und Prüfbericht liegen in der ZIP-Datei. ' if summary['technicalPassed'] else 'Prüfung nicht bestanden: Die ZIP-Datei enthält ausschließlich Prüfberichte, keine PDF. ') + summary['note'])
        return response


@app.post('/v1/pdfua/structure', dependencies=[Depends(authorize)])
def inspect_pdfua_structure(file: UploadFile = File(...)):
    with job() as directory:
        source=upload(file,directory/'input.pdf');require_pdf(source)
        convert_worker('tag-structure',source,directory)
        return result((directory/'report.json').read_bytes(),'PDF-Struktur.json','application/json')


@app.post('/v1/pdfua/repair', dependencies=[Depends(authorize)])
def repair_pdfua_structure(file: UploadFile = File(...), changes: str = Form(...), profile: str = Form('ua1')):
    if len(changes)>1024*1024:
        raise HTTPException(422,'Der Tag-Auftrag überschreitet 1 MB.')
    try:
        request=json.loads(changes)
        if not isinstance(request,dict):raise ValueError()
    except ValueError:
        raise HTTPException(422,'Ungültiger Tag-Auftrag.')
    with job() as directory:
        source=upload(file,directory/'input.pdf');require_pdf(source)
        (directory/'settings.json').write_text(json.dumps(request))
        convert_worker('tag-repair',source,directory)
        output=directory/'output.pdf'
        if output.stat().st_size>MAX_BYTES:raise HTTPException(422,'Das Ergebnis überschreitet 80 MB.')
        summary,raw=pdfua_report(output,profile,directory)
        files=pdfua_files(summary,raw)
        files['Manuell-pruefen.txt']=(summary['note']+'\nDas ursprüngliche Seitenlayout bleibt erhalten. Die fachliche Richtigkeit der bearbeiteten Tags, Tabellenbeziehungen, Formularbeschreibungen und Lesereihenfolge muss geprüft werden.').encode()
        files['Aenderungen.json']=(directory/'changes.json').read_bytes()
        if summary['technicalPassed']:files['PDF-UA-repariert-technisch-geprueft.pdf']=output.read_bytes()
        response=archive(files,'PDF-UA-Reparatur.zip' if summary['technicalPassed'] else 'PDF-UA-Reparatur-Pruefung-fehlgeschlagen.zip')
        response.headers['X-MoinPDF-Note']=quote(('Technische PDF/UA-Prüfung bestanden; reparierte PDF und Bericht enthalten. ' if summary['technicalPassed'] else 'Prüfung nicht bestanden; ausschließlich Berichte, keine PDF ausgegeben. ')+summary['note'])
        return response


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
def sign_pdf(file: UploadFile = File(...), certificate: UploadFile = File(...), password: str = Form(""), level: str = Form("basic")):
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
            signatures=importlib.import_module((__package__+'.' if __package__ else '')+'signature_documents')
            roots,crls,ocsps=signatures.configured_evidence()
            signed=signatures.sign_bytes(source.read_bytes(),signer,level,roots,crls,ocsps,signatures.configured_timestamper() if level!='basic' else None)
            return result(signed, "Zertifikat-signiert.pdf", "application/pdf")
        except Exception:
            raise HTTPException(422, "Signieren fehlgeschlagen. Zertifikat, Passwort, PDF-Berechtigungen sowie bei Zeitstempeln Vertrauensanker, Sperrnachweise und Zeitstempeldienst prüfen.")


@app.post("/v1/signatures/validate", dependencies=[Depends(authorize)])
def validate_signatures(file: UploadFile = File(...)):
    signatures=importlib.import_module((__package__+'.' if __package__ else '')+'signature_documents')
    with job() as directory:
        source=upload(file,directory/'input.pdf');require_pdf(source)
        try:
            report=signatures.validate_bytes(source.read_bytes(),*signatures.configured_evidence())
        except Exception:
            raise HTTPException(422,'Die Signaturen konnten nicht vollständig ausgewertet werden. PDF und Vertrauenskonfiguration prüfen.')
        return result(json.dumps(report,ensure_ascii=False,indent=2).encode(),'Signaturpruefung.json','application/json')


@app.post('/v1/signatures/renew', dependencies=[Depends(authorize)])
def renew_signatures(file: UploadFile = File(...)):
    signatures=importlib.import_module((__package__+'.' if __package__ else '')+'signature_documents')
    with job() as directory:
        source=upload(file,directory/'input.pdf');require_pdf(source)
        try:
            data=signatures.renew_bytes(source.read_bytes(),*signatures.configured_evidence(),signatures.configured_timestamper())
        except Exception:
            raise HTTPException(422,'Die Langzeitsignatur konnte nicht erneuert und bestätigt werden. Vorhandene LTA-Signatur, Zeitstempeldienst, Vertrauensanker und Sperrnachweise prüfen.')
        if len(data)>MAX_BYTES:raise HTTPException(422,'Das signierte Ergebnis überschreitet 80 MB.')
        return result(data,'Langzeitsignatur-erneuert.pdf','application/pdf')


@app.post('/v1/documents/{action}', dependencies=[Depends(authorize)])
def extended_document(action: str, file: UploadFile = File(...), options: str = Form('{}')):
    allowed={'powerpoint','html','orient','form','print','accessibility','redaction','dewarp','translate','optimize','ebook','svg','font-outlines','flatten-layers'}
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
        if action=='ebook' and Path(file.filename or '').suffix.lower()!='.epub':
            raise HTTPException(422,'Bitte eine EPUB-Datei auswählen.')
        source=upload(file,directory/('input.html' if action=='html' else 'input.epub' if action=='ebook' else 'input.pdf'),maximum=40*1024*1024 if action=='ebook' else MAX_BYTES)
        if action not in {'html','ebook'}:require_pdf(source)
        (directory/'settings.json').write_text(json.dumps(settings))
        convert_worker(action,source,directory)
        if action in {'print','accessibility','redaction'}:
            return result((directory/'report.json').read_bytes(),{'print':'Druckqualitaet','accessibility':'Barrierefreiheit','redaction':'Schwaerzungspruefung'}[action]+'.json','application/json')
        if action=='svg':
            return result((directory/'output.zip').read_bytes(),'PDF-Vektorseiten.zip','application/zip')
        if action=='powerpoint':
            return result((directory/'output.pptx').read_bytes(),'PDF-Folien.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation')
        if action=='orient':
            return archive({'Ausgerichtet.pdf':(directory/'output.pdf').read_bytes(),'Pruefbericht.json':(directory/'report.json').read_bytes()},'Ausrichtung-mit-Bericht.zip')
        name={'html':'Webseite','form':'Erkannte-Formularfelder','dewarp':'Buchscan-entzerrt','translate':'Original-und-Uebersetzung','optimize':'PDF-optimiert','ebook':'E-Book','font-outlines':'Schriftkonturen','flatten-layers':'Ebenen-reduziert'}[action]+'.pdf'
        response=result((directory/'output.pdf').read_bytes(),name,'application/pdf')
        if action in {'optimize','font-outlines','flatten-layers'}:
            note=json.loads((directory/'result-note.json').read_text())['note']
            response.headers['X-MoinPDF-Note']=quote(note)
        return response


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


# A closed operation list intentionally excludes private keys, passwords and
# timestamp/signing side effects. Only idempotent document conversions restart.
QUEUED_OPERATIONS = {'/v1/office', '/v1/pdf-to-word', '/v1/email', '/v1/pdfa/create', '/v1/pdfa/validate', '/v1/pdfua/validate', '/v1/word-merge'} | {'/v1/documents/' + action for action in ['powerpoint', 'html', 'orient', 'form', 'print', 'accessibility', 'redaction', 'dewarp', 'translate', 'optimize', 'ebook', 'svg', 'font-outlines', 'flatten-layers']}
queue_lock = threading.Lock()


def queued_conversion(item, directory):
    with ExitStack() as stack:
        files = {key: UploadFile(file=stack.enter_context((directory / value['path']).open('rb')), filename=value['name']) for key, value in item['files'].items()}
        fields, operation = item['fields'], item['operation']
        file = files.get('file')
        if file is None: raise HTTPException(422, 'Bitte eine Datei auswählen.')
        if operation == '/v1/office': response = office(file)
        elif operation == '/v1/pdf-to-word': response = pdf_to_word(file)
        elif operation == '/v1/email': response = email_to_pdf(file, fields.get('include_attachments', 'true') == 'true')
        elif operation == '/v1/pdfa/create': response = create_pdfa(file, fields.get('profile', '2b'))
        elif operation == '/v1/pdfa/validate': response = validate_pdfa(file, fields.get('profile', '2b'))
        elif operation == '/v1/pdfua/validate': response = validate_pdfua(file, fields.get('profile', 'ua1'))
        elif operation == '/v1/word-merge':
            if 'spreadsheet' not in files: raise HTTPException(422, 'Bitte eine Excel-Tabelle auswählen.')
            response = word_mail_merge(file, files['spreadsheet'])
        elif operation in QUEUED_OPERATIONS and operation.startswith('/v1/documents/'):
            response = extended_document(operation.rsplit('/', 1)[1], file, fields.get('options', '{}'))
        else: raise HTTPException(422, 'Dieser Auftrag kann nicht in der Warteschlange ausgeführt werden.')
        return response.body, response.media_type, {key: value for key, value in response.headers.items() if key.lower() in {'content-disposition', 'x-moinpdf-note'}}


def background_queue():
    with queue_lock:
        if not getattr(app.state, 'job_queue', None) or app.state.job_queue.stopping.is_set():
            app.state.job_queue = JobQueue(os.getenv('MOINPDF_JOB_DIR', '/tmp/moinpdf-jobs'), queued_conversion)
        return app.state.job_queue


@app.exception_handler(QueueError)
async def queue_error(_request, error):
    return JSONResponse({'detail': error.detail}, status_code=error.status)


@app.post('/v1/jobs', dependencies=[Depends(authorize)])
async def submit_job(request: Request, ticket: str = Header('', alias='X-MoinPDF-Job-Ticket')):
    from starlette.concurrency import run_in_threadpool
    from starlette.datastructures import UploadFile as FormUpload
    async with request.form(max_files=2, max_fields=6, max_part_size=200000) as form:
        operation = form.get('operation', '')
        if operation not in QUEUED_OPERATIONS: raise HTTPException(422, 'Dieses Werkzeug unterstützt keine Hintergrundaufträge.')
        fields, uploads, names = {}, [], set()
        for key, value in form.multi_items():
            if key in names: raise HTTPException(422, 'Doppelte Auftragsfelder sind nicht erlaubt.')
            names.add(key)
            if key == 'operation': continue
            if isinstance(value, FormUpload):
                if key not in {'file', 'spreadsheet'}: raise HTTPException(422, 'Unbekanntes Dateifeld.')
                uploads.append((key, value.filename, value.file))
            else:
                if key not in {'options', 'profile', 'include_attachments'} or len(value) > 10000: raise HTTPException(422, 'Ungültige Auftragseinstellungen.')
                fields[key] = value
        if 'file' not in names: raise HTTPException(422, 'Bitte eine Datei auswählen.')
        return await run_in_threadpool(background_queue().submit, ticket, operation, fields, uploads)


@app.get('/v1/jobs/{job_id}', dependencies=[Depends(authorize)])
def job_status(job_id: str, ticket: str = Header('', alias='X-MoinPDF-Job-Ticket')):
    return background_queue().status(job_id, ticket)


@app.get('/v1/jobs/{job_id}/result', dependencies=[Depends(authorize)])
def job_result(job_id: str, ticket: str = Header('', alias='X-MoinPDF-Job-Ticket')):
    data, media, headers = background_queue().output(job_id, ticket)
    return Response(data, media_type=media, headers=headers)


@app.post('/v1/jobs/{job_id}/cancel', dependencies=[Depends(authorize)])
def cancel_job(job_id: str, ticket: str = Header('', alias='X-MoinPDF-Job-Ticket')):
    return background_queue().cancel(job_id, ticket)


@app.post('/v1/jobs/{job_id}/delete', dependencies=[Depends(authorize)])
def delete_job(job_id: str, ticket: str = Header('', alias='X-MoinPDF-Job-Ticket')):
    return background_queue().cancel(job_id, ticket, delete=True)
