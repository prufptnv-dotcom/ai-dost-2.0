'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const OPENAPI_VERSION = '3.0.3';

const SENSITIVE_COLUMN_NAMES = new Set([
  'password',
  'password_hash',
  'password_digest',
  'passwd',
  'salt',
  'secret',
  'token',
  'auth_token',
  'refresh_token',
  'api_key',
  'private_key',
  'ssn'
]);

/**
 * Maps SQL/database column types to OpenAPI schema types
 */
function mapSqlTypeToOpenApi(typeStr) {
  if (!typeStr || typeof typeStr !== 'string') return { type: 'string' };
  const lower = typeStr.toLowerCase();

  if (lower.includes('int') || lower.includes('serial')) {
    return { type: 'integer' };
  }
  if (lower.includes('bool')) {
    return { type: 'boolean' };
  }
  if (lower.includes('float') || lower.includes('double') || lower.includes('numeric') || lower.includes('decimal') || lower.includes('real')) {
    return { type: 'number', format: 'float' };
  }
  if (lower.includes('json')) {
    return { type: 'object' };
  }
  if (lower.includes('timestamp') || lower.includes('datetime')) {
    return { type: 'string', format: 'date-time' };
  }
  if (lower.includes('date')) {
    return { type: 'string', format: 'date' };
  }
  if (lower.includes('uuid')) {
    return { type: 'string', format: 'uuid' };
  }

  return { type: 'string' };
}

/**
 * Capitalizes first letter to create component name (e.g. users -> User, items -> Item)
 */
