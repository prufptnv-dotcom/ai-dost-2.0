const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve('C:/Users/vikash kumar/.gemini/antigravity-ide/brain/09998a4d-9fb9-4a90-84ac-f3163883a177/screenshots');

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/dashboard...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 1. Desktop Dark Empty State
  console.log('1. Capturing Desktop Dark Empty State...');
  await page.screenshot({ path: path.join(OUT_DIR, '01_desktop_dark_empty.png'), fullPage: false });

  // 2. Toggle Theme to Light
  console.log('2. Toggling to Light Theme...');
  const themeToggle = page.locator('button[title*="mode"], button[aria-label*="mode"], .chat-sidebar-bottom button:last-child').first();
  if (await themeToggle.count() > 0) {
    await themeToggle.click();
    await page.waitForTimeout(1000);
    console.log('Capturing Desktop Light Empty State...');
    await page.screenshot({ path: path.join(OUT_DIR, '02_desktop_light_empty.png'), fullPage: false });
  }

  // 3. Send message to generate conversation with Code Block
  console.log('3. Sending prompt to generate code block...');
  const composerInput = page.locator('textarea[placeholder*="Ask"]').first();
  await composerInput.fill('Write a python function to calculate factorial and explain it in one line.');
  await page.waitForTimeout(300);

  // Capture focused composer state
  await page.screenshot({ path: path.join(OUT_DIR, '03_desktop_light_composer_focused.png'), fullPage: false });

  await page.keyboard.press('Enter');
  console.log('Waiting for AI response...');

  // Wait for AI reply message bubble to render
  try {
    await page.waitForSelector('.prose-chat', { timeout: 25000 });
    await page.waitForTimeout(3000);
  } catch (err) {
    console.log('Wait for response timed out or response completed early:', err.message);
  }

  // 4. Capture Light Theme Chat with Code
  console.log('4. Capturing Desktop Light Chat with Code...');
  await page.screenshot({ path: path.join(OUT_DIR, '04_desktop_light_chat_code.png'), fullPage: false });

  // 5. Hover over AI message to reveal contextual actions
  console.log('5. Hovering over AI message actions...');
  const aiMessage = page.locator('.prose-chat').last();
  if (await aiMessage.count() > 0) {
    await aiMessage.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, '05_desktop_light_actions_hover.png'), fullPage: false });
  }

  // 6. Switch back to Dark Theme
  console.log('6. Switching back to Dark Theme...');
  if (await themeToggle.count() > 0) {
    await themeToggle.click();
    await page.waitForTimeout(1000);
    console.log('Capturing Desktop Dark Chat with Code...');
    await page.screenshot({ path: path.join(OUT_DIR, '06_desktop_dark_chat_code.png'), fullPage: false });
  }

  // 7. Mobile Viewport (390 x 844)
  console.log('7. Switching to Mobile Viewport (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  console.log('Capturing Mobile Dark Chat...');
  await page.screenshot({ path: path.join(OUT_DIR, '07_mobile_dark_chat.png'), fullPage: false });

  // 8. Mobile Light Theme
  console.log('8. Toggling to Mobile Light Theme...');
  await page.evaluate(() => {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('ai_dost_theme', 'light');
  });
  await page.waitForTimeout(1000);
  console.log('Capturing Mobile Light Chat...');
  await page.screenshot({ path: path.join(OUT_DIR, '08_mobile_light_chat.png'), fullPage: false });

  await browser.close();
  console.log('All screenshots captured successfully in:', OUT_DIR);
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
