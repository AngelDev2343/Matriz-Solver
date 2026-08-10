#!/usr/bin/env python3
"""Servidor estático simple para Matriz-Solver (necesario para el Service Worker)."""
from __future__ import annotations

import argparse
import http.server
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Evita caché agresiva del navegador mientras desarrollas; el SW gestiona offline.
        if self.path.endswith(".html") or self.path in ("/", "/index.html"):
            self.send_header("Cache-Control", "no-cache")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Servir Matriz-Solver")
    parser.add_argument("--port", "-p", type=int, default=8080)
    args = parser.parse_args()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", args.port), Handler) as httpd:
        print(f"Matriz-Solver en http://localhost:{args.port}")
        print("Ctrl+C para detener")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDetenido.")


if __name__ == "__main__":
    main()
