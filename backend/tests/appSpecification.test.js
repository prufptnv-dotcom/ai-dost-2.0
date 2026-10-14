'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAppSpecification,
  formatAppSpecificationForPrompt,
  shouldCreateAppSpecification,
  validateAppSpecification,
} = require('../services/appSpecificationService');

describe('AppSpecificationService', () => {
  test('creates a UI specification with explicit requirements and linked acceptance checks', () => {
    const spec = buildAppSpecification('Build a responsive finance dashboard with search, charts, and CSV export');
    assert.ok(spec);
    assert.equal(spec.scope, 'application-ui');
    assert.equal(spec.archetype.id, 'saas-dashboard');
    assert.equal(spec.stack.requested, null);
    assert.deepEqual(spec.designSystem.responsiveWidthsPx, [360, 768, 1280]);
    assert.ok(spec.componentArchitecture.boundaries.some((rule) => /reusable/i.test(rule)));
    assert.ok(spec.nonFunctional.security.length >= 3);
    assert.ok(spec.dataModel.entities.some((entity) => entity.name === 'Transaction'));
    assert.ok(spec.interactions.some((interaction) => interaction.featureKey === 'search-filter' && interaction.stateTransitions.length > 1));
    assert.ok(spec.requirements.some((item) => item.featureKey === 'search-filter'));
    assert.ok(spec.requirements.some((item) => item.featureKey === 'charts-analytics'));
    assert.ok(spec.requirements.some((item) => item.featureKey === 'csv-export'));
    assert.equal(validateAppSpecification(spec).valid, true);
    assert.equal(validateAppSpecification(spec).requirementCoverage, 1);
  });

  test('preserves prompt clauses that are not covered by known feature rules', () => {
    const spec = buildAppSpecification([
      'Create a scheduling app.',
      '- Let users reserve time slots',
      '- Export bookings as CSV',
      '- Include timezone selection and a cancellation policy',
    ].join('\n'));
    assert.ok(spec.requirements.some((item) => item.source === 'explicit-clause' && /timezone selection/i.test(item.sourceText)));
    assert.ok(spec.requirements.some((item) => item.featureKey === 'csv-export'));
    assert.equal(spec.explicitCoverage.unrepresentedClauses.length, 0);
    assert.equal(validateAppSpecification(spec).valid, true);
    const formatted = formatAppSpecificationForPrompt(spec);
    assert.match(formatted, /timezone selection and a cancellation policy/i);
    assert.match(formatted, /explicitCoverage/);
  });

  test('retains multiple explicit clauses mapped to the same feature type', () => {
    const spec = buildAppSpecification([
      'Build a customer dashboard.',
      '- Search customers by name',
      '- Search customers by email',
    ].join('\n'));
    const searchRequirement = spec.requirements.find((item) => item.featureKey === 'search-filter');
    assert.ok(searchRequirement);
    assert.match(searchRequirement.sourceText, /Search customers by name/i);
    assert.match(searchRequirement.sourceText, /Search customers by email/i);
    assert.equal(spec.explicitCoverage.unrepresentedClauses.length, 0);
  });

  test('does not turn explicitly excluded features into implementation requirements', () => {
    const spec = buildAppSpecification('Create a dashboard without search, charts, or login; include CSV export.');
    assert.equal(spec.requirements.some((item) => item.featureKey === 'search-filter'), false);
    assert.equal(spec.requirements.some((item) => item.featureKey === 'charts-analytics'), false);
    assert.equal(spec.requirements.some((item) => item.featureKey === 'authentication'), false);
    assert.ok(spec.requirements.some((item) => item.featureKey === 'csv-export'));
    assert.ok(spec.requirements.some((item) => item.source === 'explicit-clause' && /without search/i.test(item.sourceText)));
    assert.ok(spec.pages.explicitlyRequested.includes('Dashboard'));
    assert.equal(spec.pages.explicitlyRequested.includes('Login/signup'), false);
  });

  test('keeps excluded features out across varied negation wording and list lengths', () => {
    const cases = [
      { prompt: 'Create a dashboard with no search.', excluded: ['search-filter'] },
      { prompt: 'Create a dashboard without search, charts, or login.', excluded: ['search-filter', 'charts-analytics', 'authentication'] },
      { prompt: 'Create a dashboard; omit chat and CSV export.', excluded: ['chat', 'csv-export'] },
      { prompt: 'Create a dashboard where login is not required.', excluded: ['authentication'] },
      { prompt: "Create a dashboard where login isn't needed.", excluded: ['authentication'] },
      { prompt: 'Create a dashboard and do not include search or charts.', excluded: ['search-filter', 'charts-analytics'] },
      { prompt: 'Create a dashboard with search, but without login.', excluded: ['authentication'], included: ['search-filter'] },
      { prompt: 'Create a dashboard without login and include search.', excluded: ['authentication'], included: ['search-filter'] },
      { prompt: 'Create a dashboard with no login; add charts.', excluded: ['authentication'], included: ['charts-analytics'] },
      { prompt: 'Create a dashboard with no login. Include search and charts.', excluded: ['authentication'], included: ['search-filter', 'charts-analytics'] },
      { prompt: 'Create a dashboard; no charts. Include login.', excluded: ['charts-analytics'], included: ['authentication'] },
      { prompt: 'Create a dashboard with search, not only charts but also login.', excluded: [], included: ['search-filter', 'charts-analytics', 'authentication'] },
    ];

    for (const entry of cases) {
      const spec = buildAppSpecification(entry.prompt);
      for (const featureKey of entry.excluded || []) {
        assert.equal(
          spec.requirements.some((item) => item.featureKey === featureKey),
          false,
          entry.prompt + ' should exclude ' + featureKey
        );
      }
      for (const featureKey of entry.included || []) {
        assert.ok(
          spec.requirements.some((item) => item.featureKey === featureKey),
          entry.prompt + ' should include ' + featureKey
        );
      }
    }
  });

  test('keeps every feature in generated comma-list exclusions excluded', () => {
    const featureTerms = [
      { term: 'search', key: 'search-filter' },
      { term: 'charts', key: 'charts-analytics' },
      { term: 'login', key: 'authentication' },
      { term: 'chat', key: 'chat' },
      { term: 'CSV export', key: 'csv-export' },
      { term: 'dark mode', key: 'dark-mode' },
      { term: 'file upload', key: 'file-upload' },
    ];

    // Deterministic property-style coverage: rotate the list so every feature
    // appears in every position, then test each prefix length (1..7).
    for (let offset = 0; offset < featureTerms.length; offset += 1) {
      const rotated = featureTerms.slice(offset).concat(featureTerms.slice(0, offset));
      for (let length = 1; length <= rotated.length; length += 1) {
        const selected = rotated.slice(0, length);
        const list = selected.map((item) => item.term);
        const prompt = 'Create a dashboard without ' + list.slice(0, -1).join(', ') +
          (list.length > 1 ? ' or ' : '') + list[list.length - 1] + '.';
        const spec = buildAppSpecification(prompt);
        for (const feature of selected) {
          assert.equal(
            spec.requirements.some((item) => item.featureKey === feature.key),
            false,
            prompt + ' should exclude ' + feature.key
          );
        }
      }
    }
  });

  test('respects explicit framework choices without inventing a stack when omitted', () => {
    const explicit = buildAppSpecification('Create a Next.js education platform with quizzes');
    assert.equal(explicit.stack.requested, 'Next.js');
    const implicit = buildAppSpecification('Create a learning platform with quizzes');
    assert.equal(implicit.stack.requested, null);
    assert.match(implicit.stack.selectionPolicy, /inspect the existing workspace first/i);
  });

  test('classifies targeted application changes as modification work', () => {
    const spec = buildAppSpecification('Fix the CSV export button in the existing React dashboard');
    assert.equal(spec.mode, 'modify-existing');
    assert.equal(spec.scope, 'application-ui');
    assert.ok(spec.requirements.some((item) => item.featureKey === 'csv-export'));
  });

  test('recognizes mixed Hindi/Hinglish software instructions', () => {
    const spec = buildAppSpecification('Dashboard mein CSV export button lagao');
    assert.ok(spec);
    assert.equal(spec.scope, 'application-ui');
    assert.ok(spec.requirements.some((item) => item.featureKey === 'csv-export'));
  });

  test('does not add application specs to ordinary explanatory questions', () => {
    assert.equal(shouldCreateAppSpecification('Explain what a REST API is'), false);
    assert.equal(buildAppSpecification('Explain what a REST API is'), null);
    const codeChange = buildAppSpecification('Fix src/services/cache.js');
    assert.ok(codeChange);
    assert.equal(codeChange.scope, 'software-change');
  });

  test('formatter includes stable requirement IDs, acceptance IDs, and honesty rules', () => {
    const spec = buildAppSpecification('Build a todo app with search and CSV export');
    const prompt = formatAppSpecificationForPrompt(spec);
    assert.match(prompt, /AI-DOST APP SPECIFICATION/);
    assert.match(prompt, /REQ-001/);
    assert.match(prompt, /AC-01/);
    assert.match(prompt, /componentArchitecture/);
    assert.match(prompt, /dataModel/);
    assert.match(prompt, /stateTransitions/);
    assert.match(prompt, /nonFunctional/);
    assert.match(prompt, /Do not claim integrations or checks are complete/i);
    assert.match(prompt, /original request remains authoritative/i);
  });

  test('validator rejects requirements with no linked acceptance checks', () => {
    const spec = buildAppSpecification('Build a dashboard with CSV export');
    const target = spec.requirements.find((item) => item.featureKey === 'csv-export');
    const criterion = spec.acceptanceCriteria.find((item) => item.requirementIds?.includes(target.id));
    criterion.requirementIds = [];
    const validation = validateAppSpecification(spec);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((message) => message.includes('acceptance coverage')));
  });
});

