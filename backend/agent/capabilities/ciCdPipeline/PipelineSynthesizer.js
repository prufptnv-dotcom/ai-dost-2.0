'use strict';

/**
 * AI-Dost 2.0 — Phase 4E: Pipeline Synthesizer
 * 
 * Introspects workspace metadata, package.json, lockfiles, and Phase 4B/4C/4D artifacts
 * to deterministically construct a Canonical Pipeline Model (CPM).
 */

const path = require('path');
const fs = require('fs');
const { CanonicalPipelineModel } = require('./CanonicalPipelineModel');
const {
  ACTIVE_NODE_LTS_VERSIONS,
  OFFICIAL_ACTION_SHAS
} = require('./CiCdPlan');

class PipelineSynthesizer {
  /**
   * Introspects a project and synthesizes a Canonical Pipeline Model
   */
  static synthesize(plan) {
    const workspacePath = plan.workspacePath || '';
    let pkg = {};
    let hasLockfile = false;

    if (workspacePath && fs.existsSync(workspacePath)) {
      const pkgPath = path.join(workspacePath, 'package.json');
      const lockPath = path.join(workspacePath, 'package-lock.json');
      const shrinkwrapPath = path.join(workspacePath, 'npm-shrinkwrap.json');

      if (fs.existsSync(pkgPath)) {
        try {
          pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch {
          // Ignore parse error
        }
      }

      hasLockfile = fs.existsSync(lockPath) || fs.existsSync(shrinkwrapPath);
    }

    const scripts = pkg.scripts || {};
    const allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);

    // 1. Resolve Runtime Matrix
    const nodeVersions = PipelineSynthesizer.resolveNodeMatrix(plan, pkg);

    // 2. Resolve Test Framework and Command
    const testInfo = PipelineSynthesizer.resolveTestExecution(plan, pkg, scripts, allDeps);

    // 3. Resolve Database Service
    const dbService = PipelineSynthesizer.resolveDatabaseService(plan, pkg, scripts, allDeps);

    // 4. Construct Stages
    const stages = [];

    // Stage 1: Checkout (SHA pinned)
    const checkoutSha = plan.actionPinningMode === 'sha' ? OFFICIAL_ACTION_SHAS['actions/checkout'] : 'v4';
    stages.push({
      id: 'checkout',
      name: 'Checkout Repository',
      type: 'ACTION',
      action: `actions/checkout@${checkoutSha}`
    });

    // Stage 2: Setup Node (SHA pinned with native cache)
    const setupNodeSha = plan.actionPinningMode === 'sha' ? OFFICIAL_ACTION_SHAS['actions/setup-node'] : 'v4';
    stages.push({
      id: 'setup-node',
      name: 'Setup Node.js Runtime',
      type: 'ACTION',
      action: `actions/setup-node@${setupNodeSha}`,
      with: {
        'node-version': '${{ matrix.node-version }}',
        'cache': 'npm'
      }
    });

    // Stage 3: Install Dependencies
    const installCmd = plan.installScriptPolicy === 'standard' ? 'npm ci' : 'npm ci --ignore-scripts';
    stages.push({
      id: 'install-dependencies',
      name: 'Install Dependencies (Clean Install)',
      type: 'COMMAND',
      run: installCmd
    });

    // Stage 4: Linting (if enabled & script exists)
    if (plan.stages.lint && scripts.lint) {
      stages.push({
        id: 'lint',
        name: 'Run Linting Checks',
        type: 'COMMAND',
        run: 'npm run lint'
      });
    }

    // Stage 5: Ephemeral Database Migration (if enabled, DB present, and script exists)
    if (plan.stages.databaseMigration && dbService && dbService.migrationCommand) {
      stages.push({
        id: 'db-migration',
        name: 'Run Database Migrations',
        type: 'COMMAND',
        run: dbService.migrationCommand,
        env: dbService.env
      });
    }

    // Stage 6: Browser Setup (Playwright only if detected and locked)
    if (testInfo.isPlaywright) {
      stages.push({
        id: 'install-playwright-browsers',
        name: 'Install Playwright Browser Binaries',
        type: 'COMMAND',
        run: './node_modules/.bin/playwright install --with-deps chromium'
      });
    }

    // Stage 7: Test Execution (Framework-specific, safe flags only)
    if (plan.stages.test && testInfo.testCommand) {
      const testStage = {
        id: 'test',
        name: `Run Test Suite (${testInfo.framework})`,
        type: 'COMMAND',
        run: testInfo.testCommand
      };
      if (dbService) {
        testStage.env = dbService.env;
      }
      stages.push(testStage);

      // Playwright Artifact Upload (always upload test reports/trace on failure/success)
      if (testInfo.isPlaywright) {
        const uploadSha = plan.actionPinningMode === 'sha' ? OFFICIAL_ACTION_SHAS['actions/upload-artifact'] : 'v4';
        stages.push({
          id: 'upload-playwright-report',
          name: 'Upload Playwright Test Report',
          type: 'ACTION',
          action: `actions/upload-artifact@${uploadSha}`,
          if: 'always()',
          with: {
            name: 'playwright-report',
            path: 'playwright-report/',
            'retention-days': '30'
          }
        });
      }
    }

    // Stage 8: OpenAPI Contract Drift Check (Phase 4D integration)
    if (plan.stages.contractDrift && (scripts['check-drift'] || scripts['contract:check'])) {
      const driftScript = scripts['check-drift'] ? 'npm run check-drift' : 'npm run contract:check';
      stages.push({
        id: 'contract-drift-check',
        name: 'Validate OpenAPI Contract Drift',
        type: 'COMMAND',
        run: driftScript
      });
    }

    // Stage 9: Build (if enabled & script exists)
    if (plan.stages.build && scripts.build) {
      stages.push({
        id: 'build',
        name: 'Build Production Bundle',
        type: 'COMMAND',
        run: 'npm run build'
      });
    }

    // Build and return Canonical Pipeline Model
    const ephemeralServices = dbService && dbService.serviceContainer ? [dbService.serviceContainer] : [];

    return new CanonicalPipelineModel({
      pipelineName: `${plan.projectId} CI Pipeline`,
      permissions: plan.permissions,
      triggers: plan.triggers,
      runtimeMatrix: {
        runtime: 'node',
        versions: nodeVersions
      },
      ephemeralServices,
      stages
    });
  }

