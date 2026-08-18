const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  const apiCalls = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 200)));
  page.on('request', r => { if (r.url().includes('/api/')) apiCalls.push(r.method() + ' ' + r.url().replace('http://localhost:5000', '')); });

  await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  // 1. TTS via Volume2 button in main chat
  const ta = page.locator('textarea').first();
  if (await ta.isVisible().catch(() => false)) {
    await ta.fill('2 lines me batayo ki AI-Dost kya karta hai');
    await page.keyboard.press('Enter');
    console.log('CHAT SENT');
    // wait for assistant reply
    let replied = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(3000);
      const volBtn = page.locator('button[title="Read aloud"]').first();
      if (await volBtn.isVisible().catch(() => false)) { replied = true; console.log('ASSISTANT REPLY + VOLUME BTN: yes'); break; }
    }
    if (!replied) console.log('NO REPLY within 2min');
    const volBtn = page.locator('button[title="Read aloud"]').first();
    if (await volBtn.isVisible().catch(() => false)) {
      await volBtn.click();
      console.log('VOLUME CLICKED');
      await page.waitForTimeout(12000);
      const ttsHits = apiCalls.filter(u => u.includes('/agent/ai/tts'));
      console.log('TTS API CALLS:', ttsHits.length);
    }
  } else {
    console.log('NO CHAT TEXTAREA — chat view not shown');
  }

  // 2. Crew tab + cerebras option
  const agentNav = page.locator('button[aria-label="Agent"]').first();
  if (await agentNav.isVisible().catch(() => false)) {
    await agentNav.click();
    await page.waitForTimeout(1500);
  }
  const crewTab = page.locator('button:has-text("Multi-Agent Crew")').first();
  if (await crewTab.isVisible().catch(() => false)) {
    await crewTab.click();
    await page.waitForTimeout(1000);
    const cerebras = await page.locator('button:has-text("Cerebras")').first().isVisible().catch(() => false);
    const nvidia = await page.locator('button:has-text("NVIDIA")').first().isVisible().catch(() => false);
    const ollama = await page.locator('button:has-text("Ollama")').first().isVisible().catch(() => false);
    console.log('CREW OPTIONS — nvidia:', nvidia, 'cerebras:', cerebras, 'ollama:', ollama);
  } else {
    console.log('CREW TAB NOT VISIBLE');
  }

  console.log('PAGE ERRORS:', logs.length ? logs.slice(0, 3) : 'none');
  await browser.close();
})();