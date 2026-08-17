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

  const gate = page.locator('button[title*="Plan gate"]').first();
  if (await gate.count()) { await gate.click(); await page.waitForTimeout(300); }
  console.log('plan gate toggled OFF (autopilot)');

  const ta = page.locator('textarea[placeholder*="Prompt likho"]').first();
  await ta.fill('Create index.html showing a green box with text "LIVE OK" centered');
  await ta.locator('xpath=following-sibling::button').first().click();
  console.log('send clicked');

  const start = Date.now();
  let firstTool = null, doneT = null, shotT = null;
  const WATCH_MS = 90000;
  while (Date.now() - start < WATCH_MS) {
    await page.waitForTimeout(250);
    const txt = await page.evaluate(() => document.body.innerText);
    if (firstTool === null && /⚙️/u.test(txt)) firstTool = (Date.now() - start) / 1000;
    if (doneT === null && /\u2705/.test(txt)) doneT = (Date.now() - start) / 1000;
    if (shotT === null && /result screenshot/u.test(txt)) shotT = (Date.now() - start) / 1000;
    if (shotT !== null && Date.now() - start > (shotT * 1000) + 4000) break;
    if (doneT !== null && Date.now() - start > (doneT * 1000) + 15000) break;
  }

  console.log('\n===== RESULTS =====');
  console.log('live tool msg :', firstTool === null ? 'MISSING' : firstTool.toFixed(1) + 's');
  console.log('done          :', doneT === null ? 'MISSING' : doneT.toFixed(1) + 's');
  console.log('screenshot    :', shotT === null ? 'MISSING' : shotT.toFixed(1) + 's', shotT && doneT && shotT > doneT ? '(after done ✓)' : '');
  console.log('editor LIVE OK:', (await page.evaluate(() => document.body.innerText)).includes('LIVE OK'));
  console.log('img cards     :', await page.locator('img[src^="data:image"]').count());
  console.log('\n===== HTTP 4xx/5xx =====');
  for (const [u, c] of bad) console.log(c + 'x', u.slice(0, 160));
  console.log('===== PAGE ERRORS =====');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await page.screenshot({ path: 'copilot_verify_final.png' });
  await browser.close();
  console.log('TOTAL', ((Date.now() - start) / 1000).toFixed(1) + 's');
})();