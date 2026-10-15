// Explicit proof: a vite-hmr WebSocket through the BACKEND (:5000) opens.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'playwright'));

(async () => {
  const token = ((await (await fetch('http://localhost:5000/api/preview/p5-live/@vite/client')).text())
    .match(/const wsToken = "([^"]+)"/) || [])[1];
  if (!token) { console.log('FAIL: no wsToken'); process.exit(1); }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5000/api/preview/p5-live/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  const result = await page.evaluate((tok) => new Promise((resolve) => {
    let done = false;
    const ws = new WebSocket('ws://localhost:5000/?token=' + tok, 'vite-hmr');
    const t = setTimeout(() => { if (!done) { done = true; resolve('TIMEOUT'); ws.close(); } }, 3000);
    ws.onopen = () => { if (!done) { done = true; clearTimeout(t); resolve('OPEN (backend-proxied HMR works)'); setTimeout(() => ws.close(), 300); } };
    ws.onclose = (ev) => { if (!done) { done = true; clearTimeout(t); resolve('CLOSE code=' + ev.code); } };
  }), token);
  console.log('ws://localhost:5000/?token=' + token + ' [vite-hmr] -> ' + result);
  await browser.close();
  process.exit(result.startsWith('OPEN') ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
