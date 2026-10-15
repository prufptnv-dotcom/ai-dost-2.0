const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('http://localhost:3000/dashboard?view=chat', { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const errors = await page.$$eval('nextjs-portal', els => els.map(e => e.shadowRoot?.innerHTML || e.innerHTML));
  console.log('NEXTJS PORTAL COUNT:', errors.length);
  if (errors.length > 0) {
    console.log('PORTAL CONTENT:', errors[0]?.slice(0, 500));
  }

  await browser.close();
}
run().catch(console.error);
