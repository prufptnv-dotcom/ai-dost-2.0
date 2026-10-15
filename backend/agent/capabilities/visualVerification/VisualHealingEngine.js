'use strict';

/**
 * AI-Dost 2.0 — Phase 4G: VisualHealingEngine
 * 
 * Context-aware deterministic UI healing synthesizer.
 * Generates non-destructive CSS and HTML attribute patches for detected visual defects.
 * 
 * Safety guarantees:
 * - NEVER uses 'overflow: hidden', 'display: none', 'visibility: hidden', or 'opacity: 0'.
 * - Prefers fluid layout: min-width: 0, flex-wrap: wrap, max-width: 100%, overflow-wrap: anywhere.
 * - Replaces rigid fixed height with min-height + height: auto.
 * - Enforces 44x44px minimum touch targets and accessible names.
 * - Enforces patch scoping: pre-existing user files trigger CONFLICT_DETECTED.
 * - Computes cryptographic SHA-256 checksums on all generated patches.
 */

const crypto = require('crypto');
const path = require('path');
const { VisualVerificationPlan, FORBIDDEN_HEALING_PATTERNS } = require('./VisualVerificationPlan');

class VisualHealingEngine {
  constructor(plan = null, options = {}) {
    this.plan = plan instanceof VisualVerificationPlan ? plan : new VisualVerificationPlan(plan || {});
    this.generatedManifest = options.generatedManifest || new Set(); // Files allowed to be modified
    this.history = []; // Prior iteration patches to detect churn
  }

  /**
   * Generates deterministic healing patches for an array of detected defects.
   * 
   * @param {Array<Object>} defects - Defects produced by VisualGeometryInspector
   * @param {Object} context - Execution context (e.g. current files, project files)
   * @returns {Object} { patches: Array<Object>, conflict: Object|null, error: string|null }
   */
  synthesizePatches(defects = [], context = {}) {
    if (!Array.isArray(defects) || defects.length === 0) {
      return { patches: [], conflict: null, error: null };
    }

    const patches = [];
    const targetFile = context.targetFile || 'frontend/src/index.css';

    // 1. Conflict detection against protected pre-existing files
    if (this.generatedManifest.size > 0 && !this.generatedManifest.has(targetFile)) {
      return {
        patches: [],
        conflict: {
          code: 'CONFLICT_DETECTED',
          message: `Cannot patch protected pre-existing file '${targetFile}'. Healing is restricted to generated files only.`,
          file: targetFile
        },
        error: 'CONFLICT_DETECTED'
      };
    }

    // Process each defect deterministically
    for (let i = 0; i < defects.length; i++) {
      const defect = defects[i];
      const patch = this._createPatchForDefect(defect, targetFile, i);

      if (!patch) continue;

      // 2. Safety check: ensure patch does NOT contain forbidden content-hiding hacks
      const ruleToCheck = `${patch.afterRule};`;
      let isForbidden = false;
      for (const pattern of FORBIDDEN_HEALING_PATTERNS) {
        if (pattern.test(ruleToCheck)) {
          isForbidden = true;
          break;
        }
      }

      if (isForbidden) {
        return {
          patches: [],
          conflict: null,
          error: `Safety violation: Generated patch for selector '${patch.selector}' contains forbidden content-hiding pattern '${patch.afterRule}'`
        };
      }

      // 3. Churn / opposing selector check
      const priorPatch = this.history.find(p => p.selector === patch.selector && p.property === patch.property);
      if (priorPatch && priorPatch.afterRule !== patch.afterRule) {
        return {
          patches: [],
          conflict: null,
          error: `Patch churn detected: Opposing rule generated for selector '${patch.selector}' (prior: '${priorPatch.afterRule}', new: '${patch.afterRule}')`
        };
      }

      patches.push(patch);
    }

    // Record in history
    this.history.push(...patches);

    return {
      patches,
      conflict: null,
      error: null
    };
  }

