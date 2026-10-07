"""Retake: serif hero + composer + settings toggle (fresh unique names)."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots_after")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # Landing hero (serif check)
    page.goto("http://localhost:3000/", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.wait_for_timeout(3000)
    page.screenshot(path=os.path.join(OUT, "v3_hero_serif.png"))
    print("v3_hero_serif")

    # Hero h1 font family probe
    fam = page.evaluate("""() => {
        const h1 = document.querySelector('h1');
        return h1 ? getComputedStyle(h1).fontFamily : 'none';
    }""")
    print("h1 font-family:", fam)

    # Dashboard composer (proper placeholder selector)
    page.goto("http://localhost:3000/dashboard", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.wait_for_timeout(3500)
    try:
        ta = page.locator("textarea[placeholder]").first
        ta.click(timeout=8000)
        ta.fill("ek calculator app banao with react")
        page.wait_for_timeout(700)
        page.screenshot(path=os.path.join(OUT, "v3_composer.png"))
        print("v3_composer")
    except Exception as e:
        print("composer fail:", e)

    # Settings toggle
    try:
        page.locator("aside button[aria-label='Settings']").first.click(timeout=5000)
        page.wait_for_timeout(1800)
        page.screenshot(path=os.path.join(OUT, "v3_settings_toggle.png"))
        print("v3_settings_toggle")
    except Exception as e:
        print("settings fail:", e)

    print("pageErrors:", errors[:5])
    browser.close()
