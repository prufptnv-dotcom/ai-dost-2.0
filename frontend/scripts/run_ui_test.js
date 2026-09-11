const { chromium } = require('playwright');
const path = require('path');

async function runLiveUiTest() {
  console.log('=====================================================');
  console.log('🚀 Launching Real Visible Browser for Live UI Testing');
  console.log('=====================================================');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 600, // Smooth human-like pacing so the user can watch live
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 850 }
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // PART 1: OPTION 1 — AGENT WORKBENCH & SECURITY FLOW
    // -------------------------------------------------------------
    console.log('\n[1/2] Testing Option 1: Agent Workbench...');
    await page.goto('http://localhost:3000/dashboard?view=agent', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('  -> Locating agent prompt input...');
    const agentInput = page.locator('input[placeholder*="Instruct the autonomous agent"]');
    await agentInput.waitFor({ state: 'visible', timeout: 10000 });

    const testPrompt = 'Build a fullstack notes app with SQLite';
    console.log(`  -> Typing prompt: "${testPrompt}"...`);
    await agentInput.fill(testPrompt);
    await page.waitForTimeout(1000);

    console.log('  -> Clicking Execute button...');
    const executeBtn = page.getByRole('button', { name: 'Execute', exact: true });
    await executeBtn.click();

    console.log('  -> Watching Agent planning loop & coordinator hierarchy...');
    await page.waitForTimeout(6000);

    const screenshot1Path = path.resolve(__dirname, '../../agent_workbench_live_user.png');
    await page.screenshot({ path: screenshot1Path });
    console.log(`  -> Saved Option 1 live screenshot: ${screenshot1Path}`);

    // Check for approval banner if any
    const approvalBanner = page.locator('[role="alert"]');
    if (await approvalBanner.isVisible()) {
      console.log('  -> Approval Banner detected! Inspecting details...');
      const bannerText = await approvalBanner.innerText();
      console.log('     ' + bannerText.replace(/\n/g, ' '));
      const approveBtn = approvalBanner.locator('button:has-text("Approve")');
      if (await approveBtn.isVisible()) {
        console.log('  -> Clicking "Approve & Proceed"...');
        await approveBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    await page.waitForTimeout(2000);

    // -------------------------------------------------------------
    // PART 2: OPTION 3 — COPILOT IDE & VISUAL QA / PREVIEW
    // -------------------------------------------------------------
    console.log('\n[2/2] Testing Option 3: Copilot IDE & Visual QA / Live Preview...');
    await page.goto('http://localhost:3000/dashboard?view=copilot', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log('  -> Checking for Error Boundary or crashes...');
    const errorCrash = await page.locator('text=Workspace encountered a rendering issue').isVisible();
    if (errorCrash) {
      console.error('  ❌ Crash detected in Copilot IDE!');
    } else {
      console.log('  ✅ Copilot IDE loaded cleanly with zero crashes!');
    }

    console.log('  -> Checking interactive Preview Canvas...');
    const previewTab = page.getByRole('button', { name: 'Preview', exact: true });
    if (await previewTab.isVisible()) {
      console.log('  -> Preview tab is active and visible.');
    }

    const screenshot2Path = path.resolve(__dirname, '../../copilot_ide_live_user.png');
    await page.screenshot({ path: screenshot2Path });
    console.log(`  -> Saved Option 3 live screenshot: ${screenshot2Path}`);

    console.log('\n=====================================================');
    console.log('🎉 Live Testing of Option 1 and Option 3 Completed!');
    console.log('=====================================================');
    await page.waitForTimeout(4000);

  } catch (err) {
    console.error('Error during live UI testing:', err.message);
  } finally {
    await browser.close();
  }
}

runLiveUiTest();
