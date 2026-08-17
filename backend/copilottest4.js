const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const bad = new Map();
  page.on('response', r => { if (r.status() >= 400) bad.set(r.url(), (bad.get(r.url()) || 0) + 1); });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const openDash = page.locator('text=Open Dashboard').first();
  if (await openDash.count()) { await openDash.click(); await page.waitForTimeout(2500); }
  await page.keyboard.press('Control+3');
  await page.waitForTimeout(3000);

  const ta = page.locator('textarea').first();
  console.log('textarea count:', await ta.count());
  await ta.fill('Create a simple calculator webpage using HTML CSS and JavaScript');
  const valAfterFill = await page.evaluate(() => document.querySelector('textarea').value);
  console.log('textarea value after fill:', JSON.stringify(valAfterFill.slice(0, 50)));

  const sendBtn = ta.locator('xpath=following-sibling::button').first();
  console.log('send button count:', await sendBtn.count());
  await sendBtn.click();
  console.log('send button clicked');

  const start = Date.now();
  let last = '';
  while (Date.now() - start < 20000) {
    await page.waitForTimeout(400);
    const txt = await page.evaluate(() => document.body.innerText);
    if (txt !== last) { last = txt; console.log('--- text changed, tail:', txt.slice(-200).replace(/\n/g, ' | ')); }
  }

  console.log('\n===== HTTP 4xx/5xx ====');
  for (const [u, c] of bad) console.log(c + 'x', u);
  await browser.close();
})();