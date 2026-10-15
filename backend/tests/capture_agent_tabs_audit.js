const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve('C:/Users/vikash kumar/.gemini/antigravity-ide/brain/09998a4d-9fb9-4a90-84ac-f3163883a177/agent_audit');

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Go to agent view
  await page.goto('http://localhost:3000/dashboard?view=agent', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // 1. Capture Agent Workbench root
  await page.screenshot({ path: path.join(OUT_DIR, '01_agent_workbench.png') });

  // 2. Click Kanban Tasks tab
  const kanbanTab = page.locator('button:has-text("Kanban Tasks")');
  if (await kanbanTab.count() > 0) {
    await kanbanTab.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, '02_agent_kanban.png') });
  }

  // 3. Click Spec Wizard tab
  const specTab = page.locator('button:has-text("Spec Wizard")');
  if (await specTab.count() > 0) {
    await specTab.first().click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT_DIR, '03_agent_spec_wizard.png') });
  }

  // 4. Click Multi-Agent Crew tab (Dark)
  const crewTab = page.locator('button:has-text("Multi-Agent Crew")');
  if (await crewTab.count() > 0) {
    await crewTab.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT_DIR, '04_agent_crew_dark.png') });

    // Switch to light theme and capture
    await page.evaluate(() => {
      document.body.classList.add('light-theme');
      document.documentElement.classList.add('light-theme');
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, '04_agent_crew_light.png') });
  }

  await browser.close();
  console.log('Agent tabs captured successfully in:', OUT_DIR);
}

run().catch(console.error);
