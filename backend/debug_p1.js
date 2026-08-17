const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1560, height: 980 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  const openDash = page.locator('text=Open Dashboard').first();
  console.log('openDash count:', await openDash.count());
  if (await openDash.count()) { await openDash.click(); await page.waitForTimeout(3000); }
  console.log('URL2:', page.url());
  const ideTitle = page.locator('text=AI-Dost Copilot');
  console.log('ideTitle count (before ctrl+3):', await ideTitle.count());
  await page.keyboard.press('Control+3');
  await page.waitForTimeout(4000);
  console.log('ideTitle count (after ctrl+3):', await ideTitle.count());
  console.log('New File count:', await page.locator('button:has-text("New File")').count());
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('BODY:', bodyText.replace(/\n/g, ' | '));
  await browser.close();
})();
