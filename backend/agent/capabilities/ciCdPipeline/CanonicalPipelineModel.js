'use strict';

/**
 * AI-Dost 2.0 — Phase 4E: Canonical Pipeline Model (CPM)
 * 
 * Platform-independent, structured intermediate representation of a CI/CD pipeline.
 * Enforces structured least-privilege permissions, stage dependency graphs,
 * ephemeral services, and secret context references.
 */

const { deepFreeze } = require('./CiCdPlan');

class CanonicalPipelineModel {
  constructor(data = {}) {
    this.version = '1.0.0';
    this.pipelineName = String(data.pipelineName || 'CI Pipeline').trim();
    
    // Structured permissions ONLY: { contents: "read" }
    this.permissions = this._validatePermissions(data.permissions);

    // Platform-agnostic triggers
    const rawTriggers = data.triggers || {};
    this.triggers = {
      push: Array.isArray(rawTriggers.push) ? rawTriggers.push.slice() : ['main'],
      pullRequest: Array.isArray(rawTriggers.pullRequest) ? rawTriggers.pullRequest.slice() : ['main'],
      workflowDispatch: rawTriggers.workflowDispatch !== false
    };

    // Runtime Matrix
    const rawMatrix = data.runtimeMatrix || {};
    this.runtimeMatrix = {
      runtime: rawMatrix.runtime || 'node',
      versions: Array.isArray(rawMatrix.versions) && rawMatrix.versions.length > 0
        ? rawMatrix.versions.slice()
        : ['20.x']
    };

    // Ephemeral Services (e.g. Postgres / MySQL containers)
    this.ephemeralServices = Array.isArray(data.ephemeralServices)
      ? data.ephemeralServices.map(s => Object.assign({}, s))
      : [];

    // Pipeline Stages
    this.stages = Array.isArray(data.stages)
      ? data.stages.map(st => Object.assign({}, st))
      : [];

    // Track referenced platform secrets
    this.secretsReferenced = new Set(data.secretsReferenced || []);

    // Deep freeze
    deepFreeze(this);
  }

  _validatePermissions(perms) {
    if (!perms || typeof perms !== 'object' || Array.isArray(perms)) {
      throw new Error('CanonicalPipelineModel permissions must be a structured object (e.g. { contents: "read" }).');
    }

    const clean = {};
    for (const [scope, level] of Object.entries(perms)) {
      if (typeof scope !== 'string' || typeof level !== 'string') {
        throw new Error('Permission scope and level must be strings.');
      }
      const cleanScope = scope.toLowerCase().trim();
      const cleanLevel = level.toLowerCase().trim();

      if (cleanLevel !== 'read' && cleanLevel !== 'none') {
        throw new Error(`Permission value "${cleanLevel}" for "${cleanScope}" violates least-privilege policy.`);
      }
      clean[cleanScope] = cleanLevel;
    }

    if (Object.keys(clean).length === 0) {
      clean.contents = 'read';
    }

    return clean;
  }

  toJSON() {
    return {
      version: this.version,
      pipelineName: this.pipelineName,
      permissions: this.permissions,
      triggers: this.triggers,
      runtimeMatrix: this.runtimeMatrix,
      ephemeralServices: this.ephemeralServices,
      stages: this.stages,
      secretsReferenced: Array.from(this.secretsReferenced)
    };
  }
}

module.exports = {
  CanonicalPipelineModel
};
