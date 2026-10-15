# Complete installation with Docker Compose

[Deutsch](DOCKER.md) · **English** · [← README](README.en.md)

The Compose setup in the **repository root** includes the web app, document server, website converter and LibreTranslate. All tool views are included. The browser connects automatically to your document server; you do not need to enter server addresses or API keys. Each tool's document-related limitations still apply in Docker.

## Start

Requirements: Docker Engine with Compose v2 or Docker Desktop, internet access for the first build and website-link conversions, and sufficient resources. For the complete stack, start with **8 GB of available RAM and 20 GB of free disk space**. Container limits can be adjusted in `.env.example`. The installation builds locally and does not require private container-registry credentials. The source code is public; cloning the repository does not require a GitHub login.

```bash
git clone https://github.com/MoinPDF/moinpdf.git
cd moinpdf
docker compose up -d --build
```

Then open **http://localhost:8080** or **http://SERVER-IP:8080**. The default setup does not require an `.env` file. The older `docker-compose` command can also be used on installations with a compatible Compose v2 binary.

The first start takes longer while images, converters and language models are downloaded. Compose waits for model installation and service readiness. Afterwards, `initialize` and `translation-models` may show **Exited (0)**: they have successfully completed their one-time setup. The four running services, `app`, `documents`, `translation` and `website`, should be **healthy**.

```bash
docker compose ps -a
docker compose logs -f translation-models translation
```

To start with an explicit readiness check:

```bash
docker compose up -d --build --wait --wait-timeout 1800
```

## Included components

| Area | Available automatically |
| --- | --- |
| Web app | Standalone production build, local fonts, PDF.js, qpdf-WASM and OCR files |
| Browser OCR | 21 local OCR languages, up to eight combined, with optional automatic language sampling |
| Document server | LibreOffice, Ghostscript, Tesseract OSD, pdf2docx, EML/MSG import, PowerPoint, form detection and document checks |
| Website converter | Chromium for public website links with images, fonts and CSS |
| Invoices and archiving | KoSIT, XRechnung rules, veraPDF, Mustang/ZUGFeRD and pyHanko |
| Translation | LibreTranslate with German, English, French, Spanish, Italian, Dutch and Polish |
| Connection | Shared web address, internal random API key and automatic capability checks in the app |

Setup downloads the required language pairs, including English as a pivot language, and performs initial translations so that sentence-splitting models are cached too. Interrupted downloads are resumed on the next attempt. Models and caches are stored in Docker volumes. Model initialisation has internet access; **the document server and running translation service are isolated in the internal Docker network**. Later starts reuse complete, prepared models.

PDF translation requires extractable text; run OCR on scans first. It can produce original text and translation side by side. The app interface can switch independently between German and English. Operators still provide their own signing certificate and, where needed, trusted CA certificates.

## Settings and optional login

```bash
cp .env.example .env
```

| Setting | Default | Meaning |
| --- | --- | --- |
| `MOINPDF_PORT` | `8080` | Web app port |
| `MOINPDF_BIND` | `0.0.0.0` | Bind to all host addresses; `127.0.0.1` restricts access to the host |
| `MOINPDF_USERNAME` | `moinpdf` | Username for the optional login |
| `MOINPDF_PASSWORD` | empty | When set, HTTP Basic Auth protects the entire app and its API |
| `MOINPDF_DOCUMENT_MEMORY` | `2g` | Memory limit for converters and temporary documents |
| `MOINPDF_WEBSITE_MEMORY` | `1g` | Memory limit for the website converter |
| `MOINPDF_TRANSLATION_MEMORY` | `4g` | Memory limit for LibreTranslate |

Run `docker compose up -d` after making changes. Put passwords containing special characters in single quotes in `.env`. This file is not versioned. The default setup is intended for your own computer or a trusted network; use HTTPS and access protection when exposing it publicly.

## HTTPS and camera

Browsers allow camera access on `localhost` or over HTTPS. Ordinary file upload remains available when accessing a server IP without HTTPS. An existing HTTPS reverse proxy can forward to port 8080; allow at least 85 MB uploads and a 200-second timeout for document jobs. The app expects the root path of its own domain, not a subdirectory.

Automatic HTTPS setup with Caddy is also included. Set `MOINPDF_DOMAIN` in `.env`, point DNS at the server and make ports 80/443 reachable:

```bash
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

Then open `https://YOUR-DOMAIN`. Use the same two `-f` arguments for subsequent Compose commands. Certificates remain in the `caddy_data` volume.

## Legal notice and privacy

The legal notice and privacy policy are small links at the bottom of every tool view. They open a new tab to preserve the current document session. Both pages are delivered with the app and require no externally loaded fonts or scripts.

The provider details in `public/impressum.html` and `public/datenschutz.html` describe the original MoinPDF instance: its own server behind Cloudflare and a contact mailbox at Tuta (Tutao GmbH). The policy describes local editing, server jobs and translations, browser storage and processing by these providers. It explains that document jobs transmitted through Cloudflare, including their contents, pass through its infrastructure. Operators of independent instances must adapt these details to their own deployment.

