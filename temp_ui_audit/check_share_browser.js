// P7 definitive proof: a REAL browser opens the public share URL end-to-end
// (tunnel → scoped proxy → backend → vite dev server → React render).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'playwright'));

const URL = process.argv[2];

(async () => {
  if (!URL) {
    console.error('usage: node check_share_browser.js <share-url-with-key>');
    process.exit(2);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 160));
  });

  const resp = await page
    .goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    .catch((e) => ({ statusText: () => e.message }));
  // give React a beat to mount (HMR ws will fail through the share — expected)
  await page.waitForTimeout(4000);

  const rootChildren = await page.evaluate(() => {
    const el = document.getElementById('root');
    return el ? el.children.length : -1;
  });
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));
  const finalUrl = page.url();
  const cookies = await page.context().cookies();
  const shareCookie = cookies.find((c) => c.name === 'aidost_share');

  console.log('final url     :', finalUrl);
  console.log('http status   :', resp && typeof resp.status === 'function' ? resp.status() : 'n/a');
  console.log('share cookie  :', shareCookie ? `SET on ${shareCookie.domain} (HttpOnly=${shareCookie.httpOnly})` : 'MISSING');
  console.log('#root children:', rootChildren);
  console.log('body text     :', JSON.stringify(text));
  const hmrOnly = errors.filter((e) => /server connection lost|WebSocket|ws:\/\/|HMR/i.test(e));
  const realErrors = errors.filter((e) => !hmrOnly.includes(e));
  console.log(`errors        : total=${errors.length} (hmr-through-share expected=${hmrOnly.length}, real=${realErrors.length})`);
  realErrors.slice(0, 5).forEach((e) => console.log('   REAL:', e));

  const shot = path.join(__dirname, 'share_browser.png');
  await page.screenshot({ path: shot });
  console.log('screenshot    :', shot);
  await browser.close();
  process.exit(rootChildren > 0 && shareCookie && realErrors.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
