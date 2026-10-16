<p align="center">
  <a href="README.md">Deutsch</a> · <strong>English</strong>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/branding/moinpdf-wordmark-dark.svg">
    <img src="public/branding/moinpdf-wordmark.svg" alt="MoinPDF" width="340">
  </picture>
</p>

<p align="center"><strong>Paperwork. Sorted.</strong></p>

<p align="center">
  <a href="https://github.com/MoinPDF/moinpdf/releases/latest"><img src="https://img.shields.io/github/v/release/MoinPDF/moinpdf?style=flat&amp;color=168378&amp;label=version" alt="Latest version"></a>
  <a href="https://github.com/MoinPDF/moinpdf/actions/workflows/docker.yml"><img src="https://github.com/MoinPDF/moinpdf/actions/workflows/docker.yml/badge.svg?branch=main" alt="Complete Docker installation checks"></a>
</p>

<p align="center">
  <a href="#quick-start">Install</a> ·
  <a href="#what-you-can-do-with-moinpdf">Features</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#media-and-contact">Media &amp; contact</a>
</p>

<p align="center">
  <img src="public/branding/moinpdf-harbor.webp" alt="A sailor salvaging a printer in the harbour – the MoinPDF harbour artwork." width="1000">
</p>

MoinPDF brings **tools** into one workspace. Open your files, choose a task or search in your own words, review the result and download it. Many tools process documents directly on your device. The complete Docker installation adds your own services for advanced conversion, validation, translation and audio.

**German and English** are available in both the app and this repository's documentation. Each guide links directly to its other language version.

## What you can do with MoinPDF

| Your task | Tools to help |
| --- | --- |
| **Organise pages** | Merge, split, rotate, reorder, crop, number, bookmark and print posters |
| **Edit PDFs** | Text and original objects, paragraphs with previews, images, notes, highlights, redactions and forms |
| **Make scans searchable** | OCR with 21 languages, up to eight combined, searchable PDFs, scan enhancement and a camera scanner |
| **Convert files** | Images, text, tables and local Office conversion; additional Office formats, emails and website links with the server |
| **Check content** | Text and image comparison, numbers, arithmetic, missing pages and reports with source references |
| **Work with invoices** | Read UBL/CII and compare PDF with XML; KoSIT XRechnung validation and a ZUGFeRD wizard with the server |
| **Handle repetitive work** | Batches, saved workflows, receipt fields, returned forms and document timelines |
| **Do more with documents** | Layers, a measuring tool and local projects; PDF translation and audiobooks with the server |

See [Features](docs/FEATURES.en.md) and [Implementation status](docs/STATUS.en.md) for the precise scope and limitations.

## Quick start

You need **Docker Engine with Compose v2 or Docker Desktop**, internet access for the initial setup and, as a starting point, **8 GB of available RAM and 20 GB of free disk space**.

```bash
git clone https://github.com/MoinPDF/moinpdf.git
cd moinpdf
docker compose up -d --build
```

