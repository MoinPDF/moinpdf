# MoinPDF document server

[Deutsch](README.md) · **English** · [← Project README](../README.en.md)

> **For the complete app including translation:** run `docker compose up -d --build` in the repository root. See the [Docker guide](../DOCKER.en.md). The guide below covers a separate document API for an independently hosted web app or API client. Since 0.2.0, the standard interface no longer offers fields for manually entering a server address and API key; separate deployments must configure the appropriate integration/proxy.

Many tools process files locally in the browser. This server adds the conversions and checks described below:

| Feature | Processing | Result |
| --- | --- | --- |
| Office to PDF | LibreOffice (Word, Excel, PowerPoint, OpenDocument, Pages, Visio, Publisher) | PDF |
| Create and validate PDF/A | Ghostscript and veraPDF, profiles 1b/2b/3b | Archive copy + XML validation report + JSON in a ZIP |
| Full XRechnung validation | KoSIT 1.6.3, XRechnung configuration 3.0.2 dated 31 August 2026 | Complete XSD/Schematron report in a ZIP |
| Certificate signatures | pyHanko, PKCS#12 and verification of existing signatures | Signed PDF or JSON report |

The complete Docker installation connects the web app and document server automatically. Separately hosted integrations must configure server access and authentication themselves. Capability checks do not transfer documents. Files are sent only when the corresponding processing job starts.

## Start a separate document server with Docker Compose

Requirements: a Linux server with Docker Compose, about 2 GB of free RAM, a domain pointing at the server and reachable ports 80/443. The supplied Compose file runs Caddy with HTTPS and keeps the document container on an internal network without outbound internet access.

```bash
cd server
cp .env.example .env
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Enter the generated key, server domain and exact app origin in `.env`. `MOINPDF_ORIGINS` may contain multiple comma-separated app origins, without trailing slashes. Do not commit `.env`.

```bash
docker compose up -d --build
docker compose ps
```

Connect the API through your own integration/proxy and use the configured key. The capability endpoint reports each server component as ready or missing. The server does not start document jobs without a sufficiently strong key. For the standard app, use the automatic connection provided by the root-level Docker installation.

## Checks and operational behaviour

- Each job uses its own temporary directory, which is deleted afterwards. Jobs and file contents are not stored permanently. The MoinPDF API key is not passed to converter subprocesses. Only translation jobs receive the separately configured LibreTranslate key when needed. Certificate passwords appear in neither command lines nor reports.
- At most two document jobs run simultaneously; native converters and their child processes are terminated after three minutes. Limits: 80 MB files, 10 MB invoice XML, 2 MB certificates. Cancelling an HTTP request in the browser initially stops waiting; a server job already started continues until completion or timeout.
- LibreOffice uses a fresh profile with macros disabled. The container has a read-only filesystem, a temporary working directory and no internet access. Office layout depends partly on available fonts. Operators may add their own licensed fonts when building the image.
- PDF/A is considered conformant only after passing veraPDF validation. Failed outputs are explicitly named `NICHT-PDF-A-konform.pdf`. The archive copy may change or lose forms, attachments, active elements and existing signatures; the original is preserved. Profile 3b alone does not create a ZUGFeRD invoice.
- KoSIT applies the fully installed scenario configuration. Acceptance and version are in `Ergebnis.json`; all individual rules remain in the unmodified XML report. DTDs and external XML entities are rejected.
- Signature verification distinguishes cryptographic integrity, document changes, certificate trust, revocation and timestamps. Custom trusted CA certificates belong in `trust/` as PEM; revocation evidence belongs in `trust/revocation/` as DER files ending in `.crl` or `.ocsp`. Embedded DSS evidence is also checked. Missing or expired evidence does not establish trust; certificate addresses are not queried automatically over the network. Qualified signature status is not confirmed.
- The basic signing profile uses no external timestamp. PAdES-T, -LT and -LTA, and renewal of an LTA timestamp chain, require explicit trust anchors, matching revocation evidence and an HTTPS `MOINPDF_TSA_URL`; optional `MOINPDF_TSA_BEARER` authenticates the operator to the timestamp service. Operators must configure targeted connectivity from the isolated network. Setting the URL does not open the container network. Failed signature, timestamp or long-term checks block advanced output.

## Local development and tests

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.lock.txt
pip install httpx==0.28.1
cd ..
python tests/fetch-office-fixtures.py
python -m unittest server.test_service server.test_expansion server.test_extended_documents server.test_expansion_documents server.test_tags server.test_signatures server.test_import_formats -v
```

