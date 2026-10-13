"""Public HTTP(S) only. Validate DNS answers at the socket's actual resolution."""
from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
from urllib.parse import urlsplit, urlunsplit

MAX_TOTAL = 40 * 1024 * 1024
MAX_REQUESTS = 160


class WebsiteError(ValueError):
    pass


def public_address(value: str) -> bool:
    address = ipaddress.ip_address(value.split('%')[0])
    if not address.is_global or address.is_multicast or address.is_reserved:
        return False
    if isinstance(address, ipaddress.IPv6Address):
        # Do not let a public-looking IPv6 transition address reach an IPv4 LAN.
        if address.ipv4_mapped or address.sixtofour or address.teredo:
            return False
        if address in ipaddress.ip_network('64:ff9b::/96') or address in ipaddress.ip_network('64:ff9b:1::/48'):
            return False
    return True


def normalize_url(value: str) -> str:
    value = value.strip()
    if not value or len(value) > 4096 or re.search(r'[\x00-\x20\x7f\\]', value):
        raise WebsiteError('Bitte eine gültige öffentliche Website-Adresse eingeben.')
    if not re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', value):
        value = 'https://' + value
    try:
        url = urlsplit(value)
        if url.scheme not in ('http', 'https') or url.username is not None or url.password is not None:
            raise ValueError()
        host = (url.hostname or '').encode('idna').decode('ascii').lower().rstrip('.')
        if not host or '%' in host or url.port not in (None, 80 if url.scheme == 'http' else 443):
            raise ValueError()
    except (ValueError, UnicodeError):
        raise WebsiteError('Bitte HTTP oder HTTPS ohne Zugangsdaten und ohne abweichenden Port verwenden.') from None
    try:
        ipaddress.ip_address(host)
    except ValueError:
        if ('.' not in host or host.replace('.', '').isdigit()
                or not all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', part) for part in host.split('.'))
                or host.endswith(('.localhost', '.local', '.internal', '.lan', '.home', '.onion'))):
            raise WebsiteError('Nur öffentlich erreichbare Webseiten sind erlaubt.')
    else:
        if not public_address(host):
            raise WebsiteError('Nur öffentlich erreichbare Webseiten sind erlaubt.')
    authority = '[' + host + ']' if ':' in host else host
    return urlunsplit((url.scheme, authority, url.path or '/', url.query, url.fragment))


class PublicResolver:
    async def resolve(self, host, port=0, family=socket.AF_UNSPEC):
        answers = await asyncio.wait_for(
            asyncio.get_running_loop().getaddrinfo(host, port, family=family, type=socket.SOCK_STREAM), 8
        )
        if not answers or any(not public_address(answer[4][0]) for answer in answers):
            raise WebsiteError('Nur öffentlich erreichbare Webseiten sind erlaubt.')
        # These exact numeric addresses go to the connector; there is no second
        # hostname lookup between validation and connect (DNS rebinding).
        return [dict(hostname=host, host=answer[4][0], port=port, family=answer[0],
                     proto=answer[2], flags=socket.AI_NUMERICHOST) for answer in answers]

    async def close(self):
        pass


class EgressProxy:
    """HTTP forward proxy with public-IP-pinned CONNECT tunnels.

    Chromium retains native redirects, cookies within its disposable context,
    TLS verification, CSS relative URLs and normal browser loading semantics.
    Every new socket is checked here, even traffic bypassing Playwright routes.
    """
    def __init__(self):
        self.total = 0
        self.connections = 0
        self.failures = 0
        self.tasks = set()
        self.server = None
        self.resolver = PublicResolver()

    async def __aenter__(self):
        self.server = await asyncio.start_server(self.handle, '127.0.0.1', 0, limit=32768)
        self.url = 'http://127.0.0.1:' + str(self.server.sockets[0].getsockname()[1])
        return self

    async def __aexit__(self, *args):
        self.server.close()
        await self.server.wait_closed()
        tasks = list(self.tasks)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await self.resolver.close()

    async def connect(self, host, port):
        # Numeric literals need the same check as DNS results. Validate ALL
        # answers before choosing one; no second hostname lookup on connect.
        answers = await self.resolver.resolve(host, port)
        error = None
        for answer in answers:
            try:
                return await asyncio.wait_for(asyncio.open_connection(
                    answer['host'], answer['port'], family=answer['family']), 8)
            except OSError as failed:
                error = failed
        raise OSError('Connection failed') from error

    async def relay(self, source, destination, count):
        while chunk := await asyncio.wait_for(source.read(65536), 20):
            if count:
                self.total += len(chunk)
                if self.total > MAX_TOTAL:
                    raise WebsiteError('Die Webseite oder eine ihrer Ressourcen ist zu groß.')
            destination.write(chunk)
            await destination.drain()

    async def handle(self, reader, writer):
        task = asyncio.current_task()
        self.tasks.add(task)
        upstream = None
        relays = []
        try:
            self.connections += 1
            if self.connections > MAX_REQUESTS or len(self.tasks) > 32 or self.total > MAX_TOTAL:
                raise WebsiteError('Die Webseite lädt zu viele Ressourcen. Bitte eine kleinere Seite wählen.')
            head = await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'), 8)
            lines = head.decode('iso-8859-1').split('\r\n')
            method, target, version = lines[0].split(' ')
            if version not in ('HTTP/1.0', 'HTTP/1.1') or method not in ('GET', 'HEAD', 'CONNECT'):
                raise WebsiteError('Interaktive Inhalte wurden nicht geladen.')
            if method == 'CONNECT':
                address = urlsplit(normalize_url('https://' + target))
                if address.path != '/' or address.query or address.fragment:
                    raise WebsiteError('Ungültiges Verbindungsziel.')
                port = 443
            else:
                address = urlsplit(normalize_url(target))
                if address.scheme != 'http':
                    raise WebsiteError('Ungültiges Verbindungsziel.')
                port = 80
            upstream_reader, upstream = await self.connect(address.hostname, port)
            if method == 'CONNECT':
                writer.write(b'HTTP/1.1 200 Connection Established\r\n\r\n')
                await writer.drain()
            else:
                path = address.path + ('?' + address.query if address.query else '')
                forward = [method + ' ' + path + ' HTTP/1.1', 'Host: ' + address.netloc, 'Connection: close']
                for line in lines[1:]:
                    if not line:
                        continue
                    name, value = line.split(':', 1)
                    if name.lower() not in ('host', 'connection', 'proxy-connection', 'proxy-authorization',
                                            'content-length', 'transfer-encoding', 'upgrade', 'te', 'trailer'):
                        forward.append(name + ':' + value)
                upstream.write(('\r\n'.join(forward) + '\r\n\r\n').encode('iso-8859-1'))
                await upstream.drain()
            relays = [asyncio.create_task(self.relay(upstream_reader, writer, True)),
                      asyncio.create_task(self.relay(reader, upstream, False))]
            done, _ = await asyncio.wait(relays, return_when=asyncio.FIRST_COMPLETED)
            for completed in done:
                completed.result()
        except (OSError, ValueError, asyncio.IncompleteReadError, asyncio.LimitOverrunError, TimeoutError):
            self.failures += 1
            # Do not expose URLs, DNS answers or page content in errors/logs.
            try:
                writer.write(b'HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
                await writer.drain()
            except OSError:
                pass
        finally:
            for relay in relays:
                relay.cancel()
            await asyncio.gather(*relays, return_exceptions=True)
            if upstream:
                upstream.close()
            writer.close()
            self.tasks.discard(task)
