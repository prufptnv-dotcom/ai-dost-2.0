'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WorkspaceFrameworkIntelligence } = require('../services/workspaceFrameworkIntelligence');

test('Workspace & Framework Intelligence Suite', async (t) => {
  const intel = new WorkspaceFrameworkIntelligence();

  await t.test('1. Monorepo with nested frontend/backend manifests detected accurately', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-monorepo-test-'));
    try {
      const frontendDir = path.join(tmpDir, 'frontend');
      const backendDir = path.join(tmpDir, 'backend');
      fs.mkdirSync(frontendDir, { recursive: true });
      fs.mkdirSync(backendDir, { recursive: true });

      // Frontend package.json
      fs.writeFileSync(path.join(frontendDir, 'package.json'), JSON.stringify({
        name: 'my-frontend',
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@fortawesome/react-fontawesome': '^3.5.0',
          tailwindcss: '^3.4.0'
        },
        devDependencies: {
          vite: '^5.0.0'
        }
      }));

      // Backend package.json
      fs.writeFileSync(path.join(backendDir, 'package.json'), JSON.stringify({
        name: 'my-backend',
        dependencies: {
          express: '^4.21.0'
        }
      }));

      const res = intel.inspectWorkspace(tmpDir);
      assert.strictEqual(res.isMonorepo, true);
      assert.strictEqual(res.architecture, 'monorepo-nested');
      assert.strictEqual(res.frontend.framework, 'react');
      assert.strictEqual(res.backend.framework, 'express');
      assert.strictEqual(res.buildTool, 'vite');
      assert.strictEqual(res.iconSystem, 'fontawesome');
      assert.strictEqual(res.stylingSystem, 'tailwindcss');

      // Verify directive contains monorepo and icon preservation instructions
      assert.ok(res.promptDirective.includes('monorepo-nested'));
      assert.ok(res.promptDirective.includes('Preserved Icon System: fontawesome'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('2. Distinguishes build tool (Vite) from application framework (React)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-buildtool-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'my-app',
        dependencies: {
          vue: '^3.4.0'
        },
        devDependencies: {
          vite: '^5.0.0'
        }
      }));

      const res = intel.inspectWorkspace(tmpDir);
      assert.strictEqual(res.buildTool, 'vite');
      assert.strictEqual(res.frontend.framework, 'vue');
      assert.notStrictEqual(res.frontend.framework, 'vite');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('3. Explicit stack override takes precedence over detected workspace', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-override-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'existing-react',
        dependencies: { react: '^18.0.0' }
      }));

      const res = intel.inspectWorkspace(tmpDir, { preferredFramework: 'nextjs' });
      assert.strictEqual(res.effectiveFramework, 'nextjs');
      assert.strictEqual(res.userOverrideApplied, true);
      assert.ok(res.promptDirective.includes('Explicit User Selection'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('4. Handles missing or empty directory without throwing', () => {
    const res = intel.inspectWorkspace(path.join(os.tmpdir(), 'non-existent-dir-12345'));
    assert.strictEqual(res.isMonorepo, false);
    assert.ok(res.effectiveFramework);
    assert.strictEqual(typeof res.promptDirective, 'string');
  });

  await t.test('5. Handles malformed / corrupt package.json gracefully', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-corrupt-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{ broken json ...');
      const res = intel.inspectWorkspace(tmpDir);
      assert.strictEqual(res.isMonorepo, false);
      assert.ok(res.effectiveFramework);
      assert.ok(typeof res.promptDirective === 'string');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('6. Detects Python backend framework (FastAPI) from requirements.txt', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-py-backend-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'fastapi>=0.110.0\nuvicorn\npydantic\n');
      const res = intel.inspectWorkspace(tmpDir);
      assert.strictEqual(res.backend.framework, 'fastapi');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
