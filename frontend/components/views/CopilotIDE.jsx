import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  FolderTree, Search, GitBranch, Puzzle, X, Plus, Save,
  Send, Sparkles, Play, Terminal as TerminalIcon,
  Loader2, Bot, Eraser, Eye, Download, Square, RotateCcw, Settings2,
  FilePlus2, FolderPlus, Pencil, Trash2, SaveAll, PanelLeftClose, PanelLeftOpen, ChevronRight, GitCompareArrows, Database,
  Smartphone, Tablet, Monitor, Crosshair,
  Mic, MicOff, LayoutGrid, Zap, Bug, Code2, RefreshCw, ExternalLink, Copy, Check, ArrowRight,
  Code, ShieldCheck, ShoppingCart, BarChart3, Kanban, MessageSquare, Flame, CheckCircle2, ChevronDown, ChevronUp,
  BrainCircuit, Workflow, ArrowUp, CornerDownLeft, Paperclip
} from 'lucide-react';
import api from '../../services/api';
import { LANG_BY_EXT, TreeView, fileTreeFromFiles } from './CopilotTree';
import { PromptModal, QuickOpen, CommandPalette, SearchOverlay, MODAL_ICONS } from './IDEOverlays';
import DiffReviewModal from './DiffReviewModal';
import ProjectWizardModal from './ProjectWizardModal';
import TaskStepItem from './TaskStepItem';
import VisualDebugger from './VisualDebugger';
import { FileExplorer } from '../ide/FileExplorer';
import { WorkspaceTabs } from '../ide/WorkspaceTabs';
import { EditorToolbar } from '../ide/EditorToolbar';
import { TerminalDock } from '../ide/TerminalDock';
import { AiInspector } from '../ide/AiInspector';
import { DiffReview } from '../ide/DiffReview';
import { configureMonacoThemes } from '../ide/MonacoTheme';
import { syncFileToWebContainer } from '../../lib/webcontainer';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: true,
  gfm: true,
});

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
const TerminalPanel = dynamic(() => import('./TerminalPanel'), { ssr: false });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Agent tool action → human-readable live status
const STATUS_BY_ACTION = {
  write_file: '✍️ Writing source code...',
  create_file: '✍️ Creating file...',
  apply_diff: '✏️ Applying surgical code edits...',
  read_file: '📖 Reading file context...',
  list_directory: '📂 Scanning workspace files...',
  run_terminal: '💻 Running terminal command...',
  run_terminal_auto: '💻 Executing background command...',
  run_tests: '🧪 Running automated test suite...',
  search_codebase: '🔍 Analyzing codebase graph...',
  generate_project_from_prompt: '🏗️ Generating full-stack project scaffold...',
  git_init: '🔀 Initializing local git repo...',
  git_add: '🔀 Staging files...',
  git_commit: '🔀 Creating commit snapshot...',
  git_branch: '🔀 Managing git branch...',
  git_log: '🔀 Reading git logs...',
};

// File extension → brand color
const LANG_COLOR = {
  js: '#f7df1e', mjs: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
  html: '#e34f26', htm: '#e34f26', css: '#563d7c', scss: '#cd6799',
  py: '#3776ab', json: '#fbcb40', md: '#8b949e', txt: '#8b949e',
  java: '#f89820', c: '#a8b9cc', cpp: '#659ad2', go: '#00add8',
  rs: '#dea584', sh: '#89e051', yml: '#cb171e', yaml: '#cb171e',
  xml: '#e34f26', svg: '#ffb13b', sql: '#e38c00', php: '#777bb4',
  rb: '#cc342d', lock: '#fbcb40',
};