describe('Full-stack generation prompt quality contract', () => {
  const { buildFullstackSystemPrompt } = require('../agent/fullstackTrainer');

  test('does not force one theme or a single monolithic component', () => {
    const prompt = buildFullstackSystemPrompt('Build a light, accessible portfolio with case studies', 'portfolio');
    assert.match(prompt, /request-appropriate visual system/i);
    assert.match(prompt, /Theme is request-driven/i);
    assert.match(prompt, /semantic design tokens/i);
    assert.match(prompt, /Do not put the entire product in one giant App component/i);
    assert.doesNotMatch(prompt, /dark theme \(slate-950\)/i);
    assert.doesNotMatch(prompt, /Font Awesome ONLY/i);
  });
});

describe('CopilotDirector AppSpecification integration', () => {
  test('passes the validated specification to the director before task planning', async () => {
    const { handleCopilotDirectorRequest } = require('../agent/runtime/copilotDirectorHandler');
    let captured = null;
    const res = {
      writableEnded: false,
      destroyed: false,
      headers: {},
      writes: [],
      setHeader(key, value) { this.headers[key] = value; },
      flushHeaders() {},
      write(chunk) { this.writes.push(String(chunk)); },
      on(event, handler) { if (event === 'finish') this.finishHandler = handler; return this; },
      end() { this.writableEnded = true; this.finishHandler?.(); },
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; this.writableEnded = true; return this; },
    };
    const req = {
      body: {
        copilotDirector: true,
        userPrompt: 'Build a responsive finance dashboard with search and CSV export',
        projectId: 'spec-integration-test',
      },
      headers: {},
      get(name) { return name === 'x-ai-dost-task-id' ? 'spec-integration-task' : undefined; },
    };
    const dependencies = {
      projectAuthorization: {
        authorize: () => ({ authorized: true, user: { id: 'test-user' }, project: { id: 'spec-integration-test' } }),
      },
      runtime: {
        director: {
          run: async (args) => {
            captured = args;
            return { status: 'COMPLETED', taskCount: 1, summary: '1 adaptive task' };
          },
        },
      },
    };

    await handleCopilotDirectorRequest(req, res, () => { throw new Error('request should not fall through'); }, dependencies);
    assert.ok(captured);
    assert.match(captured.request, /AI-DOST APP SPECIFICATION/);
    assert.match(captured.request, /REQ-002/);
    assert.match(captured.request, /AC-01/);
    assert.ok(res.writes.some((frame) => frame.includes('Mapped ') && frame.includes('acceptance checks')));
    assert.equal(res.writableEnded, true);
  });

  test('does not inject UI requirements for an explanatory request', async () => {
    const { handleCopilotDirectorRequest } = require('../agent/runtime/copilotDirectorHandler');
    let captured = null;
    const res = {
      writableEnded: false,
      destroyed: false,
      setHeader() {},
      flushHeaders() {},
      write() {},
      on(event, handler) { if (event === 'finish') this.finishHandler = handler; return this; },
      end() { this.writableEnded = true; this.finishHandler?.(); },
    };
    const req = {
      body: { copilotDirector: true, userPrompt: 'Explain what a REST API is', projectId: 'spec-question-test' },
      headers: {},
      get(name) { return name === 'x-ai-dost-task-id' ? 'spec-question-task' : undefined; },
    };
    const dependencies = {
      projectAuthorization: {
        authorize: () => ({ authorized: true, user: { id: 'test-user' }, project: { id: 'spec-question-test' } }),
      },
      runtime: {
        director: { run: async (args) => { captured = args; return { status: 'COMPLETED', taskCount: 1 }; } },
      },
    };

    await handleCopilotDirectorRequest(req, res, () => {}, dependencies);
    assert.equal(captured.request, 'Explain what a REST API is');
    assert.doesNotMatch(captured.request, /AI-DOST APP SPECIFICATION/);
  });
});
