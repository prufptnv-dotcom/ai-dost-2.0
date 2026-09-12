'use strict';

class ContractValidatorGenerator {
  /**
   * Generates a zero-dependency pure JavaScript runtime payload validator
   */
  static generateJsValidators(spec) {
    const schemas = spec.components?.schemas || {};
    const schemasJson = JSON.stringify(schemas, null, 2);

    return `/**
 * AI-Dost 2.0 Auto-Generated Runtime Contract Validators (Phase 4D)
 * Zero external dependencies — pure JavaScript schema validation
 */

/* AI-DOST-AUTO-GENERATED: START */

export const SCHEMAS = ${schemasJson};

/**
 * Validates a payload object against an OpenAPI component schema definition
 * @param {string} schemaName - Name of the component schema (e.g. 'Item', 'User')
 * @param {Record<string, any>} payload - Data object to validate
 * @param {Object} [options]
 * @param {boolean} [options.strict=false] - Reject unknown properties
 * @returns {{ valid: boolean, errors: string[], sanitized: Record<string, any> }}
 */
export function validate(schemaName, payload, options = {}) {
  const schema = SCHEMAS[schemaName];
  if (!schema) {
    return { valid: true, errors: [], sanitized: payload || {} };
  }

  const errors = [];
  const sanitized = {};

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      errors: [\`Payload for \${schemaName} must be a non-null object\`],
      sanitized: {}
    };
  }

  // Security: block prototype pollution keys
  for (const dangerousKey of ['__proto__', 'constructor', 'prototype']) {
    if (Object.prototype.hasOwnProperty.call(payload, dangerousKey)) {
      errors.push(\`Forbidden security attribute detected: "\${dangerousKey}"\`);
    }
  }

  const properties = schema.properties || {};
  const requiredFields = new Set(schema.required || []);

  // 1. Check required fields
  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null) {
      errors.push(\`Missing required field: "\${field}" in \${schemaName}\`);
    }
  }

  // 2. Check property types & sanitize
  for (const [key, val] of Object.entries(payload)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

    const propDef = properties[key];
    if (!propDef) {
      if (options.strict) {
        errors.push(\`Unknown property "\${key}" is not permitted on \${schemaName}\`);
      } else {
        sanitized[key] = val;
      }
      continue;
    }

    if (val !== undefined && val !== null) {
      const expectedType = propDef.type;
      const actualType = Array.isArray(val) ? 'array' : typeof val;

      if (expectedType === 'integer') {
        if (typeof val !== 'number' || !Number.isInteger(val)) {
          errors.push(\`Field "\${key}" must be an integer, received \${typeof val} (\${val})\`);
        }
      } else if (expectedType === 'number') {
        if (typeof val !== 'number' || Number.isNaN(val)) {
          errors.push(\`Field "\${key}" must be a number, received \${typeof val}\`);
        }
      } else if (expectedType === 'boolean') {
        if (typeof val !== 'boolean') {
          errors.push(\`Field "\${key}" must be a boolean, received \${typeof val}\`);
        }
      } else if (expectedType === 'string') {
        if (typeof val !== 'string') {
          errors.push(\`Field "\${key}" must be a string, received \${typeof val}\`);
        } else if (propDef.format === 'date-time' && isNaN(Date.parse(val))) {
          errors.push(\`Field "\${key}" must be a valid ISO date-time string\`);
        }
      } else if (expectedType === 'array') {
        if (!Array.isArray(val)) {
          errors.push(\`Field "\${key}" must be an array\`);
        }
      } else if (expectedType === 'object') {
        if (typeof val !== 'object' || Array.isArray(val)) {
          errors.push(\`Field "\${key}" must be an object\`);
        }
      }
    }

    sanitized[key] = val;
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/* AI-DOST-AUTO-GENERATED: END */
`;
  }

  /**
   * Generates Zod schema validators when Zod is installed in the workspace
   */
  static generateZodValidators(spec) {
    const schemas = spec.components?.schemas || {};
    const schemaDefs = [];

    for (const [name, def] of Object.entries(schemas)) {
      const props = def.properties || {};
      const required = new Set(def.required || []);
      const lines = [];

      for (const [propName, propDef] of Object.entries(props)) {
        let zodType = 'z.any()';
        if (propDef.type === 'string') {
          zodType = propDef.format === 'date-time' ? 'z.string().datetime()' : 'z.string()';
        } else if (propDef.type === 'integer') {
          zodType = 'z.number().int()';
        } else if (propDef.type === 'number') {
          zodType = 'z.number()';
        } else if (propDef.type === 'boolean') {
          zodType = 'z.boolean()';
        } else if (propDef.type === 'array') {
          zodType = 'z.array(z.any())';
        } else if (propDef.type === 'object') {
          zodType = 'z.record(z.any())';
        }

        if (!required.has(propName)) {
          zodType += '.optional()';
        }
        lines.push(`  ${propName}: ${zodType}`);
      }

      schemaDefs.push(`export const ${name}Schema = z.object({\n${lines.join(',\n')}\n});`);
    }

    return `/**
 * AI-Dost 2.0 Auto-Generated Zod Validators (Phase 4D)
 * Requires 'zod' package
 */

/* AI-DOST-AUTO-GENERATED: START */

import { z } from 'zod';

${schemaDefs.join('\n\n')}

/* AI-DOST-AUTO-GENERATED: END */
`;
  }
}

module.exports = {
  ContractValidatorGenerator
};