function AiStudioResponseCard({ message, onSelectFile, onOpenDiff, onRollback, onOpenPreview }) {
  const modelName = message.model || 'Gemini 2.5 Flash + Groq Cascade';
  const duration = message.duration || '12s';
  const files = Array.isArray(message.files) ? message.files : [];
  const content = message.content || message.summary || '';

  const renderedHtml = useMemo(() => {
    try {
      if (!content) return '';
      const raw = marked.parse(content);
      return typeof window !== 'undefined' ? DOMPurify.sanitize(raw) : raw;
    } catch (_) {
      return content;
    }
  }, [content]);

  return (
    <div className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
        <Bot size={15} className="text-white" />
      </div>

      <div className="flex-1 space-y-3 rounded-2xl p-4 border bg-canvas-surface/95 backdrop-blur-md shadow-xl border-border">
        {/* Header: Model & Duration */}
        <div className="flex items-center justify-between text-xs text-ink-muted pb-2.5 border-b border-border">
          <span className="font-medium flex items-center gap-2 text-paper-100">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            {modelName} • {duration}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            Completed
          </span>
        </div>

        {/* Markdown Content */}
        {content && (
          <div
            className="ai-studio-markdown text-xs leading-relaxed text-paper-200 space-y-2.5"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}

        {/* Files Touched Chips */}
        {files.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <span className="text-[10px] uppercase tracking-wider text-ink-muted font-bold block">
              Files Built ({files.length}):
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {files.map((file, idx) => {
                const fileName = typeof file === 'string' ? file : (file.path || file.name || `file-${idx}`);
                const ext = fileName.split('.').pop()?.toLowerCase();
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectFile && onSelectFile(fileName)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono bg-canvas-base hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer shadow-xs hover:border-border-strong"
                    title={`Open ${fileName}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: LANG_COLOR[ext] || '#818cf8' }} />
                    <span className="truncate max-w-[170px]">{fileName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800 text-xs">
          <button
            onClick={onOpenDiff}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium cursor-pointer transition-colors border border-zinc-700"
          >
            <GitCompareArrows size={12} className="text-amber-400" />
            Review Diff
          </button>

          <button
            onClick={onOpenPreview}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer transition-colors shadow-sm shadow-indigo-600/30"
          >
            <Play size={11} className="fill-white" />
            Live Preview
          </button>

          {message.checkpointDir && (
            <button
              onClick={() => onRollback && onRollback(message.checkpointDir)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 font-medium cursor-pointer transition-colors border border-red-500/30"
            >
              <RotateCcw size={12} className="text-red-400" />
              Restore
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── In-Browser Instant Live App Compiler with Error Boundary & Inspector ──────
function generateLiveAppHtml(files = [], contents = {}, inspectorActive = false) {
  let appCode = contents['src/App.jsx'] || contents['App.jsx'] || contents['src/main.jsx'] || '';
  if (!appCode) {
    const appFile = files.find(f => f.path.endsWith('App.jsx') || f.path.endsWith('main.jsx') || f.path.endsWith('index.html'));
    if (appFile) appCode = contents[appFile.path] || appFile.content || '';
  }

  if (!appCode && contents['index.html']) {
    return contents['index.html'];
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
        const clean = id.trim().split(' as ')[0].trim();
        if (clean) importedLucide.push(clean);
      });
    }
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
  ])).filter(name => !['App', 'Main', 'Root', 'React', 'ReactDOM', 'GlobalErrorBoundary', 'Fragment'].includes(name));

  const iconDeclarations = ALL_DETECTED_ICONS.map(name =>
    `const ${name} = function ${name}Icon(props) {
      const size = props.size || 18;
      const className = props.className || '';
      return React.createElement('span', {
        className: 'inline-flex items-center justify-center text-sky-400 font-bold ' + className,
        style: { width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
        title: '${name}'
      }, '✦');
    };`
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

      // Safe local fallback for any unhandled relative or localhost endpoint
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
        type: 'AUTO_FIX_ERROR',
        error: errText,
        source: 'iframe_window_onerror'
      }, '*');
      return false;
    };

    window.addEventListener('unhandledrejection', function(event) {
      const reason = event.reason ? (event.reason.message || event.reason) : 'Unhandled promise';
      window.parent.postMessage({
        type: 'AUTO_FIX_ERROR',
        error: 'Promise Rejection: ' + String(reason),
        source: 'iframe_unhandled_rejection'
      }, '*');
    });

    const _origConsoleError = console.error;
    console.error = function(...args) {
      _origConsoleError.apply(console, args);
      const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      if (text.includes('Error') || text.includes('Uncaught') || text.includes('SyntaxError') || text.includes('TypeError')) {
        window.parent.postMessage({
          type: 'AUTO_FIX_ERROR',
          error: text.slice(0, 300),
          source: 'iframe_console_error'
        }, '*');
      }
    };
  </script>
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; background: #0b0f19; color: #f8fafc; }
    ${inspectorActive ? `
      *:hover { outline: 2px dashed #6366f1 !important; cursor: crosshair !important; }
    ` : ''}
  </style>
</head>
<body>
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

    try {
      ${cleanedCode}

      const RootComp = typeof App !== 'undefined' ? App : (typeof Main !== 'undefined' ? Main : null);
      if (RootComp) {
        ReactDOM.createRoot(document.getElementById('root')).render(
          <GlobalErrorBoundary>
            <RootComp />
          </GlobalErrorBoundary>
        );
      } else {
        ReactDOM.createRoot(document.getElementById('root')).render(
          <div className="min-h-screen flex items-center justify-center text-slate-500 text-xs font-mono">
            Compiling application preview...
          </div>
        );
      }
    } catch(err) {
      document.getElementById('root').innerHTML = '<div style="padding:24px;color:#f87171;font-family:monospace;font-size:12px;"><b>Syntax/Execution Error:</b> ' + err.message + '</div>';
      window.parent.postMessage({
        type: 'AUTO_FIX_ERROR',
        error: 'Babel Compilation Syntax Error: ' + err.message,
        source: 'babel_compilation_error'
      }, '*');
    }
  </script>

  ${inspectorActive ? `
  <script>
    document.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      window.parent.postMessage({
        type: 'INSPECT_ELEMENT',
        tag: el.tagName.toLowerCase(),
        className: el.className || '',
        text: el.innerText ? el.innerText.trim().slice(0, 40) : ''
      }, '*');
    }, true);
  </script>
  ` : ''}
</body>
</html>`;
}

export default function CopilotIDE({ projectId = 'copilot-workspace', projectName = 'Copilot Workspace', onToast }) {
  const [files, setFiles] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [contents, setContents] = useState({});
  const [dirtyPaths, setDirtyPaths] = useState(() => new Set());

  // Workspace Mode: 'code' | 'preview'
  const [workspaceMode, setWorkspaceMode] = useState('code');

  // Left Sidebar & Terminal Collapsible States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Copilot Agent Chat States
  const [copilotMessages, setCopilotMessages] = useState([]);
  const [copilotInput, setCopilotInput] = useState('');
  const [running, setRunning] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [problems, setProblems] = useState(0);
  const [copilotStatus, setCopilotStatus] = useState({ label: '', tone: 'info' });
  const [planTasks, setPlanTasks] = useState([]);
  const [planGate, setPlanGate] = useState(false); // Default to Autopilot (Replit/Bolt style)
  const [pendingPlan, setPendingPlan] = useState(null);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      if (typeof window === 'undefined') return;
      const light = document.body.classList.contains('light-theme') || localStorage.getItem('ai_dost_theme') === 'light';
      setIsLight(light);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', checkTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', checkTheme);
    };
  }, []);

  useEffect(() => {
    if (monacoRef.current?.editor) {
      try {
        monacoRef.current.editor.setTheme(isLight ? 'aidost-light' : 'aidost-dark');
      } catch (_) {}
    }
  }, [isLight]);

  // Live preview configuration
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [inspectorActive, setInspectorActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(`/api/preview/${projectId}`);
  const [previewSourceMode, setPreviewSourceMode] = useState('live'); // 'live' | 'mock'
  const [devServerStatus, setDevServerStatus] = useState({ running: false, state: 'STOPPED', url: null });
  const [devServerLoading, setDevServerLoading] = useState(false);

  // Modals & Overlays
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialPrompt, setWizardInitialPrompt] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);
  const [latestRunId, setLatestRunId] = useState(null);
  const latestRunIdRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);

  // Voice Coding State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Ctrl+K Inline AI Edit State
  const [inlineEditOpen, setInlineEditOpen] = useState(false);
  const [inlineEditPrompt, setInlineEditPrompt] = useState('');
  const [inlineEditLoading, setInlineEditLoading] = useState(false);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const terminalRef = useRef(null);
  const iframeRef = useRef(null);
  const abortRef = useRef(null);
  const activePathRef = useRef(null);
  const endRef = useRef(null);
  const diagTimerRef = useRef(null);
  const [visualDebuggerOpen, setVisualDebuggerOpen] = useState(false);

  const showToast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
  }, [onToast]);

  const loadDevServerStatus = useCallback(async () => {
    try {
      const res = await api.get(`/preview/${projectId}/status`);
      if (res.data?.success) {
        setDevServerStatus(res.data);
      }
    } catch (_) {}
  }, [projectId]);

  useEffect(() => {
    loadDevServerStatus();
    const interval = setInterval(loadDevServerStatus, 5000);
    return () => clearInterval(interval);
  }, [loadDevServerStatus]);

  const handleStartDevServer = async () => {
    setDevServerLoading(true);
    try {
      showToast('🚀 Starting Dev Server...', 'info');
      const res = await api.post(`/preview/${projectId}/dev/start`, { projectPath: '.' });
      if (res.data?.success) {
        showToast(`✅ Dev Server Ready on port ${res.data.hostPort || res.data.port || ''}`, 'success');
        setDevServerStatus(prev => ({ ...prev, running: true, state: 'READY', url: res.data.url }));
        if (iframeRef.current) iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
      } else {
        showToast(`❌ Dev Server Start Failed: ${res.data?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast(`Dev Server error: ${err.message}`, 'error');
    } finally {
      setDevServerLoading(false);
      loadDevServerStatus();
    }
  };

  const handleStopDevServer = async () => {
    try {
      await api.post(`/preview/${projectId}/dev/stop`);
      showToast('⏹️ Dev Server Stopped', 'info');
      setDevServerStatus(prev => ({ ...prev, running: false, state: 'STOPPED' }));
    } catch (err) {
      showToast(`Stop error: ${err.message}`, 'error');
    }
  };

  const handleRestartDevServer = async () => {
    setDevServerLoading(true);
    try {
      showToast('🔄 Restarting Dev Server...', 'info');
      const res = await api.post(`/preview/${projectId}/dev/restart`);
      if (res.data?.success) {
        showToast('✅ Dev Server Restarted', 'success');
        if (iframeRef.current) iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
      }
    } catch (err) {
      showToast(`Restart error: ${err.message}`, 'error');
    } finally {
      setDevServerLoading(false);
      loadDevServerStatus();
    }
  };

  // Voice input setup
  const toggleVoice = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Speech recognition not supported in this browser.', 'warning');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'hi-IN';
      recognition.onstart = () => {
        setIsListening(true);
        showToast('🎙️ Sun raha hoon... Speak your prompt!', 'info');
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setCopilotInput(prev => prev ? `${prev} ${transcript}` : transcript);
          showToast(`🎙️ Captured: "${transcript}"`, 'success');
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch (_) {
      setIsListening(false);
    }
  };

  // Ctrl+K Inline AI Edit
  const triggerInlineEdit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setInlineEditPrompt('');
    setInlineEditOpen(true);
  };

  const handleInlineEditSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!inlineEditPrompt.trim()) return;
    const editor = editorRef.current;
    if (!editor || !activePath) return;

    const selection = editor.getSelection();
    const model = editor.getModel();
    let selectedText = model.getValueInRange(selection);
    let targetRange = selection;

    if (!selectedText.trim()) {
      const pos = editor.getPosition();
      const lineContent = model.getLineContent(pos.lineNumber);
      selectedText = lineContent;
      targetRange = new monacoRef.current.Range(pos.lineNumber, 1, pos.lineNumber, lineContent.length + 1);
    }

    setInlineEditLoading(true);
    try {
      const ext = activePath.split('.').pop()?.toLowerCase();
      const res = await api.post('/agent/inline-edit', {
        code: selectedText,
        prompt: inlineEditPrompt,
        language: LANG_BY_EXT[ext] || 'javascript',
        file: activePath
      });

      if (res.data?.success && res.data?.replacement) {
        editor.executeEdits('inline-ai', [
          { range: targetRange, text: res.data.replacement, forceMoveMarkers: true }
        ]);
        setDirtyPaths(prev => new Set(prev).add(activePath));
        showToast('✨ Inline AI edit applied! (Ctrl+S to save)', 'success');
        setInlineEditOpen(false);
      }
    } catch (err) {
      showToast(`Inline edit failed: ${err.message}`, 'error');
    } finally {
      setInlineEditLoading(false);
    }
  };

  // Active path ref sync
  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  // Auto scroll chat messages
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollTop = endRef.current.scrollHeight;
    }
  }, [copilotMessages, copilotStatus, planTasks]);

  // Suppress benign Monaco editor unmount cancellation errors
  useEffect(() => {
    const handleRejection = (e) => {
      if (e?.reason?.message === 'Canceled' || e?.reason?.name === 'Canceled' || e?.reason === 'Canceled') {
        e.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  // Load workspace files
  const loadWorkspaceFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await api.get(`/memory/project/${projectId}`);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.files || []);
      const fileList = raw.map(f => ({
        path: f.path || f.name,
        content: f.content || '',
        lastModified: f.last_modified || f.lastModified || Date.now()
      }));

      setFiles(fileList);
      const map = {};
      fileList.forEach(f => { map[f.path] = f.content; });
      setContents(map);

      if (fileList.length > 0 && !activePathRef.current && openTabs.length === 0) {
        const priority = ['src/App.jsx', 'src/App.js', 'src/main.jsx', 'src/index.js', 'App.jsx', 'index.html', 'server.js', 'package.json'];
        const target = priority.find(p => fileList.some(f => f.path === p)) || fileList[0].path;
        setOpenTabs([target]);
        setActivePath(target);
        activePathRef.current = target;
      } else if (fileList.length === 0 && !activePathRef.current) {
        setOpenTabs([]);
        setActivePath(null);
      }
    } catch (_) {
      setFiles([]);
      setContents({});
      setOpenTabs([]);
      setActivePath(null);
    } finally {
      setLoadingFiles(false);
    }
  }, [projectId, openTabs.length]);

  useEffect(() => {
    loadWorkspaceFiles();
  }, [loadWorkspaceFiles]);

  // Unified Cross-Module Bridge: Import code or artifacts from Chat / Agent into active editor
  useEffect(() => {
    try {
      const imported = localStorage.getItem('ai_dost_copilot_import');
      if (imported) {
        localStorage.removeItem('ai_dost_copilot_import');
        const data = JSON.parse(imported);
        if (data && data.code) {
          const lang = (data.language || 'javascript').toLowerCase();
          const ext = lang === 'html' ? 'html' : lang === 'css' ? 'css' : lang === 'python' || lang === 'py' ? 'py' : lang === 'json' ? 'json' : lang === 'jsx' ? 'jsx' : lang === 'ts' || lang === 'typescript' ? 'ts' : 'js';
          const filename = data.title ? (data.title.includes('.') ? data.title : `${data.title.replace(/\s+/g, '_')}.${ext}`) : `imported_snippet.${ext}`;

          activePathRef.current = filename;
          setContents(prev => ({ ...prev, [filename]: data.code }));
          setFiles(prev => {
            const exists = prev.some(f => f.path === filename);
            if (exists) {
              return prev.map(f => f.path === filename ? { ...f, content: data.code } : f);
            }
            return [{ path: filename, content: data.code, lastModified: Date.now() }, ...prev];
          });
          setOpenTabs(prev => prev.includes(filename) ? prev : [filename, ...prev]);
          setActivePath(filename);
          setWorkspaceMode('code');
          if (onToast) onToast(`Imported ${filename} from chat into editor`, 'success');
        }
      }
    } catch (_) {}
  }, [onToast]);

  const selectFile = useCallback((fileOrPath) => {
    const pathStr = typeof fileOrPath === 'string' ? fileOrPath : fileOrPath.path;
    if (!pathStr) return;
    if (!openTabs.includes(pathStr)) {
      setOpenTabs(prev => [...prev, pathStr]);
    }
    setActivePath(pathStr);
    setWorkspaceMode('code');
  }, [openTabs]);

  const closeTab = useCallback((pathStr) => {
    setOpenTabs(prev => {
      const next = prev.filter(p => p !== pathStr);
      if (activePath === pathStr) {
        setActivePath(next[next.length - 1] || null);
      }
      return next;
    });
  }, [activePath]);

  const activeContent = activePath ? (contents[activePath] ?? '') : '';
  const activeExt = activePath ? activePath.split('.').pop()?.toLowerCase() : 'js';
  const activeLang = LANG_BY_EXT[activeExt] || 'javascript';

  const setFileContent = (pathStr, newContent) => {
    setContents(prev => ({ ...prev, [pathStr]: newContent }));
  };

  const markDirty = (pathStr) => {
    setDirtyPaths(prev => new Set(prev).add(pathStr));
  };

  const saveActiveFile = async () => {
    if (!activePath) return;
    const content = contents[activePath] ?? '';
    setSaving(true);
    try {
      await api.post(`/memory/project/${projectId}/file`, { path: activePath, content });
      setDirtyPaths(prev => {
        const next = new Set(prev);
        next.delete(activePath);
        return next;
      });
      setFiles(prev => prev.map(f => f.path === activePath ? { ...f, content } : f));
      showToast(`Saved ${activePath}`, 'success');
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveAllFiles = async () => {
    if (dirtyPaths.size === 0) return;
    const saves = Array.from(dirtyPaths).map(p =>
      api.post(`/memory/project/${projectId}/file`, { path: p, content: contents[p] ?? '' })
    );
    try {
      await Promise.all(saves);
      setDirtyPaths(new Set());
      showToast(`All files saved`, 'success');
    } catch (err) {
      showToast(`Save error: ${err.message}`, 'error');
    }
  };

  // LSP Diagnostics
  const setMarkers = useCallback((pathStr, diags) => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;

    const markers = (diags || []).map(d => ({
      severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      message: d.message,
      startLineNumber: d.line || 1,
      startColumn: d.column || 1,
      endLineNumber: d.line || 1,
      endColumn: (d.column || 1) + 10,
    }));
    monaco.editor.setModelMarkers(model, 'lsp', markers);
    setProblems(markers.length);
  }, []);

  const runDiagnostics = useCallback((pathStr, content) => {
    const ext = pathStr.split('.').pop()?.toLowerCase();
    const lang = LANG_BY_EXT[ext];
    if (!lang) return;
    if (diagTimerRef.current) clearTimeout(diagTimerRef.current);
    diagTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.post('/agent/lsp-diagnostics', { code: content, language: lang });
        setMarkers(pathStr, Array.isArray(res.data?.diagnostics) ? res.data.diagnostics : []);
      } catch (_) {}
    }, 500);
  }, [setMarkers]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    try {
      configureMonacoThemes(monaco);
      monaco.editor.setTheme(isLight ? 'aidost-light' : 'aidost-dark');
    } catch (_) {}

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      triggerInlineEdit();
    });

    try {
      const supportedLangs = ['javascript', 'typescript', 'python', 'html', 'css', 'json'];
      supportedLangs.forEach(langId => {
        monaco.languages.registerInlineCompletionsProvider(langId, {
          provideInlineCompletions: async (model, position) => {
            const prefix = model.getValueInRange({
              startLineNumber: Math.max(1, position.lineNumber - 30),
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });
            const suffix = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 20),
              endColumn: 1
            });

            if (!prefix.trim() || prefix.trim().length < 5) return { items: [] };

            try {
              const res = await api.post('/agent/autocomplete', {
                prefix,
                suffix,
                language: langId
              });
              if (res.data?.success && res.data?.completion) {
                return {
                  items: [{
                    insertText: res.data.completion,
                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
                  }]
                };
              }
            } catch (_) {}
            return { items: [] };
          },
          freeInlineCompletions: () => {}
        });
      });
    } catch (_) {}

    if (activePath) runDiagnostics(activePath, activeContent);
  };

  const runSingleFile = () => {
    if (!activePath) return;
    setTerminalOpen(true);
    const ext = activePath.split('.').pop()?.toLowerCase();
    let cmd = `node "${activePath}"`;
    if (ext === 'py') cmd = `python "${activePath}"`;
    if (ext === 'sh') cmd = `bash "${activePath}"`;
    terminalRef.current?.runCommand(cmd);
  };

  const rollbackTo = async (dir) => {
    if (!dir) return;
    try {
      const res = await api.post('/agent/rollback', { dir });
      if (res.data?.success) {
        showToast('Restored workspace snapshot successfully', 'success');
        await loadWorkspaceFiles();
      }
    } catch (err) {
      showToast(`Rollback failed: ${err.message}`, 'error');
    }
  };

  const openProjectWizard = (prompt = '') => {
    setWizardInitialPrompt(prompt);
    setWizardOpen(true);
  };

  const handleWizardBuild = async (spec) => {
    setWizardOpen(false);
    setRunning(true);
    setCopilotStatus({ label: '🏗️ Scaffolding full-stack application...', tone: 'work' });

    try {
      const res = await api.post('/agent/scaffold-wizard', {
        spec,
        projectId
      });

      if (res.data?.success) {
        showToast('🎉 Project scaffolded successfully!', 'success');
        await loadWorkspaceFiles();
        setWorkspaceMode('preview');
      }
    } catch (err) {
      showToast(`Scaffold error: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  // Main SSE Agent Stream Runner
  const runCopilot = async (prompt) => {
    if (!prompt || running) return;
    setRunning(true);
    setCopilotStatus({ label: '🤖 Agent thinking & planning...', tone: 'info' });
    setCopilotMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setCopilotInput('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${BACKEND}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: prompt,
          projectId,
          projectFiles: files
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Agent request failed: ${response.statusText}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'run_started') {
              setLatestRunId(data.runId || null);
              latestRunIdRef.current = data.runId || null;
            }
            else if (data.type === 'plan' || data.type === 'plan_tasks') {
              const tasks = Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data.plan?.tasks) ? data.plan.tasks : []);
              if (tasks.length > 0) {
                setPlanTasks(tasks.map((t, idx) => ({
                  ...t,
                  status: idx === 0 ? 'in_progress' : (t.status || 'pending')
                })));
              }
            }
            else if (data.type === 'thinking' || data.type === 'thought' || data.type === 'agent_status') {
              const msg = data.message || data.thought;
              if (msg && msg.trim()) {
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: msg, agent: data.agent }]);
                setCopilotStatus({ label: msg.substring(0, 45) + '...', tone: 'work' });
                setPlanTasks(prev => prev.map(t => t.status === 'in_progress' ? { ...t, logSnippet: msg.substring(0, 60) } : t));
              }
            }
            else if (data.type === 'tool_call') {
              const action = data.action;
              const label = STATUS_BY_ACTION[action] || `Executing ${action}...`;
              setCopilotStatus({ label, tone: 'work' });
              if (data.thought) {
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: data.thought }]);
              }
              setPlanTasks(prev => {
                let foundActive = false;
                return prev.map(t => {
                  if (t.status === 'in_progress') {
                    foundActive = true;
                    return { ...t, actionType: action, logSnippet: data.thought || label };
                  }
                  return t;
                });
              });
            }
            else if (data.type === 'file_written' || data.type === 'file_changed' || data.type === 'file') {
              const filePath = data.path || data.file;
              const content = data.content || '';
              if (filePath) {
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'file', file: filePath, content: `Created/Updated: ${filePath}` }]);
                setFiles(prev => {
                  const existingIdx = prev.findIndex(f => f.path === filePath);
                  if (existingIdx !== -1) {
                    const updated = [...prev];
                    updated[existingIdx] = { path: filePath, content, lastModified: Date.now() };
                    return updated;
                  }
                  return [...prev, { path: filePath, content, lastModified: Date.now() }];
                });
                setContents(prev => ({ ...prev, [filePath]: content }));
                syncFileToWebContainer(filePath, content);

                // Advance milestone task status dynamically
                setPlanTasks(prev => {
                  let advanced = false;
                  return prev.map((t) => {
                    if (t.status === 'in_progress' && !advanced) {
                      advanced = true;
                      return { ...t, status: 'completed', target: filePath, actionType: 'WRITE' };
                    }
                    return t;
                  }).map((t, idx, arr) => {
                    const prevTask = arr[idx - 1];
                    if (prevTask && prevTask.status === 'completed' && t.status === 'pending') {
                      return { ...t, status: 'in_progress' };
                    }
                    return t;
                  });
                });

                // Auto-open primary component in editor tab
                if (!activePathRef.current || filePath.endsWith('App.jsx') || filePath.endsWith('main.jsx')) {
                  setActivePath(filePath);
                  setOpenTabs(prev => prev.includes(filePath) ? prev : [...prev, filePath]);
                }
              }
            }
            else if (data.type === 'step') {
              const log = data.stepLog || {};
              if (log.thought || log.action) {
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'step', content: log.thought || log.action }]);
              }
            }
            else if (data.type === 'screenshot') {
              if (data.data) {
                setCopilotMessages(prev => [...prev, {
                  role: 'assistant',
                  kind: 'screenshot',
                  image: `data:${data.mimeType || 'image/png'};base64,${data.data}`,
                  url: data.url || 'http://localhost:3000',
                  message: data.message || 'Live Application UI Verification Snapshot'
                }]);
              }
            }
            else if (data.type === 'vision') {
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: `👁️ Vision QA: ${data.message}` }]);
            }
            else if (data.type === 'done') {
              const stepCount = Array.isArray(data.steps) ? data.steps.length : (data.steps || '?');
              setPlanTasks(prev => prev.map(t => ({ ...t, status: 'completed' })));
              setCopilotStatus({ label: `✅ Done — ${stepCount} steps`, tone: 'success' });

              setCopilotMessages(prev => [
                ...prev,
                {
                  role: 'assistant',
                  kind: 'aistudio_card',
                  model: 'Gemini 2.5 Flash + Groq Cascade',
                  duration: `${Math.max(6, parseInt(stepCount) * 4 || 12)}s`,
                  files: files.map(f => f.path),
                  content: data.message || `🎉 Fullstack task completed successfully across ${stepCount} steps.`,
                  summary: data.message
                }
              ]);

              await loadWorkspaceFiles();
              setWorkspaceMode('preview');
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setCopilotStatus({ label: `⚠️ ${err.message}`, tone: 'error' });
        showToast(err.message, 'error');
      }
    } finally {
      setRunning(false);
    }
  };

  const handleSend = async (text, isWizardPrompt = false) => {
    if (isWizardPrompt) {
      return openProjectWizard(text || copilotInput);
    }
    const prompt = (text || copilotInput).trim();
    if (!prompt || running) return;

    if (!planGate) {
      return runCopilot(prompt);
    }

    setCopilotInput('');
    setCopilotMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setCopilotStatus({ label: '📋 Planning architecture...', tone: 'info' });

    try {
      const res = await api.post('/agent/plan', { userPrompt: prompt });
      const tasks = Array.isArray(res.data?.plan?.tasks) ? res.data.plan.tasks : [];
      if (tasks.length === 0) return runCopilot(prompt);
      setPendingPlan({ prompt, summary: res.data.plan?.summary || '', tasks });
    } catch (_) {
      runCopilot(prompt);
    }
  };

  const approvePlan = () => {
    if (!pendingPlan) return;
    const prompt = pendingPlan.prompt;
    setPendingPlan(null);
    runCopilot(prompt);
  };

  const cancelPlan = () => {
    setPendingPlan(null);
    setCopilotStatus({ label: 'Plan cancelled', tone: 'neutral' });
  };

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // Preview Iframe Auto-Fix & Inspector message listener
  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'AUTO_FIX_ERROR') {
        showToast('⚡ Sending runtime error to Copilot for auto-healing...', 'info');
        handleSendRef.current(`Fix this runtime error in the application: ${e.data.error}`);
      } else if (e.data.type === 'INSPECT_ELEMENT') {
        const promptText = `Edit the <${e.data.tag}> element (class: "${e.data.className}", text: "${e.data.text}"): `;
        setCopilotInput(promptText);
        showToast(`🎯 Selected <${e.data.tag}> in inspector! Type your edit instructions in chat.`, 'success');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showToast]);

  // ── File & Folder CRUD + New Project Handlers ──────────────────────────────
  const handleCreateFile = async (parentFolder = '') => {
    const name = window.prompt(parentFolder ? `Create new file inside ${parentFolder}:` : 'Enter new file name (e.g. src/components/Card.jsx):');
    if (!name || !name.trim()) return;
    const fullPath = parentFolder ? `${parentFolder}/${name.trim()}` : name.trim();
    try {
      await api.post(`/memory/project/${projectId}/file`, { path: fullPath, content: '' });
      setContents(prev => ({ ...prev, [fullPath]: '' }));
      setFiles(prev => [...prev, { path: fullPath, content: '', lastModified: Date.now() }]);
      setOpenTabs(prev => prev.includes(fullPath) ? prev : [...prev, fullPath]);
      setActivePath(fullPath);
      showToast(`📄 Created file ${fullPath}`, 'success');
    } catch (err) {
      showToast(`Create file failed: ${err.message}`, 'error');
    }
  };

  const handleCreateFolder = async (parentFolder = '') => {
    const name = window.prompt(parentFolder ? `Create folder inside ${parentFolder}:` : 'Enter new folder name (e.g. src/utils):');
    if (!name || !name.trim()) return;
    const fullPath = parentFolder ? `${parentFolder}/${name.trim()}` : name.trim();
    try {
      await api.post(`/memory/project/${projectId}/folder`, { path: fullPath });
      const placeholderFile = `${fullPath}/.gitkeep`;
      setContents(prev => ({ ...prev, [placeholderFile]: '' }));
      setFiles(prev => [...prev, { path: placeholderFile, content: '', lastModified: Date.now() }]);
      showToast(`📁 Created folder ${fullPath}`, 'success');
    } catch (err) {
      showToast(`Create folder failed: ${err.message}`, 'error');
    }
  };

  const handleRename = async (oldPath) => {
    const newName = window.prompt(`Rename "${oldPath}" to:`, oldPath);
    if (!newName || !newName.trim() || newName.trim() === oldPath) return;
    const newPath = newName.trim();
    try {
      await api.post(`/memory/project/${projectId}/rename`, { oldPath, newPath });
      const oldContent = contents[oldPath] || '';
      setContents(prev => {
        const next = { ...prev, [newPath]: oldContent };
        delete next[oldPath];
        return next;
      });
      setFiles(prev => prev.map(f => f.path === oldPath ? { ...f, path: newPath } : f));
      setOpenTabs(prev => prev.map(t => t === oldPath ? newPath : t));
      if (activePath === oldPath) setActivePath(newPath);
      showToast(`✏️ Renamed to ${newPath}`, 'success');
    } catch (err) {
      showToast(`Rename failed: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (filePath) => {
    if (!window.confirm(`Are you sure you want to delete "${filePath}"?`)) return;
    try {
      await api.delete(`/memory/project/${projectId}/file`, { data: { path: filePath } });
      setContents(prev => {
        const next = { ...prev };
        delete next[filePath];
        return next;
      });
      setFiles(prev => prev.filter(f => f.path !== filePath));
      setOpenTabs(prev => prev.filter(t => t !== filePath));
      if (activePath === filePath) setActivePath(null);
      showToast(`🗑️ Deleted ${filePath}`, 'info');
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteFolder = async (folderPath) => {
    if (!window.confirm(`Are you sure you want to delete folder "${folderPath}" and all its contents?`)) return;
    try {
      await api.delete(`/memory/project/${projectId}/folder`, { data: { path: folderPath } });
      setFiles(prev => prev.filter(f => !f.path.startsWith(folderPath)));
      setContents(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.startsWith(folderPath)) delete next[k];
        });
        return next;
      });
      setOpenTabs(prev => prev.filter(t => !t.startsWith(folderPath)));
      if (activePath && activePath.startsWith(folderPath)) setActivePath(null);
      showToast(`🗑️ Deleted folder ${folderPath}`, 'info');
    } catch (err) {
      showToast(`Delete folder failed: ${err.message}`, 'error');
    }
  };

  const handleNewProject = async () => {
    if (files.length > 0 && !window.confirm('Start a new project? Current project files will be reset.')) return;
    try {
      await api.delete(`/memory/project/${projectId}`);
      setFiles([]);
      setContents({});
      setOpenTabs([]);
      setActivePath(null);
      setCopilotMessages([]);
      setPlanTasks([]);
      setCopilotStatus({ label: '', tone: 'info' });
      setWorkspaceMode('code');
      showToast('✨ Fresh new project initialized! Select a starter template below.', 'success');
    } catch (err) {
      showToast(`New project error: ${err.message}`, 'error');
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-canvas-base text-paper-100 select-none overflow-hidden font-sans">
      {/* ── TOP ACTION BAR (Linear/Cursor style header) ────────────────────────── */}
      <header className="h-13 shrink-0 flex items-center justify-between px-4 bg-canvas-surface border-b border-border z-20">
        {/* Left: Project identity + New Project button */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-accent text-white shadow-glow-sm">
            <Sparkles size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-paper-100 tracking-tight">{projectName}</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                Live
              </span>
            </div>
            <span className="text-[10px] text-ink-muted font-mono">React 19 • Express • Vite • SQLite</span>
          </div>

          <button
            onClick={handleNewProject}
            className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all shadow-xs cursor-pointer"
            title="Create a fresh empty project"
          >
            <Plus size={12} className="text-accent" /> New Project
          </button>
        </div>

        {/* Center: Workspace Mode Switcher (Code Editor vs Live Preview) */}
        <div className="flex items-center bg-canvas-base p-1 rounded-lg border border-border shadow-inner">
          <button
            onClick={() => setWorkspaceMode('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              workspaceMode === 'code'
                ? 'bg-accent text-white shadow-glow-sm font-semibold'
                : 'text-ink-muted hover:text-paper-100'
            }`}
          >
            <Code size={13} /> Code Editor
          </button>

          <button
            onClick={() => setWorkspaceMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              workspaceMode === 'preview'
                ? 'bg-emerald-600 text-white shadow-md font-semibold'
                : 'text-ink-muted hover:text-paper-100'
            }`}
          >
            <Eye size={13} /> Live Preview
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        </div>

        {/* Right: Quick Launchers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openProjectWizard()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-accent border border-accent/20 hover:border-accent/40 transition-all cursor-pointer shadow-xs"
            title="Launch Project Architect Wizard"
          >
            <Sparkles size={13} className="text-accent" /> App Wizard
          </button>

          <button
            onClick={saveAllFiles}
            disabled={dirtyPaths.size === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all disabled:opacity-40 cursor-pointer"
            title="Save all modified files"
          >
            <SaveAll size={13} className="text-emerald-500" />
            Save{dirtyPaths.size > 0 ? ` (${dirtyPaths.size})` : ''}
          </button>

          <a
            href={`${BACKEND}/api/preview/${projectId}/zip`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer"
            title="Download ZIP with Windows & Mac double-click launchers"
          >
            <Download size={13} className="text-accent" /> ZIP
          </a>
        </div>
      </header>

      {/* ── 2. MASTER 2-COLUMN SPLIT (Left: AI Copilot | Right: Code/Preview) ───── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT PANE: AI COPILOT CHAT & AUTONOMOUS ENGINE ─────────────────── */}
        <aside className="w-[430px] shrink-0 flex flex-col bg-canvas-base border-r border-border z-10">

          {/* Copilot Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-canvas-surface border-b border-border">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 absolute inset-0 animate-ping opacity-75" />
              </div>
              <span className="text-xs font-bold text-paper-100 tracking-wide">AI Copilot</span>
              <span className="text-[10px] font-mono text-ink-muted bg-canvas-elevated px-2 py-0.5 rounded border border-border">
                Groq + Gemini
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPlanGate(g => !g)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  planGate
                    ? 'bg-accent/20 text-accent border-accent/40 shadow-xs'
                    : 'bg-canvas-elevated text-ink-muted border-border'
                }`}
                title={planGate ? 'Plan Gate ON (Review plan before execution)' : 'Autopilot ON (Instant execution)'}
              >
                {planGate ? '🛡 Plan' : '⚡ Auto'}
              </button>

              <button
                onClick={() => {
                  setCopilotMessages([]);
                  setPendingPlan(null);
                  setPlanTasks([]);
                  showToast('Chat history cleared', 'info');
                }}
                className="p-1.5 rounded-lg hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                title="Clear Conversation"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Planning Todo Milestones */}
          {planTasks.length > 0 && (
            <div className="p-3 bg-canvas-surface border-b border-border space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-accent tracking-wider flex items-center gap-1.5 font-mono">
                <Sparkles size={11} /> Milestone Tasks
              </span>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {planTasks.map((t, idx) => (
                  <TaskStepItem key={idx} step={t} index={idx} />
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages Scroll Container */}
          <div ref={endRef} className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Empty State: Linear/Cursor Style Hero Starters */}
            {copilotMessages.length === 0 && !pendingPlan && (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-canvas-surface border border-border shadow-surface-card text-center space-y-2">
                  <div className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center bg-accent/10 text-accent border border-accent/20 shadow-glow-sm">
                    <Sparkles size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-paper-100 tracking-tight">What would you like to build?</h3>
                  <p className="text-xs text-ink-muted leading-relaxed font-sans">
                    Describe any fullstack web app in plain English or Hindi. Copilot will architect, code, test, and render live preview automatically.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted px-1 font-mono">
                    Try asking Copilot:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Hospital Appointment Booking with Doctor Filters',
                      'Crypto Trading Simulator with Live Portfolio',
                      'Space Rocket Launch Tracker with Timers',
                      'Restaurant Food Delivery with Slide-Over Cart'
                    ].map((promptText, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(promptText)}
                        className="text-left text-xs px-3 py-2 rounded-lg bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer shadow-xs"
                      >
                        ✨ {promptText}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pending Plan Approval Gate */}
            {pendingPlan && (
              <div className="rounded-2xl p-4 bg-[#161a2b] border border-indigo-500/40 space-y-3 shadow-xl animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-indigo-400" /> Plan Generated
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">Approve to proceed</span>
                </div>
                <div className="space-y-1.5">
                  {pendingPlan.tasks.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-zinc-300 font-mono">
                      <span className="text-indigo-400">▸</span>
                      <span>{t.title}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 border-t border-[#23273b]">
                  <button
                    onClick={approvePlan}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Play size={12} className="fill-white" /> Approve & Build
                  </button>
                  <button
                    onClick={cancelPlan}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#1e2235] hover:bg-[#282d47] text-zinc-300 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Chat Timeline */}
            {copilotMessages.map((m, i) => {
              if (m.kind === 'thought') {
                return (
                  <div key={i} className="flex gap-2.5 items-start text-xs text-blue-300 font-mono bg-blue-950/20 p-3 rounded-2xl border border-blue-900/30">
                    <Sparkles size={13} className="text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold text-blue-400 block text-[9px] uppercase tracking-wider">{m.agent || 'Agent Thought'}</span>
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (m.kind === 'file') {
                return (
                  <div key={i} className="flex items-center gap-2 text-xs text-emerald-300 font-mono bg-emerald-950/20 px-3 py-2 rounded-xl border border-emerald-900/30">
                    <FilePlus2 size={13} className="text-emerald-400 shrink-0" />
                    <span className="truncate">📄 {m.file || m.content}</span>
                  </div>
                );
              }
              if (m.kind === 'step') {
                return (
                  <div key={i} className="flex items-center gap-2 text-xs text-indigo-300 font-mono bg-indigo-950/20 px-3 py-2 rounded-xl border border-indigo-900/30">
                    <Zap size={13} className="text-indigo-400 shrink-0" />
                    <span className="truncate">{m.content}</span>
                  </div>
                );
              }
              if (m.kind === 'screenshot') {
                return (
                  <div key={i} className="space-y-2 p-3 rounded-2xl bg-[#141724] border border-purple-500/30 shadow-xl">
                    <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                      📸 {m.message}
                    </span>
                    {m.image && m.image.length > 30 && !m.image.endsWith('undefined') && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt="Live App UI" className="rounded-xl border border-white/10 w-full object-cover shadow-md" />
                    )}
                  </div>
                );
              }
              if (m.kind === 'aistudio_card') {
                return (
                  <AiStudioResponseCard
                    key={i}
                    message={m}
                    onSelectFile={selectFile}
                    onOpenDiff={() => setDiffOpen(true)}
                    onRollback={rollbackTo}
                    onOpenPreview={() => setWorkspaceMode('preview')}
                  />
                );
              }
              if (m.role === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs leading-relaxed bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20 font-medium">
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (!m.content || !m.content.trim()) {
                return null;
              }
              return (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div
                    className="max-w-[90%] px-4 py-3 rounded-2xl rounded-tl-xs text-xs leading-relaxed bg-canvas-surface border border-border text-paper-200 space-y-1 shadow-md"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(m.content || '')) }}
                  />
                </div>
              );
            })}
          </div>

          {/* Floating Prompt Composer */}
          <div className="p-3 bg-canvas-surface border-t border-border">
            <div className="relative rounded-xl bg-canvas-elevated border border-border focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/10 transition-all shadow-surface-card flex flex-col">
              <textarea
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (copilotInput.trim() && !running) handleSend();
                  }
                }}
                rows={2}
                placeholder="Ask AI Dost to build, edit files, or debug errors..."
                className="w-full bg-transparent px-3.5 pt-3 pb-2 text-xs text-paper-100 placeholder:text-ink-muted focus:outline-none resize-none font-sans leading-relaxed"
              />

              {/* Footer toolbar inside box */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-canvas-surface/50 rounded-b-xl">
                {/* Quick Context / Tool Chips */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className={`p-1.5 rounded-md flex items-center justify-center cursor-pointer transition-all ${
                      isListening
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                        : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated'
                    }`}
                    title="Hands-free voice prompt (Hindi / Hinglish / English)"
                  >
                    {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSend('Show active files context')}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                  >
                    <Paperclip className="w-3 h-3 text-ink-muted" />
                    <span>Context</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTerminalOpen(!terminalOpen)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                  >
                    <TerminalIcon className="w-3 h-3 text-ink-muted" />
                    <span>Terminal</span>
                  </button>
                </div>

                {/* Submit Action */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-muted font-mono hidden sm:inline-flex items-center gap-0.5">
                    <span>Return</span>
                    <CornerDownLeft className="w-2.5 h-2.5" />
                  </span>
                  <button
                    onClick={() => handleSend()}
                    disabled={!copilotInput.trim() || running}
                    className="w-7 h-7 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-30 disabled:hover:bg-accent text-white flex items-center justify-center transition-all shadow-glow-sm cursor-pointer"
                  >
                    {running ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp className="w-4 h-4 stroke-[2.5]" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT PANE: WORKSPACE (Code Editor OR Live Preview) ──────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-canvas-base">

          {/* When in CODE EDITOR mode */}
          {workspaceMode === 'code' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Workspace Tabs & Rail Toggle */}
              <div className="flex items-center bg-canvas-subtle border-b border-border">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="px-2.5 h-8 border-r border-border text-ink-muted hover:text-paper-100 hover:bg-canvas-surface cursor-pointer transition-fast flex items-center justify-center flex-shrink-0"
                  title={sidebarOpen ? 'Hide Files' : 'Show Files'}
                >
                  <FolderTree size={14} />
                </button>
                <WorkspaceTabs
                  tabs={openTabs}
                  activePath={activePath}
                  modifiedPaths={dirtyPaths}
                  onSelectTab={selectFile}
                  onCloseTab={closeTab}
                  onNewTab={() => handleCreateFile()}
                  className="flex-1 min-w-0 border-b-0"
                />
              </div>

                {/* Editor Breadcrumb & Toolbar */}
                {activePath && (
                  <EditorToolbar
                    activePath={activePath}
                    isModified={dirtyPaths.has(activePath)}
                    isSaving={saving}
                    onSave={saveActiveFile}
                    onFormat={() => formatFile(activePath)}
                    onTogglePreview={() => setWorkspaceMode(workspaceMode === 'preview' ? 'code' : 'preview')}
                    showPreview={workspaceMode === 'preview'}
                    onToggleDiff={() => setDiffModalOpen(true)}
                    showDiff={diffModalOpen}
                    onAiAction={(action) => handleSend(`${action === 'explain' ? 'Explain how' : action === 'fix' ? 'Find and fix bugs in' : 'Refactor'} ${activePath}`)}
                  />
                )}

                {/* Editor + File Tree Split */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                  {/* File Explorer Panel */}
                  {sidebarOpen && (
                    <FileExplorer
                      files={files}
                      activePath={activePath}
                      onSelectFile={selectFile}
                      onCreateFile={handleCreateFile}
                      onCreateFolder={handleCreateFolder}
                      onDeleteFile={handleDelete}
                      onRefresh={loadWorkspaceFiles}
                      loading={loadingFiles}
                      className="w-56 flex-shrink-0"
                    />
                  )}

                  {/* Monaco Editor Container */}
                  <div className="flex-1 min-h-0 relative bg-canvas-base">
                    {activePath ? (
                      <MonacoEditor
                        height="100%"
                        language={activeLang}
                        value={activeContent}
                        onMount={handleEditorMount}
                        onChange={(v) => {
                          if (!activePath) return;
                          setFileContent(activePath, v || '');
                          markDirty(activePath);
                          runDiagnostics(activePath, v || '');
                        }}
                        theme="aidost-dark"
                        options={{
                          automaticLayout: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          padding: { top: 12 },
                          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                        }}
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center gap-3 text-xs text-ink-muted select-none">
                        <Code2 size={28} className="text-ink-muted/40" />
                        <p>Select a file from the explorer on the left</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Integrated Terminal Dock */}
                {terminalOpen && (
                  <div className="h-48 shrink-0 flex flex-col bg-canvas-base border-t border-border">
                    <div className="flex items-center justify-between px-3 py-1 bg-canvas-subtle border-b border-border text-xs font-mono">
                      <span className="text-xs font-semibold text-paper-200 uppercase tracking-wider flex items-center gap-1.5">
                        <TerminalIcon size={13} className="text-accent-primary" /> Terminal
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={runSingleFile}
                          className="px-2 py-0.5 rounded-xs text-[10px] font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 border border-border cursor-pointer transition-fast"
                        >
                          <Play size={10} className="inline mr-1" /> Run File
                        </button>
                        <button
                          onClick={() => terminalRef.current?.clear()}
                          className="p-1 rounded-xs hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 cursor-pointer transition-fast"
                          title="Clear Terminal"
                        >
                          <Eraser size={13} />
                        </button>
                        <button
                          onClick={() => setTerminalOpen(false)}
                          className="p-1 rounded-xs hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 cursor-pointer transition-fast"
                          title="Close Terminal"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0">
                      <TerminalPanel innerRef={terminalRef} projectId={projectId} projectPath="" />
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* When in LIVE PREVIEW mode (Linear / Vercel style full browser) */}
          {workspaceMode === 'preview' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-canvas-base">

              {/* Browser Address Bar & Device Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-canvas-surface border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-accent uppercase tracking-wider font-mono">
                    <Eye size={14} /> Preview
                  </span>

                  {/* Dev Server Live Status Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-canvas-base border border-border text-[11px] font-mono">
                    {devServerStatus.state === 'READY' ? (
                      <span className="flex items-center gap-1.5 text-signal-success font-medium">
                        <span className="w-2 h-2 rounded-full bg-signal-success animate-pulse" />
                        Live Dev Server (:{devServerStatus.hostPort || '5173'})
                      </span>
                    ) : devServerStatus.state === 'STARTING' || devServerStatus.state === 'CREATING' ? (
                      <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                        <Loader2 size={12} className="animate-spin" />
                        Booting ({devServerStatus.state})...
                      </span>
                    ) : devServerStatus.state === 'FAILED' ? (
                      <span className="flex items-center gap-1.5 text-signal-danger font-medium">
                        <span className="w-2 h-2 rounded-full bg-signal-danger" />
                        Server Error
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink-muted">
                        <span className="w-2 h-2 rounded-full bg-ink-muted" />
                        Server Idle
                      </span>
                    )}
                  </div>

                  {/* Dev Server Actions */}
                  <div className="flex items-center gap-1">
                    {devServerStatus.state !== 'READY' && (
                      <button
                        onClick={handleStartDevServer}
                        disabled={devServerLoading}
                        className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer flex items-center gap-1"
                        title="Start Real Dev Server"
                      >
                        <Play size={11} className="fill-emerald-500" /> Start Server
                      </button>
                    )}
                    {devServerStatus.state === 'READY' && (
                      <>
                        <button
                          onClick={handleRestartDevServer}
                          disabled={devServerLoading}
                          className="px-2 py-1 rounded-md text-[10px] font-medium bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-all cursor-pointer flex items-center gap-1"
                          title="Restart Dev Server"
                        >
                          <RotateCcw size={11} /> Restart
                        </button>
                        <button
                          onClick={handleStopDevServer}
                          className="px-2 py-1 rounded-md text-[10px] font-medium bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/30 hover:bg-red-500/25 transition-all cursor-pointer flex items-center gap-1"
                          title="Stop Dev Server"
                        >
                          <Square size={11} className="fill-red-500" /> Stop
                        </button>
                      </>
                    )}
                  </div>

                  {/* Responsive Device Switcher */}
                  <div className="flex items-center bg-canvas-base rounded-lg p-0.5 border border-border">
                    <button
                      onClick={() => setPreviewDevice('desktop')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        previewDevice === 'desktop' ? 'bg-accent text-white font-semibold' : 'text-ink-muted hover:text-paper-100'
                      }`}
                    >
                      <Monitor size={12} /> Desktop
                    </button>
                    <button
                      onClick={() => setPreviewDevice('tablet')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        previewDevice === 'tablet' ? 'bg-accent text-white font-semibold' : 'text-ink-muted hover:text-paper-100'
                      }`}
                    >
                      <Tablet size={12} /> Tablet
                    </button>
                    <button
                      onClick={() => setPreviewDevice('mobile')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        previewDevice === 'mobile' ? 'bg-accent text-white font-semibold' : 'text-ink-muted hover:text-paper-100'
                      }`}
                    >
                      <Smartphone size={12} /> Mobile
                    </button>
                  </div>

                  <button
                    onClick={() => setInspectorActive(!inspectorActive)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                      inspectorActive
                        ? 'bg-amber-500/20 text-amber-500 dark:text-amber-300 border-amber-500/40'
                        : 'bg-canvas-subtle text-ink-muted border-border hover:text-paper-100 hover:border-border-strong'
                    }`}
                  >
                    <Crosshair size={12} /> Inspect UI
                  </button>
                </div>

                {/* Simulated URL Path Bar */}
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-canvas-base border border-border text-[11px] font-mono text-ink-muted max-w-xs truncate">
                  <span className="w-2 h-2 rounded-full bg-signal-success" />
                  <span className="text-ink-muted">/api/preview/</span>
                  <span className="text-paper-100 truncate">{projectId || 'workspace'}</span>
                </div>

                {/* Actions: Source Mode, Visual QA, Refresh & Popout */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPreviewSourceMode(m => m === 'live' ? 'mock' : 'live')}
                    className="px-2 py-1 rounded-md text-[10px] font-medium bg-canvas-subtle hover:bg-canvas-elevated text-paper-100 border border-border transition-colors cursor-pointer"
                    title="Toggle Live Server Proxy vs In-Browser Babel"
                  >
                    Mode: {previewSourceMode === 'live' ? '⚡ Live Proxy' : '🎨 In-Browser'}
                  </button>

                  <button
                    onClick={() => setVisualDebuggerOpen(prev => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      visualDebuggerOpen
                        ? 'bg-accent/20 text-accent border-accent/40'
                        : 'bg-canvas-subtle hover:bg-canvas-elevated text-paper-100 border-border'
                    }`}
                    title="Visual QA Auto-Debugger"
                  >
                    <Eye size={12} className="text-accent" /> Visual QA
                  </button>

                  <button
                    onClick={() => {
                      if (iframeRef.current) {
                        if (previewSourceMode === 'live') {
                          iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
                        } else {
                          iframeRef.current.srcdoc = generateLiveAppHtml(files, contents, inspectorActive);
                        }
                      }
                      showToast('Preview refreshed', 'info');
                    }}
                    className="p-1.5 rounded-md bg-canvas-subtle hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 border border-border transition-colors cursor-pointer"
                    title="Reload Preview"
                  >
                    <RefreshCw size={13} />
                  </button>

                  <button
                    onClick={() => window.open(`/api/preview/${projectId}`, '_blank')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-canvas-subtle hover:bg-canvas-elevated text-paper-100 border border-border transition-colors cursor-pointer"
                  >
                    <ExternalLink size={12} className="text-accent" /> Open in Tab
                  </button>
                </div>
              </div>

              {/* Visual QA Inspector Drawer */}
              {visualDebuggerOpen && (
                <div className="px-4 py-2 bg-canvas-base border-b border-border animate-in fade-in">
                  <VisualDebugger
                    iframeRef={iframeRef}
                    onTriggerFix={(p) => handleSend(p)}
                    isRepairing={running}
                  />
                </div>
              )}

              {/* Preview Viewport Canvas */}
              <div className="flex-1 min-h-0 flex items-center justify-center p-4 lg:p-6 bg-canvas-base overflow-auto">
                <div
                  className="h-full bg-canvas-surface rounded-xl overflow-hidden shadow-surface-card border border-border transition-all duration-300"
                  style={{
                    width: previewDevice === 'mobile' ? 375 : previewDevice === 'tablet' ? 768 : '100%',
                  }}
                >
                  <iframe
                    ref={iframeRef}
                    src={previewSourceMode === 'live' ? `/api/preview/${projectId}` : undefined}
                    srcDoc={previewSourceMode === 'mock' ? generateLiveAppHtml(files, contents, inspectorActive) : undefined}
                    className="w-full h-full border-0 bg-canvas-surface"
                    title="Live App"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── 3. FLOATING MODALS & OVERLAYS ──────────────────────────────────────── */}
      {/* Ctrl+K Floating Inline AI Prompt Box */}
      {inlineEditOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-[#12141e] border border-indigo-500/40 rounded-2xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Cursor-Style Inline AI (Ctrl+K)</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">{activePath || 'active file'}</span>
            </div>
            <form onSubmit={handleInlineEditSubmit} className="flex gap-2">
              <input
                autoFocus
                value={inlineEditPrompt}
                onChange={(e) => setInlineEditPrompt(e.target.value)}
                placeholder="e.g. Add validation, optimize logic, make responsive..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!inlineEditPrompt.trim() || inlineEditLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 disabled:opacity-40 cursor-pointer"
              >
                {inlineEditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Apply
              </button>
              <button
                type="button"
                onClick={() => setInlineEditOpen(false)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Esc
              </button>
            </form>
            <div className="flex justify-between items-center text-[10px] text-zinc-500">
              <span>Surgically edits selected code block</span>
              <span>Enter = Apply • Esc = Cancel</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Project Architect Wizard Modal */}
      <ProjectWizardModal
        isOpen={wizardOpen}
        initialPrompt={wizardInitialPrompt}
        onClose={() => setWizardOpen(false)}
        onBuildProject={handleWizardBuild}
      />

      {/* Diff Review Modal */}
      {diffOpen && latestRunId && (
        <DiffReviewModal
          isOpen={diffOpen}
          onClose={() => setDiffOpen(false)}
          runId={latestRunId}
          onReverted={loadWorkspaceFiles}
        />
      )}

      {/* ── 4. STATUS BAR ──────────────────────────────────────────────────────── */}
      <footer className="h-6 shrink-0 flex items-center justify-between px-4 bg-canvas-surface border-t border-border text-[10px] text-ink-muted font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-paper-200">
            <GitBranch size={12} className="text-accent" /> main
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {activePath ? activePath : 'No active file'}
          </span>
          <span className="uppercase">{activeLang}</span>
          <span className={problems > 0 ? 'text-amber-500 font-bold' : 'text-ink-muted'}>
            {problems > 0 ? `⚠ ${problems} problems` : '✓ 0 errors'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-ink-muted flex items-center gap-1">
            <Zap size={10} className="text-emerald-500" /> Groq + Gemini Cascade
          </span>
          <span>UTF-8</span>
          <span className="text-paper-200">AI-Dost v3.0</span>
        </div>
      </footer>
    </div>
  );
}