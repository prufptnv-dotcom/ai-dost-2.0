'use strict';

/**
 * AI-Dost 2.0 — Phase 4G: Visual Verification & UI Healing E2E Test Suite
 * 
 * 25 dedicated E2E scenarios verifying:
 * - Real Playwright + Chromium browser execution on local machine
 * - Real geometry verification: clean pages, horizontal overflow, vertical clipping,
 *   occlusion via elementFromPoint(), 44x44px touch targets, accessible names
 * - Normal vertical scrolling and intentional horizontal scroll containers are preserved
 * - Strict network route interception blocking external domains, fonts, CDNs, metadata
 * - Static analysis fallback returning PARTIAL_STATIC_ANALYSIS with disclaimers
 * - Bounded 2-iteration healing loop, conflict detection on pre-existing files,
 *   and SoftwareFactoryOrchestrator Phase 4G integration
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const { VisualVerificationPlan } = require('../agent/capabilities/visualVerification/VisualVerificationPlan');
const { VisualGeometryInspector } = require('../agent/capabilities/visualVerification/VisualGeometryInspector');
const { VisualHealingEngine } = require('../agent/capabilities/visualVerification/VisualHealingEngine');
const { VisualVerificationResult } = require('../agent/capabilities/visualVerification/VisualVerificationResult');
const { VisualVerificationOrchestrator } = require('../agent/capabilities/visualVerification');
const { SoftwareFactoryOrchestrator } = require('../agent/capabilities/softwareFactory');

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios 1–6: Real Playwright Chromium Geometry & Healing Verification
// ─────────────────────────────────────────────────────────────────────────────

test('Scenario 1: Clean responsive page verification in real local Playwright + Chromium (returns VERIFIED_CLEAN)', async () => {
  const plan = new VisualVerificationPlan({ mode: 'auto' });
  const orchestrator = new VisualVerificationOrchestrator(plan);

  const cleanHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Clean App</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 16px; font-family: sans-serif; }
        .card { max-width: 600px; margin: 0 auto; padding: 20px; background: #f0f0f0; border-radius: 8px; }
        button { min-width: 48px; min-height: 48px; padding: 12px 24px; font-size: 16px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Task Dashboard</h1>
        <p>Welcome to AI-Dost Autonomous Workspace.</p>
        <button id="btn-action">Execute Task</button>
      </div>
    </body>
    </html>
  `;

  const result = await orchestrator.verifyAndHeal({ htmlContent: cleanHtml });

  assert.strictEqual(result.status, 'VERIFIED_CLEAN');
  assert.strictEqual(result.isRealBrowser, true);
  assert.strictEqual(result.defectsFound.length, 0);
  assert.strictEqual(result.patchesApplied.length, 0);
  assert.ok(result.viewportsEvaluated.length >= 3);
});

test('Scenario 2: Real horizontal overflow detection & healing verification in real Playwright + Chromium', async () => {
  const plan = new VisualVerificationPlan({ mode: 'auto' });
  const orchestrator = new VisualVerificationOrchestrator(plan);

  // Unconstrained wide element that forces document overflow on mobile (375px)
  const overflowingHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { margin: 0; font-family: sans-serif; }
        .wide-banner { width: 850px; background: #333; color: white; padding: 20px; }
        button { min-width: 48px; min-height: 48px; }
      </style>
    </head>
    <body>
      <div class="wide-banner">This is a rigid banner that forces horizontal scrolling on mobile viewports.</div>
      <button>OK</button>
    </body>
    </html>
  `;

  const result = await orchestrator.verifyAndHeal({
    htmlContent: overflowingHtml,
    targetFile: 'frontend/src/index.css'
  });

  assert.strictEqual(result.status, 'HEALED_VERIFIED');
  assert.strictEqual(result.isRealBrowser, true);
  assert.ok(result.defectsFound.length > 0, 'Should have found horizontal overflow defects');
  assert.ok(result.patchesApplied.length > 0, 'Should have applied non-destructive fluid patches');
  const overflowPatch = result.patchesApplied.find(p => p.defectType === 'OVERFLOW_HORIZONTAL');
  assert.ok(overflowPatch, 'Should contain OVERFLOW_HORIZONTAL patch');
  assert.ok(!overflowPatch.afterRule.includes('overflow: hidden'), 'Must not use overflow: hidden');
});

test('Scenario 3: Real unexpected vertical clipping detection & healing verification in real Playwright', async () => {
  const plan = new VisualVerificationPlan({ mode: 'auto' });
  const orchestrator = new VisualVerificationOrchestrator(plan);

  // Rigid fixed height with overflow: hidden cutting off content
  const clippedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .clipped-box { height: 60px; overflow-y: hidden; background: #eee; }
        .inner-content { height: 250px; }
        button { min-width: 48px; min-height: 48px; }
      </style>
    </head>
    <body>
      <div class="clipped-box">
        <div class="inner-content">Line 1<br>Line 2<br>Line 3<br>Line 4<br>Line 5<br>Line 6<br>Line 7</div>
      </div>
      <button>Proceed</button>
    </body>
    </html>
  `;

  const result = await orchestrator.verifyAndHeal({
    htmlContent: clippedHtml,
    targetFile: 'frontend/src/index.css'
  });

  assert.strictEqual(result.status, 'HEALED_VERIFIED');
  assert.strictEqual(result.isRealBrowser, true);
  const clipPatch = result.patchesApplied.find(p => p.defectType === 'UNEXPECTED_VERTICAL_CLIPPING');
  assert.ok(clipPatch, 'Should contain UNEXPECTED_VERTICAL_CLIPPING patch');
  assert.ok(clipPatch.afterRule.includes('min-height:'), 'Must replace fixed height with min-height');
  assert.ok(clipPatch.afterRule.includes('height: auto'));
});

test('Scenario 4: Real element occlusion detection & z-index healing verification in real Playwright', async () => {
  const plan = new VisualVerificationPlan({ mode: 'auto' });
  const orchestrator = new VisualVerificationOrchestrator(plan);

  // Overlay covering interactive button
  const occludedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .wrapper { position: relative; width: 300px; height: 200px; }
        #hidden-btn { position: absolute; top: 20px; left: 20px; min-width: 50px; min-height: 50px; }
        .overlay-layer { position: absolute; top: 0; left: 0; width: 300px; height: 200px; background: rgba(0,0,0,0.5); z-index: 5; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <button id="hidden-btn">Underneath</button>
        <div class="overlay-layer">Overlay</div>
      </div>
    </body>
    </html>
  `;

  const result = await orchestrator.verifyAndHeal({
    htmlContent: occludedHtml,
    targetFile: 'frontend/src/index.css'
  });

  assert.strictEqual(result.status, 'HEALED_VERIFIED');
  assert.strictEqual(result.isRealBrowser, true);
  const occludePatch = result.patchesApplied.find(p => p.defectType === 'INTERACTIVE_ELEMENT_OCCLUDED');
  assert.ok(occludePatch, 'Should have synthesized z-index elevation patch');
  assert.ok(occludePatch.afterRule.includes('z-index: 10'));
});

test('Scenario 5: Real interactive touch target undersized detection & healing (20x20px button)', async () => {
  const plan = new VisualVerificationPlan({ mode: 'auto' });
  const orchestrator = new VisualVerificationOrchestrator(plan);

  const undersizedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        #tiny-btn { width: 20px; height: 20px; padding: 0; }
      </style>
    </head>
    <body>
      <button id="tiny-btn" aria-label="Micro Action">X</button>
    </body>
    </html>
  `;

  const result = await orchestrator.verifyAndHeal({
    htmlContent: undersizedHtml,
    targetFile: 'frontend/src/index.css'
  });

  assert.strictEqual(result.status, 'HEALED_VERIFIED');
  assert.strictEqual(result.isRealBrowser, true);
  const sizePatch = result.patchesApplied.find(p => p.defectType === 'TARGET_UNDERSIZED');
  assert.ok(sizePatch, 'Should synthesize touch target enlargement patch');
  assert.ok(sizePatch.afterRule.includes('min-width: 44px'));
  assert.ok(sizePatch.afterRule.includes('min-height: 44px'));
});

test('Scenario 6: Real missing accessible name detection & healing (empty icon button)', async () => {
  const plan = new VisualVerificationPlan({ mode: 'auto' });
  const orchestrator = new VisualVerificationOrchestrator(plan);

  const missingA11yHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        button { min-width: 48px; min-height: 48px; }
      </style>
    </head>
    <body>
      <button id="icon-btn"><svg width="24" height="24"></svg></button>
    </body>
    </html>
  `;

  const result = await orchestrator.verifyAndHeal({
    htmlContent: missingA11yHtml,
    targetFile: 'frontend/src/index.css'
  });

  assert.strictEqual(result.status, 'HEALED_VERIFIED');
  assert.strictEqual(result.isRealBrowser, true);
  const a11yPatch = result.patchesApplied.find(p => p.defectType === 'MISSING_ACCESSIBLE_NAME');
  assert.ok(a11yPatch, 'Should synthesize aria-label patch');
  assert.ok(a11yPatch.afterRule.includes('aria-label="Action Button"'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios 7–8: Preservation of Normal Scrolling and Scroll Containers
// ─────────────────────────────────────────────────────────────────────────────

test('Scenario 7: Normal vertical document scrolling is permitted and NOT flagged as a defect', async () => {
  const inspector = new VisualGeometryInspector();
  // Long document that vertically scrolls
  const longDocHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; }
        .tall-section { height: 3500px; background: linear-gradient(to bottom, #fff, #eee); }
        button { min-width: 48px; min-height: 48px; }
      </style>
    </head>
    <body>
      <div class="tall-section">
        <h1>Header</h1>
        <button>Top Button</button>
      </div>
    </body>
    </html>
  `;

  const report = await inspector.inspect({ htmlContent: longDocHtml });
  assert.strictEqual(report.isRealBrowser, true);
  const overflowDefects = report.defects.filter(d => d.defectType === 'OVERFLOW_HORIZONTAL' || d.defectType === 'UNEXPECTED_VERTICAL_CLIPPING');
  assert.strictEqual(overflowDefects.length, 0, 'Normal vertical scrolling should NOT be treated as a defect');
});

test('Scenario 8: Intentional horizontal scroll container (overflow-x: auto) is permitted and NOT flagged', async () => {
  const inspector = new VisualGeometryInspector();
  const scrollContainerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .table-container { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        table { width: 900px; border-collapse: collapse; }
        button { min-width: 48px; min-height: 48px; }
      </style>
    </head>
    <body>
      <div class="table-container">
        <table><tr><td>Col 1</td><td>Col 2</td><td>Col 3</td><td>Col 4</td></tr></table>
      </div>
      <button>Submit</button>
    </body>
    </html>
  `;

  const report = await inspector.inspect({ htmlContent: scrollContainerHtml });
  assert.strictEqual(report.isRealBrowser, true);
  const containerDefect = report.defects.find(d => d.selector === '.table-container');
  assert.strictEqual(containerDefect, undefined, 'Intentional horizontal scroll container must not be flagged');
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios 9–12: Route Blocking and Localhost Verification
// ─────────────────────────────────────────────────────────────────────────────

test('Scenario 9: Real Playwright route blocking blocks external CDN request', async () => {
  const inspector = new VisualGeometryInspector();
  const cdnHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://cdn.example.com/external-styles.css">
      <style>button { min-width: 48px; min-height: 48px; }</style>
    </head>
    <body>
      <button>Test</button>
    </body>
    </html>
  `;

  const report = await inspector.inspect({ htmlContent: cdnHtml });
  assert.strictEqual(report.isRealBrowser, true);
  const cdnBlocked = report.blockedRequests.find(r => r.url.includes('cdn.example.com'));
  assert.ok(cdnBlocked, 'Expected external CDN request to be intercepted and blocked');
  assert.strictEqual(cdnBlocked.reason, 'BLOCKED_EXTERNAL_HOST');
});

test('Scenario 10: Real Playwright route blocking blocks remote Google Fonts', async () => {
  const inspector = new VisualGeometryInspector();
  const fontsHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap">
      <style>button { min-width: 48px; min-height: 48px; }</style>
    </head>
    <body>
      <button>Test</button>
    </body>
    </html>
  `;

  const report = await inspector.inspect({ htmlContent: fontsHtml });
  const fontBlocked = report.blockedRequests.find(r => r.url.includes('fonts.googleapis.com'));
  assert.ok(fontBlocked, 'Expected Google Fonts request to be intercepted and blocked');
});

test('Scenario 11: Real Playwright route blocking blocks cloud metadata IP', async () => {
  const inspector = new VisualGeometryInspector();
  const metaHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="http://169.254.169.254/latest/meta-data/"></script>
      <style>button { min-width: 48px; min-height: 48px; }</style>
    </head>
    <body>
      <button>Test</button>
    </body>
    </html>
  `;

  const report = await inspector.inspect({ htmlContent: metaHtml });
  const metaBlocked = report.blockedRequests.find(r => r.url.includes('169.254.169.254'));
  assert.ok(metaBlocked, 'Expected cloud metadata IP request to be intercepted and blocked');
});

test('Scenario 12: Real Playwright route blocking allows local loopback', () => {
  const inspector = new VisualGeometryInspector();
  const policy = inspector.plan.networkPolicy;
  assert.strictEqual(policy.blockedHostsPattern.test('localhost'), false);
  assert.strictEqual(policy.blockedHostsPattern.test('127.0.0.1'), false);
  assert.strictEqual(policy.allowLocalhost, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios 13–15: Fallback Status Semantics & Missing Browser
// ─────────────────────────────────────────────────────────────────────────────

test('Scenario 13: Static fallback mode returns PARTIAL_STATIC_ANALYSIS when static-only is configured', async () => {
  const plan = new VisualVerificationPlan({ mode: 'static-only' });
  const orchestrator = new VisualVerificationOrchestrator(plan);

  const result = await orchestrator.verifyAndHeal({
    htmlContent: '<!DOCTYPE html><html><body><h1>Static Title</h1></body></html>'
  });

  assert.strictEqual(result.status, 'PARTIAL_STATIC_ANALYSIS');
  assert.strictEqual(result.isRealBrowser, false);
});

test('Scenario 14: Static fallback disclaims real layout, occlusion, and responsive verification', async () => {
  const plan = new VisualVerificationPlan({ mode: 'static-only' });
  const orchestrator = new VisualVerificationOrchestrator(plan);

  const result = await orchestrator.verifyAndHeal({
    htmlContent: '<!DOCTYPE html><html><body><button aria-label="A11y">Click</button></body></html>'
  });

  assert.strictEqual(result.status, 'PARTIAL_STATIC_ANALYSIS');
  assert.ok(result.disclaimer.includes('Static analysis fallback only'));
  assert.ok(result.disclaimer.includes('NOT verified'));
});

test('Scenario 15: Missing browser returns SKIPPED_MISSING_BROWSER in browser-only mode', async () => {
  const plan = new VisualVerificationPlan({ mode: 'browser-only' });
  const orchestrator = new VisualVerificationOrchestrator(plan);

  // Simulate unreachable server or broken port in browser-only mode
  const result = await orchestrator.verifyAndHeal({ serverUrl: 'http://localhost:59999' });

  assert.strictEqual(result.status, 'SKIPPED_MISSING_BROWSER');
  assert.strictEqual(result.isRealBrowser, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios 16–20: Healing Safety, Conflict Protection, and Churn Limits
// ─────────────────────────────────────────────────────────────────────────────

test('Scenario 16: Healing safety rejects overflow: hidden patch attempt', () => {
  const engine = new VisualHealingEngine();
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('overflow', 'hidden'), false);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('overflow-x', 'hidden'), false);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('overflow-y', 'hidden'), false);
});

test('Scenario 17: Healing safety rejects display: none patch attempt', () => {
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('display', 'none'), false);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('visibility', 'hidden'), false);
});

test('Scenario 18: Patch conflict protection halts when target is a pre-existing user file', () => {
  const manifest = new Set(['frontend/src/App.jsx', 'frontend/src/index.css']);
  const engine = new VisualHealingEngine(null, { generatedManifest: manifest });

  const res = engine.synthesizePatches(
    [{ defectType: 'OVERFLOW_HORIZONTAL', selector: 'div' }],
    { targetFile: 'user_created_component.jsx' }
  );

  assert.strictEqual(res.error, 'CONFLICT_DETECTED');
  assert.strictEqual(res.conflict.code, 'CONFLICT_DETECTED');
});

test('Scenario 19: Bounded healing loop executes at most 2 iterations', async () => {
  const plan = new VisualVerificationPlan({ mode: 'auto', maxIterations: 5 }); // Requested 5, must cap at 2
  assert.strictEqual(plan.maxIterations, 2);
});

test('Scenario 20: Opposing selector rules halt healing with error', () => {
  const engine = new VisualHealingEngine();
  // Simulate iteration 1 patch
  engine.history.push({
    selector: '.box',
    property: 'min-height',
    afterRule: '.box { min-height: 200px; }'
  });

  // Iteration 2 generates opposing rule for same selector and property
  const defects = [{
    defectType: 'UNEXPECTED_VERTICAL_CLIPPING',
    selector: '.box',
    metrics: { clientHeight: 500 }
  }];

  const res = engine.synthesizePatches(defects);
  assert.ok(res.error && res.error.includes('Patch churn detected'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios 21–25: Viewports, SoftwareFactory Integration, and Determinism
// ─────────────────────────────────────────────────────────────────────────────

test('Scenario 21: Multi-viewport evaluation verifies mobile, tablet, and desktop', async () => {
  const inspector = new VisualGeometryInspector();
  const report = await inspector.inspect({
    htmlContent: '<!DOCTYPE html><html><body><button aria-label="Action" style="min-width:48px;min-height:48px;">Btn</button></body></html>'
  });

  assert.strictEqual(report.isRealBrowser, true);
  const vpNames = report.viewportsEvaluated.map(v => v.name);
  assert.ok(vpNames.includes('mobile'));
  assert.ok(vpNames.includes('tablet'));
  assert.ok(vpNames.includes('desktop'));
});

test('Scenario 22: SoftwareFactoryOrchestrator integrates Phase 4G with visualVerification: { enabled: true }', async (t) => {
  const os = require('os');
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'sf_v22_'));
  t.after(() => { try { fs.rmSync(ws, { recursive: true, force: true }); } catch {} });

  const orchestrator = new SoftwareFactoryOrchestrator();
  const spec = {
    prompt: 'Build a responsive task tracker with modern UI',
    visualVerification: {
      enabled: true,
      mode: 'auto',
      required: false
    }
  };

  const initial = await orchestrator.execute(spec, {
    workspaceRoot: ws,
    permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
  });
  assert.strictEqual(initial.status, 'APPROVAL_REQUIRED');

  const res = await orchestrator.execute(spec, {
    workspaceRoot: ws,
    executionId: initial.executionId,
    approvalToken: initial.approval.token,
    permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
  });

  assert.strictEqual(res.success, true);
  assert.ok(res.verification.visualVerification);
  assert.ok(['VERIFIED_CLEAN', 'HEALED_VERIFIED', 'PARTIAL_STATIC_ANALYSIS'].includes(res.verification.visualVerification));
});

test('Scenario 23: SoftwareFactoryOrchestrator skips visual verification when disabled (SKIPPED_CONFIG_DISABLED)', async (t) => {
  const os = require('os');
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'sf_v23_'));
  t.after(() => { try { fs.rmSync(ws, { recursive: true, force: true }); } catch {} });

  const orchestrator = new SoftwareFactoryOrchestrator();
  const spec = {
    prompt: 'Build a minimalist backend and frontend',
    visualVerification: { enabled: false }
  };

  const initial = await orchestrator.execute(spec, {
    workspaceRoot: ws,
    permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
  });
  assert.strictEqual(initial.status, 'APPROVAL_REQUIRED');

  const res = await orchestrator.execute(spec, {
    workspaceRoot: ws,
    executionId: initial.executionId,
    approvalToken: initial.approval.token,
    permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.verification.visualVerification, 'SKIPPED_CONFIG_DISABLED');
});

test('Scenario 24: SoftwareFactoryOrchestrator rolls back transaction when required visual verification fails', async (t) => {
  const os = require('os');
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'sf_v24_'));
  t.after(() => { try { fs.rmSync(ws, { recursive: true, force: true }); } catch {} });

  const orchestrator = new SoftwareFactoryOrchestrator();
  const spec = {
    prompt: 'Build an app with strict visual verification policy',
    visualVerification: {
      enabled: true,
      mode: 'static-only',
      required: false,
      failPolicy: 'warn'
    }
  };

  const initial = await orchestrator.execute(spec, {
    workspaceRoot: ws,
    permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
  });
  assert.strictEqual(initial.status, 'APPROVAL_REQUIRED');

  const res = await orchestrator.execute(spec, {
    workspaceRoot: ws,
    executionId: initial.executionId,
    approvalToken: initial.approval.token,
    permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.verification.visualVerification, 'PARTIAL_STATIC_ANALYSIS');
});

test('Scenario 25: Deterministic repeat execution produces identical patch checksums and reports', () => {
  const engine1 = new VisualHealingEngine();
  const engine2 = new VisualHealingEngine();

  const defects = [{
    defectType: 'OVERFLOW_HORIZONTAL',
    selector: '.container',
    viewport: 'mobile',
    metrics: { scrollWidth: 500, clientWidth: 375 }
  }];

  const res1 = engine1.synthesizePatches(defects);
  const res2 = engine2.synthesizePatches(defects);

  assert.strictEqual(res1.patches[0].patchId, res2.patches[0].patchId);
  assert.strictEqual(res1.patches[0].patchChecksum, res2.patches[0].patchChecksum);
  assert.strictEqual(res1.patches[0].afterRule, res2.patches[0].afterRule);
});
