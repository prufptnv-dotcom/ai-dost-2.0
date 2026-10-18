'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  TrustedExecutionService,
  getNpmDependencyInstallPlan
} = require('../quality-evaluation/trustedExecutionService');
const { FakeContainerExecutionAdapter } = require('../quality-evaluation/containerExecutionAdapter');

function makeWorkspace(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-dependency-install-test-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const destination = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content, 'utf8');
  }
  return dir;
}

function packageFiles({ withLock = true } = {}) {
  const files = {
    'package.json': JSON.stringify({
      name: 'dependency-bootstrap-test',
      version: '1.0.0',
      private: true,
      scripts: { build: 'node build.js', test: 'node --test tests/smoke.test.js' },
      dependencies: { react: '^18.2.0' }
    }, null, 2),
    'build.js': "console.log('build fixture');\n",
    'tests/smoke.test.js': "'use strict';\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\ntest('fixture', () => assert.equal(1 + 1, 2));\n"
  };
  if (withLock) {
    files['package-lock.json'] = JSON.stringify({
      name: 'dependency-bootstrap-test',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': { name: 'dependency-bootstrap-test', version: '1.0.0', dependencies: { react: '^18.2.0' } },
        'node_modules/react': {
          version: '18.2.0',
          resolved: 'https://registry.npmjs.org/react/-/react-18.2.0.tgz',
          integrity: 'sha512-test-fixture'
        }
      }
    }, null, 2);
  }
  return files;
}

const validContainerResult = (stdout = 'ok') => ({
  executed: true,
  exitCode: 0,
  stdout,
  stderr: '',
  status: 'PASSED',
  isolation: 'CONTAINER_ISOLATED',
  error: null
});

test('npm dependency plan prefers reproducible npm ci when a registry-safe lockfile exists', () => {
  const dir = makeWorkspace(packageFiles({ withLock: true }));
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const plan = getNpmDependencyInstallPlan(dir, pkg);
    assert.equal(plan.needed, true);
    assert.equal(plan.command, 'npm');
    assert.deepEqual(plan.args, ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('npm dependency plan uses package-lock-free install when no lockfile is present', () => {
  const dir = makeWorkspace(packageFiles({ withLock: false }));
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const plan = getNpmDependencyInstallPlan(dir, pkg);
    assert.deepEqual(plan.args, ['install', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('npm dependency plan fails closed for custom registries, non-registry URLs and other package managers', () => {
  const dir = makeWorkspace(packageFiles({ withLock: true }));
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const badLock = JSON.parse(fs.readFileSync(path.join(dir, 'package-lock.json'), 'utf8'));
    badLock.packages['node_modules/react'].resolved = 'https://malicious.example/react.tgz';
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(badLock), 'utf8');
    assert.throws(() => getNpmDependencyInstallPlan(dir, pkg), /registry\.npmjs\.org/);

    fs.rmSync(path.join(dir, 'package-lock.json'));
    fs.writeFileSync(path.join(dir, '.npmrc'), 'registry=https://malicious.example/', 'utf8');
    assert.throws(() => getNpmDependencyInstallPlan(dir, pkg), /Custom package-manager configuration/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('dependency installation is blocked by default and yields signed failure evidence instead of a fake pass', async () => {
  const adapter = new FakeContainerExecutionAdapter();
  const service = new TrustedExecutionService({
    secret: 'test-secret-long-enough-0123456789',
    adapter,
    allowNetworkedDependencyInstall: false,
    timeoutMs: 1000
  });
  const result = await service.execute({
    files: packageFiles({ withLock: true }),
    runId: 'run-dependencies-disabled'
  });

  assert.equal(adapter.calls.length, 0, 'No networked package operation should happen without explicit opt-in.');
  assert.equal(result.build.status, 'FAILED');
  assert.equal(result.build.success, false);
  assert.match(result.build.output, /NETWORKED_DEPENDENCY_INSTALL_DISABLED/);
  assert.match(result.receipt.receiptSignature, /^[0-9a-f]{64}$/);
});

test('opted-in dependency install runs networked install separately, then executes build/tests offline', async () => {
  const adapter = new FakeContainerExecutionAdapter({
    handler: async (params) => {
      if (params.command === 'npm' && params.args[0] === 'ci') return validContainerResult('installed locked dependencies');
      if (params.command === 'npm' && params.args[0] === 'run' && params.args[1] === 'build') return validContainerResult('build complete');
      if (params.command === 'npm' && params.args[0] === 'test') return validContainerResult('# tests 1\n# pass 1\n# fail 0');
      return { ...validContainerResult('unexpected command'), exitCode: 2, status: 'FAILED' };
    }
  });
  const service = new TrustedExecutionService({
    secret: 'test-secret-long-enough-0123456789',
    adapter,
    allowNetworkedDependencyInstall: true,
    timeoutMs: 1000
  });
  const result = await service.execute({
    files: packageFiles({ withLock: true }),
    runId: 'run-dependencies-enabled'
  });

  assert.equal(adapter.calls.length, 3);
  assert.equal(adapter.calls[0].command, 'npm');
  assert.deepEqual(adapter.calls[0].args, ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  assert.equal(adapter.calls[0].network, 'bridge');
  assert.equal(adapter.calls[0].readOnly, false);
  assert.equal(adapter.calls[1].network, undefined, 'Build uses offline default network policy.');
  assert.equal(adapter.calls[1].readOnly, undefined, 'Build uses read-only staged source plus ephemeral overlay.');
  assert.equal(adapter.calls[2].args[0], 'test');
  assert.equal(result.build.success, true);
  assert.equal(result.tests.commandPassed, true);
  assert.match(result.receipt.command, /npm ci/);
  assert.match(result.receipt.command, /npm run build/);
  assert.match(result.receipt.command, /npm test/);
  assert.match(result.build.output, /DEPENDENCY_INSTALL_STATUS=PASSED/);
});
