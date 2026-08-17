const { chromium } = require('playwright');

const HAS = async (page, txt) => (await page.evaluate((t) => document.body.innerText.includes(t), txt));
const waitFor = async (page, txt, ms = 8000) => {
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

  const ta = page.locator('textarea[placeholder*="Prompt likho"]').first();
  console.log('=== TEST 1: Plan gate → Approve ===');
  await ta.fill('Create hello.js with a function that prints hello');
  await page.keyboard.press('Enter');
  const planCard = await waitFor(page, 'approve karo', 8000);
  console.log('plan card shown:', planCard);
  await page.waitForTimeout(800);
  const startedBeforeApprove = await HAS(page, '⚙️');
  console.log('agent NOT started before approve (expect false):', startedBeforeApprove);
  const taskBullets = await page.evaluate(() => (document.body.innerText.match(/▸/g) || []).length);
  console.log('plan task bullets:', taskBullets);
  const approveBtn = page.locator('button:has-text("Approve — Run karo")').first();
  console.log('approve button:', await approveBtn.count());
  await approveBtn.click();
  const agentRan = await waitFor(page, '⚙️', 30000);
  console.log('agent started after approve:', agentRan);
  const done = await waitFor(page, '\u2705', 60000);
  console.log('run finished (✅):', done);

  console.log('\n=== TEST 2: Plan gate → Cancel ===');
  await page.waitForTimeout(1500);
  await ta.fill('Create cancel.js with a function');
  await page.keyboard.press('Enter');
  const card2 = await waitFor(page, 'approve karo', 8000);
  console.log('plan card 2 shown:', card2);
  const cancelBtn = page.locator('button:has-text("Cancel")').first();
  await cancelBtn.click();
  await page.waitForTimeout(1000);
  console.log('card gone after cancel:', !(await HAS(page, 'approve karo')));
  console.log('no run started after cancel (expect false):', await HAS(page, '⚙️'));

  console.log('\n=== TEST 3: Auto mode (no gate) ===');
  const autoBtn = page.locator('button[title*="Plan gate"]').first();
  console.log('gate toggle exists:', await autoBtn.count());
  await autoBtn.click();
  await page.waitForTimeout(300);
  await ta.fill('Create autotest.js with console.log("auto")');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  console.log('no plan card in auto (expect false):', await HAS(page, 'approve karo'));
  const ranAuto = await waitFor(page, '⚙️', 15000);
  console.log('ran immediately in auto:', ranAuto);

  console.log('\n=== TEST 4: Custom instructions UI ===');
  const settingsBtn = page.locator('button[title="Custom instructions"]').first();
  console.log('settings button:', await settingsBtn.count());
  await settingsBtn.click();
  await page.waitForTimeout(300);
  const instrTa = page.locator('textarea[placeholder*="Custom instructions"]').first();
  console.log('instructions textarea:', await instrTa.count());
  await instrTa.fill('Sirf .js files banao');
  console.log('instructions typed OK');

  console.log('\n===== HTTP 4xx/5xx =====');
  for (const [u, c] of bad) console.log(c + 'x', u.slice(0, 160));
  console.log('===== PAGE ERRORS =====');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await page.screenshot({ path: 'copilot_gate.png' });
  await browser.close();
  console.log('ALL TESTS DONE');
})();