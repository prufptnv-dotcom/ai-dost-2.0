'use strict';

/**
 * AI-Dost Workspace & Framework Intelligence Service
 * Deeply inspects repository structure, monorepos, nested manifests, lockfiles,
 * installed frameworks vs build tools, icon systems, styling tokens, and conventions.
 */

const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  '.turbo', '.output', '.cache', 'venv', '.venv', '__pycache__',
  'coverage', '.idea', '.vscode'
]);

class WorkspaceFrameworkIntelligence {
  /**
   * Deeply inspects a workspace directory and derives bounded, framework-aware context.
   * @param {string} workspacePath - Absolute path to workspace root
   * @param {Object} [options] - User preferences and explicit overrides
   * @param {string} [options.preferredFramework] - Explicit user requested framework
   * @returns {Object} Comprehensive workspace context
   */
  inspectWorkspace(workspacePath, options = {}) {
    if (!workspacePath || typeof workspacePath !== 'string' || !fs.existsSync(workspacePath)) {
      return this._defaultResult(options);
    }

    try {
      const manifests = this._findManifests(workspacePath, workspacePath, 4);
      const isMonorepo = manifests.length > 1;

      // Group manifests into root, frontend, backend
      const { rootManifest, frontendManifest, backendManifest } = this._classifyManifests(manifests);

      // Primary manifest for analysis
      const primaryManifest = frontendManifest || rootManifest || backendManifest || manifests[0];

      // Detect frameworks, build tools, libraries
      const detectedFrontend = this._detectFrontendFramework(manifests, workspacePath);
      const detectedBackend = this._detectBackendFramework(manifests, workspacePath);
      const detectedBuildTool = this._detectBuildTool(manifests, workspacePath);
      const iconSystem = this._detectIconSystem(manifests);
      const stylingSystem = this._detectStylingSystem(manifests, workspacePath);
      const stateManagement = this._detectStateManagement(manifests);
      const testingFramework = this._detectTestingFramework(manifests);

      // User explicit framework override takes precedence unless incompatible
      let effectiveFramework = detectedFrontend.framework || detectedBackend.framework || 'vanilla-html';
      if (options.preferredFramework) {
        effectiveFramework = options.preferredFramework;
      } else if (options.framework) {
        effectiveFramework = options.framework;
      }

      // Detect language and package manager
      const language = this._detectPrimaryLanguage(manifests, workspacePath);
      const packageManager = this._detectPackageManager(workspacePath);
      const databaseAndOrm = this._discoverDatabaseAndOrm(manifests, workspacePath);
      const existingRoutes = this._discoverExistingRoutesAndEndpoints(workspacePath);
      const codeConventions = this._discoverCodeConventions(workspacePath);
      const conflictingModules = this._detectConflictingModules(manifests);

      // Gather important scripts from primary manifest
      const scripts = primaryManifest?.parsed?.scripts || {};

      const summary = {
        isMonorepo,
        architecture: isMonorepo ? 'monorepo-nested' : 'single-project',
        effectiveFramework,
        userOverrideApplied: Boolean(options.preferredFramework || options.framework),
        frontend: detectedFrontend,
        backend: detectedBackend,
        buildTool: detectedBuildTool,
        language,
        packageManager,
        iconSystem,
        stylingSystem,
        stateManagement,
        testingFramework,
        databaseAndOrm,
        existingRoutes,
        codeConventions,
        conflictingModules,
        scripts,
        manifestLocations: manifests.map((m) => m.relativePath).filter(Boolean),
        dependencies: this._summarizeDependencies(manifests)
      };

      return {
        ...summary,
        promptDirective: this.buildPromptDirective(summary)
      };
    } catch (err) {
      return this._defaultResult(options, err.message);
    }
  }

