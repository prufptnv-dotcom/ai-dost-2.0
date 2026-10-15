const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve('C:/Users/vikash kumar/.gemini/antigravity-ide/brain/09998a4d-9fb9-4a90-84ac-f3163883a177/views_audit');

const VIEWS = [
  'chat',
  'agent',
  'copilot',
  'projects',
  'artifacts',
  'voice',
  'images',
  'history',
  'mcp',
  'settings',
  'resume'
];

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

  for (const v of VIEWS) {
    console.log(`Auditing view: ${v}...`);
    
    // Dark Theme
    await page.goto(`http://localhost:3000/dashboard?view=${v}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    // Ensure dark theme
    await page.evaluate(() => {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('ai_dost_theme', 'dark');
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, `${v}_dark.png`), fullPage: false });
    
    // Toggle to Light Theme
    await page.evaluate(() => {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      document.documentElement.classList.add('light-theme');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('ai_dost_theme', 'light');
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, `${v}_light.png`), fullPage: false });
  }

  await browser.close();
  console.log('All views audit screenshots captured successfully in:', OUT_DIR);
}

run().catch((err) => {
  console.error('Views audit failed:', err);
  process.exit(1);
});
