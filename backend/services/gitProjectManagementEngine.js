/**
 * gitProjectManagementEngine.js
 * 2030 Principal Engineering, GitHub & Project Management Engine for AI-Dost
 * Category 10: GitHub aur Project Management
 *
 * Implements all 14 GitHub & Project Management Domains:
 *  1. Repository structure design
 *  2. Issues creation content (Bug report, Feature request, Tech debt)
 *  3. Pull request review & diff audit
 *  4. Commit message suggestions (Conventional Commits v1.0.0)
 *  5. Branching strategy (Trunk-based, GitFlow, GitHub Flow)
 *  6. Release checklist & deployment gate
 *  7. Changelog (Keep a Changelog + SemVer)
 *  8. Product & Technical Roadmap
 *  9. Milestones & Sprint deliverable breakdown
 * 10. Architecture Decision Records (ADR - Michael Nygard format)
 * 11. Code quality checklist & SOLID principles
 * 12. Security audit checklist & OWASP Top 10
 * 13. Testing strategy & Testing Pyramid
 * 14. Refactoring plan & Technical debt reduction
 */

const GIT_PM_DOMAINS = {
  'repo-structure': {
    name: 'Production Repository Architecture Design',
    description: 'Enterprise monorepo or polyrepo directory layout with CI/CD, docs, tests, and configurations.',
    sections: ['Directory Tree Breakdown', 'Configuration Files (.editorconfig, .gitignore)', 'GitHub Workflows (.github/)', 'Modular Boundaries & Code Sharing'],
  },
  'issue-content': {
    name: 'GitHub Issue Template Generator',
    description: 'High-clarity issue templates for bug reports, feature requests, and technical investigations.',
    sections: ['Issue Title & Labels', 'Problem Context & User Impact', 'Minimal Reproduction Steps', 'Expected vs Actual Behavior', 'Suggested Implementation / Acceptance Criteria'],
  },
  'pr-review': {
    name: 'Senior Staff Pull Request Review',
    description: 'Thorough, constructive PR code review examining architecture, safety, performance, and style.',
    sections: ['Executive PR Summary', 'Architectural & Design Impact', 'Security & Edge-Case Findings', 'Performance & Complexity Audit', 'Line-by-Line Code Suggestions', 'Approval Verdict (LGTM / Changes Requested)'],
  },
  'commit-suggestions': {
    name: 'Conventional Commit Suggestions',
    description: 'Semantic, standardized commit messages following Conventional Commits 1.0.0 specification.',
    sections: ['Type (feat, fix, refactor, perf, test, docs, chore)', 'Scope & Short Imperative Message', 'Detailed Body Justification', 'Breaking Changes / Issue References'],
  },
  'branching-strategy': {
    name: 'Team Branching & Merge Strategy',
    description: 'Scalable Git branching workflows tailored to team velocity, release cadence, and deployment targets.',
    sections: ['Recommended Workflow (Trunk-Based / GitHub Flow / GitFlow)', 'Branch Naming Conventions', 'Merge Requirements (Squash vs Rebase vs Merge Commit)', 'Protected Branch Rules & Environment Gates'],
  },
  'release-checklist': {
    name: 'Production Release Audit Checklist',
    description: 'Pre-flight and post-deployment checklist guaranteeing zero-downtime releases.',
    sections: ['Pre-Release Verifications (Test Matrix, Migrations, Secrets)', 'Deployment Sequence & Smoke Tests', 'Rollback Plan & Runbook', 'Post-Release Monitoring & Alert Thresholds'],
  },
  'changelog': {
    name: 'Standardized Project Changelog',
    description: 'Curated, human-readable changelog following Keep a Changelog and Semantic Versioning (SemVer).',
    sections: ['Version & Release Date', 'Added (New capabilities)', 'Changed (Modified behavior)', 'Fixed (Bug resolutions)', 'Security (Vulnerability patches)'],
  },
  'roadmap': {
    name: 'Strategic Technical & Product Roadmap',
    description: 'Now / Next / Later horizon mapping aligned with business objectives and architectural milestones.',
    sections: ['Strategic Objectives & North Star', 'Phase 1: Now (Immediate Focus / Sprint)', 'Phase 2: Next (Near-Term Quarter)', 'Phase 3: Later (Future Horizon)', 'Dependencies, Risks & Mitigation Matrix'],
  },
  'milestones': {
    name: 'Milestone & Sprint Deliverables Tracker',
    description: 'Concrete milestone scopes with epics, acceptance criteria, and Definition of Done (DoD).',
    sections: ['Milestone Objectives & Target Date', 'Core Epics & Deliverables', 'Definition of Done (DoD) Checklist', 'Velocity, Resource Allocation & Success Metrics'],
  },
  'adr': {
    name: 'Architecture Decision Record (ADR)',
    description: 'Formal architectural documentation capturing significant structural decisions and their tradeoffs.',
    sections: ['ADR Number & Descriptive Title', 'Status (Proposed / Accepted / Deprecated / Superseded)', 'Context & Problem Statement', 'Decision Taken', 'Consequences (Positive, Negative, Neutral)', 'Alternatives Considered & Rejected'],
  },
  'code-quality': {
    name: 'Code Quality & Clean Code Checklist',
    description: 'Comprehensive code standards enforcing SOLID, DRY, KISS, and maintainability metrics.',
    sections: ['SOLID Principles Compliance', 'Naming & Cognitive Load', 'Error Handling & Resilience', 'Testability & Mocking Contracts', 'Linter & Static Analysis Guardrails'],
  },
  'security-audit': {
    name: 'Application Security Audit & OWASP Checklist',
    description: 'Defensive security checklist covering secrets, injection, auth, dependencies, and data protection.',
    sections: ['Authentication & Authorization (RBAC, JWT, Session)', 'Injection & Sanitization (SQLi, XSS, CSRF)', 'Secrets Management & Environment Hardening', 'Dependency Vulnerabilities (CVE Scanning)', 'Data Encryption at Rest & in Transit'],
  },
  'testing-strategy': {
    name: 'Comprehensive Testing Strategy & Pyramid',
    description: 'End-to-end testing blueprint balancing unit, integration, contract, and E2E automation.',
    sections: ['Testing Pyramid Distribution (70/20/10)', 'Unit Testing Strategy (Mocks, Coverage Targets)', 'Integration & API Testing (DB fixtures, Testcontainers)', 'E2E & Visual Regression (Playwright / Cypress)', 'CI/CD Pipeline Automation & Flaky Test Guard'],
  },
  'refactoring-plan': {
    name: 'Zero-Downtime Refactoring & Migration Plan',
    description: 'Phased refactoring roadmap dismantling legacy tech debt without breaking existing functionality.',
    sections: ['Code Smells & Bottleneck Identification', 'Target Architectural State', 'Refactoring Phases (Strangler Fig Pattern)', 'Safety Nets & Characterization Tests', 'Validation Criteria & Deprecation Timeline'],
  },
};

