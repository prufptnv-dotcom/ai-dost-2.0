// P6 spike runner: open the COOP/COEP page, wait for boot/server-ready, report.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'playwright'));

const URL = process.argv[2] || 'http://127.0.0.1:3999/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e.message).slice(0, 200)));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

  const ok = await page
    .waitForFunction(() => {
      const s = window.__status || [];
      return window.__wcUrl || window.__bootError || s.some((x) => x.startsWith('ERROR'));
    }, { timeout: 90000 })
    .then(() => true)
    .catch(() => false);

  const status = await page.evaluate(() => window.__status || []);
  const wcUrl = await page.evaluate(() => window.__wcUrl);
  const err = await page.evaluate(() => window.__bootError);
  const isolated = await page.evaluate(() => window.crossOriginIsolated);

  console.log('=== status ===');
  status.forEach((s) => console.log('  ' + s));
  console.log('crossOriginIsolated : ' + isolated);
  console.log('server-ready URL    : ' + (wcUrl || '(none)'));
  console.log('boot error          : ' + (err || '(none)'));
  console.log('console errors      : ' + consoleErrors.length);
  consoleErrors.slice(0, 5).forEach((e) => console.log('  ' + e));

  if (wcUrl) {
    // load the container's served page directly in a fresh tab to prove content
    const p2 = await browser.newPage();
    await p2.goto(wcUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    const text = await p2.textContent('#x').catch(() => null);
    console.log('served content #x   : ' + (text || '(not found)'));
    await p2.close();
    await page.screenshot({ path: path.join(__dirname, 'wc_spike.png') });
    console.log('screenshot          : ' + path.join(__dirname, 'wc_spike.png'));
  }

  await browser.close();
  process.exit(wcUrl && isolated ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
