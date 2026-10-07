"""Render mockup HTML files to publish-ready PNG + JPG."""
import os
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.join(BASE, "mockups")
OUT = os.path.join(MOCK, "out")
os.makedirs(OUT, exist_ok=True)

SIZES = {
    "m1_chat": (1600, 1000),
    "m2_projects": (1600, 1000),
    "m3_ide": (1600, 1000),
    "m4_design_system": (1600, 1400),
    "m5_mobile": (1600, 1000),
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, (w, h) in SIZES.items():
        page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
        page.goto(f"file:///{MOCK}/{name}.html".replace("\\", "/"), timeout=60000)
        page.wait_for_load_state("networkidle", timeout=30000)
        page.wait_for_timeout(1200)
        png = os.path.join(OUT, f"{name}.png")
        page.screenshot(path=png)
        jpg = os.path.join(OUT, f"{name}.jpg")
        page.screenshot(path=jpg, type="jpeg", quality=92)
        print(f"rendered: {name} -> PNG + JPG")
        page.close()
    browser.close()
print("done:", OUT)
