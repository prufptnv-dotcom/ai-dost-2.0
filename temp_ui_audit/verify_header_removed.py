"""Verify the AppShell non-chat header is gone on the Copilot IDE."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(2500)
    pg.locator("aside button:has-text('Copilot IDE')").first.click()
    pg.wait_for_timeout(7000)

    body = pg.evaluate("() => document.body.innerText")
    for needle in ["WORKSPACE", "Personal computing workspace", "Search anything"]:
        print(f"{needle:32} present={needle in body}")

    # Copilot's own header must still be there
    print("copilot header h-11 :", pg.locator("header.h-11").count())
    print("chat view label     :", pg.get_by_text("Copilot IDE", exact=True).count())
    pg.screenshot(path=r"C:\Users\vikash kumar\Pictures\ai dost 3.0\temp_ui_audit\crops\copilot_no_dup_header_2026.png")

    # Settings view should also be header-less now
    pg.locator("aside button[aria-label='Settings']").first.click()
    pg.wait_for_timeout(2500)
    s = pg.evaluate("() => document.body.innerText")
    print("settings: WORKSPACE present =", "WORKSPACE" in s)

    print("pageErrors:", errs[:3] if errs else "none")
    b.close()