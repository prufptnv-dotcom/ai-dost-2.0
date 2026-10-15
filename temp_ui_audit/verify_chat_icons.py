"""Verify chat page after lucide→AppIcon migration: pageErrors + icon fallbacks."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crops")
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1600, "height": 950})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(f"CONSOLE[{m.type}] {m.text}") if m.type == "error" else None)

    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(4000)

    # Every AppIcon renders data-testid="app-icon-<name>"
    names = pg.eval_on_selector_all(
        "[data-testid^='app-icon-']",
        "els => els.map(e => e.getAttribute('data-testid').replace('app-icon-',''))"
    )
    from collections import Counter
    counts = Counter(names)

    # navigate: Copilot IDE + Agent + Settings to exercise more components
    for label in ["Copilot IDE", "Agent Workbench"]:
        try:
            btn = pg.locator(f"aside button:has-text('{label}')").first
            if btn.is_visible(timeout=3000):
                btn.click()
                pg.wait_for_timeout(2200)
                more = pg.eval_on_selector_all(
                    "[data-testid^='app-icon-']",
                    "els => els.map(e => e.getAttribute('data-testid').replace('app-icon-',''))"
                )
                counts.update(more)
        except Exception as e:
            print(f"nav {label}: {e}")

    pg.locator("aside button:has-text('Chat')").first.click()
    pg.wait_for_timeout(2500)
    pg.screenshot(path=os.path.join(OUT, "chat_after_icon_migration.png"))

    print("ICON COUNTS:", dict(sorted(counts.items())))
    print("FALLBACK circle count:", counts.get("circle", 0))
    print("ERRORS:", errors[:8] if errors else "none")
    b.close()