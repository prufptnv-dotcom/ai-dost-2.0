const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
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
  await ta.fill('Create index.html showing a red box with the text "AI-Dost LIVE" centered');
  await ta.locator('xpath=following-sibling::button').first().click();
  console.log('send clicked');

  const start = Date.now();
  let lastText = '';
  const seen = new Set();
  const WATCH_MS = 90000;
  let shotT = null, doneT = null;
  while (Date.now() - start < WATCH_MS) {
    await page.waitForTimeout(250);
    const txt = await page.evaluate(() => document.body.innerText);
    for (const l of txt.split('\n').map(s => s.trim()).filter(s => s.length > 1)) {
      if (!lastText.includes(l) && !seen.has(l)) {
        seen.add(l);
        const t = ((Date.now() - start) / 1000).toFixed(1);
        if (/[✍💻✏📋🤔🚀✅⚠🔧🦙⚙]/u.test(l)) console.log(`[${t}s] STATUS> ${l}`);
      }
    }
    if (doneT === null && /\u2705/.test(txt)) doneT = (Date.now() - start) / 1000;
    if (shotT === null && /result screenshot/u.test(txt)) shotT = (Date.now() - start) / 1000;
    if (shotT !== null && Date.now() - start > (shotT * 1000) + 4000) break;
    lastText = txt;
  }

  console.log('\n===== RESULTS =====');
  console.log('done event      :', doneT === null ? 'MISSING' : doneT.toFixed(1) + 's');
  console.log('screenshot card :', shotT === null ? 'MISSING' : shotT.toFixed(1) + 's', shotT !== null && doneT !== null ? `(PASS, after done: ${(shotT - doneT).toFixed(1)}s)` : '');
  const imgs = await page.locator('img[src^="data:image"]').count();
  console.log('data:image imgs in chat:', imgs);
  console.log('editor shows AI-Dost LIVE:', (await page.evaluate(() => document.body.innerText)).includes('AI-Dost LIVE'));
  console.log('\n===== HTTP 4xx/5xx ====');
  for (const [u, c] of bad) console.log(c + 'x', u.slice(0, 160));
  console.log('===== PAGE ERRORS =====');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await page.screenshot({ path: 'copilot_final2.png' });
  await browser.close();
  console.log('TOTAL', ((Date.now() - start) / 1000).toFixed(1) + 's');
})();