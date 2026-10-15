const { chromium } = require('playwright');
const path = require('path');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:3000/dashboard?view=chat', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
  });

  const loadBtn = page.locator('button:has-text("Load previous conversation")').first();
  if (await loadBtn.count() > 0) await loadBtn.click({ force: true });
  await page.waitForTimeout(1000);

  const runBtn = page.locator('button:has-text("Run Animation")').first();
  if (await runBtn.count() > 0) await runBtn.click({ force: true });
  await page.waitForTimeout(2000);

  for (let i = 0; i < page.frames().length; i++) {
    const f = page.frames()[i];
    if (f.url() === 'about:srcdoc') {
      console.log(`FRAME ${i} BODY:`, await f.innerHTML('body'));
    }
  }

  await page.screenshot({ path: path.resolve('C:/Users/vikash kumar/.gemini/antigravity-ide/brain/09998a4d-9fb9-4a90-84ac-f3163883a177/animation_audit/04_verified_running_sphere.png') });
  await browser.close();
  console.log('Done!');
}
run().catch(console.error);
