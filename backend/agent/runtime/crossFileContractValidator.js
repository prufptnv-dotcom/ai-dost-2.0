'use strict';

/**
 * AI-Dost Cross-File Contract Validator
 * Validates consistency across frontend, backend, APIs, data models,
 * imports/exports, routes, environment assumptions, and framework preservation.
 */

const path = require('path');

const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'];

/**
 * Resolves a local import specifier to a potential file key in the files map.
 */
function resolveImportPath(importerPath, importSpecifier, fileKeys) {
  if (!importSpecifier.startsWith('.') && !importSpecifier.startsWith('/')) {
    return null; // External package dependency, not local
  }

  const importerDir = path.dirname(importerPath).replace(/\\/g, '/');
  let target = path.posix.normalize(path.posix.join(importerDir, importSpecifier));
  if (target.startsWith('./')) target = target.slice(2);

  // Exact match
  if (fileKeys.has(target)) return target;

  // Try with supported extensions
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (fileKeys.has(`${target}${ext}`)) return `${target}${ext}`;
  }

  // Try index files
  for (const ext of SUPPORTED_EXTENSIONS) {
    const indexTarget = path.posix.join(target, `index${ext}`);
    if (fileKeys.has(indexTarget)) return indexTarget;
  }

  return null;
}

/**
 * Extracts imports and named specifiers from source code.
 */
function extractImports(source) {
  const imports = [];
  if (!source || typeof source !== 'string') return imports;

  // ES module imports: import Default, { named1, named2 as alias } from './specifier'
  const esImportRegex = /import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]+)\})?\s*(?:from\s*)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = esImportRegex.exec(source)) !== null) {
    const defaultImport = match[1] ? match[1].trim() : null;
    const rawNamed = match[2];
    const specifier = match[3];
    const named = [];
    if (rawNamed) {
      for (const part of rawNamed.split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const [orig] = trimmed.split(/\s+as\s+/);
        named.push(orig.trim());
      }
    }
    imports.push({ specifier, defaultImport, named, isRequire: false });
  }

  // CommonJS requires: const { foo, bar } = require('./specifier') or const foo = require('./specifier')
  const cjsDestructRegex = /(?:const|let|var)\s+\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjsDestructRegex.exec(source)) !== null) {
    const rawNamed = match[1];
    const specifier = match[2];
    const named = rawNamed.split(',').map((p) => p.trim().split(':')[0].trim()).filter(Boolean);
    imports.push({ specifier, defaultImport: null, named, isRequire: true });
  }

  const cjsDefaultRegex = /(?:const|let|var)\s+([\w$]+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjsDefaultRegex.exec(source)) !== null) {
    const defaultImport = match[1];
    const specifier = match[2];
    imports.push({ specifier, defaultImport, named: [], isRequire: true });
  }

  return imports;
}

/**
 * Extracts declared exports from a file's source code.
 */
function extractExports(source) {
  const exports = {
    hasDefault: false,
    named: new Set()
  };
  if (!source || typeof source !== 'string') return exports;

  // export default ...
  if (/export\s+default\b/.test(source) || /module\.exports\s*=\s*[\w$]+/.test(source)) {
    exports.hasDefault = true;
  }

  // export const/let/var/function/class foo
  const namedExportRegex = /export\s+(?:const|let|var|function\*?|class|async\s+function\*?)\s+([\w$]+)/g;
  let match;
  while ((match = namedExportRegex.exec(source)) !== null) {
    exports.named.add(match[1]);
  }

  // export { foo, bar as baz }
  const bracketExportRegex = /export\s+\{([^}]+)\}/g;
  while ((match = bracketExportRegex.exec(source)) !== null) {
    const raw = match[1];
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+as\s+/);
      const name = (parts[1] || parts[0]).trim();
      exports.named.add(name);
    }
  }

  // module.exports = { foo, bar }
  const cjsObjExportsRegex = /module\.exports\s*=\s*\{([^}]+)\}/g;
  while ((match = cjsObjExportsRegex.exec(source)) !== null) {
    const raw = match[1];
    for (const part of raw.split(',')) {
      const name = part.trim().split(':')[0].trim();
      if (name && /^[\w$]+$/.test(name)) exports.named.add(name);
    }
  }

  // exports.foo = ...
  const cjsNamedExportsRegex = /exports\.([\w$]+)\s*=/g;
  while ((match = cjsNamedExportsRegex.exec(source)) !== null) {
    exports.named.add(match[1]);
  }

  return exports;
}

/**
 * Extracts frontend HTTP calls (fetch, axios, apiClient)
 */
