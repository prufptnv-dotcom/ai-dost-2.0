// Why does vite's DIRECT HMR ws attempt fail? Probe from a real page context.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'playwright'));

const PAGE = 'http://localhost:5000/api/preview/p5-live/';
const TOKEN = process.argv[2] || 'YkEUAAi9veFE';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const wsEvents = [];
  page.on('websocket', (ws) => {
    wsEvents.push({ url: ws.url(), status: 'attempted' });
    ws.on('close', () => { const e = wsEvents.find((e) => e.url === ws.url()); if (e) e.status = 'closed'; });
    ws.on('socketerror', (err) => { const e = wsEvents.find((e) => e.url === ws.url()); if (e) e.status = 'error: ' + err; });
  });
  const consoleLines = [];
  page.on('console', (m) => { const t = m.text(); if (/WebSocket|failing|HMR|socket/i.test(t)) consoleLines.push(t.substring(0, 180)); });

  await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3500);

  const results = await page.evaluate(async (token) => {
    const attempt = (url) => new Promise((resolve) => {
      let done = false;
      const ws = new WebSocket(url);
      const t = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch (_) {} resolve('TIMEOUT(>2.5s)'); } }, 2500);
      ws.onopen = () => { if (!done) { done = true; clearTimeout(t); ws.close(); resolve('OPEN'); } };
      ws.onerror = () => { /* wait for close reason */ };
      ws.onclose = (ev) => { if (!done) { done = true; clearTimeout(t); resolve('CLOSE code=' + ev.code + ' reason=' + (ev.reason || '(none)')); } };
    });
    const out = {};
    out['direct-localhost'] = await attempt(`ws://localhost:58228/?token=${token}`);
    out['direct-127.0.0.1'] = await attempt(`ws://127.0.0.1:58228/?token=${token}`);
    out['backend-root'] = await attempt(`ws://localhost:5000/?token=${token}`);
    out['backend-with-path'] = await attempt(`ws://localhost:5000/api/preview/p5-live/?token=${token}`);
    return out;
  }, TOKEN);

  console.log('=== ws attempts from real page context (origin http://localhost:5000) ===');
  for (const [k, v] of Object.entries(results)) console.log(`  ${k.padEnd(24)} -> ${v}`);
  console.log('=== page ws events during load ===');
  wsEvents.forEach((e) => console.log('  ' + e.url + '  [' + e.status + ']'));
  console.log('=== vite console (ws-related) ===');
  consoleLines.slice(0, 8).forEach((l) => console.log('  ' + l));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