Before making an instance public, compare the actual Cloudflare protection features, security cookies, logs and deletion rules with the policy. The default configuration enables HTTP access logs in neither Caddy nor the document server; Docker, host and Cloudflare operational/error logs are separate. Limit and document their retention. Check any required data-processing agreements with the providers you use; the privacy policy does not replace them. Include any additional data-centre or hosting provider you use.

All Compose services use Docker's `local` log driver with at most three log files of 10 MB each. Rotation removes older files. This limits volume but does not delete logs after a fixed number of days. Existing containers adopt the setting on the next `docker compose up -d`; it does not change logs from other services, tunnels or the host.

For Cloudflare, secure transport to your own server: use “Full (strict)” for a public HTTPS origin with a valid certificate, or an appropriately secured local connection when using Cloudflare Tunnel. Do not add caching rules for document and website APIs or their results (`/api/documents/*` and `/api/website/*`); the included proxy sets `Cache-Control: no-store` there. The app enables no external analytics trackers. Analytics or login services enabled separately in your Cloudflare account must be considered separately.

Styling: `public/legal/legal.css`; in-app links: `components/studio/legal-footer.tsx`. Rebuild the web app with `docker compose up -d --build` after changes.

## Updates, restarts and data

```bash
git pull --ff-only
docker compose build --pull
docker compose up -d --wait --wait-timeout 1800
```

`docker compose stop` stops services; `docker compose up -d` starts them again. `docker compose down` removes containers and networks but keeps volumes. **`docker compose down -v` also deletes keys, models, caches and HTTPS certificates** and is intended only for a deliberate complete reset.

Documents and results are not stored permanently in Docker volumes. Server jobs use temporary directories; browser documents live in the session. Download results before closing it. Volumes contain only operational data. Backing up volumes saves downloads during recovery and preserves the internal key and HTTPS certificates.

## Troubleshooting

- **First start is waiting:** Run `docker compose logs -f translation-models`. Downloads may take several minutes; failed attempts are retried. An empty installation cannot be set up without internet access.
- **Container stopped / exit 137:** Check available memory and Docker Desktop's RAM allocation; increase available resources or the relevant container memory limits.
- **Port already in use:** Change `MOINPDF_PORT` in `.env`, then run `docker compose up -d`.
- **Server features missing:** Check `docker compose logs documents` and `docker compose ps -a`, then rebuild the images and choose “Try again” in the app.
- **API returns 403:** The app automatically sends `X-MoinPDF-Client: web`. The web proxy rejects direct requests without this header and requests from other browser origins. This installation does not use a public bearer key.

## Automated verification

The `.github/workflows/docker.yml` workflow builds the actual images, runs browser and converter tests, starts the complete stack with all seven languages and checks a real German/English PDF translation through the web proxy. It also checks local OCR/PDF assets, Office conversion, restart with existing volumes and the optional login. Look for a successful run under **GitHub → Actions → Complete Docker installation**.

For a local integration check after starting the stack:

```bash
docker compose run --rm --no-deps --volume "$PWD:/repo:ro" documents python /repo/tests/selfhost-smoke.py
```

When login is enabled, also pass `--env MOINPDF_TEST_USERNAME=... --env MOINPDF_TEST_PASSWORD=...`. Use this test only with its included synthetic test material.

The standalone document API is documented in [server/README.en.md](server/README.en.md). Since 0.2.0, the interface no longer offers a manual API connection; use the complete Docker edition for all converters. Converter and Python dependency versions are documented there. LibreTranslate is based on [v1.9.6](https://github.com/LibreTranslate/LibreTranslate/tree/v1.9.6); see the [upstream documentation](https://docs.libretranslate.com/guides/build_from_sources/) for model and licence information.

## Website link to PDF

“HTML & websites to PDF” accepts a public website link. The additional `website` service contains Chromium and creates PDFs with images, fonts and CSS, with screen or print rendering, A4/Letter and portrait/landscape options. It is included in `compose.yaml` and requires no third-party API. Rebuild and restart the entire stack when updating so that the service and proxy route are included. For statically hosted web files, both `/api/documents/*` and `/api/website/*` must route to the Docker web container.

Only `website` receives internet access for this task. `documents` and `translation` remain on the internal network. The browser uses a local HTTP/HTTPS proxy that passes only public DNS answers to the socket on every connection. Direct DNS resolution, QUIC and WebRTC connections outside the proxy are disabled. Redirects, scripts and embedded content undergo the same checks. Loopback, private/link-local networks, IPv6 transition addresses, credentials in URLs and non-standard ports are blocked. WebSockets, service workers and HTTP requests that write data are disabled.

Each job is limited to 160 requests, 40 MiB of transferred web resources and 40 MiB of PDF output. The entire process group is terminated after at most 75 seconds or upon a detected disconnect. At most two jobs run simultaneously. Temporary files and browser profiles are then removed; URL queries are not logged. Missing resources are identified in the result. Login pages, cookie banners, bot protection and some dynamic content may limit the output.

The service defaults to 1 GiB of RAM (`MOINPDF_WEBSITE_MEMORY`). Chromium comes from Debian security updates for amd64 and arm64; rebuild the image regularly to incorporate browser security fixes.

---

[README](README.en.md) · [Features](docs/FEATURES.en.md) · [Development](docs/DEVELOPMENT.en.md)
