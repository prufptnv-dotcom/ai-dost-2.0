"""Capture the Copilot IDE after removing the duplicate AppShell header."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crops")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(2500)
    pg.locator("aside button:has-text('Copilot IDE')").first.click()
    pg.wait_for_timeout(8000)
    pg.screenshot(path=os.path.join(OUT, "copilot_single_header_2026.png"))
    print("captured")
    b.close()