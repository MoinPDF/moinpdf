"""Serve the production build with its required isolation headers."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.wasm': 'application/wasm', '.mjs': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Server(ThreadingHTTPServer):
    # A fresh browser preloads dozens of application modules at once. The
    # default queue of five can reject connections before any handler runs.
    request_queue_size = 128


Server(('127.0.0.1', 8765), partial(Handler, directory='dist/selfhost')).serve_forever()
