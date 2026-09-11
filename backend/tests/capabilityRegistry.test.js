'use strict';

/**
 * AI-Dost 2.0 — Capability Registry Test Suite
 * 
 * Verifies that the machine-readable CapabilityRegistry:
 * 1. Loads correctly without error.
 * 2. Registers all 83 canonical capabilities across 9 operational domains.
 * 3. Enforces unique IDs, valid enums, non-empty categories, and structural schemas.
 * 4. Strictly validates dependency graphs without unknown references or circular chains.
 * 5. Binds real implementation modules to IMPLEMENTED capabilities and prevents fake bindings on MISSING.
 * 6. Guarantees runtime immutability (deep freeze).
 * 7. Exposes deterministic intent matching, code diff gate detection, and lightweight availability states.
 * 8. Protects against arbitrary mutation or security bypasses.
 * 
 * Run: node --test tests/capabilityRegistry.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  CapabilityRegistry,
  capabilityRegistry,
  STATUS,
  RISK,
  APPROVAL,
  COST,
  CATEGORIES,
  AVAILABILITY
} = require('../agent/registry/CapabilityRegistry.js');

describe('AI-Dost 2.0 Capability Registry', () => {

  test('1. Registry loads successfully and is an instance of CapabilityRegistry', () => {
    assert.ok(capabilityRegistry);
    assert.ok(capabilityRegistry instanceof CapabilityRegistry);
  });

  test('2. Exactly 83 canonical capabilities are registered', () => {
    const all = capabilityRegistry.getAllCapabilities();
    assert.equal(all.length, 83, `Expected 83 capabilities, got ${all.length}`);
  });

  test('3. Every capability has a unique ID', () => {
    const all = capabilityRegistry.getAllCapabilities();
    const ids = new Set();
    for (const cap of all) {
      assert.ok(cap.capability_id, 'Capability missing capability_id');
      assert.ok(!ids.has(cap.capability_id), `Duplicate ID found: ${cap.capability_id}`);
      ids.add(cap.capability_id);
    }
    assert.equal(ids.size, 83);
  });

  test('4. Every capability has a valid category matching CATEGORIES enum', () => {
    const validCategories = Object.values(CATEGORIES);
    for (const cap of capabilityRegistry.getAllCapabilities()) {
      assert.ok(
        validCategories.includes(cap.category),
        `Invalid category '${cap.category}' on ${cap.capability_id}`
      );
    }
  });

  test('5. Every capability has a valid status matching STATUS enum', () => {
    const validStatuses = Object.values(STATUS);
    for (const cap of capabilityRegistry.getAllCapabilities()) {
      assert.ok(
        validStatuses.includes(cap.status),
        `Invalid status '${cap.status}' on ${cap.capability_id}`
      );
    }
  });

  test('6. Every capability has valid risk metadata matching RISK enum', () => {
    const validRisks = Object.values(RISK);
    for (const cap of capabilityRegistry.getAllCapabilities()) {
      assert.ok(
        validRisks.includes(cap.risk_level),
        `Invalid risk_level '${cap.risk_level}' on ${cap.capability_id}`
      );
    }
  });

  test('7. Every capability has valid approval metadata matching APPROVAL enum', () => {
    const validApprovals = Object.values(APPROVAL);
    for (const cap of capabilityRegistry.getAllCapabilities()) {
      assert.ok(
        validApprovals.includes(cap.approval_policy),
        `Invalid approval_policy '${cap.approval_policy}' on ${cap.capability_id}`
      );
    }
  });

  test('8. Every dependency references an existing registered capability ID', () => {
    for (const cap of capabilityRegistry.getAllCapabilities()) {
      for (const depId of cap.dependencies) {
        assert.ok(
          capabilityRegistry.getCapability(depId) !== null,
          `Capability '${cap.capability_id}' references unknown dependency '${depId}'`
        );
      }
    }
  });

  test('9. No circular dependencies exist across the entire registry', () => {
    // Registry initialization would throw if cycles existed; verify explicit DFS
    for (const cap of capabilityRegistry.getAllCapabilities()) {
      const visited = new Set();
      const stack = new Set();

      const dfs = (id) => {
        visited.add(id);
        stack.add(id);
        const current = capabilityRegistry.getCapability(id);
        for (const dep of current.dependencies) {
          if (!visited.has(dep)) {
            if (dfs(dep)) return true;
          } else if (stack.has(dep)) {
            return true;
          }
        }
        stack.delete(id);
        return false;
      };

      assert.equal(dfs(cap.capability_id), false, `Cycle detected from ${cap.capability_id}`);
    }
  });

  test('10. All IMPLEMENTED capabilities have real implementation service bindings', () => {
    const implemented = capabilityRegistry.getByStatus(STATUS.IMPLEMENTED);
    assert.ok(implemented.length > 0);
    for (const cap of implemented) {
      assert.ok(cap.implementation, `Implemented cap '${cap.capability_id}' missing implementation object`);
      assert.ok(cap.implementation.service, `Implemented cap '${cap.capability_id}' missing implementation.service`);
    }
  });

  test('11. MISSING capabilities do not claim implementation bindings', () => {
    const missing = capabilityRegistry.getByStatus(STATUS.MISSING);
    for (const cap of missing) {
      if (cap.implementation) {
        assert.equal(cap.implementation.service, null);
        assert.equal(cap.implementation.module, null);
      }
    }
  });

  test('12. Invalid capability definition is rejected by validateCapability()', () => {
    const invalidDef = {
      capability_id: 'invalid.test',
      category: 'NON_EXISTENT_CATEGORY',
      status: STATUS.IMPLEMENTED
    };
    const res = capabilityRegistry.validateCapability(invalidDef);
    assert.equal(res.valid, false);
    assert.match(res.error, /invalid category/i);
  });

  test('13. Duplicate capability ID is rejected during initialization', () => {
    const validCap = capabilityRegistry.getCapability('coding.production_code');
    const duplicateList = [validCap, validCap];
    assert.throws(() => {
      new CapabilityRegistry(duplicateList);
    }, /Duplicate capability ID detected/);
  });

  test('14. Registry definitions are deeply immutable (Object.isFrozen)', () => {
    const cap = capabilityRegistry.getCapability('coding.production_code');
    assert.ok(Object.isFrozen(cap));
    assert.throws(() => {
      cap.risk_level = 'CRITICAL';
    }, TypeError);
    assert.equal(cap.risk_level, RISK.LOW);
  });

  test('15. getCapability() returns correct capability and handles invalid input', () => {
    const cap = capabilityRegistry.getCapability('coding.production_code');
    assert.ok(cap);
    assert.equal(cap.capability_id, 'coding.production_code');
    assert.equal(capabilityRegistry.getCapability('non.existent.id'), null);
    assert.equal(capabilityRegistry.getCapability(null), null);
    assert.equal(capabilityRegistry.getCapability(123), null);
  });

  test('16. getByCategory() returns correct subset', () => {
    const coding = capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_1);
    assert.ok(Array.isArray(coding));
    assert.equal(coding.length, 12);
    assert.ok(coding.every(c => c.category === CATEGORIES.CATEGORY_1));
  });

  test('17. getByStatus() returns correct subset', () => {
    const implemented = capabilityRegistry.getByStatus(STATUS.IMPLEMENTED);
    assert.ok(Array.isArray(implemented));
    assert.ok(implemented.length >= 46);
    assert.ok(implemented.every(c => c.status === STATUS.IMPLEMENTED));
  });

  test('18. getDependencies() returns direct dependency list', () => {
    const deps = capabilityRegistry.getDependencies('coding.full_stack_delivery');
    assert.ok(Array.isArray(deps));
    assert.ok(deps.includes('coding.production_code'));
    assert.ok(deps.includes('devops.terminal'));
  });

  test('19. findByIntent() resolves deterministic keywords and aliases', () => {
    const scaffold = capabilityRegistry.findByIntent('scaffold');
    assert.ok(scaffold.length > 0);
    assert.equal(scaffold[0].capability_id, 'coding.full_stack_delivery');

    const git = capabilityRegistry.findByIntent('please commit this file to git');
    assert.ok(git.some(c => c.capability_id === 'coding.git_operations'));

    const offline = capabilityRegistry.findByIntent('run offline with ollama');
    assert.ok(offline.some(c => c.capability_id === 'performance.offline_ai'));
  });

  test('20. isAvailable() returns structured status and handles configuration checks', () => {
    // Docker capability check
    const dockerAvail = capabilityRegistry.isAvailable('devops.docker', { dockerAvailable: true });
    assert.equal(dockerAvail, AVAILABILITY.AVAILABLE);

    const dockerUnavail = capabilityRegistry.isAvailable('devops.docker', { dockerAvailable: false });
    assert.equal(dockerUnavail, AVAILABILITY.UNAVAILABLE);

    // Foundation capability requires configuration
    const ciCd = capabilityRegistry.isAvailable('devops.ci_cd_pipeline');
    assert.equal(ciCd, AVAILABILITY.REQUIRES_CONFIGURATION);
  });

  test('21. requiresCodeDiffGate() identifies persistent source modifying capabilities', () => {
    assert.equal(capabilityRegistry.requiresCodeDiffGate('coding.production_code'), true);
    assert.equal(capabilityRegistry.requiresCodeDiffGate('coding.legacy_refactoring'), true);
    assert.equal(capabilityRegistry.requiresCodeDiffGate('coding.automated_bug_resolution'), true);
    assert.equal(capabilityRegistry.requiresCodeDiffGate('coding.code_explanation'), false);
    assert.equal(capabilityRegistry.requiresCodeDiffGate('performance.offline_ai'), false);
  });

  test('22. Security policy and risk metadata cannot be overridden by arbitrary input', () => {
    const cap = capabilityRegistry.getCapability('devops.docker');
    assert.equal(cap.risk_level, RISK.HIGH);
    assert.equal(cap.approval_policy, APPROVAL.EXPLICIT_APPROVAL);

    assert.throws(() => {
      cap.risk_level = RISK.LOW;
    }, TypeError);

    assert.throws(() => {
      cap.approval_policy = APPROVAL.AUTO;
    }, TypeError);

    assert.equal(cap.risk_level, RISK.HIGH);
    assert.equal(cap.approval_policy, APPROVAL.EXPLICIT_APPROVAL);
  });

  describe('Category Counts Verification (Exact Sum = 83)', () => {
    test('Category 1 — CODING_SOFTWARE_ENGINEERING has 12 capabilities', () => {
      assert.equal(capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_1).length, 12);
    });

    test('Category 2 — UI_UX_VISUAL_DESIGN has 11 capabilities', () => {
      assert.equal(capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_2).length, 11);
    });

    test('Category 3 — DEVOPS_EXECUTION has 10 capabilities', () => {
      assert.equal(capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_3).length, 10);
    });

    test('Category 4 — AUTONOMY_AGENTIC_LOGIC has 9 capabilities', () => {
      assert.equal(capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_4).length, 9);
    });

    test('Category 5 — PERFORMANCE_COST has 8 capabilities', () => {
      assert.equal(capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_5).length, 8);
    });

    test('Category 6 — SAAS_BUSINESS has 9 capabilities', () => {
      assert.equal(capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_6).length, 9);
    });

    test('Category 7 — SECURITY_PRIVACY has 8 capabilities', () => {
      assert.equal(capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_7).length, 8);
    });

    test('Category 8 — DATA_ADVANCED_AI has 7 capabilities', () => {
      assert.equal(capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_8).length, 7);
    });

    test('Category 9 — UX_TRANSPARENCY has 9 capabilities', () => {
      assert.equal(capabilityRegistry.getByCategory(CATEGORIES.CATEGORY_9).length, 9);
    });
  });

  describe('Helper Accessor Methods', () => {
    test('getRequiredTools() returns list of tool names', () => {
      const tools = capabilityRegistry.getRequiredTools('coding.automated_bug_resolution');
      assert.deepEqual(tools, ['DiffEngineTool', 'TerminalTool', 'ReadTool']);
    });

    test('getRequiredSkills() returns list of skill names', () => {
      const skills = capabilityRegistry.getRequiredSkills('coding.automated_bug_resolution');
      assert.deepEqual(skills, ['error-debugging', 'stacktrace-repair']);
    });

    test('getRiskPolicy() returns risk_level and approval_policy', () => {
      const policy = capabilityRegistry.getRiskPolicy('devops.terminal');
      assert.deepEqual(policy, {
        risk_level: RISK.HIGH,
        approval_policy: APPROVAL.EXPLICIT_APPROVAL
      });
    });

    test('getVerificationPolicy() returns policy string', () => {
      assert.equal(
        capabilityRegistry.getVerificationPolicy('coding.production_code'),
        'AST_VALIDATION'
      );
      assert.equal(
        capabilityRegistry.getVerificationPolicy('ui.pixel_perfect'),
        'DOM_HEURISTIC'
      );
      assert.equal(
        capabilityRegistry.getVerificationPolicy('coding.code_explanation'),
        'NONE'
      );
    });
  });

});
