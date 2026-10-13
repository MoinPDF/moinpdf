"""Security boundaries and real Chromium output using synthetic public pages."""
import asyncio
import json
import os
from pathlib import Path
import socket
import tempfile
import threading
import unittest
from types import SimpleNamespace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import AsyncMock, patch

import httpx
import pymupdf

import app as service
import network
from network import normalize_url, public_address, PublicResolver, EgressProxy, WebsiteError
from render import render


class Addresses(unittest.IsolatedAsyncioTestCase):
    def test_url_boundary(self):
        self.assertEqual(normalize_url(' example.org/page?q=1#part '), 'https://example.org/page?q=1#part')
        self.assertEqual(normalize_url('https://bücher.de/'), 'https://xn--bcher-kva.de/')
        self.assertEqual(normalize_url('https://example.org:443/'), 'https://example.org/')
        for value in ('http://localhost/', 'http://sub.localhost/', 'http://192.168.1.1/',
                      'http://127.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/',
                      'http://169.254.169.254/latest/meta-data/', 'http://[::1]/',
                      'http://[::ffff:127.0.0.1]/', 'https://[64:ff9b::7f00:1]/',
                      'https://[2002:7f00:1::]/', 'file:///etc/passwd', 'ftp://example.org/',
                      'data:text/html,test', 'https://user:password@example.org/',
                      'https://example.org:8443/', 'http://user@127.0.0.1/',
                      'https://example.org\\@127.0.0.1/', 'https://example.org/\nadmin',
                      'https://[fe80::1%25eth0]/', 'https://printer.local/', ''):
            with self.subTest(value=value), self.assertRaises(WebsiteError):
                normalize_url(value)

    def test_nonpublic_ip_ranges(self):
        for address in ('0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '172.16.0.1',
                        '192.168.0.1', '169.254.1.1', '224.0.0.1', '240.0.0.1',
                        '::', '::1', 'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1',
                        '::ffff:8.8.8.8', '64:ff9b::a00:1', '2002:0808:0808::'):
            self.assertFalse(public_address(address), address)
        self.assertTrue(public_address('93.184.216.34'))
        self.assertTrue(public_address('2606:4700:4700::1111'))

    async def test_dns_checked_at_resolution_and_every_new_connection(self):
        def answer(ip):
            return (socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, 443))
        resolver = PublicResolver()
        loop = asyncio.get_running_loop()
        with patch.object(loop, 'getaddrinfo', AsyncMock(side_effect=[
            [answer('93.184.216.34')], [answer('127.0.0.1')],
            [answer('93.184.216.34'), answer('10.0.0.1')],
        ])) as lookup:
            values = await resolver.resolve('rebind.example', 443)
            self.assertEqual(values[0]['host'], '93.184.216.34')
            self.assertEqual(values[0]['flags'], socket.AI_NUMERICHOST)
            with self.assertRaises(WebsiteError):
                await resolver.resolve('rebind.example', 443)
            with self.assertRaises(WebsiteError):
                await resolver.resolve('mixed.example', 443)
            self.assertEqual(lookup.await_count, 3)


class FixtureHandler(BaseHTTPRequestHandler):
    hits = []

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.hits.append((self.path, dict(self.headers)))
        status, kind, body, headers = 200, 'text/html', b'', {}
        if self.path == '/redirect':
            status, headers = 302, {'Location': '/page'}
        elif self.path == '/private-redirect':
            status, headers = 302, {'Location': 'http://127.0.0.1/secret'}
        elif self.path == '/loop':
            status, headers = 302, {'Location': '/loop'}
        elif self.path == '/style.css':
            kind, body = 'text/css', b'body{background:#176c64;color:white}h1{font-size:36px} @media print{h1{color:black}}'
        elif self.path == '/image.svg':
            kind, body = 'image/svg+xml', b'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#ff0000"/></svg>'
        elif self.path == '/script.js':
            kind, body = 'application/javascript', b'document.querySelector("#js").textContent="JavaScript-Inhalt";'
        elif self.path == '/oversize':
            body = b'X' * 4096
        elif self.path == '/error':
            status, body = 403, b'Forbidden'
        elif self.path == '/not-html':
            kind, body = 'application/pdf', b'%PDF-1.7\n'
        else:
            private = (b'<img src="http://127.0.0.1/secret"><iframe src="http://169.254.169.254/meta"></iframe>'
                       b'<script>fetch("http://192.168.1.1/private").catch(()=>{});'
                       b'new WebSocket("ws://127.0.0.1/secret");</script>') if self.path == '/private-content' else b''
            body = (b'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head>'
                    b'<body><h1>MoinPDF Testseite</h1><p id="js">Warten</p><img src="/image.svg">'
                    b'<script src="/script.js"></script>' + private + b'</body></html>')
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(body)))
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)


