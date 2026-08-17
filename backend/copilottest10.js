const { chromium } = require('playwright');

const HAS = async (page, txt) => (await page.evaluate((t) => document.body.innerText.includes(t), txt));
const waitFor = async (page, txt, ms = 10000) => {
  const st = Date.now();
  while (Date.now() - st < ms) {
    if (await HAS(page, txt)) return true;
    await page.waitForTimeout(250);
  }
  return false;
};

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

  const gate = page.locator('button[title*="Plan gate"]').first();
  if (await gate.count()) { await gate.click(); await page.waitForTimeout(300); }
  console.log('plan gate OFF (autopilot)');

  const ta = page.locator('textarea[placeholder*="Prompt likho"]').first();
  await ta.fill('Create rollbacktest.js with console.log("v1") then change it to console.log("v2")');
  await ta.locator('xpath=following-sibling::button').first().click();
  console.log('send clicked');

  console.log('\n=== PHASE 1: run + checkpoints + commit ===');
  const done = await waitFor(page, '\u2705', 90000);
  console.log('run done:', done);
  const snapCount = await page.evaluate(() => (document.body.innerText.match(/⏸ Snapshot step/g) || []).length);
  console.log('checkpoint cards:', snapCount);
  const rollBtn = await page.locator('button:has-text("Rollback to step")').count();
  console.log('rollback buttons:', rollBtn);
  const commitShown = await waitFor(page, '🔀 commit', 8000);
  console.log('commit line:', commitShown);

  console.log('\n=== PHASE 2: rollback to step 1 ===');
  await page.waitForTimeout(2500);
  const treeHasV2 = await page.evaluate(() => document.body.innerText.includes('v2'));
  console.log('v2 in workspace before rollback:', treeHasV2);
  const firstRoll = page.locator('button:has-text("Rollback to step")').first();
  if (await firstRoll.count()) {
    await firstRoll.click();
    const rolled = await waitFor(page, 'Rollback done', 15000);
    console.log('rollback done message:', rolled);
    await page.waitForTimeout(2000);
    const treeNow = await page.evaluate(() => document.body.innerText);
    console.log('v1 visible after rollback:', treeNow.includes('v1'));
    console.log('v2 gone after rollback:', !treeNow.includes('v2'));
  } else console.log('rollback button missing — FAIL');

  console.log('\n===== HTTP 4xx/5xx =====');
  for (const [u, c] of bad) console.log(c + 'x', u.slice(0, 160));
  console.log('===== PAGE ERRORS =====');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await page.screenshot({ path: 'copilot_rollback.png' });
  await browser.close();
  console.log('ALL TESTS DONE');
})();