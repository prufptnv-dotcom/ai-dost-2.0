const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1560, height: 980 } });
  const logs = [];
  page.on('console', m => { logs.push(m.type() + ': ' + m.text().slice(0, 500)); });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const openDash = page.locator('text=Open Dashboard').first();
  if (await openDash.count()) { await openDash.click(); await page.waitForTimeout(2500); }
  await page.keyboard.press('Control+3');
  await page.waitForTimeout(4000);
  for (const l of logs) {
    if (!l.startsWith('error: Failed to load resource')) console.log(l);
  }
  await browser.close();
})();
