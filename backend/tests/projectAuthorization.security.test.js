'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const ProjectAuthorizationService = require('../services/projectAuthorization').ProjectAuthorizationService;

function makeService() {
  const users = new Map();
  const projects = new Map();
  const fakeDb = {};
  const service = new ProjectAuthorizationService(fakeDb);
  Object.defineProperty(service, 'users', { get: () => ({
    getById: (id) => users.get(id) || null,
    create: ({ id, username }) => { const u = { id, username }; users.set(id, u); return u; }
  }) });
  Object.defineProperty(service, 'projects', { get: () => ({
    getById: (id) => projects.get(id) || null,
    create: (input) => { const p = { id: input.id, user_id: input.userId, name: input.name }; projects.set(p.id, p); return p; }
  }) });
  return { service, projects };
}

describe('ProjectAuthorizationService production identity', () => {
  test('does not trust x-user-id in production', () => {
    const previous = process.env.NODE_ENV;
    const previousHeader = process.env.ALLOW_UNTRUSTED_USER_HEADER;
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_UNTRUSTED_USER_HEADER = 'true';
    try {
      const { service } = makeService();
      const req = { headers: { 'x-user-id': 'attacker' } };
      assert.equal(service.resolveUser(req), 'local-user');
      const auth = service.authorize('project-1', req);
      assert.equal(auth.authorized, false);
      assert.equal(auth.status, 401);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
      if (previousHeader === undefined) delete process.env.ALLOW_UNTRUSTED_USER_HEADER; else process.env.ALLOW_UNTRUSTED_USER_HEADER = previousHeader;
    }
  });

  test('accepts authenticated req.user identity in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { service } = makeService();
      assert.equal(service.resolveUser({ user: { id: 'alice' }, headers: { 'x-user-id': 'attacker' } }), 'alice');
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
    }
  });

  test('legacy owner-less project is not cross-tenant in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { service } = makeService();
      assert.equal(service.verifyOwnership({ id: 'legacy', user_id: null }, 'local-user'), false);
      assert.equal(service.verifyOwnership({ id: 'legacy', user_id: 'alice' }, 'bob'), false);
      assert.equal(service.verifyOwnership({ id: 'legacy', user_id: 'alice' }, 'alice'), true);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
    }
  });
});
