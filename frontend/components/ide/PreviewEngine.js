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

export function generateLiveAppHtml(files = [], contents = {}, inspectorActive = false) {
  const norm = (p) => (p || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').trim();

  // Find index.html if present
  const indexHtmlFile = (files || []).find(f => norm(f.path) === 'index.html' || norm(f.path).endsWith('/index.html'));
  const rawIndexHtml = indexHtmlFile ? (contents[indexHtmlFile.path] || contents[norm(indexHtmlFile.path)] || indexHtmlFile.content || '') : (contents['index.html'] || '');

  // Look for primary React component (App.jsx, App.js, App.tsx, or main.jsx)
  let appCode = contents['src/App.jsx'] || contents['App.jsx'] || contents['src/App.js'] || contents['App.js'] || '';
  if (!appCode) {
    const appFile = (files || []).find(f => {
      const p = norm(f.path);
      return p.endsWith('App.jsx') || p.endsWith('App.js') || p.endsWith('App.tsx');
    });
    if (appFile) appCode = contents[appFile.path] || contents[norm(appFile.path)] || appFile.content || '';
  }

  if (!appCode) {
    const mainFile = (files || []).find(f => {
      const p = norm(f.path);
      return p.endsWith('main.jsx') || p.endsWith('main.js') || p.endsWith('index.jsx') || p.endsWith('index.js');
    });
    if (mainFile) appCode = contents[mainFile.path] || contents[norm(mainFile.path)] || mainFile.content || '';
  }
  if (!appCode) {
    for (const f of (files || [])) {
      const p = norm(f.path);
      const code = contents[f.path] || contents[p] || f.content || '';
      if (code && (p.endsWith('.jsx') || p.endsWith('.tsx') || p.endsWith('.js')) && !p.endsWith('.config.js') && (code.includes('export default') || code.includes('function App') || code.includes('const App'))) {
        appCode = code;
        break;
      }
    }
  }

  const isReactOrViteApp = Boolean(
    appCode ||
    (rawIndexHtml && (rawIndexHtml.includes('src/main') || rawIndexHtml.includes('src/App'))) ||
    (files || []).some(f => {
      const p = norm(f.path);
      return p.endsWith('.jsx') || p.endsWith('.tsx') || p === 'package.json' || p.endsWith('/package.json');
    })
  );

  // If this is a static website (HTML/CSS/JS without React App code, or contains full HTML structure)
  if (!isReactOrViteApp && rawIndexHtml && rawIndexHtml.includes('<body')) {
    let injectedHtml = rawIndexHtml;
    // Inject style.css if present
    const cssFile = (files || []).find(f => norm(f.path).endsWith('.css'));
    if (cssFile && !injectedHtml.includes('<style>')) {
      const cssContent = contents[cssFile.path] || contents[norm(cssFile.path)] || cssFile.content || '';
      if (cssContent) {
        injectedHtml = injectedHtml.replace('</head>', `<style>${cssContent}</style></head>`);
      }
    }
    // Inject script.js if present
    const jsFile = (files || []).find(f => norm(f.path).endsWith('script.js') || norm(f.path).endsWith('main.js'));
    if (jsFile && !injectedHtml.includes(jsFile.path)) {
      const jsContent = contents[jsFile.path] || contents[norm(jsFile.path)] || jsFile.content || '';
      if (jsContent) {
        injectedHtml = injectedHtml.replace('</body>', `<script>${jsContent}</script></body>`);
      }
    }
    return injectedHtml.replace('</head>', `${PREVIEW_TELEMETRY_SCRIPT}</head>`);
  }

  if (isReactOrViteApp && !appCode) {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <title>Loading Application...</title>
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
    .replace(/export\s+default\s+(\w+);?/g, '')
    .replace(/export\s+(?:async\s+)?function\s+(\w+)/g, 'async function $1')
    .replace(/export\s+(?:const|let|var)\s+(\w+)/g, 'const $1')
    .replace(/export\s+\{[\s\S]*?\};?/g, '');

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

  // Load and clean src/services/api.js if available
  const apiFile = (files || []).find(f => f.path?.endsWith('api.js') || f.path?.endsWith('api.ts'));
  let apiCode = '';
  if (apiFile && contents[apiFile.path]) {
    apiCode = (contents[apiFile.path] || '')
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

  // Inject sub-components from src/components/*.jsx or *.jsx so App can render them
  let subComponentsCode = '';
  (files || []).forEach(f => {
    if (f.path && f.path.endsWith('.jsx') && !f.path.endsWith('App.jsx') && !f.path.endsWith('main.jsx')) {
      const subContent = contents[f.path] || f.content || '';
      if (subContent) {
        const cleanedSub = subContent
          .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '')
          .replace(/import\s+['"].*?['"];?/g, '')
          .replace(/export\s+default\s+function\s*(\w*)/g, (m, name) => name ? `function ${name}` : '')
          .replace(/export\s+default\s+const\s+(\w+)\s*=/g, 'const $1 =')
          .replace(/export\s+default\s+(\w+);?/g, '')
          .replace(/export\s+(?:async\s+)?function\s+(\w+)/g, 'function $1')
          .replace(/export\s+(?:const|let|var)\s+(\w+)/g, 'const $1')
          .replace(/export\s+\{[\s\S]*?\};?/g, '');
        subComponentsCode += '\n' + cleanedSub + '\n';
      }
    }
  });

  const declaredComponents = new Set();
  const declMatches = ((appCode || '') + '\n' + subComponentsCode).matchAll(/(?:function|class|const|let|var)\s+([A-Z][A-Za-z0-9_]*)/g);
  for (const m of declMatches) {
    if (m[1]) declaredComponents.add(m[1]);
  }

  const jsxTags = (appCode || '').match(/<([A-Z][A-Za-z0-9_]*)/g) || [];
  const tagsList = jsxTags.map(t => t.replace('<', '').trim());

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
    ...tagsList
  ])).filter(name => !declaredComponents.has(name) && !['App', 'Main', 'Root', 'React', 'ReactDOM', 'GlobalErrorBoundary', 'Fragment'].includes(name));

  const iconDeclarations = ALL_DETECTED_ICONS.map(name =>
    `if (typeof window.${name} === 'undefined') {
      window.${name} = function ${name}Icon(props) {
        const size = props?.size || 18;
        const className = props?.className || '';
        return React.createElement('span', {
          className: 'inline-flex items-center justify-center text-sky-400 font-bold ' + className,
          style: { width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
          title: '${name}'
        }, '✦');
      };
    }
    var ${name} = window.${name};`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

    // ── Smart In-Memory REST & Fetch Router for Preview ─────────────────────
    const _origFetch = window.fetch;
    const _db = {
      notes: [
        { id: '1', title: 'System Architecture', content: '# Core Design\\n\\n- Reactive state management\\n- Zero-latency preview sync\\n- Dark Linear design tokens', tags: ['architecture', 'saas'], createdAt: new Date().toISOString() },
        { id: '2', title: 'Roadmap & Specs', content: '## Sprint 1 Goals\\n\\n- SQLite REST API: Completed\\n- Split Editor: Active', tags: ['roadmap', 'product'], createdAt: new Date().toISOString() }
      ],
      tags: ['architecture', 'saas', 'roadmap', 'product', 'design'],
      items: [
        { id: '1', title: 'Primary Item', name: 'Sample Item 1', status: 'Active', count: 10, price: 99, tags: ['general'] }
      ]
    };

    window.fetch = async function(url, options = {}) {
      const rawUrl = String(url || '').split('?')[0];
      const withoutProto = rawUrl.indexOf('://') !== -1 ? rawUrl.split('://')[1].split('/').slice(1).join('/') : rawUrl;
      const cleanPath = withoutProto.startsWith('api/') ? withoutProto.slice(4) : (withoutProto.startsWith('/') ? withoutProto.slice(1) : withoutProto);
      const method = (options.method || 'GET').toUpperCase();
      const resource = cleanPath.split('/')[0] || 'items';

      if (!_db[resource]) {
        _db[resource] = [
          { id: '1', title: 'Sample ' + resource, name: 'Item 1', status: 'Active', count: 5, tags: ['default'], createdAt: new Date().toISOString() }
        ];
      }

      if (method === 'GET') {
        const id = cleanPath.split('/')[1];
        const data = Array.isArray(_db[resource]) && id
          ? _db[resource].find(x => x.id === id) || _db[resource][0]
          : _db[resource];
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (method === 'POST') {
        let body = {};
        try { body = JSON.parse(options.body || '{}'); } catch(_) {}
        const newItem = { id: String(Date.now()), ...body, createdAt: new Date().toISOString() };
        if (Array.isArray(_db[resource])) _db[resource].unshift(newItem);
        return new Response(JSON.stringify(newItem), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      if (method === 'PUT' || method === 'PATCH') {
        let body = {};
        try { body = JSON.parse(options.body || '{}'); } catch(_) {}
        const id = cleanPath.split('/')[1];
        let updatedItem = { id: id || '1', ...body };
        if (Array.isArray(_db[resource])) {
          const idx = _db[resource].findIndex(x => x.id === id);
          if (idx !== -1) {
            _db[resource][idx] = { ..._db[resource][idx], ...body };
            updatedItem = _db[resource][idx];
          }
        }
        return new Response(JSON.stringify(updatedItem), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (method === 'DELETE') {
        const id = cleanPath.split('/')[1];
        if (Array.isArray(_db[resource]) && id) {
          _db[resource] = _db[resource].filter(x => x.id !== id);
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (!rawUrl.startsWith('http') || rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) {
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

    // ── Primary App Component ──────────────────────────────────────────────
    ${cleanedCode}

    const container = document.getElementById('root');
    const root = ReactDOM.createRoot(container);
    root.render(
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    );

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
