'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AgentOrchestrator = require('../agent/orchestrator');

test('Orchestrator Centralized Production Security Boundary', async (t) => {
  const tempWs = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-sec-ws-'));

  await t.test('blocks execution and throws CAPABILITY_BLOCKED when gatekeeper blocks', async () => {
    const events = [];
    const gatekeeper = {
      evaluate() {
        return { decision: 'BLOCK', capabilities: [{ id: 'coding.production_code', reason: 'Blocked by test policy' }] };
      }
    };
    const orchestrator = new AgentOrchestrator({
      projectPath: tempWs,
      gatekeeper,
      audit: {
        record(e) { events.push(e); }
      }
    });

    const res = await orchestrator.executeTool('write_file', {
      path: 'malicious.js',
      content: 'console.log("danger");'
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'CAPABILITY_BLOCKED');
    assert.match(res.error, /blocked by capability policy/i);
    assert.strictEqual(fs.existsSync(path.join(tempWs, 'malicious.js')), false);
  });

  await t.test('enforces approval token requirement for restricted operations', async () => {
    const gatekeeper = {
      evaluate() {
        return { decision: 'REQUIRE_EXPLICIT_APPROVAL', approval_token: 'valid-token' };
      },
      validateApproval({ token }) {
        return { valid: token === 'approved-token-123' };
      }
    };
    const orchestrator = new AgentOrchestrator({
      projectPath: tempWs,
      gatekeeper
    });

    // 1. Without token -> APPROVAL_REQUIRED
    const rejected = await orchestrator.executeTool('write_file', {
      path: 'approved.js',
      content: 'console.log("pending");'
    });
    assert.strictEqual(rejected.success, false);
    assert.strictEqual(rejected.code, 'APPROVAL_REQUIRED');

    // 2. With valid token -> succeeds
    const approved = await orchestrator.executeTool('write_file', {
      path: 'approved.js',
      content: 'console.log("approved");',
      approvalToken: 'approved-token-123'
    });
    assert.strictEqual(approved.success, true);
    assert.strictEqual(fs.existsSync(path.join(tempWs, 'approved.js')), true);
  });

  await t.test('emits audit events for successful and blocked operations', async () => {
    const auditEvents = [];
    const auditSink = {
      record(event) {
        auditEvents.push(event);
      }
    };

    const orchestrator = new AgentOrchestrator({
      projectPath: tempWs,
      audit: auditSink
    });

    const res = await orchestrator.executeTool('read_file', { path: 'approved.js' });
    assert.strictEqual(res.success, true);
    assert.ok(auditEvents.length > 0);
    assert.ok(auditEvents.some(e => e.type === 'execution.completed'));
  });

  await t.test('rejects inputs exceeding input limits', async () => {
    const orchestrator = new AgentOrchestrator({
      projectPath: tempWs,
      limits: {
        maxInputBytes: 50
      }
    });

    const oversized = await orchestrator.executeTool('write_file', {
      path: 'large.js',
      content: 'A'.repeat(500)
    });

    assert.strictEqual(oversized.success, false);
    assert.strictEqual(oversized.code, 'INPUT_TOO_LARGE');
  });
});
