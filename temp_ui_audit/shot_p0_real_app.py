"""Serve the real built output of a P0 workspace and screenshot it."""
import os, sys, threading, http.server, socketserver, functools, glob
from playwright.sync_api import sync_playwright

ws = os.path.join(os.environ['TEMP'], sys.argv[1] if len(sys.argv) > 1 else 'agent-ws-p0-e2e-04')
dist = os.path.join(ws, 'dist')
if not os.path.isdir(dist):
    dist = ws
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crops', 'p0_real_app_2026.png')

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=dist)
class Quiet(socketserver.TCPServer):
    allow_reuse_address = True
    def handle_error(self, *a): pass
srv = Quiet(('127.0.0.1', 0), handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
print(f'serving {dist} on {port}')

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': 1280, 'height': 860})
    errs, cerrs = [], []
    pg.on('pageerror', lambda e: errs.append(e.message[:200]))
    pg.on('console', lambda m: cerrs.append(m.text[:200]) if m.type == 'error' else None)
    pg.goto(f'http://127.0.0.1:{port}/', wait_until='load', timeout=30000)
    pg.wait_for_timeout(2000)
    pg.screenshot(path=out, full_page=False)
    print('pageErrors:', errs or 'none')
    print('consoleErrors:', cerrs or 'none')
    print('text:', pg.evaluate("document.body.innerText.replace(/\\s+/g,' ').trim().slice(0,240)"))
    print('saved:', out)
    b.close()
srv.shutdown()