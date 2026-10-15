// P5 proof: load the LIVE preview (real Vite dev server via backend proxy) in a
// real browser and report what actually rendered + every console/page error.
const { chromium } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'playwright'));

const URL = process.argv[2] || 'http://localhost:5000/api/preview/p5-live/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 200)));
  page.on('response', r => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().slice(0, 160)}`); });
  page.on('requestfailed', r => failedRequests.push(`FAILED ${r.url().slice(0, 160)} :: ${(r.failure() || {}).errorText}`));

  const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      title: document.title,
      rootChildren: root ? root.children.length : -1,
      rootText: (root ? root.innerText : '(no #root)').replace(/\s+/g, ' ').slice(0, 260),
      bodyLen: document.body.innerText.length,
      isViteClient: [...document.scripts].some(s => (s.src || '').includes('/@vite/client')),
    };
  });

  await page.screenshot({ path: require('path').join(__dirname, 'live_preview.png'), fullPage: false });

  console.log('HTTP            :', resp.status());
  console.log('title           :', info.title);
  console.log('vite HMR client :', info.isViteClient);
  console.log('#root children  :', info.rootChildren);
  console.log('#root text      :', info.rootText || '(empty)');
  console.log('console errors  :', consoleErrors.length, consoleErrors.slice(0, 5));
  console.log('page errors     :', pageErrors.length, pageErrors.slice(0, 5));
  console.log('failed requests :', failedRequests.length);
  failedRequests.forEach(f => console.log('   -', f));
  console.log('screenshot      :', require('path').join(__dirname, 'live_preview.png'));

  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
