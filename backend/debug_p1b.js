const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1560, height: 980 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 300)); });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const openDash = page.locator('text=Open Dashboard').first();
  if (await openDash.count()) { await openDash.click(); await page.waitForTimeout(2500); }
  await page.keyboard.press('Control+3');
  await page.waitForTimeout(4000);
  const errText = await page.evaluate(() => document.body.innerText.includes('IDE crash') ? document.body.innerText.slice(document.body.innerText.indexOf('IDE crash'), document.body.innerText.indexOf('IDE crash') + 300) : 'NO CRASH');
  console.log('BOUNDARY:', errText.replace(/\n/g, ' '));
  console.log(errors.slice(0, 10).join('\n'));
  await browser.close();
})();
