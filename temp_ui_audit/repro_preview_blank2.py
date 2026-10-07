"""Dump the preview iframe's post-mount DOM, tolerating navigations."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crops")

PROBE = """() => {
    const el = document.querySelector('#root');
    return {
        rootChildren: el ? el.children.length : -1,
        rootText: el ? el.innerText.replace(/\\s+/g,' ').slice(0, 220) : '(no #root)',
        bodyText: document.body ? document.body.innerText.replace(/\\s+/g,' ').slice(0, 220) : '',
    };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    errs = []
    pg.on("pageerror", lambda e: errs.append(e.message[:300]))

    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(2500)
    pg.locator("aside button:has-text('Copilot IDE')").first.click()
    pg.wait_for_timeout(12000)

    print("frames:", len(pg.frames))
    for i, f in enumerate(pg.frames):
        if i == 0:
            continue
        try:
            info = f.evaluate(PROBE)
            print(f"\nframe {i}:")
            for k, v in info.items():
                print(f"   {k}: {str(v)[:200]}")
        except Exception as e:
            print(f"\nframe {i}: <probe failed: {type(e).__name__}>")

    # capture just the preview pane for a visual read
    try:
        pane = pg.locator("iframe").first
        pane.screenshot(path=os.path.join(OUT, "preview_pane_only_2026.png"))
        print("\npreview pane shot saved")
    except Exception as e:
        print("pane shot failed:", e)

    print("\npage errors:", errs[:3] if errs else "none")
    b.close()