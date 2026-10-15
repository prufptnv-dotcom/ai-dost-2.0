/**
 * Visual Healer Browser Tests (Playwright + real Chromium)
 *
 * These tests verify that the heuristic engine receives REAL browser geometry,
 * real computed styles, and detects actual layout issues in real Chromium.
 *
 * Per Phase-1 spec:
 *  - Real getBoundingClientRect / getComputedStyle (no jsdom mocks)
 *  - Real overflow / text-overlap / clipping / hidden-interactive detection
 *  - Real MutationObserver pipeline (finding without manual analyze call)
 *  - Iframe integration (preview analyzed, host NOT)
 *  - Real viewport resize (375 / 768 / 1440)
 *  - False-positive protection (aria-hidden descendants, modal, nested text)
 *
 * Uses file:// URLs for fixtures — no webServer required.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Path to fixtures directory
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

/**
 * Load the VisualHealer source and convert it from an ES module into a
 * plain browser script:
 *  - `export default <name>;` → `window.__VH_DEFAULT = <name>;`
 *  - `export function x` / `export const x` → `function x` / `const x`
 */
function loadVisualHealerSource() {
  const visualHealerPath = path.join(__dirname, '..', '..', 'utils', 'visualHealer.js');
  let code = fs.readFileSync(visualHealerPath, 'utf8');
  code = code.replace(/^export default /m, 'window.__VH_DEFAULT = ');
  code = code.replace(/^export /gm, '');
  return code;
}

/**
 * Helper: Load a fixture page and inject the VisualHealer script.
 * Returns after window.analyzeDocument is available.
 */
async function loadFixtureWithVisualHealer(page, fixtureName) {
  const fixturePath = path.join(FIXTURES_DIR, fixtureName);
  await page.goto(pathToFileURL(fixturePath).href);

  await page.waitForLoadState('networkidle');

  await page.addScriptTag({ content: loadVisualHealerSource() });
  await page.waitForFunction(() => typeof window.analyzeDocument === 'function');

  return page;
}

/**
 * Helper: Run analyzeDocument in the page context against the real DOM.
 * Options (viewportWidth etc.) are accepted for API compatibility; the real
 * browser viewport is what actually drives geometry.
 */
