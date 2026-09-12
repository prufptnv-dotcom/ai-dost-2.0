'use strict';

const crypto = require('crypto');
const { OpenApiGenerator } = require('./OpenApiGenerator');

class ContractDriftDetector {
  /**
   * Compares an existing OpenAPI specification with a new specification
   * and produces a structured drift report.
   */
  static detectDrift(oldSpec, newSpec) {
    if (!oldSpec || typeof oldSpec !== 'object') {
      return {
        hasDrift: false,
        isBreaking: false,
        summary: 'No previous specification provided for drift comparison',
        changes: [],
        oldChecksum: null,
        newChecksum: newSpec ? OpenApiGenerator.computeChecksum(newSpec) : null
      };
    }

    const oldChecksum = OpenApiGenerator.computeChecksum(oldSpec);
    const newChecksum = OpenApiGenerator.computeChecksum(newSpec);

    if (oldChecksum === newChecksum) {
      return {
        hasDrift: false,
        isBreaking: false,
        summary: 'Contracts are identical; zero drift detected',
        changes: [],
        oldChecksum,
        newChecksum
      };
    }

    const changes = [];
    const oldPaths = oldSpec.paths || {};
    const newPaths = newSpec.paths || {};

    // 1. Check for removed endpoints or method changes
    for (const [pathKey, oldPathItem] of Object.entries(oldPaths)) {
      const newPathItem = newPaths[pathKey];
      if (!newPathItem) {
        changes.push({
          type: 'REMOVED_ENDPOINT',
          severity: 'BREAKING',
          path: pathKey,
          message: `Endpoint "${pathKey}" was removed from the API specification`
        });
        continue;
      }

      for (const [method, oldOp] of Object.entries(oldPathItem)) {
        const newOp = newPathItem[method];
        if (!newOp) {
          changes.push({
            type: 'REMOVED_METHOD',
            severity: 'BREAKING',
            path: pathKey,
            method: method.toUpperCase(),
            message: `Method ${method.toUpperCase()} was removed from endpoint "${pathKey}"`
          });
          continue;
        }

        // 2. Check path parameters
        const oldParams = (oldOp.parameters || []).filter(p => p.in === 'path').map(p => p.name);
        const newParams = (newOp.parameters || []).filter(p => p.in === 'path').map(p => p.name);
        if (oldParams.sort().join(',') !== newParams.sort().join(',')) {
          changes.push({
            type: 'PATH_PARAMETER_CHANGED',
            severity: 'BREAKING',
            path: pathKey,
            method: method.toUpperCase(),
            message: `Path parameters changed on ${method.toUpperCase()} ${pathKey} (was: [${oldParams.join(', ')}], now: [${newParams.join(', ')}])`
          });
        }

        // 3. Check for added required query parameters
        const oldReqQueries = (oldOp.parameters || []).filter(p => p.in === 'query' && p.required).map(p => p.name);
        const newReqQueries = (newOp.parameters || []).filter(p => p.in === 'query' && p.required).map(p => p.name);
        const addedReqQueries = newReqQueries.filter(q => !oldReqQueries.includes(q));
        if (addedReqQueries.length > 0) {
          changes.push({
            type: 'ADDED_REQUIRED_QUERY_PARAMETER',
            severity: 'BREAKING',
            path: pathKey,
            method: method.toUpperCase(),
            parameter: addedReqQueries.join(', '),
            message: `New required query parameters added to ${method.toUpperCase()} ${pathKey}: [${addedReqQueries.join(', ')}]`
          });
        }

        // 4. Check for response status code removals / changes
        const oldStatuses = Object.keys(oldOp.responses || {});
        const newStatuses = Object.keys(newOp.responses || {});
        for (const st of oldStatuses) {
          if (!newStatuses.includes(st)) {
            const isSuccessStatus = st.startsWith('2');
            changes.push({
              type: 'STATUS_CODE_CHANGED',
              severity: isSuccessStatus ? 'BREAKING' : 'WARNING',
              path: pathKey,
              method: method.toUpperCase(),
              statusCode: st,
              message: `Response status ${st} was removed or altered on ${method.toUpperCase()} ${pathKey}`
            });
          }
        }

        // 5. Check for operation-level authentication requirement changes
        const oldSec = JSON.stringify(oldOp.security || null);
        const newSec = JSON.stringify(newOp.security || null);
        if (oldSec !== newSec) {
          changes.push({
            type: 'AUTH_REQUIREMENT_CHANGED',
            severity: 'BREAKING',
            path: pathKey,
            method: method.toUpperCase(),
            message: `Authentication requirements changed on ${method.toUpperCase()} ${pathKey}`
          });
        }
      }
    }

    // 6. Check root-level security and securitySchemes
    const oldRootSec = JSON.stringify(oldSpec.security || null);
    const newRootSec = JSON.stringify(newSpec.security || null);
    const oldSecSchemes = JSON.stringify(oldSpec.components?.securitySchemes || null);
    const newSecSchemes = JSON.stringify(newSpec.components?.securitySchemes || null);
    if (oldRootSec !== newRootSec || oldSecSchemes !== newSecSchemes) {
      changes.push({
        type: 'AUTH_REQUIREMENT_CHANGED',
        severity: 'BREAKING',
        message: 'Global authentication requirements or security schemes were altered'
      });
    }

    // 7. Check for new endpoints and methods (non-breaking additions)
    for (const [pathKey, newPathItem] of Object.entries(newPaths)) {
      if (!oldPaths[pathKey]) {
        changes.push({
          type: 'ADDED_ENDPOINT',
          severity: 'NON_BREAKING',
          path: pathKey,
          message: `New endpoint "${pathKey}" added to specification`
        });
        continue;
      }
      for (const [method] of Object.entries(newPathItem)) {
        if (!oldPaths[pathKey][method]) {
          changes.push({
            type: 'ADDED_METHOD',
            severity: 'NON_BREAKING',
            path: pathKey,
            method: method.toUpperCase(),
            message: `New method ${method.toUpperCase()} added to "${pathKey}"`
          });
        }
      }
    }

    // 8. Check component schema changes (added/removed fields, type changes)
    const oldSchemas = oldSpec.components?.schemas || {};
    const newSchemas = newSpec.components?.schemas || {};

    for (const [schemaName, oldSchemaDef] of Object.entries(oldSchemas)) {
      const newSchemaDef = newSchemas[schemaName];
      if (!newSchemaDef) {
        changes.push({
          type: 'REMOVED_SCHEMA',
          severity: 'BREAKING',
          schema: schemaName,
          message: `Schema component "${schemaName}" was removed`
        });
        continue;
      }

      const oldProps = oldSchemaDef.properties || {};
      const newProps = newSchemaDef.properties || {};

      // Removed response/schema fields
      for (const propName of Object.keys(oldProps)) {
        if (!newProps[propName]) {
          changes.push({
            type: 'REMOVED_FIELD',
            severity: 'BREAKING',
            schema: schemaName,
            field: propName,
            message: `Field "${propName}" was removed from schema "${schemaName}"`
          });
        } else if (oldProps[propName].type !== newProps[propName].type) {
          changes.push({
            type: 'FIELD_TYPE_CHANGED',
            severity: 'BREAKING',
            schema: schemaName,
            field: propName,
            message: `Field "${propName}" type changed from ${oldProps[propName].type} to ${newProps[propName].type} on schema "${schemaName}"`
          });
        }
      }

      // Added required fields
      const oldReq = new Set(oldSchemaDef.required || []);
      const newReq = new Set(newSchemaDef.required || []);
      for (const r of newReq) {
        if (!oldReq.has(r)) {
          changes.push({
            type: 'ADDED_REQUIRED_FIELD',
            severity: 'BREAKING',
            schema: schemaName,
            field: r,
            message: `New required field "${r}" added to schema "${schemaName}"`
          });
        }
      }
    }

    // 9. Fail-closed UNKNOWN_CHANGE detection:
    // If checksums differ but no known rule above triggered, record UNKNOWN_CHANGE as BREAKING
    if (oldChecksum !== newChecksum && changes.length === 0) {
      changes.push({
        type: 'UNKNOWN_CHANGE',
        severity: 'BREAKING',
        message: 'Unclassified specification difference detected; treated as fail-closed breaking drift'
      });
    }

    const isBreaking = changes.some(c => c.severity === 'BREAKING');

    return {
      hasDrift: changes.length > 0,
      isBreaking,
      summary: isBreaking
        ? `Breaking API drift detected (${changes.length} changes)`
        : `Non-breaking API additions detected (${changes.length} changes)`,
      changes,
      oldChecksum,
      newChecksum
    };
  }
}

module.exports = {
  ContractDriftDetector
};
