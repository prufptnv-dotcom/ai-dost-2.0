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
  if (!(await ta.isVisible().catch(() => false))) {
    console.log('NO TEXTAREA — chat view not active');
    await browser.close();
    return;
  }
  await ta.fill('image banao: ek sunset beach ka painting');
  await page.keyboard.press('Enter');
  console.log('IMAGE REQUEST SENT');

  let imageCard = false;
  let replyText = '';
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(5000);
    const img = page.locator('img[src*="pollinations"]').first();
    if (await img.isVisible().catch(() => false)) { imageCard = true; break; }
    const bubbles = await page.locator('.prose-chat').count();
    if (bubbles > 0) replyText = await page.locator('.prose-chat').last().innerText().catch(() => '');
  }
  console.log('IMAGE CARD VISIBLE:', imageCard);
  if (replyText) console.log('LAST REPLY (head):', replyText.slice(0, 120).replace(/\n/g, ' '));
  console.log('PAGE ERRORS:', logs.length ? logs.slice(0, 3) : 'none');
  await browser.close();
})();