  /**
   * Deterministic rule synthesizer based on defect type and context
   */
  _createPatchForDefect(defect, file, index) {
    const defectType = defect.defectType;
    const selector = defect.selector || '*';
    const viewport = defect.viewport || 'all';
    let beforeRule = '';
    let afterRule = '';
    let property = '';
    let reason = '';

    switch (defectType) {
      case 'OVERFLOW_HORIZONTAL': {
        // Safe fluid fix: min-width: 0, flex-wrap: wrap, max-width: 100%, overflow-wrap: anywhere
        property = 'fluid-overflow';
        beforeRule = '/* unconstrained width or rigid flex child */';
        afterRule = `${selector} { max-width: 100%; min-width: 0; flex-wrap: wrap; overflow-wrap: anywhere; box-sizing: border-box; }`;
        reason = 'Resolves horizontal overflow via responsive fluid constraints and word wrapping without hiding content';
        break;
      }

      case 'UNEXPECTED_VERTICAL_CLIPPING': {
        // Safe height fix: replace fixed height with min-height and height: auto
        property = 'min-height';
        const declaredHeight = defect.metrics?.clientHeight || 200;
        beforeRule = `${selector} { height: ${declaredHeight}px; overflow-y: hidden; }`;
        afterRule = `${selector} { min-height: ${declaredHeight}px; height: auto; overflow-y: visible; }`;
        reason = 'Replaces rigid fixed height with min-height to prevent vertical content clipping';
        break;
      }

      case 'INTERACTIVE_ELEMENT_OCCLUDED': {
        // Safe stacking context fix: elevate z-index
        property = 'z-index';
        beforeRule = `${selector} { z-index: auto; }`;
        afterRule = `${selector} { position: relative; z-index: 10; }`;
        reason = 'Elevates interactive element stacking context to restore hit-testing and pointer interaction';
        break;
      }

      case 'TARGET_UNDERSIZED': {
        // Safe hit target expansion: enforce 44x44px minimum target
        property = 'min-target-size';
        const currentW = defect.metrics?.width || 24;
        const currentH = defect.metrics?.height || 24;
        beforeRule = `${selector} { min-width: ${currentW}px; min-height: ${currentH}px; }`;
        afterRule = `${selector} { min-width: 44px; min-height: 44px; padding: 8px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; }`;
        reason = 'Enforces 44x44px WCAG minimum interactive touch target dimension with comfortable hit padding';
        break;
      }

      case 'MISSING_ACCESSIBLE_NAME': {
        // Safe accessibility label fix
        property = 'aria-label';
        beforeRule = `<${selector}>`;
        afterRule = `aria-label="Action Button"`;
        reason = 'Provides explicit accessible name for screen readers and assistive technology';
        break;
      }

      default:
        return null;
    }

    // Build unique patchId and SHA256 checksum
    const rawContent = `${file}:${selector}:${defectType}:${viewport}:${afterRule}`;
    const patchChecksum = crypto.createHash('sha256').update(rawContent).digest('hex');
    const patchId = `vpatch_${patchChecksum.slice(0, 10)}`;

    return {
      patchId,
      defectId: `defect_${index}_${patchChecksum.slice(0, 6)}`,
      file,
      selector,
      defectType,
      viewport,
      property,
      beforeRule,
      afterRule,
      reason,
      metricsBefore: defect.metrics || {},
      metricsAfter: { applied: true },
      patchChecksum
    };
  }

  /**
   * Applies CSS patches to CSS content string
   * 
   * @param {string} cssContent - Original CSS
   * @param {Array<Object>} patches - Patches to apply
   * @returns {string} Modified CSS content
   */
  applyPatchesToCss(cssContent = '', patches = []) {
    let result = cssContent || '';
    for (const patch of patches) {
      if (patch.defectType !== 'MISSING_ACCESSIBLE_NAME') {
        result += `\n/* AI-Dost Visual Healer [${patch.patchId}]: ${patch.reason} */\n${patch.afterRule}\n`;
      }
    }
    return result;
  }

  /**
   * Applies HTML attribute patches to HTML content string
   * 
   * @param {string} htmlContent - Original HTML
   * @param {Array<Object>} patches - Patches to apply
   * @returns {string} Modified HTML content
   */
  applyPatchesToHtml(htmlContent = '', patches = []) {
    let result = htmlContent || '';
    for (const patch of patches) {
      if (patch.defectType === 'MISSING_ACCESSIBLE_NAME') {
        // Add aria-label to buttons that lack accessible names
        result = result.replace(
          /<button\b(?![^>]*\baria-label\b)([^>]*)>/gi,
          `<button $1 ${patch.afterRule}>`
        );
      }
    }
    return result;
  }
}

module.exports = {
  VisualHealingEngine
};
