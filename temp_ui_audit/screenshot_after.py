"""AI-Dost UI upgrade — AFTER screenshots (warm Claude palette)."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots_after")
os.makedirs(OUT, exist_ok=True)

def shot(page, name, full=False):
    page.screenshot(path=os.path.join(OUT, f"{name}.png"), full_page=full)
    print(f"captured: {name}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # 1. Landing
    page.goto("http://localhost:3000/", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.wait_for_timeout(2500)
    shot(page, "01_landing")
    shot(page, "07_landing_full", full=True)

    # 2. Dashboard chat
    page.goto("http://localhost:3000/dashboard", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.wait_for_timeout(4000)
    shot(page, "02_dashboard_chat")

    # 3. Settings (Toggle component)
    try:
        btn = page.locator("aside button[aria-label='Settings']").first
        if btn.is_visible(timeout=3000):
            btn.click()
            page.wait_for_timeout(2000)
            shot(page, "05_settings")
    except Exception as e:
        print("settings:", e)

    # 4. Back to chat, type
    try:
        for b in page.locator("aside button:has-text('Chat')").all():
            if b.is_visible():
                b.click()
                break
        page.wait_for_timeout(1500)
        ta = page.locator("textarea").first
        if ta.is_visible(timeout=4000):
            ta.click()
            ta.fill("ek todo app banao with react aur express")
            page.wait_for_timeout(700)
            shot(page, "06_chat_composer_typed")
    except Exception as e:
        print("composer:", e)

    # 5. Light theme landing (Claude cream)
    page.goto("http://localhost:3000/", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.wait_for_timeout(1500)
    try:
        page.evaluate("""() => {
            document.body.classList.add('light-theme');
            document.documentElement.classList.add('light-theme');
            document.documentElement.setAttribute('data-theme', 'light');
        }""")
        page.wait_for_timeout(800)
        shot(page, "10_landing_light")
    except Exception as e:
        print("light:", e)

    # 6. Mobile
    mob = browser.new_page(viewport={"width": 390, "height": 844})
    mob.goto("http://localhost:3000/dashboard", timeout=60000)
    mob.wait_for_load_state("networkidle", timeout=60000)
    mob.wait_for_timeout(3500)
    shot(mob, "08_mobile_dashboard")
    mob.goto("http://localhost:3000/", timeout=60000)
    mob.wait_for_load_state("networkidle", timeout=60000)
    mob.wait_for_timeout(2500)
    shot(mob, "09_mobile_landing")

    print("pageErrors:", errors[:10])
    browser.close()