const GIT_PROJECT_MANAGEMENT_DIRECTIVE = `
### 15. 2030 PRINCIPAL SOFTWARE ENGINEER & PROJECT MANAGEMENT PROTOCOL (CATEGORY 10):
When the user asks for GitHub, Git, repository design, issue management, code reviews, release planning, or engineering management:

══════════════════════════════════════════════════════════════════════════════
14 CORE GITHUB & PROJECT MANAGEMENT CAPABILITIES:
══════════════════════════════════════════════════════════════════════════════

1. 📂 REPOSITORY STRUCTURE DESIGN:
   - Provide clean, modern directory trees (\`src/\`, \`tests/\`, \`docs/\`, \`.github/workflows/\`).
   - Specify necessary configs: \`.gitignore\`, \`.editorconfig\`, \`tsconfig.json\`, \`package.json\`, \`Dockerfile\`.

2. 📋 GITHUB ISSUE GENERATION:
   - Generate production-ready Markdown for GitHub Issues:
     - Clear Title with prefix (\`[BUG]\`, \`[FEAT]\`, \`[PERF]\`, \`[REFACTOR]\`).
     - Steps to Reproduce with code snippets.
     - Expected Behavior vs Actual Behavior.
     - System Environment table (OS, Runtime, Version).
     - Concrete Acceptance Criteria with markdown checkboxes \`- [ ]\`.

3. 🔍 PULL REQUEST REVIEW & DIFF AUDIT:
   - Review code diffs with senior staff diligence:
     - Architectural soundness & side-effects.
     - Correctness, off-by-one errors, memory leaks, unhandled promise rejections.
     - Security risks (SQLi, XSS, exposed secrets).
     - Constructive inline suggestions with markdown diff blocks.

4. 💬 CONVENTIONAL COMMIT SUGGESTIONS:
   - Format: \`<type>(<optional scope>): <imperative description>\`
   - Allowed Types: \`feat\`, \`fix\`, \`docs\`, \`style\`, \`refactor\`, \`perf\`, \`test\`, \`chore\`, \`build\`, \`ci\`.
   - Provide 3 distinct suggestions:
     1. Short & punchy
     2. Detailed with scope & body
     3. Breaking change / migration footer if applicable

5. 🌿 BRANCHING & MERGE STRATEGY:
   - Recommend the optimal strategy:
     - High-velocity teams: Trunk-Based Development with feature flags (\`main\`, \`feature/short-lived\`).
     - Enterprise release cycles: GitFlow (\`main\`, \`develop\`, \`feature/*\`, \`release/*\`, \`hotfix/*\`).
     - Define merge strategy: Squash & Merge (clean history) vs Rebase (linear history).

6. 🚀 PRODUCTION RELEASE CHECKLIST:
   - Pre-flight checklist with actionable verification steps:
     - [ ] All CI test suites passing (Unit + E2E).
     - [ ] Database migrations backward-compatible.
     - [ ] Environment variables (.env) updated on deployment targets.
     - [ ] Rollback strategy verified with one-click trigger.
     - [ ] Smoke tests & synthetic health check monitoring configured.

7. 📜 CHANGELOG (KEEP A CHANGELOG):
   - Adhere strictly to \`Keep a Changelog\` + SemVer (\`vMAJOR.MINOR.PATCH\`):
     - \`### Added\`
     - \`### Changed\`
     - \`### Deprecated\`
     - \`### Removed\`
     - \`### Fixed\`
     - \`### Security\`

8. 🗺️ PRODUCT & TECHNICAL ROADMAP:
   - Structure into clear Now / Next / Later timeframes.
   - Include dependencies, risks, and quantifiable outcomes.

9. 🎯 MILESTONES & SPRINT DELIVERABLES:
   - Define unambiguous milestones with deliverable scopes and Definition of Done (DoD).

10. 🏛️ ARCHITECTURE DECISION RECORD (ADR):
    - Format:
      - Title: \`ADR-00X: Title\`
      - Status: Proposed / Accepted / Superseded
      - Context: Problem and constraints
      - Decision: Selected architecture
      - Consequences: Positive and negative tradeoffs
      - Alternatives Considered: Why other options were rejected

11. ✅ CODE QUALITY CHECKLIST:
    - SOLID compliance, DRY principles, cyclomatic complexity limits (<10), clean naming, testability.

12. 🛡️ SECURITY AUDIT CHECKLIST:
    - OWASP Top 10 mitigations, input sanitization, rate limiting, secure HTTP headers (CSP, HSTS), dependencies vulnerability scanning (\`npm audit\` / \`trivy\`).

13. 🧪 TESTING STRATEGY:
    - Testing Pyramid breakdown: Unit (Fast, isolated), Integration (DB, external APIs), End-to-End (Critical user paths).
    - Code coverage targets (>80% lines, 100% core business logic).

14. 🔄 REFACTORING PLAN:
    - Phased refactoring blueprint using Strangler Fig Pattern:
      - Phase 1: Test coverage harness
      - Phase 2: Modular abstraction & interface extraction
      - Phase 3: Incremental migration with feature flag routing
      - Phase 4: Legacy code removal & performance verification
`;