Native integration tests run when Java, Ghostscript and the tools installed in `MOINPDF_TOOLS` are available. Office tests also require LibreOffice; both `libreoffice` and `soffice` command names are supported. Office checks convert synthetic DOCX, XLSX, PPTX, ODT, ODS and ODP files and read each PDF independently afterwards. Missing native components are reported as skipped. To install into a local directory:

```bash
MOINPDF_TOOLS="$PWD/server/tools" python server/install_tools.py
MOINPDF_TOOLS="$PWD/server/tools" python -m unittest server.test_service server.test_expansion server.test_extended_documents -v
```

## Versions and sources

`tools.lock.json` pins download URLs and SHA-256 checksums. Installation stops on a checksum mismatch. `requirements.lock.txt` records the tested Python package versions. Update upstream versions and their rules deliberately and retest them.

- [LibreOffice: PDF export parameters](https://help.libreoffice.org/latest/en-US/text/shared/guide/pdf_params.html)
- [LibreOffice: command-line parameters](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html)
- [KoSIT: validator and CLI](https://github.com/itplr-kosit/validator/blob/v1.6.3/docs/cli.md)
- [KoSIT: XRechnung configuration](https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-08-31)
- [veraPDF: installation](https://docs.verapdf.org/install/) and [validation](https://docs.verapdf.org/cli/validation/)
- [pyHanko: signature library](https://docs.pyhanko.eu/en/stable/lib-guide/signing.html)

Downloaded programs are governed by their upstream licences. In particular, consider Ghostscript's AGPL licence when distributing the container image. Licence files are included in the installed distributions.

## Advanced tools

The current server adds PDF→Word (pdf2docx), PDF→PowerPoint (python-pptx), EML/MSG→PDF (email/extract-msg and LibreOffice), static HTML import (MuPDF Story), Tesseract OSD orientation, book-gutter correction, form detection, document checks, Word/Excel mail merge and ZUGFeRD (Mustang 2.26.0). The app checks each capability separately; rebuild the Docker image after updating code.

Additional API routes:

- `POST /v1/pdf-to-word`: PDF as `file`, DOCX result; layout reconstruction, with image-only scans rejected with an OCR hint.
- `POST /v1/office` also supports Pages 4/5, VSD/VSDX and Publisher. Renamed text files and archives without the required document structure are rejected. Real examples are checked using pinned LibreOffice test data; complex layouts still depend on LibreOffice support and installed fonts.
- `POST /v1/email`: EML/MSG as `file`, `include_attachments=true|false`; PDF or ZIP with unchanged attachments. External email images are not loaded.
- `POST /v1/documents/{action}`: `powerpoint`, `html`, `orient`, `form`, `print`, `accessibility`, `redaction`, `dewarp`, `translate`; file and optional JSON form field `options`.
- `POST /v1/word-merge`: DOCX as `file`, XLSX as `spreadsheet`; placeholders such as `{{Name}}` match Excel column names. First worksheet, at most 50 records and 50 columns. Convert formulas to values first. Formatting is preserved where possible for placeholders spanning multiple Word runs.
- `POST /v1/zugferd/create`: PDF as `file`, matching CII XML as `invoice`, profile `E`, `B`, `T` or `X`. PDF/A-3 conversion, then embedding and Mustang/veraPDF checks. Failed results are explicitly named `NICHT-VALIDIERT-Rechnung.pdf`.
- `POST /v1/zugferd/validate`: existing hybrid PDF as `file`; ZIP with a machine-readable overall result and both raw reports.

Print quality, accessibility and redaction checks provide technical findings, not comprehensive approval. Redaction checks search text and metadata and identify potential later dark vector overlays; they do not examine old revisions or all image/attachment content. Book-gutter correction is a manually adjustable quadratic column shift, not general automatic 3D dewarping. Saved HTML is laid out again without scripts, CSS, images or external resources.

### Optional: your own translation service

`MOINPDF_TRANSLATE_URL` points to the base URL of your own LibreTranslate service, with optional `MOINPDF_TRANSLATE_KEY`. Translation remains disabled without this setting. The hostname is shown in the app, and the disclosure identifies the transfer of extracted text. Configuration does not accept a destination supplied by a document. The existing internal Docker network remains unchanged: LibreTranslate must be reachable within it. Install the necessary language models in the translation service beforehand. Manage keys only in the local `.env` and do not commit them.

### Checking the extensions

```sh
python -m unittest server.test_service server.test_expansion server.test_extended_documents -v
```

The suite checks real converters and file contents: DOCX text, EML/MSG attachment bytes, PowerPoint page images, HTML text, OSD rotation, editable detected fields, concealed text, low image resolution, tag gaps, curve correction and two individual mail-merge PDFs. Mustang/veraPDF validate a valid ZUGFeRD result and reject an ordinary PDF as nonconformant. Translation API tests use a local HTTP test response, not a connected production service. The `../.github/workflows/docker.yml` workflow also builds and checks the complete Docker stack with real translation.

Observe additional dependencies and their licences, particularly PyMuPDF/MuPDF (AGPL or commercial licence); the optional document server is separate from the browser bundle.

## Compression and EPUB (since 0.3.0)

`POST /v1/documents/optimize` accepts a PDF and `options` with `targetMB` (0.05–80) and `optimizeMode` (`images` or `lossless`). Each quality level starts from the original. Text, links and form fields are preserved. The `X-MoinPDF-Note` header contains a URL-encoded result message including the actual target-size status. A missed target is not reported as a successful size match.

`POST /v1/documents/ebook` accepts unprotected `.epub` files up to 40 MB. `options`: `paper` (`a4`/`a5`) and `fontSize` (8–24 pt). Limits: 80 MB unpacked, 1500 archive entries and 200 output pages. The isolated worker sanitises active/external resources, rejects encrypted archives/content and does not extract archive paths to the filesystem. PDF links are not retained.

Test: `python -m unittest server.test_recovery -v`.

## Local audiobooks (0.5.0)

`POST /v1/audio` accepts an authenticated multipart field `request` containing JSON: `voice` (`thorsten` or `kerstin`), `speed` (0.75–1.5), and `sections`, each with `title` and validated plain-text `text`. Model paths, download URLs and original PDFs are not accepted. One section produces WAV; multiple sections produce a ZIP with numbered WAV files, `Kapitel.json` and `Hoerbuch.m3u8`.

Limits: 20,000 characters, 100 sections, 80 MiB PCM output, two simultaneous document jobs and 180 seconds of process time. ONNX uses at most two CPU threads per job. The existing process-group limit also terminates subprocesses; all job files stay exclusively in the temporary job directory. Cancelling in the browser stops the request, while the server job may continue until completion or timeout.

Piper and its runtime dependencies are pinned in `requirements.lock.txt`. `install_voices.py` downloads only the immutable revisions in `voices.lock.json` and verifies each model, configuration and model card. Both German voices are installed during image construction; the document service needs no internet access at runtime. Missing models disable the `speech` capability. `/v1/capabilities` reports available `audioVoices` and text/section limits. Licence information: [AUDIO-NOTICES.md](AUDIO-NOTICES.md).

For local tests, install Python dependencies, set `MOINPDF_TOOLS` to a dedicated test directory, run `python server/install_voices.py`, then `python -m unittest server.test_audio -v`. The test generates real WAV files with both models, checks format, signal and speed, and performs an authenticated chapter ZIP export. In Docker, this test runs without a network.

---

[Project README](../README.en.md) · [Complete Docker installation](../DOCKER.en.md) · [Development](../docs/DEVELOPMENT.en.md)
