const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const bad = new Map();
  const errors = [];
  page.on('response', r => { if (r.status() >= 400) bad.set(r.url(), (bad.get(r.url()) || 0) + 1); });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const openDash = page.locator('text=Open Dashboard').first();
  if (await openDash.count()) { await openDash.click(); await page.waitForTimeout(2500); }
  await page.keyboard.press('Control+3');
  await page.waitForTimeout(2000);

  const ta = page.locator('textarea[placeholder*="Prompt likho"]').first();
  console.log('prompt textarea count:', await ta.count());
  await ta.fill('Create a simple stopwatch app with stopwatch.html, stopwatch.css, stopwatch.js');
  const sendBtn = ta.locator('xpath=following-sibling::button').first();
  await sendBtn.click();
  console.log('send clicked');

  const start = Date.now();
  let lastText = '';
  const seen = new Set();
  const WATCH_MS = 240000;
  let firstToolT = null, doneT = null, fileInTreeT = null, firstTermT = null;
  while (Date.now() - start < WATCH_MS) {
    await page.waitForTimeout(250);
    const txt = await page.evaluate(() => document.body.innerText);
    for (const l of txt.split('\n').map(s => s.trim()).filter(s => s.length > 1)) {
      if (!lastText.includes(l) && !seen.has(l)) {
        seen.add(l);
        const t = ((Date.now() - start) / 1000).toFixed(1);
        if (/[✍💻✏📋🤔🚀✅⚠🔧🦙⚙]/u.test(l)) console.log(`[${t}s] STATUS> ${l}`);
        else if (/Task \d+ of \d+/i.test(l)) console.log(`[${t}s] TASK> ${l}`);
        else if (/^\$ /u.test(l)) console.log(`[${t}s] TERM> ${l.slice(0, 100)}`);
      }
    }
    if (firstToolT === null && /⚙️/.test(txt)) firstToolT = (Date.now() - start) / 1000;
    if (firstTermT === null && /^\$ /u.test(txt.split('\n').find(l => l.trim().startsWith('$ ')) || '')) firstTermT = (Date.now() - start) / 1000;
    if (fileInTreeT === null && /stopwatch\.html/u.test(txt)) fileInTreeT = (Date.now() - start) / 1000;
    if (doneT === null && /\u2705/.test(txt)) doneT = (Date.now() - start) / 1000;
    lastText = txt;
    if (doneT !== null && Date.now() - start > (doneT * 1000) + 12000) break;
  }
  if (doneT === null) {
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const txt = await page.evaluate(() => document.body.innerText);
      if (/\u2705/.test(txt)) { doneT = (Date.now() - start) / 1000; break; }
    }
  }

  console.log('\n===== LIVE-TIMING CHECK =====');
  console.log('first tool message  :', firstToolT === null ? 'MISSING' : firstToolT.toFixed(1) + 's');
  console.log('first terminal echo :', firstTermT === null ? 'MISSING' : firstTermT.toFixed(1) + 's');
  console.log('file in tree        :', fileInTreeT === null ? 'MISSING' : fileInTreeT.toFixed(1) + 's');
  console.log('done                :', doneT === null ? 'MISSING' : doneT.toFixed(1) + 's');
  if (firstToolT !== null && doneT !== null) console.log('LIVE_TOOL_MSG:', firstToolT < doneT ? 'PASS (tool msg before done)' : 'FAIL');
  if (fileInTreeT !== null && doneT !== null) console.log('LIVE_FILE_TREE:', fileInTreeT < doneT ? 'PASS (file visible before done)' : 'FAIL');

  console.log('\n===== SCREENSHOT CARD (agent eyes) =====');
  await page.waitForTimeout(2500);
  const shotText = await page.evaluate(() => document.body.innerText.includes('result screenshot'));
  const shotImg = await page.locator('img[src^="data:image"]').count();
  console.log('screenshot label text:', shotText, '| screenshot imgs:', shotImg);

  console.log('\n===== LIVE PREVIEW PANEL =====');
  try {
    const prevBtn = page.locator('button:has-text("Preview")').first();
    if (await prevBtn.count()) {
      await prevBtn.click();
      await page.waitForTimeout(2500);
      const iframe = page.locator('iframe[title="live-preview"]').first();
      console.log('iframe present:', await iframe.count());
      const src = await iframe.getAttribute('src');
      console.log('iframe src:', src);
      const fr = page.frames().find(f => f.url().includes('/api/preview/'));
      if (fr) {
        const bodyLen = await fr.evaluate(() => document.body.innerText.length).catch(() => -1);
        const hasStopwatch = await fr.evaluate(() => document.body.innerText.includes('stopwatch') || document.title.includes('stopwatch')).catch(() => false);
        console.log('preview frame body chars:', bodyLen, '| stopwatch text inside:', hasStopwatch);
      } else console.log('preview frame: NOT FOUND');
      await page.screenshot({ path: 'copilot_preview.png' });
      const closeBtn = page.locator('button[title="Close preview"]').first();
      if (await closeBtn.count()) await closeBtn.click();
    } else console.log('Preview button: NOT FOUND');
  } catch (e) { console.log('preview check error:', e.message); }

  console.log('\n===== ZIP LINK =====');
  const zipA = await page.locator('a[href*="zip"]').count();
  console.log('zip link count:', await page.locator('a[href*="zip"]').count());

  console.log('\n===== HTTP 4xx/5xx ====');
  for (const [u, c] of bad) console.log(c + 'x', u.slice(0, 160));
  console.log('===== PAGE ERRORS =====');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await page.screenshot({ path: 'copilot_final.png' });
  await browser.close();
  console.log('DONE in', ((Date.now() - start) / 1000).toFixed(1) + 's');
})();