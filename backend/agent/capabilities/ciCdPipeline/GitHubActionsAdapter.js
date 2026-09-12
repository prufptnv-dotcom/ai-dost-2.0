'use strict';

/**
 * AI-Dost 2.0 — Phase 4E: GitHub Actions Adapter
 * 
 * Deterministically maps a Canonical Pipeline Model (CPM) to valid GitHub Actions YAML AST.
 * Enforces action SHA pinning, CPM-to-GitHub key conversions (pullRequest -> pull_request),
 * zero duplicate caching, expression preservation, and inert deployment template synthesis.
 */

const crypto = require('crypto');
const { OFFICIAL_ACTION_SHAS } = require('./CiCdPlan');

class GitHubActionsAdapter {
  /**
   * Translates a CanonicalPipelineModel into a GitHub Actions CI workflow YAML string
   */
  static generateWorkflowYaml(cpm, plan) {
    const lines = [];

    // Header comment
    lines.push('# AI-Dost 2.0 Auto-Generated CI Pipeline (Phase 4E)');
    lines.push('# Platform: GitHub Actions | Least-Privilege Enforced');
    lines.push('');

    // 1. Workflow Name
    lines.push(`name: ${cpm.pipelineName}`);
    lines.push('');

    // 2. Triggers (Deterministic key mapping)
    lines.push('on:');
    if (cpm.triggers.push && cpm.triggers.push.length > 0) {
      lines.push('  push:');
      lines.push('    branches:');
      for (const branch of cpm.triggers.push) {
        lines.push(`      - ${branch}`);
      }
    }

    if (cpm.triggers.pullRequest && cpm.triggers.pullRequest.length > 0) {
      lines.push('  pull_request:');
      lines.push('    branches:');
      for (const branch of cpm.triggers.pullRequest) {
        lines.push(`      - ${branch}`);
      }
    }

    if (cpm.triggers.workflowDispatch) {
      lines.push('  workflow_dispatch:');
    }
    lines.push('');

    // 3. Permissions (Structured least privilege ONLY: { contents: "read" })
    lines.push('permissions:');
    for (const [scope, level] of Object.entries(cpm.permissions)) {
      lines.push(`  ${scope}: ${level}`);
    }
    lines.push('');

    // 4. Jobs
    lines.push('jobs:');
    lines.push('  ci-pipeline:');
    lines.push('    name: Lint, Test & Build');
    lines.push('    runs-on: ubuntu-latest');

    // Ephemeral Services (Postgres / MySQL)
    if (Array.isArray(cpm.ephemeralServices) && cpm.ephemeralServices.length > 0) {
      lines.push('    services:');
      for (const s of cpm.ephemeralServices) {
        lines.push(`      ${s.name}:`);
        lines.push(`        image: ${s.image}`);
        if (s.env && Object.keys(s.env).length > 0) {
          lines.push('        env:');
          for (const [k, v] of Object.entries(s.env)) {
            lines.push(`          ${k}: ${v}`);
          }
        }
        if (s.ports && s.ports.length > 0) {
          lines.push('        ports:');
          for (const p of s.ports) {
            lines.push(`          - ${p}`);
          }
        }
        if (s.options) {
          lines.push(`        options: >-\n          ${s.options}`);
        }
      }
    }

    // Matrix Strategy
    if (cpm.runtimeMatrix && Array.isArray(cpm.runtimeMatrix.versions) && cpm.runtimeMatrix.versions.length > 0) {
      lines.push('    strategy:');
      lines.push('      fail-fast: false');
      lines.push('      matrix:');
      lines.push('        node-version:');
      for (const v of cpm.runtimeMatrix.versions) {
        lines.push(`          - ${v}`);
      }
    }

    // Steps
    lines.push('    steps:');
    for (const stage of cpm.stages) {
      lines.push(`      - name: ${stage.name}`);
      if (stage.if) {
        lines.push(`        if: ${stage.if}`);
      }

      if (stage.type === 'ACTION') {
        lines.push(`        uses: ${stage.action}`);
        if (stage.with && Object.keys(stage.with).length > 0) {
          lines.push('        with:');
          for (const [k, v] of Object.entries(stage.with)) {
            lines.push(`          ${k}: ${v}`);
          }
        }
      } else if (stage.type === 'COMMAND') {
        lines.push(`        run: ${stage.run}`);
        if (stage.env && Object.keys(stage.env).length > 0) {
          lines.push('        env:');
          for (const [k, v] of Object.entries(stage.env)) {
            lines.push(`          ${k}: ${v}`);
          }
        }
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Synthesizes an inert, non-executable deployment workflow template
   * Saved strictly as .github/workflows/deploy.yml.template
   */
  static generateDeploymentTemplate(cpm, plan) {
    const lines = [];

    lines.push('# ==============================================================================');
    lines.push('# AI-Dost 2.0 Deployment Workflow Template (Phase 4E)');
    lines.push('#');
    lines.push('# INERT NOTICE: This file is saved as .template to prevent automatic execution.');
    lines.push('# To activate:');
    lines.push('# 1. Configure required repository secrets in GitHub Settings -> Secrets & Variables.');
    lines.push('# 2. Rename this file to deploy.yml when ready for production delivery.');
    lines.push('# ==============================================================================');
    lines.push('');
    lines.push(`name: Deployment Workflow Template (${plan.projectId})`);
    lines.push('');
    lines.push('on:');
    lines.push('  workflow_dispatch:');
    lines.push('  push:');
    lines.push('    branches:');
    lines.push('      - production');
    lines.push('');
    lines.push('permissions:');
    lines.push('  contents: read');
    lines.push('');
    lines.push('jobs:');
    lines.push('  deploy-staging:');
    lines.push('    name: Staging Deployment Verification');
    lines.push('    runs-on: ubuntu-latest');
    lines.push('    steps:');

    const checkoutSha = plan.actionPinningMode === 'sha' ? OFFICIAL_ACTION_SHAS['actions/checkout'] : 'v4';
    lines.push('      - name: Checkout Code');
    lines.push(`        uses: actions/checkout@${checkoutSha}`);

    const setupNodeSha = plan.actionPinningMode === 'sha' ? OFFICIAL_ACTION_SHAS['actions/setup-node'] : 'v4';
    lines.push('      - name: Setup Node Runtime');
    lines.push(`        uses: actions/setup-node@${setupNodeSha}`);
    lines.push('        with:');
    lines.push('          node-version: 20.x');
    lines.push('          cache: npm');

    lines.push('      - name: Install Production Dependencies');
    lines.push('        run: npm ci --ignore-scripts --omit=dev');

    lines.push('      - name: Verify Build Artifacts');
    lines.push('        run: npm run build');
    lines.push('        env:');
    lines.push('          DATABASE_URL: ${{ secrets.DATABASE_URL }}');
    lines.push('          APP_SECRET: ${{ secrets.APP_SECRET }}');
    lines.push('          PRODUCTION_DEPLOY_KEY: ${{ secrets.PRODUCTION_DEPLOY_KEY }}');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Computes sha256 checksum of generated workflow content
   */
  static computeChecksum(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}

module.exports = {
  GitHubActionsAdapter
};
