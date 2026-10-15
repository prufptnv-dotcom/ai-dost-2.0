const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Launching Chromium for Assessment UI Verification...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });

  const screenshotsDir = 'C:\\Users\\vikash kumar\\.gemini\\antigravity-ide\\brain\\dc27110b-81fa-47f3-91ad-0085871196bf\\audit_screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    console.log('Navigating to http://localhost:3000/dashboard...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Locate chat textarea
    console.log('Locating chat input textarea...');
    const textarea = page.locator('textarea, textarea[placeholder*="Ask"]').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });

    // Submit natural language quiz prompt
    const promptText = 'Mujhe Python ka 5-question quiz karao.';
    console.log(`Submitting prompt: "${promptText}"`);
    await textarea.fill(promptText);
    await page.waitForTimeout(500);

    const sendBtn = page.locator('button:has(svg.lucide-arrow-up), button:has(svg.lucide-send), button[type="submit"]').first();
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
    } else {
      await textarea.press('Enter');
    }

    console.log('Waiting for AI response & AssessmentCard to render...');
    // Wait for the assessment card button
    const launchBtn = page.locator('button:has-text("Launch Assessment")').first();
    await launchBtn.waitFor({ state: 'visible', timeout: 45000 });

    // Screenshot of chat containing AssessmentCard
    const chatCardScreenshot = path.join(screenshotsDir, 'assessment_chat_card.png');
    await page.screenshot({ path: chatCardScreenshot });
    console.log(`Saved chat card screenshot to: ${chatCardScreenshot}`);

    // Click Launch Assessment to open AssessmentRunner
    console.log('Launching Assessment Runner Modal...');
    await launchBtn.click();
    await page.waitForTimeout(1500);

    // Verify AssessmentRunner is visible
    const runnerHeader = page.locator('text=Question 1 of').first();
    await runnerHeader.waitFor({ state: 'visible', timeout: 10000 });

    // Screenshot of active test runner
    const runnerScreenshot = path.join(screenshotsDir, 'assessment_active_runner.png');
    await page.screenshot({ path: runnerScreenshot });
    console.log(`Saved active runner screenshot to: ${runnerScreenshot}`);

    // Answer Question 1: click first option
    console.log('Selecting option for Question 1...');
    const firstOption = page.locator('button:has(span.font-mono):has-text("A")').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
    }

    // Toggle Mark for Review
    console.log('Toggling Mark for Review...');
    const markBtn = page.locator('button:has-text("Mark Review")').first();
    if (await markBtn.isVisible()) {
      await markBtn.click();
    }

    // Click Next to navigate to Question 2
    console.log('Navigating to Question 2...');
    const nextBtn = page.locator('button:has-text("Next")').first();
    await nextBtn.click();
    await page.waitForTimeout(500);

    // Answer Question 2
    console.log('Selecting option for Question 2...');
    const q2Option = page.locator('button:has(span.font-mono):has-text("B")').first();
    if (await q2Option.isVisible()) {
      await q2Option.click();
    }

    // Submit the test
    console.log('Clicking Submit Test...');
    const submitBtn = page.locator('button:has-text("Submit Test")').first();
    await submitBtn.click();
    await page.waitForTimeout(800);

    // Confirm submit in modal
    const confirmBtn = page.locator('button:has-text("Confirm Submit")').first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();

    console.log('Waiting for evaluation results & scorecard...');
    const scoreTitle = page.locator('text=Score:').first();
    await scoreTitle.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Screenshot of final Scorecard & Review
    const scorecardScreenshot = path.join(screenshotsDir, 'assessment_scorecard_result.png');
    await page.screenshot({ path: scorecardScreenshot });
    console.log(`Saved scorecard screenshot to: ${scorecardScreenshot}`);

    const results = {
      success: true,
      chatCardScreenshot,
      runnerScreenshot,
      scorecardScreenshot
    };

    fs.writeFileSync(path.join(screenshotsDir, 'assessment_browser_results.json'), JSON.stringify(results, null, 2));
    console.log('✅ Assessment Browser UI Verification completed successfully!');
  } catch (err) {
    console.error('Assessment Browser Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
