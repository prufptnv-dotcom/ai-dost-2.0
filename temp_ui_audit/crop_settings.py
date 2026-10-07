import os
from playwright.sync_api import sync_playwright

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crops")
os.makedirs(out, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1600, "height": 900})
    pg.goto("http://localhost:3000/dashboard", timeout=60000)
    pg.wait_for_load_state("networkidle", timeout=60000)
    pg.wait_for_timeout(3000)
    pg.locator("aside button[aria-label='Settings']").first.click(timeout=8000)
    pg.wait_for_timeout(1500)
    pg.evaluate("""() => {
        const h = [...document.querySelectorAll('h2')].find(x => x.textContent.includes('Preferences'));
        if (h) h.scrollIntoView({block: 'center'});
    }""")
    pg.wait_for_timeout(600)
    pg.screenshot(path=os.path.join(out, "settings_prefs_20261005a.png"))
    print("done")
    b.close()