Then open **[localhost:8080](http://localhost:8080)**. The web app, document server, website converter and translation service are set up together. The default setup needs neither an `.env` file nor manually entered API keys. Programs and language models are downloaded on the first start, which may take several minutes.

**[Complete Docker guide →](DOCKER.en.md)** · [HTTPS and camera](DOCKER.en.md#https-and-camera) · [Updates and data](DOCKER.en.md#updates-restarts-and-data)

## One workspace from start to finish

1. **Open:** Add PDFs, images or invoice XML, or start with a sample document.
2. **Edit:** Use a shortcut or search. File names, page counts and sizes remain visible in the document overview; open the tool sidebar whenever you need it.
3. **Review and take it with you:** Download the result or use it directly as a new working document. On phones, a compact action bar keeps the main actions within reach.

**Projects** keep up to five local working states, including original files and editing history. A `.moinpdf` project file transfers a state to another device. Browser projects and project archives are unencrypted and include originals and earlier edits; use the final output file when sharing completed documents.

## Where your documents are processed

| Mode | Processing |
| --- | --- |
| **Browser tools** | On your device. Program files and OCR language data are loaded from the same origin. |
| **Server tools** | On your MoinPDF installation after you start a job. Any proxies in front of it may be part of the transfer path. |
| **Website to PDF** | The separate website converter fetches the public address. It does not inherit your browser's login or cookies. |

A static web build does not provide a running document server by itself. Use the Docker installation for the complete set of features. Check important results against the original; modifying PDFs may invalidate existing digital signatures.

## Documentation

In the app, **Documentation** opens the searchable handbook for all 112 tools, with direct links and a print view. Technical guides are available here in both languages:

| Topic | Deutsch | English |
| --- | --- | --- |
| Installation, HTTPS and operation | [Docker](DOCKER.md) | [Docker](DOCKER.en.md) |
| Tools and limitations | [Funktionen](docs/FUNKTIONEN.md) | [Features](docs/FEATURES.en.md) |
| Implemented and outstanding features | [Ausbaustand](docs/AUSBAUSTAND.md) | [Implementation status](docs/STATUS.en.md) |
| Office locally in the browser | [Browser-Office](docs/BROWSER-OFFICE.md) | [Browser Office](docs/BROWSER-OFFICE.en.md) |
| Separate document server and API | [Server](server/README.md) | [Server](server/README.en.md) |
| Setup, tests and releases | [Entwicklung](docs/ENTWICKLUNG.md) | [Development](docs/DEVELOPMENT.en.md) |
| Validation and what it establishes | [Validierung](VALIDATION.md) | [Validation](VALIDATION.en.md) |
| Version history | [Änderungen](CHANGELOG.md) | [Changelog](CHANGELOG.en.md) |
| Feedback and contributions | [Mitwirken](CONTRIBUTING.md) | [Contributing](CONTRIBUTING.en.md) |
| Reporting security issues | [Sicherheit](SECURITY.md) | [Security](SECURITY.en.md) |
| Project-wide licence status | [Lizenzhinweis](LICENSE) | [License notice](LICENSE.en.md) |

**[Latest release](https://github.com/MoinPDF/moinpdf/releases/latest)** · [All releases](https://github.com/MoinPDF/moinpdf/releases) · [Current checks](https://github.com/MoinPDF/moinpdf/actions)

## Develop and contribute

The browser workspace uses React and TypeScript, PDF.js, pdf-lib and Tesseract. Docker services add tools including LibreOffice, Ghostscript, KoSIT, veraPDF and LibreTranslate. Setup, component notices and verification steps are in the [development guide](docs/DEVELOPMENT.en.md).

Report bugs and ideas using the **[German or English issue templates](https://github.com/MoinPDF/moinpdf/issues/new/choose)**. Please use synthetic sample files. For security reports, use the confidential contact in [SECURITY.en.md](SECURITY.en.md).

## Media and contact

Banners, wordmarks, the “Printer overboard?” clip and download packages are available in the app's **Media** section. Files are in [public/media](public/media), with a catalogue in [media/banner-catalog.json](media/banner-catalog.json). The [usage notes](public/en/media/moinpdf-usage.txt) explain permitted use of the press materials.

- Questions and feedback: **[ahoi@moinpdf.de](mailto:ahoi@moinpdf.de)**
- Privacy and confidential security reports: **[post@moinpdf.de](mailto:post@moinpdf.de)**

## Licence status

The source code is publicly viewable. The project as a whole has **no blanket open-source licence**; see the [English licence notice](LICENSE.en.md) and [original LICENSE](LICENSE). Explicitly licensed files and third-party components retain their respective rights and notices.

---

<p align="center">
  <img src="public/branding/moinpdf-sailor.webp" alt="The MoinPDF sailor" width="56"><br>
  <strong>MoinPDF · Paperwork. Sorted.</strong><br>
  <a href="README.md">Diese Seite auf Deutsch lesen</a>
</p>
