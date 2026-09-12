'use strict';

/**
 * AI-Dost 2.0 — Phase 4E: Workflow Semantic Validator
 * 
 * Performs two-tier validation:
 * 1. Structural YAML syntax checking.
 * 2. GitHub Actions semantic AST schema and policy checking.
 */

const { OFFICIAL_ACTIONS } = require('./CiCdValidator');

const ALLOWED_RUNNERS = new Set([
  'ubuntu-latest',
  'ubuntu-22.04',
  'ubuntu-20.04',
  'windows-latest',
  'macos-latest'
]);

class WorkflowSemanticValidator {
  /**
   * Validates generated workflow YAML content against strict GitHub Actions semantic rules
   */
  static validate(yamlContent) {
    const errors = [];
    const warnings = [];

    if (!yamlContent || typeof yamlContent !== 'string') {
      return {
        valid: false,
        errors: ['Workflow content must be a non-empty string'],
        warnings
      };
    }

    const lines = yamlContent.split('\n');

    // 1. Structural YAML Checks (Basic indentation & structure)
    let hasName = false;
    let hasOn = false;
    let hasPermissions = false;
    let hasJobs = false;

    let inPermissions = false;
    let permissions = {};

    let inSteps = false;
    let currentStep = null;
    const steps = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const indent = line.length - line.trimStart().length;

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Top-level keys (indent === 0)
      if (indent === 0) {
        inPermissions = false;
        inSteps = false;

        if (trimmed.startsWith('name:')) hasName = true;
        if (trimmed.startsWith('on:')) hasOn = true;
        if (trimmed.startsWith('permissions:')) {
          hasPermissions = true;
          inPermissions = true;
          // Check for forbidden inline string/array permissions like "permissions: read-all"
          const inlineVal = trimmed.replace('permissions:', '').trim();
          if (inlineVal) {
            errors.push(`Inline permission "${inlineVal}" is forbidden. Permissions must be a structured object.`);
          }
        }
        if (trimmed.startsWith('jobs:')) hasJobs = true;
      }

      // Check permissions block
      if (inPermissions && indent === 2) {
        const parts = trimmed.split(':');
        if (parts.length >= 2) {
          const scope = parts[0].trim();
          const level = parts[1].trim();
          permissions[scope] = level;

          if (level !== 'read' && level !== 'none') {
            errors.push(`Permission "${scope}: ${level}" violates least-privilege policy. Only "read" or "none" allowed.`);
          }
        }
      }

      // Track steps
      if (trimmed.startsWith('- name:')) {
        inSteps = true;
        if (currentStep) steps.push(currentStep);
        currentStep = { name: trimmed.replace('- name:', '').trim(), lineNum: i + 1, uses: null, run: null };
      } else if (inSteps && indent >= 8) {
        if (trimmed.startsWith('uses:')) {
          if (currentStep) currentStep.uses = trimmed.replace('uses:', '').trim();
        } else if (trimmed.startsWith('run:')) {
          if (currentStep) currentStep.run = trimmed.replace('run:', '').trim();
        }
      }
    }

    if (currentStep) steps.push(currentStep);

    // 2. Validate Top-Level Required Keys
    if (!hasName) errors.push('Missing required top-level key: "name"');
    if (!hasOn) errors.push('Missing required top-level key: "on"');
    if (!hasPermissions) errors.push('Missing required top-level key: "permissions" (Least-privilege must be explicitly declared)');
    if (!hasJobs) errors.push('Missing required top-level key: "jobs"');

    // 3. Validate Permissions Object
    if (hasPermissions) {
      if (Object.keys(permissions).length === 0) {
        errors.push('Permissions block cannot be empty.');
      }
      if (permissions.contents !== 'read') {
        errors.push('Permissions block must at least declare "contents: read".');
      }
    }

    // 4. Validate Steps: Mutual Exclusivity and Action Verification
    for (const step of steps) {
      if (!step.uses && !step.run) {
        errors.push(`Step "${step.name}" (line ${step.lineNum}) must define either "uses:" or "run:".`);
      }
      if (step.uses && step.run) {
        errors.push(`Step "${step.name}" (line ${step.lineNum}) cannot define both "uses:" and "run:".`);
      }

      // If action reference (uses:)
      if (step.uses) {
        const atIdx = step.uses.indexOf('@');
        if (atIdx === -1) {
          errors.push(`Action "${step.uses}" in step "${step.name}" must be pinned with "@<sha>" or "@<tag>".`);
          continue;
        }

        const actionName = step.uses.substring(0, atIdx).trim();
        const actionRef = step.uses.substring(atIdx + 1).trim();

        if (!OFFICIAL_ACTIONS.has(actionName)) {
          errors.push(`Unverified third-party action "${actionName}" in step "${step.name}". Only official actions are allowlisted.`);
        }

        // Check pinning: 40-character hex SHA vs tag
        if (/^[a-f0-9]{40}$/i.test(actionRef)) {
          // Immutable 40-char SHA (best practice)
        } else if (/^v[0-9]+(?:\.[0-9]+)*$/.test(actionRef)) {
          warnings.push(`Action "${step.uses}" in step "${step.name}" is using mutable major tag rather than immutable commit SHA.`);
        } else {
          errors.push(`Invalid action reference "${actionRef}" for "${actionName}". Must be 40-character commit SHA or verified major tag.`);
        }
      }

      // If shell command (run:)
      if (step.run) {
        if (/curl\s+.*\|\s*bash/i.test(step.run) || /wget\s+.*\|\s*sh/i.test(step.run)) {
          errors.push(`Step "${step.name}" contains dangerous remote script execution.`);
        }
      }
    }

    // 5. Expression integrity check
    const expressionMatches = yamlContent.match(/\${{\s*([^}]+)\s*}}/g) || [];
    for (const expr of expressionMatches) {
      if (!expr.includes('secrets.') && !expr.includes('matrix.') && !expr.includes('github.')) {
        warnings.push(`Uncommon expression found: ${expr}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = {
  WorkflowSemanticValidator,
  ALLOWED_RUNNERS
};
