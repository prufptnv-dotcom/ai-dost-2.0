const { chromium } = require('playwright');
const fs = require('fs');

const REQUESTS = [
  { msg: 'bihar ke bare me research karo or doct file banao', type: '.docx' },
  { msg: '15 august pe presentation banao', type: '.pptx' },
  { msg: 'bihar ke shaheed jawan ki list csv me do', type: '.csv' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 150)));

  await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  const ta = page.locator('textarea').first();
  if (!(await ta.isVisible().catch(() => false))) { console.log('NO TEXTAREA'); await browser.close(); return; }

  for (const req of REQUESTS) {
    await ta.fill(req.msg);
    await page.keyboard.press('Enter');
    console.log(`\n▶ SENT: "${req.msg}"`);

    let link = null;
    for (let i = 0; i < 36; i++) { // up to 3 min
      await page.waitForTimeout(5000);
      const links = page.locator(`a[href*="${req.type}"]`);
      if (await links.count() > 0) { link = await links.first().getAttribute('href'); break; }
    }

    if (link) {
      const fullUrl = 'http://localhost:3001' + link;
      try {
        const dl = await page.evaluate(async (url) => {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          return { status: res.status, size: buf.byteLength, head: new TextDecoder().decode(buf.slice(0, 2)) };
        }, fullUrl);
        console.log(`  ✅ LINK: ${link} → HTTP ${dl.status}, ${dl.size} bytes, magic "${dl.head}"`);
      } catch (e) {
        console.log(`  ❌ LINK FOUND BUT FETCH FAIL: ${e.message}`);
      }
    } else {
      const lastText = await page.locator('.prose-chat').last().innerText().catch(() => '');
      console.log(`  ❌ NO LINK. LAST REPLY: ${lastText.slice(0, 120).replace(/\n/g, ' ')}`);
    }
    await page.waitForTimeout(1500);
  }

  console.log('\nPAGE ERRORS:', logs.length ? logs.slice(0, 5) : 'none');
  await browser.close();
})();