class Rendering(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), FixtureHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    async def asyncSetUp(self):
        FixtureHandler.hits = []
        port = self.server.server_port

        class FixtureResolver:
            async def resolve(self, host, port=0, family=0):
                if host != 'fixture.example':
                    raise OSError('Unexpected outgoing hostname')
                return [dict(hostname=host, host='127.0.0.1', port=self_port,
                             family=socket.AF_INET, proto=6, flags=socket.AI_NUMERICHOST)]

            async def close(self):
                pass

        self_port = port
        # Only tests map this synthetic public hostname to their fixture server.
        # The production resolver is separately tested above, without a bypass.
        self.resolver = patch.object(network, 'PublicResolver', FixtureResolver)
        self.resolver.start()
        self.addCleanup(self.resolver.stop)

    async def proxy_get(self, proxy, target, method='GET'):
        port = proxy.server.sockets[0].getsockname()[1]
        reader, writer = await asyncio.open_connection('127.0.0.1', port)
        writer.write((method + ' ' + target + ' HTTP/1.1\r\nHost: fixture.example\r\n\r\n').encode())
        await writer.drain()
        result = await reader.read()
        writer.close()
        await writer.wait_closed()
        return result

    async def test_transport_bounds_and_private_connect(self):
        async with EgressProxy() as proxy:
            data = await self.proxy_get(proxy, 'http://fixture.example/page')
            self.assertIn(b'MoinPDF Testseite', data)
            self.assertIn(b'200 OK', data)
            for target, method in [('127.0.0.1:443', 'CONNECT'), ('169.254.169.254:443', 'CONNECT'),
                                   ('http://192.168.0.1/', 'GET'), ('http://fixture.example/', 'POST')]:
                data = await self.proxy_get(proxy, target, method)
                self.assertIn(b'502 Bad Gateway', data)
            self.assertEqual(len(FixtureHandler.hits), 1)
            port = proxy.server.sockets[0].getsockname()[1]
            reader, writer = await asyncio.open_connection('127.0.0.1', port)
            writer.write(b'CONNECT fixture.example:443 HTTP/1.1\r\nHost: fixture.example:443\r\n\r\n')
            await writer.drain()
            self.assertIn(b'200 Connection Established', await reader.readuntil(b'\r\n\r\n'))
            # A CONNECT tunnel relays bytes unchanged; Chromium performs TLS
            # certificate verification itself in production.
            writer.write(b'GET /page HTTP/1.0\r\nHost: fixture.example\r\n\r\n')
            await writer.drain()
            self.assertIn(b'MoinPDF Testseite', await reader.read())
            writer.close()
            await writer.wait_closed()
        with patch.object(network, 'MAX_TOTAL', 1024):
            async with EgressProxy() as proxy:
                await self.proxy_get(proxy, 'http://fixture.example/oversize')
                self.assertGreater(proxy.failures, 0)

    async def export(self, path='/page', **options):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            settings = dict(url='http://fixture.example' + path, paper='A4', landscape=False,
                            background=True, media='screen')
            settings.update(options)
            await render(settings, directory)
            return (directory / 'output.pdf').read_bytes(), json.loads((directory / 'result.json').read_text())

    async def test_real_css_image_javascript_redirect_and_paper(self):
        data, report = await self.export('/redirect')
        self.assertFalse(report['partial'])
        with pymupdf.open(stream=data, filetype='pdf') as pdf:
            text = ''.join(page.get_text() for page in pdf)
            self.assertIn('MoinPDF Testseite', text)
            self.assertIn('JavaScript-Inhalt', text)
            self.assertAlmostEqual(pdf[0].rect.width, 595, delta=2)
            self.assertAlmostEqual(pdf[0].rect.height, 842, delta=2)
            fills = [item.get('fill') for item in pdf[0].get_drawings()]
            self.assertTrue(any(fill and fill[0] > 0.9 and fill[1] < 0.1 for fill in fills), 'SVG image missing')
            self.assertTrue(any(fill and 0.07 < fill[0] < 0.12 and 0.35 < fill[1] < 0.5 for fill in fills), 'CSS background missing')
        data, _ = await self.export(paper='Letter', landscape=True, background=False, media='print')
        with pymupdf.open(stream=data, filetype='pdf') as pdf:
            self.assertAlmostEqual(pdf[0].rect.width, 792, delta=2)
            self.assertAlmostEqual(pdf[0].rect.height, 612, delta=2)

    async def test_private_subresources_are_blocked_and_warned(self):
        data, report = await self.export('/private-content')
        self.assertTrue(report['partial'])
        self.assertTrue(data.startswith(b'%PDF-'))
        self.assertFalse(any('secret' in path or 'meta' in path for path, _ in FixtureHandler.hits))

    async def test_private_redirect_and_non_html_fail(self):
        for path in ('/private-redirect', '/not-html', '/error', '/loop'):
            with self.subTest(path=path), self.assertRaises(WebsiteError):
                await self.export(path)