  /**
   * Resolves safe active LTS Node.js versions without hardcoding or guessing
   */
  static resolveNodeMatrix(plan, pkg) {
    if (Array.isArray(plan.nodeVersions) && plan.nodeVersions.length > 0) {
      return plan.nodeVersions;
    }

    const enginesNode = pkg.engines?.node;
    if (!enginesNode) {
      // Default to active modern LTS versions
      return ['20.x', '22.x'];
    }

    // Inspect engines string
    const cleanEngines = String(enginesNode).trim();
    if (cleanEngines.includes('<16') || cleanEngines.includes('<=16') || cleanEngines.includes('<18')) {
      const err = new Error(`engines.node specifies obsolete Node range: "${enginesNode}". Node LTS 18.x+ required.`);
      err.code = 'UNRESOLVED_RUNTIME_MATRIX';
      throw err;
    }

    // Check >= range
    const gteMatch = cleanEngines.match(/>=\s*([0-9]+)/);
    if (gteMatch) {
      const minMajor = parseInt(gteMatch[1], 10);
      const matched = ACTIVE_NODE_LTS_VERSIONS.filter(v => parseInt(v, 10) >= minMajor);
      if (matched.length > 0) return matched;
    }

    // Check exact or ^ or ~ or .x matching
    const matchedVersions = [];
    for (const lts of ACTIVE_NODE_LTS_VERSIONS) {
      const major = parseInt(lts, 10);
      if (cleanEngines.includes(`^${major}`) || cleanEngines.includes(`~${major}`) || cleanEngines.includes(`${major}.x`) || cleanEngines.includes(`${major}.`)) {
        matchedVersions.push(lts);
      }
    }

    if (matchedVersions.length > 0) {
      return matchedVersions;
    }

    const err = new Error(`Cannot safely resolve active Node LTS version matching engines.node: "${enginesNode}".`);
    err.code = 'UNRESOLVED_RUNTIME_MATRIX';
    throw err;
  }

