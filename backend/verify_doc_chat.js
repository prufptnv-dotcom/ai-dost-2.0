const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 200)));

  await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  const ta = page.locator('textarea').first();
  if (!(await ta.isVisible().catch(() => false))) { console.log('NO TEXTAREA'); await browser.close(); return; }

  await ta.fill('bihar ke bare me research karo or doct file banao');
  await page.keyboard.press('Enter');
  console.log('REQUEST SENT: "bihar ke bare me research karo or doct file banao"');

  let linkFound = false;
  let lastText = '';
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(5000);
    const links = await page.locator('a[href*="/downloads/"]').count();
    if (links > 0) { linkFound = true; break; }
    lastText = await page.locator('.prose-chat').last().innerText().catch(() => '');
  }
  console.log('DOWNLOAD LINK FOUND:', linkFound);
  if (linkFound) {
    const href = await page.locator('a[href*="/downloads/"]').first().getAttribute('href');
    console.log('HREF:', href);
  } else {
    console.log('LAST REPLY:', lastText.slice(0, 150).replace(/\n/g, ' '));
  }
  console.log('PAGE ERRORS:', logs.length ? logs.slice(0, 3) : 'none');
  await browser.close();
})();