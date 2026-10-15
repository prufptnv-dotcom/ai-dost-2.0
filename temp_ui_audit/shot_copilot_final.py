"""Capture Copilot IDE after agent-header reflow (overflow fix)."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crops")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto("http://localhost:3000/dashboard", timeout=90000)
    pg.wait_for_load_state("networkidle", timeout=90000)
    pg.wait_for_timeout(2500)
    pg.locator("aside button:has-text('Copilot IDE')").first.click()
    pg.wait_for_timeout(8000)

    # overflow check: does any child of the agent pane exceed the pane width?
    overflow = pg.evaluate("""() => {
        const pane = document.querySelector("aside.w-\\\\[390px\\\\]");
        if (!pane) return 'pane not found';
        const pr = pane.getBoundingClientRect();
        const bad = [];
        pane.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width && r.right > pr.right + 1) {
                bad.push(`${el.tagName}.${(el.className||'').toString().slice(0,40)} right=${Math.round(r.right)} vs ${Math.round(pr.right)}`);
            }
        });
        return bad.slice(0, 5);
    }""")
    print("overflowing elements:", overflow)

    pg.screenshot(path=os.path.join(OUT, "copilot_final_2026.png"))
    print("pageErrors:", errs[:4] if errs else "none")
    b.close()