'use strict';

const { ApiClientGenerator } = require('./ApiClientGenerator');

class MockAdapterGenerator {
  /**
   * Synthesizes an offline in-memory mock client that mirrors the real ApiClient
   */
  static generateMockClient(spec, plan) {
    const operations = ApiClientGenerator.extractOperations(spec);
    const schemas = spec.components?.schemas || {};

    const mockMethods = operations.map(op => {
      const { methodName, httpMethod, pathTemplate, hasBody, pathParamNames, summary } = op;
      const paramSig = [
        ...pathParamNames,
        hasBody ? 'payload' : null,
        'options = {}'
      ].filter(Boolean).join(', ');

      const resourceKey = pathTemplate.split('/').filter(p => p && !p.startsWith('{'))[1] || 'items';
      const isList = httpMethod === 'get' && pathParamNames.length === 0;
      const isGetOne = httpMethod === 'get' && pathParamNames.length > 0;
      const isCreate = httpMethod === 'post';
      const isDelete = httpMethod === 'delete';
      const isUpdate = httpMethod === 'put' || httpMethod === 'patch';

      let methodLogic = '';
      if (isList) {
        methodLogic = `
    await this._delay();
    this._checkSimulatedError();
    const list = this._store['${resourceKey}'] || [];
    return [...list];`;
      } else if (isGetOne) {
        const idVar = pathParamNames[0] || 'id';
        methodLogic = `
    await this._delay();
    this._checkSimulatedError();
    const list = this._store['${resourceKey}'] || [];
    const item = list.find(x => String(x.id) === String(${idVar}));
    if (!item) {
      throw new Error(\`Mock 404: \${${idVar}} not found in ${resourceKey}\`);
    }
    return { ...item };`;
      } else if (isCreate) {
        methodLogic = `
    await this._delay();
    this._checkSimulatedError();
    if (!this._store['${resourceKey}']) this._store['${resourceKey}'] = [];
    const newItem = {
      id: this._nextId++,
      ...(payload || {}),
      created_at: new Date().toISOString()
    };
    this._store['${resourceKey}'].push(newItem);
    return { ...newItem };`;
      } else if (isDelete) {
        const idVar = pathParamNames[0] || 'id';
        methodLogic = `
    await this._delay();
    this._checkSimulatedError();
    const list = this._store['${resourceKey}'] || [];
    this._store['${resourceKey}'] = list.filter(x => String(x.id) !== String(${idVar}));
    return { success: true, deletedId: ${idVar} };`;
      } else if (isUpdate) {
        const idVar = pathParamNames[0] || 'id';
        methodLogic = `
    await this._delay();
    this._checkSimulatedError();
    const list = this._store['${resourceKey}'] || [];
    const idx = list.findIndex(x => String(x.id) === String(${idVar}));
    if (idx === -1) {
      throw new Error(\`Mock 404: \${${idVar}} not found for update\`);
    }
    this._store['${resourceKey}'][idx] = { ...this._store['${resourceKey}'][idx], ...(payload || {}) };
    return { ...this._store['${resourceKey}'][idx] };`;
      } else {
        methodLogic = `
    await this._delay();
    this._checkSimulatedError();
    return { message: 'Mock response for ${methodName}', success: true };`;
      }

      return `
  /**
   * ${summary || methodName} (Mock)
   */
  async ${methodName}(${paramSig}) {
    ${methodLogic.trim()}
  }`;
    }).join('\n');

    return `/**
 * AI-Dost 2.0 Auto-Generated Offline Mock Client (Phase 4D)
 * 100% Offline — in-memory stateful mock adapter for sandbox testing
 */

/* AI-DOST-AUTO-GENERATED: START */

export class MockApiClient {
  constructor(config = {}) {
    this.latencyMs = typeof config.latencyMs === 'number' ? config.latencyMs : 20;
    this.simulateError = config.simulateError || null;
    this._nextId = 100;
    this._store = {
      items: [
        { id: 1, name: 'Sample Item 1', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 2, name: 'Sample Item 2', status: 'pending', created_at: '2026-01-01T00:00:00.000Z' }
      ]
    };
  }

  async _delay() {
    if (this.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.latencyMs));
    }
  }

  _checkSimulatedError() {
    if (this.simulateError) {
      const err = new Error(\`Simulated Mock Error: \${this.simulateError}\`);
      err.status = this.simulateError;
      throw err;
    }
  }

  // --- Mock Operations ---
${mockMethods}
}

export const mockApi = new MockApiClient();
export default mockApi;

/* AI-DOST-AUTO-GENERATED: END */
`;
  }
}

module.exports = {
  MockAdapterGenerator
};