async function analyzeInPage(page, options = {}) {
  return page.evaluate((opts) => window.analyzeDocument(document, opts), options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Real Browser Geometry Verification
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Real Browser Geometry', () => {

  test('getBoundingClientRect returns real non-zero values', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'overflow.html');

    const geometry = await page.evaluate(() => {
      const el = document.querySelector('.wide-element');
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        computedWidth: style.width,
        computedHeight: style.height,
      };
    });

    // Real browser geometry — NOT jsdom all-zeros
    expect(geometry.width).toBeGreaterThan(100);
    expect(geometry.height).toBeGreaterThan(10);
    expect(geometry.x).toBeGreaterThanOrEqual(0);
    expect(geometry.y).toBeGreaterThanOrEqual(0);
    expect(geometry.computedWidth).toBeTruthy();
    expect(geometry.computedHeight).toBeTruthy();
  });

  test('getComputedStyle returns real values', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'overflow.html');

    const computed = await page.evaluate(() => {
      const el = document.querySelector('.wide-element');
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        overflow: style.overflow,
        width: style.width,
        height: style.height,
      };
    });

    expect(computed.display).toBe('flex');
    expect(computed.visibility).toBe('visible');
    expect(computed.position).toBeTruthy();
    expect(computed.width).toBeTruthy();
    expect(computed.height).toBe('50px');
  });

  test('overflow detection finds viewport overflow', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'overflow.html');

    const report = await analyzeInPage(page);

    expect(report.success).toBe(true);
    expect(report.findings.length).toBeGreaterThan(0);

    const overflowFinding = report.findings.find(f => f.type === 'viewport-horizontal-overflow');
    expect(overflowFinding).toBeDefined();
    expect(overflowFinding.selector).toContain('wide-element');
  });

  test('text overlap detection finds overlapping elements', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'text-overlap.html');

    const report = await analyzeInPage(page);

    expect(report.success).toBe(true);

    const overlapFinding = report.findings.find(f => f.type === 'text-overlap');
    expect(overlapFinding).toBeDefined();
  });

  test('hidden interactive detection finds invisible buttons', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'hidden-interactive.html');

    const report = await analyzeInPage(page);

    expect(report.success).toBe(true);

    const invisibleFinding = report.findings.find(f => f.type === 'zero-size-interactive');
    expect(invisibleFinding).toBeDefined();
  });

  test('clipping detection finds interactive element clipped by viewport edge', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'clipping.html');

    const report = await analyzeInPage(page);

    expect(report.success).toBe(true);

    const clipFinding = report.findings.find(f => f.type === 'clipped-interactive');
    expect(clipFinding).toBeDefined();
    expect(clipFinding.selector).toContain('clip-button');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Runtime Error Capture (real window error → structured finding)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Runtime Error Capture', () => {

  test('runtime errors are captured in findings', async ({ page }) => {
    // The fixture also throws an Error 100ms after load, but that races with
    // script injection. So after attaching capture we dispatch the window
    // error deterministically. addScriptTag runs at true top-level scope
    // (addInitScript wraps content in a function scope, which would leave
    // window.analyzeDocument undefined).
    const fixturePath = path.join(FIXTURES_DIR, 'runtime-error.html');
    await page.goto(pathToFileURL(fixturePath).href);
    await page.addScriptTag({ content: loadVisualHealerSource() });
    await page.evaluate(() => initRuntimeErrorCapture());

    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'visual-healer-test-runtime-error',
        error: new Error('visual-healer-test-runtime-error'),
        filename: 'file:///fixture/runtime-error.html',
        lineno: 17,
        colno: 15
      }));
    });

    await page.waitForFunction(
      () => window.getRuntimeErrors && window.getRuntimeErrors().length > 0,
      null,
      { timeout: 5000 }
    );

    await page.waitForTimeout(100);

    const report = await analyzeInPage(page);

    expect(report.success).toBe(true);

    const runtimeFinding = report.findings.find(f => f.type === 'runtime-error');
    expect(runtimeFinding).toBeDefined();
    expect(runtimeFinding.message).toContain('visual-healer-test-runtime-error');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: False Positive Protection
// ─────────────────────────────────────────────────────────────────────────────

