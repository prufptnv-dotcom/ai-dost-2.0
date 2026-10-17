/**
 * PreviewEngine.js
 * In-Browser Instant Live App Compiler with Error Boundary, Telemetry, and Visual Inspector.
 * Extracts ~600 lines from CopilotIDE.jsx into a clean, reusable preview engine.
 */

export const PREVIEW_TELEMETRY_SCRIPT = `
<script>
(() => {
  const report = (type, payload) => window.parent.postMessage({ channel: 'ai-dost-preview', type, ...payload }, '*');
  window.addEventListener('error', (event) => report('RUNTIME_ERROR', { error: event.message || 'Runtime error' }));
  window.addEventListener('unhandledrejection', (event) => report('RUNTIME_ERROR', { error: String(event.reason?.message || event.reason || 'Unhandled promise') }));
  // Console capture → parent console drawer (cap 80 entries, 600 chars each)
  const fmt = (a) => {
    try { return typeof a === 'string' ? a : JSON.stringify(a); }
    catch (_) { return String(a); }
  };
  ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
    const orig = console[level] ? console[level].bind(console) : null;
    console[level] = (...args) => {
      try { report('CONSOLE', { level, text: args.map(fmt).join(' ').slice(0, 600) }); } catch (_) {}
      if (orig) orig(...args);
    };
  });
  // Failed resource loads (img/script/css) → console drawer
  window.addEventListener('error', (event) => {
    const t = event.target;
    if (t && t !== window && (t.src || t.href)) {
      report('CONSOLE', { level: 'error', text: 'Failed to load ' + (t.src || t.href) });
    }
  }, true);
  const inspect = () => {
    const body = document.body;
    if (!body) return;
    const rect = body.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || !body.children.length) report('VISUAL_ERROR', { message: 'Blank preview detected' });
    else report('PREVIEW_READY', { width: rect.width, height: rect.height });
  };
  new MutationObserver(() => requestAnimationFrame(inspect)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => requestAnimationFrame(inspect), { once: true });
})();
</script>`;

/**
 * Resolve the alias the in-browser mount needs so `<App />` resolves.
 * Returns `{ rootAlias }` — either '' (workspace already declares App, or no
 * default export at all) or a `const App = <rootName>;` statement.
 * Exported for tests: a silently-wrong alias means a blank preview.
 */
export function resolveRootAlias(appCode, cleanedCode = '') {
  const match =
    (appCode || '').match(/export\s+default\s+(?:async\s+)?function\s+(\w+)/) ||
    (appCode || '').match(/export\s+default\s+const\s+(\w+)\s*=/) ||
    (appCode || '').match(/export\s+default\s+class\s+(\w+)/) ||
    (appCode || '').match(/export\s+default\s+(\w+)\s*;?\s*(?:\/\/[^\n]*)?$/m);
  const rootName = match && !/^(?:function|async|const|let|var|class)$/.test(match[1])
    ? match[1] : '';
  const declaresApp = /\b(?:function|class|const|let|var)\s+App\b/.test(cleanedCode);
  if (declaresApp || !rootName || rootName === 'App') return { rootAlias: '', rootName };
  return {
    rootAlias: `const App = typeof ${rootName} !== 'undefined' ? ${rootName} : undefined;`,
    rootName,
  };
}

