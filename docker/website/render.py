"""One disposable Chromium process per job; the browser has no direct network."""
from __future__ import annotations

import asyncio
import json
import os
import signal
import sys
from pathlib import Path

from playwright.async_api import async_playwright, Error, TimeoutError as BrowserTimeout
from network import EgressProxy, WebsiteError, normalize_url, MAX_REQUESTS

TIMEOUT = 65


async def render(settings: dict, directory: Path):
    url = normalize_url(settings['url'])
    async with async_playwright() as driver, EgressProxy() as proxy:
        browser = await driver.chromium.launch(
            executable_path=os.getenv('MOINPDF_CHROMIUM') or None,
            headless=True,
            # The proxy validates and pins every outgoing socket, including
            # redirects or browser traffic not intercepted by request routing.
            proxy={'server': proxy.url, 'bypass': '<-loopback>'},
            args=['--disable-dev-shm-usage', '--disable-quic', '--disable-background-networking',
                  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
                  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
        )
        try:
            context = await browser.new_context(
                service_workers='block', accept_downloads=False,
                viewport={'width': 1280, 'height': 900}, locale='de-DE',
            )
            context.set_default_timeout(15000)
            page = await context.new_page()
            failures = []
            fatal = []
            request_count = 0

            async def route_request(route):
                request = route.request
                main = request.is_navigation_request() and request.frame == page.main_frame
                try:
                    if request.method not in ('GET', 'HEAD') or request.resource_type in ('media', 'websocket'):
                        raise WebsiteError('Interaktive Inhalte wurden nicht geladen.')
                    normalize_url(request.url)
                    await route.continue_()
                except WebsiteError as error:
                    (fatal if main else failures).append(str(error))
                    await route.abort('blockedbyclient')

            def request_started(request):
                nonlocal request_count
                request_count += 1
                if request_count == MAX_REQUESTS + 1:
                    fatal.append('Die Webseite lädt zu viele Ressourcen. Bitte eine kleinere Seite wählen.')
                    asyncio.create_task(context.close())

            async def response_received(response):
                if response.status >= 400:
                    failures.append('http')

            await context.route('**/*', route_request)
            await context.route_web_socket('**/*', lambda ws: ws.close())
            context.on('page', lambda popup: popup.close() if popup != page else None)
            context.on('request', request_started)
            context.on('requestfailed', lambda request: failures.append('network'))
            context.on('response', response_received)
            page.on('dialog', lambda dialog: dialog.dismiss())
            await page.emulate_media(media=settings['media'])
            try:
                response = await page.goto(url, wait_until='domcontentloaded', timeout=30000)
                if not response or response.status >= 400:
                    raise WebsiteError('Die Webseite ist nicht öffentlich erreichbar oder blockiert den Abruf.')
                if not any(kind in response.headers.get('content-type', '').lower()
                           for kind in ('text/html', 'application/xhtml+xml')):
                    raise WebsiteError('Diese Adresse liefert keine HTML-Webseite.')
                # Allow JS content, fonts and bounded lazy loading to settle.
                # A perpetual analytics connection must not stall an export.
                try:
                    await page.wait_for_load_state('networkidle', timeout=8000)
                except BrowserTimeout:
                    failures.append('loading')
                await page.evaluate('''async () => {
                    for (const image of document.images) image.loading = 'eager';
                    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]);
                    const maximum = Math.min(document.documentElement.scrollHeight, 20000);
                    for (let y = 0; y < maximum; y += 900) {
                        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
                    }
                    window.scrollTo(0, 0);
                    await Promise.race([Promise.all(Array.from(document.images).map(image =>
                        image.complete ? Promise.resolve() : new Promise(r => {
                            image.addEventListener('load', r, {once:true});
                            image.addEventListener('error', r, {once:true});
                        }))), new Promise(r => setTimeout(r, 2500))]);
                }''')
                if fatal:
                    raise WebsiteError(fatal[0])
                normalize_url(page.url)
                await page.pdf(
                    path=str(directory / 'output.pdf'), format=settings['paper'],
                    landscape=settings['landscape'], print_background=settings['background'],
                    prefer_css_page_size=False, margin={side: '10mm' for side in ('top', 'right', 'bottom', 'left')},
                    tagged=True, outline=True,
                )
                if (directory / 'output.pdf').stat().st_size > 40 * 1024 * 1024:
                    raise WebsiteError('Die erzeugte PDF ist zu groß. Bitte eine kleinere Webseite wählen.')
                (directory / 'result.json').write_text(json.dumps({'partial': bool(failures or proxy.failures)}))
            except Error as error:
                raise WebsiteError(fatal[0] if fatal else 'Die Webseite konnte nicht geladen werden. Bitte Adresse und Erreichbarkeit prüfen.') from error
        finally:
            await browser.close()


async def main(directory):
    task = asyncio.current_task()
    asyncio.get_running_loop().add_signal_handler(signal.SIGTERM, task.cancel)
    settings = json.loads((directory / 'request.json').read_text())
    try:
        async with asyncio.timeout(TIMEOUT):
            await render(settings, directory)
    except (WebsiteError, TimeoutError) as error:
        message = str(error) if isinstance(error, WebsiteError) else 'Die Webseite konnte nicht rechtzeitig verarbeitet werden.'
        (directory / 'error.json').write_text(json.dumps({'detail': message}))
        return 2
    except asyncio.CancelledError:
        # Unwind render() so Playwright closes its detached browser process
        # before the supervising service removes the temporary directory.
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main(Path(sys.argv[1]))))
