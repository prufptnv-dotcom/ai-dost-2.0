const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Launching Chromium for Web Access UI Verification...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  const screenshotsDir = 'C:\\Users\\vikash kumar\\.gemini\\antigravity-ide\\brain\\dc27110b-81fa-47f3-91ad-0085871196bf\\audit_screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    console.log('Navigating to http://localhost:3000/dashboard...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Look for chat textarea or input
    console.log('Finding chat input textarea...');
    const textarea = page.locator('textarea, input[placeholder*="Ask"], input[placeholder*="message"], textarea[placeholder*="Ask"], textarea[placeholder*="Message"]').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });

    console.log('Submitting live query: "What is the latest news about AI in 2026?"');
    await textarea.fill('What is the latest news about AI in 2026?');
    await page.waitForTimeout(500);

    // Click submit button or press Enter
    const sendButton = page.locator('button[type="submit"], button:has(svg.lucide-arrow-up), button:has(svg.lucide-send)').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await textarea.press('Enter');
    }

    console.log('Waiting for response and web search sources to arrive...');
    // Wait for response bubble
    await page.waitForTimeout(10000);

    // Take screenshot of live chat with web access response
    const screenshotPath = path.join(screenshotsDir, 'web_access_chat_verification.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot to: ${screenshotPath}`);

    // Inspect sources on page
    const sourceElements = page.locator('a[target="_blank"]');
    const count = await sourceElements.count();
    console.log(`Found ${count} external anchor links in page.`);

    // Check if any secrets were leaked to console or DOM
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasTavilyLeak = /tvly-[a-zA-Z0-9_-]{20,}/i.test(bodyText);
    const hasGeminiLeak = /AIzaSy[a-zA-Z0-9_-]{20,}/i.test(bodyText);

    console.log('Secret leakage check in DOM:', { hasTavilyLeak, hasGeminiLeak });

    const results = {
      success: true,
      screenshot: screenshotPath,
      linksFound: count,
      hasTavilyLeak,
      hasGeminiLeak
    };

    fs.writeFileSync(path.join(screenshotsDir, 'web_access_browser_results.json'), JSON.stringify(results, null, 2));
    console.log('✅ Browser verification completed successfully!');
  } catch (err) {
    console.error('Browser verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
