"""Verify unified indigo palette: chat page in dark + light theme."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crops")
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1600, "height": 950})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))

    # seed a couple of chats + a message so bubbles/bubbles styling is visible
    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(3500)

    pg.screenshot(path=os.path.join(OUT, "indigo_chat_dark_2026.png"))

    # light theme
    pg.evaluate("""() => {
        document.body.classList.add('light-theme');
        document.documentElement.classList.add('light-theme');
        document.documentElement.setAttribute('data-theme', 'light');
    }""")
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(OUT, "indigo_chat_light_2026.png"))

    print("pageErrors:", errs[:5] if errs else "none")
    b.close()