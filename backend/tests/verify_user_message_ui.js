const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:\\Users\\vikash kumar\\.gemini\\antigravity-ide\\brain\\dc27110b-81fa-47f3-91ad-0085871196bf\\audit_screenshots');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyRealApp() {
  const browser = await chromium.launch({ headless: true });
  console.log(`Starting Real-App User Message UI Verification at ${FRONTEND_URL}...`);

  const testInputs = [
    {
      id: 'case_hello',
      label: 'Single short word "hello"',
      text: 'hello',
      expectedSingleLine: true
    },
    {
      id: 'case_english_sentence',
      label: 'English sentence "Hello how are you?"',
      text: 'Hello how are you?',
      expectedSingleLine: true
    },
    {
      id: 'case_hinglish_sentence',
      label: 'Hinglish sentence "Mujhe AI Dost ke baare mein batao"',
      text: 'Mujhe AI Dost ke baare mein batao',
      expectedSingleLine: true
    },
    {
      id: 'case_hindi_devanagari',
      label: 'Hindi Devanagari "नमस्ते, आप कैसे हैं? मुझे मदद चाहिए।"',
      text: 'नमस्ते, आप कैसे हैं? मुझे मदद चाहिए।',
      expectedSingleLine: true
    },
    {
      id: 'case_long_url',
      label: 'Long continuous URL',
      text: 'https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap/an-extremely-long-url-path-that-must-not-overflow-the-container-boundary-testing-user-bubble-safety',
      expectedSingleLine: false
    },
    {
      id: 'case_unbroken_string',
      label: 'Extremely long unbroken alphanumeric string',
      text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_AN_EXTREMELY_LONG_UNBROKEN_STRING_THAT_SHOULD_STAY_WITHIN_BUBBLE',
      expectedSingleLine: false
    }
  ];

  const viewports = [
    { name: 'Desktop (1280x800)', width: 1280, height: 800 },
    { name: 'Mobile (375x667)', width: 375, height: 667 }
  ];

  const fullReport = [];

  for (const vp of viewports) {
    console.log(`\n==================================================================`);
    console.log(`RUNNING VIEWPORT: ${vp.name}`);
    console.log(`==================================================================`);

    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2000);

    for (const tc of testInputs) {
      console.log(`\n[${vp.name}] Testing: ${tc.label}`);

      const composer = page.locator('textarea[placeholder*="Ask"]').first();
      await composer.click();
      await composer.fill(tc.text);
      await sleep(300);

      const initialCount = await page.evaluate(() => document.querySelectorAll('.chat-user-message').length);
      await page.keyboard.press('Enter');

      // Wait for user bubble to appear
      let rendered = false;
      for (let i = 0; i < 15; i++) {
        await sleep(300);
        const count = await page.evaluate(() => document.querySelectorAll('.chat-user-message').length);
        if (count > initialCount) {
          rendered = true;
          break;
        }
      }

      await sleep(400);

      const metrics = await page.evaluate(() => {
        const bubbles = document.querySelectorAll('.chat-user-message');
        const bubble = bubbles[bubbles.length - 1];
        if (!bubble) return null;
        const inner = bubble.querySelector('div') || bubble;
        const parent = bubble.parentElement;
        const chatContainer = document.querySelector('.space-y-6') || document.body;

        const bRect = bubble.getBoundingClientRect();
        const iRect = inner.getBoundingClientRect();
        const pRect = parent.getBoundingClientRect();
        const cRect = chatContainer.getBoundingClientRect();

        const lineHeight = parseFloat(window.getComputedStyle(inner).lineHeight) || 22.475;
        const lines = Math.round(iRect.height / lineHeight);
        const overflowsContainer = bRect.right > (cRect.right + 4);

        return {
          bubbleRect: { width: bRect.width, height: bRect.height, left: bRect.left, right: bRect.right },
          innerRect: { width: iRect.width, height: iRect.height },
          parentRect: { width: pRect.width, height: pRect.height },
          lines,
          lineHeight,
          overflowsContainer,
          textContent: inner.textContent
        };
      });

      const shotFileName = `real_app_${vp.name.startsWith('Desktop') ? 'desktop' : 'mobile'}_${tc.id}.png`;
      const shotFilePath = path.join(ARTIFACT_DIR, shotFileName);
      await page.screenshot({ path: shotFilePath });

      let passed = false;
      if (metrics) {
        if (tc.expectedSingleLine) {
          passed = metrics.lines === 1 && !metrics.overflowsContainer;
        } else {
          passed = metrics.lines >= 1 && !metrics.overflowsContainer;
        }
      }

      console.log(`   -> Lines: ${metrics?.lines}, Width: ${metrics?.bubbleRect.width.toFixed(1)}px, Container Overflow: ${metrics?.overflowsContainer} | Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);

      fullReport.push({
        viewport: vp.name,
        testId: tc.id,
        label: tc.label,
        input: tc.text.slice(0, 50),
        bubbleWidth: metrics ? metrics.bubbleRect.width : 0,
        innerWidth: metrics ? metrics.innerRect.width : 0,
        lines: metrics ? metrics.lines : 0,
        overflowsContainer: metrics ? metrics.overflowsContainer : true,
        passed,
        screenshot: shotFileName
      });
    }

    // Check page horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });

    console.log(`\n[${vp.name}] Document Horizontal Overflow: ${hasHorizontalOverflow ? 'DETECTED ❌' : 'NONE (Clean) ✅'}`);
    console.log(`[${vp.name}] Console Errors Count: ${consoleErrors.length}`);

    await context.close();
  }

  // Save report
  const reportPath = path.join(ARTIFACT_DIR, 'user_message_wrapping_verification.json');
  fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2), 'utf-8');

  console.log(`\n==================================================================`);
  console.log(`REAL APP VERIFICATION COMPLETED! Report saved to: ${reportPath}`);
  console.table(fullReport.map(r => ({
    vp: r.viewport.split(' ')[0],
    test: r.testId,
    width: `${r.bubbleWidth.toFixed(1)}px`,
    lines: r.lines,
    overflow: r.overflowsContainer,
    passed: r.passed ? 'PASS' : 'FAIL'
  })));

  await browser.close();
}

verifyRealApp().catch(err => {
  console.error('Real app verification failed:', err);
  process.exit(1);
});