export function generateLiveAppHtml(files = [], contents = {}, inspectorActive = false, activeFile = '') {
  const norm = (p) => (p || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').trim();

  let isInspector = Boolean(inspectorActive);
  let activePath = typeof activeFile === 'string' ? activeFile : '';
  if (typeof inspectorActive === 'string') {
    activePath = inspectorActive;
    isInspector = false;
  }

  const sanitizeCode = (str) => {
    if (typeof str !== 'string') return '';
    if (str.includes('\\n') && !str.includes('\n')) {
      return str.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\\t/g, '  ');
    }
    return str;
  };

  // Find index.html or active HTML file if present
  let rawIndexHtml = '';
  const indexHtmlFile = (files || []).find(f => norm(f.path) === 'index.html' || norm(f.path).endsWith('/index.html'));
  if (indexHtmlFile) {
    rawIndexHtml = sanitizeCode(contents[indexHtmlFile.path] || contents[norm(indexHtmlFile.path)] || indexHtmlFile.content || '');
  } else if (contents['index.html']) {
    rawIndexHtml = sanitizeCode(contents['index.html']);
  } else if (activePath && (norm(activePath).endsWith('.html') || norm(activePath).endsWith('.htm'))) {
    rawIndexHtml = sanitizeCode(contents[activePath] || contents[norm(activePath)] || '');
  } else {
    for (const [p, c] of Object.entries(contents || {})) {
      if (p.endsWith('.html') && c) {
        rawIndexHtml = sanitizeCode(c);
        break;
      }
    }
  }

  // Look for primary React component (App.jsx, App.js, App.tsx, or main.jsx)
  let appCode = sanitizeCode(contents['src/App.jsx'] || contents['App.jsx'] || contents['src/App.js'] || contents['App.js'] || contents['src/App.tsx'] || contents['App.tsx'] || '');

  // If active file is an explicit React/JS component file with code, prioritize it if appCode is not standard
  if (!appCode && activePath && (activePath.endsWith('.jsx') || activePath.endsWith('.tsx') || activePath.endsWith('.js')) && !activePath.endsWith('.config.js')) {
    const candidate = sanitizeCode(contents[activePath] || contents[norm(activePath)] || '');
    if (candidate && (candidate.includes('export default') || candidate.includes('function ') || candidate.includes('const ') || candidate.includes('return'))) {
      appCode = candidate;
    }
  }

  if (!appCode) {
    const appFile = (files || []).find(f => {
      const p = norm(f.path);
      return p === 'App.jsx' || p.endsWith('/App.jsx') || p === 'App.js' || p.endsWith('/App.js') || p === 'App.tsx' || p.endsWith('/App.tsx');
    });
    if (appFile) appCode = sanitizeCode(contents[appFile.path] || contents[norm(appFile.path)] || appFile.content || '');
  }

  if (!appCode) {
    const mainFile = (files || []).find(f => {
      const p = norm(f.path);
      return p.endsWith('main.jsx') || p.endsWith('main.js') || p.endsWith('index.jsx') || p.endsWith('index.js');
    });
    if (mainFile) appCode = sanitizeCode(contents[mainFile.path] || contents[norm(mainFile.path)] || mainFile.content || '');
  }

  if (!appCode) {
    for (const f of (files || [])) {
      const p = norm(f.path);
      const code = sanitizeCode(contents[f.path] || contents[p] || f.content || '');
      if (code && (p.endsWith('.jsx') || p.endsWith('.tsx') || p.endsWith('.js')) && !p.endsWith('.config.js') && !p.includes('.test.') && !p.includes('.spec.') && (code.includes('export default') || code.includes('function App') || code.includes('const App') || code.includes('return (') || code.includes('return <'))) {
        appCode = code;
        break;
      }
    }
  }

  if (!appCode) {
    for (const [pRaw, codeRaw] of Object.entries(contents || {})) {
      const p = norm(pRaw);
      const code = sanitizeCode(codeRaw || '');
      if (code && (p.endsWith('.jsx') || p.endsWith('.tsx') || p.endsWith('.js')) && !p.endsWith('.config.js') && !p.includes('.test.') && !p.includes('.spec.') && (code.includes('export default') || code.includes('function App') || code.includes('const App') || code.includes('return (') || code.includes('return <'))) {
        appCode = code;
        break;
      }
    }
  }

  const hasHtmlContent = Boolean(rawIndexHtml && (rawIndexHtml.includes('<html') || rawIndexHtml.includes('<body') || rawIndexHtml.includes('<div') || rawIndexHtml.includes('<h1') || rawIndexHtml.includes('<p') || rawIndexHtml.includes('<section') || rawIndexHtml.includes('<main')));

  // If this is a static website (HTML/CSS/JS without React App code, or contains full HTML structure)
  if (!appCode && hasHtmlContent) {
    let injectedHtml = rawIndexHtml;
    if (!injectedHtml.includes('<body')) {
      injectedHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"><style>body{font-family:'Inter',sans-serif;margin:0;padding:16px;background:#090d16;color:#e2e8f0;}</style></head><body>${injectedHtml}</body></html>`;
    }
    // Inject style.css if present
    const cssFile = (files || []).find(f => norm(f.path).endsWith('.css'));
    if (cssFile && !injectedHtml.includes('<style>')) {
      const cssContent = sanitizeCode(contents[cssFile.path] || contents[norm(cssFile.path)] || cssFile.content || '');
      if (cssContent) {
        injectedHtml = injectedHtml.replace('</head>', `<style>${cssContent}</style></head>`);
      }
    }
    // Inject script.js if present
    const jsFile = (files || []).find(f => norm(f.path).endsWith('script.js') || norm(f.path).endsWith('main.js'));
    if (jsFile && !injectedHtml.includes(jsFile.path)) {
      const jsContent = sanitizeCode(contents[jsFile.path] || contents[norm(jsFile.path)] || jsFile.content || '');
      if (jsContent) {
        injectedHtml = injectedHtml.replace('</body>', `<script>${jsContent}</script></body>`);
      }
    }
    return injectedHtml.replace('</head>', `${PREVIEW_TELEMETRY_SCRIPT}</head>`);
  }

  const isReactOrViteApp = Boolean(
    appCode ||
    (rawIndexHtml && (rawIndexHtml.includes('src/main') || rawIndexHtml.includes('src/App'))) ||
    (files || []).some(f => {
      const p = norm(f.path);
      return p.endsWith('.jsx') || p.endsWith('.tsx');
    })
  );

  if (!appCode) {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <title>Ready to Build</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; background: #090d16; color: #94a3b8; margin: 0; }</style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-6 text-center">
  <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
  <h3 class="text-sm font-semibold text-white">Initializing React Application...</h3>
  <p class="text-xs text-slate-500 mt-1 max-w-xs">Reading workspace components and mounting live runtime.</p>
</body>
</html>`;
  }

  const cleanedCode = (appCode || '')
    .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '')
    .replace(/import\s+['"].*?['"];?/g, '')
    .replace(/export\s+default\s+function\s*(\w*)/g, (m, name) => name ? `function ${name}` : 'function App')
    .replace(/export\s+default\s+const\s+(\w+)\s*=/g, 'const $1 =')
    .replace(/export\s+default\s+async\s+function\s*(\w*)/g, (m, name) => name ? `async function ${name}` : 'async function App')
    .replace(/export\s+default\s+class\s*(\w*)/g, (m, name) => name ? `class ${name}` : 'class App')
    .replace(/export\s+default\s+(\(.*?\)\s*=>|[\w$]+\s*=>)/g, 'const App = $1')
    .replace(/export\s+default\s+([a-zA-Z0-9_$]+);?/g, (m, name) => `if (typeof ${name} !== 'undefined') { window.__rootComponent = ${name}; }`)
    .replace(/export\s+async\s+function\s+(\w+)/g, 'async function $1')
    .replace(/export\s+function\s+(\w+)/g, 'function $1')
    .replace(/export\s+(?:const|let|var)\s+(\w+)/g, 'const $1')
    .replace(/export\s+\{[\s\S]*?\};?/g, '');

  // The mount below hardcodes <App />, but generated apps often export the
  // root as HomePage/Dashboard/TodoApp. Capture that name so we can alias it,
  // and skip the alias when the workspace really does declare `App`.
  const { rootAlias } = resolveRootAlias(appCode, cleanedCode);

  // Extract all imported API functions (from ./services/api, ./api, etc.)
  const apiImports = [];
  const apiMatches = (appCode || '').matchAll(/import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"][^'"]*api[^'"]*['"]/g);
  for (const m of apiMatches) {
    if (m[1]) {
      m[1].split(',').forEach(id => {
        const clean = id.trim().split(' as ')[0].trim();
        if (clean) apiImports.push(clean);
      });
    }
    if (m[2]) apiImports.push(m[2].trim());
  }

  // Load and clean src/services/api.js if available.
  // This module is injected once below (${apiCode}) so its API surface + mock
  // fallbacks resolve. It must be excluded from the sub-component sweep further
  // down, or `const API` is declared twice and Babel throws a SyntaxError that
  // blanks the entire preview.
  const apiFile = (files || []).find(f => f.path?.endsWith('api.js') || f.path?.endsWith('api.ts'));
  let apiCode = '';
  if (apiFile && (contents[apiFile.path] || apiFile.content)) {
    apiCode = sanitizeCode(contents[apiFile.path] || apiFile.content || '')
      .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '')
      .replace(/import\s+['"].*?['"];?/g, '')
      .replace(/export\s+(?:async\s+)?function\s+(\w+)/g, 'async function $1')
      .replace(/export\s+(?:const|let|var)\s+(\w+)/g, 'const $1')
      .replace(/export\s+default\s+[\s\S]*?;?/g, '')
      .replace(/export\s+\{[\s\S]*?\};?/g, '');
  }

  // Generate fallback stubs for all imported API functions
  const apiStubs = Array.from(new Set(apiImports)).map(name =>
    `if (typeof window.${name} === 'undefined' && typeof ${name} === 'undefined') {
      window.${name} = async function ${name}Stub(payload) {
        try {
          const key = 'mock_' + '${name}'.toLowerCase();
          if (payload && typeof payload === 'object') {
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const newItem = { id: String(Date.now()), ...payload, createdAt: new Date().toISOString() };
            existing.unshift(newItem);
            localStorage.setItem(key, JSON.stringify(existing));
            return newItem;
          }
          return JSON.parse(localStorage.getItem(key) || '[]');
        } catch(_) { return []; }
      };
    }`
  ).join('\n');

  // Extract all imported Lucide icons + JSX component tags
  const importedLucide = [];
  const lucideMatches = (appCode || '').matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g);
  for (const m of lucideMatches) {
    if (m[1]) {
      m[1].split(',').forEach(id => {
        const parts = id.trim().split(/\s+as\s+/);
        if (parts[0]) importedLucide.push(parts[0].trim());
        if (parts[1]) importedLucide.push(parts[1].trim());
      });
    }
  }

  // Inject sub-components from src/components/*.jsx or *.js/jsx so App can render them
  let subComponentsCode = '';
  const declaredNames = new Set();
  const appTopLevelMatches = (appCode || '').matchAll(/(?:function|class|const|let|var)\s+([A-Za-z0-9_]+)/g);
  for (const m of appTopLevelMatches) {
    if (m[1]) declaredNames.add(m[1]);
  }

  // Stripping an `import` leaves its local binding undeclared, so any JSX that
  // referenced it (`createRoot(el).render(<App />)` in main.tsx is the classic
  // case) throws "X is not defined" at transform time. Collect every stripped
  // binding and re-declare it below, resolved off the window namespace the
  // sub-component injection already publishes.
  const strippedImports = new Map(); // localName -> { source, imported }

  (files || []).forEach(f => {
    const isCode = f.path && (f.path.endsWith('.jsx') || f.path.endsWith('.js') || f.path.endsWith('.tsx') || f.path.endsWith('.ts'));
    const normP = norm(f.path);
    // Entry files are mounted by the template below, so they must never be
    // injected as sub-components (a second copy of App is both a duplicate
    // declaration and a dangling reference). TS variants belong here too —
    // omitting them is what let main.tsx leak in and throw.
    const isEntry = normP === 'App.jsx' || normP.endsWith('/App.jsx') ||
                    normP === 'App.js' || normP.endsWith('/App.js') ||
                    normP === 'App.tsx' || normP.endsWith('/App.tsx') ||
                    normP === 'App.ts' || normP.endsWith('/App.ts') ||
                    normP === 'main.jsx' || normP.endsWith('/main.jsx') ||
                    normP === 'main.js' || normP.endsWith('/main.js') ||
                    normP === 'main.tsx' || normP.endsWith('/main.tsx') ||
                    normP === 'main.ts' || normP.endsWith('/main.ts') ||
                    normP === 'index.jsx' || normP.endsWith('/index.jsx') ||
                    normP === 'index.js' || normP.endsWith('/index.js') ||
                    normP === 'index.tsx' || normP.endsWith('/index.tsx') ||
                    normP === 'index.ts' || normP.endsWith('/index.ts');
    const isTest = f.path.includes('.test.') || f.path.includes('.spec.');
    // Already injected above via ${apiCode} — injecting it again here would
    // redeclare its bindings.
    const isApiModule = Boolean(apiFile && norm(f.path) === norm(apiFile.path));
    // Server-side / build-config modules run in Node, not the browser. Bundling
    // them throws `require is not defined` at transform time and blanks the
    // whole preview, so they never enter the app bundle.
    const isServerSide =
      /(^|\/)server(\/|\.|$)/i.test(normP) ||
      /\.config\.(js|ts|mjs|cjs)$/i.test(normP) ||
      /^(vite|webpack|rollup|esbuild|postcss|tailwind|drizzle|tsconfig|next)\./i.test(normP.split('/').pop() || '');
    if (isCode && !isEntry && !isTest && !isApiModule && !isServerSide) {
      const subContent = sanitizeCode(contents[f.path] || f.content || '');
      // Final guard: a CJS/Node module slipped past the path checks above.
      if (subContent && !/\brequire\s*\(|\bmodule\.exports\b/.test(subContent)) {
        // Record bindings before the import lines are removed.
        for (const im of subContent.matchAll(/import\s+([^;'"]+?)\s+from\s+['"]([^'"]+)['"]/g)) {
          const clause = im[1].trim();
          const source = im[2];
          const brace = clause.match(/\{([\s\S]*)\}/);
          if (brace) {
            for (const raw of brace[1].split(',')) {
              const part = raw.trim();
              if (!part) continue;
              const as = part.split(/\s+as\s+/);
              strippedImports.set(as[1] || as[0], { source, imported: as[0] });
            }
          }
          const def = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, '').trim();
          if (def && !def.startsWith('*')) {
            strippedImports.set(def, { source, imported: 'default' });
          }
        }

        let cleanedSub = subContent
          .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '')
          .replace(/import\s+['"].*?['"];?/g, '')
          .replace(/export\s+default\s+function\s*(\w*)/g, (m, name) => name ? `function ${name}` : '')
          .replace(/export\s+default\s+const\s+(\w+)\s*=/g, 'const $1 =')
          .replace(/export\s+default\s+(\w+);?/g, '')
          .replace(/export\s+async\s+function\s+(\w+)/g, 'async function $1')
          .replace(/export\s+function\s+(\w+)/g, 'function $1')
          .replace(/export\s+(?:const|let|var)\s+(\w+)/g, 'const $1')
          .replace(/export\s+\{[\s\S]*?\};?/g, '');

        cleanedSub = cleanedSub.replace(/(?:function|class)\s+([A-Za-z0-9_]+)/g, (match, name) => {
          if (declaredNames.has(name)) {
            return `window.${name} = function ${name}`;
          }
          declaredNames.add(name);
          return match;
        });

        cleanedSub = cleanedSub.replace(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=/g, (match, name) => {
          if (declaredNames.has(name)) {
            return `window.${name} =`;
          }
          declaredNames.add(name);
          return match;
        });

        subComponentsCode += '\n' + cleanedSub + '\n';
      }
    }
  });

  // Re-declare every stripped import as a window-resolved local. React hooks and
  // components resolve off the React global / the injected `window.X`
  // declarations; anything unresolved falls back to undefined so a missing
  // module degrades to an inert stub instead of a thrown ReferenceError.
  const reactBuiltins = new Set([
    'React', 'ReactDOM', 'useState', 'useEffect', 'useRef', 'useMemo',
    'useCallback', 'useContext', 'useReducer', 'createContext', 'Fragment',
    'useId', 'useTransition', 'useDeferredValue', 'useLayoutEffect', 'useImperativeHandle'
  ]);

  const subImportAliases = Array.from(strippedImports.entries())
    .filter(([local]) => !declaredNames.has(local) && !reactBuiltins.has(local))
    .map(([local, meta]) => {
      const fromReact = /(^|\/)react($|\/)/.test(meta.source) && !/react-router|react-dom/.test(meta.source);
      const expr = fromReact
        ? `(typeof React !== 'undefined' && React[${JSON.stringify(meta.imported)}])`
        : `(typeof window !== 'undefined' && window[${JSON.stringify(meta.imported)}])`;
      return `var ${local} = ${expr};`;
    })
    .join('\n');

  const declaredComponents = new Set();
  const declMatches = ((appCode || '') + '\n' + subComponentsCode).matchAll(/(?:function|class|const|let|var|window\.)\s*([A-Z][A-Za-z0-9_]*)/g);
  for (const m of declMatches) {
    if (m[1]) declaredComponents.add(m[1]);
  }
  for (const name of declaredNames) {
    if (name && /^[A-Z]/.test(name)) declaredComponents.add(name);
  }

  const jsxTags = (appCode || '').match(/<([A-Z][A-Za-z0-9_]*)/g) || [];
  const tagsList = jsxTags.map(t => t.replace('<', '').trim());
  const knownComponentSuffixes = /(?:App|Page|View|Card|Modal|Form|List|Item|Container|Provider|Layout|Nav|Header|Footer|Sidebar|Board|Grid|Row|Column|Button|Input|Dialog|Popup|Panel|Screen|Route|Wrapper|Section|Table)$/;
  const filteredTagsList = tagsList.filter(t => !knownComponentSuffixes.test(t));

  const ALL_DETECTED_ICONS = Array.from(new Set([
    'Search', 'ShoppingCart', 'ShoppingBag', 'Kanban', 'BrainCircuit', 'Activity', 'BarChart2', 'BarChart3',
    'Sparkles', 'Play', 'Layers', 'TrendingUp', 'CheckCircle', 'CheckCircle2', 'Shield', 'ShieldCheck',
    'GitBranch', 'Plus', 'Minus', 'Zap', 'Box', 'ArrowRight', 'Download', 'X', 'Menu', 'Trash', 'Trash2',
    'Edit', 'Pencil', 'FolderTree', 'FilePlus2', 'FolderPlus', 'ChevronDown', 'ChevronUp', 'ChevronRight',
    'ChevronLeft', 'Globe', 'Database', 'Server', 'Code', 'Code2', 'Eye', 'EyeOff', 'Lock', 'User',
    'Users', 'Clock', 'Mail', 'Phone', 'MapPin', 'Star', 'Heart', 'Filter', 'RefreshCw', 'ExternalLink',
    'Settings', 'AlertCircle', 'Check', 'Copy', 'Sliders', 'Calendar', 'Camera', 'Image', 'Video',
    'Hospital', 'Stethoscope', 'Award', 'PhoneCall', 'UserCheck', 'Bed', 'CalendarCheck', 'Pill',
    'Ticket', 'Film', 'Rocket', 'Mars', 'Info', 'Utensils', 'Coffee', 'DollarSign', 'CreditCard', 'Tag', 'FileText',
    ...importedLucide,
    ...filteredTagsList
  ])).filter(name => !declaredComponents.has(name) && !['App', 'Main', 'Root', 'React', 'ReactDOM', 'GlobalErrorBoundary', 'Fragment'].includes(name));

  const LUCIDE_SVG_PATHS = {
    Search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    Plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    Minus: '<line x1="5" y1="12" x2="19" y2="12"></line>',
    Check: '<polyline points="20 6 9 17 4 12"></polyline>',
    CheckCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    CheckCircle2: '<circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path>',
    X: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    Trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
    Trash2: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>',
    Edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>',
    Pencil: '<line x1="18" y1="2" x2="22" y2="6"></line><path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"></path>',
    ChevronDown: '<polyline points="6 9 12 15 18 9"></polyline>',
    ChevronUp: '<polyline points="18 15 12 9 6 15"></polyline>',
    ChevronRight: '<polyline points="9 18 15 12 9 6"></polyline>',
    ChevronLeft: '<polyline points="15 18 9 12 15 6"></polyline>',
    ArrowRight: '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
    ArrowLeft: '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
    ArrowUp: '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>',
    ArrowDown: '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>',
    User: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    Users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    Settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    Lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
    Eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
    EyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>',
    Bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>',
    Heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>',
    Star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    Sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path>',
    Zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
    Activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>',
    TrendingUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>',
    BarChart2: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
    BarChart3: '<path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path>',
    Calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    Clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    Mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>',
    Phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>',
    MapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
    Globe: '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>',
    Database: '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>',
    Server: '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line>',
    Code: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>',
    Play: '<polygon points="5 3 19 12 5 21 5 3"></polygon>',
    RefreshCw: '<polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>',
    Filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>',
    Sliders: '<line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>',
    ExternalLink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>',
    Download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>',
    Upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>',
    Copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
    Info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
    AlertCircle: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
    ShoppingCart: '<circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>',
    ShoppingBag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path>',
    Folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>',
    FolderPlus: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line>',
    FileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>',
    Home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
    Menu: '<line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line>',
    Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    ShieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path>'
  };

  const iconDeclarations = ALL_DETECTED_ICONS.map(name => {
    const svgPath = LUCIDE_SVG_PATHS[name] || '<circle cx="12" cy="12" r="10"></circle><path d="m12 8 4 4-4 4M8 12h8"></path>';
    return `if (typeof window.${name} === 'undefined') {
      window.${name} = function ${name}Icon(props) {
        const size = props?.size || 18;
        const className = props?.className || '';
        const strokeWidth = props?.strokeWidth || 2;
        const color = props?.color || 'currentColor';
        return React.createElement('svg', {
          xmlns: 'http://www.w3.org/2000/svg',
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: color,
          strokeWidth: strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          className: 'inline-block ' + className,
          dangerouslySetInnerHTML: { __html: ${JSON.stringify(svgPath)} }
        });
      };
    }
    var ${name} = window.${name};`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>
    (function() {
      var origWarn = console.warn;
      console.warn = function(...args) {
        var msg = (args && args[0] ? String(args[0]) : '');
        if (msg.includes('cdn.tailwindcss.com') || msg.includes('Babel transformer')) return;
        origWarn.apply(console, args);
      };
      var origInfo = console.info;
      console.info = function(...args) {
        var msg = (args && args[0] ? String(args[0]) : '');
        if (msg.includes('cdn.tailwindcss.com') || msg.includes('Babel transformer')) return;
        origInfo.apply(console, args);
      };
    })();
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script>
    // ── In-Browser Preview Telemetry ─────────────────────────────────────
    const report = (type, payload) => window.parent.postMessage({ channel: 'ai-dost-preview', type, ...payload }, '*');
    window.addEventListener('error', (event) => report('RUNTIME_ERROR', { error: event.message || 'Runtime error' }));
    window.addEventListener('unhandledrejection', (event) => report('RUNTIME_ERROR', { error: String(event.reason?.message || event.reason || 'Unhandled promise') }));
    // Console capture → parent console drawer (cap ~80 by parent, 600 chars each)
    const _fmtArg = (a) => { try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (_) { return String(a); } };
    ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
      const orig = console[level] ? console[level].bind(console) : null;
      console[level] = (...args) => {
        try { report('CONSOLE', { level, text: args.map(_fmtArg).join(' ').slice(0, 600) }); } catch (_) {}
        if (orig) orig(...args);
      };
    });
    window.addEventListener('error', (event) => {
      const t = event.target;
      if (t && t !== window && (t.src || t.href)) report('CONSOLE', { level: 'error', text: 'Failed to load ' + (t.src || t.href) });
    }, true);
    const inspect = () => {
      const body = document.body;
      if (!body) return;
      const rect = body.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || !body.children.length) report('VISUAL_ERROR', { message: 'Blank preview detected' });
      else report('PREVIEW_READY', { width: rect.width, height: rect.height });
    };
    new MutationObserver(() => requestAnimationFrame(inspect)).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', () => requestAnimationFrame(inspect), { once: true });
  </script>
  <script>
    // ── Safe In-Memory Storage Polyfill ─────────────────────────────────────
    const _memoryStorage = {};
    window.safeStorage = {
      getItem: (k) => _memoryStorage[k] !== undefined ? _memoryStorage[k] : null,
      setItem: (k, v) => { _memoryStorage[k] = String(v); },
      removeItem: (k) => { delete _memoryStorage[k]; },
      clear: () => { Object.keys(_memoryStorage).forEach(k => delete _memoryStorage[k]); }
    };
    try {
      if (!window.localStorage) window.localStorage = window.safeStorage;
    } catch(_) {}

    // ── Smart In-Memory REST & Fetch Router for Preview (Bolt / Lovable Parity) ──
    const _origFetch = window.fetch;
    const _initialDb = {
      notes: [
        { id: '1', title: 'System Architecture', content: '# Core Design\n\n- Reactive state management\n- Zero-latency preview sync\n- Dark Linear design tokens', category: 'Engineering', tags: ['architecture', 'saas'], createdAt: new Date().toISOString() },
        { id: '2', title: 'Roadmap & Specs', content: '## Sprint 1 Goals\n\n- SQLite REST API: Completed\n- Split Editor: Active', category: 'Product', tags: ['roadmap', 'product'], createdAt: new Date().toISOString() }
      ],
      tasks: [
        { id: '1', title: 'Complete project architecture', description: 'Design frontend and backend state flow', status: 'in_progress', priority: 'high', dueDate: '2026-10-25', tags: ['architecture', 'core'], createdAt: new Date().toISOString() },
        { id: '2', title: 'Implement interactive preview', description: 'Zero-latency live compilation with WebContainer fallback', status: 'done', priority: 'high', dueDate: '2026-10-18', tags: ['ui', 'preview'], createdAt: new Date().toISOString() },
        { id: '3', title: 'Add search and filtering', description: 'Filter lists dynamically based on user search term', status: 'todo', priority: 'medium', dueDate: '2026-10-30', tags: ['feature'], createdAt: new Date().toISOString() }
      ],
      todos: [
        { id: '1', title: 'Review pull requests', completed: true, status: 'done', priority: 'high', createdAt: new Date().toISOString() },
        { id: '2', title: 'Integrate real-time telemetry', completed: true, status: 'done', priority: 'medium', createdAt: new Date().toISOString() },
        { id: '3', title: 'Deploy staging build', completed: false, status: 'todo', priority: 'urgent', createdAt: new Date().toISOString() }
      ],
      products: [
        { id: '1', name: 'Wireless Noise-Canceling Headphones', title: 'Wireless Noise-Canceling Headphones', price: 199.99, category: 'Electronics', rating: 4.8, stock: 24, inStock: true, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', description: 'Premium sound with active noise cancelation.' },
        { id: '2', name: 'Ergonomic Mechanical Keyboard', title: 'Ergonomic Mechanical Keyboard', price: 129.50, category: 'Accessories', rating: 4.9, stock: 15, inStock: true, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400', description: 'Custom mechanical switches with RGB backlight.' },
        { id: '3', name: 'Minimalist Smart Watch', title: 'Minimalist Smart Watch', price: 159.00, category: 'Wearables', rating: 4.6, stock: 8, inStock: true, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', description: 'Sleek design with health and fitness tracking.' },
        { id: '4', name: 'Ultra-Fast USB-C Power Bank', title: 'Ultra-Fast USB-C Power Bank', price: 49.99, category: 'Accessories', rating: 4.7, stock: 30, inStock: true, image: 'https://images.unsplash.com/photo-1609081219090-a6d8173087ec?w=400', description: 'High-capacity 20,000mAh portable charger.' }
      ],
      users: [
        { id: '1', name: 'Alex Johnson', email: 'alex@example.com', role: 'Administrator', status: 'Active', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120' },
        { id: '2', name: 'Sarah Chen', email: 'sarah@example.com', role: 'Product Designer', status: 'Active', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120' },
        { id: '3', name: 'Michael Davis', email: 'michael@example.com', role: 'Full Stack Engineer', status: 'Pending', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120' }
      ],
      metrics: {
        totalRevenue: 124500,
        activeUsers: 8420,
        conversionRate: 3.8,
        growth: 24.5,
        chartData: [
          { month: 'Jan', revenue: 18000, users: 3200 },
          { month: 'Feb', revenue: 22000, users: 4100 },
          { month: 'Mar', revenue: 28000, users: 5600 },
          { month: 'Apr', revenue: 34000, users: 6900 },
          { month: 'May', revenue: 42000, users: 8420 }
        ]
      },
      tags: ['architecture', 'saas', 'roadmap', 'product', 'design', 'ui', 'core'],
      items: [
        { id: '1', title: 'Primary Item', name: 'Sample Item 1', status: 'Active', count: 10, price: 99, tags: ['general'] }
      ]
    };

    let _db = _initialDb;
    try {
      const savedDb = window.localStorage?.getItem('__aidost_mock_db');
      if (savedDb) _db = { ..._initialDb, ...JSON.parse(savedDb) };
    } catch (_) {}

    const _persistDb = () => {
      try { window.localStorage?.setItem('__aidost_mock_db', JSON.stringify(_db)); } catch (_) {}
    };

    window.fetch = async function(url, options = {}) {
      const urlStr = String(url || '');
      const [rawPath, rawQuery] = urlStr.split('?');
      const withoutProto = rawPath.indexOf('://') !== -1 ? rawPath.split('://')[1].split('/').slice(1).join('/') : rawPath;
      const cleanPath = withoutProto.startsWith('api/') ? withoutProto.slice(4) : (withoutProto.startsWith('/') ? withoutProto.slice(1) : withoutProto);
      const method = (options.method || 'GET').toUpperCase();
      const pathParts = cleanPath.split('/').filter(Boolean);
      const resource = pathParts[0] || 'items';
      const id = pathParts[1] || null;

      // Parse query parameters
      const params = {};
      if (rawQuery) {
        rawQuery.split('&').forEach((pair) => {
          const [k, v] = pair.split('=');
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
      }

      if (!_db[resource]) {
        _db[resource] = [
          { id: '1', title: 'Sample ' + resource, name: 'Item 1', status: 'Active', count: 5, tags: ['default'], createdAt: new Date().toISOString() }
        ];
        _persistDb();
      }

      if (method === 'GET') {
        if (id) {
          const item = Array.isArray(_db[resource]) ? _db[resource].find(x => String(x.id) === String(id)) : _db[resource];
          return new Response(JSON.stringify(item || { error: 'Not found' }), {
            status: item ? 200 : 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        let dataset = _db[resource];
        if (Array.isArray(dataset)) {
          const search = (params.search || params.q || '').toLowerCase();
          const category = (params.category || '').toLowerCase();
          const status = (params.status || '').toLowerCase();

          if (search) {
            dataset = dataset.filter(item => {
              const text = Object.values(item).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(' ').toLowerCase();
              return text.includes(search);
            });
          }
          if (category && category !== 'all') {
            dataset = dataset.filter(item => String(item.category || '').toLowerCase() === category);
          }
          if (status && status !== 'all') {
            dataset = dataset.filter(item => String(item.status || '').toLowerCase() === status);
          }
          if (params.sort) {
            const sortField = params.sort.replace(/^[-+]/, '');
            const desc = params.sort.startsWith('-');
            dataset = [...dataset].sort((a, b) => {
              const va = a[sortField] ?? '';
              const vb = b[sortField] ?? '';
              return (va < vb ? -1 : va > vb ? 1 : 0) * (desc ? -1 : 1);
            });
          }
        }
        return new Response(JSON.stringify(dataset), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (method === 'POST') {
        let body = {};
        try { body = JSON.parse(options.body || '{}'); } catch(_) {}
        const newItem = { id: String(Date.now()), ...body, createdAt: new Date().toISOString() };
        if (Array.isArray(_db[resource])) {
          _db[resource].unshift(newItem);
          _persistDb();
        }
        return new Response(JSON.stringify(newItem), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      if (method === 'PUT' || method === 'PATCH') {
        let body = {};
        try { body = JSON.parse(options.body || '{}'); } catch(_) {}
        let updatedItem = { id: id || '1', ...body };
        if (Array.isArray(_db[resource]) && id) {
          const idx = _db[resource].findIndex(x => String(x.id) === String(id));
          if (idx !== -1) {
            _db[resource][idx] = { ..._db[resource][idx], ...body, updatedAt: new Date().toISOString() };
            updatedItem = _db[resource][idx];
            _persistDb();
          }
        }
        return new Response(JSON.stringify(updatedItem), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (method === 'DELETE') {
        if (Array.isArray(_db[resource]) && id) {
          _db[resource] = _db[resource].filter(x => String(x.id) !== String(id));
          _persistDb();
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (!rawPath.startsWith('http') || rawPath.includes('localhost') || rawPath.includes('127.0.0.1')) {
        const dynamicPayload = [
          { id: '1', title: 'Item Active', name: 'Item Alpha', status: 'Active', count: 12, tags: ['general'], createdAt: new Date().toISOString() }
        ];
        return new Response(JSON.stringify(dynamicPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        return await _origFetch(url, options);
      } catch(e) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    };

    // ── Live Iframe Error Telemetry ─────────────────────────────────────────
    window.onerror = function(msg, url, lineNo, columnNo, error) {
      const errText = (msg || '').toString() + (lineNo ? ' (Line: ' + lineNo + ':' + columnNo + ')' : '');
      window.parent.postMessage({
        channel: 'ai-dost-preview',
        type: 'AUTO_FIX_ERROR',
        error: errText,
        source: 'iframe_window_onerror'
      }, '*');
      return false;
    };

    window.addEventListener('unhandledrejection', function(event) {
      const reason = event.reason ? (event.reason.message || event.reason) : 'Unhandled promise';
      window.parent.postMessage({
        channel: 'ai-dost-preview',
        type: 'AUTO_FIX_ERROR',
        error: 'Promise Rejection: ' + String(reason),
        source: 'iframe_unhandled_rejection'
      }, '*');
    });
  </script>
</head>
<body class="bg-[#090a0f] text-slate-100 min-h-screen">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer, createContext, Fragment } = React;

    // ── Modern UI Primitives & Motion Polyfill (Bolt/Lovable Parity) ───────
    window.cn = function(...classes) { return classes.filter(Boolean).join(' '); };
    window.clsx = window.cn;
    window.confetti = function(options = {}) {
      try {
        const count = 30;
        const colors = ['#6366f1', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];
        for (let i = 0; i < count; i++) {
          const p = document.createElement('div');
          p.style.cssText = 'position:fixed;z-index:99999;width:8px;height:8px;pointer-events:none;border-radius:2px;';
          p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
          p.style.left = (options.origin?.x !== undefined ? options.origin.x * window.innerWidth : window.innerWidth / 2) + 'px';
          p.style.top = (options.origin?.y !== undefined ? options.origin.y * window.innerHeight : window.innerHeight / 2) + 'px';
          document.body.appendChild(p);
          const angle = Math.random() * Math.PI * 2;
          const dist = 60 + Math.random() * 150;
          const tx = Math.cos(angle) * dist;
          const ty = Math.sin(angle) * dist + 50;
          p.animate([
            { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
            { transform: 'translate(' + tx + 'px, ' + ty + 'px) rotate(' + (Math.random() * 720) + 'deg) scale(0)', opacity: 0 }
          ], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }).onfinish = () => p.remove();
        }
      } catch(_) {}
    };

    const _createMotionComponent = (tag) => React.forwardRef((props, ref) => {
      const { initial, animate, exit, transition, whileHover, whileTap, whileInView, variants, ...rest } = props;
      return React.createElement(tag, { ref, ...rest });
    });
    window.motion = {
      div: _createMotionComponent('div'),
      span: _createMotionComponent('span'),
      button: _createMotionComponent('button'),
      a: _createMotionComponent('a'),
      p: _createMotionComponent('p'),
      section: _createMotionComponent('section'),
      main: _createMotionComponent('main'),
      header: _createMotionComponent('header'),
      footer: _createMotionComponent('footer'),
      nav: _createMotionComponent('nav'),
      ul: _createMotionComponent('ul'),
      li: _createMotionComponent('li'),
      h1: _createMotionComponent('h1'),
      h2: _createMotionComponent('h2'),
      h3: _createMotionComponent('h3'),
      article: _createMotionComponent('article')
    };
    window.AnimatePresence = ({ children }) => children;

    // ── In-Memory React Router DOM Polyfill (Multi-page Apps) ───────────────
    const RouterContext = createContext({ pathname: '/', navigate: () => {}, params: {} });

    window.useLocation = function() {
      const ctx = useContext(RouterContext);
      return { pathname: ctx.pathname || '/', search: '', hash: '', state: null };
    };

    window.useNavigate = function() {
      const ctx = useContext(RouterContext);
      return ctx.navigate || (() => {});
    };

    window.useParams = function() {
      const ctx = useContext(RouterContext);
      return ctx.params || {};
    };

    window.BrowserRouter = function({ children }) {
      const [pathname, setPathname] = useState('/');
      const navigate = useCallback((to) => {
        if (typeof to === 'string') setPathname(to);
      }, []);
      const value = useMemo(() => ({ pathname, navigate, params: {} }), [pathname, navigate]);
      return React.createElement(RouterContext.Provider, { value }, children);
    };

    window.MemoryRouter = window.BrowserRouter;
    window.HashRouter = window.BrowserRouter;

    window.Routes = function({ children }) {
      const ctx = useContext(RouterContext);
      const currentPath = ctx.pathname || '/';
      const childArray = React.Children.toArray(children);
      for (const child of childArray) {
        if (!React.isValidElement(child)) continue;
        const routePath = child.props.path;
        if (!routePath || routePath === '*' || routePath === currentPath) {
          return child.props.element || child.props.children || null;
        }
      }
      return childArray[0]?.props?.element || null;
    };

    window.Route = function(props) {
      return props.element || props.children || null;
    };

    window.Link = function({ to, children, className = '', ...rest }) {
      const ctx = useContext(RouterContext);
      const handleClick = (e) => {
        e.preventDefault();
        ctx.navigate(to);
      };
      return React.createElement('a', { href: to, onClick: handleClick, className: 'cursor-pointer ' + className, ...rest }, children);
    };

    window.NavLink = window.Link;
    window.Navigate = function({ to }) {
      const ctx = useContext(RouterContext);
      useEffect(() => { ctx.navigate(to); }, [to]);
      return null;
    };
    window.Outlet = function() { return null; };

    var BrowserRouter = window.BrowserRouter;
    var MemoryRouter = window.MemoryRouter;
    var HashRouter = window.HashRouter;
    var Routes = window.Routes;
    var Route = window.Route;
    var Link = window.Link;
    var NavLink = window.NavLink;
    var Navigate = window.Navigate;
    var Outlet = window.Outlet;
    var useNavigate = window.useNavigate;
    var useLocation = window.useLocation;
    var useParams = window.useParams;

    // ── Sonner / React-Hot-Toast Polyfill ───────────────────────────────────
    window.toast = Object.assign(
      function(msg) { try { console.log('[Toast]', msg); } catch(_) {} },
      {
        success: (msg) => { try { console.log('[Toast Success]', msg); } catch(_) {} },
        error: (msg) => { try { console.log('[Toast Error]', msg); } catch(_) {} },
        info: (msg) => { try { console.log('[Toast Info]', msg); } catch(_) {} },
        warning: (msg) => { try { console.log('[Toast Warning]', msg); } catch(_) {} },
      }
    );
    window.Toaster = function() { return null; };
    var toast = window.toast;
    var Toaster = window.Toaster;

    // ── Recharts / Charting Polyfill (Bolt/Lovable Parity for Dashboards) ───
    window.ResponsiveContainer = function ResponsiveContainer({ children, width = '100%', height = 260, className = '' }) {
      return React.createElement('div', {
        className: 'w-full overflow-hidden flex flex-col items-center justify-center ' + className,
        style: { width, height: typeof height === 'number' ? height + 'px' : height, minHeight: '180px' }
      }, children);
    };

    window.Tooltip = function Tooltip() { return null; };
    window.Legend = function Legend() { return null; };
    window.CartesianGrid = function CartesianGrid() { return null; };
    window.XAxis = function XAxis() { return null; };
    window.YAxis = function YAxis() { return null; };
    window.Cell = function Cell() { return null; };

    function _extractSeries(children, tag) {
      const keys = [];
      React.Children.forEach(children, child => {
        if (React.isValidElement(child) && (child.props?.dataKey || child.type?.name === tag)) {
          keys.push({
            dataKey: child.props?.dataKey,
            color: child.props?.stroke || child.props?.fill || '#6366f1',
            name: child.props?.name || child.props?.dataKey
          });
        }
      });
      return keys.length ? keys : [{ dataKey: 'value', color: '#6366f1' }];
    }

    window.LineChart = function LineChart({ data = [], children }) {
      const series = _extractSeries(children, 'Line');
      const w = 480;
      const h = 200;
      const pad = 24;
      const count = Math.max(data.length, 1);
      const stepX = (w - pad * 2) / Math.max(count - 1, 1);

      let maxVal = 10;
      data.forEach(d => {
        series.forEach(s => {
          const v = Number(d[s.dataKey]) || 0;
          if (v > maxVal) maxVal = v;
        });
      });

      return React.createElement('svg', {
        viewBox: '0 0 ' + w + ' ' + h,
        className: 'w-full h-full overflow-visible font-sans'
      }, [
        [0.25, 0.5, 0.75, 1].map((pct, i) => React.createElement('line', {
          key: 'grid-' + i,
          x1: pad, y1: (h - pad) - pct * (h - pad * 2),
          x2: w - pad, y2: (h - pad) - pct * (h - pad * 2),
          stroke: 'rgba(255,255,255,0.08)', strokeDasharray: '3 3'
        })),
        series.map((s, si) => {
          const points = data.map((d, i) => {
            const val = Number(d[s.dataKey]) || 0;
            const x = pad + i * stepX;
            const y = (h - pad) - (val / maxVal) * (h - pad * 2);
            return { x, y };
          });
          const pathD = points.map((p, i) => (i === 0 ? 'M ' + p.x + ' ' + p.y : 'L ' + p.x + ' ' + p.y)).join(' ');
          return React.createElement('g', { key: 'series-' + si }, [
            React.createElement('path', {
              key: 'line-' + si,
              d: pathD,
              fill: 'none',
              stroke: s.color,
              strokeWidth: 2.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round'
            }),
            points.map((p, pi) => React.createElement('circle', {
              key: 'dot-' + pi,
              cx: p.x, cy: p.y, r: 3.5,
              fill: s.color, stroke: '#090a0f', strokeWidth: 1.5
            }))
          ]);
        }),
        data.map((d, i) => {
          const xLabel = d.name || d.month || d.label || d.date || String(i + 1);
          return React.createElement('text', {
            key: 'label-' + i,
            x: pad + i * stepX,
            y: h - 6,
            textAnchor: 'middle',
            fill: 'rgba(255,255,255,0.4)',
            fontSize: '9px'
          }, String(xLabel).slice(0, 4));
        })
      ]);
    };

    window.AreaChart = function AreaChart({ data = [], children }) {
      const series = _extractSeries(children, 'Area');
      const w = 480;
      const h = 200;
      const pad = 24;
      const count = Math.max(data.length, 1);
      const stepX = (w - pad * 2) / Math.max(count - 1, 1);

      let maxVal = 10;
      data.forEach(d => {
        series.forEach(s => {
          const v = Number(d[s.dataKey]) || 0;
          if (v > maxVal) maxVal = v;
        });
      });

      return React.createElement('svg', {
        viewBox: '0 0 ' + w + ' ' + h,
        className: 'w-full h-full overflow-visible font-sans'
      }, [
        React.createElement('defs', { key: 'defs' },
          series.map((s, si) => React.createElement('linearGradient', {
            key: 'grad-' + si, id: 'area-grad-' + si, x1: 0, y1: 0, x2: 0, y2: 1
          }, [
            React.createElement('stop', { key: 's1', offset: '5%', stopColor: s.color, stopOpacity: 0.4 }),
            React.createElement('stop', { key: 's2', offset: '95%', stopColor: s.color, stopOpacity: 0 })
          ]))
        ),
        series.map((s, si) => {
          const points = data.map((d, i) => {
            const val = Number(d[s.dataKey]) || 0;
            const x = pad + i * stepX;
            const y = (h - pad) - (val / maxVal) * (h - pad * 2);
            return { x, y };
          });
          if (!points.length) return null;
          const lineD = points.map((p, i) => (i === 0 ? 'M ' + p.x + ' ' + p.y : 'L ' + p.x + ' ' + p.y)).join(' ');
          const areaD = lineD + ' L ' + (pad + (data.length - 1) * stepX) + ' ' + (h - pad) + ' L ' + pad + ' ' + (h - pad) + ' Z';
          return React.createElement('g', { key: 'area-series-' + si }, [
            React.createElement('path', { key: 'area-fill-' + si, d: areaD, fill: 'url(#area-grad-' + si + ')' }),
            React.createElement('path', { key: 'area-line-' + si, d: lineD, fill: 'none', stroke: s.color, strokeWidth: 2 })
          ]);
        })
      ]);
    };

    window.BarChart = function BarChart({ data = [], children }) {
      const series = _extractSeries(children, 'Bar');
      const w = 480;
      const h = 200;
      const pad = 24;
      const count = Math.max(data.length, 1);
      const slotW = (w - pad * 2) / count;
      const barW = Math.max(8, Math.min(28, (slotW * 0.55) / series.length));

      let maxVal = 10;
      data.forEach(d => {
        series.forEach(s => {
          const v = Number(d[s.dataKey]) || 0;
          if (v > maxVal) maxVal = v;
        });
      });

      return React.createElement('svg', {
        viewBox: '0 0 ' + w + ' ' + h,
        className: 'w-full h-full overflow-visible font-sans'
      }, [
        data.map((d, di) => {
          const slotX = pad + di * slotW;
          return React.createElement('g', { key: 'slot-' + di }, [
            series.map((s, si) => {
              const val = Number(d[s.dataKey]) || 0;
              const barH = (val / maxVal) * (h - pad * 2);
              const bx = slotX + (slotW - barW * series.length) / 2 + si * barW;
              const by = (h - pad) - barH;
              return React.createElement('rect', {
                key: 'bar-' + si,
                x: bx, y: by, width: barW - 2, height: Math.max(2, barH),
                fill: s.color, rx: 3
              });
            }),
            React.createElement('text', {
              key: 'lbl-' + di,
              x: slotX + slotW / 2, y: h - 6,
              textAnchor: 'middle', fill: 'rgba(255,255,255,0.4)', fontSize: '9px'
            }, String(d.name || d.month || d.label || di + 1).slice(0, 4))
          ]);
        })
      ]);
    };

    window.PieChart = function PieChart() {
      return React.createElement('div', { className: 'w-full h-full flex items-center justify-center p-4' },
        React.createElement('div', {
          className: 'w-28 h-28 rounded-full border-4 border-indigo-500/80 bg-gradient-to-tr from-indigo-500/20 to-purple-500/30 flex items-center justify-center text-xs text-indigo-300 font-bold'
        }, '100%')
      );
    };

    window.Line = function Line() { return null; };
    window.Bar = function Bar() { return null; };
    window.Area = function Area() { return null; };
    window.Pie = function Pie() { return null; };

    var ResponsiveContainer = window.ResponsiveContainer;
    var LineChart = window.LineChart;
    var BarChart = window.BarChart;
    var AreaChart = window.AreaChart;
    var PieChart = window.PieChart;
    var Line = window.Line;
    var Bar = window.Bar;
    var Area = window.Area;
    var Pie = window.Pie;
    var XAxis = window.XAxis;
    var YAxis = window.YAxis;
    var Tooltip = window.Tooltip;
    var Legend = window.Legend;
    var CartesianGrid = window.CartesianGrid;
    var Cell = window.Cell;

    // ── API Functions & Stubs ───────────────────────────────────────────────
    ${apiCode}
    ${apiStubs}

    // ── Dynamic Icon Component Declarations ─────────────────────────────────
    ${iconDeclarations}

    class GlobalErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }
      componentDidCatch(error, info) {
        console.error("Preview caught error:", error, info);
        window.parent.postMessage({
          type: 'AUTO_FIX_ERROR',
          error: 'React ErrorBoundary: ' + (error?.message || 'Component Crash'),
          source: 'react_error_boundary'
        }, '*');
      }
      render() {
        if (this.state.hasError) {
          return (
            <div className="min-h-screen bg-[#0d111a] text-red-400 p-8 flex flex-col items-center justify-center space-y-4">
              <div className="p-6 max-w-lg w-full bg-red-950/40 border border-red-500/30 rounded-2xl shadow-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Preview Runtime Error</h3>
                </div>
                <pre className="text-xs bg-black/60 p-3 rounded-xl overflow-x-auto text-red-300 font-mono">
                  {this.state.error?.message || 'Unknown error'}
                </pre>
                <button
                  onClick={() => {
                    window.parent.postMessage({
                      type: 'AUTO_FIX_ERROR',
                      error: this.state.error?.message || 'Runtime crash'
                    }, '*');
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  ⚡ Auto-Fix this Error with Copilot AI
                </button>
              </div>
            </div>
          );
        }
        return this.props.children;
      }
    }

    // ── Sub-Components Injected from Workspace ─────────────────────────────
    ${subComponentsCode}

    ${subImportAliases}

    // ── Primary App Component ──────────────────────────────────────────────
    ${cleanedCode}

    ${rootAlias}

    const _appMountContainer = document.getElementById('root');
    let _previewMountRoot = window.__aiDostRootInstance;
    if (!_previewMountRoot && _appMountContainer) {
      _previewMountRoot = window.__aiDostRootInstance = ReactDOM.createRoot(_appMountContainer);
    }
    let _RootComponent = typeof App !== 'undefined' && App ? App :
      (typeof Main !== 'undefined' && Main ? Main :
      (typeof Page !== 'undefined' && Page ? Page :
      (typeof Dashboard !== 'undefined' && Dashboard ? Dashboard :
      (typeof Portfolio !== 'undefined' && Portfolio ? Portfolio :
      (typeof Home !== 'undefined' && Home ? Home :
      (typeof Index !== 'undefined' && Index ? Index :
      (typeof window.__rootComponent !== 'undefined' ? window.__rootComponent : null)))))));

    if (!_RootComponent) {
      for (const k of Object.keys(window)) {
        if (typeof window[k] === 'function' && /^[A-Z]/.test(k) && !['React', 'ReactDOM', 'GlobalErrorBoundary', 'Fragment'].includes(k)) {
          _RootComponent = window[k];
          break;
        }
      }
    }

    if ((typeof App === 'undefined' || !App) && !_RootComponent) {
      // Mount failure is outside GlobalErrorBoundary's reach (the ReferenceError
      // fires while evaluating <App />), so surface it as a readable card.
      try { report('RUNTIME_ERROR', { error: 'Root component not found: no App export in workspace entry file' }); } catch (_) {}
      if (_appMountContainer) {
        _appMountContainer.innerHTML = '<div style="max-width:420px;text-align:center;padding:24px;border:1px solid #334155;border-radius:16px;background:#0f172a;color:#94a3b8;font-family:Inter,sans-serif">' +
          '<div style="font-size:20px;margin-bottom:8px">🧩</div>' +
          '<div style="color:#e2e8f0;font-weight:600;margin-bottom:6px">Preview could not mount a root component</div>' +
          '<div style="font-size:12px;line-height:1.6">No <code style="color:#818cf8">App</code> (or default export) was found in <code style="color:#818cf8">src/App.jsx</code>.<br>Check the entry file and retry.</div>' +
          '</div>';
      }
    } else {
      const TargetComponent = _RootComponent || App;
      _previewMountRoot.render(
        <GlobalErrorBoundary>
          <TargetComponent />
        </GlobalErrorBoundary>
      );
    }

    // ── Visual Element Inspector Instrumentation ────────────────────────────
    let _inspectorActive = ${inspectorActive ? 'true' : 'false'};
    let _hoveredEl = null;
    let _badge = null;

    function _getBadge() {
      if (_badge) return _badge;
      _badge = document.createElement('div');
      _badge.id = '_aidost_inspector_badge';
      _badge.style.cssText = 'position:fixed;z-index:999999;display:none;padding:4px 9px;border-radius:6px;background:rgba(15,23,42,0.95);color:#818cf8;border:1px solid #6366f1;font-family:monospace;font-size:11px;font-weight:600;pointer-events:none;box-shadow:0 8px 16px rgba(0,0,0,0.5);white-space:nowrap;backdrop-filter:blur(8px);';
      document.body.appendChild(_badge);
      return _badge;
    }

    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'SET_INSPECTOR_ACTIVE') {
        _inspectorActive = Boolean(e.data.active);
        if (!_inspectorActive && _hoveredEl) {
          _hoveredEl.style.outline = '';
          _hoveredEl.style.boxShadow = '';
          if (_badge) _badge.style.display = 'none';
        }
      }
    });

    document.addEventListener('mouseover', function(e) {
      if (!_inspectorActive) return;
      const el = e.target;
      if (el === document.body || el === document.documentElement || el.id === '_aidost_inspector_badge') return;
      if (_hoveredEl && _hoveredEl !== el) {
        _hoveredEl.style.outline = '';
        _hoveredEl.style.boxShadow = '';
      }
      _hoveredEl = el;
      el.style.outline = '2px dashed #6366f1';
      el.style.outlineOffset = '2px';
      el.style.boxShadow = '0 0 12px rgba(99,102,241,0.35)';

      const badge = _getBadge();
      const rect = el.getBoundingClientRect();
      const tag = el.tagName.toLowerCase();
      const cls = el.className ? '.' + String(el.className).trim().split(/\\s+/).slice(0, 2).join('.') : '';
      const text = el.innerText ? ' \"' + el.innerText.trim().slice(0, 20) + '\"' : '';
      badge.textContent = '<' + tag + cls + '>' + text;
      badge.style.display = 'block';
      badge.style.top = Math.max(6, rect.top - 28) + 'px';
      badge.style.left = Math.max(6, rect.left) + 'px';
    }, true);

    document.addEventListener('mouseout', function(e) {
      if (!_inspectorActive) return;
      if (_hoveredEl) {
        _hoveredEl.style.outline = '';
        _hoveredEl.style.boxShadow = '';
      }
      if (_badge) _badge.style.display = 'none';
    }, true);

    function _buildSelector(el) {
      if (!el || el === document.body) return 'body';
      if (el.id) return '#' + el.id;
      var path = [];
      var cur = el;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        var tag = cur.tagName.toLowerCase();
        if (cur.id) { path.unshift(tag + '#' + cur.id); break; }
        var cls = cur.className ? '.' + String(cur.className).trim().split(/\\s+/).slice(0, 2).join('.') : '';
        var idx = 1;
        var sib = cur.previousElementSibling;
        while (sib) { if (sib.tagName === cur.tagName) idx++; sib = sib.previousElementSibling; }
        path.unshift(tag + cls + ':nth-of-type(' + idx + ')');
        cur = cur.parentElement;
      }
      return path.join(' > ');
    }

    document.addEventListener('click', function(e) {
      if (!_inspectorActive) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      const tag = el.tagName.toLowerCase();
      const className = el.className || '';
      const text = (el.innerText || '').trim().slice(0, 60);
      const id = el.id || '';
      const selector = _buildSelector(el);
      const outerHTML = el.outerHTML ? el.outerHTML.slice(0, 500) : '';
      const computedStyle = window.getComputedStyle(el);
      const styles = {
        color: computedStyle.color,
        background: computedStyle.background,
        fontSize: computedStyle.fontSize,
        padding: computedStyle.padding,
        margin: computedStyle.margin,
        borderRadius: computedStyle.borderRadius
      };

      window.parent.postMessage({
        type: 'INSPECT_ELEMENT',
        element: { tag, className, text, id, selector, outerHTML, styles }
      }, '*');

      el.style.outline = '3px solid #10b981';
      setTimeout(() => {
        if (el) {
          el.style.outline = '';
          el.style.boxShadow = '';
        }
      }, 800);
    }, true);
  </script>
</body>
</html>`;
}
