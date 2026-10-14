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
    assert.ok(spec.requirements.some((item) => item.featureKey === 'search-filter'));
    assert.ok(spec.requirements.some((item) => item.featureKey === 'charts-analytics'));
    assert.ok(spec.requirements.some((item) => item.featureKey === 'csv-export'));
    assert.equal(validateAppSpecification(spec).valid, true);
    assert.equal(validateAppSpecification(spec).requirementCoverage, 1);
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
    assert.equal(buildAppSpecification('Fix src/services/cache.js'), true === false ? null : null);
  });

  test('formatter includes stable requirement IDs, acceptance IDs, and honesty rules', () => {
    const spec = buildAppSpecification('Build a todo app with search and CSV export');
    const prompt = formatAppSpecificationForPrompt(spec);
    assert.match(prompt, /AI-DOST APP SPECIFICATION/);
    assert.match(prompt, /REQ-001/);
    assert.match(prompt, /AC-01/);
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
      end() { this.writableEnded = true; },
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
      end() { this.writableEnded = true; },
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
