"""Authenticated, bounded website rendering; isolated from document converters."""
from __future__ import annotations

import asyncio
import hmac
import json
import os
import signal
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote, urlsplit

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from network import WebsiteError, normalize_url

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
active = 0


def api_key():
    if os.getenv('MOINPDF_API_KEY'):
        return os.environ['MOINPDF_API_KEY']
    try:
        return Path(os.environ['MOINPDF_API_KEY_FILE']).read_text().strip()
    except (KeyError, OSError):
        return ''


@app.middleware('http')
async def guard(request, call_next):
    if request.url.path.startswith('/v1/'):
        key = api_key()
        if len(key) < 32:
            return JSONResponse({'detail': 'Der Web-Konverter ist noch nicht eingerichtet.'}, status_code=503)
        if not hmac.compare_digest(request.headers.get('authorization', '').encode(), ('Bearer ' + key).encode()):
            return JSONResponse({'detail': 'API-Schlüssel nicht akzeptiert.'}, status_code=401)
        # Count streamed bodies too, not just their optional Content-Length.
        data = bytearray()
        async for part in request.stream():
            data.extend(part)
            if len(data) > 16384:
                return JSONResponse({'detail': 'Die Website-Adresse oder die Einstellungen sind zu lang.'}, status_code=413)
        request._body = bytes(data)
    response = await call_next(request)
    response.headers.update({'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
    return response


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/v1/capabilities')
def capabilities():
    return {'apiVersion': 1, 'service': 'MoinPDF Web-Konverter', 'capabilities': {'website': True}}


@app.post('/v1/website')
async def website(request: Request, url: str = Form(...), options: str = Form('{}')):
    global active
    try:
        address = normalize_url(url)
        settings = json.loads(options)
        if not isinstance(settings, dict) or set(settings) - {'paper', 'landscape', 'background', 'media'}:
            raise ValueError()
        settings = {'paper': 'A4', 'landscape': False, 'background': True, 'media': 'screen', **settings}
        if (settings['paper'] not in ('A4', 'Letter') or settings['media'] not in ('screen', 'print')
                or type(settings['landscape']) is not bool or type(settings['background']) is not bool):
            raise ValueError()
    except WebsiteError as error:
        raise HTTPException(422, str(error)) from None
    except (ValueError, TypeError):
        raise HTTPException(422, 'Bitte Papierformat und Seiteneinstellungen prüfen.') from None
    if active >= 2:
        raise HTTPException(503, 'Der Web-Konverter verarbeitet bereits zwei Aufträge. Bitte später erneut versuchen.')
    active += 1
    try:
        with tempfile.TemporaryDirectory(prefix='moinpdf-website-') as temporary:
            directory = Path(temporary)
            (directory / 'request.json').write_text(json.dumps({**settings, 'url': address}))
            # No service credentials or environment proxies in the renderer.
            environment = {key: os.environ[key] for key in ('PATH', 'PLAYWRIGHT_BROWSERS_PATH', 'MOINPDF_CHROMIUM', 'LANG') if key in os.environ}
            environment.update(HOME=temporary, TMPDIR=temporary)
            process = await asyncio.create_subprocess_exec(
                sys.executable, str(Path(__file__).with_name('render.py')), temporary,
                env=environment, cwd=temporary, start_new_session=True,
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            wait = asyncio.create_task(process.wait())
            try:
                async with asyncio.timeout(70):
                    while not wait.done():
                        if await request.is_disconnected():
                            raise HTTPException(499, 'Der Auftrag wurde abgebrochen.')
                        await asyncio.wait({wait}, timeout=0.2)
                    code = await wait
            except TimeoutError:
                raise HTTPException(504, 'Die Webseite konnte nicht rechtzeitig verarbeitet werden.') from None
            finally:
                # Graceful cancellation lets Playwright close Chromium, which
                # can have its own process group. Enforce a short final bound.
                if not wait.done():
                    try:
                        os.killpg(process.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                    try:
                        await asyncio.wait_for(asyncio.shield(wait), timeout=5)
                    except TimeoutError:
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                await wait
            if code != 0:
                message = 'Die Webseite konnte nicht geladen werden. Bitte Adresse und Erreichbarkeit prüfen.'
                if (directory / 'error.json').is_file():
                    message = json.loads((directory / 'error.json').read_text())['detail']
                raise HTTPException(422, message)
            output = directory / 'output.pdf'
            if not output.is_file() or output.stat().st_size > 40 * 1024 * 1024:
                raise HTTPException(422, 'Es wurde keine vollständige PDF erzeugt.')
            data = output.read_bytes()
            if not data.startswith(b'%PDF-'):
                raise HTTPException(422, 'Es wurde keine vollständige PDF erzeugt.')
            filename = 'Webseite-' + urlsplit(address).hostname.replace(':', '-') + '.pdf'
            headers = {'Content-Disposition': "attachment; filename*=UTF-8''" + quote(filename)}
            if json.loads((directory / 'result.json').read_text())['partial']:
                headers['X-MoinPDF-Note'] = quote('Einzelne Inhalte konnten nicht geladen werden. Bitte die Vorschau prüfen.')
            return Response(data, media_type='application/pdf', headers=headers)
    finally:
        active -= 1
