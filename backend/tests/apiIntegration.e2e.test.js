'use strict';

/**
 * AI-Dost 2.0 — Phase 4D: Real E2E Verification & Hardening Gate
 * 
 * Executes real isolated workflows in sandbox fixture workspaces:
 * 1. Real Express fixture -> OpenAPI 3.0.3 generation -> Client SDK generation
 * 2. Generated mock client roundtrip with runtime contract validation
 * 3. Contract-breaking route change -> drift detection
 * 4. Multi-file staging failure -> complete ACID transaction rollback
 * 5. Deterministic repeated generation & user-authored file preservation
 * 6. Gatekeeper confirmation & token-guarded commit
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  ApiIntegrationPlan,
  OpenApiGenerator,
  ApiClientGenerator,
  ContractValidatorGenerator,
  MockAdapterGenerator,
  ContractDriftDetector,
  generateApiIntegration
} = require('../agent/capabilities/apiIntegration');

const { TransactionManager } = require('../services/transactionManager');
const { capabilityGatekeeper } = require('../agent/policy/CapabilityGatekeeper');

const FIXTURES_DIR = path.resolve(__dirname, '../temp/test-fixtures/api-integration-e2e');

describe('AI-Dost 2.0 — Phase 4D Real E2E Gate & Hardening', () => {

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
  // E2E 1: REAL EXPRESS FIXTURE -> OPENAPI -> CLIENT
  // ==========================================
  test('E2E 1: Real Express fixture -> OpenAPI 3.0.3 generation -> Client SDK generation', async () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'e2e-1-express');
    fs.mkdirSync(fixtureDir, { recursive: true });

    // 1. Create real Express routes fixture file
    const routesContent = `
const express = require('express');
const router = express.Router();

router.get('/items', (req, res) => {
  res.json([{ id: 1, name: 'Widget' }]);
});

router.post('/items', (req, res) => {
  res.status(201).json({ id: 2, name: req.body.name });
});

router.get('/items/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Widget' });
});

router.delete('/items/:id', (req, res) => {
  res.status(204).end();
});

module.exports = router;
`;
    const routesFilePath = path.join(fixtureDir, 'routes.js');
    fs.writeFileSync(routesFilePath, routesContent, 'utf8');

    // 2. Plan and generate API integration
    const plan = new ApiIntegrationPlan({
      projectId: 'e2e_express_fixture',
      workspacePath: fixtureDir,
      routeFiles: [routesFilePath],
      clientOutputDir: 'services/api',
      openapiOutputDir: 'docs'
    });

    const result = await generateApiIntegration(plan);

    assert.equal(result.ok, true);
    assert.ok(result.files.length >= 4);

    // 3. Write generated files to isolated disk workspace
    for (const file of result.files) {
      const absPath = path.join(fixtureDir, file.path);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, file.content, 'utf8');
      assert.ok(fs.existsSync(absPath), `File must exist: ${absPath}`);
    }

    // 4. Verify OpenAPI structure on disk
    const openapiPath = path.join(fixtureDir, 'docs/openapi.json');
    const parsedOpenApi = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));

    assert.equal(parsedOpenApi.openapi, '3.0.3');
    assert.ok(parsedOpenApi.paths['/items']);
    assert.ok(parsedOpenApi.paths['/items'].get);
    assert.ok(parsedOpenApi.paths['/items'].post);
    assert.ok(parsedOpenApi.paths['/items/{id}'].get);
    assert.ok(parsedOpenApi.paths['/items/{id}'].delete);
  });

  // ==========================================
  // E2E 2: GENERATED MOCK CLIENT ROUNDTRIP & VALIDATION
  // ==========================================
  test('E2E 2: Generated mock client roundtrip with runtime contract validation', async () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'e2e-2-mock');
    fs.mkdirSync(fixtureDir, { recursive: true });

    const plan = new ApiIntegrationPlan({
      projectId: 'mock_roundtrip_app',
      workspacePath: fixtureDir,
      routeDescriptors: [
        { method: 'get', path: '/api/tasks', resourceName: 'tasks', summary: 'List Tasks' },
        { method: 'post', path: '/api/tasks', resourceName: 'tasks', summary: 'Create Task', hasRequestBody: true },
        { method: 'get', path: '/api/tasks/:id', resourceName: 'tasks', summary: 'Get Task' }
      ],
      schemaMetadata: {
        tables: [
          {
            name: 'tasks',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true },
              { name: 'title', type: 'VARCHAR', required: true },
              { name: 'completed', type: 'BOOLEAN' }
            ]
          }
        ]
      }
    });

    const result = await generateApiIntegration(plan);
    assert.equal(result.ok, true);

    const spec = result.openapiSpec;
    const validatorCode = ContractValidatorGenerator.generateJsValidators(spec);
    const mockCode = MockAdapterGenerator.generateMockClient(spec, plan);

    // Write to fixture directory
    fs.writeFileSync(path.join(fixtureDir, 'validators.js'), validatorCode, 'utf8');
    fs.writeFileSync(path.join(fixtureDir, 'mockClient.js'), mockCode, 'utf8');

    // Dynamic execution of validation logic
    const { validate } = require(path.join(fixtureDir, 'validators.js'));
    
    // Valid payload
    const validRes = validate('Task', { id: 1, title: 'Buy Groceries', completed: false });
    assert.equal(validRes.valid, true);
    assert.equal(validRes.errors.length, 0);

    // Invalid payload (missing required title)
    const invalidRes = validate('Task', { id: 2, completed: true });
    assert.equal(invalidRes.valid, false);
    assert.ok(invalidRes.errors.some(e => e.includes('Missing required field: "title"')));

    // Prototype pollution attack payload
    const maliciousPayload = JSON.parse('{"id": 3, "title": "Hack", "__proto__": {"polluted": true}}');
    const attackRes = validate('Task', maliciousPayload);
    assert.equal(attackRes.valid, false);
    assert.ok(attackRes.errors.some(e => e.includes('Forbidden security attribute')));
  });

  // ==========================================
  // E2E 3: CONTRACT-BREAKING ROUTE CHANGE -> DRIFT
  // ==========================================
  test('E2E 3: Contract-breaking route change -> structured drift detection', () => {
    const originalSpec = {
      openapi: '3.0.3',
      info: { title: 'Stable API', version: '1.0.0' },
      paths: {
        '/api/orders': {
          get: { operationId: 'getOrders', responses: { '200': {} } },
          post: { operationId: 'createOrder', responses: { '201': {} } }
        },
        '/api/orders/{id}': {
          get: { operationId: 'getOrderById', responses: { '200': {} } }
        }
      },
      components: {
        schemas: {
          Order: {
            type: 'object',
            required: ['id', 'amount'],
            properties: { id: { type: 'integer' }, amount: { type: 'number' } }
          }
        }
      }
    };

    // Modified spec: POST endpoint deleted, Order schema removed 'amount' and added required 'taxId'
    const breakingSpec = {
      openapi: '3.0.3',
      info: { title: 'Modified API', version: '2.0.0' },
      paths: {
        '/api/orders': {
          get: { operationId: 'getOrders', responses: { '200': {} } }
          // POST /api/orders removed
        },
        '/api/orders/{id}': {
          get: {
            operationId: 'getOrderById',
            parameters: [{ name: 'tenantId', in: 'query', required: true }], // New required query param
            responses: { '200': {} }
          }
        }
      },
      components: {
        schemas: {
          Order: {
            type: 'object',
            required: ['id', 'taxId'], // 'taxId' added as required
            properties: { id: { type: 'integer' }, taxId: { type: 'string' } } // 'amount' removed
          }
        }
      }
    };

    const drift = ContractDriftDetector.detectDrift(originalSpec, breakingSpec);

    assert.equal(drift.hasDrift, true);
    assert.equal(drift.isBreaking, true);
    assert.ok(drift.changes.some(c => c.type === 'REMOVED_METHOD' && c.method === 'POST'));
    assert.ok(drift.changes.some(c => c.type === 'ADDED_REQUIRED_QUERY_PARAMETER'));
    assert.ok(drift.changes.some(c => c.type === 'REMOVED_FIELD' && c.field === 'amount'));
    assert.ok(drift.changes.some(c => c.type === 'ADDED_REQUIRED_FIELD' && c.field === 'taxId'));
  });

  // ==========================================
  // E2E 4: MULTI-FILE STAGING FAILURE -> ACID ROLLBACK
  // ==========================================
  test('E2E 4: Multi-file staging failure -> complete ACID transaction rollback', async () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'e2e-4-rollback');
    fs.mkdirSync(fixtureDir, { recursive: true });

    // Existing pre-condition user file
    const existingFilePath = path.join(fixtureDir, 'README.md');
    fs.writeFileSync(existingFilePath, '# Pre-existing Project Document\n', 'utf8');

    const tm = new TransactionManager();
    const txId = 'tx_e2e_rollback_test';
    const tx = tm.beginTransaction(txId, fixtureDir, 'FullStackDelivery');

    // Stage generated API files
    tm.stageNewFile(tx.id, { path: 'docs/openapi.json', content: '{"openapi": "3.0.3"}' });
    tm.stageNewFile(tx.id, { path: 'services/api/apiClient.js', content: '// api client' });

    // Verify staged files are not yet in workspace
    assert.equal(fs.existsSync(path.join(fixtureDir, 'docs/openapi.json')), false);
    assert.equal(fs.existsSync(path.join(fixtureDir, 'services/api/apiClient.js')), false);

    // Simulate unexpected failure before commit -> Trigger rollback
    const rollbackRes = tm.rollback(tx.id);
    assert.equal(rollbackRes.success, true);

    // Verify zero leftover files and pre-existing file preserved
    assert.equal(fs.existsSync(path.join(fixtureDir, 'docs/openapi.json')), false);
    assert.equal(fs.existsSync(path.join(fixtureDir, 'services/api/apiClient.js')), false);
    assert.equal(fs.existsSync(existingFilePath), true);
    assert.equal(fs.readFileSync(existingFilePath, 'utf8'), '# Pre-existing Project Document\n');
  });

  // ==========================================
  // E2E 5: DETERMINISTIC GENERATION & REPEATABILITY
  // ==========================================
  test('E2E 5: Deterministic repeated generation produces bit-for-bit identical checksums', async () => {
    const planConfig = {
      projectId: 'deterministic_app',
      routeDescriptors: [
        { method: 'get', path: '/api/v1/users', resourceName: 'users', summary: 'List Users' },
        { method: 'post', path: '/api/v1/users', resourceName: 'users', summary: 'Create User', hasRequestBody: true },
        { method: 'get', path: '/api/v1/users/:id', resourceName: 'users', summary: 'Get User' }
      ]
    };

    const res1 = await generateApiIntegration(new ApiIntegrationPlan(planConfig));
    const res2 = await generateApiIntegration(new ApiIntegrationPlan(planConfig));

    assert.equal(res1.ok, true);
    assert.equal(res2.ok, true);
    assert.equal(res1.contractChecksum, res2.contractChecksum);

    for (let i = 0; i < res1.files.length; i++) {
      assert.equal(res1.files[i].path, res2.files[i].path);
      assert.equal(res1.files[i].checksum, res2.files[i].checksum);
      assert.equal(res1.files[i].content, res2.files[i].content);
    }
  });

  // ==========================================
  // E2E 6: GATEKEEPER APPROVAL ENFORCEMENT
  // ==========================================
  test('E2E 6: CapabilityGatekeeper enforces CONFIRM policy and token-guarded access', () => {
    const gateRes = capabilityGatekeeper.evaluate('coding.api_integration', {
      requestId: 'req_e2e_gate',
      planId: 'plan_e2e_gate',
      permissions: ['workspace:write']
    });

    assert.equal(gateRes.decision, 'REQUIRE_CONFIRMATION');
    assert.ok(gateRes.approval_token);

    const validCheck = capabilityGatekeeper.validateApproval({
      token: gateRes.approval_token,
      requestId: 'req_e2e_gate',
      planId: 'plan_e2e_gate',
      capabilityIds: ['coding.api_integration']
    });

    assert.equal(validCheck.valid, true);

    // Tampered token must be rejected
    const tamperedCheck = capabilityGatekeeper.validateApproval({
      token: 'tampered_token_ffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      requestId: 'req_e2e_gate',
      planId: 'plan_e2e_gate',
      capabilityIds: ['coding.api_integration']
    });

    assert.equal(tamperedCheck.valid, false);
  });

  // ==========================================
  // E2E 7: REAL LOCAL HTTP ROUNDTRIP & RUNTIME VALIDATION
  // ==========================================
  test('E2E 7: Real local HTTP roundtrip on dynamic localhost port with runtime contract validation', async () => {
    const fixtureDir = path.join(FIXTURES_DIR, 'e2e-7-http-roundtrip');
    fs.mkdirSync(fixtureDir, { recursive: true });

    const express = require('express');
    const http = require('http');
    const { pathToFileURL } = require('url');

    const app = express();
    app.use(express.json());

    // Express fixture endpoints
    app.get('/api/products', (req, res) => {
      res.json({ id: 101, name: 'Precision Caliper', price: 49.95 });
    });

    app.get('/api/products/invalid', (req, res) => {
      // Intentionally returns invalid types violating the OpenAPI contract
      res.json({ id: 'not-an-integer-id', name: 12345, price: 'not-a-number' });
    });

    app.post('/api/products', (req, res) => {
      res.status(201).json({ id: 102, name: req.body.name, price: req.body.price });
    });

    // Start Express server on dynamic localhost port
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const dynamicBaseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. Generate OpenAPI 3.0.3 specification
      const plan = new ApiIntegrationPlan({
        projectId: 'product_catalog_app',
        workspacePath: fixtureDir,
        baseUrl: dynamicBaseUrl,
        routeDescriptors: [
          { method: 'get', path: '/api/products', resourceName: 'products', summary: 'Get Product' },
          { method: 'post', path: '/api/products', resourceName: 'products', summary: 'Create Product', hasRequestBody: true }
        ],
        schemaMetadata: {
          tables: [
            {
              name: 'products',
              columns: [
                { name: 'id', type: 'INTEGER', primaryKey: true },
                { name: 'name', type: 'VARCHAR', required: true },
                { name: 'price', type: 'FLOAT', required: true }
              ]
            }
          ]
        }
      });

      const result = await generateApiIntegration(plan);
      assert.equal(result.ok, true);

      // 2. Write client and validator to ESM fixture files
      const clientFilePath = path.join(fixtureDir, 'apiClient.mjs');
      const validatorFilePath = path.join(fixtureDir, 'validators.mjs');

      fs.writeFileSync(clientFilePath, ApiClientGenerator.generateFetchClient(result.openapiSpec, plan), 'utf8');
      fs.writeFileSync(validatorFilePath, ContractValidatorGenerator.generateJsValidators(result.openapiSpec), 'utf8');

      // 3. Dynamically import generated client and validator
      const { ApiClient } = await import(pathToFileURL(clientFilePath).href);
      const { validate } = await import(pathToFileURL(validatorFilePath).href);

      const client = new ApiClient({ baseUrl: dynamicBaseUrl, timeoutMs: 5000 });

      // 4. Test Success HTTP roundtrip
      const successData = await client.getProduct();
      assert.equal(successData.id, 101);
      assert.equal(successData.name, 'Precision Caliper');

      // Validate success response against contract
      const successValidation = validate('Product', successData);
      assert.equal(successValidation.valid, true);
      assert.equal(successValidation.errors.length, 0);

      // 5. Test Validation-Failure HTTP roundtrip
      const invalidData = await client._request('GET', '/api/products/invalid');
      const failureValidation = validate('Product', invalidData);
      assert.equal(failureValidation.valid, false);
      assert.ok(failureValidation.errors.length >= 2);
      assert.ok(failureValidation.errors.some(e => e.includes('must be an integer')));
      assert.ok(failureValidation.errors.some(e => e.includes('must be a string')));

    } finally {
      // Cleanly shut down HTTP server
      await new Promise((resolve) => server.close(resolve));
    }
  });

});

