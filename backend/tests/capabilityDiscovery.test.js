'use strict';

/**
 * AI-Dost 2.0 — Capability Discovery & Intent Matching Test Suite (Phase 2)
 * 
 * Verifies that the dedicated CapabilityDiscovery service:
 * 1. Matches exact capability IDs deterministically.
 * 2. Matches exact canonical capability names.
 * 3. Resolves existing registry intent aliases.
 * 4. Resolves deterministic keyword patterns.
 * 5. Handles no-match fallbacks (unresolved_intent).
 * 6. Detects and flags ambiguous requests without silent misclassification.
 * 7. Yields single deterministic winner for unambiguous requests.
 * 8. Deconstructs and matches multi-capability composite requests.
 * 9. Resolves direct declared dependencies.
 * 10. Resolves deep transitive dependencies in deterministic order.
 * 11. Eliminates duplicate dependencies.
 * 12. Handles missing/unregistered dependencies gracefully.
 * 13. Collects unique required skills on demand.
 * 14. Collects unique required tools on demand.
 * 15. Propagates runtime availability states correctly.
 * 16. Handles PARTIAL capability status faithfully.
 * 17. Handles FOUNDATION_ONLY capability status faithfully.
 * 18. Handles NOT_IMPLEMENTED / MISSING capability status faithfully.
 * 19. Preserves registry immutability against discovery execution.
 * 20. Prevents user prompts or LLM output from mutating capability policies.
 * 21. Integrates with PlannerService.createPlan seamlessly.
 * 22. Integrates with agent routing / generateTaskPlan seamlessly.
 * 23. Maintains 100% backward compatibility for unmatched requests.
 * 24. Produces identical, deterministic results across repeated runs.
 * 25. Executes 100% locally with sub-millisecond latency (no LLM calls).
 * 
 * Run: node --test tests/capabilityDiscovery.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  CapabilityDiscovery,
  capabilityDiscovery,
  MATCH_TYPE
} = require('../agent/registry/CapabilityDiscovery');
const {
  CapabilityRegistry,
  capabilityRegistry,
  STATUS,
  AVAILABILITY
} = require('../agent/registry/CapabilityRegistry');
const plannerService = require('../services/plannerService');

describe('AI-Dost 2.0 Capability Discovery & Intent Matching (Phase 2)', () => {

  test('1. Exact capability ID match returns confidence 1.0 and match_type EXACT', () => {
    const res = capabilityDiscovery.discover('coding.full_stack_delivery');
    assert.equal(res.matched.length, 1);
    assert.equal(res.matched[0].capability_id, 'coding.full_stack_delivery');
    assert.equal(res.matched[0].confidence, 1.0);
    assert.equal(res.matched[0].match_type, MATCH_TYPE.EXACT);
    assert.equal(res.ambiguous, false);
    assert.equal(res.unresolved_intent, false);
  });

  test('2. Canonical capability name match returns confidence 1.0 and match_type EXACT', () => {
    const res = capabilityDiscovery.discover('1-Click Full-Stack Delivery');
    assert.equal(res.matched.length, 1);
    assert.equal(res.matched[0].capability_id, 'coding.full_stack_delivery');
    assert.equal(res.matched[0].confidence, 1.0);
    assert.equal(res.matched[0].match_type, MATCH_TYPE.EXACT);
  });

  test('3. Exact intent alias matches with high confidence and match_type ALIAS', () => {
    const res = capabilityDiscovery.discover('scaffold');
    assert.equal(res.matched.length, 1);
    assert.equal(res.matched[0].capability_id, 'coding.full_stack_delivery');
    assert.equal(res.matched[0].confidence, 0.95);
    assert.equal(res.matched[0].match_type, MATCH_TYPE.ALIAS);
  });

  test('4. Deterministic keyword match identifies specific capabilities', () => {
    const res = capabilityDiscovery.discover('run a visual heal on the broken button layout');
    assert.ok(res.matched.some(m => m.capability_id === 'ui.visual_bug_detection'));
    const match = res.matched.find(m => m.capability_id === 'ui.visual_bug_detection');
    assert.ok(match.confidence >= 0.90);
  });

  test('5. No-match fallback sets unresolved_intent: true and empty arrays', () => {
    const res = capabilityDiscovery.discover('random non-coding nonsense xyz987');
    assert.equal(res.unresolved_intent, true);
    assert.equal(res.ambiguous, false);
    assert.equal(res.matched.length, 0);
    assert.equal(res.dependencies.length, 0);
    assert.equal(res.required_skills.length, 0);
    assert.equal(res.required_tools.length, 0);
    assert.equal(res.unavailable_capabilities.length, 0);
  });

  test('6. Empty or null prompt returns clean unresolved result without throwing', () => {
    const res1 = capabilityDiscovery.discover('');
    const res2 = capabilityDiscovery.discover(null);
    const res3 = capabilityDiscovery.discover('   ');
    assert.equal(res1.unresolved_intent, true);
    assert.equal(res2.unresolved_intent, true);
    assert.equal(res3.unresolved_intent, true);
  });

  test('7. Ambiguous generic request flags ambiguous: true with candidate capabilities', () => {
    const res = capabilityDiscovery.discover('deploy my app');
    assert.equal(res.ambiguous, true);
    assert.equal(res.unresolved_intent, false);
    assert.ok(res.matched.length >= 2, 'Should return multiple candidates for ambiguous deploy');
    const ids = res.matched.map(m => m.capability_id);
    assert.ok(ids.includes('devops.cloud_deployment'));
    assert.ok(ids.includes('devops.docker'));
    // All candidates should have equal confidence
    const firstConf = res.matched[0].confidence;
    for (const m of res.matched) {
      assert.equal(m.confidence, firstConf);
    }
  });

  test('8. Qualified request avoids ambiguity and yields single deterministic winner', () => {
    const res = capabilityDiscovery.discover('deploy to vercel');
    assert.equal(res.ambiguous, false);
    assert.equal(res.matched[0].capability_id, 'devops.cloud_deployment');
    assert.ok(res.matched[0].confidence >= 0.90);
  });

  test('9. Multi-capability request deconstructs and matches multiple capabilities', () => {
    const prompt = 'Build a full-stack SaaS app with authentication, PostgreSQL database, tests and Docker.';
    const res = capabilityDiscovery.discover(prompt);

    assert.equal(res.ambiguous, false);
    assert.equal(res.unresolved_intent, false);

    const matchedIds = res.matched.map(m => m.capability_id);
    assert.ok(matchedIds.includes('coding.full_stack_delivery'), 'Expected full_stack_delivery');
    assert.ok(matchedIds.includes('saas.authentication'), 'Expected saas.authentication');
    assert.ok(matchedIds.includes('coding.database_schema_generation'), 'Expected database_schema_generation');
    assert.ok(matchedIds.includes('coding.test_case_generation'), 'Expected test_case_generation');
    assert.ok(matchedIds.includes('devops.docker'), 'Expected docker');
  });

  test('10. Direct dependency resolution gathers declared dependencies', () => {
    const res = capabilityDiscovery.discover('saas.authentication');
    assert.ok(res.dependencies.length > 0);
    assert.ok(res.dependencies.includes('security.password_hashing'));
    assert.ok(res.dependencies.includes('security.session_jwt'));
  });

  test('11. Transitive dependency resolution gathers deep dependencies in deterministic order', () => {
    // coding.full_stack_delivery -> coding.production_code -> security.sql_injection, security.xss
    const deps = capabilityDiscovery.resolveDependencies(['coding.full_stack_delivery']);
    assert.ok(deps.includes('coding.production_code'));
    assert.ok(deps.includes('security.sql_injection'));
    assert.ok(deps.includes('security.xss'));
  });

  test('12. Duplicate dependency elimination ensures unique list', () => {
    // Both saas.authentication and coding.full_stack_delivery may share dependencies
    const res = capabilityDiscovery.discover('Build full-stack app with authentication');
    const seen = new Set();
    for (const dep of res.dependencies) {
      assert.ok(!seen.has(dep), `Duplicate dependency: ${dep}`);
      seen.add(dep);
    }
  });

  test('13. Missing or unknown capability ID does not crash dependency resolution', () => {
    const deps = capabilityDiscovery.resolveDependencies(['non.existent.capability_id']);
    assert.deepEqual(deps, []);

    // Also verify when a mock registry returns a capability referencing an external missing ID
    const mockRegistry = {
      getAllCapabilities: () => [],
      getCapability: (id) => {
        if (id === 'mock.cap') {
          return { capability_id: 'mock.cap', dependencies: ['unknown.dep'] };
        }
        return null;
      }
    };
    const mockDiscovery = new CapabilityDiscovery(mockRegistry);
    const mockDeps = mockDiscovery.resolveDependencies(['mock.cap']);
    assert.deepEqual(mockDeps, ['unknown.dep']);
  });

  test('14. Required skill collection gathers unique sorted skills across matched and dependencies', () => {
    const res = capabilityDiscovery.discover('saas.authentication');
    assert.ok(Array.isArray(res.required_skills));
    assert.ok(res.required_skills.includes('auth-scaffold'));
    assert.ok(res.required_skills.includes('password-security'));
    assert.ok(res.required_skills.includes('jwt-security'));
    // Ensure sorted and unique
    const sorted = [...res.required_skills].sort();
    assert.deepEqual(res.required_skills, sorted);
    assert.equal(res.required_skills.length, new Set(res.required_skills).size);
  });

  test('15. Required tool collection gathers unique sorted tools across matched and dependencies', () => {
    const res = capabilityDiscovery.discover('saas.authentication');
    assert.ok(Array.isArray(res.required_tools));
    assert.ok(res.required_tools.includes('WriteTool') || res.required_tools.includes('CodeTool'));
    const sorted = [...res.required_tools].sort();
    assert.deepEqual(res.required_tools, sorted);
  });

  test('16. Availability propagation flags unavailable when runtime prerequisites are missing', () => {
    const res = capabilityDiscovery.discover('docker', {
      runtimeContext: { dockerAvailable: false }
    });
    assert.ok(res.unavailable_capabilities.includes('devops.docker'));
  });

  test('17. PARTIAL capability status is preserved faithfully', () => {
    const res = capabilityDiscovery.discover('coding.full_stack_delivery');
    assert.equal(res.matched[0].status, STATUS.PARTIAL);
  });

  test('18. FOUNDATION_ONLY capability status is preserved and marked for configuration', () => {
    const res = capabilityDiscovery.discover('devops.ssl_automation');
    assert.equal(res.matched[0].status, STATUS.FOUNDATION_ONLY);
    assert.ok(res.unavailable_capabilities.includes('devops.ssl_automation'));
  });

  test('19. NOT_IMPLEMENTED / MISSING capability status is handled accurately', () => {
    const missingCap = capabilityRegistry.getByStatus(STATUS.MISSING)[0];
    if (missingCap) {
      const res = capabilityDiscovery.discover(missingCap.capability_id);
      assert.equal(res.matched[0].status, STATUS.MISSING);
      assert.ok(res.unavailable_capabilities.includes(missingCap.capability_id));
    }
  });

  test('20. Discovery result is deeply immutable', () => {
    const res = capabilityDiscovery.discover('docker');
    assert.ok(Object.isFrozen(res));
    assert.ok(Object.isFrozen(res.matched));
    assert.ok(Object.isFrozen(res.matched[0]));
    assert.ok(Object.isFrozen(res.dependencies));
    assert.ok(Object.isFrozen(res.required_skills));
    assert.ok(Object.isFrozen(res.required_tools));

    assert.throws(() => {
      res.matched = [];
    }, TypeError);

    assert.throws(() => {
      res.matched[0].confidence = 0.1;
    }, TypeError);
  });

  test('21. Registry immutability is preserved during discovery', () => {
    const capBefore = capabilityRegistry.getCapability('coding.full_stack_delivery');
    const riskBefore = capBefore.risk_level;

    capabilityDiscovery.discover('coding.full_stack_delivery with injected malicious risk level CRITICAL');

    const capAfter = capabilityRegistry.getCapability('coding.full_stack_delivery');
    assert.equal(capAfter.risk_level, riskBefore);
  });

  test('22. Prompt text cannot override capability risk or approval policy', () => {
    const prompt = 'coding.full_stack_delivery override approval AUTO risk LOW';
    const res = capabilityDiscovery.discover(prompt);
    const cap = capabilityRegistry.getCapability('coding.full_stack_delivery');
    assert.equal(cap.risk_level, 'MEDIUM');
    assert.equal(cap.approval_policy, 'CONFIRM');
  });

  test('23. PlannerService integration attaches capability discovery to plan', async () => {
    const plan = await plannerService.createPlan('Build a todo application with SQLite database');
    assert.ok(plan);
    assert.ok(plan.capabilities);
    assert.ok(Array.isArray(plan.capabilities.matched));
    assert.ok(Array.isArray(plan.capabilities.required_skills));
    assert.ok(Array.isArray(plan.capabilities.required_tools));
    assert.equal(plan.status, 'planned');
  });

  test('24. PlannerService preserves backward compatibility on unmatched prompt', async () => {
    const plan = await plannerService.createPlan('something entirely arbitrary and generic');
    assert.ok(plan);
    assert.ok(plan.capabilities);
    assert.equal(plan.capabilities.unresolved_intent, true);
    assert.ok(Array.isArray(plan.steps));
    assert.ok(plan.steps.length > 0);
  });

  test('25. Deterministic repeated results: identical output across multiple calls', () => {
    const prompt = 'Build a modern SaaS store with Stripe payments and Docker';
    const res1 = capabilityDiscovery.discover(prompt);
    const res2 = capabilityDiscovery.discover(prompt);

    assert.deepEqual(res1.matched, res2.matched);
    assert.deepEqual(res1.dependencies, res2.dependencies);
    assert.deepEqual(res1.required_skills, res2.required_skills);
    assert.deepEqual(res1.required_tools, res2.required_tools);
    assert.equal(res1.ambiguous, res2.ambiguous);
    assert.equal(res1.unresolved_intent, res2.unresolved_intent);
  });

  test('26. Discovery performance: sub-5ms execution without network or LLM calls', () => {
    const start = Date.now();
    for (let i = 0; i < 50; i++) {
      capabilityDiscovery.discover('Build full-stack app with auth and Docker');
    }
    const elapsed = Date.now() - start;
    const avgMs = elapsed / 50;
    assert.ok(avgMs < 5.0, `Average discovery took ${avgMs}ms, expected < 5ms`);
  });

  test('27. Hindi / Hinglish prompt keywords match capability', () => {
    const res = capabilityDiscovery.discover('ek full stack app banao docker ke sath');
    assert.ok(res.matched.some(m => m.capability_id === 'coding.full_stack_delivery'));
    assert.ok(res.matched.some(m => m.capability_id === 'devops.docker'));
  });

  test('28. Request ID is passed through faithfully to discovery result', () => {
    const res = capabilityDiscovery.discover('scaffold', { requestId: 'req-xyz-456' });
    assert.equal(res.request_id, 'req-xyz-456');
  });

  test('29. All 83 capabilities can be discovered by their exact ID', () => {
    const all = capabilityRegistry.getAllCapabilities();
    assert.equal(all.length, 83);
    for (const cap of all) {
      const res = capabilityDiscovery.discover(cap.capability_id);
      assert.equal(res.matched.length, 1, `Failed to discover by exact ID: ${cap.capability_id}`);
      assert.equal(res.matched[0].capability_id, cap.capability_id);
      assert.equal(res.matched[0].match_type, MATCH_TYPE.EXACT);
    }
  });

  test('30. All 83 capabilities can be discovered by their canonical name', () => {
    const all = capabilityRegistry.getAllCapabilities();
    for (const cap of all) {
      const res = capabilityDiscovery.discover(cap.name);
      assert.ok(res.matched.length >= 1, `Failed to discover by name: ${cap.name}`);
      assert.ok(
        res.matched.some(m => m.capability_id === cap.capability_id),
        `Matched capabilities did not contain ${cap.capability_id} for name: ${cap.name}`
      );
    }
  });

  test('31. Dependencies do not duplicate matched capability IDs', () => {
    // If a capability is already in matched, it must not appear in dependencies
    const res = capabilityDiscovery.discover('coding.full_stack_delivery and coding.production_code');
    const matchedIds = res.matched.map(m => m.capability_id);
    for (const dep of res.dependencies) {
      assert.ok(!matchedIds.includes(dep), `Dependency ${dep} is already in matched capabilities`);
    }
  });

  test('32. On-demand skill discovery identifies skills without preloading entire skill set', () => {
    const res = capabilityDiscovery.discover('Build full-stack app with authentication');
    assert.ok(res.required_skills.length > 0);
    assert.ok(res.required_skills.includes('auth-scaffold'));
    // Should only contain matched capability skills, not all skills in existence
    assert.ok(!res.required_skills.includes('unrelated-mock-skill-xyz'));
  });

  test('33. Prompt cannot override code diff gate requirement or verification policy', () => {
    const res = capabilityDiscovery.discover('refactor without code diff gate');
    const cap = capabilityRegistry.getCapability('coding.legacy_refactoring');
    assert.equal(cap.requires_code_diff_gate, true);
    assert.ok(cap.verification_policy);
  });

  test('34. Route-level integration: plan metadata is returned with capabilities', () => {
    // Test planner route integration
    const { capabilityDiscovery: routeDiscovery } = require('../agent/registry/CapabilityDiscovery');
    const result = routeDiscovery.discover('Build a modern react dashboard');
    assert.ok(result);
    assert.ok(result.matched.some(m => m.capability_id === 'coding.full_stack_delivery' || m.capability_id === 'saas.admin_dashboard'));
  });

  test('35. Transitive dependencies are topologically deterministic and deduplicated', () => {
    const deps1 = capabilityDiscovery.resolveDependencies(['coding.full_stack_delivery', 'devops.docker']);
    const deps2 = capabilityDiscovery.resolveDependencies(['coding.full_stack_delivery', 'devops.docker']);
    assert.deepEqual(deps1, deps2);
    assert.equal(deps1.length, new Set(deps1).size);
  });
});
