const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve('C:/Users/vikash kumar/.gemini/antigravity-ide/brain/09998a4d-9fb9-4a90-84ac-f3163883a177/copilot_audit');

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Navigate to Copilot IDE
  await page.goto('http://localhost:3000/dashboard?view=copilot', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Switch to Preview workspace mode if button exists
  const previewTab = page.locator('button:has-text("Preview"), [title*="Preview"]').first();
  if (await previewTab.count() > 0) {
    await previewTab.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  // Capture Dark Preview
  await page.screenshot({ path: path.join(OUT_DIR, '01_copilot_preview_dark.png') });

  // Toggle to Light Mode
  await page.evaluate(() => {
    document.body.classList.add('light-theme');
    document.documentElement.classList.add('light-theme');
  });
  await page.waitForTimeout(1000);

  // Capture Light Preview
  await page.screenshot({ path: path.join(OUT_DIR, '02_copilot_preview_light.png') });

  await browser.close();
  console.log('Copilot preview screenshots captured successfully in:', OUT_DIR);
}

run().catch(console.error);
