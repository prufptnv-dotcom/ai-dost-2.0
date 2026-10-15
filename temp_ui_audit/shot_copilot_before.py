"""Capture current Copilot IDE state (before upgrade)."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crops")
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(2500)

    # navigate into Copilot IDE
    for sel in ["aside button[aria-label='Copilot IDE']", "aside button:has-text('Copilot IDE')"]:
        try:
            btn = pg.locator(sel).first
            if btn.is_visible(timeout=3000):
                btn.click()
                break
        except Exception as e:
            print("nav miss", sel, e)
    pg.wait_for_timeout(6000)
    pg.screenshot(path=os.path.join(OUT, "copilot_before_2026.png"))

    print("pageErrors:", errs[:5] if errs else "none")
    b.close()