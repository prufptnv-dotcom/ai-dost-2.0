const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve('C:/Users/vikash kumar/.gemini/antigravity-ide/brain/09998a4d-9fb9-4a90-84ac-f3163883a177/website_audit');

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Dark
  const contextDark = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageDark = await contextDark.newPage();
  await pageDark.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await pageDark.evaluate(() => {
    localStorage.setItem('ai_dost_theme', 'dark');
    document.body.classList.remove('light-theme');
  });
  await pageDark.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await pageDark.waitForTimeout(1000);
  await pageDark.screenshot({ path: path.join(OUT_DIR, '01_landing_desktop_dark.png'), fullPage: false });
  await contextDark.close();

  // 2. Desktop Light
  const contextLight = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageLight = await contextLight.newPage();
  await pageLight.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await pageLight.evaluate(() => {
    localStorage.setItem('ai_dost_theme', 'light');
    document.body.classList.add('light-theme');
  });
  await pageLight.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await pageLight.waitForTimeout(1000);
  await pageLight.screenshot({ path: path.join(OUT_DIR, '02_landing_desktop_light.png'), fullPage: false });
  await contextLight.close();

  // 3. Mobile Dark
  const contextMobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const pageMobile = await contextMobile.newPage();
  await pageMobile.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await pageMobile.evaluate(() => {
    localStorage.setItem('ai_dost_theme', 'dark');
    document.body.classList.remove('light-theme');
  });
  await pageMobile.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await pageMobile.waitForTimeout(1000);
  await pageMobile.screenshot({ path: path.join(OUT_DIR, '03_landing_mobile_dark.png'), fullPage: false });
  await contextMobile.close();

  await browser.close();
  console.log('Landing page screenshots captured successfully in:', OUT_DIR);
}

run().catch(console.error);
