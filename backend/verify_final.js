const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 150)));

  await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  const ta = page.locator('textarea').first();
  await ta.fill('bihar ki report pdf me chahiye');
  await page.keyboard.press('Enter');
  console.log('SENT: "bihar ki report pdf me chahiye"');

  let link = null;
  let progressText = '';
  for (let i = 0; i < 48; i++) { // up to 4 min
    await page.waitForTimeout(5000);
    link = await page.locator('a[href*=".pdf"]').first().getAttribute('href').catch(() => null);
    if (link) break;
    progressText = await page.locator('.prose-chat').last().innerText().catch(() => '');
  }

  if (link) {
    console.log('LINK:', link);
    const dl = await page.evaluate(async (url) => {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      return { status: res.status, size: buf.byteLength, head: new TextDecoder().decode(buf.slice(0, 4)) };
    }, 'http://localhost:3001' + link);
    console.log(`DOWNLOAD: HTTP ${dl.status}, ${dl.size} bytes, head "${dl.head}"`);
  } else {
    console.log('NO LINK. LAST REPLY:', progressText.slice(0, 150).replace(/\n/g, ' '));
  }
  console.log('PAGE ERRORS:', logs.length ? logs.slice(0, 3) : 'none');
  await browser.close();
})();