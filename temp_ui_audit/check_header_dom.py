"""Check whether the new IdeHeader actually rendered (DOM truth, not pixels)."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(2500)
    pg.locator("aside button:has-text('Copilot IDE')").first.click()
    pg.wait_for_timeout(7000)

    # new header uses aria-labels; old one rendered text buttons
    for label in ["New project", "Session history", "Project setup", "Package manager", "Secrets", "Save all files", "Download ZIP"]:
        print(f"{label:18} ->", pg.locator(f"[aria-label='{label}']").count())

    print("\nOLD header text still present?")
    for txt in ["New Project", "Run project", "Project setup"]:
        print(f"  '{txt}' count:", pg.get_by_text(txt, exact=True).count())

    print("\nfooter h-6 present:", pg.locator("footer.h-6").count(), "| footer h-7 present:", pg.locator("footer.h-7").count())
    print("header h-11 present:", pg.locator("header.h-11").count(), "| header h-14 present:", pg.locator("header.h-14").count())
    b.close()