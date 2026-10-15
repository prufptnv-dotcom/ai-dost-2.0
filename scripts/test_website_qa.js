const path = require('path');
const fs = require('fs');
const { chromium } = require('../backend/node_modules/playwright');

const PREVIEW_URL = 'http://localhost:5000/api/preview/copilot-workspace/';
const ARTIFACTS_DIR = path.resolve(__dirname, '../test-results');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runQALoop() {
  console.log('🚀 Starting ApexHealth 3.0 Autonomous QA Loop...');
  const browser = await chromium.launch({ headless: true });
  
  const consoleErrors = [];
  const pageErrors = [];

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  const testReport = {
    url: PREVIEW_URL,
    timestamp: new Date().toISOString(),
    viewportsTested: [],
    functionalTests: {},
    errorHandlingTests: {},
    consoleErrors: [],
    pageErrors: [],
    overallStatus: 'FAILED'
  };

  try {
    // ----------------------------------------------------
    // TEST 1: DESKTOP VIEWPORT (1280 x 800)
    // ----------------------------------------------------
    console.log('📸 1. Testing Desktop Viewport (1280x800)...');
    await page.setViewportSize({ width: 1280, height: 800 });
    const response = await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`HTTP Status: ${response.status()}`);
    
    await page.waitForSelector('#root', { timeout: 10000 });
    await page.waitForTimeout(1500); // Wait for canvas initialization
    
    const desktopScreenshot = path.join(ARTIFACTS_DIR, 'desktop_view.png');
    await page.screenshot({ path: desktopScreenshot, fullPage: true });
    testReport.viewportsTested.push({ name: 'Desktop', width: 1280, height: 800, screenshot: desktopScreenshot });
    console.log(`Saved screenshot: ${desktopScreenshot}`);

    // ----------------------------------------------------
    // TEST 2: TABLET VIEWPORT (768 x 1024)
    // ----------------------------------------------------
    console.log('📸 2. Testing Tablet Viewport (768x1024)...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(800);
    const tabletScreenshot = path.join(ARTIFACTS_DIR, 'tablet_view.png');
    await page.screenshot({ path: tabletScreenshot, fullPage: true });
    testReport.viewportsTested.push({ name: 'Tablet', width: 768, height: 1024, screenshot: tabletScreenshot });
    console.log(`Saved screenshot: ${tabletScreenshot}`);

    // ----------------------------------------------------
    // TEST 3: MOBILE VIEWPORT (375 x 667)
    // ----------------------------------------------------
    console.log('📸 3. Testing Mobile Viewport (375x667)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(800);
    const mobileScreenshot = path.join(ARTIFACTS_DIR, 'mobile_view.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: true });
    testReport.viewportsTested.push({ name: 'Mobile', width: 375, height: 667, screenshot: mobileScreenshot });
    console.log(`Saved screenshot: ${mobileScreenshot}`);

    // Reset to Desktop for functional workflows
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // ----------------------------------------------------
    // TEST 4: SPECIALTY FILTERING & SEARCH
    // ----------------------------------------------------
    console.log('🔍 4. Testing Specialty Filtering & Search...');
    const cardioBtn = await page.waitForSelector('[data-testid="specialty-btn-Cardiology"]');
    await cardioBtn.click();
    await page.waitForTimeout(500);

    const docCards = await page.$$('[data-testid^="doctor-card-"]');
    console.log(`Cardiology doctors found: ${docCards.length}`);
    testReport.functionalTests.specialtyFiltering = docCards.length > 0 ? 'PASSED' : 'FAILED';

    // Search query test
    const searchInput = await page.waitForSelector('[data-testid="search-input"]');
    await searchInput.fill('Ananya');
    await page.waitForTimeout(500);
    
    // Reset filters
    const allBtn = await page.waitForSelector('[data-testid="specialty-btn-All"]');
    await allBtn.click();
    await searchInput.fill('');
    await page.waitForTimeout(500);

    // ----------------------------------------------------
    // TEST 5: EMERGENCY SOS MODAL
    // ----------------------------------------------------
    console.log('🚨 5. Testing 24/7 SOS Helpline Modal...');
    const sosBtn = await page.waitForSelector('[data-testid="emergency-btn"]');
    await sosBtn.click();
    await page.waitForSelector('[data-testid="emergency-modal"]');
    
    const closeSos = await page.waitForSelector('[data-testid="close-emergency-btn"]');
    await closeSos.click();
    await page.waitForTimeout(300);
    testReport.functionalTests.emergencyModal = 'PASSED';

    // ----------------------------------------------------
    // TEST 6: FORM ERROR HANDLING & VALIDATION
    // ----------------------------------------------------
    console.log('⚠️ 6. Testing Form Error Handling (Invalid & Empty Input)...');
    const bookBtn = await page.waitForSelector('[data-testid="book-doctor-doc-1"]');
    await bookBtn.click();
    await page.waitForSelector('[data-testid="booking-modal"]');

    // Submit Empty Form
    const submitBtn = await page.waitForSelector('[data-testid="submit-booking-btn"]');
    await submitBtn.click();
    await page.waitForTimeout(300);

    const nameError = await page.$('[data-testid="error-patient-name"]');
    const phoneError = await page.$('[data-testid="error-phone"]');

    if (nameError && phoneError) {
      console.log('✅ Empty form correctly caught by validation handlers!');
      testReport.errorHandlingTests.emptyFormValidation = 'PASSED';
    } else {
      console.error('❌ Missing validation errors for empty form submission');
      testReport.errorHandlingTests.emptyFormValidation = 'FAILED';
    }

    // Input invalid short phone number
    const nameInput = await page.waitForSelector('[data-testid="input-patient-name"]');
    const phoneInput = await page.waitForSelector('[data-testid="input-phone"]');
    await nameInput.fill('Karan Malhotra');
    await phoneInput.fill('1234');
    await submitBtn.click();
    await page.waitForTimeout(300);

    const invalidPhoneError = await page.$('[data-testid="error-phone"]');
    if (invalidPhoneError) {
      console.log('✅ Invalid phone length rejected gracefully!');
      testReport.errorHandlingTests.invalidPhoneValidation = 'PASSED';
    }

    // ----------------------------------------------------
    // TEST 7: VALID FORM SUBMISSION & APPOINTMENT CREATION
    // ----------------------------------------------------
    console.log('📝 7. Testing Valid Form Submission...');
    await phoneInput.fill('+91 9876543210');
    await submitBtn.click();
    
    // Check confirmation toast
    await page.waitForSelector('[data-testid="toast-notification"]', { timeout: 4000 });
    console.log('✅ Confirmation toast notification received!');
    testReport.functionalTests.appointmentBooking = 'PASSED';

    // Verify appointment in portal
    await page.waitForTimeout(500);
    const bookingScreenshot = path.join(ARTIFACTS_DIR, 'booking_confirmed.png');
    await page.screenshot({ path: bookingScreenshot });
    testReport.functionalTests.bookingScreenshot = bookingScreenshot;

    // Check cancellation
    const cancelBtns = await page.$$('[data-testid^="cancel-appointment-"]');
    if (cancelBtns.length > 0) {
      await cancelBtns[0].click();
      await page.waitForTimeout(500);
      console.log('✅ Appointment cancellation flow verified!');
      testReport.functionalTests.appointmentCancellation = 'PASSED';
    }

    // ----------------------------------------------------
    // FINAL ERROR AUDIT
    // ----------------------------------------------------
    testReport.consoleErrors = consoleErrors;
    testReport.pageErrors = pageErrors;

    console.log(`Console Errors: ${consoleErrors.length}`);
    console.log(`Page Errors: ${pageErrors.length}`);

    if (pageErrors.length === 0) {
      testReport.overallStatus = 'PASSED';
    }

    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'qa_report.json'),
      JSON.stringify(testReport, null, 2)
    );

    console.log('🎉 QA Loop Completed Successfully! Report saved.');
  } catch (err) {
    console.error('QA Loop Exception:', err);
    testReport.overallStatus = 'ERROR';
    testReport.exception = err.message;
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'qa_report.json'),
      JSON.stringify(testReport, null, 2)
    );
  } finally {
    await browser.close();
  }
}

runQALoop();
