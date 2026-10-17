'use strict';

/**
 * AI-Dost Cross-File Contract Validator
 * Validates consistency across frontend, backend, APIs, data models,
 * imports/exports, routes, environment assumptions, and framework preservation.
 */

const path = require('node:path');

const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'];

/**
 * Resolves a local import specifier to a potential file key in the files map.
 */
function resolveImportPath(importerPath, importSpecifier, fileKeys) {
  if (!importSpecifier.startsWith('.') && !importSpecifier.startsWith('/')) {
    return null; // External package dependency, not local
  }

  const importerDir = path.dirname(importerPath).replaceAll('\\', '/');
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

function parseImportClause(clause) {
  let defaultImport = null;
  const named = [];

  const braceStart = clause.indexOf('{');
  const braceEnd = clause.indexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    const beforeBrace = clause.slice(0, braceStart).replaceAll(',', '').trim();
    if (beforeBrace && /^[\w$]+$/.test(beforeBrace)) {
      defaultImport = beforeBrace;
    }
    const rawNamed = clause.slice(braceStart + 1, braceEnd);
    for (const part of rawNamed.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const asIdx = trimmed.indexOf(' as ');
      const orig = asIdx !== -1 ? trimmed.slice(0, asIdx).trim() : trimmed;
      if (orig) named.push(orig);
    }
  } else if (/^[\w$]+$/.test(clause)) {
    defaultImport = clause;
  }
  return { defaultImport, named };
}

function extractEsImports(source, imports) {
  const esImportRegex = /import\s+([^\r\n;'"]+?)\s+from\s+['"]([^'"\r\n]+)['"]/g;
  let match;
  while ((match = esImportRegex.exec(source)) !== null) {
    const clause = match[1].trim();
    const specifier = match[2].trim();
    const { defaultImport, named } = parseImportClause(clause);
    imports.push({ specifier, defaultImport, named, isRequire: false });
  }
}

/**
 * Extracts imports and named specifiers from source code.
 */
function extractImports(source) {
  const imports = [];
  if (!source || typeof source !== 'string') return imports;

  extractEsImports(source, imports);

  // CommonJS requires: const { foo, bar } = require('./specifier') or const foo = require('./specifier')
  const cjsDestructRegex = /(?:const|let|var)\s+\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
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

function extractCjsExports(source, exports) {
  const cjsObjExportsRegex = /module\.exports\s*=\s*\{([^}]+)\}/g;
  let match;
  while ((match = cjsObjExportsRegex.exec(source)) !== null) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(':')[0].trim();
      if (name && /^[\w$]+$/.test(name)) exports.named.add(name);
    }
  }

  const cjsNamedExportsRegex = /exports\.([\w$]+)\s*=/g;
  while ((match = cjsNamedExportsRegex.exec(source)) !== null) {
    exports.named.add(match[1]);
  }
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

  if (/export\s+default\b/.test(source) || /module\.exports\s*=\s*[\w$]+/.test(source)) {
    exports.hasDefault = true;
  }

  const namedExportRegex = /export\s+(?:const|let|var|function\*?|class|async\s+function\*?)\s+([\w$]+)/g;
  let match;
  while ((match = namedExportRegex.exec(source)) !== null) {
    exports.named.add(match[1]);
  }

  const bracketExportRegex = /export\s+\{([^}]+)\}/g;
  while ((match = bracketExportRegex.exec(source)) !== null) {
    for (const part of match[1].split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const asIdx = trimmed.indexOf(' as ');
      const name = asIdx !== -1 ? trimmed.slice(asIdx + 4).trim() : trimmed;
      if (name) exports.named.add(name);
    }
  }

  extractCjsExports(source, exports);
  return exports;
}

/**
 * Extracts frontend HTTP calls (fetch, axios, apiClient)
 */