test.describe('False Positive Protection', () => {

  test('correct UI does not generate false positives', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'correct-ui.html');

    const report = await analyzeInPage(page);

    expect(report.success).toBe(true);

    // Should NOT flag the fixed modal as viewport overflow
    const falseOverflow = report.findings.find(f =>
      f.type === 'viewport-horizontal-overflow' && f.selector && f.selector.includes('modal')
    );
    expect(falseOverflow).toBeUndefined();

    // Should NOT flag nested text elements as overlap
    const falseOverlap = report.findings.find(f =>
      f.type === 'text-overlap' && f.selector && f.selector.includes('nested')
    );
    expect(falseOverlap).toBeUndefined();
  });

  test('aria-hidden descendants are ignored', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'correct-ui.html');

    const report = await analyzeInPage(page);

    expect(report.success).toBe(true);

    // Elements inside aria-hidden="true" should not generate findings
    const ariaHiddenFindings = report.findings.filter(f =>
      f.selector && f.selector.includes('aria-hidden')
    );
    expect(ariaHiddenFindings.length).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: MutationObserver Pipeline (real observer → debounced scan)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('MutationObserver Pipeline', () => {

  test('DOM mutations trigger scans and generate findings without manual analyze', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'overflow.html');

    // Initialize VisualHealer with a report callback (real observer pipeline)
    await page.evaluate(() => {
      window.__testFindings = [];
      window.__cleanup = window.initVisualHealer(document, (report) => {
        window.__testFindings.push(report);
      });
    });

    // The observer pipeline only scans in response to MUTATIONS, so no report
    // can exist before we change the DOM:
    const before = await page.evaluate(() => window.__testFindings.length);
    expect(before).toBe(0);

    // Mutation #1 — insert an overflowing element. This must trigger:
    // childList mutation → MutationObserver → debounce → scan → onReport
    await page.evaluate(() => {
      const newEl = document.createElement('div');
      newEl.className = 'dynamic-overflow';
      newEl.style.width = '3000px';
      newEl.style.height = '30px';
      newEl.style.background = 'blue';
      newEl.textContent = 'Dynamically added overflow element';
      document.body.appendChild(newEl);
    });

    // Wait for debounced scan + report #1
    await page.waitForTimeout(700);

    // Mutation #2 — insert another overflowing element. post-cooldown, so it
    // must produce a second scan + report #2 (proves the pipeline keeps firing)
    await page.evaluate(() => {
      const secondEl = document.createElement('div');
      secondEl.className = 'dynamic-overflow-2';
      secondEl.style.width = '2500px';
      secondEl.style.height = '30px';
      secondEl.style.background = 'purple';
      secondEl.textContent = 'Second dynamically added overflow element';
      document.body.appendChild(secondEl);
    });

    await page.waitForTimeout(700);

    const findings = await page.evaluate(() => window.__testFindings);

    // First report (mutation #1) + second report (mutation #2) — both produced
    // by the observer pipeline, WITHOUT any manual analyzeDocument() call.
    expect(findings.length).toBeGreaterThanOrEqual(2);

    // The first auto report must see the first element's overflow
    const firstReport = findings[0];
    const dynamicOverflow = firstReport.findings.find(f =>
      f.type === 'viewport-horizontal-overflow' && f.selector && f.selector.includes('dynamic-overflow')
    );
    expect(dynamicOverflow).toBeDefined();

    // The last auto report must see the second element's overflow
    const lastReport = findings[findings.length - 1];
    const dynamicOverflow2 = lastReport.findings.find(f =>
      f.type === 'viewport-horizontal-overflow' && f.selector && f.selector.includes('dynamic-overflow-2')
    );
    expect(dynamicOverflow2).toBeDefined();

    // Clean up observer
    await page.evaluate(() => {
      if (window.__cleanup) window.__cleanup();
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Iframe Integration (preview analyzed, host NOT — audit regression)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Iframe Integration', () => {

  test('iframe content is analyzed, not host page', async ({ page }) => {
    const fixturePath = path.join(FIXTURES_DIR, 'host-with-iframe.html');
    await page.goto(pathToFileURL(fixturePath).href);
    await page.waitForLoadState('networkidle');

    const frameHandle = await page.$('#preview-frame');
    const frame = await frameHandle.contentFrame();

    // Inject VisualHealer into the iframe (simulates production preview wiring)
    await frame.addScriptTag({ content: loadVisualHealerSource() });
    await frame.waitForFunction(() => typeof window.analyzeDocument === 'function');

    // Analyze the iframe document
    const report = await frame.evaluate(() => window.analyzeDocument(document));

    expect(report.success).toBe(true);

    // Must find the overflow inside the iframe
    const overflowFinding = report.findings.find(f => f.type === 'viewport-horizontal-overflow');
    expect(overflowFinding).toBeDefined();

    // Must NOT report the host page's deliberately broken element
    const hostBrokenFinding = report.findings.find(f =>
      f.selector && f.selector.includes('broken-host-element')
    );
    expect(hostBrokenFinding).toBeUndefined();

    // Host page analyzed separately must show the host's own broken element
    await page.addScriptTag({ content: loadVisualHealerSource() });
    await page.waitForFunction(() => typeof window.analyzeDocument === 'function');
    const hostReport = await page.evaluate(() => window.analyzeDocument(document));
    expect(hostReport.success).toBe(true);
    const hostFinding = hostReport.findings.find(f =>
      f.selector && f.selector.includes('broken-host-element')
    );
    expect(hostFinding).toBeDefined();
  });

  test('iframe runtime errors are captured via captureIframeRuntimeErrors', async ({ page }) => {
    const fixturePath = path.join(FIXTURES_DIR, 'host-with-iframe.html');
    await page.goto(pathToFileURL(fixturePath).href);
    await page.waitForLoadState('networkidle');

    const frameHandle = await page.$('#preview-frame');
    const frame = await frameHandle.contentFrame();

    await frame.addScriptTag({ content: loadVisualHealerSource() });
    await page.addScriptTag({ content: loadVisualHealerSource() });

    // Attach iframe error capture from the HOST (like VisualHealer.jsx does)
    const captured = await page.evaluate(() => {
      window.__iframeErrors = [];
      const iframe = document.querySelector('#preview-frame');
      const detach = window.captureIframeRuntimeErrors(iframe, (finding) => {
        window.__iframeErrors.push(finding);
      });
      window.__detachIframeErrors = detach;
      return true;
    });
    expect(captured).toBe(true);

    // Trigger an error inside the iframe
    await frame.evaluate(() => {
      setTimeout(() => { throw new Error('iframe-captured-runtime-error'); }, 50);
    });
    await page.waitForTimeout(600);

    const errors = await page.evaluate(() => window.__iframeErrors);
    const match = errors.find(e => e.message && e.message.includes('iframe-captured-runtime-error'));
    expect(match).toBeDefined();
    expect(match.type).toBe('iframe-runtime-error');

    // And it must be normalized into the shared runtime error store
    const stored = await page.evaluate(() => window.getRuntimeErrors());
    expect(stored.some(e => e.message && e.message.includes('iframe-captured-runtime-error'))).toBe(true);

    await page.evaluate(() => { if (window.__detachIframeErrors) window.__detachIframeErrors(); });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Responsive Viewport (REAL viewport resize — not a parameter)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Responsive Viewport', () => {

  const BREAKPOINTS = [
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];

  test('viewport resize changes real geometry and detection results', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'responsive.html');

    const results = [];

    for (const bp of BREAKPOINTS) {
      // REAL viewport resize — media queries actually execute in Chromium
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(250); // allow reflow + media query recalc

      // Verify the real geometry actually changed with the viewport
      const realGeometry = await page.evaluate(() => {
        const el = document.querySelector('.responsive-element');
        const rect = el.getBoundingClientRect();
        return {
          rectWidth: rect.width,
          innerWidth: window.innerWidth,
          mediaQueryMatched: window.matchMedia('(max-width: 767px)').matches,
        };
      });

      // Real browser viewport is actually 375/768/1440 — not a passed parameter
      expect(realGeometry.innerWidth).toBe(bp.width);

      const report = await analyzeInPage(page, {
        viewportWidth: bp.width,
        viewportHeight: bp.height,
      });

      expect(report.success).toBe(true);
      // Report viewport must reflect the REAL browser viewport
      expect(report.viewport.width).toBe(bp.width);

      results.push({
        bp: bp.width,
        geometry: realGeometry,
        overflowCount: report.findings.filter(f => f.type === 'viewport-horizontal-overflow').length,
      });
    }

    // Findings must be generated independently per viewport:
    // the 1300px-wide element overflows at 375 and 768, but fits at 1440.
    const at375 = results.find(r => r.bp === 375);
    const at768 = results.find(r => r.bp === 768);
    const at1440 = results.find(r => r.bp === 1440);

    expect(at375.overflowCount).toBeGreaterThan(0);
    expect(at768.overflowCount).toBeGreaterThan(0);
    expect(at1440.overflowCount).toBe(0);

    // Geometry actually re-measured: element width differs across viewports
    // (responsive-element is 100% under the 767px media query, 800px otherwise)
    expect(at375.geometry.rectWidth).toBeLessThanOrEqual(375);
    expect(at1440.geometry.rectWidth).toBe(800);
    // Media query genuinely executed in the browser
    expect(at375.geometry.mediaQueryMatched).toBe(true);
    expect(at1440.geometry.mediaQueryMatched).toBe(false);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Self-Healing Loop (Phase 2, real browser DOM)
//
// Case A — single SAFE_DETERMINISTIC finding auto-fixed
// Case B — SOURCE_REPAIR_REQUIRED finding bounded at MAX attempts
// Case C — multiple INDEPENDENT safe findings fixed in one batch pass
// Case D — healthy UI passes immediately without any repair
//──────────────────────────────────────────────────────────────────────────────

test.describe('Self-Healing Loop (Phase 2)', () => {

  test('Case A: single deterministic overflow is auto-fixed and verified', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'heal-safe.html');

    const result = await page.evaluate(async () => {
      const loop = await runSelfHealLoop({
        document,
        onRerender: () => Promise.resolve(),
        maxAttempts: 3,
        maxLoopMs: 15000
      });
      const wide = document.querySelector('.wide-element');
      return {
        ...loop,
        wideMaxWidth: wide ? wide.style.maxWidth : null,
        wideOverflowX: wide ? wide.style.overflowX : null
      };
    });

    expect(result.success).toBe(true);
    // The safe clamp was actually WRITTEN to the real DOM
    expect(result.wideMaxWidth).toBe('100%');
    expect(result.wideOverflowX).toBe('hidden');
    // Loop reached VERIFY → PASS
    const passes = result.results.filter(r => r.state === 'PASS');
    expect(passes.length).toBeGreaterThanOrEqual(1);
  });

  test('Case B: source-repair finding is bounded at max attempts (no infinite loop)', async ({ page }) => {
    // Fixture has a text-overlap → SOURCE_REPAIR_REQUIRED. The fake repair
    // claims success but never changes the DOM, so the overlap persists and
    // the loop must stop after maxAttempts rather than loop forever.
    await loadFixtureWithVisualHealer(page, 'heal-overlap.html');

    const result = await page.evaluate(async () => {
      window.__repairRequests = [];
      const loop = await runSelfHealLoop({
        document,
        onSourceRepair: (req) => {
          window.__repairRequests.push(req);
          return Promise.resolve({ success: true });
        },
        onRerender: () => Promise.resolve(),
        maxAttempts: 3,
        maxLoopMs: 15000
      });
      return {
        success: loop.success,
        attempts: loop.attempts,
        results: loop.results,
        repairRequests: window.__repairRequests,
        metrics: getMetrics()
      };
    });

    expect(result.success).toBe(false);
    // Server-initiated retries are BOUNDED:
    expect(result.attempts).toBeLessThanOrEqual(3);
    // Every repair request reuse the structured diagnostic contract
    expect(result.repairRequests.length).toBeGreaterThan(0);
    const req = result.repairRequests[0];
    expect(req.structured).toContain('VISUAL_HEALER_SOURCE_REPAIR_REQUEST');
    expect(req.structured).toContain('UNTRUSTED_PREVIEW_DATA');
    expect(req.structured).toContain('FILES_IN_SCOPE');
    expect(req.diagnostic.RULE).toBe('text-overlap');
    expect(JSON.stringify(req.untrustedFields)).toContain('EVIDENCE');
    // Metrics recorded the bounded session
    expect(result.metrics.repairAttempts).toBeGreaterThan(0);
  });

  test('Case C: multiple independent findings are fixed in ONE batch pass', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'heal-multi.html');

    const result = await page.evaluate(async () => {
      const loop = await runSelfHealLoop({
        document,
        onRerender: () => Promise.resolve(),
        maxAttempts: 3,
        maxLoopMs: 15000
      });
      return {
        ...loop,
        widths: {
          a: document.querySelector('.wide-a')?.style.maxWidth || null,
          b: document.querySelector('.wide-b')?.style.maxWidth || null,
          c: document.querySelector('.wide-c')?.style.maxWidth || null
        }
      };
    });

    expect(result.success).toBe(true);
    // READ/WRITE phase separation: all 3 independent fix WRITEs happened in a
    // single batch pass — none suppressed behind the first finding.
    expect(result.widths.a).toBe('100%');
    expect(result.widths.b).toBe('100%');
    expect(result.widths.c).toBe('100%');

    // The verified pass reports all fixes together. At the 1280px Desktop
    // Chrome viewport, each wide element fires BOTH viewport-horizontal-overflow
    // AND fixed-width-overflow (2 safe rules × 3 elements = 6 verified fixes),
    // applied in ONE batch WRITE pass — none suppressed behind the first finding.
    const verifyEntry = result.results.find(r => r.state === 'VERIFY');
    expect(verifyEntry).toBeDefined();
    expect(verifyEntry.verifiedCount).toBeGreaterThanOrEqual(3);
    expect(verifyEntry.failedCount).toBe(0);
    const fixedSelectors = verifyEntry.fixes
      .filter(f => f.verification === 'FIX_VERIFIED')
      .map(f => f.selector);
    expect(fixedSelectors.some(s => s.includes('wide-a'))).toBe(true);
    expect(fixedSelectors.some(s => s.includes('wide-b'))).toBe(true);
    expect(fixedSelectors.some(s => s.includes('wide-c'))).toBe(true);
  });

  test('Case D: healthy UI passes immediately with no repair attempted', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'heal-clean.html');

    const result = await page.evaluate(async () => {
      const loop = await runSelfHealLoop({
        document,
        onSourceRepair: () => { return Promise.resolve({ success: true }); },
        onRerender: () => Promise.resolve(),
        maxAttempts: 3,
        maxLoopMs: 15000
      });
      return { ...loop, metrics: getMetrics() };
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.results[0].reason).toBe('NO_FINDINGS');
    expect(result.metrics.repairAttempts).toBe(0);
    expect(result.metrics.sourceRepairsRequested).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Self-Healing in the Preview Iframe (host page untouched)
//──────────────────────────────────────────────────────────────────────────────

test.describe('Self-Healing Loop iframe scope', () => {

  test('healing targets the iframe preview DOM only — host is NOT repaired', async ({ page }) => {
    const fixturePath = path.join(FIXTURES_DIR, 'heal-window-host.html');
    await page.goto(pathToFileURL(fixturePath).href);
    await page.waitForLoadState('networkidle');

    const frameHandle = await page.$('#preview-frame');
    const frame = await frameHandle.contentFrame();

    // Inject VH into the IFRAME and run the healing loop against iframe's doc
    await frame.addScriptTag({ content: loadVisualHealerSource() });
    await frame.waitForFunction(() => typeof window.runSelfHealLoop === 'function');

    const iframeResult = await frame.evaluate(async () => {
      const loop = await runSelfHealLoop({
        document,
        onRerender: () => Promise.resolve(),
        maxAttempts: 3,
        maxLoopMs: 15000
      });
      return { ...loop, wideMaxWidth: document.querySelector('.wide-element')?.style.maxWidth || null };
    });

    // Iframe content (heal-safe) heals successfully
    expect(iframeResult.success).toBe(true);
    expect(iframeResult.wideMaxWidth).toBe('100%');

    // The HOST page's own broken element is absolutely untouched (no inline
    // max-width clamp written into the host document)
    const hostState = await page.evaluate(() => {
      const el = document.getElementById('host-broken');
      return { geometryWidth: el.getBoundingClientRect().width, maxWidth: el.style.maxWidth };
    });
    expect(hostState.maxWidth).toBe('');
    expect(hostState.geometryWidth).toBeGreaterThan(9000);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Source-Repair Integration (Phase 2 §16)
//
// Proves the distinction between:
//  - DOM-only inline-style patches (transient — wiped on re-render), and
//  - persistent SOURCE changes (survive re-render and verify on rescan).
//──────────────────────────────────────────────────────────────────────────────

test.describe('Source-Repair Integration', () => {

  test('persistent source change survives re-render; DOM-only patch does not', async ({ page }) => {
    // Production-equivalent setup: a preview iframe whose content is rendered
    // from source (a plain HTML string), exactly like CopilotIDE's preview
    // re-renders the app source after a repair. The healing loop runs INSIDE
    // the iframe (VH injected there) against the iframe document.
    await page.setContent(`<iframe id="preview" width="100%" height="600" style="border:2px solid #333;"></iframe>`);
    const iframeHandle = await page.$('#preview');
    const frame = await iframeHandle.contentFrame();
    await frame.addScriptTag({ content: loadVisualHealerSource() });
    await frame.waitForFunction(() => typeof window.runSelfHealLoop === 'function');

    // Source = the iframe's body markup (incl. its <style>). Re-render
    // re-injects this INTO THE SAME document (stable doc handle) — so a
    // DOM-only inline patch is wiped, while a real source edit persists.
    await frame.evaluate(() => {
      const brokenBody = `
        <style>
          body { margin:0; padding:20px; font-family:sans-serif; position:relative; }
          .text-a { position:absolute; top:50px; left:50px; width:200px;
                    background:#ff6b6b; color:white; padding:10px; font-size:16px; }
          .text-b { position:absolute; top:50px; left:50px; width:200px;
                    background:#4dc9c8; color:white; padding:10px; font-size:16px; }
        </style>
        <p>Short intro above the pair.</p>
        <p class="text-a">Text element A</p>
        <p class="text-b">Text element B fully overlaps A</p>`;
      document.body.innerHTML = brokenBody;
      window.__previewSource = brokenBody;
      document.querySelector('#__srcdoc-placeholder')?.remove();

      window.__heal = (shouldEditSource) => {
        return runSelfHealLoop({
          document,
          onRerender: () => {
            document.body.innerHTML = window.__previewSource; // re-render from SOURCE
            return new Promise(r => setTimeout(r, 150));
          },
          onSourceRepair: (req) => {
            if (shouldEditSource) {
              // The coding agent EDITS THE SOURCE: it moves .text-b off .text-a.
              window.__previewSource = window.__previewSource.replace(
                'top:50px; left:50px;',
                'top:180px; left:50px;'
              );
            }
            return Promise.resolve({ success: true });
          },
          maxAttempts: 3,
          maxLoopMs: 15000
        });
      };
    });

    // Sanity: fixture really starts overlapping.
    const initial = await frame.evaluate(() => {
      const a = document.querySelector('.text-a').getBoundingClientRect();
      const b = document.querySelector('.text-b').getBoundingClientRect();
      return { aY: a.top, bY: b.top, overlap: b.top < a.bottom };
    });
    expect(initial.overlap).toBe(true);

    // ── Phase 1: fake repair (no source edit, no DOM change) → bounded STOP.
    // Overlap persists across re-renders because nothing in SOURCE changed.
    const domOnly = await frame.evaluate(() => window.__heal(false));
    expect(domOnly.success).toBe(false);
    const partialCount = domOnly.results.filter(r => r.verification === 'SOURCE_REPAIR_PARTIAL').length;
    expect(partialCount).toBeGreaterThanOrEqual(1);
    expect(partialCount).toBeLessThanOrEqual(3);
    expect(domOnly.results.some(r => r.verification === 'SOURCE_REPAIR_VERIFIED')).toBe(false);

    // ── Phase 2: REAL source edit → survives re-render → verified on rescan.
    const sourceRepair = await frame.evaluate(() => window.__heal(true));
    expect(sourceRepair.success).toBe(true);
    expect(sourceRepair.results.some(r => r.verification === 'SOURCE_REPAIR_VERIFIED')).toBe(true);

    // The SUCCESSFUL rescan genuinely sees clean DOM — no text-overlap remains.
    const finalReport = await frame.evaluate(() => window.analyzeDocument(document));
    const overlapStillPresent = finalReport.findings.some(f => f.type === 'text-overlap');
    expect(overlapStillPresent).toBe(false);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Performance Budgets on Large DOMs (Phase 2)
//──────────────────────────────────────────────────────────────────────────────

test.describe('Performance Budgets (large DOM)', () => {

  test('huge page is scanned within the bounded element/scan budgets', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'heal-clean.html');

    // Generate 2000 elements (> 4× the 500-element scan budget)
    await page.evaluate(() => {
      const container = document.createElement('div');
      for (let i = 0; i < 2000; i++) {
        const el = document.createElement('div');
        el.className = 'perf-item';
        el.style.cssText = 'width: 100px; height: 20px; margin: 2px;';
        el.textContent = `item-${i}`;
        container.appendChild(el);
      }
      document.body.appendChild(container);
    });
    await page.waitForTimeout(200);

    const report = await analyzeInPage(page);
    expect(report.success).toBe(true);

    // SCAN_BUDGET limits are respected even on a 2000-element DOM
    expect(report.scannedElements).toBeLessThanOrEqual(500);
    // Scan completed in bounded time (no all-pairs text-overlap blowup)
    expect(report.scanTimeMs).toBeLessThan(5000);
  });

  test('findings are capped at the MAX_FINDINGS budget on dense broken DOMs', async ({ page }) => {
    await loadFixtureWithVisualHealer(page, 'heal-clean.html');

    // 800 elements, ALL overflowing the viewport → way past MAX_FINDINGS (50)
    await page.evaluate(() => {
      for (let i = 0; i < 800; i++) {
        const el = document.createElement('div');
        el.className = 'perf-overflow';
        el.style.cssText = 'width: 3000px; height: 30px; margin: 2px; background: #f00;';
        el.textContent = `overflow-${i}`;
        document.body.appendChild(el);
      }
    });
    await page.waitForTimeout(200);

    const report = await analyzeInPage(page);
    expect(report.success).toBe(true);
    expect(report.scannedElements).toBeLessThanOrEqual(500);
    expect(report.findings.length).toBeLessThanOrEqual(50);
  });

});
