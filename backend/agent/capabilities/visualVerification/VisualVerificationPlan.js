'use strict';

/**
 * AI-Dost 2.0 — Phase 4G: VisualVerificationPlan
 * 
 * Versioned, immutable specification for Autonomous Visual Verification & UI Healing.
 * 
 * Defines viewports, defect classification rules, forbidden healing rules (overflow: hidden),
 * strict local network allowlists, and execution modes.
 */

const crypto = require('crypto');

const VISUAL_PLAN_SCHEMA_VERSION = '1.0.0';

const ALLOWED_VIEWPORTS = Object.freeze({
  mobile: Object.freeze({ width: 375, height: 667, name: 'mobile' }),
  tablet: Object.freeze({ width: 768, height: 1024, name: 'tablet' }),
  desktop: Object.freeze({ width: 1280, height: 800, name: 'desktop' })
});

const ALLOWED_DEFECT_RULES = Object.freeze([
  'OVERFLOW_HORIZONTAL',
  'UNEXPECTED_VERTICAL_CLIPPING',
  'INTERACTIVE_ELEMENT_OCCLUDED',
  'TARGET_UNDERSIZED',
  'MISSING_ACCESSIBLE_NAME'
]);

const FORBIDDEN_HEALING_PATTERNS = Object.freeze([
  /overflow\s*:\s*hidden/i,
  /overflow-x\s*:\s*hidden/i,
  /overflow-y\s*:\s*hidden/i,
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /opacity\s*:\s*0(?![.\d])/i
]);

const ALLOWED_HEALING_PROPERTIES = Object.freeze([
  'min-width',
  'max-width',
  'min-height',
  'height',
  'flex-wrap',
  'overflow-wrap',
  'word-break',
  'overflow-x',
  'z-index',
  'padding',
  'box-sizing',
  'aria-label'
]);

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

class VisualVerificationPlan {
  constructor(raw = {}) {
    this.schemaVersion = raw.schemaVersion || VISUAL_PLAN_SCHEMA_VERSION;
    if (this.schemaVersion !== VISUAL_PLAN_SCHEMA_VERSION) {
      const err = new Error(`Unsupported schemaVersion '${this.schemaVersion}'. Expected '${VISUAL_PLAN_SCHEMA_VERSION}'`);
      err.code = 'INVALID_PLAN_PAYLOAD';
      throw err;
    }

    this.planId = raw.planId || `vplan_${crypto.randomUUID().slice(0, 8)}`;
    this.targetFiles = Array.isArray(raw.targetFiles) && raw.targetFiles.length > 0
      ? [...raw.targetFiles]
      : ['frontend/src/App.jsx', 'frontend/index.html'];

    this.workspaceRoot = raw.workspaceRoot || process.cwd();
    this.mode = raw.mode || 'auto'; // 'auto', 'browser-only', 'static-only'
    if (!['auto', 'browser-only', 'static-only'].includes(this.mode)) {
      const err = new Error(`Invalid mode '${this.mode}'. Must be 'auto', 'browser-only', or 'static-only'`);
      err.code = 'INVALID_PLAN_PAYLOAD';
      throw err;
    }

    // Viewports normalization
    const vpNames = Array.isArray(raw.viewports) && raw.viewports.length > 0
      ? raw.viewports
      : ['mobile', 'tablet', 'desktop'];

    this.viewports = [];
    for (const v of vpNames) {
      if (typeof v === 'string' && ALLOWED_VIEWPORTS[v]) {
        this.viewports.push(ALLOWED_VIEWPORTS[v]);
      } else if (typeof v === 'object' && v.width && v.height) {
        this.viewports.push(Object.freeze({
          width: Number(v.width),
          height: Number(v.height),
          name: v.name || `${v.width}x${v.height}`
        }));
      }
    }

    if (this.viewports.length === 0) {
      this.viewports = [ALLOWED_VIEWPORTS.mobile, ALLOWED_VIEWPORTS.tablet, ALLOWED_VIEWPORTS.desktop];
    }

    // Tolerance thresholds
    this.overflowTolerancePx = typeof raw.overflowTolerancePx === 'number' ? raw.overflowTolerancePx : 2;
    this.minTargetSizePx = typeof raw.minTargetSizePx === 'number' ? raw.minTargetSizePx : 44;
    this.maxIterations = typeof raw.maxIterations === 'number' ? Math.min(raw.maxIterations, 2) : 2;
    this.timeoutMs = typeof raw.timeoutMs === 'number' ? raw.timeoutMs : 10000;

    // Strict local network allowlist
    this.networkPolicy = Object.freeze({
      allowLocalhost: true,
      allowFileScheme: true,
      allowDataUris: true,
      blockExternal: true,
      blockedHostsPattern: /^(?!(?:localhost|127\.0\.0\.1|::1)\b).+$/i
    });

    deepFreeze(this);
  }

  /**
   * Asserts whether a proposed CSS patch rule is valid and not a prohibited content-hiding hack
   */
  static isAllowedHealingRule(cssProperty, cssValue) {
    if (!cssProperty || typeof cssProperty !== 'string') return false;
    const propLower = cssProperty.toLowerCase().trim();
    const valLower = String(cssValue || '').toLowerCase().trim();

    // Check for forbidden content-hiding patterns
    const fullRule = `${propLower}: ${valLower};`;
    for (const pattern of FORBIDDEN_HEALING_PATTERNS) {
      if (pattern.test(fullRule)) {
        return false;
      }
    }

    return ALLOWED_HEALING_PROPERTIES.includes(propLower);
  }

  clone(overrides = {}) {
    return new VisualVerificationPlan({
      schemaVersion: this.schemaVersion,
      planId: `vplan_${crypto.randomUUID().slice(0, 8)}`,
      targetFiles: [...this.targetFiles],
      workspaceRoot: this.workspaceRoot,
      mode: this.mode,
      viewports: this.viewports.map(v => ({ ...v })),
      overflowTolerancePx: this.overflowTolerancePx,
      minTargetSizePx: this.minTargetSizePx,
      maxIterations: this.maxIterations,
      timeoutMs: this.timeoutMs,
      ...overrides
    });
  }
}

module.exports = {
  VisualVerificationPlan,
  VISUAL_PLAN_SCHEMA_VERSION,
  ALLOWED_VIEWPORTS,
  ALLOWED_DEFECT_RULES,
  FORBIDDEN_HEALING_PATTERNS,
  ALLOWED_HEALING_PROPERTIES,
  deepFreeze
};