  _defaultResult(options = {}, errorMsg = null) {
    const fw = options.preferredFramework || options.framework || 'react-vite';
    const def = {
      isMonorepo: false,
      architecture: 'single-project',
      effectiveFramework: fw,
      userOverrideApplied: Boolean(options.preferredFramework || options.framework),
      frontend: { framework: fw, version: null },
      backend: { framework: 'none', version: null },
      buildTool: 'vite',
      language: 'javascript',
      packageManager: 'npm',
      iconSystem: 'fontawesome',
      stylingSystem: 'vanilla-css',
      stateManagement: 'react-state',
      testingFramework: 'none',
      scripts: {},
      manifestLocations: [],
      dependencies: {},
      error: errorMsg
    };
    return {
      ...def,
      promptDirective: this.buildPromptDirective(def)
    };
  }

  _findManifests(rootDir, currentDir, maxDepth, currentDepth = 0) {
    if (currentDepth > maxDepth) return [];
    let results = [];
    let entries = [];

    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return [];
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (entry.isFile()) {
        if (entry.name === 'package.json') {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const parsed = JSON.parse(content);
            results.push({
              type: 'npm',
              name: entry.name,
              fullPath,
              relativePath,
              parsed
            });
          } catch (_) {
            results.push({ type: 'npm', name: entry.name, fullPath, relativePath, parsed: null });
          }
        } else if (entry.name === 'requirements.txt' || entry.name === 'pyproject.toml') {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            results.push({ type: 'python', name: entry.name, fullPath, relativePath, content });
          } catch (_) {}
        } else if (entry.name === 'pom.xml' || entry.name === 'build.gradle') {
          results.push({ type: 'java', name: entry.name, fullPath, relativePath });
        } else if (entry.name === 'go.mod') {
          results.push({ type: 'go', name: entry.name, fullPath, relativePath });
        } else if (entry.name === 'Cargo.toml') {
          results.push({ type: 'rust', name: entry.name, fullPath, relativePath });
        }
      } else if (entry.isDirectory() && currentDepth < maxDepth) {
        results = results.concat(this._findManifests(rootDir, fullPath, maxDepth, currentDepth + 1));
      }
    }
    return results;
  }

  _classifyManifests(manifests) {
    let rootManifest = null;
    let frontendManifest = null;
    let backendManifest = null;

    for (const m of manifests) {
      const lower = m.fullPath.toLowerCase().replace(/\\/g, '/');
      if (lower.includes('/frontend/') || lower.includes('/client/') || lower.includes('/web/') || lower.includes('/ui/')) {
        frontendManifest = m;
      } else if (lower.includes('/backend/') || lower.includes('/server/') || lower.includes('/api/')) {
        backendManifest = m;
      } else if (!rootManifest) {
        rootManifest = m;
      }
    }

    return { rootManifest, frontendManifest, backendManifest };
  }

  _detectFrontendFramework(manifests, workspacePath) {
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = { ...(m.parsed.dependencies || {}), ...(m.parsed.devDependencies || {}) };

        if (deps['next']) {
          const isAppRouter = fs.existsSync(path.join(path.dirname(m.fullPath), 'app')) || fs.existsSync(path.join(path.dirname(m.fullPath), 'src/app'));
          return { framework: 'nextjs', version: deps['next'], routing: isAppRouter ? 'app-router' : 'pages-router' };
        }
        if (deps['@astrojs/compiler'] || deps['astro']) {
          return { framework: 'astro', version: deps['astro'] || deps['@astrojs/compiler'] };
        }
        if (deps['@sveltejs/kit'] || deps['svelte']) {
          return { framework: deps['@sveltejs/kit'] ? 'sveltekit' : 'svelte', version: deps['@sveltejs/kit'] || deps['svelte'] };
        }
        if (deps['nuxt'] || deps['nuxt3']) {
          return { framework: 'nuxt', version: deps['nuxt'] || deps['nuxt3'] };
        }
        if (deps['vue']) {
          return { framework: 'vue', version: deps['vue'] };
        }
        if (deps['@remix-run/react']) {
          return { framework: 'remix', version: deps['@remix-run/react'] };
        }
        if (deps['@angular/core']) {
          return { framework: 'angular', version: deps['@angular/core'] };
        }
        if (deps['react']) {
          return { framework: 'react', version: deps['react'] };
        }
      }
    }

    // Check config files directly
    try {
      const rootFiles = fs.readdirSync(workspacePath);
      if (rootFiles.some((f) => /^next\.config\./i.test(f))) return { framework: 'nextjs', version: 'unknown' };
      if (rootFiles.some((f) => /^astro\.config\./i.test(f))) return { framework: 'astro', version: 'unknown' };
      if (rootFiles.some((f) => /^nuxt\.config\./i.test(f))) return { framework: 'nuxt', version: 'unknown' };
      if (rootFiles.some((f) => /^svelte\.config\./i.test(f))) return { framework: 'sveltekit', version: 'unknown' };
    } catch (_) {}

    return { framework: null, version: null };
  }

  _detectBackendFramework(manifests, workspacePath) {
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = { ...(m.parsed.dependencies || {}), ...(m.parsed.devDependencies || {}) };
        if (deps['@nestjs/core']) return { framework: 'nestjs', version: deps['@nestjs/core'] };
        if (deps['express']) return { framework: 'express', version: deps['express'] };
        if (deps['fastify']) return { framework: 'fastify', version: deps['fastify'] };
        if (deps['koa']) return { framework: 'koa', version: deps['koa'] };
      } else if (m.type === 'python' && m.content) {
        const text = m.content.toLowerCase();
        if (text.includes('fastapi')) return { framework: 'fastapi', version: 'python' };
        if (text.includes('django')) return { framework: 'django', version: 'python' };
        if (text.includes('flask')) return { framework: 'flask', version: 'python' };
      } else if (m.type === 'java') {
        return { framework: 'spring-boot', version: 'java' };
      } else if (m.type === 'go') {
        return { framework: 'go-backend', version: 'go' };
      } else if (m.type === 'rust') {
        return { framework: 'rust-actix', version: 'rust' };
      }
    }
    return { framework: null, version: null };
  }

  _detectBuildTool(manifests, workspacePath) {
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = { ...(m.parsed.dependencies || {}), ...(m.parsed.devDependencies || {}) };
        if (deps['vite']) return 'vite';
        if (deps['webpack']) return 'webpack';
        if (deps['esbuild']) return 'esbuild';
        if (deps['parcel']) return 'parcel';
        if (deps['rollup']) return 'rollup';
        if (deps['turbo']) return 'turbopack';
      }
    }
    try {
      const rootFiles = fs.readdirSync(workspacePath);
      if (rootFiles.some((f) => /^vite\.config\./i.test(f))) return 'vite';
      if (rootFiles.some((f) => /^webpack\.config\./i.test(f))) return 'webpack';
    } catch (_) {}
    return 'unknown';
  }

  _detectIconSystem(manifests) {
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = { ...(m.parsed.dependencies || {}), ...(m.parsed.devDependencies || {}) };
        if (deps['@fortawesome/fontawesome-svg-core'] || deps['@fortawesome/react-fontawesome']) {
          return 'fontawesome';
        }
        if (deps['lucide-react'] || deps['lucide-vue-next']) {
          return 'lucide';
        }
        if (deps['@heroicons/react'] || deps['@heroicons/vue']) {
          return 'heroicons';
        }
        if (deps['react-icons']) {
          return 'react-icons';
        }
      }
    }
    return 'none';
  }

  _detectStylingSystem(manifests, workspacePath) {
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = { ...(m.parsed.dependencies || {}), ...(m.parsed.devDependencies || {}) };
        if (deps['tailwindcss']) return 'tailwindcss';
        if (deps['styled-components']) return 'styled-components';
        if (deps['@emotion/react']) return 'emotion';
        if (deps['@mui/material']) return 'mui';
        if (deps['bootstrap']) return 'bootstrap';
      }
    }
    try {
      const rootFiles = fs.readdirSync(workspacePath);
      if (rootFiles.some((f) => /^tailwind\.config\./i.test(f))) return 'tailwindcss';
    } catch (_) {}
    return 'vanilla-css';
  }

  _detectStateManagement(manifests) {
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = { ...(m.parsed.dependencies || {}), ...(m.parsed.devDependencies || {}) };
        if (deps['zustand']) return 'zustand';
        if (deps['@reduxjs/toolkit'] || deps['redux']) return 'redux';
        if (deps['pinia']) return 'pinia';
        if (deps['vuex']) return 'vuex';
        if (deps['mobx']) return 'mobx';
      }
    }
    return 'react-state';
  }

  _detectTestingFramework(manifests) {
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = { ...(m.parsed.dependencies || {}), ...(m.parsed.devDependencies || {}) };
        if (deps['vitest']) return 'vitest';
        if (deps['jest']) return 'jest';
        if (deps['playwright'] || deps['@playwright/test']) return 'playwright';
        if (deps['cypress']) return 'cypress';
      }
    }
    return 'none';
  }

  _detectPrimaryLanguage(manifests, workspacePath) {
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = { ...(m.parsed.dependencies || {}), ...(m.parsed.devDependencies || {}) };
        if (deps['typescript']) return 'typescript';
      }
    }
    try {
      const rootFiles = fs.readdirSync(workspacePath);
      if (rootFiles.some((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f === 'tsconfig.json')) {
        return 'typescript';
      }
    } catch (_) {}
    return 'javascript';
  }

  _detectPackageManager(workspacePath) {
    try {
      const files = fs.readdirSync(workspacePath);
      if (files.includes('pnpm-lock.yaml')) return 'pnpm';
      if (files.includes('yarn.lock')) return 'yarn';
      if (files.includes('bun.lockb') || files.includes('bun.lock')) return 'bun';
      if (files.includes('package-lock.json')) return 'npm';
    } catch (_) {}
    return 'npm';
  }

  _summarizeDependencies(manifests) {
    const summary = {};
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = m.parsed.dependencies || {};
        for (const [k, v] of Object.entries(deps)) {
          if (!summary[k]) summary[k] = v;
        }
      }
    }
    return summary;
  }

  _discoverDatabaseAndOrm(manifests, workspacePath) {
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const deps = { ...(m.parsed.dependencies || {}), ...(m.parsed.devDependencies || {}) };
        if (deps['@prisma/client'] || deps['prisma']) return { orm: 'prisma', schema: 'prisma/schema.prisma' };
        if (deps['drizzle-orm']) return { orm: 'drizzle', schema: 'drizzle/schema.ts' };
        if (deps['mongoose']) return { orm: 'mongoose', schema: 'models/' };
        if (deps['sequelize']) return { orm: 'sequelize', schema: 'models/' };
        if (deps['typeorm']) return { orm: 'typeorm', schema: 'entities/' };
        if (deps['better-sqlite3'] || deps['sqlite3']) return { orm: 'sqlite', schema: 'database/schema.sql' };
        if (deps['pg']) return { orm: 'postgres', schema: 'database/schema.sql' };
      }
    }
    try {
      if (fs.existsSync(path.join(workspacePath, 'prisma/schema.prisma'))) {
        return { orm: 'prisma', schema: 'prisma/schema.prisma' };
      }
    } catch (_) {}
    return { orm: 'none', schema: null };
  }

  _discoverExistingRoutesAndEndpoints(workspacePath) {
    const endpoints = [];
    const routeRegex = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.checkpoints']);

    const scanDir = (dir, depth = 0) => {
      if (depth > 4 || endpoints.length >= 25) return;
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
      for (const e of entries) {
        if (skip.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          scanDir(full, depth + 1);
        } else if (e.isFile() && /\.(js|ts|mjs|cjs)$/.test(e.name)) {
          try {
            const content = fs.readFileSync(full, 'utf8');
            let m;
            while ((m = routeRegex.exec(content)) !== null) {
              endpoints.push({ method: m[1].toUpperCase(), route: m[2], file: path.relative(workspacePath, full).replace(/\\/g, '/') });
              if (endpoints.length >= 25) break;
            }
          } catch (_) {}
        }
      }
    };

    scanDir(workspacePath);
    return endpoints;
  }

  _discoverCodeConventions(workspacePath) {
    const conventions = {
      jsxExtension: '.jsx',
      style: 'esm',
      indentation: '2-spaces',
      exportStyle: 'default-and-named'
    };
    try {
      const scanDir = (dir, depth = 0) => {
        if (depth > 2) return [];
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return []; }
        let found = [];
        for (const e of entries) {
          if (IGNORED_DIRS.has(e.name)) continue;
          if (e.isFile()) found.push(e.name);
          else if (e.isDirectory() && ['src', 'app', 'pages', 'components', 'lib'].includes(e.name)) {
            found.push(...scanDir(path.join(dir, e.name), depth + 1));
          }
        }
        return found;
      };
      const files = scanDir(workspacePath);
      if (files.some((f) => f.endsWith('.tsx'))) conventions.jsxExtension = '.tsx';
      else if (files.some((f) => f.endsWith('.jsx'))) conventions.jsxExtension = '.jsx';
      else if (files.some((f) => f.endsWith('.ts'))) conventions.jsxExtension = '.ts';
      else conventions.jsxExtension = '.js';

      if (fs.existsSync(path.join(workspacePath, 'tsconfig.json'))) {
        conventions.style = 'typescript';
      } else {
        let pkg = null;
        try { pkg = JSON.parse(fs.readFileSync(path.join(workspacePath, 'package.json'), 'utf8')); } catch (_) {}
        if (pkg?.type === 'module') {
          conventions.style = 'esm';
        } else if (pkg?.type === 'commonjs') {
          conventions.style = 'cjs';
        }
      }
    } catch (_) {}
    return conventions;
  }

  _detectConflictingModules(manifests) {
    const conflicts = [];
    const reactVersions = new Set();
    for (const m of manifests) {
      if (m.type === 'npm' && m.parsed) {
        const v = m.parsed.dependencies?.react || m.parsed.devDependencies?.react;
        if (v) reactVersions.add(v);
      }
    }
    if (reactVersions.size > 1) {
      conflicts.push(`Multiple conflicting React versions detected across workspaces: ${Array.from(reactVersions).join(', ')}`);
    }
    return conflicts;
  }

  /**
   * Generates a concise, high-value prompt block (< 1200 chars) for Director & Planner LLM calls.
   */
  buildPromptDirective(summary) {
    if (!summary) return '';

    const lines = [
      `[WORKSPACE & FRAMEWORK CONVENTIONS]`,
      `- Architecture: ${summary.architecture}${summary.isMonorepo ? ' (respect nested frontend/backend directory boundaries)' : ''}`,
      `- Effective Framework: ${summary.effectiveFramework}${summary.userOverrideApplied ? ' (Explicit User Selection)' : ''}`,
      `- Build Tool: ${summary.buildTool} | Package Manager: ${summary.packageManager} | Language: ${summary.language}`,
      `- Preserved Icon System: ${summary.iconSystem} (Do NOT introduce foreign icon libraries)`,
      `- Preserved Styling: ${summary.stylingSystem} | State Management: ${summary.stateManagement}`,
      `- Testing Stack: ${summary.testingFramework}`
    ];

    if (summary.databaseAndOrm && summary.databaseAndOrm.orm !== 'none') {
      lines.push(`- Database/ORM: ${summary.databaseAndOrm.orm} (Schema: ${summary.databaseAndOrm.schema || 'standard'})`);
    }

    if (summary.existingRoutes && summary.existingRoutes.length > 0) {
      const routeList = summary.existingRoutes.slice(0, 5).map(r => `${r.method} ${r.route}`).join(', ');
      lines.push(`- Existing API Routes: ${routeList}${summary.existingRoutes.length > 5 ? ' ...' : ''}`);
    }

    if (summary.manifestLocations && summary.manifestLocations.length > 0) {
      lines.push(`- Project Manifests: ${summary.manifestLocations.join(', ')}`);
    }

    if (summary.conflictingModules && summary.conflictingModules.length > 0) {
      lines.push(`- ⚠️ Conflict Notice: ${summary.conflictingModules.join('; ')}`);
    }

    return lines.join('\n');
  }
}

const workspaceFrameworkIntelligence = new WorkspaceFrameworkIntelligence();

module.exports = {
  WorkspaceFrameworkIntelligence,
  workspaceFrameworkIntelligence,
  inspectWorkspace: (wsPath, opts) => workspaceFrameworkIntelligence.inspectWorkspace(wsPath, opts),
  buildPromptDirective: (summary) => workspaceFrameworkIntelligence.buildPromptDirective(summary)
};
