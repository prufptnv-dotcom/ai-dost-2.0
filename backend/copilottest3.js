const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const openDash = page.locator('text=Open Dashboard').first();
  if (await openDash.count()) {
    await openDash.click();
    await page.waitForTimeout(2000);
    console.log('dashboard opened via button');
  }
  console.log('loaded dashboard');

  await page.keyboard.press('Control+3');
  await page.waitForTimeout(1500);

  const ta = page.locator('textarea').first();
  const taCount = await ta.count();
  console.log('textarea count:', taCount);
  if (taCount === 0) {
    console.log('FULL BODY TEXT:\n' + (await page.evaluate(() => document.body.innerText)).slice(0, 3000));
    await browser.close();
    return;
  }

  await ta.fill('Create a simple calculator webpage using HTML CSS and JavaScript');
  await page.keyboard.press('Enter');
  console.log('prompt sent');

  let lastText = '';
  const seen = new Set();
  const start = Date.now();
  const WATCH_MS = 180000;
  while (Date.now() - start < WATCH_MS) {
    await page.waitForTimeout(250);
    const txt = await page.evaluate(() => document.body.innerText);
    const lines = txt.split('\n').map(s => s.trim()).filter(s => s.length > 1);
    for (const l of lines) {
      if (!lastText.includes(l) && !seen.has(l)) {
        seen.add(l);
        const t = ((Date.now() - start) / 1000).toFixed(1);
        if (/[✍💻✏📋🤔🚀✅⚠🔧🦙⚙]/u.test(l)) console.log(`[${t}s] STATUS> ${l}`);
        else if (l.includes('Task ') || l.includes('task ')) console.log(`[${t}s] TASK> ${l}`);
      }
    }
    lastText = txt;
    if (/\u2705/.test(txt) || /error/i.test(txt.split('\n').filter(l => l.includes('⚠')).join(' '))) {
      if (/✓|Done/.test(txt)) break;
    }
  }

  const finalText = await page.evaluate(() => document.body.innerText);
  console.log('\n===== FINAL PANEL TEXT (tail) =====');
  console.log(finalText.split('\n').slice(-60).join('\n'));

  await page.screenshot({ path: 'copilot_c.png', fullPage: false });
  console.log('\n===== CONSOLE/PAGE ERRORS =====');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await browser.close();
  console.log('\nDONE in', ((Date.now() - start) / 1000).toFixed(1) + 's');
})();