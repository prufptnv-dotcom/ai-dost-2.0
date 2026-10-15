const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  GIT_PM_DOMAINS,
  GIT_PROJECT_MANAGEMENT_DIRECTIVE,
  detectGitPmIntent,
} = require('../services/gitProjectManagementEngine');

describe('Category 10: Principal Git & Project Management Engine Tests', () => {
  describe('All 14 Domains Registered', () => {
    const expectedDomains = [
      'repo-structure',
      'issue-content',
      'pr-review',
      'commit-suggestions',
      'branching-strategy',
      'release-checklist',
      'changelog',
      'roadmap',
      'milestones',
      'adr',
      'code-quality',
      'security-audit',
      'testing-strategy',
      'refactoring-plan',
    ];

    test('has all 14 principal engineering domains configured with sections', () => {
      for (const domain of expectedDomains) {
        assert.ok(GIT_PM_DOMAINS[domain], `Domain ${domain} should exist`);
        assert.ok(GIT_PM_DOMAINS[domain].name, `Domain ${domain} should have a name`);
        assert.ok(Array.isArray(GIT_PM_DOMAINS[domain].sections), `Domain ${domain} should have sections`);
        assert.ok(GIT_PM_DOMAINS[domain].sections.length >= 3, `Domain ${domain} should have >= 3 sections`);
      }
    });
  });

  describe('Intent Detection', () => {
    test('detects PR review intent', () => {
      const res = detectGitPmIntent('is pull request ka review karo aur diff audit do');
      assert.equal(res.isGitPm, true);
      assert.equal(res.domain, 'pr-review');
    });

    test('detects Conventional Commit suggestions', () => {
      const res = detectGitPmIntent('suggest conventional commit message for user auth fix');
      assert.equal(res.isGitPm, true);
      assert.equal(res.domain, 'commit-suggestions');
    });

    test('detects Architecture Decision Record (ADR) intent', () => {
      const res = detectGitPmIntent('write an adr for switching database to postgresql');
      assert.equal(res.isGitPm, true);
      assert.equal(res.domain, 'adr');
    });

    test('detects Release Checklist & Deployment Gate', () => {
      const res = detectGitPmIntent('production deployment se pehle release checklist banao');
      assert.equal(res.isGitPm, true);
      assert.equal(res.domain, 'release-checklist');
    });

    test('detects Refactoring Plan intent', () => {
      const res = detectGitPmIntent('legacy monolithic controller ka refactoring plan do using strangler fig');
      assert.equal(res.isGitPm, true);
      assert.equal(res.domain, 'refactoring-plan');
    });

    test('detects Product & Technical Roadmap intent', () => {
      const res = detectGitPmIntent('q3 and q4 technical roadmap create karo with milestones');
      assert.equal(res.isGitPm, true);
      assert.ok(res.domain === 'roadmap' || res.domain === 'milestones');
    });

    test('detects Branching Strategy intent', () => {
      const res = detectGitPmIntent('what is the best branching strategy for our team (trunk based or gitflow)?');
      assert.equal(res.isGitPm, true);
      assert.equal(res.domain, 'branching-strategy');
    });

    test('returns false for unrelated non-git messages', () => {
      const res = detectGitPmIntent('mumbai weather kaisa hai aaj');
      assert.equal(res.isGitPm, false);
    });
  });

  describe('Directive & Schema Verification', () => {
    test('directive contains comprehensive guidance for all 14 domains', () => {
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('1. 📂 REPOSITORY STRUCTURE DESIGN'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('2. 📋 GITHUB ISSUE GENERATION'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('3. 🔍 PULL REQUEST REVIEW & DIFF AUDIT'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('4. 💬 CONVENTIONAL COMMIT SUGGESTIONS'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('5. 🌿 BRANCHING & MERGE STRATEGY'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('6. 🚀 PRODUCTION RELEASE CHECKLIST'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('7. 📜 CHANGELOG'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('8. 🗺️ PRODUCT & TECHNICAL ROADMAP'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('9. 🎯 MILESTONES & SPRINT DELIVERABLES'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('10. 🏛️ ARCHITECTURE DECISION RECORD'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('11. ✅ CODE QUALITY CHECKLIST'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('12. 🛡️ SECURITY AUDIT CHECKLIST'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('13. 🧪 TESTING STRATEGY'));
      assert.ok(GIT_PROJECT_MANAGEMENT_DIRECTIVE.includes('14. 🔄 REFACTORING PLAN'));
    });
  });
});