function extractFrontendApiCalls(source, filePath) {
  const calls = [];
  if (!source || typeof source !== 'string') return calls;

  // fetch('/api/...') or fetch(`/api/...`)
  const fetchRegex = /fetch\s*\(\s*[`'"](\/api\/[^`'"?\s]+)[^`'"]*[`'"](?:\s*,\s*([\s\S]*?))?\)/gi;
  let match;
  while ((match = fetchRegex.exec(source)) !== null) {
    const rawUrl = match[1];
    const optionsStr = match[2] || '';
    const methodMatch = optionsStr.match(/method\s*:\s*[`'"]([A-Za-z]+)[`'"]/i);
    const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';
    calls.push({ filePath, url: rawUrl, method });
  }

  // axios.get/post/put/delete('/api/...')
  const axiosRegex = /(?:axios|apiClient|client|api)\.(get|post|put|delete|patch)\s*\(\s*[`'"](\/api\/[^`'"]*)[`'"]/gi;
  while ((match = axiosRegex.exec(source)) !== null) {
    const method = match[1].toUpperCase();
    const rawUrl = match[2].split('?')[0];
    calls.push({ filePath, url: rawUrl, method });
  }

  return calls;
}

/**
 * Extracts backend route definitions from Express, Next.js, or server files.
 */
function extractBackendRoutes(files) {
  const routes = [];

  for (const [filePath, content] of Object.entries(files)) {
    if (!content || typeof content !== 'string') continue;

    // Strip comments to ignore commented-out routes
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    // Express style: app.get('/api/users', ...), router.post('/api/auth/login', ...)
    const expressRegex = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"](\/api\/[^'"]+)['"]/gi;
    let match;
    while ((match = expressRegex.exec(cleanContent)) !== null) {
      routes.push({
        filePath,
        method: match[1].toUpperCase(),
        path: match[2]
      });
    }

    // Next.js App Router style: app/api/items/route.js with export async function GET / POST
    if (filePath.includes('api/') && /route\.[jt]sx?$/.test(filePath)) {
      const matchNextRoute = filePath.match(/(?:src\/)?app(\/api\/.+?)\/route\.[jt]sx?$/);
      if (matchNextRoute) {
        const routePath = matchNextRoute[1];
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        for (const m of methods) {
          const fnRegex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`);
          if (fnRegex.test(content)) {
            routes.push({ filePath, method: m, path: routePath });
          }
        }
      }
    }

    // Next.js Pages Router style: pages/api/items.js
    if (filePath.includes('pages/api/')) {
      const matchPages = filePath.match(/(?:src\/)?pages(\/api\/.+?)(?:\/index)?\.[jt]sx?$/);
      if (matchPages) {
        const routePath = matchPages[1];
        // Handles any method or inspects req.method
        routes.push({ filePath, method: 'ANY', path: routePath });
      }
    }
  }

  return routes;
}

/**
 * Checks route path equivalence allowing for path params like :id or [id]
 */
function routesMatch(calledPath, definedPath) {
  if (calledPath === definedPath) return true;
  const calledParts = calledPath.replace(/^\/|\/$/g, '').split('/');
  const definedParts = definedPath.replace(/^\/|\/$/g, '').split('/');
  if (calledParts.length !== definedParts.length) return false;

  for (let i = 0; i < calledParts.length; i++) {
    const def = definedParts[i];
    const call = calledParts[i];
    if (def.startsWith(':') || (def.startsWith('[') && def.endsWith(']'))) {
      continue; // Param wildcard matches
    }
    if (def !== call) return false;
  }
  return true;
}

/**
 * Detects framework indicator signatures in files.
 */
function detectIntroducedFrameworks(files) {
  const frameworks = new Set();
  for (const [filePath, content] of Object.entries(files)) {
    if (!content) continue;
    if (filePath === 'package.json' || filePath.endsWith('/package.json')) {
      try {
        const pkg = JSON.parse(content);
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps.react) frameworks.add('react');
        if (deps.next) frameworks.add('nextjs');
        if (deps.vue) frameworks.add('vue');
        if (deps['@angular/core']) frameworks.add('angular');
        if (deps.svelte || deps['@sveltejs/kit']) frameworks.add('svelte');
        if (deps.astro || deps['@astrojs/compiler']) frameworks.add('astro');
      } catch (_) {}
    } else {
      if (/\bfrom\s+['"]react['"]/.test(content)) frameworks.add('react');
      if (/\bfrom\s+['"]next\//.test(content)) frameworks.add('nextjs');
      if (/\bfrom\s+['"]vue['"]/.test(content)) frameworks.add('vue');
      if (/\bfrom\s+['"]@angular\//.test(content)) frameworks.add('angular');
      if (/\bfrom\s+['"]svelte['"]/.test(content)) frameworks.add('svelte');
      if (/\bfrom\s+['"]astro\//.test(content)) frameworks.add('astro');
    }
  }
  return frameworks;
}

/**
 * Validates cross-file implementation contracts across all project files.
 * @param {Object} files - Map of relative path -> file content string
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[], metrics: Object }
 */
function validateCrossFileContracts(files = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const fileKeys = new Set(Object.keys(files));

  let importsChecked = 0;
  let exportsChecked = 0;
  let apiCallsChecked = 0;

  // Pre-parse exports for all files
  const fileExports = new Map();
  for (const [filePath, content] of Object.entries(files)) {
    if (/\.[jt]sx?$/i.test(filePath)) {
      fileExports.set(filePath, extractExports(content));
    }
  }

  // 1. Validate Imports vs Exports
  for (const [filePath, content] of Object.entries(files)) {
    if (!/\.[jt]sx?$/i.test(filePath)) continue;

    const imports = extractImports(content);
    for (const imp of imports) {
      if (!imp.specifier.startsWith('.') && !imp.specifier.startsWith('/')) {
        continue; // Third-party package
      }

      importsChecked++;
      const resolvedTarget = resolveImportPath(filePath, imp.specifier, fileKeys);
      if (!resolvedTarget) {
        errors.push(`MISSING_LOCAL_FILE: '${filePath}' imports from '${imp.specifier}', but target file does not exist.`);
        continue;
      }

      const targetExports = fileExports.get(resolvedTarget);
      if (targetExports) {
        exportsChecked += imp.named.length;
        for (const named of imp.named) {
          if (!targetExports.named.has(named)) {
            errors.push(`MISSING_NAMED_EXPORT: '${filePath}' imports '${named}' from '${imp.specifier}', but '${named}' is not exported by '${resolvedTarget}'.`);
          }
        }
      }
    }
  }

  // 2. Validate Frontend API Calls against Backend Routes
  const frontendCalls = [];
  for (const [filePath, content] of Object.entries(files)) {
    const isFrontend = filePath.startsWith('src/') || filePath.startsWith('frontend/') || filePath.startsWith('web/') || filePath.startsWith('client/') || /App\.[jt]sx?$/.test(filePath);
    if (isFrontend) {
      frontendCalls.push(...extractFrontendApiCalls(content, filePath));
    }
  }

  if (frontendCalls.length > 0) {
    const backendRoutes = extractBackendRoutes(files);
    // Only check if backend files are present in the project
    const hasBackendFiles = Object.keys(files).some((f) => f.startsWith('backend/') || f.startsWith('server/') || f.includes('server.js') || f.includes('/api/'));

    if (hasBackendFiles && backendRoutes.length > 0) {
      for (const call of frontendCalls) {
        apiCallsChecked++;
        const matchingRoutes = backendRoutes.filter((r) => routesMatch(call.url, r.path));
        if (matchingRoutes.length === 0) {
          errors.push(`MISSING_API_ROUTE: Frontend in '${call.filePath}' calls '${call.method} ${call.url}', but no backend route handler exists.`);
        } else {
          const methodMatch = matchingRoutes.some((r) => r.method === 'ANY' || r.method === call.method);
          if (!methodMatch) {
            const available = matchingRoutes.map((r) => r.method).join(', ');
            errors.push(`API_METHOD_MISMATCH: Frontend in '${call.filePath}' calls '${call.method} ${call.url}', but backend only implements [${available}].`);
          }
        }
      }
    }
  }

  // 3. Framework Preservation Check
  if (options.existingFramework && !options.allowFrameworkMigration) {
    const introduced = detectIntroducedFrameworks(files);
    const existing = options.existingFramework.toLowerCase();
    for (const fw of introduced) {
      // React and Next.js are sometimes mixed in migration, but Vue/Angular/Svelte in a React project is a violation
      if (existing === 'react' && (fw === 'vue' || fw === 'angular' || fw === 'svelte')) {
        errors.push(`FRAMEWORK_VIOLATION: Workspace framework is '${options.existingFramework}', but files introduce incompatible '${fw}'.`);
      } else if (existing === 'vue' && (fw === 'react' || fw === 'angular')) {
        errors.push(`FRAMEWORK_VIOLATION: Workspace framework is '${options.existingFramework}', but files introduce incompatible '${fw}'.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      totalFiles: fileKeys.size,
      importsChecked,
      exportsChecked,
      apiCallsChecked
    }
  };
}

/**
 * Validates task file ownership to prevent uncoordinated concurrent overwrites.
 * @param {Array<Object>} tasks - List of planned tasks
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function checkTaskFileCollisions(tasks = []) {
  const errors = [];
  if (!Array.isArray(tasks) || tasks.length <= 1) return { valid: true, errors };

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Check all pairs of tasks that touch the same file
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const taskA = tasks[i];
      const taskB = tasks[j];
      const filesA = Array.isArray(taskA.files) ? taskA.files : [];
      const filesB = Array.isArray(taskB.files) ? taskB.files : [];

      const shared = filesA.filter((f) => filesB.includes(f));
      if (shared.length > 0) {
        // Must have an explicit dependency order (either A depends on B or B depends on A)
        const aDependsOnB = (taskA.dependsOn || []).includes(taskB.id);
        const bDependsOnA = (taskB.dependsOn || []).includes(taskA.id);

        if (!aDependsOnB && !bDependsOnA) {
          errors.push(`UNCOORDINATED_FILE_WRITE: Task '${taskA.id}' and Task '${taskB.id}' both modify [${shared.join(', ')}] without an explicit dependency order.`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateCrossFileContracts,
  checkTaskFileCollisions,
  extractImports,
  extractExports,
  extractFrontendApiCalls,
  extractBackendRoutes,
  resolveImportPath
};
