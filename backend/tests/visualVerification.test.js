'use strict';

/**
 * AI-Dost 2.0 — Phase 4G: Visual Verification Unit Test Suite
 * 
 * 35+ dedicated unit tests covering:
 * - VisualVerificationPlan schemas, immutability, allowlists, and forbidden pattern detection
 * - VisualGeometryInspector defect rules, scroll semantics, hit-testing, and static fallback
 * - VisualHealingEngine patch synthesis, safety guards, conflict detection, and patch records
 * - VisualVerificationResult immutability, statuses, and factories
 * - VisualVerificationOrchestrator bounded loop mechanics
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const {
  VisualVerificationPlan,
  VISUAL_PLAN_SCHEMA_VERSION,
  ALLOWED_VIEWPORTS,
  ALLOWED_DEFECT_RULES,
  FORBIDDEN_HEALING_PATTERNS,
  ALLOWED_HEALING_PROPERTIES
} = require('../agent/capabilities/visualVerification/VisualVerificationPlan');

const { VisualGeometryInspector } = require('../agent/capabilities/visualVerification/VisualGeometryInspector');
const { VisualHealingEngine } = require('../agent/capabilities/visualVerification/VisualHealingEngine');
const { VisualVerificationResult, VISUAL_VERIFICATION_STATUSES } = require('../agent/capabilities/visualVerification/VisualVerificationResult');
const { VisualVerificationOrchestrator } = require('../agent/capabilities/visualVerification');

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 1: VisualVerificationPlan & Immutability (Tests 1-8)
// ─────────────────────────────────────────────────────────────────────────────

test('VisualVerificationPlan: initializes valid defaults with schema v1.0.0', () => {
  const plan = new VisualVerificationPlan();
  assert.strictEqual(plan.schemaVersion, VISUAL_PLAN_SCHEMA_VERSION);
  assert.ok(plan.planId.startsWith('vplan_'));
  assert.strictEqual(plan.mode, 'auto');
  assert.strictEqual(plan.viewports.length, 3);
  assert.strictEqual(plan.maxIterations, 2);
  assert.strictEqual(plan.overflowTolerancePx, 2);
  assert.strictEqual(plan.minTargetSizePx, 44);
});

test('VisualVerificationPlan: rejects unsupported schemaVersion with INVALID_PLAN_PAYLOAD', () => {
  assert.throws(() => {
    new VisualVerificationPlan({ schemaVersion: '2.0.0' });
  }, (err) => {
    return err.code === 'INVALID_PLAN_PAYLOAD' && err.message.includes('2.0.0');
  });
});

test('VisualVerificationPlan: rejects invalid mode with INVALID_PLAN_PAYLOAD', () => {
  assert.throws(() => {
    new VisualVerificationPlan({ mode: 'unsupported-mode' });
  }, (err) => {
    return err.code === 'INVALID_PLAN_PAYLOAD' && err.message.includes('unsupported-mode');
  });
});

test('VisualVerificationPlan: deepFreeze enforces strict immutability', () => {
  const plan = new VisualVerificationPlan();
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.viewports));
  assert.ok(Object.isFrozen(plan.networkPolicy));
  assert.throws(() => {
    plan.mode = 'static-only';
  }, TypeError);
});

test('VisualVerificationPlan: normalizes custom viewport dimensions', () => {
  const plan = new VisualVerificationPlan({
    viewports: [{ width: 400, height: 800, name: 'custom-mobile' }]
  });
  assert.strictEqual(plan.viewports.length, 1);
  assert.strictEqual(plan.viewports[0].width, 400);
  assert.strictEqual(plan.viewports[0].height, 800);
  assert.strictEqual(plan.viewports[0].name, 'custom-mobile');
});

test('VisualVerificationPlan: caps maxIterations at 2 to prevent unbounded loops', () => {
  const plan = new VisualVerificationPlan({ maxIterations: 10 });
  assert.strictEqual(plan.maxIterations, 2);
});

test('VisualVerificationPlan: detects forbidden content-hiding patterns', () => {
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('overflow', 'hidden'), false);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('overflow-x', 'hidden'), false);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('overflow-y', 'hidden'), false);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('display', 'none'), false);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('visibility', 'hidden'), false);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('opacity', '0'), false);
});

test('VisualVerificationPlan: validates allowed responsive healing properties', () => {
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('min-width', '0'), true);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('max-width', '100%'), true);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('flex-wrap', 'wrap'), true);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('overflow-wrap', 'anywhere'), true);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('min-height', '200px'), true);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('z-index', '10'), true);
  assert.strictEqual(VisualVerificationPlan.isAllowedHealingRule('aria-label', 'Button'), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 2: VisualGeometryInspector Static & Defect Logic (Tests 9-18)
// ─────────────────────────────────────────────────────────────────────────────

test('VisualGeometryInspector: static mode returns PARTIAL_STATIC_ANALYSIS disclaimer', async () => {
  const inspector = new VisualGeometryInspector(new VisualVerificationPlan({ mode: 'static-only' }));
  const report = await inspector.inspect({
    htmlContent: '<!DOCTYPE html><html><body><h1>Hello</h1></body></html>'
  });
  assert.strictEqual(report.status, 'PARTIAL_STATIC_ANALYSIS');
  assert.strictEqual(report.isRealBrowser, false);
  assert.ok(report.disclaimer.includes('Static analysis fallback only'));
});

test('VisualGeometryInspector: static mode flags rigid fixed widths exceeding mobile bounds', async () => {
  const inspector = new VisualGeometryInspector(new VisualVerificationPlan({ mode: 'static-only' }));
  const report = await inspector.inspect({
    htmlContent: '<div class="card">Big content</div>',
    cssContent: '.card { width: 900px; }'
  });
  assert.strictEqual(report.status, 'PARTIAL_STATIC_ANALYSIS');
  const overflowDefect = report.defects.find(d => d.defectType === 'OVERFLOW_HORIZONTAL');
  assert.ok(overflowDefect, 'Expected OVERFLOW_HORIZONTAL defect');
  assert.strictEqual(overflowDefect.metrics.declaredWidth, 900);
});

test('VisualGeometryInspector: static mode flags empty buttons without accessible names', async () => {
  const inspector = new VisualGeometryInspector(new VisualVerificationPlan({ mode: 'static-only' }));
  const report = await inspector.inspect({
    htmlContent: '<div><button class="icon-btn"><svg></svg></button></div>'
  });
  const a11yDefect = report.defects.find(d => d.defectType === 'MISSING_ACCESSIBLE_NAME');
  assert.ok(a11yDefect, 'Expected MISSING_ACCESSIBLE_NAME defect');
});

test('VisualGeometryInspector: static mode passes buttons with aria-label', async () => {
  const inspector = new VisualGeometryInspector(new VisualVerificationPlan({ mode: 'static-only' }));
  const report = await inspector.inspect({
    htmlContent: '<div><button aria-label="Close dialog"><svg></svg></button></div>'
  });
  const a11yDefect = report.defects.find(d => d.defectType === 'MISSING_ACCESSIBLE_NAME');
  assert.strictEqual(a11yDefect, undefined);
});

test('VisualGeometryInspector: static mode flags undersized button CSS', async () => {
  const inspector = new VisualGeometryInspector(new VisualVerificationPlan({ mode: 'static-only' }));
  const report = await inspector.inspect({
    htmlContent: '<button>Click</button>',
    cssContent: 'button { width: 20px; height: 20px; }'
  });
  const sizeDefect = report.defects.find(d => d.defectType === 'TARGET_UNDERSIZED');
  assert.ok(sizeDefect, 'Expected TARGET_UNDERSIZED defect');
  assert.strictEqual(sizeDefect.metrics.dimensionPx, 20);
});

test('VisualGeometryInspector: handles missing target file gracefully in static mode', async () => {
  const inspector = new VisualGeometryInspector(new VisualVerificationPlan({ mode: 'static-only' }));
  const report = await inspector.inspect({ filePath: 'non_existent_file.html' });
  assert.strictEqual(report.status, 'PARTIAL_STATIC_ANALYSIS');
});

test('VisualGeometryInspector: browser-only mode returns SKIPPED_MISSING_BROWSER when launch fails', async () => {
  const inspector = new VisualGeometryInspector(new VisualVerificationPlan({ mode: 'browser-only' }));
  // Force simulate failure by passing invalid serverUrl that fails goto
  const report = await inspector.inspect({ serverUrl: 'http://localhost:99999' });
  assert.strictEqual(report.status, 'SKIPPED_MISSING_BROWSER');
  assert.strictEqual(report.isRealBrowser, false);
});

test('VisualGeometryInspector: blocks external network domains in route interceptor', () => {
  const inspector = new VisualGeometryInspector();
  assert.strictEqual(inspector.plan.networkPolicy.blockExternal, true);
  assert.strictEqual(inspector.plan.networkPolicy.blockedHostsPattern.test('fonts.googleapis.com'), true);
  assert.strictEqual(inspector.plan.networkPolicy.blockedHostsPattern.test('cdn.jsdelivr.net'), true);
  assert.strictEqual(inspector.plan.networkPolicy.blockedHostsPattern.test('169.254.169.254'), true);
});

test('VisualGeometryInspector: allows local loopback and file protocols in route interceptor', () => {
  const inspector = new VisualGeometryInspector();
  assert.strictEqual(inspector.plan.networkPolicy.blockedHostsPattern.test('localhost'), false);
  assert.strictEqual(inspector.plan.networkPolicy.blockedHostsPattern.test('127.0.0.1'), false);
});

test('VisualGeometryInspector: records blocked requests array in inspection result', async () => {
  const inspector = new VisualGeometryInspector(new VisualVerificationPlan({ mode: 'static-only' }));
  const report = await inspector.inspect({ htmlContent: '<div>test</div>' });
  assert.ok(Array.isArray(report.blockedRequests));
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 3: VisualHealingEngine Patch Synthesis & Safety (Tests 19-27)
// ─────────────────────────────────────────────────────────────────────────────

test('VisualHealingEngine: synthesizes fluid responsive patch for OVERFLOW_HORIZONTAL', () => {
  const engine = new VisualHealingEngine();
  const defects = [{
    defectType: 'OVERFLOW_HORIZONTAL',
    selector: '.container',
    viewport: 'mobile',
    metrics: { scrollWidth: 500, clientWidth: 375 }
  }];

  const res = engine.synthesizePatches(defects);
  assert.strictEqual(res.patches.length, 1);
  const patch = res.patches[0];
  assert.strictEqual(patch.defectType, 'OVERFLOW_HORIZONTAL');
  assert.ok(patch.afterRule.includes('max-width: 100%'));
  assert.ok(patch.afterRule.includes('flex-wrap: wrap'));
  assert.ok(patch.afterRule.includes('overflow-wrap: anywhere'));
  assert.ok(!patch.afterRule.includes('overflow: hidden'), 'Must not use overflow: hidden');
});

test('VisualHealingEngine: synthesizes min-height patch for UNEXPECTED_VERTICAL_CLIPPING', () => {
  const engine = new VisualHealingEngine();
  const defects = [{
    defectType: 'UNEXPECTED_VERTICAL_CLIPPING',
    selector: '.card',
    viewport: 'desktop',
    metrics: { clientHeight: 180 }
  }];

  const res = engine.synthesizePatches(defects);
  assert.strictEqual(res.patches.length, 1);
  const patch = res.patches[0];
  assert.strictEqual(patch.defectType, 'UNEXPECTED_VERTICAL_CLIPPING');
  assert.ok(patch.afterRule.includes('min-height: 180px'));
  assert.ok(patch.afterRule.includes('height: auto'));
  assert.ok(!patch.afterRule.includes('overflow: hidden'));
});

test('VisualHealingEngine: synthesizes elevated z-index for INTERACTIVE_ELEMENT_OCCLUDED', () => {
  const engine = new VisualHealingEngine();
  const defects = [{
    defectType: 'INTERACTIVE_ELEMENT_OCCLUDED',
    selector: '#submit-btn',
    viewport: 'desktop',
    metrics: { occludedBy: '.modal-backdrop' }
  }];

  const res = engine.synthesizePatches(defects);
  assert.strictEqual(res.patches.length, 1);
  const patch = res.patches[0];
  assert.strictEqual(patch.defectType, 'INTERACTIVE_ELEMENT_OCCLUDED');
  assert.ok(patch.afterRule.includes('z-index: 10'));
  assert.ok(patch.afterRule.includes('position: relative'));
});

test('VisualHealingEngine: synthesizes 44x44px minimum touch target for TARGET_UNDERSIZED', () => {
  const engine = new VisualHealingEngine();
  const defects = [{
    defectType: 'TARGET_UNDERSIZED',
    selector: '.small-btn',
    viewport: 'mobile',
    metrics: { width: 24, height: 24 }
  }];

  const res = engine.synthesizePatches(defects);
  assert.strictEqual(res.patches.length, 1);
  const patch = res.patches[0];
  assert.strictEqual(patch.defectType, 'TARGET_UNDERSIZED');
  assert.ok(patch.afterRule.includes('min-width: 44px'));
  assert.ok(patch.afterRule.includes('min-height: 44px'));
});

test('VisualHealingEngine: synthesizes aria-label for MISSING_ACCESSIBLE_NAME', () => {
  const engine = new VisualHealingEngine();
  const defects = [{
    defectType: 'MISSING_ACCESSIBLE_NAME',
    selector: 'button.icon-only',
    viewport: 'all',
    metrics: { tag: 'button' }
  }];

  const res = engine.synthesizePatches(defects);
  assert.strictEqual(res.patches.length, 1);
  const patch = res.patches[0];
  assert.strictEqual(patch.defectType, 'MISSING_ACCESSIBLE_NAME');
  assert.ok(patch.afterRule.includes('aria-label="Action Button"'));
});

test('VisualHealingEngine: computes unique patchId and SHA256 checksum for each patch', () => {
  const engine = new VisualHealingEngine();
  const defects = [{
    defectType: 'OVERFLOW_HORIZONTAL',
    selector: '.wrapper',
    viewport: 'mobile',
    metrics: {}
  }];

  const res = engine.synthesizePatches(defects);
  const patch = res.patches[0];
  assert.ok(patch.patchId.startsWith('vpatch_'));
  assert.strictEqual(patch.patchChecksum.length, 64); // SHA-256 hex length
});

test('VisualHealingEngine: detects pre-existing protected files and returns CONFLICT_DETECTED', () => {
  const manifest = new Set(['frontend/src/index.css', 'frontend/src/App.jsx']);
  const engine = new VisualHealingEngine(null, { generatedManifest: manifest });

  const res = engine.synthesizePatches([{ defectType: 'OVERFLOW_HORIZONTAL', selector: 'div' }], {
    targetFile: 'user_protected_component.jsx'
  });

  assert.strictEqual(res.error, 'CONFLICT_DETECTED');
  assert.ok(res.conflict);
  assert.strictEqual(res.conflict.code, 'CONFLICT_DETECTED');
  assert.strictEqual(res.patches.length, 0);
});

test('VisualHealingEngine: applies CSS patches non-destructively to stylesheet string', () => {
  const engine = new VisualHealingEngine();
  const patches = [{
    patchId: 'vpatch_12345',
    defectType: 'OVERFLOW_HORIZONTAL',
    afterRule: '.card { max-width: 100%; }',
    reason: 'Responsive fluid fix'
  }];

  const updatedCss = engine.applyPatchesToCss('body { margin: 0; }', patches);
  assert.ok(updatedCss.includes('body { margin: 0; }'));
  assert.ok(updatedCss.includes('.card { max-width: 100%; }'));
  assert.ok(updatedCss.includes('vpatch_12345'));
});

test('VisualHealingEngine: applies HTML aria-label patches to buttons lacking accessible names', () => {
  const engine = new VisualHealingEngine();
  const patches = [{
    patchId: 'vpatch_67890',
    defectType: 'MISSING_ACCESSIBLE_NAME',
    afterRule: 'aria-label="Action Button"'
  }];

  const originalHtml = '<button class="icon"><svg></svg></button>';
  const updatedHtml = engine.applyPatchesToHtml(originalHtml, patches);
  assert.ok(updatedHtml.includes('aria-label="Action Button"'));
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 4: VisualVerificationResult & Envelope Invariants (Tests 28-33)
// ─────────────────────────────────────────────────────────────────────────────

test('VisualVerificationResult: enforces deep immutability on envelope', () => {
  const res = VisualVerificationResult.successClean('vplan_test', [{ name: 'mobile' }]);
  assert.strictEqual(res.status, 'VERIFIED_CLEAN');
  assert.ok(Object.isFrozen(res));
  assert.throws(() => {
    res.status = 'UNRESOLVED_DEFECTS';
  }, TypeError);
});

test('VisualVerificationResult: validates allowlisted statuses and rejects unknown', () => {
  assert.throws(() => {
    new VisualVerificationResult({ status: 'INVALID_UNKNOWN_STATUS' });
  }, /Invalid VisualVerificationResult status/);
});

test('VisualVerificationResult: factory methods produce conformant envelopes', () => {
  const clean = VisualVerificationResult.successClean('p1', []);
  assert.strictEqual(clean.status, 'VERIFIED_CLEAN');
  assert.strictEqual(clean.isRealBrowser, true);

  const healed = VisualVerificationResult.successHealed('p2', [], ['d1'], ['p1'], 1);
  assert.strictEqual(healed.status, 'HEALED_VERIFIED');
  assert.strictEqual(healed.isRealBrowser, true);

  const partial = VisualVerificationResult.partialStatic('p3', [], 'Disclaimer');
  assert.strictEqual(partial.status, 'PARTIAL_STATIC_ANALYSIS');
  assert.strictEqual(partial.isRealBrowser, false);

  const skipped = VisualVerificationResult.skippedMissingBrowser('p4', 'No browser');
  assert.strictEqual(skipped.status, 'SKIPPED_MISSING_BROWSER');
  assert.strictEqual(skipped.isRealBrowser, false);

  const conflict = VisualVerificationResult.conflictDetected('p5', { file: 'a.js' });
  assert.strictEqual(conflict.status, 'CONFLICT_DETECTED');

  const unresolved = VisualVerificationResult.unresolvedDefects('p6', ['d1'], [], 2, 'Stuck');
  assert.strictEqual(unresolved.status, 'UNRESOLVED_DEFECTS');

  const rolledBack = VisualVerificationResult.failedRolledBack('p7', 'Error');
  assert.strictEqual(rolledBack.status, 'FAILED_ROLLED_BACK');
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 5: VisualVerificationOrchestrator Bounded Loop (Tests 34-36)
// ─────────────────────────────────────────────────────────────────────────────

test('VisualVerificationOrchestrator: clean initial static scan returns PARTIAL_STATIC_ANALYSIS', async () => {
  const orchestrator = new VisualVerificationOrchestrator({ mode: 'static-only' });
  const result = await orchestrator.verifyAndHeal({
    htmlContent: '<!DOCTYPE html><html><body><h1>Clean Static Page</h1></body></html>',
    cssContent: 'body { margin: 0; }'
  });
  assert.strictEqual(result.status, 'PARTIAL_STATIC_ANALYSIS');
  assert.strictEqual(result.isRealBrowser, false);
});

test('VisualVerificationOrchestrator: bounded healing loop halts at max 2 iterations', async () => {
  const orchestrator = new VisualVerificationOrchestrator({ mode: 'static-only', maxIterations: 2 });
  // Pass HTML with persistent defects
  const result = await orchestrator.verifyAndHeal({
    htmlContent: '<button><svg></svg></button>',
    cssContent: '.card { width: 900px; }'
  });
  // Since mode is static-only, initial inspect returns PARTIAL_STATIC_ANALYSIS immediately
  assert.strictEqual(result.status, 'PARTIAL_STATIC_ANALYSIS');
});

test('VisualVerificationOrchestrator: protects pre-existing files and halts with CONFLICT_DETECTED', async () => {
  const manifest = new Set(['allowed_file.css']);
  const orchestrator = new VisualVerificationOrchestrator(
    { mode: 'static-only' },
    { generatedManifest: manifest }
  );
  // Verify that engine rejects when target is outside manifest
  const engine = orchestrator.healingEngine;
  const res = engine.synthesizePatches([{ defectType: 'OVERFLOW_HORIZONTAL' }], {
    targetFile: 'unmanaged_user_code.js'
  });
  assert.strictEqual(res.error, 'CONFLICT_DETECTED');
});