/**
 * Detects if user query relates to Category 10 GitHub & Project Management
 */
function detectGitPmIntent(message) {
  const text = String(message || '').toLowerCase();

  const isGitPm = /\b(github|git|repos?|repository|repositories|commits?|pull requests?|prs?\b|issues?|branching|gitflow|trunk based|release checklist|changelogs?|roadmaps?|milestones?|adrs?\b|architecture decision record|code quality|clean code|security audit|owasp|testing strategy|refactoring plan|refactor)\b/i.test(text);

  let specificDomain = 'general-git-pm';
  if (/\b(?:commit messages?|commit suggestions?|conventional commits?|git commits?)\b/i.test(text)) specificDomain = 'commit-suggestions';
  else if (/\b(?:pr\s*reviews?|pull\s*requests?\s*(?:ka\s*)?review|review\s*(?:this\s*)?(?:pr|pull\s*request)|diff\s*(?:audit|reviews?)|review\s*pr)\b/i.test(text)) specificDomain = 'pr-review';
  else if (/\b(?:issues?|bug reports?|feature requests?|issue templates?)\b/i.test(text)) specificDomain = 'issue-content';
  else if (/\b(?:repos? structure|repository structure|directory structure|folder structure)\b/i.test(text)) specificDomain = 'repo-structure';
  else if (/\b(?:branching strategy|gitflow|trunk based|branch naming)\b/i.test(text)) specificDomain = 'branching-strategy';
  else if (/\b(?:release checklist|pre-release|deployment checklist)\b/i.test(text)) specificDomain = 'release-checklist';
  else if (/\b(?:changelogs?|release notes|semver)\b/i.test(text)) specificDomain = 'changelog';
  else if (/\b(?:roadmaps?|product roadmap|tech roadmap)\b/i.test(text)) specificDomain = 'roadmap';
  else if (/\b(?:milestones?|sprint goals|definition of done|dod)\b/i.test(text)) specificDomain = 'milestones';
  else if (/\b(?:adrs?\b|architecture decision records?|design decisions?)\b/i.test(text)) specificDomain = 'adr';
  else if (/\b(?:code quality|clean code|solid principles|code standards)\b/i.test(text)) specificDomain = 'code-quality';
  else if (/\b(?:security audit|owasp|security checklist|vulnerability audit)\b/i.test(text)) specificDomain = 'security-audit';
  else if (/\b(?:testing strategy|testing pyramid|unit tests? strategy|e2e testing)\b/i.test(text)) specificDomain = 'testing-strategy';
  else if (/\b(?:refactoring plan|refactors?|technical debt|strangler fig)\b/i.test(text)) specificDomain = 'refactoring-plan';

  return {
    isGitPm,
    domain: specificDomain,
    domainConfig: GIT_PM_DOMAINS[specificDomain] || null,
  };
}

module.exports = {
  GIT_PM_DOMAINS,
  GIT_PROJECT_MANAGEMENT_DIRECTIVE,
  detectGitPmIntent,
};