  /**
   * Resolves test framework and derives safe execution command
   */
  static resolveTestExecution(plan, pkg, scripts, allDeps) {
    const rawTestScript = scripts.test || '';
    let framework = plan.testFramework;

    // Detect framework from dependencies if not explicitly in plan
    if (!framework) {
      if (allDeps['@playwright/test'] || rawTestScript.includes('playwright')) {
        framework = 'playwright';
      } else if (allDeps['jest'] || rawTestScript.includes('jest')) {
        framework = 'jest';
      } else {
        framework = 'node:test';
      }
    }

    let testCommand = 'npm test';
    let isPlaywright = false;

    if (framework === 'jest') {
      // For Jest, append --ci if not already in the npm script
      testCommand = rawTestScript.includes('--ci') ? 'npm test' : 'npm test -- --ci';
    } else if (framework === 'node:test') {
      // NEVER append --ci to node:test as it is unsupported by Node's test runner
      testCommand = 'npm test';
    } else if (framework === 'playwright') {
      isPlaywright = true;
      testCommand = scripts['test:e2e'] ? 'npm run test:e2e' : './node_modules/.bin/playwright test';
    }

    return {
      framework,
      testCommand,
      isPlaywright
    };
  }

  /**
   * Resolves ephemeral database service requirements without guessing
   */
  static resolveDatabaseService(plan, pkg, scripts, allDeps) {
    // 1. Explicit database configuration from plan (Phase 4B integration)
    const dbConfig = plan.databaseConfig;
    if (dbConfig && dbConfig.engine) {
      const engine = dbConfig.engine.toLowerCase();

      if (engine === 'sqlite') {
        return {
          engine: 'sqlite',
          serviceContainer: null,
          migrationCommand: scripts['db:migrate'] ? 'npm run db:migrate' : null,
          env: { DATABASE_URL: 'file:./dev.db' }
        };
      }

      if (engine === 'postgresql' || engine === 'postgres') {
        return {
          engine: 'postgresql',
          serviceContainer: {
            name: 'postgres',
            image: 'postgres:16-alpine',
            env: {
              POSTGRES_DB: 'testdb',
              POSTGRES_USER: 'testuser',
              POSTGRES_PASSWORD: 'testpassword'
            },
            ports: ['5432:5432'],
            options: '--health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5'
          },
          migrationCommand: scripts['db:migrate'] ? 'npm run db:migrate' : (scripts['migrate'] ? 'npm run migrate' : null),
          env: { DATABASE_URL: 'postgresql://testuser:testpassword@localhost:5432/testdb' }
        };
      }

      if (engine === 'mysql') {
        return {
          engine: 'mysql',
          serviceContainer: {
            name: 'mysql',
            image: 'mysql:8.0',
            env: {
              MYSQL_DATABASE: 'testdb',
              MYSQL_USER: 'testuser',
              MYSQL_PASSWORD: 'testpassword',
              MYSQL_ROOT_PASSWORD: 'testpassword'
            },
            ports: ['3306:3306'],
            options: '--health-cmd "mysqladmin ping -ptestpassword" --health-interval 10s --health-timeout 5s --health-retries 5'
          },
          migrationCommand: scripts['db:migrate'] ? 'npm run db:migrate' : (scripts['migrate'] ? 'npm run migrate' : null),
          env: { DATABASE_URL: 'mysql://testuser:testpassword@localhost:3306/testdb' }
        };
      }
    }

    // 2. Ambiguity check: if pg or mysql2 is in dependencies but no DB config provided
    if (allDeps['pg'] && !dbConfig) {
      // Driver present without schema metadata -> flag ambiguity if migrations requested
      if (plan.stages.databaseMigration) {
        const err = new Error('PostgreSQL driver detected but no verified Phase 4B database schema or engine configuration provided.');
        err.code = 'AMBIGUOUS_DATABASE_CONFIGURATION';
        throw err;
      }
    }

    return null;
  }
}

module.exports = {
  PipelineSynthesizer
};
