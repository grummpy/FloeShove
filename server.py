#!/usr/bin/env python3
"""Tiny local server for Floe Shove. Stdlib only.

Binds 127.0.0.1 on the arcade port (8812) and walks forward if that port is taken.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import sys
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8812
PORT_TRIES = 30


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def make_server(host: str, start: int):
    handler = functools.partial(Handler, directory=ROOT)
    last_error = None
    for port in range(start, start + PORT_TRIES):
        try:
            http.server.ThreadingHTTPServer.allow_reuse_address = True
            server = http.server.ThreadingHTTPServer((host, port), handler)
            return server, port
        except OSError as exc:
            last_error = exc
            continue
    raise SystemExit(
        f"No free port in {start}-{start + PORT_TRIES - 1} ({last_error})."
    )


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Serve Floe Shove on localhost")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open a browser window",
    )
    args = parser.parse_args(argv)

    os.chdir(ROOT)
    server, port = make_server(args.host, args.port)
    url = f"http://{args.host}:{port}/"
    print(f"LISTENING {url}", flush=True)
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception as exc:  # pragma: no cover - desktop only
            print(f"Could not open a browser ({exc}). Open {url} yourself.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
