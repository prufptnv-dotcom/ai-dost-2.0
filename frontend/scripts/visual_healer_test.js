const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });

  // Inject overlapping divs
  await page.evaluate(() => {
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '200px';
    container.style.height = '100px';
    container.style.border = '2px solid red';
    container.style.margin = '20px';
    document.body.appendChild(container);
    const a = document.createElement('div');
    a.textContent = 'Behind';
    a.style.position = 'absolute';
    a.style.left = '30px';
    a.style.top = '30px';
    a.style.background = '#ffcccc';
    container.appendChild(a);
    const b = document.createElement('div');
    b.textContent = 'On top';
    b.style.position = 'absolute';
    b.style.left = '30px';
    b.style.top = '30px';
    b.style.background = '#ff7777';
    container.appendChild(b);
  });

  // Inject overflow element
  await page.evaluate(() => {
    const overflowBox = document.createElement('div');
    overflowBox.style.width = '150px';
    overflowBox.style.height = '50px';
    overflowBox.style.border = '2px solid blue';
    overflowBox.style.overflow = 'visible';
    overflowBox.style.margin = '20px';
    overflowBox.textContent = 'Overflow test';
    document.body.appendChild(overflowBox);
  });

  // Inject clickable span
  await page.evaluate(() => {
    const span = document.createElement('span');
    span.textContent = 'Click me!';
    span.style.cursor = 'pointer';
    span.addEventListener('click', () => console.log('span clicked'));
    document.body.appendChild(span);
  });

  // Wait for VisualHealer heuristics
  await page.waitForTimeout(3000);

  // Capture toast texts
  const toastTexts = await page.$$eval('.fixed.bottom-4.right-4.z-50', nodes => nodes.map(n => n.innerText.trim()).filter(t => t));
  console.log('TOASTS:', JSON.stringify(toastTexts));

  // Screenshot of toast area
  const screenshotPath = `${process.env.USERPROFILE.replace('\\', '/')}/.gemini/antigravity-ide/brain/3aadcd11-fef7-45e8-8675-9b01c2a344b0/visual_healer_test.png`;
  await page.screenshot({ path: screenshotPath, clip: { x: 1200, y: 0, width: 300, height: 200 } });

  await browser.close();
})();
