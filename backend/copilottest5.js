const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const bad = new Map();
  const errors = [];
  page.on('response', r => { if (r.status() >= 400) bad.set(r.url(), (bad.get(r.url()) || 0) + 1); });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const openDash = page.locator('text=Open Dashboard').first();
  if (await openDash.count()) { await openDash.click(); await page.waitForTimeout(2500); }
  await page.keyboard.press('Control+3');
  await page.waitForTimeout(2000);

  const ta = page.locator('textarea[placeholder*="Prompt likho"]').first();
  console.log('prompt textarea count:', await ta.count());
  await ta.fill('Create a simple stopwatch app with stopwatch.html, stopwatch.css, stopwatch.js');
  const val = await page.evaluate(() => document.querySelector('textarea[placeholder*="Prompt likho"]').value);
  console.log('value after fill:', JSON.stringify(val.slice(0, 40)));
  const sendBtn = ta.locator('xpath=following-sibling::button').first();
  console.log('send button:', await sendBtn.count(), 'disabled:', await sendBtn.isDisabled());
  await sendBtn.click();
  console.log('send clicked');

  const start = Date.now();
  let lastText = '';
  const seen = new Set();
  const WATCH_MS = 240000;
  while (Date.now() - start < WATCH_MS) {
    await page.waitForTimeout(250);
    const txt = await page.evaluate(() => document.body.innerText);
    for (const l of txt.split('\n').map(s => s.trim()).filter(s => s.length > 1)) {
      if (!lastText.includes(l) && !seen.has(l)) {
        seen.add(l);
        const t = ((Date.now() - start) / 1000).toFixed(1);
        if (/[✍💻✏📋🤔🚀✅⚠🔧🦙⚙]/u.test(l)) console.log(`[${t}s] STATUS> ${l}`);
        else if (/Task \d+ of \d+/i.test(l)) console.log(`[${t}s] TASK> ${l}`);
      }
    }
    lastText = txt;
    if (/\u2705/.test(txt)) break;
  }

  console.log('\n===== FINAL PANEL TEXT (tail) =====');
  await page.waitForTimeout(3000);
  console.log((await page.evaluate(() => document.body.innerText)).split('\n').slice(-50).join('\n'));
  await page.screenshot({ path: 'copilot_c.png' });
  console.log('\n===== HTTP 4xx/5xx ====');
  for (const [u, c] of bad) console.log(c + 'x', u.slice(0, 160));
  console.log('===== PAGE ERRORS =====');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await browser.close();
  console.log('DONE in', ((Date.now() - start) / 1000).toFixed(1) + 's');
})();