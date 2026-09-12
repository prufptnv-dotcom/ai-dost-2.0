const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('C:\\Users\\vikash kumar\\.gemini\\antigravity-ide\\brain\\dc27110b-81fa-47f3-91ad-0085871196bf\\audit_screenshots');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  console.log(`Starting Browser Language Matching Verification at ${FRONTEND_URL}...`);

  // Helper function to run a chat turn
  async function executeTurn(page, turnName, prompt, expectedLang, validator) {
    console.log(`\n--- Running [${turnName}] ---`);
    console.log(`User Input: "${prompt}"`);

    const composerInput = page.locator('textarea[placeholder*="Ask"]').first();
    await composerInput.click();
    await composerInput.fill(prompt);
    await sleep(400);

    const initialBubbles = await page.evaluate(() => document.querySelectorAll('.prose-chat').length);
    await page.keyboard.press('Enter');

    let matchedText = '';
    let lastContent = '';
    let stable = 0;

    for (let attempt = 0; attempt < 45; attempt++) {
      await sleep(1000);
      const count = await page.evaluate(() => document.querySelectorAll('.prose-chat').length);
      if (count > initialBubbles) {
        const text = await page.evaluate(() => {
          const bubbles = document.querySelectorAll('.prose-chat');
          return bubbles[bubbles.length - 1].innerText || bubbles[bubbles.length - 1].textContent || '';
        });

        if (text && text.length > 15) {
          if (text === lastContent) {
            stable++;
            if (stable >= 2) {
              matchedText = text;
              break;
            }
          } else {
            stable = 0;
            lastContent = text;
          }
        }
      }
    }

    if (!matchedText && lastContent) matchedText = lastContent;

    const pass = matchedText ? validator(matchedText) : false;
    console.log(`Turn [${turnName}] -> Result (${expectedLang}): ${pass ? 'PASSED' : 'FAILED'}`);
    console.log(`Reply Preview: "${(matchedText || '').slice(0, 140).replace(/\n/g, ' ')}..."`);

    const shotPath = path.join(ARTIFACT_DIR, `browser_${turnName}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    results.push({
      test: turnName,
      inputPrompt: prompt,
      expectedLang,
      matched: pass,
      preview: (matchedText || '').slice(0, 200).replace(/\n/g, ' '),
      screenshot: shotPath
    });

    return pass;
  }

  // TEST 1: Two-turn consecutive language switching in the same session (English -> Hindi)
  console.log('\n==================================================================');
  console.log('TEST 1: CONSECUTIVE LANGUAGE SWITCHING IN SAME SESSION (EN -> HI)');
  console.log('==================================================================');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2000);

    // Turn 1: English
    await executeTurn(
      page,
      'consecutive_turn_1_english',
      'What is HTTP in computer networking? Explain in one sentence.',
      'en',
      (t) => !/[\u0900-\u0D7F]/.test(t) && /\b(http|protocol|web|data|transfer|communication|hypertext)\b/i.test(t)
    );

    // Turn 2: Hindi (switching language in consecutive turn)
    await executeTurn(
      page,
      'consecutive_turn_2_hindi',
      'और HTTPS क्या होता है? संक्षेप में समझाइए।',
      'hi',
      (t) => (t.match(/[\u0900-\u097F]/g) || []).length > 20
    );

    await context.close();
  }

  // TEST 2: Hinglish natural response
  console.log('\n==================================================================');
  console.log('TEST 2: HINGLISH INPUT -> HINGLISH RESPONSE');
  console.log('==================================================================');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2000);

    await executeTurn(
      page,
      'hinglish_test',
      'Router aur Switch mein kya difference hota hai simply explain karo bina code ke',
      'hinglish',
      (t) => (t.match(/[\u0900-\u097F]/g) || []).length < 5 && /\b(hai|hain|hota|hoti|hote|ka|ki|ke|dono|packet|network|data|ye|yeh)\b/i.test(t)
    );

    await context.close();
  }

  // TEST 3: Bengali response
  console.log('\n==================================================================');
  console.log('TEST 3: BENGALI INPUT -> BENGALI RESPONSE');
  console.log('==================================================================');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2000);

    await executeTurn(
      page,
      'bengali_test',
      'কম্পিউটার কি? সংক্ষেপে এক লাইনে উত্তর দিন।',
      'bn',
      (t) => (t.match(/[\u0980-\u09FF]/g) || []).length > 15
    );

    await context.close();
  }

  // TEST 4: Explicit Language Override
  console.log('\n==================================================================');
  console.log('TEST 4: EXPLICIT OVERRIDE (English query, "Reply in Hindi")');
  console.log('==================================================================');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2000);

    await executeTurn(
      page,
      'explicit_override_test',
      'What is cloud computing? Reply in Hindi only please.',
      'hi',
      (t) => (t.match(/[\u0900-\u097F]/g) || []).length > 20
    );

    await context.close();
  }

  // Save report
  const reportPath = path.join(ARTIFACT_DIR, 'live_browser_language_test_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n==================================================================`);
  console.log(`ALL BROWSER VERIFICATIONS COMPLETED!`);
  console.log(`Report saved to: ${reportPath}`);
  console.table(results.map(r => ({ test: r.test, expected: r.expectedLang, matched: r.matched })));

  await browser.close();
}

runTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
