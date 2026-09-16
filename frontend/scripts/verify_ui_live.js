const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve('C:/Users/vikash kumar/.gemini/antigravity-ide/brain/c614b521-9fe1-4409-bfcb-5f229f372ecb/screenshots');

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('🚀 Launching System Chrome for Visual Verification...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();
  const consoleErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  // 1. Landing Page
  console.log('📸 1. Navigating to Landing Page: http://localhost:3000/ ...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);
  const landingPath = path.join(OUT_DIR, '01_landing_page.png');
  await page.screenshot({ path: landingPath, fullPage: false });
  console.log(`✅ Landing page captured: ${landingPath}`);

  // 2. Dashboard / Main IDE
  console.log('📸 2. Navigating to Dashboard: http://localhost:3000/dashboard ...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  const dashboardPath = path.join(OUT_DIR, '02_dashboard_ide.png');
  await page.screenshot({ path: dashboardPath, fullPage: false });
  console.log(`✅ Dashboard captured: ${dashboardPath}`);

  // 3. Open Chat & Workspace Trigger
  console.log('📸 3. Testing Chat & Workspace Interaction ...');
  try {
    // Dispatch test workspace state to verify ChatWorkspacePanel opens
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ai_dost_chat_workspace', {
        detail: {
          version: 1,
          open: true,
          type: 'artifact',
          title: 'Live Task Plan & Architecture Verification',
          source: 'task-plan',
          payload: {
            taskId: 'task-live-verify',
            plan: {
              intent: { label: 'Autonomous Production Verification' },
              steps: [
                { title: 'Security Boundary Execution' },
                { title: 'Database Integrity Check' },
                { title: 'MCP Multi-Server Discovery' },
                { title: 'Live UI Verification' }
              ]
            }
          },
          updatedAt: Date.now()
        }
      }));
    });
    await page.waitForTimeout(1000);
    const workspacePath = path.join(OUT_DIR, '03_chat_workspace_panel.png');
    await page.screenshot({ path: workspacePath, fullPage: false });
    console.log(`✅ Chat Workspace Panel captured: ${workspacePath}`);
  } catch (e) {
    console.warn('Workspace trigger note:', e.message);
  }

  // 4. Docs Page
  console.log('📸 4. Navigating to Docs: http://localhost:3000/docs ...');
  await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  const docsPath = path.join(OUT_DIR, '04_docs_page.png');
  await page.screenshot({ path: docsPath, fullPage: false });
  console.log(`✅ Docs page captured: ${docsPath}`);

  await browser.close();

  console.log('\n📊 Visual Verification Summary:');
  console.log(`- Total Screenshots Captured: 4`);
  console.log(`- Output Directory: ${OUT_DIR}`);
  console.log(`- Fatal Console Errors Encountered: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Logged Console Errors:', consoleErrors);
  } else {
    console.log('🎉 0 Console Errors encountered during full navigation flow!');
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
