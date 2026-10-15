"""Render AI-Dost UI concept mockups to publish-ready @2x PNGs.

Usage: python design/render_concept.py [name ...]
Requires: playwright (Python). Output: design/out/concept-<name>.png
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent
CONCEPTS = ["landing", "chat", "copilot", "projects", "memory"]
STRIPS = ["beforeafter-chat", "beforeafter-copilot", "beforeafter-projects"]

names = sys.argv[1:] or (CONCEPTS + STRIPS)

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    for name in names:
        src = BASE / "concepts" / f"{name}.html"
        if not src.exists():
            print(f"SKIP {name} (missing {src})")
            continue
        page = ctx.new_page()
        page.goto(src.as_uri(), wait_until="load")
        try:
            page.evaluate("async () => { await document.fonts.ready }")
        except Exception:
            pass
        page.wait_for_timeout(900)
        out = BASE / "out" / f"concept-{name}.png"
        page.screenshot(path=str(out), full_page=True)
        print(f"OK {out.name} {out.stat().st_size}B")
        page.close()
    browser.close()
