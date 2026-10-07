"""Reproduce the blank Copilot preview: dump the iframe's console + errors."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    errs = []
    pg.on("pageerror", lambda e: errs.append(e.message[:400]))

    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(2500)
    pg.locator("aside button:has-text('Copilot IDE')").first.click()
    pg.wait_for_timeout(9000)

    print("frames:", len(pg.frames))
    for i, f in enumerate(pg.frames):
        if i == 0:
            continue
        print(f"\n--- frame {i} ({f.url[:40]}) ---")
        info = f.evaluate("""() => {
            const el = document.querySelector('#root');
            return {
                rootHTML: el ? el.innerHTML.slice(0, 300) : '(no #root)',
                rootText: el ? el.innerText.slice(0, 200) : '(no #root)',
                lastError: typeof window.__aiDostLastError !== 'undefined'
                    ? String(window.__aiDostLastError) : 'n/a',
            };
        }""")
        for key, val in info.items():
            print(f"  {key}: {str(val)[:220]}")

    print("\n=== page errors ===")
    for e in errs[:5]:
        print(" -", e)
    b.close()