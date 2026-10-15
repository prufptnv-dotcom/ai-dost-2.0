"""AI-Dost UI/UX audit v2 — main app at /dashboard."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(OUT, exist_ok=True)

def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f"{name}.png"))
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

    # 2. Dashboard (main app / chat)
    page.goto("http://localhost:3000/dashboard", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.wait_for_timeout(4000)
    shot(page, "02_dashboard_chat")

    # 3. Try sidebar nav — Copilot / Project view
    for label, fname in [("Project", "03_project_view"), ("History", "04_history"),
                         ("Settings", "05_settings")]:
        try:
            btns = page.locator(f"aside button:has-text('{label}')").all()
            target = None
            for b in btns:
                if b.is_visible():
                    target = b
                    break
            if target:
                target.click()
                page.wait_for_timeout(2500)
                shot(page, fname)
            else:
                print(f"no visible button {label}")
        except Exception as e:
            print(f"{label}: {e}")

    # 4. Back to chat, type message
    try:
        btns = page.locator("aside button:has-text('Chat')").all()
        for b in btns:
            if b.is_visible():
                b.click()
                break
        page.wait_for_timeout(2000)
        ta = page.locator("textarea").first
        if ta.is_visible(timeout=4000):
            ta.click()
            ta.fill("ek todo app banao with react aur express")
            page.wait_for_timeout(700)
            shot(page, "06_chat_composer_typed")
    except Exception as e:
        print("composer:", e)

    # 5. Scroll landing page full
    page.goto("http://localhost:3000/", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.wait_for_timeout(2000)
    shot(page, "07_landing_full", full=True) if False else None
    page.screenshot(path=os.path.join(OUT, "07_landing_full.png"), full_page=True)
    print("captured: 07_landing_full")

    # 6. Mobile dashboard
    mob = browser.new_page(viewport={"width": 390, "height": 844})
    mob.goto("http://localhost:3000/dashboard", timeout=60000)
    mob.wait_for_load_state("networkidle", timeout=60000)
    mob.wait_for_timeout(3500)
    mob.screenshot(path=os.path.join(OUT, "08_mobile_dashboard.png"))
    print("captured: 08_mobile_dashboard")

    # mobile landing
    mob.goto("http://localhost:3000/", timeout=60000)
    mob.wait_for_load_state("networkidle", timeout=60000)
    mob.wait_for_timeout(2500)
    mob.screenshot(path=os.path.join(OUT, "09_mobile_landing.png"))
    print("captured: 09_mobile_landing")

    print("pageErrors:", errors[:10])
    browser.close()
