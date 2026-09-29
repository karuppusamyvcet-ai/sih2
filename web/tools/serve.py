#!/usr/bin/env python3
"""Static server for the browser build, with caching switched off.

The demo is developed by editing ES modules and reloading the tab, and a normal
static server lets the browser hold on to a stale module — which looks exactly
like "my fix did not work". This server sends no-store for everything, so a
reload always runs the code that is on disk.

    python3 web/tools/serve.py [port] [directory]
"""

import functools
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIRECTORY = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # keep the console readable: only report failures
        status = args[1] if len(args) > 1 else ""
        if str(status).startswith(("4", "5")):
            super().log_message(fmt, *args)


Handler.extensions_map.update({".js": "text/javascript", ".mjs": "text/javascript"})

with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), functools.partial(Handler, directory=DIRECTORY)) as httpd:
    httpd.allow_reuse_address = True
    print(f"serving {DIRECTORY} on http://0.0.0.0:{PORT} (no caching)")
    httpd.serve_forever()