function extractFrontendApiCalls(source, filePath) {
  const calls = [];
  if (!source || typeof source !== 'string') return calls;

  const fetchRegex = /\bfetch\s*\(\s*[`'"](\/api\/[^`'"?\s]+)[^,)]*(?:,\s*\{([^}]*)\})?/gi;
  let match;
  while ((match = fetchRegex.exec(source)) !== null) {
    let rawUrl = match[1];
    if (rawUrl?.endsWith('/')) {
      rawUrl = `${rawUrl}:id`;
    }
    const optionsStr = match[2] || '';
    const methodMatch = /method\s*:\s*[`'"]([a-z]+)[`'"]/i.exec(optionsStr);
    const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';
    calls.push({ filePath, url: rawUrl, method });
  }

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

    const codeWithoutComments = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const expressRegex = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"](\/api\/[^'"]+)['"]/gi;
    let match;
    while ((match = expressRegex.exec(codeWithoutComments)) !== null) {
      routes.push({
        filePath,
        method: match[1].toUpperCase(),
        path: match[2]
      });
    }

    if (filePath.includes('api/') && /route\.[jt]sx?$/.test(filePath)) {
      const matchNextRoute = /(?:src\/)?app(\/api\/.+?)\/route\.[jt]sx?$/.exec(filePath);
      if (matchNextRoute) {
        const routePath = matchNextRoute[1];
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        for (const m of methods) {
          const fnRegex = new RegExp(String.raw`export\s+(?:async\s+)?function\s+${m}\b`);
          if (fnRegex.test(content)) {
            routes.push({ filePath, method: m, path: routePath });
          }
        }
      }
    }

    if (filePath.includes('pages/api/')) {
      const matchPages = /(?:src\/)?pages(\/api\/.+?)(?:\/index)?\.[jt]sx?$/.exec(filePath);
      if (matchPages) {
        routes.push({ filePath, method: 'ANY', path: matchPages[1] });
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
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.react) frameworks.add('react');
        if (deps.next) frameworks.add('nextjs');
        if (deps.vue) frameworks.add('vue');
        if (deps['@angular/core']) frameworks.add('angular');
        if (deps.svelte || deps['@sveltejs/kit']) frameworks.add('svelte');
        if (deps.astro || deps['@astrojs/compiler']) frameworks.add('astro');
      } catch (_err) {
        // Ignore JSON parsing errors in malformed package manifests
      }
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

function validateFileImports(filePath, content, fileKeys, fileExports, dependencyGraph, errors, stats) {
  const stripped = content.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').trim();
  if (stripped.length === 0) {
    errors.push(`EMPTY_STUB_FILE: '${filePath}' is empty or contains only comments with no executable implementation.`);
    return;
  }

  if (!dependencyGraph.has(filePath)) dependencyGraph.set(filePath, []);

  const imports = extractImports(content);
  for (const imp of imports) {
    if (!imp.specifier.startsWith('.') && !imp.specifier.startsWith('/')) {
      continue; // Third-party package
    }

    stats.importsChecked++;
    const resolvedTarget = resolveImportPath(filePath, imp.specifier, fileKeys);
    if (!resolvedTarget) {
      errors.push(`MISSING_LOCAL_FILE: '${filePath}' imports from '${imp.specifier}', but target file does not exist.`);
      continue;
    }

    dependencyGraph.get(filePath).push(resolvedTarget);

    const targetExports = fileExports.get(resolvedTarget);
    if (targetExports) {
      if (imp.defaultImport && !targetExports.hasDefault && targetExports.named.size > 0) {
        const available = Array.from(targetExports.named).join(', ');
        errors.push(`MISSING_DEFAULT_EXPORT: '${filePath}' imports default '${imp.defaultImport}' from '${imp.specifier}', but '${resolvedTarget}' only exports named: [${available}].`);
      }

      stats.exportsChecked += imp.named.length;
      for (const named of imp.named) {
        if (!targetExports.named.has(named)) {
          errors.push(`MISSING_NAMED_EXPORT: '${filePath}' imports '${named}' from '${imp.specifier}', but '${named}' is not exported by '${resolvedTarget}'.`);
        }
      }
    }
  }
}

function detectCircularImports(dependencyGraph, warnings) {
  const visited = new Set();
  function detectCycle(node, pathStack = []) {
    pathStack.push(node);
    for (const neighbor of dependencyGraph.get(node) || []) {
      if (pathStack.includes(neighbor)) {
        const cyclePath = [...pathStack.slice(pathStack.indexOf(neighbor)), neighbor].join(' -> ');
        warnings.push(`CIRCULAR_IMPORT_CYCLE: Circular import detected across files: ${cyclePath}`);
      } else if (!visited.has(neighbor)) {
        detectCycle(neighbor, pathStack);
      }
    }
    pathStack.pop();
    visited.add(node);
  }
  for (const node of dependencyGraph.keys()) {
    if (!visited.has(node)) detectCycle(node);
  }
}

function validateFrontendApis(files, frontendCalls, errors, stats) {
  if (frontendCalls.length === 0) return;
  const backendRoutes = extractBackendRoutes(files);
  const hasBackendFiles = Object.keys(files).some((f) => f.startsWith('backend/') || f.startsWith('server/') || f.includes('server.js') || f.includes('/api/'));

  if (!hasBackendFiles || backendRoutes.length === 0) return;

  for (const call of frontendCalls) {
    stats.apiCallsChecked++;
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
  const stats = { importsChecked: 0, exportsChecked: 0, apiCallsChecked: 0 };

  const fileExports = new Map();
  for (const [filePath, content] of Object.entries(files)) {
    if (/\.[jt]sx?$/i.test(filePath)) {
      fileExports.set(filePath, extractExports(content));
    }
  }

  const dependencyGraph = new Map();
  for (const [filePath, content] of Object.entries(files)) {
    if (/\.[jt]sx?$/i.test(filePath)) {
      validateFileImports(filePath, content, fileKeys, fileExports, dependencyGraph, errors, stats);
    }
  }

  detectCircularImports(dependencyGraph, warnings);

  // Check for unreferenced components
  const allImportedTargets = new Set();
  for (const targets of dependencyGraph.values()) {
    for (const t of targets) allImportedTargets.add(t);
  }
  for (const filePath of fileKeys) {
    if (filePath.includes('src/components/') && /\.[jt]sx?$/i.test(filePath)) {
      if (!allImportedTargets.has(filePath)) {
        warnings.push(`UNREFERENCED_COMPONENT: Component '${filePath}' is defined in src/components/ but never imported in any view.`);
      }
    }
  }

  // Check for CSS stylesheet linkage
  const cssFiles = Array.from(fileKeys).filter((f) => f.endsWith('.css'));
  if (cssFiles.length > 0) {
    const allFileContents = Object.values(files).join('\n');
    for (const cssFile of cssFiles) {
      const baseName = path.basename(cssFile);
      if (!allFileContents.includes(baseName)) {
        warnings.push(`UNLINKED_STYLESHEET: Stylesheet '${cssFile}' exists but does not appear to be imported in any JavaScript/TypeScript file.`);
      }
    }
  }

  const frontendCalls = [];
  for (const [filePath, content] of Object.entries(files)) {
    const isFrontend = filePath.startsWith('src/') || filePath.startsWith('frontend/') || filePath.startsWith('web/') || filePath.startsWith('client/') || /App\.[jt]sx?$/.test(filePath);
    if (isFrontend) {
      frontendCalls.push(...extractFrontendApiCalls(content, filePath));
    }
  }
  validateFrontendApis(files, frontendCalls, errors, stats);

  if (options.existingFramework && !options.allowFrameworkMigration) {
    const introduced = detectIntroducedFrameworks(files);
    const existing = options.existingFramework.toLowerCase();
    for (const fw of introduced) {
      const isReactViolation = existing === 'react' && (fw === 'vue' || fw === 'angular' || fw === 'svelte');
      const isVueViolation = existing === 'vue' && (fw === 'react' || fw === 'angular');
      if (isReactViolation || isVueViolation) {
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
      importsChecked: stats.importsChecked,
      exportsChecked: stats.exportsChecked,
      apiCallsChecked: stats.apiCallsChecked
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

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const taskA = tasks[i];
      const taskB = tasks[j];
      const filesA = Array.isArray(taskA.files) ? taskA.files : [];
      const filesB = Array.isArray(taskB.files) ? taskB.files : [];

      const shared = filesA.filter((f) => filesB.includes(f));
      if (shared.length > 0) {
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
