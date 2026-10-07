"""Capture the live 'App is not defined' stack from the Copilot IDE preview."""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1600, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append({"msg": e.message, "stack": (e.stack or "")[:600]}))

    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(2000)
    pg.locator("aside button:has-text('Copilot IDE')").first.click()
    pg.wait_for_timeout(7000)

    frames = pg.frames
    print(f"frames: {len(frames)}")
    for i, f in enumerate(frames):
        try:
            body = f.evaluate("() => document.body ? document.body.innerText.slice(0, 200) : ''")
            print(f"  [{i}] url={f.url[:60]!r} text={body[:120]!r}")
        except Exception as e:
            print(f"  [{i}] <inaccessible: {e}>")

    print("\n=== ERRORS ===")
    for e in errs:
        print("MSG:", e["msg"])
        print("STACK:", e["stack"][:500])
        print("---")
    b.close()