class API(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.key = 'synthetic-test-key-never-used-in-production'
        self.env = patch.dict(os.environ, MOINPDF_API_KEY=self.key)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=service.app), base_url='http://test')
        self.headers = {'Authorization': 'Bearer ' + self.key}

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_auth_validation_body_limit_and_slots(self):
        self.assertEqual((await self.client.get('/v1/capabilities')).status_code, 401)
        response = await self.client.get('/v1/capabilities', headers=self.headers)
        self.assertTrue(response.json()['capabilities']['website'])
        with patch.object(service.asyncio, 'create_subprocess_exec', AsyncMock()) as process:
            for data in ({'url': 'http://127.0.0.1/'}, {'url': 'https://example.org', 'options': '[]'},
                         {'url': 'https://example.org', 'options': '{"landscape":"yes"}'},
                         {'url': 'https://example.org', 'options': '{"executable":"/bin/sh"}'}):
                response = await self.client.post('/v1/website', headers=self.headers, data=data)
                self.assertEqual(response.status_code, 422, response.text)
            response = await self.client.post('/v1/website', headers=self.headers, content=b'x' * 20000)
            self.assertEqual(response.status_code, 413)
            with patch.object(service, 'active', 2):
                response = await self.client.post('/v1/website', headers=self.headers, data={'url': 'https://example.org'})
                self.assertEqual(response.status_code, 503)
            process.assert_not_called()

    async def test_worker_environment_result_and_cleanup(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            worker = directory / 'render.py'
            worker.write_text('''import json, os, pathlib, sys
directory = pathlib.Path(sys.argv[1])
assert not any(key in os.environ for key in ('MOINPDF_API_KEY', 'MOINPDF_API_KEY_FILE', 'HTTPS_PROXY'))
(directory / 'output.pdf').write_bytes(b'%PDF-1.7\\nsynthetic response')
(directory / 'result.json').write_text(json.dumps({'partial': True}))
pathlib.Path(__file__).with_name('job-path').write_text(str(directory))
''')
            with patch.object(service, '__file__', str(directory / 'app.py')):
                response = await self.client.post('/v1/website', headers=self.headers, data={'url': 'https://example.org/page'})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.headers['content-type'], 'application/pdf')
            self.assertIn('example.org.pdf', response.headers['content-disposition'])
            self.assertIn('x-moinpdf-note', response.headers)
            self.assertFalse(Path((directory / 'job-path').read_text()).exists())
            self.assertEqual(service.active, 0)

    async def test_disconnect_stops_worker_and_frees_slot(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'render.py').write_text('''import os, pathlib, sys, time
pathlib.Path(__file__).with_name('job-path').write_text(sys.argv[1])
pathlib.Path(__file__).with_name('pid').write_text(str(os.getpid()))
time.sleep(60)
''')

            async def disconnected():
                await asyncio.sleep(0.1)
                return (directory / 'pid').is_file()

            request = SimpleNamespace(is_disconnected=disconnected)
            with patch.object(service, '__file__', str(directory / 'app.py')):
                with self.assertRaises(service.HTTPException) as raised:
                    await asyncio.wait_for(service.website(request, 'https://example.org/', '{}'), timeout=8)
            self.assertEqual(raised.exception.status_code, 499)
            self.assertEqual(service.active, 0)
            self.assertFalse(Path((directory / 'job-path').read_text()).exists())
            with self.assertRaises(ProcessLookupError):
                os.kill(int((directory / 'pid').read_text()), 0)


if __name__ == '__main__':
    unittest.main()
