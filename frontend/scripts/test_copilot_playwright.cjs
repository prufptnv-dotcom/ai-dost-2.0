const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('🚀 Starting Playwright browser test for Copilot IDE...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  const consoleLogs = [];
  const networkLogs = [];

  page.on('console', msg => {
    const text = `[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log(text);
  });

  page.on('pageerror', err => {
    const text = `[BROWSER UNCAUGHT ERROR] ${err.message}`;
    consoleLogs.push(text);
    console.error(text);
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/agent/') || url.includes('/api/preview')) {
      networkLogs.push(`[NET ${res.status()}] ${res.request().method()} ${url}`);
      console.log(`[NET ${res.status()}] ${res.request().method()} ${url}`);
    }
  });

  const screenshotDir = path.join(__dirname, '..', 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    const freshProjectId = `playwright-${Date.now()}`;
    const testUrl = `http://localhost:3000/dashboard?view=copilot&projectId=${freshProjectId}`;
    console.log(`Navigating to ${testUrl} ...`);
    await page.goto(testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('Waiting for Copilot IDE input to appear...');
    const inputSelector = 'textarea[placeholder*="Message Copilot"]';
    await page.waitForSelector(inputSelector, { timeout: 20000 });
    console.log('✅ Copilot IDE loaded and textarea is ready!');

    await page.screenshot({ path: path.join(screenshotDir, '01_copilot_loaded.png') });

    // Enter prompt
    const testPrompt = 'Create a clean modern Todo app in React with add, toggle, and delete features.';
    console.log(`Typing prompt: "${testPrompt}"`);
    await page.fill(inputSelector, testPrompt);
    await page.waitForTimeout(500);

    // Click Send Button cleanly
    console.log('Clicking send button...');
    const sendBtn = await page.waitForSelector('[data-testid="copilot-send-btn"]', { timeout: 5000 });
    await sendBtn.click();

    console.log('Prompt submitted! Waiting for execution to start...');
    // Wait up to 10 seconds for stop button or execution to start
    await page.waitForSelector('[data-testid="copilot-stop-btn"]', { timeout: 15000 }).catch(() => {
      console.log('Note: Stop button not seen yet, checking stream...');
    });

    console.log('Monitoring execution stream for up to 120 seconds...');

    let completed = false;
    let failed = false;
    let failReason = '';
    let hasStarted = false;
    const startTime = Date.now();

    while (Date.now() - startTime < 120000) {
      await page.waitForTimeout(2000);

      const stopBtn = await page.$('[data-testid="copilot-stop-btn"]');
      if (stopBtn) {
        hasStarted = true;
      }

      // Check text in the page
      const pageText = await page.evaluate(() => document.body.innerText);

      // Check for failure patterns
      if (pageText.includes('Director Error: Copilot Director failed after 4 self-healing attempts')) {
        failed = true;
        failReason = 'Director failed after 4 self-healing attempts';
        console.error('❌ Detected fatal failure in UI text!');
        break;
      }

      // Check for success / progress markers
      const hasPlan = pageText.includes('PLAN ·') || pageText.includes('Director accepted') || pageText.includes('Planning architecture');
      const hasFiles = pageText.includes('.jsx') || pageText.includes('package.json') || pageText.includes('App.jsx');
      const isComplete = pageText.includes('completed') || pageText.includes('All tasks completed') || pageText.includes('Execution complete') || pageText.includes('Completed successfully') || pageText.includes('QA passed') || pageText.includes('Done');

      console.log(`[Status ${Math.round((Date.now() - startTime)/1000)}s] Started: ${hasStarted}, StopBtn: ${Boolean(stopBtn)}, Plan: ${hasPlan}, Files: ${hasFiles}, Complete: ${isComplete}`);

      if (hasPlan || hasFiles) {
        await page.screenshot({ path: path.join(screenshotDir, '02_executing.png') });
      }

      // If execution was running and now finished (stop button gone, files or complete message present)
      if (hasStarted && !stopBtn && (hasFiles || isComplete)) {
        console.log('✅ Agent execution finished successfully! Stop button cleared and files present.');
        completed = true;
        break;
      }
    }

    await page.screenshot({ path: path.join(screenshotDir, '03_final_state.png'), fullPage: true });

    if (failed) {
      console.error(`❌ Test failed: ${failReason}`);
      process.exit(1);
    } else if (completed) {
      console.log('🎉 Playwright browser test finished successfully!');
      process.exit(0);
    } else {
      console.log('Timed out waiting for completion.');
      process.exit(1);
    }

  } catch (err) {
    console.error('❌ Playwright test encountered exception:', err);
    await page.screenshot({ path: path.join(screenshotDir, 'error_state.png'), fullPage: true }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
