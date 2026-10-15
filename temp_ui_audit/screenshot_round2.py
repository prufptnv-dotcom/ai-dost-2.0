"""Round 2 — Copilot IDE, Studios, clean chat."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto("http://localhost:3000/dashboard", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.wait_for_timeout(4000)

    # close artifact panel if present
    try:
        close = page.locator("button[aria-label='Close'], button:has-text('×')").first
        if close.is_visible(timeout=2000):
            close.click()
            page.wait_for_timeout(800)
    except Exception:
        pass

    # New chat clean
    try:
        nc = page.locator("aside button:has-text('New chat')").first
        if nc.is_visible():
            nc.click()
            page.wait_for_timeout(2000)
    except Exception as e:
        print("newchat:", e)
    page.screenshot(path=os.path.join(OUT, "10_chat_clean.png"))
    print("captured: 10_chat_clean")

    # Copilot IDE
    try:
        b = page.locator("aside button:has-text('Copilot IDE')").first
        if b.is_visible():
            b.click()
            page.wait_for_timeout(6000)
            page.screenshot(path=os.path.join(OUT, "11_copilot_ide.png"))
            print("captured: 11_copilot_ide")
    except Exception as e:
        print("ide:", e)

    # Studios & Tools
    try:
        b = page.locator("aside button:has-text('Studios & Tools')").first
        if b.is_visible():
            b.click()
            page.wait_for_timeout(3500)
            page.screenshot(path=os.path.join(OUT, "12_studios.png"))
            print("captured: 12_studios")
    except Exception as e:
        print("studios:", e)

    # Agent Workbench
    try:
        b = page.locator("aside button:has-text('Agent Workbench')").first
        if b.is_visible():
            b.click()
            page.wait_for_timeout(3500)
            page.screenshot(path=os.path.join(OUT, "13_agent_workbench.png"))
            print("captured: 13_agent_workbench")
    except Exception as e:
        print("agent:", e)

    print("pageErrors:", errors[:8])
    browser.close()