function toComponentName(pluralOrSingular) {
  if (!pluralOrSingular || typeof pluralOrSingular !== 'string') return 'Item';
  const clean = pluralOrSingular.replace(/[^a-zA-Z0-9]/g, '');
  if (!clean) return 'Item';
  let singular = clean;
  if (singular.endsWith('ies')) {
    singular = singular.slice(0, -3) + 'y';
  } else if (singular.endsWith('s') && !singular.endsWith('ss')) {
    singular = singular.slice(0, -1);
  }
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

function sortKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

class OpenApiGenerator {
  /**
   * Statically inspects Express route source code and enforces fail-closed validation
   * against unsupported dynamic routes, complex routers, and ambiguous contracts.
   */
  static inspectRouteSource(sourceCode, filePrefix = '') {
    const unsupportedReasons = [];
    const ambiguousReasons = [];
    const routes = [];

    if (!sourceCode || typeof sourceCode !== 'string') {
      return {
        supported: true,
        status: 'OK',
        code: null,
        routes: [],
        unsupportedReasons: [],
        ambiguousReasons: []
      };
    }

    // 1. Detect dynamic RegExp routes: e.g. router.get(/^\/items/, ...) or router.get(new RegExp(...))
    if (/(?:router|app)\.(?:get|post|put|delete|patch|options|head|all)\s*\(\s*\/(?![/*])/i.test(sourceCode) ||
        /(?:router|app)\.(?:get|post|put|delete|patch|options|head|all)\s*\(\s*new\s+RegExp/i.test(sourceCode)) {
      unsupportedReasons.push('RegExp literal or RegExp dynamic route pattern is unsupported in static contract generation');
    }

    // 2. Detect wildcard / splat routes: e.g. router.get('*', ...) or app.all('/*', ...)
    if (/(?:router|app)\.(?:get|post|put|delete|patch|options|head|all)\s*\(\s*['"`](?:\*|\/\*|.*\*.*)['"`]/i.test(sourceCode)) {
      unsupportedReasons.push('Wildcard or catch-all route pattern ("*", "/*") is unsupported in static contract generation');
    }

    // 3. Detect dynamic / computed path variables: router.get(MY_PATH, ...) or router.get(pathVar, ...)
    const dynamicVarRouteRegex = /(?:router|app)\.(?:get|post|put|delete|patch|options|head)\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,/gi;
    let varMatch;
    while ((varMatch = dynamicVarRouteRegex.exec(sourceCode)) !== null) {
      const identifier = varMatch[1];
      // Exclude string literals or functions
      if (identifier !== 'function' && identifier !== 'async') {
        unsupportedReasons.push(`Dynamic path variable "${identifier}" cannot be statically resolved without execution`);
      }
    }

    // 4. Detect dynamic method invocation: router[methodName](...)
    if (/(?:router|app)\[[a-zA-Z0-9_$]+\]\s*\(/i.test(sourceCode)) {
      unsupportedReasons.push('Dynamic HTTP method dispatch (router[method]) cannot be statically introspected');
    }

    // 5. Detect complex / dynamic router mounts: app.use(getDynamicRouter()) or router.use(prefixVar, ...)
    const dynamicMountRegex = /(?:router|app)\.use\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/gi;
    let mountMatch;
    while ((mountMatch = dynamicMountRegex.exec(sourceCode)) !== null) {
      unsupportedReasons.push(`Dynamic router mount with variable prefix "${mountMatch[1]}" cannot be statically resolved`);
    }

    // If unsupported dynamic patterns detected, fail-closed immediately
    if (unsupportedReasons.length > 0) {
      return {
        supported: false,
        status: 'UNSUPPORTED',
        code: 'UNSUPPORTED_DYNAMIC_ROUTE',
        routes: [],
        unsupportedReasons,
        ambiguousReasons: [],
        message: `Unsupported dynamic route pattern detected: ${unsupportedReasons.join('; ')}`
      };
    }

    // 6. Detect router mounts (e.g. app.use('/api/v1', router) or router.use('/prefix', subRouter))
    const mountMatches = sourceCode.matchAll(/(?:app|router)\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*([a-zA-Z0-9_$]+)/g);
    const mounts = {};
    for (const match of mountMatches) {
      const prefix = match[1];
      const routerVar = match[2];
      mounts[routerVar] = prefix;
    }

    // 7. Detect route definitions: router.get('/items/:id', ...) or app.post(...)
    const routeRegex = /(router|app)\.(get|post|put|delete|patch|options|head)\(\s*['"`]([^'"`]+)['"`]/gi;
    let match;
    const seenMethodPaths = new Map();

    while ((match = routeRegex.exec(sourceCode)) !== null) {
      const routerVar = match[1];
      const method = match[2].toLowerCase();
      const rawPath = match[3];

      let fullPath = rawPath;
      const mountPrefix = mounts[routerVar] || filePrefix || '';
      if (mountPrefix) {
        const cleanMount = mountPrefix.endsWith('/') ? mountPrefix.slice(0, -1) : mountPrefix;
        const cleanSub = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
        fullPath = `${cleanMount}${cleanSub}`;
      }

      // Ensure leading slash
      if (!fullPath.startsWith('/')) fullPath = `/${fullPath}`;

      // Check for ambiguous conflicting duplicate definitions on exact same method + path
      const routeKey = `${method}:${fullPath}`;
      if (seenMethodPaths.has(routeKey)) {
        ambiguousReasons.push(`Ambiguous route definition: duplicate conflicting handler found for ${method.toUpperCase()} ${fullPath}`);
      }
      seenMethodPaths.set(routeKey, true);

      // Convert Express :param to OpenAPI {param}
      const openapiPath = fullPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

      // Extract path parameters
      const pathParamMatches = fullPath.matchAll(/:([a-zA-Z0-9_]+)/g);
      const parameters = [];
      for (const pMatch of pathParamMatches) {
        parameters.push({
          name: pMatch[1],
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `Path parameter ${pMatch[1]}`
        });
      }

      // Infer summary and operationId
      const pathParts = openapiPath.split('/').filter(Boolean);
      const lastResource = pathParts.find(p => !p.startsWith('{')) || 'resource';
      const isParam = openapiPath.endsWith('}');

      let operationId = `${method}${toComponentName(lastResource)}`;
      if (isParam) operationId += 'ById';

      routes.push({
        method,
        path: openapiPath,
        operationId,
        parameters,
        summary: `${method.toUpperCase()} ${openapiPath}`,
        hasRequestBody: ['post', 'put', 'patch'].includes(method),
        resourceName: lastResource
      });
    }

    if (ambiguousReasons.length > 0) {
      return {
        supported: false,
        status: 'AMBIGUOUS_CONTRACT',
        code: 'AMBIGUOUS_CONTRACT',
        routes: [],
        unsupportedReasons: [],
        ambiguousReasons,
        message: `Ambiguous route contract detected: ${ambiguousReasons.join('; ')}`
      };
    }

    return {
      supported: true,
      status: 'OK',
      code: null,
      routes,
      unsupportedReasons: [],
      ambiguousReasons: []
    };
  }

  /**
   * Statically parses an Express route file content into route descriptors without eval.
   * Fails closed if unsupported dynamic routes or ambiguous contracts are present.
   */
  static parseRouteSource(sourceCode, filePrefix = '', options = {}) {
    const inspection = OpenApiGenerator.inspectRouteSource(sourceCode, filePrefix);
    if (!inspection.supported) {
      const err = new Error(inspection.message);
      err.status = inspection.status;
      err.code = inspection.code;
      err.unsupportedReasons = inspection.unsupportedReasons;
      err.ambiguousReasons = inspection.ambiguousReasons;
      throw err;
    }
    return inspection.routes;
  }

  /**
   * Generates a complete OpenAPI 3.0.3 specification object
   */
  static generateSpec(plan) {
    const title = plan.projectId ? `${plan.projectId} API` : 'AI-Dost Integrated API';
    const description = 'Auto-generated OpenAPI 3.0.3 contract synthesized by AI-Dost 2.0 (Phase 4D)';

    const spec = {
      openapi: OPENAPI_VERSION,
      info: {
        title,
        version: '1.0.0',
        description
      },
      servers: [
        {
          url: plan.baseUrl || '/api',
          description: 'API base server URL'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Optional Bearer token for authorized requests'
          }
        }
      }
    };

    // 1. Gather all route descriptors from plan or file parsing
    let routes = [];
    if (Array.isArray(plan.routeDescriptors) && plan.routeDescriptors.length > 0) {
      routes = plan.routeDescriptors.map(r => {
        const rawPath = String(r.path || '/');
        const openapiPath = rawPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
        let parameters = Array.isArray(r.parameters) ? r.parameters.slice() : [];
        if (parameters.length === 0) {
          const pathParamMatches = openapiPath.matchAll(/{([a-zA-Z0-9_]+)}/g);
          for (const m of pathParamMatches) {
            parameters.push({
              name: m[1],
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: `Path parameter ${m[1]}`
            });
          }
        }
        return Object.assign({}, r, {
          method: String(r.method || 'get').toLowerCase(),
          path: openapiPath,
          parameters
        });
      });
    } else if (Array.isArray(plan.routeFiles) && plan.routeFiles.length > 0) {
      for (const file of plan.routeFiles) {
        if (typeof file === 'string') {
          // If file content passed directly
          if (file.includes('router.') || file.includes('app.')) {
            routes.push(...OpenApiGenerator.parseRouteSource(file));
          } else {
            // Read from filesystem if path exists
            const resolved = plan.workspacePath ? path.resolve(plan.workspacePath, file) : path.resolve(file);
            if (fs.existsSync(resolved)) {
              try {
                const content = fs.readFileSync(resolved, 'utf8');
                routes.push(...OpenApiGenerator.parseRouteSource(content));
              } catch {
                // Ignore read errors
              }
            }
          }
        }
      }
    }

    // Default smoke route if no routes discovered
    if (routes.length === 0) {
      routes.push(
        {
          method: 'get',
          path: '/api/health',
          operationId: 'getHealth',
          summary: 'Health Check Endpoint',
          parameters: [],
          hasRequestBody: false,
          resourceName: 'health'
        },
        {
          method: 'get',
          path: '/api/items',
          operationId: 'listItems',
          summary: 'List Items',
          parameters: [],
          hasRequestBody: false,
          resourceName: 'items'
        },
        {
          method: 'post',
          path: '/api/items',
          operationId: 'createItem',
          summary: 'Create Item',
          parameters: [],
          hasRequestBody: true,
          resourceName: 'items'
        }
      );
    }

    // 2. Build component schemas from Phase 4B database metadata if present
    if (plan.schemaMetadata && Array.isArray(plan.schemaMetadata.tables)) {
      for (const table of plan.schemaMetadata.tables) {
        const componentName = toComponentName(table.name);
        const properties = {};
        const required = [];

        if (Array.isArray(table.columns)) {
          for (const col of table.columns) {
            const colName = col.name;
            // SECURITY GUARD: Never expose sensitive/internal columns in public schemas
            if (SENSITIVE_COLUMN_NAMES.has(colName.toLowerCase())) {
              continue;
            }

            properties[colName] = mapSqlTypeToOpenApi(col.type);
            if (col.required || col.primaryKey || col.notNull) {
              required.push(colName);
            }
          }
        }

        spec.components.schemas[componentName] = {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined
        };
      }
    }

    // Deduplicate and group routes by path and method
    const sortedRoutes = routes.slice().sort((a, b) => {
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      return a.method.localeCompare(b.method);
    });

    for (const r of sortedRoutes) {
      const p = r.path.startsWith('/') ? r.path : `/${r.path}`;
      if (!spec.paths[p]) {
        spec.paths[p] = {};
      }

      const method = r.method.toLowerCase();
      const compName = toComponentName(r.resourceName);
      const hasSchema = !!spec.components.schemas[compName];

      const operation = {
        summary: r.summary || `${method.toUpperCase()} ${p}`,
        operationId: r.operationId || `${method}${compName}`,
        parameters: Array.isArray(r.parameters) ? r.parameters : [],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: hasSchema ? { $ref: `#/components/schemas/${compName}` } : { type: 'object' }
              }
            }
          },
          '400': {
            description: 'Bad Request / Validation Error'
          },
          '500': {
            description: 'Internal Server Error'
          }
        }
      };

      if (['post', 'put', 'patch'].includes(method)) {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: hasSchema ? { $ref: `#/components/schemas/${compName}` } : { type: 'object' }
            }
          }
        };
        if (method === 'post') {
          operation.responses['201'] = {
            description: 'Created successfully',
            content: {
              'application/json': {
                schema: hasSchema ? { $ref: `#/components/schemas/${compName}` } : { type: 'object' }
              }
            }
          };
        }
      }

      spec.paths[p][method] = operation;
    }

    // 3. Structural OpenAPI validation (fail-fast on malformed specs)
    OpenApiGenerator.validateSpecStructure(spec);

    return spec;
  }

  /**
   * Validates structural integrity of an OpenAPI 3.0 object
   */
  static validateSpecStructure(spec) {
    if (!spec || typeof spec !== 'object') {
      throw new Error('OpenAPI specification must be a valid object');
    }
    if (spec.openapi !== OPENAPI_VERSION) {
      throw new Error(`OpenAPI version must be ${OPENAPI_VERSION}, got ${spec.openapi}`);
    }
    if (!spec.info || !spec.info.title || !spec.info.version) {
      throw new Error('OpenAPI specification must include info.title and info.version');
    }
    if (!spec.paths || typeof spec.paths !== 'object') {
      throw new Error('OpenAPI specification must include paths object');
    }

    // Validate paths and refs
    const knownSchemas = new Set(Object.keys(spec.components?.schemas || {}));

    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      if (!pathKey.startsWith('/')) {
        throw new Error(`OpenAPI path must start with a leading slash: "${pathKey}"`);
      }
      for (const [method, op] of Object.entries(pathItem)) {
        if (!op.responses || typeof op.responses !== 'object' || Object.keys(op.responses).length === 0) {
          throw new Error(`Operation ${method.toUpperCase()} ${pathKey} must define at least one response status code`);
        }

        // Check $ref resolution
        const checkRef = (schemaObj) => {
          if (!schemaObj || typeof schemaObj !== 'object') return;
          if (schemaObj.$ref) {
            const match = schemaObj.$ref.match(/^#\/components\/schemas\/(.+)$/);
            if (match && !knownSchemas.has(match[1])) {
              throw new Error(`Unresolvable $ref: "${schemaObj.$ref}" in ${method.toUpperCase()} ${pathKey}`);
            }
          }
        };

        if (op.requestBody?.content?.['application/json']?.schema) {
          checkRef(op.requestBody.content['application/json'].schema);
        }
        for (const resp of Object.values(op.responses)) {
          if (resp.content?.['application/json']?.schema) {
            checkRef(resp.content['application/json'].schema);
          }
        }
      }
    }
  }

  /**
   * Computes sha256 checksum of an OpenAPI document
   */
  static computeChecksum(spec) {
    const canonical = JSON.stringify(sortKeys(spec));
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }
}

module.exports = {
  OpenApiGenerator,
  OPENAPI_VERSION,
  SENSITIVE_COLUMN_NAMES,
  toComponentName,
  mapSqlTypeToOpenApi
};
