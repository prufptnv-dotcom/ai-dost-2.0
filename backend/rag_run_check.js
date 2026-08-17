const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1560, height: 980 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 150)));
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const openDash = page.locator('text=Open Dashboard').first();
  if (await openDash.count()) { await openDash.click(); await page.waitForTimeout(3500); }
  await page.keyboard.press('Control+3');
  await page.waitForTimeout(4000);
  const ta = page.locator('textarea[placeholder*="Prompt likho"]');
  await ta.fill('workspace me existing files ko dekho aur ek naya file notes.txt banao jisme "rag test" likho');
  await page.keyboard.press('Control+Enter');
  const approve = page.locator('button:has-text("Approve")').first();
  await approve.waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
  const planSeen = (await approve.count()) > 0;
  await page.waitForTimeout(400);
  if (planSeen) await approve.click();
  const diffsReq = page.waitForRequest(r => r.url().includes('/api/agent/run-diffs') && r.method() === 'GET', { timeout: 600000 }).catch(() => null);
  await diffsReq;
  await page.waitForTimeout(3000);
  console.log(JSON.stringify({ planSeen, done: !!diffsReq, errors }, null, 2));
  await browser.close();
})();