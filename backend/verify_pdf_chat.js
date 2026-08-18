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
  await ta.fill('bihar ke shaheed jawan ki list pdf me banao');
  await page.keyboard.press('Enter');
  console.log('SENT: "bihar ke shaheed jawan ki list pdf me banao"');

  let pdfLink = null;
  for (let i = 0; i < 36; i++) {
    await page.waitForTimeout(5000);
    pdfLink = await page.locator('a[href*=".pdf"]').first().getAttribute('href').catch(() => null);
    if (pdfLink) break;
  }
  console.log('PDF LINK FOUND:', !!pdfLink, pdfLink || '');
  if (pdfLink) {
    const dl = await page.evaluate(async (url) => {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      return { status: res.status, size: buf.byteLength, head: new TextDecoder().decode(buf.slice(0, 4)) };
    }, 'http://localhost:3001' + pdfLink);
    console.log(`DOWNLOAD: HTTP ${dl.status}, ${dl.size} bytes, head "${dl.head}"`);
  } else {
    const lastText = await page.locator('.prose-chat').last().innerText().catch(() => '');
    console.log('LAST REPLY:', lastText.slice(0, 140).replace(/\n/g, ' '));
  }
  console.log('PAGE ERRORS:', logs.length ? logs.slice(0, 3) : 'none');
  await browser.close();
})();